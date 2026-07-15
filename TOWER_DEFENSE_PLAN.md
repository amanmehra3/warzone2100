# Warzone 2100: Siege Protocol — Tower Defense Mode
## End-to-End Multi-Sprint Execution Plan

> **Purpose of this document.** This is the master execution plan for building a tower
> defense (TD) spin of Warzone 2100, playable on phones via the existing web/WASM port.
> It is written to be executed leg-by-leg by implementation agents (Claude Sonnet
> sessions). Each leg is a self-contained prompt with context, tasks, acceptance
> criteria, and verification steps. **Every implementation session must read
> §1 (Operating Rules) and §2 (Repo Cheat Sheet) before starting its leg.**

---

## 0. Product Vision & Design Spec

**Working title:** *Warzone 2100: Siege Protocol*

**Elevator pitch:** Waves of enemy machines advance across the map toward your
Command Center. You have no army — only construction trucks, power, and the full
Warzone 2100 arsenal of defensive emplacements. Build, upgrade, and survive all waves.

### 0.1 Core loop
1. Between waves: a countdown timer runs. Player places/upgrades towers using power.
2. Wave spawns: scripted attacker units enter at fixed spawn points and attack-move
   toward the player's Command Center (HQ).
3. Kills grant power (bounty). Enemies that reach the HQ zone are removed and cost a life.
4. Wave milestones unlock higher-tier towers automatically.
5. Survive the final wave → victory. Lives reach 0 → defeat.

### 0.2 Mechanics mapping (Warzone concept → TD concept)
| Warzone 2100 | Siege Protocol |
|---|---|
| Defensive structures (guard towers, emplacements, hardpoints, AA sites) | Towers |
| Power | Gold/currency (bounty per kill + small passive trickle) |
| Command Center HQ | The "base" creeps try to reach |
| Research tiers | Tower tier unlocks (automatic, at wave milestones) |
| Droid templates (bodies × propulsion × turrets) | Creep variety (fast/tanky/air/boss) |
| Construction trucks | Builders (kept in v1 — preserves the Warzone feel) |
| Challenge system | Delivery vehicle: each TD map ships as a challenge |

### 0.3 Hard design decisions (do NOT relitigate these in implementation legs)
- **D1.** Player is always `player 0` (human, team 0). Attacker is `player 1`
  ("SIEGE", team 1, `"ai": null` in the challenge file — fully script-driven).
  Scavengers off. All other player slots closed.
- **D2.** Pure JavaScript + JSON + existing assets for Sprints 0–4. **No C++/engine
  changes before Sprint 5** (mobile touch input). No new art assets anywhere.
- **D3.** Creeps use attack-move (`DORDER_SCOUT`) toward the HQ so they fight through
  defenses rather than pathing around them. Leaks are detected by proximity polling,
  not map labels (bundled skirmish maps have no label support).
- **D4.** Towers are built by trucks (native Warzone building flow) in v1.
  A tap-to-place instant-build option is a Sprint 5 stretch goal, not a v1 mechanic.
- **D5.** Tier unlocks are automatic at wave milestones via `completeResearch`/
  `enableStructure`. No research labs, no factories, no player unit production.
- **D6.** Ship as challenges in `data/mp/challenges/` with a shared rules engine in
  the same directory, per the challenge `scripts.rules` mechanism documented in
  `doc/Scripting.md`. Three maps at launch, three difficulty tiers each.
- **D7.** Phone delivery = the existing Emscripten web build served as a PWA
  (GitHub Pages from this fork). Native Android/iOS is explicitly out of scope.
- **D8.** Everything stays GPL-2.0+ compatible (this is a hard license requirement).

---

## 1. Operating Rules for Implementation Sessions (READ FIRST)

1. **Branch:** all work happens on `claude/tower-defense-game-concept-ree0e6`.
   Never push to any other branch. Push with `git push -u origin <branch>`
   (retry up to 4× with 2s/4s/8s/16s backoff on network failure only).
2. **One leg per session.** Execute exactly the leg you were asked to run.
   If a previous leg's deliverable is missing, stop and report — do not silently
   re-implement earlier legs.
3. **Read before you write.** Each leg lists "Context to load". Read those files
   first. Also read `TD_PROGRESS.md` at repo root to see what's done.
4. **Update `TD_PROGRESS.md`** at the end of your leg: mark the leg done, note any
   deviations from this plan, and record decisions in its Decision Log section.
5. **Commit style:** one or more commits, message format
   `td(sprint<S>.<L>): <imperative summary>`, e.g. `td(1.2): add wave spawner engine`.
6. **Verification is mandatory.** Run the leg's verification steps and paste the
   results into your final report. If verification cannot run (e.g. build broken by
   an earlier leg), report that instead of claiming success.
7. **Do not modify** existing game files (default `rules.js`, existing challenges,
   stats JSON, engine C++) unless the leg explicitly says to. Sprints 0–4 add new
   files only, with the narrow exceptions each leg lists.
8. **Plan deviations:** if the plan's assumption is wrong (an API doesn't behave as
   documented, a file doesn't exist), fix forward with the smallest change that
   preserves the design decisions in §0.3, and log it in `TD_PROGRESS.md`.
9. All temporary/experiment files go in your session scratchpad, never the repo.

---

## 2. Repo Cheat Sheet (verified facts — trust these)

### 2.1 Layout
- `data/mp/challenges/` — challenge JSON files (e.g. `hidebehind.json`); this is
  where our challenge JSONs and rules scripts live. Loader: `src/challenge.cpp`
  (searches the `challenges` virtual dir).
- `data/mp/multiplay/skirmish/` — AI scripts + JSON descriptors.
- `data/mp/multiplay/script/rules/` — the default game rules (`init.js`, `setupgame.js`,
  `endconditions.js`, etc.). Our custom `scripts.rules` **replaces** these entirely —
  we own win/lose, starting state, everything.
- `data/mp/multiplay/maps/` — 95 bundled skirmish maps (e.g. `2c-DustyMaze`,
  `Sk-MizaMaze` — the latter is referenced by the existing `hidebehind.json` challenge).
