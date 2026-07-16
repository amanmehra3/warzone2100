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

---

## 5. Linting TD scripts (Leg 0.2)

The repo's flat ESLint config `eslint.config.mjs` already matches
`data/mp/challenges/**/*.js` via its `files: ["**/*.js"]` pattern — no config
change was needed (verified empirically: a probe file with `eval`/`console.log`
in `data/mp/challenges/towerdefense/` produced `no-eval` + `no-console`
errors; a clean file exited 0).

ESLint is not vendored; install it locally once per session (creates only
`./node_modules/`, which is gitignored — no `package.json`/lockfile appears):

```sh
npm install --no-save --no-package-lock --no-audit --no-fund \
  eslint @eslint/js eslint-plugin-n eslint-plugin-prettier eslint-plugin-jsonc prettier
```

Canonical lint invocation (run from repo root; exits non-zero on any lint
error; `--no-error-on-unmatched-pattern` keeps it green while no TD scripts
exist yet):

```sh
npx eslint --config eslint.config.mjs --no-error-on-unmatched-pattern \
  "data/mp/challenges/**/*.js"
```

Verified with ESLint v10.7.0 on Node v22. (Upstream CI lints via super-linter
with the same `eslint.config.mjs`; the command above is the local equivalent.)
Note the config's relevant rules for our scripts: `no-console` is an **error**
(use the game's `console()`/`debug()` API functions, never `console.log`).

---

## 6. TD smoke test — launching custom challenge rules headlessly (Leg 0.2)

### 6.1 The finding (empirical)

**Custom `scripts.rules` scripts CAN replace the default rules and run fully
headlessly.** Mechanism: the `--skirmish=<name>.json` launcher. All three
launch paths funnel through the same code in `src/multiint.cpp`
(`loadMapChallengeAndPlayerSettings`, ~line 555): if the settings JSON has a
`scripts.rules` key, the engine calls `loadGlobalScript(path + value)` and
**skips** `multiplay/script/rules/init.js` entirely. The only difference
between launchers is the prefix `path` prepended to the `rules` value:

| Launcher | JSON location (virtual path) | `scripts.rules` value is relative to |
|---|---|---|
| Challenges menu (GUI) | `challenges/<file>.json` | `challenges/` |
| `--skirmish=<f>.json` | `tests/<f>.json` (= `data/mp/tests/`) | `tests/` |
| `--autohost=<f>` | `autohost/<f>` | `autohost/` |

**Consequence for challenge JSONs (corrects plan §2.4):** in
`data/mp/challenges/td-outpost.json`, the correct value is
`"rules": "towerdefense/td_rules.js"` (relative to `challenges/`), NOT
`"challenges/towerdefense/td_rules.js"`.

**Log visibility:** the JS `debug(...)` API writes directly to **stderr**
(`src/wzapi.cpp` `debugOutputStrings`); `console(...)` is in-game-only and
invisible headlessly. TD scripts should emit a few `debug()` markers for the
harness.

**`include()` resolution:** data-root-relative paths are tried first
(`src/wzapi.cpp` `loadFileForInclude`), so any script can
`include("challenges/towerdefense/td_waves.js")` regardless of which launcher
loaded it.

**Loose data dir:** the engine mounts plain `mp/` + `base/` directories as
well as `.wz` archives (`src/init.cpp` `rebuildSearchPath`), so
`--datadir="$(pwd)/data"` runs straight off the source tree — script edits
take effect on next launch with **no data rebuild**. (Alternative: rebuild
`mp.wz` with `cmake --build build/native --target data_mp` and use
`--datadir=$(pwd)/build/native/data`.)

### 6.2 The canonical TD harness (tracked files, created in Leg 1.1)

Two *tracked* harness files in `data/mp/tests/` mirror the real challenge but
launch via `--skirmish`:
- `data/mp/tests/td-harness.json` — mirrors `data/mp/challenges/td-outpost.json`
  but with `"scripts": { "rules": "td-harness_rules.js" }`.
- `data/mp/tests/td-harness_rules.js` — one-line shim:
  `include("challenges/towerdefense/td_rules.js");`

The pattern was proven in Leg 0.2 with throwaway probes and is now the
committed harness: the shim's include executes the real challenge-dir rules
script and all its events fire.

### 6.3 Canonical command + success markers

```sh
rm -rf /tmp/wz-td-config && mkdir -p /tmp/wz-td-config
timeout 90 ./build/native/src/warzone2100 \
  --configdir=/tmp/wz-td-config \
  --datadir="$(pwd)/data" \
  --skirmish=td-harness.json --autogame --headless --nosound \
  2>&1 | tee /tmp/td-smoke.log
grep "TD:" /tmp/td-smoke.log | head -20
```

Success = ALL of the following `TD:` markers on stderr (verified Leg 1.1):
```
TD: eventGameInit (rules=towerdefense/td_rules.js)
TD: eventStartLevel
TD: zeroed structure limits for 164 structure types
TD: enabled 6 starting tower/wall types for player 0
TD: cleared <N> structures / <N> droids for player 0     (and player 1)
TD: timers armed
TD: HQ placed at tile (52,56) id=<id>
TD: truck 1 placed at tile (50,54) id=<id>
TD: truck 2 placed at tile (55,58) id=<id>
TD: spawn points configured: 2
TD: power=1300 structLimitHQ=1 structLimitFactory=0 structLimitTower=100
TD: setup complete
TD: heartbeat tick=30 gameTime=30002        (repeating, gameTime increasing)
```
and NO lines matching `TD: ERROR`,
`could not be built due to building limits`, or `Syntax error`.
With the wave engine (Leg 1.2) the same run must also show, per wave:
```
TD-WAVE: lane 0 reach check wheeled=true tracked=true hover=true   (lane 1 too)
TD-WAVE: BUILD phase for wave N/10 (...)
TD-WAVE: wave N SPAWNING, <count> creeps queued
TD-WAVE: spawned <body>/<turret> id=... lane=... at (x,y), K left
TD-WAVE: wave N ACTIVE with <count> creeps
TD-WAVE: push check: ... lead id=... at (x,y) distHQ=<decreasing>
TD-WAVE: HARNESS auto-clear removing <count> creeps
TD-WAVE: wave N CLEARED, reward=... power=<increasing>
```
cycling through all 10 waves to `TD-WAVE: all 10 waves finished`, with no
`TD-WAVE: ERROR` lines. (Auto-clear lines come from the harness-only
`tdDebugAutoClearSecs` knob set in the tests shim; the real challenge leaves
it 0.) A 90 s wall run covers the entire 10-wave cycle headlessly.

Usually the shutdown also logs `Destroying [0]:tests/td-harness_rules` (proof
default rules were replaced), but the timeout kill can truncate shutdown
logging — treat that line as informative, not required (the
`rules=towerdefense/td_rules.js` marker already proves the same thing).

Exit code (since Leg 1.3): **`0` — the canonical run is a deterministic
pure-leak defeat.** With no towers, every creep walks in and leaks; lives go
20 → 0 during wave 4 and `gameOverMessage(false)` fires, which under
`--autogame --headless` quits cleanly. Expected economy markers:
```
TD-ECO: lives initialized to 20 (medium)
TD-ECO: LEAK id=... (Body1REC) lives=<one less each time> waveLeaks=...
TD-WAVE: wave 1 CLEARED, reward=150 bounty=0 leaks=4 lives=16 power=1568
TD-WAVE: wave 2 CLEARED, reward=180 bounty=0 leaks=6 lives=10 power=1838
TD-WAVE: wave 3 CLEARED, reward=210 bounty=0 leaks=6 lives=4 power=2138
TD-ECO: DEFEAT (lives exhausted) wave=4 lives=0
```
Exactly 20 `TD-ECO: LEAK` lines (one per life — leaks are counted exactly
once per creep). The power values are exact: +2/s during BUILD ticks only
(59 income ticks for the 60 s phase, 45 for each 45 s phase) plus wave
rewards — any drift means the economy broke. Exit `124` now indicates a
hang/regression; `134`/`139` are crashes.

Since Leg 1.4 the run also shows tier unlock markers:
`TD-TIER: tier 0 enabled (starting defenses): 4 structure types` at setup and
`TD-TIER: tier 1 enabled (...)` at the wave-3 BUILD phase (the defeat run
never reaches tiers 2/3).

**Knob variants (temporary local edits to `td-harness_rules.js`, do not
commit):**
- *Bounty path:* add `tdDebugPlaceTowers = 2;` — places two guard towers
  flanking lane B (off-path: on-path towers block the corridor and creeps
  stall out of range). Expect `TD-ECO: bounty +10 (Body1REC id=...)` lines
  and wave-end `bounty=` sums matching the power arithmetic. Script-removed
  creeps (leaks/auto-clear) never pay bounty.
- *HQ-destroyed path:* add `tdDebugKillHqTick = 150;` — expect
  `TD-ECO: HARNESS killing HQ id=...` then `TD-ECO: DEFEAT (hq destroyed)`
  with lives still > 0, and exit 0.
- *Victory path:* change `tdDebugAutoClearSecs = 60;` to `10` — creeps are
  cleared before reaching the HQ, all 10 waves pass, all four tiers unlock
  (`TD-TIER: tier 1/2/3 enabled` at waves 3/5/8) and the run ends
  `TD-ECO: VICTORY after wave 10 lives=20 power=5788` with exit 0.
- *Unlock functionality:* add `tdDebugPlaceUnlocked = 1;` with
  `tdDebugAutoClearSecs = 40;` — each newly unlocked tier is also
  script-placed on the lane-B flank (`TD-TIER: HARNESS test-place <id> ...
  OK`), and tier-1 towers score attributable combat kills (`TD-ECO: bounty`
  lines only after the wave-3 unlock). Tier-2/3 kill attribution is NOT
  achievable headlessly (artillery/heavy-AT vs fast light movers within the
  leak-timing window) — placement + enablement verify headlessly; their
  damage output needs the desktop playtest.
- *Difficulty multiplier:* temporarily set `difficultyKey: "hard"` in
  `td_rules.js` tdConfig — expect `lives initialized to 12 (hard)`, starting
  `power=1100`, and scaled spawn counts (`wave 1 SPAWNING, 6 creeps` =
  ceil(4x1.3); wave 2: 8 = 2 groups x ceil(3x1.3)).

Known-benign line in harness runs: one `Failed to load AI!` /
`openLoadFile: file multiplay/skirmish/<garbage>` error — under `--autogame`
the engine tries to auto-assign an AI to the human slot (player 0), which the
harness JSON deliberately leaves AI-less to mirror the challenge. Player 0
simply sits idle; all TD script activity proceeds.

### 6.3.1 Engine behaviors the TD scripts must respect (found empirically, Leg 1.1)

- **Limits reset after `eventGameInit`:** with a challenge active, the engine
  resets structure limits to stats defaults (`userLimits`) after
  `eventGameInit` → apply script limits in `eventStartLevel` or later.
- **`applyLimitSet()` overwrites script limits** with the lobby limit set
  (src/multilimit.cpp) → call it *before* imposing script limits.
- **`Stats.Building` is keyed by display name**, not structure ID; use
  `Stats.Building[key].Id` when calling `setStructureLimits` etc.
- **`removeObject()` only queues removal** until the current script event
  returns → `queue()` any `addStructure` that depends on a prior removal
  (e.g. replacing the map's pre-placed HQ), and mind `curCount` vs limits.
- **`addStructure()` respects structure limits** — a script cannot place a
  structure whose limit is 0 for that player.

### 6.4 What can and cannot be verified headlessly (honest statement)

**CAN be verified headlessly** (and every later leg must):
- Custom rules script loads, replaces default rules, and executes.
- All script events/timers fire; full game simulation runs (unthrottled,
  ~100× real time), including unit spawning, combat, structures, power.
- Script-observable game state, via `debug()` prints to stderr.
- Lint cleanliness of all TD scripts.

**CANNOT be verified headlessly:**
- The Challenges *menu* flow (challenge listed, description shown, clicking
  it) — GUI only. The underlying `scripts.rules` loading is the same code
  path as the verified `--skirmish` one (only the `challenges/` prefix
  differs), but the actual menu launch must be verified in a real session
  (Leg 1.1 does this; the web build legs verify it via Playwright).
- Anything visual: reticule buttons, console() text, beacons, camera.
- Human-interactive play (tower placement UX etc.).
- Headless human-player start: `--skirmish` + `--autogame` gives the local
  player an AI; a human-driven TD session is inherently non-headless.
- **Loading a save of the custom-rules game (Leg 1.2 finding):** the SAVE
  side works headlessly (`--saveandquit=savegames/skirmish/<name>.gam` from
  the harness; all `td*` globals, timers, and queued calls serialize into the
  save's `scriptstate.json` — inspected and confirmed). But a harness save
  stores `challengeFileName=""`, so `--loadskirmish=<name>` cannot re-create
  the custom rules script (`Script context ... not found`) and falls back to
  the DEFAULT rules — an engine limitation of the tests path (same reason the
  save/load lines in `tests/test.sh` are commented out). Real challenge saves
  (launched from the Challenges menu) store `challengeFileName` and the load
  path re-creates `scripts.rules` (src/game.cpp ~4722 + challenge loader) —
  code-audited, needs a desktop session to confirm end-to-end.
  Related: the engine DOES save/restore script timers and queued calls
  (scriptstate.json version 2) — the old "timers are not saved" doc note is
  outdated; TD timer arming is idempotent (removeTimer-then-setTimer) so it
  is correct under both behaviors.

### 6.5 Verification status (Leg 0.2, 2026-07-15)

- Lint probe (bad file rejected, clean file passes, challenges glob covered):
  **pass**.
- Headless custom-rules probe via `--skirmish=td_probe.json`: **pass**
  (markers above; ticks ran for the full 60 s window ≈ 106 game-minutes).
- include()-shim pattern (tests shim → challenges-dir script): **pass**.
- Throwaway probe files deleted before commit: **confirmed** (`git status`
  clean except intended files).
