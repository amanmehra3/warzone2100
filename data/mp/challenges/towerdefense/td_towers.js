// Siege Protocol — tower whitelist + tier unlocks.
// Loaded via include("challenges/towerdefense/td_towers.js") from td_rules.js.
//
// v0 tier system (Leg 1.4; the full five-tier roster arrives in Leg 2.1).
// Every ID verified against data/mp/stats/structure.json. Tiers unlock at the
// START of the BUILD phase for their unlockWave, so the player can prepare.
//
// Research note (verified empirically in Legs 1.3/1.4): script-enabled
// defense structures are buildable and their weapons fire with base stats
// WITHOUT any research completed. completeResearch chains are therefore not
// needed for function; weapon-upgrade research is a Leg 2.1 concern.

const tdTowerTiers = [
	{ unlockWave: 0, label: "starting defenses", structures: [
		["GuardTower1", 100],            // Heavy Machinegun Guard Tower
		["A0HardcreteMk1Wall", 200],     // Hardcrete Wall
		["A0HardcreteMk1CWall", 200],    // Hardcrete Corner Wall
		["A0HardcreteMk1Gate", 50]       // Hardcrete Gate
	] },
	{ unlockWave: 3, label: "Tier 1: cannon, flamer, assault gun, AA", structures: [
		["GuardTower-RotMg", 100],       // Assault Gun Tower
		["PillBox4", 100],               // Light Cannon Bunker
		["GuardTower4", 100],            // Flamer Guard Tower
		["AASite-QuadMg1", 50]           // Hurricane AA Site
	] },
	{ unlockWave: 5, label: "Tier 2: artillery and anti-tank", structures: [
		["Emplacement-MortarPit01", 100], // Mortar Pit
		["Emplacement-MRL-pit", 100],     // Mini-Rocket Battery
		["GuardTower5", 100]              // Lancer Tower
	] },
	{ unlockWave: 8, label: "Tier 3: heavy weapons", structures: [
		["Emplacement-HvyATrocket", 100], // Tank Killer Emplacement
		["Emplacement-PulseLaser", 100]   // Pulse Laser Emplacement
	] }
];

// ---------------------------------------------------------------- state (saved)
var tdTiersUnlocked = 0; // count of tiers already enabled (index into tdTowerTiers)
// Harness-only knob: when 1, each newly unlocked tier also script-places one
// of each new tower on the lane-B flank so kills prove the towers function.
// MUST stay 0 here; set locally (uncommitted) for unlock verification runs.
var tdDebugPlaceUnlocked = 0;

// Enable one tier's structures for the given player (inside hackNetOff()).
function tdEnableTier(tierIndex, player)
{
	const tier = tdTowerTiers[tierIndex];
	for (let i = 0; i < tier.structures.length; ++i)
	{
		setStructureLimits(tier.structures[i][0], tier.structures[i][1], player);
		enableStructure(tier.structures[i][0], player);
	}
	debug("TD-TIER: tier " + tierIndex + " enabled (" + tier.label + "): " +
		tier.structures.length + " structure types for player " + player);
}

// Called at each BUILD phase start with the upcoming wave number.
function tdCheckTierUnlocks(upcomingWave)
{
	while (tdTiersUnlocked < tdTowerTiers.length &&
		tdTowerTiers[tdTiersUnlocked].unlockWave <= upcomingWave)
	{
		const tier = tdTowerTiers[tdTiersUnlocked];
		tdEnableTier(tdTiersUnlocked, tdConfig.humanPlayer);
		if (tier.unlockWave > 0)
		{
			tdAnnounce(_("New defenses unlocked:") + " " + tier.label);
		}
		if (tdDebugPlaceUnlocked === 1 && tier.unlockWave > 0)
		{
			tdPlaceTierForTest(tdTiersUnlocked);
		}
		tdTiersUnlocked += 1;
	}
}

// Harness-only: place one of each tower of the tier on the lane-B flank
// (open ground within weapon range of the observed walk line; see
// td_economy.js tdPlaceDebugTowers for the geometry notes).
function tdPlaceTierForTest(tierIndex)
{
	// Distinct spots per tier (placing two tiers on the same tile fails), all
	// flanking lane B's walk line near its spawn so creeps are exposed early.
	const spotsByTier = {
		1: [{ x: 14, y: 57 }, { x: 18, y: 56 }, { x: 22, y: 57 }, { x: 26, y: 56 }],
		2: [{ x: 14, y: 54 }, { x: 18, y: 53 }, { x: 22, y: 54 }],
		3: [{ x: 26, y: 53 }, { x: 30, y: 54 }]
	};
	const flankSpots = spotsByTier[tierIndex] || [];
	const tier = tdTowerTiers[tierIndex];
	for (let i = 0; i < tier.structures.length && i < flankSpots.length; ++i)
	{
		const towerId = tier.structures[i][0];
		const spot = flankSpots[i];
		const tower = addStructure(towerId, tdConfig.humanPlayer, spot.x * 128, spot.y * 128);
		debug("TD-TIER: HARNESS test-place " + towerId + " at (" + spot.x + "," + spot.y + "): " +
			(tower ? "OK id=" + tower.id : "FAILED"));
	}
}
