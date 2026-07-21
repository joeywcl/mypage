'use client'

import React, { useEffect, useReducer, useRef, useState } from 'react'
import './night-shift.css'
import { buildDebrief, clockLabel, consensusTemp, initialState, NIGHT_SEEDS, reducer, SHIFT_END } from './engine'
import { EOPS } from './eops'
import FloorGame from './FloorGame'
import type { Action, Alarm, AssistRec, DoorRequest, GameState, NightPlan, Zone, ZoneId } from './types'

// ---------------------------------------------------------------- trend

function trendInfo(z: Zone): { label: string; level: '' | 'warn' | 'crit' } {
  const h = z.history
  if (h.length < 4) return { label: 'TREND: —', level: '' }
  const cur = h[h.length - 1]
  const slope = (cur - h[h.length - 4]) / 6 // °C per game-minute (samples 2 min apart)
  if (slope < 0.08) return { label: 'TREND: STABLE', level: '' }
  // TTB = time-to-breach: the console's estimate of minutes until a threshold.
  // Computed from sensor readings — only as honest as the sensor feeding it.
  const eta = (th: number) => Math.max(1, Math.round((th - cur) / slope))
  if (cur < 38)
    return { label: `TREND +${slope.toFixed(1)}°/min · TTB 38° ~${eta(38)}m · 42° ~${eta(42)}m`, level: 'warn' }
  return { label: `TREND +${slope.toFixed(1)}°/min · TTB SHUTDOWN 42° ~${eta(42)}m`, level: 'crit' }
}

function Sparkline({
  history,
  lo = 20,
  hi = 46,
  crit = 38,
}: {
  history: number[]
  lo?: number
  hi?: number
  crit?: number
}) {
  const w = 140
  const h = 26
  const pts = history.slice(-30)
  if (pts.length < 2) return <svg width={w} height={h} className="ns-spark" />
  const x = (i: number) => (i / (pts.length - 1)) * (w - 2) + 1
  const y = (v: number) => h - 2 - (Math.max(lo, Math.min(hi, v)) - lo) * ((h - 4) / (hi - lo))
  const d = pts.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
  return (
    <svg width={w} height={h} className="ns-spark" aria-hidden>
      <line x1={0} x2={w} y1={y(crit)} y2={y(crit)} className="ns-spark-crit" />
      <polyline points={d} fill="none" />
    </svg>
  )
}

// Tj moves fast (1-min samples): slope over the last 3 minutes
function tjTrend(L: { tjHistory: number[] }): { label: string; level: '' | 'warn' | 'crit' } {
  const h = L.tjHistory
  if (h.length < 4) return { label: 'TREND: —', level: '' }
  const cur = h[h.length - 1]
  const slope = (cur - h[h.length - 4]) / 3
  if (slope < 0.15) return { label: 'TREND: STABLE', level: '' }
  const eta = (th: number) => Math.max(1, Math.round((th - cur) / slope))
  if (cur < 95) return { label: `TREND +${slope.toFixed(1)}°/min · TTB THROTTLE 95° ~${eta(95)}m · TRIP 105° ~${eta(105)}m`, level: 'warn' }
  return { label: `TREND +${slope.toFixed(1)}°/min · TTB TRIP 105° ~${eta(105)}m`, level: 'crit' }
}

// ---------------------------------------------------------------- sound

function useBeeper(muted: boolean) {
  const ctxRef = useRef<AudioContext | null>(null)
  const ensure = () => {
    if (!ctxRef.current && typeof window !== 'undefined') {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (AC) ctxRef.current = new AC()
    }
    return ctxRef.current
  }
  const beep = (freq: number, ms: number, gain = 0.04) => {
    if (muted) return
    const ctx = ensure()
    if (!ctx) return
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.type = 'square'
    osc.frequency.value = freq
    g.gain.value = gain
    osc.connect(g).connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + ms / 1000)
  }
  // sustained tones (floor hum, bearing whine): keyed oscillators that live
  // until stopped. setTone re-tunes in place — no click, no re-trigger.
  const tonesRef = useRef<Map<string, { osc: OscillatorNode; g: GainNode }>>(new Map())
  const mutedRef = useRef(muted)
  mutedRef.current = muted
  const setTone = (id: string, freq: number, gain: number, type: OscillatorType = 'sine') => {
    const ctx = ensure()
    if (!ctx) return
    const effGain = mutedRef.current ? 0 : gain
    const existing = tonesRef.current.get(id)
    if (existing) {
      existing.osc.frequency.setTargetAtTime(freq, ctx.currentTime, 0.05)
      existing.g.gain.setTargetAtTime(effGain, ctx.currentTime, 0.08)
      return
    }
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.type = type
    osc.frequency.value = freq
    g.gain.value = 0
    g.gain.setTargetAtTime(effGain, ctx.currentTime, 0.15)
    osc.connect(g).connect(ctx.destination)
    osc.start()
    tonesRef.current.set(id, { osc, g })
  }
  const stopTone = (id: string) => {
    const ctx = ctxRef.current
    const t = tonesRef.current.get(id)
    if (!t || !ctx) return
    t.g.gain.setTargetAtTime(0, ctx.currentTime, 0.08)
    const osc = t.osc
    setTimeout(() => { try { osc.stop() } catch {} }, 400)
    tonesRef.current.delete(id)
  }
  const stopAllTones = () => { Array.from(tonesRef.current.keys()).forEach(stopTone) }
  // looped filtered noise (rain on the roof) — one shared buffer, keyed like tones
  const noiseRef = useRef<{ src: AudioBufferSourceNode; g: GainNode } | null>(null)
  const setRain = (gain: number) => {
    const ctx = ensure()
    if (!ctx) return
    const effGain = mutedRef.current ? 0 : gain
    if (noiseRef.current) {
      noiseRef.current.g.gain.setTargetAtTime(effGain, ctx.currentTime, 0.5)
      return
    }
    const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
    const src = ctx.createBufferSource()
    src.buffer = buf
    src.loop = true
    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 1100
    const g = ctx.createGain()
    g.gain.value = 0
    g.gain.setTargetAtTime(effGain, ctx.currentTime, 1.2) // rain fades in like rain
    src.connect(filter).connect(g).connect(ctx.destination)
    src.start()
    noiseRef.current = { src, g }
  }
  const stopRain = () => {
    const ctx = ctxRef.current
    if (!noiseRef.current || !ctx) return
    noiseRef.current.g.gain.setTargetAtTime(0, ctx.currentTime, 1.5)
    const src = noiseRef.current.src
    setTimeout(() => { try { src.stop() } catch {} }, 4000)
    noiseRef.current = null
  }
  return { beep, ensure, setTone, stopTone, stopAllTones, setRain, stopRain }
}

