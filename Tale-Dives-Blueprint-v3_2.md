# Tale Dives — Master Game Blueprint & System Architecture Specification (v3.2)

**Project Title:** Tale Dives

**App Developer:** Kemuel Avenido (Kem Ave)

**Dedicated To:** Elisah Mirelle R. King (*My Avid Bookworm*)

**Architecture:** Single Page Application (SPA) — Vite + React | Local-First Engine + Provider-Agnostic LLM API (Player-Configured Model/Provider)

**Target Atmosphere:** Authorial High-Sensory Fantasy RPG (mature violence & romance themes) / Interactive Web Novel

**v3.2 changelog (2026-09-07) — the Narrative-First Overhaul.** Every numeric mechanical channel v3.0 specified (HP/MP/ST pools derived from STR/INT/AGI formulas, TACTICAL client-computed combat math, `stat_grant` amounts, signed NPC affection/trust deltas, Bestiary `hp_max`/`dmg_base`) is gone, replaced by a small, fixed, ordinal-word vocabulary the model must always use verbatim — never a number. This was a deliberate design reversal, not a bug fix: the target audience (avid fantasy readers) reads for vivid prose and long-term memory, not turn-based mechanical bookkeeping, and every numeric channel was a recurring hallucination/desync risk in practice (see the since-retired NaN-repair pass in `store.ts`, kept only as version history). §5.1–§5.1d are rewritten around this; §7.2/§7.3 are full verbatim replacements of the live prompt text. Read §5.1's new intro before anything else in this document if you're only skimming — it explains the vocabulary every other section now assumes. TaleDiveWeaver (formerly WorldSeedWeaver) is also now the default "New Story" creation flow — see §6.4B.

---

## 1. Executive Summary & Core Philosophy

**Tale Dives** is an atmospheric, high-stakes fantasy role-playing engine — mature violence and romance themes, not a horror-toned genre label — engineered to blend rich authorial prose with unyielding game-state integrity. Standard LLM text adventures suffer from context decay, weightless choices, and stat hallucinations. Tale Dives eliminates these flaws through a **Client-Side Shadow Referee** paired with **Just-In-Time (JIT) Context Slicing**. The AI engine serves purely as an expressive narrator and world simulator, while the client application handles hard state, currency accounting, entity validation, and persistent world memory.

There is no hidden randomness in Tale Dives — no dice, no rolls, and (as of v3.2) **no numbers of any kind in the mechanical channels either**. Combat is always fully narrative-adjudicated: the model resolves an exchange from context — established competency, stated tactics, an adversary's actual Condition Tags and Threat Tier — the same discipline SOCIAL/EXPLORE turns already used before v3.2, never a client-computed formula. What keeps this from being "just vibes": every mechanical fact either side can act on (how hurt someone is, how outmatched a fight is, how socially resistant an NPC is) is still expressed as one of a small, closed set of canonical **ordinal tier words** (§5.1), enforced at the parser boundary — an off-vocabulary or numeric-looking value is a parse error, not a value the client silently accepts. The Shadow Referee still owns state integrity; it now validates *vocabulary*, not arithmetic.

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
    shadowReferee.js  # §3.2 — validation logic lives here, isolated from UI
    jitContext.js      # §3.1 — builds the context slice each turn
    tiers.js            # §5.1 — canonical tier word vocabularies + compareTiers()
    conditions.js        # §5.1 — Condition Tag add/remove/expire
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
|                                                 | (Injects Condition Tags, ordinal   |
|                                                 |  adjudication hints + lean context)  |
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

1. **Trait & Origin Definition**: Name, background, starting attributes (STR/INT/AGI) — **optional**. A fixed starting point pool (`TOTAL_ASSIGNABLE_POINTS = 12`, on top of a `BASE_ATTR_VALUE = 10` floor) is split across the three proportionally to the chosen class's weight vector (§5.1a); if skipped, the client applies the flat unweighted baseline. **Known gap, not yet closed**: this creation-time picker still hands out a wider raw 10–22-ish range rather than the true 5-word `CompetencyTier` scale everywhere else in the app reads/writes (§5.1) — rescaling it to a genuine tier picker is tracked as outstanding UI work, not done in this revision (see PROJECT_REVISION_NOTES.md).
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
### Phase C: World Initialization & Seed Data

* Loads local static dictionaries (location nodes, item values, base spells) into browser `localStorage`.
* Generates zero-token baseline contexts so routine turns do not require repeated setup queries.
* If a Tale Dive Brief (§Phase B.4) named NPCs not yet in the Codex (e.g. family members present at the opening scene), those are seeded from the Phase A.2 grounding response using the same stub-creation path as Location Auto-Registration (§5.10), so Turn 1 can reference them immediately rather than waiting for an ordinary in-session auto-log.

### Phase D: Active Narrative Turn Loop

1. **Action Input**: Player types an action or selects a suggested choice pill.
2. **JIT Context Slicing**: The client compiles active location info, present NPCs, active quests, active Condition Tags (player + present combat opponent), and — on a COMBAT-eligible turn — a `compareTiers()` ordinal adjudication hint (§5.1/§3.1), into a lean context string (~30–60 input tokens).
3. **Gemini Handshake**: Prompts Gemini with strict System Instructions and the XML output grammar (§7.2/§7.3). Combat, like every other turn state, is resolved narratively by Gemini — bounded by the context slice above, never by a client-precomputed number.
4. **Self-Healing Pipeline**: Regex Sanitizer cleans raw strings → XML Parser extracts `<nar>`/`<sync>` → Shadow Referee validates/clamps values (§3.2) — Condition Tags added/removed/expired, tier words checked against the fixed vocabulary, magnitudes rejected outright since none are ever expected.
5. **State Mutation & Render**: Conditions, inventory, currency, and parchment scroll update in real-time.

### Phase E: Chapter Milestone & Memory Reset

* At chapter boundaries, Gemini outputs a 2-sentence chapter summary.
* Past conversation turns are flushed from the sliding API prompt window while persistent summary cards are saved locally, maintaining full memory coherence at minimal token cost.

---

## 3. Architectural Pillars & Token Optimization Protocols

### 3.1 Just-In-Time (JIT) Context Slicing

Instead of feeding Gemini an infinite chat log or full codex, the engine constructs a dynamic **JIT Context Header** right before sending each prompt:

```text
[ACTIVE CONTEXT SLICE]
Player: Wren of the Ashmark (Dark Monarch) | Level: 3 | STR: Adept | INT: Novice | AGI: Adept
Conditions: Bleeding, Exhausted
Location Node: loc_ashgate_courtyard | Time: Day 1 08:15 AM
Known Location: Ashgate Fortress — Upper Courtyard | Danger: Low | Standing: Friendly (Ashgate Garrison)
Equipped Quick-Slots: [Shadow Step], [Arise], [Soul Feast]
Present NPCs: NPC: Commander Valen Thorne | Stage: Acquaintance | Trust: Adept | Mem: "Needs vault inspected."
Active Regional Objectives: Main: "Inspect Keystone Seal"
World Flags: [spared_archive_guard]
Base Copper Wealth: 14580
Combat Adjudication (if applicable): outmatched — win by cleverness, not raw force
Target Prose Depth: BALANCED (~1,100-1,400 tokens)
Narration Style: Third-person limited, past tense, long sensory sentences broken by short blunt ones at moments of violence...
```

**No numeric channel exists in this slice at all.** STR/INT/AGI render as their `CompetencyTier` word (§5.1), never a number; `Conditions` lists the active `ConditionTag`s by label, omitted entirely when empty; NPC `Trust` is likewise its own tier word (§5.5). `Combat Adjudication` — new in this revision — is `compareTiers()`'s one-line narrative hint (§5.1/Combat Resolution above), present only on a turn where a combat exchange is actually in play, comparing the protagonist's relevant `CompetencyTier` against the opponent's `threatTier` (or, on a SOCIAL turn against an NPC with a set `resolve`, the protagonist's INT against that NPC's `resolve` — the same primitive, a different call site). This line is guidance for the model's narration, never a value it echoes back or computes against.

**How location memory actually works — the model doesn't "remember," the client re-tells it.** Gemini has no persistent memory of prior turns beyond the sliding conversation window (§Phase E flushes it at chapter boundaries) and never sees the full Codex. Consistency about a place the player has been before comes entirely from this line: **`Known Location`**. Every turn, the client checks the current `loc_id` against the Locations Codex (§6.4D); if a real (non-stub) entry already exists, its display name, danger level, and derived faction standing (§5.11) are compiled into this one compact line and re-sent — so the model is reminded "this is the same courtyard, already Friendly territory" without ever needing the full stored description or a second API call. If the location has no Codex entry yet (first visit), this line is simply omitted and the model is narrating somewhere genuinely new.

### 3.2 Client-Side "Shadow Referee"

Gemini handles creativity; React handles ground truth.

