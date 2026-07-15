# NIGHT SHIFT

*A data-center operator sim: you are the last human on the night shift. Keep the racks alive until 06:00.*

**Play it:** [joeywcl.github.io/night-shift](https://joeywcl.github.io/night-shift) · one shift ≈ 4 minutes · keyboard recommended

## What it is

You run the graveyard shift of a Tier III data center, alone, from a phosphor-green BMS console. Alarms fire, cooling units trip, a UPS blinks onto battery, contractors buzz the gate with work orders that don't quite match tonight's schedule, and somewhere around 04:10 a leak-detection rope gets wet — maybe with condensation, maybe with coolant heading for a live busbar. At 06:00 the day crew arrives and you're graded like a real post-mortem: abnormality, handling, result, follow-up.

## The design ideas

**Two tempos.** Hall A is air-cooled: failures unfold over fifteen minutes and reward planning. Hall B is direct-to-chip liquid-cooled GPUs: if coolant flow collapses, junction temperature races to the trip point in *minutes*, and the only thing fast enough to save you is the trend projection. Juggling a slow-burn problem while a hair-trigger one detonates is the actual cognitive signature of hybrid data halls — and, not coincidentally, a live demo of why predictive early-warning monitoring exists.

**The console lies; the physics doesn't.** Alarms and trend projections are computed from *sensor readings*. The racks cook on *true temperature*. Sensors silently drift and stick, so a confident projection can be confidently wrong. Your tools: redundant sensor pairs, divergence warnings, sparkline shapes (a steady climb while cooling runs fine = drift; a flat line while everything changes = stuck), the option to isolate a lying sensor — and walking the floor, where your own skin is ground truth but the console is a long way behind you.

**Attention is the resource.** Leaving the console to fix or verify anything means navigating the dark hall by torchlight — and while you're out there, you cannot see the BMS. Nothing pauses. Every verification has a price; every price is paid in the currency the game is actually about.

**Judgment, not procedure, is the game.** Every alarm links to an in-fiction EOP (emergency operating procedure) written for people who've never set foot in a data center, with steps that check themselves off live. The EOP tells you *how* to respond to a leak alert; it will never tell you whether tonight's leak is real. That split — procedure is free, judgment is yours — is both the accessibility model and the design thesis.

**Consequences travel.** The bogus contractor you badge in at 22:40 is why the smoke pre-alarm at 05:10 is real. The pump bearing you didn't service at 01:20 is why the 04:10 leak isn't condensation and why the second pump dies at 04:20. Diligence quietly rewrites your endgame.

## Architecture

- **Pure-TypeScript engine** ([engine.ts](./engine.ts)): a single reducer over immutable-per-tick state, no React, no DOM, no wall-clock reads. 1 real second = 2 game minutes. Deterministic by construction — which makes the whole scenario unit-testable by just dispatching ticks.
- **Scenario tests** ([`__tests__/`](./__tests__)): 70 assertions drive full nights through the reducer — diligent runs, negligent runs, every branch of the smoke and leak dilemmas (`npm run test:game`).
- **Console UI** ([NightShift.tsx](./NightShift.tsx)): React over the reducer, 4 Hz ticks with measured `dt` (background-tab clamping would otherwise silently slow time). The shift pauses while the tab is hidden — a Slack ping shouldn't cost anyone a data hall.
- **The floor** ([FloorGame.tsx](./FloorGame.tsx)): a `<canvas>` top-down segment — WASD movement, collision, torchlight radial mask, heat-tinted racks driven by *true* hall temperature. Runs on `setInterval`, not `requestAnimationFrame`, because rAF freezes in hidden tabs while game time doesn't.
- No game engine, no dependencies beyond React. The whole game is ~2,500 lines.

## Provenance

I build monitoring and operations software for data centers professionally. This game is a clean-room personal project: it borrows the *domain* (and affection for the people who work night shifts in it), not code, visuals, or product designs from my employer. Any resemblance between the leak rope's false positives and real condensation is fully intended.
