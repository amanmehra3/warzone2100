// Headless-harness shim: --skirmish rules paths resolve relative to tests/,
// so this one-liner pulls in the real challenge rules (data-root-relative
// include, verified in Leg 0.2 — see doc/tower-defense/VERIFY.md §6).
include("challenges/towerdefense/td_rules.js");