* **Tier-Word Enforcement, the anti-drift backstop.** Every `CompetencyTier`/`ThreatTierToken`/`EffortTier` attribute the model emits is checked at the XML parser boundary (`lib/xmlHelpers.ts`'s `reqTierWord`) against its fixed scale — a word outside the scale (an invented synonym, or a number where a word belongs) is a parse failure, exactly like a missing required attribute, never silently coerced or defaulted away. This is the direct successor to the old numeric Stat Clamping rule: there's no `[0, max]` range to clamp into anymore, only a closed vocabulary to police.
* **Condition Tag Integrity.** `<cond>` add/remove is applied via `lib/conditions.ts` — an unrecognized condition name defaults to `narrative` (never silently auto-expiring), and `expireConditions` runs once per turn against the current `GameTime`, both purely client-side.
* **Inventory Sanity Check**: If Gemini emits `<item rem="shadow_dagger">` but the player doesn't own it, the update is dropped.
* **Skill Affordability**: React checks a skill's `effort` tier against the player's current Condition Tags *before* sending a skill action to Gemini (§5.1), instructing Gemini to narrate either successful casting or a strain penalty. This check is advisory, never blocking, same as every prior revision.
* **Turn State is always Gemini's judgment call.** With no client-precomputed combat result to check against anymore, `turn_state: COMBAT` (like every other state) is the model's own labeling of the turn, bounded only by the narrative content it's writing — there's no client precondition left to force it.
* **Reputation-Gated Social Outcomes**: For SOCIAL-tier turns, NPC willingness is bounded by their `trust` `CompetencyTier` (§5.5) rather than by a check — e.g. a `Novice`-trust NPC should refuse requests a `Master`-trust NPC would grant. This is enforced via system instruction, not client math, since social outcomes remain narrative.

### 3.3 Three-Stage Self-Healing Turn-Response Pipeline

```
[Raw Model Response] --> [Stage 1: Fence Sanitizer] --> [Stage 2: XML Parser] --> [Stage 3: Parchment Fallback]
```

The turn response format is a **hybrid**: `<nar>` stays plain prose carrying the existing markup rules unchanged (§4.2), while a second top-level `<sync>` element carries every mechanical field as self-closing XML tags/attributes (§7.3) — not JSON. This shipped after a live token benchmark against the real Gemini tokenizer showed the equivalent XML output running ~25% smaller than the old JSON-schema response for the same turn content, with no change to any field the client actually consumes.

1. **Stage 1 (Fence Sanitizer)**: Strips a stray ```` ```xml ```` code fence if the model wraps output in one anyway, despite the system instructions saying not to.
2. **Stage 2 (XML Parser)**: `<nar>` is extracted with a targeted regex (not the full XML parser) specifically so a response cut off mid-generation by `MAX_TOKENS` still yields whatever prose made it out before the cutoff, with its own entity-decode pass (a model-escaped `&amp;` still needs unescaping even though it never passes through a DOM parser). `<sync>` is parsed as real XML and mapped tag-by-tag onto the same internal `TurnResponse` shape the old JSON schema (§7.3) produced — every downstream consumer (Shadow Referee, state commit) is unchanged, since the wire format changed but the parsed shape didn't.
3. **Stage 3 (Fallback Reader)**: If `<sync>` fails to parse (malformed XML, a field the model got wrong), Stage 2's already-extracted `<nar>` prose still renders in the parchment viewer, displaying a discreet `[Repairing State]` indicator while keeping gameplay smooth — the fallback no longer depends on `<sync>` succeeding at all, since narration is parsed independently of it in Stage 2.

**Stage 0 (Request Failure Handling)** — new: if the API call itself fails (timeout, rate limit, safety block), retry once silently. On second failure, freeze the turn in a `PAUSE`-equivalent state and surface an in-fiction "The thread of fate falters..." message rather than a raw error, preserving immersion while the player retries. If the failure persists, the player can expand this message into the API Failure Diagnostics Panel (§3.5) rather than being stuck guessing.

### 3.4 Provider-Agnostic Model Routing

No step in Tale Dives is pinned to a specific vendor or model. **API Settings** (accessible from the Title Screen, Main Menu, and the in-story Settings drawer) is the single source of truth for which provider, model, and credentials every call in the app uses:

* **Fields**: Provider (e.g., Gemini / OpenAI / Anthropic / OpenAI-compatible custom endpoint), Model ID (free-text or dropdown, since providers ship new point-releases faster than any hardcoded list can track — see the note at the end of §7.1), API Key (stored locally only, never sent anywhere but the provider's endpoint), Temperature, and the per-Prose-Depth `max_output_tokens` table (§4.4/§7.1) which remains overridable per provider since token accounting differs slightly across APIs.
* **One config, every call type.** Turn narration (§2 Phase D), Inspired Mode world seeding (§Phase A.2), Chapter Milestone summaries (§2 Phase E), and Class Grounding (§Phase B.2a) all read from this same configuration at call time. There is no separate "creation model" or "narration model" hardcoded anywhere in the app — if the player changes their model in Settings mid-session, the very next call of any kind uses it.
* **Capability flags, not hardcoded assumptions.** Because grounding/search-tool support, native structured-output/JSON-schema support, streaming behavior, and prompt/context caching all vary by provider, the client keeps a small local capability map per provider (`supportsGrounding`, `supportsJsonSchema`, `supportsStreaming`, `supportsPromptCaching`) so features like §Phase B.2a's grounded class call, §9.1's partial-JSON streaming parser, and the caching bullet below degrade gracefully — never silently fail — on providers that lack a given capability, and any degraded state (e.g., ungrounded class assignment) is surfaced to the player rather than hidden. **`supportsJsonSchema` describes the provider's own native structured-output mechanism, not which wire format Tale Dives actually sends it** — the live Gemini integration (§7) currently sends the hybrid XML format (§7.3) regardless of this flag, since a real token benchmark showed it costing meaningfully fewer output tokens than Gemini's own JSON-schema mode for the same turn content. A provider without a comparable win from switching formats can keep using its native JSON-schema mode; the capability map is what lets that decision be per-provider rather than hardcoded.
* **Static payload caching, where supported.** §7.2's System Instructions and §7.3's XML Output Grammar are byte-identical on every turn of a session — only the JIT Context Slice (§3.1) actually changes turn to turn — which makes them the single biggest lever for reducing per-turn cost, well beyond trimming the field-level text either block contains. On a provider whose `supportsPromptCaching` flag is true (e.g. Gemini context caching, Anthropic prompt caching, OpenAI's automatic prefix caching), the client caches the System Instructions + Grammar pair once at session start and sends only the JIT Context Slice plus the cache reference each turn thereafter, rather than re-transmitting ~800–1,200 static tokens on every single exchange. Where unsupported, the client falls back to sending both in full every turn, exactly as every prior revision of this spec already assumed — this is a pure optimization, never a behavior change the model needs to know about.
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
* **Every other field is a mechanism, not prose, and stays compact.** `<cond>`, `<item>`, `<flag>`, `<breakthrough>`, `<npc>`, `<quest>`, `<project>`, `<enrich>`, and `copper_delta` (§5.1c/§7.3) use short attribute keys and canonical tier words, never a sentence where a word or id suffices — and never restating in a sync tag something already fully expressed in `<nar>`.
* **Non-LLM logic stays 0-token by construction.** This was already true for currency (§5.2), crafting (§5.8), and faction rivalry (§5.4) — every new client-side system since (Location Auto-Registration §5.10, Faction Standing derivation §5.11, and Codex Discovery reveals §5.12) follows the same rule: state changes that can be computed or checked locally are computed or checked locally, never round-tripped through the model to confirm.
* **New features are held to this by default**, not by special-case review — any future schema addition should ask "does this belong in `nar` (lush, player-facing) or in a delta field (compact, mechanism-only)" before it ships, rather than growing a third, ambiguous category.
* **Schema `description` fields are payload, not documentation.** §7.3's XML Output Grammar and §7.2's System Instructions are sent to the model on every single turn (or cached whole, §3.4) — a `description` string bloated with multi-sentence rationale or, worse, a `(§5.1c)`-style cross-reference into *this blueprint* is pure waste: the model never sees this document's section numbers, so a reference to one teaches it nothing and just costs tokens. Keep schema descriptions to the minimum needed to fill the field correctly; put the "why" here in the blueprint, not in the payload. Watch specifically for the same explanation appearing twice across the System Instructions and the Schema (or twice within the System Instructions itself, e.g. a turn-state guideline and a mechanics rule both re-explaining the same branch) — state it once, in whichever spot the model would naturally consult first, and have the other spot point at it briefly rather than repeat it.

---

## 4. Narrative & LLM Writing Protocols

### 4.1 Authorial Fantasy Prose Guidelines

* **Sensory Density**: Focus on weapon weight, physical strain, lighting variations, ambient temperature, tactile surfaces, and acoustic reverberation.
* **Strict Player Agency Bounds**: **NEVER** write dialogue, internal thoughts, or decisions for the player character. Describe environmental reactions, world shifts, and NPC behavior only.
* **Vocabulary Fidelity**: Every attribute, skill, NPC relationship, and adversary threat is a fixed tier word (§5.1) — never invent a number, a percentage, or a synonym not on the canonical list, even in prose (e.g. narrate "his grip weakens, Adept fading toward Novice" rather than "his strength drops by 12%"). When a `Combat Adjudication` hint is present in the context slice (§3.1), let it steer how lopsided the exchange reads — outmatched, evenly matched, dominant — without stating the hint's wording verbatim or inventing a number to justify it.

### 4.2 Mandatory Rich Text Markup

Narrative output must wrap key elements in special delimiters for client-side visual highlighting:

* **`[Active Skill]`**: Soft indigo pill (`bg-[#e8eefb] border-[#5b7fc7]/40 text-[#31456e]`) — a cool accent against the warm gold/ivory palette so skills read as a distinct category from items at a glance, no glow (per §6.1d, glow is a sci-fi tell this app avoids). Tapping opens a Codex Popup Card (§6.4C) for that skill.
* **`[[Item / Equipment]]`**: Warm metallic gold pill (`bg-[#e2c275]/15 border-[#9c7a2e]/40 text-[#5a4d3e]`). Tapping opens a Codex Popup Card (§6.4C) for that item. **Double square brackets, not angle brackets** — angle brackets are reserved for the real XML markup the turn response now carries (§3.3/§7.3), so a literal `>Item<` would be a parse hazard rather than styling. `[[Double brackets]]` never collide with XML and sit naturally next to the `[Skill]` single-bracket convention.
* **`'Inner Thoughts / Whispers'`**: Muted ink-toned serif italics, no pill or background — text treatment only, since interiority should feel quieter than an interactive element. Not Codex-linked; thoughts don't have entries.
* **`{{Term|category}}`** *(new, v2.2)*: Codex keyword link, for the entity categories the first two markers don't already cover — proper nouns worth cross-referencing. `category` is a short code: `npc`, `loc`, `faction`, `quest`, or `beast`, e.g. `{{Mira Sorrengail|npc}}`, `{{The Parapet|loc}}`, `{{Riders Quadrant|faction}}`. Rendered as a subtle dotted underline in Ink on Gold Accent (`underline decoration-dotted decoration-[#9c7a2e]/50 underline-offset-2`) — a literary in-text cross-reference, not another colored pill, consistent with §6.1d's "annotated manuscript" register. Tapping opens a Codex Popup Card the same way a Skill or Item does (§6.4C). Full mechanics — including what happens when the term doesn't match an existing Codex entry — in §5.14.

All four markers share one interaction model: tap → Codex Popup Card, never a jarring full-screen navigation. See §6.4C for the popup component and §5.14 for how `{{Term|category}}` resolves against the Codex.

### 4.3 9-Tier Turn State Matrix

| Turn State | Visual Theme & Badge | Narrative Focus & Mechanical Impact |
| --- | --- | --- |
| **`PEACE`** | `bg-amber-50 border-amber-300 text-amber-800` | Ambient travel, town interaction, downtime, sensory worldbuilding. |
| **`COMBAT`** | `bg-rose-50 border-rose-300 text-rose-800` | Fully narrative-adjudicated (§5.1) — resolved like any other narrative state, bounded by Condition Tags and the `compareTiers()` hint in context, never by a precomputed number. |
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

| Prose Depth Mode | Target Token Output | Target Word Range (after XML overhead) | `max_output_tokens` (generous headroom) | Operational Focus & Narrative Output |
| --- | --- | --- | --- | --- |
| **CONCISE** | ~600–800 tokens | ~460–615 words | **1,280** | Direct, action-oriented narration. Quick spatial updates, core tactical outcomes, minimal fluff. Best for combat-heavy or high-frequency mobile sessions. |
| **BALANCED** *(Default)* | ~1,100–1,400 tokens | ~845–1,075 words | **2,048** | Standard novel cadence. Rich environmental texture, tactical strike weight, balanced NPC dialogue. |
| **IMMERSIVE (DEEP)** | ~2,800–4,000 tokens | ~2,155–3,075 words | **6,144** | Full authorial fantasy prose. Multi-paragraph sensory density, deep body language, atmosphere, room geometry. |

Word ranges assume ~1.3 tokens/word, with less structural overhead to subtract than the old JSON format carried (the `<sync>` block's attribute="value" pairs cost fewer tokens than JSON's `"key":"value"` for the same field, per the live benchmark in §3.3/§7.3). The `max_output_tokens` column is intentionally generous — because a truncated `MAX_TOKENS` cutoff is a worse player-facing bug than a slightly higher per-turn cost, and it's the single biggest source of the "bugs" this system was previously producing. §7.1 and §9.4 use these exact same three numbers; there is only one token-ceiling table in the app, referenced from all three places. IMMERSIVE's own ceiling was raised specifically to give genuinely novel-length turns real room — both the target-length guidance text and the hard `max_output_tokens` ceiling have to move together, since raising the ceiling alone doesn't make the model write longer if it's still being told the old, shorter target.

**Climax Overflow — the one exception to "pick a depth, get that length."** A turn whose own events carry a Class Evolution (§5.1b), a completed quest, or the defeat of a genuinely major adversary is allowed to exceed the player's chosen Prose Depth's target for that turn only (§7.2 rule 2a) — the target stops being a ceiling, not just a floor, so a class-defining moment or a quest's ending isn't compressed into the same room an ordinary turn gets regardless of which depth the player happens to have set. This is backed by a real technical floor, not just a prompt instruction: every turn's `max_output_tokens` is `max(chosen depth's ceiling, IMMERSIVE's ceiling)`, so even a CONCISE or BALANCED player's own climax turn gets IMMERSIVE's full 6,144-token ceiling to actually write into, rather than truncating mid-sentence against a tighter tier's own cap. This is the exception, not the default — it only fires when the turn's own content already earns one of those three markers, never as license to pad an otherwise ordinary turn.

**Context slice addition (every turn):**
```
Target Prose Depth: BALANCED (~1,100-1,400 tokens)
```

Recommend defaulting new players to BALANCED, auto-suggesting CONCISE on detected mobile/cellular conditions (see §9), and reserving IMMERSIVE for chapter climaxes or player-toggled "deep scenes" given its latency cost. §3.3's continuation-recovery path (re-requesting a cut-off response from exactly where it left off) remains as a safety net, but with this much headroom it should trigger rarely.

### 4.5 Narration Style Profile

A second, independent lever from Prose Depth (§4.4): where Prose Depth controls *how long* a turn is, Narration Style controls *how it's written* — sentence rhythm, point of view, diction, pacing, and hallmark devices. It's carried in the system instructions/context slice every turn (§7.2 rule 1a), and the model must respect it the same way it respects the turn-state and rich-text rules already defined in §4.

* **Recommended default voice** (used whenever a campaign has no author-matched or manually written style, and as a strong starting point for Original Mode): *Third-person limited, past tense. Long, sensory sentences that build atmosphere through concrete physical detail — weight, temperature, texture, sound — periodically broken by short, blunt sentences at moments of violence or shock, so pacing itself carries tension. Occasional spare narratorial asides on cost, memory, or fate, never more than a line. Dialogue is economical and purposeful; characters are shown through action, restraint, and what they don't say rather than through exposition.* This is a genuinely good general-purpose literary dark-fantasy register — dense but not purple, varied in rhythm, and it holds up across PEACE, COMBAT, and INTIMACY turns alike without needing per-turn-state tuning.
* **Original Mode**: a free-text Narration Style field at campaign creation (§Phase A.1), pre-filled with the recommended default above as editable placeholder text — the player can keep it, tweak it, or replace it entirely (a different register, a different tense, an influence list, whatever they want).
* **Inspired Mode — "Match Author's Style" toggle**: when enabled (§Phase A.2), the existing one-time world-seeding grounding request is extended with one additional field in the same response — it does **not** fire a second call. The model researches the named author's prose conventions and returns a `narration_style_profile`: a *descriptive* summary of sentence-length variance, tense/POV convention, diction register, recurring imagery motifs, and dialogue tendencies. This is explicitly a style guide for emulation, never a request to quote, paraphrase closely, or reproduce the author's actual text — the returned field is a set of craft parameters ("long compound sentences with embedded clauses," "close third person, present-tense flashbacks," "spare, understated dialogue"), not sample prose.
* **Enforcement.** The active Narration Style text is injected as a labeled line in the JIT context slice every turn (alongside Target Prose Depth), and §7.2's System Instructions gain an explicit rule that this line governs voice for that turn — narrative content rules (§4.1–4.3) still apply underneath it; style shapes *how* those rules are executed, not whether they apply.
* **Mid-campaign override.** The player can edit or replace the active Narration Style at any point from the Settings Drawer (§6.4E) — in-story, not just at creation. Changes apply to the **next turn onward only**; already-generated turns are never retroactively rewritten, the same non-retroactive philosophy already used for Class Evolution in §5.1b. A style change mid-campaign can even be a deliberate narrative beat (e.g., shifting from a measured voice to a fractured one after a DESPAIR-tier event) rather than purely a settings tweak.

---

## 5. Game Components & Mechanics Specifications

### 5.1 Attributes & Condition Tags (No Numeric Pools)

* **Three attributes, ordinal not numeric.** STR/INT/AGI (§Phase B.1 creation, §5.1a growth) are each a `CompetencyTier` — one of five fixed rank words (`lib/tiers.ts`'s `COMPETENCY_TIERS`): `Untrained → Novice → Adept → Expert → Master`. There is no HP/MP/ST pool, no derived-stat formula, and nothing in the schema is a raw magnitude the model has to compute or track.
* **No hidden pools at all.** The old HP/MP/ST trio is gone outright, not renamed. A protagonist's (or adversary's) current state is entirely represented by a `conditions: ConditionTag[]` array (§5.1c) — "how hurt is the player" is answered by reading which named conditions are active (`Bleeding`, `Wounded`, `Exhausted`, `Defeated`, ...), the same way a novel would describe it, not by a bar draining toward zero.
* **Combat is always narrative-adjudicated.** There is no Tactical Mode, no client-precomputed hit/damage math, and no per-player toggle between resolution styles — every prior revision's Combat Resolution Mode setting has been removed entirely, along with `lib/combat.ts`/`lib/derivedStats.ts`. A COMBAT turn resolves exactly the way SOCIAL/EXPLORE/STEALTH turns already did: Gemini narrates an outcome bounded by the [ACTIVE CONTEXT SLICE] — established competency, active Condition Tags on both sides, and a one-line ordinal adjudication hint from `compareTiers()` (§3.1/§4.1) — never a hidden roll, never a formula, never a number the client has to validate for arithmetic correctness.
* **Equipment and skills stay open/flexible rather than a fixed master table.** Weapons/armor/accessories carry freeform `traits: string[]` tags (e.g. `["reach","heavy"]`, §5.9) that are pure narration fuel for the model to weigh in a scene, not a mechanical bonus the client computes. Skills carry an `effort` tier (`minor`/`focused`/`taxing`, §5.9-adjacent, `SkillEntry.effort`) judged narratively against the player's current Condition Tags rather than a numeric MP/ST cost (`lib/skills.ts`'s `checkAffordability` — still advisory, never blocking, same as every prior revision).

### 5.1a Attribute Growth: Milestone Leveling & the Preset Class Dictionary

A class's weight vector (`STR + INT + AGI = 1.0`, same shape as every prior revision) survives this overhaul, but it no longer feeds a per-level point-budget formula into derived pools — there are no pools left to feed. `data/classes.ts`'s `weights` now does exactly two things, both implemented today:

1. **Starting-attribute point-buy split (character creation only).** `NewGame.tsx` / `ProtagonistNodeModal.tsx` / `novelweaver/ProtagonistChapter.tsx` split a fixed starting point pool across STR/INT/AGI proportionally to the chosen class's `weights`, then round each into a starting `CompetencyTier`. Display/creation-time convenience only, not a per-turn mechanic.
2. **Which attribute a Milestone Breakthrough favors.** On a Milestone Leveling trigger (below), `lib/leveling.ts`'s `applyLevelUps` picks the class's single **highest-weight attribute** — its "primary" — and bumps that one `CompetencyTier` up by exactly one rung, capped at `Master`. A Warrior (`STR: 0.60`) always breaks through on STR; a Mage (`INT: 0.70`) always breaks through on INT. This replaces the old proportional `stat_gain = level_budget × weight_vector` formula entirely: no fractional point accumulation, just "the next level nudges your defining trait forward one rank" — narrated as a distinct beat (`App.tsx` logs a `breakthrough`, the same treatment a Class Evolution already gets, never a silent counter).

**Milestone Leveling trigger — unchanged in spirit from prior revisions, both still pure client-side checks against fields the schema already emits (0 extra tokens, no new schema field; the model never states or requests a level):**
  * **+1 level** on every `quest_update` reaching `status="completed"` this turn. `quest_update` still doesn't carry a Main/Side/Secret tier to gate on, so every completion counts for now (§8 revisits this if a campaign's pacing wants it narrower).
  * **+1 level** at every Chapter Milestone boundary — `lib/leveling.ts`'s `isChapterBoundary`, currently every 15th turn (`CHAPTER_TURN_INTERVAL`) — independent of quest completions that chapter.

