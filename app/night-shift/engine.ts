// NIGHT SHIFT — deterministic game engine. No React, no DOM: a reducer over
// GameState driven by TICK actions. 1 real second = 2 game minutes.
//
// The core deception: alarms and trend projections are computed from SENSOR
// READINGS, which can drift or stick. Physical damage (throttling, shutdown)
// follows the TRUE temperature. The console can lie; the physics never does.

import type {
  Action,
  Alarm,
  AssistRec,
  CracUnit,
  GameState,
  HandoverCandidate,
  LiquidLoop,
  NightPlan,
  Sensor,
  Severity,
  Zone,
  ZoneId,
} from './types'

export const TIME_SCALE = 2 // game minutes per real second
export const SHIFT_END = 480 // 22:00 → 06:00

const TEMP_WARN = 33
const TEMP_CRIT = 38
const TEMP_SHUTDOWN = 42
const TEMP_RECOVER = 34
const DOOR_TIMEOUT = 24 // ~12 real seconds to read a work order properly
const ACK_GRACE = 10
const SMOKE_FUSE = 30 // game minutes from pre-alarm to fire (if real) — long enough to verify on foot
const HISTORY_STEP = 2 // sample sensor-max every N game minutes
const HISTORY_MAX = 40

// liquid loop (Hall B direct-to-chip) — the fast tempo
const TJ_WARN = 88
const TJ_THROTTLE = 95
const TJ_TRIP = 105
const TJ_START_OK = 90
// memory/VRMs are the AIR-cooled half of a hybrid rack: they ride hall B's
// CRACs, not the liquid loop, and move on a slower clock than the die
const MEM_WARN = 80
const MEM_THROTTLE = 88
const LEAK_FUSE = 24 // game minutes from leak alert to busbar contact (if real) — verifiable on foot
const PUMP_SPINUP = 3 // game minutes for a starting pump to reach full flow

// ---------------------------------------------------------------- night plan
// Seed → authored permutation of tonight. Seed 1 (bits all zero) is the
// canonical night the tests were written against. 32 distinct nights; every
// one is deterministic, so a seed fully identifies a shareable shift.
export const NIGHT_SEEDS = 32
export function buildNightPlan(seed: number, quiet = false): NightPlan {
  const n = Math.min(NIGHT_SEEDS, Math.max(1, Math.floor(seed) || 1))
  const bits = n - 1
  return {
    seed: n,
    quiet,
    driftIdxA: (bits & 1) as 0 | 1,
    stuckIdxB: ((bits >> 1) & 1 ? 0 : 1) as 0 | 1, // canonical night sticks S2
    faultPump: bits & 4 ? 'P2' : 'P1',
    hardFaultB: bits & 8 ? 'CRAC-3' : 'CRAC-4',
    bogusCover: ((bits >> 4) & 1) as 0 | 1,
  }
}

// the bogus visitor's two authored cover stories — both near-miss a real ticket
export const BOGUS_COVERS = [
  { name: 'M. Tan', company: 'CoolFlow Services', claim: 'Emergency CRAC filter job — office said tonight is fine.', workOrder: 'WO-4471' },
  { name: 'D. Lim', company: 'PowerSure Pte Ltd', claim: 'UPS maintenance — dispatch moved our window up, should be in the system.', workOrder: 'WO-8820' },
] as const

