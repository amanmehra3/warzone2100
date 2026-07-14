# Siege Protocol — Build & Verification Recipe (Native Linux)

Established by Sprint 0 Leg 0.1. Verified on Ubuntu 24.04 (Noble), x86_64, gcc 13.3,
CMake 3.28.3, running as root in a container. All commands are run from the repo
root (`/home/user/warzone2100` in the reference session) unless noted.

---

## 1. Dependencies

### 1.1 Distro packages (Ubuntu 24.04)

The repo's own script installs everything except SDL3:

```sh
./get-dependencies_linux.sh ubuntu build-all
```

(Prefix with `sudo` if not root. This runs `apt-get update` and installs the
compiler toolchain, ninja, cmake, and all -dev packages except SDL3, which has
no Ubuntu 24.04 package.)

### 1.2 SDL3 build dependencies + Vulkan tooling

From `.ci/sdl3/install_sdl3.sh` (the SDL3 build deps), plus `libvulkan-dev` and
`glslc` so the Vulkan backend gets compiled (optional — without `glslc` the
build simply disables the Vulkan backend):

```sh
DEBIAN_FRONTEND=noninteractive apt-get -y install \
  git pkg-config cmake ninja-build \
  gnome-desktop-testing libpulse-dev \
  libfribidi-dev libjack-dev libsndio-dev libx11-dev libxext-dev \
  libxrandr-dev libxcursor-dev libxfixes-dev libxi-dev libxss-dev libxtst-dev \
  libxkbcommon-dev libdrm-dev libgbm-dev libgl1-mesa-dev libgles2-mesa-dev \
  libegl1-mesa-dev libdbus-1-dev libibus-1.0-dev libudev-dev libthai-dev \
  libwayland-dev libdecor-0-dev liburing-dev \
  libvulkan-dev glslc
```

### 1.3 SDL3 from source (pinned 3.4.4, same as `.ci/sdl3/install_sdl3.sh`)

The upstream script downloads a release tarball from
`github.com/.../releases/download/...`, which is **blocked by this container's
egress proxy** (plain `git clone` of github.com works; release-asset downloads
return 403). Equivalent source fetch via git, using the exact same version and
CMake flags as the upstream script:

```sh
cd "$(mktemp -d)"
git clone --depth 1 --branch release-3.4.4 https://github.com/libsdl-org/SDL.git sdl3-src
cmake -S sdl3-src -B build -DSDL_DEPS_SHARED:BOOL=ON -DSDL_SHARED:BOOL=OFF \
  -DSDL_STATIC:BOOL=ON -DSDL_TEST_LIBRARY:BOOL=OFF -DSDL_ALSA:BOOL=OFF \
  -DSDL_OSS:BOOL=OFF -DSDL_X11_XTEST=OFF -DCMAKE_POSITION_INDEPENDENT_CODE=ON
cmake --build build -j"$(nproc)"
cmake --install build --prefix /usr/local     # sudo if not root
pkg-config --modversion sdl3                  # must print 3.4.4
```

### 1.4 Git submodules

```sh
git submodule update --init --recursive
```

**Expected partial failure:** the nested submodule
`3rdparty/GameNetworkingSockets/src/external/webrtc`
(`webrtc.googlesource.com`) is blocked by the egress proxy. It is **not
needed** (GNS option `USE_STEAMWEBRTC` defaults OFF). The failure aborts the
recursion into GameNetworkingSockets *after* cloning its other nested
submodules but *before* checking them out to their pinned commits, so fix them
up explicitly:

```sh
git -C 3rdparty/GameNetworkingSockets submodule update --init --force \
  src/external/abseil src/external/picojson
git status --short   # must be empty
```

---

## 2. Configure + build

```sh
export WZ_CI_DISABLE_BASIS_COMPRESS_TEXTURES=ON   # see note below
cmake -S . -B build/native -G Ninja -DCMAKE_BUILD_TYPE=Release
cmake --build build/native -j"$(nproc)"
```

CMake flags used (complete list):
- `-G Ninja`
- `-DCMAKE_BUILD_TYPE=Release`
- env `WZ_CI_DISABLE_BASIS_COMPRESS_TEXTURES=ON` — skips basis-universal
  texture compression / prebuilt `high.wz` download (that download URL is a
  GitHub release asset, blocked by the egress proxy; without the env var the
  build would fall back to a very slow local texture encode). Same switch the
  upstream CI workflows use. Textures ship uncompressed; fine for testing,
  *not* for distributable packages.

