// NIGHT SHIFT — core game types. Pure data: state must survive structuredClone.

export type Phase = 'start' | 'playing' | 'debrief'
export type ZoneId = 'A' | 'B'
export type CracStatus = 'running' | 'tripped' | 'failed'
export type Severity = 'info' | 'warning' | 'critical'

export interface CracUnit {
  id: string
  zone: ZoneId
  status: CracStatus
}

// A room sensor can silently go bad. Readings drive alarms and projections;
// the physics (throttling, shutdown) always follows the TRUE temperature.
export type SensorFault = 'none' | 'drift' | 'stuck'
export interface Sensor {
  fault: SensorFault
  faultAt: number // game minute the fault began
  frozen: number // reading a 'stuck' sensor is frozen at
  isolated: boolean // operator excluded it from alarming
  kudosGiven: boolean
}

export interface Zone {
  id: ZoneId
  name: string
  temp: number // TRUE temperature — never shown directly on the console
  racks: number
  serversDown: boolean
  epo: boolean // emergency power off (suppression discharge) — down for the night
  fire: boolean
  sensors: [Sensor, Sensor]
  readings: [number, number] // what the console shows
  history: number[] // sensor-max samples every 2 game-min (sparkline + trend)
  lastSample: number
  // threshold latches so each crossing raises exactly one alarm
  warned: boolean
  critAlarmed: boolean
}

export interface Alarm {
  id: number
  time: number // game minute raised
  severity: Severity
  text: string
  acked: boolean
  penalized: boolean
  eop?: string // procedure reference, e.g. 'EOP-03' — the in-game manual
  unit?: string // related CRAC unit, for EOP step check-off
  zone?: ZoneId
}

export interface DoorRequest {
  id: number
  arrivedAt: number
  name: string
  company: string
  claim: string
  workOrder: string
  legit: boolean
  decision?: 'admit' | 'deny' | 'timeout'
  resolvedAt?: number
}

export interface Ticket {
  wo: string
  desc: string
  window: string
}

export type OperatorLoc =
  | { kind: 'console' }
  | { kind: 'floor'; unit: string | null } // null = general walk / verification

// ---- Hall B direct-to-chip liquid loop (the fast tempo) ----
export type PumpStatus = 'running' | 'standby' | 'starting' | 'tripped' | 'failed'
export interface Pump {
  id: 'P1' | 'P2'
  status: PumpStatus
  readyAt: number // when a 'starting' pump reaches full flow
}

export interface LeakAlert {
  raisedAt: number
  real: boolean // real coolant leak vs condensation on the rope sensor
  revealed: boolean
  dismissed: boolean
  resolved: boolean
  contained: boolean // shut in time: fixable on-site, unlike busbar contamination
}

export interface LiquidLoop {
  pumps: [Pump, Pump]
  flow: number // % of design flow
  tj: number // max GPU junction temperature across the fleet (real + honest)
  tjHistory: number[] // sampled every game minute
  lastTjSample: number
  load: number // scheduled GPU load %
  shed: boolean // operator shed compute to reduce heat
  gpuRunning: boolean
  damaged: boolean
  loopLocked: boolean // real leak contained: loop is down for the night
  gpuThrottleMin: number
  shedMin: number
  tjWarned: boolean
  tjCritAlarmed: boolean
  leak: LeakAlert | null
}

export interface SmokeEvent {
  zone: ZoneId
  realFire: boolean
  raisedAt: number
  revealed: boolean // operator saw the source in person
  dismissed: boolean
  resolved: boolean
}

export interface ScoreItem {
  time: number
  text: string
  pts: number // positive = kudos, negative = penalty
}

export interface LogEntry {
  time: number
  text: string
}

export interface GameState {
  phase: Phase
  t: number // game minutes since 22:00; shift ends at 480 (06:00)
  cracs: CracUnit[]
  zones: Zone[]
  ups: { onBattery: boolean; sinceT: number; acked: boolean }
  alarms: Alarm[]
  door: DoorRequest | null
  doorHistory: DoorRequest[]
  tickets: Ticket[]
  operator: OperatorLoc
  smoke: SmokeEvent | null
  liquid: LiquidLoop
  log: LogEntry[]
  downtimeMin: number
  throttleMin: number
  score: ScoreItem[]
  firedEvents: number[]
  sabotageAt: number | null
  nextId: number
}

export type Action =
  | { type: 'START' }
  | { type: 'TICK'; dt: number } // dt in real seconds
  | { type: 'ACK'; id: number }
  | { type: 'REMOTE_RESTART'; unit: string }
  | { type: 'WALK'; unit?: string } // no unit = walk the floor to verify
  | { type: 'REPAIR_DONE'; unit: string }
  | { type: 'RETURN' }
  | { type: 'ISOLATE_SENSOR'; zone: ZoneId; idx: 0 | 1 }
  | { type: 'REVEAL_SMOKE' }
  | { type: 'SUPPRESS' } // discharge suppression + EPO the hall
  | { type: 'DISMISS_SMOKE' }
  | { type: 'RESTART_PUMP'; pump: 'P1' | 'P2' }
  | { type: 'REPAIR_PUMPS' } // on-site at the CDU: failed pumps back to standby
  | { type: 'SHED_LOAD' }
  | { type: 'RESTORE_LOAD' }
  | { type: 'GPU_STOP' } // controlled fleet shutdown — downtime, no damage
  | { type: 'GPU_START' }
  | { type: 'LEAK_SHUT' } // shut the loop + stop GPUs in response to leak alert
  | { type: 'DISMISS_LEAK' }
  | { type: 'REVEAL_LEAK' }
  | { type: 'DOOR'; decision: 'admit' | 'deny' }
  | { type: 'RESTART' }