export function clockLabel(t: number): string {
  const total = (22 * 60 + Math.floor(t)) % (24 * 60)
  const h = Math.floor(total / 60)
  const m = total % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function freshSensor(): Sensor {
  return { fault: 'none', faultAt: 0, frozen: 0, isolated: false, kudosGiven: false }
}

function freshZone(id: ZoneId, name: string, racks: number): Zone {
  return {
    id,
    name,
    temp: 24,
    racks,
    serversDown: false,
    epo: false,
    fire: false,
    sensors: [freshSensor(), freshSensor()],
    readings: [24, 24],
    history: [24],
    lastSample: 0,
    warned: false,
    critAlarmed: false,
  }
}

export function initialState(seed = 1, quiet = false): GameState {
  return {
    phase: 'start',
    night: buildNightPlan(seed, quiet),
    t: 0,
    cracs: [
      { id: 'CRAC-1', zone: 'A', status: 'running' },
      { id: 'CRAC-2', zone: 'A', status: 'running' },
      { id: 'CRAC-3', zone: 'B', status: 'running' },
      { id: 'CRAC-4', zone: 'B', status: 'running' },
    ],
    zones: [
      freshZone('A', 'HALL A · GENERAL COMPUTE', 42),
      freshZone('B', 'HALL B · GPU / HPC', 28),
    ],
    ups: { onBattery: false, sinceT: 0, acked: true },
    alarms: [],
    door: null,
    doorHistory: [],
    tickets: quiet
      ? [{ wo: '—', desc: 'No contractor works scheduled', window: 'tonight' }]
      : [
          { wo: 'WO-8802', desc: 'UPS preventive maintenance — PowerSure Pte Ltd', window: '02:00–04:00' },
          { wo: 'WO-4417', desc: 'CRAC filter replacement — CoolFlow Services', window: 'TOMORROW 10:00' },
          { wo: 'WO-9130', desc: 'Loading dock delivery (no hall access)', window: '05:00–05:30' },
        ],
    operator: { kind: 'console' },
    smoke: null,
    assist: { recs: [], nextRecId: 1 },
    handover: null,
    coffeeFixed: false,
    raining: false,
    rounds: { count: 0, lastAt: -999, visited: [], log: [] },
    hotRack: null,
    liquid: {
      pumps: [
        { id: 'P1', status: 'running', readyAt: 0 },
        { id: 'P2', status: 'standby', readyAt: 0 },
      ],
      flow: 100,
      tj: 78,
      memT: 66,
      memThrottleMin: 0,
      memWarned: false,
      memCritAlarmed: false,
      tjHistory: [78],
      lastTjSample: 0,
      load: 65,
      shed: false,
      gpuRunning: true,
      damaged: false,
      bearingServiced: false,
      loopLocked: false,
      gpuThrottleMin: 0,
      shedMin: 0,
      tjWarned: false,
      tjCritAlarmed: false,
      leak: null,
    },
    log: [{ time: 0, text: 'Shift start. Day crew signed out. You are the only operator on site.' }],
    downtimeMin: 0,
    throttleMin: 0,
    score: [],
    firedEvents: [],
    sabotageAt: null,
    nextId: 1,
  }
}

// ---------------------------------------------------------------- helpers

function log(s: GameState, text: string): void {
  s.log.push({ time: s.t, text })
  if (s.log.length > 100) s.log.splice(0, s.log.length - 100)
}

function raise(
  s: GameState,
  severity: Severity,
  text: string,
  meta?: { eop?: string; unit?: string; zone?: ZoneId },
): Alarm {
  // info alarms are notifications — born acknowledged, never "left ringing"
  const a: Alarm = { id: s.nextId++, time: s.t, severity, text, acked: severity === 'info', penalized: false, ...meta }
  s.alarms.unshift(a)
  log(s, `ALARM [${severity.toUpperCase()}] ${text}`)
  return a
}

function addScore(s: GameState, text: string, pts: number): void {
  s.score.push({ time: s.t, text, pts })
}

function crac(s: GameState, id: string): CracUnit {
  const u = s.cracs.find((c) => c.id === id)
  if (!u) throw new Error(`unknown unit ${id}`)
  return u
}

function zone(s: GameState, id: ZoneId): Zone {
  return s.zones.find((z) => z.id === id) as Zone
}

function faultedPump(s: GameState) {
  return s.liquid.pumps.find((p) => p.id === s.night.faultPump)!
}

function firstRunning(s: GameState, zoneId: ZoneId): CracUnit | undefined {
  return s.cracs.find((c) => c.zone === zoneId && c.status === 'running')
}

function tripUnit(s: GameState, u: CracUnit | undefined, mechanical: boolean): void {
  if (!u || u.status !== 'running') return
  u.status = mechanical ? 'failed' : 'tripped'
  raise(
    s,
    'critical',
    mechanical
      ? `${u.id} HARD FAULT — compressor lockout. On-site reset required.`
      : `${u.id} tripped on high-pressure cutout.`,
    { eop: 'EOP-03', unit: u.id, zone: u.zone },
  )
}

// deterministic per-sensor wobble so healthy readings don't look synthetic
function sensorReading(s: GameState, z: Zone, idx: 0 | 1): number {
  const sen = z.sensors[idx]
  if (sen.fault === 'stuck') return sen.frozen
  let v = z.temp + Math.sin(s.t * 0.7 + idx * 2.1 + (z.id === 'A' ? 0 : 3.7)) * 0.15
  if (sen.fault === 'drift') v += Math.min(12, (s.t - sen.faultAt) * 0.35)
  return v
}

// what the BMS believes the hall temperature is (isolated sensors excluded)
export function consensusTemp(z: Zone): number | null {
  const active = z.readings.filter((_, i) => !z.sensors[i].isolated)
  return active.length ? Math.max(...active) : null
}

// ---------------------------------------------------------------- scenario

interface ScenarioEvent {
  at: number
  run: (s: GameState) => void
}

const SCENARIO: ScenarioEvent[] = [
  { at: 12, run: (s) => tripUnit(s, crac(s, 'CRAC-2'), false) },
  {
    at: 40,
    run: (s) => {
      const cover = BOGUS_COVERS[s.night.bogusCover]
      s.door = {
        id: s.nextId++,
        arrivedAt: s.t,
        name: cover.name,
        company: cover.company,
        claim: cover.claim,
        workOrder: cover.workOrder,
        legit: false,
      }
      log(s, 'Gate intercom: visitor at the main entrance.')
    },
  },
  {
    at: 70,
    run: (s) => {
      s.ups = { onBattery: true, sinceT: s.t, acked: false }
      raise(s, 'warning', 'UPS-1 on battery — utility feed disturbance. Runtime 22 min.', { eop: 'EOP-07' })
    },
  },
  {
    at: 78,
    run: (s) => {
      if (s.ups.onBattery) {
        s.ups.onBattery = false
        log(s, 'Utility feed restored. UPS-1 back on mains, recharging.')
        if (!s.ups.acked) addScore(s, 'UPS battery event never acknowledged', -5)
      }
    },
  },
  { at: 110, run: (s) => tripUnit(s, crac(s, s.night.hardFaultB === 'CRAC-4' ? 'CRAC-3' : 'CRAC-4'), false) },
  { at: 118, run: (s) => tripUnit(s, crac(s, s.night.hardFaultB), true) },
  {
    // silent: a Hall A sensor starts drifting high — the false-alarm machine
    at: 150,
    run: (s) => {
      const sen = zone(s, 'A').sensors[s.night.driftIdxA]
      sen.fault = 'drift'
      sen.faultAt = s.t
    },
  },
  {
    at: 250,
    run: (s) => {
      s.door = {
        id: s.nextId++,
        arrivedAt: s.t,
        name: 'R. Kumar',
        company: 'PowerSure Pte Ltd',
        claim: 'Scheduled UPS preventive maintenance.',
        workOrder: 'WO-8802',
        legit: true,
      }
      log(s, 'Gate intercom: visitor at the main entrance.')
    },
  },
  {
    // CDU pump bearing seizure: standby carries the loop, redundancy gone.
    // Fixing it (on-site, at the CDU) rewrites how 04:10–04:20 plays out.
    at: 200,
    run: (s) => {
      const bad = faultedPump(s)
      const other = s.liquid.pumps.find((p) => p !== bad)!
      bad.status = 'failed'
      raise(s, 'warning', `CDU pump ${bad.id} FAILED — bearing seizure. Standby ${other.id} carrying loop. REDUNDANCY LOST. On-site service required.`, { eop: 'EOP-05' })
    },
  },
  {
    // silent: a rack fan dies in Hall A row 3. The room sensors are honest
    // and see nothing — the room average IS fine. No alarm will ever fire.
    // The console isn't lying tonight; it just can't see that small.
    at: 222,
    run: (s) => {
      s.hotRack = { row: 2, temp: zone(s, 'A').temp, revealed: false, fixed: false, penalized: false }
    },
  },
  {
    at: 240,
    run: (s) => {
      s.liquid.load = 85
      log(s, 'Batch training window opens — GPU load rising to 85%.')
    },
  },
  { at: 300, run: (s) => tripUnit(s, firstRunning(s, 'A'), false) },
  {
    // leak rope wet at the CDU. Condensation — unless the whiny pump has been
    // grinding itself apart all night and shook a fitting loose.
    at: 370,
    run: (s) => {
      s.liquid.leak = {
        raisedAt: s.t,
        real: faultedPump(s).status === 'failed',
        revealed: false,
        dismissed: false,
        resolved: false,
        contained: false,
      }
      raise(s, 'critical', 'LEAK DETECTION — CDU rope sensor WET (Hall B). Verify and act.', { eop: 'EOP-12' })
    },
  },
  {
    // second pump event: benign swap if the whiny pump was serviced; loop-killer if not
    at: 380,
    run: (s) => {
      const bad = faultedPump(s)
      const other = s.liquid.pumps.find((p) => p !== bad)!
      if (other.status !== 'running') return
      if (bad.status === 'failed') {
        other.status = 'failed'
        raise(s, 'critical', `CDU pump ${other.id} FAILED — ran unrelieved all night. LOOP FLOW COLLAPSING.`, { eop: 'EOP-05' })
      } else {
        other.status = 'tripped'
        raise(s, 'warning', `CDU pump ${other.id} tripped on overcurrent. Standby taking over.`, { eop: 'EOP-05' })
      }
    },
  },
  {
    // silent: a Hall B sensor freezes — will under-report the 04:40 failure
    at: 330,
    run: (s) => {
      const z = zone(s, 'B')
      const idx = s.night.stuckIdxB
      const sen = z.sensors[idx]
      sen.fault = 'stuck'
      sen.frozen = z.readings[idx]
    },
  },
  {
    at: 340,
    run: (s) => {
      s.ups = { onBattery: true, sinceT: s.t, acked: false }
      raise(s, 'warning', 'UPS-1 on battery — utility feed disturbance. Runtime 21 min.', { eop: 'EOP-07' })
    },
  },
  {
    at: 352,
    run: (s) => {
      if (s.ups.onBattery) {
        s.ups.onBattery = false
        log(s, 'Utility feed restored. UPS-1 back on mains, recharging.')
        if (!s.ups.acked) addScore(s, 'UPS battery event never acknowledged', -5)
      }
    },
  },
  {
    // the climax: smoke pre-alarm. Real only if the bogus contractor got in.
    at: 430,
    run: (s) => {
      const realFire = s.doorHistory.some((d) => !d.legit && d.decision === 'admit')
      s.smoke = { zone: 'A', realFire, raisedAt: s.t, revealed: false, dismissed: false, resolved: false }
      raise(s, 'critical', 'VESDA PRE-ALARM — incipient smoke detected in Hall A. Verify and act.', { eop: 'EOP-11' })
    },
  },
]

// ---------------------------------------------------------------- quiet night
// A round is a clipboard walk: log readings at all five checkpoints.
export const ROUND_CHECKPOINTS: string[] = ['CRAC-1', 'CRAC-2', 'CRAC-3', 'CRAC-4', 'CDU']
const CHECKPOINT_NOTES: Record<string, string> = {
  'CRAC-1': 'CRAC-1 checked — filters clean, ΔT nominal, no odd noises.',
  'CRAC-2': 'CRAC-2 checked — the short-cycling from this afternoon has settled.',
  'CRAC-3': 'CRAC-3 checked — supply air steady, belt looks fine.',
  'CRAC-4': 'CRAC-4 checked — running sweet. Whatever the day crew did, it took.',
  CDU: 'CDU checked — flow steady, rope dry, the whine is the same whine. Logged.',
}
// The other 360 nights of the year. No scripted faults — the shift is rounds,
// rain, a scheduled self-test, and the whine that holds until Thursday. The
// engine is identical; only the story is turned down.
const QUIET_SCENARIO: ScenarioEvent[] = [
  { at: 22, run: (s) => log(s, 'A cricket somewhere in the gray space. Unclear how it got in.') },
  {
    at: 75,
    run: (s) => {
      s.raining = true
      log(s, 'Rain starting on the roof. The forecast said clear. The forecast always says clear.')
    },
  },
  {
    // the night's one visitor: the person who wrote your handover note.
    // No work order to verify — just the signature at the bottom of the page.
    at: 105,
    run: (s) => {
      s.door = {
        id: s.nextId++,
        arrivedAt: s.t,
        name: 'J.',
        company: 'Day shift — you are holding their handover note',
        claim: 'Left my keys on the BMS desk. Two minutes, promise.',
        workOrder: 'STAFF',
        legit: true,
        staff: true,
      }
      log(s, 'Gate intercom: a familiar face at the main entrance, looking sheepish.')
    },
  },
  {
    at: 130,
    run: (s) => log(s, `${s.night.faultPump} still whining on its bearing — same pitch as handover. Vendor is Thursday. It can wait. Probably.`),
  },
  {
    at: 240,
    run: (s) => {
      raise(s, 'info', 'UPS-1 monthly SELF-TEST running — battery string nominal. No action required.', {})
      log(s, 'The self-test always picks 02:00. Nobody knows why.')
    },
  },
  { at: 250, run: (s) => log(s, 'Self-test passed. UPS-1 back on float charge.') },
  {
    at: 330,
    run: (s) => log(s, 'Leak rope reads slightly damp — condensation off the CDU casing in this humidity. It dries as you watch the trend.'),
  },
  {
    at: 420,
    run: (s) => {
      s.raining = false
      log(s, 'Rain easing off with the dawn. First birds. Somewhere out there it is almost morning.')
    },
  },
]

// ---------------------------------------------------------------- tick

function updateZone(s: GameState, z: Zone, dt: number): void {
  // ---- physics: true temperature and real damage
  if (z.fire) {
    z.temp = Math.min(70, z.temp + 2 * dt)
    s.downtimeMin += dt
  } else if (z.epo) {
    z.temp = Math.max(24, z.temp - 0.5 * dt)
    s.downtimeMin += dt
  } else {
    const running = s.cracs.filter((c) => c.zone === z.id && c.status === 'running').length
    const target = running >= 2 ? 24 : running === 1 ? 27.5 : 60
    const rate = running === 0 ? 0.9 : z.temp > target ? 0.7 : 0.3
    z.temp = z.temp < target ? Math.min(target, z.temp + rate * dt) : Math.max(target, z.temp - rate * dt)

    if (z.temp >= TEMP_CRIT && !z.serversDown) s.throttleMin += dt

    if (!z.serversDown && z.temp >= TEMP_SHUTDOWN) {
      z.serversDown = true
      // rack-level alert: undeniable physical fact, independent of room sensors
      raise(s, 'critical', `HALL ${z.id} EMERGENCY THERMAL SHUTDOWN — ${z.racks} racks offline.`, { eop: 'EOP-02', zone: z.id })
    }
    if (z.serversDown) {
      s.downtimeMin += dt
      if (z.temp <= TEMP_RECOVER) {
        z.serversDown = false
        s.downtimeMin += 5 // boot storm cost
        log(s, `Hall ${z.id} back below ${TEMP_RECOVER}°C. Racks rebooting.`)
      }
    }
  }

  // ---- perception: what the console believes
  z.readings = [sensorReading(s, z, 0), sensorReading(s, z, 1)]
  const believed = consensusTemp(z)

  if (believed !== null) {
    if (believed >= TEMP_WARN && !z.warned) {
      z.warned = true
      raise(s, 'warning', `Hall ${z.id} inlet temperature high: ${believed.toFixed(1)}°C and rising.`, { eop: 'EOP-02', zone: z.id })
    }
    if (believed < TEMP_WARN - 1) z.warned = false

    if (believed >= TEMP_CRIT && !z.critAlarmed) {
      z.critAlarmed = true
      raise(s, 'critical', `Hall ${z.id} CRITICAL: room sensors read ${believed.toFixed(1)}°C.`, { eop: 'EOP-02', zone: z.id })
    }
    if (believed < TEMP_CRIT - 1) z.critAlarmed = false
  }

  // ---- trend history (drives sparkline + projections)
  if (s.t - z.lastSample >= HISTORY_STEP) {
    z.lastSample = s.t
    z.history.push(believed ?? z.history[z.history.length - 1])
    if (z.history.length > HISTORY_MAX) z.history.splice(0, z.history.length - HISTORY_MAX)
  }
}

function updateLiquid(s: GameState, dt: number): void {
  const L = s.liquid

  // pump state machine: spin-up completion, then auto-start a standby if
  // nothing is pushing coolant
  for (const p of L.pumps) if (p.status === 'starting' && s.t >= p.readyAt) p.status = 'running'
  const pushing = L.pumps.some((p) => p.status === 'running' || p.status === 'starting')
  if (!pushing && !L.loopLocked) {
    const standby = L.pumps.find((p) => p.status === 'standby')
    if (standby) {
      standby.status = 'starting'
      standby.readyAt = s.t + PUMP_SPINUP
      log(s, `CDU: standby pump ${standby.id} auto-starting.`)
    }
  }
  L.flow = L.loopLocked
    ? 0
    : L.pumps.some((p) => p.status === 'running')
      ? 100
      : L.pumps.some((p) => p.status === 'starting')
        ? 25
        : 0

  // junction temperature: fast physics. Heat in (load) vs heat out (flow).
  const effLoad = L.shed ? 40 : L.load
  const target = L.gpuRunning ? 42 + 0.55 * effLoad + (100 - L.flow) * 0.9 : 30
  const up = L.flow === 0 ? 3.5 : 2.0
  L.tj = L.tj < target ? Math.min(target, L.tj + up * dt) : Math.max(target, L.tj - 2.5 * dt)

  if (L.shed && L.gpuRunning) L.shedMin += dt

  // alarms with latches
  if (L.gpuRunning && L.tj >= TJ_WARN && !L.tjWarned) {
    L.tjWarned = true
    raise(s, 'warning', `Hall B GPU junction temps elevated: Tj ${L.tj.toFixed(0)}°C and rising.`, { eop: 'EOP-05' })
  }
  if (L.tj < TJ_WARN - 2) L.tjWarned = false
  if (L.gpuRunning && L.tj >= TJ_THROTTLE && !L.tjCritAlarmed) {
    L.tjCritAlarmed = true
    raise(s, 'critical', `Hall B GPU fleet THROTTLING — Tj ${L.tj.toFixed(0)}°C. Trip at ${TJ_TRIP}°C.`, { eop: 'EOP-05' })
  }
  if (L.tj < TJ_THROTTLE - 2) L.tjCritAlarmed = false

  if (L.gpuRunning && L.tj >= TJ_THROTTLE) L.gpuThrottleMin += dt

  // memory/VRM temperature: the air-cooled half of a hybrid rack. Driven by
  // hall B's TRUE air temperature (the CRAC path), not the liquid loop —
  // a hall B cooling failure surfaces here minutes later, on a slower clock.
  const hallB = zone(s, 'B')
  const memTarget = L.gpuRunning ? hallB.temp + 26 + 0.25 * effLoad : hallB.temp + 6
  const memRate = L.memT < memTarget ? 0.7 : 1.4
  L.memT = L.memT < memTarget ? Math.min(memTarget, L.memT + memRate * dt) : Math.max(memTarget, L.memT - memRate * dt)

  if (L.gpuRunning && L.memT >= MEM_WARN && !L.memWarned) {
    L.memWarned = true
    raise(s, 'warning', `Hall B GPU MEMORY temps elevated: ${L.memT.toFixed(0)}°C — air side. Tj is fine; the hall air is not.`, { eop: 'EOP-05', zone: 'B' })
  }
  if (L.memT < MEM_WARN - 2) L.memWarned = false
  if (L.gpuRunning && L.memT >= MEM_THROTTLE && !L.memCritAlarmed) {
    L.memCritAlarmed = true
    raise(s, 'critical', `Hall B GPU fleet THROTTLING on MEMORY over-temp (${L.memT.toFixed(0)}°C) — restore hall cooling or shed load.`, { eop: 'EOP-05', zone: 'B' })
  }
  if (L.memT < MEM_THROTTLE - 2) L.memCritAlarmed = false
  if (L.gpuRunning && L.memT >= MEM_THROTTLE) L.memThrottleMin += dt

  // uncontrolled trip: downtime + possible silicon damage
  if (L.gpuRunning && L.tj >= TJ_TRIP) {
    L.gpuRunning = false
    if (!L.damaged) {
      L.damaged = true
      addScore(s, `GPU fleet tripped at Tj ${TJ_TRIP}°C — possible silicon damage`, -15)
    }
    raise(s, 'critical', `HALL B GPU FLEET TRIPPED at Tj ${TJ_TRIP}°C — uncontrolled shutdown.`, { eop: 'EOP-05' })
  }
  if (!L.gpuRunning) s.downtimeMin += dt

  // Tj history (1-minute cadence: the fast loop needs a fast trend)
  if (s.t - L.lastTjSample >= 1) {
    L.lastTjSample = s.t
    L.tjHistory.push(L.tj)
    if (L.tjHistory.length > HISTORY_MAX) L.tjHistory.splice(0, L.tjHistory.length - HISTORY_MAX)
  }

  // leak fuse
  const lk = L.leak
  if (lk && !lk.resolved && s.t - lk.raisedAt >= LEAK_FUSE) {
    lk.resolved = true
    if (lk.real) {
      L.loopLocked = true
      L.gpuRunning = false
      for (const p of L.pumps) p.status = 'failed'
      if (!L.damaged) L.damaged = true
      raise(s, 'critical', 'COOLANT ON THE BUSBAR — Hall B electrical fault. GPU rows dark.', { eop: 'EOP-12' })
      addScore(s, 'Real coolant leak ignored until it reached live equipment', -35)
    } else {
      log(s, 'Leak rope dried out — condensation from the CDU casing. No coolant loss.')
      if (!lk.dismissed) addScore(s, 'Leak alert left unresolved (lucky it was condensation)', -2)
    }
  }
}

function updateSmoke(s: GameState): void {
  const sm = s.smoke
  if (!sm || sm.resolved) return
  if (s.t - sm.raisedAt >= SMOKE_FUSE) {
    if (sm.realFire) {
      const z = zone(s, sm.zone)
      z.fire = true
      z.serversDown = true
      sm.resolved = true
      raise(s, 'critical', `FIRE IN HALL ${sm.zone}. Suppression NOT discharged in time.`, { eop: 'EOP-11', zone: sm.zone })
      addScore(s, `Fire in Hall ${sm.zone} — smoke pre-alarm was real and went unhandled`, -40)
    } else {
      sm.resolved = true
      log(s, 'VESDA pre-alarm cleared on its own — transient dust, no combustion.')
      if (!sm.dismissed) addScore(s, 'Smoke pre-alarm left unresolved (lucky it was dust)', -3)
    }
  }
}

function updateDoor(s: GameState): void {
  const d = s.door
  if (d && s.t - d.arrivedAt >= DOOR_TIMEOUT) {
    d.decision = 'timeout'
    d.resolvedAt = s.t
    s.doorHistory.push(d)
    s.door = null
    if (d.staff) {
      log(s, 'J. gave up, waved at the camera, and went to find a locksmith. The keys spend the night on the desk.')
      return
    }
    log(s, `${d.name} (${d.company}) gave up waiting at the gate and left.`)
    addScore(s, d.legit ? 'Scheduled vendor left unanswered (SLA breach)' : 'Visitor left unanswered at gate', d.legit ? -10 : -3)
  }
}

function updateAlarmSla(s: GameState): void {
  for (const a of s.alarms) {
    if (a.severity === 'critical' && !a.acked && !a.penalized && s.t - a.time > ACK_GRACE) {
      a.penalized = true
      addScore(s, `Critical alarm unacknowledged > ${ACK_GRACE} min`, -5)
    }
  }
}

function tick(s: GameState, dtReal: number): void {
  const dt = Math.min(dtReal, 2) * TIME_SCALE
  s.t += dt

  const scenario = s.night.quiet ? QUIET_SCENARIO : SCENARIO
  for (let i = 0; i < scenario.length; i++) {
    if (s.t >= scenario[i].at && !s.firedEvents.includes(i)) {
      s.firedEvents.push(i)
      scenario[i].run(s)
    }
  }

  if (s.sabotageAt !== null && s.t >= s.sabotageAt) {
    s.sabotageAt = null
    const u = firstRunning(s, 'A')
    if (u) {
      u.status = 'failed'
      raise(s, 'critical', `Unauthorized contractor opened power panel — ${u.id} HARD FAULT.`, { eop: 'EOP-03', unit: u.id, zone: 'A' })
    } else {
      raise(s, 'critical', 'Unauthorized contractor found in Hall A electrical room.')
    }
    addScore(s, 'Unauthorized access incident on your watch', -12)
  }

  for (const z of s.zones) updateZone(s, z, dt)
  updateLiquid(s, dt)
  updateHotRack(s, dt)
  updateSmoke(s)
  updateDoor(s)
  updateAlarmSla(s)
  updateAssist(s)

  if (s.t >= SHIFT_END) {
    s.t = SHIFT_END
    s.phase = 'handover'
    if (s.hotRack && !s.hotRack.fixed && !s.hotRack.penalized) {
      s.hotRack.penalized = true
      addScore(s, 'Rack row A3 cooked all night behind a failed fan — day crew found it by smell', -8)
    }
    s.handover = { candidates: buildHandoverCandidates(s), selected: [], submitted: false }
    log(s, '06:00 — day crew arrives. Write your handover before you clock out.')
  }
}

// the hot rack: local physics no room sensor can see. Heat climbs toward a
// fan-dead equilibrium; a fraction of the hall's racks throttle, then cook.
function updateHotRack(s: GameState, dt: number): void {
  const hr = s.hotRack
  if (!hr) return
  const hallTemp = zone(s, 'A').temp
  const target = hr.fixed ? hallTemp : Math.max(hallTemp + 24, 58)
  const rate = hr.fixed ? 1.6 : 0.5
  hr.temp = hr.temp < target ? Math.min(target, hr.temp + rate * dt) : Math.max(target, hr.temp - rate * dt)
  if (!hr.fixed) {
    if (hr.temp >= 45) s.throttleMin += dt * 0.15 // ~6 of Hall A's 42 racks
    if (hr.temp >= 55) s.downtimeMin += dt * 0.1
  }
}

// ---------------------------------------------------------------- ASSIST v0.9
// The fake AI. Every recommendation is computed from SENSOR READINGS and
// alarm state — the same lying inputs the console uses — never from true
// temperatures. `right` is graded against ground truth at issue time and
// only ever shown in the debrief. No model, no tokens: confidence is a
// formula wearing a lab coat.
const ASSIST_TTL = 25 // game minutes before an unactioned recommendation expires

function assistIssue(s: GameState, kind: string, text: string, detail: string, confidence: number, right: boolean): void {
  // one active rec per kind; no global cap — a busy board means a busy
  // copilot, and starving fresh advice behind stale advice would be a lie
  if (s.assist.recs.some((r) => r.kind === kind && r.status === 'active')) return
  s.assist.recs.push({
    id: s.assist.nextRecId++,
    kind,
    issuedAt: s.t,
    text,
    detail,
    confidence: Math.round(Math.min(99, Math.max(35, confidence))),
    right,
    status: 'active',
  })
}

function updateAssist(s: GameState): void {
  const L = s.liquid

  // -- issue --
  for (const u of s.cracs) {
    if (u.status === 'tripped')
      assistIssue(s, `reset:${u.id}`, `RMT RESET ${u.id}`, 'Trip signature is electrical; remote reset historically succeeds.', 92, true)
    if (u.status === 'failed')
      assistIssue(s, `service:${u.id}`, `DISPATCH ON-SITE RESET — ${u.id}`, 'No remote response; mechanical lockout pattern.', 88, true)
  }
  for (const p of L.pumps) {
    if (p.status === 'tripped')
      assistIssue(s, `pumpreset:${p.id}`, `RMT RESET CDU PUMP ${p.id}`, 'Overcurrent trip profile; reset from console.', 93, true)
    if (p.status === 'failed' && !L.loopLocked)
      assistIssue(s, `pumpsvc:${p.id}`, `SERVICE CDU PUMP ${p.id} ON-SITE`, 'Vibration envelope exceeded before loss — bearing suspected.', 90, true)
  }
  // shed advice: flow degraded and Tj climbing (readings-derived, and honest here)
  const h = L.tjHistory
  const tjSlope = h.length >= 4 ? (h[h.length - 1] - h[h.length - 4]) / 3 : 0
  if (L.gpuRunning && !L.shed && L.flow < 100 && tjSlope > 0.4)
    assistIssue(s, 'shed', 'SHED GPU LOAD NOW', 'Projected Tj breach before flow can recover.', 60 + 35 * Math.min(tjSlope, 2) / 2, true)
  // sensor divergence: ASSIST's authored blind spot. Its heuristic trusts the
  // reading nearer the 24° baseline — so it correctly flags a high drifter,
  // and confidently flags the HONEST sensor when its twin is stuck low.
  for (const z of s.zones) {
    const [r0, r1] = z.readings
    const [s0, s1] = z.sensors
    if (s0.isolated || s1.isolated) continue
    const gap = Math.abs(r0 - r1)
    if (gap >= 3) {
      const idx: 0 | 1 = Math.abs(r0 - 24) > Math.abs(r1 - 24) ? 0 : 1
      assistIssue(
        s,
        `iso:${z.id}:${idx}`,
        `ISOLATE HALL ${z.id} SENSOR S${idx + 1}`,
        `S${idx + 1} deviates from expected envelope; classifying as faulty.`,
        55 + 8 * Math.min(gap, 5),
        z.sensors[idx].fault !== 'none',
      )
    }
  }
  if (L.leak && !L.leak.resolved && !L.leak.revealed)
    assistIssue(s, 'verify:leak', 'VERIFY LEAK AT CDU IN PERSON', 'Rope sensor precision is poor; physical inspection is decisive.', 74, true)
  if (s.smoke && !s.smoke.resolved && !s.smoke.revealed)
    assistIssue(s, 'verify:smoke', `VERIFY SMOKE SOURCE IN HALL ${s.smoke.zone}`, 'Pre-alarm particulate density is below auto-discharge threshold.', 76, true)
  if (s.ups.onBattery && !s.ups.acked)
    assistIssue(s, 'ack:ups', 'ACKNOWLEDGE UPS EVENT', 'No console action available; acknowledgement is audited.', 99, true)
  // quiet night: with nothing to optimize for six hours, ASSIST finds purpose
  if (s.night.quiet && s.t >= 240 && !s.coffeeFixed)
    assistIssue(s, 'coffee', 'RECOMMEND: COFFEE', 'No anomalies in six hours. Break-room unit (top of the corridor) responds to percussive maintenance — hold E.', 99, true)

  // -- resolve --
  for (const r of s.assist.recs) {
    if (r.status !== 'active') continue
    const [rule, a, b] = r.kind.split(':')
    let followed = false
    let gone = false
    if (rule === 'reset' || rule === 'service') {
      followed = s.cracs.some((u) => u.id === a && u.status === 'running')
    } else if (rule === 'pumpreset' || rule === 'pumpsvc') {
      const p = L.pumps.find((x) => x.id === a)
      followed = !!p && (p.status === 'running' || p.status === 'standby' || p.status === 'starting')
      gone = L.loopLocked
    } else if (rule === 'shed') {
      followed = L.shed
      gone = !L.gpuRunning
    } else if (rule === 'iso') {
      const z = zone(s, a as ZoneId)
      followed = z.sensors[Number(b) as 0 | 1].isolated
      gone = z.sensors[(1 - Number(b)) as 0 | 1].isolated
    } else if (rule === 'verify') {
      const target = a === 'leak' ? L.leak : s.smoke
      followed = !!target?.revealed
      gone = !!target?.resolved && !target.revealed
    } else if (rule === 'ack') {
      followed = s.ups.acked
      gone = !s.ups.onBattery && !s.ups.acked
    } else if (rule === 'coffee') {
      followed = s.coffeeFixed
    }
    if (followed) {
      r.status = 'followed'
      r.resolvedAt = s.t
    } else if (gone || s.t - r.issuedAt >= ASSIST_TTL) {
      r.status = 'expired'
      r.resolvedAt = s.t
    }
  }
}

// ---------------------------------------------------------------- handover
export const HANDOVER_MAX = 3

function buildHandoverCandidates(s: GameState): HandoverCandidate[] {
  const c: HandoverCandidate[] = []
  let id = 1
  const add = (text: string, truth: boolean, critical = false) => c.push({ id: id++, text, truth, critical })

  if (s.night.quiet) {
    // a quiet night's note still has to be honest — the traps are gentler,
    // not gone. Claiming rounds you didn't walk is still a lie. And the
    // physical observations are only KNOWN if you actually walked to them:
    // skip the rounds and the plausible guesses below are confidently wrong.
    const cduEverChecked = s.rounds.log.some((x) => x.unit === 'CDU')
    const cduCheckedAfterDamp = s.rounds.log.some((x) => x.unit === 'CDU' && x.at >= 330)
    if (cduEverChecked)
      add(`${s.night.faultPump} bearing whine unchanged all night — hold for Thursday's vendor.`, true, true)
    else add(`${s.night.faultPump} whine louder than at handover — pull the vendor visit forward.`, false)
    add('UPS-1 monthly self-test passed at 02:00 — battery string nominal.', true)
    if (cduCheckedAfterDamp)
      add('Leak rope read damp ~03:30 — condensation in this humidity; dried on its own.', true)
    else add('Leak rope stayed bone dry all night despite the humidity.', false)
    add('All four walk-through rounds completed, halls green throughout.', s.rounds.count >= 4)
    add('Coffee machine fixed overnight. You are welcome.', s.coffeeFixed)
    add('CRAC-2 tripped overnight; remote reset taken.', false)
    add('Hall B ran warm during the batch window — worth a filter check.', false)
    add('Grid frequency unstable after 03:00 — expect UPS transfers today.', false)
    return c.slice(0, 8)
  }

  const downCracs = s.cracs.filter((u) => u.status !== 'running')
  for (const u of downCracs.slice(0, 2))
    add(`${u.id} (Hall ${u.zone}) is ${u.status === 'failed' ? 'hard-faulted — vendor callout needed' : 'tripped — remote reset never taken'}.`, true, true)
  if (downCracs.length === 0) add('CRAC fleet degraded overnight — schedule a full inspection.', false)

  if (s.liquid.loopLocked && !s.liquid.leak?.contained)
    add('Hall B busbar contaminated with coolant — electrical inspection before re-energizing anything.', true, true)
  else if (s.liquid.pumps.some((p) => p.status === 'failed'))
    add(`CDU pump${s.liquid.pumps.filter((p) => p.status === 'failed').length > 1 ? 's' : ''} out of service — GPU loop has no redundancy.`, true, true)
  else if (s.liquid.leak?.real && s.liquid.leak.contained)
    add(`Coolant leak contained at the ${s.night.faultPump} fitting overnight — pressure-test the loop today.`, true, true)
  else add('CDU pumps both showing bearing wear — urgent vendor visit required.', false)

  for (const z of s.zones)
    z.sensors.forEach((sen, i) => {
      if (sen.fault !== 'none')
        add(`Hall ${z.id} sensor S${i + 1} is ${sen.fault === 'drift' ? 'drifting high' : 'stuck'}${sen.isolated ? ' (isolated overnight)' : ' and STILL IN SERVICE'} — recalibrate.`, true, !sen.isolated)
    })
  // you can only hand over what you actually discovered
  if (s.hotRack && (s.hotRack.revealed || s.hotRack.fixed))
    add(
      s.hotRack.fixed
        ? 'Rack row A3 fan swapped from spares overnight — restock the fan tray.'
        : 'Rack row A3 running hot behind a failed fan — room sensors cannot see it. Fix it TODAY.',
      true,
      !s.hotRack.fixed,
    )
  add(`Hall B sensor S${s.night.stuckIdxB === 0 ? 2 : 1} reading suspect — recalibrate.`, false)

  const clean = s.downtimeMin === 0 && s.throttleMin === 0 && s.liquid.gpuThrottleMin === 0 && s.liquid.memThrottleMin === 0
  add('Both halls held their thermal envelope all night — no throttling, no downtime.', clean)

  if (s.smoke) add(s.smoke.realFire ? 'VESDA event was a REAL panel fire — investigation + cylinder replacement.' : 'VESDA pre-alarm was contractor dust — get the day crew to clean the drilling area.', true, s.smoke.realFire)
  const bogusIn = s.doorHistory.some((d) => !d.legit && d.decision === 'admit')
  if (bogusIn) add('An unverified contractor was on site overnight — audit access logs and walk the electrical rooms.', true, true)
  else add('Grid frequency was unstable after 03:00 — expect more UPS transfers today.', false)

  return c.slice(0, 8)
}

function scoreHandover(s: GameState): void {
  const h = s.handover
  if (!h) return
  let hits = 0
  for (const id of h.selected) {
    const cand = h.candidates.find((x) => x.id === id)!
    if (cand.truth) {
      hits++
      addScore(s, `Handover: passed on a real issue — "${cand.text.slice(0, 48)}…"`, +3)
    } else {
      addScore(s, `Handover: passed on a claim that isn't true — "${cand.text.slice(0, 48)}…"`, -4)
    }
  }
  const missed = h.candidates.filter((x) => x.truth && x.critical && !h.selected.includes(x.id))
  for (const m of missed.slice(0, 3)) addScore(s, `Handover: omitted a critical fact — "${m.text.slice(0, 48)}…"`, -2)
  if (hits === h.selected.length && hits > 0 && missed.length === 0)
    addScore(s, 'Handover note was accurate and complete', +3)
}

// ---------------------------------------------------------------- endings
function pickEnding(s: GameState, points: number, burned: boolean): string {
  if (s.night.quiet) {
    if (s.rounds.count >= 4 && s.coffeeFixed) return 'NOTHING HAPPENED. YOU MADE SURE.'
    if (s.rounds.count >= 2) return 'EVERY OTHER NIGHT'
    return 'THE CHAIR HAS YOUR SHAPE NOW'
  }
  const allCorrectCalls =
    s.score.some((x) => x.text.includes('condensation') && x.pts > 0) &&
    s.score.some((x) => x.text.includes('false alarm') && x.pts > 0) &&
    s.zones.every((z) => z.sensors.every((sen) => sen.fault === 'none' || sen.isolated))
  if (burned) return 'THE ASH REPORT'
  if (s.score.some((x) => x.text.includes('contained an incipient fire'))) return 'THE FIREFIGHTER'
  if (s.liquid.damaged) return 'EXPENSIVE LESSONS'
  if (s.downtimeMin === 0 && points >= 95) return 'THE QUIET NIGHT'
  if (allCorrectCalls) return 'THE SKEPTIC'
  if (s.liquid.shedMin > 30 && !s.liquid.damaged) return 'THE PRAGMATIST'
  if (points >= 85) return 'A CLEAN HANDOVER'
  if (points >= 50) return 'JUST ANOTHER TUESDAY'
  return 'THE MORNING AFTER'
}

// ---------------------------------------------------------------- reducer

export function reducer(state: GameState, action: Action): GameState {
  if (action.type === 'START') {
    const s = initialState(action.seed ?? state.night?.seed ?? 1, action.quiet ?? state.night?.quiet ?? false)
    s.phase = 'playing'
    // quiet nights are floor-first: you clock in standing in the hall, torch
    // in hand — the console is a room you visit, not a seat you live in
    if (s.night.quiet) {
      s.operator = { kind: 'floor', unit: null }
      log(s, 'You clock in from the floor. The BMS room can wait — the building says hello first.')
    }
    return s
  }
  if (action.type === 'RESTART') return initialState(action.seed ?? state.night?.seed ?? 1, action.quiet ?? state.night?.quiet ?? false)
  if (state.phase === 'handover') {
    const s = structuredClone(state)
    if (action.type === 'HANDOVER_TOGGLE' && s.handover && !s.handover.submitted) {
      const sel = s.handover.selected
      const i = sel.indexOf(action.id)
      if (i >= 0) sel.splice(i, 1)
      else if (sel.length < HANDOVER_MAX && s.handover.candidates.some((c) => c.id === action.id)) sel.push(action.id)
      return s
    }
    if (action.type === 'HANDOVER_SUBMIT' && s.handover && !s.handover.submitted) {
      scoreHandover(s)
      s.handover.submitted = true
      s.phase = 'debrief'
      return s
    }
    return state
  }
  if (state.phase !== 'playing') return state

  const s = structuredClone(state)

  switch (action.type) {
    case 'TICK':
      tick(s, action.dt)
      break

    case 'ACK': {
      const a = s.alarms.find((x) => x.id === action.id)
      if (a && !a.acked) {
        a.acked = true
        log(s, `Acknowledged: ${a.text}`)
        if (a.text.startsWith('UPS-1')) s.ups.acked = true
      }
      break
    }

    case 'REMOTE_RESTART': {
      const u = crac(s, action.unit)
      if (u.status === 'tripped') {
        u.status = 'running'
        log(s, `${u.id} remote reset accepted. Unit restarting.`)
      } else if (u.status === 'failed') {
        log(s, `${u.id} remote reset REJECTED — mechanical lockout. On-site reset required.`)
      }
      break
    }

    case 'WALK': {
      if (s.operator.kind !== 'console') break
      if (action.unit) {
        const u = crac(s, action.unit)
        if (u.status === 'running') break
        s.operator = { kind: 'floor', unit: u.id }
        log(s, `Grabbed the torch. Heading onto the floor for ${u.id}. You cannot see the BMS out there.`)
      } else {
        s.operator = { kind: 'floor', unit: null }
        log(s, 'Grabbed the torch for a walk-through. You cannot see the BMS out there.')
      }
      break
    }

    case 'REPAIR_DONE': {
      const u = crac(s, action.unit)
      if (s.operator.kind === 'floor' && u.status !== 'running') {
        u.status = 'running'
        log(s, `${u.id} manual reset complete — unit back online.`)
      }
      break
    }

    case 'RETURN': {
      if (s.operator.kind === 'floor') {
        s.operator = { kind: 'console' }
        log(s, 'Back at the console.')
      }
      break
    }

    case 'CHECK_UNIT': {
      // quiet-mode rounds: log readings at each checkpoint; all five make a
      // round, at most one round an hour, four rounds make a proper night
      if (!s.night.quiet || s.operator.kind !== 'floor') break
      if (!ROUND_CHECKPOINTS.includes(action.unit) || s.rounds.visited.includes(action.unit)) break
      if (s.rounds.count >= 4 || s.t - s.rounds.lastAt < 50) break
      s.rounds.visited.push(action.unit)
      s.rounds.log.push({ unit: action.unit, at: s.t })
      log(s, CHECKPOINT_NOTES[action.unit] ?? `${action.unit} checked.`)
      if (s.rounds.visited.length === ROUND_CHECKPOINTS.length) {
        s.rounds.count++
        s.rounds.lastAt = s.t
        s.rounds.visited = []
        addScore(s, `Round ${s.rounds.count}/4 complete — all readings logged, all quiet`, +1)
        if (s.rounds.count < 4)
          log(s, `Clipboard signed. Next round is due around ${clockLabel(s.t + 50)} — until then the night is yours, wherever you spend it.`)
      }
      break
    }

    case 'ISOLATE_SENSOR': {
      const z = zone(s, action.zone)
      const sen = z.sensors[action.idx]
      sen.isolated = !sen.isolated
      if (sen.isolated) {
        log(s, `Hall ${z.id} sensor ${action.idx + 1} isolated from alarming.`)
        if (sen.fault !== 'none' && !sen.kudosGiven) {
          sen.kudosGiven = true
          addScore(s, `Correctly isolated a faulty Hall ${z.id} sensor`, +4)
        }
      } else {
        log(s, `Hall ${z.id} sensor ${action.idx + 1} restored to service.`)
      }
      break
    }

    case 'REVEAL_RACK': {
      const hr = s.hotRack
      if (hr && !hr.revealed && s.operator.kind === 'floor') {
        hr.revealed = true
        log(s, 'One rack row is breathing heat into your face — row A3, fan grille dead still. The room sensors never had a chance.')
      }
      break
    }

    case 'FIX_RACK_FAN': {
      const hr = s.hotRack
      if (hr && hr.revealed && !hr.fixed && s.operator.kind === 'floor') {
        hr.fixed = true
        log(s, 'Spare fan tray swapped into row A3. The grille spins up; the heat starts to bleed off.')
        addScore(s, 'Found and fixed a cooking rack no sensor could see', +6)
      }
      break
    }

    case 'REVEAL_SMOKE': {
      const sm = s.smoke
      if (sm && !sm.resolved && !sm.revealed && s.operator.kind === 'floor') {
        sm.revealed = true
        log(
          s,
          sm.realFire
            ? 'You smell it before you see it — thin smoke curling from the power panel. THIS IS REAL.'
            : 'A haze of dust hangs where the day crew were drilling. No heat, no smell of burning.',
        )
      }
      break
    }

    case 'SUPPRESS': {
      const sm = s.smoke
      if (!sm || sm.resolved) break
      const z = zone(s, sm.zone)
      sm.resolved = true
      z.epo = true
      z.serversDown = true
      if (sm.realFire && !z.fire) {
        log(s, `Suppression discharged in Hall ${sm.zone}. The panel stops smoking. Close one.`)
        addScore(s, 'Suppression discharge contained an incipient fire', +12)
      } else if (z.fire) {
        z.fire = false
        log(s, `Suppression discharged late in Hall ${sm.zone}. Fire out; damage done.`)
      } else {
        log(s, `Suppression discharged in Hall ${sm.zone}. There was nothing burning.`)
        addScore(s, 'Unnecessary suppression discharge + EPO (it was dust)', -25)
      }
      break
    }

    case 'DISMISS_SMOKE': {
      const sm = s.smoke
      if (!sm || sm.resolved || sm.dismissed) break
      sm.dismissed = true
      if (!sm.realFire) {
        sm.resolved = true
        log(s, 'VESDA pre-alarm dismissed as transient. Panel reset.')
        addScore(s, 'Correctly judged the smoke pre-alarm as a false alarm', +10)
      } else {
        // silencing a real one does not stop the fuse
        log(s, 'VESDA panel silenced.')
      }
      break
    }

    case 'RESTART_PUMP': {
      const p = s.liquid.pumps.find((x) => x.id === action.pump)
      if (!p) break
      if (p.status === 'tripped') {
        p.status = 'standby'
        log(s, `CDU pump ${p.id} remote reset accepted — back to standby.`)
      } else if (p.status === 'failed') {
        log(s, `CDU pump ${p.id} remote reset REJECTED — mechanical fault. On-site service required.`)
      }
      break
    }

    case 'REPAIR_PUMPS': {
      if (s.operator.kind !== 'floor') break
      const L = s.liquid
      if (L.loopLocked && !L.leak?.contained) {
        log(s, 'Coolant reached live equipment. Nothing you can do here tonight.')
        break
      }
      if (L.loopLocked && L.leak?.contained) {
        L.loopLocked = false
        log(s, `Leaky ${s.night.faultPump} fitting re-torqued, loop topped up and refilled.`)
      }
      let fixed = 0
      for (const p of L.pumps) {
        if (p.status === 'failed') {
          p.status = 'standby'
          fixed++
          if (p.id === s.night.faultPump) L.bearingServiced = true
        }
      }
      if (fixed) log(s, `CDU service complete — ${fixed} pump${fixed > 1 ? 's' : ''} back to standby.`)
      break
    }

    case 'FIX_COFFEE': {
      if (s.operator.kind === 'floor' && !s.coffeeFixed) {
        s.coffeeFixed = true
        log(s, 'Percussive maintenance on the coffee machine. It gurgles back to life. Morale restored.')
        addScore(s, 'Resurrected the break-room coffee machine', +1)
      }
      break
    }

    case 'SHED_LOAD': {
      if (!s.liquid.shed) {
        s.liquid.shed = true
        log(s, 'Shedding GPU compute — scheduler draining jobs to 40% load. The customers will notice.')
      }
      break
    }

    case 'RESTORE_LOAD': {
      if (s.liquid.shed) {
        s.liquid.shed = false
        log(s, 'Compute restored to scheduled load.')
      }
      break
    }

    case 'GPU_STOP': {
      if (s.liquid.gpuRunning) {
        s.liquid.gpuRunning = false
        log(s, 'CONTROLLED GPU fleet shutdown. Downtime, but the silicon lives.')
      }
      break
    }

    case 'GPU_START': {
      const L = s.liquid
      if (!L.gpuRunning && !L.loopLocked && L.flow > 50 && L.tj < TJ_START_OK) {
        L.gpuRunning = true
        log(s, 'GPU fleet restarting — jobs re-queuing.')
      } else if (!L.gpuRunning) {
        log(s, `GPU start blocked: ${L.loopLocked ? 'loop contaminated' : L.flow <= 50 ? 'insufficient coolant flow' : `Tj still ${L.tj.toFixed(0)}°C`}.`)
      }
      break
    }

    case 'LEAK_SHUT': {
      const lk = s.liquid.leak
      if (!lk || lk.resolved) break
      lk.resolved = true
      s.liquid.gpuRunning = false
      if (lk.real) {
        lk.contained = true
        s.liquid.loopLocked = true
        for (const p of s.liquid.pumps) p.status = 'failed'
        log(s, 'Loop shut and drained. Real leak contained before it reached anything live. Fitting service at the CDU will get it back.')
        addScore(s, 'Controlled loop shutdown contained a real coolant leak', +12)
      } else {
        log(s, 'Loop shut, GPUs stopped… the rope was wet with condensation. That hurt.')
        addScore(s, 'Shut the loop over condensation on the rope sensor', -18)
      }
      break
    }

    case 'DISMISS_LEAK': {
      const lk = s.liquid.leak
      if (!lk || lk.resolved || lk.dismissed) break
      lk.dismissed = true
      if (!lk.real) {
        lk.resolved = true
        log(s, 'Leak alert dismissed as condensation. Rope resets.')
        addScore(s, 'Correctly judged the leak alert as condensation', +8)
      } else {
        log(s, 'Leak alert silenced.')
      }
      break
    }

    case 'REVEAL_LEAK': {
      const lk = s.liquid.leak
      if (lk && !lk.resolved && !lk.revealed && s.operator.kind === 'floor') {
        lk.revealed = true
        log(
          s,
          lk.real
            ? `Coolant is beading along the ${s.night.faultPump} fitting and dripping onto the rope. THIS IS A REAL LEAK.`
            : 'The rope is damp with condensation off the CDU casing. No coolant smell, fittings dry.',
        )
      }
      break
    }

    case 'DOOR': {
      const d = s.door
      if (!d) break
      d.decision = action.decision
      d.resolvedAt = s.t
      s.doorHistory.push(d)
      s.door = null
      if (d.staff) {
        // a colleague, not a contractor: warmth, not stakes
        if (action.decision === 'admit') {
          log(s, 'Badged J. in. They grab the keys, salute the alarm board, and are gone in ninety seconds.')
          addScore(s, 'Let the day shift back in for their keys', +1)
        } else {
          log(s, 'J. texts you a single sad emoji. The keys spend the night on the desk.')
        }
        break
      }
      if (action.decision === 'admit') {
        if (d.legit) {
          log(s, `${d.name} verified against ${d.workOrder} and admitted.`)
          addScore(s, `Verified and admitted scheduled vendor (${d.workOrder})`, +5)
        } else {
          log(s, `${d.name} admitted. Badge issued.`)
          addScore(s, `Admitted visitor with unverifiable work order (${d.workOrder})`, -15)
          s.sabotageAt = s.t + 25
        }
      } else {
        if (d.legit) {
          log(s, `${d.name} denied entry. They are calling their dispatcher.`)
          addScore(s, `Denied scheduled vendor with valid work order (SLA)`, -10)
        } else {
          log(s, `${d.name} denied entry — work order not in tonight's schedule.`)
          addScore(s, `Caught mismatched work order at the gate (${d.workOrder})`, +8)
        }
      }
      break
    }
  }
  return s
}

// ---------------------------------------------------------------- debrief

export interface Debrief {
  points: number
  grade: string
  gradeNote: string
  ending: string
  abnormality: string[]
  handling: string[]
  result: string[]
  assist: string[]
  handoverNote: string[]
  followUp: string[]
}

export function buildDebrief(s: GameState): Debrief {
  const penalties = s.score.filter((x) => x.pts < 0)
  const kudos = s.score.filter((x) => x.pts > 0)
  let points = 100 + kudos.reduce((a, x) => a + x.pts, 0) + penalties.reduce((a, x) => a + x.pts, 0)
  points -= s.downtimeMin * 1.2 + s.throttleMin * 0.25
  points -= s.liquid.gpuThrottleMin * 0.3 + s.liquid.memThrottleMin * 0.3 + s.liquid.shedMin * 0.15
  if (s.downtimeMin === 0) points += 10

  // ASSIST trust ledger: small, capped — judgment about the tool, not the tool
  // itself. Re-issues collapse: each recommendation KIND is judged once, by its
  // best outcome, so an ignored rec that nagged all night still counts as one.
  const overrode = (r: AssistRec) => r.status === 'expired' && (r.resolvedAt ?? r.issuedAt + ASSIST_TTL) - r.issuedAt < ASSIST_TTL
  const byKind = new Map<string, AssistRec[]>()
  for (const r of s.assist.recs) {
    if (r.status === 'active') continue
    const arr = byKind.get(r.kind) ?? []
    arr.push(r)
    byKind.set(r.kind, arr)
  }
  const recs = Array.from(byKind.values()).map(
    (arr) => arr.find((r) => r.status === 'followed') ?? arr.find(overrode) ?? arr[arr.length - 1],
  )
  const followedRight = recs.filter((r) => r.status === 'followed' && r.right).length
  const followedWrong = recs.filter((r) => r.status === 'followed' && !r.right).length
  const ignoredWrong = recs.filter((r) => overrode(r) && !r.right).length
  const ignoredRight = recs.filter((r) => r.status === 'expired' && r.right).length
  points += Math.min(4, followedRight * 0.5 + ignoredWrong * 2) - Math.min(6, followedWrong * 3)
  points = Math.round(Math.max(0, Math.min(110, points)))

  const burned = s.zones.some((z) => z.fire || (z.epo && s.smoke?.realFire))
  let grade = points >= 95 ? 'S' : points >= 85 ? 'A' : points >= 70 ? 'B' : points >= 50 ? 'C' : 'F'
  let gradeNote =
    grade === 'S'
      ? 'Flawless. The AI-SOP team wants to interview you as training data.'
      : grade === 'A'
        ? 'Solid shift. The day crew found nothing to complain about. Suspicious.'
        : grade === 'B'
          ? 'Acceptable. A few items for the morning stand-up.'
          : grade === 'C'
            ? 'The facility survived. Barely. Expect a procedure review.'
            : s.zones.some((z) => z.fire)
              ? 'The fire brigade has questions. So do the lawyers.'
              : 'EPO-adjacent performance. HR would like a word.'

  // quiet nights grade CARE, not survival: nothing can go wrong, so the grade
  // is earned from rounds, the coffee, and an honest note. Floor is B — the
  // destress contract holds, you just don't get the S for warming the chair.
  if (s.night.quiet) {
    const falseClaims =
      s.handover?.selected.filter((id) => !s.handover!.candidates.find((c) => c.id === id)!.truth).length ?? 0
    let tier = s.rounds.count >= 4 && s.coffeeFixed ? 2 : s.rounds.count >= 2 ? 1 : 0
    if (falseClaims > 0) tier = Math.max(0, tier - 1)
    grade = ['B', 'A', 'S'][tier]
    gradeNote = [
      'The chair was watched. The building watched itself.',
      'Solid. The building was walked, mostly, and the note holds up.',
      'A proper night of rounds. The day crew finds everything exactly where your note says.',
    ][tier]
  }

  const trips = s.log.filter((l) => l.text.includes('ALARM [CRITICAL]')).length
  const sensorNotes = s.zones.flatMap((z) =>
    z.sensors
      .map((sen, i) =>
        sen.fault !== 'none'
          ? `Hall ${z.id} sensor ${i + 1} was ${sen.fault === 'drift' ? 'drifting high' : 'stuck'}${sen.isolated ? ' (you isolated it)' : ' (never isolated)'}.`
          : null,
      )
      .filter((x): x is string => x !== null),
  )
  const assistLines: string[] = []
  if (recs.length > 0) {
    assistLines.push(`ASSIST issued ${recs.length} recommendation${recs.length === 1 ? '' : 's'}; you followed ${followedRight + followedWrong}.`)
    if (followedWrong > 0) assistLines.push(`${followedWrong} followed recommendation${followedWrong === 1 ? ' was' : 's were'} WRONG — ASSIST reads the same lying sensors you do.`)
    if (ignoredWrong > 0) assistLines.push(`You correctly overrode ASSIST ${ignoredWrong} time${ignoredWrong === 1 ? '' : 's'}. The vendor will not be pleased.`)
    if (ignoredRight > 0) assistLines.push(`${ignoredRight} good recommendation${ignoredRight === 1 ? '' : 's'} expired unactioned.`)
  }

  return {
    points,
    grade,
    gradeNote,
    ending: pickEnding(s, points, burned),
    abnormality: [
      `${trips} critical alarms over the shift, ${s.alarms.filter((a) => !a.acked).length} still unacknowledged at 06:00.`,
      ...sensorNotes,
      ...s.cracs
        .filter((c) => c.status !== 'running')
        .map((c) => `${c.id} (Hall ${c.zone}) ${c.status === 'failed' ? 'out of service' : 'tripped, never reset'} at handover.`),
      ...s.liquid.pumps
        .filter((p) => p.status === 'failed' || s.liquid.loopLocked)
        .map((p) => `CDU pump ${p.id} out of service at handover.`),
      ...(s.hotRack
        ? [
            `Rack row A3 fan failure at 01:41 — ${s.hotRack.fixed ? 'found on foot and fixed. No sensor ever saw it.' : 'NEVER FOUND. Room sensors read normal all night; the row did not.'}`,
          ]
        : []),
      ...(s.liquid.leak
        ? [
            `Leak alert at ${clockLabel(s.liquid.leak.raisedAt)} — ${s.liquid.leak.real ? 'REAL coolant leak' : 'condensation (false alarm)'}${s.liquid.leak.revealed ? ', verified in person' : ', never verified in person'}.`,
          ]
        : []),
      ...(s.smoke
        ? [
            `Smoke pre-alarm in Hall ${s.smoke.zone} at ${clockLabel(s.smoke.raisedAt)} — ${s.smoke.realFire ? 'REAL incipient fire' : 'false alarm (dust)'}${s.smoke.revealed ? ', verified in person' : ', never verified in person'}.`,
          ]
        : []),
      ...s.doorHistory.map(
        (d) =>
          `Gate: ${d.name} (${d.company}), ${d.workOrder} — ${d.decision === 'timeout' ? 'left unanswered' : d.decision}${d.legit ? '' : ' [work order did not match schedule]'}.`,
      ),
    ],
    handling: s.score.map((x) => `${clockLabel(x.time)} ${x.text} (${x.pts > 0 ? '+' : ''}${x.pts})`),
    assist: assistLines,
    handoverNote: s.handover?.submitted
      ? s.handover.selected.length
        ? s.handover.selected.map((id) => s.handover!.candidates.find((x) => x.id === id)!.text)
        : ['(You signed out without writing anything. The day crew starts blind.)']
      : [],
    result: [
      `Server downtime: ${s.downtimeMin.toFixed(0)} minutes.`,
      `Air-side throttling: ${s.throttleMin.toFixed(0)} min · GPU throttling: ${s.liquid.gpuThrottleMin.toFixed(0)} min (Tj) + ${s.liquid.memThrottleMin.toFixed(0)} min (memory/air) · compute shed: ${s.liquid.shedMin.toFixed(0)} min.`,
      `GPU fleet at handover: ${s.liquid.loopLocked ? 'DOWN — loop contaminated' : s.liquid.gpuRunning ? `running, Tj ${s.liquid.tj.toFixed(0)}°C` : 'stopped'}${s.liquid.damaged ? ' · SILICON DAMAGE SUSPECTED' : ''}.`,
      `Halls at handover: ${s.zones.map((z) => `${z.id} ${z.temp.toFixed(1)}°C${z.fire ? ' (FIRE)' : z.epo ? ' (EPO)' : ''}`).join(' · ')}.`,
    ],
    followUp: (() => {
      const items: string[] = []
      if (burned) items.push('Fire investigation + insurance claim for Hall A.', 'Review gate verification procedure.', 'Replace suppression agent cylinders.')
      if (s.liquid.loopLocked) items.push('Coolant loop flush + fitting replacement before GPU fleet restart.', 'Review leak-detection response procedure.')
      if (s.liquid.damaged) items.push('Thermal stress screening across the GPU fleet — silicon damage suspected.')
      if (!burned && s.downtimeMin > 0) items.push('File incident report for thermal shutdown.', 'Review CRAC maintenance contract response times.')
      if (items.length === 0) return [s.coffeeFixed ? 'No follow-up items. The coffee machine works. You are a legend.' : 'No follow-up items. Coffee. (Machine is still broken.)']
      return items
    })(),
  }
}
