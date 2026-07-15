// Siege Protocol — per-map configuration.
// Loaded via include("challenges/towerdefense/td_maps.js") from td_rules.js.
//
// Coordinates are in TILES. addStructure() needs world units (tile * 128);
// td_rules.js does that conversion.
//
// Map choice (Leg 1.1): Sk-UrbanChasm — static 2-player 64x64 urban map whose
// central chasm creates natural lane chokepoints. Start positions probed
// empirically (headless): p0=(52,56), p1=(12,11).
// Spawn points sit in the SIEGE half of the map on known-open ground
// (p1 start position and oil-derrick tiles are guaranteed buildable/walkable).
// Leg 1.2 (wave engine) validates creep pathing from each spawn and may tune.

const tdMapCatalog = {
	"Sk-UrbanChasm": {
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
		// 10-wave table. All template components verified against
		// data/mp/stats/templates.json (Leg 1.2). delay = build-phase seconds
		// before the wave; stagger = ms between spawns within a group;
		// spawn = index into spawns[] above. Balance pass happens in Leg 2.3.
		waves: [
			{ delay: 60, reward: 150, announce: "Wave 1: scout machines on lane A",
				groups: [
					{ count: 4, spawn: 0, stagger: 2000,
						template: { name: "Machinegun Viper Wheels", body: "Body1REC", prop: "wheeled01", turrets: ["MG1Mk1"] } }
				] },
			{ delay: 45, reward: 180, announce: "Wave 2: scouts on BOTH lanes",
				groups: [
					{ count: 3, spawn: 0, stagger: 2000,
						template: { name: "Machinegun Viper Wheels", body: "Body1REC", prop: "wheeled01", turrets: ["MG1Mk1"] } },
					{ count: 3, spawn: 1, stagger: 2000,
						template: { name: "Machinegun Viper Wheels", body: "Body1REC", prop: "wheeled01", turrets: ["MG1Mk1"] } }
				] },
			{ delay: 45, reward: 210, announce: "Wave 3: twin guns and flamers",
				groups: [
					{ count: 4, spawn: 0, stagger: 2000,
						template: { name: "Twin Machinegun Viper Wheels", body: "Body1REC", prop: "wheeled01", turrets: ["MG2Mk1"] } },
					{ count: 2, spawn: 1, stagger: 3000,
						template: { name: "Flamer Viper Wheels", body: "Body1REC", prop: "wheeled01", turrets: ["Flame1Mk1"] } }
				] },
			{ delay: 45, reward: 240, announce: "Wave 4: heavy machineguns",
				groups: [
					{ count: 6, spawn: 1, stagger: 2000,
						template: { name: "Heavy Machinegun Viper Wheels", body: "Body1REC", prop: "wheeled01", turrets: ["MG3Mk1"] } }
				] },
			{ delay: 50, reward: 280, announce: "Wave 5: light armor column",
				groups: [
					{ count: 5, spawn: 0, stagger: 2500,
						template: { name: "Light Cannon Cobra Tracks", body: "Body5REC", prop: "tracked01", turrets: ["Cannon1Mk1"] } }
				] },
			{ delay: 50, reward: 320, announce: "Wave 6: armored push, both lanes",
				groups: [
					{ count: 4, spawn: 0, stagger: 2500,
						template: { name: "Medium Cannon Cobra Tracks", body: "Body5REC", prop: "tracked01", turrets: ["Cannon2A-TMk1"] } },
					{ count: 2, spawn: 1, stagger: 2500,
						template: { name: "Heavy Machinegun Viper Wheels", body: "Body1REC", prop: "wheeled01", turrets: ["MG3Mk1"] } }
				] },
			{ delay: 50, reward: 360, announce: "Wave 7: fast hover strike",
				groups: [
					{ count: 4, spawn: 1, stagger: 1500,
						template: { name: "Heavy Machinegun Cobra Hover", body: "Body5REC", prop: "hover01", turrets: ["MG3Mk1"] } },
					{ count: 2, spawn: 0, stagger: 1500,
						template: { name: "Inferno Cobra Hover", body: "Body5REC", prop: "hover01", turrets: ["Flame2"] } }
				] },
			{ delay: 55, reward: 420, announce: "Wave 8: heavy cannons",
				groups: [
					{ count: 4, spawn: 0, stagger: 3000,
						template: { name: "Heavy Cannon Cobra Tracks", body: "Body5REC", prop: "tracked01", turrets: ["Cannon375mmMk1"] } },
					{ count: 3, spawn: 1, stagger: 3000,
						template: { name: "Medium Cannon Scorpion Tracks", body: "Body8MBT", prop: "tracked01", turrets: ["Cannon2A-TMk1"] } }
				] },
			{ delay: 55, reward: 500, announce: "Wave 9: python armor column",
				groups: [
					{ count: 3, spawn: 0, stagger: 3000,
						template: { name: "Heavy Cannon Python Tracks", body: "Body11ABT", prop: "tracked01", turrets: ["Cannon375mmMk1"] } },
					{ count: 5, spawn: 1, stagger: 2000,
						template: { name: "Medium Cannon Cobra Tracks", body: "Body5REC", prop: "tracked01", turrets: ["Cannon2A-TMk1"] } }
				] },
			{ delay: 60, reward: 800, announce: "Wave 10: VENGEANCE-class SIEGE breakers!",
				groups: [
					{ count: 2, spawn: 0, stagger: 4000,
						template: { name: "Tank Killer Vengeance Tracks", body: "Body10MBT", prop: "tracked01", turrets: ["Rocket-HvyA-T"] } },
					{ count: 4, spawn: 1, stagger: 2500,
						template: { name: "Heavy Cannon Python Tracks", body: "Body11ABT", prop: "tracked01", turrets: ["Cannon375mmMk1"] } }
				] }
		]
	}
};

// The map the currently-running challenge plays on. mapName is an engine
// global; td_rules.js asserts this lookup succeeded.
const tdMapDef = tdMapCatalog[mapName];
