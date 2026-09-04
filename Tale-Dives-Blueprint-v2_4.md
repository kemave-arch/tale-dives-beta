# Tale Dives — Master Game Blueprint & System Architecture Specification (v2.4)

**Project Title:** Tale Dives

**App Developer:** Kemuel Avenido (Kem Ave)

**Dedicated To:** Elisah Mirelle R. King (*My Avid Bookworm*)

**Architecture:** Single Page Application (SPA) — Vite + React | Local-First Engine + Provider-Agnostic LLM API (Player-Configured Model/Provider)

**Target Atmosphere:** Authorial High-Sensory Fantasy RPG (mature violence & romance themes) / Interactive Web Novel

**v2.4 Changelog (this revision):**
* **New §1.1 Technical Stack & Build Setup** — the build tooling was implied throughout (React, Tailwind, Framer Motion, Lucide all named in §6) but never pinned down as an explicit stack. Now stated plainly: Vite + React, client-only SPA, no backend. Includes the core dependency list with blueprint tie-ins, a suggested folder structure mapped to this document's own section terminology, npm scripts, and a deployment note (any static host, since there's nothing but static files to ship).

---

## 1. Executive Summary & Core Philosophy

**Tale Dives** is an atmospheric, high-stakes fantasy role-playing engine — mature violence and romance themes, not a horror-toned genre label — engineered to blend rich authorial prose with unyielding game mechanics. Standard LLM text adventures suffer from context decay, weightless choices, and stat hallucinations. Tale Dives eliminates these flaws through a **Client-Side Shadow Referee** paired with **Just-In-Time (JIT) Context Slicing**. The AI engine serves purely as an expressive narrator and world simulator, while the client application handles hard state, currency accounting, entity validation, and persistent world memory.

There is no hidden randomness in Tale Dives — no dice, no rolls. By default, combat outcomes are fully deterministic, computed client-side from derived stat formulas before the prompt is ever sent, and Gemini's job is exclusively to narrate outcomes it is handed — never to decide them. This is **Tactical Mode**. A player can instead choose **Narrative Mode** for a scene or a whole campaign — see §5.1d — where combat resolves the way SOCIAL/EXPLORE turns already do: narratively, bounded by context rather than a formula, for stories where stated tactics or a special power should matter more than a stat sheet. Either way, the Shadow Referee still owns state integrity; only the *source* of a combat outcome changes.

### 1.1 Technical Stack & Build Setup

Pinned down explicitly here since every other section assumes it: Tale Dives is a **standalone Vite + React SPA, client-only, no backend server**. Every design decision elsewhere in this blueprint — local-first saves (§6.4B), the API key living only in the browser (§3.4), the client owning all game-state math (§3.2) — depends on there being no server in the loop at all. The app talks directly from the browser to whichever LLM provider the player configures; there is nothing else to deploy or host beyond static files.

**Core dependencies:**

| Package | Role | Blueprint tie-in |
| --- | --- | --- |
| `vite` + `@vitejs/plugin-react` | Dev server & build tool | Fast HMR for iterating on the Chronicle loop; outputs a static `dist/` — no server-side rendering needed since there's no backend to render against. |
| `react` / `react-dom` | UI framework | Referenced throughout as "React" (§3.2 Shadow Referee, §2 Phase D) |
| `tailwindcss` (+ `postcss`, `autoprefixer`) | Styling | §6.1's theme tokens, §6.1a glassmorphism recipe, §6.1d chrome rules |
| `framer-motion` | Motion | §6.0 Motion System |
| `lucide-react` | Icons | §6.1b icon mapping |

**State & persistence — deliberately minimal, not a new library per feature:**
* Component state via React's built-in `useState`/`useReducer`/Context is sufficient for a single-session game loop like this; don't reach for Redux/Zustand/etc. unless the Codex/Library state genuinely outgrows Context in practice — most of this app's real complexity lives in the Shadow Referee's validation logic (§3.2), not in state plumbing.
* `localStorage`/`IndexedDB` for the `Browser Only` save path, and the File System Access API for `On-Device Folder` (§6.4B) — both native browser APIs, no persistence library required.

**Suggested folder structure**, mapped to this blueprint's own terminology so the code and the spec stay easy to cross-reference:

```
src/
  screens/          # Title, MainMenu, Chronicle, Codex, SettingsDrawer (§6.4A-E)
  components/
    radial-menu/     # §6.5
    command-palette/ # §6.6
    codex/           # Entry Grid/Detail/Popup Card (§6.4D, §5.14)
  lib/
    shadowReferee.js  # §3.2 — all clamping/validation logic lives here, isolated from UI
    jitContext.js      # §3.1 — builds the context slice each turn
    combat.js           # §5.1/§5.1d — Tactical math + Narrative Mode bounds
    autoRegister.js     # §5.10/§5.13/§5.14 — the shared stub-creation pattern
  api/
    providers/          # one adapter per provider (§3.4), behind a common interface
    capabilityMap.js     # supportsGrounding/JsonSchema/Streaming/PromptCaching flags
  data/                  # local static dictionaries (Phase C): classes.json, locations.json,
                         # items.json, recipes.json, adversaries.json
```

**npm scripts**: `npm run dev` (local dev server), `npm run build` (static production build), `npm run preview` (serve the built output locally to sanity-check before deploying). No `start`/server script — there's nothing to keep running once it's built.

**Deployment**: any static host (Vercel, Netlify, GitHub Pages, or self-hosted) works, since `vite build` produces plain static files and the app never calls anything but the player's own chosen LLM provider directly from the browser.

---

## 2. Complete Gameplay Lifecycle & Flow

```
+----------------------------------------------------------------------------------------+
|                                1. CREATION PIPELINE                                    |
|   Campaign Setup (Original / Inspired) --> Protagonist Creation (3 Class Branches)    |
+-------------------------------------------+--------------------------------------------+
                                            |
                                            v
+----------------------------------------------------------------------------------------+
|                             2. INITIALIZATION & SEEDING                                |
|   Load Regional Map Nodes --> Seed Codex --> Establish Factions & Initial NPCs         |
+-------------------------------------------+--------------------------------------------+
                                            |
                                            v
+----------------------------------------------------------------------------------------+
|                             3. ACTIVE NARRATIVE TURN LOOP                              |
|                                                                                        |
|   +-----------------------+         +------------------------+                         |
|   | Player Action Input   | ------> | JIT Context Compiler   |                         |
|   +-----------------------+         +-----------+------------+                         |
|                                                 | (Client resolves any combat math,   |
|                                                 |  appends result + lean context)      |
|                                                 v                                      |
|   +-----------------------+         +------------------------+                         |
|   | UI Render & Parchment | <------ | Shadow Referee & Parse | <------ Gemini Output   |
|   +-----------------------+         +------------------------+                         |
+-------------------------------------------+--------------------------------------------+
                                            |
                                            v
+----------------------------------------------------------------------------------------+
|                             4. CHAPTER RECAP & MILESTONES                              |
|   Chapter Milestone Summary --> Archive Local Log --> Reset Sliding Dialogue Window   |
+----------------------------------------------------------------------------------------+
```

### Phase A: Campaign & World Setup

1. **Original Mode**: Manual selection of narrative genre, tone, starter location node, and core regional conflict, plus a **World Background** field (short free text — the setting's key backdrop, e.g. "the continent of Navarre") and a **Narration Style** field (§4.5) — free text describing the desired prose voice. Defaults to the recommended voice in §4.5 if left blank; fully player-editable at creation and later.
2. **Inspired Mode**: The player inputs a Title and Author (e.g., *Fourth Wing* by Rebecca Yarros), plus an optional **World Background** field to narrow which part of a larger series/setting the campaign uses (e.g. a specific continent, era, or region) beyond what grounding would infer alone. A **"Match Author's Style"** toggle (default **on**) sits alongside these fields — when enabled, the grounding call additionally returns a `narration_style_profile` (§4.5) describing the author's prose voice. **The grounding call itself is deferred**, not fired here — it waits for the Tale Dive Brief (§Phase B.4) so protagonist and opening-scene context can be folded into the same single request, then fires exactly once to populate 3 core factions, a world overview, primary plot threads, the narration style profile (if enabled), suggested `discovery` states for the lore it generates (§5.12), and the Turn 1 opening seed together.

### Phase B: Protagonist Creation Pipeline

1. **Trait & Origin Definition**: Name, background, starting attributes ($STR, INT, AGI$) — **optional**. If skipped, the client applies a flat baseline profile (STR/INT/AGI = 10/10/10) so downstream formulas always resolve.
2. **Class Assignment** — one class slot, chosen from the unified preset roster (§5.1a) or grounded freely (§Phase B.2a below):
   * Three presets happen to grant summoning-type abilities (§5.3): **Dark Monarch** (Shadow Extraction, `/arise`), **Classic Necromancer** (Bone Dust reanimation, `/raise_skeleton`), **Contract Gate Summoner** (planar familiars, `/summon`) — these are just three entries in the same preset list as Warrior, Mage, Paladin, and the rest (§5.1a), not a separate mandatory pick. A player who picks any preset skips grounding entirely and loads the local weight vector at zero token cost.
   * Whichever class is chosen determines that character's starting abilities and weight vector from Turn 1. It isn't permanent — see **Class Evolution** (§5.1b) for how a class can change later through ordinary story events, no second slot required.

2a. **Free-Form Class Assignment (Grounded Mode)**: Class Assignment is open-ended. Instead of picking from the preset roster, the player may type **any class name** — including one lifted straight from the source material (`Windrunner`, `Fated Blade`, `Apprentice Scribe`, `Bonded Warder`, anything).

   * **Trigger fields.** The player supplies: the typed class name, plus whatever's already known from campaign setup — Novel/Series Title, Author (Inspired Mode only), World/Setting Name, and the protagonist's Character Name if named. Original Mode still works; those fields are simply left blank and the grounding call reasons from genre/tone instead of a specific canon.
   * **Single grounded call, no chaining.** This is resolved in **exactly one** API request — not a search call followed by a separate reasoning/formatting call. The request enables the selected provider's built-in web-grounding/search tool (e.g., Google Search grounding on Gemini, the `web_search` tool on providers that support server-side tool use) **in the same call** that also carries the structured-output schema below, so research and formatting happen in one round trip:
     ```text
     [CLASS GROUNDING REQUEST]
     Player-Typed Class: "Windrunner"
     Source: "The Stormlight Archive" by Brandon Sanderson
     World/Setting: (as set in campaign)
     Character Name: (as set, if any)
     Task: Identify how this class/role functions in the named source (abilities, combat role,
     resource logic, thematic identity). If ungrounded/original setting, reason from genre and
     tone instead. Return ONLY the JSON object matching the Class Assignment Schema.
     ```
   * **Class Assignment Schema** (single structured response, mirrors the pattern in §7.3): `class_id` (snake_case), `display_name`, `weights` (`STR`/`INT`/`AGI`, must sum to 1.0), `flavor_summary` (≤40 words, canon-grounded rationale), `suggested_quick_slots` (2–4 thematically appropriate ability names for the Phase B.3 tray), and `grounding_used` (boolean — false if the provider/model had no search tool available and the model answered from its own training data instead). This exact schema is reused, unchanged, whenever Class Evolution (§5.1b) fires later in the campaign.
   * **Client-side validation (Shadow Referee pattern, §3.2):** the returned `weights` vector is clamped/renormalized to sum to exactly 1.0 before it's ever written to state — the same integrity guarantee every preset class already has (§5.1a). A vector that arrives malformed or missing is rejected and the player is re-prompted to retry or fall back to a preset, rather than silently accepting bad data.
   * **Caching, not re-grounding.** Once resolved, the class is written into the player's local **Custom Class Dictionary** (same flat-JSON pattern as §5.1a's preset table) so it never needs to be re-grounded on later sessions, level-ups, or if the player starts a second character with the same class in the same world.
   * **Model source.** This call uses whatever model/provider is currently selected in API Settings (§3.4) — never a separate, hardcoded "creation model." If that model/provider doesn't expose a grounding tool, the app proceeds ungrounded and marks `grounding_used: false`; the Class Confirmation card (below) visibly flags this so the player knows the result is the model's own knowledge rather than a verified web lookup.
   * **Class Confirmation card.** Before committing, the player sees the returned `flavor_summary`, weight vector (rendered as a simple STR/INT/AGI bar split), and suggested quick-slots, with **Accept** / **Reroll** (re-runs the same single grounded call) / **Edit Manually** (opens the weights as editable sliders, still constrained to sum to 1.0) / **Use a Preset Instead** actions.
   * **A class doesn't have to be the story's final word.** Nothing here requires the starting class to be combat-relevant — an `Apprentice Scribe`-type starting class with a scholarly, non-combat weight vector is a perfectly valid result. Class Evolution (§5.1b) is the simple, single-slot mechanic that exists for exactly the case where the protagonist's real identity is revealed or forced by the plot later — see Appendix A for a worked example.
3. **Equipped Quick-Slots**: [CUT BY USER] Selecting 3 active skills for instant 1-tap cast buttons on the UI tray — pre-populated from `suggested_quick_slots` when the class came from grounding.
4. **Tale Dive Brief**: a free-text field — named after the app itself — where the player describes the exact scene, moment, location, and characters present where Turn 1 should open. Optional; left blank, the deferred grounding call (Inspired Mode) or genre/tone defaults (Original Mode) choose a sensible opening automatically. **Submitting this brief is what fires the single deferred world-fabrication call described in §Phase A.2** — it happens right before the world is fabricated, not earlier in the flow, so the call can seed the opening scene's specific NPCs (e.g. named family members mentioned in the brief) using the exact same auto-registration pattern already defined for mid-session location stubs (§5.10). See Appendix A for a full worked example.
5. **Combat Resolution Mode** (§5.1d): a two-option toggle, **Tactical** (default) or **Narrative** — whether combat resolves from derived-stat math or narratively like other turn states. Changeable at any time from the Settings Drawer (§6.4E) or overridden for a single scene via the `!` command manager (§6.6); nothing here is locked in at creation.

### Phase C: World Initialization & Seed Data

* Loads local static dictionaries (location nodes, item values, base spells) into browser `localStorage`.
* Generates zero-token baseline contexts so routine turns do not require repeated setup queries.
* If a Tale Dive Brief (§Phase B.4) named NPCs not yet in the Codex (e.g. family members present at the opening scene), those are seeded from the Phase A.2 grounding response using the same stub-creation path as Location Auto-Registration (§5.10), so Turn 1 can reference them immediately rather than waiting for an ordinary in-session auto-log.

### Phase D: Active Narrative Turn Loop

1. **Action Input**: Player types an action or selects a suggested choice pill.
2. **Client-Side Resolution (Combat Only, Tactical Mode)**: If the action is a combat action **and** the active Combat Resolution Mode (§5.1d) is Tactical, React computes the numeric result — damage dealt, MP/ST spent, resulting HP — using the derived-stat formulas in §5.1. No roll, no check, no randomness: same inputs always produce the same output. In Narrative Mode, this step is skipped and the combat action flows through like any other narrative turn, subject to §3.2's softer Narrative Delta Bounds instead.
3. **JIT Context Slicing**: The client compiles active location info, present NPCs, active quests, the active Combat Resolution Mode (§5.1d), and (if applicable, Tactical Mode) the precomputed combat result into a lean context string (~30–60 input tokens).
4. **Gemini Handshake**: Prompts Gemini with strict System Instructions and JSON response schema. In Tactical Mode, Gemini narrates the given result; it does not compute or alter it. In Narrative Mode, Gemini resolves the exchange itself, bounded by context.
5. **Self-Healing Pipeline**: Regex Sanitizer cleans raw strings → `JSON.parse` extracts deltas → Shadow Referee validates/clamps values (exact-match in Tactical Mode, magnitude-bounded in Narrative Mode, §3.2).
6. **State Mutation & Render**: Stats, inventory, currency, and parchment scroll update in real-time.

### Phase E: Chapter Milestone & Memory Reset

