# NIGHT SHIFT — roadmap & design ideas

*Captured 2026-07-17 from a game-design review. The bar for adding anything: it must
amplify an existing pillar (attention economy · the console lies · judgment over
procedure · consequences travel), not bolt on a genre feature.*

**SHIPPED 2026-07-17 (v1.7 rollout):** all of Tier 1 (sound incl. the audible bearing
whine, morning-handover writing, 32 seeded nights + `?night=N` sharing), the Tier 2
flagship (ASSIST v0.9 with trust ledger), named endings, heat-split readout, and the
coffee machine. Remaining below: duty-manager phone, consecutive-night campaign, CCTV.

## Ideas that emerged during the build

- **ASSIST escalation voice:** recs already reissue after their 25-min TTL — show
  "REISSUED ×2" and let the copy get passive-aggressive. Cheap, characterful.
- **The note loops back (campaign hook):** in consecutive-night play, the handover you
  WRITE becomes the note you RECEIVE tomorrow — the campaign's save file is diegetic.
- **Gate call-back:** a denied/timed-out visitor buzzes again later, angrier. The gate
  becomes a running relationship, not an event.
- **Night map:** a 32-cell grid on the start screen showing which seeds you've survived
  (localStorage) — a completionist pull that costs one component.
- **Time compression:** optional 2× fast-forward during quiet stretches that snaps back
  to 1× on any alarm — respects the player's evening without deflating the tension.
- ~~**The hot rack (rack-level blind spot)**~~ — **SHIPPED 2026-07-18**: row A3's fan
  dies silently at 01:41 in every scripted night. Room sensors honestly read normal; no
  alarm exists; ASSIST is silent. Only the floor shows one row glowing amber. Fix it on
  foot (+6, handover material) or the day crew finds it by smell (−8). The third sensor
  lesson: sometimes the console isn't lying — it just can't see that small.
- ~~**Quiet Night floor-first**~~ — **SHIPPED 2026-07-18**: quiet nights clock in
  STANDING ON THE FLOOR; the console is a room you visit. Telemetry lives in the space:
  walk up to any CRAC/CDU and its local gauge plate renders (quiet-only — in the
  scripted game, floor-blindness IS the mechanic).
- ~~**Multi-room floor (the full "room simulator")**~~ — **SHIPPED 2026-07-19**: interior
  walls with real doorways — Hall A | corridor | Hall B, break room at the corridor's
  top (the coffee machine now lives there, NOT in the white space — no drinks near
  racks), BMS room at its bottom. Doorways align with the halls' open ends; traversal
  verified end-to-end. The rollout sweep (L15) drives all 32 scripted nights + quiet
  night through the reducer as a release gate.
- ~~**"Quiet Night" ambient mode (the destress version)**~~ — **SHIPPED 2026-07-17**:
  rain (real filtered-noise audio), 02:00 UPS self-test info line, clipboard rounds
  (hold-E readings at all 5 checkpoints, ✓ ticks on the map, one round an hour),
  the shy cricket, ASSIST's coffee recommendation, honest-note traps, three quiet
  endings ("NOTHING HAPPENED. YOU MADE SURE." / "EVERY OTHER NIGHT" / "THE CHAIR HAS
  YOUR SHAPE NOW").

---

## Tier 1 — highest experience-per-effort

### 1. Sound
The biggest missing sense. A BMS sim is *made* of sound.
- Severity-coded alarm tones — operators triage by ear before they read.
- Room hum on the floor; silence after an E-STOP should feel wrong.
- **The killer detail:** the handover note already mentions P1's bearing whine. Make it
  audible when walking past the CDU, pitch rising before the 01:20 failure — diegetic
  telemetry the console cannot show, rewarding floor walks with real information.
- Scope: 5–6 loops + 3 beeps. Respect `prefers-reduced-motion`-style audio toggle + MUTE.

### 2. Write the morning handover
At 06:00, before the grade: show ~8 candidate observations (some true, some traps sourced
from lying sensors) — player picks 3–4 to pass to the day crew. Grade the note against
ground truth. Bookends the game (it opens with a handover note; it should close with
yours), tests understanding rather than reflexes, and is cheap: every fact is already in
`GameState`.

### 3. Seeded night variants
Not random — *permuted*. A seed swaps 4–5 authored variation points: which sensor drifts,
which pump dies, whether the contractor is bogus, which hall gets the smoke. Dozens of
distinct nights, each still deterministic and CI-testable (drive every seed through the
reducer). Seed goes in the share text: "Night #47, grade B — can you survive my night?"
This is the replay multiplier and the social loop.

---

## Tier 2 — the flagship

### 4. ASSIST v0.9 (beta) — an AI you learn when to trust
An in-fiction early-warning assistant pane. **No LLM, no tokens — fully scripted, and the
bluff is the point:**

- **Why scripted is the design, not a fallback:**
  - Static GitHub Pages export: no backend, so a real API key can't be shipped safely.
  - Determinism is the engine's identity — ASSIST is a pure function over `GameState`,
    unit-testable like everything else.
  - Real LLMs aren't wrong *on cue*. ASSIST must be confidently wrong exactly when the
    sensors lie — that's authored behavior, not emergent.
- **Mechanic:** recommendations + confidence % computed from **sensor readings** (the
  lying layer), never true temperature. Drifting Hall A sensor ⇒ ASSIST confidently
  recommends fixing a non-problem. Stuck Hall B sensor ⇒ ASSIST stays serene while the
  hall cooks. The sensor-trust pillar extends to model-trust.
- **Voice:** terse, beta-product energy. "RECOMMEND: RMT RESET CRAC-1 · confidence 87%".
  Confidence is a formula (sensor agreement × trend stability × rule specificity) — it
  *feels* like ML and is three multiplications.
- **Scoring:** debrief gains a trust ledger — followed-when-right / overrode-when-wrong
  (kudos) vs followed-when-wrong / overrode-when-right (penalty). "You trusted ASSIST 6
  times; it was right 4."
- **Clean-room rule:** generic beta assistant, no resemblance to employer products in
  name, voice, or visuals.

---

## Tier 3 — when the mood strikes

5. **Duty-manager phone** (promoted from old roadmap): authorization friction with a
   sleepy voice; hold time eats real seconds while Tj climbs. Attention currency again.
6. **Named endings:** "The Quiet Night", "The Firefighter", "The Skeptic". People share
   endings, not letter grades.
7. **Consecutive-night campaign:** debrief follow-up items become tomorrow's starting
   conditions — the CRAC left failed is still failed, and the vendor fixing it is in the
   hall when the smoke alarm fires. The debrief becomes a save file. Biggest lift; the
   "full game" version.
8. **Small diegetic joys:** grainy CCTV still at the gate; fixable coffee machine (+1
   easter-egg kudos); heat-split bar on the Hall B panel now that MEM exists.

---

## Deliberately out of scope

Inventory, dialogue trees, 3D, roguelike randomization, meta-progression unlocks, real
LLM calls. Each dilutes the core feeling: you are being *audited*, not entertained.

## Final-walk fixes (SHIPPED 2026-07-19)

- J. at the gate: the quiet night's one visitor — the author of your handover note,
  keyless at 23:45. Staff visit: warmth, not stakes (admit +1; deny/ignore cost nothing).
- Quiet ticket board tells the truth ("No contractor works scheduled · tonight").
- Quiet nights don't touch the personal-best (a quiet S is a lovely evening, not a score).
- ASSIST trust ledger collapses re-issues — each recommendation judged once, by kind.

## Previously agreed (kept)

- Vendor callout loop (gate becomes remediation).
- EOP compliance scoring.
