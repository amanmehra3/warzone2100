// Siege Protocol — data-driven wave engine.
// Loaded via include("challenges/towerdefense/td_waves.js") from td_rules.js.
// Wave tables live per-map in td_maps.js (tdMapDef.waves).
//
// State machine (driven from tdMasterTick in td_rules.js, 1s tick):
//   IDLE -> BUILD -> SPAWNING -> ACTIVE -> (CLEARED) -> BUILD ... -> DONE
// Savegame rules: all mutable state below is plain types (saved/restored);
// queued spawns are re-queued from eventGameLoaded (queue() is not saved).

// ---------------------------------------------------------------- creep catalog
// Named library of creep specs (Leg 2.2). Every body/prop/turret combination
// verified against data/mp/stats/templates.json entries. Wave tables in
// td_maps.js reference these entries. vtol creeps are ordered via
// orderDroidObj(DORDER_ATTACK, HQ) — VTOLs ignore DORDER_SCOUT/MOVE (verified
// empirically); boss creeps trigger a console() warning on spawn.
const tdCreepCatalog = {
	runner: { name: "Machinegun Viper Wheels", body: "Body1REC", prop: "wheeled01", turrets: ["MG1Mk1"] },
	runnerTwin: { name: "Twin Machinegun Viper Wheels", body: "Body1REC", prop: "wheeled01", turrets: ["MG2Mk1"] },
	runnerHmg: { name: "Heavy Machinegun Viper Wheels", body: "Body1REC", prop: "wheeled01", turrets: ["MG3Mk1"] },
	runnerFlamer: { name: "Flamer Viper Wheels", body: "Body1REC", prop: "wheeled01", turrets: ["Flame1Mk1"] },
	runnerLancer: { name: "Lancer Viper Wheels", body: "Body1REC", prop: "wheeled01", turrets: ["Rocket-LtA-T"] },
	soldier: { name: "Light Cannon Cobra Tracks", body: "Body5REC", prop: "tracked01", turrets: ["Cannon1Mk1"] },
	soldierMedium: { name: "Medium Cannon Cobra Tracks", body: "Body5REC", prop: "tracked01", turrets: ["Cannon2A-TMk1"] },
	soldierHeavy: { name: "Heavy Cannon Cobra Tracks", body: "Body5REC", prop: "tracked01", turrets: ["Cannon375mmMk1"] },
	scorpion: { name: "Medium Cannon Scorpion Tracks", body: "Body8MBT", prop: "tracked01", turrets: ["Cannon2A-TMk1"] },
	hoverStriker: { name: "Heavy Machinegun Cobra Hover", body: "Body5REC", prop: "hover01", turrets: ["MG3Mk1"] },
	hoverInferno: { name: "Inferno Cobra Hover", body: "Body5REC", prop: "hover01", turrets: ["Flame2"] },
	tank: { name: "Heavy Cannon Python Tracks", body: "Body11ABT", prop: "tracked01", turrets: ["Cannon375mmMk1"] },
	tankTiger: { name: "Heavy Cannon Tiger Tracks", body: "Body9REC", prop: "tracked01", turrets: ["Cannon375mmMk1"] },
	vtolBomber: { name: "SIEGE Cluster Bomber", body: "Body4ABT", prop: "V-Tol", turrets: ["Bomb1-VTOL-LtHE"], vtol: true },
	vtolLancer: { name: "SIEGE Lancer VTOL", body: "Body8MBT", prop: "V-Tol", turrets: ["Rocket-VTOL-LtA-T"], vtol: true },
	bossRetribution: { name: "RETRIBUTION-class breaker", body: "Body7ABT", prop: "tracked01", turrets: ["RailGun1Mk1"], boss: true },
	bossVengeance: { name: "VENGEANCE-class breaker", body: "Body10MBT", prop: "tracked01", turrets: ["Rocket-HvyA-T"], boss: true }
};