* At chapter boundaries, Gemini outputs a 2-sentence chapter summary.
* Past conversation turns are flushed from the sliding API prompt window while persistent summary cards are saved locally, maintaining full memory coherence at minimal token cost.

---

## 3. Architectural Pillars & Token Optimization Protocols

### 3.1 Just-In-Time (JIT) Context Slicing

Instead of feeding Gemini an infinite chat log or full codex, the engine constructs a dynamic **JIT Context Header** right before sending each prompt:

```text
[ACTIVE CONTEXT SLICE]
Player: Wren of the Ashmark (Dark Monarch) | Level: 3 | HP: 42/50 | MP: 18/30 | ST: 25/25
Location Node: loc_ashgate_courtyard | Time: Day 1 08:15 AM
Known Location: Ashgate Fortress — Upper Courtyard | Danger: Low | Standing: Friendly (Ashgate Garrison)
Equipped Quick-Slots: [Shadow Step], [Arise], [Soul Feast]
Present NPCs: NPC: Commander Valen Thorne | Stage: Acquaintance | Trust: 45 | Mem: "Needs vault inspected."
Active Regional Objectives: Main: "Inspect Keystone Seal"
World Flags: [spared_archive_guard]
Base Copper Wealth: 14580
Combat Resolution Mode: TACTICAL
Combat Result (if applicable, Tactical Mode only): Player strikes for 14 damage. Enemy HP: 22/40 remaining.
Target Prose Depth: BALANCED (~1,100-1,400 tokens)
Narration Style: Third-person limited, past tense, long sensory sentences broken by short blunt ones at moments of violence...
```

**How location memory actually works — the model doesn't "remember," the client re-tells it.** Gemini has no persistent memory of prior turns beyond the sliding conversation window (§Phase E flushes it at chapter boundaries) and never sees the full Codex. Consistency about a place the player has been before comes entirely from this line: **`Known Location`**. Every turn, the client checks the current `loc_id` against the Locations Codex (§6.4D); if a real (non-stub) entry already exists, its display name, danger level, and derived faction standing (§5.11) are compiled into this one compact line and re-sent — so the model is reminded "this is the same courtyard, already Friendly territory" without ever needing the full stored description or a second API call. If the location has no Codex entry yet (first visit), this line is simply omitted and the model is narrating somewhere genuinely new.

### 3.2 Client-Side "Shadow Referee"

Gemini handles creativity; React handles ground truth.

* **Stat Clamping**: HP is clamped to $[0, \text{Max HP}]$, MP to $[0, \text{Max MP}]$, ST to $[0, \text{Max ST}]$ — in every Combat Resolution Mode (§5.1d), no exceptions.
* **Combat Math Ownership (Tactical Mode)**: All damage, healing, and resource costs are computed by React *before* the prompt is sent (see §5.1). Gemini never determines a numeric combat outcome — it only narrates one it's given. Any `deltas` Gemini emits during a Tactical combat turn are validated against the precomputed result and overwritten if they disagree.
* **Narrative Delta Bounds (Narrative Mode, §5.1d)**: with no precomputed value to check against, the Shadow Referee can't overwrite a mismatch — instead it clamps `deltas.hp/mp/st` to `[0, max]` as always and soft-caps any single-turn magnitude exceeding a tunable share of the relevant max pool (§8), so an ordinary narrated exchange goes through untouched while a wildly implausible number still gets bounded. Opting into Narrative Mode relaxes *whose number wins*, not the floor/ceiling every pool already has.
* **Inventory Sanity Check**: If Gemini emits `"inv_rem": ["shadow_dagger"]` but the player doesn't own it, the update is dropped.
* **Skill Affordability**: React checks player MP/ST *before* sending a skill action to Gemini, instructing Gemini to narrate either successful casting or exhaustion penalties based on actual resource state. This check runs regardless of Combat Resolution Mode — affordability is never optional, only the outcome-authority is.
* **Turn State Consistency**: When the client has precomputed a Combat Result (§2 Phase D.2, Tactical Mode only) and sent it in the context slice, `turn_state` is forced to `COMBAT` regardless of what Gemini emits — the client already knows this is a combat turn before the prompt goes out, so it isn't left to the model to independently (and possibly incorrectly) label. In Narrative Mode, `turn_state: COMBAT` is Gemini's judgment call like any other state, since there's no client precondition to check it against.
* **Reputation-Gated Social Outcomes**: For SOCIAL-tier turns (no numeric resolution), NPC willingness is bounded by their Trust tier (§5.4/§5.5) rather than by a check — e.g. a Tier -1 "Suspicious" NPC should refuse requests a Tier +2 "Allied" NPC would grant. This is enforced via system instruction, not client math, since social outcomes remain narrative.

### 3.3 Three-Stage Self-Healing JSON Pipeline

```
[Raw Gemini Response] --> [Stage 1: Regex Sanitizer] --> [Stage 2: Schema Parser] --> [Stage 3: Parchment Fallback]
```

1. **Stage 1 (Regex Sanitizer)**: Strips Markdown code fences, fixes trailing commas, unescapes rogue quotes inside narrative text.
2. **Stage 2 (Schema Parser)**: Executes `JSON.parse()`. On success, commits state deltas (after Shadow Referee validation).
3. **Stage 3 (Fallback Reader)**: If parsing fails, extracts pure prose between quotes and renders it directly in the parchment viewer, displaying a discreet `[Repairing State]` indicator while keeping gameplay smooth.

**Stage 0 (Request Failure Handling)** — new: if the API call itself fails (timeout, rate limit, safety block), retry once silently. On second failure, freeze the turn in a `PAUSE`-equivalent state and surface an in-fiction "The thread of fate falters..." message rather than a raw error, preserving immersion while the player retries. If the failure persists, the player can expand this message into the API Failure Diagnostics Panel (§3.5) rather than being stuck guessing.

### 3.4 Provider-Agnostic Model Routing

No step in Tale Dives is pinned to a specific vendor or model. **API Settings** (accessible from the Title Screen, Main Menu, and the in-story Settings drawer) is the single source of truth for which provider, model, and credentials every call in the app uses:

