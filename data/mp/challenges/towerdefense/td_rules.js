// Siege Protocol — custom rules script (replaces multiplay/script/rules entirely).
// Referenced from challenge JSON as: "scripts": { "rules": "towerdefense/td_rules.js" }
// (resolved relative to challenges/ — see doc/tower-defense/VERIFY.md §6.1).
//
// Savegame rules honored throughout (doc/Scripting.md):
// - all globals case-insensitively unique
// - no game objects stored in globals (IDs / plain types only)
// - consts hold static config only (consts are NOT saved)
// - every timer re-armed from eventGameLoaded (timers are not saved)

// Order matters: td_waves.js defines tdCreepCatalog, which the wave tables in
// td_maps.js reference at include time.
include("challenges/towerdefense/td_waves.js");
include("challenges/towerdefense/td_maps.js");
include("challenges/towerdefense/td_towers.js");
include("challenges/towerdefense/td_economy.js");

// Receive events for all players' objects (needed for creep tracking in later legs).
receiveAllEvents(true);

// ---------------------------------------------------------------- static config
const tdConfig = {
	humanPlayer: 0,     // design decision D1
	siegePlayer: 1,     // design decision D1 ("SIEGE", script-driven, ai: null)
	truckLimit: 2,      // no unit production, ever
	masterTickMs: 1000, // 1s master tick (drives the wave engine)
	heartbeatTicks: 30, // debug heartbeat every N ticks (headless verification)
	reorderSecs: 10,    // re-issue attack-move to non-fighting creeps every N s
	difficultyKey: "medium" // selects the tdDifficulty row (td-outpost = Medium)
};

// Difficulty knobs (Leg 1.4). lives = starting lives; startingPower = initial
// power; creepMult = wave group count multiplier (ceil, min 1 per group).
const tdDifficulty = {
	easy: { lives: 30, startingPower: 1600, creepMult: 0.8 },
	medium: { lives: 20, startingPower: 1300, creepMult: 1.0 },
	hard: { lives: 12, startingPower: 1100, creepMult: 1.3 }
};

function tdDiff()
{
	// Per-map difficulty (td_maps.js) wins; tdConfig.difficultyKey is the fallback.
	const key = (tdMapDef && tdMapDef.difficulty) ? tdMapDef.difficulty : tdConfig.difficultyKey;
	return tdDifficulty[key] || tdDifficulty.medium;
}

// ---------------------------------------------------------------- mutable state
// (plain types only; saved/restored by the engine)
var tdHqId = 0;         // id of the player's Command Center (0 = not placed yet)
var tdSetupDone = false; // guards against double setup
var tdTickCount = 0;    // master tick counter

// ---------------------------------------------------------------- UX setup

// Build-only reticule: Close + Build live; everything else present but inert
// (empty image names render the button unavailable, mirroring default reticule.js).
function tdSetReticule()
{
	setReticuleButton(0, _("Close"), "image_cancel_up.png", "image_cancel_down.png");
	setReticuleButton(1, _("Manufacture - unavailable in Siege Protocol"), "", "");
	setReticuleButton(2, _("Research - unavailable in Siege Protocol"), "", "");
	if (enumDroid(selectedPlayer, DROID_CONSTRUCT).length > 0)
	{
		setReticuleButton(3, _("Build (F3)"), "image_build_up.png", "image_build_down.png");
	}
	else
	{
		setReticuleButton(3, _("Build - no trucks left"), "", "");
	}
	setReticuleButton(4, _("Design - unavailable in Siege Protocol"), "", "");
	setReticuleButton(5, _("Intelligence Display - unavailable in Siege Protocol"), "", "");
	setReticuleButton(6, _("Commanders - unavailable in Siege Protocol"), "", "");
}

function tdSetupUx()
{
	setRevealStatus(true); // light fog, as in default multiplayer rules
	if (tilesetType === "ARIZONA")
	{
		setCampaignNumber(1);
	}
	else if (tilesetType === "URBAN")
	{
		setCampaignNumber(2);
	}
	else if (tilesetType === "ROCKIES")
	{
		setCampaignNumber(3);
	}
	if (tilesetType !== "ARIZONA")
	{
		setSky("texpages/page-25-sky-urban.png", 0.5, 10000.0);
	}
	setDesign(false);   // no unit design, ever
	setMiniMap(true);   // player has an HQ from the start
	showInterface();    // must precede reticule button setup
	queue("tdSetReticule", 100);
}

