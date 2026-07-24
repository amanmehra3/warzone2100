// Siege Protocol — per-map configuration.
// Loaded via include("challenges/towerdefense/td_maps.js") from td_rules.js.
// NOTE: td_waves.js (tdCreepCatalog) is included BEFORE this file.
//
// Coordinates are in TILES. addStructure() needs world units (tile * 128);
// td_rules.js does that conversion.
//
// Map choices (all static, non-script-generated; start positions probed
// empirically via headless dumps):
// - Sk-UrbanChasm (Leg 1.1): 2p 64x64 urban, chasm chokepoints. p0=(52,56), p1=(12,11).
// - Sk-Mountain  (Leg 2.2, td-crossfire): 4p 96x96, mountain valleys; two
//   simultaneous lanes converge on the SE corner ("crossfire").
//   Start positions: (83,89) (6,5) (38,89) (58,4).
// - Sk-MizaMaze  (Leg 2.2, td-lastline): 8p 128x128 maze, three lanes.
//   Start positions include (20,10) (112,105) (14,70) (68,12).
//
// difficulty selects the tdDifficulty row (td_rules.js) for lives / starting
// power / creep multiplier. Wave tables reference tdCreepCatalog entries.

const tdMapCatalog = {
	"Sk-UrbanChasm": {
		difficulty: "easy", // entry map — matches the Easy challenge card (Leg 2.3)
		// Player HQ (Command Center) tile position — player 0's map start slot.
		hq: { x: 52, y: 56 },
		// Where the player's two starting trucks appear (near the HQ).
		trucks: [
			{ x: 50, y: 54 },
			{ x: 55, y: 58 }
		],
		// Creep entry points (index referenced by wave tables below).
		spawns: [
			{ x: 12, y: 11 },  // lane A: SIEGE corner (map start position 1)
			{ x: 7, y: 58 }    // lane B: south-west edge (open derrick ground)
		],
		// 10-wave table (composition unchanged from Leg 1.2; now catalog-driven).
		waves: [
			{ delay: 90, reward: 150, announce: "Wave 1: scout machines on lane A",
				groups: [
					{ count: 4, spawn: 0, stagger: 2000, template: tdCreepCatalog.runner }
				] },
			{ delay: 60, reward: 180, announce: "Wave 2: scouts on BOTH lanes",
				groups: [
					{ count: 3, spawn: 0, stagger: 2000, template: tdCreepCatalog.runner },
					{ count: 3, spawn: 1, stagger: 2000, template: tdCreepCatalog.runner }
				] },
			{ delay: 45, reward: 210, announce: "Wave 3: twin guns and flamers",
				groups: [
					{ count: 4, spawn: 0, stagger: 2000, template: tdCreepCatalog.runnerTwin },
					{ count: 2, spawn: 1, stagger: 3000, template: tdCreepCatalog.runnerFlamer }
				] },
			{ delay: 45, reward: 240, announce: "Wave 4: heavy machineguns",
				groups: [
					{ count: 6, spawn: 1, stagger: 2000, template: tdCreepCatalog.runnerHmg }
				] },
			{ delay: 50, reward: 280, announce: "Wave 5: light armor column",
				groups: [
					{ count: 5, spawn: 0, stagger: 2500, template: tdCreepCatalog.soldier }
				] },
			{ delay: 50, reward: 320, announce: "Wave 6: armored push, both lanes",
				groups: [
					{ count: 4, spawn: 0, stagger: 2500, template: tdCreepCatalog.soldierMedium },
					{ count: 2, spawn: 1, stagger: 2500, template: tdCreepCatalog.runnerHmg }
				] },
			{ delay: 50, reward: 360, announce: "Wave 7: fast hover strike",
				groups: [
					{ count: 3, spawn: 1, stagger: 1500, template: tdCreepCatalog.hoverStriker },
					{ count: 2, spawn: 0, stagger: 1500, template: tdCreepCatalog.hoverInferno }
				] },
			{ delay: 55, reward: 420, announce: "Wave 8: heavy cannons",
				groups: [
					{ count: 4, spawn: 0, stagger: 3000, template: tdCreepCatalog.soldierHeavy },
					{ count: 3, spawn: 1, stagger: 3000, template: tdCreepCatalog.scorpion }
				] },
			{ delay: 55, reward: 500, announce: "Wave 9: python armor column",
				groups: [
					{ count: 2, spawn: 0, stagger: 3000, template: tdCreepCatalog.tank },
					{ count: 4, spawn: 1, stagger: 2000, template: tdCreepCatalog.soldierMedium }
				] },
			{ delay: 60, reward: 800, announce: "Wave 10: VENGEANCE-class SIEGE breaker!",
				groups: [
					{ count: 1, spawn: 0, stagger: 4000, template: tdCreepCatalog.bossVengeance },
					{ count: 3, spawn: 1, stagger: 2500, template: tdCreepCatalog.tank }
				] }
		]
	},

	"Sk-Mountain": { // td-crossfire: two simultaneous lanes, 15 waves
		difficulty: "medium",
		hq: { x: 83, y: 89 },       // map start position 0 (SE corner)
		trucks: [
			{ x: 81, y: 87 },
			{ x: 86, y: 91 }
		],
		spawns: [
			{ x: 6, y: 5 },    // lane A: NW corner (map start position 1)
			{ x: 58, y: 4 }    // lane B: north edge (map start position 3)
		],
		waves: [
			{ delay: 90, reward: 150, announce: "Wave 1: scouts from the north-west",
				groups: [
					{ count: 4, spawn: 0, stagger: 2000, template: tdCreepCatalog.runner }
				] },
			{ delay: 60, reward: 170, announce: "Wave 2: crossfire! Both lanes at once",
				groups: [
					{ count: 3, spawn: 0, stagger: 2000, template: tdCreepCatalog.runner },
					{ count: 2, spawn: 1, stagger: 2000, template: tdCreepCatalog.runnerTwin }
				] },
			{ delay: 55, reward: 200, announce: "Wave 3: flamer runners",
				groups: [
					{ count: 3, spawn: 0, stagger: 2000, template: tdCreepCatalog.runnerFlamer },
					{ count: 3, spawn: 1, stagger: 2000, template: tdCreepCatalog.runnerHmg }
				] },
			{ delay: 45, reward: 230, announce: "Wave 4: light armor, both lanes",
				groups: [
					{ count: 3, spawn: 0, stagger: 2500, template: tdCreepCatalog.soldier },
					{ count: 3, spawn: 1, stagger: 2500, template: tdCreepCatalog.soldier }
				] },
			{ delay: 55, reward: 260, announce: "Wave 5: fast hover flank",
				groups: [
					{ count: 3, spawn: 1, stagger: 1500, template: tdCreepCatalog.hoverStriker },
					{ count: 2, spawn: 0, stagger: 2000, template: tdCreepCatalog.runnerHmg }
				] },
			{ delay: 50, reward: 300, announce: "Wave 6: armored column",
				groups: [
					{ count: 4, spawn: 0, stagger: 2500, template: tdCreepCatalog.soldierMedium },
					{ count: 2, spawn: 1, stagger: 2500, template: tdCreepCatalog.scorpion }
				] },
			{ delay: 50, reward: 340, announce: "Wave 7: anti-tank runners",
				groups: [
					{ count: 4, spawn: 1, stagger: 2000, template: tdCreepCatalog.runnerLancer },
					{ count: 3, spawn: 0, stagger: 2000, template: tdCreepCatalog.runnerHmg }
				] },
			{ delay: 55, reward: 400, announce: "Wave 8: TIGER-class armor sighted",
				groups: [
					{ count: 1, spawn: 0, stagger: 4000, template: tdCreepCatalog.bossRetribution },
					{ count: 3, spawn: 1, stagger: 2500, template: tdCreepCatalog.soldierMedium }
				] },
			{ delay: 55, reward: 440, announce: "Wave 9: inferno hovers",
				groups: [
					{ count: 4, spawn: 0, stagger: 1500, template: tdCreepCatalog.hoverInferno },
					{ count: 3, spawn: 1, stagger: 2000, template: tdCreepCatalog.soldierMedium }
				] },
			{ delay: 55, reward: 480, announce: "Wave 10: heavy cannon push",
				groups: [
					{ count: 4, spawn: 0, stagger: 3000, template: tdCreepCatalog.soldierHeavy },
					{ count: 3, spawn: 1, stagger: 3000, template: tdCreepCatalog.scorpion }
				] },
			{ delay: 55, reward: 520, announce: "Wave 11: python armor, both lanes",
				groups: [
					{ count: 2, spawn: 0, stagger: 3000, template: tdCreepCatalog.tank },
					{ count: 2, spawn: 1, stagger: 3000, template: tdCreepCatalog.tank }
				] },
			{ delay: 55, reward: 560, announce: "Wave 12: mixed assault",
				groups: [
					{ count: 3, spawn: 0, stagger: 2000, template: tdCreepCatalog.soldierHeavy },
					{ count: 4, spawn: 1, stagger: 1500, template: tdCreepCatalog.hoverStriker }
				] },
			{ delay: 55, reward: 620, announce: "Wave 13: TIGER pack",
				groups: [
					{ count: 3, spawn: 0, stagger: 3500, template: tdCreepCatalog.tankTiger },
					{ count: 3, spawn: 1, stagger: 2500, template: tdCreepCatalog.soldierMedium }
				] },
			{ delay: 60, reward: 700, announce: "Wave 14: armored horde",
				groups: [
					{ count: 4, spawn: 0, stagger: 2500, template: tdCreepCatalog.tank },
					{ count: 4, spawn: 1, stagger: 2500, template: tdCreepCatalog.soldierHeavy }
				] },
			{ delay: 60, reward: 1000, announce: "Wave 15: the VENGEANCE has come",
				groups: [
					{ count: 1, spawn: 0, stagger: 4000, template: tdCreepCatalog.bossVengeance },
					{ count: 1, spawn: 1, stagger: 4000, template: tdCreepCatalog.bossVengeance },
					{ count: 4, spawn: 0, stagger: 2500, template: tdCreepCatalog.tank }
				] }
		]
	},

	"Sk-MizaMaze": { // td-lastline: three lanes + VTOL waves, 20 waves
		difficulty: "hard",
		hq: { x: 112, y: 105 },     // map start position 1 (SE corner)
		trucks: [
			{ x: 110, y: 103 },
			{ x: 115, y: 107 }
		],
		spawns: [
			{ x: 20, y: 10 },   // lane A: NW (map start position 0)
			{ x: 14, y: 70 },   // lane B: W (map start position 4)
			{ x: 68, y: 12 }    // lane C: N (map start position 6)
		],
		waves: [
			{ delay: 60, reward: 150, announce: "Wave 1: scouts in the maze",
				groups: [
					{ count: 4, spawn: 0, stagger: 2000, template: tdCreepCatalog.runner }
				] },
			{ delay: 45, reward: 170, announce: "Wave 2: two lanes",
				groups: [
					{ count: 3, spawn: 1, stagger: 2000, template: tdCreepCatalog.runner },
					{ count: 3, spawn: 2, stagger: 2000, template: tdCreepCatalog.runnerTwin }
				] },
			{ delay: 45, reward: 200, announce: "Wave 3: ALL THREE lanes",
				groups: [
					{ count: 2, spawn: 0, stagger: 2000, template: tdCreepCatalog.runnerHmg },
					{ count: 2, spawn: 1, stagger: 2000, template: tdCreepCatalog.runnerHmg },
					{ count: 2, spawn: 2, stagger: 2000, template: tdCreepCatalog.runnerFlamer }
				] },
			{ delay: 50, reward: 240, announce: "Wave 4: AIR RAID - SIEGE bombers!",
				groups: [
					{ count: 3, spawn: 2, stagger: 3000, template: tdCreepCatalog.vtolBomber },
					{ count: 3, spawn: 0, stagger: 2000, template: tdCreepCatalog.runnerHmg }
				] },
			{ delay: 50, reward: 270, announce: "Wave 5: light armor",
				groups: [
					{ count: 3, spawn: 0, stagger: 2500, template: tdCreepCatalog.soldier },
					{ count: 3, spawn: 1, stagger: 2500, template: tdCreepCatalog.soldier }
				] },
			{ delay: 50, reward: 300, announce: "Wave 6: hover strike",
				groups: [
					{ count: 4, spawn: 1, stagger: 1500, template: tdCreepCatalog.hoverStriker },
					{ count: 2, spawn: 2, stagger: 2000, template: tdCreepCatalog.hoverInferno }
				] },
			{ delay: 50, reward: 340, announce: "Wave 7: armor on all lanes",
				groups: [
					{ count: 2, spawn: 0, stagger: 2500, template: tdCreepCatalog.soldierMedium },
					{ count: 2, spawn: 1, stagger: 2500, template: tdCreepCatalog.soldierMedium },
					{ count: 2, spawn: 2, stagger: 2500, template: tdCreepCatalog.scorpion }
				] },
			{ delay: 55, reward: 380, announce: "Wave 8: anti-tank runners",
				groups: [
					{ count: 4, spawn: 2, stagger: 2000, template: tdCreepCatalog.runnerLancer },
					{ count: 3, spawn: 0, stagger: 2000, template: tdCreepCatalog.runnerHmg }
				] },
			{ delay: 55, reward: 420, announce: "Wave 9: AIR RAID - lancer VTOLs!",
				groups: [
					{ count: 3, spawn: 0, stagger: 3000, template: tdCreepCatalog.vtolLancer },
					{ count: 3, spawn: 1, stagger: 2500, template: tdCreepCatalog.soldierMedium }
				] },
			{ delay: 55, reward: 500, announce: "Wave 10: RETRIBUTION-class breaker",
				groups: [
					{ count: 1, spawn: 1, stagger: 4000, template: tdCreepCatalog.bossRetribution },
					{ count: 3, spawn: 2, stagger: 2500, template: tdCreepCatalog.soldierHeavy }
				] },
			{ delay: 55, reward: 520, announce: "Wave 11: heavy cannon columns",
				groups: [
					{ count: 3, spawn: 0, stagger: 3000, template: tdCreepCatalog.soldierHeavy },
					{ count: 3, spawn: 2, stagger: 3000, template: tdCreepCatalog.scorpion }
				] },
			{ delay: 55, reward: 560, announce: "Wave 12: maze runners",
				groups: [
					{ count: 3, spawn: 0, stagger: 1500, template: tdCreepCatalog.hoverStriker },
					{ count: 3, spawn: 1, stagger: 1500, template: tdCreepCatalog.hoverStriker },
					{ count: 2, spawn: 2, stagger: 2000, template: tdCreepCatalog.hoverInferno }
				] },
			{ delay: 55, reward: 600, announce: "Wave 13: AIR RAID - mixed wing!",
				groups: [
					{ count: 3, spawn: 1, stagger: 3000, template: tdCreepCatalog.vtolBomber },
					{ count: 2, spawn: 2, stagger: 3000, template: tdCreepCatalog.vtolLancer }
				] },
			{ delay: 55, reward: 640, announce: "Wave 14: python columns",
				groups: [
					{ count: 2, spawn: 0, stagger: 3000, template: tdCreepCatalog.tank },
					{ count: 2, spawn: 1, stagger: 3000, template: tdCreepCatalog.tank },
					{ count: 2, spawn: 2, stagger: 3000, template: tdCreepCatalog.soldierHeavy }
				] },
			{ delay: 55, reward: 680, announce: "Wave 15: TIGER pack hunts",
				groups: [
					{ count: 3, spawn: 2, stagger: 3500, template: tdCreepCatalog.tankTiger },
					{ count: 3, spawn: 0, stagger: 2500, template: tdCreepCatalog.soldierMedium }
				] },
			{ delay: 55, reward: 720, announce: "Wave 16: everything at once",
				groups: [
					{ count: 2, spawn: 0, stagger: 2500, template: tdCreepCatalog.soldierHeavy },
					{ count: 3, spawn: 1, stagger: 1500, template: tdCreepCatalog.hoverStriker },
					{ count: 2, spawn: 2, stagger: 2500, template: tdCreepCatalog.scorpion }
				] },
			{ delay: 55, reward: 780, announce: "Wave 17: AIR ARMADA",
				groups: [
					{ count: 4, spawn: 0, stagger: 2500, template: tdCreepCatalog.vtolBomber },
					{ count: 2, spawn: 1, stagger: 3000, template: tdCreepCatalog.vtolLancer }
				] },
			{ delay: 60, reward: 840, announce: "Wave 18: RETRIBUTION pair",
				groups: [
					{ count: 1, spawn: 0, stagger: 4000, template: tdCreepCatalog.bossRetribution },
					{ count: 1, spawn: 2, stagger: 4000, template: tdCreepCatalog.bossRetribution },
					{ count: 3, spawn: 1, stagger: 2500, template: tdCreepCatalog.tank }
				] },
			{ delay: 60, reward: 900, announce: "Wave 19: armored flood",
				groups: [
					{ count: 3, spawn: 0, stagger: 2500, template: tdCreepCatalog.tank },
					{ count: 3, spawn: 1, stagger: 2500, template: tdCreepCatalog.tankTiger },
					{ count: 3, spawn: 2, stagger: 2500, template: tdCreepCatalog.soldierHeavy }
				] },
			{ delay: 60, reward: 1200, announce: "Wave 20: the last line",
				groups: [
					{ count: 1, spawn: 0, stagger: 4000, template: tdCreepCatalog.bossVengeance },
					{ count: 1, spawn: 1, stagger: 4000, template: tdCreepCatalog.bossVengeance },
					{ count: 1, spawn: 2, stagger: 4000, template: tdCreepCatalog.bossVengeance },
					{ count: 3, spawn: 2, stagger: 2500, template: tdCreepCatalog.tank }
				] }
		]
	}
};

// The map the currently-running challenge plays on. mapName is an engine
// global; td_rules.js asserts this lookup succeeded.
const tdMapDef = tdMapCatalog[mapName];