// ---------------------------------------------------------------- state (saved)
var tdWaveNum = 0;          // 1-based wave number; 0 = before first wave
var tdWaveState = "IDLE";   // IDLE | BUILD | SPAWNING | ACTIVE | DONE
var tdBuildSecsLeft = 0;    // BUILD countdown (seconds)
var tdActiveSecs = 0;       // seconds current wave has been SPAWNING/ACTIVE
var tdWaveDroidIds = [];    // ids (numbers) of live droids of the current wave
var tdPendingSpawns = [];   // plain spawn specs not yet executed
var tdVtolPassMade = {};    // VTOL ids that already flew an attack pass
var tdCreepStall = {};      // id -> {x, y, strikes} for the R11 stall detector
// Harness-only knob: when > 0, live wave droids are force-removed after this
// many ACTIVE seconds so the CLEARED path can be exercised headlessly (no
// towers exist to kill creeps). MUST stay 0 here; the tests shim overrides it.
var tdDebugAutoClearSecs = 0;

// ---------------------------------------------------------------- helpers

function tdAnnounce(text)
{
	console(text);              // player-facing (invisible headlessly)
	debug("TD-UI: " + text);    // harness-visible mirror
}

function tdLivingWaveDroids()
{
	// Reconcile tracked ids against reality (never store objects in globals).
	const alive = enumDroid(tdConfig.siegePlayer);
	const aliveIds = {};
	for (let i = 0; i < alive.length; ++i)
	{
		aliveIds[alive[i].id] = true;
	}
	const stillAlive = [];
	for (let j = 0; j < tdWaveDroidIds.length; ++j)
	{
		if (aliveIds[tdWaveDroidIds[j]])
		{
			stillAlive.push(tdWaveDroidIds[j]);
		}
	}
	return stillAlive;
}

// ---------------------------------------------------------------- phases

function tdStartBuildPhase()
{
	const nextWave = tdMapDef.waves[tdWaveNum]; // tdWaveNum is 1-based; index = next wave
	tdWaveState = "BUILD";
	tdBuildSecsLeft = nextWave.delay;
	tdActiveSecs = 0;
	tdCheckTierUnlocks(tdWaveNum + 1); // tier milestones (td_towers.js)
	if (tdDebugBaseline === 1)
	{
		tdBaselineBuild(); // harness-only baseline-player stub (tuning runs)
	}
	debug("TD-WAVE: BUILD phase for wave " + (tdWaveNum + 1) + "/" + tdMapDef.waves.length +
		" (" + tdBuildSecsLeft + "s)");
	tdAnnounce(_("Wave") + " " + (tdWaveNum + 1) + " " + _("incoming in") + " " + tdBuildSecsLeft + "s");
}

function tdBeginWave()
{
	tdWaveNum += 1;
	const wave = tdMapDef.waves[tdWaveNum - 1];
	tdWaveState = "SPAWNING";
	tdActiveSecs = 0;
	tdWaveDroidIds = [];
	tdPendingSpawns = [];
	tdWaveBounty = 0;   // per-wave economy counters (td_economy.js)
	tdWaveLeaks = 0;
	tdNoBountyIds = {}; // previous wave's script-removed ids no longer needed
	tdVtolPassMade = {};
	tdCreepStall = {};
	for (let g = 0; g < wave.groups.length; ++g)
	{
		const group = wave.groups[g];
		// Difficulty multiplier: ceil, min 1 per group (td_rules.js tdDifficulty).
		const scaledCount = Math.max(1, Math.ceil(group.count * tdDiff().creepMult));
		for (let c = 0; c < scaledCount; ++c)
		{
			tdPendingSpawns.push({
				name: group.template.name,
				body: group.template.body,
				prop: group.template.prop,
				turrets: group.template.turrets,
				boss: group.template.boss ? true : false,
				spawn: group.spawn,
				delayMs: c * group.stagger
			});
		}
	}
	debug("TD-WAVE: wave " + tdWaveNum + " SPAWNING, " + tdPendingSpawns.length + " creeps queued");
	if (wave.announce)
	{
		tdAnnounce(wave.announce);
	}
	tdQueuePendingSpawns();
}

// Queue one tdSpawnNext call per pending spawn (also used by eventGameLoaded
// to re-queue what was pending at save time — queue() calls are not saved).
function tdQueuePendingSpawns()
{
	for (let i = 0; i < tdPendingSpawns.length; ++i)
	{
		queue("tdSpawnNext", tdPendingSpawns[i].delayMs);
	}
}

