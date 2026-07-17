// Siege Protocol — tower whitelist + tier unlocks (full five-tier roster, Leg 2.1).
// Loaded via include("challenges/towerdefense/td_towers.js") from td_rules.js.
//
// Format per plan §6: { unlockWave, structures: [[id, limit]...], research: [ids] }.
// Every structure ID verified against data/mp/stats/structure.json; research IDs
// against data/mp/stats/research.json.
//
// Research policy (Leg 1.4 finding): enabled structures build and fire with
// base stats and ZERO research — research[] entries are used only deliberately
// for armor/HP upgrade scaling (granted force-completed at their unlockWave).
// Roles per tier: anti-ground kinetic / anti-tank / artillery-AoE / anti-air.

const tdTowerTiers = [
	{ unlockWave: 0, label: "starting defenses", structures: [
		["GuardTower1", 100],             // Heavy Machinegun Guard Tower (kinetic)
		["GuardTower4", 100],             // Flamer Guard Tower (close AoE)
		["A0HardcreteMk1Wall", 200],      // Hardcrete Wall
		["A0HardcreteMk1CWall", 200],     // Hardcrete Corner Wall
		["A0HardcreteMk1Gate", 50]        // Hardcrete Gate
	], research: [] },
	{ unlockWave: 3, label: "Tier 2: assault gun, cannon, rockets, AA", structures: [
		["GuardTower-RotMg", 100],        // Assault Gun Tower (kinetic DPS)
		["PillBox4", 100],                // Light Cannon Bunker (anti-armor)
		["GuardTower6", 100],             // Mini-Rocket Tower (light AT)
		["AASite-QuadMg1", 50]            // Hurricane AA Site (anti-air)
	], research: [] },
	{ unlockWave: 5, label: "Tier 3: artillery and anti-tank", structures: [
		["Emplacement-MortarPit01", 100], // Mortar Pit (artillery/AoE)
		["Emplacement-MRL-pit", 100],     // Mini-Rocket Battery (artillery/AoE)
		["WallTower03", 100],             // Medium Cannon Hardpoint (anti-armor)
		["GuardTower5", 100]              // Lancer Tower (anti-tank)
	], research: [] },
	{ unlockWave: 6, label: "structural reinforcement", structures: [],
		research: ["R-Defense-WallUpgrade01", "R-Struc-Materials01"] },
	{ unlockWave: 8, label: "Tier 4: heavy weapons and flak", structures: [
		["Emplacement-HvyATrocket", 100], // Tank Killer Emplacement (heavy AT)
		["Emplacement-Howitzer105", 100], // Howitzer Emplacement (heavy artillery)
		["GuardTower-BeamLas", 100],      // Pulse Laser Tower (energy kinetic)
		["AASite-QuadBof", 50]            // AA Cyclone Flak Cannon (anti-air)
	], research: [] },
	{ unlockWave: 10, label: "Tier 5: experimental weapons", structures: [
		["Emplacement-PulseLaser", 100],  // Pulse Laser Emplacement (energy)
		["Emplacement-Rail2", 100],       // Railgun Emplacement (heavy AT)
		["Emplacement-PlasmaCannon", 100] // Plasma Cannon Emplacement (super-heavy)
	], research: [] },
	{ unlockWave: 12, label: "advanced structural reinforcement", structures: [],
		research: ["R-Defense-WallUpgrade02", "R-Struc-Materials02"] }
	// unlockWave 12 only fires on maps with 12+ waves (td-crossfire/lastline, Leg 2.2)
];

// ---------------------------------------------------------------- state (saved)
var tdTiersUnlocked = 0; // count of tiers already enabled (index into tdTowerTiers)
// Harness-only knobs (MUST stay 0 here; set locally, uncommitted, for tests):
var tdDebugPlaceUnlocked = 0; // 1: script-place each tier's towers when it unlocks
var tdDebugTierKillTest = 0;  // tier INDEX (2/4/5): place that tier at game start
                              // on the flank rows + set lives to 999 so all
                              // waves run — proves the tier's towers kill.

