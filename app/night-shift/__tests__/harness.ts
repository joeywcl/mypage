// Shared harness for NIGHT SHIFT engine tests: drive the pure reducer with
// synthetic ticks (1 tick = 2 game minutes) and assert on resulting state.
import { initialState, reducer } from '../engine'
import type { Action, GameState } from '../types'

export function runTo(s: GameState, t: number): GameState {
  while (s.t < t && s.phase === 'playing') s = reducer(s, { type: 'TICK', dt: 1 })
  return s
}

export function act(s: GameState, a: Action): GameState {
  return reducer(s, a)
}

let failures = 0
export function assert(cond: boolean, msg: string): void {
  if (!cond) {
    failures++
    console.error('FAIL:', msg)
    process.exitCode = 1
  } else {
    console.log('ok  :', msg)
  }
}

export function summary(suite: string): void {
  console.log(failures === 0 ? `${suite}: all green` : `${suite}: ${failures} FAILURES`)
}

export { initialState }