// Order one creep toward the HQ. Ground creeps attack-move (DORDER_SCOUT);
// VTOLs ignore SCOUT/MOVE entirely (verified empirically) and need an attack
// order on a specific object — the HQ.
function tdOrderCreep(creep)
{
	if (creep.propulsion === "V-Tol")
	{
		const hqObject = getObject(STRUCTURE, tdConfig.humanPlayer, tdHqId);
		if (hqObject)
		{
			orderDroidObj(creep, DORDER_ATTACK, hqObject);
		}
		return;
	}
	orderDroidLoc(creep, DORDER_SCOUT, tdMapDef.hq.x, tdMapDef.hq.y);
}

function tdSpawnNext()
{
	const spec = tdPendingSpawns.shift();
	if (!spec)
	{
		return;
	}
	const spawnPos = tdMapDef.spawns[spec.spawn];
	const creep = addDroid(tdConfig.siegePlayer, spawnPos.x, spawnPos.y,
		spec.name, spec.body, spec.prop, "", "", spec.turrets[0]);
	if (creep)
	{
		tdWaveDroidIds.push(creep.id);
		tdOrderCreep(creep);
		if (spec.boss)
		{
			tdAnnounce(_("WARNING:") + " " + spec.name + " " + _("inbound!"));
		}
		debug("TD-WAVE: spawned " + spec.body + "/" + spec.turrets[0] +
			" id=" + creep.id + " lane=" + spec.spawn +
			" at (" + spawnPos.x + "," + spawnPos.y + "), " +
			tdPendingSpawns.length + " left");
	}
	else
	{
		debug("TD-WAVE: ERROR - addDroid failed for " + spec.body + "/" + spec.turrets[0] +
			" lane=" + spec.spawn);
	}
}

function tdOnWaveCleared()
{
	const wave = tdMapDef.waves[tdWaveNum - 1];
	setPower(playerPower(tdConfig.humanPlayer) + wave.reward, tdConfig.humanPlayer);
	debug("TD-WAVE: wave " + tdWaveNum + " CLEARED, reward=" + wave.reward +
		" bounty=" + tdWaveBounty + " leaks=" + tdWaveLeaks +
		" lives=" + tdLives + " power=" + playerPower(tdConfig.humanPlayer));
	tdAnnounce(_("Wave") + " " + tdWaveNum + " " + _("cleared!") + " +" + wave.reward + " " + _("power") +
		" (" + _("bounty:") + " " + tdWaveBounty + ", " + _("lives:") + " " + tdLives + ")");
	if (tdWaveNum >= tdMapDef.waves.length)
	{
		tdVictory(); // all waves survived (td_economy.js)
		return;
	}
	tdStartBuildPhase();
}

// Keep creeps pushing toward the HQ: re-issue attack-move to any wave droid
// not currently fighting. Runs every tdConfig.reorderSecs from the tick.
function tdReorderCreeps()
{
	const creeps = enumDroid(tdConfig.siegePlayer);
	let reordered = 0;
	for (let i = 0; i < creeps.length; ++i)
	{
		const creep = creeps[i];
		if (creep.order === DORDER_ATTACK)
		{
			continue; // fighting - leave it alone
		}
		if (creep.propulsion === "V-Tol")
		{
			// VTOL design (Leg 2.2): one re-targeted pass, then the bomber
			// leaves the battlefield (removed, no bounty, no life cost) so
			// out-of-ammo VTOLs can never stall a wave.
			if (tdVtolPassMade[creep.id])
			{
				tdNoBountyIds[creep.id] = true;
				removeObject(creep);
				debug("TD-WAVE: VTOL id=" + creep.id + " departed after its pass");
				continue;
			}
			tdVtolPassMade[creep.id] = true;
			tdOrderCreep(creep);
			reordered += 1;
			continue;
		}
		// R11 stall detector: a ground creep that is not fighting and has not
		// materially moved between passes attacks the nearest player structure
		// (walled-off lanes get broken through instead of soft-locking).
		const prev = tdCreepStall[creep.id];
		if (prev && Math.abs(prev.x - creep.x) <= 1 && Math.abs(prev.y - creep.y) <= 1)
		{
			prev.strikes += 1;
		}
		else
		{
			tdCreepStall[creep.id] = { x: creep.x, y: creep.y, strikes: 0 };
		}
		const strikes = tdCreepStall[creep.id].strikes;
		if (strikes >= 4)
		{
			// Nothing attackable resolved the stall: neutral despawn failsafe
			// (no bounty, no life lost) so a wave can never soft-lock.
			tdNoBountyIds[creep.id] = true;
			removeObject(creep);
			debug("TD-WAVE: R11 stalled creep id=" + creep.id + " despawned (no resolution)");
			continue;
		}
		if (strikes >= 2)
		{
			const blockers = enumStruct(tdConfig.humanPlayer);
			let bestStruct = null;
			let bestDist = 11; // only attack blockers within 10 tiles
			for (let b = 0; b < blockers.length; ++b)
			{
				const d = distBetweenTwoPoints(creep.x, creep.y, blockers[b].x, blockers[b].y);
				if (d < bestDist)
				{
					bestDist = d;
					bestStruct = blockers[b];
				}
			}
			if (bestStruct)
			{
				orderDroidObj(creep, DORDER_ATTACK, bestStruct);
				debug("TD-WAVE: R11 stalled creep id=" + creep.id + " attacking " +
					bestStruct.name + " at (" + bestStruct.x + "," + bestStruct.y + ")");
				reordered += 1;
				continue;
			}
		}
		tdOrderCreep(creep);
		reordered += 1;
	}
	if (creeps.length > 0)
	{
		const lead = creeps[0];
		debug("TD-WAVE: push check: " + creeps.length + " creeps, reordered " + reordered +
			", lead id=" + lead.id + " hp=" + lead.health + " at (" + lead.x + "," + lead.y + ") distHQ=" +
			distBetweenTwoPoints(lead.x, lead.y, tdMapDef.hq.x, tdMapDef.hq.y));
	}
}