// Enable one tier's structures + research grants for the given player.
function tdEnableTier(tierIndex, player)
{
	const tier = tdTowerTiers[tierIndex];
	for (let i = 0; i < tier.structures.length; ++i)
	{
		setStructureLimits(tier.structures[i][0], tier.structures[i][1], player);
		enableStructure(tier.structures[i][0], player);
	}
	for (let j = 0; j < tier.research.length; ++j)
	{
		completeResearch(tier.research[j], player, true);
		debug("TD-TIER: research granted: " + tier.research[j] + " for player " + player);
	}
	debug("TD-TIER: tier " + tierIndex + " enabled (" + tier.label + "): " +
		tier.structures.length + " structure types, " + tier.research.length +
		" research grants for player " + player);
}

// Called at each BUILD phase start with the upcoming wave number.
function tdCheckTierUnlocks(upcomingWave)
{
	while (tdTiersUnlocked < tdTowerTiers.length &&
		tdTowerTiers[tdTiersUnlocked].unlockWave <= upcomingWave)
	{
		const tier = tdTowerTiers[tdTiersUnlocked];
		tdEnableTier(tdTiersUnlocked, tdConfig.humanPlayer);
		if (tier.unlockWave > 0 && tier.structures.length > 0)
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

// Proven-buildable flanking spots along lane B (see td_economy.js notes).
const tdFlankRowA = [
	{ x: 14, y: 57 }, { x: 18, y: 56 }, { x: 22, y: 57 }, { x: 26, y: 56 }
];
const tdFlankRowB = [
	{ x: 14, y: 54 }, { x: 18, y: 53 }, { x: 22, y: 54 }, { x: 26, y: 53 }, { x: 30, y: 54 }
];

function tdPlaceTestTower(towerId, spot)
{
	const tower = addStructure(towerId, tdConfig.humanPlayer, spot.x * 128, spot.y * 128);
	debug("TD-TIER: HARNESS test-place " + towerId + " at (" + spot.x + "," + spot.y + "): " +
		(tower ? "OK id=" + tower.id : "FAILED"));
}

// Harness-only: place one of each tower of a freshly unlocked tier (row keyed
// by tier index so consecutive tiers don't collide on the same tiles).
function tdPlaceTierForTest(tierIndex)
{
	const rows = { 1: tdFlankRowA, 2: tdFlankRowB, 4: tdFlankRowA, 5: tdFlankRowB };
	const flankSpots = rows[tierIndex] || [];
	const tier = tdTowerTiers[tierIndex];
	for (let i = 0; i < tier.structures.length && i < flankSpots.length; ++i)
	{
		tdPlaceTestTower(tier.structures[i][0], flankSpots[i]);
	}
}

// Harness-only start-of-game kill test for a single tier: whitelist + place its
// non-AA towers on both flank rows and make defeat unreachable (999 lives) so
// every wave passes the towers. AA towers are skipped (no VTOL waves until
// Leg 2.2 — nothing for them to shoot headlessly).
function tdRunTierKillTest()
{
	const tier = tdTowerTiers[tdDebugTierKillTest];
	if (!tier)
	{
		debug("TD-TIER: HARNESS kill-test: invalid tier index " + tdDebugTierKillTest);
		return;
	}
	tdLives = 999;
	debug("TD-TIER: HARNESS kill-test for tier " + tdDebugTierKillTest +
		" (" + tier.label + "), lives forced to 999");
	let spot = 0;
	for (let i = 0; i < tier.structures.length; ++i)
	{
		const towerId = tier.structures[i][0];
		if (towerId.indexOf("AASite") === 0)
		{
			debug("TD-TIER: HARNESS kill-test skipping AA tower " + towerId + " (no VTOL waves yet)");
			continue;
		}
		setStructureLimits(towerId, 100, tdConfig.humanPlayer);
		if (spot < tdFlankRowA.length)
		{
			tdPlaceTestTower(towerId, tdFlankRowA[spot]);
		}
		if (spot < tdFlankRowB.length)
		{
			tdPlaceTestTower(towerId, tdFlankRowB[spot]);
		}
		spot += 1;
	}
}