* **Fields**: Provider (e.g., Gemini / OpenAI / Anthropic / OpenAI-compatible custom endpoint), Model ID (free-text or dropdown, since providers ship new point-releases faster than any hardcoded list can track — see the note at the end of §7.1), API Key (stored locally only, never sent anywhere but the provider's endpoint), Temperature, and the per-Prose-Depth `max_output_tokens` table (§4.4/§7.1) which remains overridable per provider since token accounting differs slightly across APIs.
* **One config, every call type.** Turn narration (§2 Phase D), Inspired Mode world seeding (§Phase A.2), Chapter Milestone summaries (§2 Phase E), and Class Grounding (§Phase B.2a) all read from this same configuration at call time. There is no separate "creation model" or "narration model" hardcoded anywhere in the app — if the player changes their model in Settings mid-session, the very next call of any kind uses it.
* **Capability flags, not hardcoded assumptions.** Because grounding/search-tool support, native structured-output/JSON-schema support, streaming behavior, and prompt/context caching all vary by provider, the client keeps a small local capability map per provider (`supportsGrounding`, `supportsJsonSchema`, `supportsStreaming`, `supportsPromptCaching`) so features like §Phase B.2a's grounded class call, §9.1's partial-JSON streaming parser, and the caching bullet below degrade gracefully — never silently fail — on providers that lack a given capability, and any degraded state (e.g., ungrounded class assignment) is surfaced to the player rather than hidden.
* **Static payload caching, where supported.** §7.2's System Instructions and §7.3's JSON Schema are byte-identical on every turn of a session — only the JIT Context Slice (§3.1) actually changes turn to turn — which makes them the single biggest lever for reducing per-turn cost, well beyond trimming the field-level text either block contains. On a provider whose `supportsPromptCaching` flag is true (e.g. Gemini context caching, Anthropic prompt caching, OpenAI's automatic prefix caching), the client caches the System Instructions + Schema pair once at session start and sends only the JIT Context Slice plus the cache reference each turn thereafter, rather than re-transmitting ~800–1,200 static tokens on every single exchange. Where unsupported, the client falls back to sending both in full every turn, exactly as every prior revision of this spec already assumed — this is a pure optimization, never a behavior change the model needs to know about.
* **Optimization commitment.** Every multi-field task in this spec (class grounding, world seeding, turn resolution) is scoped to be resolvable in a **single request** wherever the target provider allows it — tool use (search grounding) and structured output are requested together in the same call rather than as sequential round trips, since sequential calls double latency and cost for no benefit the player can see.

### 3.5 API Failure Diagnostics Panel

When Stage 0's silent retry also fails (or the player taps "Show Details" on the in-fiction failure message), the app surfaces a diagnostics panel instead of leaving the player guessing:

* **Current API Settings, read-only and re-editable in place**: Provider, Model ID, Temperature, active Prose Depth's `max_output_tokens`, and whether grounding/streaming capability flags were active for the failed call. The API key itself is masked (`sk-••••1a2b`) — never shown or copied in full.
* **Comprehensive Copyable Report** — a single **"Copy Diagnostic Report"** button that copies a pre-formatted block to the clipboard, e.g.:
  ```text
  [TALE DIVES — API ERROR REPORT]
  Timestamp: 2026-09-02T10:41:03Z
  Call Type: Turn Narration (COMBAT)
  Provider / Model: Gemini / gemini-3.7-flash
  Attempt: 2 of 2 (Stage 0 retry exhausted)
  HTTP / Error Code: 429 RESOURCE_EXHAUSTED
  Provider Message: "Quota exceeded for requests per minute."
  Request Context: turn_state=COMBAT, prose_depth=BALANCED, max_output_tokens=2048,
  grounding_requested=false, streaming=true
  Client Version: Tale Dives v1.9
  ```
  This is safe to paste into a bug report or a provider's support channel — it deliberately never includes the API key, the player's narrative content, or personal data, only call metadata. `Client Version` is pulled from build info at report-generation time, not hardcoded — the value above is illustrative for this spec revision only.
* **Recovery actions** offered alongside the report: **Retry Now**, **Open API Settings** (deep-links into the same panel described in §3.4), and **Dismiss & Resume in PAUSE** (lets the player keep browsing Codex/Inventory while they fix credentials, without losing the frozen turn).

### 3.6 Narrative Richness vs. Delta Economy

A standing design law, restated explicitly here now that the schema has grown (Narration Style, Tale Dive Brief, Codex Discovery, §4.5/§Phase B.4/§5.12): **only one field in the whole response is allowed to be expensive, and it's `nar`.**

* **`nar` is the one lush field.** Prose Depth (§4.4) already budgets it generously, and Narration Style (§4.5) shapes its voice — this is the field the player is paying tokens to read, so richness there is the point, not a cost to minimize.
* **Every other field is a mechanism, not prose, and stays compact.** `deltas`, `inv_add`/`inv_rem`, `flag_add`, `corpse_add`, `npc_mem_up`, `quest_update`, `stat_grant` (§5.1c), and the discovery-reveal fields (§5.12) use short snake_case IDs and the shortest field names that stay unambiguous (`c` for currency, `d`/`h` for day/hour) — never a sentence where an ID suffices, and never restating in a delta field something already fully expressed in `nar`.
* **Non-LLM logic stays 0-token by construction.** This was already true for currency (§5.2), crafting (§5.8), and faction rivalry (§5.4) — every new client-side system since (Location Auto-Registration §5.10, Faction Standing derivation §5.11, and Codex Discovery reveals §5.12) follows the same rule: state changes that can be computed or checked locally are computed or checked locally, never round-tripped through the model to confirm.
* **New features are held to this by default**, not by special-case review — any future schema addition should ask "does this belong in `nar` (lush, player-facing) or in a delta field (compact, mechanism-only)" before it ships, rather than growing a third, ambiguous category.
* **Schema `description` fields are payload, not documentation.** §7.3's JSON Schema and §7.2's System Instructions are sent to the model on every single turn (or cached whole, §3.4) — a `description` string bloated with multi-sentence rationale or, worse, a `(§5.1c)`-style cross-reference into *this blueprint* is pure waste: the model never sees this document's section numbers, so a reference to one teaches it nothing and just costs tokens. Keep schema descriptions to the minimum needed to fill the field correctly; put the "why" here in the blueprint, not in the payload. Watch specifically for the same explanation appearing twice across the System Instructions and the Schema (or twice within the System Instructions itself, e.g. a turn-state guideline and a mechanics rule both re-explaining the same branch) — state it once, in whichever spot the model would naturally consult first, and have the other spot point at it briefly rather than repeat it.

---

## 4. Narrative & LLM Writing Protocols

### 4.1 Authorial Fantasy Prose Guidelines

* **Sensory Density**: Focus on weapon weight, physical strain, lighting variations, ambient temperature, tactile surfaces, and acoustic reverberation.
* **Strict Player Agency Bounds**: **NEVER** write dialogue, internal thoughts, or decisions for the player character. Describe environmental reactions, world shifts, and NPC behavior only.
* **Numeric Fidelity**: In Tactical Mode, when a `Combat Result` is present in the context slice, narrate that exact result — do not invent a different damage amount, a miss, or a critical hit that isn't in the provided number. In Narrative Mode (§5.1d), no `Combat Result` is provided; resolve the exchange narratively instead, the same way SOCIAL or EXPLORE turns already are.

### 4.2 Mandatory Rich Text Markup

Narrative output must wrap key elements in special delimiters for client-side visual highlighting:

* **`[Active Skill]`**: Soft indigo pill (`bg-[#e8eefb] border-[#5b7fc7]/40 text-[#31456e]`) — a cool accent against the warm gold/ivory palette so skills read as a distinct category from items at a glance, no glow (per §6.1d, glow is a sci-fi tell this app avoids). Tapping opens a Codex Popup Card (§6.4C) for that skill.
* **`>Item / Equipment<`**: Warm metallic gold pill (`bg-[#e2c275]/15 border-[#9c7a2e]/40 text-[#5a4d3e]`). Tapping opens a Codex Popup Card (§6.4C) for that item.
* **`'Inner Thoughts / Whispers'`**: Muted ink-toned serif italics, no pill or background — text treatment only, since interiority should feel quieter than an interactive element. Not Codex-linked; thoughts don't have entries.
* **`{{Term|category}}`** *(new, v2.2)*: Codex keyword link, for the entity categories the first two markers don't already cover — proper nouns worth cross-referencing. `category` is a short code: `npc`, `loc`, `faction`, `quest`, or `beast`, e.g. `{{Mira Sorrengail|npc}}`, `{{The Parapet|loc}}`, `{{Riders Quadrant|faction}}`. Rendered as a subtle dotted underline in Ink on Gold Accent (`underline decoration-dotted decoration-[#9c7a2e]/50 underline-offset-2`) — a literary in-text cross-reference, not another colored pill, consistent with §6.1d's "annotated manuscript" register. Tapping opens a Codex Popup Card the same way a Skill or Item does (§6.4C). Full mechanics — including what happens when the term doesn't match an existing Codex entry — in §5.14.

All four markers share one interaction model: tap → Codex Popup Card, never a jarring full-screen navigation. See §6.4C for the popup component and §5.14 for how `{{Term|category}}` resolves against the Codex.

### 4.3 9-Tier Turn State Matrix

| Turn State | Visual Theme & Badge | Narrative Focus & Mechanical Impact |
| --- | --- | --- |
| **`PEACE`** | `bg-amber-50 border-amber-300 text-amber-800` | Ambient travel, town interaction, downtime, sensory worldbuilding. |
| **`COMBAT`** | `bg-rose-50 border-rose-300 text-rose-800` | Tactical Mode: client-resolved damage/resource exchange, narrated only. Narrative Mode (§5.1d): resolved like any other narrative state, bounded by context. |
| **`STEALTH`** | `bg-violet-50 border-violet-300 text-violet-800` | Shadow navigation, suppressing magic signatures, line-of-sight — narrative only, no check. |
| **`DESPAIR`** | `bg-stone-100 border-stone-400 text-stone-700` | Psychological strain, claustrophobic dread, overwhelming odds. |
| **`EXPLORE`** | `bg-emerald-50 border-emerald-300 text-emerald-800` | Room investigation, trap disarming, lockpicking — narrative only, no check. |
| **`INSIGHT`** | `bg-cyan-50 border-cyan-300 text-cyan-800` | Monarch visions, ancient lore revelations, memory recalls, runic deciphering. |
| **`SOCIAL`** | `bg-yellow-50 border-yellow-300 text-yellow-800` | Diplomacy, merchant bargaining, coercion; outcomes bounded by NPC Trust tier (§3.2). |
| **`INTIMACY`** | `bg-pink-50 border-pink-300 text-pink-800` | Flirtation, romantic chemistry, emotional vulnerability, deep personal bonding. **Gated exactly like SOCIAL (§3.2)** — escalation is bounded by the target NPC's Trust tier, personality, and current perception of the player, not freely available. The player may always attempt to pursue intimacy; the NPC's in-fiction response (warm reciprocation, hesitance, rebuff) follows from their actual standing, the same way a Suspicious NPC would decline a SOCIAL request. |
| **`PAUSE`** | `bg-stone-100 border-stone-300 text-stone-500` | Freezes generation (0 API tokens) for system configuration, debugging, or request-failure recovery. |

All nine badges use the same recipe — a pale (`-50`) tint fill, a mid-saturation (`-300`) border, and a dark (`-700`/`-800`) text tone for AA contrast (§6.1) — so they read as small parchment-ink accents consistent with the rest of the light palette, not the dark-chip-on-dark-app treatment earlier drafts used.

### 4.4 Prose Depth Token Allocation

Prose length is player-selectable per session (or per turn, via a quick toggle) and is passed into the JIT context slice as a target for that turn — it is **not** hardcoded into the static system instructions, since the target changes turn to turn.

**This table controls length only — never model choice.** Earlier revisions auto-paired each Prose Depth Mode with a different suggested model (§9.4), which turned out to be the source of recurring bugs: switching models mid-session changes JSON-schema adherence, grounding support, and latency behavior out from under the Shadow Referee's assumptions (§3.2/§3.4). As of v1.7, Prose Depth Mode is purely a **token-ceiling and target-length control**. The model stays exactly whatever's configured once in API Settings (§3.4) for the whole session, no matter which depth the player picks turn to turn.

| Prose Depth Mode | Target Token Output | Target Word Range (after JSON overhead) | `max_output_tokens` (generous headroom) | Operational Focus & Narrative Output |
| --- | --- | --- | --- | --- |
| **CONCISE** | ~600–800 tokens | ~420–570 words | **1,280** | Direct, action-oriented narration. Quick spatial updates, core tactical outcomes, minimal fluff. Best for combat-heavy or high-frequency mobile sessions. |
| **BALANCED** *(Default)* | ~1,100–1,400 tokens | ~800–1,035 words | **2,048** | Standard novel cadence. Rich environmental texture, tactical strike weight, balanced NPC dialogue. |
| **IMMERSIVE (DEEP)** | ~1,800–2,600 tokens | ~1,340–1,955 words | **3,584** | Full authorial fantasy prose. Multi-paragraph sensory density, deep body language, atmosphere, room geometry. |

Word ranges assume ~1.3 tokens/word and subtract ~50–60 tokens of unavoidable JSON structural overhead (field names, punctuation, delta objects) from the raw token target. The `max_output_tokens` column is intentionally generous — roughly 60–70% headroom over the top of the target range rather than a tight ceiling — because a truncated `MAX_TOKENS` cutoff is a worse player-facing bug than a slightly higher per-turn cost, and it's the single biggest source of the "bugs" this system was previously producing. §7.1 and §9.4 use these exact same three numbers; there is only one token-ceiling table in the app, referenced from all three places.

**Context slice addition (every turn):**
```
Target Prose Depth: BALANCED (~1,100-1,400 tokens)
```

Recommend defaulting new players to BALANCED, auto-suggesting CONCISE on detected mobile/cellular conditions (see §9), and reserving IMMERSIVE for chapter climaxes or player-toggled "deep scenes" given its latency cost. §3.3's continuation-recovery path (re-requesting a cut-off JSON object) remains as a safety net, but with this much headroom it should trigger rarely.

### 4.5 Narration Style Profile

A second, independent lever from Prose Depth (§4.4): where Prose Depth controls *how long* a turn is, Narration Style controls *how it's written* — sentence rhythm, point of view, diction, pacing, and hallmark devices. It's carried in the system instructions/context slice every turn (§7.2 rule 1a), and the model must respect it the same way it respects the turn-state and rich-text rules already defined in §4.

* **Recommended default voice** (used whenever a campaign has no author-matched or manually written style, and as a strong starting point for Original Mode): *Third-person limited, past tense. Long, sensory sentences that build atmosphere through concrete physical detail — weight, temperature, texture, sound — periodically broken by short, blunt sentences at moments of violence or shock, so pacing itself carries tension. Occasional spare narratorial asides on cost, memory, or fate, never more than a line. Dialogue is economical and purposeful; characters are shown through action, restraint, and what they don't say rather than through exposition.* This is a genuinely good general-purpose literary dark-fantasy register — dense but not purple, varied in rhythm, and it holds up across PEACE, COMBAT, and INTIMACY turns alike without needing per-turn-state tuning.
* **Original Mode**: a free-text Narration Style field at campaign creation (§Phase A.1), pre-filled with the recommended default above as editable placeholder text — the player can keep it, tweak it, or replace it entirely (a different register, a different tense, an influence list, whatever they want).
* **Inspired Mode — "Match Author's Style" toggle**: when enabled (§Phase A.2), the existing one-time world-seeding grounding request is extended with one additional field in the same response — it does **not** fire a second call. The model researches the named author's prose conventions and returns a `narration_style_profile`: a *descriptive* summary of sentence-length variance, tense/POV convention, diction register, recurring imagery motifs, and dialogue tendencies. This is explicitly a style guide for emulation, never a request to quote, paraphrase closely, or reproduce the author's actual text — the returned field is a set of craft parameters ("long compound sentences with embedded clauses," "close third person, present-tense flashbacks," "spare, understated dialogue"), not sample prose.
* **Enforcement.** The active Narration Style text is injected as a labeled line in the JIT context slice every turn (alongside Target Prose Depth), and §7.2's System Instructions gain an explicit rule that this line governs voice for that turn — narrative content rules (§4.1–4.3) still apply underneath it; style shapes *how* those rules are executed, not whether they apply.
* **Mid-campaign override.** The player can edit or replace the active Narration Style at any point from the Settings Drawer (§6.4E) — in-story, not just at creation. Changes apply to the **next turn onward only**; already-generated turns are never retroactively rewritten, the same non-retroactive philosophy already used for Class Evolution in §5.1b. A style change mid-campaign can even be a deliberate narrative beat (e.g., shifting from a measured voice to a fractured one after a DESPAIR-tier event) rather than purely a settings tweak.

---

## 5. Game Components & Mechanics Specifications

### 5.1 Attributes, Derived Pools & Combat Math

* **Six stats, one rule.** Only three — Strength ($STR$), Intelligence ($INT$), Agility ($AGI$) — are ever allocated directly (creation, §Phase B.1; level-ups, §5.1a). The other three — HP, MP, ST (Stamina) — are **always derived**, never entered or tracked as independent growth targets:

$$HP_{max} = HP_{base} + (STR_{eff} \times k_1) + HP_{bonus}$$
$$MP_{max} = MP_{base} + (INT_{eff} \times k_2) + MP_{bonus}$$
$$ST_{max} = ST_{base} + (STR_{eff} \times k_3) + (AGI_{eff} \times k_4) + ST_{bonus}$$

  **Universal constants (apply to every class, never tuned per-class):** $HP_{base}=20$, $MP_{base}=10$, $ST_{base}=15$, $k_1=2.5$, $k_2=2.0$, $k_3=1.0$, $k_4=1.5$. $STR_{eff}/INT_{eff}/AGI_{eff}$ are the attribute's allocated value (creation + level-ups) plus any flat attribute bonus currently active; $HP_{bonus}/MP_{bonus}/ST_{bonus}$ are flat pool bonuses that don't route through an attribute at all. Both bonus channels are defined in §5.1c — **STR/INT/AGI (with any bonus already folded in) plus this one formula is the only path to a resource pool number; nothing ever writes to HP/MP/ST max directly.**
* **No rolls, no checks, no randomness anywhere in the system.** All action outcomes are either:
  1. **Combat** — deterministic, computed client-side from the formulas above plus weapon/skill base values, before the prompt is sent; Gemini narrates only, or
  2. **Non-combat (SOCIAL / EXPLORE / STEALTH / INSIGHT / etc.)** — resolved purely narratively by Gemini, bounded by existing state (NPC trust tier, faction standing, world flags) rather than by any hidden number.
* Weapon and skill base damage values are intentionally left open/flexible rather than a fixed master table — narratively grounded per item/skill as introduced, not pre-specced (see §8).

### 5.1a Attribute Growth: Class Weight Vectors (Generalized System)

Rather than a bespoke, hand-tuned growth table per class — which doesn't scale once the roster grows beyond a handful — attribute growth is generalized into a **universal per-level point budget** split by a **class weight vector**. This is what makes adding new classes (Assassin, Warrior, Dragon Rider, and anything future) a one-line data change rather than a rebalancing exercise.

* **Universal constants:** `level_budget = 4` attribute points per level-up, `starting_pool = 32` points distributed at character creation. Same for every class.
* **Class definition = a normalized weight vector** where `STR + INT + AGI = 1.0`. This is the balance guarantee: every class gets the same total attribute budget over the same number of levels, just shaped differently — no class can be secretly stronger by design, only differently specialized.
* At level-up: `stat_gain = level_budget × weight_vector`, applied cumulatively on top of the existing total.
* **Level-up trigger — Milestone Leveling, not a hidden XP economy.** Earlier drafts referenced "Level" throughout (the JIT context slice, the sample pool table below) without ever specifying what causes one — worth closing explicitly rather than leaving implicit. Tale Dives ties leveling to story progress the schema already tracks, not a separate per-kill point tally the model would have to compute or the client would have to hide-and-reveal:
  * **+1 level** on every `quest_update` reaching `status: "completed"` for a Main or Side quest (Secret quests excluded by default — tune in §8 if that's wrong for a given campaign's pacing).
  * **+1 level** at every Chapter Milestone boundary (§2 Phase E), independent of quest completions that chapter.
  * Both checks are pure client-side comparisons against fields the schema already emits (`quest_update`, chapter boundary detection) — **0 extra tokens, no new schema field.** The model never states or requests a level; it only completes quests and reaches chapter boundaries in the course of normal narration, and the client derives leveling from that, the same "client owns the number, model narrates the fiction" split used everywhere else in this system.
  * On level-up, the client applies `stat_gain` above, recomputes derived pools per §5.1c's recompute rule, and surfaces a short UI toast/banner — not a narrated event, same treatment as a Codex Discovery reveal (§5.12) or a Class Evolution (§5.1b).
* Classes live as flat JSON entries in the same local static-dictionary pattern already used for location nodes and items (Phase C) — no new code path per class:

```json
{ "id": "warrior",      "weights": { "STR": 0.60, "INT": 0.10, "AGI": 0.30 } }
{ "id": "assassin",     "weights": { "STR": 0.15, "INT": 0.15, "AGI": 0.70 } }
{ "id": "dragon_rider", "weights": { "STR": 0.35, "INT": 0.30, "AGI": 0.35 } }
{ "id": "dark_monarch", "weights": { "STR": 0.55, "INT": 0.20, "AGI": 0.25 } }
{ "id": "necromancer",  "weights": { "STR": 0.20, "INT": 0.55, "AGI": 0.25 } }
{ "id": "summoner",     "weights": { "STR": 0.15, "INT": 0.45, "AGI": 0.40 } }
{ "id": "mage",         "weights": { "STR": 0.05, "INT": 0.70, "AGI": 0.25 } }
{ "id": "tank",         "weights": { "STR": 0.70, "INT": 0.05, "AGI": 0.25 } }
{ "id": "paladin",      "weights": { "STR": 0.40, "INT": 0.40, "AGI": 0.20 } }
```

The roster is genuinely open-ended — any future class is just one more line here, validated to sum to 1.0. Mage pushes MP further than Necromancer, Tank pushes HP further than Dark Monarch, Paladin sits as a true STR/INT hybrid — the underlying formula in §5.1 never changes.

**Two class dictionaries, one schema.** This table is the **Preset Class Dictionary** (bundled, zero-token, curated). Player-typed classes resolved via §Phase B.2a's grounded call are written into a second, per-player **Custom Class Dictionary** using this exact same `{ id, weights }` shape (plus the extra `flavor_summary`/`suggested_quick_slots` fields captured at grounding time) — combat math, level-up budgeting, and Class Evolution (§5.1b) treat entries from either dictionary identically. The client checks Custom before Preset when resolving a `class_id` so a player's grounded "Windrunner" always resolves to their own researched vector, not a same-named preset.

Sample derived pools at Levels 1 / 15 / 30 under this system:

| Class | L1 (HP/MP/ST) | L15 (HP/MP/ST) | L30 (HP/MP/ST) |
| --- | --- | --- | --- |
| Warrior | 68 / 16 / 49 | 152 / 28 / 107 | 242 / 40 / 170 |
| Assassin | 32 / 20 / 53 | 52 / 36 / 121 | 75 / 54 / 193 |
| Dragon Rider | 48 / 30 / 42 | 98 / 62 / 92 | 150 / 98 / 145 |
| Dark Monarch | 65 / 22 / 45 | 140 / 46 / 96 | 222 / 70 / 152 |
| Necromancer | 35 / 46 / 33 | 65 / 106 / 66 | 95 / 172 / 100 |
| Summoner | 32 / 38 / 40 | 52 / 90 / 80 | 75 / 144 / 126 |

### 5.1b Class Evolution (Single-Slot, Story-Driven)

Tale Dives protagonists carry **exactly one active class at a time** — no locked second axis, no permanently-tracked parallel identity. Earlier drafts of this system used two independent axes (a fixed "Summoning School" plus an unlockable "Combat Style") to let a character's identity change mid-story; that turned out to be solving a problem the derived-pool formula (§5.1) doesn't actually have. Since HP/MP/ST are already fully derived from STR/INT/AGI, a class is really just "the shape attribute points take as they're earned" — one slot that can change is simpler than two slots that blend, and gets to the same story beats.

* **Evolution reuses Class Grounding, unchanged.** A class can change mid-campaign — Violet moving from Apprentice Scribe to Rider (Appendix A) is the canonical example — through the exact same single grounded call already defined at creation (§Phase B.2a), fired again when a story trigger occurs: a completed quest, a world flag, a specific NPC bond. This reuses the existing `quest_update`/`flag_add` schema fields (§7.3) and the same Class Assignment Schema — no new mechanic type, no new call shape.
* **The new class replaces the old one outright.** There's no averaging or blending vector to maintain. The player's single class slot is updated, and the Class Confirmation card (§Phase B.2a) appears again so the player can Accept / Reroll / Edit Manually / decline exactly as they could at creation.
* **Non-retroactive, same principle as before.** Attribute points already earned under the old weight vector are never recalculated — the character's stat history stays exactly as played. Only points earned from the evolution turn forward use the new class's vector (§5.1a's `stat_gain = level_budget × weight_vector` formula, just re-pointed at a new vector going forward).
* **Quick-Slots refresh, not reset.** [CUT BY USER] On evolution, the Quick-Slot Tray (§6.4C) offers to re-populate from the new class's `suggested_quick_slots`; any slot the player had customized is left alone unless they accept the refresh.
* **Manual evolution.** A player can also trigger this from Codex CRUD (Character Sheet / Skills) without waiting for a story trigger — the same "steer state directly" philosophy already established for auto-logged entries (§5.10) and Codex Discovery (§5.12).
* **UI note.** The Chronicle surfaces an evolution as a distinct narrative beat (a banner/toast, not a silent stat change) — the same treatment principle as a Codex Discovery reveal (§5.12), just for the character sheet instead of the Codex.

### 5.1c Direct Stat Modification (Items & Events)

Beyond level-up allocation (§5.1a), any of the six stats (§5.1) can also move via items or story events — and every path is client-computed, deterministic, and Shadow Referee-validated (§3.2), same as everything else in this system:

* **Two flat bonus channels, both additive, no multipliers:**
  1. **Attribute Bonus** (STR/INT/AGI) — from equipped gear or a permanent event grant. Feeds straight into the §5.1 formulas as part of $STR_{eff}$/$INT_{eff}$/$AGI_{eff}$, so HP/MP/ST recompute automatically — no separate mechanic needed for these three.
  2. **Pool Bonus** (HP/MP/ST) — from items/events that boost a resource cap directly without being modeled as a raw attribute (a vitality charm, a blessing that just says "+15 Max HP"). Added on top of the formula as $HP_{bonus}$/$MP_{bonus}$/$ST_{bonus}$.
* **Equipment source (0 tokens).** Item entries (§5.9) may carry an optional `stat_bonus` object — `{"STR":2}` or `{"hp_flat":15}` — applied or removed by the client the instant the item is equipped/unequipped. This is a local lookup against data the client already holds; it never touches the API.
* **Event/narrative source (compact schema field).** A turn can narrate a permanent stat grant — a blessing, a hard-won transformation, a scar that costs something — carried in a minimal schema field, `stat_grant` (§7.3): `{"attr":"STR","amount":2}` or `{"pool":"hp","amount":15}`. Same minimal-field philosophy as every other delta (§3.6) — Gemini supplies the fact and the amount; it never computes the resulting max itself.
* **Recompute rule (Shadow Referee, §3.2).** Any time an attribute or pool bonus changes — level-up, equip/unequip, or `stat_grant` — the client immediately recomputes all three max pools from §5.1's formula and reclamps current HP/MP/ST: if a max increases, current increases by the same delta (no free top-off); if a max decreases (e.g. unequipping a bonus item), current is clamped down to the new max, never below 0. This is the same clamping rule §3.2 already applies to ordinary combat deltas, not a new validation system.

### 5.1d Combat Resolution Mode (Tactical vs. Narrative)

Everything in §5.1–§5.1c assumes combat is resolved by formula. That's the right default for a game about stat growth and gear — but some stories genuinely want a scene, or a whole campaign, where a stated tactic or an awakened power should be able to matter more than the sheet: outmaneuvering a stronger enemy through cleverness, a scholarly character improvising a way to survive a fight she was never built for (Appendix A), a climactic moment where raw numbers shouldn't be the point. Rather than force one philosophy, **Combat Resolution Mode is a player setting with two values:**

* **Tactical (default).** Combat works exactly as specified everywhere else in §5: the client precomputes the exchange from derived stats before the prompt is sent (§2 Phase D.2), Gemini narrates that exact result (§3.2, §4.1 Numeric Fidelity), and the Shadow Referee overwrites any mismatch. Unchanged from every prior revision of this spec.
* **Narrative.** A COMBAT turn is resolved the way SOCIAL/EXPLORE/STEALTH turns already are (§5.1): no client-precomputed number, Gemini narrates an outcome bounded by context — established power, stated tactics, the target's actual defenses per the [ACTIVE CONTEXT SLICE] — rather than by a hidden check or a formula. The player can still see and use stat-derived numbers (HP/MP/ST still exist, still gate what's affordable per §3.2's Skill Affordability check), but the *outcome* of an exchange isn't forced to match a precomputed value.

**Where the setting lives.** Chosen at Protagonist Creation (§Phase B, default Tactical) and editable at any time from the Settings Drawer (§6.4E) — a full-campaign default — plus a **per-scene override** via the `!` command manager (§6.6: `!narrative_combat` / `!tactical_combat`), since the whole point is that some individual encounters want the other mode without a permanent setting change. A per-scene override reverts to the campaign default at the next chapter boundary unless the player sets a new one, so a one-off climax doesn't silently change how every future fight resolves.

**Narrative Mode doesn't mean unvalidated.** The Shadow Referee still applies bounds, just softer ones than Tactical Mode's exact-match overwrite (§3.2's new Narrative Delta Bounds rule): `deltas.hp/mp/st` are still clamped to `[0, max]` as always, and a delta whose magnitude exceeds a tunable share of the relevant max pool in one turn (§8) is soft-capped rather than blindly accepted — this catches a wildly hallucinated number without reintroducing a formula the player just opted out of. HP reaching 0 still routes to Player Defeat State (§5.7) in either mode.

**Adversary stats become optional flavor, not a requirement, in Narrative Mode.** §5.13's auto-registered stat blocks are still generated (cheap, and useful for the Bestiary regardless of mode), but a Narrative-Mode encounter doesn't need them to resolve — they're reference data for the player and a fallback if the campaign switches back to Tactical mid-story, not an input the client has to compute against every turn.

**Context slice addition (every COMBAT-eligible turn):**
```
Combat Resolution Mode: TACTICAL
```
This is the only prompt-side change — everything else about how the setting behaves is client-side logic, per §3.6's rule that mechanism stays out of `nar`.

### 5.2 Four-Tier Currency Engine (Base Copper Storage)

To prevent currency math hallucinations, React stores total wealth as a single base copper integer ($c_{\text{total}}$):

$$1\text{ Platinum (P)} = 100\text{ Gold (G)} = 10,000\text{ Silver (S)} = 1,000,000\text{ Base Copper (C)}$$

* Gemini only emits net copper deltas (e.g., `"c": 15000` for $+1.5\text{ Gold}$).
* Client side automatically displays metallic badges: `1P 25G 50S 0C`.

### 5.3 Three-Branch Summoning & Minion Engine

These are class-specific ability kits (§Phase B.2), not a mandatory first choice — a player only has access to one of these if their active class actually grants it, whether that's a preset pick or a Class Evolution result (§5.1b). A scholarly class like Apprentice Scribe has none of these until, or unless, evolution moves the character into one.

1. **Dark Monarch (Shadow Extraction)**: Requires specific slain boss tags (`"corpse_add": ["rift_stalker"]`). Player executes `/arise` to extract shadow units into a persistent army.
2. **Classic Necromancer (Reanimation)**: Uses ambient commodity counters (`bone_dust: 12`). Spends MP + 1 Bone Dust to animate skeletal infantry via `/raise_skeleton`.
3. **Contract Gate Summoner (Planar Gates)**: Zero corpses required. Calls elemental or celestial familiars via `/summon`, spending initial MP plus minor turn-by-turn MP upkeep (`mp_upkeep: 2`).

### 5.4 5-Tier Faction Reputation & Rivalry System

* **Standings**: Tier -2 (Hostile), Tier -1 (Suspicious), Tier 0 (Neutral), Tier +1 (Favored), Tier +2 (Allied).
* **App-Side Rivalry**: Gaining standing with a faction (e.g., `Shadow Guild`) automatically decreases standing with its rival (`Holy Order`) in local React state without consuming LLM tokens.

### 5.5 Romance & Key Contact Memory Engine

* **Proximity Slicing**: Memory blocks for an NPC are **only injected into context when present at the active location node**. Absent NPCs cost **0 tokens**.
* **Metrics**: `affection` (0–100), `trust` (0–100), `stage` (`Stranger` → `Beloved`).
* **Deed Array & Micro-Memory**: Snake_case deed tags (`["saved_brother", "gifted_pendant"]`) paired with a single 15-word summary (`"Grateful for saving her brother; touched by the obsidian pendant."`).

### 5.6 World Impact Ledger (`flag_add`)

Major choices append persistent snake_case flags to local state (`["burned_basgiath_bridge", "spared_archive_guard"]`). Regional flags are re-injected into context whenever the player visits related locations.

### 5.7 Player Defeat State

When HP reaches 0, the turn is forced into a client-triggered `DESPAIR`-tier resolution turn rather than an ordinary combat turn: the client supplies Gemini with a fixed "defeat" context (no further damage math needed) and the narrative resolves to one of a small set of defined outcomes — e.g. waking at the nearest safe node with an inventory/currency penalty, or a scripted narrative consequence for boss/story fights. Recommend deciding this per-encounter-type up front rather than leaving it generic, since permadeath vs. soft-fail changes how you'll want to tune combat damage.

### 5.8 Crafting & Resource Management (Timestamp-Based)

Crafting is fully client-resolved — like currency and faction rivalry, it costs **0 API tokens** to run. Gemini's only involvement is optional flavor narration when the player collects a finished item; it never decides whether a craft succeeds, what it costs, or when it's ready. This uses the Day/Time clock already tracked in every turn (`time: {d, h}`) rather than introducing a new pacing system.

**Materials as inventory, not a separate system.** Raw ingredients (ore, herbs, hides, bone dust, etc.) use the same `inv_add`/`inv_rem` schema fields already defined (§7.3) — no new schema is needed. Item entries in the local static dictionary (Phase C) simply carry a `"type": "material"` tag to distinguish them from equipment/consumables in the UI.

**Recipe Dictionary** — a new local static dictionary, following the same pattern as location nodes and items:

```json
{
  "id": "recipe_steel_sword",
  "output": { "id": "steel_sword", "qty": 1 },
  "ingredients": [
    { "id": "iron_ore", "qty": 3 },
    { "id": "coal", "qty": 1 }
  ],
  "station_required": "forge",
  "craft_hours": 4
}
```

**Crafting Queue** — per-player local state, not sent to Gemini:

```json
{
  "job_id": "job_0007",
  "recipe_id": "recipe_steel_sword",
  "station_loc_id": "loc_ashgate_forge",
  "start_time": { "d": 2, "h": "14:00" },
  "complete_time": { "d": 2, "h": "18:00" }
}
```

**Resolution algorithm (runs client-side, every turn, before the prompt is compiled):**

1. **On queueing**: Shadow Referee validates ingredients are held and (if required) the player is at the correct station — exactly the same check pattern as skill affordability (§3.2). If valid, ingredients are deducted **immediately** (not on completion) to prevent a queue-then-cancel exploit, and a job is added to the queue with `complete_time = current_time + craft_hours`.
2. **Every subsequent turn**: compare current `time` against each queued job's `complete_time`. Once elapsed, the output item is added to inventory and the job is marked complete — this happens regardless of whether the player is nearby, so waiting doesn't require sitting at the forge.
3. **Narration hook**: if the player is at or returns to `station_loc_id` with a job that completed since their last visit, the context slice includes a one-line note (e.g. `Craft Ready: >Steel Sword< sits cooling on the anvil.`) for Gemini to narrate naturally on that turn. If the player is elsewhere, completion surfaces as a silent UI toast/badge instead — no token spent narrating an empty room.
4. Recommend 1 concurrent crafting slot by default; additional slots make a natural progression reward (or a hook for an Artisan/Tinkerer-style class using the same weight-vector system from §5.1a — crafting speed or slot count could scale off INT, the same way HP/MP/ST already scale off STR/INT/AGI).

**Resource management, using the same timer mechanic in reverse:** flag select materials as `"perishable": true` with a `spoil_hours` value in the item dictionary. Checked the same way as craft completion each turn — once `spoil_hours` elapses since acquisition, the item is silently removed or downgraded. This gives hoarding real stakes (can't stockpile rare reagents indefinitely) without adding a second engine — it's the identical timestamp-comparison logic already built for crafting completion, just running the other direction. Recommend also a simple per-material stack cap (e.g. 99) to keep the Materials view from growing unbounded, enforced the same way inventory sanity-checks already are.

**UI placement — finalized in v1.7**: Crafting gets its own Codex category, **Craft** (§6.4D, category 10). Folding it into "Items" was the original either/or option, but Items already carries 7 item-type filters (§5.9) — a crafting station screen with queued jobs and a live countdown (`complete_time − current_time`, styled in the JetBrains Mono metadata typeface used for timestamps elsewhere) reads more clearly as its own category than as an eighth filter bolted onto an already-dense one.

### 5.9 Item Type Taxonomy

Earlier drafts used a loose free-text `category` field on inventory entries. This is now a **closed enum**, referenced identically by the Codex UI (Items filters), the Shadow Referee's inventory sanity check (§3.2), and the crafting system's `type: "material"` tag (§5.8):

| Type | Slot Behavior | Examples |
| --- | --- | --- |
| **Weapon** | Equippable, 1 active at a time (or per-hand if dual-wield is enabled later) | `>Obsidian Dagger<`, `>Rift Stalker Fang<` |
| **Armor** | Equippable, one per body region (head/chest/hands/feet — start with a single "armor" slot and split later if needed) | `>Ashgate Plate<`, `>Wraithveil Cloak<` |
| **Accessory** | Equippable, 1–2 slots (rings/amulets/trinkets) | `>Obsidian Signet<`, `>Pendant of Quiet Steps<` |
| **Tool** | Non-combat equippable/usable; enables an action class rather than dealing damage (lockpicks, climbing gear, a crafting instrument) | `>Thieves' Picks<`, `>Surveyor's Lens<` |
| **Key Item** | Non-stackable, cannot be sold or discarded, tied to quest/story logic | `>Ashgate Vault Sigil<` |
| **Consumable** | Stackable, single-use, applies an immediate effect and is removed on use | `>Elixir of Vigor<`, `>Bone Dust Pouch<` |
| **Material** | Stackable, used only as crafting input (§5.8); never equippable | `iron_ore`, `bone_dust` |

**Schema note**: `inv_add` / `inv_rem` entries (§7.3) gain an implicit type via the item's Codex definition, not a per-turn field — Gemini still only emits `{ "id", "qty" }`, keeping the JSON schema unchanged. The client resolves `id → type` against the Codex's Items dictionary (or flags it as an ungrounded item for Shadow Referee review if the `id` is new — same pattern as Location Auto-Registration in §5.11).

**Stat bonus note**: Weapon, Armor, and Accessory entries may additionally carry an optional `stat_bonus` object in their Codex definition — `{"STR":2}` or `{"hp_flat":15}` — per §5.1c. This lives on the item, not the turn schema; the client applies/removes it purely by comparing equipped-item state before and after, at equip/unequip time, at zero API cost.

### 5.10 Location Auto-Registration

A recurring failure mode in earlier builds: Gemini narrates a location by name (`loc_disp`) that was never seeded into the Codex, leaving the player with a place they visited but can't look up later. This is now a client-side guarantee, not a narrative instruction:

1. Every turn response includes `loc_id` and `loc_disp` (already required fields, §7.3).
2. Before rendering, the client checks `loc_id` against the Locations codex. If it's missing, the client **auto-creates a stub entry** immediately — `name: loc_disp`, `region: <parent region if inferable from loc_id namespacing, else "Unmapped">`, `description: "(Auto-logged — visit again or add detail manually.)"`, `dangerLevel: "Unknown"`, `factionOwner: null`, `standing: "neutral"` — using the same CRUD write path a manual Codex edit would use.
3. The stub is flagged `autoLogged: true` so the Codex UI can visually mark it (e.g. a small "auto" badge) and the player knows it may want manual cleanup — CRUD editing (§6.4D) is always available for correction.
4. This closes the gap without adding any new schema field or extra API call — it is pure client-side reconciliation of a field the schema already required. This is the original, implicit case of the general pattern stated once in §5.14 — Locations also get a second, explicit registration path via `{{Term|loc}}` keyword links (§4.2) if Gemini names one outside the required `loc_id`/`loc_disp` fields (a place mentioned in passing, not yet visited).

### 5.11 Faction-Owned Locations & Territory Standing

Locations may now optionally carry a `factionOwner` (a Faction Codex entry) and derive a `standing` from the existing 5-Tier Faction Reputation system (§5.4) rather than tracking a second, separate reputation number:

| Faction Rep Tier (§5.4) | Derived Location Standing | Access Implication |
| --- | --- | --- |
| Tier +2 (Allied) / Tier +1 (Favored) | **Friendly** | Open access, PEACE/SOCIAL/EXPLORE turns as normal; may unlock faction-exclusive dialogue or vendors. |
| Tier 0 (Neutral) | **Neutral** | Open access, standard turn states, no special gating. |
| Tier -1 (Suspicious) / Tier -2 (Hostile) | **Hostile** | Open approach is narratively contested — guards challenge, patrols intercept. The client routes the active turn's suggested action pills and system instruction context toward **STEALTH** as the expected approach rather than free PEACE/EXPLORE movement; the player can still attempt an open approach, but Gemini is instructed to narrate realistic resistance bounded by the same Trust/Reputation-gating pattern already used for SOCIAL turns (§3.2), not a hidden check. |

**Implementation notes:**
- `standing` is a **derived, not stored**, value — it's recomputed client-side from `factionOwner`'s current reputation tier every time the location is loaded into the JIT context slice (§3.1), so a faction-rep change (via `flag_add`/reputation deltas) automatically updates every location it owns with zero extra tokens or schema fields.
- Locations without a `factionOwner` (independent/contested territory) default to `neutral` standing and behave exactly as in prior revisions.
- The JIT context slice for a Hostile-standing location gains one line: `Territory Standing: HOSTILE (Shadow Guild) — stealth approach advised.` — this is the only prompt-side change; all gating logic otherwise lives client-side per the Shadow Referee pattern.
- Codex UI (§6.4D, Locations category) surfaces `factionOwner` and the derived `standing` badge (green/gray/red) directly on each location card, and both fields are editable via CRUD for manual correction (e.g. after a story event flips control of a location outside the reputation system).

### 5.12 Codex Discovery System ("Fog of Lore")

Campaign seeding (Phase C, and the deferred grounding call in §Phase A.2) intentionally populates the Codex with **more** lore than Turn 1 needs — secondary NPCs, faction secrets, distant locations, backstory the protagonist hasn't confronted yet. That depth is worth having (it's what makes later reveals feel earned rather than improvised), but it shouldn't all be readable from the Main Menu before the story gets there. Every Codex entry (§6.4D) carries a `discovery` object:

```json
"discovery": {
  "state": "known",
  "reveal_condition": "flag:met_mira_sorrengail",
  "reveal_trigger_type": "flag",
  "teaser": "A name spoken with unease in the mess hall."
}
```

* **`state`**: `"known"` (fully visible) or `"hidden"` (masked). Entries seeded as directly relevant to the opening scene (§Phase B.4's Tale Dive Brief) default to `known`; peripheral lore defaults to `hidden`.
* **`reveal_trigger_type`**: one of `flag` (a `flag_add` value, §5.6), `location_visit` (a `loc_id`), `npc_met` (first `npc_mem_up` contact for an `npc_id`), `quest_complete` (a `quest_update` reaching `completed`), or `manual` (only the player, via CRUD, ever reveals it — used for entries with no clean narrative trigger).
* **`teaser`** *(optional, ≤10 words)*: a short line shown even while hidden, so a masked card reads as an inviting mystery rather than a dead slot.
* **Zero-token reveals.** Exactly like Location Auto-Registration (§5.10) and Faction Standing (§5.11), reveal checks run entirely client-side, every turn, against fields the turn response already contains (`flag_add`, `loc_id`, `npc_mem_up`, `quest_update`) — there is no new LLM call and no new schema field on the turn response itself. When a check passes, the client flips `state` to `known` and fires a short client-side toast ("Codex Updated: Mira Sorrengail") — the model never has to narrate the unlock as an event.
* **Seeding validation (Shadow Referee pattern, §3.2).** The one-time grounding call may suggest a `discovery` block per entry it generates, but the client validates every `reveal_condition` references a real flag/location/NPC/quest id that actually exists in the seeded set before accepting it as anything other than `manual`. A condition that can't be validated fails open to `state: "known"` rather than shipping an entry the player can never unlock — an unreachable hidden entry is a worse bug than an entry revealed a little early.
* **CRUD Edit Mode is the exception to masking.** Inside Codex CRUD (§6.4D), every entry — hidden or not — shows its full content, its current `discovery.state`, and an editable `reveal_condition`/`reveal_trigger_type`, so the player (or a returning player debugging their own save) can hand-author or fix discovery logic exactly like any other Codex field. This is the same "steer state directly rather than through the LLM" philosophy already established for auto-logged entries (§5.10).

### 5.13 Adversary Stat Blocks & Auto-Registration

A gap worth closing explicitly: §5.1's combat math requires an enemy HP pool and damage value to compute a deterministic result *before* the prompt is sent (§2 Phase D.2) — but nothing earlier in this spec defines where an enemy's stats actually come from. Weapon/skill base values are deliberately left open (§5.1/§8) because the player already owns those and a human can eyeball a reasonable number; enemies need the same treatment, applied automatically, since the player can't be expected to stat-block every monster Gemini introduces.

* **Adversary entries are a Codex-backed local dictionary**, same flat-JSON pattern as locations and items (Phase C): `{ "id": "rift_stalker", "hp_max": 40, "dmg_base": 12, "threat_tier": "elite", "corpse_tag": "rift_stalker" }`. `threat_tier` (`minor` / `standard` / `elite` / `boss`) is what actually drives the numbers — see below — not a hand-tuned value per monster.
* **Auto-registration mirrors Location Auto-Registration (§5.10) exactly — both are instances of the general pattern in §5.14.** When Gemini's narration introduces a combat-capable adversary not yet in the local dictionary, the client stubs one in immediately using the same reconciliation pattern: infer `threat_tier` from context (a named boss vs. an ambient "guard"), assign baseline `hp_max`/`dmg_base` from a small tier table scaled to the player's current level (so a `minor` adversary never trivializes nor a `standard` one one-shots a fresh character), and flag it `autoLogged: true`. No extra API call, no new schema field on the turn response — this reads the same `nar`/`act` text the client already receives, the way Location Auto-Registration reads `loc_disp`.
* **Combat math then proceeds exactly as §5.1/§3.2 already specify**: the client computes the exchange between player and stubbed adversary stats before the prompt is sent, Gemini narrates the given result only, and the Shadow Referee overwrites any `deltas` mismatch — this section only fills in *where the enemy number came from*, it changes nothing about how combat is resolved once both sides have one.
* **Codex placement**: a new category, **Bestiary** (§6.4D, category 11) — encountered adversaries, their tier, and (for repeat/boss-type enemies worth remembering) a short flavor note. A first encounter with a new adversary type is a natural fit for Codex Discovery's `npc_met`-style reveal pattern (§5.12) — the entry can seed `hidden` with a teaser and flip to `known` on first combat contact, giving the Bestiary the same "fill in as you play" feel as the rest of the Codex.
* **CRUD applies identically**: a player can hand-correct an auto-logged adversary's tier or stats exactly like an auto-logged location (§5.10), for the same reason — the client's inferred stub is a reasonable default, not a guaranteed-perfect one.

### 5.14 Universal Codex Auto-Registration & Keyword Links

§5.10 (Locations) and §5.13 (Adversaries) are both specific cases of one general rule, stated once here: **whenever Gemini's narration references an entity the client doesn't yet have a Codex entry for, the client stub-creates one immediately, flags it `autoLogged: true`, and moves on** — the Codex is something the game fills in as it's played, never something the player has to pre-build or the model has to explicitly "generate into." This is how content ends up in the Codex at all, alongside the one-time bulk seeding a grounding call does at creation (§Phase A.2, §5.12).

Two trigger surfaces feed this, and a turn can use either or both:

* **Implicit, via required schema fields already sent every turn.** `loc_id`/`loc_disp` for Locations (§5.10); `corpse_add` and combat context for Adversaries (§5.13). Nothing new here — this is what those two sections already specify.
* **Explicit, via `{{Term|category}}` keyword links in `nar` (§4.2, new in v2.2).** This is what makes NPCs, Factions, Lore, and Quests work the same way Locations and Adversaries always have, and it's what powers the tappable Codex Popup Card (§6.4C):
  1. The client scans the streamed `nar` string for `{{Term|category}}` matches — pure client-side string parsing, the same free operation already required to render `[Skill]`/`>Item<`/`'Thought'` markup, so this adds no API cost (§3.6).
  2. For each match, the client resolves `Term` against that `category`'s Codex dictionary. A hit renders the tap target linked to the existing entry — respecting Codex Discovery masking (§5.12): if that entry is currently `hidden`, the popup shows the same `???`/teaser treatment the Codex Entry Grid would, never the real content early.
  3. A miss auto-registers a stub in that category, exactly like a Location or Adversary stub — reasonable inferred defaults, `autoLogged: true`, correctable via CRUD (§6.4D).
* **The model's only job is tagging, not deciding what belongs in the Codex.** §7.2's Rich Text Formatting rule tells Gemini to wrap a proper noun the first few times it's mentioned meaningfully (not every pronoun or repeat reference) — the client owns whether that becomes a new entry, an existing one, or gets left alone, the same "model proposes text, client owns state" split used everywhere else in this system.

---

## 6. UI/UX Design System Specification

### 6.0 Motion System — Framer Motion

All interactive UI motion runs through Framer Motion (`motion`/`AnimatePresence`), not raw CSS transitions, so timing and easing stay consistent across the whole app:

| Interaction | Pattern | Notes |
| --- | --- | --- |
| Screen-to-screen transitions (Title → Main Menu → Story Creation → Chronicle) | `AnimatePresence` cross-fade + slight vertical slide (`initial={{opacity:0,y:12}}`) | Exit animation completes before the next screen mounts, avoiding pop-in. |
| Card hover/tap (Story Creation cards, Codex entry cards, Library cards) | `whileHover={{scale:1.02}}` / `whileTap={{scale:0.98}}` | Subtle — this is a warm, high-sensory app, not a bouncy consumer UI. |
| Parchment turn entry | Fade + upward drift as each new `nar` block commits | Runs once per turn, independent of the typewriter streaming effect in §9.1. |
| Drawers / bottom sheets (NPC, World DB, Settings) | Spring physics (`type: "spring", damping: 22, stiffness: 260`) with a drag handle | Matches the native bottom-sheet gesture called for in §9.3. |
| Fantasy Radial Menu (§6.6) | Staggered spring expansion (`staggerChildren`) fanning out from the FAB | See §6.6 for full behavior. |
| Slash/Bang Command Palette (§6.7) | Height auto-animate as filtered results change, opacity fade on open/close | Keeps the palette from jumping as the result count changes per keystroke. |

Motion should always be interruptible (a fast second tap cancels/reverses an in-flight animation rather than queuing) and should respect `prefers-reduced-motion` by collapsing to instant opacity swaps.

### 6.1 Theme Palette & Visual Tokens

**Light mode, gold glassmorphism.** The app runs on a warm ivory/parchment base, not a dark obsidian one — gold is reserved for accents, borders, icons, and buttons, never for body text on a light background, since gold-on-light fails readability. All body copy uses the dark ink tone (`#2a241e`) regardless of which light surface it sits on.

| Element | Hex Color | Tailwind Equivalent | Role |
| --- | --- | --- | --- |
| **Ivory Canvas** | `#f8f4ea` | `bg-[#f8f4ea]` | Main app background |
| **Card Surface** | `#fdfaf0` | `bg-[#fdfaf0]` | Main cards, menu panels, Settings Drawer |
| **Ink (body text)** | `#2a241e` | `text-[#2a241e]` | Default body/paragraph text on every light surface — never gold |
| **Gold Primary** | `#9c7a2e` | `text-[#9c7a2e]` / `border-[#e2c275]` | Titles, Cinzel headers — deepened from decorative gold so header text stays AA-contrast on ivory |
| **Gold Accent (decorative)** | `#e2c275` | `border-[#e2c275]` / `bg-[#e2c275]/15` | Borders, glass tints, icon strokes, dividers — not for text |
| **Action Gold** | `#f0ca65` | `bg-[#f0ca65] text-[#2a241e]` | **RESUME** / **SAVE SETTINGS** primary buttons — dark ink text on the gold fill keeps this one AA-compliant |
| **Emerald Highlight** | `#0f5132` on `#dff3e8` | `bg-[#dff3e8] text-[#0f5132]` | **NEW SESSION** / status connectivity badges |
| **Aged Parchment** | `#e5d9c3` | `bg-[#e5d9c3] text-[#2a241e]` | Story Chronicle reader scroll box — deliberately a shade darker than Ivory Canvas so the reading surface still reads as distinct "paper" against the app chrome |
| **Parchment Header** | `#e0d3ba` | `bg-[#e0d3ba] text-[#5a4d3e]` | Parchment metadata status bar |
| **Prompt Input Tray** | `#fdfaf0` | `bg-[#fdfaf0] border-[#e2c275]/50` | Bottom action entry bar |

**Readability rule.** Every text/background pairing above targets WCAG AA (4.5:1 for body copy, 3:1 for large headers) — this is the one non-negotiable constraint on an otherwise flexible palette. If a future accent color is added, check it against Ink-on-light and Ivory-on-accent before shipping it, not after.

### 6.1a Glassmorphism Component Styling

Tailwind + glassmorphism is the default treatment for **floating/overlaying** surfaces — drawers, modals, the radial menu, the command palette, and toast notifications — layered on top of the Ivory Canvas background (§6.1) so depth reads clearly against the parchment/card layers beneath. Light-mode glass needs higher fill opacity than dark-mode glass to stay legible, so this is not a simple color swap of the old dark recipe:

```html
<!-- Standard glass surface utility class -->
<div class="backdrop-blur-xl bg-[#fdfaf0]/80 border border-[#e2c275]/40 shadow-[0_8px_28px_rgba(120,90,20,0.12)] rounded-2xl">
```

* **Base recipe**: `backdrop-blur-lg`–`backdrop-blur-xl`, background at 75–85% opacity of the Card Surface token (`#fdfaf0`) — noticeably higher than a dark-mode glass recipe would use, so body text (Ink, `#2a241e`) inside the panel stays AA-readable against whatever's behind it — a 1px gold-tinted border at 30–45% opacity (`border-[#e2c275]/40`), and a soft warm-toned shadow (not pure black) for lift.
* **Where it applies**: Radial Menu (§6.5), Slash/Bang Command Palette (§6.6), bottom-sheet drawers (§9.3), the Settings Drawer (§6.4E), the API Failure Diagnostics Panel (§3.5), and modal confirmations (delete/reroll/overwrite).
* **Where it does not apply**: the Parchment Story Canvas (§6.4C) stays fully opaque (`#e5d9c3`) — it's meant to read as physical paper, not glass, and mixing the two metaphors on the primary reading surface would hurt legibility on mobile screens in bright light.

### 6.1b Iconography — Lucide

All in-app icons use the `lucide-react` icon set for a single consistent stroke weight and style. This replaces the emoji placeholders used as shorthand elsewhere in this spec — the mapping below is the source of truth:

| Spec Shorthand | Lucide Icon | Used In |
| --- | --- | --- |
| 📁 Local Save badge | `FolderOpen` | Main Menu header (§6.4B) |
| ⚙️ Settings | `Settings` | Header bars, radial menu, command palette |
| ✨ New Session | `Sparkles` | Story Creation cards, Chronicle top strip |
| ⬇ Export | `Download` | Library cards, Load User Files panel |
| ⬆ Import | `Upload` | Dashed creation cards, Load User Files panel |
| Trash/Delete | `Trash2` | Campaign/Library card actions |
| NPC Directory | `Users` | Right drawer dock, Codex |
| World Map / Locations | `Map` | Right drawer dock, Codex |
| Chapter Summaries | `BookOpen` | Right drawer dock, Codex |
| Turn state badges | `Swords` (COMBAT), `Moon` (STEALTH), `Compass` (EXPLORE), `Eye` (INSIGHT), `MessageCircle` (SOCIAL), `Heart` (INTIMACY), `CloudFog` (DESPAIR), `Sun` (PEACE), `Pause` (PAUSE) | Turn Header Tags (§6.4C) |
| Radial Menu FAB | `Wand2` | Story View floating prompt (§6.5) |
| Quest Log shortcut | `ScrollText` | Radial menu (§6.5) |
| Inventory shortcut | `Backpack` | Radial menu (§6.5), Quick-Slot Tray area |
| Crafting shortcut (conditional) | `Hammer` | Radial menu (§6.5), Craft cards (§6.4D) |
| Character Sheet | `User` | Radial menu (§6.5) |
| Slash command trigger | `Slash` | Command palette header |
| Bang/system command trigger | `Terminal` | Command palette header |
| Faction standing | `ShieldCheck` (Friendly), `Shield` (Neutral), `ShieldAlert` (Hostile) | Location/Faction entry cards |
| Default selector (Library) | `Star` (filled = default) | World/Protagonist Library cards |
| Hidden/undiscovered entry | `Lock` | Codex entry cards (§5.12/§6.4D) |
| Bestiary | `Skull` | Codex category list (§6.4D) |

### 6.1c Mobile-First Copy Length

Menu titles, section headers, and nav labels stay short by rule, not by accident — this is a phone-first app, and long labels wrap, truncate, or crowd touch targets on narrow viewports:

* **Screen/drawer titles**: 1–3 words (`Main Menu`, `Codex`, `Settings`, not `Your Codex & World Database`).
* **Category/section headers**: ≤4–5 words (`Items`, `Quests`) — every existing category name in §6.4D already fits this.
* **Buttons & actions**: 1–2 words, verb-first where possible (`Resume`, `New Session`, `Save & Export`).
* **Where more explanation is genuinely needed** (a setting's effect, an onboarding hint), put it in a subtitle line or helper text at a smaller type size below the short label — never lengthen the label itself to carry the explanation.

### 6.1d Menu Chrome & Ornamentation

**Novel-fantasy, not sci-fi.** Concise labels (§6.1c) still need a visual frame, and the frame is where "elegant fantasy menu" is won or lost. Tale Dives explicitly avoids the modern-sci-fi UI vocabulary — no neon edge-glow, no angular/beveled corner-cut panels, no scanline or HUD-reticle motifs, no monospace-everything chrome. Instead:

* **Corners & framing**: generously rounded corners (`rounded-2xl`–`rounded-3xl`) on every card, drawer, and modal — reads as a bound book or leather journal, not a terminal window. Never a sharp/cut corner.
* **Dividers as flourishes, not rules**: where a hard `<hr>` would sit in a conventional app, use a thin gold hairline (`border-[#e2c275]/30`) centered under a small ornamental glyph (a diamond, a simple laurel sprig, or a stylized quill — one consistent glyph reused app-wide, not a different icon per divider) rather than a bare line. This is the single detail that reads as "storybook" instead of "settings panel."
* **Section headers get a mark, not a background fill**: a short Cinzel label with the divider glyph beneath it, rather than a colored header bar/pill — color-fill header bars are the most common sci-fi-menu tell.
* **Buttons**: rounded-pill or softly rounded-rect, gold fill or gold-outline on Card Surface, label only (§6.1c) — no icon-in-a-hexagon or icon-in-a-hard-edged-square badge treatment.
* **Iconography restraint**: Lucide icons (§6.1b) stay line-weight and unfilled by default, tinted Gold Accent — they should read as small engravings, not glowing UI widgets. Reserve a filled/solid icon state for the one thing that should draw the eye (e.g. the filled `Star` default selector, §6.1b).
* **Applies everywhere** cards, drawers, and modals appear: Main Menu (§6.4B), Codex (§6.4D), Settings Drawer (§6.4E), Radial Menu (§6.5), and the Slash/Bang Command Palette (§6.6) all share this chrome — a consistent "illuminated manuscript" register rather than each surface inventing its own framing.

### 6.2 Typography Hierarchy

* **Headers & Titles** (`Cinzel`, serif, weights 600/700/900): All main headings, campaign titles, turn numbers, button labels, and turn-state badges.
* **Narrative Prose** (`Lora`, serif, weights 400/500/Italic): Main story text, NPC dialogue, campaign descriptions, and player action inputs.
* **Metadata & System Codes** (`JetBrains Mono`, monospace, weights 400/500): Timestamps, day/time tracking, currency counters, stat pools, and model selection dropdowns.

```html
<!-- Font Imports -->
<link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@500;700;900&family=JetBrains+Mono:wght@400;500&family=Lora:ital,wght@0,400;0,600;1,400&display=swap" rel="stylesheet">
```

### 6.3 Application Metadata & About Modal Data

In the Settings / About Drawer:

* **App Developer**: Kemuel Avenido (Kem Ave)
* **Dedicated To**: Elisah Mirelle R. King (*My Avid Bookworm*)
* **Version**: Single Page Application 1.3 (Local-First + Provider-Agnostic LLM Engine, No-Roll Combat, Grounded Class Assignment)

### 6.4 Screen Views & Layout Components

**Terminology note (resolves v1.1 ambiguity):** session structure is standardized as **Session → Chapters → Turns**. The label "Tale #" is retired in favor of "Turn #" everywhere in the UI, matching the lifecycle terms already defined in §2.

#### A. Title Screen

The first thing the player sees on launch — a calm, deliberate entry point rather than dropping straight into the dashboard:

* **Backdrop**: full-bleed Ivory Canvas (`#f8f4ea`) with a slow-drifting field of soft gold motes (CSS/Framer Motion looped particles, low opacity, gold-tinted rather than bright white so they read against a light background), reinforcing the atmosphere before any UI chrome appears.
* **Center Stack**: the `TALE DIVES` wordmark in Cinzel 900, a short atmospheric tagline, and a single primary action — **`ENTER`** (or "tap/press any key") — that Framer-Motion cross-fades into the Main Menu Screen (§6.4B).
* **Continuation shortcut**: if a most-recently-played campaign exists in local save, a smaller **`▶ CONTINUE — <Campaign Title>`** ghost-button appears beneath `ENTER`, skipping straight to the Chronicle (§6.4C) for that campaign.
* **Footer**: developer credit ("Developed by Kem Ave"), dedication line, and version tag (§6.3), rendered small and low-opacity so they don't compete with the wordmark.

#### B. Main Menu Screen

Reached from the Title Screen's `ENTER`. This is the hub for everything that isn't "currently inside a story" — campaign management, world/protagonist libraries, and file I/O.

* **Header Bar**:
  * Left: App title (`TALE DIVES`), tagline ("Choose a tale, or begin a new one" — marketing copy only, not a session-structure term), developer credit.
  * Right: `FolderOpen` **Local Save** status badge (see spec below), a **Load User Files** quick-setting button (see below), and a `Settings` drawer button.
* **Story Creation — Cards Row**: the entry point into Phase A/B (§2), presented as a horizontal row of glassmorphic cards rather than a single "+" button, so the two creation modes are equally discoverable:
  * **Original Mode Card**: `Sparkles` icon, "Build a world from scratch," launches manual genre/tone/location setup (§Phase A.1).
  * **Inspired Mode Card**: `BookOpen` icon, "Adapt a novel or series," launches the title/author grounding flow (§Phase A.2) which also feeds context into Class Grounding (§Phase B.2a) later in the pipeline.
  * **Import Tale Card**: dashed gold border (`border-[#e2c275]/25`), `Upload` icon, `.json` helper text — imports a single previously-exported campaign save.
  * Existing **Active Campaign Card(s)**: campaign title, left vertical gold accent bar, synopsis, last-played timestamp, and action buttons **▶ RESUME**, **✨ NEW SESSION**, **⬇ EXPORT** (single-campaign `.json`), and `Trash2` (delete, with confirmation) — unchanged from prior revisions, just now sitting alongside the two mode cards instead of a generic "+".
* **World Library Panel**: every World created via Original or Inspired Mode (even ones not currently attached to an active campaign) is saved here as a selectable card — name, genre/source tags, World Background (§Phase A), and a short synopsis. Each card carries a `Star` **default selector**: marking a World as default pre-fills it on the next New Story flow, skipping re-entry of the same setting for a player running multiple campaigns/protagonists in one world. See **Appendix A** for a full worked World Library entry.
* **Protagonist Library Panel**: same pattern as the World Library, for saved protagonist presets (name, background, class/weight-vector, portrait placeholder, and the saved **Tale Dive Brief**, §Phase B.4) generated across past campaigns. Also carries a `Star` default selector, and an entry can be reused as a starting point for a new campaign (stats/class/brief prefilled, still editable) rather than rebuilding a character from zero. See **Appendix A** for a full worked Protagonist Library entry.
* **Load User Files — Quick Setting**: a single dedicated control (header button, opening a glassmorphic panel) that separates file I/O from the per-campaign Export button above, since libraries and defaults are cross-campaign data:
  * **Import/Export — Tales**: bundles one or more full campaign saves.
  * **Import/Export — World Library**: the full set of saved Worlds.
  * **Import/Export — Protagonist Library**: the full set of saved protagonist presets.
  * **Import/Export — User Defaults**: API Settings (§3.4, key excluded from export for safety), UI preferences, and the current default World/Protagonist selections.
  * Each category exports independently as its own `.json`, or the panel offers an **Export Everything** bundle. Writes go through the same `On-Device Folder` / `Browser Only` path described below, so the mechanism is identical to the existing per-campaign Export — this panel just exposes it for the library/default data that individual campaign cards don't cover.
* **Active Campaign Tools Toolbar**: 5-column grid for 1-tap navigation to Chronicle, Chapter Summaries, World Database, NPC Directory, and Master Archives (see distinction in §6.4D).

**Local Save status — resolves v1.1 ambiguity.** This is a status indicator, not a freely reversible toggle:
- **`On-Device Folder`**: available on browsers supporting the File System Access API (Chrome/Edge desktop). Saves write directly to a folder the player chose, surviving cache clears and visible in their OS file browser. Both per-campaign Export and the Load User Files panel use this same folder when available.
- **`Browser Only`**: the fallback everywhere else, including iOS/Android (no File System Access API support). Saves persist in `localStorage`/`IndexedDB` only — the UI should show a one-line warning that clearing browser data will erase progress, and should nudge toward using **Export** / **Load User Files** for backup on these platforms.

#### C. Chronicle Story Viewer (Aged Parchment Engine)

* **Top Navigation Strip**: quick-return button, active campaign title with book icon, ✨ NEW SESSION, MENU ▾ dropdown, Settings gear.
* **Parchment Header Bar**:
  * Chapter title (`CHAPTER I: THE BLOOD-STAINED PARAPET`), Day & Time (`DAY 1 • 08:15`), Location Node (`Ashgate Fortress — Upper Courtyard`).
  * Right: icon shortcuts to NPCs, World Map, Chapter Summaries, the active 9-Tier Turn State Badge, and a **page counter** (`1/3 ▾`).
* **Page counter — resolves v1.1 ambiguity.** This is a mobile-performance pagination unit, not a chapter or turn count: each "page" holds a fixed window of turns (recommend ~8–12) within the current chapter, and only the active page's turns are mounted in the DOM (see §9 virtualization). `1/3` means "page 1 of 3 pages of turns in this chapter," independent of the Turn # or Chapter # shown elsewhere.
* **Story Canvas**:
  * Parchment scroll view (`#e5d9c3`) with custom amber scrollbars (`.parchment-scroll`).
  * Turn Header Tags: `TURN #1 (Day 1 - 08:15)` plus environmental mood pills (`Cold mountain mist with swirling ash motes`).
  * Action Suggestion Pills: clickable choices (`➢ Inspect the keystone seal...`) rendered below narration.
  * **Codex Popup Card** *(new, v2.2)*: tapping any `[Skill]`, `>Item<`, or `{{Term|category}}` link (§4.2) opens a small glassmorphic (§6.1a) card anchored near the tap point — scale/fade in via Framer Motion (§6.0), never a full-screen navigation. It reuses the matching category's Entry Card fields from §6.4D (so an NPC popup shows the same Trust/Affection bars an NPC Entry Card would, a Location popup shows the same Danger/Standing badges, etc.) plus an **"Open in Codex →"** button that drills into the full Entry Detail (§6.4D) for anyone who wants more. A tap on a still-`hidden` entry (§5.12) shows the masked `???`/teaser card instead — the popup never spoils what the Entry Grid wouldn't show yet. Dismisses on outside-tap or a close affordance; the parchment scroll position is preserved underneath.
* **Right Drawer Vertical Icon Dock**: Card Surface styling (`#fdfaf0`, §6.1), positioned alongside the parchment reader. Features an `INFO` toggle, a Turns-in-page count badge, a Chapter Summaries count badge, and World DB / NPC Directory shortcuts.
* **Quick-Slot Tray** *(new, v1.7)*: [CUT BY USER] a persistent, always-visible horizontal row of the 3 equipped active skills (§Phase B.3), docked directly above the floating action-input prompt. This is deliberately **not** inside the Radial Menu (§6.5) — quick-slots are the single highest-frequency action in a turn loop, so they get a permanent one-tap surface rather than an extra tap through an expandable menu. Each slot shows its icon, name, and MP/ST cost, and dims (not hides) when unaffordable per the Shadow Referee's affordability check (§3.2).
* **Floating Action-Input Prompt**: the decorated bottom input bar (§6.1 Prompt Input Tray tokens) — this is where the player types actions, and where `/` and `!` (§6.6) trigger their respective command palettes. The Fantasy Radial Menu's FAB (§6.5) is centered directly above/on this prompt.
* **0-Token Delta & Currency Footer**: client-side status strip showing live pools (`HP 42/50`, `MP 18/30`, `ST 25/25`) and the metallic currency display (`1P 25G 50S 0C`) — both rendered entirely from local state, no API call involved.

#### D. Database & Codex Directory

**Three-level drill-down**, consistent across every category: **Category List → Entry Grid → Entry Detail**. The player never lands on a wall of text; each level narrows before showing full content, and Framer Motion (§6.0) animates the forward/back transition as a horizontal push rather than a hard cut, so the drill-down reads as spatial navigation rather than a page reload.

1. **Category List** (top level): the 10 categories below, each shown as a row with its Lucide icon (§6.1b), a live entry count (hidden entries count toward the total, so a "12" total hints there's more to find even before it's discovered), and a right-chevron. Tapping a row pushes into that category's Entry Grid. Lazy-loaded on drawer-open per §9.2 — none of this hydrates at session start.
2. **Entry Grid** (per category): a responsive grid/list of **Entry Cards** (templates below) — glassmorphic (§6.1a), each summarizing just enough to recognize and select the right entry. A search/filter bar sits above the grid (by name, and by category-specific filters — e.g. Locations filter by Danger Level or Faction Owner, Items filter by Item Type per §5.9). Entries with `discovery.state === "hidden"` (§5.12) render masked: name replaced with `???`, portrait/emblem replaced with a `Lock` glyph (§6.1b), and the card shows the entry's short `teaser` line if one was seeded, in place of its normal summary.
3. **Entry Detail** (drill-down target): the full record — every field the category tracks — plus CRUD actions (Edit/Delete) where applicable. Tapping into a hidden entry opens a minimal "??? — not yet discovered" detail rather than the full record; no fields beyond the teaser are exposed outside CRUD Edit Mode.

Categories:

1. Realm (Cosmology, Setting, Tone) — also surfaces the campaign's active Narration Style (§4.5) as a read-only field with a shortcut into the Settings Drawer (§6.4E) to change it, so the player never has to remember which drawer owns that setting.
2. **Chapters** — curated, chronological. One entry per chapter, populated from the 2-sentence Chapter Milestone summaries generated in Phase E (§2). This is the player-facing recap.
3. NPCs (Companions & Trust Ratings)
4. Factions (Political Cabals & Territory)
5. Locations (Regions, Danger Levels, Faction Owner & Standing — §5.11)
6. Skills (Spells & Abilities)
7. Items (Weapons, Armor, Accessories, Tools, Key Items, Consumables, Materials — §5.9)
8. Quests (Main, Side & Secret) — driven by the `quest_update` schema field (§7.3)
9. **Craft** — the crafting system (§5.8): known recipes, station requirements, and the live crafting queue with countdown.
10. **Bestiary** — encountered adversaries (§5.13): threat tier, stats, and flavor notes, filled in as the player fights new enemy types.

**Codex CRUD.** Every category above (except Plot Chapters, which is a generated recap, and Master Archives, which is a raw log) supports full Create/Read/Update/Delete via the UI — the player can add, edit, or remove any NPC, Faction, Location, Skill, Item, Quest, or Recipe by hand. This is the correction path for auto-logged entries (§5.10) and for any state the player wants to fix directly rather than steering the LLM toward. **CRUD Edit Mode also bypasses masking** (§5.12): every entry shows its full content regardless of `discovery.state`, plus an editable Reveal Condition control (trigger type + target flag/location/NPC/quest), so a player can hand-author discovery pacing exactly like any other field.

**Entry Card templates (Entry Grid level)** — each category gets a card shape suited to what players actually scan for, rather than one generic card reused everywhere. (Masked/hidden cards, §5.12, override all of this with the `???` + teaser treatment described above, regardless of category.)

| Category | Card Shows | Card Badge(s) |
| --- | --- | --- |
| NPCs | Portrait placeholder, name, current Stage (`Stranger` → `Beloved`) | Trust bar + Affection bar (0–100, §5.5), auto-logged flag if unmet-but-mentioned |
| Factions | Emblem placeholder, faction name, one-line description | Rivalry indicator (linked rival faction), current Reputation Tier (§5.4) as a −2..+2 pip strip |
| Locations | Name, region, one-line description | Danger Level, Faction Owner + derived Standing badge (green/gray/red, §5.11), `autoLogged: true` "auto" badge where applicable (§5.10) |
| Skills | Skill name, owning class icon | MP/ST cost pill, `[Active Skill]` glow styling matching in-narrative formatting (§4.2) |
| Items | Item name, Item Type icon (§5.9) | Rarity/type pill, equipped indicator if currently worn/wielded |
| Quests | Quest title, tier (Main/Side/Secret) | Status badge (`advanced`/`completed`/`failed`, §7.3), objective checklist preview |
| Craft | Recipe/output item name, station icon (forge/bench/etc.) | Live countdown badge if queued (`complete_time − current_time`, JetBrains Mono), "Ready" badge if complete and uncollected |
| Bestiary | Adversary name, threat tier icon | `autoLogged: true` "auto" badge where applicable (§5.13), boss/elite accent for higher tiers |
| Chapters | Chapter number + title, 2-sentence milestone summary | none — read-only recap |

All cards share the same glass surface recipe (§6.1a) and the same tap target — the whole card is tappable, pushing into Entry Detail, not just a "view" link.

**Plot Chapters vs. Master Archives — resolves v1.1 ambiguity.** These are deliberately different views over the same underlying log:
- **Plot Chapters** (above, in the Codex): short, curated, player-facing recap — what a reader would want to skim to remember the story so far.
- **Master Archives** (Launcher toolbar): the full raw, unfiltered turn-by-turn log, including every `nar` string ever generated. Intended as a debug/reference tool and for players who want to re-read a scene verbatim, not as the primary recap surface.

#### E. Settings Drawer (Pre-Campaign & In-Story)

One glassmorphic (§6.1a) drawer component, reused in two contexts — opened from the `Settings` gear on the Main Menu (§6.4B) before a campaign exists, and from the `Settings` gear in the Chronicle top strip (§6.4C) or the Radial Menu (§6.5) during one. The contents are contextual, not duplicated components:

* **API Settings** (§3.4): Provider, Model ID, API Key, Temperature, and the shared Prose Depth token-ceiling table (§4.4) — available in both contexts, since a player may need to fix credentials mid-session (this is also what the API Failure Diagnostics Panel's "Open API Settings" action, §3.5, deep-links into).
* **Narration Style** (§4.5): the active style text, editable in both contexts. In-story edits apply from the next turn onward only, per §4.5.
* **Combat Mode** (§5.1d): Tactical/Narrative toggle, the campaign-wide default. In-story changes apply from the next COMBAT-eligible turn onward; a `!`-command scene override (§6.6) always takes precedence over this default until the next chapter boundary.
* **Prose Depth**: the current CONCISE/BALANCED/IMMERSIVE selection (§4.4) — also duplicated as a quick toggle near the input tray for faster in-story access, since it's the setting most likely to change turn-to-turn.
* **UI Preferences**: reduced-motion toggle (respecting `prefers-reduced-motion`, §6.0), text size, and (in-story only) parchment scroll vs. paginated view.
* **About** (§6.3): developer credit, dedication, version tag — pre-campaign context only.

### 6.5 Fantasy Radial Menu (Story View)

A floating action control that keeps lower-frequency systems reachable from the parchment view without permanent chrome eating screen space.

* **FAB placement**: a single circular floating icon (`Wand2`, §6.1b), glassmorphic (§6.1a) with a thin gold rim, positioned centered directly above the floating action-input prompt at the bottom of the Chronicle screen (§6.4C) — visually reads as the ornamental "hub" the decorated input tray radiates from, not a separate floating button bolted on.
* **Expansion**: a tap/press expands a radial fan of glassmorphic icon buttons around the FAB using Framer Motion's `staggerChildren` (§6.0) — each option springs outward on a slight delay from its neighbor, arcing upward so the fan never covers the input tray. A second tap, an outside tap, or selecting an option collapses it the same way in reverse.
* **Default ring of actions** *(revised, v1.7)*:
  * `BookOpen` **Codex** (§6.4D) — full drill-down entry point.
  * `ScrollText` **Quest Log** — a direct shortcut straight into the Quests Entry Grid, skipping the Codex Category List tap, since objectives get checked far more often than most other categories.
  * `Backpack` **Inventory** — shortcut into Items (§5.9), filtered to owned items.
  * `User` **Character** — attributes, derived HP/MP/ST pools (§5.1), equipped gear, and active class (including grounded custom classes, §Phase B.2a).
  * `Map` **World Map** — Locations category (§5.11), current-location-centered.
  * `Save` **Save & Export** — writes current state per the Local Save mechanism (§6.4B).
  * `Settings` **Settings** — opens the Settings Drawer (§6.4E) in its in-story context.
  * `Hammer` **Crafting** *(conditional)* — only appears in the ring while a crafting job is queued or a completed job is awaiting collection (§5.8); carries the same live countdown/"Ready" badge as its Craft Entry Card (§6.4D). Absent otherwise, keeping the resting ring at 7 rather than 8.
* **Touch target sizing**: each radial option meets the 44×44px minimum from §9.3, with enough angular spacing between icons that adjacent options don't compete for a thumb tap on narrow viewports.
* **State awareness**: the FAB itself swaps icon/glow briefly to reflect the active 9-Tier Turn State badge color (§4.3) when collapsed, so its resting state carries information rather than sitting static.

### 6.6 Slash & Bang Command Manager

Both live at the same floating action-input prompt described in §6.4C, but they are deliberately two different systems rather than one command list, because they resolve differently:

* **`/` — In-Fiction Commands.** Typing `/` at the start of the input opens a glassmorphic **Command Palette** overlay above the tray, auto-animating its height as the filtered list narrows with each keystroke (§6.0). Listed commands are pulled dynamically from: universal commands (`/inventory`, `/codex`, `/map`) plus whatever the player's *current* active class grants (a summon-type command per §5.3, if any) — refreshed automatically if Class Evolution (§5.1b) changes that class mid-campaign. Selecting or completing a `/` command sends it through the normal action pipeline (§2 Phase D) exactly like typed prose — it can cost MP/ST, gets narrated, and is subject to the Shadow Referee (§3.2). This is flavor-preserving shorthand for actions the player could otherwise type in full sentences, not a separate mechanic.
* **`!` — Out-of-Fiction System Commands.** Typing `!` opens a visually distinct palette (different accent tint, `Terminal` icon, §6.1b) for meta/OOC actions that never reach the LLM as narrative and cost 0 tokens: `!pause` (freezes into the `PAUSE` turn state, §4.3), `!regenerate` (re-rolls the last narration with the same context slice), `!rewind` (reverts to the previous committed turn, client-side state only), `!note` (attaches a private player note to the current turn, never sent in context), `!settings` (deep-links into API Settings, §3.4), and `!narrative_combat` / `!tactical_combat` (a one-scene Combat Resolution Mode override, §5.1d, that reverts to the campaign default at the next chapter boundary). These are resolved entirely client-side, matching the `PAUSE` "0 API tokens" behavior already defined in §4.3.
* **Discoverability**: both triggers show a one-line hint the first time the input tray is focused in a new session ("Type `/` for actions, `!` for system commands"), then don't repeat it — this is a keyboard/touch-friendly power-user feature, not something that should nag returning players.
* **Keyboard & touch navigation**: arrow keys (desktop) or vertical swipe (touch) move the highlighted suggestion; Enter/tap selects; Escape/outside-tap or deleting back past the trigger character closes the palette without sending anything.

---

## 7. Google AI Studio Native Integration

**Reference configuration, not the only supported path.** Per §3.4, the production app is provider-agnostic — the player picks their provider/model in API Settings, and every call (turn narration, world seeding, class grounding) routes through that choice. This section documents Gemini/AI Studio specifically because it's a convenient zero-code reference implementation; the same System Instructions (§7.2) and JSON Schema (§7.3) shape apply conceptually on other providers, adapted to that provider's own structured-output/tool-use syntax by the client's capability map (§3.4).

To run Tale Dives directly inside [Google AI Studio](https://aistudio.google.com/) without writing web code, configure your prompt environment as follows:

### 7.1 Model Configurations

**Campaign Settings > Gemini 3.x Spectrum Model** (as configured):

| Model | API ID | Recommended Use |
| --- | --- | --- |
| **Gemini 3.1 Flash Lite** *(Default)* | `gemini-3.1-flash-lite` | Ultra-fast, cheapest option. Best for routine PEACE/EXPLORE turns and high-frequency play sessions where prose quality can flex slightly for speed. |
| **Gemini 3.7 Flash** | `gemini-3.7-flash` | Newest Flash model as of writing (Aug 2026); strong at structured/agentic output. Good default for turns where JSON schema adherence matters most. |
| **Gemini 3.6 Flash** | `gemini-3.6-flash` | Prior-gen Flash; solid fallback if 3.7 pricing/availability shifts. |
| **Gemini 3.5 Flash** | `gemini-3.5-flash` | Near-Pro reasoning at Flash cost — good middle tier for COMBAT/INSIGHT turns needing more coherent multi-entity tracking. |
| **Gemini 3.5 Flash Lite** | `gemini-3.5-flash-lite` | Budget option between 3.1 Flash-Lite and full Flash tiers. |
| **Gemini 3 Flash Preview** | `gemini-3-flash-preview` | Legacy preview; keep only for back-compat testing, not recommended for new sessions. |
| **Gemini 3.1 Pro Preview** *(High Reasoning)* | `gemini-3.1-pro-preview` | Highest reasoning depth and cost. Best reserved for **Inspired Mode** world-generation (one-time faction/lore seeding) rather than routine turns, given per-token cost. |

**Response Format**: `application/json`
**Temperature**: `0.7`

**Max Output Tokens — set per Prose Depth Mode, not globally** (see §4.4 — this is the same table, not a second one). A single flat cap either truncates IMMERSIVE turns mid-JSON or wastes budget on CONCISE ones:

| Prose Depth Mode | Narrative Target | `max_output_tokens` (generous headroom) |
| --- | --- | --- |
| CONCISE | ~600–800 tokens | 1,280 |
| BALANCED | ~1,100–1,400 tokens | 2,048 |
| IMMERSIVE | ~1,800–2,600 tokens | 3,584 |

**Model choice is manual and session-wide, not per-turn-type.** The table in §7.1 above lists what each Gemini variant is good at so the player can make one informed pick in API Settings (§3.4) — it is not an instruction to switch models automatically per Prose Depth or turn state. That auto-switching behavior existed in pre-1.7 drafts of §9.4 and was removed for reliability; see §9.4 for why.

**Thinking Level**: set `minimal`–`low` for routine turn narration (this is a creative-writing task, not multi-step reasoning, and thinking tokens are spent from the same budget before visible output appears). Reserve `medium`–`high` for the one-time Inspired Mode world-generation call in §7.1 (which now also carries the Narration Style grounding field, §4.5), where deeper reasoning genuinely helps quality.

**Truncation Recovery**: check `finish_reason` on every response. If it returns `MAX_TOKENS` even with the headroom above, do not treat the cut-off JSON as a Stage 3 parse failure — issue one short continuation request ("continue the JSON object from exactly where it left off") and stitch the result together before rendering. The token headroom keeps this rare; this path guarantees no scene is ever visibly cut off when it does happen.

> Note: Google revises the Gemini model lineup frequently (new Flash point-releases have shipped roughly every 4–6 weeks through 2026). Treat this table as a snapshot — re-verify exact model IDs and pricing in AI Studio before each release rather than hardcoding assumptions long-term.

### 7.2 System Instructions

Paste the text block below into the **System Instructions** field:

```text
You are the Dungeon Master engine for Tale Dives, an atmospheric fantasy RPG (mature violence and romance themes) set in a reactive, high-stakes world.

NARRATIVE & TONE RULES:
1. Writing Style: Write elaborate, novel-quality third-person prose grounded in sensory detail, distinct NPC voices, and real narrative stakes. Emphasize body language, environmental textures, physical strain, and lighting.
1a. Narration Style Profile: Apply the voice described in "Narration Style" in the context slice for this turn — sentence rhythm, point of view, diction, and pacing. This governs HOW rules 1–6 are executed; it never overrides rule 3 (Player Agency) or rule 5 (Mature Themes boundary).
2. Length: Match your narrative length to the "Target Prose Depth" specified in the context slice for this turn. Do not default to a fixed length regardless of what the slice requests.
3. Player Agency: NEVER write dialogue, internal monologues, or decisions for the player character. Describe the world's reaction to player choices only.
4. End most turns on a hook or open decision point rather than a fully resolved beat.
5. Mature Themes: Violence, moral ambiguity, romance, and tension are welcome and should be written with real narrative weight. All characters are adults. For content beyond kissing/embrace, use a clear scene-break transition and resume afterward rather than writing it graphically — this boundary is fixed and does not flex with Trust tier or Prose Depth Mode.
5a. INTIMACY Gating: Before narrating romantic or physical escalation, check the target NPC's Trust value, personality, and `currentImpression`/relationship note in the context slice — exactly as you would for a SOCIAL request. A Stranger-stage or low-Trust NPC should rebuff, deflect, or slow-play advances in character; only a high-Trust NPC with an established, receptive relationship should reciprocate warmly. The player may always attempt to initiate — the NPC's reaction is what's bounded, never the player's ability to try.
6. Rich Text Formatting Rules (MANDATORY):
   - Enclose active skills, spells, or abilities in square brackets: [Shadow Step], [Arise], [Soul Feast].
   - Enclose items, weapons, keys, or loot in angle brackets: >Obsidian Dagger<, >Silver Quill<, >Bone Fragment<.
   - Enclose NPC inner monologues, spoken whispers, or player internal monologues in single quotes: 'Something watches us.'
   - Tag named NPCs, locations, factions, quests, and adversaries in double braces with a category code the first few times they're meaningfully mentioned — not every pronoun or repeat reference: {{Mira Sorrengail|npc}}, {{The Parapet|loc}}, {{Riders Quadrant|faction}}. Category codes: npc, loc, faction, lore, quest, beast. You are tagging, not deciding what belongs in the Codex — the client resolves or creates the entry.

9-TIER TURN STATE GUIDELINES:
- PEACE: Ambient travel, town interaction, downtime, environmental sensory detail.
- COMBAT: Check "Combat Resolution Mode." TACTICAL: narrate the exact "Combat Result" given — no invented misses, crits, or damage. NARRATIVE: no Combat Result is given; resolve the exchange yourself from context (stakes, stated tactics, target's actual defenses) — same discipline as SOCIAL/EXPLORE, not an auto-win.
- STEALTH: High-tension shadow navigation. Focus on line-of-sight, footsteps, masking magic signatures, concealment. Resolve narratively — there is no hidden check.
- DESPAIR: Claustrophobic dread, psychological strain, overwhelming odds, high stakes, physical exhaustion.
- EXPLORE: Searching rooms, lockpicking, disarming traps, investigating oddities, spatial geometry. Resolve narratively — there is no hidden check.
- INSIGHT: Monarch visions, memory recalls, ancient lore revelations, deciphering arcana.
- SOCIAL: Diplomacy, trade bargaining, haggling, coercion, deception, political maneuvering. Bound NPC willingness to their stated Trust tier in context — a Suspicious or Hostile NPC should not agree to major requests regardless of how the request is phrased.
- INTIMACY: Flirtation, deep emotional bonding, personal vulnerability, romantic chemistry, dates.
- PAUSE: Freeze narrative output (System command processing).

MECHANICS & GROUNDING DEFENSE:
1. Numeric Fidelity: No dice, checks, or hidden randomness anywhere. Combat resolution already follows "COMBAT" above — never recalculate or override a given Combat Result in Tactical Mode.
2. Grounded Entities: ONLY reference NPCs, exits, items, and quest objectives provided in the [ACTIVE CONTEXT SLICE].
3. Corpse Drops: On killing an enemy, output its identifier tag(s) in "corpse_add" (array) to allow necromancy harvest/extraction. Include every enemy killed this turn, not just one.
4. Currency Storage: Deduct or reward currency in base copper ("c" delta field).
5. Permanent Stat Grants: Only use "stat_grant" for a genuine permanent boost (a blessing, a hard-won transformation) — never for ordinary damage/healing, which belongs in "deltas". Supply only the attribute/pool and the amount; never compute or state a resulting HP/MP/ST max yourself, the client derives that.
6. JSON Strictness: Output ONLY valid, parsable JSON matching the defined response schema. Do NOT wrap output in markdown code blocks.
```

### 7.3 JSON Schema

Paste the JSON structure below into the **JSON Schema** box:

```json
{
  "type": "OBJECT",
  "properties": {
    "nar": {
      "type": "STRING",
      "description": "Main narrative prose. Use [Skill], >Item<, 'Thought', and {{Term|category}} formatting."
    },
    "turn_state": {
      "type": "STRING",
      "enum": ["PEACE", "COMBAT", "STEALTH", "DESPAIR", "EXPLORE", "INSIGHT", "SOCIAL", "INTIMACY", "PAUSE"]
    },
    "time": {
      "type": "OBJECT",
      "properties": {
        "d": { "type": "INTEGER" },
        "h": { "type": "STRING" }
      },
      "required": ["d", "h"]
    },
    "loc_disp": { "type": "STRING" },
    "loc_id": { "type": "STRING" },
    "dist": {
      "type": "STRING",
      "enum": ["c", "m", "f", "none"]
    },
    "deltas": {
      "type": "OBJECT",
      "description": "Tactical Mode: must match the given Combat Result exactly. Narrative Mode: your own bounded amount (no Combat Result given).",
      "properties": {
        "hp": { "type": "INTEGER" },
        "mp": { "type": "INTEGER" },
        "st": { "type": "INTEGER" },
        "c": { "type": "INTEGER" }
      }
    },
    "inv_add": {
      "type": "ARRAY",
      "items": {
        "type": "OBJECT",
        "properties": {
          "id": { "type": "STRING" },
          "qty": { "type": "INTEGER" }
        },
        "required": ["id", "qty"]
      }
    },
    "inv_rem": {
      "type": "ARRAY",
      "items": {
        "type": "OBJECT",
        "properties": {
          "id": { "type": "STRING" },
          "qty": { "type": "INTEGER" }
        },
        "required": ["id", "qty"]
      }
    },
    "corpse_add": {
      "type": "ARRAY",
      "items": { "type": "STRING" },
      "description": "One entry per enemy killed this turn."
    },
    "stat_grant": {
      "type": "OBJECT",
      "description": "Permanent attribute/pool bonus only — not ordinary damage/healing (use deltas for that). Set exactly one of attr or pool, plus amount.",
      "properties": {
        "attr": { "type": "STRING", "enum": ["STR", "INT", "AGI"] },
        "pool": { "type": "STRING", "enum": ["hp", "mp", "st"] },
        "amount": { "type": "INTEGER" }
      }
    },
    "act": {
      "type": "ARRAY",
      "items": { "type": "STRING" },
      "description": "2-4 short suggested next actions. Flavor only, not a restrictive menu — the player can always type something else."
    },
    "flag_add": {
      "type": "ARRAY",
      "items": { "type": "STRING" }
    },
    "quest_update": {
      "type": "OBJECT",
      "description": "Optional. Present only when this turn advances or completes a tracked objective.",
      "properties": {
        "quest_id": { "type": "STRING" },
        "status": { "type": "STRING", "enum": ["advanced", "completed", "failed"] },
        "note": { "type": "STRING" }
      }
    },
    "npc_mem_up": {
      "type": "ARRAY",
      "items": {
        "type": "OBJECT",
        "properties": {
          "npc_id": { "type": "STRING" },
          "aff_delta": { "type": "INTEGER" },
          "trust_delta": { "type": "INTEGER" },
          "deed": { "type": "STRING" },
          "mem_summary": { "type": "STRING" }
        }
      },
      "description": "One entry per present NPC affected this turn."
    }
  },
  "required": ["nar", "turn_state", "time", "loc_disp", "loc_id", "act"]
}
```

---

## 8. Open Design Decisions (Recommend Deciding Before Build)

These aren't blockers, but each one changes downstream mechanics enough that it's worth locking in early:

1. **Tuning constants** for §5.1 ($HP_{base}$, $MP_{base}$, $ST_{base}$, $k_1$–$k_4$) — depends on target level range and how "swingy" you want early combat to feel.
2. **Defeat consequence** per §5.7 — soft respawn vs. scripted story branch vs. hybrid by encounter type.
3. **Save slots & export/import** — not yet specified; recommend at minimum a JSON export button for backup, plus a schema-version field in every save so future changes to this spec don't silently corrupt old saves.
4. **Weapon/skill base damage values** — intentionally kept open and flexible rather than a fixed master table (confirmed design choice, not an outstanding gap). New weapons/skills can be introduced narratively and assigned reasonable client-side values on the fly rather than requiring a pre-built spec.
5. **Level cap and Milestone Leveling scope** (§5.1a) — whether Secret-tier quest completions should also grant a level (excluded by default, to avoid rewarding side-content spam over main progress), and whether leveling should ever stop scaling once a campaign runs long past its planned arc.
6. **Adversary threat-tier baseline table** (§5.13) — `minor`/`standard`/`elite`/`boss` need actual `hp_max`/`dmg_base` numbers scaled to player level, in the same spirit as item 1 above; left open here since it depends on the same combat-feel tuning pass.
7. **Narrative Mode's magnitude-cap threshold** (§5.1d/§3.2) — what share of a max pool a single-turn delta can hit before the Shadow Referee soft-caps it. Too tight and Narrative Mode feels like Tactical Mode with extra steps; too loose and it stops catching genuinely runaway numbers. Recommend tuning this alongside item 1, not in isolation.

---

## 9. Performance, Responsiveness & Mobile-First Design

Three things determine whether Tale Dives *feels* immersive on a phone: perceived latency during generation, DOM/render weight as a session grows over many turns, and whether touch interaction feels native rather than adapted from desktop.

### 9.1 The IMMERSIVE-Mode Latency Problem

This is the most important item in this section. Standard JSON structured output cannot be safely parsed as a partial object while it streams — the client has to wait for the full response before `JSON.parse()` succeeds. At the IMMERSIVE token ceiling (§7.1), that's a real, silent wait with nothing on screen, which is the opposite of immersive.

**Fix — partial-JSON streaming parser for the `nar` field.** Use the streaming API, but instead of waiting for a complete, valid JSON object, run a lightweight incremental parser against the growing raw response buffer that:
1. Detects the `"nar": "` field opening as soon as it arrives.
2. Extracts and renders the string content live, character-by-character, as a typewriter effect on the parchment canvas — this is the part the player is actually reading, so it can render before the object closes.
3. Holds all other fields (`deltas`, `turn_state`, `npc_mem_up`, etc.) until the full object is valid, then commits them to the Shadow Referee in one atomic update once streaming completes.

This gives the player something to read within a few hundred milliseconds regardless of Prose Depth Mode, while state mutation stays exactly as safe and atomic as before — no change to the Shadow Referee validation logic in §3.2.

### 9.2 Rendering & DOM Performance

* **Virtualize the parchment scroll.** Don't keep every turn of a long chapter mounted in the DOM. Combine this directly with the page-counter pagination from §6.4: only the active page's ~8–12 turns are rendered; older pages unmount and are restored from local state on scroll-back, not re-fetched.
* **Lazy-load Codex entries.** World DB / NPC Directory entries should hydrate on drawer-open, not at session load — none of it is needed for the active turn loop.
* **Debounce the action input** and disable the send control during an in-flight request rather than allowing queued taps, which is a common source of duplicate-turn bugs in chat-style UIs.

### 9.3 Mobile-First Interaction

* **Thumb-reachable action tray**: the action input anchors to the bottom of the viewport, not the top — the single highest-impact mobile layout decision for a text-input-heavy app.
* **Respect safe areas**: pad the bottom tray and top header for notches/home-indicator bars (`env(safe-area-inset-*)`), since the parchment canvas will otherwise render under the OS chrome on many devices.
* **Bottom-sheet drawers, not side drawers**, for NPC/World DB/Settings on narrow viewports — side drawers on mobile tend to eat the whole screen anyway, so a bottom sheet with a drag handle is a more native-feeling gesture.
* **Large touch targets** for choice pills (44×44px minimum), with generous spacing — dense desktop-style click targets are the most common mobile-port complaint.
* **Scroll-snap pagination** on the parchment canvas so swiping between pages (§6.4) feels like turning a page, not an accidental partial scroll.

### 9.4 Prose Depth as a Pure Token-Ceiling Control

**Superseded in v1.7: do not auto-switch models per Prose Depth Mode.** Earlier drafts of this section paired each Prose Depth Mode with a different suggested model, on the theory that it saved the player a decision. In practice this was the source of recurring bugs: swapping models mid-session changes JSON-schema strictness, grounding/tool support, and latency characteristics out from under assumptions the Shadow Referee (§3.2) and capability map (§3.4) both depend on staying constant for a session. A turn narrated in CONCISE by one model and IMMERSIVE by another can drift in voice, formatting compliance, and even turn-state judgment in ways that are hard to trace back to "the model changed underneath you."

**Fixed as of v1.7**: Prose Depth Mode (§4.4) is purely a **token-ceiling and target-length control**. It changes two things and two things only, every turn:
1. The `max_output_tokens` sent with the request (§4.4/§7.1's shared table: 1,280 / 2,048 / 3,584 for CONCISE / BALANCED / IMMERSIVE).
2. The `Target Prose Depth` line in the JIT context slice (§3.1), which tells the model how much to write.

It never changes the model or provider. The model is chosen exactly once, in API Settings (§3.4), and stays fixed for the session (or until the player deliberately changes it there) regardless of which Prose Depth the player toggles turn to turn.

**Why the token ceilings are generous, not tight.** The §4.4 table intentionally budgets ~60–70% headroom above the top of each mode's target range, rather than the tighter caps used in pre-1.7 drafts. A `MAX_TOKENS` truncation mid-JSON is worse for the player than the modest extra cost of headroom — it either trips the Stage 3 fallback parser (§3.3) or the continuation-recovery path (§7.1), both of which exist specifically to paper over a truncation that generous ceilings should make rare in the first place. If a provider's actual pricing makes the IMMERSIVE ceiling (3,584 tokens) uncomfortable at scale, tune the *target range* down in §4.4 rather than reintroducing per-mode model switching — the token ceiling and the model are separate knobs and should stay separate.

---

## Appendix A: Worked Example — World, Protagonist & Tale Dive Brief

A concrete run through campaign creation (§Phase A/B), tying together World Background, Class Grounding, the Tale Dive Brief, and Codex Discovery Seeding (§5.12) in one example. This is reference material, not a shipped default campaign.

### A.1 World Library Entry (§6.4B)

| Field | Value |
| --- | --- |
| Mode | Inspired Mode |
| Title / Author | *Fourth Wing* / Rebecca Yarros |
| World Background | "The continent of Navarre." |
| Match Author's Style | On |
| Narration Style (grounded, §4.5) | *Close third person with a present-tense sense of urgency; short, breath-tight sentences during danger or physical strain; banter-forward dialogue that carries romantic tension through action rather than pausing for it; visceral, specific physical detail over abstraction.* |

This card is what the World Library (§6.4B) shows the player when they later start a second campaign in the same setting, or mark it as their default World.

### A.2 Protagonist Library Entry (§6.4B)

| Field | Value |
| --- | --- |
| Name | Violet Sorrengail |
| Class (§Phase B.2a, grounded) | `apprentice_scribe` — display name **Apprentice Scribe**. `grounding_used: true`. |
| Background | Daughter of Lilith Sorrengail, general commander of Navarre's forces; her father was a scribe. Her late brother was a celebrated Dragon Rider; her surviving sister, Mira, also a Dragon Rider, dotes on her. |

**"A class doesn't have to be the story's final word" in practice (cross-ref §Phase B.2a, §5.1b):** Apprentice Scribe is a genuinely INT-heavy, low-STR weight vector — an accurate, non-combat starting class for a character who trained for the Scribe Quadrant. Nothing about that blocks the story from forcing her into Rider training later: when that story beat lands, **Class Evolution** (§5.1b) fires the same grounded call again, her single class slot is replaced outright with whatever grounding returns for "Rider" in this setting, and only points earned from that turn forward follow the new vector. Her frail, scholarly Turn 1 stat profile is never retroactively rewritten — the mismatch between who she was built to be and what she's forced to become is the point, and the engine represents that honestly instead of quietly reclassing her.

### A.3 Tale Dive Brief (§Phase B.4)

The free-text brief the player enters right before the world is fabricated — saved into the Protagonist Library entry alongside the class and background above:

> The tale starts the morning of Conscription Day, when Violet is forced by her commanding-general mother to enter the deadly Riders Quadrant instead of the peaceful Scribes Quadrant she trained for all her life. The story opens in her mother's office for a tense final physical assessment and uniform fitting, while Violet quietly panics over her frailty and hypermobile joints — a serious liability given how easily she can be injured. Her sister Mira protests and tries to press protective gear on her; Violet accepts the situation, binds her joints, and prepares to cross the parapet, a narrow stone bridge that kills applicants before they even reach the quadrant, all while aware her visible weakness makes her a target. **The dive begins while Violet is still on her way to her mother's office, where Mira and her mother are already waiting.**

Note the bolded final sentence: it's what actually pins Turn 1's `loc_id`/`loc_disp` and the two present NPCs — everything before it is scene-setting context for the grounding call, not part of the opening beat itself.

### A.4 Resulting Codex Seed (§5.12 demonstration)

A representative slice of what the deferred grounding call (§Phase A.2) would return for this brief — mixing entries the brief names directly (seeded `known`) with peripheral lore (seeded `hidden`, discoverable in play):

| Category | Entry | `discovery.state` | Reveal Condition | Teaser (if hidden) |
| --- | --- | --- | --- | --- |
| NPCs | Lilith Sorrengail | `known` | — (present at Turn 1) | — |
| NPCs | Mira Sorrengail | `known` | — (present at Turn 1) | — |
| NPCs | *(the late brother, named on grounding)* | `hidden` | `npc_met` — first time another NPC brings him up in conversation | "A name the family doesn't say at dinner." |
| Locations | Lilith's Office | `known` | — (Turn 1 setting) | — |
| Locations | The Parapet | `known` | — (named directly in the brief) | — |
| Factions | Riders Quadrant | `known` | — (named directly in the brief) | — |
| Factions | Scribes Quadrant | `known` | — (named directly in the brief) | — |
| Skills | *(scribing-related utility skill, from her trained background)* | `known` | — (already part of her training) | — |

This is exactly the Category List / Entry Grid behavior described in §6.4D: the player opens Codex on Turn 1 and already sees a populated Realm Overview, both quadrant factions, and the immediate cast — with a couple of `Lock`-badged `???` cards visible in NPCs, seeded once at creation for free and revealed later purely by client-side flag/NPC checks (§5.12), at zero additional token cost.


