// Siege Protocol — economy, lives, defeat.
// Loaded via include("challenges/towerdefense/td_economy.js") from td_rules.js.
//
// Bounty design: eventDestroyed fires for EVERY droid death INCLUDING script
// removeObject() calls (code-audited: both removal paths land the object on
// the engine's destroyed list, src/objmem.cpp). So script-initiated removals
// (leaks, harness auto-clear) are marked in tdNoBountyIds first and pay no
// bounty; only real combat kills do.

// ---------------------------------------------------------------- static config
const tdEconomy = {
	buildIncomePerSec: 2,   // passive power during BUILD phase only
	leakRadius: 3,          // tiles from HQ centre = a leak (plan value)
	beelineRadius: 12,      // creeps this close to the HQ stop besieging and walk in
	defaultBounty: 10,
	// bounty per body class (verified body IDs; anything missing pays defaultBounty)
	bountyByBody: {
		"Body1REC": 10,   // Viper
		"Body5REC": 15,   // Cobra
		"Body8MBT": 20,   // Scorpion
		"Body12SUP": 25,  // Mantis
		"Body11ABT": 30,  // Python
		"Body9REC": 30,   // Tiger
		"Body7ABT": 40,   // Retribution
		"Body10MBT": 50   // Vengeance
	}
	// lives / startingPower / creepMult live in tdDifficulty (td_rules.js)
};

// ---------------------------------------------------------------- state (saved)
var tdLives = 0;          // set once at board placement; saved thereafter
var tdWaveBounty = 0;     // bounty earned during the current wave
var tdWaveLeaks = 0;      // leaks during the current wave
var tdGameEnded = false;  // defeat/victory latch
var tdNoBountyIds = {};   // droid ids removed by script -> never pay bounty
// Harness-only knobs (MUST stay inert here; the tests shim may override):
var tdDebugPlaceTowers = 0;   // >0: script-places that many T0 guard towers near the HQ
var tdDebugKillHqTick = 0;    // >0: removeObject() the HQ at this master tick

// ---------------------------------------------------------------- lives / defeat

function tdInitLives()
{
	tdLives = tdDiff().lives;
	const effectiveKey = (tdMapDef && tdMapDef.difficulty) ? tdMapDef.difficulty : tdConfig.difficultyKey;
	debug("TD-ECO: lives initialized to " + tdLives + " (" + effectiveKey + ")");
}

function tdDefeat(reason)
{
	if (tdGameEnded)
	{
		return;
	}
	tdGameEnded = true;
	tdWaveState = "DONE";           // freezes the wave state machine
	removeTimer("tdMasterTick");    // stop all TD timers
	debug("TD-ECO: DEFEAT (" + reason + ") wave=" + tdWaveNum + " lives=" + tdLives);
	tdAnnounce(_("The SIEGE has overrun your outpost."));
	gameOverMessage(false);
}

function tdVictory()
{
	if (tdGameEnded)
	{
		return;
	}
	tdGameEnded = true;
	tdWaveState = "DONE";
	removeTimer("tdMasterTick");
	debug("TD-ECO: VICTORY after wave " + tdWaveNum + " lives=" + tdLives +
		" power=" + playerPower(tdConfig.humanPlayer));
	tdAnnounce(_("The SIEGE is broken. Your outpost stands!"));
	gameOverMessage(true);
}

// ---------------------------------------------------------------- bounty

function tdEconomyOnDestroyed(gameObject)
{
	if (tdGameEnded)
	{
		return;
	}
	if (gameObject.type === STRUCTURE && gameObject.player === tdConfig.humanPlayer &&
		gameObject.id === tdHqId)
	{
		tdDefeat("hq destroyed");
		return;
	}
	if (gameObject.type !== DROID || gameObject.player !== tdConfig.siegePlayer)
	{
		return;
	}
	if (tdNoBountyIds[gameObject.id])
	{
		return; // we removed it ourselves (leak / harness clear)
	}
	if (tdWaveState !== "SPAWNING" && tdWaveState !== "ACTIVE")
	{
		return;
	}
	const bounty = tdEconomy.bountyByBody[gameObject.body] || tdEconomy.defaultBounty;
	setPower(playerPower(tdConfig.humanPlayer) + bounty, tdConfig.humanPlayer);
	tdWaveBounty += bounty;
	debug("TD-ECO: bounty +" + bounty + " (" + gameObject.body + " id=" + gameObject.id +
		") waveBounty=" + tdWaveBounty + " power=" + playerPower(tdConfig.humanPlayer));
}