// ---------------------------------------------------------------- limits & power

function tdApplyLimits()
{
	// Zero every structure limit for the human player, then whitelist towers/walls.
	// Stats.Building is keyed by DISPLAY NAME; the engine-usable structure ID is
	// in the .Id property (setStructureLimits requires IDs — found empirically).
	const allBuildings = Object.keys(Stats.Building);
	for (let i = 0; i < allBuildings.length; ++i)
	{
		setStructureLimits(Stats.Building[allBuildings[i]].Id, 0, tdConfig.humanPlayer);
	}
	debug("TD: zeroed structure limits for " + allBuildings.length + " structure types");
	// The HQ needs limit 1 so our own addStructure() below can place it
	// (addStructure respects limits — found empirically). It is never
	// enableStructure()d, so the player still cannot build one.
	setStructureLimits("A0CommandCentre", 1, tdConfig.humanPlayer);
	// Enable tier 0 (starting towers/walls) now, inside the hackNetOff block;
	// later tiers unlock at waves 3/5/8 via tdCheckTierUnlocks (td_towers.js).
	tdCheckTierUnlocks(0);

	// No unit production is possible (no factories), but belt-and-braces:
	setDroidLimit(tdConfig.humanPlayer, tdConfig.truckLimit, DROID_ANY);
	setDroidLimit(tdConfig.humanPlayer, tdConfig.truckLimit, DROID_CONSTRUCT);
	setDroidLimit(tdConfig.humanPlayer, 0, DROID_COMMAND);

	setPower(tdDiff().startingPower, tdConfig.humanPlayer);
	// Power modifier left at engine default (100). With no oil derricks owned
	// there is no passive engine income anyway; the TD economy (Leg 1.3) grants
	// power directly via setPower(). Decision logged in TD_PROGRESS.md.
}

// ---------------------------------------------------------------- board setup

function tdClearPlayerObjects(player)
{
	const oldStructs = enumStruct(player);
	for (let i = 0; i < oldStructs.length; ++i)
	{
		removeObject(oldStructs[i]);
	}
	const oldDroids = enumDroid(player);
	for (let j = 0; j < oldDroids.length; ++j)
	{
		removeObject(oldDroids[j]);
	}
	debug("TD: cleared " + oldStructs.length + " structures / " + oldDroids.length + " droids for player " + player);
}

// Runs one tick after eventStartLevel: removeObject() only queues removals
// (src/wzapi.cpp scriptQueuedObjectRemovals), so the map's pre-placed HQ still
// counts against the limit until the clearing event returns (found empirically).
function tdPlaceStartingBoard()
{
	if (!tdMapDef)
	{
		debug("TD: ERROR - no map config for \"" + mapName + "\" in td_maps.js");
		return;
	}
	hackNetOff();

	const hqStruct = addStructure("A0CommandCentre", tdConfig.humanPlayer, tdMapDef.hq.x * 128, tdMapDef.hq.y * 128);
	if (hqStruct)
	{
		tdHqId = hqStruct.id;
		debug("TD: HQ placed at tile (" + tdMapDef.hq.x + "," + tdMapDef.hq.y + ") id=" + tdHqId);
	}
	else
	{
		debug("TD: ERROR - failed to place HQ at (" + tdMapDef.hq.x + "," + tdMapDef.hq.y + ")");
	}

	for (let i = 0; i < tdMapDef.trucks.length; ++i)
	{
		const spot = tdMapDef.trucks[i];
		const truck = addDroid(tdConfig.humanPlayer, spot.x, spot.y, _("Truck"),
			"Body1REC", "wheeled01", "", "", "Spade1Mk1");
		if (truck)
		{
			debug("TD: truck " + (i + 1) + " placed at tile (" + spot.x + "," + spot.y + ") id=" + truck.id);
		}
		else
		{
			debug("TD: ERROR - failed to place truck at (" + spot.x + "," + spot.y + ")");
		}
	}

	debug("TD: spawn points configured: " + tdMapDef.spawns.length);
	centreView(tdMapDef.hq.x, tdMapDef.hq.y);
	debug("TD: power=" + playerPower(tdConfig.humanPlayer) +
		" structLimitHQ=" + getStructureLimit("A0CommandCentre", tdConfig.humanPlayer) +
		" structLimitFactory=" + getStructureLimit("A0LightFactory", tdConfig.humanPlayer) +
		" structLimitTower=" + getStructureLimit("GuardTower1", tdConfig.humanPlayer));
	hackNetOn();
	queue("tdSetReticule", 100);
	tdInitLives();
	if (tdDebugPlaceTowers > 0)
	{
		tdPlaceDebugTowers(); // harness-only (inert in the real challenge)
	}
	if (tdDebugTierKillTest > 0)
	{
		tdRunTierKillTest(); // harness-only tier kill-attribution test
	}
	if (tdDebugWallLane === 1)
	{
		tdPlaceWallLine(); // harness-only R11 stall-response test
	}
	tdWavesBegin(); // start the wave cycle (BUILD phase of wave 1)
	debug("TD: setup complete");
}

