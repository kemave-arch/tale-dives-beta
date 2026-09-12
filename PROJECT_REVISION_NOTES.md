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
- **Lore Accuracy System:** Optional, Tale-Weaving-only "Novel Inspiration / Author / Canon Scope Boundary" fields (`WorldData.sourceScope` gates this — a bare `sourceTitle` stays attribution-only, unaffected). When set, injects a lore-accuracy + spoiler-boundary contract into Tale Weaving's phase calls and every turn's JIT context (`jitContext.ts`), and resolves canon-accurate, name-free physical/environmental descriptions for NPC portraits and Location images (`lib/canonDescription.ts` — NPCs via a fixed 10-slot template, Locations as one freeform paragraph) — the entity's real name/source title never reaches the image model at either stage (Stage 1 resolution or Stage 2 final prompt assembly), only the resolved description does, with continuity preserved across regenerations via `NpcEntry.canonAppearance`/`LocationEntry.canonDescription`. Region maps are NOT yet covered by this system (a map depicts multiple named places, so blanket redaction isn't viable there — open gap). A dev-only **Image Prompt Lab** (Settings → AI Model → Open Image Prompt Lab) drives the real prompt/resolution functions directly for iterating on wording.
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
- **2026-09-11** — Audited Image Generation Lifecycle & Enforced Strict Manual-Only Policy (`src/lib/imageGeneration.ts`, `ImagePromptTest.md`).
  1. Audited all 7 Tale Weaver phases, story turns (`narrator.ts`, `gemini.ts`), and Codex workflows to inspect for automatic image generation calls. Confirmed zero automated image calls exist in the codebase: image generation has always been strictly on-demand via `TaleWeaverImageGenerator` and `EntityImagePanel`.
  2. Enforced explicit lockdown policy: defined `AUTOMATIC_IMAGE_GENERATION_ENABLED = false` in `src/lib/imageGeneration.ts` to guarantee no future phases or background hooks silently call image generation without direct player button interaction.
  3. Created `ImagePromptTest.md` documenting the 3 entity types with generated artwork (Character portraits, Location environment art, Region maps), their exact prompt templates, related data fields (`worldDirective`, `appearance`, `role`, `description`), and 3 complete beginner-friendly examples showing how final prompts are constructed from game data.
- **2026-09-10** — Re-architected Tale Weaving (`src/screens/TaleWeaver.tsx`) layout for PC & ultra-wide displays. Constrained container max-width to `max-w-4xl lg:max-w-5xl` to eliminate horizontal stretching, centered and structured the 7-phase stepper bar, refined the empty-state card with a quick "Auto-Weave" CTA, polished the guidance input deck, and constrained navigation buttons to proportional widths.
- **2026-09-10** — Added Environment Secrets Pipeline for GitHub Pages (`.github/workflows/deploy.yml`, `.env`, `.env.example`). Passed `VITE_GEMINI_API_KEY`, `VITE_GEMINI_PREM_KEY`, and `VITE_IMGBB_API_KEY` through the GitHub Actions build workflow step so automated deployments inject secrets securely into static site builds. Cleaned up `.env` syntax formatting.
- **2026-09-10** — Initial Prompt Edit Preview on First Click (`src/screens/TaleWeaver.tsx`, `src/screens/Codex.tsx`). Updated `handleButtonClick` in `TaleWeaverImageGenerator` and `EntityImagePanel` so clicking the initial image generation button opens the prompt edit panel pre-filled with the auto-generated initial draft prompt. This allows players to inspect and tweak the prompt before confirming generation.
- **2026-09-10** — Codex Navigation Return Fix & Region Deduplication (`src/screens/Codex.tsx`, `src/screens/Chronicle.tsx`, `src/lib/codex.ts`, `src/App.tsx`). Fixed Codex navigation bug where opening a Codex entry from the Parchment view (`Chronicle`) didn't return to the Parchment view upon pressing back. `Codex.tsx` now tracks `openedWithTargetRef` and calls `onBack()` directly to return to caller view (`Chronicle`). Solved the redundant "Basgiath War College" location bug where a region was auto-logged as an empty location stub: `applyKeywordLinks` now checks `regions` before auto-logging a location stub, `dedupLocationsWithRegions` purges empty location stubs that duplicate known Region entries, and `Chronicle` / `App` smoothly fallback to Region entries for location keyword links.
- **2026-09-10** — Parchment Popup Images & Champagne Gold Premium Image Generation (`src/screens/Chronicle.tsx`, `src/screens/TaleWeaver.tsx`, `src/screens/Codex.tsx`, `src/lib/imageGeneration.ts`, `src/lib/entityImages.ts`, `src/types.ts`, `.env.example`).
  1. **Parchment Keyword Popup Image Display:** Parchment keyword popups in `Chronicle.tsx` check for entity image keys (`portraitKey`, `imageKey`, `mapImageKey`) via `useEntityImage` and display generated artwork inside the parchment popup card.
  2. **Premium Nanobanana Key & Champagne Gold Generation Button:** Added `VITE_GEMINI_PREM_KEY` support in `.env.example`, `ApiSettings.premiumApiKey` in `types.ts`, and `getPremiumApiKey` helper in `lib/imageGeneration.ts`. Added a Champagne Gold `'Premium'` button in `TaleWeaverImageGenerator` (`TaleWeaver.tsx`) and `EntityImagePanel` (`Codex.tsx`) alongside a warning note that 'Premium' uses paid API tokens (`Gemini_Prem_Key` quota).
