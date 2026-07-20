'use client'

// NIGHT SHIFT — the floor. Top-down torchlight segment: WASD/arrows to move,
// hold E at a faulted unit to reset it, walk back to the BMS room door to
// return to the console. The shift clock never pauses while you are out here.

import React, { useEffect, useRef } from 'react'
import { ROUND_CHECKPOINTS } from './engine'
import type { CracStatus, GameState } from './types'

const W = 768
const H = 512
const SPEED = 150 // px/s
const PLAYER_R = 7
const LIGHT_R = 130
const REACH = 64 // repair proximity, px from unit centre
const HOLD_S = 4 // seconds holding E to reset

interface Rect {
  x: number
  y: number
  w: number
  h: number
}

const RACK_ROWS: Rect[] = [
  ...[104, 184, 264, 344].map((y) => ({ x: 72, y, w: 232, h: 36 })),
  ...[104, 184, 264, 344].map((y) => ({ x: 464, y, w: 232, h: 36 })),
]

const CRAC_POS: Record<string, Rect> = {
  'CRAC-1': { x: 16, y: 408, w: 48, h: 48 },
  'CRAC-2': { x: 16, y: 24, w: 48, h: 48 },
  'CRAC-3': { x: 704, y: 408, w: 48, h: 48 },
  'CRAC-4': { x: 704, y: 24, w: 48, h: 48 },
}

const DOOR: Rect = { x: 344, y: 484, w: 80, h: 28 }
const CDU: Rect = { x: 620, y: 420, w: 44, h: 48 } // Hall B coolant distribution unit
const COFFEE: Rect = { x: 366, y: 14, w: 28, h: 32 } // in the BREAK ROOM — never the white space

// interior walls: the floor is rooms, not a warehouse. Center corridor with
// the break room at its top and the BMS room at its bottom; door gaps into
// each hall align with the halls' open ends so no squeeze-pixel corridors.
const WALLS: Rect[] = [
  { x: 320, y: 0, w: 8, h: 72 }, // Hall A wall, above its doorway
  { x: 320, y: 144, w: 8, h: 368 }, // Hall A wall, below its doorway
  { x: 440, y: 0, w: 8, h: 72 }, // Hall B wall, above its doorway
  { x: 440, y: 144, w: 8, h: 368 }, // Hall B wall, below its doorway
  { x: 328, y: 64, w: 36, h: 6 }, // break-room floor wall, left of its door
  { x: 404, y: 64, w: 36, h: 6 }, // break-room floor wall, right of its door
  { x: 328, y: 424, w: 28, h: 6 }, // BMS-room ceiling, left of its door
  { x: 412, y: 424, w: 28, h: 6 }, // BMS-room ceiling, right of its door
]
const OBSTACLES: Rect[] = [...RACK_ROWS, ...Object.values(CRAC_POS), CDU, COFFEE, ...WALLS]
const SMOKE_SPOT = { x: 120, y: 430 } // power panel in Hall A, bottom-left
const SMOKE_REACH = 80
const CDU_REACH = 64

const centre = (r: Rect) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 })

function hitsObstacle(x: number, y: number): boolean {
  if (x < PLAYER_R || x > W - PLAYER_R || y < PLAYER_R || y > H - PLAYER_R) return true
  for (const r of OBSTACLES) {
    if (
      x + PLAYER_R > r.x &&
      x - PLAYER_R < r.x + r.w &&
      y + PLAYER_R > r.y &&
      y - PLAYER_R < r.y + r.h
    )
      return true
  }
  return false
}

interface Props {
  s: GameState
  onRepair: (unit: string) => void
  onRepairPumps: () => void
  onFixCoffee: () => void
  onCheck: (unit: string) => void
  onReveal: () => void
  onRevealLeak: () => void
  onRevealRack: () => void
  onFixRackFan: () => void
  onReturn: () => void
  beep: (freq: number, ms: number, gain?: number) => void
  setTone: (id: string, freq: number, gain: number, type?: OscillatorType) => void
  stopTone: (id: string) => void
}

const CRICKET_SPOT = { x: 740, y: 250 } // right wall, gray space between the halls
const HOLD_CHECK_S = 2.5 // logging readings is quicker than swinging a breaker

