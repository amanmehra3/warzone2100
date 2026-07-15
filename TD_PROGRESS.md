# Siege Protocol — Progress Tracker
Plan: TOWER_DEFENSE_PLAN.md | Branch: claude/tower-defense-game-concept-ree0e6

## Leg status
| Leg | Status | Session date | Notes |
|-----|--------|--------------|-------|
| 0.1 | ✅ | 2026-07-14 | Native Ubuntu 24.04 build (Release, Ninja) + headless smoke test; see doc/tower-defense/VERIFY.md |
| 0.2 | ✅ | 2026-07-15 | Lint recipe + headless custom-rules launch proven via `--skirmish` tests JSON; see VERIFY.md §5–§6 |
| 1.1 | ☐ | | |
| 1.2 | ☐ | | |
| 1.3 | ☐ | | |
| 1.4 | ☐ | | |
| 2.1 | ☐ | | |
| 2.2 | ☐ | | |
| 2.3 | ☐ | | |
| 3.1 | ☐ | | |
| 3.2 | ☐ | | |
| 4.1 | ☐ | | |
| 4.2 | ☐ | | |
| 4.3 | ☐ | | |
| 5.1 | ☐ | | |
| 5.2 | ☐ | | |
| 5.3 | ☐ | | |
| 5.4 | ☐ | | |
| 6.1 | ☐ | | |
| 6.2 | ☐ | | |

## Decision Log
<!-- date | leg | decision | why -->
- 2026-07-14 | 0.1 | SDL3 3.4.4 built from source via `git clone --branch release-3.4.4` instead of the release tarball used by `.ci/sdl3/install_sdl3.sh` | Container egress proxy blocks GitHub release-asset downloads (403) but allows git clone; same pinned version and identical CMake flags as the upstream script.
- 2026-07-14 | 0.1 | Configured with env `WZ_CI_DISABLE_BASIS_COMPRESS_TEXTURES=ON`; no CMake feature flags disabled (`-G Ninja -DCMAKE_BUILD_TYPE=Release` only) | Prebuilt `high.wz` texture-pack download is a blocked GitHub release asset and local basis encoding is very slow; upstream CI uses the same env switch. Videos/discord-rpc did not need disabling (not enabled by default on Linux).
- 2026-07-14 | 0.1 | Nested submodule `3rdparty/GameNetworkingSockets/src/external/webrtc` left uninitialized; abseil/picojson nested submodules fixed up to pinned SHAs manually | `webrtc.googlesource.com` is blocked by the egress proxy; the module is unused (`USE_STEAMWEBRTC` defaults OFF). Its clone failure aborts the recursive submodule update mid-way, leaving GNS's other nested submodules on wrong commits — fix-up commands are in VERIFY.md §1.4.
- 2026-07-14 | 0.1 | Canonical smoke test = `--skirmish=highground.json --autogame --headless --nosound` using the repo's existing `data/mp/tests/highground.json` fixture (pattern from `tests/test.sh`) | Plan §2.5 suggested `--autogame --headless` needed extra flags to start a skirmish; `--skirmish=<file>` is that flag. Headless autogame is unthrottled, so a full AI-vs-AI match completes and exits 0 in <1 min — stronger signal than a 2-min tick. A 1–2 min variant (`miza.json`) was also verified.
- 2026-07-14 | 0.1 | No root `.gitignore` change | `/build` already ignored (existing entry).
- 2026-07-14 | 0.1 | Three recurring non-fatal `Assert in Warzone` info-lines documented as known-benign (resource_loading_controller.h:196, hci.cpp:398, spectatorgameoverscreen.cpp:65) | Present with unmodified sources in headless/spectator flow; exit code stays 0. Listed in VERIFY.md so later legs don't misread them as regressions.

- 2026-07-15 | 0.2 | ESLint config needed NO change: `eslint.config.mjs` `files: ["**/*.js"]` already covers `data/mp/challenges/**/*.js` (verified with a throwaway probe file that triggered no-eval/no-console) | Minimal-diff rule; only a local `npm install --no-save` of eslint+plugins is needed (command in VERIFY.md §5).
- 2026-07-15 | 0.2 | Added `/node_modules/` to root `.gitignore` | The local eslint install lives at repo root (flat-config plugin imports must resolve from the config file's directory); without the ignore entry a later `git add -A` would stage thousands of dependency files. Smallest safe guard; not a game file.
- 2026-07-15 | 0.2 | **Headless challenge-rules launch: YES, via `--skirmish=<name>.json`** pointing at a JSON in `data/mp/tests/` containing `"scripts": { "rules": ... }`. Empirically proven: custom rules replaced default rules (`Destroying [0]:tests/td_probe_rules`), `eventGameInit`/`eventStartLevel` fired, `setTimer` ticks ran, all visible via JS `debug()` → stderr. `--autohost` uses the identical code path (prefix `autohost/`) but is built for hosting real network games — `--skirmish` + `--autogame` is the right harness | All three launchers share `loadMapChallengeAndPlayerSettings` (src/multiint.cpp ~555); each prefixes `scripts.rules` with its own dir.
- 2026-07-15 | 0.2 | **Correction to plan §2.4:** a challenge's `scripts.rules` value is resolved relative to `challenges/` (engine prepends the prefix), so td-outpost.json must use `"rules": "towerdefense/td_rules.js"`, NOT `"challenges/towerdefense/td_rules.js"`. Same for tests JSONs (prefix `tests/`) | Read directly from the loader code; the doc/Scripting.md example (`"rules": "towerdefense.js"`) is consistent with this.
- 2026-07-15 | 0.2 | Harness pattern for later legs: tracked `data/mp/tests/td-harness.json` + one-line shim rules file that does `include("challenges/towerdefense/td_rules.js")`; `include()` resolves data-root-relative paths first (src/wzapi.cpp loadFileForInclude) — proven with probes | Lets the headless harness exercise the *real* challenge scripts without duplicating them.
- 2026-07-15 | 0.2 | `--datadir="$(pwd)/data"` (loose source tree) works for the headless harness — the engine mounts plain `mp/`/`base/` dirs as well as `.wz` archives — so TD script edits need no data rebuild | Faster iteration than re-zipping mp.wz each run.
- 2026-07-15 | 0.2 | JS `console()` is invisible headlessly (in-game console only); TD scripts must use `debug()` markers for harness verification | `debug()` writes to stderr (src/wzapi.cpp debugOutputStrings).

## Known issues / deferred
- Vulkan-Headers are auto-fetched by CMake at configure time (Ubuntu 24.04 ships v275 < required 290) — configure needs github.com git access.
- Headless challenge-launch recipe (custom `scripts.rules`) not yet established — that is Leg 0.2.
