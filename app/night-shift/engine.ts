// NIGHT SHIFT — deterministic game engine. No React, no DOM: a reducer over
// GameState driven by TICK actions. 1 real second = 2 game minutes.
//
// The core deception: alarms and trend projections are computed from SENSOR
// READINGS, which can drift or stick. Physical damage (throttling, shutdown)
// follows the TRUE temperature. The console can lie; the physics never does.

import type {
  Action,
  Alarm,
  CracUnit,
  GameState,
  LiquidLoop,
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
const DOOR_TIMEOUT = 15
const ACK_GRACE = 6
const SMOKE_FUSE = 15 // game minutes from pre-alarm to fire (if real)
const HISTORY_STEP = 2 // sample sensor-max every N game minutes
const HISTORY_MAX = 40

// liquid loop (Hall B direct-to-chip) — the fast tempo
const TJ_WARN = 88
const TJ_THROTTLE = 95
const TJ_TRIP = 105
const TJ_START_OK = 90
const LEAK_FUSE = 12 // game minutes from leak alert to busbar contact (if real)
const PUMP_SPINUP = 3 // game minutes for a starting pump to reach full flow

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

export function initialState(): GameState {
  return {
    phase: 'start',
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
    tickets: [
      { wo: 'WO-8802', desc: 'UPS preventive maintenance — PowerSure Pte Ltd', window: '02:00–04:00' },
      { wo: 'WO-4417', desc: 'CRAC filter replacement — CoolFlow Services', window: 'TOMORROW 10:00' },
      { wo: 'WO-9130', desc: 'Loading dock delivery (no hall access)', window: '05:00–05:30' },
    ],
    operator: { kind: 'console' },
    smoke: null,
    liquid: {
      pumps: [
        { id: 'P1', status: 'running', readyAt: 0 },
        { id: 'P2', status: 'standby', readyAt: 0 },
      ],
      flow: 100,
      tj: 78,
      tjHistory: [78],
      lastTjSample: 0,
      load: 65,
      shed: false,
      gpuRunning: true,
      damaged: false,
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
  const a: Alarm = { id: s.nextId++, time: s.t, severity, text, acked: false, penalized: false, ...meta }
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
      s.door = {
        id: s.nextId++,
        arrivedAt: s.t,
        name: 'M. Tan',
        company: 'CoolFlow Services',
        claim: 'Emergency CRAC filter job — office said tonight is fine.',
        workOrder: 'WO-4471',
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
  { at: 110, run: (s) => tripUnit(s, crac(s, 'CRAC-3'), false) },
  { at: 118, run: (s) => tripUnit(s, crac(s, 'CRAC-4'), true) },
  {
    // silent: Hall A sensor 1 starts drifting high — the false-alarm machine
    at: 150,
    run: (s) => {
      const sen = zone(s, 'A').sensors[0]
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
    // CDU pump P1 bearing seizure: standby carries the loop, redundancy gone.
    // Fixing it (on-site, at the CDU) rewrites how 04:10–04:20 plays out.
    at: 200,
    run: (s) => {
      s.liquid.pumps[0].status = 'failed'
      raise(s, 'warning', 'CDU pump P1 FAILED — bearing seizure. Standby P2 carrying loop. REDUNDANCY LOST. On-site service required.', { eop: 'EOP-05' })
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
    // leak rope wet at the CDU. Condensation — unless P1 has been grinding
    // itself apart all night and shook a fitting loose.
    at: 370,
    run: (s) => {
      s.liquid.leak = {
        raisedAt: s.t,
        real: s.liquid.pumps[0].status === 'failed',
        revealed: false,
        dismissed: false,
        resolved: false,
        contained: false,
      }
      raise(s, 'critical', 'LEAK DETECTION — CDU rope sensor WET (Hall B). Verify and act.', { eop: 'EOP-12' })
    },
  },
  {
    // second pump event: benign swap if P1 is healthy; loop-killer if not
    at: 380,
    run: (s) => {
      const [p1, p2] = s.liquid.pumps
      if (p2.status !== 'running') return
      if (p1.status === 'failed') {
        p2.status = 'failed'
        raise(s, 'critical', 'CDU pump P2 FAILED — ran unrelieved all night. LOOP FLOW COLLAPSING.', { eop: 'EOP-05' })
      } else {
        p2.status = 'tripped'
        raise(s, 'warning', 'CDU pump P2 tripped on overcurrent. Standby taking over.', { eop: 'EOP-05' })
      }
    },
  },
  {
    // silent: Hall B sensor 2 freezes — will under-report the 04:40 failure
    at: 330,
    run: (s) => {
      const z = zone(s, 'B')
      const sen = z.sensors[1]
      sen.fault = 'stuck'
      sen.frozen = z.readings[1]
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

  for (let i = 0; i < SCENARIO.length; i++) {
    if (s.t >= SCENARIO[i].at && !s.firedEvents.includes(i)) {
      s.firedEvents.push(i)
      SCENARIO[i].run(s)
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
  updateSmoke(s)
  updateDoor(s)
  updateAlarmSla(s)

  if (s.t >= SHIFT_END) {
    s.t = SHIFT_END
    s.phase = 'debrief'
    log(s, '06:00 — day crew arrives. Shift over.')
  }
}

// ---------------------------------------------------------------- reducer

export function reducer(state: GameState, action: Action): GameState {
  if (action.type === 'START') {
    const s = initialState()
    s.phase = 'playing'
    return s
  }
  if (action.type === 'RESTART') return initialState()
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
        log(s, 'Leaky P1 fitting re-torqued, loop topped up and refilled.')
      }
      let fixed = 0
      for (const p of L.pumps) {
        if (p.status === 'failed') {
          p.status = 'standby'
          fixed++
        }
      }
      if (fixed) log(s, `CDU service complete — ${fixed} pump${fixed > 1 ? 's' : ''} back to standby.`)
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
            ? 'Coolant is beading along the P1 fitting and dripping onto the rope. THIS IS A REAL LEAK.'
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
  abnormality: string[]
  handling: string[]
  result: string[]
  followUp: string[]
}

export function buildDebrief(s: GameState): Debrief {
  const penalties = s.score.filter((x) => x.pts < 0)
  const kudos = s.score.filter((x) => x.pts > 0)
  let points = 100 + kudos.reduce((a, x) => a + x.pts, 0) + penalties.reduce((a, x) => a + x.pts, 0)
  points -= s.downtimeMin * 1.2 + s.throttleMin * 0.25
  points -= s.liquid.gpuThrottleMin * 0.3 + s.liquid.shedMin * 0.15
  if (s.downtimeMin === 0) points += 10
  points = Math.round(Math.max(0, Math.min(110, points)))

  const burned = s.zones.some((z) => z.fire || (z.epo && s.smoke?.realFire))
  const grade = points >= 95 ? 'S' : points >= 85 ? 'A' : points >= 70 ? 'B' : points >= 50 ? 'C' : 'F'
  const gradeNote =
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
  return {
    points,
    grade,
    gradeNote,
    abnormality: [
      `${trips} critical alarms over the shift, ${s.alarms.filter((a) => !a.acked).length} still unacknowledged at 06:00.`,
      ...sensorNotes,
      ...s.liquid.pumps
        .filter((p) => p.status === 'failed' || s.liquid.loopLocked)
        .map((p) => `CDU pump ${p.id} out of service at handover.`),
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
    result: [
      `Server downtime: ${s.downtimeMin.toFixed(0)} rack-minutes.`,
      `Air-side throttling: ${s.throttleMin.toFixed(0)} min · GPU throttling: ${s.liquid.gpuThrottleMin.toFixed(0)} min · compute shed: ${s.liquid.shedMin.toFixed(0)} min.`,
      `GPU fleet at handover: ${s.liquid.loopLocked ? 'DOWN — loop contaminated' : s.liquid.gpuRunning ? `running, Tj ${s.liquid.tj.toFixed(0)}°C` : 'stopped'}${s.liquid.damaged ? ' · SILICON DAMAGE SUSPECTED' : ''}.`,
      `Halls at handover: ${s.zones.map((z) => `${z.id} ${z.temp.toFixed(1)}°C${z.fire ? ' (FIRE)' : z.epo ? ' (EPO)' : ''}`).join(' · ')}.`,
    ],
    followUp: burned
      ? ['Fire investigation + insurance claim for Hall A.', 'Review gate verification procedure.', 'Replace suppression agent cylinders.']
      : s.downtimeMin > 0
        ? ['File incident report for thermal shutdown.', 'Review CRAC maintenance contract response times.']
        : ['No follow-up items. Coffee.'],
  }
}
