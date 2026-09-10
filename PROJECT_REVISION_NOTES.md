# Tale Dives — Project Revision Notes

**Read this file first, always.** It carries the current state, the "read this before touching X" warnings, and the pending-work list — everything a session actually needs to resume work. 

For the complete historical log of past decisions and older entries, see [`PROJECT_REVISION_NOTES_ARCHIVE.md`](./PROJECT_REVISION_NOTES_ARCHIVE.md).

## 0. How to resume
- **Start the dev server:** `npm run dev` (runs on `0.0.0.0:3000` per `package.json`).
- **Check the preview:** Open the shared URL or dev URL.
- **Run the checks:** `npm run typecheck` and `npm run build` must pass clean.

## 1. What Tale Dives Is
An immersive, LLM-driven fantasy novel game. The protagonist's actions and the world's responses are generated as narrative prose by Gemini, but long-term memory, game state (inventory, codex, NPCs, factions, quests), and mechanics are tracked deterministically in client-side TypeScript structures and parsed from the LLM's structured `<sync>` output each turn. It runs purely client-side (React + Vite) with no backend, storing state in `localStorage` with optional Google Drive backup.

## 2. Current File Inventory
- `src/App.tsx`: Main router, global state (`game`, `campaigns`), turn loop manager (`sendAction`).
- `src/screens/`: Major UI views (`Title`, `MainMenu`, `Chronicle`, `Codex`, `TaleWeaver`, etc.).
- `src/components/`: Sub-components (`glassChrome.tsx`, `seedweaver/`).
- `src/lib/`: Core logic (`taleWeaving.ts`, `taleWeaverParser.ts`, `store.ts`, `jitContext.ts`, `xmlTurnParser.ts`, `seeding.ts`, `npcs.ts`, `quests.ts`, `imageGeneration.ts`, etc.).
- `src/types.ts`: Master types (Campaign, TurnResponse, Codex entries).
- `src/api/`: Gemini API integration and turn/seeding contracts (`providers/gemini.ts`, `xmlTurnContract.ts`, `taleWeaverContract.ts`).
- `src/data/`: Static data (`classes.ts`, `starterTemplates.ts`, `soundtrackManifest.ts`).
- `PROJECT_REVISION_NOTES_ARCHIVE.md`: The full historical log.

## 3. What's Built (Current State)
- **Tale Weaving (Inspired Mode):** A phased, generative setup flow (World → Protagonist → Cast → Lore → Arc) using the LLM to draft a rich starting state. Includes safety confirmations on generation. Tale Weaving's Arc phase also captures Narrative Events and Death/End Game Rules interactively, and world seeding (Original Mode, `lib/seeding.ts`) generates starter Narrative Events too.
- **Narrative Events:** `Campaign.narrativeEvents?: Dict<NarrativeEvent>` — condition-triggered reactive story complications (distinct from the linear `Campaign.beats[]` spine), checked client-side each turn via `lib/narrativeEvents.ts` against the same trigger vocabulary Codex Discovery uses (`flag`/`location_visit`/`npc_met`/`quest_complete`/`manual`), plus a `story` trigger where the model itself emits `<event_trip id="..." />` when a freeform prose condition is met.
- **Death Rules & End Game Rules:** `Campaign.deathRule?: 'soft_fail' | 'permadeath'` (plus `deathInstructions`) branches defeat handling between the existing recovery beat and a real story-ending death; `Campaign.endGameRules?: Partial<Record<EndingOutcome, string>>` is per-outcome narration guidance surfaced to the model on the existing `!conclude`/final-beat ending triggers.
- **NPC Kinship:** `KinshipType` (`'parent'`/`'sibling'`/`'child'`/`'spouse'`/`'mentor'`/`'clan'`) on `NpcEntry.kinship`, hard-gating INTIMACY-track escalation for family relations regardless of Trust/Affection tier.
- **XML Turn Engine:** The narrator emits a `<nar>` block for prose and a `<sync>` block (parsed by `xmlTurnParser.ts`) containing exact state updates (`<loc>`, `<npc>`, `<item>`, `<enrich>`, `<project>`, `<breakthrough>`, etc.).
- **JIT Context:** Slices the massive Codex into a small ~40-80 token header (`jitContext.ts`) injected into the prompt each turn, based on who is present or relevant.
- **Codex & Discovery:** Tracks Lore, NPCs, Factions, Locations, Items, Quests, Skills, Projects, and Bestiary. Items are gated by `DiscoveryState` (Known vs. Hidden).
- **Client-Side Image Generation:** Generates UI assets (character portraits, realm art) on the fly via Gemini (`lib/imageGeneration.ts`), storing them in IndexedDB.
- **Background Music:** Context-aware soundtrack crossfading based on turn states.
- **Data Persistence:** Client-side `localStorage` with multiple campaign slots and optional Google Drive backup/restore.

## 4. What's Not Built / Known Issues
- Full multi-device sync or backend database (intentionally client-side for now).
- Novel Weaver (a second, alternate Tale-creation flow) was built earlier and has since been fully removed — don't reintroduce it or look for `screens/NovelWeaver.tsx`, it no longer exists.

## 5. Explicitly Requested But Not Started
- Action Suggestion Pills (rendering clickable `turn.act` suggestions into the UI).

## 6. Suggested Resumption Order
- Pick up from the user's latest prompt. Always verify changes with a live click-through in the dev server.

## Full revision history
Every dated session entry through 2026-09-09 has been moved to [`PROJECT_REVISION_NOTES_ARCHIVE.md`](./PROJECT_REVISION_NOTES_ARCHIVE.md). That file is a verbatim continuation of the same log; nothing was edited or condensed, only relocated. Read it only when a specific past decision needs more detail than the summary sections above give — for resuming work, everything above this line is what actually matters.

### New entries below, most recent first.

- **2026-09-09** — Docs-only current-state refresh in `PROJECT_REVISION_NOTES.md` (no code touched). Updated §3 with recently shipped systems (Narrative Events, Death & End Game Rules, NPC Kinship, Tale Weaving & Seeding integration) and added a removal note in §4 for Novel Weaver as a follow-up to the prior archiving pass.
- **2026-09-09** — Updated the image generation pipeline to use `@google/genai` with the `gemini-3.1-flash-image` model per custom AI Studio system instructions, replacing the previous raw `fetch` to `gemini-2.5-flash-image`. Verified mapping for NPCs, Locations, and Regions. Modified TaleWeaver flow to require opening the "Tale Overview" modal before starting the campaign via the "Dive in" button. Verified cleanly with `tsc --noEmit`.