Classes live as flat entries in `data/classes.ts` (`PRESET_CLASSES`), the current roster:

```ts
{ id: 'warrior',           name: 'Warrior',        weights: { STR: 0.60, INT: 0.10, AGI: 0.30 } }
{ id: 'assassin',          name: 'Assassin',       weights: { STR: 0.15, INT: 0.15, AGI: 0.70 } }
{ id: 'dragon_rider',      name: 'Dragon Rider',   weights: { STR: 0.35, INT: 0.30, AGI: 0.35 } }
{ id: 'dark_monarch',      name: 'Shadow Monarch', weights: { STR: 0.55, INT: 0.20, AGI: 0.25 } }
{ id: 'necromancer',       name: 'Necromancer',    weights: { STR: 0.20, INT: 0.55, AGI: 0.25 } }
{ id: 'summoner',          name: 'Summoner',       weights: { STR: 0.15, INT: 0.45, AGI: 0.40 } }
{ id: 'mage',              name: 'Mage',           weights: { STR: 0.05, INT: 0.70, AGI: 0.25 } }
{ id: 'tank',              name: 'Tank',           weights: { STR: 0.70, INT: 0.05, AGI: 0.25 } }
{ id: 'paladin',           name: 'Paladin',        weights: { STR: 0.40, INT: 0.40, AGI: 0.20 } }
{ id: 'apprentice_scribe', name: 'Scribe',         weights: { STR: 0.10, INT: 0.65, AGI: 0.25 } }
```

The roster is still genuinely open-ended — any future class is one more line, validated to sum to 1.0 — but a new class now only needs to answer "which attribute is this class's defining trait," not tune a derived-pool curve. (The old L1/L15/L30 sample-pools table from earlier revisions is retired along with the pools it illustrated.)

**Two class dictionaries, one schema — unchanged.** This is the **Preset Class Dictionary** (bundled, zero-token, curated). Player-typed classes resolved via §Phase B.2a's grounded call are written into a second, per-player **Custom Class Dictionary** using the same `{ id, weights }` shape (plus `flavor_summary`/`suggested_quick_slots` captured at grounding time) — Milestone Leveling and Class Evolution (§5.1b) treat entries from either dictionary identically. The client checks Custom before Preset when resolving a `class_id` so a player's grounded "Windrunner" always resolves to their own researched vector, not a same-named preset.

### 5.1b Class Evolution (Single-Slot, Story-Driven)

Tale Dives protagonists carry **exactly one active class at a time** — no locked second axis, no permanently-tracked parallel identity. Since attribute growth no longer routes through a derived-pool formula, a class is simply "which attribute a Milestone Breakthrough favors, and what the class is called" — one slot that can change is simpler than two slots that blend, and gets to the same story beats.

* **Evolution reuses Class Grounding, unchanged.** A class can change mid-campaign — Violet moving from Apprentice Scribe to Rider (Appendix A) is the canonical example — through the exact same single grounded call already defined at creation (§Phase B.2a), fired again when a story trigger occurs: a completed quest, a world flag, a specific NPC bond. This reuses the existing `quest_update`/`flag_add` schema fields and the `<class_evo>` sync tag (§7.3) — no new mechanic type, no new call shape.
* **The new class replaces the old one outright.** `App.tsx`'s turn-loop resolves `<class_evo>` via `findClassById` (strict — an unrecognized id is rejected, never silently treated as a fallback) and swaps `classId`/`className` in one step; a same-class "evolution" (already this class) is a no-op rather than a banner. There's no averaging or blending vector to maintain.
* **Non-retroactive, same principle as before.** Attribute points already earned stay exactly as played. Only the next Milestone Breakthrough forward picks its favored attribute from the new class's weight vector — the level-up that fired this same turn, if any, still used the old class's primary.
* **Manual evolution.** A player can also trigger this from Codex CRUD (Character Sheet / Skills) without waiting for a story trigger — the same "steer state directly" philosophy already established for auto-logged entries (§5.10) and Codex Discovery (§5.12).
* **UI note.** The Chronicle surfaces an evolution as a distinct narrative beat (a banner/toast, not a silent stat change) — the same treatment principle as a Codex Discovery reveal (§5.12) or a Milestone Breakthrough, just for the character sheet instead of the Codex.

### 5.1c Condition Tags: Add, Remove, Expire

Replaces the old "Direct Stat Modification" system entirely — there are no attribute/pool bonus channels anymore, no `stat_grant`, and equipment no longer computes a mechanical bonus on equip/unequip. Instead, `lib/conditions.ts` owns a single client-side mechanic for both the player and the current combat opponent (`Player.conditions`/`CombatState.enemyConditions`):

