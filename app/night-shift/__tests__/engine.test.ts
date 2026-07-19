// Liquid-loop (Hall B direct-to-chip) scenario tests.
import { buildDebrief, buildNightPlan } from '../engine'
import { act, assert, initialState, runTo } from './harness'

// --- L1: diligent operator — fix P1 on-site → leak is condensation, P2 event benign
{
  let s = act(initialState(), { type: 'START' })
  s = runTo(s, 202)
  assert(s.liquid.pumps[0].status === 'failed', 'L1: P1 failed at 01:20')
  s = runTo(s, 206) // standby spin-up complete
  assert(s.liquid.flow === 100, 'L1: P2 carries loop after spin-up')
  s = act(s, { type: 'WALK' })
  s = act(s, { type: 'REPAIR_PUMPS' })
  s = act(s, { type: 'RETURN' })
  assert(s.liquid.pumps[0].status === 'standby', 'L1: CDU service returns P1 to standby')
  s = runTo(s, 371)
  assert(!!s.liquid.leak && !s.liquid.leak.real, 'L1: leak is condensation when P1 was fixed')
  s = act(s, { type: 'DISMISS_LEAK' })
  assert(s.score.some((x) => x.pts === +8), 'L1: +8 for correct condensation call')
  s = runTo(s, 385)
  assert(s.liquid.flow > 0, 'L1: flow alive through P2 trip (auto-swap)')
  s = runTo(s, 480)
  assert(!s.liquid.damaged, 'L1: no silicon damage on a diligent night')
}

// --- L2: negligent operator — P1 never fixed → real leak → busbar catastrophe; not fixable
{
  let s = act(initialState(), { type: 'START' })
  s = runTo(s, 371)
  assert(!!s.liquid.leak && s.liquid.leak.real, 'L2: leak is REAL when P1 left failed')
  s = runTo(s, 398) // busbar lands at 370 + 24 fuse
  assert(s.score.some((x) => x.pts === -35), 'L2: busbar catastrophe for ignoring real leak')
  assert(s.liquid.loopLocked && s.liquid.damaged && !s.liquid.gpuRunning, 'L2: loop dead, damage, fleet dark')
  s = act(s, { type: 'WALK' })
  s = act(s, { type: 'REPAIR_PUMPS' })
  assert(s.liquid.loopLocked, 'L2: busbar contamination is NOT fixable on-site')
}

// --- L2b: physics — flow collapse with fleet running → Tj races to 105, trip + damage
{
  let s = act(initialState(), { type: 'START' })
  s = runTo(s, 260) // load 85%, Tj settled ~89
  // synthetic double-pump loss (unit-testing the physics path)
  s.liquid.pumps[0].status = 'failed'
  s.liquid.pumps[1].status = 'failed'
  const tj0 = s.liquid.tj
  s = runTo(s, 266)
  assert(s.liquid.flow === 0, 'L2b: no pumps, no flow')
  assert(s.liquid.tj > tj0 + 10, 'L2b: Tj races at zero flow')
  s = runTo(s, 280)
  assert(!s.liquid.gpuRunning && s.liquid.damaged, 'L2b: uncontrolled trip at 105')
  assert(s.score.some((x) => x.pts === -15), 'L2b: -15 silicon damage penalty')
}

// --- L3: crisis managed — real leak contained, fixed on-site, fleet restarted
{
  let s = act(initialState(), { type: 'START' })
  s = runTo(s, 371) // P1 neglected → leak real
  s = act(s, { type: 'LEAK_SHUT' })
  assert(s.liquid.loopLocked && s.liquid.leak!.contained, 'L3: contained leak locks loop, repairably')
  s = act(s, { type: 'WALK' })
  s = act(s, { type: 'REPAIR_PUMPS' })
  s = act(s, { type: 'RETURN' })
  assert(!s.liquid.loopLocked, 'L3: fitting re-torqued — loop unlocked')
  s = runTo(s, 379) // pump auto-start + spin-up
  assert(s.liquid.flow === 100, 'L3: flow restored after CDU service')
  s = act(s, { type: 'GPU_START' })
  assert(s.liquid.gpuRunning, 'L3: fleet restarts once flow is back')
  s = runTo(s, 480)
  assert(!s.liquid.damaged, 'L3: comeback night — no damage')
  assert(!s.score.some((x) => x.pts === -35), 'L3: busbar avoided')
}