// ---------------------------------------------------------------- pieces

function AlarmRow({ a, onAck, onEop }: { a: Alarm; onAck: () => void; onEop: () => void }) {
  return (
    <div className={`ns-alarm ${a.severity}${a.acked ? ' acked' : ''}`}>
      <span className="ns-alarm-time">{clockLabel(a.time)}</span>
      <span className="ns-alarm-text">{a.text}</span>
      {a.eop && (
        <button className="ns-btn" title="Open the procedure for this alarm" onClick={onEop}>{a.eop}</button>
      )}
      {!a.acked && a.severity !== 'info' && (
        <button className="ns-btn" onClick={onAck}>ACK</button>
      )}
    </div>
  )
}

// The in-game manual: a real facility's emergency procedure, doubling as the
// tutorial. Steps check themselves off live against game state.
function EopDrawer({
  s,
  eopId,
  alarmId,
  onClose,
}: {
  s: GameState
  eopId: string
  alarmId: number
  onClose: () => void
}) {
  const eop = EOPS[eopId]
  const alarm = s.alarms.find((a) => a.id === alarmId)
  if (!eop) return null
  return (
    <div className="ns-eop">
      <div className="ns-eop-head">
        <span>{eop.id} · {eop.title}</span>
        <button className="ns-btn" onClick={onClose}>CLOSE</button>
      </div>
      <div className="ns-eop-why">{eop.why}</div>
      <ol className="ns-eop-steps">
        {eop.steps.map((st, i) => {
          const checkable = !!st.done && !!alarm
          const done = checkable && alarm && st.done!(s, alarm)
          return (
            <li key={i} className={done ? 'done' : ''}>
              <span className="ns-eop-mark">{checkable ? (done ? '✓' : '○') : '—'}</span>
              {st.text}
            </li>
          )
        })}
      </ol>
      <div className="ns-eop-foot">The procedure gives you the steps. The judgment is still yours.</div>
    </div>
  )
}

function ZoneCard({
  s,
  z,
  hints,
  onRemote,
  onWalk,
  onIsolate,
}: {
  s: GameState
  z: Zone
  hints: boolean
  onRemote: (id: string) => void
  onWalk: (id: string) => void
  onIsolate: (zone: ZoneId, idx: 0 | 1) => void
}) {
  // the console only knows what the sensors say — never the true temperature
  const believed = consensusTemp(z)
  const shown = believed ?? Math.max(...z.readings)
  const level = shown >= 38 ? 'crit' : shown >= 33 ? 'warn' : ''
  const pct = Math.max(0, Math.min(100, ((shown - 20) / 25) * 100))
  const status = z.fire
    ? 'FIRE'
    : z.epo
      ? 'EPO — HALL DOWN'
      : z.serversDown
        ? `OFFLINE — ${z.racks} RACKS DOWN`
        : believed === null
          ? 'NO SENSOR DATA'
          : shown >= 38
            ? 'CRITICAL (SENSOR)'
            : shown >= 33
              ? 'ELEVATED'
              : 'NOMINAL'
  const atConsole = s.operator.kind === 'console'
  const divergent = Math.abs(z.readings[0] - z.readings[1]) > 3
  const trend = trendInfo(z)
  return (
    <div className="ns-zone">
      <div className="ns-panel-title">{z.name}</div>
      <div className="ns-panel-body">
        <div className="ns-zone-top">
          <span className={`ns-temp ${level}`}>{shown.toFixed(1)}°C</span>
          <Sparkline history={z.history} />
          <span className={`ns-zone-status ${level === 'crit' || z.fire ? 'ns-neg' : ''}`}>{status}</span>
        </div>
        <div className={`ns-tempbar ${level}`}><div style={{ width: `${pct}%` }} /></div>
        <div className={`ns-trend ${trend.level}`}>{trend.label}</div>
        <div className={`ns-sensors${divergent ? ' divergent' : ''}`}>
          {z.readings.map((r, i) => {
            const sen = z.sensors[i]
            return (
              <span key={i} className={`ns-sensor${sen.isolated ? ' isolated' : ''}`}>
                S{i + 1} {r.toFixed(1)}°
                <button className="ns-btn" onClick={() => onIsolate(z.id, i as 0 | 1)}>
                  {sen.isolated ? 'RESTORE' : 'ISO'}
                </button>
              </span>
            )
          })}
          {divergent && <span className="ns-sensor-warn">SENSORS DISAGREE</span>}
        </div>
        {hints && (
          <div className="ns-help">
            Two sensors, same air — 3°+ apart means one is lying. ISO removes a sensor from alarms and trends: isolate the liar, never the honest one. Unsure? Walk the floor and feel the air.
          </div>
        )}
        <div className="ns-crac-row">
          {s.cracs
            .filter((c) => c.zone === z.id)
            .map((c) => (
              <span key={c.id} className={`ns-crac ${c.status}`}>
                {c.id} · {c.status.toUpperCase()}
                {c.status === 'tripped' && (
                  <button className="ns-btn amber" onClick={() => onRemote(c.id)}>RMT RESET</button>
                )}
                {c.status !== 'running' && (
                  <button className="ns-btn red" disabled={!atConsole} onClick={() => onWalk(c.id)}>
                    GO ON-SITE
                  </button>
                )}
              </span>
            ))}
        </div>
        {hints && (
          <div className="ns-help">
            A CRAC is this hall&rsquo;s air conditioner. TRIPPED = electrical hiccup, RMT RESET fixes it from here. HARD FAULT = GO ON-SITE — and out on the floor you can&rsquo;t see this console.
          </div>
        )}
      </div>
    </div>
  )
}