export default function FloorGame({ s, onRepair, onRepairPumps, onFixCoffee, onCheck, onReveal, onRevealLeak, onRevealRack, onFixRackFan, onReturn, beep, setTone, stopTone }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const keys = useRef<Record<string, boolean>>({})
  const sRef = useRef(s)
  sRef.current = s

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    const player = { x: W / 2, y: 456 }
    let progress = 0
    let progressUnit: string | null = null
    let repaired = false // beep latch
    let done = false
    let cricketShy = false // approached once → silent for the night
    let lastChirp = 0
    let last = performance.now()
    const entered = last

    const onKey = (down: boolean) => (e: KeyboardEvent) => {
      const k = e.key.toLowerCase()
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' ', 'e', 'w', 'a', 's', 'd'].includes(k)) {
        keys.current[k] = down
        e.preventDefault()
      }
    }
    const kd = onKey(true)
    const ku = onKey(false)
    const onBlur = () => (keys.current = {})
    window.addEventListener('keydown', kd)
    window.addEventListener('keyup', ku)
    window.addEventListener('blur', onBlur)

    const frame = () => {
      if (done) return
      const now = performance.now()
      const dt = Math.min((now - last) / 1000, 0.1)
      last = now
      const st = sRef.current
      const k = keys.current

      // --- move (axis-separated so we slide along racks)
      let dx = (k.arrowright || k.d ? 1 : 0) - (k.arrowleft || k.a ? 1 : 0)
      let dy = (k.arrowdown || k.s ? 1 : 0) - (k.arrowup || k.w ? 1 : 0)
      if (dx && dy) {
        dx *= Math.SQRT1_2
        dy *= Math.SQRT1_2
      }
      const nx = player.x + dx * SPEED * dt
      const ny = player.y + dy * SPEED * dt
      if (!hitsObstacle(nx, player.y)) player.x = nx
      if (!hitsObstacle(player.x, ny)) player.y = ny

      // --- repair: any non-running CRAC within reach, or failed pumps at the CDU
      const near = st.cracs.find((c) => {
        if (c.status === 'running') return false
        const p = centre(CRAC_POS[c.id])
        return Math.hypot(player.x - p.x, player.y - p.y) < REACH
      })
      const cduC = centre(CDU)
      const nearCdu =
        Math.hypot(player.x - cduC.x, player.y - cduC.y) < CDU_REACH &&
        !st.liquid.loopLocked &&
        st.liquid.pumps.some((p) => p.status === 'failed')
      const coffeeC = centre(COFFEE)
      const nearCoffee = !st.coffeeFixed && Math.hypot(player.x - coffeeC.x, player.y - coffeeC.y) < REACH
      // quiet-mode rounds: any unvisited checkpoint within reach is a target
      // (only while a round is actually available — one an hour, four a night)
      let nearCheck: string | null = null
      if (st.night.quiet && st.rounds.count < 4 && st.t - st.rounds.lastAt >= 50) {
        for (const id of ROUND_CHECKPOINTS) {
          if (st.rounds.visited.includes(id)) continue
          const r = id === 'CDU' ? CDU : CRAC_POS[id]
          const p = centre(r)
          if (Math.hypot(player.x - p.x, player.y - p.y) < REACH) {
            nearCheck = id
            break
          }
        }
      }
      // the hot rack: close enough and you feel it on your skin — no console
      // required, no console possible
      const hr = st.hotRack
      let nearHotRack = false
      if (hr) {
        const rr = RACK_ROWS[hr.row]
        const rc = { x: rr.x + rr.w / 2, y: rr.y + rr.h / 2 }
        const d = Math.hypot(player.x - rc.x, player.y - rc.y)
        if (!hr.revealed && !hr.fixed && hr.temp > 34 && d < 95) {
          onRevealRack()
          beep(300, 250, 0.05)
        }
        nearHotRack = hr.revealed && !hr.fixed && d < 80
      }
      const targetId = near ? near.id : nearCdu ? 'CDU' : nearHotRack ? 'RACKFAN' : nearCoffee ? 'COFFEE' : nearCheck ? `CHECK:${nearCheck}` : null
      const holdFor = targetId?.startsWith('CHECK:') ? HOLD_CHECK_S : HOLD_S
      if (targetId && (k.e || k[' '])) {
        if (progressUnit !== targetId) {
          progressUnit = targetId
          progress = 0
        }
        progress += dt / holdFor
        if (progress >= 1) {
          if (targetId.startsWith('CHECK:')) onCheck(targetId.slice(6))
          else if (targetId === 'CDU') onRepairPumps()
          else if (targetId === 'RACKFAN') onFixRackFan()
          else if (targetId === 'COFFEE') onFixCoffee()
          else onRepair(targetId)
          if (!repaired) beep(targetId.startsWith('CHECK:') ? 520 : 660, 160)
          repaired = true
          progress = 0
          progressUnit = null
        }
      } else {
        progress = Math.max(0, progress - dt / holdFor)
        repaired = false
      }

      // --- the cricket: audible in the gray space until the rain starts.
      // It stops when you get close. Of course it does.
      if (st.night.quiet && !st.raining && st.t >= 22 && st.t < 75) {
        const d = Math.hypot(player.x - CRICKET_SPOT.x, player.y - CRICKET_SPOT.y)
        if (d < 55) cricketShy = true
        if (!cricketShy && now - lastChirp > 1400) {
          lastChirp = now
          const prox = Math.max(0.05, 1 - d / 420)
          beep(4400, 22, 0.012 * prox)
          setTimeout(() => beep(4400, 22, 0.012 * prox), 90)
        }
      }

      // --- bearing whine: the whiny pump is audible near the CDU while it
      // spins — pitch climbs as its failure approaches. Diegetic telemetry:
      // the console cannot hear this; you can.
      const whinyPump = st.liquid.pumps.find((p) => p.id === st.night.faultPump)
      const whineOn = !!whinyPump && whinyPump.status === 'running' && !st.liquid.bearingServiced
      if (whineOn) {
        const d = Math.hypot(player.x - cduC.x, player.y - cduC.y)
        const proximity = Math.max(0, 1 - d / 260)
        // failure lands at game-min 200: the last 40 minutes get audibly worse
        const distress = Math.max(0, Math.min(1, (st.t - 160) / 40))
        setTone('whine', 900 + 700 * distress, 0.028 * proximity * (0.4 + 0.6 * distress), 'sawtooth')
      } else {
        stopTone('whine')
      }

      // --- leak inspection: get close to the CDU and the rope tells its story
      const lk = st.liquid.leak
      if (lk && !lk.resolved && !lk.revealed && Math.hypot(player.x - cduC.x, player.y - cduC.y) < CDU_REACH + 16) {
        onRevealLeak()
        beep(300, 250, 0.05)
      }

      // --- smoke investigation: get close to the source and the truth is yours
      const sm = st.smoke
      if (sm && !sm.resolved && !sm.revealed && Math.hypot(player.x - SMOKE_SPOT.x, player.y - SMOKE_SPOT.y) < SMOKE_REACH) {
        onReveal()
        beep(300, 250, 0.05)
      }

      // --- back through the door → console
      if (
        now - entered > 1500 &&
        player.x > DOOR.x &&
        player.x < DOOR.x + DOOR.w &&
        player.y > DOOR.y - PLAYER_R
      ) {
        done = true // parent unmounts us; stop simulating meanwhile
        onReturn()
        return
      }

      draw(ctx, st, player, targetId, progress, now)
      ;(window as unknown as { __nsFloor?: { x: number; y: number } }).__nsFloor = { x: player.x, y: player.y }
    }
    // setInterval, not requestAnimationFrame: rAF freezes in hidden/background
    // tabs while the shift clock keeps running — 30 fps is plenty for this.
    const iv = setInterval(frame, 33)

    return () => {
      clearInterval(iv)
      window.removeEventListener('keydown', kd)
      window.removeEventListener('keyup', ku)
      window.removeEventListener('blur', onBlur)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const klaxon = s.alarms.some((a) => a.severity === 'critical' && !a.acked)
  const press = (key: string, down: boolean) => () => {
    keys.current[key] = down
  }
  const padBtn = (label: string, key: string) => (
    <button
      className="ns-btn"
      onPointerDown={press(key, true)}
      onPointerUp={press(key, false)}
      onPointerLeave={press(key, false)}
      onContextMenu={(e) => e.preventDefault()}
    >
      {label}
    </button>
  )

  return (
    <div className="ns-floorgame">
      <canvas ref={canvasRef} width={W} height={H} />
      <div className="ns-floor-hint">WASD / ARROWS — MOVE · HOLD E — RESET UNIT · EXIT VIA THE BMS ROOM DOOR</div>
      {klaxon && <div className="ns-klaxon">A KLAXON ECHOES SOMEWHERE IN THE DARK.</div>}
      <div className="ns-dpad">
        <span />
        {padBtn('▲', 'arrowup')}
        <span />
        {padBtn('◀', 'arrowleft')}
        {padBtn('▼', 'arrowdown')}
        {padBtn('▶', 'arrowright')}
      </div>
      <div className="ns-dpad-e">{padBtn('E', 'e')}</div>
    </div>
  )
}