// ---------------------------------------------------------------- timers

// All timers are armed here, and ONLY here — called from both eventStartLevel
// and eventGameLoaded. NOTE (Leg 1.2 finding): the current engine DOES save
// and restore script timers and queued calls (scriptstate.json, version 2) —
// the "timers are not saved" doc note is outdated. removeTimer() first makes
// re-arming idempotent either way (no double ticks after load).
function tdArmTimers()
{
	removeTimer("tdMasterTick");
	setTimer("tdMasterTick", tdConfig.masterTickMs);
	debug("TD: timers armed");
}

function tdMasterTick()
{
	tdTickCount += 1;
	tdWaveTick();    // wave engine state machine (td_waves.js)
	tdEconomyTick(); // passive income, leaks, lives, harness knobs (td_economy.js)
	if (tdTickCount % tdConfig.heartbeatTicks === 0)
	{
		debug("TD: heartbeat tick=" + tdTickCount + " gameTime=" + gameTime +
			" waveState=" + tdWaveState + " wave=" + tdWaveNum +
			" lives=" + tdLives + " power=" + playerPower(tdConfig.humanPlayer));
	}
}

// ---------------------------------------------------------------- events

function eventGameInit()
{
	debug("TD: eventGameInit (rules=towerdefense/td_rules.js)");
	tdSetupUx();
}

function eventStartLevel()
{
	debug("TD: eventStartLevel");
	if (tdSetupDone)
	{
		debug("TD: setup already done, skipping");
		return;
	}
	hackNetOff();
	// NOTE: limits are applied here (not in eventGameInit): with an active
	// challenge the engine resets structure limits to their stats defaults
	// after eventGameInit, which silently reverted them (found empirically in
	// Leg 1.1). applyLimitSet() runs first because it overwrites script-set
	// limits with the lobby limit set (src/multilimit.cpp).
	applyLimitSet();
	tdApplyLimits();
	// Engine-placed starting units depend on map + bases setting; normalize to
	// exactly: our HQ + our two trucks (player 0), nothing at all (player 1).
	tdClearPlayerObjects(tdConfig.humanPlayer);
	tdClearPlayerObjects(tdConfig.siegePlayer);
	hackNetOn();
	tdSetupDone = true;
	tdArmTimers();
	// Removals above are only queued; place our board next tick.
	queue("tdPlaceStartingBoard", 100);
}

function eventGameLoaded()
{
	debug("TD: eventGameLoaded - re-arming timers, waveState=" + tdWaveState +
		" wave=" + tdWaveNum + " pendingSpawns=" + tdPendingSpawns.length);
	tdSetupUx();
	if (tdGameEnded)
	{
		removeTimer("tdMasterTick"); // finished game: nothing left to drive
		return;
	}
	// Defensively re-enable every unlocked tier (structure availability may
	// not fully persist through save/load; idempotent).
	for (let t = 0; t < tdTiersUnlocked; ++t)
	{
		tdEnableTier(t, tdConfig.humanPlayer);
	}
	tdArmTimers();
	// The engine restores queued calls too (Leg 1.2 finding), but re-queueing
	// pending spawns is harmless: tdSpawnNext() drains a shared array and
	// no-ops once it is empty. Belt-and-braces for older engines.
	if (tdPendingSpawns.length > 0)
	{
		tdQueuePendingSpawns();
	}
	queue("tdSetReticule", 100);
}

function eventDestroyed(gameObject)
{
	// Bounty for combat kills + HQ-destroyed defeat (td_economy.js).
	tdEconomyOnDestroyed(gameObject);
	// Keep the Build button truthful if the player loses trucks.
	if (gameObject.type === DROID && gameObject.player === tdConfig.humanPlayer)
	{
		queue("tdSetReticule", 100);
	}
}
