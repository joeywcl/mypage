// Smoke/fire, gate, and sensor-trust scenario tests.
import { buildDebrief } from '../engine'
import { act, assert, initialState, runTo } from './harness'

// s1: admit bogus contractor → real fire if smoke unhandled
{
  let s = act(initialState(), { type: 'START' })
  s = runTo(s, 41)
  assert(!!s.door && !s.door.legit, 's1: bogus visitor at gate at 22:41')
  s = act(s, { type: 'DOOR', decision: 'admit' })
  s = runTo(s, 431)
  assert(!!s.smoke && s.smoke.realFire, 's1: smoke is REAL after admitting saboteur')
  s = runTo(s, 448)
  assert(s.zones[0].fire, 's1: hall A on fire after ignoring real smoke')
  assert(s.score.some((x) => x.pts === -40), 's1: -40 fire penalty applied')
  s = runTo(s, 480)
  const d = buildDebrief(s)
  assert(d.grade === 'F', 's1: burned DC grades F (got ' + d.grade + ')')
  assert(d.followUp.some((x) => x.includes('Fire investigation')), 's1: fire follow-up present')
}

// s2: real smoke, suppressed in time
{
  let s = act(initialState(), { type: 'START' })
  s = runTo(s, 41)
  s = act(s, { type: 'DOOR', decision: 'admit' })
  s = runTo(s, 433)
  s = act(s, { type: 'SUPPRESS' })
  assert(s.smoke!.resolved && !s.zones[0].fire && s.zones[0].epo, 's2: suppression contains fire, hall EPO')
  assert(s.score.some((x) => x.pts === +12), 's2: +12 kudos for correct discharge')
  s = runTo(s, 480)
  assert(s.zones[0].fire === false, 's2: no fire by 06:00')
}

// s3: dust (deny bogus), dismissed correctly
{
  let s = act(initialState(), { type: 'START' })
  s = runTo(s, 41)
  s = act(s, { type: 'DOOR', decision: 'deny' })
  s = runTo(s, 433)
  assert(!!s.smoke && !s.smoke.realFire, 's3: smoke is dust when saboteur was denied')
  s = act(s, { type: 'DISMISS_SMOKE' })
  assert(s.smoke!.resolved, 's3: dismissed dust resolves')
  assert(s.score.some((x) => x.pts === +10), 's3: +10 kudos for correct dismissal')
}

// s4: suppress dust = expensive mistake
{
  let s = act(initialState(), { type: 'START' })
  s = runTo(s, 41)
  s = act(s, { type: 'DOOR', decision: 'deny' })
  s = runTo(s, 433)
  s = act(s, { type: 'SUPPRESS' })
  assert(s.score.some((x) => x.pts === -25), 's4: -25 for suppressing dust')
  assert(s.zones[0].epo, 's4: hall A EPO after unnecessary discharge')
}

// s5: reveal on the floor
{
  let s = act(initialState(), { type: 'START' })
  s = runTo(s, 41)
  s = act(s, { type: 'DOOR', decision: 'deny' })
  s = runTo(s, 433)
  s = act(s, { type: 'WALK' })
  assert(s.operator.kind === 'floor', 's5: general floor walk allowed')
  s = act(s, { type: 'REVEAL_SMOKE' })
  assert(s.smoke!.revealed, 's5: smoke source revealed on foot')
  s = act(s, { type: 'RETURN' })
  assert(s.operator.kind === 'console', 's5: back at console')
}

// s6: sensor drift → isolate → no false criticals
{
  let s = act(initialState(), { type: 'START' })
  s = runTo(s, 14)
  s = act(s, { type: 'REMOTE_RESTART', unit: 'CRAC-2' })
  s = runTo(s, 170) // drift active, S1 climbing
  const zA = s.zones[0]
  assert(Math.abs(zA.readings[0] - zA.readings[1]) > 3, 's6: sensors diverge under drift')
  s = act(s, { type: 'ISOLATE_SENSOR', zone: 'A', idx: 0 })
  assert(s.score.some((x) => x.pts === +4), 's6: +4 for isolating faulty sensor')
  const critBefore = s.alarms.filter((a) => a.text.includes('room sensors read')).length
  s = runTo(s, 250)
  const critAfter = s.alarms.filter((a) => a.text.includes('room sensors read')).length
  assert(critAfter === critBefore, 's6: no false sensor-critical after isolation')
}
