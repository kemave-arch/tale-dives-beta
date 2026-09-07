
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
guess). The model's raw response is exactly two top-level elements:
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
for a real, measured reduction in output tokens.
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
- Performance: backdrop-blur is expensive on lower-end mobile GPUs.
  Opacity-based translucency (semi-transparent background, no blur) is
  an acceptable alternative. Avoid stacking multiple blurred layers at
  once. Exclude `backdrop-filter` from transition lists (Tailwind's
  `backdrop-blur-none` compiles to keyword `none`, which can't animate
  against a numeric blur — causes a "stuck blur" bug).
- Contrast: text/UI over the cycling background must stay legible
  regardless of which image is active — use a scrim, gradient overlay,
  or sufficiently opaque backing behind text.

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
