# NIGHT SHIFT

*A data-center operator sim: you are the last human on the night shift. Keep the racks alive until 06:00.*

**Play it:** [joeywcl.github.io/night-shift](https://joeywcl.github.io/night-shift) · one shift ≈ 4 minutes · keyboard recommended

## What it is

You run the graveyard shift of a Tier III data center, alone, from a phosphor-green BMS console. Alarms fire, cooling units trip, a UPS blinks onto battery, contractors buzz the gate with work orders that don't quite match tonight's schedule, and somewhere around 04:10 a leak-detection rope gets wet — maybe with condensation, maybe with coolant heading for a live busbar. At 06:00 the day crew arrives and you're graded like a real post-mortem: abnormality, handling, result, follow-up.

## The design ideas

**Two tempos.** Hall A is air-cooled: failures unfold over fifteen minutes and reward planning. Hall B is direct-to-chip liquid-cooled GPUs: if coolant flow collapses, junction temperature races to the trip point in *minutes*, and the only thing fast enough to save you is the trend projection (its **TTB** — time-to-breach — readout is the console's countdown estimate). And Hall B's racks are properly hybrid: the die rides the liquid loop, but memory still rides hall air — lose Hall B's CRACs and MEM creeps toward throttle on the slow clock while Tj sits innocent. Two failure paths bind the same rack. Juggling a slow-burn problem while a hair-trigger one detonates is the actual cognitive signature of hybrid data halls — and, not coincidentally, a live demo of why predictive early-warning monitoring exists.

**The console lies; the physics doesn't.** Alarms and trend projections are computed from *sensor readings*. The racks cook on *true temperature*. Sensors silently drift and stick, so a confident projection can be confidently wrong. Your tools: redundant sensor pairs, divergence warnings, sparkline shapes (a steady climb while cooling runs fine = drift; a flat line while everything changes = stuck), the option to isolate a lying sensor — and walking the floor, where your own skin is ground truth but the console is a long way behind you.

**Attention is the resource.** Leaving the console to fix or verify anything means navigating the dark hall by torchlight — and while you're out there, you cannot see the BMS. Nothing pauses. Every verification has a price; every price is paid in the currency the game is actually about.

**Judgment, not procedure, is the game.** Every alarm links to an in-fiction EOP (emergency operating procedure) written for people who've never set foot in a data center, with steps that check themselves off live. The EOP tells you *how* to respond to a leak alert; it will never tell you whether tonight's leak is real. That split — procedure is free, judgment is yours — is both the accessibility model and the design thesis.

**ASSIST v0.9 — an AI you learn when to trust.** A beta "early-warning copilot" pane offers recommendations with confidence percentages. It is not an LLM — it's a rule engine computed from the same *sensor readings* the alarms use, so it is confidently wrong exactly when the console is: a sensor stuck cool while its hall heats will make ASSIST finger the *honest* sensor, at 90%+ confidence. Following it and overriding it are both graded in a trust ledger at 06:00. The confidence number is a formula wearing a lab coat, and that's the point.

**You write the morning handover.** At 06:00, before your grade: eight candidate observations, some true, some traps sourced from the night's lying sensors — pick up to three to pass to the day crew. Passing on a false claim sends them chasing ghosts; omitting the failed CRAC means nobody knows. The game opens with a handover note and ends with yours.

**32 authored nights.** A seed permutes which sensor drifts, which pump's bearing fails, which CRAC hard-faults, and the intruder's cover story — every permutation still deterministic and unit-tested. Your debrief's share text carries the night number, and `?night=N` loads it: "can you survive my night?"

**Sound is telemetry.** Severity-coded alarm tones, room hum on the floor — and the bearing whine the handover note warns you about is actually audible near the CDU, pitch climbing as failure approaches. The console cannot hear it; you can.

**Quiet Night — the destress mode.** The scripted night is the worst night of the year; ☾ QUIET NIGHT is every other night, and it is **floor-first**: you clock in standing in the hall, torch in hand — the console is a room you visit, not a seat you live in. Telemetry lives in the space: walk up to any unit and its local gauge plate renders (quiet-only — in the scripted game, floor-blindness *is* the mechanic). Rain starts on the roof (audibly), the UPS runs its proud little 02:00 self-test, the whine holds until Thursday — and the job is the **clipboard walk**: hold E to log readings at all four CRACs and the CDU, a checklist filling as you move, four rounds to a proper night. A cricket chirps somewhere in the gray space until the rain starts; it goes silent when you get close. Of course it does. The coffee machine is the other quest — ASSIST's only recommendation all night (`RECOMMEND: COFFEE · CONF 99%`). You still write the handover — and here the rounds pay off: **the walk gathers your note**. The observations worth passing on (the whine's pitch, the damp rope at 03:30) only appear as true options if you were actually there to observe them; skip the rounds and the note offers you confident guesses instead, and every one of them is wrong. Claiming rounds you never walked is still a lie. Finish it properly and the ending reads: *"NOTHING HAPPENED. YOU MADE SURE."* Most of operations is uneventful care; now the game says so too.

**The hot rack.** One rack row's fan dies at 01:41, silently, every scripted night. Both room sensors honestly read normal — the room average *is* normal. No alarm will ever fire; ASSIST never speaks. Only walking the floor reveals a single row glowing amber in the torchlight; swap the fan tray on foot (+6) or the day crew finds it by smell at 06:00 (−8). It completes the game's trilogy of sensor lessons: sensors that drift, sensors that stick, and the truth no room sensor can resolve — *sometimes the console isn't lying; it just can't see that small.* (In the real industry, this gap is why rack-level monitoring exists.)

**Consequences travel.** The bogus contractor you badge in at 22:40 is why the smoke pre-alarm at 05:10 is real. The pump bearing you didn't service at 01:20 is why the 04:10 leak isn't condensation and why the second pump dies at 04:20. Diligence quietly rewrites your endgame.

## Architecture

- **Pure-TypeScript engine** ([engine.ts](./engine.ts)): a single reducer over immutable-per-tick state, no React, no DOM, no wall-clock reads. 1 real second = 2 game minutes. Deterministic by construction — which makes the whole scenario unit-testable by just dispatching ticks.
- **Scenario tests** ([`__tests__/`](./__tests__)): 114 assertions drive full nights through the reducer — diligent runs, negligent runs, every branch of the smoke and leak dilemmas, seeded-night permutations, ASSIST's blind spot, and handover scoring (`npm run test:game`).
- **Console UI** ([NightShift.tsx](./NightShift.tsx)): React over the reducer, 4 Hz ticks with measured `dt` (background-tab clamping would otherwise silently slow time). The shift pauses while the tab is hidden — a Slack ping shouldn't cost anyone a data hall.
- **The floor** ([FloorGame.tsx](./FloorGame.tsx)): a `<canvas>` top-down segment — WASD movement, collision, torchlight radial mask, heat-tinted racks driven by *true* hall temperature. The building has rooms: Hall A and Hall B behind real walls and doorways, a corridor between them, the BMS room at its foot and the break room at its head (the coffee machine lives there — no drinks in the white space, ever). Runs on `setInterval`, not `requestAnimationFrame`, because rAF freezes in hidden tabs while game time doesn't.
- No game engine, no dependencies beyond React. The whole game is ~2,500 lines.

## Provenance

I build monitoring and operations software for data centers professionally. This game is a clean-room personal project: it borrows the *domain* (and affection for the people who work night shifts in it), not code, visuals, or product designs from my employer. Any resemblance between the leak rope's false positives and real condensation is fully intended.

Built pair-programming with Claude (Fable 5): I brought the domain, the design calls, and the taste; the model brought velocity. Every mechanic here survived a 128-assertion test suite either way.
