// Headless-harness shim: --skirmish rules paths resolve relative to tests/,
// so this one-liner pulls in the real challenge rules (data-root-relative
// include, verified in Leg 0.2 — see doc/tower-defense/VERIFY.md §6).
include("challenges/towerdefense/td_rules.js");

// HARNESS-ONLY: no towers exist headlessly to kill creeps, so force-clear
// each wave after 60 ACTIVE seconds to exercise the CLEARED -> next-wave
// path. The real challenge never sets this (td_waves.js default is 0).
tdDebugAutoClearSecs = 60;