- `data/mp/stats/structure.json` — structure stats; 124 entries with `"type": "DEFENSE"`.
  Verified tower IDs include: `GuardTower1`…`GuardTower6`, `GuardTower-RotMg`,
  `GuardTower-ATMiss`, `GuardTower-BeamLas`, `GuardTower-Rail1`,
  `Emplacement-MortarPit01`, `Emplacement-MRL-pit`, `Emplacement-HvyATrocket`,
  `Emplacement-PulseLaser`, `Emplacement-Rail2`, `Emplacement-PlasmaCannon`,
  `Emplacement-Howitzer105`, `AASite-QuadMg1`, `AASite-QuadBof`, `CoolingTower` (decor).
- `data/mp/stats/templates.json` — 280 droid templates. Format example:
  `"A-Cobra-Trk-HMG": { name: "Heavy Machinegun Cobra Tracks", body: "Body5REC",
  propulsion: "tracked01", weapons: ["MG3Mk1"] }`.
- `doc/Scripting.md`, `doc/js-functions.md`, `doc/js-events.md`, `doc/js-objects.md`,
  `doc/js-globals.md` — the scripting API reference. **Authoritative.**
- `platforms/emscripten/` — web port (shell.html, PWA manifest, service worker config,
  `README-build.md` with exact build steps).
- `.github/workflows/CI_emscripten.yml` and `.github/workflows/publish_web_build.yml`
  — existing CI for building/publishing the web edition.
- `eslint.config.mjs` — repo-level ESLint config for the game's JS scripts.
- `lib/sdl/main_sdl.cpp` — SDL input layer; already tracks multi-touch fingers
  (`TrackedFinger`, `inputHandleTouchFingerEvent` around line 1575).

### 2.2 Key scripting API (signatures verified against `doc/js-functions.md`)
- `addDroid(player, x, y, templateName, body, propulsion, reserved, reserved, turrets...)`
  → returns the created droid. Coordinates in **tiles**.
- `addStructure(structureName, player, x, y[, direction])` → coordinates in **world
  units**: pass `tileX*128, tileY*128`.
- `setStructureLimits(structureName, limit[, player])`, `enableStructure(structureName[, player])`
- `completeResearch(researchName[, player[, forceResearch]])`, `enableResearch(...)`
- `setPower(power[, player])`, `playerPower(player)`, `setPowerModifier(mod[, player])`,
  `setPowerStorageMaximum(max[, player])`
  — bounty pattern: `setPower(playerPower(0) + bounty, 0)`.
- `setTimer("fnName", ms)`, `queue("fnName"[, ms[, object]])` — timers call functions
  **by name string**.
- `orderDroidLoc(droid, order, x, y)` with `DORDER_SCOUT` (attack-move) / `DORDER_MOVE`.
- `enumDroid(player[, type])`, `enumStruct(player[, type])`, `distBetweenTwoPoints(...)`.
- `removeObject(object[, sfx])` — use for leaked creeps.
- `gameOverMessage(gameWon[, showBackDrop[, showOutro]])` — ends the game.
- `setMissionTime(time)`, `centreView(x, y)`, `setScrollLimits(x1, y1, x2, y2)`,
  `setDroidLimit(player, max[, droidType])`,
  `setReticuleButton(buttonId, tooltip, filename, filenameDown[, callback])`,
  `console(...)` for on-screen messages, `playSound(...)`, `addBeacon(x, y, player[, msg])`.
- `include(file)` — include another script file (used heavily by existing AIs).
- Events: `eventGameInit()` (setup, before objects exist is NOT guaranteed — treat as
  early init), `eventStartLevel()` (main entry), `eventGameLoaded()` (savegame resume),
  `eventDroidBuilt(droid[, structure])`, `eventStructureBuilt(structure[, droid])`,
  `eventDestroyed(object)`, `eventAttacked(victim, attacker)`,
  `eventObjectTransfer(object, from)`.

### 2.3 Scripting gotchas (from `doc/Scripting.md` — violating these causes savegame bugs)
- **Global variables must be case-insensitively unique** (savegame collision bug).
- **Never store game objects (droids/structures) in globals** — store IDs/positions
  and re-`enum` instead. Globals of basic types/arrays are saved & restored.
- `const` is NOT saved in savegames — use consts for static config (good: our wave
  tables should be `const`), vars for mutable state.
- Don't use `for (... in ...)` over arrays; use indexed loops.
- Events must return fast — heavy work stutters the game. Spread work with `queue()`.

### 2.4 Challenge file mechanics
- Challenge JSON fields (see `data/mp/challenges/hidebehind.json` for a live example):
  `challenge: { name, description, map, maxPlayers, bases, powerLevel, techLevel,
  scavengers, difficulty }`, plus `player_N: { team, ai, difficulty, position, name }`,
  plus `locked: { ... }` to lock lobby settings.
- Adding `"scripts": { "rules": "<path>" }` replaces the default rules scripts
  entirely (`doc/Scripting.md` documents this with a literal `towerdefense.js`
  example). `"extra"` adds a script alongside default rules — we use `rules`.
  AI paths in challenges are given relative to the data root, e.g.
  `"multiplay/skirmish/nexus.js"` or `"challenges/foo.js"`.
- **Verified in Leg 0.2:** `scripts.rules` values resolve relative to the
  *launcher's* directory prefix (`challenges/` for challenge files, `tests/` for
  `--skirmish` harness files, `autohost/` for autohost) — NOT the data root. So a
  challenge JSON in `data/mp/challenges/` must use
  `"rules": "towerdefense/td_rules.js"` (no `challenges/` prefix). The loader is
  `loadMapChallengeAndPlayerSettings` in `src/multiint.cpp` (~line 555); when
  `scripts.rules` is present, default rules (`multiplay/script/rules/init.js`)
  are skipped entirely. `include()` inside scripts resolves data-root-relative
  paths (e.g. `include("challenges/towerdefense/td_waves.js")`).