- **2026-09-10** — Image Gallery Carousel & Deletion (`src/types.ts`, `src/screens/Codex.tsx`, `src/screens/TaleWeaver.tsx`, `src/lib/imageStore.ts`).
  1. Added `imageHistory?: string[]` to entity and draft interfaces to track all generated image keys for a given entity.
  2. Implemented carousel controls (left/right hover chevrons and position indicators) in `EntityImagePanel` (`Codex.tsx`) and `TaleWeaverImageGenerator` (`TaleWeaver.tsx`) so players can cycle through past artwork generations.
  3. Added a hover Trash button and `deleteImageBlob` helper (`imageStore.ts`) to delete bad generations and purge them from IndexedDB.
- **2026-09-10** — Single Model Enforcer & Dynamic Prompt Overhaul (`src/lib/imageGeneration.ts`).
  1. Removed multi-model fallback cascade, enforcing strict single-model generation targeting `gemini-3.1-flash-lite-image`.
  2. Overhauled `buildLocationImagePrompt`, `buildNpcPortraitPrompt`, and `buildRegionMapPrompt` to construct structured RPG prompts including `genreTone`, `eraTechLevel`, and `powerSystem` via `worldDirective`.
  3. Corrected SDK schema mismatch (reverting invalid `responseFormat` suggestions back to valid `imageConfig` in `@google/genai`).
- **2026-09-10** — Refined Prompt Engineering & Configuration via Claude Feedback (`src/lib/imageGeneration.ts`).
  1. Expanded `ImageAspectRatio` type to support all 14 ratios supported by `gemini-3.1-flash-lite-image` (`"1:1" | "1:4" | "4:1" | "1:8" | "8:1" | "2:3" | "3:2" | "3:4" | "4:3" | "4:5" | "5:4" | "9:16" | "16:9" | "21:9"`).
  2. Updated prompt negative-constraints to say "no readable text, labels, or logos in the artwork" instead of absolute "no watermarks" (reflecting C2PA/SynthID watermark realities).
  3. Replaced hardcoded "fantasy" fallback in `worldDirective` with generic "an original fictional setting" to avoid clashing with sci-fi, modern, or magitech worlds.
  4. Verified `responseModalities: ["IMAGE"]` and `config.imageConfig` payload with `@google/genai` TypeScript SDK.