// ---------------------------------------------------------------- render

const STATUS_COLOR: Record<CracStatus, string> = {
  running: 'rgba(76,240,122,0.9)',
  tripped: 'rgba(255,179,71,0.95)',
  failed: 'rgba(255,92,92,0.95)',
}

function draw(
  ctx: CanvasRenderingContext2D,
  st: GameState,
  player: { x: number; y: number },
  nearId: string | null,
  progress: number,
  now: number,
): void {
  // floor
  ctx.fillStyle = '#041008'
  ctx.fillRect(0, 0, W, H)
  ctx.strokeStyle = 'rgba(76,240,122,0.06)'
  ctx.lineWidth = 1
  for (let x = 0; x <= W; x += 32) {
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, H)
    ctx.stroke()
  }
  for (let y = 0; y <= H; y += 32) {
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(W, y)
    ctx.stroke()
  }

  // interior walls — the building has rooms, and doorways you actually use
  for (const wl of WALLS) {
    ctx.fillStyle = '#0a140c'
    ctx.fillRect(wl.x, wl.y, wl.w, wl.h)
    ctx.strokeStyle = 'rgba(130,160,140,0.35)'
    ctx.strokeRect(wl.x + 0.5, wl.y + 0.5, wl.w, wl.h)
  }

  // hall + room labels
  ctx.fillStyle = 'rgba(76,240,122,0.10)'
  ctx.font = '700 26px ui-monospace, monospace'
  ctx.fillText('HALL A', 130, 78)
  ctx.fillText('HALL B', 540, 78)
  ctx.font = '700 11px ui-monospace, monospace'
  ctx.fillStyle = 'rgba(255,179,71,0.28)'
  ctx.fillText('BREAK ROOM', 342, 58)
  ctx.fillText('BMS', 372, 444)
  ctx.fillStyle = 'rgba(76,240,122,0.14)'
  ctx.fillText('CORRIDOR', 358, 250)

  // racks — tinted by the TRUE hall temperature (the floor never lies).
  // Hot rows glow amber→red; dead rows go dark: shut-down servers make no light.
  for (let i = 0; i < RACK_ROWS.length; i++) {
    const r = RACK_ROWS[i]
    const z = i < 4 ? st.zones[0] : st.zones[1]
    const gpuDark = i >= 4 && !st.liquid.gpuRunning
    const dead = z.serversDown || z.epo || z.fire || gpuDark
    let heat = Math.max(0, Math.min(1, (z.temp - 28) / 14))
    if (i >= 4) heat = Math.max(heat, Math.min(1, (st.liquid.tj - 88) / 17))
    // the hot rack: this one row burns on ITS temperature, not the room's —
    // the only place in the facility where the truth is per-row
    if (st.hotRack && i === st.hotRack.row) heat = Math.max(heat, Math.min(1, (st.hotRack.temp - 28) / 14))
    if (dead) {
      ctx.fillStyle = '#020503'
      ctx.fillRect(r.x, r.y, r.w, r.h)
      ctx.strokeStyle = 'rgba(130,140,130,0.18)'
      ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w, r.h)
      continue
    }
    // lerp green → amber → red with heat
    const cr = Math.round(76 + heat * (255 - 76))
    const cg = Math.round(240 - heat * (240 - 110))
    const cb = Math.round(122 - heat * (122 - 60))
    if (heat > 0.05) {
      ctx.fillStyle = `rgba(255,70,40,${(heat * 0.22).toFixed(3)})`
      ctx.fillRect(r.x - 4, r.y - 4, r.w + 8, r.h + 8)
    }
    ctx.fillStyle = '#06180c'
    ctx.fillRect(r.x, r.y, r.w, r.h)
    ctx.strokeStyle = `rgba(${cr},${cg},${cb},${0.28 + heat * 0.5})`
    ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w, r.h)
    for (let x = r.x + 29; x < r.x + r.w; x += 29) {
      ctx.beginPath()
      ctx.moveTo(x, r.y)
      ctx.lineTo(x, r.y + r.h)
      ctx.stroke()
    }
  }

  // a burning hall flickers orange through everything
  for (const z of st.zones) {
    if (!z.fire) continue
    const x0 = z.id === 'A' ? 0 : W / 2
    ctx.fillStyle = `rgba(255,120,30,${(0.06 + 0.05 * Math.sin(now / 90)).toFixed(3)})`
    ctx.fillRect(x0, 0, W / 2, H)
  }

  // CRAC units
  ctx.font = '10px ui-monospace, monospace'
  for (const c of st.cracs) {
    const r = CRAC_POS[c.id]
    ctx.fillStyle = '#06180c'
    ctx.fillRect(r.x, r.y, r.w, r.h)
    ctx.strokeStyle = STATUS_COLOR[c.status]
    ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w, r.h)
    ctx.fillStyle = STATUS_COLOR[c.status]
    ctx.fillText(c.id.replace('CRAC-', 'C'), r.x + 4, r.y + 13)
  }

  // CDU (liquid loop plant, Hall B)
  const anyPumpFailed = st.liquid.pumps.some((p) => p.status === 'failed')
  ctx.fillStyle = '#06180c'
  ctx.fillRect(CDU.x, CDU.y, CDU.w, CDU.h)
  ctx.strokeStyle = anyPumpFailed ? 'rgba(255,92,92,0.95)' : 'rgba(102,204,255,0.7)'
  ctx.strokeRect(CDU.x + 0.5, CDU.y + 0.5, CDU.w, CDU.h)
  ctx.fillStyle = anyPumpFailed ? 'rgba(255,92,92,0.95)' : 'rgba(102,204,255,0.7)'
  ctx.font = '10px ui-monospace, monospace'
  ctx.fillText('CDU', CDU.x + 10, CDU.y + 13)

  // coffee machine (break-room corner) — broken until someone shows it love
  ctx.fillStyle = '#140d04'
  ctx.fillRect(COFFEE.x, COFFEE.y, COFFEE.w, COFFEE.h)
  ctx.strokeStyle = st.coffeeFixed ? 'rgba(76,240,122,0.8)' : 'rgba(255,179,71,0.55)'
  ctx.strokeRect(COFFEE.x + 0.5, COFFEE.y + 0.5, COFFEE.w, COFFEE.h)
  ctx.fillStyle = st.coffeeFixed ? 'rgba(76,240,122,0.8)' : 'rgba(255,179,71,0.55)'
  ctx.font = '9px ui-monospace, monospace'
  ctx.fillText(st.coffeeFixed ? '☕' : '✕☕', COFFEE.x + 5, COFFEE.y + 20)

  // door
  ctx.strokeStyle = 'rgba(255,179,71,0.9)'
  ctx.strokeRect(DOOR.x + 0.5, DOOR.y + 0.5, DOOR.w, DOOR.h)
  ctx.fillStyle = 'rgba(255,179,71,0.9)'
  ctx.font = '10px ui-monospace, monospace'
  ctx.fillText('BMS ROOM', DOOR.x + 14, DOOR.y + 18)

  // player
  ctx.fillStyle = '#4cf07a'
  ctx.beginPath()
  ctx.arc(player.x, player.y, PLAYER_R, 0, Math.PI * 2)
  ctx.fill()

  // darkness + torch
  const g = ctx.createRadialGradient(player.x, player.y, LIGHT_R * 0.25, player.x, player.y, LIGHT_R * 1.9)
  g.addColorStop(0, 'rgba(0,0,0,0)')
  g.addColorStop(0.45, 'rgba(0,0,0,0.55)')
  g.addColorStop(1, 'rgba(0,0,0,0.955)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)

  // fault LEDs punch through the dark
  for (const c of st.cracs) {
    if (c.status === 'running') continue
    const p = centre(CRAC_POS[c.id])
    const pulse = 0.45 + 0.4 * Math.sin(now / 160)
    ctx.fillStyle = c.status === 'failed' ? `rgba(255,92,92,${pulse})` : `rgba(255,179,71,${pulse})`
    ctx.beginPath()
    ctx.arc(p.x, p.y, 4, 0, Math.PI * 2)
    ctx.fill()
  }

  // failed-pump LED at the CDU punches through the dark
  if (st.liquid.pumps.some((p) => p.status === 'failed')) {
    const c = centre(CDU)
    const pulse = 0.45 + 0.4 * Math.sin(now / 160)
    ctx.fillStyle = `rgba(255,92,92,${pulse})`
    ctx.beginPath()
    ctx.arc(c.x, c.y, 4, 0, Math.PI * 2)
    ctx.fill()
  }

  // leak puddle shimmer under the CDU when the rope is wet, within torch range
  const lk = st.liquid.leak
  if (lk && !lk.resolved) {
    const c = centre(CDU)
    const d = Math.hypot(player.x - c.x, player.y - c.y)
    if (d < LIGHT_R * 1.4) {
      const a = Math.max(0, 0.4 - d / (LIGHT_R * 3.5)) * (0.7 + 0.3 * Math.sin(now / 250))
      ctx.fillStyle = `rgba(102,204,255,${a})`
      ctx.beginPath()
      ctx.ellipse(c.x - 6, CDU.y + CDU.h + 8, 20, 6, 0, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  // smoke haze near the source, only within torch range
  const sm = st.smoke
  if (sm && !sm.resolved) {
    const d = Math.hypot(player.x - SMOKE_SPOT.x, player.y - SMOKE_SPOT.y)
    if (d < LIGHT_R * 1.6) {
      const a = Math.max(0, 0.5 - d / (LIGHT_R * 3.2))
      for (let i = 0; i < 3; i++) {
        const r = 18 + i * 14 + 4 * Math.sin(now / 300 + i)
        ctx.fillStyle = `rgba(180,180,180,${(a * (3 - i)) / 6})`
        ctx.beginPath()
        ctx.arc(SMOKE_SPOT.x + 6 * Math.sin(now / 400 + i * 2), SMOKE_SPOT.y - i * 12, r, 0, Math.PI * 2)
        ctx.fill()
      }
    }
  }

  // HUD
  const faulted = st.cracs.filter((c) => c.status !== 'running')
  ctx.fillStyle = 'rgba(76,240,122,0.85)'
  ctx.font = '12px ui-monospace, monospace'
  const failedPumps = st.liquid.pumps.filter((p) => p.status === 'failed')
  const roundOpen = st.night.quiet && st.rounds.count < 4 && st.t - st.rounds.lastAt >= 50
  const objective = st.night.quiet
    ? roundOpen
      ? `ROUND ${st.rounds.count + 1}/4 · READINGS LOGGED ${st.rounds.visited.length}/5 — HOLD E AT EACH UNIT`
      : st.rounds.count >= 4
        ? 'ROUNDS COMPLETE — THE FLOOR IS YOURS'
        : `NEXT ROUND OPENS SOON — ENJOY THE ${st.raining ? 'RAIN' : 'QUIET'}`
    : lk && !lk.resolved && !lk.revealed
      ? 'LEAK ROPE WET — INSPECT THE CDU (HALL B, BOTTOM AISLE)'
      : sm && !sm.resolved && !sm.revealed
        ? 'VESDA REPORTS SMOKE NEAR THE HALL A POWER PANEL (BOTTOM-LEFT)'
        : st.hotRack?.revealed && !st.hotRack.fixed
          ? 'HOT RACK — ROW A3 NEEDS A FAN TRAY (HOLD E AT THE ROW)'
          : faulted.length === 0 && failedPumps.length === 0
            ? 'ALL PLANT RUNNING — RETURN TO THE BMS ROOM'
            : `FAULTED: ${[...faulted.map((c) => c.id), ...failedPumps.map((p) => `${p.id} (CDU)`)].join(', ')}`
  ctx.fillText(objective, 12, 18)

  // quiet rounds: a small tick over every checkpoint already logged this round
  if (st.night.quiet && roundOpen) {
    ctx.fillStyle = 'rgba(76,240,122,0.9)'
    ctx.font = '11px ui-monospace, monospace'
    for (const id of st.rounds.visited) {
      const r = id === 'CDU' ? CDU : CRAC_POS[id]
      ctx.fillText('✓', r.x + r.w - 12, r.y + 12)
    }
  }

  // quiet mode: telemetry lives in the space — walk up to a unit and read its
  // local gauge plate, like the clipboard rounds the job is actually made of
  if (st.night.quiet) {
    for (const id of ROUND_CHECKPOINTS) {
      const r = id === 'CDU' ? CDU : CRAC_POS[id]
      const p = centre(r)
      if (Math.hypot(player.x - p.x, player.y - p.y) > REACH + 24) continue
      const z = id === 'CRAC-1' || id === 'CRAC-2' ? st.zones[0] : st.zones[1]
      const lines =
        id === 'CDU'
          ? [`FLOW ${st.liquid.flow}%`, `P1 ${st.liquid.pumps[0].status.toUpperCase()} · P2 ${st.liquid.pumps[1].status.toUpperCase()}`]
          : [`SUP 14.1° · RET ${z.temp.toFixed(1)}°`, 'FAN OK · FILTER OK']
      // beside the unit, not above it — the HOLD E prompt owns the space above
      const bx = r.x < W / 2 ? Math.min(W - 130, r.x + r.w + 10) : Math.max(6, r.x - 134)
      const by = Math.max(6, Math.min(H - 32, p.y - 13))
      ctx.fillStyle = 'rgba(2,8,4,0.92)'
      ctx.fillRect(bx, by, 124, 26)
      ctx.strokeStyle = 'rgba(102,204,255,0.55)'
      ctx.strokeRect(bx + 0.5, by + 0.5, 124, 26)
      ctx.fillStyle = 'rgba(102,204,255,0.9)'
      ctx.font = '9px ui-monospace, monospace'
      ctx.fillText(lines[0], bx + 6, by + 10)
      ctx.fillText(lines[1], bx + 6, by + 21)
    }
  }

  // the one thing the floor gives you that the console can't: ground truth
  const hall = player.x < 320 ? st.zones[0] : player.x > 448 ? st.zones[1] : null
  if (hall) {
    const feel =
      hall.temp >= 42 ? 'AIR: SCORCHING' : hall.temp >= 36 ? 'AIR: HOT' : hall.temp >= 30 ? 'AIR: WARM' : 'AIR: NORMAL'
    ctx.fillStyle =
      hall.temp >= 36 ? 'rgba(255,92,92,0.9)' : hall.temp >= 30 ? 'rgba(255,179,71,0.9)' : 'rgba(76,240,122,0.7)'
    ctx.fillText(`HALL ${hall.id} · ${feel}`, 12, H - 12)
  }

  // repair prompt + progress
  if (nearId) {
    const isCheck = nearId.startsWith('CHECK:')
    const unitId = isCheck ? nearId.slice(6) : nearId
    const r =
      unitId === 'CDU' ? CDU
      : unitId === 'COFFEE' ? COFFEE
      : unitId === 'RACKFAN' ? RACK_ROWS[st.hotRack?.row ?? 2]
      : CRAC_POS[unitId]
    const p = centre(r)
    ctx.fillStyle = 'rgba(255,179,71,0.95)'
    ctx.font = '11px ui-monospace, monospace'
    const label =
      isCheck ? 'HOLD E — LOG READINGS'
      : nearId === 'RACKFAN' ? 'HOLD E — SWAP FAN TRAY'
      : nearId === 'COFFEE' ? 'HOLD E — PERCUSSIVE MAINTENANCE'
      : 'HOLD E — MANUAL RESET'
    const tx = Math.max(8, Math.min(W - 150, p.x - 70))
    ctx.fillText(label, tx, p.y + (p.y < H / 2 ? 44 : -36))
    if (progress > 0) {
      const bx = Math.max(8, Math.min(W - 108, p.x - 50))
      const by = p.y + (p.y < H / 2 ? 52 : -30)
      ctx.strokeStyle = 'rgba(255,179,71,0.9)'
      ctx.strokeRect(bx, by, 100, 7)
      ctx.fillRect(bx, by, 100 * Math.min(1, progress), 7)
    }
  }
}