// --- L4: real leak, shut in time, never repaired → down for the night but safe
{
  let s = act(initialState(), { type: 'START' })
  s = runTo(s, 371)
  s = act(s, { type: 'LEAK_SHUT' })
  assert(s.score.some((x) => x.pts === +12), 'L4: +12 for containing real leak')
  s = runTo(s, 480)
  assert(!s.score.some((x) => x.pts === -35), 'L4: no busbar catastrophe after containment')
}

// --- L5: real leak dismissed → busbar catastrophe
{
  let s = act(initialState(), { type: 'START' })
  s = runTo(s, 371)
  s = act(s, { type: 'DISMISS_LEAK' })
  s = runTo(s, 398)
  assert(s.score.some((x) => x.pts === -35), 'L5: -35 coolant-on-busbar penalty')
  assert(s.liquid.loopLocked, 'L5: loop contaminated')
}

// --- L6: false-leak shutdown penalised but recoverable
{
  let s = act(initialState(), { type: 'START' })
  s = runTo(s, 202)
  s = act(s, { type: 'WALK' })
  s = act(s, { type: 'REPAIR_PUMPS' })
  s = act(s, { type: 'RETURN' })
  s = runTo(s, 371)
  s = act(s, { type: 'LEAK_SHUT' }) // condensation — wrong call
  assert(s.score.some((x) => x.pts === -18), 'L6: -18 for shutting loop on condensation')
  assert(!s.liquid.loopLocked, 'L6: loop not locked on false leak')
  s = runTo(s, 386) // past P2 trip + spin-up
  s = act(s, { type: 'GPU_START' })
  assert(s.liquid.gpuRunning, 'L6: fleet restartable after false-leak shutdown')
}

// --- L7: shed load actually buys Tj margin
{
  let s = act(initialState(), { type: 'START' })
  s = runTo(s, 260)
  const before = s.liquid.tj
  s = act(s, { type: 'SHED_LOAD' })
  s = runTo(s, 275)
  assert(s.liquid.tj < before - 10, 'L7: shedding load drops Tj')
  assert(s.liquid.shedMin > 0, 'L7: shed minutes tracked for the report')
}

// --- L8: memory/air path — Hall B CRAC loss surfaces as MEM over-temp, not Tj
{
  // negligent: CRAC-3 trips at 110, CRAC-4 hard-faults at 118, nobody acts
  let s = act(initialState(), { type: 'START' })
  s = runTo(s, 160)
  const tjBefore = s.liquid.tj
  assert(s.liquid.memT >= 88, 'L8: MEM breaches 88° after Hall B air loss ignored')
  assert(s.liquid.memThrottleMin > 0, 'L8: memory throttle minutes accrue')
  assert(tjBefore < 95, 'L8: Tj stays below throttle — the liquid path is innocent')
  assert(
    s.alarms.some((a) => a.text.includes('MEMORY')),
    'L8: memory over-temp raises its own alarm',
  )

  // diligent: reset the tripped unit remotely, service the hard fault on-site
  let d = act(initialState(), { type: 'START' })
  d = runTo(d, 120)
  d = act(d, { type: 'REMOTE_RESTART', unit: 'CRAC-3' })
  d = act(d, { type: 'WALK', unit: 'CRAC-4' })
  d = act(d, { type: 'REPAIR_DONE', unit: 'CRAC-4' })
  d = act(d, { type: 'RETURN' })
  d = runTo(d, 200)
  assert(d.liquid.memT < 80, 'L8: MEM stays nominal when Hall B cooling is restored')
  assert(d.liquid.memThrottleMin === 0, 'L8: no memory throttling on a diligent night')

  // shed relieves the air path too: while hall air is collapsing it can't
  // reverse the climb, but a shed run must sit cooler than a no-shed control
  let e = act(initialState(), { type: 'START' })
  e = runTo(e, 150)
  let ctl = structuredClone(e)
  e = act(e, { type: 'SHED_LOAD' })
  e = runTo(e, 165)
  ctl = runTo(ctl, 165)
  assert(e.liquid.memT < ctl.liquid.memT, 'L8: shedding load buys MEM margin vs no-shed control')
}