* **Two kinds.** `duration` — auto-expires after a fixed number of in-fiction hours (`Bleeding`, `Exhausted`, `Blessed`, ...); `narrative` — persists until the story itself lifts it via `<cond rem>` (a curse, a broken bone, a debt owed) and **never** silently auto-expires.
* **`COMMON_CONDITIONS` is the zero-attribute common case.** A client-side lookup table of well-known condition names and their default kind/duration means the model only needs to write `<cond add="Bleeding" />` — no `kind`/`dur_h` required. Those two attributes are escape hatches for a genuinely novel condition name not in the table; an unrecognized name given neither defaults to `narrative`, never to silently auto-expiring (never guess a duration for something the client doesn't recognize).
* **`expireConditions` runs once per turn**, in the same place `resolveCraftingJobs` already runs — comparing each duration-condition's `expiresAt` against the current `GameTime` via `isTimeReached`, reusing the exact time-comparison primitive crafting already established rather than a second one.
* **Sentinel `Defeated` tag.** See §5.7 — Player Defeat is now signaled by a `<cond add="Defeated">` rather than an HP-reaches-zero check, since there's no HP pool anymore.

### Combat Resolution — Always Narrative

Earlier revisions of this spec offered a Tactical/Narrative toggle (client-precomputed damage math vs. narrated outcome). That toggle, `lib/combat.ts`, and every `Combat Resolution Mode`/`!tactical_combat`/`!narrative_combat` surface tied to it have been removed outright — narrative resolution is no longer an opt-in mode, it is simply how combat works now (§5.1). Any remaining reference elsewhere in this document to a "Tactical Mode" or a resolution-mode setting is stale and should be read as removed.

### 5.2 Four-Tier Currency Engine (Base Copper Storage)

To prevent currency math hallucinations, React stores total wealth as a single base copper integer ($c_{\text{total}}$):

$$1\text{ Platinum (P)} = 100\text{ Gold (G)} = 10,000\text{ Silver (S)} = 1,000,000\text{ Base Copper (C)}$$

* Gemini only emits net copper deltas (e.g., `"c": 15000` for $+1.5\text{ Gold}$).
* Client side automatically displays metallic badges: `1P 25G 50S 0C`.

### 5.3 Three-Branch Summoning & Minion Engine

These are class-specific ability kits (§Phase B.2), not a mandatory first choice — a player only has access to one of these if their active class actually grants it, whether that's a preset pick or a Class Evolution result (§5.1b). A scholarly class like Apprentice Scribe has none of these until, or unless, evolution moves the character into one.

1. **Dark Monarch (Shadow Extraction)**: Consumes one harvestable corpse from a slain adversary's `BestiaryEntry.corpseCount` (§5.13 — folded from the old standalone `Campaign.corpses` tag stack into a per-species count directly on the Bestiary entry). Player executes `!arise` to extract a shadow unit into a persistent army, decrementing that species' `corpseCount` by one.
2. **Classic Necromancer (Reanimation)**: Uses ambient commodity counters (`bone_dust: 12`) via ordinary inventory (`<item>`, §7.3). Spends 1 Bone Dust to animate skeletal infantry via `!raise_skeleton` — no MP cost, since MP no longer exists (§5.1); judged instead against the caster's current Condition Tags the same way any `taxing`-effort skill is.
3. **Contract Gate Summoner (Planar Gates)**: Zero corpses required. Calls elemental or celestial familiars via `!summon`. This is the one place a genuine numeric pool survives on purpose — `Minion.hpMax`/`mpUpkeep` (§5.1's Condition Tag model does not apply to summoned minions, which are explicitly out of scope for this overhaul; see `types.ts`'s note on `Minion`).

### 5.4 5-Tier Faction Reputation & Rivalry System

* **Standings**: Tier -2 (Hostile), Tier -1 (Suspicious), Tier 0 (Neutral), Tier +1 (Favored), Tier +2 (Allied).
* **App-Side Rivalry**: Gaining standing with a faction (e.g., `Shadow Guild`) automatically decreases standing with its rival (`Holy Order`) in local React state without consuming LLM tokens.

### 5.5 Romance & Key Contact Memory Engine

* **Proximity Slicing**: Memory blocks for an NPC are **only injected into context when present at the active location node**. Absent NPCs cost **0 tokens**.
* **Two independent CompetencyTier ladders, not one shared axis.** `NpcEntry.affection` and `NpcEntry.trust` (`lib/tiers.ts`'s 5-word `COMPETENCY_TIERS` scale, own wording each) move separately — a mercenary can respect the protagonist's competence (high trust) while disliking them personally (low affection), a real narrative state a single shared axis can't express. The turn schema never sends a magnitude for either: `<npc aff="+|-" trust="+|-">` (§7.3) is a bare sign, a single-step nudge up or down its own ladder — no numeric delta, foreclosing the hallucination risk a raw 0–100 number invited. `stage` (`Stranger → Acquaintance → Friend → Confidant → Beloved`) is still derived from `affection` alone, unchanged.
* **`resolve` (optional).** A third, independent `CompetencyTier` — an NPC's social/rhetorical resistance, set or revised by the LLM on introduction the same way a Bestiary entry's `threatTier` is (§5.13). Used only for the SOCIAL `compareTiers()` adjudication hint (§3.1/§4.1); omitted for minor NPCs who never need it.
* **Deed Array & Micro-Memory**: Snake_case deed tags (`["saved_brother", "gifted_pendant"]`) paired with a single 15-word summary (`"Grateful for saving her brother; touched by the obsidian pendant."`) — unchanged.

### 5.6 World Impact Ledger (`flag_add`)

Major choices append persistent snake_case flags to local state (`["burned_basgiath_bridge", "spared_archive_guard"]`). Regional flags are re-injected into context whenever the player visits related locations.

### 5.7 Player Defeat State

There's no HP pool to reach 0 anymore (§5.1) — Player Defeat is instead signaled by a sentinel `<cond add="Defeated">` Condition Tag (`turnContract.ts`'s COMBAT rule instructs the model to add it exactly when a defeat beat is narrated). `App.tsx`'s turn-loop checks for the `defeated` condition id immediately after conditions are applied each turn; if present, it's consumed on the spot (filtered back out, never left lingering as a literal persistent tag once the recovery beat fires) and combat state is cleared (`nextCombat = { active: false }`). The narrative resolution itself — waking at the nearest safe node with a penalty, a scripted consequence for a boss/story fight — is still Gemini's to narrate; the client only owns detecting the sentinel and closing out combat state, the same "client owns the mechanism, model owns the fiction" split as everywhere else in this system.

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
4. Recommend 1 concurrent crafting slot by default; additional slots make a natural progression reward (or a hook for an Artisan/Tinkerer-style class — crafting speed or slot count could scale off an INT `CompetencyTier`, §5.1).

**Resource management, using the same timer mechanic in reverse:** flag select materials as `"perishable": true` with a `spoil_hours` value in the item dictionary. Checked the same way as craft completion each turn — once `spoil_hours` elapses since acquisition, the item is silently removed or downgraded. This gives hoarding real stakes (can't stockpile rare reagents indefinitely) without adding a second engine — it's the identical timestamp-comparison logic already built for crafting completion, just running the other direction. Recommend also a simple per-material stack cap (e.g. 99) to keep the Materials view from growing unbounded, enforced the same way inventory sanity-checks already are.

**UI placement**: Crafting gets its own Codex category, **Craft** (§6.4D). Folding it into "Items" was the original either/or option, but Items already carries 7 item-type filters (§5.9) — a crafting station screen with queued jobs and a live countdown (`complete_time − current_time`, styled in the JetBrains Mono metadata typeface used for timestamps elsewhere) reads more clearly as its own category than as an eighth filter bolted onto an already-dense one.

### 5.8a Projects: Multi-Stage Tracking Beyond Crafting

A broader, deliberately **separate** system alongside Crafting (§5.8) — `lib/projects.ts`, untouched from `lib/crafting.ts`/`data/recipes.ts` — for a long-running narrative endeavor the player wants to check in on rather than just be told about once: a city under construction, a satellite module mid-repair, a siege engine being built. Crafting stays the narrow "spend materials, wait N hours, collect output" queue; Projects is the open-ended "track stages, prerequisites, and a possible ETA, narrated forward by the LLM" registry.

* **`ProjectEntry`** (`Campaign.projects: Dict<ProjectEntry>`): `name`, `stages: {label, done}[]`, optional `prerequisites: string[]` (freeform description strings, e.g. `"200 Timber, a master mason"`), optional `eta?: GameTime`, `status?: 'active' | 'completed' | 'stalled'`, `note?: string`.
* **Never auto-completes on a timer.** Unlike a `CraftingJob`, a Project's completion is always an explicit LLM-narrated update — `<project id="..." stat="advanced|completed|failed" stage="N" note="...">` (§7.3) — since a project isn't a fire-and-forget recipe queue. A first mention with no prior entry mints a bare stub (title-cased from the id) via the same `ensureEntry` auto-registration pattern every other Codex category uses (§5.14).
* **`isProjectReady(project, currentTime)`** is the read-only gating primitive: `true` when there's no `eta` set, or once the current `GameTime` reaches it (`isTimeReached`, the same time-comparison primitive `lib/crafting.ts`'s `resolveCraftingJobs` already uses) — this is what lets the client (or the model, via context) correctly say "this isn't ready yet, so you can't do X" rather than guessing.
* **Codex placement**: its own category, **Projects** (§6.4D) — CRUD-editable exactly like every other category, for the same "the client's inferred state is a reasonable default, not a guaranteed-perfect one" reason as an auto-logged location or adversary stub.

### 5.9 Item Type Taxonomy

Earlier drafts used a loose free-text `category` field on inventory entries. This is now a **closed enum**, referenced identically by the Codex UI (Items filters), the Shadow Referee's inventory sanity check (§3.2), and the crafting system's `type: "material"` tag (§5.8):

| Type | Slot Behavior | Examples |
| --- | --- | --- |
| **Weapon** | Equippable, 1 active at a time (or per-hand if dual-wield is enabled later) | `[[Obsidian Dagger]]`, `[[Rift Stalker Fang]]` |
| **Armor** | Equippable, one per body region (head/chest/hands/feet — start with a single "armor" slot and split later if needed) | `[[Ashgate Plate]]`, `[[Wraithveil Cloak]]` |
| **Accessory** | Equippable, 1–2 slots (rings/amulets/trinkets) | `[[Obsidian Signet]]`, `[[Pendant of Quiet Steps]]` |
| **Tool** | Non-combat equippable/usable; enables an action class rather than dealing damage (lockpicks, climbing gear, a crafting instrument) | `[[Thieves' Picks]]`, `[[Surveyor's Lens]]` |
| **Key Item** | Non-stackable, cannot be sold or discarded, tied to quest/story logic | `[[Ashgate Vault Sigil]]` |
| **Consumable** | Stackable, single-use, applies an immediate effect and is removed on use | `[[Elixir of Vigor]]`, `[[Bone Dust Pouch]]` |
| **Material** | Stackable, used only as crafting input (§5.8); never equippable | `iron_ore`, `bone_dust` |

**Schema note**: item add/remove now folds the id into the attribute itself — `<item add="ITEM_ID" name="..." type="..." qty="N" desc="..." traits="...">` / `<item rem="ITEM_ID" qty="N">` (§7.3) — an implicit type comes from the item's Codex definition on repeat mentions, but `name`/`type`/`qty` are required on every `add` so a real item name is never lossily guessed from its id.

**Traits, not stat bonuses.** Weapon, Armor, and Accessory entries carry an optional `traits: string[]` tag list (`ItemEntry.traits`, e.g. `["reach","heavy"]`) — this replaces the old numeric `stat_bonus` object entirely (§5.1). Traits are pure narrative flavor for the model to factor into how a fight or scene reads; there is no mechanical tier-bump bookkeeping on equip/unequip, no client-side computation at all. This is a deliberate simplification over inventing a second mechanical system just for gear.

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

### 5.13 Adversary Stat Blocks & Auto-Registration (Bestiary, Threat Tiers, Corpses)

No enemy HP pool or damage value exists to compute anymore (§5.1) — an adversary's entire "stat block" is now a single fixed-vocabulary word plus whatever Condition Tags are currently active on it, exactly the same shape as the player.

* **`BestiaryEntry.threatTier`** is a `ThreatTierToken` — one of `lib/tiers.ts`'s 8-word `THREAT_TIERS` scale (`trivial → minor → notable → dangerous → severe → extreme → legendary → mythic`), or the client-only placeholder `'unknown'` for a bare `{{Name|beast}}` mention that hasn't actually been established in a scene yet (never a value the model itself is asked to emit). The LLM sets/revises it via `<enrich beast="ID" ...>` (§7.3) on introduction, same trigger point Location Auto-Registration uses for a first-visit description.
* **`conditions?: ConditionTag[]`** mirrors the player's — a beast or hazard can carry the same narrative status tags (`Bleeding`, `Stunned`, ...) the protagonist can, added/removed via the `id="enemy"`-scoped `<cond>` variant during the active encounter (§5.1c), and read into `CombatState.enemyConditions` for the duration of the fight.
* **Player-facing reskin, client-side only.** `THREAT_TIERS` is what the model always emits; `WorldData.tierSkin.threatLabels` (set in the TaleDiveWeaver's Narrative node, §6) is a purely-cosmetic 8-entry display substitution — a couple of built-in flavor packs (`plain`, the default; `rank`, an `E/D/C/B/A/S/S+/S++` ladder) plus a fully custom option, resolved client-side via `displayThreatLabel()`. A custom label scheme can never reach the model and can never cause a parse-drift bug, since the wire format never changes.
* **Combat is fully narrative-adjudicated (§5.1).** There is no client-precomputed exchange to feed — `compareTiers()` (§3.1/§4.1) hands the model a one-line ordinal hint (protagonist's relevant `CompetencyTier` vs. the opponent's `threatTier`) as adjudication *guidance*, not a formula input; the outcome itself is Gemini's to narrate, bounded by that hint and the active Condition Tags on both sides.
* **Corpses fold directly onto the Bestiary entry, not a separate Codex category.** `corpseCount?: number` and `lastSlainTime?: GameTime` track how many harvestable corpses of that species currently exist — incremented on a kill, decremented one at a time by `!arise` (§5.3's Dark Monarch branch). This replaces the earlier flat, untyped `Campaign.corpses` tag stack: a harvestable corpse is now always attached to a real, named adversary record instead of a bare id in a separate array.
* **Auto-registration follows the same general pattern as every other Codex category (§5.14).** When Gemini's narration introduces a combat-capable adversary not yet in the Bestiary, the client stubs one in immediately (`autoLogged: true`) from the same `nar`/`act` text it already receives — no extra API call, no new schema field.
* **Codex placement**: **Bestiary** (§6.4D) — encountered adversaries, their threat tier, active conditions, corpse count, and (for repeat/boss-type enemies worth remembering) a short flavor note via `<enrich beast>`. A first encounter is a natural fit for Codex Discovery's `npc_met`-style reveal pattern (§5.12) — the entry can seed `hidden` with a teaser and flip to `known` on first contact.
* **CRUD applies identically**: a player can hand-correct an auto-logged adversary's tier exactly like an auto-logged location (§5.10), for the same reason — the client's inferred stub is a reasonable default, not a guaranteed-perfect one.

### 5.14 Universal Codex Auto-Registration & Keyword Links

§5.10 (Locations) and §5.13 (Adversaries) are both specific cases of one general rule, stated once here: **whenever Gemini's narration references an entity the client doesn't yet have a Codex entry for, the client stub-creates one immediately, flags it `autoLogged: true`, and moves on** — the Codex is something the game fills in as it's played, never something the player has to pre-build or the model has to explicitly "generate into." This is how content ends up in the Codex at all, alongside the one-time bulk seeding a grounding call does at creation (§Phase A.2, §5.12).

Two trigger surfaces feed this, and a turn can use either or both:

* **Implicit, via required schema fields already sent every turn.** `loc`/`locdisp` for Locations (§5.10); combat context and `<enrich beast>` for Adversaries (§5.13). Nothing new here — this is what those two sections already specify.
* **Explicit, via `{{Term|category}}` keyword links in `nar` (§4.2, new in v2.2).** This is what makes NPCs, Factions, Lore, and Quests work the same way Locations and Adversaries always have, and it's what powers the tappable Codex Popup Card (§6.4C):
  1. The client scans the streamed `nar` string for `{{Term|category}}` matches — pure client-side string parsing, the same free operation already required to render `[Skill]`/`[[Item]]`/`'Thought'` markup, so this adds no API cost (§3.6).
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
* **Metadata & System Codes** (`JetBrains Mono`, monospace, weights 400/500): Timestamps, day/time tracking, currency counters, Condition Tag/tier-word badges, and model selection dropdowns.

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
  * **Codex Popup Card** *(new, v2.2)*: tapping any `[Skill]`, `[[Item]]`, or `{{Term|category}}` link (§4.2) opens a small glassmorphic (§6.1a) card anchored near the tap point — scale/fade in via Framer Motion (§6.0), never a full-screen navigation. It reuses the matching category's Entry Card fields from §6.4D (so an NPC popup shows the same Trust/Affection bars an NPC Entry Card would, a Location popup shows the same Danger/Standing badges, etc.) plus an **"Open in Codex →"** button that drills into the full Entry Detail (§6.4D) for anyone who wants more. A tap on a still-`hidden` entry (§5.12) shows the masked `???`/teaser card instead — the popup never spoils what the Entry Grid wouldn't show yet. Dismisses on outside-tap or a close affordance; the parchment scroll position is preserved underneath.
* **Right Drawer Vertical Icon Dock**: Card Surface styling (`#fdfaf0`, §6.1), positioned alongside the parchment reader. Features an `INFO` toggle, a Turns-in-page count badge, a Chapter Summaries count badge, and World DB / NPC Directory shortcuts.
* **Quick-Slot Tray** *(new, v1.7)*: [CUT BY USER] a persistent, always-visible horizontal row of the 3 equipped active skills (§Phase B.3), docked directly above the floating action-input prompt. This is deliberately **not** inside the Radial Menu (§6.5) — quick-slots are the single highest-frequency action in a turn loop, so they get a permanent one-tap surface rather than an extra tap through an expandable menu. Each slot shows its icon, name, and effort-tier pill (`minor`/`focused`/`taxing`, §5.1 — replaces the old MP/ST cost display), and dims (not hides) when advised against by the Shadow Referee's affordability check against the player's current Condition Tags (§3.2).
* **Floating Action-Input Prompt**: the decorated bottom input bar (§6.1 Prompt Input Tray tokens) — this is where the player types actions, and where `/` and `!` (§6.6) trigger their respective command palettes. The Fantasy Radial Menu's FAB (§6.5) is centered directly above/on this prompt.
* **Condition-Derived Status & Currency Footer**: client-side status strip. There's no HP/MP/ST bar anymore (§5.1) — instead a coarse condition-derived banner (e.g. `Fine` → `Hurt` → `Bloodied` → `Critical`, derived from the count/severity of the player's currently active negative Condition Tags) plus the metallic currency display (`1P 25G 50S 0C`) — both rendered entirely from local state, no API call involved.

#### D. Database & Codex Directory

**Three-level drill-down**, consistent across every category: **Category List → Entry Grid → Entry Detail**. The player never lands on a wall of text; each level narrows before showing full content, and Framer Motion (§6.0) animates the forward/back transition as a horizontal push rather than a hard cut, so the drill-down reads as spatial navigation rather than a page reload.

1. **Category List** (top level): the 12 categories below, each shown as a row with its Lucide icon (§6.1b), a live entry count (hidden entries count toward the total, so a "12" total hints there's more to find even before it's discovered), and a right-chevron. Tapping a row pushes into that category's Entry Grid. Lazy-loaded on drawer-open per §9.2 — none of this hydrates at session start.
2. **Entry Grid** (per category): a responsive grid/list of **Entry Cards** (templates below) — glassmorphic (§6.1a), each summarizing just enough to recognize and select the right entry. A search/filter bar sits above the grid (by name, and by category-specific filters — e.g. Locations filter by Danger Level or Faction Owner, Items filter by Item Type per §5.9). Entries with `discovery.state === "hidden"` (§5.12) render masked: name replaced with `???`, portrait/emblem replaced with a `Lock` glyph (§6.1b), and the card shows the entry's short `teaser` line if one was seeded, in place of its normal summary.
3. **Entry Detail** (drill-down target): the full record — every field the category tracks — plus CRUD actions (Edit/Delete) where applicable. Tapping into a hidden entry opens a minimal "??? — not yet discovered" detail rather than the full record; no fields beyond the teaser are exposed outside CRUD Edit Mode.

**Categories** (current implementation, ordered by how often a player actually opens each during play rather than by topic — quests/NPCs/items/locations/bestiary are live-reference lookups made mid-turn, faction/lore/projects are occasional check-ins, chapters/campaign/crafting are read once and rarely revisited):

1. Quests (Main, Side, Ambition & Secret Ambition) — driven by the `<quest>` sync tag (§7.3)
2. NPCs (Companions & Trust/Affection Ratings, §5.5)
3. Skills (Spells & Abilities)
4. Items (Weapons, Armor, Accessories, Tools, Key Items, Consumables, Materials — §5.9)
5. Locations (Regions, Danger Levels, Faction Owner & Standing — §5.11)
6. **Bestiary** — encountered adversaries (§5.13): threat tier, active Condition Tags, and (folded in from the retired standalone Corpses category) harvestable corpse count per species, filled in as the player fights new enemy types.
7. **Projects** (§5.8a) — multi-stage builds, repairs, and other long-running endeavors, distinct from Crafting below.
8. Faction (Political Cabals & Territory, §5.4)
9. Lore (Legends, myths & discovered secrets)
10. **Chapters** — curated, chronological. One entry per chapter, populated from the 2-sentence Chapter Milestone summaries generated in Phase E (§2). This is the player-facing recap.
11. **Campaign** — merges the earlier separate "Realm" and "Character" surfaces into one tab: cosmology/setting/tone plus the protagonist's attributes (as `CompetencyTier` words, §5.1), equipped gear, and active class. Also surfaces the campaign's active Narration Style (§4.5) as a read-only field with a shortcut into the Settings Drawer (§6.4E) to change it.
12. **Crafting** — the recipe-based crafting system (§5.8): known recipes, station requirements, and the live crafting queue with countdown. Kept distinct from Projects (§5.8a) — Crafting is the narrow "spend materials, wait N hours, collect output" queue, Projects is the open-ended multi-stage tracker.

**Codex CRUD.** Every category above (except Chapters, a generated recap, and Master Archives, a raw log) supports full Create/Read/Update/Delete via the UI — the player can add, edit, or remove any NPC, Faction, Location, Skill, Item, Quest, Bestiary entry, Project, or Recipe by hand. This is the correction path for auto-logged entries (§5.10) and for any state the player wants to fix directly rather than steering the LLM toward. **CRUD Edit Mode also bypasses masking** (§5.12): every entry shows its full content regardless of `discovery.state`, plus an editable Reveal Condition control (trigger type + target flag/location/NPC/quest), so a player can hand-author discovery pacing exactly like any other field.

**Entry Card templates (Entry Grid level)** — each category gets a card shape suited to what players actually scan for, rather than one generic card reused everywhere. (Masked/hidden cards, §5.12, override all of this with the `???` + teaser treatment described above, regardless of category.)

| Category | Card Shows | Card Badge(s) |
| --- | --- | --- |
| NPCs | Portrait placeholder, name, current Stage (`Stranger` → `Beloved`) | Trust tier + Affection tier as `CompetencyTier` word pills (§5.5), auto-logged flag if unmet-but-mentioned |
| Factions | Emblem placeholder, faction name, one-line description | Rivalry indicator (linked rival faction), current Reputation Tier (§5.4) as a −2..+2 pip strip |
| Locations | Name, region, one-line description | Danger Level, Faction Owner + derived Standing badge (green/gray/red, §5.11), `autoLogged: true` "auto" badge where applicable (§5.10) |
| Skills | Skill name, owning class icon | Effort tier pill (`minor`/`focused`/`taxing`, §5.1), `[Active Skill]` glow styling matching in-narrative formatting (§4.2) |
| Items | Item name, Item Type icon (§5.9) | Rarity/type pill, equipped indicator if currently worn/wielded, trait tags (§5.9) |
| Quests | Quest title, type (Main/Side/Ambition/Secret Ambition) | Status badge (`advanced`/`completed`/`failed`, §7.3), objective checklist preview |
| Bestiary | Adversary name, Threat Tier badge (reskinned per `WorldData.tierSkin`, §5.13) | `autoLogged: true` "auto" badge where applicable, active Condition Tag pills, corpse count if harvestable, boss/elite accent for higher tiers |
| Projects | Project name, stage progress (`N of M done`) | Status badge (`active`/`completed`/`stalled`), ETA countdown badge if set (JetBrains Mono) |
| Crafting | Recipe/output item name, station icon (forge/bench/etc.) | Live countdown badge if queued (`complete_time − current_time`, JetBrains Mono), "Ready" badge if complete and uncollected |
| Chapters | Chapter number + title, 2-sentence milestone summary | none — read-only recap |

All cards share the same glass surface recipe (§6.1a) and the same tap target — the whole card is tappable, pushing into Entry Detail, not just a "view" link.

**Plot Chapters vs. Master Archives — resolves v1.1 ambiguity.** These are deliberately different views over the same underlying log:
- **Plot Chapters** (above, in the Codex): short, curated, player-facing recap — what a reader would want to skim to remember the story so far.
- **Master Archives** (Launcher toolbar): the full raw, unfiltered turn-by-turn log, including every `nar` string ever generated. Intended as a debug/reference tool and for players who want to re-read a scene verbatim, not as the primary recap surface.

#### E. Settings Drawer (Pre-Campaign & In-Story)

One glassmorphic (§6.1a) drawer component, reused in two contexts — opened from the `Settings` gear on the Main Menu (§6.4B) before a campaign exists, and from the `Settings` gear in the Chronicle top strip (§6.4C) or the Radial Menu (§6.5) during one. The contents are contextual, not duplicated components:

* **API Settings** (§3.4): Provider, Model ID, API Key, Temperature, and the shared Prose Depth token-ceiling table (§4.4) — available in both contexts, since a player may need to fix credentials mid-session (this is also what the API Failure Diagnostics Panel's "Open API Settings" action, §3.5, deep-links into).
* **Narration Style** (§4.5): the active style text, editable in both contexts. In-story edits apply from the next turn onward only, per §4.5.
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
  * `User` **Character** — attributes as `CompetencyTier` words, active Condition Tags (§5.1), equipped gear, and active class (including grounded custom classes, §Phase B.2a).
  * `Map` **World Map** — Locations category (§5.11), current-location-centered.
  * `Save` **Save & Export** — writes current state per the Local Save mechanism (§6.4B).
  * `Settings` **Settings** — opens the Settings Drawer (§6.4E) in its in-story context.
  * `Hammer` **Crafting** *(conditional)* — only appears in the ring while a crafting job is queued or a completed job is awaiting collection (§5.8); carries the same live countdown/"Ready" badge as its Craft Entry Card (§6.4D). Absent otherwise, keeping the resting ring at 7 rather than 8.
* **Touch target sizing**: each radial option meets the 44×44px minimum from §9.3, with enough angular spacing between icons that adjacent options don't compete for a thumb tap on narrow viewports.
* **State awareness**: the FAB itself swaps icon/glow briefly to reflect the active 9-Tier Turn State badge color (§4.3) when collapsed, so its resting state carries information rather than sitting static.

### 6.6 Slash & Bang Command Manager

Both live at the same floating action-input prompt described in §6.4C, but they are deliberately two different systems rather than one command list, because they resolve differently:

* **`/` — In-Fiction Commands.** Typing `/` at the start of the input opens a glassmorphic **Command Palette** overlay above the tray, auto-animating its height as the filtered list narrows with each keystroke (§6.0). Listed commands are pulled dynamically from: universal commands (`/inventory`, `/codex`, `/map`) plus whatever the player's *current* active class grants (a summon-type command per §5.3, if any) — refreshed automatically if Class Evolution (§5.1b) changes that class mid-campaign. Selecting or completing a `/` command sends it through the normal action pipeline (§2 Phase D) exactly like typed prose — it can carry an effort tier (§5.1), gets narrated, and is subject to the Shadow Referee (§3.2). This is flavor-preserving shorthand for actions the player could otherwise type in full sentences, not a separate mechanic.
* **`!` — Out-of-Fiction System Commands.** Typing `!` opens a visually distinct palette (different accent tint, `Terminal` icon, §6.1b) for meta/OOC actions that never reach the LLM as narrative and cost 0 tokens: `!pause` (freezes into the `PAUSE` turn state, §4.3), `!regenerate` (re-rolls the last narration with the same context slice), `!rewind` (reverts to the previous committed turn, client-side state only), `!note` (attaches a private player note to the current turn, never sent in context), `!settings` (deep-links into API Settings, §3.4), `!corpses` (lists current harvestable corpse counts per Bestiary species, §5.13), and the three Summoning bang commands (§5.3, class-gated) `!arise` / `!raise_skeleton` / `!summon`. These are resolved entirely client-side, matching the `PAUSE` "0 API tokens" behavior already defined in §4.3. There is no Combat Resolution Mode override command anymore — combat is always narrative (§5.1), so there is nothing left to toggle per-scene.
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
| **Gemini 3.8 Flash** | `gemini-3.8-flash` | Newest Flash model as of writing; strong at structured/agentic output. Good pick for turns where output-format adherence matters most. |
| **Gemini 3.7 Flash** | `gemini-3.7-flash` | Prior-gen Flash; solid fallback if 3.8 pricing/availability shifts. |
| **Gemini 3.6 Flash** | `gemini-3.6-flash` | Two generations back; kept for back-compat testing. |
| **Gemini 3.5 Flash** | `gemini-3.5-flash` | Near-Pro reasoning at Flash cost — good middle tier for COMBAT/INSIGHT turns needing more coherent multi-entity tracking. |
| **Gemini 3.5 Flash Lite** *(current app default — `data/store.ts`)* | `gemini-3.5-flash-lite` | Ultra-fast, cheapest option. Best for routine PEACE/EXPLORE turns and high-frequency play sessions where prose quality can flex slightly for speed. |
| **Gemini 3.1 Pro Preview** *(High Reasoning)* | `gemini-3.1-pro-preview` | Highest reasoning depth and cost. Best reserved for **Inspired Mode** world-generation (one-time faction/lore seeding) rather than routine turns, given per-token cost. |
| **Gemini 3.1 Flash Lite** | `gemini-3.1-flash-lite` | Budget option, one generation behind the current default. |
| **Gemini 3 Flash Preview** | `gemini-3-flash-preview` | Legacy preview; keep only for back-compat testing, not recommended for new sessions. |

**Response Format**: plain text (`system_instruction` only — no `responseMimeType`/`responseSchema`). The turn response is the hybrid format from §3.3/§7.2/§7.3: a `<nar>` block of plain prose followed by a `<sync>` block of self-closing XML tags, not a JSON object. This is a deliberate departure from Gemini's native JSON-schema structured-output mode (`application/json` + `responseSchema`) — a live token benchmark run against the real Gemini tokenizer this project measured the equivalent XML output at ~25% fewer tokens than the JSON-schema response for the same turn content, so the JSON-schema path was dropped for the live Gemini integration in favor of parsing the plain-text XML response client-side (§3.3). `supportsJsonSchema` in the provider capability map (§3.4) still reflects whether *Gemini itself* supports schema mode — it does — this is a Tale-Dives-side choice to not use it, not a provider limitation.
**Temperature**: `0.7`

**Max Output Tokens — set per Prose Depth Mode, not globally** (see §4.4 — this is the same table, not a second one). A single flat cap either truncates IMMERSIVE turns mid-response or wastes budget on CONCISE ones:

| Prose Depth Mode | Narrative Target | `max_output_tokens` (generous headroom) |
| --- | --- | --- |
| CONCISE | ~600–800 tokens | 1,280 |
| BALANCED | ~1,100–1,400 tokens | 2,048 |
| IMMERSIVE | ~2,800–4,000 tokens | 6,144 |

**Climax Overflow floor (§4.4/§7.2 rule 2a)**: every *actual* API call's `max_output_tokens` is `max(chosen Prose Depth's ceiling, IMMERSIVE's ceiling)`, not the bare per-depth value above — so a CONCISE or BALANCED turn that ends up carrying a Class Evolution, a completed quest, or a major kill still gets IMMERSIVE's full 6,144-token ceiling to write into, rather than truncating against its own tier's tighter cap. The table above is the *per-tier* target; the floor is what's actually sent to the API on every single turn.

**Model choice is manual and session-wide, not per-turn-type.** The table in §7.1 above lists what each Gemini variant is good at so the player can make one informed pick in API Settings (§3.4) — it is not an instruction to switch models automatically per Prose Depth or turn state. That auto-switching behavior existed in pre-1.7 drafts of §9.4 and was removed for reliability; see §9.4 for why.

**Thinking Level**: set `minimal`–`low` for routine turn narration (this is a creative-writing task, not multi-step reasoning, and thinking tokens are spent from the same budget before visible output appears). Reserve `medium`–`high` for the one-time Inspired Mode world-generation call in §7.1 (which now also carries the Narration Style grounding field, §4.5), where deeper reasoning genuinely helps quality.

**Truncation Recovery**: check `finish_reason` on every response. If it returns `MAX_TOKENS` even with the headroom above, do not treat the cut-off response as a Stage 3 parse failure — Stage 2 (§3.3) already extracts whatever `<nar>` prose made it out before the cutoff independently of whether `<sync>` parses, so a mid-generation cutoff degrades gracefully rather than losing the whole turn. The token headroom (and the Climax Overflow floor above) keep an actual cutoff rare in practice.

> Note: Google revises the Gemini model lineup frequently (new Flash point-releases have shipped roughly every 4–6 weeks through 2026). Treat this table as a snapshot — re-verify exact model IDs and pricing in AI Studio before each release rather than hardcoding assumptions long-term.

### 7.2 System Instructions

Paste the text block below into the **System Instructions** field. This is the byte-identical text the live client sends (`turnContract.ts`'s `SYSTEM_INSTRUCTIONS`) — the narrative/craft rules are format-agnostic and unchanged by the XML migration in §7.3 below:

```text
You are the Dungeon Master engine for Tale Dives, an atmospheric fantasy RPG (mature violence and romance themes) set in a reactive, high-stakes world.

NARRATIVE & TONE RULES:
1. Writing Style: Write elaborate, novel-quality third-person prose grounded in sensory detail, distinct NPC voices, and real narrative stakes. Emphasize body language, environmental textures, physical strain, and lighting.
1a. Narration Style Profile: Apply the voice described in "Narration Style" in the context slice for this turn — sentence rhythm, point of view, diction, and pacing. This governs HOW rules 1-6 are executed; it never overrides rule 3 (Player Agency) or rule 5 (Mature Themes boundary).
1b. Paragraph Breaks: Never write "nar" as one dense unbroken block, and never string more than 2-3 sentences together without a line break — break within a paragraph, not just between paragraphs, whenever a beat, focus, or breath shifts. Roughly 2-4 paragraphs for BALANCED depth, more for IMMERSIVE, fewer for CONCISE; vary paragraph length for pacing, the way a novel would.
1c. Thought/Dialogue Isolation: Give any inner thought or spoken/whispered line (the single-quoted material from rule 6) its own line, set apart from the surrounding narration — don't bury it mid-paragraph. A run of several consecutive thoughts or dialogue lines may stay grouped together, one per line, rather than each being forced apart with narration in between.
1d. NPC Behavior: Every present NPC should feel like they're actively responding to what just happened, not reciting a line. Ground their dialogue, body language, and reactions in their established personality, tone of voice, current Trust/Affection toward the player, and stake in the unfolding situation — narrate what they're doing, not only what they say.
1e. Protagonist Framing: When "Protagonist Identity" is present in the context slice, let it shape how the world reacts to the protagonist and what a scene chooses to emphasize — an NPC reading their demeanor, a detail catching their eye because of what they want, a moment landing harder because of a trait or secret already established. This never overrides rule 3 (Player Agency): it steers what you narrate around and about the protagonist, never what they think, say, or decide.
2. Length: Treat the "Prose Depth" in the context slice as a floor to reach, not a ceiling to undercut — a turn that stops short of it is a failure regardless of how the scene resolves. Never default to a short, thin beat; use the full room the depth gives you to develop the scene, the NPCs present, and what's at stake.
2a. Climax Overflow: If this turn's own events are significant enough to carry a class_evolution, a quest_update whose status is "completed", or the defeat of a genuinely major adversary, Prose Depth's target stops being a ceiling too — let the scene run as long as it actually needs to land with real weight, rather than compressing a class evolution or a quest's ending into the same room an ordinary turn gets, regardless of which Prose Depth the player has set. This is the exception, not the default: it applies only when the turn's own content already earns one of those three markers, never as license to pad an otherwise ordinary turn.
3. Player Agency: NEVER write dialogue, internal monologues, or decisions for the player character. Describe the world's reaction to player choices only.
3a. Player Statement Override: Text the player wraps in *asterisks* (e.g. "*I gain +100 HP*") is not an ordinary in-fiction action for you to judge plausible or not — it's an explicit, authoritative directive. Make it real through the normal mechanical channels (deltas/inv_add/stat_grant/etc., still governed by their own field rules and numeric limits — an asterisked claim outside those bounds is honored up to the limit, not rejected outright), then narrate a justification that makes it feel earned or at least explicable in the fiction rather than simply asserting it flatly. This is the one case where you don't get to decide whether something happens — only how it's framed. Unmarked action text keeps its ordinary treatment under rule 3 above: you decide the outcome.
3b. Continuity Callouts: If the player points out an apparent inconsistency in your own prior narration (an item, detail, or fact that changed without an in-story reason), treat their observation as correct and reconcile the story around it — a quiet correction, a character's own explanation, or simply adopting it as true going forward. Never retcon it as the player character's own senses or memory being unreliable unless perception distortion is already an established, deliberate element of this scene (a curse, a hallucinogen, a supernatural fog) — you are not allowed to blame the player for a mistake in your own telling.
4. End most turns on a hook or open decision point rather than a fully resolved beat — make the live options concrete enough (what's in front of the player, what just changed, who's watching) that a plausible next move is legible, even though you never enumerate it as a list.
5. Mature Themes: Violence, moral ambiguity, romance, and tension are welcome and should be written with real narrative weight. All characters are adults. Violence may be graphic and uncensored — do not soften or cut away from it (see the COMBAT guideline below). For romantic/sexual content beyond kissing/embrace, use a clear scene-break transition and resume afterward rather than writing it graphically — this boundary is fixed and does not flex with Trust tier or Prose Depth Mode.
5a. INTIMACY Gating: Before narrating romantic or physical escalation, check the target NPC's Trust value, personality, and currentImpression/relationship note in the context slice — exactly as you would for a SOCIAL request. A Stranger-stage or low-Trust NPC should rebuff, deflect, or slow-play advances in character; only a high-Trust NPC with an established, receptive relationship should reciprocate warmly. The player may always attempt to initiate — the NPC's reaction is what's bounded, never the player's ability to try.
6. Rich Text Formatting Rules (MANDATORY):
   - Enclose active skills, spells, or abilities in square brackets: [Shadow Step], [Arise], [Soul Feast].
   - Enclose items, weapons, keys, or loot in double square brackets: [[Obsidian Dagger]], [[Silver Quill]], [[Bone Fragment]]. Never angle brackets — those are reserved for real XML markup in this output format (see below) and a literal >Item< is a parse error, not styling. [[...]] is its own bracket type with no category code — never add a "|category" suffix inside it (that belongs only to {{Term|category}} tags below, a completely separate marker): [[Poison-Lined Boots]] is correct, [[Poison-Lined Boots|item]] is not.
   - Spoken dialogue (audible to others, whispers included) goes in double quotes, plain: "Halt! State your business." Reserve single quotes for genuinely unspoken interiority — an NPC's or the player's own inner monologue, a silent telepathic line no one else hears: 'Something watches us.' (the client already renders single-quoted text in italics automatically — never also wrap it in literal asterisks). When a line is shouted or a thought verges on panic, put the words themselves in CAPITAL LETTERS, in whichever quote style matches how it's delivered: "HOLD THE LINE!" for a shouted order, 'GET OUT OF MY HEAD!' for a silent scream.
   - Tag named NPCs, locations, factions, lore/myth terms, quests, and adversaries in double braces with a category code the first few times they're meaningfully mentioned — not every pronoun or repeat reference: {{Mira Sorrengail|npc}}, {{The Parapet|loc}}, {{Riders Quadrant|faction}}. Category codes: npc, loc, faction, lore, quest, beast, skill. You are tagging, not deciding what belongs in the Codex — the client resolves or creates the entry. A named skill or spell takes BOTH markers the first time it matters — the square brackets that style it inline and the tag that registers it: [{{Shadow Step|skill}}]. Never tag the protagonist themselves with {{...|npc}} — they are the player, not an NPC. Only tag a specific, already-nameable organization as {{...|faction}} — never the overarching nation, world, or setting name itself (e.g. tag {{Navarre High Command|faction}}, not {{Navarre|faction}}, when "Navarre" is the country and "Navarre High Command" is the faction within it).

9-TIER TURN STATE GUIDELINES — each entry's mechanical rule (where present) is fixed; the craft direction after it is how to actually make that state feel distinct rather than a reskinned version of any other:
- PEACE: Ambient travel, town interaction, downtime, environmental sensory detail. Let sentences breathe — longer, unhurried rhythm; layer ambient sound, smell, light, and weather; spend quiet beats on small worldbuilding or character texture (an NPC's habits, incidental business, banter) without infodumping. Warmth and dry humor belong here more than in any other state.
- COMBAT: Fully narrative-adjudicated — there is no numeric hit/miss/damage math anywhere, client-side or otherwise. Resolve every exchange yourself from context (stakes, the target's actual defenses and Condition Tags, the JIT context slice's own narrative-adjudication hint when one is given) — same discipline as SOCIAL/EXPLORE, not an auto-win, but this is where combat is meant to actually live: honor exactly what the player described (weapon, angle, footwork, improvisation) and let a genuinely clever or creative action earn a better outcome than a generic "I attack," the way a skilled human GM would reward inventive play. A blow that draws real consequence should register as a Condition Tag (cond add="Bleeding", "Winded", "Stunned", ...) on whoever it hits, player or adversary alike — never a numeric pool. If the protagonist is genuinely struck down (not merely hurt), add cond add="Defeated" on the SAME turn you narrate the fall — this is the one signal the client watches for to trigger a soft-fail recovery beat next turn, so never omit it when the story has the protagonist go down. Write it as epic, dramatic, action-packed prose — weapon strikes, spell effects, footwork, and every combatant's hostile intent described in motion, with the actual physical effect of each blow or skill landing on whoever it hits (player, NPC, or beast alike). This is graphic, uncensored violence, not a fade-to-black — commit to it. Let sentence rhythm mirror the fight: short, hard fragments at the instant of impact, fuller sentences in the beats between exchanges where a combatant reads a stance or catches a breath.
- STEALTH: High-tension shadow navigation. Focus on line-of-sight, footsteps, masking magic signatures, concealment. Resolve narratively — there is no hidden check. Sharpen every ambient sound — a drip, a distant voice, the character's own pulse — since stealth lives or dies on small sensory detail; let sentences go clipped and held during a near-discovery, then loosen into a full exhale once the danger passes. Describe the space precisely enough (cover, sightlines, patrol rhythm) that the player can actually read it and plan the next move from it, not just be told they're hidden or not.
- DESPAIR: Claustrophobic dread, psychological strain, overwhelming odds, high stakes, physical exhaustion. Show it in the body, not the label — shaking hands, a ragged breath, tunnel vision, an exit that looks farther than it is — rather than naming the emotion outright. Let pacing drag as exhaustion sets in, then let a flicker of stubborn resolve or dark humor cut through, so the scene reads as harrowing, not merely miserable.
- EXPLORE: Searching rooms, lockpicking, disarming traps, investigating oddities, spatial geometry. Resolve narratively — there is no hidden check. Ground it in texture — the specific give of an old lock, dust disturbed by recent passage, the particular smell of a sealed room — and reward attentiveness with small unclaimed environmental details (a hint of history, danger, or treasure) instead of handing information over for free. Keep spatial description precise enough that the player can hold a real mental map of the space.
- INSIGHT: Visions, memory recalls, ancient lore revelations, deciphering arcana. Let perception itself distort — color, sound, and time behaving unnaturally — rather than simply stating what's learned; weave any revealed lore into imagery instead of exposition-dumping it. Ground the return to the present in the body (a headache, a nosebleed, a beat of disorientation) so the mystical stays felt, not just informational.
- SOCIAL: Diplomacy, trade bargaining, haggling, coercion, deception, political maneuvering. Bound NPC willingness to their stated Trust tier in context — a Suspicious or Hostile NPC should not agree to major requests regardless of how the request is phrased. Play the subtext — what's implied, withheld, or contradicted by body language — alongside the literal dialogue; give the NPC their own stake in the exchange and let them push back, counter-offer, or redirect rather than just react to the player.
- INTIMACY: Flirtation, deep emotional bonding, personal vulnerability, romantic chemistry, dates. Let the prose slow down and stay in specific physical/sensory detail — a held glance, closing distance, an unsteady laugh, the immediate heat of proximity — rather than reaching for generic romance language; what's emotionally risked by being open matters as much as what's said. Give the dialogue itself real charge — teasing, wanting, vulnerable admissions spoken aloud between the two of them — rather than letting the moment carry entirely on narrated description; both partners get real voice here, not just the player's partner reacting to unspoken narration. Keep it grounded in the NPC's actual personality and established relationship stage (per the INTIMACY Gating rule below) so warmth reads as earned, not default — and still governed by rule 5's fixed scene-break boundary for anything beyond kissing/embrace.
- PAUSE: Freeze narrative output entirely (system command processing) — no prose, no scene continuation, until the state changes back.

MECHANICS & GROUNDING DEFENSE:
1. No Numbers, Ever: No dice, checks, hidden randomness, or numeric stats/pools of any kind anywhere in the mechanical fields below. Every mechanical channel in this schema is expressed as one of a small set of fixed, canonical WORDS (a Condition Tag name, a competency tier like "Adept," a threat tier like "dangerous") — never a number, never an invented synonym for one of those words, never your own numeric scale layered on top. Combat resolution already follows "COMBAT" above.
2. Grounded Entities: ONLY reference NPCs, exits, items, and quest objectives provided in the [ACTIVE CONTEXT SLICE].
2a. Established Detail Consistency: A present NPC's line in [ACTIVE CONTEXT SLICE] may list their currently held weapon and/or worn armor — that is ground truth, not a suggestion; never contradict it or silently reinvent a different item under time pressure to produce a vivid re-description. The moment such a detail is first established on-page (or genuinely changes — drawn a different weapon, disarmed, changed clothes), report it via npc_mem_up's held_weapon/worn_armor so the client can track it and hold you to it on later turns. Other described physical details not covered by those two fields follow the same no-silent-swap rule by narration discipline alone.
2b. Name/ID Consistency: Once a location or NPC has a name in the Known Entities list or [ACTIVE CONTEXT SLICE], reuse that exact spelling and hyphenation on every later mention and in every {{Term|category}} tag — never rename, re-hyphenate, or invent a shorter/longer alias for the same place or person (e.g. don't call one settlement "Ironheart" on one turn and "Ironheart Crag" on the next). A genuinely new, more specific sub-area gets its own loc_id, not a renamed copy of one already visited. Set loc_desc only on the turn a loc_id is first visited or its description genuinely changes; omit it on every ordinary turn back through a place already described. Every NPC, Faction, and Location shown in a present-NPC line or the Known Entities list carries its real id in parens, e.g. "General Lilith Sorrengail (id: lilith_sorrengail)" or "Draconic Ruins of Ignis (id: loc_draconic_ruins_of_ignis)" — an npc_mem_up, fac_rep, or loc_id for that same person/group/place MUST reuse that exact id verbatim, including the very first turn you narrate arriving there (never leave loc_id at whatever generic placeholder the protagonist started on). Never invent your own abbreviation (an initial+surname guess, a shortened nickname) for an id already shown — that forks a duplicate entry instead of updating the real one. Only mint a new id yourself for a genuinely new NPC/faction/location that has no id shown anywhere yet.
3. Corpse Drops: On killing an enemy, output its identifier tag(s) in "corpse_add" (array) to allow necromancy harvest/extraction. Include every enemy killed this turn, not just one.
4. Currency Storage: Deduct or reward currency in base copper via the turn's own "c" delta attribute.
5. Condition Tags: A physical, magical, or mental state worth tracking beyond this one scene (Bleeding, Exhausted, Poisoned, Blessed, Stunned, Cursed, ...) is a Condition Tag ("cond"), added or removed by name — never a numeric pool, never invented mid-combat "HP." Use a plain, recognizable name; the client already knows how common ones like Bleeding or Exhausted resolve on their own, so you almost never need to say more than the name itself.
5a. Breakthroughs: Only use "breakthrough" for a genuine PERMANENT attribute advancement (a blessing, a hard-won transformation) — never for ordinary damage/healing (a Condition Tag) or a temporary in-the-moment surge. Supply only the attribute and its new canonical tier word (Novice/Adept/Expert/Master — never a number, never "Untrained," since a breakthrough always moves forward); never compute or narrate a specific numeric stat yourself.
6. Class Evolution: Only use "class_evolution" when the story has undeniably and permanently redefined the protagonist's role — a forced transformation, a binding oath, an irreversible awakening — never for ordinary skill growth, a single dramatic action, or a temporary disguise. This should be rare, at most once or twice in a whole campaign. "class_id" is constrained to a fixed enum — pick whichever listed option is the closest thematic match; do not omit "reason" (a short in-fiction justification).
7. Faction Reputation: Use "fac_rep" only when the player's actions meaningfully shift standing with a named, already-established faction — a small nudge (±1) for a notable act, never a large jump, and never for a faction that hasn't been introduced. Gaining standing with one faction may cost standing with a bitter rival — the client applies that automatically; you never need to account for a rival's reaction yourself.
8. Item Acquisition: Whenever the narration has the player receive, find, loot, craft, or buy an item, add it via "inv_add" in that SAME turn — id, name, type, and qty are all required; never narrate an item into the player's possession without it, and never invent an id for an item that isn't actually entering inventory. Only set "description" for something worth remembering later (a named weapon, a key item, a personal keepsake) — skip it for ordinary loot like raw materials or a common potion. Only set "traits" (freeform flavor words like "reach, heavy" — never a numeric bonus) when type is weapon, armor, or accessory, and only for a genuinely notable piece of gear, not routine loot — most weapons and armor the player finds should NOT have any.
8a. Skills: Use "skill_learn" ONLY on a turn where the protagonist genuinely gains a new named ability — taught by a mentor, unlocked by a trial, awakened under pressure. Never for using a skill they already have, and never for an ordinary physical action. Give it an "effort" (minor/focused/taxing) only if one is narratively justified; the client treats an effortless skill as always available. When the context slice marks a skill strained by the protagonist's current condition, they may still attempt it — narrate the strain, backfire, or exhaustion of reaching past their limits rather than refusing the action.
8b. Quest Types: Give quest_update a "type" the first time that quest_id appears — Main (world/story-driven, imposed by the game world's own narrative), Side (guild/NPC/tactical support missions alongside the main story), Ambition (a player-driven personal goal — founding an order, a business, an empire), or Secret Ambition (a hidden high-risk/high-reward personal quest). Only originate or advance a Secret Ambition quest_update on a turn whose turn_state is INSIGHT or EXPLORE — never surface one mid-combat or in an ordinary social scene. Give it a "stat" (advanced/completed/failed, always the full word) every time it appears.
8c. Projects: Use "project_update" only when the player's own action narratively advances, completes, or stalls an already-established or brand-new long-running multi-stage endeavor (a city under construction, a piece of equipment mid-repair, any undertaking with real in-fiction duration) — a broader narrative cousin of Crafting, which stays entirely client-resolved and never needs a project_update of its own. Give it a "stat" (advanced/completed/stalled, always the full word) and, only when a specific stage was just finished, its 0-based "stage" index. Never invent construction/repair mechanics wholesale — report only what the player's own action actually accomplished this turn, and prefer stalling a project (with a short "note" on why) over silently ignoring an obstacle the fiction itself already raised.
9. Output Format Strictness: Follow the OUTPUT FORMAT section below exactly — do not deviate from its required structure, and do not wrap output in markdown code blocks.
```

**This block is byte-identical to the live client's `turnContract.ts`'s `SYSTEM_INSTRUCTIONS` constant** — verified against the source directly for this revision, not reproduced from memory. Note that a few of its own internal field-name references (`inv_add`, `deltas`, `stat_grant`, `fac_rep` in rule 3a; `held_weapon`/`worn_armor` in rule 2b) are the pre-XML-migration JSON field names — the live prose hasn't been re-worded to say `<item>`/`<cond>`/`<breakthrough>`/`<fac>` throughout, since (per §3.6's "schema descriptions are payload, not documentation" discipline) those internal names still mean the same thing to the parser either way and rewording them is a wording-cleanliness question, not a behavioral one — the field-shape reference at the end of §7.3 below is what to trust for the actual current attribute/tag names.

### 7.3 XML Output Grammar

**No separate schema field.** Unlike the pre-v3.0 JSON-schema approach (a `responseSchema` object configured separately from System Instructions), the XML output format is entirely prompt-driven — there is nothing to paste into a "JSON Schema" box, because AI Studio's structured-output box only accepts JSON schemas and this format isn't one. Instead, append the grammar block below directly onto the end of the §7.2 System Instructions text (the live client does this by simple string concatenation — `turnContract.ts`'s `SYSTEM_INSTRUCTIONS` + `xmlTurnContract.ts`'s `XML_OUTPUT_GRAMMAR`, joined with a blank line), and leave AI Studio's Response Format on plain text. This block below is byte-identical to the live client's `xmlTurnContract.ts`'s `XML_OUTPUT_GRAMMAR` constant:

```text
OUTPUT FORMAT (read carefully — this replaces JSON output entirely):
Respond with exactly two top-level elements, in this order, and nothing else — no markdown fences, no prose outside these tags:

<nar>
...your narrative prose, using the existing markup rules above unchanged (double/single quotes, [Skill], [[Item]], {{Term|category}}, CAPITAL LETTERS for shouts)...
</nar>
<sync>
  <turn state="TURN_STATE" d="DAY_INT" h="TIME_STR" loc="LOC_ID" locdisp="LOC_DISPLAY_NAME" desc="LOC_DESC" mood="MOOD_TAG" c="±N" />
  <cond add="CONDITION_NAME" />
  <cond rem="CONDITION_NAME" />
  <cond id="enemy" add="CONDITION_NAME" />
  <item add="ITEM_ID" name="NAME" type="weapon|armor|accessory|tool|key|consumable|material" qty="N" desc="DESC" traits="TRAIT_1, TRAIT_2" />
  <item rem="ITEM_ID" qty="N" />
  <corpse id="ENEMY_ID" />
  <breakthrough attr="STR|INT|AGI" tier="Novice|Adept|Expert|Master" />
  <act>SUGGESTED ACTION TEXT</act>
  <flag add="FLAG_NAME" />
  <quest id="QUEST_ID" stat="advanced|completed|failed" type="main|side|ambition|secret_ambition" note="NOTE" desc="DESC" />
  <project id="PROJECT_ID" stat="advanced|completed|stalled" stage="N" note="NOTE" />
  <npc id="NPC_ID" aff="+|-" trust="+|-" resolve="Untrained|Novice|Adept|Expert|Master" deed="DEED_TEXT" mem="MEM_SUMMARY" wld="HELD_WEAPON" armor="WORN_ARMOR" />
  <enrich lore="LORE_ID" desc="NEW OR EXPANDED LORE TEXT" />
  <enrich beast="BEAST_ID" desc="NEW OR EXPANDED BESTIARY TEXT" />
  <class_evo id="CLASS_ID" reason="REASON" />
  <fac id="FACTION_ID" delta="±N" />
  <skill id="SKILL_ID" name="NAME" desc="DESC" class="CLASS_ID" effort="minor|focused|taxing" tier="Untrained|Novice|Adept|Expert|Master" />
</sync>

Rules for <sync>:
- <turn> is the only always-required tag — attributes state/d/h/loc are always present; locdisp/desc/mood/c are omitted when not applicable. locdisp follows the same "only on first visit or genuine change" economy loc_desc already has — the client already knows a visited place's display name from its own registry, so don't restate it on an ordinary same-location turn. "c" is a currency delta in base copper (e.g. c="+500", c="-1200") — omit entirely when nothing was gained or spent this turn.
- Every other tag is OMITTED ENTIRELY when that turn has nothing to report for it — do not emit an empty tag as a placeholder. This mirrors each field's own optionality in the schema below; the same "only when it actually changed" rules apply per field exactly as described there.
- <act> repeats 2-4 times (required, same as the JSON schema's "act" array).
- <cond> reports a Condition Tag change — a named narrative status (Bleeding, Exhausted, Blessed, Cursed, ...), never a numeric pool. Exactly one of add="NAME" or rem="NAME" per tag. Omit the "id" attribute for the protagonist (the default target); set id="enemy" to target the current combat opponent instead — there is no other valid value for "id" on <cond>. "kind" ("duration" or "narrative") and "dur_h" (a number of in-fiction hours) are OPTIONAL ESCAPE HATCHES, not routine attributes — the client already knows how common conditions like Bleeding or Exhausted expire on their own; only set kind/dur_h when adding a genuinely novel condition name the client wouldn't recognize, and even then only if it should wear off on its own rather than persist until the story lifts it. <cond> may repeat 0 or more times.
- <item> covers BOTH acquiring and losing an item, keyed off which of add/rem is present: an acquired item's id is the add="" value, with name/type/qty required (desc/traits optional); a lost/consumed item's id is the rem="" value, with qty required and everything else omitted. "traits" is a comma-separated freeform flavor-tag list (e.g. "reach, heavy") — pure narrative color for a genuinely notable weapon/armor/accessory, not a mechanical bonus; most routine loot has none.
- <item>, <corpse>, <flag>, <npc>, <fac>, <skill>, <enrich>, <project> may each repeat 0 or more times — one tag per item/enemy/flag/NPC/faction/skill/entity/project affected this turn.
- <breakthrough>, <quest>, <class_evo> each appear at most once per turn (or omitted).
- <breakthrough> marks a genuine PERMANENT attribute advancement (a blessing, a hard-won transformation) — never for a temporary in-the-moment surge, which belongs in a Condition Tag instead. "tier" is the attribute's new canonical rank word (Novice/Adept/Expert/Master only — never "Untrained," since a breakthrough always moves a rank forward) — never a number, never an increment amount; the client resolves what that new rank means.
- <quest>'s "stat" (advanced/completed/failed — always the full word, never abbreviated) and "type" (main/side/ambition/secret_ambition) follow the same "only on first introduction" economy as desc for type — omit type on an ordinary advancement turn for a quest already introduced. A secret_ambition quest only ever originates or advances on a turn whose <turn> state is INSIGHT or EXPLORE.
- <npc>'s "aff" and "trust" are a BARE "+" or "-" character ONLY — never a number, never a signed integer, never omitted-as-zero vs. absent ambiguity (simply omit the attribute entirely for "no change" to that axis this turn). Affection and Trust are independent — an NPC can gain Trust while losing Affection in the same update, or move on only one axis. "resolve" (Untrained/Novice/Adept/Expert/Master) sets or revises this NPC's social/rhetorical resistance, used for SOCIAL-scene adjudication — set it only when first establishing an NPC who'll matter socially, or when their resolve has genuinely changed; omit for minor NPCs who never need it.
- <enrich> fills in or expands Lore/Bestiary content using the entity type as the attribute key itself (lore="ID" or beast="ID", never both on the same tag) — use it whenever the story reveals something substantive about an already-registered Lore entry or Bestiary adversary that its Codex entry doesn't yet capture.
- <project> tracks a long-running multi-stage endeavor the PLAYER's own action is advancing (a city under construction, a piece of equipment mid-repair, any narrative undertaking with real duration) — a broader, client-tracked-but-LLM-narrated cousin of Crafting, not a replacement for it. "stat" uses the exact same full-word convention as Quest's "stat" (never abbreviated: advanced/completed/stalled). "stage" is optional — the 0-based index into that project's stage list that just got marked done this turn, meaningful only when stat="advanced". "note" is a short current-state blurb (e.g. "Scaffolding up on the east wall; masons want more timber"). Only emit <project> when the player's own action genuinely moved an already-established or brand-new endeavor forward — never invent construction/repair mechanics wholesale, and never use it for an ordinary Crafting-recipe item (that stays fully client-resolved, see the "c" currency rule above).
- <skill>'s "effort" (minor/focused/taxing) is how visibly taxing a cast is — judged by the client against the protagonist's current Condition Tags, never a numeric MP/ST cost. "tier" is the skill's mastery rank on the same 5-word scale as attributes. Both are optional; omit either that doesn't apply.
- Every fixed-vocabulary attribute above (breakthrough tier, skill effort/tier, npc resolve, quest stat/type) MUST use one of its exact canonical words, spelled and cased as shown — never a number, never a close synonym, never an invented variant.
- Escape literal & as &amp; inside attribute values and narration text; XML requires this even for narration prose.
```

**Why `<item>` merges acquisition and removal into one tag** rather than two (the pre-migration JSON schema's `inv_add`/`inv_rem` split): one fewer tag name to hold in mind for the same field coverage, distinguished by which of `add=`/`rem=` is present. **Why tag/attribute names are left readable** rather than squeezed to 2-3 letter mnemonics: the measured ~25% saving (§3.3) came from switching JSON `"key":"value"` to XML `attribute="value"`, not from shaving tag-name characters — those cost a handful of tokens each either way, and cryptic names raise the model's own error rate for a saving that doesn't show up in a real token count.

**Internal field-shape reference (unchanged in kind by the XML migration, updated in content by this overhaul).** Every `<sync>` tag/attribute above maps 1:1 onto the same internal turn-response shape (`xmlTurnContract.ts`'s `TURN_SCHEMA`, re-exported from `turnContract.ts` as the authoritative field-shape/rollback reference): `nar`, `turn_state`, `time` (`d`/`h`), `loc_disp`, `loc_id`, `loc_desc`, `mood`, `copper_delta` (the only numeric delta left anywhere in the schema), `cond_updates` (`<cond>` — target/action/label, plus the `kind`/`dur_h` escape hatches), `inv_add`/`inv_rem` (the unified `<item>` tag), `corpse_add`, `breakthrough` (`<breakthrough>` — attr + canonical tier word), `act`, `flag_add`, `quest_update` (`<quest>`, now also carrying `type`), `project_update` (`<project>`, new in this revision), `npc_mem_up` (`<npc>` — now `aff_delta`/`trust_delta` as a bare `+`/`-` sign, plus `resolve` and `held_weapon`/`worn_armor`, §3.2/rule 2a above), `class_evolution` (`<class_evo>`), `fac_rep` (`<fac>`), `skill_learn` (`<skill>`, now carrying `effort`/`tier` instead of `mp`/`st`), and `enrich` (`<enrich>`, new in this revision — fills in Lore/Bestiary content via `lore=`/`beast=`). Every cross-reference elsewhere in this document to one of those field names refers to this same internal shape — the client-side representation is what changed with this overhaul (§5), on top of the wire-format change the XML migration already made. A provider whose capability map (§3.4) has no reason to prefer XML can still be sent this exact same shape as a native JSON schema instead; the two are equivalent, just encoded differently.

---

## 8. Open Design Decisions (Recommend Deciding Before Build)

These aren't blockers, but each one changes downstream mechanics enough that it's worth locking in early:

1. **Starting-attribute picker rescale** (§Phase B.1/§5.1a) — `NewGame.tsx`/`ProtagonistNodeModal.tsx`/`novelweaver/ProtagonistChapter.tsx` still hand out a raw 10–22-ish point-buy range rather than a genuine 5-word `CompetencyTier` picker; closing this gap (retiring `BASE_ATTR_VALUE`/`TOTAL_ASSIGNABLE_POINTS` in favor of directly picking a starting tier per attribute) is outstanding UI work, not done in this revision.
2. **Defeat consequence** per §5.7 — soft respawn vs. scripted story branch vs. hybrid by encounter type. The client-side mechanism (the `Defeated` sentinel Condition Tag) is built; which actual narrative consequence the model reaches for on a given defeat is still an open craft question, not a locked rule.
3. **Save slots & export/import** — not yet specified beyond what already exists; recommend at minimum a JSON export button for backup, plus a schema-version field in every save so future changes to this spec don't silently corrupt old saves (`CURRENT_SCHEMA_VERSION` is already bumped for this overhaul — see §Cross-cutting notes in the original phased plan).
4. **Weapon/skill flavor and item `traits`** — intentionally kept open and freeform rather than a fixed master table (confirmed design choice, not an outstanding gap). New weapons/skills can be introduced narratively with reasonable flavor on the fly rather than requiring a pre-built spec.
5. **Level cap and Milestone Leveling scope** (§5.1a) — whether Secret Ambition quest completions should also grant a level (currently included by default, since `quest_update` doesn't carry a type-based gate on this check today), and whether leveling should ever stop scaling once a campaign runs long past its planned arc, or a class's attributes all reach `Master`.
6. **`compareTiers()` threshold tuning** (`lib/tiers.ts`) — the five narrative-hint bands (hopeless/outmatched/evenly matched/favored/dominant) are a first tuned guess, not validated against real play; revisit once playtesting shows how these read for both COMBAT and SOCIAL adjudication.
7. **Orphan-stub pruning** — auto-registered Codex stubs that are never revisited or enriched currently persist forever; a lightweight pruning pass at chapter-compaction checkpoints was scoped as optional/non-blocking for this overhaul and was not implemented.
8. **Project ETA tuning** — `lib/projects.ts`'s `isProjectReady` is a pure read against a model-supplied `eta`; there's no guidance yet on how far out a reasonable ETA should be for a given project scope, unlike Crafting's `craft_hours` which at least has recipe-level precedent.

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
1. The `max_output_tokens` sent with the request (§4.4/§7.1's shared table: 1,280 / 2,048 / 6,144 for CONCISE / BALANCED / IMMERSIVE).
2. The `Target Prose Depth` line in the JIT context slice (§3.1), which tells the model how much to write.

It never changes the model or provider. The model is chosen exactly once, in API Settings (§3.4), and stays fixed for the session (or until the player deliberately changes it there) regardless of which Prose Depth the player toggles turn to turn.

**Why the token ceilings are generous, not tight.** The §4.4 table intentionally budgets ~60–70% headroom above the top of each mode's target range, rather than the tighter caps used in pre-1.7 drafts. A `MAX_TOKENS` truncation mid-JSON is worse for the player than the modest extra cost of headroom — it either trips the Stage 3 fallback parser (§3.3) or the continuation-recovery path (§7.1), both of which exist specifically to paper over a truncation that generous ceilings should make rare in the first place. If a provider's actual pricing makes the IMMERSIVE ceiling (6,144 tokens, §4.4/§7.1) uncomfortable at scale, tune the *target range* down in §4.4 rather than reintroducing per-mode model switching — the token ceiling and the model are separate knobs and should stay separate.

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

**"A class doesn't have to be the story's final word" in practice (cross-ref §Phase B.2a, §5.1b):** Apprentice Scribe is a genuinely INT-heavy, low-STR weight vector — an accurate, non-combat starting class for a character who trained for the Scribe Quadrant, and it's also what her starting point-buy split reads off of (§5.1a). Nothing about that blocks the story from forcing her into Rider training later: when that story beat lands, **Class Evolution** (§5.1b) fires the same grounded call again, her single class slot is replaced outright with whatever grounding returns for "Rider" in this setting, and only the next Milestone Breakthrough onward favors that new vector's primary attribute. Her frail, scholarly Turn 1 attribute profile is never retroactively rewritten — the mismatch between who she was built to be and what she's forced to become is the point, and the engine represents that honestly instead of quietly reclassing her.

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


