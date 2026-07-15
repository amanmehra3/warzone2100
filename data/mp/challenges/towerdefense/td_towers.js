// Siege Protocol — tower whitelist + tier unlocks.
// Loaded via include("challenges/towerdefense/td_towers.js") from td_rules.js.
//
// Leg 1.1 stub: the initial (wave-0) roster only. The full five-tier system
// arrives in Legs 1.4/2.1. Every ID below verified against
// data/mp/stats/structure.json.

// Structures the player can build from the start of the game.
// [structureId, buildLimit]
const tdTowerRosterT0 = [
	["GuardTower1", 100],            // Heavy Machinegun Guard Tower (DEFENSE)
	["GuardTower-RotMg", 100],       // Assault Gun Tower (DEFENSE)
	["Emplacement-MortarPit01", 100], // Mortar Pit (DEFENSE)
	["A0HardcreteMk1Wall", 200],     // Hardcrete Wall (WALL)
	["A0HardcreteMk1CWall", 200],    // Hardcrete Corner Wall (CORNER WALL)
	["A0HardcreteMk1Gate", 50]       // Hardcrete Gate (GATE)
];

// Make the starting roster buildable for the given player, assuming all
// structure limits were zeroed first (see tdApplyLimits in td_rules.js).
// Runs inside hackNetOff().
function tdEnableStartingTowers(player)
{
	for (let i = 0; i < tdTowerRosterT0.length; ++i)
	{
		const towerId = tdTowerRosterT0[i][0];
		const towerLimit = tdTowerRosterT0[i][1];
		setStructureLimits(towerId, towerLimit, player);
		enableStructure(towerId, player);
	}
	debug("TD: enabled " + tdTowerRosterT0.length + " starting tower/wall types for player " + player);
}
