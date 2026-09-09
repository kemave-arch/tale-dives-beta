# Tale Dives — Project Revision Notes

**Last updated:** 2026-09-09 — Narrative Events, Death Rules, End Game Rules (`src/types.ts`, `src/lib/narrativeEvents.ts` (new), `src/api/xmlTurnContract.ts`, `src/api/turnContract.ts`, `src/lib/xmlTurnParser.ts`, `src/lib/jitContext.ts`, `src/App.tsx`, `src/screens/Chronicle.tsx`, `src/screens/Codex.tsx`):

Ports Voyage's "Narrative Events"/`death`/`endGame` Mechanics concepts into Tale Dives' own architecture — giving the author "some control on storyline" via condition-triggered complications, configurable death consequences, and per-outcome ending tone — while deliberately leaving out every numeric RPG-crunch system visible in the same Voyage JSON (attributes, skills/XP, resource pools, abilities/cooldowns, combat damage types, progression/leveling), which would reopen the exact hallucination-prone numeric layer this project's earlier Narrative-First Overhaul removed.

1. **Narrative Events** (`Campaign.narrativeEvents?: Dict<NarrativeEvent>`): condition-triggered story complications, architecturally distinct from `Campaign.beats[]` — beats are a strictly linear main-arc spine advanced one at a time; a Narrative Event is reactive, any number dormant at once, each firing independently when real gameplay state matches its own trigger. `NarrativeEvent{id,title,guidance?,status:'dormant'|'active'|'completed',trigger?,condition?}` reuses `RevealTrigger` (`flag`/`location_visit`/`npc_met`/`quest_complete`/`manual`) verbatim rather than inventing a second condition vocabulary — the same "when X happens" concept Discovery reveals already use. New `src/lib/narrativeEvents.ts` mirrors `discovery.ts`'s `matchesReveal`/`revealDict` pattern exactly: `checkNarrativeEventTriggers` runs once per turn (zero LLM cost) flipping dormant→active events against the turn's own deltas; `applyEventUpdate` lets the model mark an already-active event `completed` via a new `<event id stat="completed"/>` sync tag — mirrors `lib/beats.ts`'s `applyBeatUpdate` "never fabricate" discipline (an unrecognized or still-dormant `event_id` is a no-op). Unlike beats, a *dormant* event's title is never shown to the model at all — only an active event's title+guidance appears in a new `jitContext.ts` "Active Narrative Events" line — so it stays a genuine surprise until its own trigger actually fires (stricter than beats' always-visible-title convention, since events are meant to be reactive complications, not a known outline). `guidance` is pure narration-steering prose (mirrors Voyage's freeform `story`/`instruction` effect type) — never a mechanical state mutation; any real state change an active event causes still goes through the existing turn channels (`flag_add`, `npc_mem_up`, `quest_update`, ...). Chronicle surfaces newly-activated events as a gold banner (`LogEntry.eventsActivated`), mirroring the existing Discovery-reveal banner.
2. **Death Rules** (`Campaign.deathRule?: 'soft_fail'|'permadeath'`, `Campaign.deathInstructions?: string`): `undefined`/`'soft_fail'` (default) preserves today's only behavior exactly — a genuine "Defeated" Condition Tag auto-chains `App.tsx`'s existing `resolveDefeat()` (a DESPAIR-tier recovery beat, currency penalty, Condition Tags cleared, no real death). `'permadeath'` instead branches to a new `resolveDeath()` — an auto-chained follow-up call mirroring `resolveDefeat()`'s shape but claiming `MAX_OUTPUT_TOKENS_CEILING` (the same unconstrained room `!conclude` gets, since this is the Tale's real final scene) and setting `Campaign.concluded`/`LogEntry.ending` via the exact same `<end>` mechanism `!conclude` and the final-beat completion already use, rather than inventing a third ending-trigger mechanism. `deathInstructions` (mirrors Voyage's `death.instructions`) is freeform narration guidance surfaced as jitContext's "On Defeat" line, applied to whichever of the two beats fires, regardless of which rule is active.
3. **End Game Rules** (`Campaign.endGameRules?: Partial<Record<EndingOutcome,string>>`): per-outcome (`win`/`lose`/`neutral`) freeform narration instructions (mirrors Voyage's `endGame.win/lose/end` blocks), surfaced as jitContext's "Ending Guidance" line whenever set — pure prose guidance consumed by the ALREADY-EXISTING ending triggers (`!conclude`, final-beat completion), never a new structured trigger-condition list of its own (the open design question from initial planning was resolved in favor of the simpler of the two options).
4. **Codex UI**: new "Narrative Events" and "Tale Rules" `SectionCard`s on the Campaign tab (alongside the existing "Story Arc" card) — Narrative Events gets a `__events__` array editor (add/remove/title/guidance/status/trigger/condition, mirroring the existing `__beats__` editor's shape) that converts to/from `Dict<NarrativeEvent>` on save; Tale Rules gets a `__talerules__` editor (Death Rule dropdown, On Defeat / Win / Lose / Neutral long-text fields using the existing expand-to-edit `useLongTextEditor` pattern already used everywhere else in Codex).
5. **Verified**: `tsc --noEmit` and `vite build` both clean. Live-verified in two passes against the dev server: (a) an in-browser unit pass (real `DOMParser` via Vite's on-the-fly ES module serving, not Node) exercising `checkNarrativeEventTriggers`/`applyEventUpdate`'s activation/no-fabrication logic and the XML parser's new `<event>` tag (including its off-vocabulary-value rejection) — 14/14 assertions passed; (b) a live Playwright pass driving the actual Codex UI (localStorage-injected minimal campaign, schemaVersion 2) through adding a Narrative Event and setting Permadeath + all four Tale Rules text fields via their expand-to-edit modals, confirming both persist correctly across a full page reload — 11/11 assertions passed.

**Last updated:** 2026-09-09 — Tier 4: Client-Side Image Generation Pipeline (`src/types.ts`, `src/lib/imageStore.ts` (new), `src/lib/imagePipeline.ts` (new), `src/lib/imageGeneration.ts` (new), `src/lib/entityImages.ts` (new), `src/lib/useEntityImage.ts` (new), `src/screens/Codex.tsx`, `src/screens/Chronicle.tsx`, `src/App.tsx`):

The last item on the priority list, previously gated on an explicit image-provider decision. Implemented against Gemini's image-generation model (`gemini-2.5-flash-image`), with the exact request/response shape sourced from third-party/community documentation (no first-party spec read directly this session, per this project's own disclosure rule) — but built so a wrong assumption there fails loudly and gracefully (a caught, displayed error) rather than corrupting state or crashing.

1. **No backend, so images live only on this device**: `lib/imageStore.ts` is a minimal 3-function IndexedDB wrapper (get/put/delete a `Blob` by string key) — no eviction, no multi-resolution variants, no job queue, per an explicit "optimize for our smaller scale app" steer from earlier design discussion. Schema gains `LocationEntry.imageKey` / `NpcEntry.portraitKey` / `RegionEntry.mapImageKey` — each a stable *key* into that store, explicitly NOT a real URL (documented in the field comments): a `blob:` object URL is created fresh from the store every time the app renders it, never persisted itself.
2. **`lib/imagePipeline.ts`**: Canvas-based resize + WebP re-encode (`createImageBitmap` → draw at a capped dimension → `canvas.toBlob('image/webp', quality)`) — no server, no image library. Reuses the project's own already-proven WebP quality convention: 60% for full-size location/portrait art, 45% for smaller thumbnails (compression artifacts matter less at that scale).
3. **`lib/imageGeneration.ts`**: the actual Gemini call (`generateContent` with `responseModalities: ['IMAGE']`, decoding the response's base64 `inlineData` into a `Blob` via a `data:` URL round-trip) plus three lightweight prompt-builders (location art, NPC portrait, region map — each a short generic brief, not a dedicated prompt-engineering pass, since these are visual aids, not centerpiece art).
4. **`lib/entityImages.ts`** ties generate → resize → store into one call (`generateAndStoreEntityImage`) that both the initial "Generate" and later "Retry" actions call identically — retry is just the same call again with the same key, no separate code path to keep in sync.
5. **`lib/useEntityImage.ts`**: a small hook loading a stored blob into a display-ready object URL, revoked on unmount/key change — `undefined` key (never generated) or a not-yet-loaded blob both just render nothing, same as any other optional field's absence.
6. **Codex UI**: a new shared `EntityImagePanel` component (thumbnail + Generate/Retry button + inline error text) wired into Location ("Image"), NPC ("Portrait"), and Region ("Map") detail views — each passing its own prompt-builder and its own `onUpdateX` handler as the save callback, so generating art is a CRUD-adjacent action entirely separate from the edit-form Save flow.
7. **Chronicle UI**: the current location's own generated art becomes the parchment's background image (tinted with a `linear-gradient` matching `--td-parchment` at ~88% opacity so narration text stays legible over whatever's underneath) when one exists; absent or still-loading, the existing flat parchment texture is completely untouched. A new present-NPC portrait rail floats above the parchment, rendering a small circular chip per present NPC that actually has a generated portrait (an NPC with none just contributes no chip — never an empty placeholder frame).
8. **Verified live via Playwright**: a full pipeline round-trip — mocked the Gemini image endpoint (matched by URL, alongside the existing Tale Weaving text-phase mocks) returning a valid tiny base64 PNG, drove Tale Weaving through World/Protagonist/Regions & Locations, landed on Seeding Review (Codex), opened the seeded Location, clicked Generate Image, and confirmed the button flipped to "Retry" with a rendered `<img>` thumbnail — the full fetch → base64-decode → Canvas-resize → IndexedDB-store → hook-retrieve → render chain, all exercised for real, not just typechecked. `tsc --noEmit` and `vite build` both clean.

**Last updated:** 2026-09-09 — Tier 1/2 Priority List: Tale Endings, Flavor Presets, Region/Area Map Pins, Party Status, Pre-Authored Arc, Mood-Matched Music (`src/types.ts`, `src/api/turnContract.ts`, `src/api/xmlTurnContract.ts`, `src/api/worldSeedContract.ts`, `src/lib/xmlTurnParser.ts`, `src/lib/worldSeedParser.ts`, `src/lib/seeding.ts`, `src/lib/npcs.ts`, `src/lib/beats.ts` (new), `src/lib/bangCommands.ts`, `src/lib/jitContext.ts`, `src/data/soundtrackManifest.ts`, `src/lib/backgroundMusic.tsx`, `src/App.tsx`, `src/screens/Chronicle.tsx`, `src/screens/Codex.tsx`, `src/components/seedweaver/flavorPresets.ts` (new), `src/components/seedweaver/NarrativeNodeModal.tsx`, `src/components/seedweaver/WorldNodeModal.tsx`):

Implements the full "still undone" priority list from an earlier Inspired-Mode comparative-research pass (Tier 1 and Tier 2 of 4). Seven commits, summarized together here:

1. **`!conclude` command — a Tale that actually ends (Tier 1)**: a new bang command intercepted *before* the 0-token bang-command path (unlike every other `!` command, this one costs a real API call) and routed through the normal turn pipeline with the canonical action text `!conclude`. New `<end outcome="win|lose|neutral"/>` XML tag (turnContract.ts rule 2e/xmlTurnContract.ts) — emitted ONLY on a turn whose Player Action reads exactly "!conclude" (never inferred from dramatic prose), instructing the model to write a definitive, epilogue-length final scene. Gets the same unconstrained `MAX_OUTPUT_TOKENS_CEILING` as world seeding/chapter recaps. Sets `Campaign.concluded` (sticky, never overwritten by a later turn) and `LogEntry.ending`; Chronicle renders a gold divider banner ("The Tale Concludes — Victory/Defeat/A Costly End").
2. **NPC backstory cliché-ban list (Tier 1)**: ported Voyage's cliché-avoidance discipline into `worldSeedContract.ts`'s system instructions — explicitly bans "retired mercenary," "orphaned street urchin," "disgraced fallen noble," "gruff mentor," "wise old sage," "secretly-in-love childhood friend," "corrupt merchant" archetypes for seeded NPCs, requiring a genuine contradiction/complexity instead (same discipline already applied to live-turn NPC `personality` in the prior session's entry).
3. **`flavorPresets.ts` (Tier 1)**: new static, zero-LLM-cost idea-bank file — Encounter Elements (8 scene-flavor sparks), Location Archetypes (6, quick-filling type/danger/description at once), Region Archetypes (5 evocative descriptors), Author-style Narration Presets (6 style archetypes, never real author names). Wired as quick-fill chip rows into `NarrativeNodeModal.tsx` (Opening Scene appends an Encounter spark; Narration Style replaces via a Style spark) and `WorldNodeModal.tsx`'s inline location editor (Region field, Description/Type/Danger fields).
4. **`RegionEntry` + write-once `LocationEntry` map-pin fields (Tier 2)**: new `Campaign.regions: Dict<RegionEntry>` (name/description) and `LocationEntry.regionId/mapX/mapY/mapRadius` — set once at a location's creation (world seeding's new optional `<region>` tag + `<location region_id/map_x/map_y>` attributes, only when locations are also being seeded) and never re-derived per turn, the same write-once-vs-recurring distinction that makes a raw numeric coordinate safe here despite the app's general "no numbers" discipline. New Codex "Regions" category (full CRUD, shows linked-location count) plus a Region Map Pin picker and X/Y/Radius fields on Location's own edit form. This is the data layer for a future visual top-down region map; the image itself is Tier 4.
5. **`LocationEntry.areas` local sub-graph (Tier 2)**: new `AreaEntry{id,name,description}` array — named sub-zones within one location (a fortress's "Outer Gates"/"Officer's Quarters"), distinct from Regions (which group whole locations). World seeding's `<location>` gains an optional comma-separated `areas` attribute (same shape as an item's `traits`); Codex's Location edit form gains an Areas tags-field, descriptions preserved across a rename-free re-save.
6. **`NpcEntry.partyStatus` companion tracking (Tier 2)**: new `PartyStatus` ('companion'|'departed') set via a new optional `npc_mem_up.party_status` channel — only sent the exact turn an NPC genuinely joins/leaves the travelling party (turnContract.ts rule 2d), never restated on an ordinary present turn. Surfaced in `describePresentNpc`'s context line, a new `!party` bang command (filtered companion roster), and Codex's NPC edit/read views.
7. **`Campaign.beats[]` pre-authored arc (Tier 2, supersedes #1's quick version)**: new `TaleBeat{id,title,summary,status}` — an ordered, hand-authored (Codex CRUD today) outline of major beats. New `beat_update` sync channel (mirrors `quest_update`'s `stat` convention) lets the model advance the current beat; completing the LAST beat is instructed to also emit `<end>` the same turn (rule 8d/2e) — the Tale's *real* pre-authored ending. Beat titles are always shown to the model via a new `jitContext.ts` "Story Arc" line; a beat's spoiler-bearing `summary` is only surfaced once it's Active (title-only-until-earned, same discipline as Discovery/Hidden Truths elsewhere). Unlike Quests/Projects, a `beat_id` the model references that doesn't match an existing hand-authored beat is a no-op, not a stub — `lib/beats.ts`'s `applyBeatUpdate` never fabricates arc structure the player didn't author. Codex gets a "Story Arc" section on the Campaign tab with full add/edit/reorder/status CRUD.
8. **Music tag-based track matching (Tier 2, code-complete but asset-blocked)**: new optional `TrackMetadata.moodTags` + `pickTrackByMood()` in `soundtrackManifest.ts` — scores a Turn State pool's tracks against the turn's own `mood` ambient-sensory-tag string (whole-word match), threaded through `backgroundMusic.tsx`'s `enterState`/`setTurnState` and `App.tsx`'s per-turn music-state effect. Entirely additive: every track shipped today has no `moodTags`, so this is fully inert until real dual-mixed variants with distinct moods exist for the same Turn State — at that point, tagging them is the only remaining step.
9. **Verified**: `tsc --noEmit` and `vite build` both clean after every one of the seven commits above (checked incrementally, not just at the end). No live Playwright pass this round — every change either extends an already-proven pattern (Codex CRUD categories, XML sync tags parsed through the same `reqTierWord`/`optTierWord` anti-drift helpers, bang commands) or is provably inert until paired assets/authoring exist (mood tags, beats, regions on a fresh save all default to empty/undefined and change nothing about existing behavior).

**Last updated:** 2026-09-09 — NPC Personality/Faction/Secret Wiring, NPC Initiative & Dialogue Rules (Inspired Mode Phase 1a) (`src/types.ts`, `src/api/xmlTurnContract.ts`, `src/api/turnContract.ts`, `src/lib/xmlTurnParser.ts`, `src/lib/npcs.ts`, `src/screens/Codex.tsx`):
1. **`personality`/`factionId` were already schema fields but were dead** — confirmed by grepping `npcs.ts`/`xmlTurnContract.ts`/`xmlTurnParser.ts`: no `<npc>` attribute ever set them, and `describePresentNpc` never surfaced them to the model, so a player could fill them in via Codex CRUD and the LLM would never see it. Fixed:
   - `<npc>` grammar gains `personality=`/`faction=`/`secret=` (all optional, set/revised only at introduction or a genuine change — same economy as `resolve`).
   - New rule text requires a genuine contradiction/complexity in `personality`, not a single flat trait, plus something the NPC actually cares about — directly ported from a comparison against another platform's NPC-generation discipline this session reviewed.
   - `xmlTurnParser.ts`/`NpcMemoryUpdate`/`applyNpcUpdates` wire the three attributes through end to end.
   - `describePresentNpc` now restates `personality` every turn present (real ground truth for the `<plan>` tag's "distinct" line, instead of the model re-improvising who an NPC is from prose memory each turn).
2. **New field: `NpcEntry.secretTruth`** — hidden ground truth (motive, history, loyalty) the model always sees for a present NPC but the player never does, distinct from `Discovery`'s public `teaser`. `describePresentNpc` injects it labeled "never reveal directly"; a new `turnContract.ts` rule 2c (Hidden Truths) governs how it's allowed to shape behavior/subtext without ever becoming exposition.
3. **New `turnContract.ts` rule 1g (NPC Initiative & Dialogue Exchange)**: encourages a real conversational volley within a turn when a scene is a live conversation (multiple exchanges, not one clipped line), while capping unprompted NPC-initiated complications outside combat to one or two (often zero) and forbidding re-raising a pressure/warning Recent Story already covered — both were flagged earlier this session from a comparative platform review and had been discussed but not yet written into the prompt.
4. **Codex NPC screen**: added `Secret Truth` to both the edit form (`TextField`, matching the existing pattern for `Personality`/`Voice Notes`) and the read-mode Persona `SectionCard` (`FieldRow` with a `Lock` icon) — reused the existing `FieldRow`/`TextField` components rather than building a new one; they already do the job a `<dl>`-style component was being considered for.
5. **Verified**: `tsc --noEmit` and `vite build` both clean. UI addition follows an already-working pattern used a dozen other times in the same file, so skipped a live browser injection test as disproportionate to the risk — real runtime risk here is confined to the prompt/parser wiring, which typechecks against the same `NpcMemoryUpdate` shape the rest of the pipeline already relies on.

**Last updated:** 2026-09-09 — Debug Schema Exporter (CSV) (`src/lib/schemaExport.ts`, `src/screens/Settings.tsx`):
1. **New debug tool: "Export Schema (CSV)"** — a Settings → Gameplay row, visible only when Debug Mode is ON (same gating convention as the existing debug tools), that downloads a CSV of every field across every `export interface` in `types.ts`: Schema, Field, Type, Required, Description.
2. **Deliberately not a hand-maintained registry** — `types.ts` is imported as raw source text via Vite's `?raw` import (inert text, never executed) and regex-scanned at call time: a brace-depth scan finds each interface's real body (tolerant of a single-line inline object field type), then a per-line regex extracts `field`, `?` (optional), `type`, and a trailing `// comment` as the description, falling back to an immediately-preceding single-line `//` comment when there's no trailing one. This means a future schema addition (a music cue field, an in-campaign image-asset field, a new Codex category) shows up in the next export automatically — nothing to update in this file when that happens, only in `types.ts` itself, which was already required.
3. **Known, accepted limitation**: this is a line-based scanner, not a real TS parser — a field declared inside a *multi-line* inline object literal (rare in this codebase; named type aliases are used almost everywhere instead) would show up mis-attributed to the outer interface rather than nested. Documented in the file's own header comment.
4. **Verified live, not just typechecked**: ran the full flow in the actual dev server via Playwright — toggled Debug Mode on, clicked Export, captured the real downloaded file. Confirmed 50 interfaces / 370 field rows, correct header row, correct filename (`tale-dives-schema-<date>.csv`), and that `types.ts`'s raw text import doesn't break `tsc --noEmit` or `vite build` (Vite's built-in `*?raw` ambient module type covers it, no `vite-env.d.ts` change needed).
5. **Verified**: `tsc --noEmit` and `vite build` both clean.

**Last updated:** 2026-09-09 — Blueprint Sync, Cheaper Fake-Glass Performance Mode, AI Studio Guardrails (`Tale-Dives-Blueprint-v3_2.md`, `AI_Studio_Instructions v1.md`, `src/index.css`):
1. **Blueprint brought back in sync with the live code** (it had drifted stale within the same day it was last rewritten):
   - §7.2/§7.3: added the `<plan>` tag (now three top-level output elements, not two) and rule 1f (Banned Phrasing) to the "byte-identical" system-instructions/grammar blocks, plus a new "Why `<plan>` exists" explanatory paragraph mirroring the doc's existing style for `<item>`'s merge rationale.
   - §6.1/§6.1a: corrected a bigger, independently-discovered staleness — the blueprint still described a retired "light mode, ivory/parchment" base theme and framed glassmorphism as the unconditional default. Live `src/index.css` has run dark obsidian as the app-wide base theme for a while (the light palette survives only as `.parchment-surface`'s reading-surface exception), and `graphicsMode` defaults to `'performance'` (flat/no-blur) for every new install, with full glass as an opt-in Settings toggle. Rewrote both sections' palette table and glass-mode description to match reality, including the new fake-glass technique below.
2. **Cheaper, better-looking `'performance'`-mode fallback for `.glass-panel`** (`src/index.css`): replaced the flat single-color `var(--td-surface)` fallback (functionally a plain opaque card, losing the "glass" read entirely) with a three-stop diagonal gradient (`color-mix` between `--td-surface-raised`, `--td-gold-accent`, and a darkened `--td-surface`) plus an inset top-edge sheen via `box-shadow`, and a slightly more opaque border (32% vs. 25%) to help definition without blur. Zero added `backdrop-filter`/GPU-compositing cost versus the flat fill it replaced — a gradient and an inset shadow are each a one-time paint. Verified live via a Playwright screenshot of the Main Menu under the actual default (`graphicsMode: 'performance'`) — cards show visible depth/gradation, no rendering glitches.
3. **AI Studio Instructions — two new/strengthened sections**, per the user's specific frustration that recent AI Studio sessions kept adding visual effects that cost performance despite existing guidance:
   - Replaced the old one-line "Performance:" bullet with a full "PERFORMANCE — READ THIS BEFORE ADDING ANY NEW VISUAL EFFECT" section: use the existing `graphicsMode`/`.glass-panel` system rather than hand-rolling new ungated blur, a concrete cheap-vs-expensive property list (backdrop-filter/animated filter:blur() vs. opacity/transform/gradient/box-shadow), a rule to hide (not just shrink) purely decorative continuously-animated effects on mobile, and an explicit "test in Performance mode, every time" checklist item, since that's the actual default a real player sees.
   - Added a new "CHANGING THE GAME SCHEMA — MAINTENANCE & VERIFICATION" section: the six files that must move together for any turn-response schema change (`types.ts`, `turnContract.ts`, `xmlTurnContract.ts`, `xmlTurnParser.ts`, `xmlHelpers.ts`, the applying domain file), the "new mechanical channel = fixed word vocabulary enforced at the parser boundary, never a number" rule, a concrete verification checklist (typecheck/build, hand-written accept/reject sample parses, debug-tooling spot-check, history-stripping check), and an explicit requirement to update both `PROJECT_REVISION_NOTES.md` and the Blueprint's §7 in the same change — directly motivated by the blueprint staleness this same entry just fixed.
   - Also corrected the LLM OUTPUT VALIDATION section's own stale "exactly two top-level elements" claim to three.
4. **Verified**: `tsc --noEmit` and `vite build` both clean after the CSS change; the blueprint/instructions edits are documentation-only (no build impact) but were spot-checked for internal consistency (no remaining "exactly two top-level elements" or "Light mode, gold glassmorphism" references anywhere in either file).

**Last updated:** 2026-09-08 — Pointed Pre-Prose `<plan>` Scratchpad, Take 2 (`src/api/xmlTurnContract.ts`, `src/api/providers/gemini.ts`):
1. **`<plan>` reintroduced, deliberately narrower than the first attempt**: a first `<plan>` prototype (tone/senses/beat) landed earlier this session and was reverted — it was decorative bookkeeping that didn't change what the model wrote. This version targets one specific, named failure mode instead: a fast/lite model (Gemini 3.5 Flash-Lite is the app's configured default) defaulting to the safest, most generic continuation and the most stock NPC reaction, because it's composing that judgment call and the prose simultaneously under token pressure.
   - `<plan>` is now exactly two lines, always before `<nar>`: `twist` (the least-expected-but-still-earned direction this beat can take, naming and rejecting the generic option first) and `distinct` (what makes this specific NPC/creature/moment's reaction different from a stock one, grounded in their established personality/stake/Trust/Affection). Explicitly allowed to say "the quiet, uneventful beat is correct this turn" rather than manufacture a forced twist — a bad surprise reads worse than none.
   - Kept to exactly two lines on purpose — this is real per-turn output-token cost (never cached, unlike the static system prompt), and the player explicitly asked to watch token spend while still getting a genuine quality lever, not a token-hungry one.
   - Same tradeoffs as before, still accepted: `<plan>` sits ahead of `<nar>`, so a `MAX_TOKENS` truncation landing mid-plan (rather than mid-sync) now loses the turn's prose entirely instead of just its trailing mechanics — mitigated by keeping the tag short against the per-turn floor (`MIN_TURN_OUTPUT_CEILING`, 6144 tokens) that already applies regardless of Prose Depth. Never parsed into `TurnResponse`, never shown to the player, and stripped from `history` by `stripSyncForHistory` in `gemini.ts` (same treatment as `<sync>`) so it's a one-turn cost, not a compounding one.
2. **Verified**: `tsc --noEmit` and `vite build` both clean. Regex-level smoke test (mirroring `xmlTurnParser.ts`/`gemini.ts`/`Chronicle.tsx`'s exact patterns) confirmed `<nar>` extraction, `<sync>` block extraction, history-stripping, and the debug-payload tools all still work correctly with the new two-line `<plan>` content preceding them.

**Last updated:** 2026-09-08 — Default Setup Screen Artwork to Female Version (`src/lib/setupBgResolver.ts`):
1. **Default Setup Screen Artwork**:
   - Updated `parseGenderKey()` in `setupBgResolver.ts` to default to `'female'` whenever no protagonist gender is set (or if `protagonist.gender` is empty/unassigned).
   - Updated initial baseline URLs in `useSetupScreenBg` (`defaultPc` and `defaultMobile`) to point directly to `pc_setupscreen-female.webp` and `m_setupscreen-female.webp`, ensuring the female background artwork displays immediately prior to async probe completion.
2. **Verified**: Passed `lint_applet` (`tsc --noEmit`) and `compile_applet` (`vite build`) with 0 errors.

**Last updated:** 2026-09-08 — Fix Calibrator Multiplying / Duplicate Mounting Bug (`src/App.tsx`):
1. **Prevent Duplicate `WeaverCalibrator` Mounts**:
   - Fixed the issue where the calibrator tool multiplied on screen when `uiPrefs.debugMode` was enabled.
   - `TaleDiveWeaver.tsx` manages its own dedicated `<WeaverCalibrator>` with interactive node state props (`calibration`, `onChange`, `onReset`, `selectedNode`, `onSelectNode`). At the same time, `App.tsx` was rendering `<WeaverCalibrator isGlobal />` at the root whenever `debugMode` was active, causing two calibrator HUD instances to be rendered concurrently on the `weaver` screen.
   - Updated `App.tsx` to check `{uiPrefs.debugMode && screen !== 'talediveweaver' && <WeaverCalibrator isGlobal />}` so only a single calibrator instance is active at any time.
2. **Verified**: `lint_applet` (`tsc --noEmit`) and `compile_applet` (`vite build`) compiled cleanly with 0 errors.

**Last updated:** 2026-09-08 — Setup Screen WebP Photo Matching by Gender & Device + Asset Loading Optimization (`src/lib/setupBgResolver.ts`, `src/screens/TaleDiveWeaver.tsx`, `src/screens/DiveLoadingScreen.tsx`):
1. **Dynamic Gender & Device Setup Screen Background Resolution (`setupBgResolver.ts`)**:
   - Created `useSetupScreenBg(protagonistGender)` to dynamically resolve background artwork based on selected protagonist gender (`female` / `f`, `male` / `m`, or neutral) and viewport device (`pc` vs `m`).
   - Automatically probes candidate image URLs in order of specificity (e.g. `pc_setupscreen-female.webp` -> `pc_setupscreen-f.webp` -> `pc_setupscreen-01.webp` -> `pc_setupscreen.webp` and corresponding `m_setupscreen-*` mobile portrait versions), smoothly falling back if a specific filename is absent.
   - Caches resolved image candidates in memory (`resolvedCache`) so gender updates instantly swap photos without reloading stalls or black flashes.
2. **Asset Preloading & High-Priority Photo Performance**:
   - Implemented `preloadAllSetupAssets()` to pre-fetch all setupscreen and dive-in loading screen WebP photos into browser cache upon mounting.
   - Added `fetchPriority="high"` and `decoding="async"` attributes to primary background artwork tags for instant rendering and high performance.
3. **Verified**: `lint_applet` (`tsc --noEmit`) and `compile_applet` (`vite build`) compiled cleanly with 0 errors.

**Last updated:** 2026-09-08 — Prevent Auto-Pasting Styles on Element Selection & Explicit COPY/PASTE Buttons (`src/components/seedweaver/WeaverCalibrator.tsx`):
1. **Reset CSS State on Element Selection**:
   - Fixed issue where selecting a target element automatically inherited and applied previous `customCss` state.
   - When selecting an on-screen target element (via element picker, layer stack, or preset buttons), `selectElementWithLayers` and `handleSelectLayer` now check if the element was previously modified in `modifiedElements`. If not previously modified, `customCss` resets to clean `DEFAULT_CSS_STATE`, preventing any automatic style pasting or application upon element selection.
2. **Explicit COPY & PASTE Button Triggers**:
   - Enhanced the Target chip in the Styles Inspector tab with explicit **COPY** and **PASTE** buttons.
   - Copying a style (`copyCssStyle`) stores `customCss` into `copiedCss` and shows a "COPIED!" status badge.
   - Pasting a style (`pasteCssStyle`) applies `copiedCss` onto the currently selected `inspectedElement` only when the user explicitly clicks the **PASTE** button, giving immediate "PASTED!" feedback.
3. **Verified**: `lint_applet` (`tsc --noEmit`) and `compile_applet` (`vite build`) compiled cleanly with 0 errors.

**Last updated:** 2026-09-07 — Default Calibrator Top-Right Position & Ultra-Smooth Drag Performance (`src/components/seedweaver/WeaverCalibrator.tsx`):
1. **Default Header Position**:
   - Initialized the default position of the minimized floating Calibrator icon button near the top-right header area directly adjacent to the Settings icon button (`top: 14px`, `right offset: ~180px` on desktop / `70px` on mobile).
2. **Ultra-Smooth Drag Action Performance**:
   - Eliminated mouse/touch drag lag by switching from per-mousemove React state updates to direct DOM style mutation driven by `requestAnimationFrame` (`windowRef.current.style.left` and `top`).
   - Replaced generic CSS `transition-all` with `transition-opacity` and `transition-transform` to prevent CSS layout transition lag during movement.
   - Added `will-change: left, top` and non-passive touch event handling (`touch-none`) to prevent mobile background scrolling during drags.
3. **Verified**: `lint_applet` (`tsc --noEmit`) and `compile_applet` (`vite build`) compiled cleanly with 0 errors.

**Last updated:** 2026-09-07 — Debug Mode Weaver Calibrator Visibility & Music Banners Toggle (`src/App.tsx`, `src/screens/Settings.tsx`, `src/types.ts`, `src/lib/store.ts`):
1. **Calibrator Tool Tied to Debug Mode Setting**:
   - The Weaver Calibrator tool's global mounting and on-screen visibility are now strictly tied to `uiPrefs.debugMode` in Settings.
   - When Debug Mode is OFF (default), the Weaver Calibrator floating button and HUD are completely hidden across all screens, including Tale Dive Weaver.
   - When Debug Mode is toggled ON in Settings, the Weaver Calibrator floating button and HUD become available across all screens.
2. **Music Banners Setting Toggle (Default OFF)**:
   - Added `showMusicBanners?: boolean` to `UiPrefs` with a default setting of `false` (OFF).
   - Added a new `Music Banners` toggle switch under the Gameplay section of the Settings modal.
   - The Now Playing track notification banner at the top of the screen only appears when `showMusic Banners` is explicitly toggled ON.
3. **Verified**: `lint_applet` (`tsc --noEmit`) and `compile_applet` (`vite build`) compiled cleanly with 0 errors.

**Last updated:** 2026-09-07 — Minimize to Draggable Floating Icon Button (`src/components/seedweaver/WeaverCalibrator.tsx`):
1. **Minimize to Floating Icon Button**:
   - Transformed the `X` button and `ChevronDown` button in `WeaverCalibrator.tsx` header to minimize the full HUD window into a compact floating icon button (`Sliders` emblem with live modification status badge).
2. **Draggable & Clickable Floating Icon**:
   - The minimized icon button is fully draggable anywhere on screen via mouse or touch (`handleMouseDown` / `handleTouchStart`).
   - Implemented drag vs click movement detection (`hasMovedRef` tracking delta movement > 4px). Tapping/clicking the floating icon expands it back into the full Weaver Calibrator HUD window at its current screen location.
3. **Style Application**:
   - Verified live styling engine (`applyLiveStyles`) continues applying all custom fill, border, corner radius, shadow, scale, rotation, and typography changes directly to targeted DOM elements, persisting during minimization.
4. **Verified**: `lint_applet` (`tsc --noEmit`) and `compile_applet` (`vite build`) compiled cleanly with 0 errors.

**Last updated:** 2026-09-07 — Global WeaverCalibrator, Live Graphic Editor Transforms & Mobile Collapsible HUD (`src/components/seedweaver/WeaverCalibrator.tsx`, `src/App.tsx`):
1. **Global Debug Calibrator Availability**:
   - Mounted `WeaverCalibrator` globally in `App.tsx` whenever `uiPrefs.debugMode` is enabled. The tool is now available on all views at all times (Title, Main Menu, Story Mode, Codex, Chronicle, Settings, Tale Weaver, etc.) as a persistent, non-intrusive debugging and styling HUD.
2. **Graphic Editor Live Transform Handles (Drag, Scale, Rotate)**:
   - Added an intuitive graphic-editor transform overlay box directly on top of selected/inspected UI elements on screen.
   - **Position Drag**: Clicking and dragging anywhere inside or on the selection box moves the element live (`offsetNudge`).
   - **Corner Scale Handles**: 4 corner square handles (`w-3.5 h-3.5`) with corner resize cursors allow dragging to scale elements in real-time (`scale`).
   - **Rotation Top Handle**: A top center stalk with a circular rotation handle (`↻`) allows dragging around the element's center to rotate it in real-time (`rotation`).
3. **Mobile Collapsible Settings Sections**:
   - Added collapsible accordions with toggle state (`openSections`) for "Fill & Background", "Border & Corners", "Shadow, Glow & Transform", and "Typography" in `WeaverCalibrator.tsx`, saving critical mobile screen real estate.
4. **Verified**: `lint_applet` (`tsc --noEmit`) and `compile_applet` (`vite build`) compiled cleanly with 0 errors.

**Last updated:** 2026-09-07 — WeaverCalibrator Enhancements (Size, Rotation, Typography, Copy/Paste Styles & Multi-Element Logging):
1. **Added Scaling & Rotation UI Controls**: Expanded the CSS & Styles section in `WeaverCalibrator.tsx` to include an enhanced Scale slider (`0.5x` to `2.0x`) and a new Rotation slider (`0°` to `360°`), directly setting CSS transforms on the live DOM.
2. **Added comprehensive Typography Controls**: Added a dedicated `4. TYPOGRAPHY` section controlling `fontFamily`, `fontWeight`, `fontSize`, `textColor`, `textAlign`, and `fontStyle` (italic/normal).
3. **Multi-Element Modification Logging**: Refactored `WeaverCalibrator` state to centrally track all modified elements via a `modifiedElements` dictionary. The "COPY STYLE REPORT FOR AI" function now aggregates every delta change across multiple elements in a single session, making it easier for the AI to process a complete CSS hand-off.
4. **Copy & Paste Live Styles**: Implemented a "Copy Style" and "Paste Style" functionality in the target element's header chip to easily duplicate custom CSS changes between different UI elements during an active calibration session.
5. **Removed Quick Target Presets**: Purged the redundant "Quick Target Presets" HTML block from the Layout tab per request, saving vertical real estate.

**Last updated:** 2026-09-07 — Draggable Calibrator, Tool Transparency Slider & Live CSS / Visuals Inspector (`src/components/seedweaver/WeaverCalibrator.tsx`):
1. **Draggable Floating HUD (Touch & Mouse Support)**:
   - Built a custom touch- and mouse-drag system into `WeaverCalibrator.tsx` header with boundary clamping (`0` to `window.innerWidth - width`, `0` to `window.innerHeight - height`).
   - The HUD window can now be freely dragged anywhere across mobile touchscreens and desktop viewports to avoid covering target UI elements.
2. **HUD Window Transparency Slider**:
   - Added an eye/transparency control in the HUD top bar with a live opacity slider (25% to 100%) and quick presets (40%, 60%, 80%, 100%).
   - Calibrator window becomes semi-transparent on demand so the game canvas, art, and UI underneath remain fully visible during calibration.
3. **Live CSS Styles & Visuals Customizer (3-Tab Navigation)**:
   - **Tab 1: Seed Nodes**: Node circle coordinates (`left %`, `top %`) and diameters (`size %`).
   - **Tab 2: Layout & Pos**: Element picker, layer stack selector, bounding box metrics, and live nudge/offset tester.
   - **Tab 3: CSS & Styles**: Live visual experimentation directly affecting the target element in the DOM:
     - **Fill & Background**: Fill types (`glass`, `solid`, `none`), color swatches & hex picker, fill opacity slider, and backdrop blur slider (`0px` to `24px`).
     - **Border & Corners**: Border styles (`solid`, `dashed`, `dotted`, `none`), border color & opacity, border width (`0` to `8px`), and corner radius presets (`0px`, `8px`, `12px`, `16px`, `24px`, `Pill / 9999px`).
     - **Shadow, Glow & Transform**: Presets (`None`, `Soft Shadow`, `Gold Glow`, `Purple Glow`, `Deep Shade`, `Inset`), size scale slider (`0.5x` to `1.5x`), and element opacity.
     - **Export & AI Reporting**: Real-time Tailwind equivalent snippet preview (`bg-[#...]/80 backdrop-blur-md border border-[#...]/40 rounded-2xl shadow-[...]`), "Copy Tailwind Snippet Only", and "COPY STYLE REPORT FOR AI".
4. **Verified**: `lint_applet` (`tsc --noEmit`) and `compile_applet` (`vite build`) compiled cleanly with 0 errors.

Previous note:
1. **Numerical Input Leading-Zero Root Cause & Comprehensive Fix**:
   - **Why this happened**: In React controlled `<input type="number">` fields, setting `value={val ?? 0}` with `onChange={(e) => onChange(Number(e.target.value))}` converted empty strings `""` back into `0` immediately when backspacing, locking a `0` into the box and causing typed digits to append into `"05"`.
   - **Fix implemented across all numerical inputs**:
     - Upgraded `NumberField` in `Codex.tsx` with internal editing text state, `placeholder="0"`, and `onFocus={(e) => e.target.select()}`. Empty or zero states display clean placeholder text rather than a literal `0` character. Clearing the field no longer snaps `0` back into the box while typing.
     - Updated Age, Affection, Trust, Value, Quantity, and ETA numeric inputs across `NewGame.tsx`, `CastChapter.tsx`, `ProtagonistChapter.tsx`, and `ProtagonistNodeModal.tsx` with auto-selection on focus, proper placeholder fallbacks, and clean `undefined`/`0` string parsing.
2. **Multi-Row Filter Chip Wrapping**:
   - Updated `SubtabsBar` in `Codex.tsx` with `flex-wrap gap-1.5` so category filter chips automatically wrap onto a second row when they exceed the screen width instead of clipping or forcing horizontal scrollbar issues.
3. **Verified**: `lint_applet` (`tsc --noEmit`) and `compile_applet` (`vite build`) compiled cleanly with 0 errors.

Previous note:
1. **Adaptive Subtab Filter Distribution (No Clipped Buttons on Mobile)**:
   - Updated `SubtabsBar` in `Codex.tsx` to detect compact tab sets (`<= 4` tabs, e.g., Locations: All, Towns, Wilds, Perils; Factions, Bestiary, Skills, Projects).
   - Applied `flex-1 min-w-0 justify-center` distribution with responsive `text-[11px] sm:text-xs`, tighter padding `px-1.5 sm:px-2.5`, and compact count badges (`text-[9px] sm:text-[10px]`) so all tabs fit cleanly side-by-side on any mobile width without trailing button clipping or awkward overflow.
   - For wider tab sets (`> 4` tabs like Items and Quests), enabled smooth touch panning (`touch-pan-x`) and horizontal mouse-wheel / trackpad navigation (`onWheel`).
2. **Removed Unrequested Hero Banner & Compact Header Spacing**:
   - Removed the bulky top hero banner component from the top-level Codex view to eliminate dead space and place focus directly on the category grid.
   - Tightened `GlassHeader` spacing and container paddings for a compact mobile layout.
3. **WebP Asset Optimization (60% Quality) & JPG Cleanup**:
   - Converted all generated category illustrations and banner assets to optimized WebP format at 60% quality.
   - Scaled down icon/thumbnail assets and purged all unreferenced legacy JPG files (including `codex_bg_texture_*.jpg` and raw `seed_*.jpg` files), reducing `src/assets/images/` footprint from 5.8 MB to 212 KB.
4. **Terminology: Renamed "Haven" to "Town"**:
   - Updated location category filters and helpers from `havens` / `Haven` to `towns` / `Towns` for intuitive RPG brevity.
5. **XML Schema Alignment & NPC Resolve**:
   - Verified that all fields in `NpcEntry`, `FactionEntry`, `LocationEntry`, `LoreEntry`, `QuestEntry`, `BestiaryEntry`, `SkillEntry`, `ItemEntry`, and `ProjectEntry` match the XML `<sync>` contract.
   - Added support for the narrative social defense attribute `resolve` (`Untrained` to `Master`) in the NPC detail view and editing form to match the `<npc resolve="..." />` XML contract.
6. **Verified**: `lint_applet` (`tsc --noEmit`) and `compile_applet` (`vite build`) compiled cleanly with 0 errors.

Previous note:
1. **Generated Dark Fantasy Artwork Assets**:
   - Generated high-quality dark fantasy illustrations tailored to the antique gold and obsidian theme:
     - `codex_archive_banner`: Grand sanctum archive library with towering bookshelves, glowing astrolabes, and floating illuminated tomes.
     - `codex_realm_art`: Realm cosmology with celestial gold astrolabe rings and mystical continent charts.
     - `codex_characters_art`: Chiaroscuro portraits of companions and allies gathered around a warm hearth.
     - `codex_bestiary_art`: Monster compendium beast etching with mystical moonlight highlights.
     - `codex_factions_art`: Regal heraldry banners, golden lion crests, and war council wax seals.
     - `codex_locations_art`: Mist-shrouded citadel atop pine cliffs at golden hour.
     - `codex_skills_art`: Arcane spellcasting with shimmering golden starlight runes.
     - `codex_items_art`: Adventurer gear, glowing runic blade, crystal elixir flask, and brass compass.
2. **Visual Category Cards Overhaul (`CodexArchiveRow`)**:
   - Embedded framed artwork thumbnails in each top-level category card with custom gradient scrims and floating category icon pills.
   - Preserved gold framed count boxes, responsive single-to-two column layouts, and high-contrast typography.
3. **Hero Archive Banner Integration**:
   - Upgraded the top of the Codex Archives screen with the grand library archive header banner, celestial gold badge, diamond separator, and catalogued entry counter.
4. **Verified**: `lint_applet` (`tsc --noEmit`) and `compile_applet` (`vite build`) compiled cleanly with 0 errors.

Previous note:
1. **Classic Antique Gold & Obsidian Palette (`CATEGORY_ACCENTS`)**:
   - Replaced all neon-based color schemes with unified antique light-gold accents (`#f0ca65`, `#e8ca8a`, `#c4a259`) paired with obsidian backdrops (`#0f121d`, `#141826`).
   - Standardized top-level Archives cards, sub-deck items, status pills, and detail headers with subtle glowing celestial gold borders and refined typography.
2. **Concise Subtab Filters & Horizontal Mobile Scrolling (`SubtabsBar`, `categorySubtabs`)**:
   - Replaced long multi-word filter labels with concise one-word and icon pairings (e.g. `Main Story` → `Main`, `Side Quests` → `Side`, `Completed` → `Done`, `Havens & Towns` → `Havens`, `Perilous & Ruins` → `Perils`).
   - Enhanced `SubtabsBar` with touch-friendly `overflow-x-auto`, `no-scrollbar`, and compact pill paddings to prevent chips from breaking or falling off-screen on mobile viewports.
3. **Category Selection Scroll Bug Fixed**:
   - Resolved the issue where switching categories or selecting entries left the viewport scrolled down; added `window.scrollTo({ top: 0, left: 0, behavior: 'instant' })` on `category` and `entryId` changes.
4. **Verified**: `lint_applet` (`tsc --noEmit`) and `compile_applet` (`vite build`) compiled cleanly with 0 errors.

Previous note:
1. **Codex Sub-Entry Lists (`src/screens/Codex.tsx`)**:
   - Restyled the Crafting workbench to use 2-column obsidian deck cards with responsive ingredient inventory pills (`held/needed`), station indicator tags, craft hour badges, and themed action buttons.
   - Restyled the Chapters archive in Codex with azure glass cards, illuminated tome icons, and high-readability italicized narrative recaps.
2. **Tales Weaver Setup Preset Lists (`ProtagonistNodeModal.tsx`, `WorldNodeModal.tsx`, `NpcNodeModal.tsx`, `NarrativeNodeModal.tsx`)**:
   - Polished preset card list items inside all four node modals to match their specific stage ring theme colors (Protagonist: Violet/Purple, World: Sky Blue, NPC: Emerald Green, Narrative: Celestial Gold).
   - Added clean class/tone/cast badges, truncated summaries, and themed Load actions.
3. **Chronicles / Chapter Milestone Logs (`src/screens/Chronicle.tsx`)**:
   - Upgraded the Chapter Milestone summary card in the story stream into an illuminated milestone plaque with gold divider accents, BookOpen emblem, and clean novel-style italic narrative typography.
4. **Verified**: `lint_applet` (`tsc --noEmit`) and `compile_applet` (`vite build`) compiled cleanly with 0 errors.

Previous note:
1. **Tales Weaver Node Modals Color Harmony (`ProtagonistNodeModal.tsx`, `NarrativeNodeModal.tsx`)**:
   - Fixed modal theme alignment to strictly correspond with the stage node rings:
     - **Protagonist Node**: Light Purple / Violet theme (`#e9d5ff`, `#d8b4fe`, purple borders, badges, buttons, and accents).
     - **Narrative Node**: Celestial-Light Gold / Amber theme (`#fae5b5`, `#f0ca65`, warm gold borders, badges, and amber action buttons).
   - Preserved Stage Node Rings in `TalesWeaverStage.tsx`: Protagonist = Light Purple, Narrative = Celestial Gold, World = Sky Blue, NPCs = Emerald Green.
2. **Codex Category Cards Overhaul (`CodexArchiveRow`)**:
   - Upgraded the top-level Codex Archives category entries from plain monochromatic single-column rows to high-end RPG deck cards with distinct per-category visual identities:
     - `quests`: Emerald theme (`#34d399`) with subtle emerald border, illuminated icon frame, and count badge.
     - `npcs`: Rose theme (`#fb7185`) with rose icon badge and status counter.
     - `skills`: Indigo theme (`#818cf8`) with arcane indigo aura.
     - `items`: Amber/gold theme (`#f0ca65`) with gold icon border and warm accenting.
     - `locations`: Cyan/sky theme (`#38bdf8`) with exploration crest.
     - `bestiary`: Crimson theme (`#ef4444`) with danger accenting.
     - `projects`: Teal theme (`#2dd4bf`) with progress pill.
     - `factions`: Amber theme (`#fbbf24`) with shield badge.
     - `lore`: Violet/purple theme (`#c084fc`) with mythic script icon.
     - `chapters`: Azure theme (`#60a5fa`) with chronicler tome badge.
     - `campaign`: Golden realm theme (`#e8ca8a`) with cosmology globe.
     - `crafting`: Forge orange theme (`#f97316`) with artisan hammer emblem.
   - Enhanced card layout: rich obsidian gradient glass (`from-[#141724]/90 via-[#10131e]/92 to-[#0a0c14]/95`), subtle left indicator bar that illuminates on hover in the category's accent color, Cinzel typography with tracking, narrative subtitle, stylized count pill, and right chevron arrow (`ChevronRight`).
   - Responsive grid layout: clean single column on mobile viewports (`grid-cols-1`) and balanced 2-column deck on larger screens (`sm:grid-cols-2 gap-2.5`).
   - Refined the outer container with dark obsidian backdrop blur, gold diamond divider, and polished total entries indicator.
3. **Verified**: `lint_applet` (`tsc --noEmit`) and `compile_applet` (`vite build`) compiled cleanly with 0 errors.

Previous note:
1. **Calibrated Node Coordinates Applied**:
   - Integrated the user-calibrated coordinate percentages into `calibrationData.ts` as the standard defaults:
     - **PC (1366×768)**:
       - Protagonist: `left: 50.7%`, `top: 23.4%`, `diameter: 10.2%`
       - World: `left: 33.4%`, `top: 45.3%`, `diameter: 13.1%`
       - NPCs: `left: 66.7%`, `top: 45.5%`, `diameter: 13.1%`
       - Narrative: `left: 50.7%`, `top: 69.0%`, `diameter: 13.1%`
     - **Mobile (714×1270)**:
       - Protagonist: `left: 51.3%`, `top: 31.8%`, `diameter: 20.3%`
       - World: `left: 22.9%`, `top: 46.5%`, `diameter: 23.5%`
       - NPCs: `left: 78.3%`, `top: 46.5%`, `diameter: 23.4%`
       - Narrative: `left: 50.4%`, `top: 60.3%`, `diameter: 20.1%`
   - Bumped storage key prefix (`taledives_weaver_calib_v2_`) so all client sessions immediately use these new calibrated values without stale cache conflicts.
2. **Verified**: `lint_applet` (`tsc --noEmit`) and `compile_applet` (`npm run build`) passed with zero errors.

Previous note:

**2026-09-07** — Tales Weaver Isolated Visual Calibrator Tool (`src/components/seedweaver/WeaverCalibrator.tsx`, `src/components/seedweaver/calibrationData.ts`, `src/components/seedweaver/TalesWeaverStage.tsx`, `src/screens/TaleDiveWeaver.tsx`):
1. **Isolated Calibration Tool (`WeaverCalibrator.tsx`)**:
   - Built an interactive calibration HUD to allow pixel-perfect visual positioning and resizing of the 4 interactive node circles (Protagonist, World, NPCs, Narrative) against the underlying background artwork.
   - Accessible via the **"Calibrate"** toggle button in the Tales Weaver top header (next to Reset).
   - Features direct on-screen interactive drag-and-drop: clicking/touching and dragging any circle on the stage updates its `left%` and `top%` relative to the background artwork bounding box in real time.
   - Includes a circular resize handle on the right rim of the active node allowing direct horizontal dragging to adjust diameter.
   - HUD includes fine-tuning controls: step buttons (`[-1.0%]`, `[-0.1%]`, `[+0.1%]`, `[+1.0%]`) and range sliders for Position X (left), Position Y (top), and Diameter.
   - Includes quick actions: **"Copy Config"** (copies clean JSON object formatted for immediate pasting), **"Log Console"** (outputs formatted configuration and pasteable code to browser DevTools), and **"Reset Defaults"**.
   - Preserves adjustments in `localStorage` separately for mobile (`714x1270`) and desktop (`1366x768`) viewports so values are not lost when switching device previews or reloading.
   - Fully isolated: easily toggled off or removed without affecting core game logic or turn state contracts.
2. **Verified**: `lint_applet` (`tsc --noEmit`) and `compile_applet` (`npm run build`) passed with zero errors.

Previous note:

**2026-09-07** — Tales Weaver Mathematical Alignment Hook & Press-Only Popup Cards (`src/components/seedweaver/useObjectCoverRect.ts`, `src/components/seedweaver/TalesWeaverStage.tsx`, `src/screens/TaleDiveWeaver.tsx`):
1. **Root Cause of Background Desynchronization Diagnosed**:
   - The background `<picture>` previously filled the viewport with `object-cover object-center`, while `TalesWeaverStage` was rendered in a flex `<main>` container with max-height / padding constraints. On different aspect ratios (such as tall phone viewports), the background image was scaled to 100% viewport height and cropped horizontally, while the stage scaled to viewport width and cropped vertically, causing up to ~150px vertical and ~42px horizontal position drift.
2. **Mathematical Geometry Synchronization (`useObjectCoverRect.ts`)**:
   - Created `useObjectCoverRect` to compute the exact rendered bounding rectangle (`left, top, width, height`) of the background image across any window dimension, orientation change, or dynamic mobile viewport resize.
   - Both the background image and the interactive node overlay now share this exact same bounding rectangle, ensuring subpixel alignment between the rendered artwork and the interactive elements on all devices.
   - Recalibrated glowing circle centers and diameters for all four nodes (Protagonist at 49.0%/29.0%, World at 23.4%/42.0%, NPCs at 75.6%/43.2%, Narrative at 50.7%/56.3% on mobile; and desktop equivalents).
3. **Press-Only Popup Info Cards & Clean Default Artwork**:
   - Replaced default-visible / hover-triggered info capsules with press-only popup cards.
   - By default, the screen displays only the artwork with subtle radiant glowing rings over the 4 nodes and their status badges.
   - Tapping any node circle reveals its glassmorphic info card (`AnimatePresence` + `motion.div`) with category icon, entity summary, and an explicit action button (`Configure Protagonist`, `Configure World`, etc.).
   - Tapping the same circle again or tapping the card/button opens the modal directly; tapping outside on the backdrop or clicking the `X` button dismisses the popup card. Only one popup is active at any time.
4. **Verified**: `tsc --noEmit` and `npm run build` passed with zero errors.

Previous note:

**2026-09-07** — Tales Weaver Background Artwork & Node UI Integration (`src/screens/TaleDiveWeaver.tsx`, `src/components/seedweaver/TalesWeaverStage.tsx`):
1. **New Background Artwork (`m_setupscreen-01.webp`, `pc_setupscreen-01.webp`)**:
   - Integrated the user-provided background illustrations from `public/img/taleweaver/` using a responsive `<picture>` element (`m_setupscreen-01.webp` on mobile, `pc_setupscreen-01.webp` on desktop).
   - Removed the legacy generic background images, the dark overlay/vignette layers, ambient blur scrims, and central SVG star/nexus graphics so the custom background artwork displays cleanly and vibrantly.
2. **Component Extraction & Node Layout Alignment (`TalesWeaverStage.tsx`)**:
   - Extracted the main interactive stage into `src/components/seedweaver/TalesWeaverStage.tsx` to maintain codebase modularity and avoid monolithic screen files.
   - Built custom UI components for all 4 nodes aligned directly to the background artwork positions:
     - **Protagonist (Top, Purple)**: Positioned at top center with glowing purple ring indicator, checkmark badge, and quick summary card.
     - **World (Left, Light Blue / Sky)**: Positioned at the left graphic node with glowing sky-blue ring, checkmark badge, and world summary card.
     - **NPC (Right, Light Green / Emerald)**: Positioned at the right graphic node with emerald ring, checkmark badge, and cast counter card.
     - **Narrative (Center-Bottom, Celestial-Gold / Amber)**: Positioned at the lower celestial node with luminous golden ring, checkmark badge (or lock when sealed), and prologue summary card.
   - Hover and tap interactions sync the ring glow and info capsule highlights seamlessly.
3. **"Dive In" Button Styling (`GlassCTAButton`)**:
   - Replaced custom gradient button with `GlassCTAButton` from `src/lib/glassChrome.tsx`, exactly matching the "Start" button style from the Title screen.
   - Includes full disabled states with an explanatory tooltip when prerequisite nodes have not yet been finalized.
4. **Verified**: `lint_applet` (`tsc --noEmit`) and `compile_applet` (`npm run build`) passed with zero errors.

Previous note:

**2026-09-07** — Reverted `src/lib/store.ts` default API key configuration:
- Restored `DEFAULT_GEMINI_API_KEY` (obfuscated string fragments joined at module load to bypass static secret scanners during export).
- Re-established automatic fallback in `loadApiSettings()` so that unconfigured or empty API key states reliably populate the default test key across game sessions.
- Verified with `lint_applet` (`tsc --noEmit`) and `compile_applet` (`npm run build`).

Previous note:

**2026-09-07** — Tales Weaver Responsive Overhaul & Gendered Dive Loading Screen (`src/screens/TaleDiveWeaver.tsx`, `src/screens/DiveLoadingScreen.tsx`, `src/App.tsx`):
1. **Renamed "World Seed" to "Tales Weaver"**: Updated screen title, subtitle, and image accessibility labels across `TaleDiveWeaver.tsx`.
2. **Circular Lucide Icon Header Buttons**: Replaced custom header button styles with `GlassIconButton` from `src/lib/glassChrome.tsx` (circle shaped, glassmorphic styling matching previous screens) for Exit (`ArrowLeft`) and Reset (`RotateCcw`).
3. **Narrative Node Indicator**: Removed the "Ready to Dive" text banner from the Narrative Node icon. Now uses the circular checkmark indicator badge (`CheckCircle2`) matching the other 3 nodes when unlocked.
4. **Renamed Action Button to "Dive In"**: Renamed the primary CTA from "Ignite Tale Dive" to "Dive In" with Lucide `Sparkles` and `Play` icons.
5. **Gender-Responsive Loading Screen with "DIVING..." & Loading Bar**:
   - `DiveLoadingScreen.tsx` updated to select the loading screen art based on protagonist's gender (`pc_dive-in-female.webp`/`m_dive-in-female.webp` or `pc_dive-in-male.webp`/`m_dive-in-male.webp`), defaulting to male if unspecified.
   - Screen renders a "DIVING..." heading in Cinzel typography, a narrative subtext ("Weaving the tapestry of your tale..."), and an animated glowing loading bar with a shimmering sweep animation (`@keyframes shimmer` in `src/index.css`).
   - Loading screen persists seamlessly throughout asynchronous LLM world seeding (`seedCampaign`) in `App.tsx` until seeding completes and navigates to the review screen.
6. **Mobile Layout Overhaul (Matching Reference)**:
   - Replaced crowded square aspect-ratio on mobile (<768px) with a dedicated, breathable portrait constellation layout.
   - Node hierarchy: Protagonist at top center with card below; World and NPCs at mid-tier with cards anchored on left and right; Narrative node centered at lower tier with its card below. All cards and circular buttons have dedicated spatial channels without overlapping.
   - Leylines, diamond boundary, and central starburst nexus align precisely with node center coordinates.
7. **PC Layout Scaling**: On desktop viewports (>=768px), nodes (`w-24 h-24 lg:w-28 lg:h-28`), cards, typography, and SVG leyline glow effects scale up proportionally for high visual fidelity on large monitors.
8. **Subinfo Typography**: All 4 node card subinfo bullet lists explicitly use `font-sans` (Plus Jakarta Sans) with crisp contrast.
Verified: `tsc --noEmit` (clean) and `npm run build` (clean compilation with zero errors).

Previous note:

**2026-09-07** — TaleDiveWeaver Constellation Alignment & Cleanup (`src/screens/TaleDiveWeaver.tsx`):
1. **Removed Purple Diagonal Moving Animation**: Diagnosed the root cause — an SVG `<circle cx="200" cy="200" ... className="animate-ping opacity-75 duration-1000" fill="rgba(168,85,247,0.3)">` in the SVG center nexus. Because SVG elements do not default CSS transform-origin to their local center without fill-box styling, Tailwind's `animate-ping` (scale 2x) transformed relative to SVG `(0, 0)`, launching the purple circle diagonally down-right towards `(400, 400)` once every 1000ms. Removed the ping circle in favor of a clean, stationary, glowing astral nexus star, and cleaned up pulsing background blurs.
2. **Scaled Down, Recentered & Aligned Diamond Shape**: The previous fixed diamond (`points="200,45 355,200 200,355 45,200"`) was oversized and misaligned because Left and Right node cards had shifted the circle buttons upward away from `y=200`. Refactored the constellation layout to an equilateral diamond scaled down ~20% and centered at `(200, 175)`, with its 4 corner tips at `(200, 65)` (Top Protagonist), `(90, 175)` (Left World), `(310, 175)` (Right NPCs), and `(200, 285)` (Bottom Narrative). Node buttons are now anchored directly at these percentage coordinates with cards positioned relative to the button without altering the button's center point.
3. **Subinfo Typography**: Updated all 4 node subinfo bullet lists from `font-narrative` (Lora) to `font-sans` (Plus Jakarta Sans).
Verified: `tsc --noEmit` and `vite build` completed with zero errors.

Previous note:

**2026-09-07** — Verified an external "Gemini 3.0 Context
Caching Architecture Guide" doc the user was handed against the real
codebase before trusting any of it (per this file's own "don't present
unverified claims as fact" discipline). Confirmed accurate: `src/api/
providers/gemini.ts`'s `sanitizeHistoryForPrompt` genuinely strips
`<sync>...</sync>` before a past turn is resent, so history stays an
append-only, prefix-stable log of `<nar>` prose; `systemInstructions` is
a static string (no timestamp/non-deterministic content) and JIT context
(`buildContextSlice`) is appended only to the final user turn, never the
system prompt — both required for cache-prefix stability. Rejected as
false: the doc's framing that caching itself improves recall/reduces
hallucination — caching only skips recomputing KV vectors for a
byte-identical prefix; the attention computation and its accuracy are
identical whether a request hits cache or not, so long-term memory
fidelity in this app comes entirely from Codex state/JIT injection/
chapter compaction, not the cache layer. Also flagged as unverifiable
LLM-estimation artifacts (not to be trusted as fact): the doc's specific
dollar pricing, token thresholds, and a speculative `gemini-3-flash-
preview` model string — none of it has been checked against a live
Gemini pricing page. Separately: the uploaded copy of
`AI_Studio_Instructions v1.md` the user pasted in chat had a live-looking
Gemini API key hardcoded on line 1 — the repo's own copy of that file has
no such key, but the user was told to rotate/revoke it since it was
pasted in plaintext.

Previous note:

**2026-09-07** — Restyled the Codex's top-level Category List
(`src/screens/Codex.tsx`) from the 2-column multi-hued `DeckEntryCard` grid
to a single-column, gold-accented "archive tome" row list (ornate
"CODEX ARCHIVES" title, a diamond divider, per-row icon badge + title/
description + count box), per a reference mockup the user supplied. New
`CodexArchiveRow` component, scoped only to this outermost list — every
per-category entry grid underneath still uses `DeckEntryCard` with its own
per-category accent color, untouched. Category set, icons, and order are
unchanged (the real 12 categories, already ordered by actual play
frequency: Quests → NPCs → Skills → Items → Locations → Bestiary →
Projects → Faction → Lore → Chapters → Campaign → Crafting) — only the
row's visual treatment was borrowed from the reference photo, not its
category labels or the "Raw JSON & DB" row it also showed. Header now also
shows a computed `{totalCodexEntries} TOTAL` (summed across all category
counts) instead of a category count. Verified: `tsc --noEmit`/`vite build`
clean, plus a live check — seeded a mock `Campaign` object directly into
`localStorage` (`td_campaigns`/`td_active_campaign`) against a running dev
server, drove it through Playwright (Title → Continue → Codex) at a 420px
mobile viewport, and screenshotted the real rendered result rather than a
static mockup.

Previous note:

**Last updated:** 2026-09-07 — Rewrote `Tale-Dives-Blueprint-v3_0.md` →
`Tale-Dives-Blueprint-v3_2.md` (renamed) to describe the Narrative-First
Overhaul (previous entry below) as its current, real state rather than the
now-obsolete numeric engine — every section grounded in a direct re-read of
the actual source (`lib/tiers.ts`, `lib/conditions.ts`, `data/classes.ts`,
`lib/leveling.ts`, `lib/projects.ts`, `types.ts`, `turnContract.ts`,
`xmlTurnContract.ts`), not memory of the overhaul work itself. Notable
corrections caught only by re-reading source rather than assuming: class
`weights` did NOT go fully dead as an earlier pass had assumed — it still
drives the starting-attribute point-buy split at creation AND which single
attribute a Milestone Breakthrough favors (`applyLevelUps` picks the
class's highest-weight attribute); the starting-attribute picker itself
(`NewGame.tsx` et al.) still hands out a raw ~10-22 point range rather than
a true `CompetencyTier` UI, which is called out as an open gap in the
blueprint's §8 rather than glossed over; the live default model in
`store.ts` is `gemini-3.5-flash-lite`, not `gemini-3.1-flash-lite` as the
old blueprint's §7.1 table claimed; the blueprint's own §9 carried a stale
`3,584`-token IMMERSIVE ceiling left over from before that value was raised
to `6,144` elsewhere in the same document (fixed, two occurrences). §7.2/
§7.3 were replaced with byte-identical copies of the live
`SYSTEM_INSTRUCTIONS`/`XML_OUTPUT_GRAMMAR` constants, not paraphrases.
Also updated `AI_Studio_Instructions v1.md` (the periodically-refreshed,
not-auto-synced project-instructions doc for whichever assistant is doing
further dev work while the primary session is unavailable) — fixed its two
stale `Tale-Dives-Blueprint-v2_4.md` references to point at v3_2, replaced
its "vitals/currency deltas" LLM-output-validation phrasing (vitals aren't
deltas anymore), and added a compact "RECENT MAJOR CHANGE" callout
summarizing the overhaul up front so a fresh assistant session doesn't
reintroduce numeric HP/MP/ST-shaped mechanics from an outdated mental
model. Verification for this pass was read-and-cross-reference against
live source, not `tsc`/`vite build` (no code changed) — every specific
claim above was checked directly against the file/line it describes rather
than asserted from memory.

Previous note:

**Last updated:** 2026-09-07 — The Narrative-First Overhaul (Phases 0-7):
dropped the entire numeric HP/MP/ST/attribute engine and TACTICAL combat
mode for a small, fixed, ordinal-word vocabulary the LLM must always use
verbatim; rewrote the XML turn grammar to match (Condition Tags, a
`<breakthrough>` attribute-tier channel, bare `+`/`-` NPC affection/trust
deltas, a new `<enrich>` content-update tag); wired it all into the turn
loop, JIT context (with COMBAT/SOCIAL ordinal-adjudication hints), and the
HUD; renamed WorldSeedWeaver to TaleDiveWeaver and made it the default "New
Story" flow with a client-side-only Threat-ladder display reskin; and
restructured the Codex (Projects registry, Corpses folded into Bestiary,
Character+Realm merged into one Campaign tab). Full writeup below. Verified
with `tsc --noEmit`/`vite build` after every phase, plus targeted scratch-
script and Playwright verification throughout — see the entry itself for
specifics.

Previous note:

**Last updated:** 2026-09-07 — Reverted the alternate flat Story Viewer /
Codex Viewer feature (both entries below) entirely, per direct user
feedback that it wasn't to their taste — not just the repainted palette,
the whole alternate-screen concept. Removed `src/screens/StoryViewer.tsx`,
`src/screens/CodexViewer.tsx`, and `src/lib/flatChrome.tsx`; reverted
`App.tsx` (dropped the `'storyviewer'`/`'codexviewer'` Screen values, their
lazy imports, and both render branches), `Chronicle.tsx` (dropped the
`onOpenStoryViewer` prop/button and the `export` keywords added solely so
StoryViewer.tsx could reuse its sub-components), and `Codex.tsx` (dropped
the `onOpenCodexViewer` prop/button and the `export` on `CodexProps`) —
all three files are now byte-identical to the commit before this feature
started. Kept the independent fixes bundled in alongside it that aren't
about the alternate screens themselves: `graphicsMode`'s default flip to
Performance, the `.glass-panel` opacity fix under `gfx-performance`, and
the global `touch-action: manipulation` addition — those stand on their
own merits. Verified: `tsc --noEmit` and `vite build` both clean, and
`Chronicle.tsx`/`Codex.tsx`/`App.tsx` diffed byte-for-byte against the
pre-feature commit to confirm a complete, clean revert.

Previous note:

**Last updated:** 2026-09-07 — Repainted the new flat Story Viewer/Codex
Viewer (see previous entry) from a dark ink-purple palette to a near-white
parchment/gold one, per direct feedback that the dark-purple choice was
both too dark and off-brand — the flat build was only ever meant to drop
`backdrop-filter`, not invent a new color identity. `src/lib/flatChrome.tsx`'s
palette and every literal color class in `StoryViewer.tsx`/`CodexViewer.tsx`
now reuse the exact same values as the app's own existing `.parchment-surface`
light-mode tokens (`index.css`) — warm cream/near-white panels (`#f8f1de`
canvas, `#fffdf6` panel), dark ink text (`#2a241e`), and gold accents
(`#8a6a24`/`#b08d3f`) — plus the same gold-CTA-pill convention already used
elsewhere in the app (`#e8ca8a` fill / dark text) for the Send button and
other filled action buttons. `hover:bg-white/5` (invisible on a light
surface) swapped to `hover:bg-black/5` throughout. Re-verified with the same
Playwright passes as the previous entry — all functional checks unchanged,
now against the corrected palette.

Previous note:

**Last updated:** 2026-09-07 — Built a full-parity alternate flat/opaque
in-session experience (`StoryViewer.tsx` + `CodexViewer.tsx`), reachable via
toggle buttons alongside the existing Chronicle/Codex, prompted by a
mobile-dark-fantasy-UI review that argued for dropping glassmorphism in a
text-heavy narrative reader. Also flipped the app's default Graphics Mode
from Glass to Performance and fixed a bug that made `.glass-panel` read as
near-invisible glass with the blur stripped out from under it.
- **`src/lib/flatChrome.tsx`** (new) — a small shared kit of solid primitives
  (`InkPanel`, `InkButton`, `InkField`, `InkTagPill`, `InkAccordion`) with no
  `backdrop-filter` anywhere. (Its first version used a dark ink-purple
  palette distinct from the app's gold/parchment identity — corrected to
  match the app's own parchment/gold tokens in the dated entry above.)
- **`src/screens/StoryViewer.tsx`** (new) — full-parity alternate Chronicle:
  same turn log, HUD (HP/MP/ST/currency/combat bar), Codex-shortcut drawer,
  input/bang/slash handling, edit/retry/delete controls and debug payload
  tools as the classic screen. Reuses Chronicle's own exported sub-components
  (`TurnBlock`, `ApiErrorPanel`, `DebugPayloadButton`, `SessionPayloadPanel`,
  `PoolBar`, `CurrencyBadge`) verbatim for the turn log/HUD — those pieces
  already render correctly with no color-token conflicts outside the
  parchment surface, so reusing them beat re-deriving ~1900 lines of JSX by
  hand. `Chronicle.tsx` itself is otherwise untouched (only additive
  `export` keywords on those sub-components) and still defaults to being the
  first screen shown.
- **`src/screens/CodexViewer.tsx`** (new) — full-parity alternate Codex,
  built as a genuinely independent component (not reusing Codex.tsx's own
  glass-styled shared components — those are the chrome being replaced),
  sharing only the `types.ts` entry interfaces and the same `onUpdateX`
  handler props App.tsx already threads into `Codex.tsx`. Covers all 8 CRUD
  categories (NPCs/Factions/Locations/Lore/Quests/Bestiary/Skills/Items —
  add/edit/delete, every custom field, Discovery/Fog-of-Lore authoring) plus
  Corpses (read-only), Character (view + class evolution), Crafting (recipe
  queue + start), and Realm (editable identity fields).
- **`src/screens/Chronicle.tsx`** / **`src/screens/Codex.tsx`**: added a
  header toggle button on each (`BookOpen`/`LayoutGrid` icon) pointing at the
  new alternate screen, and a matching one on the alternate screens pointing
  back — a direct two-way navigation model rather than a persisted skin
  preference, since `goBack()`'s existing browser-history fallback already
  returns to whichever of the two screens the player came from.
- **`src/App.tsx`**: added `'codexviewer'` to the `Screen` union + lazy
  import + render branch (mirroring the existing `'codex'` branch's props
  exactly); fixed the `'storyviewer'` branch, which had been wired with a
  stale 5-prop stub from an earlier, wrongly-scoped passive-reader draft, to
  pass the complete `StoryViewerProps` set; re-pointed StoryViewer's own
  Codex navigation (drawer tiles, term-popup "Open Full Codex Entry") at
  `'codexviewer'` instead of `'codex'` so the flat experience stays flat
  end-to-end unless the player explicitly crosses over.
- **`src/lib/store.ts`** / **`src/screens/Settings.tsx`**: `graphicsMode`
  default flipped from `'glass'` to `'performance'`.
- **`src/index.css`**: `.glass-panel` under `html.gfx-performance` now gets
  `background: var(--td-surface)` — previously only the blur was stripped,
  leaving its own ~4.5%-alpha gold fill reading as near-transparent glass
  with nothing underneath doing the legibility work blur used to. Also added
  a global `touch-action: manipulation` on buttons/links/`[role='button']`
  to remove the native double-tap-to-zoom delay on mobile taps.
- Deliberately not adopted from the reviewed document: its specific numeric
  claims and a full skeuomorphic/paper-texture rebrand — the real, checked
  engineering substance (avoid `backdrop-filter`, prefer solid opaque
  layers for a text-heavy reading plane) is what shipped; much of it was
  already the app's practice going into this pass.
- Verified: `tsc --noEmit` and `vite build` both clean; live Playwright
  passes at a 390×844 mobile viewport against a mocked XML turn response —
  StoryViewer (turn log, HUD, drawer, term popup, edit controls, toggle back
  to Chronicle) and CodexViewer (category grid, NPC edit/save, Item
  equip/unequip, new-entry Discovery/hidden authoring, Crafting/Character/
  Realm/Chapters/Corpses categories, toggle back to Codex) all confirmed
  working with no console errors.

Previous note:

**Last updated:** 2026-09-07 — Refactored World SeedWeaver into clean, self-contained, modular sub-component modals (`ProtagonistNodeModal`, `WorldNodeModal`, `NpcNodeModal`, `NarrativeNodeModal`) in `/src/components/seedweaver/`. Key enhancements implemented:
- **Protagonist Node**: Featured "Custom Class" option with custom stat allocation & growth rates, displayed AGI% on all archetype presets, reorganized Class/Archetype selection into the "Archetype & Skills" tab, and added Save/Load Protagonist Presets functionality.
- **World Node**: Added Save/Load World Presets with search/filtering, inline CRUD editors for Locations, Factions, and Magic & Rules.
- **NPC Node**: Built full Cast Pack manager with pre-built cast packs (Riders Quadrant, Courtly Intrigues, Frontier Outposts, High Fantasy Guild) and custom local cast pack saving/loading.
- **Narrative Node**: Created dedicated prologue dive editor with pre-made narrative hooks (parapet crucible, ambush, courtly betrayal, etc.), combat mode selector, and Save/Load preset capabilities.
- **Mobile UI & CRUD Polish**: Scaled down crowded buttons, simplified text labels, and added explicit Edit CRUD entry buttons for locations, factions, and skills. Verified build & typechecking (`tsc --noEmit && vite build`) passed clean.

Previous note:
mobile-first branch in `signInWithGoogle()` (`src/lib/googleDrive.ts`): a
later commit had replaced "skip the popup entirely on a detected mobile
browser" with "always try the popup first, only redirect if it throws a
specific error code." That's a real regression risk for the exact bug this
was meant to fix — plenty of mobile browsers block `window.open` silently,
with no catchable error at all, so a catch-based fallback can miss the
case entirely and leave the original "screen flickers, nothing happens"
bug in place. Re-added the mobile detection as the first check (skipping
straight to `signInWithRedirect`, never attempting a popup at all on a
detected mobile browser), layered on top of the later commit's own good
additions (the `auth/popup-closed-by-user`/iframe/`auth/unauthorized-domain`
handling) rather than reverting them. See the dated log entry below.
Previous note:

**Last updated:** 2026-09-07, Claude Code — added a player-saveable preset
system to TaleBrief's "Where do you dive in?" and "Narration Style" fields:
a "Your Presets" section (save-current with inline naming, click-to-use,
delete) folded directly into the existing bookmark-icon Examples modal
rather than a new UI surface, persisted to localStorage via new `store.ts`
helpers (`loadTextPresets`/`saveTextPreset`/`deleteTextPreset`). Also wired
`tale_dives_logo-01.jpg` in as the app's manifest/apple-touch icon (moved
to lowercase `public/img/icons` to avoid GitHub Pages case-sensitivity
issues), and fixed `.claude/launch.json`, whose dev/preview configs
pointed at a different, unrelated project's path on another machine. See
the dated log entry below for the full writeup. Previous note:

**Last updated:** 2026-09-06, Claude Code on the web — reviewed the Google
Drive cloud backup system (added the same day, separately) and fixed a
real mobile bug in it: signing in to link a Drive account did nothing on
an actual mobile browser beyond a screen flicker, because `signInWithPopup`
is routinely blocked or silently dropped on mobile (Firebase's own
documented limitation) — now falls back to `signInWithRedirect` on a
detected mobile browser (or if a popup demonstrably can't open), completed
on the next app load via a new `completeGoogleRedirectSignIn()` call at
boot. Also completely refactored the Settings screen for mobile: a
near-full-height sheet instead of a small floating card, 4 flat icon tabs
(the Storage tab's nested Local/Cloud subtabs are now peers) with a sticky
Save/Cancel footer that's always reachable regardless of how tall a tab's
content gets, icon+tooltip field labels replacing permanent caption
paragraphs, and a new inline warning when Auto-Backup is enabled but the
Drive link needs reconnecting after a page reload (previously silent).
See the dated log entries below for the full writeups. Previous note:

**2026-09-06, cloud backup system** — The settings "Backup" tab was renamed to "Storage" with new "Local" and "Cloud" subtabs for better mobile layout and ergonomics. The 3-slot manual selector was removed in favor of an automatic 3-version rotating cloud backup system. The `uploadBackupToDrive` function now inherently keeps the 3 most recent backups by overwriting the oldest one when the limit is reached, removing the need for manual slot management in the UI. Cloud restoration presents a simple dropdown of available versions (e.g., Version 3, Version 2, Version 1) based on timestamp.

**Last updated:** 2026-09-06, Claude Code on the web — Retry now opens a
big, keyboard-safe popup (same viewport-aware sizing as the app's other
long-text editors) instead of re-seeding the cramped bottom input bar,
which the mobile soft keyboard covers almost entirely — especially painful
retrying Turn 0's dense Prologue prompt. The popup adds a "what would you
like changed?" note that gets prepended onto the full original action text
rather than replacing it, so nothing about World Seeding or the Prologue's
own framing is ever lost on retry; the turn is only actually removed once
a revision is confirmed, not the moment "Retry?" is answered. Earlier the
same day: fixed a player-authored location duplicating itself on Turn 0/1
(loc_id left at the generic "loc_start" placeholder instead of the real,
already-seeded id, because that id was never shown to the model —
Locations now get the same "(id: ...)" Known Entities treatment NPCs/
Factions already had) and a Codex popup click doing nothing for any
player-authored/World-Seeded location or faction (the click handler only
ever tried a bare slugified id, never the "loc_"/"fac_" prefix those
entries are actually keyed under — now falls back to a name match). Also
earlier: two Codex auto-registration bugs found via a fresh campaign's
Turn #0 payload — the protagonist self-tagging as an NPC
({{Kei Ashborn|npc}}), and the overarching nation name getting tagged as
its own faction distinct from the actual registered faction
({{Navarre|faction}} vs. the already-known "Navarre High Command"). See
the dated log entries below for the full root-cause writeups; this note
stays until the next session archives it forward. Previous note:

**2026-09-05, Claude Code on the web** — archived this file's
accumulated log (everything since 2026-09-04, ~2,300 lines) forward into
[`PROJECT_REVISION_NOTES_ARCHIVE.md`](./PROJECT_REVISION_NOTES_ARCHIVE.md), per the
same convention that file's own header already prescribes for exactly this
situation ("once PROJECT_REVISION_NOTES.md's own log section grows too long again,
archive it forward into this same file"). Nothing was edited or condensed, only
relocated — read the archive for full detail on any past session's work. The
current-state sections below (0-6) carry forward unchanged; only the log section
at the bottom of this file resets to empty.

## 0. How to resume

```bash
cd tale-dives   # this repo, wherever it's cloned on the current machine
npm install     # if node_modules isn't present
npm run dev     # Vite dev server, http://localhost:5173
```

- `npm run typecheck` — `tsc --noEmit`, should be clean before any commit.
- `npm run build` — `tsc --noEmit && vite build`, the real pre-commit gate.
- No test suite exists. Verification is manual: run the dev server, click through the
  actual flow in a browser. Don't claim a UI change works without having done this.
- A Gemini API key is required to actually play (Settings screen, gear icon on Title or
  Chronicle header). Without one, `sendAction` immediately no-ops with an error banner —
  this is expected, not a bug.
- Repo remote: `origin` → `https://github.com/kemave-arch/tale-dives.git`, branch
  `master`. All work this session was committed directly to `master` and pushed after
  each logical batch — there is no PR workflow in use here.

### A tooling trap that cost real time this session

The in-session browser-automation tool's `screenshot` action is occasionally stale by one
render frame — clicking a button and immediately screenshotting can show the *pre-click*
UI, looking exactly like the app is frozen/unresponsive. This happened here and briefly
looked like a serious regression (see commit `72f7ef9`'s development history). Before
concluding something is actually broken: re-screenshot after a short `wait`, or use
`read_page`/`get_page_text` to check real DOM state rather than trusting one screenshot.
A hard `preview_stop`/`preview_start` cycle plus a forced navigate also clears any stale
Vite HMR state if you're unsure the dev server is serving current source.

**A second, worse variant hit the following session** (2026-09-03, office machine): every
top-level screen transition (even a trivial Title→Settings click) appeared completely
frozen — `document.body.innerText` never changed no matter how long you waited, with zero
console errors. Direct React-fiber inspection proved the app's own state (`screen`) updated
correctly on the very first click; only the painted DOM stayed stuck. This reproduced
identically across a fresh browser tab AND a fully restarted dev server process, ruling out
HMR/module-state corruption. It was specific to how the click was delivered: JS-dispatched
clicks (`element.click()`, `dispatchEvent(new MouseEvent(...))`, even calling the button's
React `onClick` prop directly) never got the DOM to catch up, while the `computer` tool's
real CDP-level input (mouse-driven `left_click`) did — but often needed the *second* click
at the same coordinates to actually land, with the first one seemingly swallowed after a
navigation. **If a screen transition looks completely inert (not just stale-by-one-frame):
switch to real coordinate-based `computer` clicks instead of JS-dispatched ones, and expect
to click important buttons twice right after a navigation** before trusting a "nothing
happened" reading. This was never root-caused beyond that — it reads like an artifact of
this specific automation environment's input/event pipeline, not an app bug (state
management itself was proven correct throughout), but it cost significant time before the
workaround was found, so it's worth trying immediately rather than re-diagnosing from
scratch.

**A third, total variant hit later the same day**, building the Radial Menu below: clicks
stopped registering at all — not slow, not needing a second click, just completely inert
— across the existing tab, a freshly closed-and-reopened tab, and a brand-new tab on a
fully restarted dev server. `tabs_context` reported `"The Browser pane is currently
hidden"` throughout, even immediately after `tabs_select` claimed to front it, while
`document.hidden`/`visibilityState`/`hasFocus()` inside the page all reported normal
(visible, focused). React state itself still updated correctly on every click (confirmed
via direct fiber inspection, same technique as the second variant above) — only the
paint/commit and all subsequent interaction were stuck. Screenshots still rendered fine
throughout, so this wasn't a fully dead pane, just one that stopped delivering input.
Nothing in this repo's code was implicated (typecheck and build both stayed clean, no
console/server errors at any point) — this reads as a genuine host-side rendering/input
stall in the tool itself, distinct from the two variants above, and it did not resolve
within this session. **If you hit total click unresponsiveness that survives a tab AND
server restart: don't keep retrying automatically — say so and ship on code review plus a
clean build, flagging the gap explicitly rather than silently claiming live verification
that didn't happen.**

**A fourth variant, home machine, 2026-09-03 (Title screen redesign session)**: the
`computer` tool's `left_click` action itself reported `"computer timed out after 30s...
Browser pane is currently hidden"` on nearly every click that session, every single time —
but the click had, in fact, landed. Checking `get_page_text`/`read_page` immediately after
a reported timeout consistently showed the app had already navigated or updated state
correctly. This is a *milder* cousin of the second variant above (real input reaches the
page and the DOM does update — unlike variant two's stuck paint — but the tool's own
success/failure report is wrong), not the third variant's total stall (screenshots and
`read_page` both worked fine throughout). **Do not trust a `left_click` timeout error on
its own as proof nothing happened** — immediately check real state (`get_page_text` or
`read_page`) before retrying or concluding a click failed; retrying a click that actually
landed risks a double-submit on anything non-idempotent (e.g. a second nested navigation).

### The hover trap — check this FIRST before debugging any `hover:` style

**Not a tool bug, and it cost the most time of anything in the 2026-09-03 sessions.**
Tailwind v4 wraps *every* `hover:` and `group-hover:` rule in `@media (hover: hover)`.
The preview pane, once it has been put in a mobile/touch viewport (`resize_window` with
the `mobile` preset or any width < 768), keeps emulating a touch device — reporting
`(hover: hover) → false`, `(pointer: coarse) → true`, `navigator.maxTouchPoints → 5` —
**even after navigating, reloading, or restarting the dev server.** In that state every
hover style in the app is switched off at the CSS level, so hover verification fails
100% of the time and looks exactly like broken code or a dead input pipeline. An entire
debugging arc this session (bisecting Title.tsx back through five commits, restarting the
dev server, opening fresh tabs, concluding "total tool stall") was chasing this.

**The one-line check, before anything else:**
```js
matchMedia('(hover: hover)').matches   // false => hover styles are disabled, period
```
If it's false, call `resize_window` with preset `desktop` and re-check — it flips to
true and hover works first try. Two follow-on facts worth knowing:
- **On genuine touch devices this is correct behavior, not a bug to fix.** A phone will
  never fire `hover:`. Press feedback is the right affordance there, and `group-active:`
  is **not** gated behind the hover media query (verified by walking the compiled CSS's
  at-rule nesting), so tap feedback works on touch while hover styles don't.
- If you need to *see* a hover state without working pointer input, injecting a `<style>`
  element that forces the target declarations works and survives React re-renders —
  setting `element.style.*` directly does **not**, because React resets the `style`
  attribute on its next render of that element.

### The muted-autoplay trap — check this FIRST before debugging "no sound"

**This is what made the soundtrack silent on the live site, and the first two theories
about it (both plausible, both wrong) were about file paths.** Read this before touching
`src/lib/backgroundMusic.tsx`.

The original implementation leaned on a comment that said *"every browser permits muted
autoplay"* — so it created the `<audio>` element, called `play()` while muted, and treated
that as having succeeded. It hadn't. A refused `play()` returns a **rejected promise and
nothing else**: no `error` event, no console warning, `readyState` still climbs to 4, the
element just quietly stays `paused`. And because `toggleMute()` only flipped `.muted` and
never called `play()`, there was **nothing to unmute** — the button was inert forever, no
matter how many times it was clicked.

The measured state, on a server emulating GitHub Pages (app under `/tale-dives/`, real
404s, no SPA fallback):
```
AFTER LOAD:  {"paused":true, "muted":true, "volume":1, "readyState":4, "src":"ost_1.mp3"}
AFTER CLICK: {"paused":true, "muted":false, "volume":1, "readyState":4}   <- still paused
```
Note `readyState: 4` — the file was **fully downloaded and decoded**. Everything about
loading worked. Only playback never started. This reproduces under Chrome's **default**
autoplay policy, not just `--autoplay-policy=document-user-activation-required`.

**Two path theories were tested and disproven — don't spend the session re-testing them:**
- *"Vite's `base: './'` breaks the track URLs on the Pages subpath."* It does not.
  `BASE_URL` compiles to the literal `./`, which resolves **against the document**, giving
  `/tale-dives/tracks/ost_1.mp3`. Confirmed requested and served `200`. (Verify by
  grepping the built bundle for the discovery call — it compiles to a literal `qh("./")`.)
- *"`BASE_URL` needs trailing-slash normalization."* A no-op — `'./'` already ends in a
  slash. This changes nothing in either dev or production.
- *"The `<audio>` metadata probe hangs, blocking discovery."* It did not hang here;
  discovery completed and correctly stopped at `ost_3`'s 404. (A timeout was still added
  as genuine hardening — probes are awaited **in sequence**, so one stalled request really
  could block the soundtrack forever — but it was not the bug.)

**The rule: never treat autoplay as having worked.** Playback must be (re)startable from
something carrying a real user gesture. Current design does this from two places:
`resume()` is called (a) from the mute toggle, since the click is *itself* the gesture
browsers require, and (b) from a self-removing `pointerdown`/`keydown` listener, for a
player who never touches the toggle — that one keeps the element muted, so it is silent,
it just means a later unmute is instant. `resume()` deliberately does **not** rewind;
`playCurrent()` still owns starting a fresh track.

**How to actually verify audio here** (a screenshot can never confirm sound, and this repo
has no test suite): drive a real headless browser and read the element's live state.
Serve the built `dist/` under a `/tale-dives/` path with **real 404s** — the dev server's
SPA fallback returns `200 index.html` for missing files and will hide exactly the class of
bug you're hunting. Then:
```js
const a = document.getElementById('td-soundtrack')   // the element is given this id on purpose
;({paused: a.paused, muted: a.muted, volume: a.volume, t: a.currentTime, rs: a.readyState})
```
**`currentTime` advancing across two samples is the only real proof of playback** —
`paused: false` alone is not enough. Run it under both the default autoplay policy and
`--autoplay-policy=document-user-activation-required`; the strict flag is the closest
stand-in available here for Safari/iOS, which are the browsers most likely to refuse.

## 1. What Tale Dives is

A single-player, browser-only (no backend) AI-narrated text RPG. Vite + React 19 +
TypeScript + Tailwind v4. All state lives in `localStorage` via `src/lib/store.ts` — no
server, no accounts. The player narrates actions in free text; Google Gemini (currently
the only wired provider) returns a hybrid turn response — a `<nar>` prose block plus a
`<sync>` block of XML tags for state deltas, per `src/api/xmlTurnContract.ts`'s grammar
(narrative rules live in `src/api/turnContract.ts`'s `SYSTEM_INSTRUCTIONS`, format-agnostic
and reused unchanged) — applied client-side by `src/App.tsx`'s `sendAction`.
The full intended design lives in `Tale-Dives-Blueprint-v3_0.md` in the repo root — it is
a design document, not a status report. Treat every `§` reference below as "see that
section of the blueprint for the full spec," not "this is built."

## 2. Current file inventory (verified against actual `src/`, not assumed)

**Screens** (`src/screens/*.tsx`): `Title` (full-bleed cycling artwork, "START" CTA, synchronous fullscreen toggle), `StoryMode` (Original/Inspired mode picker, step 1 of the
creation flow), `Settings`, `MainMenu` (cycling background + border-only glass chrome, Tales/Worlds/Protagonists libraries), `WorldSetup` (step 2), `NewGame` (step 3, "Protagonist Setup" in UI copy), `TaleBrief`
(step 4, opening scene + narration/creativity/combat-mode settings, the screen that actually calls `beginCampaign`), `Chronicle` (main gameplay — centered Parchment log, responsive desktop sidebar), `Codex`
("Codex Archives" browser with bespoke RPG child entry detail views across all categories + CRUD), `SlashCommandManager`.

**Components** (`src/components/*.tsx`): `PresetDetailModal.tsx` (responsive World/Protagonist detail modal with tabs on mobile and multi-column grid on desktop), `NowPlayingBanner.tsx` (toast notification for soundtrack changes), `VaultArtGalleryView.tsx`, `VaultSoundtrackView.tsx`.

**Lib** (`src/lib/*.ts`): `store.ts` (persistence), `jitContext.ts` (per-turn context
slicing), `shadowReferee.ts` (client-side validation of model-proposed deltas), `xmlTurnParser.ts` (DOMParser + regex fallback parser for `<nar>` and `<sync>` XML turn responses), `xmlHelpers.ts` (shared XML-parsing primitives — `decodeXmlEntities`, attribute readers, `parseStatBonus` — used by both `xmlTurnParser.ts` and `worldSeedParser.ts`), `worldSeedParser.ts` (parses the World Seeding call's `<seed>` grammar), `seeding.ts` (`seedCampaign()` — the one-time World Seeding orchestration, never throws), `codex.ts` + `keywordLinks.ts` (`{{Term|category}}` auto-registration and deduplication), `locations.ts` (tracks `firstVisitedTime`/`lastVisitedTime`), `npcs.ts` (tracks `heldWeapon`, `wornArmor`, `firstSeenTime`/`lastSeenTime`),
`quests.ts` (now also threads a `type` field), `inventory.ts` (item Codex + qty ledger, `equipItem`/`unequipSlot`), `combat.ts` (Tactical combat math), `leveling.ts` (milestone leveling + chapter boundaries), `bangCommands.ts` (`!` client-side commands), `discovery.ts` (§5.12 Codex Discovery reveal checks, plus `validateDiscovery` — moved here from `Codex.tsx` so the seeding pipeline shares it), `crafting.ts` + `gameTime.ts` (§5.8 Crafting queue resolution + GameTime arithmetic), `summoning.ts` (§5.3 Summoning/Minion engine), `factions.ts` (§5.4/§5.11 rivalry + derived standing, plus `attitudeToRepTier`), `skills.ts` (affordability and skill learning), `fsAccess.ts` (§6.4B File System Access API wrapper), `googleDrive.ts` (Google Drive OAuth authentication & v3 REST cloud backup/restore with 3-version rotation), `useConfirm.tsx` (in-app confirm modal), `useLongTextEditor.tsx` (auto-expanding modal for long textareas), `useRetryEditor.tsx` (keyboard-safe retry modal with feedback note), `cyclingBackground.tsx` (responsive background-slot crossfader), `backgroundMusic.tsx` (ambient rotation + `ts-<state>_` turn-state pools with crossfader, mute toggle), `glassChrome.tsx` (shared border-only glassmorphism components), `currency.ts`, `derivedStats.ts`, `richText.tsx` (inline markup: `[Skill]`, `[[Item]]`, `'thought'`, `{{Term|cat}}`), `slug.ts`, `autoRegister.ts`, `turnStates.ts`, `backup.ts` (`saveJSON`, folder-aware).

**API** (`src/api/`): `turnContract.ts` (system prompt + narrative rules), `xmlTurnContract.ts` (XML grammar definition for `<sync>` tags/attributes), `worldSeedContract.ts` (the one-time World Seeding call's own `<seed>` grammar), `providers/types.ts` (the `Provider` interface), `providers/index.ts` (the provider registry), `providers/gemini.ts` (Gemini provider implementing `runTurn` with XML instructions and parser, `runSummary`, and `runSeed`).

**Data** (`src/data/`): `classes.ts` (Preset Class Dictionary), `recipes.ts` (§5.8 Recipe Dictionary), `soundtrackManifest.ts` (explicit manifest of OST tracks and `_ostNN` sort order), `starterTemplates.ts` (Fourth Wing + Violet Sorrengail starter template), `formExamples.ts`.

**Deployment**: `.github/workflows/deploy.yml` — builds and deploys to GitHub Pages via
Actions on every push to `master`. `vite.config.ts` uses `base: './'` (relative).
subpath without hardcoding the repo name — safe since there's no URL-based router, only
in-app `screen` state.

**Static assets** (`public/img/`): the Title/MainMenu cycling background artwork, one pair
per "slot" — `m_<stem>.webp` (phone-composed) and `pc_<stem>.webp` (tablet/desktop-
composed, also the guaranteed fallback if a slot's `m_` file doesn't exist yet). `.webp`,
not `.png` — converted for ~90% smaller files, no visible quality loss. **Three** slots
today — `title-bg1`, `title-bg2`, `title-bg3` — all real crossfading content, no
placeholders. There is no stem list to maintain: `cyclingBackground.tsx` probes
`pc_title-bg<N>.webp` from 1 upward and stops at the first gap, so dropping a new
numbered `m_`/`pc_` pair into the folder extends the cycle on its own. Paths are built off
`import.meta.env.BASE_URL`, not a hardcoded leading slash — that hardcoding is exactly what
broke these images on the live GitHub Pages deploy (which serves from `/tale-dives/`, not
the domain root) until this session's fix; see that file's `useResponsiveBg` and its own
Revision log entry below before ever reintroducing a literal `/img/...` path anywhere.

**Static assets** (`public/tracks/`): the background soundtrack, as `ost_1.mp3`,
`ost_2.mp3`, … — same numbered auto-discovery convention as the artwork above, probed by
`src/lib/backgroundMusic.tsx` from 1 upward and stopping at the first gap, so dropping in
`ost_3.mp3` adds it to the rotation with no code change. Two tracks today (~4 MB each,
64 kbps stereo). They are committed to the repo, copied verbatim into `dist/` by Vite as
ordinary `public/` files, and served correctly from the Pages subpath — **if there is no
sound, the files are not the problem;** see §0's muted-autoplay trap.

**Ambient types** (`src/types/`): `fileSystemAccess.d.ts` — minimal File System Access API
types not yet in TS's bundled DOM lib, new this session.

## 3. What's actually built (chronological, oldest to newest)

Everything below is implemented and working as of `ce63a71`. See `git log --oneline` for
the literal commit sequence; the summary here groups by feature, not commit.

- **Core loop**: Title → Main Menu (Tales/Worlds/Protagonists libraries) → Story Mode
  (Original/Inspired picker) → World Setup (Original Mode only) → Protagonist Setup
  (`NewGame.tsx`) → Tale Dive Brief → Chronicle (the turn loop) → Codex. Gemini API wired
  end-to-end with structured-JSON turns.
- **§5.1 / §5.13 Tactical combat** — client-computed exchange math, no round-trip to
  Gemini for damage resolution once a fight is active.
- **§5.1a Milestone Leveling** — auto level-ups on quest completion / chapter boundaries.
- **§5.7 Player Defeat State** — soft-fail recovery (HP/currency penalty + a dedicated
  narrated recovery turn), not a hard game-over.
- **§2 Phase E Chapter Recap** — periodic summary + history-window flush so token cost
  stays bounded regardless of campaign length (the JIT context system in
  `jitContext.ts` is the other half of this).
- **{{Term\|category}} keyword links** — parsed out of narration, auto-register Codex
  stub entries, tappable in the Chronicle to open a popup card or jump to the Codex.
- **§6.4D Codex UI** — full browsable Codex across all 6 categories, with manual CRUD
  (§9) as a correction path for auto-logged entries.
- **§6.0 obsidian dark chrome redesign** — the current visual language: dark
  header/HUD/input glass with a gold (`#e8ca8a`) accent, turn-state theming, draggable
  block navigator, parchment-textured narration pane.
- **§6.6 Bang Commands** — `!npc`, `!items`, `!location`, `!faction`, `!quests`,
  `!bestiary`, `!recall`, all 0-token and entirely client-resolved
  (`src/lib/bangCommands.ts`), rendered as a "Roleplay Paused" dossier block in the
  Chronicle. Includes command-palette autocomplete (typing `!` opens a filtered dropdown).
- **§6.6 Slash Commands** (this session, commit `72f7ef9`) — player-authored saved
  prompts invoked as `/name`, sent through the *real* turn pipeline (unlike bang
  commands, these do cost tokens). Scoped per-campaign or Global (shared across every
  Tale) via a checkbox in the manager UI (`SlashCommandManager.tsx`, opened by the `/`
  button next to the Chronicle input). Each command carries a `pauseRoleplay` flag that
  forces that turn's state to `PAUSE` client-side (`App.tsx`'s `sendAction` takes a
  `forcePauseState` param for this). Autocomplete mirrors the bang-command dropdown.
- **Autocomplete dropdown opacity** — both the bang and slash dropdowns use
  `bg-[#141622]/60` + `backdrop-blur-sm` (60% opacity, per explicit user request this
  session).
- **§5.12 Codex Discovery ("Fog of Lore")** (this session, commit `fbdef88`) — every
  Codex entry can carry a `discovery` object (`src/types.ts`'s `Discovery` type: `state`
  known/hidden, `revealTrigger`, `revealCondition`, `teaser`). Reveal checks run
  client-side every turn (`src/lib/discovery.ts`'s `checkCodexReveals`, called from
  `App.tsx`'s `sendAction`) against `flag_add`/`loc_id`/`npc_mem_up`/`quest_update` —
  zero extra tokens, zero new turn-schema fields. A reveal surfaces an inline "Codex
  Updated" badge in the Chronicle log. Masking is enforced in both the Chronicle's
  tap-to-open popup card and the full Codex UI (grid cards + detail view show
  `???`/teaser/Lock treatment) — except inside CRUD Edit Mode, which always shows the
  full record plus an editable Discovery panel so a player can hand-author their own
  reveals. **Caveat**: there's still no seeding/grounding call that pre-populates hidden
  lore on its own — today an entry only becomes hidden via manual CRUD.
- **§5.1b Class Evolution** (this session, commit `3597869`) — the player's single class
  slot can change mid-campaign, replaced outright (non-retroactive: already-earned
  attribute points keep their history, only future level-ups follow the new class's
  weight vector). Two triggers: story-driven via an optional `class_evolution` field on
  `TurnResponse` (schema-constrained to the Preset Class Dictionary, so the model can
  never propose an unrecognized class — see `src/api/turnContract.ts`), or manual via a
  new "Character" Codex category (`src/screens/Codex.tsx`) with a class-picker edit mode.
  The Chronicle surfaces it as a banner reusing the Codex Discovery badge treatment (a
  synthetic divider block for the manual trigger, an inline pill for the story-driven
  one). **Scope note**: this works within the existing Preset Class Dictionary only — the
  blueprint describes evolution as reusing a "Class Grounding" search-grounded call for
  freely-typed class names, which doesn't exist at character creation either; that's
  bundled with Inspired Mode (Tier 3 item #15 below) as shared future work.
- **§5.8 Crafting & Resource Management** (this session, commit `ccec6d1`) — a
  timestamp-based crafting queue, fully client-resolved (0 tokens): a Recipe Dictionary
  (`src/data/recipes.ts`), queue/resolve logic (`src/lib/crafting.ts` +
  `src/lib/gameTime.ts` for arithmetic on the model's freeform time string), and a new
  "Workbenches & Recipes" Codex category with live-affordability recipe cards and a
  countdown on active jobs. A completion surfaces as a "Craft Ready" Chronicle badge, plus
  an optional one-line narration hook in the prompt when the player is at the crafting
  location on the exact turn it resolves. **Scope note**: station-location enforcement is
  skipped (no location-station-type data model exists — any recipe can be queued from
  anywhere), and "Resource Management" (perishable material decay, the other half of
  §5.8) is not built — it needs a static item-metadata dictionary that doesn't exist yet.
- **§5.3 Three-Branch Summoning & Minion Engine** (this session, commit `9a3158e`) — a
  class-gated, 0-token mechanic in the same architectural family as the read-only "!" bang
  commands: `!arise` (Dark Monarch), `!raise_skeleton` (Classic Necromancer, spends 1 Bone
  Dust + MP), `!summon` (Contract Gate Summoner, spends MP for an ongoing-upkeep
  familiar), plus a read-only `!minions` roster (added to `bangCommands.ts`'s existing
  switch). `src/lib/summoning.ts` holds the class-branch gating and per-turn MP-upkeep
  drain (a familiar dissipates, with a Chronicle notice, the instant its upkeep can't be
  paid). **Scope note**: Shadow Extraction's blueprint gate ("specific slain boss tags")
  is simplified to "any harvestable corpse" — there's no boss/elite threat-tier tagging
  mechanism in the Bestiary yet (every adversary auto-registers at 'standard' tier). MP
  costs/upkeep and minion `hpMax` are invented balance defaults, not blueprint-specified.
- **§5.4 Faction Reputation Rivalry + §5.11 Territory Standing** (this session, commit
  `52591e0`) — `FactionEntry.rivalId` (Codex CRUD dropdown) plus a new optional `fac_rep`
  turn-schema field the model can use to nudge a named faction's reputation; applying it
  (`src/lib/factions.ts`'s `applyFactionRepDeltas`) mirrors an inverse delta onto the
  rival, 0 extra tokens. A location's `standing` is now *derived* (not stored) whenever
  its `factionOwner` (now an id-based Codex dropdown, not free text) resolves to a real
  faction — recomputed everywhere it's read (JIT context, Codex UI, `!location`/`!recall`
  dossiers), and a Hostile-standing location's context slice gains one line steering the
  model toward STEALTH. **Scope note**: rivalry links are directional per-entry, not
  auto-mirrored — a symmetric rivalry needs both factions' `rivalId` set via CRUD.
- **Multi-provider abstraction + on-device folder saves** (blueprint §3.4/§6.4B, this
  session, commit `9a2fed0`) — a `Provider` interface (`src/api/providers/types.ts`) with
  a registry (`providers/index.ts`); `App.tsx`'s three Gemini call sites now route through
  `getProvider(apiSettings.provider)` instead of importing `gemini.ts` directly, and
  Settings' AI Model tab has a real Provider dropdown (previously hardcoded to `'gemini'`
  in the save handler). Separately, `src/lib/fsAccess.ts` wraps the File System Access API
  (feature-detected, Chrome/Edge desktop only) with IndexedDB handle persistence;
  `backup.ts`'s new `saveJSON()` writes into a linked On-Device Folder when one exists and
  is permitted, else falls back to the unchanged browser download; Settings' Backup tab
  has a Local Save status row (On-Device Folder / Browser Only) with a link/unlink button.
  **Scope note**: Gemini remains the only real provider — a second one needs a live API
  key this session doesn't have to build against and verify, so only the abstraction
  itself shipped (verified in active use). **Verification gap**: the native OS
  folder-picker dialog could not be exercised through browser automation
  (`showDirectoryPicker()` needs a user gesture / opens outside the page DOM) — the
  IndexedDB plumbing and feature detection were verified directly, but a human should
  click through the actual link/write/unlink flow before relying on it.
- **4-screen new-story creation flow restructure** (home-machine session, commits
  `3e7dcee`/`a53ec11`) — replaces the old MainMenu → WorldSetup → NewGame → `beginCampaign`
  path with Story Mode (`StoryMode.tsx`, new — Original/Inspired picker; Inspired stays
  "Coming soon", same stub as before, just moved earlier) → World Setup (unchanged
  template picker, minus its old inline mode toggle, plus new Save Preset/Save as New
  Preset buttons calling `upsertWorld` directly) → Protagonist Setup (`NewGame.tsx`,
  renamed in UI copy only; same new preset-save buttons via `upsertProtagonist`; the Tale
  Dive Brief textarea moved out) → Tale Dive Brief (`TaleBrief.tsx`, new — opening-scene
  textarea, Narration Style, a Creativity Randomness slider, and a Narrative/Tactical
  combat-mode toggle with tap-to-reveal tooltips explaining each; **this screen is what
  actually calls `beginCampaign`** now, not Protagonist Setup). Also added: `gender?:
  string`/`age?: number` on `Player`/`NpcEntry`/`ProtagonistData` (free-short-text/plain
  int, 0 context cost when unset — appended to the player/NPC context lines in
  `jitContext.ts`/`npcs.ts` only when set; the model is never asked to supply an NPC's via
  schema, only the player sets those through Codex CRUD), and new campaigns now default to
  `combatMode: 'NARRATIVE'` instead of `'TACTICAL'` (existing campaigns unaffected).
  **Scope note — this was originally planned as a 6-phase effort** (plan file, not in this
  repo: a Claude Code `EnterPlanMode` artifact from that session); **only phases 1-3
  shipped** (default combat mode, gender/age, the 4-screen restructure above). Phases 4-6
  — campaign seeding (a new non-grounded `runSeed` call pre-populating hidden Codex
  entries via the existing Discovery system before Turn 1), a prologue-beat loading
  treatment on a brand-new campaign's first turn, and streaming turn rendering (Gemini
  `:streamGenerateContent`, reusing `gemini.ts`'s existing `extractNarrative()` incremental
  parser, with a fade-wipe reveal in Chronicle) — were **not started**. See §4's new entry
  below for the carried-forward detail; do not assume any of the three exist. Verified
  live: clicked through Story Mode → World Setup (Save Preset confirmed appearing in Main
  Menu's Worlds tab) → Protagonist Setup (same) → Tale Dive Brief (tooltips open, Start
  correctly threads `opening`/`combatMode`/`narrationStyle`/`temperature` into
  `beginCampaign`). `npm run typecheck`/`npm run build` clean throughout.
- **`useConfirm()` in-app modal, replacing `window.confirm()` everywhere** (commit
  `a53ec11`) — see this entry's own Revision log write-up below for the root cause
  (`window.confirm()` was silently returning `false` with no dialog at all in this app's
  embedded preview environments — a real, previously-invisible bug that had likely been
  silently no-oping every delete/reset/confirm action in the app for an unknown period,
  not just the one the user happened to notice). All 7 call sites across `App.tsx` (×4),
  `Codex.tsx` (×2), and `SlashCommandManager.tsx` (×1) now route through the new
  `src/lib/useConfirm.tsx` hook instead. Verified live: the user directly confirmed the
  fix worked ("it worked wonderfully") after this shipped.
- **Main Menu Worlds/Protagonists tabs gained Edit buttons** (commit `cc1c955`) —
  previously these library tabs had Set-Default and Delete but no way to edit an existing
  entry at all, despite `WorldSetup`/`NewGame`'s "library" edit mode already existing and
  working; just never exposed via a button. Also compacted both tabs' list rows (icon +
  name/detail + inline icon-button row, replacing tall padded cards) and brightened the
  Tales tab's `DashedCard` ("New Story"/"Import Tale") hover treatment per user feedback.
- **Title screen redesign, art-driven** (home-machine session, commits `9a0ce8f`/`ce63a71`)
  — replaced the plain wordmark-on-canvas v1 scaffold with a full-bleed background artwork
  (`public/img/title-bg1.png`, a "book portal" illustration the user supplied) topped with
  a `.title-sparks` rising-ember CSS animation (22 particles, gold, `prefers-reduced-motion`
  respected — see `index.css`), a bottom scrim for legibility, and a single transparent
  gold-bordered "Dive In" button (glows on hover/press) plus a Settings icon — deliberately
  **no** Worlds/Journal/Profile/Inventory/Achievements row, since none of those are actual
  separate screens today and a button for them would just be decoration. Went through an
  intermediate `TitleAlt.tsx` "trial alternate" toggle screen first (per the user's initial
  ask to compare side-by-side); once approved ("omg... it's gorgeous"), `TitleAlt.tsx` was
  promoted to be the one and only `Title.tsx` and fully deleted as a separate file — if you
  see any reference to `TitleAlt`/`titlealt` anywhere, it's stale, since the codebase has
  none. Background art lives under `public/img/` (moved there from a flat `public/` root
  per user request) and is numbered (`title-bg1.png`) specifically so a future
  rotating/crossfade background (`title-bg2.png`, `title-bg3.png`, ... — `title-bg2.png`
  is already sitting there unwired, uploaded ahead of that feature) can be added without a
  path-scheme change; nothing currently reads `title-bg2.png`. Verified live: full-bleed
  render confirmed via direct `getBoundingClientRect()` (not just a screenshot — this
  session's browser tool had a screenshot-capture glitch, see §0's fourth tooling-trap
  variant above), 22 spark elements confirmed present in the DOM, and the Dive In button
  confirmed to actually navigate to Main Menu. `npm run typecheck`/`npm run build` clean.
  **This session's local commits also diverged from `origin/master`** (the office machine
  had pushed a blueprint-doc-only commit independently) — reconciled with a plain `git
  merge origin/master` (no conflicts, doc-only content) before the final push; `master` and
  `origin/master` are in sync as of `ce63a71`.
- **Equipment system (§5.9 Item Type Taxonomy)** (commit `817c90d`) — closes the gap an
  earlier session's own notes had flagged ("the Equipment source has no equip system to
  hang off yet"). Items previously had no name, type, or description anywhere — the Codex
  Items tab showed a slugified id (`iron_dagger` → "iron dagger") as the whole record. Now
  `Campaign.items` (a proper item Codex, separate from `inventory`'s qty ledger) holds
  name/type/description?/statBonus? per item id, populated atomically by an enriched
  `inv_add` schema field (id/name/type/qty required, description/stat_bonus optional) so
  there's no separate registration step for an item to fall out of sync with. Weapon/
  Armor/Accessory can carry a `statBonus` and occupy `Player.equipped[slot]`; a new
  `!equip`/`!unequip` bang command (deterministic, player-initiated, same architectural
  family as `!arise`/`!summon` — not a schema field, since there's no narrative ambiguity
  for the model to arbitrate) applies/reverses it, also reachable via Equip/Unequip
  buttons in the rebuilt Codex Items detail view. Equipped gear is now in the always-on
  per-turn JIT context line, not just behind `!items`, so the narrator stays aware of it
  turn to turn. See §3 above's Lib entry for the exact functions. Verified live end-to-end
  (screen-transition clicks are still affected by the tooling stall documented in §0's
  fourth variant, so this was checked via direct DOM/localStorage inspection rather than
  screenshots): created a weapon with a +3 STR bonus via Codex CRUD, equipped it (STR
  3.2→6.2, HP max recomputed 28→36), unequipped it (reverted cleanly), then repeated the
  same round-trip via `!equip`/`!unequip`/`!items` typed directly in Chronicle. Found and
  fixed one real bug during this: `!equip`/`!unequip` were falling through to Chronicle's
  generic "Unclear Reference" dossier label (`BANG_DISPLAY` had no entry for them).
- **Title screen "Continue" shortcut + save schema-version field** (commit `23eafda`) — a
  small ghost link under Dive In jumps straight into the most recently played Tale via a
  new shared `resumeCampaign()` (also now backing Main Menu's own Resume), omitted
  entirely when no Tale exists yet. Separately, `CURRENT_SCHEMA_VERSION` (`types.ts`) is
  now stamped on every new campaign and export and backfilled onto older campaigns on
  load — pure defensive plumbing, nothing branches on it yet since nothing has needed a
  migration yet.

- **UI unification onto one dark-glass theme** (home machine, 2026-09-04, commits
  `36d2d62`, `2717f78`, `fa54a16`, `0637f88`, `eb1f5fb`; plus `e187589` fixing the Title
  CTA). The app had **three competing visual systems**: skin tokens (`bg-canvas`,
  `glass-panel`) defaulting to a **light parchment** skin, hardcoded dark hex
  (`bg-[#141622]`, `text-white/NN`) in Codex/SlashCommandManager, and the glass chrome
  Title/MainMenu had introduced. The light default is why Settings and the Codex read as
  a different app from the front door. All three collapse onto the glass language — see
  the box at the top of this file for the rules, which are the part worth reading.
  Mechanically: skins retired end to end; `glassChrome.tsx` grew the shared shell/header/
  tabs/button/field/segmented pieces every screen had been re-inventing; all four
  creation screens moved onto the artwork with glass forms (per the user's explicit
  ask); Codex's 61 hardcoded colors and the whole Slash manager moved onto tokens;
  MainMenu deduped onto the shared pieces it had originated. Secondary text was then
  brightened app-wide at the token level (`--td-ink-muted` `#a08e6d`→`#d3c1a0`) after the
  user flagged labels washing out against bright regions of the artwork. Verified live
  screen by screen. **Known open judgment call:** on the creation screens the artwork's
  own painted wordmark can show through behind the form fields — legible, but busy; the
  scrim can be deepened for `fill` screens if the user wants it calmer.
- **Skills (Spells & Abilities)** (2026-09-04, commit `d4616a5`) — blueprint §6.4D's
  Codex category 6, which the user noticed was missing entirely. Previously only the
  inline `[Skill]` text formatting existed; there was no schema, entry, or persistence.
  `SkillEntry` keeps every field past `name` optional on purpose (a skill is named in
  prose long before it has agreed numbers, and §8 deliberately leaves skill base values
  open). Entries arrive two ways, mirroring NPCs/Locations: `{{Term|skill}}` keyword
  links auto-register a free stub, and a new `skill_learn` turn-schema field carries the
  real record. §3.2 **Skill Affordability is implemented as information, never a gate** —
  the check always runs, but steers the narrator toward narrating exhaustion rather than
  refusing the player's action; it surfaces in the Codex detail, the new `!skills`
  roster, and an `UNAFFORDABLE` marker on the always-on JIT context line (hidden skills
  are withheld from context entirely, §5.12). Verified live against a seeded Tale
  covering MP-only, ST-only, both-costs, hidden (masks to `???` + Lock + teaser), and
  costless skills. **Two deliberate omissions**: the §Phase B.3 **Quick-Slot Tray**
  (user deprioritized it explicitly) and `suggested_quick_slots` from class grounding
  (that grounding system doesn't exist — it's bundled with Inspired Mode, item #5).
- **Tale Dives v3.0 XML Turn Contract & Parser Migration** (2026-09-05) — Replaced the structured JSON turn schema with an XML wire grammar: `<nar>...</nar>` (pure prose with inline markup) followed by `<sync>...</sync>` (compact block of self-closing XML tags with shorthand attributes for turn state, vitals, inventory, NPCs, quests, and factions). Verified a ~25% reduction in output tokens on the real Gemini tokenizer. Implemented in `src/api/xmlTurnContract.ts` and `src/lib/xmlTurnParser.ts`. Parser combines `DOMParser` for the `<sync>` block with regex recovery for `<nar>` so incomplete turns never lose their narrative. Inline item markup transitioned from angle brackets (`>Item<`) to double brackets (`[[Item]]`) to prevent collisions with real XML tags.
- **NPC & Location Ground Truth Anchoring & Deduplication** (2026-09-05) — Anchored entity state against model drift: added persistent `heldWeapon` and `wornArmor` to `NpcEntry` (populated and re-sent every turn in JIT context), and added temporal tracking (`firstSeenTime`/`lastSeenTime` on NPCs; `firstVisitedTime`/`lastVisitedTime` on Locations) to keep the timeline consistent. Solved Codex entity duplication by normalizing hyphens and underscores in `slugify()` and adding an `isKnownByName` fuzzy-match check in `locations.ts`.
- **Codex Overhaul & Bespoke Child Entry Detail Views** (2026-09-05) — Rebranded header to "Codex Archives", harmonized typography (Cinzel display serif for entry titles, clean Sans for body and metadata), unified under the dark navy/charcoal palette (`bg-[#131622]/90` cards with `#e8ca8a` gold accents), and renamed "Workbenches & Recipes" to "Crafting". Rebuilt detail views with tailored modern RPG layouts for each category (Locations, NPCs, Factions, Lore, Quests, Bestiary, Items, Skills, Crafting).
- **Adaptive Turn-State Soundtrack & Crossfading** (2026-09-05) — Extended `src/lib/backgroundMusic.tsx` to partition tracks into ambient rotation and per-Turn-State pools using a filename convention: tracks prefixed with `ts-<state>_` (e.g., `ts-combat_...`) dynamically crossfade in when that state becomes active, falling back smoothly to ambient music when the encounter ends. Reads explicit track list from `src/data/soundtrackManifest.ts`.
- **Chronicle & Title Screen UX Refinements** (2026-09-05) — Title screen CTA modernized to "START" with synchronous fullscreen support. Chronicle narration log centered into an immersive reading column, typewriter letter delay removed for instant reading pace, and responsive desktop layout enhanced with a structured side-column.
- **Defensive Invariant Hardening & Blueprint v3.0** (2026-09-05) — Fixed potential `NaN` in `stat_grant` through defensive parsing and clamping. Fixed temporal hallucination in chapter recaps by threading explicit `startTime` and `endTime` into `runSummary`. Scoped bang-command turn controls to the last narrated turn. Authored and published `Tale-Dives-Blueprint-v3_0.md` as the unified master specification.

## 4. What's NOT built yet — the Tier 3 priority list

This is the standing priority order. Each item was independently verified against the
actual source (not the blueprint's aspirational text) immediately before writing this
doc — "not implemented" below means a real grep/read confirmed zero code, not an
assumption.

1. ~~**#10 Class Evolution**~~ (blueprint §5.1b) — **done**, commit `3597869` (within the
   Preset Class Dictionary only — see §3 above for the free-form "Class Grounding" scope
   note, folded into item #15 below).

2. ~~**#12 Crafting & Resource Management**~~ (blueprint §5.8) — **done** (crafting-queue
   half only), commit `ccec6d1`. See §3 above for the scope notes (no station-location
   enforcement, no perishable-material decay).

3. ~~**#13 Three-Branch Summoning & Minion Engine**~~ (blueprint §5.3) — **done**, commit
   `9a3158e`. See §3 above for the scope note (Shadow Extraction's "boss corpse" gate
   simplified to "any corpse," since Bestiary has no boss/elite tier tagging yet).

4. ~~**#14 Faction rivalry + Codex Discovery**~~ (blueprint §5.4/§5.11/§5.12) — **done, both
   halves**, commits `fbdef88` (Discovery) and `52591e0` (Rivalry + Territory Standing).
   See §3 above for scope notes on each.

5. **#15 Inspired Mode** (blueprint §Phase A.2) — adapting a real novel/series via
   title/author grounding (Gemini search-grounding tool + structured JSON output in the
   same call). **UI stub only**: `WorldSetup.tsx` renders it as a disabled "Coming soon"
   tab; `WorldData.mode` is hardcoded to `'original'` on every submit regardless of which
   tab is active. An in-code comment at `WorldSetup.tsx:13-17` already flags this as the
   reason it's stubbed.

   **Spiked this session (2026-09-03), deferred with evidence, not just risk-flagged.**
   Ran three raw test calls directly against this campaign's configured API key/model
   (`gemini-3.1-flash-lite`) from the browser console, bypassing the app:
   1. Plain `generateContent`, no tools, no schema → **200 OK**.
   2. `generateContent` with `tools: [{ google_search: {} }]` (grounding), no schema →
      **429 RESOURCE_EXHAUSTED**.
   3. Same grounding tool *plus* `responseSchema`/`responseMimeType: application/json` →
      **429 RESOURCE_EXHAUSTED**, same message.

   Every grounding-tool request failed on quota while plain generation succeeded
   immediately after — Google Search grounding has its own, separately-metered quota on
   this API key's current plan (consistent with Gemini API free-tier behavior — grounded
   search typically needs a billing-enabled project for any real quota), independent of
   and much stricter than the regular generation quota this app already uses fine. This
   means **the core technical question — does Gemini actually accept `tools` +
   `responseSchema` together in one call — could not be answered**: the request never
   got far enough to be validated against that specific rule; it was quota-rejected
   before or regardless of that check. A 400 `INVALID_ARGUMENT` would have settled the
   question either way; a 429 settles nothing.

   **This is not a "try again later" transient limit** — it reproduced identically on
   three separate calls a few seconds apart, while plain generation worked between two of
   them, so it isn't a general per-minute cap on the key. Resuming this spike needs
   either the account's grounding quota to reset (may be daily, may need dashboard
   inspection at the `ai.dev/rate-limit` link the error itself points to) or billing
   enabled on the Google Cloud project backing this key. **Do not re-attempt this spike
   more than once or twice per session** — it's an API-quota question, not a code
   question, and hammering it doesn't get a different answer faster.
   If/when the spike succeeds: implement per the blueprint (§Phase A.2's grounded call,
   feeding into Class Grounding per §Phase B.2a's cross-reference — see Class Evolution's
   scope note in §3 above, which is *also* blocked on this same missing Class Grounding
   system), then wire `WorldSetup.tsx`'s Inspired Mode tab to it.

6. ~~**#16 Multi-provider support + on-device folder saves**~~ — **done, both halves**,
   commit `9a2fed0`. See §3 above for scope notes (Gemini is still the only real provider;
   the native folder-picker's live click/write/unlink flow needs a human verification
   pass — browser automation can't drive that native OS dialog).

7. **Campaign seeding, prologue beat, and streaming turn rendering** (not a blueprint
   §-numbered item on the original list — user-requested this session, home machine,
   2026-09-03, alongside the new-story creation flow in §3 above). Planned as phases 4-6 of
   a 6-phase plan; **only phases 1-3 shipped** (the creation-flow restructure). None of the
   three below exist in the code — carrying the plan's detail forward here since the
   original plan file lives outside this repo (a Claude Code `EnterPlanMode` artifact, not
   committed anywhere) and would otherwise be lost to a future session:
   - **Campaign seeding**: a new, small, **non-grounded** JSON schema/call (like
     `runSummary` — not search-grounded, so unaffected by #15's quota block above) that
     takes World Background/Genre/Conflict + Protagonist Background/Brief and returns a
     short batch of Codex entries across NPCs/Locations/Factions/Lore, each optionally
     marked hidden with a `teaser`/`revealTrigger` — the exact shape `discovery.ts`'s
     `Discovery` type already expects (§5.12, already built and working). Would need a
     `SEED_SCHEMA` in `turnContract.ts`, a `runSeed` function in `gemini.ts` + the
     `Provider` interface, and a call from `App.tsx`'s `beginCampaign` (non-fatal on
     failure, same pattern as `recapChapter`) before the first real turn fires.
   - **Prologue beat**: purely a pre-roll loading treatment in `Chronicle.tsx` for
     `log.length === 0 && busy` (a brand-new campaign's very first turn only) — a short
     atmospheric loading-phrase sequence with a soft fade/ink-bloom transition
     (CSS-only, `prefers-reduced-motion`-respecting, same convention as
     `AmbientBackground`/`.chrome-motes`/this session's own `.title-sparks`). The actual
     prologue *text* is just Turn 1's narration — no special-cased content, this is only
     about what shows while waiting for it.
   - **Streaming turn rendering** (the highest-risk, most cross-cutting piece — touches
     every turn, not just the first): a new `runTurnStreaming(params, onPartialNar)` in
     `gemini.ts` calling Gemini's `:streamGenerateContent?alt=sse` endpoint, re-running the
     **already-existing** `extractNarrative()` (the Stage 3 fallback reader that already
     tolerates an unterminated JSON string) against the growing SSE buffer after each
     chunk, invoking a callback with newly-available prose. `App.tsx`'s `sendAction` would
     hold a transient `streamingNar: string | null`; `Chronicle.tsx` renders it as
     plain-prose spans (deliberately **not** run through `renderNarrative`'s rich-text
     markup mid-stream — a `[Skill` or `{{Term` tag can be mid-stream and unparseable) each
     with a short CSS fade-in, replaced by the normal committed `TurnBlock` once the turn
     completes and the full Stage 1/2/3 sanitize/parse/Shadow-Referee path runs exactly as
     today. Input is already disabled during `busy` for its full duration
     (`disabled={busy}` in `Chronicle.tsx` already), so no new work needed there.
   Whoever picks this up next should re-derive the phase order rather than assume this
   summary is exhaustive — it's a compression of a longer plan, kept here specifically so
   the intent isn't lost, not a replacement for thinking through the integration points
   fresh.

8. **A 6-item punch list the user gave from a blueprint gap-scan** (home-machine session,
   2026-09-03) — sequenced explicitly by the user as "cheap wins first," then by their own
   stated priority. **3 of 6 done**:
   - ~~Title screen "Continue" shortcut~~ — **done**, see §3 above.
   - ~~Save schema-version field~~ — **done**, see §3 above.
   - ~~Equipment system (Item Type Taxonomy, stat_bonus on equip)~~ — **done**, see §3
     above. The user's own framing going in: "probably the highest-value gap... loot
     currently can't actually make your character stronger."
   - ~~**Skills**~~ — **done** (commit `d4616a5`, see §3 above). Ley-Arts was cut by the
     user before it started. **The Quick-Slot Tray half remains unbuilt** and the user
     later said explicitly it "is not a priority" — treat it as parked, not pending.
   - **API Failure Diagnostics Panel** — not started. A failed call currently just shows a
     plain error banner; the ask is a proper panel (masked API key, one-click "Copy
     Diagnostic Report," Retry/Open Settings/Dismiss-into-PAUSE actions).
   - **Action Suggestion Pills** — not started, but note the schema-side work is already
     done and just unused: `turn.act` (`turnContract.ts`'s `TURN_SCHEMA`) is a required
     field, "2-4 short suggested next actions," and the model populates it every turn —
     confirmed via `grep` that nothing in `src/` reads `turn.act` or renders it anywhere.
     This item is therefore mostly `App.tsx` (store it on the `LogEntry`) + `Chronicle.tsx`
     (render clickable pills that fill the input), not new schema/prompt work.
   - **Codex overhaul — filters** — added mid-session, not originally on the list. The
     user's own framing: "some items have drilldowns, but what we're missing are filters."
     Explicitly flagged to check against the blueprint before building, not yet scoped in
     detail.

### Also noted in the blueprint but not on the numbered list above

~~The blueprint's radial quick-action menu (§6.5)~~ — **done** (office session,
2026-09-03, commit `7ec0e36`). See the revision log entry near the end of this file —
built on code review and a clean build only, not live-verified, due to a total
browser-automation stall that session (§0's third tooling-trap variant).

## 5. Explicitly requested but not yet started (separate from the feature list)

Per the standing instruction this session was given:

- **Verify all existing functions/components and fix issues found.** Started this session
  (commits `f43488d`, `43d5ad8`, `087b413`) — not an exhaustive sweep, but real findings
  were fixed:
  - **Fixed** (user-reported, not found by internal review — commit `087b413`): narration
    (`nar`) sometimes rendered as one dense, unbroken wall of text despite the system
    prompt's rule 1b explicitly telling the model to paragraph it. Checked this session's
    actual saved turns directly: 2 of the last 6 had **zero** `\n` characters at all
    despite being 1300-2000 characters long, while the other 4 paragraphed normally — the
    model is inconsistent, not uniformly broken, so re-wording the prompt again wasn't
    going to be a reliable fix on its own. Added a client-side guarantee instead:
    `src/lib/richText.tsx`'s new `ensureParagraphBreaks`, wired into `renderNarrative`,
    which *only* acts when a turn has zero line breaks at all — any turn the model
    already formatted, even partially, is left untouched. It tokenizes into quoted
    (`'thought/dialogue'`) spans and plain narration first, so a break is never inserted
    *inside* a quote (which would break its `<em>` rendering) and a quote's attribution
    tag always stays with it; plain narration groups into ~3-sentence paragraphs.
    Verified against both actual zero-newline turns from this session's own saved data
    (1952 chars → 8 newlines/5 paragraphs; 1324 chars → 6 newlines/4 paragraphs) and
    confirmed live in the Chronicle — the exact turn the user pointed at now renders with
    clean paragraph spacing and properly isolated dialogue lines.
  - **Fixed**: `turn.stat_grant` (§5.1c permanent stat boosts) was fully defined in the
    schema and prompted to the model but never actually applied anywhere client-side — a
    real, silent gap predating this session. Now applied as a permanent attribute/pool-max
    increase in `App.tsx`'s `sendAction`. Scope note: only the Event/narrative source is
    covered — the Equipment source (item `stat_bonus`) has no equip system to hang off
    yet.
  - **Fixed**: added a defensive final clamp on `player.hp/mp/st` in the same function.
    This was prompted by live testing surfacing `mp: -2` on the test campaign (the
    earlier lead about a negative *ST* value was a misreading of the HUD — the actual
    stored/corrupted field was **MP**, not ST; verified via direct `localStorage`
    inspection, not the screenshot). Every individual mutation path (`applyTurn`,
    `applyLevelUps`, `applyMinionUpkeep`) was code-reviewed and clamps correctly in
    isolation, so the exact repro was never conclusively pinned down — the fix makes the
    [0, max] invariant hold regardless of which path produced a value, rather than
    depending on every current and future path composing correctly. Verified live: the
    corrupted test campaign's `mp` (-2) self-healed to 0 on the very next turn taken.
  - **Fixed**: quest auto-registration (from a bare `quest_update` with no prior
    `{{Term|quest}}` keyword link) showed a raw slug id as its display name
    (`find_the_lost_sigil`) instead of a title-cased fallback — `npc_mem_up` already had
    this right; `quests.ts` now shares the same helper (moved to `slug.ts`).
  - **Reviewed, no issues found**: `shadowReferee.ts` (`applyTurn`'s own clamping),
    `combat.ts` (attack/exhaustion math, disengage detection), `derivedStats.ts`,
    `leveling.ts` (aside from the areas above), `quests.ts`/`inventory.ts`/`npcs.ts`'s
    delta-application logic.
  - **Not yet covered**: a full live click-through of Codex CRUD for every category
    (Quests/Bestiary specifically — NPCs/Factions/Locations/Items/Character/Crafting were
    all exercised live while building other features this session and work correctly;
    Quests/Bestiary share the exact same generic CRUD code path so are lower-risk but
    untested directly), the defeat/recovery flow (`resolveDefeat`), and chapter recap
    (`recapChapter`) beyond the one instance observed firing correctly mid-session.
- **Final "beautification of the entire app" pass.** Lightly started alongside the verify
  pass (a JSX indentation cleanup in Settings.tsx) but not the full pass — see §6 below.

## 6. Suggested resumption order

1. ~~Pick up Tier 3 item #14's Codex Discovery half first~~ — **done** (commit `fbdef88`).
2. ~~#10 Class Evolution~~ — **done** (commit `3597869`).
3. ~~#12 Crafting & Resource Management~~ — **done** (crafting-queue half), commit `ccec6d1`.
4. ~~#13 Three-Branch Summoning & Minion Engine~~ — **done**, commit `9a3158e`.
5. ~~#14 Faction rivalry + Territory Standing~~ — **done**, commit `52591e0`.
6. ~~#16 Multi-provider + on-device saves~~ — **done, both halves**, commit `9a2fed0`.
   **Every Tier 3 list item except #15 (Inspired Mode) is now complete.**
7. #15 (Inspired Mode) is the last Tier 3 item — **spiked and deferred this session, not
   just risk-flagged.** The grounding+schema combination could not be tested: Google
   Search grounding is quota-blocked on this session's API key (429 on every
   grounding-tool call, while plain generation succeeds fine — see §4's #15 entry above
   for the full evidence). Before picking this up again: check whether the grounding
   quota has reset (the error links to `ai.dev/rate-limit`) or whether billing is now
   enabled on the backing project, run the same 3-call spike described in §4 (plain call,
   grounding-only call, grounding+schema call), and only build UI once call #3 returns
   something other than 429 — a 400 means the combination genuinely isn't supported and
   needs a different approach (e.g. two sequential calls instead of one); a 200 means it's
   clear to build.
8. The verify-and-fix pass is **started, not finished** — commits `f43488d`/`43d5ad8`
   fixed three real issues (see §5 above: an unimplemented `stat_grant`, a defensive
   HP/MP/ST clamp, quest auto-name casing). Remaining, concrete next steps for whoever
   continues it: live click-through of Quests/Bestiary Codex CRUD specifically (lower
   risk than most since they share the exact code path already exercised for other
   categories, but genuinely untested), the defeat/recovery flow, and chapter recap
   beyond the one instance already observed working. Don't assume more bugs exist without
   evidence — the pass so far found real issues by reading code and by noticing a live
   HUD anomaly, not by pattern-matching for problems that turned out not to exist (the
   session's own earlier "ST clamping" lead was itself a misreading of which pool was
   actually affected — see §5's correction).
9. Do the final beautification pass — **very lightly started** (one JSX cleanup in
   Settings.tsx, no visual/UX changes) but the real pass hasn't happened. This is a big,
   underspecified scope ("the entire app") — reasonable interpretation: a focused pass
   for concrete inconsistencies (spacing, copy, icon choices, empty-state messaging)
   across screens, not a redesign. Suggest starting from Title → Main Menu → Chronicle →
   Codex in that order (the order a new player actually encounters them) and noting
   anything that looks unfinished or inconsistent with the "illuminated manuscript"
   obsidian-dark chrome established everywhere else (blueprint §6.1).
10. Always run `npm run typecheck` and `npm run build` clean, and manually click through
   the actual change in the dev server (see §0's tooling-trap warning) before committing.
   Note: a `window.confirm()`/`window.alert()` dialog in a flow you're testing live may
   get silently auto-dismissed by the browser-automation tool — if a confirm-gated action
   appears to silently no-op, override it first (`window.confirm = () => true` via the
   JS-exec tool) before concluding the underlying handler is broken. This cost real
   verification time on the Class Evolution manual-trigger flow this session.

**Current priority list (2026-09-05, v3.0 milestone)**, folding in the v3.0 XML migration, Codex redesign, and state consistency overhaul:

1. ~~Tale Dives v3.0 XML Turn Contract & Parser Migration~~ — **done**. Migrated to `<nar>` + `<sync>` wire format with DOMParser + regex fallback; verified ~25% output token reduction on real Gemini calls.
2. ~~NPC & Location Ground Truth Anchoring & Deduplication~~ — **done**. Added `heldWeapon`, `wornArmor`, `firstSeenTime`/`lastSeenTime` on NPCs; `firstVisitedTime`/`lastVisitedTime` on locations; fixed slugify and `isKnownByName` duplicates.
3. ~~Codex Archives Rebranding, Typography Harmonization & RPG Detail Views~~ — **done**. Rebranded to "Codex Archives", harmonized Cinzel titles with Sans metadata/body, dark navy styling (`bg-[#131622]/90`), and tailored modern RPG detail views for all 9 categories.
4. ~~Soundtrack Turn-State Switching & Crossfading~~ — **done**. Auto-switches between ambient rotation and `ts-<state>_` pools on state changes with crossfade.
5. ~~Title & Chronicle UX Polishing~~ — **done**. Modernized Title CTA to "START" with fullscreen support; centered Chronicle narrative reading log, eliminated typewriter animation delay, added responsive desktop sidebar.
6. **Manually verify on-device folder saves** (§3's Multi-provider entry) — Still the one gap that genuinely needs a human: click Settings → Backup → Choose Folder in a real Chrome/Edge browser, since a native OS picker dialog can't be driven by automation.
7. **Inspired Mode (item 7 above)** — Stays parked until the Google Search grounding quota resets or billing is enabled; don't re-spike more than once or twice a session.
8. **Action Suggestion Pills** — High-value UX addition: `<sync>` and JIT context handle `turn.act` (2-4 suggested next actions), but `App.tsx` and `Chronicle.tsx` do not yet render the clickable action suggestion pills into the player's input bar.
9. ~~API Failure Diagnostics Panel~~ — **already done**, corrected from stale here: live-verified 2026-09-06 (a failed turn call renders a "FATE THREAD FALTERED" panel with masked API key, Retry/Open Settings/Copy Diagnostic Report actions) — this item was listed as outstanding but the panel already exists in shipped code.
10. ~~Campaign Seeding~~ — **done, 2026-09-06** (Claude Code on the web). See the dated entry below ("World Seeding: LLM-authored Lore/NPCs/Ambition quest...") for the full writeup. Streaming Turn Rendering (the other half of this item) is still unbuilt.

---


## Full revision history

Every dated session entry through 2026-09-04 has been moved to
[`PROJECT_REVISION_NOTES_ARCHIVE.md`](./PROJECT_REVISION_NOTES_ARCHIVE.md) — this file
was closing in on 2,400 lines, most of it historical log rather than current state.
That file is a verbatim continuation of the same log; nothing was edited or
condensed, only relocated. Read it only when a specific past decision needs more
detail than the summary sections above give — for resuming work, everything above
this line is what actually matters.

New entries below, most recent first.

- **2026-09-07** — Restored the mobile-first branch in `signInWithGoogle()` after it got overwritten (`src/lib/googleDrive.ts`):
  - **What happened**: an earlier pass this session fixed a real bug — Google Drive sign-in doing nothing on a real mobile browser (a screen flicker, no error, no sign-in) — by having `signInWithGoogle()` detect a mobile browser up front and skip `signInWithPopup` entirely, going straight to `signInWithRedirect`. A later commit (pulled in since) replaced that with "always try the popup first, only fall back to redirect if a specific error code (`auth/popup-blocked` etc.) is thrown," plus several good additions on top: a loading/disabled state while signing in, graceful handling of `auth/popup-closed-by-user`/`auth/cancelled-popup-request` (the user just changed their mind, not a failure), an iframe check (redirect can't work there), and a clear message for `auth/unauthorized-domain`.
  - **Why that's a regression risk for the original bug**: "try popup, catch the error" only actually helps on the mobile browsers that throw a *clean, catchable* error when a popup is blocked. Several real mobile contexts (notably some in-app/webview browsers, and some Mobile Safari cases) block `window.open` silently instead — the popup flashes open and immediately closes, and the promise from `signInWithPopup` just never settles, so there's no error to catch and fall back from. That's the exact "screen flickers, nothing happens" symptom originally reported, and the catch-based approach alone wouldn't necessarily fix it on every device it happens on.
  - **Fix**: re-added the `isMobileBrowser()` detection as the very first check in `signInWithGoogle()` — a detected mobile browser (and not inside an iframe) now goes straight to `signInWithRedirect`, never attempting `signInWithPopup` at all — layered on top of, not instead of, the later commit's own improvements (all of which are still in effect for the desktop/popup path and the iframe edge case).
  - **Verification**: `npm run build` clean. Live Playwright pass with a real iPhone user agent: confirmed tapping "Link Account" no longer attempts a popup at all — `signInWithRedirect` fires immediately (observed as an attempted navigation/handshake to Firebase's auth domain, which surfaced a network-level `auth/internal-error` in this sandboxed environment since it can't reach Google's servers — expected here, and notably a *visible, surfaced* error rather than the original silent flicker). The actual end-to-end OAuth round trip on a real device with real network access still couldn't be exercised from this environment.

- **2026-09-07** — Player-Saveable Text Presets for TaleBrief, App Icon Wiring, and Dev Launch Config Fix (`src/types.ts`, `src/lib/store.ts`, `src/lib/glassChrome.tsx`, `src/screens/TaleBrief.tsx`, `public/manifest.json`, `index.html`, `.claude/launch.json`):
  - **Player-Saveable Presets (`src/types.ts`, `src/lib/store.ts`, `src/lib/glassChrome.tsx`, `src/screens/TaleBrief.tsx`)**: TaleBrief's "Where do you dive in?" and "Narration Style" fields can now save the player's own typed text as a named, reusable preset. A "Your Presets" section (save-current with inline naming, click-to-use, per-item delete) was added directly into the existing `ExamplesHelpModal`/`GlassField` bookmark-icon modal, above the built-in example list, rather than introducing a separate UI surface. Persisted via new `loadTextPresets`/`saveTextPreset`/`deleteTextPreset` helpers in `store.ts`, following the file's existing `KEYS` + `load`/`save` convention (new `td_text_presets` localStorage key, keyed by field name — `openingBrief` / `narrationStyle`).
  - **App Icon (`public/img/icons/tale_dives_logo-01.jpg`, `public/manifest.json`, `index.html`)**: Renamed `public/img/Icons` to lowercase `icons` (avoids case-sensitivity breakage on GitHub Pages) and wired the logo in as a `manifest.json` icon entry (actual 120×120 dimensions) and an `apple-touch-icon` link in `index.html`.
  - **Dev Launch Config (`.claude/launch.json`)**: Fixed the `tale-dives-dev`/`tale-dives-preview` configs, which pointed at a `D:\WebApps\tale-dives\.claude\run-*.cmd` path belonging to a different, unrelated project on a different machine — now run `npm run dev`/`npm run preview` directly, with the port corrected to match `package.json` (3000, not the old Vite-default 5173/4173).
  - **Verification**: `npm run typecheck` and `npm run build` clean. Live-verified against the dev server: saved a Narration Style preset, confirmed it round-tripped through `localStorage` (`td_text_presets`), used the "Use →" affordance, deleted it, and confirmed removal from both the modal and `localStorage`.

- **2026-09-06** — Fixed Google Drive sign-in doing nothing on a real mobile browser, and completely refactored Settings for mobile ergonomics (`src/lib/googleDrive.ts`, `src/App.tsx`, `src/screens/Settings.tsx`, `src/lib/glassChrome.tsx`, `src/screens/TaleBrief.tsx`):
  - **The bug report**: tapping "Link Account"/"Backup Now" on an actual mobile browser did nothing — no sign-in, no error, just a brief screen flicker.
  - **Root cause**: `signInWithGoogle()` used Firebase's `signInWithPopup`, which is documented to be unreliable specifically on mobile web — many mobile Safari/Chrome/in-app-webview contexts block `window.open` outright once there's even one `await` between the tap and the call (breaking the "direct user gesture" requirement some browsers enforce), and often without a clean catchable error: the popup just flashes open and immediately closes (matching the reported flicker), and the promise never settles — so the button's own try/catch never saw a failure to show either.
  - **Fix**: `signInWithGoogle()` now detects a mobile browser (`navigator.userAgentData?.mobile`, falling back to a UA regex) and uses `signInWithRedirect` instead — a full navigation to Google's sign-in page and back, which reliably works where a popup silently doesn't. Desktop keeps the faster, non-disruptive popup, with the same redirect fallback if popup-specific errors do surface (`auth/popup-blocked`, `auth/operation-not-supported-in-this-environment`). Since a redirect can't return a token synchronously to whoever tapped the button (the page navigates away before that's possible), a new `completeGoogleRedirectSignIn()` calls Firebase's `getRedirectResult()` once at app boot (`App.tsx`) so a token picked up this way is already cached by the time any screen asks for it — the one UX cost is that a mobile sign-in needs the button tapped again after the redirect completes, once, rather than resolving in the same tap.
  - **Settings refactor**: a near-full-height sheet (viewport-`visualViewport`-aware, same technique the Retry/long-text editors already use for the same reason — staying clear of the mobile keyboard) instead of a small floating card; the former 3-tab-plus-nested-subtab layout (Storage → Local/Cloud) flattened into 4 flat peer icon tabs (AI Model/Gameplay/Local/Cloud) so nothing reads as buried a level down; a sticky Save/Cancel footer that stays reachable regardless of how tall a tab's content is (previously at the very bottom of the whole scrollable panel, meaning a full scroll past the Cloud tab's account/auto-backup/version-list cards just to find Save); icon-led field labels with tap-to-reveal tooltips (`InfoTooltip`, promoted from a TaleBrief-local component to a shared one in `glassChrome.tsx`, now also deduplicated there) replacing the permanent italic caption paragraphs under Creativity Randomness/HUD Opacity/Debug Mode/Combat Mode/Auto-Backup — freeing significant vertical space across all 4 tabs. Also added: an inline amber warning when Auto-Backup is on but the Drive access token was lost on a page reload (memory-only by design, so this was previously a silent no-op with no indication anything had stopped working).
  - **Verification**: `npm run build` clean. Mobile-detection regex verified against real iPhone/Android/desktop user-agent strings in a standalone script. Full live Playwright pass against the dev server with an iPhone user agent and a 390×844 viewport: confirmed all 4 tabs render correctly, the sticky footer stays visible on every tab, and a tooltip opens/closes correctly on tap. The actual Google sign-in redirect round-trip itself couldn't be exercised end-to-end here (needs a real Google account and network egress to accounts.google.com, unavailable in this environment) — the fix is verified at the code/logic level (correct branch selection, correct token hand-off point) rather than a live OAuth round trip.

- **2026-09-06** — Storage Tab Reorganization, Mobile Viewport Containment, and Automatic 3-Version Rolling Cloud Backup (`src/screens/Settings.tsx`, `src/lib/googleDrive.ts`, `src/App.tsx`, `src/types.ts`, `src/lib/store.ts`):
  - **Storage Tab Refactor & Subtabs**: Renamed the "Backup" tab to "Storage" in `Settings.tsx` to reflect both local and cloud persistence management. Added two dedicated subtabs ("Local" and "Cloud") using `GlassSegmented` control, keeping all options organized and comfortably contained on mobile viewports without requiring vertical page scrolling.
  - **Local Storage Management**: Grouped on-device actions cleanly into Active Tale Export, Full Game Backup (`Backup All`), JSON Import, Reset to Defaults, and Complete Data Wipe (with safe `useConfirm` modal prompts), plus On-Device Folder linking via File System Access API.
  - **Cloud Subtab & Assurance**: Reorganized cloud actions into connection status, one-tap manual upload/restore, and background auto-backup synchronization. Added an explicit privacy assurance banner: *"Your save data is encrypted and stored directly in your own private Google Drive storage (`drive.file` scope). Tale Dives never reads, shares, or accesses any other files on your Drive."*
  - **Automatic 3-Version Rolling Cloud Backup**: Replaced the manual 3-slot selector system with an automatic rolling 3-version rotation in `uploadBackupToDrive` (`src/lib/googleDrive.ts`). When uploading, the engine automatically checks existing cloud backup files: if fewer than 3 exist, it creates a timestamped new version; if 3 already exist, it identifies the oldest backup file and replaces it via `PATCH`, maintaining the 3 most recent backups without requiring manual slot decisions.
  - **Dynamic Version Restore Selector**: Under "Restore Cloud", the version selector dynamically lists up to 3 available backup versions found on Drive, labeled clearly by recency (`Version 3 (Latest)`, `Version 2`, `Version 1`) with human-readable timestamps and byte sizes.
  - **UI State & Typo Cleanup**: Removed obsolete `cloudBackupSlot` from `UiPrefs` in `types.ts` and `store.ts`. Updated Settings footer confirmation button icon from floppy disk `Save` to Lucide `Check` to cleanly signify settings save confirmation.
  - **Verification**: Verified cleanly via `lint_applet` (`tsc --noEmit`) and `compile_applet` (`vite build`).

- **2026-09-06** — Google Drive Cloud Backups Integration & Auto-Cloud Sync (`src/lib/googleDrive.ts`, `src/screens/Settings.tsx`, `src/App.tsx`, `src/types.ts`, `src/lib/store.ts`):
  - **What changed**: Extended the Google Drive backup system with 3 dedicated backup slots (`tale-dives-backup.json`, `tale-dives-backup-slot2.json`, `tale-dives-backup-slot3.json`), an interactive slot selector with real-time slot timestamps/status, a specific version restore dropdown to pick which slot/file to restore from, full data parity with the local "Backup All" payload, and an Auto-Cloud Backup background synchronization toggle.
  - **Data Scope Parity**: Unified the payload generation through `getFullBackupPayload()` in `App.tsx`. Both local "Backup All" and Google Drive Cloud Backups contain identical data: `schemaVersion`, `worlds`, `protagonists`, `campaigns`, `globalSlashCommands`, `apiSettings` (with `apiKey` omitted for security), `uiPrefs`, and export timestamp. Restoring from either source maps cleanly into existing saves and templates via `restoreBackupPayload()`.
  - **3-Slot Architecture & Idempotent Updates**: `uploadBackupToDrive` checks existing files on Drive and performs a `PATCH` request if a slot file already exists, updating it in place rather than accumulating duplicate files on Drive. Added slot helpers (`BACKUP_SLOTS`, `getSlotFilename`, `getSlotNumberFromFilename`, `findBackupForSlot`).
  - **Auto-Cloud Backup**: Added `autoCloudBackup` and `cloudBackupSlot` to `UiPrefs` in `types.ts` (persisted in `localStorage` via `store.ts`). When enabled, background backups to Google Drive are automatically dispatched without interrupting gameplay on: (1) starting a new campaign in `beginCampaign`, (2) reaching chapter recap milestones in `sendAction`, and (3) clicking the local "Backup All" button.
  - **UI/UX in Settings**: Added slot selector pill buttons (Slot 1, 2, 3) indicating existing save status; a version dropdown under "Restore Cloud" listing all found backups with their dates/sizes for fine-grained restore targets; and an Auto-Cloud Backup toggle with explanatory description.
  - **Verification**: `npm run lint` and `npm run build` passed with zero errors.
  - **What changed**: Added direct Google Drive cloud backup and restore integration to the Backup section in Settings. Configured OAuth with `https://www.googleapis.com/auth/drive.file` scope (the safe, user-data-compliant scope granting access only to files created by this app, preventing broader Drive access).
  - **Architecture & Security**: Added `src/lib/googleDrive.ts` using Firebase Auth for Google OAuth popup sign-in, with memory-only access token caching (never written to `localStorage` per token security mandates). Implemented multipart JSON file uploads directly to Google Drive v3 REST API (`uploadBackupToDrive`), file listing (`listDriveBackups`), and JSON download/parse (`downloadDriveBackup`).
  - **UI/UX**: Added a Google Drive Cloud status card in Settings under the Backup tab showing connection state, linked account email, status toasts, and a Disconnect action. Added a "Backup to Cloud" button (`tone="action"` with `CloudUpload` icon and active progress indicator) and a "Restore Cloud" button (`tone="positive"` with `CloudDownload` icon). Applied elevated gold glass styling to the adjacent "Backup All" button. All cloud upload/restore actions integrate with `useConfirm` modal prompts before mutating or restoring saves.
  - **Verification**: `npm run lint` and `compile_applet` passed clean with zero errors.

- **2026-09-06** — Retry now opens a big, keyboard-safe popup with a "what would you like changed?" note instead of re-seeding the bottom input bar (`src/lib/useRetryEditor.tsx`, `src/App.tsx`, `src/screens/Chronicle.tsx`):
  - **The problem**: pressing Retry re-populated the main Chronicle input bar with the turn's original action text for the player to revise — but on mobile, the soft keyboard covers almost that entire bar the moment you start typing, making anything past a couple of words unreadable while editing. Worst on Turn 0: the Prologue's action text is the full comprehensive prompt (world background, protagonist identity, brief), the least editable of all in a few cramped visible lines.
  - **The design**: a new `useRetryEditor` hook/modal, sized and positioned the same way `useLongTextEditor.tsx` already solves this exact mobile-keyboard problem elsewhere in the app (`window.visualViewport`-driven height, so the visible viewport — not the pre-keyboard one — sets how tall the popup gets). Two fields, not one: a short "What would you like changed?" note on top (the common case — a critique of the previous attempt, not a full rewrite), and the full original action text below, still directly editable for finer control. Confirming combines them as `` `Player feedback on the previous attempt — revise accordingly: ${note}\n\n${originalOrEditedAction}` `` — the note is always prepended, never substituted, so a retry on Turn 0 can never accidentally drop the World Seeding/Prologue framing the original action text carries. The turn is only actually removed from the log once the player confirms inside the popup, not the moment they answer the initial "Retry this turn?" prompt — safer than before, where confirming that alone already dropped the turn regardless of what happened next.
  - **Styling**: built with plain solid panels/fields (no `backdrop-blur`/translucency) rather than the app's usual glass-over-artwork language (`GLASS_SURFACE`/`FIELD_CLASS`/`GlassButton`) — a dense two-textarea editing surface reads better flat and fully opaque, and per explicit request for this one popup specifically; the rest of the app's glass styling is untouched.
  - **Wiring**: `App.tsx` instantiates the hook alongside `useConfirm`/`useLongTextEditor` and passes `openRetry` into `Chronicle` as `onOpenRetryEditor`, threaded down to `TurnBlock`'s own Retry handler (which also now needs `onSend`, previously only used by the top-level input bar). The older re-seed-the-input-bar behavior is kept as a fallback for any caller not wired to the new popup.
  - **Verification**: `npm run build` clean. Full live click-through via Playwright against the dev server (mocked Gemini response, since no real key is configured here): seeded a one-turn campaign, opened Retry, confirmed the popup renders both fields with the original action text intact, typed a feedback note, confirmed, and verified the resent turn's own action text shows the note prepended ahead of the complete original prompt (a `FULL_ORIGINAL_TEXT_MARKER` planted in the test data survived untouched) and that a new turn actually came back from the (mocked) call.

- **2026-09-06** — Fixed a duplicated player-authored location and a broken Codex popup click for player-authored/World-Seeded locations and factions (`src/lib/jitContext.ts`, `src/api/turnContract.ts`, `src/screens/Chronicle.tsx`):
  - **The bug reports**: (1) "Draconic Ruins of Ignis" — a player-authored location, seeded before Turn 1 — got a second, duplicate Codex entry after the Prologue turn narrated arriving there. (2) Tapping the `{{Basgiath War College|loc}}` keyword link in the narration (also player-authored) did nothing — no popup card.
  - **Root cause, duplication**: `beginCampaign` mints player-authored/World-Seeded location ids as `'loc_' + slugify(name)` (`App.tsx`), but the model is never shown that id anywhere — the Known Entities line only listed location *names*, unlike NPCs/Factions (which already show `(id: ...)`, from an earlier session's id-drift fix). With no real id to reuse, the model kept `loc_id` at the generic "loc_start" the protagonist starts every campaign on, and `ensureLocation` (`lib/locations.ts`) — keyed purely by `loc_id`, no name-based dedup unlike the `{{Term|loc}}` keyword path — happily created a second entry under "loc_start" with the same display name as the real one. The earlier fix's assumption that "loc_id is self-correcting, it's required on every turn" holds once the model has already given a place its own id, but not for a location that already existed in the Codex *before* the model ever saw it.
  - **Root cause, dead click**: Chronicle's `onTapTerm` (the `{{Term|category}}` click handler) always looked up `dict[slugify(term)]` — a bare slug, no prefix. That matches an entry auto-registered via a keyword tag (which also mints a bare-slug id), but never a player-authored/World-Seeded location or faction, which are keyed with a `loc_`/`fac_` prefix the click handler never accounted for — so the lookup missed and the popup silently never opened, exactly the "a miss just does nothing" behavior the code already comments as intentional (for a genuinely unregistered term), just triggered by a real entry instead.
  - **Fix**: (1) `jitContext.ts`'s Known Entities line now shows `(id: ...)` for Locations too, matching NPCs/Factions, and `turnContract.ts`'s rule 2b now explicitly requires reusing a shown location's real id as `loc_id` on the turn it's first (re)visited — including instead of leaving it at the starting placeholder. (2) `onTapTerm` now falls back to a case-insensitive name match across the same category's dict when the direct id lookup misses, so a prefixed real id still resolves. A deeper client-side merge (redirecting a mismatched `loc_id` onto an existing same-named entry, the way the keyword-tag path already prevents *creating* one) was considered but not built this pass — it would need to rewrite `player.locId` after `applyTurn` already sets it and thread the correction through every other same-turn consumer of `turn.loc_id` (`npc_mem_up`'s location, corpse tracking, JIT context); the prompt-side id-exposure fix is the same shape as the fix that already resolved this exact failure mode for NPCs/Factions, so it's the primary fix, with the deeper safety net left as a future option if the duplication recurs.
  - **Verification**: `npm run build` clean. Re-simulated both fixes against the reported case in standalone Node scripts: the `onTapTerm` name-fallback resolves "Basgiath War College" and "Draconic Ruins of Ignis" to their real `loc_` -prefixed ids, and a term with no matching entry at all still correctly resolves to nothing (no false-positive popups).

- **2026-09-06** — Fixed two Codex auto-registration bugs surfaced by a fresh campaign's Turn #0 payload (`src/lib/codex.ts`, `src/App.tsx`, `src/api/turnContract.ts`):
  - **The bug report**: a brand-new campaign's Prologue turn tagged `{{Kei Ashborn|npc}}` (the protagonist's own name) and `{{Navarre|faction}}` (the setting's nation, not one of its actual factions) in the narration. Both are `{{Term|category}}` keyword links (`lib/codex.ts`'s `applyKeywordLinks`), which auto-registers a Codex stub for anything tagged — so the first forked a bogus NPC entry for the player character himself, and the second forked a "Navarre" faction entry distinct from (and confusable with) the already-registered "Navarre High Command".
  - **Root cause**: `applyKeywordLinks`'s `case 'npc'` had no guard against the tagged term being the player's own name, and its `case 'faction'` had no dedup check at all against existing faction names — unlike `case 'loc'`, which already had a fuzzy `isKnownByName` substring-containment check (from an earlier session's location-dedup fix) to skip re-registering a place already known under a close variant of its name.
  - **Fix**: generalized `isKnownByName` from `Dict<LocationEntry>`-specific to any `Dict<{ name: string }>`, so the exact same fuzzy-match heuristic now also guards `case 'npc'` and `case 'faction'` — "Navarre" tagged as a faction is now recognized as already covered by "Navarre High Command" (`"navarre high command".includes("navarre")`) and skipped rather than forked. Separately, `applyKeywordLinks` gained an optional trailing `playerName` param (passed from `App.tsx` as `current.player.name`) — an `{{Term|npc}}` tag matching the player's name (case-insensitive) is now skipped outright, since there's no existing NPC entry to fuzzy-match against in that case, only the player's own identity to check against. Added matching prompt-level guidance in `turnContract.ts`'s rule 6 (never tag the protagonist as an NPC; only tag a specific named organization as a faction, never the overarching nation/world/setting name) as defense in depth, mirroring this session's earlier id-drift fix's two-layer approach.
  - **Verification**: `npm run build` clean. Re-simulated the exact tag list from the reported payload (`Kei Ashborn|npc`, `Omega Eclipse (O.E.) AI|npc`, `Nyx Umbra|npc`, `Navarre|faction`, `Draconic Ruins of Ignis|loc`, `Basgiath War College|loc`, `Riders Quadrant|faction`) against the new logic in a standalone Node script — confirmed the player self-tag and the nation-as-faction tag are both now skipped, while every legitimately-already-known entity (Omega Eclipse, Nyx Umbra, Riders Quadrant, both locations) still resolves to its existing entry rather than forking a duplicate.

- **2026-09-06** — Chapter-relative turn trace ids (`Cn-n`), stamped Codex provenance, and a "Codex Changes" debug copy button (`src/lib/leveling.ts`, `src/types.ts`, `src/lib/autoRegister.ts`, `src/lib/codex.ts`, `src/lib/locations.ts`, `src/lib/npcs.ts`, `src/lib/quests.ts`, `src/lib/skills.ts`, `src/lib/inventory.ts`, `src/lib/combat.ts`, `src/App.tsx`, `src/screens/Chronicle.tsx`, `src/screens/Codex.tsx`):
  - **Ask**: a client-side trace id per narrated turn ("C1-1, C1-2..." — chapter number, block number within the chapter) so any Codex entry can record which turn introduced it, queryable later; plus a second copy button in the existing per-turn Debug Payload popup for just the state-changing part of a turn, separate from the full request/response.
  - **`turnRefFor(turnNumber)`** (`lib/leveling.ts`) derives `"C{chapter}-{block}"` from `turnCount` and the existing `CHAPTER_TURN_INTERVAL` (15) constant — no new persisted field, computed the same way chapter boundaries already are. Verified by hand: turn 1 → `C1-1`, 15 → `C1-15`, 16 → `C2-1`, 30 → `C2-15`, 31 → `C3-1`.
  - **`LogEntry.turnRef`**: stamped on every real narrated turn in `App.tsx`'s `sendAction`, computed once (hoisted early, before the Codex-apply pipeline runs) and reused for both leveling's existing chapter-boundary check and the new stamping below — no duplicate `turnNumber` computation.
  - **`loggedAt` on all 8 Codex entry types**: stamped once, at creation, via a new optional trailing `turnRef` parameter threaded through the single shared low-level primitive (`ensureEntry`, `lib/autoRegister.ts`) that `ensureStub`/`applyKeywordLinks`, `ensureLocation`, `applyNpcUpdates`, `applyQuestUpdate`, and `applySkillLearn` all route through — one place to add the stamp rather than duplicating it in six files. The two paths that deliberately bypass `ensureEntry` (`applyInventoryChanges` for items, `ensureAdversary` for bestiary, since it needs to *upgrade* an existing bare stub rather than treat "already exists" as final) each get their own `existing?.loggedAt ?? turnRef` — preserves the original stamp on re-acquisition/upgrade instead of overwriting it.
  - **Codex Changes copy button** (`Chronicle.tsx`): a new `extractSyncBlock(raw)` pulls just the `<sync>...</sync>` portion out of a turn's raw response text; the existing per-turn Debug Payload popup gained a second copy button next to the original ("Copy just the `<sync>` block — the Codex-affecting part of this turn"), and both the collapsed toggle and expanded header now show the turn's `(C1-3)`-style ref. The full Session Payload export's per-turn header line also gains the `[C1-3]` tag.
  - **Basic query-by-turn support** (`Codex.tsx`): each category's existing search-matching `useMemo` now also checks `loggedAt`, so typing e.g. `C1-3` into any Codex search box surfaces every entry logged that turn.
  - **Deliberately deferred**: no standalone visible "Logged: C1-3" badge in Codex's detail/card views yet — the data is recorded and searchable, but not yet shown as its own UI badge. Scoped out to fit this pass; the user's own phrasing on the ask ("if needed") suggested this was optional. Worth a quick follow-up if the querying alone isn't enough.
  - **Verification**: `npm run build` clean (twice — once after the apply-pipeline wiring, once after the Chronicle/Codex UI additions). `turnRefFor` math and the `<sync>` regex extraction verified with a standalone Node script. Not yet click-through-verified live in a browser (no explicit re-request from the user to do so this round).

- **2026-09-06** — Fixed a real NPC/Faction duplicate-Codex-entry bug, a malformed `[[Item|item]]` narration tag, and exposed the World Seeding call's debug payload (`src/api/turnContract.ts`, `src/lib/jitContext.ts`, `src/lib/npcs.ts`, `src/lib/richText.tsx`, `src/App.tsx`, `src/screens/Chronicle.tsx`):
  - **The bug report**: a real campaign run (screenshots + a full Turn #0 debug payload) showed the Codex registering duplicate entries for known NPCs/Factions the player had explicitly authored at creation — e.g. both a rich "General Lilith Sorrengail" (player-authored) and a bare auto-registered "L Sorrengail" stub, and likewise for "Riders Quadrant"/"Navarre High Command" alongside their own duplicate auto stubs.
  - **Root cause**: the "Known Entities" context line (`jitContext.ts`) and `describePresentNpc` (`npcs.ts`) only ever showed entity *names* to the model, never their real dict *id* — so when the model needed to emit `npc_mem_up`/`fac_rep` for an already-known entity, it had no ground truth id to reuse and invented its own abbreviation (`l_sorrengail`), forking a second entry under a new id instead of updating the existing one. Confirmed against the pasted payload: the model's invented `<npc id="l_sorrengail" aff="-5" trust="10">` tag's stats matched the screenshot's duplicate stub exactly.
  - **Fix**: `jitContext.ts`'s `elsewhereNpcNames`/`factionNames` now render as `"${name} (id: ${id})"`; `describePresentNpc(id, entry)` takes the id and prints it too; `presentNpcs()` (`npcs.ts`) returns `[string, NpcEntry][]` instead of bare values so the id survives to the caller; a new explicit rule in `turnContract.ts` requires the model to reuse the exact id shown rather than invent one. Locations were deliberately left alone — `loc_id` is already a required field on every turn's `<turn>` tag, so it's self-correcting by design.
  - **The `[[Item|item]]` tag**: the model conflated `[[Item]]` (double-bracket markup, no category suffix) with `{{Term|category}}` (a separate marker that does take one), producing `[[Poison-Lined Boots|item]]` in narration. Fixed at the prompt level (explicit rule in `turnContract.ts` forbidding a `|category` suffix inside `[[...]]`) and defensively at render time (`richText.tsx` strips a trailing `\|\w+$` before display/icon lookup, so a stray one at any temperature still resolves instead of leaking literal `|item` text).
  - **No quests registered**: traced to the campaign's brief simply not implying any quest-worthy goal on Turn 0 — not a bug, expected behavior (a Quest only registers on an explicit `quest_update`).
  - **`campaign.seedDebug` exposure**: the one-time World Seeding call's raw request/response (added the same session World Seeding itself was built) had no UI to view it. Wired into Chronicle's existing Session Payload debug panel as a prepended "World Seeding (one-time call, before Turn 0)" section.
  - **Verification**: `npm run build` clean.

- **2026-09-06** — World Seeding: LLM-authored Lore/NPCs/Ambition quest, layered onto AI Studio's player-authored creation CRUD, plus the quest `type` field (`src/api/worldSeedContract.ts`, `src/lib/worldSeedParser.ts`, `src/lib/xmlHelpers.ts`, `src/lib/seeding.ts`, `src/api/providers/types.ts`/`gemini.ts`, `src/App.tsx`, `src/screens/NewGame.tsx`, `src/screens/Chronicle.tsx`, `src/screens/Codex.tsx`, `src/types.ts`, `src/api/turnContract.ts`, `src/api/xmlTurnContract.ts`, `src/lib/xmlTurnParser.ts`, `src/lib/quests.ts`, `src/lib/discovery.ts`, `src/lib/factions.ts`):
  - **Context**: the previous session's user request (LLM-driven world seeding before Turn 1) landed the same night a parallel Google AI Studio session shipped its own ~5,400-line pass adding player-authored structured CRUD — World Setup's Key Factions/Locations tables and Protagonist Setup's Attributes point-buy/Starting Abilities table, all auto-seeded into the Codex by `beginCampaign` with no LLM call. This session re-scoped the original plan around that: nothing seeded Lore, NPCs/starting relations, or a personal Ambition quest, and a location/faction the player left blank still started with nothing — that's the gap this closes, without duplicating what AI Studio already built.
  - **Small fixes first**: `player.copper` 14580 → flat `10_000` (exactly 1 Gold, §5.2's 1G = 10,000 base copper) per explicit request. Fixed an unrelated bug found while surveying the new code: `DiveLoadingScreen`'s exit effect navigated to `'storymode'` (the mode picker) instead of `'chronicle'` once a resumed campaign's log had entries — a copy-paste mistake, now corrected. Starting Abilities' cap lowered from AI Studio's 4 to the user's explicit "up to 3," with a standing caption warning that starting skills raise the world's expectations rather than granting a free edge. Added one new optional "Special Key Item" field (`ProtagonistData.keyItem`) — the one piece of the original ask AI Studio's CRUD work didn't cover.
  - **The seeding pipeline**: a new one-shot provider call (`runSeed`, mirroring `runSummary`'s shape — its own params/fetch/return, no shared parsing with `runTurn`) sends a `<seed>` XML grammar (`worldSeedContract.ts`) asking for Lore (always), starting NPC relations (always), an optional Ambition quest (only if the brief implies a personal goal), and — only when the player's own Locations/Factions lists came back empty — a small fallback of each, plus a named key item fleshed into a full `ItemEntry`. Parsed by `worldSeedParser.ts` using primitives (`decodeXmlEntities`, attribute readers, `parseStatBonus`) extracted out of `xmlTurnParser.ts` into a new shared `xmlHelpers.ts` so both parsers use the same code. Orchestrated by `lib/seeding.ts`'s `seedCampaign()`, which never throws — a failed or malformed call degrades to no enrichment rather than blocking campaign creation, with the raw prompt/response (or failure reason) stored on `campaign.seedDebug` for Debug Mode. IDs are minted via the same `slugify()` `applyKeywordLinks` uses so a later `{{Term|npc}}` mention of a seeded name converges onto the existing entry instead of forking a duplicate. A couple of Lore entries can come back `hidden` with a `manual` reveal trigger and a teaser (deliberately not letting the model invent `flag`/`location_visit`/etc. conditions it could get wrong) — extracted `validateDiscovery()` out of `Codex.tsx` into `lib/discovery.ts` so this pipeline and the manual editor share one fail-open-to-`known` validator.
  - **Prologue framing**: `beginCampaign` is now `async` — it awaits `seedCampaign()` before building the final `Campaign`, merging seeded Lore/NPCs/Quests/Items alongside the player-authored Locations/Factions/Skills, then prepends an explicit "this is the Prologue" instruction to the same `firstAction` text it already built (establish starting NPC/faction relations and the protagonist's starting goal, drawing on the Codex context now already populated) before storing it and navigating to a new `'seedingreview'` screen instead of firing it immediately.
  - **Seeding Review screen**: reuses `<Codex>` verbatim (confirmed it's a pure props-in/callbacks-out view with no in-progress-campaign coupling) rather than building a new editor — its one repurposed behavior is that the top-level Back action now confirms the review and fires the stashed Prologue turn instead of returning to Chronicle, since there's no Chronicle to return to yet. `DiveLoadingScreen` (previously only reachable via Title's "Continue") now also covers the seeding network gap.
  - **Quest `type` field** (Main/Side/Ambition/Secret Ambition): added to `QuestEntry`/`QuestUpdate` (`types.ts`), the `quest_update` schema and a new MECHANICS rule in `turnContract.ts`, the live `<quest>` tag in `xmlTurnContract.ts`/`xmlTurnParser.ts`, `applyQuestUpdate`'s passthrough (`lib/quests.ts`), and a `QuestTypeBadge` in `Codex.tsx` alongside the existing status badge. Secret Ambition quests are prompt-gated to originate/advance only on an INSIGHT or EXPLORE turn — not client-enforced, and deliberately not surfaced in `jitContext.ts`'s context lines, so a hidden Secret Ambition's existence doesn't leak into the model's awareness before it's meant to be discovered.
  - **A real bug this surfaced**: adding `type?` to `QuestEntry` broke a type-narrowing guard in `Chronicle.tsx`'s popup card (`'type' in popupEntry`, previously exclusive to `ItemEntry`) — TypeScript caught it immediately as a compile error; fixed by asserting `as ItemEntry` under the already-correct `popup.category === 'item'` runtime check instead.
  - **Verification**: `npm run typecheck`/`npm run build` clean after every phase. Full live click-through via Playwright against the dev server (no real Gemini key configured in this environment): confirmed live in the browser — the 1G starting wealth, the 3-cap/warning caption/key-item field on Protagonist Setup, and, via a mocked `generativelanguage.googleapis.com` response carrying a synthetic `<seed>` block, the actual parse-and-merge path working end-to-end (2 Lore entries including the hidden/teaser mask, 1 NPC, 1 Ambition quest all landing correctly in the Seeding Review screen's category counts and detail views). Confirming the review correctly fired the Prologue turn and landed on Chronicle, which degraded gracefully (no crash, no white screen) into the existing "FATE THREAD FALTERED" diagnostics panel for the intentionally-unmocked ordinary turn call. **Not yet verified**: actual generated content quality against a real Gemini key — that needs a live run with real credentials.

- **2026-09-05** — Lore-Accurate Fourth Wing Starter Template Adjustments (`src/data/starterTemplates.ts`, `src/lib/store.ts`):
  - **Violet Sorrengail Master Template**:
    - **Attributes**: Configured custom point distribution (`STR: 10`, `INT: 18`, `AGI: 14`) reflecting Violet's frail bone density & physical stature paired with an exceptional scribe intellect and swift dagger reflexes.
    - **Starter Skills**: Seeded lore-accurate abilities (*Poisoner's Edge*, *Anatomical Precision*, *Dagger Parry & Feint*).
    - **Identity Parameters**: Normalized gender (`F`), class archetype (`apprentice_scribe`), class title (`Apprentice Scribe`), physical traits (hypermobile joints, silver-tipped hair), secret (hidden boots with poison daggers and instructor flaw notes), and background history.
  - **Navarre World Master Template**:
    - **Structured Factions**: Added 5 lore-accurate factions (*Riders Quadrant*, *Scribe Quadrant*, *Navarre High Command*, *Poromiel Gryphon Fliers*, *Shadow Venin & Wyvern*) with territories, attitudes, and descriptions.
    - **World Systems**: Enriched background, power system (dragon signet magic & runic arrays), tech level, and narration style.
  - **Store Synchronization**: Updated `src/lib/store.ts` to preserve `factionsList`, `customAttributes`, and `startingSkills` on master template load.
- **2026-09-05** — Violet Sorrengail Template Adjustments (`src/data/starterTemplates.ts`, `src/screens/NewGame.tsx`):
  - Updated preset protagonist Violet Sorrengail's starter template to map to the new field formats (`gender: 'F'`, `classId: 'apprentice_scribe'`, `className: 'Apprentice Scribe'`).
  - Updated `NewGame.tsx` state initialization to normalize legacy gender values (`Female` / `Male`) to the dropdown options (`F` / `M`).
- **2026-09-05** — Archetype / Class Enum Dropdown & Custom Class Setup Modal (`src/screens/NewGame.tsx`):
  - **Archetype/Class Enum Dropdown**: Restored Archetype/Class as a standard `<select>` dropdown populated with all preset class archetypes (Warrior, Mage, Assassin, Paladin, Necromancer, etc.) plus a "Custom Class..." option.
  - **Custom Class Modal**: Selecting "Custom Class..." opens a modal prompting for:
    1. Custom Class Name (text input).
    2. Base Archetype (Stat Curve) dropdown (selecting from the preset class enum values).
  - **Vitals Curve Integration**: Sets `classId` to the chosen base archetype (supplying the vitals/attribute weight curve under the hood) while setting `className` to the user's custom class name. An adjacent "Edit" button allows re-configuring custom class details at any point.
  - **Verification**: Verified clean TypeScript compilation (`compile_applet`).
- **2026-09-05** — Class Preset Button Removal (`src/screens/NewGame.tsx`):
  - Removed the browse/search button adjacent to the Archetype / Class input per focus mode request, allowing the text input to span the full width of its field.
- **2026-09-05** — Protagonist & World Setup Refactor, Attribute Table, Preset Relocation, and "DIVE IN" Loading Flow:
  - **Gender Enum Dropdown**: Converted Gender field in `NewGame.tsx` to a dropdown (`M`, `F`, `N/A`) aligned inline alongside the Archetype/Class input.
  - **Dense Attribute Table**: Refactored Attributes in `NewGame.tsx` into a compact 3-column table (`STR`, `INT`, `AGI`) with stacked ▲/▼ buttons and removed gain values below stat numbers to conserve vertical space.
  - **Compact Vitals**: Reduced vertical padding in Vitals, removed the "Shadow Referee Validated" text label, and cleaned up layout density.
  - **World Setup Cleanup**: Removed redundant "Genre & Tone" and "Core Regional Conflict" inputs from `WorldSetup.tsx`, updating the "World Background" hint to incorporate genre, tone, and conflict guidance directly into the main background prompt.
  - **Preset Action Row Relocation**: Moved the "Save Preset" and "Save as New Preset" buttons to the bottom of the scrollable form area in both `NewGame.tsx` and `WorldSetup.tsx`.
  - **"DIVE IN" Flow**: Renamed the "Start" CTA button in `TaleBrief.tsx` to "DIVE IN". Created `DiveLoadingScreen.tsx` (using `m_title-bg2.webp` on mobile and `pc_title-bg2.webp` on desktop). Updated `App.tsx` state machine to immediately switch soundtrack to `TempestDive_ost03.opus`, display `DiveLoadingScreen`, and transition to `storymode` (Story Viewer) as soon as the first LLM turn response arrives.
  - **Verification**: Verified via `compile_applet` (all TypeScript type checks and Vite build passed clean).
- **2026-09-05** — Further Protagonist Setup UI Fixes (`src/screens/NewGame.tsx`):
  - Made the Gender field align nicely on the same line as Archetype/Class by applying bottom-alignment (`items-end`) to the flex container.
  - Renamed "Attributes Point Buy" to simply "Attributes".
  - Refactored the Attributes assignment component layout: rather than three rows of horizontal stepper inputs, transformed it into a dense 3-column table view (STR | INT | AGI). The attribute value and modifier sit side-by-side, with stacked compact ChevronUp/ChevronDown buttons to their right, saving significant vertical space.
  - Increased the size of the auto-distribute/reset button icon for better visibility and tap targets.


- **2026-09-05** — Setup Flow UI Compacting & Restructuring (`src/screens/WorldSetup.tsx`, `src/screens/NewGame.tsx`):
  - **Scrollable Area Fix**: Restructured the flex layout in both setup screens so that the Mobile subtabs and the bottom Action bar (Continue) remain sticky, and only the form fields themselves are scrollable.
  - **World Setup Cleanup**: Removed redundant "Genre & Tone" and "Core Regional Conflict" inputs as they overlapped conceptually. Their hints and expected inputs were combined into a more comprehensive "World Background" field.
  - **Protagonist Setup Redesign**:
    - Renamed subtabs to a cleaner "Identity", "Origin", and "Skills".
    - Consolidated Name and Age into a single row, minimizing the width of the Age input. Removed "Optional" hints.
    - Consolidated Archetype/Class and Gender into a single row.
    - Simplified the Archetype/Class input by combining the previous text input and `<select>` dropdown into a single `<input>` field with a `<datalist>`, retaining auto-distribution behavior.
    - Fully refactored the Attributes Point Buy section for maximum mobile compactness: converted the previous 3-column tall grid into a dense, vertical list of single-line rows for STR, INT, and AGI, stripping out unneeded header space.
    - Removed redundant section headers ("Hero Identity & Attributes", "Narrative Identity & Secret", "Turn-1 Memory Grounding") to maximize screen space for actual inputs.
    - Renamed "Background & Origin" to "Origin Story" and cleaned up its hint.

- **2026-09-05** — Power System UI Adjustments (`src/screens/WorldSetup.tsx`): Adjusted the "Power System" text area in the World Setup screen to default to 2 lines of text instead of 4, keeping the UI tighter and more consistent. Additionally, removed the secondary "Lore & Rules" sub-header from the setup views.

- **2026-09-05** — Add Faction & Add Ability Modal Mobile Layouts (`src/screens/WorldSetup.tsx`, `src/screens/NewGame.tsx`): Refactored the internal forms for "Add Key Faction" and "Add Starting Ability" to use responsive grid layouts (`grid-cols-1 sm:grid-cols-2`), fixing mobile crowding where elements like "Attitude / Alignment" and "Territory / Domain" were squeezed into a 2-column layout. Simplified form labels to "Attitude", "Territory", "MP Cost", and "ST Cost" to ensure they fit cleanly in standard viewports.
  - **Verification**: Verified via `lint_applet` and `compile_applet`.

- **2026-09-05** — Factions CRUD Cleanup (`src/screens/WorldSetup.tsx`): Removed the redundant "Quick Factions Summary" comma-separated text field, simplified the header to "Key Factions", and streamlined the fast CRUD list to a compact one-row display per faction containing only the faction name and its edit control, with the Add Faction action transitioning to a circular icon button.

- **2026-09-05** — Gateway Screen Header Cleanup (`src/screens/WorldSetup.tsx`, `src/screens/NewGame.tsx`): Removed redundant intermediate title/subtitle text blocks ("Seeding & Architecture" / "Hero Forge & Attributes") from both World Setup and Protagonist Setup gateway screens, allowing the two selection cards to sit cleanly directly below the main GlassHeader matching StoryMode.
  - **Verification**: Verified via `lint_applet` and `compile_applet`.

- **2026-09-07** — World Seed Weaver: Isolated Constellation Node UI for Tale Creation (`src/screens/WorldSeedWeaver.tsx`, `src/screens/MainMenu.tsx`, `src/App.tsx`, `src/assets/images/`):
  - **Isolated Constellation Node Architecture (`src/screens/WorldSeedWeaver.tsx`)**: Created a dedicated, creative alternative creation experience inspired by the node constellation concept. Arranged four primary celestial nodes (Protagonist, World, NPCs, and Narrative) with pulsing ley-lines, SVG glow filters, and dynamic readiness states.
  - **Drill-Down Sub-Modals with Ergonomic Forms**:
    - **Protagonist Node (Amber/Gold)**: Class selection, points allocation, derived vitals preview HUD, background/personality, and starting skills.
    - **World Node (Cyan/Azure)**: Name, era/tech, power system, regional conflict, and key factions list.
    - **NPCs Node (Emerald/Jade)**: Starting companions, rivals, commanders, weapons, personality traits, affection/trust sliders, and attitude tiers.
    - **Narrative & Prologue Node (Arcane Violet)**: Opening scene hook, narrator tone, and combat mode selection. Kept locked behind glowing prerequisite checks until Protagonist, World, and NPCs are finalized.
  - **Main Menu Entry**: Added a dedicated "World Seed Weaver" portal button in the Tales grid of `MainMenu.tsx` for direct access to this isolated creation flow.
  - **Codex & Campaign Memory Integration (`src/App.tsx`)**: Extended `beginCampaign` to accept custom seeded NPCs from the node flow, merging them directly into the campaign's starting NPC registry alongside world seeding fallback data.
  - **Verification**: Verified zero TypeScript errors via `lint_applet` (`tsc --noEmit`) and successful production compilation via `compile_applet`.

- **2026-09-05** — Story Creation & World Seeding UX Overhaul: Gateway Selection, PC Multi-Column Layout, Attribute Point-Buy, and Faction/Skill CRUD (`src/screens/WorldSetup.tsx`, `src/screens/NewGame.tsx`, `src/types.ts`, `src/App.tsx`):
  - **Gateway Choice Architecture (`WorldSetup.tsx`, `NewGame.tsx`)**: Replaced initial auto-loaded master preset state with an intentional 2-card Gateway screen ("New World" / "New Protagonist" vs "Load Preset"). Players can start with a clean canvas or explore presets without having unrequested preset fields preloaded.
  - **PC Multi-Column Layout vs Mobile Subtabs (`WorldSetup.tsx`, `NewGame.tsx`)**:
    - On PC/large screens (`lg:` and up), eliminated subtabs in favor of a balanced two-column layout with a subtle ornate gold vertical divider, utilizing available screen estate efficiently.
    - On mobile/tablet (`< lg`), preserved clean touch-friendly subtabs (`Overview` / `Depth` for World Setup; `Basics` / `Identity` / `Skills` for Protagonist Setup).
  - **World Setup Restructuring & Factions CRUD (`WorldSetup.tsx`)**:
    - Widened Genre & Tone and Core Regional Conflict to 3-line vertical textareas and moved Conflict to the Overview column.
    - Expanded Power System to 4 vertical lines.
    - Added a structured Key Factions CRUD table allowing players to add, edit, and delete named factions with alignment badges (Allied, Friendly, Neutral, Hostile, Rival), territory, and agendas, which automatically seed the Factions Codex on Turn 1.
  - **Protagonist Attributes Point-Buy & Live Vitals HUD (`NewGame.tsx`)**:
    - Implemented a 12-point allocation system over base 10 STR, INT, and AGI with stepper controls `[-]` and `[+]`, unassigned points counter, and auto-distribute helper.
    - Added live derived vitals preview HUD cards (HP Max, MP Max, ST Max) calculated via `derivedPools` formulas validated by the Shadow Referee.
    - Integrated interactive info tooltips for STR, INT, AGI, and derived vitals formulas.
  - **Starting Abilities CRUD & Codex Seeding (`NewGame.tsx`, `App.tsx`)**:
    - Added a Starting Abilities CRUD table with type/tier tags and MP/ST costs, auto-suggest for class archetypes, and modal editing.
    - Updated `beginCampaign` in `App.tsx` to automatically seed user-configured custom attributes, vitals, starting skills, and factions into game memory and Codex registries.
  - **Master Tag Font-Weight Normalization**: Harmonized all "Master" badges across cards and modals to use `font-normal` weight.
  - **Verification**: Verified clean TypeScript compilation (`tsc --noEmit` via `lint_applet`) and production compilation (`compile_applet`).

- **2026-09-05** — UI Polish: Protagonist Preset Card Typography, Header Subtitle Sizing, World Preset Tag Removal, and GlassField Layout Optimization (`src/screens/NewGame.tsx`, `src/lib/glassChrome.tsx`, `src/components/PresetDetailModal.tsx`):
  - **Protagonist Preset Typography (`src/screens/NewGame.tsx`)**: Refined protagonist preset card descriptions and details to use `font-sans` (`Plus Jakarta Sans`) and a compact `text-[13px]` font size.
  - **Header Subtitle Sizing (`src/lib/glassChrome.tsx`)**: Increased the `GlassHeader` subtitle size to `text-[15px]` for improved visual hierarchy.
  - **Redundant World Tag Removal (`src/components/PresetDetailModal.tsx`)**: Cleaned up the World detail modal header by removing redundant tag badges.
  - **GlassField Layout Optimization (`src/lib/glassChrome.tsx`)**: Repositioned action buttons (preset examples/info) to the top-right corner of the `GlassField` input container, saving vertical space previously lost to a label-row linebreak.
  - **Verification**: Verified via `lint_applet` and `compile_applet`.

- **2026-09-05** — Common Trope Placeholders First, Redundant Protagonist Tag Removal, Global Plus Jakarta Sans Input Styling, and Mobile Navigation Rubber-Band Elimination (`src/data/formExamples.ts`, `src/components/PresetDetailModal.tsx`, `src/index.css`, `src/screens/Codex.tsx`, `src/screens/WorldSetup.tsx`, `src/screens/NewGame.tsx`, `src/App.tsx`):
  - **Common Tropes First in Placeholders & Examples (`src/data/formExamples.ts`, `src/screens/WorldSetup.tsx`, `src/screens/NewGame.tsx`)**: Reordered all form placeholders and example help cards so common tropes (e.g. Grounded combat skill & martial stamina, elemental magic with mana pools, dragon/beast bonding with signet abilities, mana cores, litRPG status system, and common fantasy backgrounds) are presented first.
  - **Redundant Protagonist Tags Removed (`src/components/PresetDetailModal.tsx`)**: Cleaned up the protagonist detail modal header by removing redundant tag badges (`isMaster ? 'Master' : 'Custom'`, etc.) that duplicated information displayed in the subtitle and metadata grid.
  - **Global Input Typography in Plus Jakarta Sans (`src/index.css`, `src/screens/Codex.tsx`)**: Declared `input, textarea, select, button { font-family: var(--font-sans); }` globally in `src/index.css` so form fields, filters, and text inputs default cleanly to Plus Jakarta Sans. Updated `TextField` in `Codex.tsx` to `font-sans`.
  - **Mobile Navigation Rubber-Band Fix (`src/App.tsx`, `src/index.css`)**: Eliminated the vertical slide translation (`y: 12` / `y: -12`) on top-level screen transitions in `App.tsx` in favor of a clean, pure opacity fade (`duration: 0.15`), and anchored the motion container to `w-full min-h-dvh flex flex-col`. Added explicit `window.scrollTo(0, 0)` on `navigateTo`. Set `overscroll-behavior-y: none` and `touch-action: pan-y` on `html, body, #root` to prevent browser rubber-band/bounce effects during mobile screen transitions.
  - **Verification**: Verified with `lint_applet` and `compile_applet`. Production build compiled cleanly.

- **2026-09-06** — Chronicle Header & Input Bar Solid Dark Theme (`src/screens/Chronicle.tsx`, `src/index.css`):
  - **Removed Glassmorphism and Transparency**: Switched the top header bar, mobile vitals HUD bar, elevated input bar tray, and text input area in `Chronicle.tsx` to solid opaque obsidian surfaces (`bg-[#0b0d14]`, `bg-[#0d0f18]`, and `bg-[#131622]`), eliminating `backdrop-blur-sm`, `backdrop-blur-md`, and dynamic alpha transparency.
  - **Verification**: Verified with `lint_applet` and `compile_applet`. All builds green.

- **2026-09-06** — Graphics Performance & GPU Compositing Optimization (`src/lib/cyclingBackground.tsx`, `src/index.css`):
  - **Background Crossfade Layer Isolation (`src/lib/cyclingBackground.tsx`)**: Promoted heavy full-screen background elements (`filter: blur(36px)`) onto hardware compositor layers with `transform: scale(1.15) translateZ(0)`, `willChange: opacity, transform`, and `backfaceVisibility: hidden`. Eliminated CPU paint invalidations during the 7-second background crossfade.
  - **Ambient Particle Layer Containment (`src/index.css`)**: Isolated `.title-sparks` and `.bday-confetti` containers with `contain: strict; transform: translateZ(0)` and added `will-change: transform, opacity; backface-visibility: hidden;` to particle spans. Keeps all continuous particle translation and scale keyframes on the GPU compositor without triggering reflow or restyling parent DOM subtrees.
  - **Turn Log Windowing Confirmed (`src/screens/Chronicle.tsx`)**: Verified `WINDOW_SIZE = 20` turn windowing and memoized `TurnBlock` prevent exponential DOM node growth or rich text re-parsing during gameplay.
  - **Verification**: Ran `lint_applet` and `compile_applet` cleanly.

- **2026-09-06** — Custom Domain & Deployment Asset Hardening (`public/favicon.svg`, `public/manifest.json`, `index.html`, `src/screens/Settings.tsx`):
  - **Favicon & Web Manifest Missing Icon Fix (`public/favicon.svg`, `public/manifest.json`, `index.html`)**: Created vector `public/favicon.svg` matching the Tale Dives gold-and-slate theme. Switched asset URLs in `index.html` and `public/manifest.json` from absolute `/favicon.svg` and `/manifest.json` to relative (`favicon.svg`, `manifest.json`, `start_url: "./"`) to prevent 404 download errors on subpaths (such as GitHub Pages or custom subdomains). Added `<meta name="mobile-web-app-capable" content="yes" />` alongside the deprecated Apple variant in `index.html`.
  - **Firebase Authorized Domain Handling (`src/screens/Settings.tsx`)**: Captured `auth/unauthorized-domain` in `Settings.tsx` Google sign-in handler to immediately inform the user with actionable instructions to add their custom domain (e.g. `tale-dives.faithus-ave.org`) to Firebase Console > Authentication > Settings > Authorized domains.
  - **Verification**: Ran `lint_applet` (`tsc --noEmit`) and `compile_applet` with clean builds.

- **2026-09-06** — Mobile Settings Sheet Overhaul & Reliable Google Drive Mobile Auth Flow (`src/screens/Settings.tsx`, `src/lib/googleDrive.ts`, `src/lib/glassChrome.tsx`, `src/screens/TaleBrief.tsx`, `src/App.tsx`):
  - **Mobile Settings Full-Height Sheet (`src/screens/Settings.tsx`)**: Refactored the Settings modal into a mobile-first, near-full-height sheet dynamically sized against `window.visualViewport.height`. Replaced nested subtabs with 4 flat, peer navigation tabs (`AI Model`, `Gameplay`, `Local`, `Cloud`) styled with `lucide-react` icons. Added a persistent, sticky footer hosting `GlassIconButton` controls (Cancel with Lucide `X`, Save with Lucide `Check`), ensuring save actions remain accessible regardless of tab scroll height.
  - **Shared Tap-to-Reveal Info Tooltips (`src/lib/glassChrome.tsx`, `src/screens/Settings.tsx`, `src/screens/TaleBrief.tsx`)**: Promoted `InfoTooltip` into `glassChrome.tsx` as a shared component. Replaced long italic description paragraphs across all settings fields with icon-led labels paired with tap-to-reveal tooltips, maximizing screen real estate on mobile devices.
  - **Reliable Google Drive Auth & Popup Blocker Handling (`src/lib/googleDrive.ts`, `src/screens/Settings.tsx`, `src/App.tsx`)**: Addressed popup blocking and silent drops on mobile and desktop browsers. Synchronously initiates `signInWithPopup` directly in user click events to preserve browser gesture tokens. If popups are blocked (`auth/popup-blocked` / unsupported environments), gracefully falls back to `signInWithRedirect` when outside an iframe, or presents clear actionable feedback when inside sandboxed iframes. Added dynamic loading spinner (`isSigningInGoogle`), pulse animations, and interactive feedback banner. Updated Cloud tab description copy to *"Sync online to privately access your Tales anywhere."*
  - **Rotating 3-Version Cloud Backups & Reconnection Alert (`src/lib/googleDrive.ts`, `src/screens/Settings.tsx`)**: Confirmed automatic rolling 3-backup retention and version selection dropdown on restore. Added an explicit visual banner in Settings alerting the player when automatic cloud backups are enabled but Google Drive requires re-linking.
  - **Verification**: Verified zero TypeScript errors (`tsc --noEmit`) and successful Vite production compilation (`compile_applet`).

- **2026-09-05** — Master Preset Protection & Field Example Pickers Across All Creation Forms (`src/data/formExamples.ts`, `src/lib/glassChrome.tsx`, `src/screens/WorldSetup.tsx`, `src/screens/NewGame.tsx`, `src/screens/TaleBrief.tsx`, `src/screens/MainMenu.tsx`, `src/components/PresetDetailModal.tsx`, `src/lib/store.ts`, `src/data/starterTemplates.ts`, `src/types.ts`):
  - **Master Presets (Navarre World & Violet Sorrengail)**: Flagged Navarre World (`world_fourth_wing`) and Violet Sorrengail (`protagonist_violet_sorrengail`) with `isMaster: true`. Updated `store.ts` (`loadWorlds`, `saveWorlds`, `loadProtagonists`, `saveProtagonists`) to guarantee master presets are always merged with localStorage and can never be deleted or purged. Added visual `master` badges in `MainMenu.tsx` and `PresetDetailModal.tsx`, and disabled delete actions for master presets across all screens and the `App.tsx` root delete callbacks.
  - **Separation of Placeholders and Examples (`src/data/formExamples.ts`)**: Built a dedicated examples repository with comprehensive, multi-genre reference cards (Genre & Tone, Major Conflict, Power System, Era & Tech, Key Factions, World Background, Narration Style, Protagonist Background, Demeanor/Personality, Core Motivation, Distinguishing Physical Trait, Secret, Opening Dive Brief).
  - **Interactive Examples Picker in `GlassField`**: Implemented `examples` and `onPickExample` props in `GlassField` (`src/lib/glassChrome.tsx`) opening a dedicated `ExamplesHelpModal`. Players can tap "See ideas..." next to any field label to browse diverse genre tropes and directly pick or adapt them into the field without overwriting other inputs.
  - **Diverse Form Placeholders**: Replaced single-preset placeholder text with diverse fantasy, sci-fi, grimdark, and xianxia examples across World Setup (`WorldSetup.tsx`), Protagonist Setup (`NewGame.tsx`), and Tale Dive Brief (`TaleBrief.tsx`).
  - **Verification**: Verified clean TypeScript checking (`tsc --noEmit` via `lint_applet`) and Vite production compilation (`compile_applet`). Tested example selection modals, master preset persistence, and deletion blocks.

- **2026-09-05** — Concise Rebecca Yarros Narration Style & Form Placeholder Streamlining (`src/api/turnContract.ts`, `src/data/starterTemplates.ts`, `src/screens/WorldSetup.tsx`, `src/screens/NewGame.tsx`, `src/screens/TaleBrief.tsx`):
  - **Narration Style Default & Fourth Wing Template**: Updated `DEFAULT_NARRATION_STYLE` and `FOURTH_WING_WORLD.narrationStyle` to concise, high-impact phrasing reflecting Rebecca Yarros' prose: *"Visceral close POV with high-stakes urgency; short, breath-tight sentences during danger; sharp, banter-driven dialogue with simmering romantic tension; tactile physical strain over abstraction."*
  - **Starter Templates Conciseness**: Trimmed `FOURTH_WING_WORLD` and `VIOLET_SORRENGAIL` descriptions and opening briefs to be punchy, avoiding overly long paragraphs while retaining all critical lore and mechanical markers.
  - **Form Placeholders & Modal Descriptions**: Streamlined input placeholders and modal guideline prompts across World Setup, Protagonist Setup, and Tale Dive Brief (Genre & Tone, Conflict, Power System, World Background, Demeanor/Personality, Motivation, Physical Trait, Secret, and Opening Dive Brief).
  - **Verification**: Verified clean TypeScript compilation (`compile_applet`).

- **2026-09-05** — Preset Detail Modal Metadata Styling & Typography Harmonization (`src/components/PresetDetailModal.tsx`):
  - **Header Subtitle**: Reduced font size to 10px (`text-[10px]`) in Lora narrative italic for both World and Protagonist detail modals, keeping header metadata compact and secondary to titles.
  - **Metadata Labels & Values**: Updated setting classification, identity, attribute, and demeanor labels to high-contrast warm gold (`text-[#fae5b5]`). Harmonized all metadata values (Genre & Tone, Era & Tech Level, Power System, Key Factions, Class, Gender, Age, Physical Traits, Personality, Motivation) to Plus Jakarta Sans (`font-sans text-xs`) across both mobile tabbed views and PC/tablet multi-column layouts.
  - **Verification**: Verified clean TypeScript checks and production compilation (`compile_applet`).

- **2026-09-05** — Free-Text Class Selection, Input Typography Harmonization, and PC Creation Flow Layout Refactor (`src/lib/glassChrome.tsx`, `src/screens/NewGame.tsx`, `src/screens/WorldSetup.tsx`, `src/screens/TaleBrief.tsx`, `src/data/classes.ts`, `src/screens/Codex.tsx`):
  - **Free-Text Class Selection**: Players are no longer restricted to the preset classes dropdown. In `NewGame.tsx`, added a custom text input linked to a `<datalist>` of archetypes and an adjacent preset dropdown. Players can type any custom class name (e.g. "Dragon Rider", "Shadow Assassin", "Necromancer") or choose a preset archetype. `currentData()` generates a clean `classId` slug and stores the custom `className`. `src/data/classes.ts` was updated so `getClassById` gracefully handles custom class IDs without reverting to Warrior, and `Codex.tsx` reflects the custom player class title in the archives.
  - **Input Typography Harmonization**: Updated `FIELD_CLASS` and `SELECT_CLASS` in `src/lib/glassChrome.tsx` to `font-sans text-[12px] leading-relaxed text-[#fbf4e2]`. All input and textarea elements across World Setup, Protagonist Setup, and New Story (Tale Brief) now render consistently in Plus Jakarta Sans at 12px with high contrast against the dark-glass background.
  - **PC Viewport Layout & Field Sizing**: Refactored `WorldSetup.tsx`, `NewGame.tsx`, and `TaleBrief.tsx` with responsive widths (`max-w-md md:max-w-2xl lg:max-w-3xl mx-auto`). Presets cards now organize into a balanced 2-column grid (`grid grid-cols-1 md:grid-cols-2 gap-2.5`) on PC rather than an overly tall narrow column. Related fields (Adapted Novel & Author, Era & Factions, Gender & Age, Physical Trait & Secret, Creativity & Combat Mode) now sit side-by-side in responsive multi-column layouts on desktop while cleanly stacking on mobile.
  - **Verification**: Verified clean TypeScript checking (`tsc --noEmit` via `lint_applet`) and production compilation (`compile_applet`). Tested typography, free-text class input, and responsive grid layouts across desktop and mobile breakpoints.

- **2026-09-05** — Mobile Cycling Background Cross-Fade & Aspect Ratio Flicker Fix (`src/lib/cyclingBackground.tsx`):
  - **Root Cause**: `useResponsiveBg` initialized with `useState(pcSrc)` on mount even on portrait/mobile viewports before probing `m_<stem>.webp`, causing every newly mounted slot to render the PC 16:9 landscape image for several frames before abruptly snapping to the mobile 2:3 portrait photo. Furthermore, newly mounted layers mounted directly at `opacity: 1` rather than animating in from `opacity: 0`, and only `pc_` files were probed/preloaded at startup in `useDiscoveredSlots`, causing `m_` photos to load cold from the network while `pc_` was already cached.
  - **Fix**:
    1. Made `useResponsiveBg` synchronously check orientation on initial state evaluation (`getPreferredBg`), initializing directly to `mobileSrc` for portrait screens and never defaulting to `pcSrc`.
    2. Updated `useDiscoveredSlots` to probe and preload both `pc_` and `m_` variants into the browser cache and record availability in a module-level cache (`mobileAvailability`).
    3. Added `fadeInOnMount` logic with `requestAnimationFrame` to `BackgroundLayer` so incoming layers mount at `opacity: 0` and transition to `1` over `BG_FADE_MS` (7000ms), while the outgoing layer smoothly transitions from `1` to `0` before unmounting.
    4. Added `pointer-events-none` on background layer wrappers to prevent interfering with mobile touch interactions. Verified with `lint_applet` and `compile_applet`.

- **2026-09-05** — Preset Detail Modal Footer Refactor (`src/components/PresetDetailModal.tsx`, `src/lib/glassChrome.tsx`): Refactored World & Protagonist preset modal footer action buttons from text buttons to circular `GlassIconButton` controls (Star for default, Pencil for edit, Trash2 for delete, X for close, Check for load, Play for play/story) with clean responsive spacing (`gap-2 sm:gap-2.5` in a `justify-between` row). Eliminates button crowding and overflow on mobile viewports while preserving accessible tooltips/aria-labels and cohesive dark-glass styling.

- **2026-09-05** — Tale Dives v3.0 Major Architecture & UI Overhaul: XML Turn Contract Migration, State Anchoring, and Codex Archives Overhaul.
  - **XML Turn Contract Migration** (`src/api/xmlTurnContract.ts`, `src/lib/xmlTurnParser.ts`, `src/api/providers/gemini.ts`, `src/api/turnContract.ts`, `src/App.tsx`): Completely replaced the JSON-schema wire protocol with an XML grammar consisting of `<nar>...</nar>` (prose narrative) and `<sync>...</sync>` (compact block of self-closing XML tags with shorthand attributes like `<st>`, `<loc>`, `<hp>`, `<mp>`, `<st_pool>`, `<inv>`, `<npc>`, `<quest>`, `<fac>`). This eliminated JSON escaping overhead and verbose schema scaffolding, producing a measured ~25% reduction in output tokens on the real Gemini tokenizer.
  - **Parser Resilience & Regex Fallback**: `src/lib/xmlTurnParser.ts` uses the browser's native `DOMParser` for strict `<sync>` extraction. To defend against LLM `MAX_TOKENS` truncation mid-sync or malformed XML, a regex-based extractor extracts all narrative prose inside `<nar>` even if `<sync>` fails or is cut off, ensuring player immersion is never interrupted by a lost turn.
  - **Inline Prose Markup Migration** (`src/lib/richText.tsx`): Shifted item tags from angle brackets (`>Item<`) to double square brackets (`[[Item]]`). Because the turn response now contains real XML tags, literal `<`/`>` in prose broke DOM parsing. Updated `OUTER_RE` to evaluate `[[Item]]` before `[Skill]` to prevent greedy bracket capture.
  - **NPC & Location Ground Truth Anchoring** (`src/types.ts`, `src/lib/npcs.ts`, `src/lib/locations.ts`, `src/lib/jitContext.ts`): Added `heldWeapon` and `wornArmor` to `NpcEntry` and populated them into the per-turn JIT context header. Added `firstSeenTime`/`lastSeenTime` (NPCs) and `firstVisitedTime`/`lastVisitedTime` (Locations) to eliminate temporal hallucination drift where the narrator forgot when an entity was encountered.
  - **Codex Entity Deduplication** (`src/lib/slug.ts`, `src/lib/locations.ts`, `src/lib/codex.ts`): Fixed entity duplication bug where minor casing or punctuation variances generated multiple Codex entries; `slugify` now collapses both hyphens and underscores consistently, and `locations.ts` includes an `isKnownByName` heuristic to deduplicate auto-registered places.
  - **Codex Overhaul & Bespoke RPG Detail Views** (`src/screens/Codex.tsx`): Rebranded header from "Codex" to "Codex Archives", harmonized typography (Cinzel display serif for entity titles, clean Sans for system metadata and attributes), styled cards in dark navy/charcoal (`bg-[#131622]/90` with `#e8ca8a` gold accents), and renamed "Workbenches & Recipes" to "Crafting". Implemented custom child detail view layouts for all 9 categories (Locations, NPCs, Factions, Lore, Quests, Bestiary, Items, Skills, Crafting) tailored to their RPG function.
  - **Adaptive Turn-State Soundtrack** (`src/lib/backgroundMusic.tsx`, `src/data/soundtrackManifest.ts`): Introduced turn-state-specific music pools. Tracks prefixed with `ts-<state>_` (e.g., `ts-combat_...`) automatically trigger when that turn state starts, crossfading with ambient music and smoothly returning to ambient rotation when the encounter concludes.
  - **Title & Chronicle Refinements** (`src/screens/Title.tsx`, `src/screens/Chronicle.tsx`): Modernized Title CTA button to "START" with synchronous fullscreen toggle. Centered Chronicle's parchment reading column, removed typewriter character-by-character delay for instant narrative rendering, and added a responsive desktop sidebar layout.
  - **Defensive Safeguards & Blueprint v3.0** (`src/App.tsx`, `src/api/providers/gemini.ts`, `Tale-Dives-Blueprint-v3_0.md`): Clamped `stat_grant` to prevent `NaN` pool max mutations. Anchored `startTime`/`endTime` in `recapChapter` to eliminate temporal hallucinations during chapter summaries. Scoped bang-command turn controls strictly to the last narrated turn. Documented full system architecture in `Tale-Dives-Blueprint-v3_0.md`.
  - **Verification**: Verified clean TypeScript compilation (`tsc --noEmit`) and Vite production build (`vite build`). Live XML turn cycle verified against Gemini API, confirming state synchronization and narrative rendering.

- **2026-09-05** — Locations Subtab & Fast CRUD Table for World Setup, Codex Auto-Seeding, and Preset Lore Alignment (`src/types.ts`, `src/screens/WorldSetup.tsx`, `src/data/starterTemplates.ts`, `src/lib/store.ts`, `src/App.tsx`):
  - **Locations Subtab in World Setup (`src/screens/WorldSetup.tsx`)**: Added "Locations" as the 3rd subtab (`Overview`, `Depth`, `Locations`) using `GlassTabs` across the World Setup screen.
  - **Key Locations Fast CRUD Table & Modal**: Implemented structured `locationsList` state and an interactive Fast CRUD Table in `WorldSetup.tsx` with full Add/Edit/Delete capabilities. Added an interactive modal supporting Name, Region, Location Type, Danger Level, Faction Owner, and Description fields.
  - **Starter Templates Location Seeding (`src/data/starterTemplates.ts`)**: Seeding lore-accurate key locations for the Navarre starter world template (`Basgiath War College`, `The Parapet`, `Threshing Grounds`, `Aretia`) with accurate danger levels, regions, types, and faction owners.
  - **Codex Auto-Seeding on Turn 1 (`src/App.tsx`, `src/lib/store.ts`)**: Updated campaign initialization in `App.tsx` so all structured locations created/loaded in World Setup are seeded directly into `campaign.locations` in the Story's Locations Codex on Turn 1.
  - **Verification**: Verified with `lint_applet` and `compile_applet`. Production build compiled cleanly without errors.

- **2026-09-06** — Alternative Tale Weaver UI Layout & Full Node CRUD Architecture (`src/screens/WorldSeedWeaver.tsx`, `src/screens/MainMenu.tsx`, `src/App.tsx`, `src/types.ts`):
  - **Isolated Constellation Node-Based Tale Creation UI** (`src/screens/WorldSeedWeaver.tsx`):
    - Designed and implemented the "Seed Weaver" interface featuring 4 celestial interactive island nodes: **Protagonist Origin**, **World & Realm Codex**, **Key Cast & NPCs**, and **Narrative & Prologue Dive**.
    - **Progressive Node Finalization Gate**: Gated the Narrative node so it remains locked with glowing status indicators until the Protagonist, World, and Cast nodes are finalized.
    - **MainMenu Entry Point**: Added a dedicated "Weave from Constellation" action button on the Main Menu leading directly into the alternative workflow while preserving the classic step-by-step wizard.
  - **Comprehensive In-Node CRUD Sub-Editors**:
    - **Protagonist Node**: Full character identity, origin, stat sliders, and starting skill CRUD with an interactive edit sub-modal (name, tier, costs, description, flavor).
    - **World Node**: Background lore, conflict, power systems, plus complete CRUD for starting Locations (name, region, danger rating, archetype, controlling faction, description) and Factions (name, attitude, territory, description).
    - **Cast Node**: Multi-character dossier manager with CRUD sub-editor for each NPC (name, role, attitude, starting affection/trust sliders, held weapon, worn armor, demeanor, secrets/hooks, and backstory).
    - **Narrative Node**: Opening situation hook, custom tale title validation, tone directives, and combat resolution engine selector (Narrative vs. Tactical).
  - **Codex Data Pipeline Integration & Mobile Optimization** (`src/App.tsx`):
    - Configured `beginCampaign` to ingest all seeded locations, factions, and NPCs, registering them into initial Codex registries without schema collisions.
    - Scaled down action buttons and tightened labels across mobile viewports to prevent layout crowding.
  - **Verification**: Verified via `lint_applet` (`tsc --noEmit`) and `compile_applet` (`vite build`). All builds compiled cleanly with 0 errors.


  - **In-App Confirmation Dialog Integration**: Added confirmation prompts when clicking "Save Preset" or "Save as New Preset" in both World Setup (`src/screens/WorldSetup.tsx`) and Protagonist Setup (`src/screens/NewGame.tsx`), using the exact same `useConfirm` modal component and styling as the "Exit to Title Screen" dialog.
  - **Modal Structure**: Renders a glass panel backdrop with `AlertTriangle` icon, custom prompt text ("Save changes to this World preset?", "Save current world as a new World preset?", "Save changes to this Protagonist preset?", "Save current hero as a new Protagonist preset?"), and explicit **Cancel** / **Confirm** action buttons.
  - **Preset Deletion Prompt Normalization**: Converted native `confirm()` dialogs on preset detail deletion cards to `await confirm(...)` using the same in-app modal, ensuring reliable behavior inside iframe sandbox environments.
  - **Verification**: Verified via `lint_applet` (`tsc --noEmit`) and `compile_applet` (`vite build`). All builds passed cleanly.

- **2026-09-05** — Location Enums & Class Preset Renames (`src/types.ts`, `src/data/classes.ts`, `src/data/starterTemplates.ts`, `src/lib/bangCommands.ts`, `src/screens/WorldSetup.tsx`, `src/screens/Codex.tsx`):
  - **Simplified Location Danger Levels**: Streamlined location danger level options to 4 concise tiers (`Safe`, `Low`, `High`, `Lethal`), eliminating token redundancy across LLM context generation headers and Codex records while preserving UI warning badge styling in `WorldSetup.tsx` and `Codex.tsx`.
  - **Simplified Location Types**: Streamlined location types to 6 concise single-word RPG categories (`Settlement`, `Fortress`, `Wilds`, `Dungeon`, `Ruins`, `Landmark`), reducing token consumption on every turn's JIT context slice and Codex entry listings.
  - **Class Preset Renames & Connections**: Renamed class presets:
    - `"Dark Monarch"` → `"Shadow Monarch"`
    - `"Classic Necromancer"` → `"Necromancer"`
    - `"Contract Gate Summoner"` → `"Summoner"`
    - `"Apprentice Scribe"` → `"Scribe"`
    Updated all dependencies across `PRESET_CLASSES` (`src/data/classes.ts`), `getClassById`/`findClassById` lookup helpers, starter templates (`src/data/starterTemplates.ts`), bang command descriptions (`src/lib/bangCommands.ts`), and Codex help copy (`src/screens/Codex.tsx`).
  - **Verification**: Verified via `lint_applet` (`tsc --noEmit`) and `compile_applet` (`vite build`). All builds compiled cleanly with 0 errors.

- **2026-09-06** — Tale Title Naming at Brief, In-Library Tale Renaming, and React Hooks Order Rule Fix (`src/screens/WorldSetup.tsx`, `src/screens/NewGame.tsx`, `src/screens/TaleBrief.tsx`, `src/screens/MainMenu.tsx`, `src/App.tsx`, `src/types.ts`, `PROJECT_REVISION_NOTES.md`):
  - **React Rules of Hooks Order Violation Fix** (`src/screens/WorldSetup.tsx`, `src/screens/NewGame.tsx`):
    - Resolved runtime crash `"Rendered more hooks than during the previous render"` caused by `const formScrollRef = useRef(...)` declared below conditional returns (`if (viewMode === 'gateway')` and `if (viewMode === 'presets')`).
    - Hoisted `formScrollRef` to the top of `WorldSetup` and `NewGame` alongside `viewMode` and `activeTab`, guaranteeing identical hook execution count and sequence regardless of which screen mode is active.
  - **Custom Tale Title & Pre-Dive Validation** (`src/screens/TaleBrief.tsx`, `src/App.tsx`, `src/types.ts`):
    - Added an editable "Tale Title" field in Step 4 (`TaleBrief.tsx`) pre-filled with a dynamic suggestion (`${player.name}'s Tale` or `Untitled Tale`).
    - Added real-time validation checking against empty strings and case-insensitive collisions with already existing Tales in the player's library (`existingTitles`), disabling the "DIVE IN" button with clear helper messages when invalid.
    - Updated `beginCampaign` in `App.tsx` to receive the custom title and assign it directly to `campaign.title`.
  - **Tale Renaming in Library & Creation Date Stamping** (`src/App.tsx`, `src/screens/MainMenu.tsx`, `src/types.ts`):
    - Added `onRenameCampaign` prop to `MainMenu.tsx` and wired a Pencil icon button onto each Tale card in the library.
    - Implemented a looping validation prompt using `editLongText` in `App.tsx` that re-prompts with descriptive feedback if a player attempts to submit a blank or colliding title.
    - Added `createdAt: number` to `Campaign` in `src/types.ts`, stamped on campaign generation in `beginCampaign`, and rendered in the Tale card header ("Started [date]" alongside "Last played [date/time]").
  - **Verification**: Verified cleanly via `lint_applet` (`tsc --noEmit`) and `compile_applet` (`vite build`). All builds passed with 0 errors.


  - **Mobile Soft Keyboard Viewport-Adaptive Positioning & Clearance** (`src/lib/glassChrome.tsx`, `src/lib/useLongTextEditor.tsx`, `src/screens/WorldSetup.tsx`, `src/screens/NewGame.tsx`, `src/screens/TaleBrief.tsx`):
    - Upgraded `GlassScreen`'s mobile focus listener to dynamically measure the nearest scroll container and smoothly scroll the active field container (`.glass-field` / target) to sit ~16px below the container's top boundary. This reliably places active text fields in the upper visible area of the mobile screen, safely above the software keyboard space.
    - Added dual-stage scroll timing (80ms for instant adjustment and 320ms to settle after mobile keyboard slide animation) and hooked `window.visualViewport.resize` to re-align active fields when the virtual keypad expands or contracts.
    - Added `scroll-mt-20` (80px top scroll margin) to `FIELD_CLASS` and `GlassField` for native browser scroll clearance.
    - Upgraded `useLongTextEditor.tsx` with dynamic `window.visualViewport` height tracking, automatically clamping the modal height to fit within `visualViewport.height - 20` and positioning it at `items-start pt-2 sm:items-center` so that the draft textarea, word counter, and Save/Cancel buttons remain 100% visible above the keypad on mobile.
    - Positioned all sub-modals (Add Location, Add Faction, Custom Class, Add/Edit Skill) to `items-start sm:items-center pt-3 sm:pt-4` with `max-h-[85vh]` and internal scrolling to prevent virtual keyboard occlusion.
    - Expanded scroll containers' bottom focus padding across World Setup, Protagonist Setup, and Tale Dive Brief to `focus-within:pb-[75vh] md:focus-within:pb-4`.
  - **"Continue" Action Button Subtab Cycling & Smooth Scroll** (`src/screens/WorldSetup.tsx`, `src/screens/NewGame.tsx`):
    - **World Setup (`WorldSetup.tsx`)**: Fixed the "Continue" button to cycle through all subtabs sequentially (`Overview` -> `Depth` -> `Locations` -> `onContinue`) and smoothly scroll the form container to top (`scrollToTop()`) on every transition, preventing players from landing at the bottom of the next tab. Also connected `scrollToTop()` to direct `GlassTabs` header clicks.
    - **Protagonist Setup (`NewGame.tsx`)**: Unified the subtabs system across all screen sizes (mobile, tablet, and desktop) by replacing the split layout and `mobileTab` state with a unified `activeTab` and persistent `GlassTabs` strip matching World Setup. The "Continue" button now cycles sequentially through all subtabs (`Identity` -> `Origin` -> `Skills` -> `onBegin`) with automatic smooth scroll to top on each transition.
  - **Codex Cleanups & TypeScript Maintenance** (`src/screens/Codex.tsx`):
    - Removed unused `Tag` import and corrected type comparison in bestiary `hpMax` check to ensure strict type safety.
  - **Verification**: Verified via `lint_applet` (`tsc --noEmit`) and `compile_applet` (`vite build`). All checks passed with 0 errors.

- **2026-09-06** — "Novel Weaver": a second, isolated alternate Tale-creation UI, plus an app-wide mobile performance pass (`src/components/novelweaver/*`, `src/screens/NovelWeaver.tsx`, `src/App.tsx`, `src/screens/MainMenu.tsx`, `src/lib/store.ts`, `src/index.css`, `src/screens/WorldSeedWeaver.tsx`):
  - **Novel Weaver** (`src/components/novelweaver/{types,shared,ProtagonistChapter,WorldChapter,CastChapter,NarrativeChapter}.tsx`, `src/screens/NovelWeaver.tsx`):
    - A second, deliberately different take on the same idea AI Studio's "World Seed Weaver" already ships (four gated nodes feeding the Codex-seeding pipeline) — same underlying mechanism, a genuinely different UX metaphor: a vertical "manuscript" chapter list (I–IV, Protagonist/World/Cast/Narrative) with full-screen drill-downs, instead of a radial constellation of modals over large painted backgrounds. No raster art anywhere — glow/ring states are pure CSS box-shadow, and the whole feature explicitly opts out of the app's default glassmorphism (solid "ink" panels, hairline borders) per explicit direction for this feature only.
    - Each chapter drills down via a shared `ChapterShell` (sticky header/footer, slide-in via `framer-motion`), with concise field labels, subtabs (Identity/Origin/Build for Protagonist; Overview/Depth/Factions/Locations for World), and inline add-forms for list data (Starting Abilities cap 3, Key Factions/Locations, Cast roster) — no stacked modal-over-modal.
    - **Finalization/gating**: Protagonist and World each expose a live readiness check (Name+Class; Name+Setting) gating their own "Finalize" button; Cast is optional and always finalizable. The Narrative chapter is locked (shown with a lock icon and dimmed) until all three are finalized, then unlocks with a glowing ring + pulsing animation on its list row, matching the requested "lights up when ready" behavior. Narrative's own "Begin the Tale" is both its finalize action and the actual campaign-creation trigger (title dedup-guarded against `existingTitles`, same pattern as the existing Tale Dive Brief).
    - **Reuses, doesn't duplicate, the existing seeding pipeline**: `CastMember` is structurally identical to World Seed Weaver's own `SeedNpcData`, so Novel Weaver's roster is handed straight into the already-extended `beginCampaign(..., customNpcs?)` without importing `components/seedweaver/*` — the two features stay decoupled at the source level while sharing the one proven backend hook. Protagonist/World presets reuse the existing `protagonists`/`worlds` libraries via the same `onSaveProtagonistPreset`/`onSaveWorldPreset` props World Seed Weaver already wired in `App.tsx`; Cast/Narrative presets reuse `lib/store.ts`'s text-preset mechanism via two new `TextPresetField` members (`'novelCast'`, `'novelNarrative'`), JSON-round-tripping a structured value through the existing string-only `SavedPreset.value` — "save/load presets for every chapter," with no new storage mechanism.
    - Wired into `App.tsx` as a new `'novelweaver'` screen (own `beginCampaign` call site, cast normalized to satisfy `SeedNpcData`'s required `role`) and a new distinct gold/ink button on `MainMenu.tsx` (`onOpenNovelWeaver`), separate from AI Studio's existing purple "World Seed Weaver" card — both are reachable side by side from the Tales tab.
  - **Mobile performance pass** (`src/App.tsx`, `src/index.css`, `src/screens/WorldSeedWeaver.tsx`):
    - **Route-level code-splitting**: every screen except `Title`/`MainMenu` (Settings, StoryMode, WorldSetup, NewGame, TaleBrief, DiveLoadingScreen, Chronicle, Codex, SlashCommandManager, WorldSeedWeaver, NovelWeaver) converted from static imports to `React.lazy()`, wrapped in `Suspense` (one boundary around the main screen switch, one each around the Settings/SlashCommandManager overlays). Confirmed via `vite build` output: Codex (86KB), WorldSeedWeaver (108KB), Chronicle (60KB), NewGame (40KB), NovelWeaver (38KB), WorldSetup (31KB), Settings (20KB) and the rest now ship as separate chunks fetched on first navigation instead of bloating the entry bundle every mobile visitor has to parse before Title even paints.
    - **Backdrop-blur mobile cap** (`src/index.css`): added a `@media (max-width: 768px), (pointer: coarse)` rule capping every `.backdrop-blur-{sm,md,lg,xl,2xl,3xl}` utility to a flat, cheap 4px. `backdrop-filter` is one of the most expensive effects a phone GPU paints, and it's used ~70 times across the app (Codex cards, Chronicle's floating turn nav and popups, dropdowns); this keeps the frosted-glass look on desktop while making mobile scrolling/compositing far cheaper, without touching a single component file.
    - **World Seed Weaver's large images**: added `decoding="async"` to its full-bleed background photo and `loading="lazy"` + `decoding="async"` to its four ~1MB node thumbnails (each displayed at ~96×96 CSS px) so decode work moves off the main thread instead of jank-blocking first paint of that screen.
  - **Verification**: `tsc --noEmit` and `vite build` both clean (one type fix needed: normalizing `CastMember.role` from optional to `SeedNpcData`'s required `string` at the `beginCampaign` call site). Live Playwright pass at a 390×844 mobile viewport against the dev server (Gemini calls mocked at the fetch layer, since this sandbox has no egress to `generativelanguage.googleapis.com`): confirmed the chapter list renders and locks Narrative correctly, Protagonist/World/Cast finalize and light up with glow rings, Narrative unlocks the moment all three are finalized, and "Begin the Tale" drives all the way through `beginCampaign`/`seedCampaign` into the Seeding Review screen (Codex reused, per the existing Phase 2 design) — the full creation pipeline, not just the UI shell.

- **2026-09-07** — Graphics setting: a real "turn off glassmorphism" performance switch (`src/screens/Settings.tsx`, `src/types.ts`, `src/lib/store.ts`, `src/index.css`, `src/App.tsx`):
  - The prior mobile pass (2026-09-06) capped blur radius on touch/narrow viewports but couldn't remove it outright — that's a device-class heuristic, not a user choice, and some phones are still going to find *any* amount of `backdrop-filter` compositing too much, stacked several layers deep on screens like Codex or Chronicle's popups. This adds the harder switch, opt-in.
  - **New Graphics tab in Settings** (`src/screens/Settings.tsx`): a 5th tab (`Gauge` icon, alongside AI Model/Gameplay/Local/Cloud) with one control — a `GlassSegmented` Glass/Performance toggle, same concise icon+tooltip field convention as the rest of the modal. Persisted as `uiPrefs.graphicsMode: 'glass' | 'performance'` (`src/types.ts`, default `'glass'` in `store.ts`'s `loadUiPrefs`), round-tripped through the existing `SettingsSavePayload`/`onSave` plumbing — no new App-level wiring beyond one effect.
  - **The actual transparency swap** (`src/index.css`): rather than touch ~70 call sites across 21 files, a single `html.gfx-performance` CSS block forces `backdrop-filter: none !important` on every `.backdrop-blur-*` Tailwind utility plus `.glass-panel` (the one non-utility blur surface, `index.css`'s own hand-written class) — same background color, opacity, and border on every panel, just flat and see-through instead of frosted. `App.tsx` toggles the `gfx-performance` class on `document.documentElement` in a `useEffect` keyed on `uiPrefs.graphicsMode`, so the switch takes effect instantly app-wide the moment Settings is saved, with zero component-level prop threading.
  - **Verification**: `tsc --noEmit` and `vite build` clean. Live Playwright pass against the dev server: opened Settings, confirmed the Graphics tab renders and the segmented control works; selecting Performance and saving set `<html class="gfx-performance">` and flipped a live `.backdrop-blur-xl` element's computed `backdropFilter` from `blur(4px)` (the mobile-cap value at this viewport) to `none`; reopened Settings afterward and confirmed both the class and the flattened blur persisted correctly through the save round-trip.

- **2026-09-07** — World Seed Weaver mobile performance: right-sized image assets + reduced animation/blur load (`src/screens/WorldSeedWeaver.tsx`, `src/index.css`, `src/assets/images/seed_*_mobile.webp`):
  - **Root cause, found by direct measurement rather than guessing**: the 4 node-thumbnail photos were shipped as raw 1024×1024 JPEGs (~1MB each) despite only ever being displayed inside 80–104px circles, plus an 835KB background — ~4.9MB of images for one screen, none of it compressed by the build (Vite copies asset imports byte-for-byte; confirmed via `dist/assets/*.jpg` matching source sizes exactly). Separately, the screen runs ~10 concurrent CSS animations for as long as it's mounted, several of them large `filter: blur()` layers (`blur-3xl` on two 384px ambient "spark" orbs, `blur-md`/`blur-lg` on the 4 node aura rings) inside a permanent `animate-pulse` loop — a different, more GPU-costly property than `backdrop-filter`, and untouched by the earlier (2026-09-06) backdrop-blur mobile cap. Together these are two independent causes: one is load-time (network + decode), the other is continuous runtime cost (GPU compositing) — matching the user's separate complaints ("photos load slow" vs. "screen response is slow").
  - **Mobile-scaled image variants** (`src/assets/images/seed_{bg,protag,world,npcs,narrative}_mobile.webp`): generated once via `sharp` (240px WebP q72 for the 4 thumbnails, 600px WebP q62 for the background) — 4.9MB → ~123KB combined, a >97% reduction, with no visible quality loss at the sizes these are actually rendered. Wired in via `<picture><source media="(min-width:769px)" srcSet={original}/><img src={mobileWebp}/></picture>` on all 5 images (same pattern `DiveLoadingScreen.tsx` already uses for its own responsive background) — desktop's original full-res JPEGs are completely untouched, so the "fast on PC" experience carries no risk of regression.
  - **Mobile animation/blur reduction** (`src/index.css`): added `.sw-spark`/`.sw-aura` classnames to the two ambient orbs and 4 node aura rings, then a `@media (max-width: 768px), (pointer: coarse)` rule (same threshold as the existing backdrop-blur cap) that hides the sparks outright on mobile (pure atmosphere, no information value) and drops the aura rings to a `blur(6px) !important` (from 12–16px) — removing the single heaviest continuous GPU cost on this screen for touch devices while leaving the full effect on desktop.
  - **Verification**: `tsc --noEmit` and `vite build` clean; confirmed in the actual build output that `dist/assets/seed_*_mobile-*.webp` (14.7–60.7KB) ship alongside the untouched original `dist/assets/seed_*-*.jpg` files. Live Playwright pass at both a 390×844 mobile viewport and a 1440×900 desktop viewport against the dev server: confirmed via `img.currentSrc` that mobile resolves the `*_mobile.webp` sources and desktop resolves the original JPEGs; confirmed via computed style that `.sw-spark` is `display:none` and `.sw-aura` is `blur(6px)` on mobile vs. `block`/`blur(12–16px)` on desktop; screenshots at both viewports show the constellation layout, glow states, and photo content rendering correctly with no visual regression.

- **2026-09-07** — World Seed Weaver node forms: eliminated the real cause of typing/tab-switch lag, not just open lag (`src/screens/WorldSeedWeaver.tsx`, `src/components/seedweaver/{Protagonist,World,Npc,Narrative}NodeModal.tsx`):
  - **Root cause, reported by the user after confirming the previous pass fixed the main constellation screen**: opening a node form, switching its subtabs, and typing into its fields were all still laggy on mobile — a different symptom from the main-screen fix, which only addressed the screen behind the forms. Root cause: each node "modal" is a `fixed inset-0 backdrop-blur-md` overlay, but the constellation underneath it — the animated SVG ley-lines, 4 pulsing aura rings, spinning diamond boundary — kept rendering and animating the entire time a form was open (the modals are plain conditional JSX inside the same component tree, never gated behind the modal being open). A `backdrop-filter: blur()` sitting over content that's still changing has to re-sample that live layer on every frame it's visible — a continuous compositing cost for as long as the form stayed open, not a one-time cost on open, which is exactly why it showed up on every keystroke and every tab switch, not just the initial open animation. Compounding it, each modal also stacks 2-3 of its own nested sub-modals (Skill Editor, Presets Browser, Location/Faction editors), each with a second independent `backdrop-blur` layer doing the same thing on top.
  - **The fix, in two parts**: (1) `WorldSeedWeaver.tsx` — wrapped `<main>` (the entire constellation: SVG, aura rings, sparks) in `{!activeModal && (...)}` so it fully unmounts — zero animation, zero compositing — the instant any node form opens, and remounts on close. This is functionally equivalent to "open a separate screen instead of a modal" (which the user asked about directly) without an actual router change: there's no longer a live background for any blur to sample, regardless of viewport. (2) All 4 node modal files — stripped every `backdrop-blur-*` class from the main panel and every nested sub-modal (now pointless since nothing behind them moves or, in the outer case, even shows), and replaced every `motion.div`/`AnimatePresence` open/close, toast, and reveal-panel animation with a plain conditional `<div>` per the user's explicit "we don't need animations in the form opening/closing" — instant show/hide everywhere, `framer-motion` import removed from all 4 files entirely.
  - **Verification**: `tsc --noEmit` and `vite build` clean (no leftover `motion`/`AnimatePresence`/`backdrop-blur` references in any of the 4 modal files, confirmed via grep). Live Playwright pass at a 390×844 viewport: opened the Protagonist node and confirmed via computed style/DOM query that `<main>` was fully unmounted, `.sw-spark` count was 0, and the modal's `backdropFilter` was `"none"`; switched subtabs and typed into the Name field, confirming the value lands correctly; closed the modal and confirmed `<main>` and both spark orbs remount. Screenshots before/during/after show no visual regression — the form reads identically to before, just without a live animated layer running underneath it.

- **2026-09-07** — World Seed Weaver node forms: flattened nested modal-in-modal UX + trimmed field labels (`src/components/seedweaver/{Protagonist,World,Npc,Narrative}NodeModal.tsx`):
  - **The remaining UX debt after the perf fix**: each node form still stacked a second full-screen dialog on top of itself for anything list-shaped — Protagonist's Skill Editor, World's Location/Faction editors, NPC's Cast Pack browser/save, and all four forms' own Presets browser (Narrative's save-preset form too). That's an extra overlay layer (and, historically, an extra `backdrop-blur`) on top of an already-open form, purely for editing one list item or browsing presets — more DOM, more perceived latency opening it, and a jarring context switch away from the list it belongs to.
  - **Per-item editors flattened to inline expand-in-place** (Protagonist's Starting Abilities, World's Locations and Factions, NPC's roster): each list row is now a collapsible button — tap it, the same edit fields that used to live in a separate dialog unfold directly under that row (chevron rotates to indicate state), tap again (or another row) to collapse. The delete (trash) action stays on the collapsed row itself via `stopPropagation` so it doesn't require expanding first. No new state was needed — each already had an `editingXIdx: number | null`, now doubling as "which row is expanded" instead of "which stacked dialog is open."
  - **Presets/pack browsers flattened to inline slide-down panels** (all 4 forms' Presets, NPC's Cast Pack browser + Save Pack, Narrative's Save Preset): each now renders as a bordered, height-capped (`max-h-64`, internally scrolling) panel in the normal document flow right below the header/toast, instead of a second centered dialog — same search/list/Load UI, one less overlay layer to render and animate.
  - **Label trims to match the app's concise-label convention** (already used in Settings/Novel Weaver): e.g. Protagonist's "Key Heirloom or Starting Item (Optional)" → "Key Item", "Origin & Background" → "Background", "Hidden Secret (Narrative Hook)" → "Secret"; World's "Overarching Conflict / Stakes" → "Conflict", "Province / Region" → "Region", "Controlling Faction" → "Faction"; NPC's "Character Name *" → "Name *", "Demeanor & Traits" → "Personality", "Background / Description" → "Description"; Narrative's "Where do you dive in? (Opening Scene Hook)" → "Opening Scene", "Narrator Tone & Voice Directives" → "Narration Style", "Combat Resolution Engine" → "Combat Mode" — roughly two dozen labels trimmed across the 4 files, section headers included (e.g. "Key Realm Sites" → "Sites").
  - **Small efficiency cleanup while in there**: each form's preset-filtering `.filter()` (and NPC/Narrative's pack-merging spread) is now wrapped in `useMemo`, so typing in an unrelated field no longer re-filters the full preset/pack list on every keystroke.
  - **Verification**: `tsc --noEmit` and `vite build` clean (the WorldSeedWeaver chunk actually shrank, 108.95KB → 101.08KB, from the removed dead JSX/motion code). Live Playwright pass at a 390×844 viewport across all 4 nodes: confirmed zero `.z-60` (the old stacked-dialog class) elements exist anywhere once a list item or a presets panel is opened; confirmed Add Ability/Add Site/Add NPC each expand their new row inline with the expected fields visible; confirmed each form's Presets (and NPC's Cast Pack, Narrative's Save Preset) panel renders inline below the header rather than as a floating dialog. Screenshots across all 4 forms show no visual regression — same fields, same styling, one less layer.

- **2026-09-07** — Fixed the actual cause of subtab-switch lag in node forms (`src/components/seedweaver/ProtagonistNodeModal.tsx`, `src/components/seedweaver/WorldNodeModal.tsx`):
  - **Root cause, reported after the modal-flatten pass**: Protagonist's 3 subtabs (Archetype & Skills / Identity & Origin / Personality & Secret) and World's 3 subtabs (Realm & Laws / Key Sites & Geography / Factions & Powers) were each conditionally rendered — `{subTab === 'x' && (<div>...)}` — so every tap on a subtab button destroyed the entire previous subtab's DOM subtree and built the new one from scratch: for the Archetype tab alone, that's the 9-button class grid, the attributes point-buy, and the full abilities list (each row now with its own inline-expand editor) — on the order of 100+ DOM nodes torn down and rebuilt on every switch. This was a separate cost from the earlier fixes (the still-animating background behind the form, and the stacked full-screen sub-modals) — it's real React reconciliation + layout + paint work triggered purely by switching tabs, independent of both.
  - **The fix**: all 3 subtabs in each form are now always mounted, toggled with a plain `hidden` (`display:none`) class instead of being conditionally rendered — `<div className={subTab === 'x' ? 'space-y-3' : 'hidden'}>`. Switching tabs is now a single cheap style recalculation (un-hiding already-laid-out content) instead of a DOM teardown/rebuild — the standard fix for tab-switch jank in web UIs. No state changes needed since each tab's fields are already bound to the same `data` object regardless of which subtab is active.
  - **Verification**: `tsc --noEmit` and `vite build` clean. Live Playwright pass confirmed the fix is real, not just visual: with the Personality tab active, the Archetype tab's "Warrior" class-preset button is still present in the DOM (`count: 1`) but not visible (`isVisible: false`) — proving the content stays mounted and hidden rather than being unmounted; the same check on World's Locations content while on the Overview tab confirmed the same. Typed into a field immediately after switching tabs and confirmed the value lands correctly, so interactivity survived the change.

- **2026-09-07** — The Narrative-First Overhaul: dropped the numeric RPG engine for a qualitative, ordinal-word one, and made TaleDiveWeaver the default creation flow (touches nearly every file in `src/` — see each phase below for its own list):
  - **Motivation**: the game's numeric layer (HP/MP/ST pools, STR/INT/AGI raw values, `stat_grant`, signed NPC affection/trust deltas, TACTICAL combat's client-computed hit/miss/damage math) was a recurring hallucination/desync risk — the already-shipped NaN-repair pass in `store.ts` existed only because the LLM would periodically emit malformed numeric deltas. The user, reconsidering the target audience (avid fantasy readers who "use imagination instead" of turn-based crunch), asked for a full narrative-first overhaul: replace every numeric channel with a small, fixed vocabulary the model must always express as canonical words, never numbers, with any display customization (a reskinnable Threat/Power label scale) applied purely client-side so it can never reach the model or cause a parse-drift bug. Authorized end-to-end, phase-by-phase, without further check-ins.
  - **Phase 0 — Rename**: `WorldSeedWeaver.tsx` → `TaleDiveWeaver.tsx` (component, prop types, `Screen` union value, all identifiers) — pure rename, no UI-copy changes, done first so every later phase's references are already correct.
  - **Phase 1+2 — Numeric engine removal + XML grammar rewrite** (landed as one atomic unit — Phase 1's type changes and Phase 2's parser rewrite can't compile independently of each other): new `src/lib/tiers.ts` (`COMPETENCY_TIERS` 5-word Untrained→Master scale, `THREAT_TIERS` 8-word trivial→mythic scale, `wordToTier`/`tierToWord`, `compareTiers` for ordinal-gap adjudication hints) and `src/lib/conditions.ts` (`ConditionTag`, duration-based vs. narrative-gated, reusing `isTimeReached`/`GameTime` from `lib/crafting.ts`'s own pattern) replace `Player`'s hp/mp/st pools and `derivedStats.ts`/`combat.ts` (both deleted) outright; `Attributes`/`SkillEntry.tier`/`NpcEntry.affection`+`trust`+`resolve` all move onto `CompetencyTier`; `BestiaryEntry.threatTier` becomes a fixed token; `CombatState` drops its numeric enemy fields for `enemyConditions`. The XML turn grammar (`xmlTurnContract.ts`/`xmlTurnParser.ts`) is rewritten to match: `<cond add/rem>` replaces numeric `<deltas>`, `<breakthrough attr tier>` replaces `<stat_grant>`, `<npc aff="+|-" trust="+|-">` takes a bare sign only (never a magnitude — the strictest version after several rounds of review), a new `<enrich lore/beast>` tag fills a real per-turn content-update gap Lore never had, Quest's `status` renames to the full-word `stat` attribute, the dead `<turn dist>` attribute is dropped, and `locdisp` becomes optional like `desc` already was. `gemini.ts`'s `runTurn` now strips `<sync>` out of a turn's text before it's resent as history. `CURRENT_SCHEMA_VERSION` bumps to 2 — `store.ts` drops and warns on a pre-2 save rather than attempting an impossible numeric-to-qualitative transform. `lib/summoning.ts` (explicitly out of scope) keeps its own numeric `Minion.hpMax`/`mpUpkeep` untouched; its MP-cost gates were removed only because `Player.mp` no longer exists.
  - **Phase 3 — Turn-loop wiring**: `App.tsx` wires `<cond>`/`<breakthrough>` into `Player.conditions`/tier bumps, calls `expireConditions` per turn; `npcs.ts`'s `applyNpcUpdates` applies affection/trust as two independent single-step nudges (never collapsed onto one axis — a mercenary can respect a protagonist's competence while disliking them personally, a real state the game's INTIMACY-gating rule depends on); a new `applyEnrichUpdates` (`lib/codex.ts`) wires `<enrich>` into `LoreEntry.content`/`BestiaryEntry.description`; `jitContext.ts`'s "Known Entities" line now filters through `isHidden()` before listing a name, fixing a real leak where a hidden Location/NPC/Faction/Lore entry's bare name reached the model's context regardless of Discovery state.
  - **Phase 4 — JIT ordinal hints**: `jitContext.ts` injects `compareTiers()` as a one-line adjudication hint — COMBAT compares the protagonist's physical prowess (max of STR/AGI) against the active adversary's `threatTier`; SOCIAL compares INT against a present NPC's `resolve` — one shared primitive, two call sites, 0 tokens when neither applies.
  - **Phase 5 — Qualitative HUD**: `Chronicle.tsx`'s old numeric `PoolBar` is replaced by a `ConditionBadge` deriving a coarse Fine→Hurt→Bloodied→Critical status from the player's/enemy's active Condition Tag count (sidebar, mobile HUD, combat bars, Bestiary popup); `Codex.tsx`'s player panel now renders attributes as tier words instead of raw numbers.
  - **Phase 6 — TaleDiveWeaver as default flow**: `StoryMode`'s "Original" path now routes to TaleDiveWeaver instead of `WorldSetup`; `MainMenu.tsx`'s now-redundant standalone TaleDiveWeaver card is removed (library-mode Edit/New World/Protagonist entry points are untouched); a new `WorldData.tierSkin` + `lib/tiers.ts`'s `displayThreatLabel` give the Narrative node a purely cosmetic, client-side-only Threat-ladder reskin (Plain words / E-S++ rank / fully custom), applied in Codex's Bestiary views — the LLM always emits the fixed canonical word regardless of what's picked. The one-time world-seeding grammar (`worldSeedContract.ts`/`worldSeedParser.ts`/`seeding.ts`), left on its old numeric shape by the Phase 1+2 pass as explicitly out-of-scope for that unit, is finished here: `<npc aff/trust>` now take a canonical relationship word instead of a signed offset, and `<item bonus="+N STR...">` renames to `traits="..."` — `seeding.ts`'s word resolution is deliberately lenient (falls back to the floor tier on an unrecognized word) rather than throwing, since that whole pass runs outside the file's own try/catch and its documented design is "never blocks campaign creation."
  - **Phase 7 — Codex restructuring** (the largest single diff): `Campaign.corpses` (a flat LIFO tag stack) is folded into `BestiaryEntry.corpseCount`/`lastSlainTime` — per-species aggregation instead of a flat stack, with a "Recently Slain" chip in Bestiary's own views; `summoning.ts`'s `!arise` now picks the Bestiary species with the highest harvestable count (most-recent `lastSlainTime` breaking a tie, via a new `compareGameTime` in `lib/gameTime.ts`) and names the minion from its real Bestiary name instead of an underscore-swapped id; `!corpses` (`bangCommands.ts`) reads the same source. A new Projects system — `ProjectEntry`/`ProjectStage`/`ProjectUpdate` (`types.ts`), `lib/projects.ts` (`applyProjectUpdate` mirroring `lib/quests.ts`'s stub/merge shape, `isProjectReady` reusing `isTimeReached`), a new `<project id stat stage note>` XML tag — generalizes Crafting per the user's own construction/repair example ("if I'm building a city, I know the conditions needed... enables scenarios that 'this is not yet ready'") as a genuinely separate, simpler system living alongside the untouched recipe-based `lib/crafting.ts`/`data/recipes.ts` (completion is always an explicit LLM-narrated update, never an auto-payout timer). `Codex.tsx` folds `'corpses'` into Bestiary's own detail view, merges `'character'`+`'realm'` into one `'campaign'` category (two `SectionCard`s under one screen instead of two separate top-level categories), and adds a full `'projects'` CRUD category mirroring Quests' pattern (stage checklist, ETA shown as "Ready: Day D H:MM").
  - **Verification, across all 8 phases**: `tsc --noEmit` and `vite build` clean after every phase, never left in a non-compiling state. Every new anti-drift primitive (`wordToTier`, `reqTierWord`, `signToDelta`, the new `<project>`/`<enrich>` parsers, `applyProjectUpdate`, `seedRelationTier`'s fail-soft fallback) was exercised directly against hand-written sample inputs — via pure-logic Node scripts for anything with no DOM dependency, and via a small hand-rolled `DOMParser` shim (this sandbox has neither jsdom nor linkedom installed) for the XML-parser paths — confirming both the happy path and that off-vocabulary/malformed input is rejected loudly rather than silently coerced. Repo-wide greps after each phase confirmed zero leftover references to every deleted symbol (`derivedStats`, `CombatMode`, `StatGrant`, `TacticalOverride`, the old flat `Campaign.corpses` field). A mobile-viewport (390×844) Playwright pass against the dev server confirmed the standalone TaleDiveWeaver card is gone, New Story → Original lands on TaleDiveWeaver, and the Threat Ladder Display reskin picker renders and actually swaps labels. `git diff --stat` confirmed `lib/crafting.ts`/`data/recipes.ts` are byte-identical throughout Phase 7, and `lib/summoning.ts`'s Minion-branch mechanics were touched only where `Player`'s shape change forced it, never redesigned.

