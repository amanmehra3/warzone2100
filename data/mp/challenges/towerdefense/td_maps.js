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
		// Creep entry points (index referenced by wave tables in Leg 1.2).
		spawns: [
			{ x: 12, y: 11 },  // lane A: SIEGE corner (map start position 1)
			{ x: 7, y: 58 }    // lane B: south-west edge (open derrick ground)
		]
	}
};

// The map the currently-running challenge plays on. mapName is an engine
// global; td_rules.js asserts this lookup succeeded.
const tdMapDef = tdMapCatalog[mapName];