// --- L9: debrief reports what the handover actually looks like
{
  // fully negligent night: failed CRAC + contaminated loop must both surface
  let s = act(initialState(), { type: 'START' })
  s = runTo(s, 480)
  const d = buildDebrief(s)
  assert(
    d.abnormality.some((x) => x.includes('CRAC-4') && x.includes('handover')),
    'L9: failed CRAC-4 listed at handover',
  )
  assert(
    d.followUp.some((x) => x.toLowerCase().includes('coolant loop')),
    'L9: contaminated loop gets a follow-up item',
  )
  assert(
    d.followUp.some((x) => x.toLowerCase().includes('silicon')),
    'L9: suspected silicon damage gets a follow-up item',
  )

  // diligent night: CRACs repaired → no CRAC handover line, no loop follow-up
  let g = act(initialState(), { type: 'START' })
  g = runTo(g, 15)
  g = act(g, { type: 'REMOTE_RESTART', unit: 'CRAC-2' })
  g = runTo(g, 120)
  g = act(g, { type: 'REMOTE_RESTART', unit: 'CRAC-3' })
  g = act(g, { type: 'WALK', unit: 'CRAC-4' })
  g = act(g, { type: 'REPAIR_DONE', unit: 'CRAC-4' })
  g = act(g, { type: 'RETURN' })
  g = runTo(g, 206)
  g = act(g, { type: 'WALK' })
  g = act(g, { type: 'REPAIR_PUMPS' })
  g = act(g, { type: 'RETURN' })
  g = runTo(g, 305)
  const trippedA = g.cracs.find((c) => c.zone === 'A' && c.status === 'tripped')
  if (trippedA) g = act(g, { type: 'REMOTE_RESTART', unit: trippedA.id })
  g = runTo(g, 371)
  g = act(g, { type: 'DISMISS_LEAK' })
  g = runTo(g, 480)
  const gd = buildDebrief(g)
  assert(!gd.abnormality.some((x) => x.startsWith('CRAC')), 'L9: no CRAC handover line on a diligent night')
  assert(!gd.followUp.some((x) => x.toLowerCase().includes('coolant loop')), 'L9: no loop follow-up when loop is healthy')
}

// --- L10: seeded nights — permutations are authored, deterministic, shareable
{
  const p1 = buildNightPlan(1)
  assert(
    p1.driftIdxA === 0 && p1.stuckIdxB === 1 && p1.faultPump === 'P1' && p1.hardFaultB === 'CRAC-4' && p1.bogusCover === 0,
    'L10: seed 1 is the canonical night',
  )

  // pump variation: the bearing fault moves to P2, and the causality web moves with it
  let s = act(initialState(5), { type: 'START' })
  assert(s.night.faultPump === 'P2', 'L10: seed 5 puts the bearing fault on P2')
  s = runTo(s, 202)
  assert(s.liquid.pumps[1].status === 'failed', 'L10: P2 fails at 01:20 on a P2 night')
  assert(s.liquid.pumps[0].status === 'running' || s.liquid.pumps[0].status === 'starting', 'L10: P1 carries the loop')
  s = runTo(s, 371)
  assert(!!s.liquid.leak && s.liquid.leak.real, 'L10: unserviced P2 makes the leak real')

  // CRAC variation: the hard fault moves to CRAC-3
  let c = act(initialState(9), { type: 'START' })
  c = runTo(c, 125)
  assert(
    c.cracs.find((u) => u.id === 'CRAC-3')!.status === 'failed' && c.cracs.find((u) => u.id === 'CRAC-4')!.status === 'tripped',
    'L10: seed 9 swaps which Hall B unit hard-faults',
  )

  // sensor variation: the drifter moves to S2
  let d = act(initialState(2), { type: 'START' })
  d = runTo(d, 170)
  assert(d.zones[0].sensors[1].fault === 'drift' && d.zones[0].sensors[0].fault === 'none', 'L10: seed 2 drifts Hall A S2')

  // determinism: same seed, same night, byte for byte
  const a1 = runTo(act(initialState(13), { type: 'START' }), 240)
  const a2 = runTo(act(initialState(13), { type: 'START' }), 240)
  assert(JSON.stringify(a1) === JSON.stringify(a2), 'L10: identical seeds produce identical shifts')
}

