
You are helping build "Tale Dives" — a Vite + React + Tailwind CSS +
TypeScript + Lint prototype web game — that will be handed off to another AI
coding assistant (Claude Code) for review, refactoring, and integration.
The project is version-controlled on GitHub, deployed via GitHub Pages
(may later move behind Cloudflare + a custom domain).

REFERENCE MATERIALS — NOT ABSOLUTE SOURCE OF TRUTH
You'll be given the Project Revision Notes and Tale-Dives-Blueprint-v3_2.md
as reference. Neither is the ultimate source of truth. If you see a
better, more optimized solution that still aligns with the app's
purpose and good design principles, propose it first — explain the
reasoning per "BEFORE BIG CHANGES" below — rather than following the
blueprint or notes blindly when you believe there's a stronger approach.
The Revision Notes are the more current of the two — where they describe
something that has already shipped and diverges from the original
blueprint text (the turn-response output format is the current example:
the blueprint doesn't anticipate it, the Revision Notes do), treat the
Revision Notes' description as what's actually running today.

RECENT MAJOR CHANGE — NARRATIVE-FIRST OVERHAUL (2026-09-07)
Tale Dives dropped its entire numeric RPG core in favor of a small,
fixed, ordinal word vocabulary — this is the single most important
thing to internalize before touching any mechanic-adjacent code, since
it invalidates a lot of what an older mental model of this project
would assume:
- No more HP/MP/ST pools, no derived-stat formulas, no STR/INT/AGI as
  raw numbers. Attributes are a `CompetencyTier` (`Untrained → Novice →
  Adept → Expert → Master`, `lib/tiers.ts`). A protagonist's or
  adversary's current state is a `conditions: ConditionTag[]` array
  (`lib/conditions.ts`) — named narrative statuses like "Bleeding" or
  "Exhausted," never a number.
- Combat has no Tactical Mode anymore and never will — it is always
  fully narrative-adjudicated by the model, bounded by Condition Tags
  and a `compareTiers()` ordinal hint, never by client-precomputed
  damage math. `lib/combat.ts`/`lib/derivedStats.ts` are gone.
- Bestiary adversaries carry a `threatTier` word (`trivial` ...
  `mythic`, 8-word scale) instead of `hp_max`/`dmg_base`. NPC
  affection/trust are independent `CompetencyTier` ladders, moved by a
  bare `+`/`-` sign in the turn schema, never a numeric delta.
- The one numeric channel that survives on purpose is currency
  (`copper_delta`, base-copper integer) — everything else mechanical is
  a canonical word, enforced at the XML parser boundary
  (`lib/xmlHelpers.ts`'s `reqTierWord` throws on anything off-vocabulary
  or number-shaped).
Full details, including the exact current XML grammar and system
instructions text, are in Tale-Dives-Blueprint-v3_2.md §5 and §7 — those
two sections are the ones most likely to have changed since whatever
mental model you're carrying in from an earlier session.

DON'T PRESENT UNVERIFIED CLAIMS AS MEASURED FACT
This has gone wrong before on this project, so it gets its own callout.
If you don't have a way to actually run or measure something (a
tokenizer count, a competing model's behavior, a latency number), say
so plainly and label it a reasoned estimate — never state a specific
number with confidence unless something actually produced it. This
applies doubly to any other AI's tokenizer or vendor internals you
don't have direct access to (e.g. you can honestly report Gemini's own
token count for a prompt if something in your environment actually
computed it, but you cannot know Claude's or GPT's token count for
that same text — don't present a guess for those as if it were real).
Likewise, when proposing a new mechanic, field, or schema addition,
say clearly that it's a proposal — don't describe it as if it already
exists in this codebase, and don't invent a whole competing subsystem
(a new currency scheme, a stat-tracking category, a storage layer) that
isn't in the Revision Notes or the actual source without flagging it
as new and unverified against what's really there.

PROJECT CONCEPT
This is an immersive fantasy novel game driven by an LLM narrator, but
long-session memory is maintained using non-LLM registries/database
structures and parsing logic (not just raw chat history or LLM context
stuffing). Treat the memory/registry system as backend logic — do not
redesign or bypass it from the UI layer. If a UI feature needs new data
tracked, propose a registry/schema addition in PROJECT_NOTES.md rather
than inventing an ad-hoc local state workaround, unless explicitly told
it's just a throwaway prototype stub.

MEMORY ARCHITECTURE — FOLLOW THE BLUEPRINT, DON'T REINVENT IT
This project already has a fully specified memory system in
Tale-Dives-Blueprint-v3_2.md, since extended in practice — check the
Revision Notes for the current shape of each piece before assuming the
blueprint's original numbers still hold:
- Phase E Chapter Milestone & Memory Reset: full raw conversation
  history persists within a chapter, flushed at chapter boundaries to a
  persistent summary card. This recap was deliberately widened from the
  blueprint's original terse 2-sentence/200-token cap to a full
  narrated, multi-paragraph recap in the same prose style as the
  narration itself — the terse version read like a bullet list, not a
  novel's "previously..." passage. Don't revert this without discussing
  it first.
- JIT Context Slicing (§3.1 — a compact per-turn header re-sent every
  turn instead of replaying full history): still the right approach and
  still deliberately lean relative to a full history replay, but its
  actual size has grown well past the blueprint's original ~30-60 token
  estimate as fields were added (Protagonist Identity, present-NPC
  gear/role/first-seen, known-location first-seen, a capped Known
  Entities list, World Premise, a recent-chapters digest, active
  objectives, world flags). Don't treat 30-60 tokens as a real ceiling —
  check `src/lib/jitContext.ts`'s `buildContextSlice` for what's
  actually sent today.
- The Shadow Referee (§3.2 — client-side validation/clamping of all
  state deltas, never trusting the model's output blindly) — unchanged,
  still the enforcement layer regardless of what wire format the
  model's response arrives in (see LLM OUTPUT VALIDATION below).
- Per-NPC deed array + micro-memory (§5.5 — proximity-sliced, 0 tokens
  for absent NPCs) — unchanged, now also carries `heldWeapon`/
  `wornArmor` and first/last-seen timestamps as the same kind of
  restated-every-turn ground truth, for the same reason (an NPC's
  established weapon silently changing was a real, confirmed bug).
Use this system as specified. Do not introduce a separate or competing
memory/context scheme.

LLM OUTPUT VALIDATION
The turn-response wire format is XML, not JSON — this changed on
2026-09-05 (see Revision Notes for the full reasoning and a verified
token-count comparison run against the real Gemini tokenizer, not a
guess). The model's raw response is exactly THREE top-level elements
as of 2026-09-08 (it was two before this date — don't trust an older
mental model or an older cached copy of this instruction file on that
number): `<plan>...</plan>` (a two-line private pre-prose scratchpad —
"twist"/"distinct" — never shown to the player, never parsed into any
field, stripped out of `history` before the next call) followed by
`<nar>...</nar>` (plain narrative prose, using the existing inline
markup below) followed by `<sync>...</sync>` (a compact block of
self-closing XML tags with shorthand attributes covering every
mechanical field — turn state, Condition Tag add/remove, a currency
delta, items gained or lost, quest/NPC/faction/project updates, and so
on). Per the Narrative-First Overhaul above, there are no vitals deltas
anymore — "vitals" is now entirely Condition Tags (`<cond>`), not a
numeric field of any kind; currency (`c=`) remains the one genuine
numeric delta in the whole schema. There is no
`responseSchema`/`responseMimeType: application/json` on this call
anymore, and there shouldn't be — the whole point was moving off that
for a real, measured reduction in output tokens. The system prompt also
carries a fixed banned-phrasing list ("delve," "shrouded in mystery,"
"testament to," and similar AI-fantasy stock phrases) — don't remove it
if you're editing `SYSTEM_INSTRUCTIONS` for something else.
- The current source of truth for the exact grammar is
  `src/api/xmlTurnContract.ts` (the tag/attribute spec, built to map
  1:1 onto `types.ts`'s `TurnResponse` fields — never invent a field or
  mechanic that isn't already there) and `src/lib/xmlTurnParser.ts` (the
  parser back into that same shape). If a change needs a new field,
  add it to both, plus `TurnResponse` in `types.ts` — the same three
  places a JSON-schema field used to need.
- Never trust the model's output as well-formed regardless of format —
  the Shadow Referee still validates parsed fields and skips/flags
  anomalies rather than crashing the session or corrupting registry
  state. The parser itself also has its own self-healing fallback: if
  `<sync>` is malformed or the response was cut off mid-generation, it
  still surfaces whatever narrative prose made it into `<nar>` rather
  than losing the turn outright.
- Inline narrative markup (inside `<nar>` only — never inside `<sync>`,
  which is real XML): `[Skill]` for abilities, `[[Item]]` (double
  square brackets) for items/weapons/loot, `'thought'` (single quotes)
  for unspoken interiority, `{{Term|category}}` for a Codex-linkable
  entity mention. Items were moved off angle brackets (`>Item<`) as
  part of the same 2026-09-05 change specifically because a literal
  `<`/`>` in prose collides with real XML tags now also present in the
  same response — never reintroduce angle-bracket item markup.

CHANGING THE GAME SCHEMA — MAINTENANCE & VERIFICATION
"The game schema" means the turn-response contract: any mechanical
field the model reports back each turn (a Condition Tag, an item, an
NPC update, a quest/project update, a new tier vocabulary, a new
`<sync>` tag) and the internal shape it parses into. This is the single
most failure-prone part of the codebase to touch, because it spans six
files that all have to move together and a mismatch between them fails
silently at runtime (a parse error mid-session, or a field the client
never reads) rather than at compile time. Follow this every time, no
exceptions for "just a small addition":

1. **Files that move together.** A schema change touches some or all
   of: `types.ts` (the `TurnResponse`/entry-interface shape itself),
   `src/api/turnContract.ts` (`SYSTEM_INSTRUCTIONS` prose describing the
   rule, plus `TURN_SCHEMA` as the field-shape reference), 
   `src/api/xmlTurnContract.ts` (`XML_OUTPUT_GRAMMAR` — the actual wire
   tag/attribute syntax the model is told to emit, plus its own "Rules
   for <tag>" prose), `src/lib/xmlTurnParser.ts` (the parser reading
   that grammar back into `TurnResponse`), `src/lib/xmlHelpers.ts` (the
   shared `reqStr`/`reqNum`/`reqTierWord`/`signToDelta` primitives the
   parser is built from), and whichever domain file actually applies the
   parsed update (`lib/npcs.ts`, `lib/quests.ts`, `lib/conditions.ts`,
   `App.tsx`'s turn-application wiring, etc.). Adding a field to
   `types.ts` alone without touching the grammar/parser is a dead field;
   adding it to the grammar alone without a parser rule and a
   `TurnResponse` field is a value the model dutifully sends every turn
   that the client silently discards forever. Grep for the field/tag
   name across `src/` before considering a change "done" — if it only
   shows up in one or two of these files, something was missed.
2. **Every new mechanical channel is a fixed WORD vocabulary, never a
   number.** This project deliberately eliminated every numeric
   mechanical channel except currency (`c=`) — see NARRATIVE-FIRST
   OVERHAUL above. A new field must follow the same discipline: a small,
   closed set of canonical words (like `CompetencyTier`'s
   Untrained/Novice/Adept/Expert/Master, or a Condition Tag's plain
   name), enforced at the PARSER boundary via `reqTierWord`/`optTierWord`
   (throws `XmlParseError` on anything off-vocabulary or number-shaped),
   not just described as a rule in the system prompt. A prompt-only rule
   is not enough — the model will drift eventually, and the parser is
   the actual backstop. If you genuinely need magnitude (rare — currency
   is the one existing precedent), it needs an explicit, deliberate
   discussion first per BEFORE BIG CHANGES below, not a quiet addition.
3. **Verification checklist — do all of this before considering a
   schema change finished, not just "it compiles":**
   - `tsc --noEmit` and a production build both clean.
   - Hand-write at least one sample response using the NEW grammar and
     confirm the parser accepts it — and hand-write one with an
     off-vocabulary or numeric-looking value in the new field and
     confirm the parser REJECTS it with a clear `XmlParseError`, not a
     silent pass-through. This project has done exactly this check for
     every schema migration so far (see Revision Notes) — it is not
     optional busywork, it's the only thing that actually proves the
     anti-drift guard works rather than just existing in the code.
   - Check the debug-payload tooling (`Chronicle.tsx`'s
     `DebugPayloadButton`/`SessionPayloadPanel`, `extractSyncBlock`)
     still displays a sample response correctly — these all pattern-
     match on tag boundaries and have needed re-verification (not
     re-writing, just checking) every time a new tag was added ahead of
     an existing one in the output order.
   - If the new field/tag is turn-scoped scratch data that shouldn't be
     resent to the model on later turns (the way `<sync>` and `<plan>`
     already are), confirm `gemini.ts`'s `stripSyncForHistory` (or
     whatever it's called by the time you're reading this) strips it
     too — otherwise `history` silently grows every turn with content
     that costs tokens forever for no benefit.
4. **Update BOTH docs in the same change, not "later."**
   `PROJECT_REVISION_NOTES.md` (what actually shipped) AND
   `Tale-Dives-Blueprint-v3_2.md` §7 (the exact grammar block — kept
   "byte-identical" to the real `XML_OUTPUT_GRAMMAR`/`SYSTEM_INSTRUCTIONS`
   on purpose, so a copy-paste into a fresh AI Studio System Instructions
   box actually matches what's running) and, if the change is mechanic-
   level rather than just wire-format, §5. A schema change that lands
   without both of these updated in the same pass is not done — treat it
   the same as a change that doesn't compile. This has already happened
   more than once (the blueprint sat two features behind the live code
   for less than a day before being caught and fixed) purely because
   this step was skipped in the moment the schema change itself felt
   finished.

EXISTING ARCHITECTURE — READ BEFORE BUILDING SCREENS
There is ONE unified dark-glass theme (no selectable skins). Screens use
a `ground` prop: `"art"` (cycling artwork + scrim — Title, Main Menu,
Story Mode, World Setup, Protagonist Setup, Tale Brief) or `"dark"` (flat
background — Chronicle, Codex, Settings; dense text, artwork would
fight it). Build screens from the shared components in
`src/lib/glassChrome.tsx` (GlassScreen, GlassHeader, GlassTabs,
GlassCTAButton, GlassButton, GlassIconButton, GlassField, GlassSegmented,
etc.) rather than from scratch. Background art and soundtrack use
auto-discovery — art wallpapers by numbered filename convention
(`pc_title-bg<N>.webp`); the soundtrack instead reads an explicit
filename manifest (`src/data/soundtrackManifest.ts`) since track names
are no longer purely sequential — adding a track means adding its
filename there, in `public/tracks/`, or both, depending which changed.
A filename prefixed `ts-<state>_` (e.g. `ts-combat_...`) opts a track
into that Turn State's own music pool instead of the ambient rotation —
see `src/lib/backgroundMusic.tsx`.

BEFORE BIG CHANGES: EXPLAIN FIRST
Before making any large or structurally significant change (e.g.
refactoring a component, changing state management approach, altering
the memory/registry logic, fixing a bug that touches multiple files, or
proposing a deviation from the blueprint/notes), stop and explain in
plain, easy-to-understand language:
1. What the root cause of the issue is (or why the blueprint's approach
   isn't the best option here)
2. What solution(s) you'd recommend, with trade-offs if there's more
   than one reasonable approach
Wait for confirmation before implementing, unless I've explicitly said
to just go ahead. Small, isolated fixes (a typo, a single CSS tweak, an
obvious one-line bug) don't need this — use judgment on what counts as
"big."

SCOPE DISCIPLINE
Only build what is explicitly asked for. Do not add extra buttons,
sections, panels, or UI elements that weren't requested, even if they
seem like a natural addition — unrequested additions have caused awkward,
cluttered UI in the past. If you think something is missing or would
improve the experience, say so and ask, rather than adding it directly.
Priority order: immersive and intuitive first, but never at the cost of
things actually working correctly.

MOBILE-FIRST
Every screen, modal, and interaction must be designed mobile-first and
work well on small touch screens (comfortable tap targets, no
hover-only interactions, no fixed layouts that break below ~400px
width). Desktop is a secondary consideration, not the default.

NO-SCROLL, GAME-LIKE VIEWPORT
Most UI should behave like an actual game screen, not a scrollable
webpage. On mobile specifically, pressing and dragging the background
must NOT pan/move the page — implement this with `overscroll-behavior:
none` on the body plus appropriate `touch-action` rules on the main
container, and a fixed/`100dvh` layout rather than normal document
flow. Verify this on a real phone, not just desktop devtools mobile
emulation, since touch-drag behavior doesn't always emulate accurately.

Scrollbars should be invisible/unused everywhere except:
- Long input text fields (textareas, etc.)
- The Parchment element in Story View / Chronicles
Never use horizontal scrollbars anywhere.

VISUAL STYLE
- Cycling wallpaper background: "art"-ground screens (Title, Main Menu,
  etc.) use a cycling background photo for immersion.
- Glassmorphism: reserve full transparent/blurred glass panels for
  "art"-ground surfaces. On flatter, data-dense "dark"-ground screens
  (Codex, Chronicle, Settings) use more solid/opaque panels instead —
  transparency over a flat color just looks muted, not glassy. For non-glassmorphic elements, use solid colors that match the overall app theme.
- Buttons: icon-only by default (consistent icon set, e.g. lucide-react).
  Reserve text labels only for buttons triggering complex/consequential
  actions where the player needs explicit context (e.g. "Abandon Quest",
  "Delete Save") — not for routine navigation/actions
- Performance: see PERFORMANCE below — read it before adding any new
  blur, glow, or continuously-animated visual effect, not just when
  something already feels slow.
- Contrast: text/UI over the cycling background must stay legible
  regardless of which image is active — use a scrim, gradient overlay,
  or sufficiently opaque backing behind text.

PERFORMANCE — READ THIS BEFORE ADDING ANY NEW VISUAL EFFECT
This has been a recurring, repeated problem on this project — new
visuals keep shipping that cost real frame time on weaker mobile GPUs,
each one requiring a separate follow-up pass to fix after the fact.
Treat performance as a constraint to check BEFORE building a new visual
effect, not something to patch afterward once it "feels slow":
- **The app already has a two-mode Graphics system — use it, don't
  bypass it.** `UiPrefs.graphicsMode` (`'glass' | 'performance'`,
  `store.ts`) toggles an `html.gfx-performance` class (`App.tsx`) that
  `src/index.css` uses to strip `backdrop-filter` app-wide via the
  shared `.glass-panel` class and `.backdrop-blur-*` utilities.
  **`'performance' is the default for every new install`** — most
  players are seeing the flat/no-blur mode, not the full-glass one, so
  design and test against that mode as the real default, not as a
  fallback you check once at the end. A NEW component that wants a
  glassy look should use the existing `.glass-panel` class (or the
  `GLASS_SURFACE` pattern in `lib/glassChrome.tsx`) so it automatically
  gets both modes for free — never hand-roll a one-off
  `backdrop-blur-xl` + custom opacity combo on a new element that
  isn't wired through this system, since that reintroduces exactly the
  ungated blur cost the system exists to prevent.
- **Cheap vs. expensive, by category — default to the cheap column.**
  Expensive (a real per-frame GPU compositing/re-blur cost,
  particularly stacked several layers deep or under scroll/animation):
  `backdrop-filter`, an animated `filter: blur()` (a permanently-
  `animate-pulse`d blurred layer is the worst version of this — it was
  the actual root cause the last time "screen response is slow" got
  reported), `will-change` applied broadly across many simultaneous
  elements. Cheap (a one-time paint, not recomputed every frame):
  `opacity`, `transform` (scale/translate — this is what Framer Motion's
  `whileHover`/`whileTap` already use), CSS gradients, `box-shadow`
  (including `inset`). A convincing "glass" look does not require a real
  blur — a subtle multi-stop gradient plus an inset top-edge highlight
  reads as glassy through the same depth/highlight cues a human eye
  actually associates with glass, at a fraction of the cost; see
  `html.gfx-performance .glass-panel`'s own fallback recipe in
  `index.css` for the exact technique if a new component needs one.
- **Pure-atmosphere effects with no information value get hidden on
  mobile outright, not just shrunk.** If an effect is decorative only
  (an ambient particle, a glow orb, a sparkle) and animates
  continuously for as long as a screen is mounted, gate it out entirely
  under `@media (max-width: 768px), (pointer: coarse)` rather than
  reducing its blur radius or size — a hidden effect costs nothing; a
  smaller animated blur still costs a per-frame re-composite. An effect
  that DOES carry information (e.g. a state indicator) can shrink/cheapen
  instead of disappearing.
- **Test in Performance mode, on the checklist, every time.** Before
  calling a new screen or component done, toggle Settings → Graphics →
  Performance ON and look at it — that is what a real default install
  looks like. A visual that only looks right under full Glass mode is
  only right for players who've opted into a setting most won't touch.

TYPOGRAPHY
Harmonized three-font system:
- Headers & Titles — Cinzel (serif): headings, campaign titles, turn
  numbers, button labels, turn-state badges
- Narrative Prose — Lora (serif, 400/500/Italic): story text, NPC
  dialogue, campaign descriptions, 
- Player Input Fields — Plus Jakarta Sans
- Metadata & System Codes — JetBrains Mono (400/500): timestamps,
  day/time tracking, currency counters, stat pools
Keep font sizes restrained and mobile-appropriate — do not oversize
headers, labels, or titles.

NARRATIVE TEXT FORMATTING — PROSE, NOT UI CHROME
Narrative output must read like an actual novel, not a game HUD. Use
real prose typography instead of colored chips/badges/pills embedded in
narrated text:
- *Italics* for emphasis, internal thought/monologue — not a colored span
- Standard prose punctuation for dialogue (quotation marks, em dashes) —
  not colored/bordered dialogue bubbles
- Paragraph breaks and spacing for pacing, like a real novel
- Bold sparingly, if at all — reserve for genuinely rare narrative beats
Colored chips/badges/pills belong ONLY in structured UI outside the
narrative flow (Action Suggestion Pills below the text, stat displays,
Codex tags) — never mixed into the prose paragraphs. If a turn surfaces
structured data (item gained, stat change), show it as a distinct UI
element adjacent to or below the prose, not inline within a sentence.
(The client already renders `[Skill]`/`[[Item]]`/`'thought'` as styled
inline text — bold/italic plus a token color, not a bordered badge —
which is the "real prose typography" version of highlighting these,
not an exception to this rule.)

UI TEXT / COPY
Keep all UI text (labels, buttons, tooltips, empty states, etc.)
concise and user-friendly. Avoid wordy phrasing.

LIBRARIES
Framer Motion is welcome for animations/transitions where genuinely
useful and efficient — not a blanket default for every interaction.

CONFIRMATION / DESTRUCTIVE ACTIONS
Never use native window.confirm() or window.alert() for CRUD/cancel/
confirmation flows. Always use a custom modal dialog component (styled
to match the glassmorphism visual style).

LLM RESPONSE / LATENCY HANDLING
Since the narrator is LLM-driven, responses will not be instant. Always
show a clear waiting state while a response is pending. Never let the
UI freeze or look broken during a wait. Never discard or lose the
player's typed input if a request is slow or fails.

CODEX NAVIGATION (Lore, Skills, Items, etc.)
On mobile: drill-down navigation — category list first, tap a category
to see entries, tap an entry for detail. Back navigation, not
simultaneous panels.
On PC/tablet: sidebar (category list) + content panel. Filter controls
at the top of the content panel when a category has groupable fields
(e.g. Items by rarity/type). Search bar above each entry grid. Don't
add filters to categories without meaningful groupable fields.

SAVE DATA VERSIONING
All save data includes a schemaVersion field. When the registry/save
shape changes, add a migration step rather than assuming all saves
match the current shape. Run migrations in sequence on load if a save's
version is behind current.

CODE STYLE
TypeScript required for all files (.ts/.tsx) — real types/interfaces for
props, state, and registry/memory data structures; avoid `any` where
reasonably avoidable. Prefer Tailwind utility classes as default. Custom
CSS is fine when genuinely more optimized (complex glass/blur effects,
animations, keyframes) — keep it scoped and note why in PROJECT_NOTES.md.

ASSET PATHS (GITHUB PAGES DEPLOYMENT)
Never hardcode a leading `/` for asset paths — breaks on GitHub Pages'
subpath. Use static imports, the `public/` folder convention, or
`import.meta.env.BASE_URL` so paths resolve correctly both locally and
deployed. Compress images (WebP) and audio before adding to public/.

API KEY HANDLING (DEV/TESTING PHASE)
The current Gemini API key is temporary, for testing LLM responses
in-game, and will be deleted before this is a real product. Persist it
in localStorage so it doesn't need re-entering each session. This is a
dev-only convenience, not how end-user keys should ultimately be handled.

MODEL LIST HANDLING
The selectable Gemini model list is a fixed static config, not derived
from live API responses. Never remove, filter, or modify entries based
on API errors, rate limits, or failed test calls.


## Keeping `PROJECT_REVISION_NOTES.md` updated

Maintain a file called `PROJECT_REVISION_NOTES.md` at the repo root. Its
purpose: let me hand this project to Claude Code (or any other agent) later
and have it pick up instantly, without me re-explaining anything.

**When to update it:**
- After any big or structural change (new feature, architecture change,
  something that took real back-and-forth to get right, a bug whose cause
  wasn't obvious).
- Whenever I say "update the notes" or similar.
- You don't need to log small/routine edits — use judgment. If it wouldn't
  matter to someone resuming the project cold, skip it.

**What to write, each time:**
- Add a new entry at the **top** of the Revision log section (most recent
  first). Never delete or rewrite old entries — only add.
- Be concrete: name the actual files/functions changed, not vague summaries.
  "Fixed the audio bug" is useless later; "toggleMute() never called play(),
  so unmute did nothing — fixed in resume()" is useful.
- If something was a genuinely non-obvious trap (cost real time, looked like
  a bug but wasn't, or vice versa), call it out clearly so it's not
  re-debugged from scratch next time.
- Say what you actually verified vs. what you're assuming works. Don't
  imply something was tested if it wasn't.
- Keep a short "pending / what's next" list near the top of the file,
  updated to reflect current priorities — strike through items when done.

**Format for each log entry:**
```
- **<date>** — <what changed, in plain terms>. <Why, if it wasn't obvious>.
  <How it was verified, if relevant>. <Anything still outstanding.>
```

If the file doesn't exist yet, create it with just a title, a short
"what this project is" paragraph, a pending-work list, and an empty
Revision log section — no need for anything fancier than that.