// ---------------------------------------------------------------- master tick

function tdWaveTick()
{
	if (tdWaveState === "IDLE" || tdWaveState === "DONE")
	{
		return;
	}

	if (tdWaveState === "BUILD")
	{
		tdBuildSecsLeft -= 1;
		if (tdBuildSecsLeft > 0 && (tdBuildSecsLeft % 10 === 0 || tdBuildSecsLeft <= 5))
		{
			tdAnnounce(_("Wave") + " " + (tdWaveNum + 1) + ": " + tdBuildSecsLeft + "s");
		}
		if (tdBuildSecsLeft <= 0)
		{
			tdBeginWave();
		}
		return;
	}

	// SPAWNING or ACTIVE
	tdActiveSecs += 1;
	if (tdWaveState === "SPAWNING" && tdPendingSpawns.length === 0)
	{
		tdWaveState = "ACTIVE";
		debug("TD-WAVE: wave " + tdWaveNum + " ACTIVE with " + tdWaveDroidIds.length + " creeps");
	}
	if (tdActiveSecs % tdConfig.reorderSecs === 0)
	{
		tdReorderCreeps();
	}
	// Harness-only forced clear (inert in the real challenge: knob stays 0).
	if (tdDebugAutoClearSecs > 0 && tdWaveState === "ACTIVE" && tdActiveSecs >= tdDebugAutoClearSecs)
	{
		const leftovers = enumDroid(tdConfig.siegePlayer);
		debug("TD-WAVE: HARNESS auto-clear removing " + leftovers.length + " creeps");
		for (let i = 0; i < leftovers.length; ++i)
		{
			tdNoBountyIds[leftovers[i].id] = true; // script removal: no bounty
			removeObject(leftovers[i]);
		}
		// removals are queued (VERIFY.md 6.3.1); reconciliation below sees them next tick
	}
	tdWaveDroidIds = tdLivingWaveDroids();
	if (tdWaveState === "ACTIVE" && tdWaveDroidIds.length === 0)
	{
		tdOnWaveCleared();
	}
}

// Called from td_rules.js once the board is placed (fresh game only).
function tdWavesBegin()
{
	if (tdWaveState !== "IDLE")
	{
		return;
	}
	// Empirical lane check: can standard propulsion reach the HQ from each spawn?
	for (let i = 0; i < tdMapDef.spawns.length; ++i)
	{
		const sp = tdMapDef.spawns[i];
		debug("TD-WAVE: lane " + i + " reach check wheeled=" +
			propulsionCanReach("wheeled01", sp.x, sp.y, tdMapDef.hq.x, tdMapDef.hq.y) +
			" tracked=" + propulsionCanReach("tracked01", sp.x, sp.y, tdMapDef.hq.x, tdMapDef.hq.y) +
			" hover=" + propulsionCanReach("hover01", sp.x, sp.y, tdMapDef.hq.x, tdMapDef.hq.y));
	}
	tdStartBuildPhase();
}