// --- L11: ASSIST v0.9 — right when the sensors are, wrong when they lie
{
  // plain trip: ASSIST recommends the reset; following it is graded right
  let s = act(initialState(), { type: 'START' })
  s = runTo(s, 20)
  const rec = s.assist.recs.find((r) => r.kind === 'reset:CRAC-2')
  assert(!!rec && rec.status === 'active' && rec.right, 'L11: tripped CRAC produces a right reset rec')
  s = act(s, { type: 'REMOTE_RESTART', unit: 'CRAC-2' })
  s = act(s, { type: 'TICK', dt: 1 })
  assert(s.assist.recs.find((r) => r.kind === 'reset:CRAC-2')!.status === 'followed', 'L11: doing the thing counts as following')

  // drift: ASSIST flags the drifter (reads farther from baseline) — correctly
  let d = act(initialState(), { type: 'START' })
  d = runTo(d, 290)
  const iso = d.assist.recs.find((r) => r.kind.startsWith('iso:A:'))
  assert(!!iso && iso.kind === 'iso:A:0' && iso.right, 'L11: ASSIST correctly fingers the drifting Hall A sensor')

  // the blind spot: a sensor stuck COOL while its hall heats. The honest
  // sensor reads far from baseline, so ASSIST confidently fingers... the
  // honest one. (Diligent night so the stuck sensor froze at a cool 24°,
  // then a synthetic double failure heats the hall — the masking scenario.)
  let b = act(initialState(), { type: 'START' })
  b = runTo(b, 120)
  b = act(b, { type: 'REMOTE_RESTART', unit: 'CRAC-3' })
  b = act(b, { type: 'WALK', unit: 'CRAC-4' })
  b = act(b, { type: 'REPAIR_DONE', unit: 'CRAC-4' })
  b = act(b, { type: 'RETURN' })
  b = runTo(b, 336) // stuck sensor froze at ~24° at 03:30
  for (const u of b.cracs) if (u.zone === 'B') u.status = 'tripped' // synthetic hall B air loss
  b = runTo(b, 352) // hall heats; honest sensor climbs away from the frozen one
  const stuckIdx = b.night.stuckIdxB
  const honestIdx = stuckIdx === 0 ? 1 : 0
  const bad = b.assist.recs.find((r) => r.kind === `iso:B:${honestIdx}`)
  assert(!!bad && !bad.right, 'L11: heating hall + sensor stuck cool = ASSIST confidently fingers the honest sensor')
  // player knows better: isolates the stuck one instead → graded as an override
  b = act(b, { type: 'ISOLATE_SENSOR', zone: 'B', idx: stuckIdx })
  b = act(b, { type: 'TICK', dt: 1 })
  const after = b.assist.recs.find((r) => r.kind === `iso:B:${honestIdx}`)!
  assert(after.status === 'expired', 'L11: isolating the other sensor kills the wrong rec')
  const deb = buildDebrief(runTo(b, 480))
  assert(deb.assist.some((x) => x.includes('correctly overrode')), 'L11: debrief credits the override')
}

