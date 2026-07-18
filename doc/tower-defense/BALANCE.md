# Siege Protocol — Balance Notes

Started in Leg 2.1 (roster). The tuning contract lives here: every gameplay
constant and the reasoning behind it. Full balance pass happens in Leg 2.3.

## Tower roster (five tiers, td_towers.js `tdTowerTiers`)

Unlock happens at the START of the BUILD phase for the listed wave. All IDs
verified against `data/mp/stats/structure.json`. No research is required for
towers to function (Leg 1.4 finding) — the two research entries below are
deliberate armor/HP scaling grants.

| Tier (unlock wave) | Structure ID | Name | Role |
|---|---|---|---|
| T1 (0) | GuardTower1 | Heavy Machinegun Guard Tower | anti-ground kinetic |
| T1 (0) | GuardTower4 | Flamer Guard Tower | close-range AoE |
| T1 (0) | A0HardcreteMk1Wall / CWall / Gate | Hardcrete wall set | blocking/routing |
| T2 (3) | GuardTower-RotMg | Assault Gun Tower | kinetic DPS |
| T2 (3) | PillBox4 | Light Cannon Bunker | anti-armor |
| T2 (3) | GuardTower6 | Mini-Rocket Tower | light anti-tank |
| T2 (3) | AASite-QuadMg1 | Hurricane AA Site | anti-air |
| T3 (5) | Emplacement-MortarPit01 | Mortar Pit | artillery/AoE |
| T3 (5) | Emplacement-MRL-pit | Mini-Rocket Battery | artillery/AoE |
| T3 (5) | WallTower03 | Medium Cannon Hardpoint | anti-armor (wall-line) |
| T3 (5) | GuardTower5 | Lancer Tower | anti-tank |
| — (6) | R-Defense-WallUpgrade01 + R-Struc-Materials01 | research grant | +armor/HP for walls/defenses + structures |
| T4 (8) | Emplacement-HvyATrocket | Tank Killer Emplacement | heavy anti-tank |
| T4 (8) | Emplacement-Howitzer105 | Howitzer Emplacement | heavy artillery |
| T4 (8) | GuardTower-BeamLas | Pulse Laser Tower | energy kinetic |
| T4 (8) | AASite-QuadBof | AA Cyclone Flak Cannon | anti-air |
| T5 (10) | Emplacement-PulseLaser | Pulse Laser Emplacement | energy DPS |
| T5 (10) | Emplacement-Rail2 | Railgun Emplacement | heavy anti-tank |
| T5 (10) | Emplacement-PlasmaCannon | Plasma Cannon Emplacement | super-heavy |
| — (12) | R-Defense-WallUpgrade02 + R-Struc-Materials02 | research grant | second armor/HP step (15/20-wave maps only) |

Build limits: 100 per tower type, 200 walls, 50 gates/AA (generous by design;
economy is the real constraint).

Kill verification (headless, Leg 2.1): T1/T2 towers kill scouts (Legs
1.3/1.4); tier kill-test knob runs proved T3 = 9 kills, T4 = 16 kills,
T5 = 18 kills across a full 10-wave pass (Viper/Cobra/Scorpion victims).
AA sites cannot be verified until VTOL waves exist (Leg 2.2).

## Economy constants (td_rules.js / td_economy.js, as of Sprint 1)

| Constant | Value | Why |
|---|---|---|
| Starting power | easy 1600 / medium 1300 / hard 1100 | CAMP_CLEAN baseline (1300) ± difficulty |
| Passive income | +2/s, BUILD phase only | walled-in player is never hard-stuck |
| Bounty by body | Viper 10, Cobra 15, Scorpion 20, Mantis 25, Python 30, Tiger 30, Retribution 40, Vengeance 50 (default 10) | scales with body class per plan |
| Lives | easy 30 / medium 20 / hard 12 | plan values |
| Creep multiplier | easy 0.8 / medium 1.0 / hard 1.3 (ceil, min 1/group) | plan Leg 1.4 |
| Leak radius | 3 tiles (creeps ≤12 tiles beeline into the HQ) | attack-movers besiege from range otherwise |
| Wave rewards (outpost) | 150→800 over 10 waves | roughly tracks wave cost |

## Maps & wave tables (Leg 2.2)

| Challenge | Map | Waves | Lanes | Internal difficulty | Card label |
|---|---|---|---|---|---|
| td-outpost | Sk-UrbanChasm (64x64) | 10 | 2 | medium | Easy |
| td-crossfire | Sk-Mountain (96x96) | 15 | 2 simultaneous | medium | Medium |
| td-lastline | Sk-MizaMaze (128x128) | 20 | 3 + VTOL waves (4/9/13/17) | hard | Hard |

Outpost's card label says Easy (it is the entry map) while its internal knobs
remain medium — Leg 2.3 reconciles this when the real tuning happens.
Rewards: crossfire 150→1000, lastline 150→1200. Boss waves: crossfire 8
(Retribution) and 15 (2x Vengeance); lastline 10, 18 (Retribution) and 20
(3x Vengeance). The wave-12 armor research entry fires on both new maps.

## Creep catalog (td_waves.js tdCreepCatalog)

17 specs, all component combos verified against templates.json: runner /
runnerTwin / runnerHmg / runnerFlamer / runnerLancer (Viper wheels),
soldier / soldierMedium / soldierHeavy (Cobra tracks), scorpion (Scorpion
tracks), hoverStriker / hoverInferno (Cobra hover), tank (Python HC),
tankTiger (Tiger HC), vtolBomber (Bug + cluster bomb), vtolLancer (Scorpion
+ VTOL lancer), bossRetribution (Body7ABT railgun), bossVengeance (Body10MBT
Tank Killer). Bosses announce on spawn; VTOLs attack the HQ directly
(orderDroidObj) and follow the one-pass rule (VERIFY.md 6.3.2).

## Open balance questions (for Leg 2.3)

- Wave delays (45–60 s) untested against real build speed.
- On-path blocking stalls creeps without them attacking blockers (R11) — needs
  a stuck-creep response before players can be allowed to full-wall lanes.
- Tower costs vs bounty income curve not yet tuned; T1 tower spam may dominate.
- Flamer (T1) may be too strong for wave-1 scouts.
- Outpost card label (Easy) vs internal medium knobs needs reconciling.
- Lastline on hard leaks out around wave 13 with zero towers — intended
  hard, but human-run tuning needed (especially VTOL wave counts vs AA cost).