function LiquidPanel({
  s,
  hints,
  dispatch,
}: {
  s: GameState
  hints: boolean
  dispatch: React.Dispatch<Action>
}) {
  const L = s.liquid
  const trend = tjTrend(L)
  const tjLevel = L.tj >= 95 ? 'crit' : L.tj >= 88 ? 'warn' : ''
  const effLoad = L.shed ? 40 : L.load
  return (
    <div className="ns-zone">
      <div className="ns-panel-title">HALL B · LIQUID LOOP · DIRECT-TO-CHIP</div>
      <div className="ns-panel-body">
        <div className="ns-zone-top">
          <span className={`ns-temp ${tjLevel}`}>Tj {L.tj.toFixed(1)}°</span>
          <span className={`ns-temp ${L.memT >= 88 ? 'crit' : L.memT >= 80 ? 'warn' : ''}`}>MEM {L.memT.toFixed(1)}°</span>
          <Sparkline history={L.tjHistory} lo={40} hi={110} crit={95} />
          <span className={`ns-zone-status ${L.loopLocked || !L.gpuRunning ? 'ns-neg' : ''}`}>
            {L.loopLocked ? 'LOOP CONTAMINATED' : !L.gpuRunning ? 'FLEET STOPPED' : L.tj >= 95 ? 'THROTTLING (Tj)' : L.memT >= 88 ? 'THROTTLING (MEM)' : 'NOMINAL'}
          </span>
        </div>
        <div className={`ns-trend ${trend.level}`}>{trend.label}</div>
        <div className="ns-liquid-row">
          <span>FLOW {L.flow}%</span>
          {L.pumps.map((p) => (
            <span key={p.id} className={`ns-crac ${p.status === 'failed' ? 'failed' : p.status === 'tripped' ? 'tripped' : ''}`}>
              {p.id} · {p.status.toUpperCase()}
              {p.status === 'tripped' && (
                <button className="ns-btn amber" onClick={() => dispatch({ type: 'RESTART_PUMP', pump: p.id })}>RMT RESET</button>
              )}
            </span>
          ))}
          {L.pumps.some((p) => p.status === 'failed') && !L.loopLocked && (
            <span className="ns-sensor-warn">SERVICE AT CDU (ON-SITE)</span>
          )}
        </div>
        <div className="ns-liquid-row">
          <span title="Share of GPU heat leaving via the liquid loop vs hall air — the hybrid hall's headline balance number">
            HEAT SPLIT · LIQ {L.gpuRunning ? Math.round(86 * (L.flow / 100)) : 0}% / AIR {L.gpuRunning ? 100 - Math.round(86 * (L.flow / 100)) : 0}%
          </span>
        </div>
        <div className="ns-liquid-row">
          <span>GPU LOAD {effLoad}%</span>
          {L.shed ? (
            <button className="ns-btn" onClick={() => dispatch({ type: 'RESTORE_LOAD' })}>RESTORE LOAD</button>
          ) : (
            <button className="ns-btn amber" onClick={() => dispatch({ type: 'SHED_LOAD' })}>SHED LOAD</button>
          )}
          {L.gpuRunning ? (
            <button className="ns-btn red" onClick={() => dispatch({ type: 'GPU_STOP' })}>E-STOP FLEET</button>
          ) : (
            <button className="ns-btn" disabled={L.loopLocked} onClick={() => dispatch({ type: 'GPU_START' })}>START FLEET</button>
          )}
        </div>
        {hints && (
          <div className="ns-help">
            These racks are hybrid. The die is liquid-cooled: no flow and Tj races in minutes. MEMORY still rides hall air: lose Hall B&rsquo;s CRACs and MEM creeps toward 88° on a slower clock — different path, different fix. TTB on any trend = time-to-breach, the console&rsquo;s countdown estimate. SHED LOAD buys time on both paths; E-STOP is a controlled stop (downtime, no damage). Letting physics trip the fleet at 105° costs downtime AND silicon.
          </div>
        )}
      </div>
    </div>
  )
}

function LeakPanel({
  s,
  onShut,
  onDismiss,
}: {
  s: GameState
  onShut: () => void
  onDismiss: () => void
}) {
  const lk = s.liquid.leak
  if (!lk || lk.resolved || lk.dismissed) return null
  const waited = Math.floor(s.t - lk.raisedAt)
  return (
    <div className="ns-panel ns-smoke">
      <div className="ns-panel-title">LEAK DETECTION · CDU ROPE SENSOR</div>
      <div className="ns-panel-body">
        <div className="ns-smoke-head">ROPE WET — HALL B CDU · {waited} MIN AGO</div>
        <div className="ns-smoke-sub">
          {lk.revealed
            ? lk.real
              ? 'VERIFIED IN PERSON: COOLANT AT THE P1 FITTING. REAL LEAK.'
              : 'VERIFIED IN PERSON: CONDENSATION OFF THE CASING. FITTINGS DRY.'
            : 'Condensation is common. Coolant on a busbar is not. Verify at the CDU, or act on the rope alone.'}
        </div>
        <div className="ns-door-row">
          <button className="ns-btn big red" onClick={onShut}>SHUT LOOP + STOP GPUS</button>
          <button className="ns-btn big amber" onClick={onDismiss}>DISMISS AS CONDENSATION</button>
        </div>
        <div className="ns-smoke-note">Shutting the loop takes the GPU fleet down. Ignoring a real leak takes much more.</div>
      </div>
    </div>
  )
}