// --- L12: handover, endings, coffee
{
  // negligent night: sign out blind and pass on a false claim
  let s = act(initialState(), { type: 'START' })
  s = runTo(s, 480)
  assert(s.phase === 'handover', 'L12: 06:00 lands on the handover screen, not the grade')
  assert(s.handover!.candidates.length === 8, 'L12: eight candidate observations')
  const lie = s.handover!.candidates.find((c) => !c.truth)!
  s = act(s, { type: 'HANDOVER_TOGGLE', id: lie.id })
  s = act(s, { type: 'HANDOVER_SUBMIT' })
  assert(s.phase === 'debrief', 'L12: submitting the note ends the shift')
  assert(s.score.some((x) => x.pts === -4 && x.text.startsWith('Handover')), 'L12: passing on a false claim costs -4')
  const d = buildDebrief(s)
  assert(d.ending === 'EXPENSIVE LESSONS', 'L12: silicon damage names the night')
  assert(d.handoverNote.length === 1, 'L12: the note you wrote is in the report')

  // truthful note scores, and the coffee machine is a real interactable
  let g = act(initialState(), { type: 'START' })
  g = act(g, { type: 'WALK' })
  g = act(g, { type: 'FIX_COFFEE' })
  assert(g.coffeeFixed && g.score.some((x) => x.pts === 1), 'L12: percussive maintenance pays out once')
  g = act(g, { type: 'FIX_COFFEE' })
  assert(g.score.filter((x) => x.pts === 1).length === 1, 'L12: coffee kudos does not stack')
  g = act(g, { type: 'RETURN' })
  g = runTo(g, 480)
  const truth = g.handover!.candidates.find((c) => c.truth && c.critical)
  if (truth) g = act(g, { type: 'HANDOVER_TOGGLE', id: truth.id })
  g = act(g, { type: 'HANDOVER_SUBMIT' })
  assert(g.score.some((x) => x.pts === 3 && x.text.startsWith('Handover')), 'L12: passing on a real issue pays +3')
}

// --- L13: Quiet Night — the other 360 nights of the year
{
  // a full quiet shift with zero input: nothing bad may happen
  let s = act(initialState(1, true), { type: 'START' })
  assert(s.night.quiet, 'L13: quiet flag survives START')
  s = runTo(s, 480)
  assert(s.downtimeMin === 0 && s.throttleMin === 0 && s.liquid.gpuThrottleMin === 0, 'L13: nothing throttles, nothing goes down')
  assert(s.cracs.every((u) => u.status === 'running'), 'L13: every CRAC runs all night')
  assert(!s.alarms.some((a) => a.severity === 'critical' || a.severity === 'warning'), 'L13: no warnings, no criticals — only the self-test info line')
  assert(s.alarms.some((a) => a.severity === 'info' && a.text.includes('SELF-TEST')), 'L13: the 02:00 UPS self-test announces itself')
  assert(!s.score.some((x) => x.pts < 0), 'L13: an untouched quiet night carries no penalties')
  assert(s.log.some((l) => l.text.includes('Rain starting')), 'L13: rain arrives')
  assert(!s.raining, 'L13: rain eases off with the dawn')

  // ASSIST's one recommendation, and the clipboard-rounds loop
  const CHECKPOINTS = ['CRAC-1', 'CRAC-2', 'CRAC-3', 'CRAC-4', 'CDU']
  const walkRound = (st: ReturnType<typeof initialState>) => {
    let x = act(st, { type: 'WALK' })
    for (const u of CHECKPOINTS) x = act(x, { type: 'CHECK_UNIT', unit: u })
    return act(x, { type: 'RETURN' })
  }
  let g = act(initialState(1, true), { type: 'START' })
  g = runTo(g, 250)
  assert(g.assist.recs.some((r) => r.kind === 'coffee'), 'L13: ASSIST recommends coffee at 02:00')
  g = act(g, { type: 'WALK' })
  g = act(g, { type: 'FIX_COFFEE' })
  g = act(g, { type: 'RETURN' })
  g = act(g, { type: 'TICK', dt: 1 })
  assert(g.assist.recs.find((r) => r.kind === 'coffee')!.status === 'followed', 'L13: fixing the machine follows the recommendation')
  g = walkRound(g)
  assert(g.rounds.count === 1, 'L13: logging all five checkpoints completes a round')
  const partial = act(act(g, { type: 'WALK' }), { type: 'CHECK_UNIT', unit: 'CRAC-1' })
  assert(partial.rounds.visited.length === 0 && partial.rounds.count === 1, 'L13: rounds are one per hour — checkpoints stay closed until the next window')

  // four rounds + coffee = the good ending; the note still punishes lies
  let q = act(initialState(1, true), { type: 'START' })
  q = act(q, { type: 'WALK' })
  q = act(q, { type: 'FIX_COFFEE' })
  q = act(q, { type: 'RETURN' })
  q = walkRound(q)
  for (const t of [120, 220, 320]) {
    q = runTo(q, t)
    q = walkRound(q)
  }
  q = runTo(q, 480)
  assert(q.rounds.count === 4, 'L13: four rounds walked')
  assert(q.phase === 'handover', 'L13: a quiet night still ends with the note')
  const roundsClaim = q.handover!.candidates.find((c) => c.text.includes('rounds completed'))!
  assert(roundsClaim.truth, 'L13: the rounds claim is TRUE when you actually walked them')
  assert(
    q.handover!.candidates.some((c) => c.text.includes('whine unchanged') && c.truth),
    'L13: walking the rounds earns you the TRUE whine observation',
  )
  q = act(q, { type: 'HANDOVER_TOGGLE', id: roundsClaim.id })
  q = act(q, { type: 'HANDOVER_SUBMIT' })
  const qd = buildDebrief(q)
  assert(qd.ending === 'NOTHING HAPPENED. YOU MADE SURE.', 'L13: the caretaker ending')
  assert(qd.grade === 'S', 'L13: showing up, done properly, grades S')

  // the lazy version: skipped rounds make the same claim a lie
  let z = act(initialState(1, true), { type: 'START' })
  z = runTo(z, 480)
  const lazyClaim = z.handover!.candidates.find((c) => c.text.includes('rounds completed'))!
  assert(!lazyClaim.truth, 'L13: claiming rounds you never walked is a false claim')
  assert(
    z.handover!.candidates.some((c) => c.text.includes('louder') && !c.truth) &&
      z.handover!.candidates.some((c) => c.text.includes('bone dry') && !c.truth),
    'L13: skip the rounds and your plausible guesses about the building are confidently wrong',
  )
  const zd = buildDebrief(act(act(z, { type: 'HANDOVER_TOGGLE', id: lazyClaim.id }), { type: 'HANDOVER_SUBMIT' }))
  assert(zd.ending === 'THE CHAIR HAS YOUR SHAPE NOW', 'L13: the chair remembers')
}