- **Headless verification of challenge rules works** (Leg 0.2): put a harness
  JSON in `data/mp/tests/` with the same `scripts.rules` (path `towerdefense/...`
  relative resolution differs — from `tests/` use a one-line shim rules file that
  `include()`s the real challenges-dir script) and run the VERIFY.md §6.3 TD
  smoke test. Use `debug("...")` for headless-visible logging (stderr);
  `console()` is player-facing only and invisible headlessly.
- `"ai": null` on a player slot = no AI script; the slot is driven by our rules script.

### 2.5 Automated testing hooks (verified in `src/clparse.cpp`)
- `--autogame` — run games automatically (AI vs AI) for testing.
- `--headless` — headless mode (valid with `--autogame`, `--autohost`, `--skirmish`).
- `--autohost=<settings file>` — start a host game from a JSON settings file.
- `--gamelog-output=log` — game history log output.
- These enable scripted smoke tests; Sprint 0 Leg 0.2 establishes the exact recipe.

### 2.6 Web build (verified in `platforms/emscripten/README-build.md`)
- Toolchain: Emscripten ≥3.1.58, CMake ≥3.27, vcpkg (`wasm32-emscripten` triplet),
  `workbox-cli` for the service worker.
- Configure: `cmake -S warzone2100 -B build -DCMAKE_BUILD_TYPE=Release
  -DCMAKE_TOOLCHAIN_FILE=vcpkg/scripts/buildsystems/vcpkg.cmake
  -DVCPKG_TARGET_TRIPLET=wasm32-emscripten -DCMAKE_INSTALL_PREFIX:PATH=$WZ_INSTALL_DIR`
- Build: `cmake --build build --target install`; test with `emrun`.
- The web port already ships a PWA manifest + service worker and supports challenges.

---

## 3. Sprint Map (overview)

| Sprint | Goal | Legs | Engine C++ touched? |
|---|---|---|---|
| 0 | Build + verification harness | 0.1, 0.2 | No |
| 1 | Core TD engine in JS (playable prototype, 1 map) | 1.1–1.4 | No |
| 2 | Content & balance (3 maps, tower tiers, creep catalog) | 2.1–2.3 | No |
| 3 | Desktop UX & onboarding | 3.1–3.2 | No |
| 4 | Web build + PWA deploy (phone-playable v1) | 4.1–4.3 | No |
| 5 | Mobile touch UX | 5.1–5.4 | **Yes** (input/UI only) |
| 6 | QA, docs, release | 6.1–6.2 | No |

Dependency order is strict within a sprint and between sprints, with one exception:
Sprint 3 and Sprint 4 may run in parallel once Sprint 2 is done.

File layout created over the sprints:

```
data/mp/challenges/
  td-outpost.json            # Sprint 1 (first map)
  td-crossfire.json          # Sprint 2
  td-lastline.json           # Sprint 2
  towerdefense/
    td_rules.js              # entry rules script (referenced by scripts.rules)
    td_waves.js              # wave engine
    td_economy.js            # bounty/lives/income
    td_towers.js             # tower whitelist + tier unlocks
    td_maps.js               # per-map config (spawns, HQ pos, wave tables)
    td_ui.js                 # announcements, reticule, hints (Sprint 3)
doc/tower-defense/
  VERIFY.md                  # how to build & smoke-test (Sprint 0)
  BALANCE.md                 # tuning notes (Sprint 2)
  MOBILE.md                  # touch design + device matrix (Sprint 5)
TD_PROGRESS.md               # living progress tracker + decision log
TOWER_DEFENSE_PLAN.md        # this file
```

---

## 4. Sprint 0 — Foundation & Verification Harness

### Leg 0.1 — Native build baseline

**Prompt for implementation session:**

> Read `TOWER_DEFENSE_PLAN.md` §1, §2, then execute Sprint 0 Leg 0.1 on branch
> `claude/tower-defense-game-concept-ree0e6`.
>
> **Task:** Produce a working native Linux build of Warzone 2100 from this repo and
> prove it can run headlessly.
> 1. Install dependencies (see `get-dependencies_linux.sh` for the distro package
>    list; use it if it matches the container distro, otherwise install equivalents).
> 2. Configure + build with CMake into `build/native/` (add `build/` to a root
>    `.gitignore` entry if not already ignored — check first). Use
>    `-DCMAKE_BUILD_TYPE=Release` and disable optional extras that block the build
>    (videos, discord-rpc etc.) only if necessary; record every flag you used.
> 3. Smoke test: run the built binary with `--autogame --headless` plus whatever
>    flags are needed for it to start a skirmish and tick the game loop for ~2
>    minutes without crashing (consult `--help` and `src/clparse.cpp`). Capture the
>    log tail.
> 4. Create `doc/tower-defense/VERIFY.md` documenting: exact dependency install
>    commands, exact CMake configure/build commands, and the exact smoke-test
>    command line with expected output markers.
> 5. Create `TD_PROGRESS.md` from the template in plan §8, mark Leg 0.1 done.
>
> **Acceptance criteria:**
> - `warzone2100` binary exists and `--version` prints a version.
> - Headless autogame run exits cleanly or runs 2 min without crash/assert.
> - `doc/tower-defense/VERIFY.md` is reproducible by a fresh session.
> - No modifications to existing source/data files (build-dir gitignore excepted).
>
> **Verify:** re-run the documented smoke-test command once from scratch.
> **Commit:** `td(0.1): native build baseline + VERIFY.md`, push.

### Leg 0.2 — Challenge test harness + lint

**Prompt for implementation session:**