function SmokePanel({
  s,
  onSuppress,
  onDismiss,
}: {
  s: GameState
  onSuppress: () => void
  onDismiss: () => void
}) {
  const sm = s.smoke
  if (!sm || sm.resolved || sm.dismissed) return null
  const waited = Math.floor(s.t - sm.raisedAt)
  return (
    <div className="ns-panel ns-smoke">
      <div className="ns-panel-title">VESDA · EARLY SMOKE DETECTION</div>
      <div className="ns-panel-body">
        <div className="ns-smoke-head">PRE-ALARM — HALL {sm.zone} · {waited} MIN AGO</div>
        <div className="ns-smoke-sub">
          {sm.revealed
            ? sm.realFire
              ? 'VERIFIED IN PERSON: SMOKE IS REAL.'
              : 'VERIFIED IN PERSON: DUST HAZE, NO COMBUSTION.'
            : 'Unverified. Walk the floor to eyeball it, or act on the panel alone.'}
        </div>
        <div className="ns-door-row">
          <button className="ns-btn big red" onClick={onSuppress}>DISCHARGE + EPO</button>
          <button className="ns-btn big amber" onClick={onDismiss}>DISMISS AS FALSE</button>
        </div>
        <div className="ns-smoke-note">Discharge kills Hall {sm.zone} for the night. A missed real fire kills much more.</div>
      </div>
    </div>
  )
}