// --- L14: the hot rack — the sensor lesson no sensor can teach
{
  // ignored: it cooks all night, silently. No alarm may ever fire for it.
  let s = act(initialState(), { type: 'START' })
  s = runTo(s, 480)
  assert(!!s.hotRack && !s.hotRack.fixed && s.hotRack.temp > 45, 'L14: unfound hot rack cooks to fan-dead equilibrium')
  assert(!s.alarms.some((a) => a.text.includes('A3') || a.text.toLowerCase().includes('rack row')), 'L14: no alarm exists for a per-rack failure — that is the lesson')
  assert(s.score.some((x) => x.pts === -8), 'L14: the day crew finds it by smell (-8)')
  const d = buildDebrief(s)
  assert(d.abnormality.some((x) => x.includes('A3') && x.includes('NEVER FOUND')), 'L14: debrief names the blind spot')

  // found and fixed: the floor rewards attention the console cannot
  let g = act(initialState(), { type: 'START' })
  g = runTo(g, 240)
  g = act(g, { type: 'WALK' })
  g = act(g, { type: 'REVEAL_RACK' })
  g = act(g, { type: 'FIX_RACK_FAN' })
  g = act(g, { type: 'RETURN' })
  assert(g.score.some((x) => x.pts === +6), 'L14: +6 for finding what no sensor could see')
  const hotAtFix = g.hotRack!.temp
  g = runTo(g, 290)
  assert(g.hotRack!.temp < hotAtFix, 'L14: swapped fan bleeds the heat back off')
  g = runTo(g, 480)
  assert(!g.score.some((x) => x.pts === -8), 'L14: no smell test when you did your job')
  assert(g.handover!.candidates.some((c) => c.text.includes('A3') && c.truth), 'L14: a discovered rack is handover material')

  // quiet nights have no hot rack, and start on the floor
  let q = act(initialState(1, true), { type: 'START' })
  assert(q.operator.kind === 'floor', 'L14: quiet night clocks in standing on the floor')
  q = runTo(q, 480)
  assert(q.hotRack === null, 'L14: the quiet night is actually quiet')
}

