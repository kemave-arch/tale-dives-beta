# Tale Dives — Live QC Pass Report

**Date:** 2026-09-13
**Test Tale:** Fourth Wing (Rebecca Yarros) / Violet Sorrengail, canon prologue
**Models used:** `gemini-3.5-flash` (Tale Weaving phases + first turns), `gemini-3.5-flash-lite` (later turns, after `gemini-3.5-flash`'s free-tier daily quota was exhausted)
**Method:** Real, live API calls — no mocking. Driven directly through the app's own unmodified generation/parsing code (`src/lib/taleWeaving.ts`, `src/api/providers/gemini.ts`, `src/lib/xmlTurnParser.ts`, `src/lib/jitContext.ts`) via a Node test harness, not through the browser UI (see "Why not the browser" below).
**Full narration transcript:** [`QC-Transcript.md`](./QC-Transcript.md)
**Raw data:** `qc-transcript-raw.json` (Tale Weaving phases), `qc-turns-transcript.json` (turns), `qc-final-accumulated.json` / `qc-campaign-after-turn-*.json` (resulting state)

## Why not the browser

Headless Chromium in this sandbox could not complete a real API call to `generativelanguage.googleapis.com` through the environment's egress proxy — every attempt failed with a generic `Failed to fetch`, even after confirming the API key, CORS, and proxy config were all otherwise correct (`curl` through the same proxy worked fine). The proxy's own status endpoint showed the failure precisely: `ws_closed_mid_exchange` — the CONNECT tunnel closes right after Chromium's TLS ClientHello, before any server response — consistent with a TLS-fingerprint mismatch between headless Chromium's handshake and something in the egress path, not a certificate-trust or app-config problem. Node's own `fetch` (`NODE_USE_ENV_PROXY=1`) went through cleanly, so the whole pass ran through that instead, calling the app's real functions directly. This means: **the generation/parsing logic below is fully real and live-verified; the Tale Weaving screen's and Chronicle's own UI/click-through were not separately re-verified in this pass.**

## Fixes applied (typecheck + build verified clean after each)

### 1. Fog-of-war gap: Locations/Factions/NPCs could never be hidden in Tale Weaving
Tale Weaving's grammar and parser supported `hidden`/`teaser` on `<lore>` only. Locations and Factions were hardcoded to `discovery: { state: 'known' }` in the Campaign-assembly step regardless of what the model drafted; NPCs got no discovery field at all. The Codex Discovery system and UI (`Codex.tsx`) already fully support hidden entries for every category — this was purely a Tale-Weaving-side content-generation gap.

**Fixed:** extended `hidden`/`teaser` to `<location>`, `<faction>`, `<npc>` across the grammar (`taleWeaverContract.ts`), the parser (`taleWeaverParser.ts`), and the Campaign-assembly mapping (`App.tsx`), reusing the same `validateDiscovery` call lore already used.

**Verified live:** asked for a hidden faction and a hidden NPC — got back "The Revolutionaries" (hidden, real teaser about treasonous whispers) and "Tairnageon" the dragon (hidden, a real teaser about a shadow looming over the Flight Field).

### 2. Arc-phase beat/event count was hardcoded low, even for chapter-mapped requests
The Story Arc phase's own rule text capped output at "3-6 beats" / "2-3 narrative events" no matter what the player asked for. Asking for a Fourth Wing chapter-by-chapter mapping (39 chapters) still only produced 9 beats / 3 events on the first attempt.

**Fixed:** relaxed the rule (`taleWeaverContract.ts`) to explicitly permit scaling into the dozens when source material has a known chapter/arc structure and the player's guidance calls for that granularity.

**Verified live:** re-ran with the same 39-chapter request — got back **exactly 39 beats and 39 narrative events**, one per chapter, in clean chronological/escalating order ("Chapter 1: The General's Mandate" → ... → "Chapter 39: The Ghost of the Past"), matching the book's real progression closely.

### 3. Quest-status parsing bug — silently discarded an entire turn's state updates
Found live, on the prologue turn. The model wrote `<quest stat="active" .../>` for a brand-new quest — a completely natural English word choice, but not in `<quest>`'s actual vocabulary (`advanced|completed|failed` — "active" belongs to `<beat>` instead). The parser's strict vocabulary check rejected it and threw, which — because of the app's existing "self-healing" fallback design — silently discarded the *entire* `<sync>` block for that turn, not just the one bad tag. The prologue's new quest, its NPC introductions (Mira, General Sorrengail), and faction-rep changes were all lost; only the prose survived (via the fallback path).

**Fixed:** `xmlTurnParser.ts` now normalizes `stat="active"` → `"advanced"` for quests specifically (a brand-new quest's first status *is* "advanced," same as progressing one already underway); also clarified the grammar rule text to reduce the model reaching for the wrong word in the first place.

### 4. Security note (flagged, not fixed — only you can act on this)
The live API key you provided is already hardcoded (lightly obfuscated to dodge secret scanners) as `DEFAULT_GEMINI_API_KEY` in `src/lib/store.ts`, committed to the repo, and shipped into the client bundle. **Recommend rotating this key** and removing the hardcoded fallback — happy to do the removal if you'd like, but only you can generate a new key.

## What worked well (no changes needed)

- **Tale Weaving field quality**: World Foundation and Protagonist generation were rich, specific, and genuinely canon-faithful (Basgiath War College, the Riders/Scribes/Healer quadrant structure, Violet's brittle-bone condition, the exact family dynamic) — not generic fantasy filler. Fields that didn't apply were left blank rather than padded.
- **Chronological/lore accuracy of the Arc**: the 39-beat run's ordering and content tracked the real novel's escalation (Threshing/dragon bonding → signet manifestation → War Games at Athebyne → the venin/wyvern reveal → climax) with no obvious out-of-order jumps.
- **Turn narration structure**: paragraph breaks, dialogue isolation, and pacing matched the style rules (`turnContract.ts` 1b/1c) well across every turn sampled — see the transcript.
- **The existing `*asterisks*` Player Statement Override** (documented today as mechanical-stat-claims only) generalized gracefully to a narrative claim in live testing — a fabricated "hidden letter from my father" was woven into the scene with real narrative weight and zero fourth-wall break, with no code changes needed for this to already work at a basic level. (This is a good sign for the separate, not-yet-implemented plan to formally broaden that rule to cover world/power-system overrides too.)
- **API error handling**: the app's Stage-2/Stage-3 fallback design (prose survives even when `<sync>` parsing fails) worked exactly as intended when the quest-stat bug hit — it degraded gracefully instead of crashing the turn.

## What wasn't fully exercised (honest gaps in this pass)

- Only 5 of the planned 10 turns completed live, due to the `gemini-3.5-flash` free-tier daily quota (20 requests) being consumed by the 7 Tale Weaving phase calls plus retries; the remaining turns ran on `gemini-3.5-flash-lite`.
- Didn't reach an actual fog-of-war *reveal* moment in play (an NPC/location/faction transitioning from hidden to known) — the mechanism is verified at the data/generation level, not yet observed live triggering a reveal.
- Didn't click through the Tale Weaving screen's own UI (Phase 7 review/Tale Overview modal, manual-entry validation) live, for the proxy reason above — the underlying data those screens display is now verified sound.
- Item pickup / inventory flow wasn't exercised (no item was picked up in the 5 sampled turns).

## Recommended follow-ups (not done in this pass)

- Rotate the exposed API key and remove the hardcoded fallback in `store.ts`.
- A short follow-up pass once quota resets: re-verify Turn 0 (the prologue) now parses cleanly end-to-end with the quest-stat fix in place, and try to reach a fog-of-war reveal moment live.
- Consider whether `/run-skill-generator` is worth invoking to capture the proxied-Chromium launch pattern as a reusable project skill, if browser-based QC passes are going to recur in this environment.
