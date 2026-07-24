// Headless-harness shim: --skirmish rules paths resolve relative to tests/,
// so this one-liner pulls in the real challenge rules (data-root-relative
// include, verified in Leg 0.2 — see doc/tower-defense/VERIFY.md §6).
include("challenges/towerdefense/td_rules.js");

// HARNESS-ONLY knobs (all inert by default in the real challenge):
// - auto-clear stuck waves after 60 ACTIVE seconds so the CLEARED path always
//   progresses even if creeps stall (td_waves.js default: 0).
tdDebugAutoClearSecs = 0; // TEMP tuning
// - tdDebugPlaceTowers (default 0): set to 2 locally (uncommitted) to place
//   flanking guard towers that score real combat kills — verifies the bounty
//   path (see VERIFY.md 6.3 variants). Left 0 here so the canonical run is a
//   deterministic pure-leak run: every creep leaks, lives 20 -> 0 by wave 4,
//   DEFEAT (lives exhausted), clean exit 0.
// - tdDebugKillHqTick (default 0): set to e.g. 150 locally (uncommitted) to
//   verify the HQ-destroyed defeat path.
tdDebugBaseline = 1; // TEMP tuning (do not commit)