// --- L15: rollout sweep — every authored night must survive a full shift
{
  let ok = true
  const issues: string[] = []
  for (let seed = 1; seed <= 32; seed++) {
    try {
      const plan = buildNightPlan(seed)
      let s = act(initialState(seed), { type: 'START' })
      s = runTo(s, 480)
      const d = buildDebrief(s)
      // structural invariants every scripted night must satisfy
      if (s.phase !== 'handover') issues.push(`#${seed}: did not reach handover`)
      if (!s.liquid.leak) issues.push(`#${seed}: leak dilemma never fired`)
      if (!s.liquid.leak?.real) issues.push(`#${seed}: neglected ${plan.faultPump} should make the leak real`)
      const bad = s.liquid.pumps.find((p) => p.id === plan.faultPump)
      if (bad && bad.status !== 'failed') issues.push(`#${seed}: planned fault pump ${plan.faultPump} not failed`)
      if (s.cracs.find((u) => u.id === plan.hardFaultB)!.status !== 'failed') issues.push(`#${seed}: planned hard fault ${plan.hardFaultB} not failed`)
      if (s.zones[0].sensors[plan.driftIdxA].fault !== 'drift') issues.push(`#${seed}: planned drift sensor not drifting`)
      if (s.zones[1].sensors[plan.stuckIdxB].fault !== 'stuck') issues.push(`#${seed}: planned stuck sensor not stuck`)
      if (!s.hotRack || s.hotRack.temp <= 45) issues.push(`#${seed}: hot rack missing or cool`)
      if (!s.smoke) issues.push(`#${seed}: smoke climax never fired`)
      if (s.smoke?.realFire) issues.push(`#${seed}: smoke real without admitting the intruder`)
      if (d.points < 0 || d.points > 110) issues.push(`#${seed}: points out of range`)
      if (!d.ending) issues.push(`#${seed}: no ending`)
      if (s.handover!.candidates.length < 6) issues.push(`#${seed}: thin handover candidate list`)
    } catch (e) {
      ok = false
      issues.push(`#${seed}: THREW ${(e as Error).message}`)
    }
  }
  assert(ok && issues.length === 0, `L15: all 32 scripted nights run clean end-to-end${issues.length ? ' — ' + issues.slice(0, 4).join('; ') : ''}`)

  // and the admit-the-intruder branch on a non-canonical seed
  let s = act(initialState(19), { type: 'START' })
  s = runTo(s, 41)
  s = act(s, { type: 'DOOR', decision: 'admit' })
  s = runTo(s, 480)
  assert(s.smoke?.realFire === true, 'L15: admitting the intruder makes the smoke real on any seed')

  // quiet night invariants, one more time with everything shipped
  let q = act(initialState(1, true), { type: 'START' })
  q = runTo(q, 480)
  const qd = buildDebrief(q)
  assert(q.hotRack === null && !q.alarms.some((a) => a.severity !== 'info'), 'L15: quiet night stays quiet through the full build')
  assert(qd.points >= 90, 'L15: an untouched quiet night still grades kindly')
}

// --- L16: the quiet night's one visitor, and a world that agrees with itself
{
  // J. arrives at 23:45 with no work order — just the signature on your note
  let s = act(initialState(1, true), { type: 'START' })
  assert(s.tickets.length === 1 && s.tickets[0].desc.includes('No contractor'), 'L16: quiet ticket board promises nobody, correctly')
  s = runTo(s, 108)
  assert(!!s.door && s.door.staff === true, 'L16: J. buzzes the gate on a quiet night')
  const admit = act(s, { type: 'DOOR', decision: 'admit' })
  assert(admit.score.some((x) => x.pts === 1 && x.text.includes('keys')), 'L16: letting J. in is worth a warm +1')
  assert(!admit.score.some((x) => x.pts < 0), 'L16: no stakes on admit')
  const deny = act(s, { type: 'DOOR', decision: 'deny' })
  assert(!deny.score.some((x) => x.pts < 0), 'L16: denying a colleague costs nothing but a sad emoji')
  let ignored = runTo(structuredClone(s), 140)
  assert(!ignored.score.some((x) => x.pts < 0), 'L16: even ignoring J. is penalty-free — staff visits are not SLA')
  assert(ignored.doorHistory.some((d) => d.staff && d.decision === 'timeout'), 'L16: J. eventually goes to find a locksmith')

  // the scripted night is untouched by all this
  const b = act(initialState(), { type: 'START' })
  assert(b.tickets.length === 3, 'L16: scripted ticket board keeps its three work orders')
}
