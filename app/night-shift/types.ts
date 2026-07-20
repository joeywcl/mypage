// NIGHT SHIFT — core game types. Pure data: state must survive structuredClone.

export type Phase = 'start' | 'playing' | 'handover' | 'debrief'

// ---- seeded night plan: which authored variation of tonight you get ----
// Seed 1 is the canonical night; 32 permutations total. Deterministic — the
// seed fully determines the shift, so any night can be shared and replayed.
export interface NightPlan {
  seed: number
  quiet: boolean // Quiet Night mode: no scripted faults — rounds, rain, and care
  driftIdxA: 0 | 1 // which Hall A sensor drifts high
  stuckIdxB: 0 | 1 // which Hall B sensor freezes
  faultPump: 'P1' | 'P2' // which CDU pump has the bearing fault
  hardFaultB: 'CRAC-3' | 'CRAC-4' // Hall B unit that hard-faults (the other trips)
  bogusCover: 0 | 1 // which cover story the bogus visitor uses
}
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
  staff?: boolean // known colleague, no work order to match — zero-stakes visit
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
  // memory/VRM temperature — the AIR-cooled half of a hybrid rack. The die
  // rides the liquid loop; memory still rides hall air, on a slower clock.
  memT: number
  memThrottleMin: number
  memWarned: boolean
  memCritAlarmed: boolean
  tjHistory: number[] // sampled every game minute
  lastTjSample: number
  load: number // scheduled GPU load %
  shed: boolean // operator shed compute to reduce heat
  gpuRunning: boolean
  damaged: boolean
  bearingServiced: boolean // the whiny pump got its on-site service (kills the whine)
  loopLocked: boolean // real leak contained: loop is down for the night
  gpuThrottleMin: number
  shedMin: number
  tjWarned: boolean
  tjCritAlarmed: boolean
  leak: LeakAlert | null
}

// ---- ASSIST v0.9 (beta): the fake AI. Recommendations are computed from
// SENSOR READINGS (the lying layer), never true state — so it is confidently
// wrong exactly when the console is. Its confidence % is a formula, not ML.
export type AssistStatus = 'active' | 'followed' | 'expired'
export interface AssistRec {
  id: number
  kind: string // rule + target, e.g. 'reset:CRAC-1', 'iso:A:0' — one active per kind
  issuedAt: number
  text: string // the recommendation, e.g. 'RMT RESET CRAC-1'
  detail: string // one-line rationale shown under it
  confidence: number // 0–99, derived from sensor agreement + trend stability
  right: boolean // ground truth at issue time — never shown, only graded
  status: AssistStatus
  resolvedAt?: number
}

// ---- morning handover: write the note the day crew actually reads ----
export interface HandoverCandidate {
  id: number
  text: string
  truth: boolean // does this match ground truth?
  critical: boolean // a fact the day crew NEEDS (penalty if a true one is omitted)
}
export interface Handover {
  candidates: HandoverCandidate[]
  selected: number[]
  submitted: boolean
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
  night: NightPlan
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
  assist: { recs: AssistRec[]; nextRecId: number }
  handover: Handover | null
  coffeeFixed: boolean
  raining: boolean
  // quiet-mode rounds: a round is a clipboard walk — log readings at every
  // checkpoint on the floor. `visited` holds this round's checked units;
  // `log` is the lifetime record of every check, because the handover can
  // only contain what you actually observed and when you observed it.
  rounds: { count: number; lastAt: number; visited: string[]; log: { unit: string; at: number }[] }
  // the hot rack: one rack row cooking behind a failed fan. Room sensors are
  // HONEST and see nothing — the room average is fine. No alarm exists for
  // this. Only the floor finds it. (null until the scripted event fires)
  hotRack: { row: number; temp: number; revealed: boolean; fixed: boolean; penalized: boolean } | null
  log: LogEntry[]
  downtimeMin: number
  throttleMin: number
  score: ScoreItem[]
  firedEvents: number[]
  sabotageAt: number | null
  nextId: number
}

export type Action =
  | { type: 'START'; seed?: number; quiet?: boolean }
  | { type: 'TICK'; dt: number } // dt in real seconds
  | { type: 'HANDOVER_TOGGLE'; id: number }
  | { type: 'HANDOVER_SUBMIT' }
  | { type: 'FIX_COFFEE' }
  | { type: 'CHECK_UNIT'; unit: string } // quiet-mode rounds: log readings at a checkpoint
  | { type: 'REVEAL_RACK' } // on the floor, close enough to feel the hot row
  | { type: 'FIX_RACK_FAN' } // swap the failed rack fan (floor, after reveal)
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
  | { type: 'RESTART'; seed?: number; quiet?: boolean }