No optional features had to be disabled: videos are not part of the Linux
build by default, `ENABLE_DISCORD` already defaults OFF, Vulkan backend builds
(CMake auto-fetches Vulkan-Headers ≥290 via git FetchContent because Ubuntu
24.04 ships only v275 — needs github.com git access at configure time).

Notes:
- `build/` is already covered by the root `.gitignore` (`/build`, line ~167) —
  no gitignore change was needed.
- Full build is ~700 ninja targets; ~35 min on 4 cores.

Build outputs:
- binary: `build/native/src/warzone2100`
- packaged game data: `build/native/data/` (`base.wz`, `mp.wz`, …)

### 2.1 Version check

```sh
./build/native/src/warzone2100 --version
```

Expected output (branch/hash/date vary):

```
Warzone 2100 - Version: claude/tower-defense-game-concept-ree0e6 0a84faa, (modified locally) Built: 2026-07-14
```

---

## 3. Headless smoke test (canonical)

Uses the repo's own skirmish test fixture `data/mp/tests/highground.json`
(2 AIs fight on Sk-HighGround; `--skirmish=X.json` resolves to the virtual
path `tests/X.json` — see `src/multiint.cpp` `ininame = "tests/" + ...`).
Headless autogame runs unthrottled, so a full AI-vs-AI match completes in well
under a minute of wall time and the process **exits on its own with code 0**.

```sh
rm -rf /tmp/wz-smoke-config && mkdir -p /tmp/wz-smoke-config
timeout 150 ./build/native/src/warzone2100 \
  --configdir=/tmp/wz-smoke-config \
  --datadir="$(pwd)/build/native/data" \
  --skirmish=highground.json --autogame --headless --nosound
echo "exit code: $?"
```

(`--configdir` may be any empty writable dir; using a throwaway keeps the run
deterministic. The `timeout 150` is a safety net only — expected wall time is
20–60 s.)

**Success = ALL of the following:**
1. Exit code `0` (printed by the `echo`). A `timeout` kill would print `124`;
   a crash prints `134`/`139`.
2. Early stdout banner:
   ```
    * Warzone 2100 - Headless Mode
   ```
3. `loading: multiplay/maps/2c-highground.gam` appears.
4. Repeated game-loop stat blocks — this is the "game loop is ticking" marker
   (emitted ~every 5 s of game time by `stdOutGameSummary()`):
   ```
   Game State [gameTime: ...]
    # | Player Name | Extrct Pwr | Units Killed | Structs (F/R) | Units Alive |  Power  |
   ```
   with gameTime strictly increasing across blocks.
5. Near the end: `Game ended (duration: ...)` (one AI won).
6. No fatal errors: nothing matching `Fatal`, `Segmentation`, `double free`.

A longer-running variant (8-player free-for-all, ~1–2 min wall time,
otherwise identical semantics): replace `--skirmish=highground.json` with
`--skirmish=miza.json`.

### Known benign log lines (do NOT treat as failures)

These non-fatal `Assert in Warzone` info-lines are upstream behavior in
headless/spectator mode, present on unmodified sources, and do not affect the
run or exit code:
- `resource_loading_controller.h:196 (!active())` — once during startup.
- `hci.cpp:398 ((ButId >= 0) && (ButId < NUMRETBUTS))` / `Invalid ButId: 7` —
  when the losing human slot is converted to a spectator at game end.
- `spectatorgameoverscreen.cpp:65 (!MissionResUp && ...)` — at game-over
  screen handling.

---

## 4. Verification status (Leg 0.1, 2026-07-14)

- `--version` check: **pass** (output above, exit 0).
- `highground.json` smoke test: **pass** — full match, exit 0, all markers.
- `miza.json` 8-player variant: **pass** — full match in ~55 s wall, exit 0,
  12 `Game State` blocks, only the known benign asserts.

The TD-specific smoke test (launching a *challenge* with custom
`scripts.rules` headlessly) is Leg 0.2's deliverable and will be added below
when established.