function DoorPanel({ s, d, onDecide }: { s: GameState; d: DoorRequest | null; onDecide: (x: 'admit' | 'deny') => void }) {
  return (
    <div className="ns-panel" id="ns-gate">
      <div className="ns-panel-title">GATE · CAM-01 + INTERCOM</div>
      <div className="ns-panel-body">
        {!d ? (
          <div className="ns-door-idle">— NO ONE AT THE GATE —</div>
        ) : (
          <div className="ns-door-cam">
            <dl className="ns-kv">
              <dt>VISITOR</dt><dd>{d.name}</dd>
              <dt>COMPANY</dt><dd>{d.company}</dd>
              <dt>CLAIMS</dt><dd>&ldquo;{d.claim}&rdquo;</dd>
              <dt>WORK ORDER</dt><dd className="ns-wo">{d.workOrder}</dd>
              <dt>WAITING</dt><dd>{Math.floor(s.t - d.arrivedAt)} min</dd>
            </dl>
            <div className="ns-door-row">
              <button className="ns-btn big" onClick={() => onDecide('admit')}>ADMIT</button>
              <button className="ns-btn big red" onClick={() => onDecide('deny')}>DENY</button>
            </div>
            <div className="ns-help">Compare their work order against tonight&rsquo;s ticket list. Similar is not the same. No match, no entry — whatever they claim.</div>
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- ASSIST
// The fake AI pane. It renders whatever the engine computed from sensor
// readings — the UI adds nothing, which is the point: it looks like a
// product and is three multiplications in a lab coat.
function AssistPanel({ s, hints }: { s: GameState; hints: boolean }) {
  const allActive = s.assist.recs.filter((r) => r.status === 'active')
  const active = allActive.slice(-4) // freshest four; the rest are still live, just off-pane
  const recent = s.assist.recs.filter((r) => r.status !== 'active').slice(-2)
  return (
    <div className="ns-panel">
      <div className="ns-panel-title">ASSIST v0.9 · EARLY-WARNING COPILOT (BETA)</div>
      <div className="ns-panel-body">
        {active.length === 0 && (
          <div style={{ color: 'var(--ns-dim)' }}>No recommendations. ASSIST is watching the same board you are.</div>
        )}
        {active.map((r) => (
          <div key={r.id} className="ns-assist-rec">
            <div className="ns-assist-head">
              <span className="ns-assist-text">▸ {r.text}</span>
              <span className="ns-assist-conf">CONF {r.confidence}%</span>
            </div>
            <div className="ns-assist-detail">{r.detail}</div>
            <div className="ns-assist-bar"><span style={{ width: `${r.confidence}%` }} /></div>
          </div>
        ))}
        {allActive.length > 4 && (
          <div style={{ color: 'var(--ns-dim)', fontSize: 12 }}>+{allActive.length - 4} more queued — the board is having a night.</div>
        )}
        {recent.map((r) => (
          <div key={r.id} className="ns-assist-rec done">
            <span className="ns-assist-text">{r.status === 'followed' ? '✓' : '·'} {r.text}</span>
            <span className="ns-assist-conf">{r.status.toUpperCase()}</span>
          </div>
        ))}
        {hints && (
          <div className="ns-help">
            ASSIST reads the same sensors the alarms do — no more, no less. Its confidence is a number, not a promise. Following it and overriding it are both graded at 06:00.
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- handover
function HandoverScreen({ s, dispatch }: { s: GameState; dispatch: React.Dispatch<Action> }) {
  const h = s.handover
  if (!h) return null
  const picked = h.selected.length
  return (
    <div className="ns-center ns-report">
      <h1>06:00 — WRITE YOUR HANDOVER</h1>
      <div className="ns-sub">THE DAY CREW READS THIS BEFORE THEY READ ANYTHING ELSE</div>
      <div className="ns-brief ns-handover" style={{ textAlign: 'left' }}>
        <div className="ns-handover-title">HANDOVER NOTE — NIGHT → DAY SHIFT</div>
        <p>Pick up to {3} lines. Pass on what is true and matters; passing on a false claim sends the day crew chasing ghosts. What you leave out, nobody knows.</p>
        {h.candidates.map((c) => {
          const on = h.selected.includes(c.id)
          return (
            <button
              key={c.id}
              className={`ns-handover-item${on ? ' on' : ''}`}
              onClick={() => dispatch({ type: 'HANDOVER_TOGGLE', id: c.id })}
              disabled={!on && picked >= 3}
            >
              <span className="ns-handover-box">{on ? '☒' : '☐'}</span> {c.text}
            </button>
          )
        })}
      </div>
      <p style={{ color: 'var(--ns-dim)' }}>{picked}/3 selected — you can also sign out with none, if you think nothing is worth passing on.</p>
      <p style={{ color: 'var(--ns-dim)', fontSize: 13 }}>Graded like the rest of the shift: a true line that matters +3 · a false claim −4 · a critical fact left out −2. Short and honest beats long and hopeful.</p>
      <button className="ns-btn big" onClick={() => dispatch({ type: 'HANDOVER_SUBMIT' })}>SIGN &amp; CLOCK OUT</button>
    </div>
  )
}

// leave mid-shift: two clicks, in fiction, no browser dialogs. The first
// click arms; ignoring it for a few seconds stands you back down.
function WalkOutButton({ onConfirm }: { onConfirm: () => void }) {
  const [armed, setArmed] = useState(false)
  useEffect(() => {
    if (!armed) return
    const t = setTimeout(() => setArmed(false), 3500)
    return () => clearTimeout(t)
  }, [armed])
  return (
    <button
      className={`ns-btn${armed ? ' red' : ''}`}
      title="Abandon the shift and return to the start screen. Nothing is saved; the night forgets you."
      onClick={() => (armed ? onConfirm() : setArmed(true))}
    >
      {armed ? 'SURE? SHIFT ENDS' : 'WALK OUT'}
    </button>
  )
}

const STATS_KEY = 'night-shift-stats'
interface ShiftStats {
  shifts: number
  best: number
  bestGrade: string
}

function readStats(): ShiftStats | null {
  try {
    const raw = localStorage.getItem(STATS_KEY)
    return raw ? (JSON.parse(raw) as ShiftStats) : null
  } catch {
    return null
  }
}

function StartScreen({ night, onStart, onMode }: { night: NightPlan; onStart: (seed?: number, quiet?: boolean) => void; onMode: (quiet: boolean) => void }) {
  // read after mount: this page is statically exported, so the server render
  // has no localStorage and a direct read would mismatch on hydration
  const [stats, setStats] = useState<ShiftStats | null>(null)
  useEffect(() => setStats(readStats()), [])
  if (night.quiet) {
    return (
      <div className="ns-center">
        <h1>NIGHT SHIFT</h1>
        <div className="ns-sub">TIER III FACILITY · 22:00 – 06:00 · QUIET NIGHT · NO PRESSURE. REALLY.</div>
        <div className="ns-brief ns-handover">
          <div className="ns-handover-title">HANDOVER NOTE — DAY SHIFT → NIGHT</div>
          <p>Both halls green, board is clean, forecast says rain no matter what it says. Honestly? Should be a quiet one.</p>
          <p>· <strong>CDU pump {night.faultPump}</strong> still has its bearing whine. Vendor confirmed for Thursday. Walk past it once in a while and make sure it still sounds like Tuesday.</p>
          <p>· UPS-1 runs its <strong>monthly self-test</strong> around 02:00. It will tell you about it. It is very proud.</p>
          <p>· Humid out — if the leak rope reads damp, it&rsquo;s the weather until proven otherwise.</p>
          <p>· Do your <strong>rounds</strong> — clipboard walk, log readings at all four CRACs and the CDU (hold E at each). Four rounds is a proper night. Nobody checks. That&rsquo;s the point.</p>
          <p>· Coffee machine is still broken. Some hero should do something about that. — J.</p>
        </div>
        <div className="ns-brief">
          <p>No scripted disasters tonight. Walk the floor, listen to the rain, watch healthy trends do nothing. At 06:00 you still write the handover — a quiet night deserves an honest note too.</p>
        </div>
        <p style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
          <button className="ns-btn big" onClick={() => onStart(undefined, true)}>▶ CLOCK IN</button>
          <button className="ns-btn big amber" onClick={() => onMode(false)}>BACK TO THE BAD NIGHTS</button>
        </p>
      </div>
    )
  }
  return (
    <div className="ns-center">
      <h1>NIGHT SHIFT</h1>
      <div className="ns-sub">TIER III FACILITY · 22:00 – 06:00 · YOU ARE THE ONLY OPERATOR ON SITE · NIGHT #{night.seed}/{NIGHT_SEEDS}</div>
      {stats && stats.shifts > 0 && (
        <div className="ns-stats">SHIFT #{stats.shifts + 1} · PERSONAL BEST: {stats.bestGrade} ({stats.best}/100)</div>
      )}
      <div className="ns-brief ns-handover">
        <div className="ns-handover-title">HANDOVER NOTE — DAY SHIFT → NIGHT</div>
        <p>Quiet board at handover, both halls nominal. Few things for your radar:</p>
        <p>· <strong>CRAC-2</strong> (Hall A air-con) short-cycled twice this afternoon. If it trips again, the remote reset usually takes.</p>
        <p>· <strong>CDU pump {night.faultPump}</strong> (the liquid loop feeding the GPU racks) has a bearing whine. Vendor is booked Thursday. Keep an ear on it — if it lets go, someone has to walk out there.</p>
        <p>· <strong>Two contractors expected tonight.</strong> Tickets are on the board. Check work orders character by character before badging anyone in — last month a guy talked his way into the wrong hall.</p>
        <p>· Humid out; the <strong>CDU leak rope</strong> loves condensation. Eyeball it before you panic — but never just assume.</p>
        <p>· Hall A&rsquo;s new room sensors were calibrated last month. Allegedly.</p>
        <p>· Coffee machine is still broken. Sorry. — J.</p>
      </div>
      <div className="ns-brief">
        <p><strong>HOW TO PLAY:</strong> ACK every alarm fast (it&rsquo;s free and audited), then act. Every alarm carries an <strong>EOP tag</strong> — click it for the step-by-step procedure, written for people who&rsquo;ve never set foot in a data center. The procedure gives you the steps; the judgment is yours.</p>
        <p><strong>ON THE FLOOR:</strong> WASD/arrows to move by torchlight, hold <strong>E</strong> to fix things, exit via the BMS room door. Out there you see the truth — but not the console. Nothing pauses.</p>
        <p>Keep the racks alive until 06:00. You&rsquo;ll be graded like a real post-mortem.</p>
      </div>
      <p style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
        <button className="ns-btn big" onClick={() => onStart()}>▶ CLOCK IN</button>
        {/* a replay tool, shown at replay time: appears once you've survived a
            shift (or arrived via a shared ?night= link, already knowing why) */}
        {((stats?.shifts ?? 0) >= 1 || night.seed !== 1) && (
          <button
            className="ns-btn big amber"
            title="Same facility, different night: the faults move. 32 authored permutations, each fully deterministic and shareable by number."
            onClick={() => onStart((night.seed % NIGHT_SEEDS) + 1)}
          >
            ⇄ DIFFERENT NIGHT
          </button>
        )}
        <button
          className="ns-btn big"
          title="The other 360 nights of the year: no disasters — rounds, rain, and the coffee machine. The destress mode."
          onClick={() => onMode(true)}
        >
          ☾ QUIET NIGHT
        </button>
      </p>
    </div>
  )
}

function DebriefScreen({ s, onRestart }: { s: GameState; onRestart: (seed?: number, quiet?: boolean) => void }) {
  const d = buildDebrief(s)
  const cls = d.points >= 85 ? 'good' : d.points >= 50 ? 'mid' : 'bad'
  const [copied, setCopied] = useState(false)
  const share = () => {
    const goodCalls = s.score.filter((x) => x.pts > 0).length
    const ringing = s.alarms.filter((a) => !a.acked).length
    const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`
    const text = s.night.quiet
      ? [
          `NIGHT SHIFT — data center operator sim`,
          `QUIET NIGHT · "${d.ending}" · grade ${d.grade}`,
          `${s.rounds.count}/4 rounds walked · ${s.coffeeFixed ? 'coffee machine fixed ☕' : 'coffee machine still broken'}`,
          d.grade === 'S' ? `Nothing happened. I made sure.` : `Nothing happened. It made sure of itself.`,
          `https://joeywcl.github.io/night-shift`,
        ].join('\n')
      : [
          `NIGHT SHIFT — data center operator sim`,
          `NIGHT #${s.night.seed} · "${d.ending}" · grade ${d.grade} (${d.points}/100)`,
          `${s.downtimeMin.toFixed(0)} min downtime · ${plural(goodCalls, 'good call')} · ${plural(ringing, 'alarm')} left ringing`,
          `Can you survive my night?`,
          `https://joeywcl.github.io/night-shift?night=${s.night.seed}`,
        ].join('\n')
    navigator.clipboard
      ?.writeText(text)
      .then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      })
      .catch(() => {})
  }
  return (
    <div className="ns-center ns-report">
      <h1>AFTER-ACTION REPORT</h1>
      <div className="ns-sub">SHIFT 22:00–06:00 · {s.night.quiet ? 'QUIET NIGHT' : `NIGHT #${s.night.seed}`} · OPERATOR: YOU</div>
      <div className="ns-ending">&ldquo;{d.ending}&rdquo;</div>
      <div className={`ns-grade ${cls}`}>{d.grade}</div>
      {s.night.quiet ? (
        <p>
          {d.gradeNote}
          <br />
          <span style={{ color: 'var(--ns-dim)' }}>
            {s.rounds.count}/4 rounds · coffee {s.coffeeFixed ? 'fixed' : 'still broken'} · graded on care, not survival — nothing can go wrong out here
          </span>
        </p>
      ) : (
        <p>{d.points} / 100 — {d.gradeNote}</p>
      )}
      {d.handoverNote.length > 0 && (
        <>
          <h3>YOUR HANDOVER NOTE</h3>
          <ul>{d.handoverNote.map((x, i) => <li key={i}>{x}</li>)}</ul>
        </>
      )}
      <h3>ABNORMALITY</h3>
      <ul>{d.abnormality.map((x, i) => <li key={i}>{x}</li>)}</ul>
      <h3>HANDLING</h3>
      <ul>
        {d.handling.length === 0 && <li>No scored events. A quiet night that wasn&rsquo;t.</li>}
        {d.handling.map((x, i) => (
          <li key={i} className={x.includes('(+') ? 'ns-pos' : 'ns-neg'}>{x}</li>
        ))}
      </ul>
      {d.assist.length > 0 && (
        <>
          <h3>ASSIST TRUST LEDGER</h3>
          <ul>{d.assist.map((x, i) => <li key={i}>{x}</li>)}</ul>
        </>
      )}
      <h3>RESULT</h3>
      <ul>{d.result.map((x, i) => <li key={i}>{x}</li>)}</ul>
      <h3>FOLLOW-UP</h3>
      <ul>{d.followUp.map((x, i) => <li key={i}>{x}</li>)}</ul>
      <p style={{ marginTop: 24, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <button className="ns-btn big" onClick={() => onRestart()}>RUN IT BACK</button>
        {s.night.quiet ? (
          <button className="ns-btn big" title="Back to the worst night of the year" onClick={() => onRestart(undefined, false)}>⚠ BACK TO THE BAD NIGHTS</button>
        ) : (
          <button className="ns-btn big" title="Same facility, different faults" onClick={() => onRestart((s.night.seed % NIGHT_SEEDS) + 1)}>⇄ DIFFERENT NIGHT</button>
        )}
        <button className="ns-btn big amber" onClick={share}>{copied ? 'COPIED ✓' : 'COPY RESULT'}</button>
      </p>
    </div>
  )
}

// ---------------------------------------------------------------- main

export default function NightShift() {
  const [s, dispatch] = useReducer(reducer, undefined, () => initialState())
  const [muted, setMuted] = useState(false)
  const [hints, setHints] = useState(true)
  const [eopView, setEopView] = useState<{ eopId: string; alarmId: number } | null>(null)
  const { beep, ensure, setTone, stopTone, stopAllTones, setRain, stopRain } = useBeeper(muted)
  const prev = useRef({ critCount: 0, warnCount: 0, recCount: 0, doorId: 0, doorBuzzT: 0 })

  // clock-in moment: the console powers on like the CRT it is (once, and
  // never for players who asked for reduced motion — CSS hides it for them)
  const [powerOn, setPowerOn] = useState(false)
  const prevPhase = useRef(s.phase)
  useEffect(() => {
    if (prevPhase.current === 'start' && s.phase === 'playing') {
      setPowerOn(true)
      const t = setTimeout(() => setPowerOn(false), 950)
      prevPhase.current = s.phase
      return () => clearTimeout(t)
    }
    prevPhase.current = s.phase
    return undefined
  }, [s.phase])

  // shareable nights: ?night=N loads that exact permutation (static export —
  // read after mount to avoid hydration mismatch)
  useEffect(() => {
    try {
      const n = Number(new URLSearchParams(window.location.search).get('night'))
      if (n >= 1 && n <= NIGHT_SEEDS && n !== initialState().night.seed) dispatch({ type: 'RESTART', seed: n })
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (s.phase !== 'playing') return
    // measured dt: background tabs clamp intervals to ~1s, so a fixed 0.25s
    // would silently slow the shift clock 4x (engine caps a single step at 2s).
    // While the tab is hidden the shift pauses entirely — a Slack ping should
    // not cost anyone a data hall.
    let last = performance.now()
    const id = setInterval(() => {
      const now = performance.now()
      if (document.hidden) {
        last = now
        return
      }
      dispatch({ type: 'TICK', dt: (now - last) / 1000 })
      last = now
    }, 250)
    return () => clearInterval(id)
  }, [s.phase])

  // persist shift count + personal best once per debrief — scripted nights
  // only: a quiet S is a lovely evening, not a high score
  const savedRef = useRef(false)
  useEffect(() => {
    if (s.phase === 'playing') savedRef.current = false
    if (s.phase !== 'debrief' || savedRef.current || s.night.quiet) return
    savedRef.current = true
    try {
      const d = buildDebrief(s)
      const st = readStats() ?? { shifts: 0, best: -1, bestGrade: '—' }
      st.shifts += 1
      if (d.points > st.best) {
        st.best = d.points
        st.bestGrade = d.grade
      }
      localStorage.setItem(STATS_KEY, JSON.stringify(st))
    } catch {}
  }, [s])

  // sound cues on new criticals / warnings / gate arrivals / ASSIST recs
  useEffect(() => {
    const crit = s.alarms.filter((a) => a.severity === 'critical' && !a.acked).length
    if (crit > prev.current.critCount) {
      beep(880, 120)
      setTimeout(() => beep(880, 120), 180)
    }
    prev.current.critCount = crit
    const warn = s.alarms.filter((a) => a.severity === 'warning' && !a.acked).length
    if (warn > prev.current.warnCount) beep(587, 140, 0.03)
    prev.current.warnCount = warn
    const recCount = s.assist.recs.length
    if (recCount > prev.current.recCount) beep(1319, 70, 0.02)
    prev.current.recCount = recCount
    const doorId = s.door?.id ?? 0
    if (doorId && doorId !== prev.current.doorId) {
      beep(220, 350, 0.05)
      prev.current.doorBuzzT = s.t
    }
    // an unanswered intercom re-buzzes — real ones are just as impatient
    if (s.door && s.t - prev.current.doorBuzzT >= 8) {
      beep(220, 350, 0.05)
      prev.current.doorBuzzT = s.t
    }
    prev.current.doorId = doorId
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.alarms, s.door, s.assist.recs.length])

  // floor ambience: room hum + GPU layer while out there; silence at console
  const onFloor = s.phase === 'playing' && s.operator.kind === 'floor'
  useEffect(() => {
    if (onFloor) {
      setTone('hum', 52, 0.015)
      return () => { stopTone('hum'); stopTone('gpu'); stopTone('whine') }
    }
    stopAllTones()
    return undefined
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onFloor])
  useEffect(() => {
    if (!onFloor) return
    if (s.liquid.gpuRunning) setTone('gpu', 121, 0.01)
    else stopTone('gpu')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onFloor, s.liquid.gpuRunning])

  // rain on the roof — audible everywhere, a little louder out on the floor
  useEffect(() => {
    if (s.phase === 'playing' && s.raining) setRain(onFloor ? 0.014 : 0.007)
    else stopRain()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.phase, s.raining, onFloor])

  if (s.phase === 'start') {
    return (
      <div className="ns-root ns-flicker">
        <StartScreen
          night={s.night}
          onStart={(seed, quiet) => { ensure(); dispatch({ type: 'START', seed, quiet }) }}
          onMode={(quiet) => dispatch({ type: 'RESTART', quiet })}
        />
      </div>
    )
  }

  if (s.phase === 'handover') {
    return (
      <div className="ns-root">
        <HandoverScreen s={s} dispatch={dispatch} />
      </div>
    )
  }

  if (s.phase === 'debrief') {
    return (
      <div className="ns-root">
        <DebriefScreen s={s} onRestart={(seed, quiet) => dispatch({ type: 'RESTART', seed, quiet })} />
      </div>
    )
  }

  const unacked = s.alarms.filter((a) => !a.acked)

  return (
    <div className="ns-root ns-flicker">
      {powerOn && <div className="ns-poweron" aria-hidden="true" />}
      {s.operator.kind === 'floor' && (
        <FloorGame
          s={s}
          beep={beep}
          setTone={setTone}
          stopTone={stopTone}
          onRepair={(unit) => dispatch({ type: 'REPAIR_DONE', unit })}
          onRepairPumps={() => dispatch({ type: 'REPAIR_PUMPS' })}
          onFixCoffee={() => dispatch({ type: 'FIX_COFFEE' })}
          onCheck={(unit) => dispatch({ type: 'CHECK_UNIT', unit })}
          onRevealRack={() => dispatch({ type: 'REVEAL_RACK' })}
          onFixRackFan={() => dispatch({ type: 'FIX_RACK_FAN' })}
          onReveal={() => dispatch({ type: 'REVEAL_SMOKE' })}
          onRevealLeak={() => dispatch({ type: 'REVEAL_LEAK' })}
          onReturn={() => dispatch({ type: 'RETURN' })}
        />
      )}
      <div className="ns-header">
        <span className="ns-title">NIGHT SHIFT</span>
        <span className="ns-clock">{clockLabel(s.t)}</span>
        <span style={{ color: 'var(--ns-dim)' }}>{s.night.quiet ? '☾ QUIET' : `N#${s.night.seed}`}{s.raining ? ' · RAIN' : ''}</span>
        <div className="ns-progress"><div style={{ width: `${(s.t / SHIFT_END) * 100}%` }} /></div>
        {s.door && (
          <button
            className="ns-btn amber ns-door-flag"
            title="Someone is waiting at the gate — click to jump to the intercom"
            onClick={() => document.getElementById('ns-gate')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
          >
            ■ VISITOR AT GATE · {Math.floor(s.t - s.door.arrivedAt)}m
          </button>
        )}
        <span className="ns-spacer" />
        <span>{s.ups.onBattery ? <span className="ns-neg">UPS: ON BATTERY</span> : 'UPS: MAINS'}</span>
        <span>OPERATOR: {s.operator.kind === 'console' ? 'AT CONSOLE' : 'ON FLOOR'}</span>
        <button className="ns-btn" onClick={() => dispatch({ type: 'WALK' })} disabled={s.operator.kind !== 'console'}
          title="Verify things with your own eyes. The console stays behind.">
          WALK THE FLOOR
        </button>
        <button className="ns-btn" onClick={() => setHints((h) => !h)} title="Plain-language explanations for non-operators">
          {hints ? 'HINTS: ON' : 'HINTS: OFF'}
        </button>
        <button className="ns-btn" onClick={() => { ensure(); setMuted((m) => !m) }}>
          {muted ? 'UNMUTE' : 'MUTE'}
        </button>
        <WalkOutButton onConfirm={() => dispatch({ type: 'RESTART' })} />
      </div>

      <div className="ns-grid">
        <div>
          <div className="ns-panel">
            <div className="ns-panel-title">ALARMS ({unacked.length} UNACKED)</div>
            <div className="ns-panel-body">
              {s.alarms.length === 0 && <div style={{ color: 'var(--ns-dim)' }}>No alarms. Enjoy it while it lasts.</div>}
              {s.alarms.slice(0, 12).map((a) => (
                <AlarmRow
                  key={a.id}
                  a={a}
                  onAck={() => { beep(440, 60); dispatch({ type: 'ACK', id: a.id }) }}
                  onEop={() => a.eop && setEopView({ eopId: a.eop, alarmId: a.id })}
                />
              ))}
              {hints && s.alarms.length > 0 && (
                <div className="ns-help">New to the board? Every alarm carries an EOP tag — the procedure that tells you what to do next. Open it. That&rsquo;s what it&rsquo;s for.</div>
              )}
            </div>
          </div>
          <AssistPanel s={s} hints={hints} />
        </div>

        <div>
          <div className="ns-panel">
            <div className="ns-panel-title">FACILITY · COOLING</div>
            {s.zones.map((z) => (
              <ZoneCard
                key={z.id}
                s={s}
                z={z}
                hints={hints}
                onRemote={(id) => dispatch({ type: 'REMOTE_RESTART', unit: id })}
                onWalk={(id) => dispatch({ type: 'WALK', unit: id })}
                onIsolate={(zoneId, idx) => dispatch({ type: 'ISOLATE_SENSOR', zone: zoneId, idx })}
              />
            ))}
            <LiquidPanel s={s} hints={hints} dispatch={dispatch} />
          </div>
        </div>

        <div>
          <LeakPanel
            s={s}
            onShut={() => dispatch({ type: 'LEAK_SHUT' })}
            onDismiss={() => dispatch({ type: 'DISMISS_LEAK' })}
          />
          <SmokePanel
            s={s}
            onSuppress={() => dispatch({ type: 'SUPPRESS' })}
            onDismiss={() => dispatch({ type: 'DISMISS_SMOKE' })}
          />
          <DoorPanel s={s} d={s.door} onDecide={(x) => dispatch({ type: 'DOOR', decision: x })} />
          <div className="ns-panel">
            <div className="ns-panel-title">APPROVED WORK TICKETS · TONIGHT</div>
            <div className="ns-panel-body">
              {s.tickets.map((t) => (
                <div key={t.wo} className="ns-ticket">
                  <span className="ns-wo">{t.wo}</span> · {t.desc}
                  <div style={{ color: 'var(--ns-dim)' }}>window {t.window}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="ns-panel">
            <div className="ns-panel-title">EVENT LOG</div>
            <div className="ns-panel-body ns-log">
              {[...s.log].reverse().map((l, i) => (
                <div key={i}><span className="t">{clockLabel(l.time)}</span>{l.text}</div>
              ))}
            </div>
          </div>
        </div>
      </div>
      {eopView && <EopDrawer s={s} eopId={eopView.eopId} alarmId={eopView.alarmId} onClose={() => setEopView(null)} />}
    </div>
  )
}
