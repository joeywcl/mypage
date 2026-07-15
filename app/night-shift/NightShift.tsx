'use client'

import React, { useEffect, useReducer, useRef, useState } from 'react'
import './night-shift.css'
import { buildDebrief, clockLabel, consensusTemp, initialState, reducer, SHIFT_END } from './engine'
import { EOPS } from './eops'
import FloorGame from './FloorGame'
import type { Action, Alarm, DoorRequest, GameState, Zone, ZoneId } from './types'

// ---------------------------------------------------------------- trend

function trendInfo(z: Zone): { label: string; level: '' | 'warn' | 'crit' } {
  const h = z.history
  if (h.length < 4) return { label: 'TREND: —', level: '' }
  const cur = h[h.length - 1]
  const slope = (cur - h[h.length - 4]) / 6 // °C per game-minute (samples 2 min apart)
  if (slope < 0.08) return { label: 'TREND: STABLE', level: '' }
  const eta = (th: number) => Math.max(1, Math.round((th - cur) / slope))
  if (cur < 38)
    return { label: `TREND +${slope.toFixed(1)}°/min · 38° in ~${eta(38)}m · 42° in ~${eta(42)}m`, level: 'warn' }
  return { label: `TREND +${slope.toFixed(1)}°/min · SHUTDOWN 42° in ~${eta(42)}m`, level: 'crit' }
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
  if (cur < 95) return { label: `TREND +${slope.toFixed(1)}°/min · THROTTLE 95° in ~${eta(95)}m · TRIP 105° in ~${eta(105)}m`, level: 'warn' }
  return { label: `TREND +${slope.toFixed(1)}°/min · TRIP 105° in ~${eta(105)}m`, level: 'crit' }
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
  return { beep, ensure }
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
          <Sparkline history={L.tjHistory} lo={40} hi={110} crit={95} />
          <span className={`ns-zone-status ${L.loopLocked || !L.gpuRunning ? 'ns-neg' : ''}`}>
            {L.loopLocked ? 'LOOP CONTAMINATED' : !L.gpuRunning ? 'FLEET STOPPED' : L.tj >= 95 ? 'THROTTLING' : 'NOMINAL'}
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
            These GPUs are liquid-cooled: no flow and chip temp (Tj) races in minutes, not tens of minutes. SHED LOAD pauses batch jobs — less heat, unhappy customers. E-STOP is a controlled stop: downtime but no damage. Letting physics trip the fleet at 105° costs downtime AND silicon.
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

function StartScreen({ onStart }: { onStart: () => void }) {
  // read after mount: this page is statically exported, so the server render
  // has no localStorage and a direct read would mismatch on hydration
  const [stats, setStats] = useState<ShiftStats | null>(null)
  useEffect(() => setStats(readStats()), [])
  return (
    <div className="ns-center">
      <h1>NIGHT SHIFT</h1>
      <div className="ns-sub">TIER III FACILITY · 22:00 – 06:00 · YOU ARE THE ONLY OPERATOR ON SITE</div>
      {stats && stats.shifts > 0 && (
        <div className="ns-stats">SHIFT #{stats.shifts + 1} · PERSONAL BEST: {stats.bestGrade} ({stats.best}/100)</div>
      )}
      <div className="ns-brief ns-handover">
        <div className="ns-handover-title">HANDOVER NOTE — DAY SHIFT → NIGHT</div>
        <p>Quiet board at handover, both halls nominal. Few things for your radar:</p>
        <p>· <strong>CRAC-2</strong> (Hall A air-con) short-cycled twice this afternoon. If it trips again, the remote reset usually takes.</p>
        <p>· <strong>CDU pump P1</strong> (the liquid loop feeding the GPU racks) has a bearing whine. Vendor is booked Thursday. Keep an ear on it — if it lets go, someone has to walk out there.</p>
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
      <button className="ns-btn big" onClick={onStart}>▶ CLOCK IN</button>
    </div>
  )
}

function DebriefScreen({ s, onRestart }: { s: GameState; onRestart: () => void }) {
  const d = buildDebrief(s)
  const cls = d.points >= 85 ? 'good' : d.points >= 50 ? 'mid' : 'bad'
  const [copied, setCopied] = useState(false)
  const share = () => {
    const goodCalls = s.score.filter((x) => x.pts > 0).length
    const text = [
      `NIGHT SHIFT — data center operator sim`,
      `Shift grade: ${d.grade} (${d.points}/100)`,
      `${s.downtimeMin.toFixed(0)} rack-min downtime · ${goodCalls} good calls · ${s.alarms.filter((a) => !a.acked).length} alarms left ringing`,
      `Can you keep the racks alive until 06:00?`,
      `https://joeywcl.github.io/night-shift`,
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
      <div className="ns-sub">SHIFT 22:00–06:00 · OPERATOR: YOU</div>
      <div className={`ns-grade ${cls}`}>{d.grade}</div>
      <p>{d.points} / 100 — {d.gradeNote}</p>
      <h3>ABNORMALITY</h3>
      <ul>{d.abnormality.map((x, i) => <li key={i}>{x}</li>)}</ul>
      <h3>HANDLING</h3>
      <ul>
        {d.handling.length === 0 && <li>No scored events. A quiet night that wasn&rsquo;t.</li>}
        {d.handling.map((x, i) => (
          <li key={i} className={x.includes('(+') ? 'ns-pos' : 'ns-neg'}>{x}</li>
        ))}
      </ul>
      <h3>RESULT</h3>
      <ul>{d.result.map((x, i) => <li key={i}>{x}</li>)}</ul>
      <h3>FOLLOW-UP</h3>
      <ul>{d.followUp.map((x, i) => <li key={i}>{x}</li>)}</ul>
      <p style={{ marginTop: 24, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <button className="ns-btn big" onClick={onRestart}>RUN IT BACK</button>
        <button className="ns-btn big amber" onClick={share}>{copied ? 'COPIED ✓' : 'COPY RESULT'}</button>
      </p>
    </div>
  )
}

// ---------------------------------------------------------------- main

export default function NightShift() {
  const [s, dispatch] = useReducer(reducer, undefined, initialState)
  const [muted, setMuted] = useState(false)
  const [hints, setHints] = useState(true)
  const [eopView, setEopView] = useState<{ eopId: string; alarmId: number } | null>(null)
  const { beep, ensure } = useBeeper(muted)
  const prev = useRef({ critCount: 0, doorId: 0, doorBuzzT: 0 })

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

  // persist shift count + personal best once per debrief
  const savedRef = useRef(false)
  useEffect(() => {
    if (s.phase === 'playing') savedRef.current = false
    if (s.phase !== 'debrief' || savedRef.current) return
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

  // sound cues on new criticals / gate arrivals
  useEffect(() => {
    const crit = s.alarms.filter((a) => a.severity === 'critical' && !a.acked).length
    if (crit > prev.current.critCount) {
      beep(880, 120)
      setTimeout(() => beep(880, 120), 180)
    }
    prev.current.critCount = crit
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
  }, [s.alarms, s.door])

  if (s.phase === 'start') {
    return (
      <div className="ns-root ns-flicker">
        <StartScreen onStart={() => { ensure(); dispatch({ type: 'START' }) }} />
      </div>
    )
  }

  if (s.phase === 'debrief') {
    return (
      <div className="ns-root">
        <DebriefScreen s={s} onRestart={() => dispatch({ type: 'RESTART' })} />
      </div>
    )
  }

  const unacked = s.alarms.filter((a) => !a.acked)

  return (
    <div className="ns-root ns-flicker">
      {s.operator.kind === 'floor' && (
        <FloorGame
          s={s}
          beep={beep}
          onRepair={(unit) => dispatch({ type: 'REPAIR_DONE', unit })}
          onRepairPumps={() => dispatch({ type: 'REPAIR_PUMPS' })}
          onReveal={() => dispatch({ type: 'REVEAL_SMOKE' })}
          onRevealLeak={() => dispatch({ type: 'REVEAL_LEAK' })}
          onReturn={() => dispatch({ type: 'RETURN' })}
        />
      )}
      <div className="ns-header">
        <span className="ns-title">NIGHT SHIFT</span>
        <span className="ns-clock">{clockLabel(s.t)}</span>
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
