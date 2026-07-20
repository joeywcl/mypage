// NIGHT SHIFT — Emergency Operating Procedures. Real facilities write these
// so a stressed human at 3 a.m. doesn't have to think, only execute. Here
// they double as the tutorial: steps carry live check-off predicates, and
// the language assumes you've never set foot in a data center.

import type { Alarm, GameState } from './types'

export interface EopStep {
  text: string
  // present = live-checkable against game state; absent = informational
  done?: (s: GameState, a: Alarm) => boolean
}

export interface Eop {
  id: string
  title: string
  why: string
  steps: EopStep[]
}

const unitRunning = (s: GameState, a: Alarm) =>
  !!s.cracs.find((c) => c.id === a.unit && c.status === 'running')
const hallCool = (s: GameState, a: Alarm) => {
  const z = s.zones.find((x) => x.id === a.zone)
  return !!z && z.temp < 33 && !z.serversDown
}

export const EOPS: Record<string, Eop> = {
  'EOP-03': {
    id: 'EOP-03',
    title: 'LOSS OF CRAC COOLING',
    why: 'A CRAC is a hall’s air conditioner. Each hall has two; one alone holds a hall at ~27°C. With zero running, the room gains ~1°C per minute — throttling at 38°C, emergency shutdown at 42°C.',
    steps: [
      { text: 'Acknowledge the alarm (ACK). Free, instant, and audited.', done: (s, a) => a.acked },
      { text: 'Count the RUNNING units left in that hall on the FACILITY panel.' },
      { text: 'TRIPPED unit → press RMT RESET. Trips are electrical hiccups; remote reset usually takes.', done: unitRunning },
      {
        text: 'HARD FAULT → remote reset is rejected; GO ON-SITE and hold E at the unit. (In real life this is a vendor callout — tonight, you are the stopgap.)',
        done: unitRunning,
      },
      { text: 'Watch the hall TREND until it reads STABLE below 33°C.', done: hallCool },
    ],
  },
  'EOP-02': {
    id: 'EOP-02',
    title: 'HIGH HALL TEMPERATURE',
    why: 'Temperature alarms come from ROOM SENSORS, and sensors go bad. The racks cook on the REAL temperature, not the reading. Verify before acting.',
    steps: [
      { text: 'Acknowledge the alarm.', done: (s, a) => a.acked },
      { text: 'Compare S1 vs S2 for the hall. More than ~3° apart means one of them is lying.' },
      { text: 'A steady climber while cooling runs fine = DRIFTING sensor. A flat line while everything changes = STUCK sensor. Press ISO on the liar — never the honest one.' },
      { text: 'Unsure which is lying? WALK THE FLOOR: the AIR line shown in the hall is ground truth you can feel.' },
      { text: 'If the heat is real, restore cooling (see EOP-03) and watch the trend recover.', done: hallCool },
    ],
  },
  'EOP-07': {
    id: 'EOP-07',
    title: 'UPS ON BATTERY',
    why: 'The utility feed blinked; the UPS batteries are carrying the load. Cooling and IT are fine for ~20 minutes. Usually the feed returns on its own.',
    steps: [
      { text: 'Acknowledge the alarm — this one is mostly about proving you saw it.', done: (s, a) => a.acked },
      { text: 'Note the runtime remaining. Nothing to fix from the console; the fault is on the utility side.' },
      { text: 'If it holds more than ~15 minutes, procedure says prepare generator transfer and call the duty manager. (Not simulated tonight — it should resolve.)' },
      { text: 'Confirm return to mains in the header.', done: (s) => !s.ups.onBattery },
    ],
  },
  'EOP-05': {
    id: 'EOP-05',
    title: 'LOSS OF COOLANT FLOW / CDU PUMP FAULT',
    why: 'Hall B’s racks are HYBRID. The GPU die is liquid-cooled: no flow and chip temperature (Tj) races in MINUTES — throttle at 95°C, trip at 105°C with possible silicon damage. But MEMORY still rides hall air: lose Hall B’s CRACs and MEM creeps toward throttle at 88°C on a slower clock. Two paths bind the same rack; read which one is moving. The TREND line is your clock — its TTB (time-to-breach) figure is the console’s estimate of minutes left before a threshold, and it is only as honest as the sensor feeding it.',
    steps: [
      { text: 'Acknowledge the alarm.', done: (s, a) => a.acked },
      { text: 'Read WHICH temperature is moving. Tj racing = LIQUID path (flow/pumps). MEM creeping while Tj is fine = AIR path — the fix is Hall B’s CRACs (EOP-03), not the CDU.', done: (s) => s.liquid.memT < 80 },
      { text: 'Check FLOW and the pumps. One pump alone carries the loop fine — but with no standby left, you are one fault from a crisis.' },
      { text: 'TRIPPED pump → RMT RESET. FAILED pump → on-site service at the CDU (bottom aisle, Hall B).', done: (s) => s.liquid.flow === 100 },
      { text: 'If either temperature is racing: SHED LOAD immediately (less compute = less heat on BOTH paths = more time).' },
      { text: 'If the TREND says TRIP arrives before your fix can: E-STOP the fleet YOURSELF. A controlled stop costs downtime; an uncontrolled trip costs downtime AND hardware.' },
      { text: 'Flow restored and Tj below 90 → START FLEET.', done: (s) => s.liquid.gpuRunning && s.liquid.tj < 95 },
    ],
  },
  'EOP-12': {
    id: 'EOP-12',
    title: 'LEAK DETECTION — CDU ROPE SENSOR',
    why: 'A moisture-sensing rope lies under the CDU. Condensation sets it off constantly in humid weather. Actual coolant reaching live electrical gear destroys the hall. Both wrong answers are expensive — evidence first.',
    steps: [
      { text: 'Acknowledge the alarm.', done: (s, a) => a.acked },
      { text: 'Best move: WALK THE FLOOR and inspect the CDU up close. You will see either dew on the casing or coolant at a fitting — certainty, for the price of being away from the console.', done: (s) => !!s.liquid.leak?.revealed },
      { text: 'Real leak → SHUT LOOP + STOP GPUS before it spreads. The fitting can then be serviced at the CDU.' },
      { text: 'Condensation → DISMISS. (Dismissing a REAL leak lets it reach the busbar within minutes.)' },
      { text: 'Resolve it one way or the other — an ignored rope alert is a gamble on luck.', done: (s) => !!s.liquid.leak?.resolved },
    ],
  },
  'EOP-11': {
    id: 'EOP-11',
    title: 'SMOKE PRE-ALARM (VESDA)',
    why: 'VESDA sniffs air continuously and alarms long before flames. Dust from contractor work triggers it too. Discharging suppression needlessly kills a hall for the night; ignoring a real fire loses the building. Authorization from the duty manager is normally required to discharge — unless it is clearly burning.',
    steps: [
      { text: 'Acknowledge the alarm.', done: (s, a) => a.acked },
      { text: 'Think: who has been in that hall tonight? Unverified visitors and hot work are how fires start.' },
      { text: 'Best move: verify in person. Walk to the flagged area and look.', done: (s) => !!s.smoke?.revealed },
      { text: 'Confirmed real → DISCHARGE + EPO. Confirmed dust → DISMISS.' },
      { text: 'Resolve before the pre-alarm window closes — incipient smoke does not wait.', done: (s) => !!s.smoke?.resolved },
    ],
  },
}