> Read `TOWER_DEFENSE_PLAN.md` §1, §2, `doc/tower-defense/VERIFY.md`, and
> `TD_PROGRESS.md`, then execute Sprint 0 Leg 0.2.
>
> **Task:** Establish the repeatable way to (a) lint our upcoming TD scripts and
> (b) launch a specific challenge for testing.
> 1. Lint: confirm `eslint.config.mjs` covers `data/mp/challenges/**/*.js` (extend
>    the config's include patterns ONLY if it doesn't — minimal diff). Document the
>    exact `npx eslint` invocation in VERIFY.md.
> 2. Challenge launch recipe: figure out and document how to start a specific
>    challenge from the command line or with minimal clicks. Investigate, in order:
>    (a) `--autohost=<file>` with a settings JSON that references our challenge or
>    its map+scripts (read `src/clparse.cpp` and any autohost docs/samples in
>    `doc/hosting/`); (b) `--skirmish` flag semantics; (c) if neither can load
>    challenge `scripts.rules` headlessly, document the fastest manual path
>    (main menu → Challenges) and add a headless *script-load* sanity check instead:
>    a tiny throwaway challenge JSON + JS that just logs from `eventStartLevel`,
>    loaded via the best mechanism found, proving custom rules scripts execute.
>    Delete throwaway files before committing, but record the finding.
> 3. Write the "TD smoke test" section of VERIFY.md: the canonical command(s) every
>    later leg runs, plus what success looks like in the logs.
>
> **Acceptance criteria:**
> - VERIFY.md has: lint command, challenge-launch/verification recipe, and an
>   honest statement of what can and cannot be verified headlessly.
> - Finding logged in TD_PROGRESS.md Decision Log (e.g. "autohost can/cannot load
>   challenge rules because …").
>
> **Commit:** `td(0.2): challenge test harness + lint recipe`, push.

---

## 5. Sprint 1 — Core TD Engine (JavaScript, one map, fully playable)

### Leg 1.1 — Challenge scaffold + game state setup

**Prompt for implementation session:**

> Read `TOWER_DEFENSE_PLAN.md` §0, §1, §2 (all of §2), `doc/tower-defense/VERIFY.md`,
> `TD_PROGRESS.md`, plus `doc/Scripting.md`, `doc/js-events.md`, and skim
> `data/mp/multiplay/script/rules/init.js` + `setupgame.js` to understand what the
> default rules normally set up (our script replaces them and must cover the
> essentials itself: reticule setup, structure limits, win/lose). Then execute
> Sprint 1 Leg 1.1.
>
> **Task:** Create the first challenge and the rules-script skeleton that boots a
> TD game state.
> 1. Pick the first map: inspect `data/mp/multiplay/maps/` and choose a small 2–4
>    player map with natural chokepoints (candidates: `2c-DustyMaze`,
>    `Sk-MizaMaze`; verify the exact name matches an existing map). Record choice +
>    HQ tile position + 1–3 spawn-point tile positions in `td_maps.js` (look at the
>    map's start positions via `startPositions`/`enumStructOffWorld` or by loading
>    it once and logging).
> 2. Create `data/mp/challenges/td-outpost.json`: name "Siege Protocol: Outpost",
>    map from step 1, `maxPlayers` matching the map, `bases: 0`, `scavengers: 0`,
>    `powerLevel/techLevel: 1`, player_0 = human team 0, player_1 = name "SIEGE",
>    `"ai": null`, team 1; lock settings; `"scripts": { "rules":
>    "towerdefense/td_rules.js" }` — path is relative to the `challenges/`
>    prefix, verified empirically in Leg 0.2 (see plan §2.4). Also create the
>    `data/mp/tests/` harness JSON + one-line shim rules file per §2.4 /
>    VERIFY.md §6.3 so this and all later legs can smoke-test headlessly; use
>    `debug()` for verification logging (`console()` is invisible headlessly).
> 3. Create `data/mp/challenges/towerdefense/td_rules.js` + `td_maps.js` +
>    `td_towers.js` (stubs ok for towers). In `eventStartLevel`:
>    - `hackNetOff()` during bulk setup, `hackNetOn()` after (see how existing
>      rules/AIs use it).
>    - Place player HQ (`addStructure("A0CommandCentre", 0, hqX*128, hqY*128)` —
>      verify the HQ structure ID in `structure.json`) and 2 trucks
>      (`addDroid(0, x, y, ...)` with a truck template — find the exact
>      truck template/body/prop/turret in `templates.json`, e.g. construction
>      droid with `Spade1Mk1`).
>    - Set starting power via `setPower` (initial value 1300 — tunable const),
>      `setPowerModifier(0, 0)` if a passive trickle interferes (decide and log).
>    - Structure limits: everything to 0 for player 0, then whitelist only towers
>      + walls from `td_towers.js` (initial roster: `GuardTower1`,
>      `GuardTower-RotMg`, `Emplacement-MortarPit01`, walls/`A0HardcreteMk1Wall`
>      family — verify IDs in `structure.json`). `setDroidLimit(0, 2)` so no unit
>      production is possible even in edge cases.
>    - Set reticule buttons appropriate for build-only play (mirror what default
>      `reticule.js` does, minus manufacture/research/design/intel; keep Build,
>      Command minimal set that works).
>    - `centreView` on HQ; `setScrollLimits` to the playfield if the map is larger
>      than needed.
>    - `eventGameLoaded()` must re-arm all timers (timers are not saved) — structure
>      the code so setup-of-timers is a separate function called from both paths.
>    - Respect ALL gotchas in plan §2.3 (case-insensitive globals, no game objects
>      in globals, consts for config).
> 4. Verify per VERIFY.md: lint passes; challenge appears in the Challenges menu
>    and loads; log line from `eventStartLevel` confirms our rules ran; player has
>    HQ + trucks + only towers buildable.
>
> **Acceptance criteria:** challenge loads with custom rules active, player cannot
> build factories/labs or make units, HQ + trucks present, power set.
> **Commit:** `td(1.1): challenge scaffold + TD game state setup`, push.

### Leg 1.2 — Wave engine

**Prompt for implementation session:**

> Read plan §0, §1, §2, `TD_PROGRESS.md`, and the Sprint 1 files created so far
> under `data/mp/challenges/towerdefense/`. Then execute Sprint 1 Leg 1.2.
>
> **Task:** Build the data-driven wave engine in a new `td_waves.js` (included from
> `td_rules.js` via `include()` — check how existing AIs like
> `data/mp/multiplay/skirmish/nexus.js` structure includes; challenge-relative
> include paths may need the full data-root-relative path).
> 1. Wave table format (a `const` in `td_maps.js`, per-map):
>    `{ delay: seconds_before_wave, groups: [ { count, template: { name, body,
>    prop, turrets[] }, spawn: spawnPointIndex, stagger: ms } ], reward: power,
>    announce: "text" }`. Define 10 waves for td-outpost using verified templates
>    from `data/mp/stats/templates.json` (early: MG wheels/viper-class; mid:
>    cannon tracks; a fast hover wave; wave 10 boss: heavy body group). Give
>    player-1 the needed components implicitly (addDroid with explicit
>    body/prop/turret args does not require research — verify; if it does, call
>    `makeComponentAvailable`/`completeResearch` for player 1 during setup).
> 2. Wave state machine driven by `setTimer`-registered tick function (1s tick):
>    states BUILD_PHASE (countdown, shown via `console()` every 10s and final 5s),
>    SPAWNING (spawn groups with stagger via `queue()`), ACTIVE (wave alive),
>    CLEARED (when all wave droids dead/leaked → grant wave reward, unlock check,
>    next BUILD_PHASE). Track wave droids by **id**, not object refs.
> 3. On spawn: `addDroid(1, spawnX, spawnY, ...)` then
>    `orderDroidLoc(droid, DORDER_SCOUT, hqX, hqY)`. Re-issue orders on a slow
>    timer (every 10s) to droids of player 1 that have gone idle (enumDroid(1),
>    check `.order`), so creeps never stall.
> 4. `eventGameLoaded` re-arms timers and reconstructs transient state from saved
>    globals (wave number, state enum, lives — all plain types in globals).
> 5. Verify: full playthrough of at least 3 waves in a real game session per
>    VERIFY.md recipe (or the documented best-available verification), lint clean.
>
> **Acceptance criteria:** waves spawn on schedule, creeps push toward HQ and fight
> defenses, wave-cleared detection works, state survives save/load.
> **Commit:** `td(1.2): data-driven wave engine`, push.

### Leg 1.3 — Economy, lives, defeat

**Prompt for implementation session:**

> Read plan §0, §1, §2, `TD_PROGRESS.md`, and all files under
> `data/mp/challenges/towerdefense/`. Execute Sprint 1 Leg 1.3.
>
> **Task:** Implement the TD economy and defeat condition in `td_economy.js`.
> 1. Bounty: in `eventDestroyed(object)`, if object is a droid of player 1 killed
>    while a wave is active, `setPower(playerPower(0) + bounty(object), 0)`.
>    Bounty scales with body class (define a small const map body→power; default 10).
>    Show a subtle running total via `console()` at wave end, not per kill.
> 2. Passive income: +N power per BUILD_PHASE second (const, start N=2) so a
>    walled-in player is never hard-stuck.
> 3. Lives: const `startingLives = 20` per difficulty (Medium; Easy 30 / Hard 12 —
>    read challenge difficulty if accessible, else per-challenge const). Leak
>    check on the 1s tick: any player-1 droid within `leakRadius` (3 tiles) of HQ →
>    `removeObject(droid)`, decrement lives, `console()` + `playSound` alert.
> 4. Defeat: lives ≤ 0 OR HQ destroyed (`eventDestroyed` on the HQ structure id) →
>    `gameOverMessage(false)`. Make sure wave timers stop.
> 5. HQ is also damageable by creeps (they attack-move) — that's intended: losing
>    the HQ is an alternative defeat path. Repair is allowed (truck repairs).
> 6. Verify: playthrough where you deliberately leak creeps → lives tick down and
>    defeat fires; playthrough where towers hold → power grows with kills. Lint.
>
> **Acceptance criteria:** bounty, passive income, lives, leak removal, and both
> defeat paths all work; no per-kill console spam.
> **Commit:** `td(1.3): economy, lives, defeat conditions`, push.

### Leg 1.4 — Victory, tier unlocks v0, savegame hardening

**Prompt for implementation session:**

> Read plan §0, §1, §2, `TD_PROGRESS.md`, and all `towerdefense/` files.
> Execute Sprint 1 Leg 1.4.
>
> **Task:** Close the loop into a complete, winnable game.
> 1. Victory: final wave CLEARED → `gameOverMessage(true)`.
> 2. Tier unlocks v0 in `td_towers.js`: at waves 3/5/8 call `enableStructure` (and
>    `completeResearch` where a structure needs research prerequisites to function —
>    check `structure.json`/`research.json` linkage; use
>    `completeResearch(name, 0, true)` force flag if needed) to add: wave 3 → light
>    cannon/flamer towers + `AASite-QuadMg1`; wave 5 → `Emplacement-MortarPit01`,
>    `Emplacement-MRL-pit`; wave 8 → `Emplacement-HvyATrocket`,
>    `Emplacement-PulseLaser`. Announce unlocks via `console()`.
> 3. Savegame hardening pass over ALL td files: audit against plan §2.3 (no game
>    objects in globals, case-insensitive-unique globals, consts for static config,
>    `eventGameLoaded` fully re-arms every timer). Fix violations.
> 4. Difficulty: implement the Easy/Medium/Hard knobs (lives, starting power,
>    creep count multiplier) as a single const table selected per challenge file
>    (td-outpost = Medium for now).
> 5. Full verification: complete winnable playthrough start→victory (use a generous
>    power cheat const temporarily if needed for speed, but ship with real values);
>    save mid-wave, load, confirm waves/lives/economy resume. Lint clean.
> 6. Update `TD_PROGRESS.md`: Sprint 1 complete; record final const values.
>
> **Acceptance criteria:** the challenge is a complete, winnable, losable,
> save/load-safe tower defense game on one map.
> **Commit:** `td(1.4): victory, tier unlocks, savegame hardening`, push.

---

## 6. Sprint 2 — Content & Balance

### Leg 2.1 — Full tower roster & tier system

> Read plan §0, §1, §2, `TD_PROGRESS.md`, all `towerdefense/` files, and
> `data/mp/stats/structure.json` (filter `type == "DEFENSE"`). Execute Leg 2.1.
>
> **Task:** Replace the v0 unlock list with a curated 5-tier roster in `td_towers.js`.
> 1. Curate from structure.json by weapon role — per tier pick 3–5 towers covering
>    anti-ground kinetic, anti-tank, artillery/AoE, and anti-air. Suggested skeleton
>    (verify every ID + its research prereqs): T1 MG/flamer guard towers + walls;
>    T2 light cannon, `GuardTower-RotMg`, `AASite-QuadMg1`; T3 mortar/MRL pits,
>    medium cannon hardpoints; T4 `Emplacement-HvyATrocket`, howitzer,
>    `GuardTower-BeamLas`, better AA; T5 `Emplacement-PulseLaser`,
>    `Emplacement-Rail2`, `Emplacement-PlasmaCannon`.
> 2. Ensure each tower actually fires when placed: some emplacements need weapon
>    research completed to have stats — force-complete the specific research chains
>    for player 0 at unlock time (find chains in `data/mp/stats/research.json`).
> 3. Structure upgrade research (armor/HP) — grant +1 defense-upgrade research
>    tier to player 0 at waves 6 and 12 for late-game scaling.
> 4. Data format: `const TOWER_TIERS = [ { unlockWave, structures[], research[] } ]`.
> 5. Verify: in-game, at each milestone the new towers appear in the build menu and
>    kill things; lint. Update BALANCE.md skeleton (`doc/tower-defense/BALANCE.md`)
>    listing the roster.
>
> **Commit:** `td(2.1): five-tier tower roster`, push.

### Leg 2.2 — Creep catalog + two more maps

> Read plan §0, §1, §2, `TD_PROGRESS.md`, `towerdefense/` files,
> `data/mp/stats/templates.json`. Execute Leg 2.2.
>
> **Task:**
> 1. Creep catalog in `td_waves.js`: a named const library of ~15 creep specs built
>    from verified templates.json entries — runner (wheels, light body), soldier
>    (tracks + MG/cannon), tank (Python/heavy body), hover striker, VTOL bomber
>    (verify VTOL propulsion `V-Tol` naming + that `addDroid` VTOLs attack
>    properly; if VTOL waves misbehave, log it and substitute fast hover),
>    boss (heaviest body, e.g. Body7ABT/Retribution-class + strong turret,
>    spawned solo with a `console()` warning).
> 2. Two new challenges: `td-crossfire.json` (medium map, 2 simultaneous spawn
>    lanes, 15 waves) and `td-lastline.json` (hard, 3 lanes + VTOL waves, 20
>    waves). Pick maps from `data/mp/multiplay/maps/` with suitable chokepoints;
>    add both to `td_maps.js` with spawns/HQ/wave tables. Set challenge difficulty
>    fields Easy→`td-outpost`, Medium→`td-crossfire`, Hard→`td-lastline`.
> 3. Verify each challenge boots and first 3 waves run (per VERIFY.md). Lint.
>
> **Commit:** `td(2.2): creep catalog + crossfire & lastline maps`, push.

### Leg 2.3 — Balance pass

> Read plan §0, §1, §2, `TD_PROGRESS.md`, `doc/tower-defense/BALANCE.md`, all
> `towerdefense/` files. Execute Leg 2.3.
>
> **Task:** Tune all three maps to the target difficulty curve.
> 1. Targets: Outpost winnable by a first-time player with ~2 near-loss waves;
>    Crossfire requires deliberate tower mix (AT + AA + AoE); Lastline should
>    defeat most players on first attempt around wave 12–15.
> 2. Method: play/observe runs per VERIFY.md; where headless challenge runs are
>    possible, add a temporary auto-build stub (script builds a fixed tower layout)
>    to simulate a baseline player — remove before commit. Tune: starting power,
>    bounty map, passive income, wave sizes/compositions/delays, lives.
> 3. Record every final constant and the reasoning in BALANCE.md (this is the
>    tuning contract for future changes).
> 4. Lint + one full verification run per map.
>
> **Commit:** `td(2.3): balance pass across all maps`, push.

---

## 7. Sprint 3 — Desktop UX & Onboarding

### Leg 3.1 — In-game presentation

> Read plan §0, §1, §2, `TD_PROGRESS.md`, `towerdefense/` files, and
> `data/mp/multiplay/script/rules/reticule.js` (reference for reticule API usage).
> Execute Leg 3.1.
>
> **Task:** Make the mode communicate clearly, in a new `td_ui.js`:
> 1. Wave banner: `console()` multi-line announcements — wave number/total,
>    composition hint ("Incoming: armored column — bring anti-tank"), countdown
>    pips at 30/10/5s. `playSound` on wave start and on leak.
> 2. HUD facts: lives + wave shown on a repeating subtle console line at phase
>    transitions only (no spam); power is already native HUD.
> 3. Spawn beacons: `addBeacon` at each active lane's spawn at BUILD_PHASE start
>    so the player sees where the next wave comes from.
> 4. Reticule: strip to the minimal working set for build-only play; verify no
>    dead buttons.
> 5. Unlock fanfare: tier unlock message lists the new tower names.
> 6. Verify in-game on td-outpost; lint.
>
> **Commit:** `td(3.1): in-game presentation & announcements`, push.

### Leg 3.2 — Onboarding & mode docs

> Read plan §0, §1, §2, `TD_PROGRESS.md`. Execute Leg 3.2.
>
> **Task:**
> 1. First-minute tutorial hints on td-outpost only: sequenced `console()` tips
>    (build here, this is your HQ, kills = power), driven by game state (first
>    truck idle >10s → hint), suppressed after wave 2.
> 2. Challenge descriptions: rewrite all three challenge JSON `description` fields
>    to sell the mode and state difficulty + wave count.
> 3. `doc/tower-defense/README.md`: what the mode is, how to play, file map of the
>    implementation, how to add a new TD map (step-by-step using `td_maps.js`).
> 4. Verify + lint.
>
> **Commit:** `td(3.2): onboarding hints + mode docs`, push.

---

## 8. Sprint 4 — Web Build & PWA Deploy (phone-playable v1)

### Leg 4.1 — Local web build with TD bundled

> Read plan §1, §2.6, `platforms/emscripten/README.md` + `README-build.md`,
> `TD_PROGRESS.md`. Execute Leg 4.1.
>
> **Task:**
> 1. Follow `README-build.md` exactly to produce a local Emscripten build
>    (Emscripten SDK, vcpkg, workbox-cli). Expect this to be long; cache the
>    emsdk/vcpkg dirs outside the repo.
> 2. Confirm the TD challenge files are packaged (they live in `data/mp`, which the
>    web build ships) — grep the generated data archives/install dir.
> 3. Serve locally (`emrun` or any static server with the right COOP/COEP headers —
>    check `shell.html`/docs for header requirements) and verify: game boots in
>    Chromium (the container has Playwright + Chromium at `/opt/pw-browsers/chromium`),
>    Challenges menu lists the three Siege Protocol entries, td-outpost starts and
>    wave 1 spawns. Screenshot evidence via Playwright.
> 4. Document the full recipe + any deviations in `doc/tower-defense/VERIFY.md`
>    (web section).
>
> **Acceptance criteria:** screenshot of td-outpost running in the browser with
> wave 1 active. **Commit:** `td(4.1): web build recipe + verification`, push
> (docs only — build outputs are not committed).

### Leg 4.2 — CI + GitHub Pages deploy

> Read plan §1, `.github/workflows/CI_emscripten.yml`,
> `.github/workflows/publish_web_build.yml`, `TD_PROGRESS.md`. Execute Leg 4.2.
>
> **Task:**
> 1. Create `.github/workflows/td_web_deploy.yml` for THIS fork, modeled on the two
>    existing workflows: trigger on push to
>    `claude/tower-defense-game-concept-ree0e6` + manual dispatch; build the
>    Emscripten target; deploy the install dir to GitHub Pages
>    (`actions/deploy-pages` flow). Reuse the upstream workflow's emsdk pinning and
>    caching strategy verbatim where possible.
> 2. Do not modify the upstream workflows; ours must be additive and skippable
>    upstream (`if: github.repository == 'amanmehra3/warzone2100'`).
> 3. Push, watch the workflow run, fix until green. Note: repo Settings → Pages
>    must be set to "GitHub Actions" — if the run fails on Pages permissions,
>    report exactly what the user must click; do not guess.
> 4. Record the deployed URL in `TD_PROGRESS.md` and `doc/tower-defense/README.md`.
>
> **Acceptance criteria:** green workflow; public URL serving the game (or a
> precise user-action needed for Pages activation).
> **Commit:** `td(4.2): fork web-deploy workflow`, push.

### Leg 4.3 — Web/phone-fit tuning

> Read plan §0.3 (D7), §1, `platforms/emscripten/` files, `TD_PROGRESS.md`.
> Execute Leg 4.3.
>
> **Task:** Make the deployed web build TD-first and phone-tolerable.
> 1. `platforms/emscripten/shell.html` (fork-local change): retitle to
>    "Warzone 2100: Siege Protocol", add a short "How to play on mobile" note
>    (landscape recommended, tap = click).
> 2. Reduce memory/perf risk on phones: identify the graphics defaults the web port
>    uses and, for the TD challenges only, force cheap settings from script where
>    possible (fog, shadows via any exposed script/config toggles) — investigate
>    `src/configuration.cpp` and web defaults; if not script-reachable, document
>    recommended in-game settings in the shell page instead. No engine C++ changes.
> 3. PWA check: manifest name/icons still valid; service worker precache passes
>    (`wz-workbox-config.js`).
> 4. Verify on the deployed URL with Playwright using a phone-sized viewport
>    (e.g. 844×390): menu reachable, challenge starts, framerate subjectively
>    playable (log frame timing if exposed). Screenshot evidence.
>
> **Commit:** `td(4.3): web shell TD branding + phone-fit tuning`, push.

---

## 9. Sprint 5 — Mobile Touch UX (the only engine-code sprint)

> **Sprint-wide constraints:** changes confined to `lib/sdl/main_sdl.cpp`,
> `lib/widget/`, and small hooks in `src/` UI files. Every change must be
> no-op for desktop mouse users. Guard risky behavior behind a config flag or
> touch-detection. Keep diffs small and reviewable per leg.

### Leg 5.1 — Touch gesture layer

> Read plan §1, §9 constraints, `lib/sdl/main_sdl.cpp` (esp. `TrackedFinger` +
> `inputHandleTouchFingerEvent` ~line 1575 and the mouse input plumbing),
> `TD_PROGRESS.md`. Execute Leg 5.1.
>
> **Task:** Implement gesture → input mapping in the SDL layer:
> tap = left click at position; two-finger drag = camera pan; pinch = zoom
> (map to the existing zoom input path); long-press (>400ms, low movement) =
> right click. Study how SDL mouse events feed `inputAddBuffer`/mouse state and
> synthesize through the same path. Emscripten forwards browser touch events
> through SDL — verify the event flow works in the web build, not just native.
> **Verify:** native build compiles + desktop mouse unaffected (smoke test per
> VERIFY.md); web build via Playwright touch emulation: tap places selection,
> pinch zooms. Document findings in `doc/tower-defense/MOBILE.md` (create).
> **Commit:** `td(5.1): touch gesture layer in SDL input`, push.

### Leg 5.2 — UI scale & hit targets

> Read plan §1, §9, `TD_PROGRESS.md`, `doc/tower-defense/MOBILE.md`; investigate
> the existing display-scaling support (search `war_SetDisplayScale` /
> display scale in `src/` and `lib/sdl/`). Execute Leg 5.2.
>
> **Task:** On touch devices / small viewports, default display scale so reticule
> buttons and build menu items are ≥ ~9mm touch targets (pick scale from viewport
> px + devicePixelRatio in the web layer if reachable, else default scale bump
> when touch input is detected). No redesign — scaling + spacing only.
> **Verify:** Playwright phone viewport screenshots before/after; desktop
> unchanged. **Commit:** `td(5.2): touch-aware UI scaling`, push.

### Leg 5.3 — Streamlined touch build flow

> Read plan §0.3 (D4), §1, §9, `TD_PROGRESS.md`, `MOBILE.md`, the build-menu flow
> (`src/hci*.cpp`, `src/design.cpp` exclusions), and `td_rules.js`. Execute Leg 5.3.
>
> **Task:** Make tower placement one-tap-friendly. Preferred (script-first) path:
> auto-select the truck at BUILD_PHASE start and re-select after each build order
> (script), so on phone the flow is: tap Build → tap tower → tap ground. Engine
> path ONLY if a small, safe assist is needed (e.g. treat tap during structure
> placement as confirm). Evaluate both; implement the cheapest that makes the flow
> ≤3 taps per tower; log the decision.
> **Verify:** web build on phone viewport — build 3 towers with taps only.
> **Commit:** `td(5.3): one-tap tower build flow`, push.

### Leg 5.4 — Device matrix & performance pass

> Read plan §1, §9, `TD_PROGRESS.md`, `MOBILE.md`. Execute Leg 5.4.
>
> **Task:** 1. Define the support matrix in MOBILE.md (recent Android Chrome,
> iOS Safari ≥17, tablet + phone landscape; portrait = best-effort). 2. Playwright
> emulation across 3 viewport/DPR combos: boot, start td-outpost, play 2 waves,
> record load time + heap (`performance.memory` where available) + screenshots.
> 3. Fix the worst offender found (likely: initial download size or wave-time frame
> drops — options: trim shipped data for the TD page, cap droid counts in wave
> tables — balance-neutral changes only, coordinate with BALANCE.md). 4. Honest
> gaps list in MOBILE.md (what real-device testing must still confirm, e.g. iOS
> Safari WASM memory limits).
> **Commit:** `td(5.4): device matrix + perf pass`, push.

---

## 10. Sprint 6 — QA & Release

### Leg 6.1 — Full QA sweep

> Read plan §1, ALL of `doc/tower-defense/`, `TD_PROGRESS.md`. Execute Leg 6.1.
>
> **Task:** Run the full QA matrix and fix what it finds:
> - Native: all 3 challenges → win path, lose path (both defeat types), save/load
>   mid-wave, save/load in BUILD_PHASE, pause, quit-and-relaunch.
> - Web (Playwright): all 3 challenges boot; td-outpost 3-wave run at desktop and
>   phone viewport; touch gestures (5.1) still work.
> - Lint all JS; grep td scripts for the §2.3 gotchas one final time.
> - Log every bug found + fixed in TD_PROGRESS.md. Anything unfixable → "Known
>   issues" in `doc/tower-defense/README.md`.
> **Commit(s):** `td(6.1): QA fixes — <topic>`, push.

### Leg 6.2 — Release packaging

> Read plan §1, `TD_PROGRESS.md`, all TD docs. Execute Leg 6.2.
>
> **Task:** 1. Final `doc/tower-defense/README.md`: overview, play instructions
> (desktop + phone), the deployed URL, architecture summary, credits/license note
> (GPL-2.0+, built on Warzone 2100 by the Warzone 2100 Project). 2. In-browser
> screenshots (desktop + phone viewport) committed under `doc/tower-defense/img/`.
> 3. Verify the deployed GitHub Pages build is current (trigger the workflow if
> stale). 4. Final TD_PROGRESS.md update: all sprints complete, deployed URL,
> summary of deviations from plan. 5. Report to the user: URL, what was built,
> known issues. Do NOT open a PR unless the user asks.
> **Commit:** `td(6.2): release docs + screenshots`, push.

---

## 11. TD_PROGRESS.md template (Leg 0.1 creates this)

```markdown
# Siege Protocol — Progress Tracker
Plan: TOWER_DEFENSE_PLAN.md | Branch: claude/tower-defense-game-concept-ree0e6

## Leg status
| Leg | Status | Session date | Notes |
|-----|--------|--------------|-------|
| 0.1 | ☐ | | |
| 0.2 | ☐ | | |
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

## Known issues / deferred
```

---

## 12. Risk Register

| # | Risk | Likelihood | Mitigation |
|---|---|---|---|
| R1 | Challenge `scripts.rules` path resolution differs from doc example | Medium | Leg 0.2/1.1 test it empirically before building on it; `hidebehind.json` + `src/challenge.cpp` are ground truth |
| R2 | Headless challenge testing impossible → slower verification | Medium | Leg 0.2 establishes honest best-available recipe; legs verify via real game session with logging |
| R3 | `addDroid` creeps require research/components for player 1 | Low | Leg 1.2 checks; fallback `makeComponentAvailable`/`completeResearch` for player 1 |
| R4 | VTOL creep waves misbehave without full VTOL infrastructure | Medium | Leg 2.2 explicitly allows substituting hover strikers; log decision |
| R5 | Web build too heavy for low-end phones (RAM/WebGL2) | High | Leg 4.3 + 5.4 perf passes; small maps, capped wave sizes; document minimum device class honestly |
| R6 | Emscripten toolchain build fails in container (network/toolchain pins) | Medium | Reuse exact pins from `CI_emscripten.yml`; CI (Leg 4.2) is the fallback build environment |
| R7 | Touch changes regress desktop input | Medium | §9 constraint: touch paths behind detection/flag; desktop smoke test in every Sprint-5 leg |
| R8 | Savegame corruption from script globals | Medium | §2.3 gotchas embedded in every scripting leg + dedicated audit in Leg 1.4 and QA in 6.1 |
| R9 | GitHub Pages needs repo-settings action only the user can do | High | Leg 4.2 reports the exact click required instead of stalling |
| R10 | Upstream `master` moves under us | Low | Fork branch is self-contained; no rebases needed until/unless upstreaming |

---

## 13. Definition of Done (whole project)

1. Three Siege Protocol challenges (Easy/Medium/Hard) playable in the native build:
   winnable, losable, save/load-safe, lint-clean, zero modifications to existing
   game modes.
2. The same challenges playable in a browser at a public GitHub Pages URL from this
   fork, installable as a PWA.
3. On a phone-sized touch viewport: game boots, a tower can be built with taps
   only, two waves play at a playable framerate (verified via emulation; real-device
   gaps documented in MOBILE.md).
4. `doc/tower-defense/` contains VERIFY.md, BALANCE.md, MOBILE.md, README.md —
   sufficient for a new contributor to build, test, tune, and extend the mode.
5. `TD_PROGRESS.md` shows all 20 legs complete with an honest decision log.
