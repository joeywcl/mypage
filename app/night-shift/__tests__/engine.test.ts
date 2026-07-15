// Liquid-loop (Hall B direct-to-chip) scenario tests.
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