// ---------------------------------------------------------------- per-tick economy

function tdEconomyTick()
{
	if (tdGameEnded)
	{
		return;
	}
	// Harness-only: force the HQ-destroyed defeat path once a fixed tick is
	// reached (checked before any state gating so it fires in any phase).
	if (tdDebugKillHqTick > 0 && tdTickCount >= tdDebugKillHqTick)
	{
		tdDebugKillHqTick = 0; // fire once
		const hqObject = getObject(STRUCTURE, tdConfig.humanPlayer, tdHqId);
		if (hqObject)
		{
			debug("TD-ECO: HARNESS killing HQ id=" + tdHqId + " at tick " + tdTickCount);
			removeObject(hqObject, true);
		}
	}
	if (tdWaveState === "BUILD")
	{
		setPower(playerPower(tdConfig.humanPlayer) + tdEconomy.buildIncomePerSec, tdConfig.humanPlayer);
		return;
	}
	if (tdWaveState !== "SPAWNING" && tdWaveState !== "ACTIVE")
	{
		return;
	}
	// Leak handling. Creeps besiege the HQ from weapon range under attack-move
	// (observed in Leg 1.2: they stall at 4-9 tiles shooting it), so creeps
	// inside beelineRadius are ordered to walk into the HQ; creeps inside
	// leakRadius are leaks: removed, cost a life.
	const creeps = enumDroid(tdConfig.siegePlayer);
	for (let i = 0; i < creeps.length; ++i)
	{
		const creep = creeps[i];
		if (tdNoBountyIds[creep.id])
		{
			continue; // removal already queued (gotcha: still enumerable this tick)
		}
		const hqDist = distBetweenTwoPoints(creep.x, creep.y, tdMapDef.hq.x, tdMapDef.hq.y);
		if (hqDist <= tdEconomy.leakRadius)
		{
			tdNoBountyIds[creep.id] = true;
			tdWaveLeaks += 1;
			tdLives -= 1;
			removeObject(creep);
			playSound("pcv337.ogg"); // base alert
			console(_("Breach! A SIEGE machine reached your Command Center.") + " " +
				_("Lives left:") + " " + tdLives);
			debug("TD-ECO: LEAK id=" + creep.id + " (" + creep.body + ") lives=" + tdLives +
				" waveLeaks=" + tdWaveLeaks);
			if (tdLives <= 0)
			{
				tdDefeat("lives exhausted");
				return;
			}
		}
		else if (hqDist <= tdEconomy.beelineRadius)
		{
			orderDroidLoc(creep, DORDER_MOVE, tdMapDef.hq.x, tdMapDef.hq.y);
		}
	}
}

// ---------------------------------------------------------------- harness towers

// Harness-only: place a few T0 guard towers on the approaches so real combat
// kills occur headlessly (bounty path). Inert unless tdDebugPlaceTowers > 0.
function tdPlaceDebugTowers()
{
	// Flanking positions 3-4 tiles OFF lane B's observed walk line
	// ((14,59)->(27,60)->(41,57)->(46,58), Leg 1.2 push logs) but within
	// MG3Mk1 range (960 world units = 7.5 tiles). Towers placed ON a lane
	// tile block the corridor and creeps stall out of range with no shots
	// fired (found empirically in Leg 1.3) — flanking keeps the lane open so
	// creeps walk past under sustained fire: kills AND leaks both happen.
	const spots = [
		{ x: 36, y: 55 }, { x: 41, y: 53 },
		{ x: 30, y: 56 }, { x: 44, y: 54 },
		{ x: 25, y: 57 }, { x: 46, y: 53 }
	];
	let placed = 0;
	for (let i = 0; i < spots.length && placed < tdDebugPlaceTowers; ++i)
	{
		const tower = addStructure("GuardTower1", tdConfig.humanPlayer, spots[i].x * 128, spots[i].y * 128);
		if (tower)
		{
			placed += 1;
			debug("TD-ECO: HARNESS tower " + placed + " placed at (" + spots[i].x + "," + spots[i].y + ")");
		}
		else
		{
			debug("TD-ECO: HARNESS tower placement failed at (" + spots[i].x + "," + spots[i].y + ")");
		}
	}
}
