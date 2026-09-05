# Tale Dives — Project Revision Notes

**Last updated:** 2026-09-05, Claude Code on the web — a real live payload surfaced
four distinct bugs at once: duplicate NPC/Location Codex entries ("Stone-Gait
Sentry" and "Stone Gait Sentry" as two separate records), locations never
getting a real description, and a "temporal hallucination" where a chapter
recap's prose implied days had passed when the record showed a few in-game
hours. Root-caused and fixed all four:
- **NPC/faction/lore/quest/beast/skill duplication** — `slugify()`
  (`lib/slug.ts`) split words on whitespace only, so a `{{Term|npc}}` tag's
  "Stone-Gait Sentry" (hyphen) and an `npc_mem_up.npc_id` of
  "stone_gait_sentry" (underscore) produced two different keys and forked
  into two Codex entries for the same person. Fixed by collapsing hyphens
  and underscores to spaces before splitting, so all three separators
  converge on one slug — a single-function fix that covers every keyword-tag
  category, not just NPCs.
- **Location duplication** — a deeper issue: `loc_id`-driven registration
  (`loc_id`/`loc_disp`, a per-waypoint id the model tracks) and
  `{{Term|loc}}`-driven registration (a slug of whatever freeform place name
  gets tagged inline) are two entirely disjoint id spaces that the slugify
  fix alone can't unify — "Iron-Bound Peaks" (a tagged region name) and
  "Iron-Bound Peaks - The Ravine" (a loc_id waypoint) will never collide on
  id alone. Added a heuristic backstop instead (`lib/codex.ts`,
  `isKnownByName`): skip minting a new location stub when its name already
  contains, or is contained by, an existing location's name. Also reordered
  App.tsx's turn pipeline so the current turn's own loc_id/loc_disp registers
  *before* the keyword-tag pass runs (previously the reverse), so a same-turn
  region-name tag has something to dedup against instead of forking before
  the "real" entry even exists. Also added rule 2b (Name/ID Consistency) so
  the model itself is told to reuse an established place/NPC name exactly
  rather than inventing "Ironheart" vs "Ironheart Crag" for one settlement.
- **Locations never getting a real description** — `ensureLocation` always
  wrote a hardcoded "(Auto-logged — visit again or add detail manually.)"
  placeholder with no schema channel for the model to ever replace it,
  the same structural gap fixed for quests earlier this session but never
  extended to locations. Added `loc_desc` (types.ts/turnContract.ts, named
  short per the existing loc_disp/loc_id convention) — an optional field
  sent only when a loc_id is first visited or its description genuinely
  changes, same economy as quest_update.description.
- **Temporal hallucination** — the chapter-recap prompt (`runSummary`,
  gemini.ts) asked for "a rich, narrated recap... several full paragraphs...
  evocative," with zero grounding in how much real in-game time the chapter
  actually covered — so it naturally reached for saga-length language ("a
  grueling ascent," implicitly "days of hardship") even when the log showed
  a single afternoon. A real payload had the player mockingly quote this
  back: "Wait, days? I just met her this morning." Fixed by computing the
  chapter's actual start/end GameTime (App.tsx's new `chapterStartTime`,
  reading back to the last chapterSummary marker) and threading it through
  `RunSummaryParams` into an explicit grounding sentence in the prompt:
  the real span, plus an instruction not to imply more time passed than
  that. Verified via a stubbed `fetch` that the real `runSummary` function
  builds this sentence correctly.
- **Bonus, additive-only**: `firstSeenTime`/`lastSeenTime` on NpcEntry and
  `firstVisitedTime`/`lastVisitedTime` on LocationEntry (the user's own
  suggested fix), surfaced as "First Seen: Day X HH:MM" in the existing
  per-turn context lines (`describePresentNpc`/`describeKnownLocation`) —
  an explicit real-clock anchor for the model to check its own narration
  against, alongside the recap fix. Also surfaced NPC `role` in
  `describePresentNpc` (e.g. "Role: Frost-Tithe Sentry") per the user's
  other suggestion, though the actual duplication root cause was the slug
  mismatch above, not a missing title field — this is a complementary,
  zero-risk addition, not the fix itself.
- Also, per explicit request: strengthened the INTIMACY turn-state guideline
  to call for charged, vulnerable dialogue between both partners (not just
  narrated physical description carrying the scene alone) and immediate
  sensory "heat" — while keeping rule 5's existing fixed scene-break
  boundary for anything beyond kissing/embrace explicitly referenced right
  in the INTIMACY bullet itself, since that boundary doesn't flex based on
  this kind of request.
- Live-verified all of the above end-to-end (not just unit-style): replayed
  the exact turn sequence from the reported payload (Iron-Bound Peaks tag +
  loc_start waypoint, Stone-Gait Sentry tag + stone_gait_sentry npc_mem_up,
  Ironheart Crag as a genuinely distinct place, Ironheart tag correctly
  deduping against an already-registered Outer Gates waypoint) and confirmed
  no forked entries, correct First Seen timestamps, and the real
  `runSummary` producing the grounded recap prompt text.

**Last updated:** 2026-09-05, Claude Code on the web — added Turn State-triggered
soundtrack switching with crossfade. Filenames can now opt out of the ambient
rotation and into a per-Turn-State pool via a `ts-<state>_` prefix (e.g.
`ts-combat_ironclash_ost00.opus`), parsed by `parseTurnState()`
(`soundtrackManifest.ts`) the same way the `_ostNN` order suffix already was
— still hand-added to the manifest like every other track, since browsers
still can't list `public/tracks/` themselves. `backgroundMusic.tsx`'s
discovery now partitions found tracks into the ambient list plus a
`Partial<Record<TurnState, string[]>>` of pools; a new `setTurnState()`
(exposed from `useBackgroundMusic`) fades the current track out, swaps to
the target pool (or back to ambient rotation) once the fade completes, and
fades the new one in — a single-track pool loops in place, a multi-track one
rotates on `ended` the same way ambient rotation does. `App.tsx` wires this
to the game: an effect computes the last *narrated* turn's `turnState`
(reusing `findLastNarratedIndex`) and calls `setTurnState` whenever it
changes, so combat (or any other tagged state) music kicks in automatically
without an explicit player action, and a no-op when the state hasn't
actually changed. Manual OST controls (`playTrack`/`nextTrack`/`prevTrack`)
always win over an active state pool if the player uses them mid-combat.
Live-verified against real audio: temporarily copied an existing track to a
`ts-combat_testcue_ost00.opus` test asset, seeded campaigns with a last
narrated `turnState` of `null`/`PEACE`/`COMBAT`, and confirmed via the real
`<audio>` element that `PEACE`/no-turn correctly stayed on ambient rotation
(`loop: false`) while `COMBAT` correctly switched to the pool track with
`loop: true` (a single-track pool loops in place rather than rotating) —
then removed the test asset and its manifest entry. The live mid-session
fade-out/fade-in transition itself (as opposed to which track loads on
mount) reuses the same `fadeTo`/`startTrack` helpers the pre-existing
ambient rotation already exercises every loop, so it wasn't separately
re-verified — flagging that as the one piece still worth a real ear-check
once actual `ts-combat_*` tracks are in `public/tracks/`.

**Last updated:** 2026-09-05, Claude Code on the web — built the structural fix
flagged (but not yet built) in the previous entry: NPCs now have real, tracked
gear. Added `heldWeapon`/`wornArmor` to `NpcEntry` (`types.ts`), a matching
`held_weapon`/`worn_armor` channel on `npc_mem_up` (`turnContract.ts`'s
`TURN_SCHEMA`, each field-described as "only send when first established or
visibly changed" — the same send-once-not-every-turn economy already used for
`quest_update.description`), storage in `applyNpcUpdates` (`lib/npcs.ts`, only
overwriting when the model actually sends a new value), and a restated
`Wielding: X | Wearing: Y` fragment in `describePresentNpc` so it rides along
in the existing per-turn "Present NPC" context-slice line — mirroring exactly
how the player's own equipment is restated every turn via `describeEquipped`
in `jitContext.ts`, no changes needed there since it just consumes
`describePresentNpc`'s return value. Rule 2a (Established Detail Consistency)
rewritten to point at this as the actual ground truth — the NPC's context-slice
line, not just narration discipline — and to instruct the model to report
first-establishment/changes through the new fields. Also wired into Codex CRUD
(`Codex.tsx`): "Held Weapon"/"Worn Armor" text fields in the NPC edit form and
matching rows in the detail view's Persona card, so a player can manually set
or correct an NPC's gear the same way `appearance`/`role` already work.
Live-verified: called `buildContextSlice` directly against a seeded NPC with
both fields set and confirmed the "Wielding: Rust-Pitted Spear | Wearing:
Dented Chainmail" fragment appears in the actual context-slice string sent to
the model; separately confirmed via the Codex UI that both fields render in
the NPC detail view and are editable in the edit form. This directly prevents
the reported bug's mechanism — an NPC's held weapon will now be present as an
explicit ground-truth line every turn they're on-page, not left to drift from
unanchored conversation history alone.

**Last updated:** 2026-09-05, Claude Code on the web — a real, upsetting live payload:
an NPC's established weapon (`>Rust-Pitted Spear<`, turns 0-1) silently became a
different one (`>Iron-Tipped Halberd<`, turn 4) with zero in-story explanation — a
genuine narrative continuity drift, not user error. Worse, when the player asked
about it (turn 5), the model in-fiction blamed the player character's own senses
("The cold plays tricks on the eyes of the uninitiated... you see what you expect to
see") rather than owning the inconsistency — using its narrative authority to
deflect its own mistake onto the player. Root cause for the drift itself: unlike the
player's own gear (restated every turn via `describeEquipped` in `jitContext.ts`),
nothing tracks what an NPC is currently holding — the model has only the raw
conversation history to "remember" it from, with no anchor, so a long IMMERSIVE-depth
turn re-describing a scene from memory can drift. Added two `SYSTEM_INSTRUCTIONS`
rules (both pure prompt text, no schema change): 2a "Established Detail Consistency"
— once an NPC's held weapon/gear/physical detail is established, never silently
swap or reinvent it without an in-story reason; 3b "Continuity Callouts" — when the
player flags an apparent inconsistency, treat it as correct and reconcile the story
around it, never retcon it as the player character's senses being unreliable unless
perception distortion is already an established element of the scene. Flagged to the
user, not yet built: a real structural fix — giving NPCs an actual tracked
"currently holding" field, restated every turn the way the player's own equipment
already is — would prevent this class of bug rather than just discourage it via
prompt instruction; that's a real schema change (new `NpcEntry` field, a channel for
the model to set it, a context-slice line) left for a future session pending the
user's go-ahead.

**Last updated:** 2026-09-05, Claude Code on the web — enforced the "basic" subset
(double quotes, single quotes, italics, capitals) of the rich-text dialogue table
proposed and then deliberately trimmed down earlier this session. Turned up a real,
pre-existing bug while doing it: `SYSTEM_INSTRUCTIONS` rule 6's dialogue bullet
conflated "spoken whispers" together with inner monologue under one single-quote/
italic treatment — exactly the inconsistency visible in an earlier real payload,
where plainly-spoken dialogue (`'Hi, Mira.'`) got single-quoted and rendered as
italicized interior thought instead of plain speech. Rewrote the bullet: double
quotes for anything audible to others (including whispers — a whisper is still
speech, just quiet), single quotes reserved for genuinely unspoken interiority
(inner monologue, silent telepathy) — already auto-italicized client-side by
`richText.tsx`, so the rule explicitly says never to also wrap it in literal
asterisks — and CAPITAL LETTERS on the words themselves for a shout or a panicked/
mental-scream line, in whichever quote style matches how it's delivered. Pure
`SYSTEM_INSTRUCTIONS` text again, no client-side parsing changes: double-quoted
text was never specially handled by `richText.tsx` to begin with (it only parses
`[skill]`/`>item<`/`'thought'`), and neither is capitalization — both are just
prose-level conventions for the model to apply, not new markup for the client to
detect.

**Last updated:** 2026-09-05, Claude Code on the web — resolved the open question from
the `stat_grant` NaN investigation (should a player's own claimed exact number, like
"+100 HP", be honored verbatim or moderated?) with a new convention rather than a
blanket policy either way: added rule 3a "Player Statement Override" to
`SYSTEM_INSTRUCTIONS` — text the player wraps in `*asterisks*` is now an explicit,
authoritative directive the model must make real through the normal mechanical
channels (still bounded by each field's own schema limits, e.g. deltas' ±500), then
narrate a justification for, rather than simply asserting flatly. Unmarked action
text is unaffected — ordinary prose still gets the model's normal narrative judgment
under rule 3 (Player Agency). Deliberately a pure prompt-text change with no schema
or client-side parsing involved: `richText.tsx` doesn't use `*` for anything (checked
before adding this, to rule out a collision), and the player's own action text
already passes through to the model as plain, unprocessed text either way, so no
code changes were needed on the client side. Not independently verifiable without a
live API call — build is clean, but there's nothing to click-test in the app itself
for a pure system-instruction change.

**Last updated:** 2026-09-05, Claude Code on the web — fixed a real usability gap in
last round's Edit/Retry/Delete turn controls (see below): a bang command (`!arise`,
`!inventory`, ...) is its own log entry with no `nar`/`rawPayload`, so running one
after a narrated turn made that turn's CRUD row vanish entirely — it was scoped to
"the literal last log entry," and a bang command becoming that entry knocked the
real turn before it out of eligibility even though nothing about it had changed.
Fixed by re-scoping eligibility to "the last *narrated* entry" (`findLastNarratedIndex`
in `App.tsx`, mirrored in `Chronicle.tsx`'s own `lastNarratedIndex` computation for
the `isLastTurn` prop) — bang commands trailing a narrated turn no longer hide its
controls. Retry/Delete now remove that turn *and everything after it* (narrated or
bang), not just one entry, since anything since was looked up or acted on against
state that's about to change — including a state-mutating bang command like `!arise`
(which the confirm-dialog wording now flags: "It — and anything since, like a bang
command lookup — will be removed..."). `history` removal is unaffected (still exactly
the last 2 entries): bang commands never touch `history` at all, so by construction
there's only ever one real API-backed turn between "the last narrated entry" and the
end of the log. Verified live in headless Chromium: seeded a narrated turn followed
by a `!items` bang-command dossier — Edit/Retry correctly stayed attached to the
narrated turn instead of disappearing, and Retry correctly removed both the bang
entry and the turn, re-seeding the input with the turn's original action, leaving
the *previous* turn as the new last-narrated one with its own working controls.

**Last updated:** 2026-09-05, Claude Code on the web — `corpses` (harvestable
slain-enemy essence, consumed LIFO by `!arise` for necromancer/Shadow Monarch
archetypes) existed in Campaign state via `corpse_add` but had zero visibility
anywhere — no bang command, no Codex entry. Added both: (1) `!corpses` in
`lib/bangCommands.ts`, following the exact `!minions` pattern — groups the flat
`corpses: string[]` by tag with a count (the same adversary is commonly slain more
than once) and cross-references the Bestiary for a real name/threat tier where the
bare tag matches a registered adversary, falling back to a title-cased tag
otherwise; (2) a new read-only "Corpses" Codex category (`Codex.tsx`), following the
`crafting` category's template (array-backed, no CRUD — a slain enemy isn't
something a player manually authors/edits) rather than inventing a new Dict-keyed
data model just for this. Hit and fixed a real gotcha along the way: `new
Map<string, number>()` failed to compile inside `Codex.tsx` specifically — this file
imports `Map` from `lucide-react` as the Locations category icon, shadowing the
built-in constructor file-wide, so the grouping there uses a plain object instead
(bangCommands.ts, a plain .ts file with no such import, uses a real `Map` and is
unaffected). Verified live in Chromium: `!corpses` renders "Orc Vanguard Captain ×2
· standard" / "Uruk Hai Grunt ×1" (bestiary-matched vs. fallback-named), and the
Codex category shows identical grouped content with the correct count on its
category-grid card. Also gave the bang command a proper dossier icon/label
(`Ghost`, "Harvestable Corpses") in Chronicle.tsx's `BANG_DISPLAY` map — without it,
it fell back to a generic "Unclear Reference" label despite resolving correctly.

**Last updated:** 2026-09-05, Claude Code on the web — a live user test of the
`deltas` fix below surfaced a worse, active bug: testing with "+100 HP" produced
`"stat_grant": {"pool": "hp"}` with **no `amount`** — the model picked `stat_grant`
(the permanent-boost mechanic, arguably reasonably given the dramatic "overloading
myself with power" phrasing) over `deltas`, and then left it incomplete, since
`amount` was never marked `required` on that schema object. `App.tsx`'s apply logic
did `hpMax + grant.amount` with `amount === undefined`, producing `hp: NaN, hpMax:
NaN` — confirmed live via a screenshot showing "HEALTH: NaN/NaN". Worse, the existing
"defensive final clamp" didn't catch it: `Math.min/max(NaN, x)` is always `NaN` in
JS, so it wasn't actually a safety net against this failure mode, just against
out-of-range numbers. Three-part fix: (1) `App.tsx` now guards `grant.amount` at the
point of use — a missing/non-finite amount is treated as no grant at all, not a
corrupt one; (2) the final clamp itself is now genuinely NaN-safe, falling back to
the attribute-derived base pool (via `derivedPools`) for any of hp/mp/st *or* their
max, rather than silently passing NaN through as if clamped; (3) `store.ts`'s
`loadCampaigns()` backfill loop (same pattern as its existing schemaVersion
backfill) now repairs any already-corrupted save on load — verified live that a
seeded `hp: null, hpMax: null` (NaN round-trips through JSON as `null`, which
`Number.isFinite` also correctly rejects) repairs to a real number the moment the
campaign loads, no player action needed. Also strengthened `TURN_SCHEMA`'s
`stat_grant` description to explicitly rule out temporary/in-the-moment surges
(combat power spikes, potion effects) even when the player's own phrasing sounds
dramatic — those belong in `deltas` — and added `required: ['amount']` so this
specific incomplete-grant shape can't recur. The underlying judgment call (does a
player's own claimed exact number, like "+100 HP", get honored verbatim, or does the
model treat it as a proposal to moderate?) is flagged to the user as still open,
not decided here.

**Last updated:** 2026-09-05, Claude Code on the web — three small changes plus one
real bug fix, all in response to a live payload report (a player narrated healing/mana
restoration outside combat, but `deltas` was silently omitted). (1) Strengthened
`turnContract.ts`'s `deltas` field description to explicitly cover non-combat stat
changes (resting, healing, potions, poison, currency) — previously the description
only ever talked about combat, so the model had no instruction connecting narrated
non-combat vitals changes to a mechanical obligation to emit them. (2) Added lean,
purely client-side icon decoration for item/location mentions in narration
(`richText.tsx`): `ITEM_TYPE_ICONS` keyed off the already-tracked `ItemEntry.type`,
and a keyword-match `locationIcon()` off the already-freeform `LocationEntry.locationType`
— zero schema/prompt changes, zero added output tokens, matched by name against the
Codex dicts (now threaded into `renderNarrative`/`renderTags`) with silent fallback
to no icon if nothing matches. Considered (and rejected, per the user's own
instinct) a much larger emoji-based rich-text overhaul — token-costly, ambiguous for
a Romantasy-leaning game where symbols like ❤️ already carry narrative weight, and
duplicative of the existing `{{Term|category}}`/bracket tagging system. (3) Fixed
the player's own typed action text losing line breaks — `entry.action` rendered
without `whitespace-pre-wrap`, so a multi-line action (Shift+Enter in the input)
collapsed into one run-on line; now matches the narration's own treatment. Also
noted but not yet fixed: world-seeding's auto-registered starting Location Codex
entry gets a hardcoded placeholder description (`lib/locations.ts`'s `ensureLocation`),
never anything LLM-authored — the same underlying gap already fixed for Quests
in the entry below, confirmed to also affect NPCs and Skills' auto-register paths.
This is the concrete case for a proposed (not yet built) pre-dive Codex-seeding
pass — discussed at length but intentionally not scoped into a plan yet, pending
further to-do items the user wants to add first.

**Last updated:** 2026-09-05 — Typewriter Narration Removal:
- **Removed Typewriter Narration**: Removed `TypewriterText` component and character-by-character animation logic from `Chronicle.tsx`. Narration now renders immediately upon turn generation.
- **Verification**: Verified via `lint_applet` (clean `tsc --noEmit`) and `compile_applet` (clean build).

**Last updated:** 2026-09-05 — Menu & Screen Header Text Color:
- **Header Text Color Updated**: Changed menu and screen header text colors in `GlassHeader` (`src/lib/glassChrome.tsx`) and `Settings.tsx` from `#f0ca65` to `#e8ca8a` across Story Viewer and Menu UIs.
- **Verification**: Verified via `lint_applet` (clean `tsc --noEmit`) and `compile_applet` (clean build).

**Last updated:** 2026-09-05 — Codex Sleek Dark Card Theme & Sans Subtitles:
- **Codex Dark Navy Card Aesthetic**: Updated card styling across all categories in `Codex.tsx` (`CATEGORY_ACCENTS`, `NEUTRAL_ACCENT`, `ITEM_RARITY_ACCENTS`, `DeckEntryCard`) to match the dark navy/charcoal sleek card theme from the reference photo. Cards use deep charcoal-navy background (`bg-[#131622]/90`), subtle dark border (`border-[#23283b]`), rounded corners (`rounded-xl`), rounded icon badges (`w-8 h-8 rounded-xl bg-[#1b1f2e] border border-[#2b3145] text-[#e8ca8a]`), gold uppercase titles (`text-[#e8ca8a] font-display font-bold uppercase tracking-wider`), muted descriptions (`text-[#9095a8]`), and dark numeric count badges (`bg-[#1a1d2b] border-[#2d3348] text-[#a0a5b8] font-mono`).
- **Smooth Sans Category Subtitles**: Updated `DeckEntryCard` subtitle typography to use `font-sans` for a smooth, clean sans-serif category description.
- **CODEX ARCHIVES Container Box**: Wrapped the main category menu grid in a dark framed box with a `CODEX ARCHIVES` header and total categories count.
- **Verification**: Verified via `lint_applet` (clean `tsc --noEmit`) and `compile_applet` (clean build).

**Last updated:** 2026-09-05 — Codex Compact Deck Views & Crafting Rename:
- **Compact Deck View Cards**: Compacted the card padding, icon badge sizes, and typography spacing across all Codex categories (`CATEGORY_ACCENTS`, `NEUTRAL_ACCENT`, `ITEM_RARITY_ACCENTS`, `DeckEntryCard`, and Crafting recipe cards). Reduced padding (`p-2.5`), badge size (`w-7 h-7`), icon size (`14px`), and line spacing for a tighter, denser RPG codex layout.
- **Renamed Category**: Renamed "Workbenches & Recipes" category to "Crafting" in `Codex.tsx` (`categories` array label and category headers).
- **Verification**: Verified via `compile_applet` (clean build) and `lint_applet` (clean `tsc --noEmit`).

**Last updated:** 2026-09-05 — Chronicle Story View Refinements:
- **Centering Text Container**: Centered the log container (`max-w-2xl sm:max-w-3xl mx-auto w-full`) inside the Parchment view while keeping the narrative prose and player action text left-aligned (`text-left`).
- **Updated Drawer Menu Button**: Replaced the drawer icon with `LayoutGrid` on the input bar tray and popup header.
- **Harmonized Button Hover Colors**: Harmonized hover states across all input tray buttons (`/` slash manager, `LayoutGrid` drawer menu, and `Send` button) to use identical gold highlight styling (`hover:border-[#f0ca65] hover:bg-[#2c1d3e] hover:text-[#f0ca65]`).
- **Full-Width Mobile/Tablet Input Bar**: Adjusted the input tray to cover the full width of the screen at the bottom on mobile/tablet (`bottom-0 inset-x-0 rounded-t-2xl border-t border-x-0 border-b-0`), transitioning to a floating bar on desktop screens (`lg:bottom-5 lg:inset-x-6 lg:max-w-4xl lg:rounded-2xl lg:border`).
- **Enlarged Textarea Height**: Increased default rows to `2` and increased minimum vertical height (`min-h-[56px] py-2`) for comfortable typing.
- **Typewriter Narration Animation**: Integrated `TypewriterText` component in `TurnBlock` so new LLM outputs type in progressively with a glowing pulse cursor, with click/tap-to-skip support to immediately reveal the full text.
- **Verification**: Verified via `lint_applet` (clean `tsc --noEmit`) and `compile_applet` (clean build).

**Last updated:** 2026-09-05 — Story View / Chronicle UI Refactoring:
- **PC Two-Column Layout**: Added `DesktopLeftSidebar` in `Chronicle.tsx` visible on desktop breakpoints (`lg:`). Displays character info & attributes, pools (HP/MP/ST + wealth), equipped gear slots (Weapon, Armor, Accessory), and tactical combat HUD on the left, while the Parchment log renders on the right. Mobile and tablet maintain the single-column centered reading view.
- **Input Bar Drawer Menu**: Replaced the previous radial menu with a responsive Codex Navigation drawer menu that extends upward from the input bar. Features rounded-square (`rounded-xl`) icon buttons for Items, Spells, Quests, Monsters, World, NPCs, Factions, Lore, and Crafting. Clicking anywhere on the Parchment automatically retracts the drawer.
- **Elevated Input Bar & Mobile Alignment**: Elevated the input tray above screen bottom with responsive spacing (`bottom-3 sm:bottom-5`). Added `text-center sm:text-left` alignment to mobile narrative prose and action text. Fixed hostile name truncation in the combat header by displaying untruncated name labels.
- **Verification**: Verified via `lint_applet` (clean `tsc --noEmit`) and `compile_applet` (clean build).

**Last updated:** 2026-09-05, Claude Code on the web — five changes from a token-budget
review + a real user-reported gap. (1) A light pass on `jitContext.ts`'s context-slice
labels: `Combat Resolution Mode`→`Combat Mode`, `Target Prose Depth`→`Prose Depth`,
`Base Copper Wealth`→`Copper` — kept in sync with `SYSTEM_INSTRUCTIONS`' own quoted
references to the first two, since the model looks those labels up by exact string.
(2) Fixed a real content gap behind "Quest progression seems stale": `quest_update`
(schema + `QuestUpdate` type) only ever carried `quest_id`/`status`/`note` — no channel
existed for `description`, so Codex quest entries could never hold more than an
auto-title-cased name and a one-line status note, no matter how far a quest advanced.
Added an optional `description` field (schema guidance: only send it the turn a quest
is first introduced or its scope changes, so it doesn't repeat every turn), threaded
through `applyQuestUpdate` (`lib/quests.ts`). (3) Fixed a latent bug in
`applyInventoryChanges` (`lib/inventory.ts`): every `inv_add` fully rebuilt the Codex
item record from scratch, silently wiping any player-set `rarity`/`loreText`/`value`/
`tags` on a repeat acquisition of an already-known item — now spreads `...existing`
first. (4) Investigated a report of items missing descriptions in Codex; traced the
full pipeline (schema → merge → state save → render) and found it already correct
end-to-end — likely a stale save from before the pipeline solidified, not a live bug;
flagged for a fresh repro if it recurs. (5) Added turn-management controls to
Chronicle: Edit/Retry/"..." (View Payload + Delete) buttons, but *only* on the single
most recent real narrated turn — editing rewrites both the displayed `nar` and the
matching raw JSON in both `log` and the live `history` sliding window (via a new
`patchNarInRawPayload` in App.tsx, reusing `gemini.ts`'s now-exported `sanitize`) so
what's shown and what the model actually remembers next turn never drift apart; Retry
removes the turn and re-seeds the input box with the original action text for the
player to revise and resend; Delete just removes it. Both Retry and Delete route
through the existing `useConfirm` modal first. Deliberately scoped to *context*
management only — HP/inventory/quest deltas that turn already applied are NOT rolled
back, same as this app has never had a general undo system; said so directly in the
code comments rather than pretending it's a full undo. Verified in headless Chromium:
Edit/Retry/"..." appear exactly once (only the last turn), "..." reveals Delete Turn
+ View Payload, Edit+Save updates the visible text, and Retry correctly removes the
turn, re-seeds the input, and the controls correctly follow to the new last turn.
Earlier the same day: removed the sub-3.0 Gemini
models (`gemini-2.5-flash`, `2.5-flash-lite`, `2.0-flash`, `2.0-flash-lite`) from
`GEMINI_MODELS` per the user's call, after a long side investigation (see below)
into whether the Interactions API — the newer, stateful Gemini endpoint the
`gemini-2.0-flash-lite` deprecation error kept pointing at — was worth migrating to.
Verdict, after actually confirming the endpoint is real and reading its full API
reference: not worth it right now. It would save on re-uploaded history for long
campaigns, but the truncation bug that started this is already fixed by the
`thinkingBudgetOverride` change below, and migrating would trade away the one thing
Chronicle's debug tooling exists for — visibility into exactly what the model sees
each turn — since the Interactions API's "story memory" lives opaquely server-side
via `previous_interaction_id`, distinct from Tale Dives's own deliberately-curated
`buildContextSlice` (which would still be needed either way). `thinkingBudgetOverride`
in `gemini.ts` stays as-is (its `!model.startsWith('gemini-2.0')` guard is now
unreachable via the model picker, but is left alone as a harmless defensive check for
anyone whose saved settings still reference a since-deprecated model). Earlier: a live
diagnostic report from the user (`gemini-2.0-flash-lite` had actually been sunset
server-side, confirming the older-models addition below was already needed as a
fallback, before being removed again per this same entry) surfaced a real, separate
bug: `ApiErrorPanel` (Chronicle's "FATE THREAD FALTERED" card) rendered almost
illegibly — labels and secondary buttons washed out to near-invisible pale gray-pink.
Root cause: the panel used the semantic `text-ink`/`text-ink-muted`/`text-gold-primary`
tokens, but it only ever renders inside `.parchment-surface` (Chronicle's reading area),
which re-points those exact token names to *dark* values meant for cream paper — while
the panel's own box stayed a translucent, blurred **dark** background
(`bg-surface-raised/80 backdrop-blur-md`). Dark text tokens on a dark, blurred box is
the washed-out look reported. Fixed by hardcoding the panel's own palette (explicit hex
values immune to ambient re-pointing) instead of the semantic tokens, and dropping the
translucency/blur for a solid opaque `bg-[#181022]` box per the user's ask for a
non-glassmorphic design; "Retry Now" is now a bold filled rose CTA (white text) and the
three secondary buttons got real contrast (`bg-white/10`/`border-white/15` on cream
text) instead of the old barely-there `white/5`/`ink-muted` combo. Verified with a
side-by-side static render (old vs. new markup against the actual compiled
`.parchment-surface` CSS) — see `panel_compare.png` reasoning: old renders as a flat
pale blur box with illegible labels/buttons, new renders as a solid high-contrast panel
with a clear primary action. Not yet verified against a real triggered API error in the
live app (seeding a fake campaign to reach Chronicle's error state via Playwright proved
too fragile to set up quickly); worth a real click-through next session. Earlier the
same day: landed the actual fix for the live truncation investigation below, on the
user's own call ("i think non lite flash and pro models are prone to this anyway")
rather than waiting on a confirmed `MAX_TOKENS` payload first. `gemini.ts` gained
`thinkingBudgetOverride(model)`, added
to `generationConfig` in both `requestOnce` (turn generation) and `runSummary`
(chapter recaps): it sends `thinkingConfig: { thinkingBudget: 0 }` for every model
*except* `-flash-lite` variants (thinking already defaults off there) and the
`gemini-2.0-*` generation (predates thinking entirely, doesn't accept the field) —
i.e. every non-Lite Flash and every Pro model gets thinking disabled, freeing the
whole `maxOutputTokens` budget for visible narration instead of invisible reasoning.
**Caveat flagged but not yet verified**: some real Gemini Pro models require a
nonzero minimum thinking budget and reject `thinkingBudget: 0` outright — if a
`gemini-3.1-pro-preview` turn starts 400ing after this change, that's the first
thing to check (the debug tooling from the entries below — `finishReason` and the
per-turn/session payload panels, both now gated behind Debug Mode — should make that
easy to spot). Below is the debug/config tooling that led here: (1) `GEMINI_MODELS`
gained 4 older generations (2.5 Flash/Flash Lite, 2.0 Flash/Flash Lite) alongside the
existing 3.x lineup, kept selectable as a fallback; (2) the default model in
`loadApiSettings()` changed to `gemini-3.5-flash-lite` (only affects a genuinely
first-ever load — existing saved settings are untouched); (3) the session-wide
payload export from the previous entry was reworked, per correction — no more `.txt`
file download, instead a `SessionPayloadPanel` matching the per-turn debug button's
copy-to-clipboard UX, toggled open from a new header icon and rendered inline inside
the `<header>` itself so the `ResizeObserver`-driven parchment `paddingTop` reflows
around it automatically; (4) both that panel and the pre-existing per-turn "View
Payload" button now only render when Debug Mode (`uiPrefs.debugMode`, Settings'
existing toggle) is on, instead of always being visible. Verified in headless
Chromium: debugMode off shows zero debug buttons of either kind; debugMode on shows
the session panel toggle plus one per-turn button per turn, the `MAX_TOKENS` rose
flagging on a per-turn button, and the expanded session panel rendering correctly with
its content reflowing the reading surface beneath it.
Earlier the same day: `LogEntry`/the debug panel gained `finishReason` surfacing (see
below), and a since-superseded session-export button (see above). Earlier still: a
follow-up pass on the Codex
overhaul: 4 categories whose data genuinely differs in shape from the rest got their
own visual treatment instead of the shared accent-card template alone — Items now
carry a real RPG loot-rarity border/glow (grey/green/blue/purple/gold), Bestiary shows
HP/Base Damage as a monster-manual stat block, Factions got a 5-segment reputation
gauge, and Quests a colored status ribbon (in-progress/completed/failed). See the log
entry below. Earlier today: the Codex overhaul itself — every entry
type (NPCs, Factions, Locations, Lore, Quests, Bestiary, Skills, Items) gained real
depth fields (Lore in particular had *no body text field at all* before this), and the
whole screen moved from a plain flat list/label-value UI to a per-category
accent-colored "modern fantasy RPG card" treatment matching MainMenu's Vault grid and
PresetDetailModal's hero-card recipe. Also added a debug-payload button on each
Chronicle turn (view + copy the exact request/response, for reporting bugs here or in
AI Studio). See the log entry below for the full field list and verification. Earlier
today: fixed a real regression from the prior entry (saved-Tale card backgrounds went
transparent) that turned out to be a much older, previously-undiagnosed bug:
`bg-transparent` in `GLASS_SURFACE` was silently winning the cascade over every
caller's own background color, everywhere, propped up only by `backdrop-blur-sm`
blurring the art behind it. Also fixed the Chronicle parchment surface's Tailwind
color utilities (`text-gold-primary`, `text-skill`, etc.) never actually re-pointing
to their light-paper values — same class of bug, different mechanism. Also: the
player's own action
echo now reads as novel-style italic prose instead of a `font-mono "> "` console line,
and the 9 turn-state accent colors got parchment-safe variants.

> ## 🎨 READ THIS BEFORE TOUCHING ANY SCREEN — the app now has ONE theme
> The selectable parchment/obsidian **skins are gone** (`UiPrefs.skin`, the `Skin` type,
> the `data-skin` attribute and the Settings picker were all removed). There is one
> dark-glass theme, defined once in `index.css`, using the values Title/MainMenu had
> been hardcoding. If you see `data-skin` or `Skin` referenced anywhere, it's stale.
>
> **Two grounds, picked by `GlassScreen`'s `ground` prop:**
> - `ground="art"` — the cycling artwork + scrim. Used by the path *into* a tale:
>   Title, Main Menu, Story Mode, World Setup, Protagonist Setup, Tale Brief.
> - `ground="dark"` — flat `bg-canvas`. Used by the screens you work *inside*:
>   Chronicle, Codex, Settings. Dense text; artwork would fight it.
>
> **The one deliberate inversion:** the Chronicle's reading card is warm light paper.
> `--td-ink` therefore does double duty (text on dark chrome vs text on cream paper), so
> `.parchment-surface` in `index.css` re-declares the ink/gold/semantic tokens for that
> subtree only. Every `text-ink`/`text-gold-primary`/`text-skill` inside it re-points
> through the cascade — which is why TurnBlock's and richText's ~40 classNames needed no
> edits. **Anything you add inside the reading surface inherits this automatically; do
> not "fix" a color there by hardcoding it.** Shipping the class but forgetting to apply
> it to the card is exactly the bug that made narration invisible for one commit
> (`0637f88`).
>
> **Build screens out of `src/lib/glassChrome.tsx`, not from scratch** — that's what the
> three-way drift was. It exports: `GlassScreen`, `GlassHeader`, `GlassTabs`,
> `GlassCTAButton` (a screen's ONE primary action), `GlassButton` (tones: default /
> action / danger / positive), `GlassIconButton`, `GlassField`, `GlassSegmented`,
> `FIELD_CLASS`, `SELECT_CLASS`, `LABEL_CLASS`, `GLASS_SURFACE`, `DASHED_ROW_CLASS`,
> `DashedCard`, `TAPER_CLIP`. Use `SELECT_CLASS` (not `FIELD_CLASS`) on every `<select>`:
> it overrides the option background, because a transparent select renders an unreadable
> near-white OS popup on Windows/Chrome.

Previous entry: 2026-09-03, end of a Claude-Code-on-the-web session, written as a
leaving-the-desk handoff.

Everything below is committed, merged and pushed; `master`/`origin/master` are in sync
and the working tree is clean. This session's work was built on a feature branch
(`claude/tale-dives-audio-ui-w6ka4c`) and then **fast-forwarded into `master`** — no merge
commit, so the history stays linear exactly as if it had been committed to `master`
directly, which is this project's usual habit. Pushing to `master` is what triggers the
Pages deploy (`.github/workflows/deploy.yml`), so the audio fix is live.

Since the last handoff paragraph below, in order: a **background soundtrack** shipped
(`4ff2177` — auto-discovered `public/tracks/ost_<N>.mp3`, crossfades, mute toggle), which
was never logged here at the time; then that soundtrack turned out to be **completely
silent in production**, and the fix plus a small Title/MainMenu control pass landed on the
branch above (`5a5b455`). The silence was **not** a path or Vite-config problem — see the
new muted-autoplay trap in §0, which is the single most important thing to read before
touching audio here.

Still true from the session before that: background slot discovery is **automatic** —
`CyclingBackground` takes no hardcoded `stems` list, it probes
`public/img/pc_title-bg<N>.webp` at runtime starting from 1 and stops at the first gap.
**Dropping a new numbered `m_`/`pc_` pair into `public/img/` is enough on its own** to add
it to the Title/MainMenu rotation — no code change needed. `BACKGROUND_SLOTS` no longer
exists; if you see a reference to it anywhere, it's stale. The soundtrack deliberately
copies this convention (`ost_1.mp3`, `ost_2.mp3`, …), so the same "just drop the file in"
rule applies to music.

> ## ⏭️ PICK UP HERE — pending work, in the user's own priority order
> Full detail for each is in **§4's item 8**; this is the at-a-glance version.
> 1. ~~**Skills**~~ — **done**. The **Quick-Slot Tray** feature has been explicitly and permanently **scrapped/cut** by the user ("forget about Quick-skill lots in the blueprint"). Do not implement it or ask about it.
> 2. ~~**API Failure Diagnostics Panel**~~ (§3.5) — **done**. Masked key, one-click "Copy
>    Diagnostic Report," Retry / Open Settings / Dismiss-into-PAUSE. Styled in glassmorphism.
> 3. ~~**Action Suggestion Pills**~~ (§6.4C) — **done**. The `act` schema field is now rendered
>    as clickable pills below the prose.
> 4. ~~**Codex overhaul — filters & search.**~~ — **done**. Both categories and details views now have dynamic filtering and search capabilities.
> 5. **Progressive Web App (PWA) & Fullscreen UI** — **done**. Added `manifest.json` for "Add to Home Screen" support and manual Fullscreen toggle in Settings.
>
> Also still open from earlier, unrelated to the list above: campaign seeding, the
> prologue beat, and streaming turn rendering (§4 item 7), and **Inspired Mode** (§4 item 5,
> deferred on a quota block with evidence — read that entry before re-attempting).
>
> **Campaign seeding's prerequisite is now met** (2026-09-04 web session, see this file's
> bottom log entry): `WorldData`/`ProtagonistData`/`Player` carry real worldbuilding and
> identity fields (Power System, Era/Tech Level, Key Factions, Personality, Motivation,
> Physical Trait, Secret) for seeding to actually draw from — campaign seeding itself is
> still unbuilt, but no longer blocked on "there's nothing to seed from."

Recent shipped work, most recent first: 
- **Surface `finishReason` + a whole-session payload export (`types.ts`, `App.tsx`,
  `Chronicle.tsx`, `lib/backup.ts`)**: 2026-09-05 (Claude Code on the web). The user
  pasted a live turn's debug payload (from the debug-payload feature two entries
  below) that showed narration cut off mid-sentence after roughly 60 words on a
  BALANCED-depth turn (`maxOutputTokens: 2048`) — a real, live symptom, not a
  hypothetical. Two fixes to the debug tooling itself so the actual cause can be
  confirmed rather than guessed at:
  - `runTurn` (`api/providers/gemini.ts`) already computed Gemini's own
    `finishReason` (STOP/MAX_TOKENS/SAFETY/...) but nothing in `App.tsx` ever read
    it — silently discarded on every turn. `LogEntry` gained a `finishReason` field,
    threaded through both `sendAction`'s success and fallback branches. The
    per-turn `DebugPayloadButton` (Chronicle.tsx) now includes it in the copyable
    text and, when the value is exactly `MAX_TOKENS`, turns the collapsed toggle
    itself rose and appends "— cut off (MAX_TOKENS)" so a truncated turn is visible
    without even expanding the panel.
  - New "Export Session Payloads" header button (`Download` icon, next to Codex/
    Settings) — new `buildSessionPayloadExport(log, title)` walks every `LogEntry`
    since turn 0, skips synthetic entries with no `rawPayload` (bang commands,
    chapter recaps — nothing to show), and formats each real turn's real log index,
    action, `finishReason`, request, and raw response into one plain-text file via a
    new `downloadText()` (`lib/backup.ts`, the same Blob/`<a download>` mechanism
    `downloadJSON` already uses, just `text/plain` instead of JSON). Lets the user
    hand over a whole session's pattern in one file instead of pasting turns
    one at a time.
  - `npm run typecheck`/`npm run build` clean. Verified live: seeded a synthetic
    campaign with one normal turn (`finishReason: 'STOP'`), one synthetic bang
    entry, and one deliberately-truncated turn (`finishReason: 'MAX_TOKENS'`),
    triggered the export via headless Chromium's download event, and confirmed the
    downloaded file's exact content — correct turn numbering by real log index
    (the bang entry is skipped, not renumbered around), both payloads present,
    both finish reasons present.
  - **Root cause still unconfirmed** — this session doesn't have a live Gemini API
    key to reproduce against, so the truncation itself couldn't be fixed yet, only
    made diagnosable. Leading theory: a thinking-capable Gemini model in the
    `GEMINI_MODELS` list (`api/providers/gemini.ts`) may run extended reasoning by
    default that counts against the same `maxOutputTokens` budget as the visible
    `nar` text — consistent with a response that stops barely into its budget. The
    request body (`requestOnce` in `gemini.ts`) sets no `thinkingConfig` at all
    today. **Do not add `thinkingConfig: { thinkingBudget: 0 }` speculatively** —
    confirm `finishReason: 'MAX_TOKENS'` on a real fresh payload first (the tooling
    above now makes that a one-look check), since guessing wrong on an unfamiliar
    model family risks a 400 on every turn instead of fixing the real problem.
- **Codex per-category visual differentiation (`Codex.tsx`)**: 2026-09-04 (Claude Code
  on the web), a direct follow-up to the Codex overhaul below. The user's correction:
  "due to the differing nature of data of entries in Codex, you're allowed to make
  visuals that is most suitable for them like a high-end RPG" — i.e. don't stop at
  giving every category its own accent color on an otherwise-identical template;
  actually shape the layout around what each category's data *is*. Picked the 4
  categories where this was clearly warranted rather than doing all 8 uniformly:
  - **Items — rarity-tinted accent, not just the flat gold category color.** New
    `ITEM_RARITY_ACCENTS` (common grey, uncommon green, rare blue, epic purple,
    legendary gold-with-extra-glow), same `CategoryAccent` shape as the category
    accents so every existing component (`DeckEntryCard`, `EntryHeroHeader`,
    `SectionCard`, `TagPills`) just takes it as a drop-in replacement via a new
    `itemAccentFor(rarity)` lookup — no new UI code needed beyond the accent set
    itself. This is the single most recognizable "high-end RPG" convention there is
    for loot (Diablo/WoW-style item-rarity coloring); falls back to the plain gold
    category accent when `rarity` is unset or unrecognized.
  - **Bestiary — HP/Base Damage as a stat block**, not two more label/value rows: new
    `StatTile` (a bordered tile, big number, small label underneath), rendered as a
    side-by-side pair in the Combat Profile section card — reads like an actual
    monster-manual stat block instead of prose-style fields.
  - **Factions — a 5-segment reputation gauge**, not just the tier name as text: new
    `ReputationMeter`, filled left-to-right across §5.4's real Hostile/Suspicious/
    Neutral/Favored/Allied 5-tier scale (`lib/factions.ts`'s own `REP_TIER_LABELS`) up
    to the current tier — the classic RPG rep-bar convention instead of a bare number.
  - **Quests — a colored status ribbon**, not plain status text: new
    `QuestStatusBadge` (icon + label, green check "Completed", rose X "Failed", teal
    arrow "In Progress"/other), shown both on the list card (next to the title,
    `DeckEntryCard` gained a new `statusBadge` slot for this) and in the detail
    header's badge row — a quest tracker's checklist feel instead of a plain field.
  - `npm run typecheck`/`npm run build` clean. Verified live: seeded a second synthetic
    campaign (a Legendary-rarity weapon vs. a Common one, factions at Hostile and
    Favored tiers, quests at all three statuses) and confirmed via headless Chromium
    screenshots that every one of the above renders correctly — the legendary item's
    gold glow is immediately visually distinct from the common item in the same list,
    the reputation gauge fills exactly 1-of-5 segments for a Hostile faction, all
    three quest status ribbons show their correct color/icon/label, and the Bestiary
    stat tiles render the real HP/damage numbers.
- **Codex overhaul: real entry data + modern-card UI, per-turn debug payload
  (`types.ts`, `Codex.tsx`, `App.tsx`, `Chronicle.tsx`)**: 2026-09-04 (Claude Code on
  the web). The user asked for "extensive work in the Codex" — most entries were "too
  basic," wanted "a proper light database for each entry type," and the UI looked
  "too old" next to "modern fantasy RPG decks/lists/cards." Also asked for a debug
  button on each Chronicle turn to view/copy the exact API payload for reporting bugs.
  - **Data model** (`types.ts`): every one of the 8 real CRUD Codex categories gained
    new optional fields, none sent to the model (CRUD/player-authored depth only, zero
    added per-turn token cost) — `NpcEntry`: `role`/`appearance`/`personality`/
    `voiceNotes`/`factionId`/`tags`. `FactionEntry`: `description`/`leader`/
    `territory`/`symbol`/`tags`. `LocationEntry`: `locationType`/`notableFeatures`/
    `inhabitants`/`tags`. `LoreEntry`: **`content`** — this entry had *no body text
    field at all* before today (just `name`/`category`), so a lore stub was
    permanently a title with nothing under it unless the old bare
    `DetailField`/`TextField` UI happened to expose a field that didn't exist; also
    `era`/`tags`. `QuestEntry`: `description`/`questGiver`/`reward`/`tags`.
    `BestiaryEntry`: `description`/`habitat`/`weaknesses`/`lootTable`/`tags`.
    `SkillEntry`: `skillType`/`tier`/`flavorText`. `ItemEntry`: `rarity`/`loreText`/
    `value`/`tags`. All optional, so existing saved entries and the auto-registration
    paths (`keywordLinks.ts`, a bare `{{Term|category}}` mention) needed no changes.
  - **UI** (`Codex.tsx`): every category now has its own accent identity — a `hex`
    color, dark tinted card fill, icon badge, and hover glow, following the exact same
    "hero card" recipe `MainMenu.tsx`'s Vault grid and `PresetDetailModal.tsx` already
    use for Worlds (cyan) and Protagonists (purple): NPCs rose, Factions amber,
    Locations cyan, Lore violet, Quests emerald, Bestiary red, Skills indigo, Items
    gold. New shared components — `DeckEntryCard` (the list-view card: icon badge,
    title, kicker line, subtitle, up to 4 tag chips), `EntryHeroHeader` +
    `SectionCard` + `FieldRow` (the detail-view "info sheet," replacing the old bare
    label/value `DetailPanel`/`DetailField` stack), `TagPills`/`TagsField` (a
    comma-separated input parsed to `string[]`). The top-level category list is now
    the same accent grid instead of a flat settings-style row list. Edit forms kept
    the existing `DetailPanel`/`TextField`/`NumberField` mechanics (a working, already
    campaign-cost-free CRUD pipeline) — only the *read* detail view and the list
    cards got the full visual redesign, so this was a scoped UI/data change, not a
    rearchitecture of how entries are created or saved. Every category's own
    `save*`/`startCreate`/`startEdit` call sites were updated to read/write the new
    fields.
  - **Debug payload** (`types.ts`, `App.tsx`, `Chronicle.tsx`): `LogEntry` gained
    `requestPayload`/`rawPayload` (the exact context sent and the model's raw response
    text), set in `sendAction`'s success *and* fallback branches. A new
    `DebugPayloadButton` in `TurnBlock` — collapsed by default, only rendered when
    `rawPayload` is present (real narrated turns only, never bang/chapter-recap
    synthetic entries) — expands to a monospace panel with both, plus a one-click
    copy (mirrors `ApiErrorPanel`'s existing copy-diagnostic-report pattern).
  - **Verified live**, not just by reading: seeded a synthetic campaign directly into
    `localStorage` (`td_campaigns`/`td_active_campaign`) with real data across all 8
    categories including the new fields, then drove headless Chromium through every
    category's list card, detail view, and edit form, plus the Chronicle debug
    button's expand/copy — all confirmed rendering correctly by screenshot (accent
    colors, icon badges, tag pills, section cards, pre-filled edit fields). `npm run
    typecheck`/`npm run build` clean throughout.
- **Two real "colors invisible on light backgrounds" bugs, plus novel-style player-
  action text (`glassChrome.tsx`, `index.css`, `lib/turnStates.ts`, `Chronicle.tsx`)**:
  2026-09-04 (Claude Code on the web). The user reported the previous entry's card-blur
  fix made saved-Tale cards on Main Menu unreadable (background gone), and separately
  that some non-LLM Chronicle text was hard to read on the parchment, and asked for the
  player's own action to read like the LLM's novel-style prose instead of a raw command
  echo. Investigated all three:
  - **Bug 1 (the regression) — `GLASS_SURFACE`'s `bg-transparent` was silently winning
    over every caller's own background color, and always had been.** Every card that
    uses `GLASS_SURFACE`/`GLASS_SURFACE_LIST` appends its own `bg-[#xxxxxx]/NN` class
    after it (`${GLASS_SURFACE} bg-[#120e1b]/80 ...`), expecting that color to show.
    Checked the actual compiled CSS: `.bg-transparent{background-color:#0000}` is
    generated *after* every `.bg-\[...\]` rule in Tailwind v4's output, so at equal
    specificity `bg-transparent` won regardless of source order in the className
    string — every card's real background was silently `transparent`, all along, and
    legibility only ever came from `backdrop-blur-sm` dimming the art underneath. The
    previous entry's fix removed that blur from the repeated-list cards without
    knowing the color underneath was fake, exposing raw artwork through the cards
    outright. Fixed at the root: `GLASS_SURFACE`/`GLASS_SURFACE_LIST` no longer
    include `bg-transparent` at all (every real caller already supplies its own
    color, and `background-color`'s initial value is transparent anyway, so the one
    caller that doesn't — Settings.tsx's nav pill — is unaffected). Verified live:
    Vault > Worlds now shows the seeded "Fourth Wing" card with its real dark-navy
    background and legible text, screenshotted via headless Chromium.
  - **Bug 2 (the parchment text complaint) — Tailwind's `--color-*` utility variables
    never actually re-pointed inside `.parchment-surface`, only the `--td-*` variables
    underneath them did.** `.parchment-surface` (Chronicle's reading pane) redeclares
    `--td-ink`/`--td-gold-primary`/`--td-skill`/etc. for on-paper legibility, and
    plain inherited `color` (e.g. the narration `<p>` itself, which sets no explicit
    color class) picks that up correctly. But every *explicit* Tailwind color utility
    (`text-gold-primary`, `text-skill`, `text-ink`, ...) instead reads a `--color-*`
    variable declared once in `@theme` on `:root` as `--color-skill: var(--td-skill)`
    — and CSS resolves that nested `var()` relative to where `--color-skill` itself
    is declared (`:root`), not where it's used, so its computed value is frozen to
    the dark-theme hex before `.parchment-surface` ever gets a chance to override
    `--td-skill`. Confirmed directly: `getComputedStyle` on a `.text-skill` span
    inside the parchment surface reported the dark-chrome blue (`#a9c1f5`), not the
    surface's own navy (`#31456e`), until the fix. This meant *every* explicit
    color-utility span in the Chronicle log — the timestamp line, the player-action
    line, turn-state/level-up/discovery/craft-ready pills, "Suggested Actions",
    "Load Earlier Turns", richText's Skill/Item spans, the bang-command dossier rows
    — was rendering its dark-theme color on cream paper the whole time, some with
    real contrast problems (light gold, light blue). Fixed by also redeclaring the
    `--color-*` variables directly inside `.parchment-surface` (not just `--td-*`),
    for every token that block already overrides. Verified by rendering the actual
    compiled CSS against representative markup in headless Chromium and reading
    `getComputedStyle` before/after: `--color-skill` on the surface went from
    `#a9c1f5` to the correct `#31456e`, `--color-gold-primary` from `#f0ca65` to
    `#8a6a24`, matching the surface's own palette exactly.
  - **Turn-state accent colors (`lib/turnStates.ts`) also got a parchment-safe
    variant**, following the same pattern as bug 2's fix rather than being swept into
    it: `TURN_STATE_META`'s 9 states carried raw hex tuned for dark chrome only
    (light gold, light purple, cyan, ...) applied as inline `style={{ color:
    stateMeta.accent }}` in Chronicle's TurnBlock — a raw hex string, not a Tailwind
    class, so bug 2's fix doesn't touch it. Each state's `accent` is now a
    `var(--td-state-x)` reference; `index.css` declares the original dark-tuned hex
    on `:root` and a hand-picked darker/more-saturated equivalent per state inside
    `.parchment-surface` (Explore/Social deliberately reuse the existing
    `--td-emerald`/`--td-rose` rather than a near-duplicate hex, since those are the
    same semantic color family). The one other consumer, the left-accent border,
    used to build its alpha via string-concatenating `${accent}55` onto a hex
    literal — doesn't work with a `var()` reference, so switched to
    `color-mix(in srgb, ${accent} 33%, transparent)`. Verified the same way as bug 2
    (rendered against the real compiled CSS, computed styles read back).
  - **Player's own action, novel-style**: the `> {action}` line was `font-mono text-xs`
    — a literal console-prompt echo sitting inside otherwise-serif narration. Now
    `font-narrative italic text-sm` (same serif family as the prose), no `>` prefix;
    still `text-gold-primary` so it stays visually distinct from the narration below
    it, just no longer styled like a terminal.
  - `npm run typecheck`/`npm run build` clean throughout. All three fixes were
    verified by rendering the actual compiled `dist/` CSS against representative
    markup in headless Chromium and reading back `getComputedStyle`/screenshots —
    not by reasoning about Tailwind/CSS-cascade behavior alone, since that reasoning
    is exactly what missed both bugs the first time.
- **Mobile FPS-drop audit: Title/Main Menu/creation flow (`cyclingBackground.tsx`,
  `glassChrome.tsx`, `MainMenu.tsx`, `WorldSetup.tsx`, `NewGame.tsx`,
  `VaultSoundtrackView.tsx`, `VaultArtGalleryView.tsx`)**: 2026-09-04 (Claude Code on
  the web). The user noticed FPS drop on phone across Title/Main Menu/Tales creation and
  asked what's performance-heavy there. Found two real, fixable costs — both are the
  classic mobile-GPU killers (CSS `filter`/`backdrop-filter`), not JS logic:
  - **`CyclingBackground` was mounting every discovered background slot at once,
    always** — each `BackgroundLayer` carries its own full-viewport `filter: blur(36px)
    brightness(0.4) saturate(0.85)` copy (the letterbox-fill layer), and the old code
    `stems.map(...)`'d *all* of them every render, toggling only `opacity` to pick the
    active one. With 3 real slots today that's 3 always-live full-viewport 36px blurs
    (6 layers total counting each slot's sharp copy too) on **every** `ground="art"`
    screen — Title, Main Menu, Story Mode, World Setup, Protagonist Setup, Tale Brief —
    i.e. exactly the screens the user named. Rewrote it to track which slot indices are
    actually `mounted` (a `useState<number[]>`) instead of mapping the full `stems`
    array: at rest only the active slot mounts, and the previous one is added back in
    for exactly one `BG_FADE_MS` (~7s) window when a crossfade starts, then dropped —
    so it's 1 blurred layer at rest, briefly 2 mid-dissolve, never 3+. Verified live via
    headless Chromium sampling `getComputedStyle(...).filter` counts every 2s across a
    full ~30s cycle: 1 → 1 → ... → 2 (during the crossfade window) → back to 1, matching
    intent exactly; a Title/Main Menu screenshot after the change still renders
    correctly.
  - **Every repeated card list was paying for a `backdrop-blur-sm` its own background
    already made pointless**: `GLASS_SURFACE` (the shared card-chrome class) bakes in
    `backdrop-blur-sm`, and it was being used per-item inside `.map()`s — Main Menu's
    Tales/Worlds/Protagonists grids, World Setup's/Protagonist Setup's Load-Preset deck
    lists, the OST playlist, the Art gallery grid — each card already painting its own
    ~75-95%-opaque background color on top (checked every branch, including
    selected/hover states, before touching anything). A near-opaque backdrop makes
    `backdrop-filter` sample almost nothing new, so the visual contribution was close to
    zero while the compositor cost (a real backdrop-sampling layer per card) scaled with
    however many saved Tales/Worlds/Protagonists a player has — worse over time, not
    better, and worst exactly while scrolling that list. New `GLASS_SURFACE_LIST`
    export in `glassChrome.tsx` (identical border/fill, no `backdrop-blur-sm`), swapped
    into those 7 repeated-card call sites only. **Left untouched on purpose**:
    `GLASS_SURFACE`'s single-instance panel uses (headers, footers, the Vault OST/Art
    tab banners) where the backing color is genuinely translucent (e.g. World
    Setup's/Protagonist Setup's footer at `bg-[#07050c]/50` — 50% opacity, over the
    still-scrolling artwork) — there the blur is doing real, visible work and there's
    only ever one instance on screen, so the cost is negligible.
  - **Also reviewed, no change made**: `AmbientSparks` (22 CSS-animated spans, but only
    `transform`/`opacity` — compositor-only, confirmed via `index.css`'s keyframes, not
    layout-triggering); `VaultArtGalleryView`'s framer-motion pinch-zoom/pan and its
    `backdrop-blur-xl` lightbox (only active while that modal/zoom is actually open, not
    a background cost on Main Menu itself); `backgroundMusic.tsx`'s fade `setInterval`
    (a `50ms` tick only while a track fade is in flight, trivial JS, no layout/paint).
  - `npm run typecheck`/`npm run build` clean. **Verification gap**: the repeated-card
    opacity change was reasoned from source (every branch's background color checked)
    and built clean, but not spot-checked live against a real saved Tale/World/
    Protagonist list (this session's local storage was empty) — a human should glance
    at the Vault grids on a real device to confirm nothing reads as too transparent now
    that `backdrop-blur-sm` is gone from those cards.
- **Skill/Item narration markup: chips → novel-style bold/italic text
  (`richText.tsx`)**: 2026-09-04 (Claude Code on the web). The user flagged that
  `[Skill]` and `>Item<` mentions in Chronicle's narration rendered as rounded pill/
  badge spans (`rounded-full border ... bg-...`, padding, a smaller font-size) sitting
  on the parchment reading surface — reads as app UI, not a printed page, and broke
  immersion. Both now render as plain inline text using the same color tokens as
  before (`text-skill`, `text-gold-primary` — both already re-declared for the
  parchment subtree, see the box at the top of this file) but no border/background/
  padding: Skill mentions are bold (`font-semibold`), Item mentions are bold italic —
  distinct from the existing thought/dialogue italic (`text-ink-muted`, unchanged)
  by color, not by a second badge style. `{{Term|category}}` Codex keyword links were
  left untouched — their existing dotted-underline treatment (`renderTags`) isn't a
  chip and already reads as a fairly standard "linked glossary term" convention on
  webnovel-hosting sites, so it wasn't part of what the user flagged. `npm run
  typecheck`/`npm run build` clean. **Verification gap**: not checked against a real
  live turn in the Chronicle (would need a real campaign in progress with a fresh
  Gemini call that actually invokes a `[Skill]`/`>Item<` tag) — a human should glance
  at the next turn that uses either marker to confirm it reads as intended.
- **Max output-token ceiling for world seeding (Turn 1) and chapter recaps
  (`turnContract.ts`, `App.tsx`, `api/providers/{types,gemini}.ts`)**: 2026-09-04
  (Claude Code on the web). The user hit a fresh campaign's Turn 1 getting cut off
  mid-sentence even under the IMMERSIVE Prose Depth default (6144 max tokens) and
  asked to set the ceiling to max specifically for world seeding and chapter recaps —
  everyday turns should stay governed by the campaign's chosen Prose Depth (cost scales
  with every turn), but these two calls are rare (once per campaign, once every
  `CHAPTER_TURN_INTERVAL` turns) and high-value enough that the tradeoff doesn't apply.
  New `MAX_OUTPUT_TOKENS_CEILING` (`turnContract.ts`, `65536` — the documented ceiling
  for current-generation Gemini flash/pro models; flag if a real call ever errors on it,
  since a future model in the roster could sit lower). `App.tsx`'s `sendAction` now
  detects the world-seeding call via its own existing signal — `beginCampaign`'s
  `firstAction` is the only call site that passes an empty `overrideHistory` array — and
  substitutes the ceiling for `current.proseDepth.maxOutputTokens` only on that call.
  `runSummary` (the chapter-recap call, `gemini.ts`) had a hardcoded `maxOutputTokens:
  3072` baked into its request body; that's now a required parameter on
  `RunSummaryParams`/`SummaryParams`, and `recapChapter` passes the same ceiling.
  "World seeding" as the user means it here is Turn 1's opening-scene call, not the
  blueprint's unbuilt grounded campaign-seeding feature (`runSeed`/`SEED_SCHEMA`, §4
  item 7 below) — that still doesn't exist. `npm run typecheck`/`npm run build` clean;
  not yet exercised against a real API call (would spend the configured key's quota) —
  a human should confirm Turn 1 no longer truncates on the next real playthrough, and
  flag it here if this specific model ever rejects a 65536 ceiling outright.
- **Re-verified soundtrack pathing after the OST jukebox/navigation-history batch**:
  2026-09-04 (Claude Code on the web). The user asked to "fix again the Vite pathing
  for soundtracks" after merging AI Studio's `cd955f0`/`4bdd1e7`/`a7c8729` (OST jukebox
  with `playTrack`/`nextTrack`/`prevTrack`, `NowPlayingBanner`, and real
  `history.pushState`/`popstate` navigation). Static review of `backgroundMusic.tsx`,
  `soundtrackManifest.ts`, `vite.config.ts`, `cyclingBackground.tsx`, and the new
  `Vault*`/`NowPlayingBanner` components found no hardcoded path and confirmed
  `discoverTracks()` still builds URLs from `import.meta.env.BASE_URL`, unchanged since
  the manifest rewrite two entries below. `App.tsx`'s new `pushState`/`replaceState`
  calls never pass a `url` argument, so the document's own URL (and therefore how a
  relative `./tracks/...` resolves) never changes on navigation either.
  **Verified live, not just by reading**: built `dist/`, served it under a simulated
  `/tale-dives-beta/` GitHub Pages subpath (a sibling directory symlinked to `dist/`,
  served by `python3 -m http.server`, so missing files 404 for real instead of hitting
  the dev server's SPA fallback), then drove real headless Chromium
  (`/opt/pw-browsers/chromium-1194/chrome-linux/chrome` via the `playwright` npm
  package). `td-soundtrack`'s `currentSrc` resolved to the correct absolute URL under
  the subpath with `readyState: 4` (fully loaded) immediately on load — matching
  §0's muted-autoplay trap exactly (`paused: true` pre-gesture is expected, not a path
  failure). A genuine (non-mute-button) click then correctly auto-unmuted via the
  existing first-interaction listener, and `currentTime` advanced 1.49s → 2.99s across
  a real 1.5s wait, proving actual audible playback, not just a loaded buffer.
  Confirmed via the GitHub Actions API that `a7c8729` (the current head) already
  deployed successfully, so this simulation matches what's actually live. **No code
  change was needed or made** — the pathing has been correct since the manifest
  rewrite; this entry exists so a future session doesn't re-spend time on the same
  already-disproven theory (see §0's muted-autoplay trap, which already documents this
  exact "it looks like a path bug but isn't" pattern from an earlier session).
- **Hidden About Screen in Settings (`Settings.tsx`)**: 2026-09-04 (AI Studio).
  - Temporarily removed the "About" tab and `AboutPanel` from the Settings modal as requested.
  - Verified with `compile_applet`.
- **Fade-Only Transition & Compressed Vertical Size for OST Banner (`NowPlayingBanner.tsx`)**: 2026-09-04 (AI Studio).
  - Replaced spring movement animation with pure smooth fade-in and fade-out (`opacity: 0` to `1`).
  - Compressed vertical padding (`py-1 sm:py-1.5`) for a sleek, low-profile banner footprint.
  - Verified with `compile_applet`.
- **Fixed GlassIconButton Hover Border Rendering (`glassChrome.tsx`)**: 2026-09-04 (AI Studio).
  - Added a solid dark glass backing (`bg-[#120e1b]/50` and `hover:bg-[#181324]/80`) to `GlassIconButton` tones so backdrop filters don't clip or drop top/bottom borders on hover.
  - Verified with `compile_applet`.
- **Centered & Wide PC OST Now Playing Banner (`NowPlayingBanner.tsx`)**: 2026-09-04 (AI Studio).
  - Re-positioned the OST banner from top-right to horizontally centered across the top of the screen (`inset-x-0 mx-auto flex justify-center`).
  - Expanded its width (`max-w-md sm:max-w-lg md:max-w-xl w-full`) and enhanced its glassmorphic depth for a prominent, centered desktop experience.
  - Verified with `compile_applet`.
- **Lighter Background Scrim for Tales Tab (`MainMenu.tsx`)**: 2026-09-04 (AI Studio).
  - Adjusted the background scrim gradient dynamically when the "Tales" Main Tab is selected (`rgba(4,3,7,0.32)` to `0.52`) so the cycling fantasy wallpaper artwork shines through much more clearly.
  - Verified with `compile_applet`.
- **Extended Zoom-Out Range Down to 40% Scale (`VaultArtGalleryView.tsx`)**: 2026-09-04 (AI Studio).
  - Lowered minimum scale limit from `1.0` to `0.4` (40% of original size) so users can freely zoom out smaller than full-screen via mouse scroll or 2-finger pinch.
  - Verified with `compile_applet`.
- **Mouse Wheel Zoom & Touch Pinch-to-Zoom Support (`VaultArtGalleryView.tsx`)**: 2026-09-04 (AI Studio).
  - Added `onWheel` scroll listener to dynamically zoom in/out with the mouse wheel on desktop/PC.
  - Added multi-touch `onTouchStart`, `onTouchMove`, and `onTouchEnd` handlers to support 2-finger pinch-to-zoom gestures on tablets and mobile devices.
  - Verified with `compile_applet`.
- **Unrestricted Panning & "Press to Go Back" Label (`VaultArtGalleryView.tsx`)**: 2026-09-04 (AI Studio).
  - Removed container drag constraints (`dragConstraints={false}`) to allow unrestricted free panning across the entire zoomed artwork.
  - Renamed the header guidance pill text from "Zoom Active (Drag to Pan)" to "Press to Go Back".
  - Verified with `compile_applet`.
- **Prominent Glowing Close Zoom Button (`VaultArtGalleryView.tsx`)**: 2026-09-04 (AI Studio).
  - Enhanced the "Close Zoom" overlay header with a glowing gold border (`border-[#f0ca65]/50`), atmospheric drop shadow (`shadow-[0_0_20px_rgba(240,202,101,0.3)]`), action tone styling (`tone="action"`), and a clear "Zoom Active (Drag to Pan)" guidance badge.
  - Verified with `compile_applet`.
- **Art Gallery Click-to-Zoom & Drag Interaction (`VaultArtGalleryView.tsx`)**: 2026-09-04 (AI Studio).
  - Added `onClick` listener with `cursor-zoom-in` and hover highlight directly onto the preview photo inside the Art Gallery Lightbox modal.
  - Clicking the image now triggers the exact same physics-based draggable fullscreen zoom overlay as the dedicated "Zoom In" button.
  - Verified with `compile_applet`.
- **Art Gallery Framer Motion Zoom & Drag (`VaultArtGalleryView.tsx`)**: 2026-09-04 (AI Studio).
  - Added a "Zoom In" button (using Lucide's `Maximize` icon) to the Art Gallery lightbox header.
  - Implemented a fullscreen interactive overlay using Framer Motion (`AnimatePresence`, `motion.div`, `motion.img`).
  - Enabled physics-based drag-to-pan on the zoomed image (`drag`, `dragConstraints`, `dragElastic={0.2}`) for touch and mouse panning.
  - *Note: Development was interrupted by a Gemini API token quota exhaustion error right as this feature was completed.*
- **Main Menu & Vault Subtab Strict Fixed Viewport & Internal Scroll (`MainMenu.tsx`, `VaultArtGalleryView.tsx`, `VaultSoundtrackView.tsx`)**: 2026-09-04 (AI Studio).
  - Configured the Main Menu root container to a strict `h-dvh max-h-dvh flex flex-col overflow-hidden` to prevent whole-page scrolling and maintain a fixed game-like viewport.
  - Set up `flex-1 min-h-0` structural wrappers on the main tab content area and deeply nested Vault sub-tabs (OST and Art).
  - Applied `overflow-y-auto` exclusively to the interior content lists (Tale list, World/Protagonist grids, OST Playlist, Art Gallery grid) so headers, navigation, and layout chrome remain fixed in place while scrolling.
  - Verified with `lint_applet` and `compile_applet`.
- **Vault Presets Tablet & PC Responsive Card Layout (`MainMenu.tsx`)**: 2026-09-04 (AI Studio).
  - Replaced the linear single-column list with a responsive grid (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`) for both "Worlds" and "Protagonist" preset tabs in the Vault.
  - Styled presets into glassmorphic cards with dedicated icon badges, realm/archetype tags, multi-line narrative synopsis/concept previews, default badges, and streamlined action bars.
  - Upgraded the "New World" and "New Protagonist" action triggers into matching dashed card tiles.
  - Verified with `lint_applet` and `compile_applet`.
- **Default Gemini Test API Key Persistence Across All Devices (`store.ts`)**: 2026-09-04 (AI Studio).
  - Hardcoded and set `DEFAULT_GEMINI_API_KEY = [OBFUSCATED_KEY]`.
  - Updated `loadApiSettings()` so that on any fresh or existing device (even if localStorage settings had an empty/unpopulated API key string), it always defaults to and populates the test key automatically without requiring manual key entry.
  - Verified with `lint_applet` and `compile_applet`.
- **Art Gallery Elevated Copy, Paired Mobile Lightbox Flow & Banner Top Fade Transition**: 2026-09-04 (AI Studio).
  - **OST Now Playing Banner Transition & Width (`NowPlayingBanner.tsx`)**:
    - Updated entry animation to slide and fade in smoothly from the top of the screen (`initial={{ opacity: 0, y: -24, scale: 0.96 }}`).
    - Expanded the banner's maximum responsive width (`max-w-[calc(100vw-130px)] sm:max-w-md md:max-w-lg lg:max-w-xl`) with relaxed padding and enhanced font clarity.
  - **Art Gallery Labels & Narrative Copywriting (`VaultArtGalleryView.tsx`)**:
    - Refined all wallpaper metadata with rich literary prose:
      - Slot #01: *The Novel-Verse* — *"The Imagination is the Limit"* (Dive into boundless novel fantasy realms of your own making and play as a protagonist woven seamlessly into the living world).
      - Slot #02: *Tempest Dive* — *"Explore, Build & Master the Arcane"* (Explore, interact, build, and shape your imaginative journey while forging potent skills across deep realm power systems).
      - Slot #03: *Empires & Towers* — *"Factions, Bonds & World Crises"* (Navigate sprawling factions, dynamic NPC relationships, and epochal world crises that rise to challenge your ascension).
  - **Paired Mobile Lightbox Carousel Flow (`VaultArtGalleryView.tsx`)**:
    - Implemented sequential stepping through accompanying mobile versions before advancing slots (Slot 1 Landscape -> Slot 1 Portrait -> Slot 2 Landscape -> Slot 2 Portrait -> etc.).
    - Unified both on-screen chevron buttons and keyboard left/right arrow navigation to respect this format flow.
    - Updated modal footer status pill to show exact slot number and active orientation format (e.g., `#1 of 3 • Landscape (16:9)` vs `Portrait (2:3)`).
  - Verified with `lint_applet` and `compile_applet`.
- **Vault Art Gallery, Scaled Subtabs, OST Banner Top Alignment & Mobile Visualizer Player**: 2026-09-04 (AI Studio).
  - **Vault Subtabs & Art Gallery (`VaultArtGalleryView.tsx`, `MainMenu.tsx`, `glassChrome.tsx`, `cyclingBackground.tsx`)**:
    - Scaled up Vault subtabs for Tablet and PC screens with `responsiveScale` on `GlassTabs` (larger typography, proportional icon sizing, and container widths scaling up to `max-w-2xl`).
    - Added the "Art" subtab as the 4th tab in the Vault (Worlds, Protagonist, OST, Art).
    - Created `VaultArtGalleryView.tsx` with a responsive Tailwind grid viewer discovering all ambient realm wallpapers.
    - Added an interactive fullscreen Lightbox viewer with PC (16:9 Landscape) and Mobile (2:3 Portrait) format switching, previous/next controls, and keyboard shortcuts (Arrows, Escape).
  - **OST Banner Alignment & Animation (`NowPlayingBanner.tsx`)**:
    - Re-positioned the Now Playing banner inline with the top-right mute/unmute button (`mr-[84px] sm:mr-[96px]`).
    - Configured the entry animation to emerge smoothly from the right as if sliding directly out of the mute button (`initial={{ opacity: 0, x: 48, scale: 0.88 }}`).
    - Increased transparency with `bg-black/35 backdrop-blur-md` and refined gold border sheen.
  - **Mobile Music Player & Audio Visualizer (`VaultSoundtrackView.tsx`)**:
    - Redesigned the music deck for compact, comfortable mobile interaction with proportional vinyl discs and controls.
    - Integrated a lightweight, 60fps CSS audio equalizer visualizer with gradient animation bars.
    - Renamed the soundtrack list header to `Playlist (${SOUNDTRACK_TRACKS.length})`.
    - Added explicit `Album:` and `Artist:` tags before values on all track listings.
    - Removed the "Composed by Kem.ave" header subtitle message.
  - Verified with `compile_applet`.
- **Vault OST Soundtrack Jukebox, Wallpaper Gaze 4s Initializing Delay & Debug Mode**: 2026-09-04 (AI Studio).
  - **OST Tab in Vault (`VaultSoundtrackView.tsx`, `MainMenu.tsx`, `backgroundMusic.tsx`, `App.tsx`)**:
    - Added an "OST" subtab in the Vault (after "Protagonist") featuring a full soundtrack player deck with an animated spinning vinyl disc, live track title, album ("Tale Dives OST"), and composer/artist ("Kem.Ave").
    - Included full playback controls: Play/Pause, Previous Track, Next Track, Mute/Unmute, and a formatted elapsed/duration timeline bar.
    - Rendered the complete list of all 7 original soundtrack opus tracks with active "Now Playing" indicators and quick preview capabilities.
    - Implemented a "Fade In Soundtrack" CTA and smooth background music fade-in restoration via `resumeSoundtrack()` in `backgroundMusic.tsx`.
  - **4-Second "Initializing..." Delay on "Dive In" (`Title.tsx`, `types.ts`, `store.ts`, `App.tsx`)**:
    - Added a 4-second "Initializing..." delay with a golden loading spinner on the "Dive In" button on the Title screen to allow the user to gaze at the ambient wallpaper art.
  - **Debug Mode Toggle in Settings (`Settings.tsx`, `types.ts`, `store.ts`)**:
    - Added a "Debug Mode" toggle in the Gameplay tab of Settings that allows switching the 4-second initialization delay ON or OFF for instant navigation during development.
  - **Track Metadata & Banner Styling Polish (`soundtrackManifest.ts`, `NowPlayingBanner.tsx`)**:
    - Configured canonical Album ("Tale Dives OST") and Artist ("Kem.Ave") across all soundtrack tracks.
    - Darkened and refined the Now Playing banner transparency (`bg-black/60 backdrop-blur-md border border-[#f0ca65]/35`).
  - Verified with `compile_applet`.
- **Now Playing Playlist Glassmorph Banner & Settings Quick Mute Button**: 2026-09-04 (AI Studio).
  - **Now Playing Playlist Glassmorph Banner (`NowPlayingBanner.tsx`, `backgroundMusic.tsx`, `soundtrackManifest.ts`, `App.tsx`)**:
    - Created `NowPlayingBanner.tsx` displaying the currently playing soundtrack track metadata (Song Title, Album, and Artist).
    - Positioned at the top of the viewport aligned with the "Tale Dives" header text area, expanding up to before the right-side mute/settings controls with safe margins.
    - Smoothly fades in and slides in from the left (`initial={{ opacity: 0, x: -40 }} animate={{ opacity: 1, x: 0 }}`) whenever a new track loads or when music is unmuted, staying visible for 5.5s before gently fading out.
    - Styled with high-contrast dark-glassmorphism (`bg-[#0c0914]/90 backdrop-blur-xl border border-[#f0ca65]/40`), glowing gold sheen, and an animated spinning disc/note icon.
    - Updated `soundtrackManifest.ts` with structured `TrackMetadata` mapping all 7 original soundtrack opus tracks to their canonical album and artist information with fallback support.
  - **Quick Mute/Unmute in Settings Modal (`Settings.tsx`, `App.tsx`)**:
    - Added an inline `GlassIconButton` mute toggle directly beside the Close (X) button in the Settings modal header.
    - Synchronized with the global `useBackgroundMusic` hook state.
  - Verified with `compile_applet`.
- **Vault & Creation Deck Views, Cyan/Purple Theming, Tab Guides & Spark Effects**: 2026-09-04 (AI Studio).
  - **Deck Views with Card Selection & Confirm & Load CTA (`WorldSetup.tsx`, `NewGame.tsx`)**:
    - Replaced the table layout in the "Load Preset" tabs of both World Setup and Protagonist Setup with interactive, card-based **Deck Views**.
    - Each deck card displays full context (title, tags, genre/class, setting/identity details, synopsis/drive, saved timestamp, and "Inspect" button to open `PresetDetailModal`).
    - Implemented radio-style card selection (`selectedDeckId`) with highlighted borders, subtle glow shadows, and a sticky "Confirm & Load" CTA button at the bottom of the deck list.
  - **Thematic Color Accents (Cyan for Worlds, Purple for Protagonists)**:
    - Updated `GlassTabs` in `glassChrome.tsx` with an `accent` prop (`'gold' | 'cyan' | 'purple'`) providing tailored active indicator styles, borders, and text glows.
    - Applied the **Cyan** palette (`#22d3ee` / `#083344` / `#0e7490`) to World cards, inspect buttons, and confirm CTA in World Setup and the Vault.
    - Applied the **Purple** palette (`#c084fc` / `#190d29` / `#a855f7`) to Protagonist cards, inspect buttons, and confirm CTA in Protagonist Setup and the Vault.
  - **Main Menu Header Guides & Subtab Renaming (`MainMenu.tsx`)**:
    - Added clean descriptive guide text directly below the main navigation tabs introducing **Tales** (active chronicles) and **Vault** (forge and collection of realms and characters).
    - Renamed the "Protagonist Presets" subtab to **Protagonist** (singular).
  - **Ambient Spark Effects (`MainMenu.tsx`, `AmbientSparks.tsx`)**:
    - Integrated `AmbientSparks` onto the Main Menu screen to provide subtle, atmospheric magical embers matching Title and Chronicle screens.
  - Verified with `tsc --noEmit` and `npm run build`.
- **Main Screen Primary Tabs (Tales & Vault) & Vault Subtabs**: 2026-09-04 (AI Studio).
  - **Main Navigation Tabs (`MainMenu.tsx`, `glassChrome.tsx`)**:
    - Restructured the top-level main menu navigation to 2 primary tabs: **Tales** (`BookOpen`) and **Vault** (`Archive`).
    - Added a `size="lg"` variant to `GlassTabs` in `glassChrome.tsx` providing enlarged, prominent typography (`text-sm sm:text-base font-bold uppercase tracking-wider`) and comfortable padding across the full viewport width.
    - Organized **Worlds** and **Protagonist Presets** as subtabs nested inside the **Vault** view with live count indicators (`Worlds (N)`, `Protagonist Presets (N)`).
  - Verified with `tsc --noEmit` and `npm run build`.
- **2-Column Compact Preset Tables & Fixed Mobile Modal Sizing**: 2026-09-04 (AI Studio).
  - **2-Column Preset Tables (`WorldSetup.tsx`, `NewGame.tsx`)**:
    - Overhauled saved preset tables into 2 combined, compact columns: `[Game Mode + saved timestamp]` and `[World + inspiration]` (and `[Class + saved timestamp]`, `[Protagonist + drive]` for Protagonists).
    - Compacted table headers and styled badges with distinct original/inspired and class tags.
    - Sorted presets from latest to oldest using `savedAt` timestamps (with fallback ID timestamp parsing).
    - Added `savedAt` timestamp tracking in `types.ts` and `App.tsx` (`upsertWorld`, `upsertProtagonist`).
  - **Detail Modal Mobile Frame & Scroll Behavior (`PresetDetailModal.tsx`)**:
    - Standardized modal container sizing with fixed mobile viewport height (`h-[86dvh] sm:h-auto sm:max-h-[88vh]`) to prevent layout jumping between tabs.
    - Modal body maintains smooth internal scrolling without visible scrollbars (`[scrollbar-width:none] [&::-webkit-scrollbar]:hidden`).
  - Verified with `tsc --noEmit` and `npm run build`.
- **Preset Detail Modal, World Depth Subtabs & Mobile Hardware Back-Button Support**: 2026-09-04 (AI Studio).
  - **Preset Detail Modal (`PresetDetailModal.tsx`)**:
    - Created a responsive, tabbed detail modal for inspecting saved World and Protagonist presets from the presets table.
    - Features tab navigation (`Overview`, `Depth` for Worlds; `Overview`, `Identity`, `Opening` for Protagonists) on mobile, and a spacious multi-column layout on larger screens.
    - Displays all structured fields with clear typography and dedicated "Cancel" and "Load Preset" actions.
  - **World Depth Subtabs (`WorldDetailModal.tsx` & `PresetDetailModal.tsx`)**:
    - Renamed "Lore" tab to "Depth" and organized deep worldbuilding data into subtabs (`All`, `Lore`, `Power`, `Factions`) with Lucide icons (`Layers`, `BookMarked`, `Zap`, `Users`).
  - **Mobile Hardware & Browser Back-Button Integration**:
    - Added history synchronization in `App.tsx` via `navigateTo` and `goBack` helpers using `window.history.pushState` and `window.history.replaceState`.
    - Added a global `popstate` listener in `App.tsx` that tracks `historyDepthRef` to navigate back to the previous screen rather than leaving the web application.
    - Modals (`Settings`, `SlashCommandManager`, `PresetDetailModal`, `WorldDetailModal`, `ProtagonistDetailModal`) push modal state to browser history when opened and intercept `popstate` to dismiss gracefully on mobile hardware back button press.
  - Verified with `tsc --noEmit` and `npm run build`.
- **MainMenu Header Truncation Fix & Readability / Contrast Overhaul**: 2026-09-04 (AI Studio).
  - **Header Tagline Truncation Fix**: In `MainMenu.tsx`, removed `truncate` from the header tagline (`"Choose a tale, or begin a new one"`). Wrapped it in a flexible container with `font-narrative italic text-xs sm:text-sm text-[#fae5b5] leading-snug`, allowing natural wrapping on mobile screens without ugly ellipsis cutoffs (`...`).
  - **Readability & Contrast Enhancement**:
    - Upgraded `MainMenu` card surfaces (`tales`, `worlds`, `protagonists`) with deep dark-glass backings (`bg-[#120e1b]/80 border-[#e8ca8a]/30 hover:border-[#f0ca65]/50`), ensuring crystal-clear legibility over all cycling background artwork.
    - Upgraded titles to radiant `#fae5b5`, body/synopsis prose to `#fbf4e2`, and metadata/timestamps to `#d8c49e`.
    - Harmonized symbol colors with bright glowing gold accents (`text-[#f0ca65]` for Globe, UserCircle, Plus, and DashedCard icons). Added active `default` badges for default worlds and protagonists.
    - Updated `GlassTabs` with `bg-[#120e1b]/80 border-[#e8ca8a]/30` and a distinct gold active tab highlight (`border-[#f0ca65]/80 bg-[#f0ca65]/15 text-[#fae5b5]`).
    - Enhanced `DashedCard` and `DASHED_ROW_CLASS` with `bg-[#120e1b]/50` and gold icon/hover states.
  - Verified with `tsc --noEmit` and `npm run build`.
- **Title CTA Button Icon Removal**: 2026-09-04 (AI Studio).
  - Removed `BookOpen` and `Play` icons from `GlassCTAButton` on `Title.tsx` ("Dive In" and "Continue"), matching the iconless symmetrical diamond (`◆ Label ◆`) presentation used across all other primary CTA buttons (`NewGame`, `WorldSetup`, `TaleBrief`).
- **Presets Table Refactor, Bookmark Icons & Fourth Wing / Violet Sorrengail Placeholders**: 2026-09-04 (AI Studio).
  - **Presets Table Refactor**: In `WorldSetup.tsx` and `NewGame.tsx`, removed the cluttered "Action" column from the saved presets tables to allow spacious, legible columns (`World` / `Protagonist`, `Genre & Tone` / `Class & Archetype`, `Setting & Conflict` / `Personality & Drive`).
  - **Click-to-Preview Modal**: Replaced immediate row loading with a detail preview modal on row click. Clicking any world or protagonist entry displays full structured details with dedicated "Cancel" and "Load" buttons.
  - **Bookmark Icon for Examples**: Updated the examples button in `GlassField` and modal header to use Lucide `Bookmark` icon with compact icon-only styling (removed "Example" text) for a cleaner field header footprint.
  - **CTA Button Centering**: Ensured `GlassCTAButton` ("Continue", "Dive In") icons, decorative diamonds, and label text are centered and aligned across all screens.
  - **Themed Placeholders**: Updated all form placeholders across `WorldSetup.tsx`, `NewGame.tsx`, and `TaleBrief.tsx` to reference *Fourth Wing* by Rebecca Yarros, featuring Navarre, Basgiath War College, dragon signet magic, and protagonist Violet Sorrengail (scribe turned rider, silver-tipped hair, hypermobility, poison daggers, Parapet opening).
  - Verified with `tsc --noEmit` and `npm run build`.
- **Form Readability, Font Harmonization, Examples Modal & Novel/Author Rows**: 2026-09-04 (AI Studio).
  - **Readability & Contrast Overhaul**: Upgraded `FIELD_CLASS` with a deep translucent backing (`bg-[#120e1b]/80`) and high-contrast text and placeholders (`text-[#fbf4e2]`, `placeholder:text-[#d4be88]/70`) so form inputs remain crisp and legible across all cycling background artwork.
  - **Harmonized Typography**: Standardized field labels to `LABEL_CLASS` (`font-display text-xs font-semibold uppercase tracking-[0.12em] text-[#fae5b5]`) and all hints to `font-narrative italic text-xs text-[#d8c49e]`, eliminating jarring font size differences across all forms.
  - **Replaced Cluttered Suggestion Chips with Examples Modal**: Replaced space-consuming inline chips in `WorldSetup` and `NewGame` with a reusable `ExamplesHelpModal` triggered by a compact `✨ Examples` button in field headers. Added comprehensive presets covering Romance Fantasy, Comedy & Satirical, Adventure Fantasy, Future Tech, Warfare & Military, Real-like & Historical, Drama & Political Intrigue, Grimdark, Cozy Hearthside, Xianxia Cultivation, Gothic Horror, Urban Supernatural, Power Systems, Personalities, and Motivations (`src/data/formExamples.ts`).
  - **Separated Novel & Author Rows**: In `WorldSetup.tsx`, separated "Adapted Novel / Work" and "Original Author" into distinct, full-width rows with clear hints and placeholders.
  - Verified with `tsc --noEmit` and `vite build`.
- **Richer World/Protagonist creation data + a two-tab layout**: 2026-09-04 (Claude Code
  on the web). See the full log entry at the bottom of this file — the short version:
  `WorldData` gained `powerSystem`/`eraTechLevel`/`keyFactions`, `ProtagonistData` and
  `Player` gained `personality`/`motivation`/`physicalTrait`/`secret` (and `Player`
  finally gained `background`, fixing a real bug — see below), both creation screens
  split into a vertical two-tab layout, and the "start from a saved X" chip row was
  replaced with a search dropdown.
- **"Clear Local Data" button & no-scroll viewport**: 2026-09-04. Fixed a logic bug in Settings where "Reset Defaults" was wiping the database instead of the display preferences, separated them correctly, and added `overscroll-behavior: none` + a fixed container to `Chronicle` so the outer glass canvas locks in place like a game viewport rather than panning/rubber-banding.
- **Glass-button pass** on the shared
`GlassCTAButton` (frosted hover tint, a properly uniform tapered border, ring-above-fill
layering, focus-visible parity) plus the **hover trap** discovery now documented in §0 —
read that before ever debugging a `hover:` style here. Before that: a punch list from the
blueprint gap-scan — a Title screen "Continue" shortcut, a save schema-version field, and
the big one, a real **Equipment system** (§5.9 Item Type Taxonomy, equip slots, stat_bonus
on equip/unequip via new `!equip`/`!unequip` bang commands) replacing what had been bare
id+qty inventory with no name, type, or description at all. Also rebuilt Main Menu around
the same cycling background and border-only glassmorphism chrome as Title, and fixed a
GitHub Pages 404 on the background images (hardcoded leading-slash path instead of Vite's
`BASE_URL`).

**Repos:** `origin` → `github.com/kemave-arch/tale-dives` (the live one; GitHub Pages
deploys from it). A second remote `backup` → `github.com/kemave-arch/TaleDivesGem` (the
user renamed it from `TaleDivesDev`; both URLs still resolve to it), created for a Google
AI Studio experiment. **Nothing syncs automatically.**

**How to push a change to `backup` now that it has diverged** (see the AI Studio commit
below) — a plain `git push backup master` will be rejected (non-fast-forward), and
force-pushing would destroy their commit. Instead, build a throwaway branch off their
history and cherry-pick just the new commit onto it, so their work stays intact and
`origin`/local `master` are never touched:
```bash
git fetch backup
git branch -f __backup_sync backup/master
git checkout __backup_sync
git cherry-pick <the new commit>
git push backup __backup_sync:master
git checkout master
git branch -D __backup_sync
```
Confirm success by comparing file content, not commit hashes (they'll legitimately
differ since the histories have diverged): `git diff <local-commit> <backup-tip> -- <files>`
should be empty.

**⚠️ The two repos have now diverged, and merging naively will break the Pages deploy.**
AI Studio pushed `713fda9` ("chore: improve project configuration and metadata") to
`backup` only. It adds a favicon, SEO metadata, Vite server host/port config, an empty
`.env.example`, and a `VITE_GEMINI_API_KEY` fallback in `store.ts` — but it also
**deletes `package-lock.json`**, and `.github/workflows/deploy.yml` runs `npm ci`, which
*requires* a lockfile and fails hard without one. If that commit is merged into `origin`
as-is, GitHub Pages deploys stop working until the lockfile is restored. Cherry-pick the
good parts, or merge and then `npm install` to regenerate the lockfile before pushing.

**On the `VITE_GEMINI_API_KEY` fallback specifically:** it is safe *as committed* — the
`.env.example` value is empty, `.gitignore` still excludes `.env`/`.env.local`, and the
Pages build runs on Actions where no `.env` exists, so the deployed bundle gets an empty
string. The trap is one step away: `VITE_`-prefixed vars are **inlined into the client
bundle at build time**, so putting a real key in `.env` and building — or wiring the key
in as an Actions secret — publishes it in plaintext in `dist/assets/*.js` for anyone to
read. Fine for local/AI-Studio dev; never for a deployed build. The intended design
remains: the key is entered per-user in Settings and lives only in that browser's
`localStorage`, never in the bundle or the repo.
**Read this first if you are a Claude Code session picking this project back up** — this
file exists specifically so a *different* session (possibly on a different machine) can
resume without re-deriving context. It is kept in sync with the actual code on `master`,
verified by direct inspection (grep/read), not by trusting the blueprint doc's
intentions — several blueprint sections describe features that are **not**
built yet, and that distinction matters below. **Check the Revision log at the bottom
first** — it's the fastest way to see what's changed since your last read of this file.

**Session summary, if you only read one paragraph:** every Tier 3 priority item shipped
and was verified live except #15 (Inspired Mode), which was spiked and deliberately
deferred with hard evidence (§4 below) rather than built blind — do not attempt it again
without re-reading that entry first. The verify-and-fix pass found and fixed one genuine
pre-existing bug (`stat_grant` was completely unimplemented) plus a defensive pool-clamp
and two small consistency fixes, but is not exhaustive — §5/§6 list concrete remaining
work. The beautification pass is barely started — §6 has a suggested approach. Nothing is
broken; everything shipped this session was verified live in a real browser, most of it
against a real Gemini turn, with any verification gaps stated explicitly rather than
implied.

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
the only wired provider) returns structured JSON turns (narration + state deltas) per
`src/api/turnContract.ts`'s schema, applied client-side by `src/App.tsx`'s `sendAction`.
The full intended design lives in `Tale-Dives-Blueprint-v2_4.md` in the repo root — it is
a design document, not a status report. Treat every `§` reference below as "see that
section of the blueprint for the full spec," not "this is built."

## 2. Current file inventory (verified against actual `src/`, not assumed)

**Screens** (`src/screens/*.tsx`): `Title` (redesigned this session — full-bleed cycling
artwork, the entry-point screen), `StoryMode` (Original/Inspired mode picker, step 1 of the
creation flow), `Settings`, `MainMenu` (redesigned same session as Title, later same day —
same cycling background + border-only glass chrome, no more skin-token `glass-panel`),
`WorldSetup` (step 2), `NewGame` (step 3, "Protagonist Setup" in UI copy), `TaleBrief`
(step 4, opening scene + narration/creativity/combat-mode settings, the screen that
actually calls `beginCampaign`), `Chronicle` (main gameplay), `Codex`
(Locations/NPCs/Factions/Lore/Quests/Bestiary/Items browser + CRUD),
`SlashCommandManager`.

**Lib** (`src/lib/*.ts`): `store.ts` (persistence), `jitContext.ts` (per-turn context
slicing), `shadowReferee.ts` (client-side validation of model-proposed deltas), `codex.ts`
+ `keywordLinks.ts` (`{{Term|category}}` auto-registration), `locations.ts`, `npcs.ts`,
`quests.ts`, `inventory.ts` (per-domain state appliers — now also §5.9 Equipment:
`applyInventoryChanges` upserts the item Codex alongside the qty ledger, `equipItem`/
`unequipSlot` apply/reverse a `statBonus`), `combat.ts` (Tactical combat
math), `leveling.ts` (milestone leveling + chapter boundaries), `bangCommands.ts` (`!`
client-side commands), `discovery.ts` (§5.12 Codex Discovery reveal checks), `crafting.ts`
+ `gameTime.ts` (§5.8 Crafting queue resolution + GameTime arithmetic), `summoning.ts`
(§5.3 Summoning/Minion engine), `factions.ts` (§5.4/§5.11 rivalry + derived standing),
`fsAccess.ts` (§6.4B File System Access API wrapper), `useConfirm.tsx` (an in-app confirm
modal; see its Revision log entry for why `window.confirm()` had to go),
`cyclingBackground.tsx` (the shared background-slot picker/crossfader — exports
`CyclingBackground`; slots are discovered at runtime, there is no `BACKGROUND_SLOTS`
array any more), `backgroundMusic.tsx` (`useBackgroundMusic` — the soundtrack hook:
runtime track discovery, per-track fade in/out, wrap-around, and the mute toggle's state.
Mounted once in `App.tsx`, deliberately **not** in a screen, so music survives navigation
instead of restarting on every unmount. Read §0's muted-autoplay trap before editing it),
`glassChrome.tsx` (the shared
border-only-glassmorphism pieces — `TAPER_CLIP`, `GlassCTAButton`, `GlassIconButton`,
`GLASS_SURFACE`), `currency.ts`, `derivedStats.ts`, `richText.tsx`, `slug.ts`,
`autoRegister.ts`, `turnStates.ts`, `backup.ts` (`downloadJSON`/`readJSONFile` plus
`saveJSON`, folder-aware).

**API** (`src/api/`): `turnContract.ts` (system prompt + `TURN_SCHEMA`),
`providers/types.ts` (the `Provider` interface, new this session),
`providers/index.ts` (the provider registry — `getProvider`/`allProviders`, new this
session), `providers/gemini.ts` (the only real provider implementation — exports both the
raw `runTurn`/`runSummary` functions and the `GEMINI_PROVIDER` descriptor).

**Data** (`src/data/`): `classes.ts` (Preset Class Dictionary, now including
`apprentice_scribe`), `recipes.ts` (§5.8 Recipe Dictionary), `starterTemplates.ts` (new —
the Fourth Wing World + Violet Sorrengail Protagonist starter template, Appendix A's worked
example, seeded once into the Library on a genuinely first-ever load).

**Deployment**: `.github/workflows/deploy.yml` — builds and deploys to GitHub Pages via
Actions on every push to `master` (repo's Pages source is set to "GitHub Actions"). `vite.config.ts` uses `base: './'` (relative) so the build works from the project's Pages
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

**Current priority list (2026-09-03, office session)**, folding in what's actually left
after the additions below — items 7/8/9 above are unchanged and still the long pole:

1. ~~Finish the verify-and-fix pass~~ — **done, completely.** Quests/Bestiary CRUD,
   defeat/recovery, and chapter recap are all now verified live against a real Gemini turn
   (see the revision log entries above). The only unverified item left anywhere in the app
   is on-device folder saves (item 2 below), which needs a human, not more agent time.
2. **Manually verify on-device folder saves** (§3's Multi-provider entry) — the one gap
   that genuinely needs a human: click Settings → Backup → Choose Folder for real, since a
   native OS picker dialog can't be driven by browser automation.
3. ~~Continue the beautification pass to Title/Main Menu~~ — **checked, already clean**,
   see the revision log entry just above this list. Every screen has now had a dedicated
   look at least once.
4. ~~Scope the radial quick-action menu~~ — **built and live-verified** (commits
   `7ec0e36`, then `bfd8792` after feedback: smaller 40px buttons, Compass icon instead of
   Wand2, layered gold border + hover/press glow, and the browser tool recovered enough
   this same session to confirm the fan opens correctly and both a Settings and a
   Codex-category shortcut navigate correctly). Nothing outstanding here.
5. **Inspired Mode (item 7 above)** — stays parked until the Google Search grounding quota
   resets or billing is enabled; don't re-spike more than once or twice a session.

---

## Full revision history

Every dated session entry before 2026-09-04 has been moved to
[`PROJECT_REVISION_NOTES_ARCHIVE.md`](./PROJECT_REVISION_NOTES_ARCHIVE.md) — this file
was closing in on 1,700 lines, most of it historical log rather than current state. That
file is a verbatim continuation of the same log; nothing was edited or condensed, only
relocated. Read it only when a specific past decision needs more detail than the summary
sections above give — for resuming work, everything above this line is what actually
matters.

New entries below, most recent first.

- **2026-09-04** (Claude Code on the web) — Richer World/Protagonist creation data, plus
  a UX pass on both creation screens driven directly by the user + AI Studio's own UX
  critique of the flow. Full design reasoning lives in the plan file this session wrote
  before implementing (not committed to the repo — see this entry for the durable
  record). What shipped:
  - **New fields**: `WorldData` gained `powerSystem` (deliberately generalized past
    "magic" — covers cultivation/cores, tech, modern/future warfare, or pure skill too,
    since a sci-fi or wuxia-style world shouldn't be steered toward assuming magic
    exists), `eraTechLevel`, `keyFactions`. `ProtagonistData` gained `personality`,
    `motivation`, `physicalTrait`, `secret`. Considered and dropped a separate
    `toneRating` select — the existing `genreTone` free-text field already conveys grit
    level in practice, and the system prompt's mature-content boundary is explicitly
    fixed regardless of tone, so a second field would've duplicated what `genreTone`
    already says without changing any model behavior. Shipped as tap-to-insert tone
    chips on `genreTone` instead.
  - **A real bug fixed, not just new fields**: `ProtagonistData.background` was only
    ever told to the model once, in Turn 1's opening message — never copied onto
    `Player`, so it vanished the moment the chapter-recap system flushed the sliding
    history window (§2 Phase E, every ~15 turns). `WorldData.genreTone`/`conflict` had
    the exact same bug (only ever sent via `beginCampaign`'s `firstAction`, never part
    of `jitContext.ts`'s always-on `World Premise` line). All three fixed alongside the
    four new fields, which follow the already-correct `gender`/`age` pattern from the
    start (copied onto `Player`, re-sent every turn).
  - **Two-tab layout, both screens**: World Setup splits into Overview (Name, Adapted
    From, Genre & Tone) / Depth (Conflict, Power System, Era/Tech Level, Key Factions,
    Background, Narration Style); Protagonist Setup splits into Basics (Name,
    Gender/Age, Class) / Identity (Background, Personality, Motivation, Physical Trait,
    Secret). Driven by a new `orientation?: 'horizontal' | 'vertical'` prop on the
    shared `GlassTabs` (default `'horizontal'`, so MainMenu/Codex/Settings' existing
    usage is untouched) — the new rail sits vertically on the left, icon-on-top/
    label-below buttons, same active/inactive classes as the horizontal form, just a
    new arrangement.
  - **Template picker rebuilt**: the old "start from a saved World/Protagonist" chip
    row breaks down once a player has saved more than a handful of presets — a
    scrolling row of same-looking pills with no filtering. Replaced with a new
    `TemplateSearchDropdown` (`glassChrome.tsx`) — shows the full list on focus (still
    works fine with only 1-2 saved templates), filters live by name as you type. Picking
    a result also resets the active tab back to the first one, so applying a template
    while sitting on the second tab doesn't read as a no-op.
  - **Suggestion chips**: a new `SuggestionChips` helper (`glassChrome.tsx`) puts
    tap-to-insert starter phrases above Genre & Tone, Power System, Personality, and
    Motivation — sets the field, never locks it, so it's a starting point not a rigid
    choice. Addresses a UX critique AI Studio raised independently ("a lot of
    open-ended essay writing... all in one screen") about blank-page friction on these
    screens.
  - **Placeholders regrounded**: every new field's placeholder (and two existing ones —
    Protagonist Name, Adapted From Title/Author — that had drifted to an unrelated
    example) now draws from the same Fourth Wing/Violet Sorrengail continuity already
    shipped in `starterTemplates.ts`, backfilled with real values for every new field.
  - **Prompt wiring**: `App.tsx`'s `beginCampaign` extends `firstAction` with all seven
    new fields; `jitContext.ts`'s `buildContextSlice` gained a `Protagonist Identity`
    line and an extended `World Premise` block so everything persists turn to turn, not
    just on Turn 1; `turnContract.ts`'s `SYSTEM_INSTRUCTIONS` gained a new sub-rule
    (1e, next to 1d's NPC Behavior rule) telling the model how to use Protagonist
    Identity — shape how the world reacts, never write the player's own thoughts/words/
    decisions (rule 3 already forbids that; this doesn't relax it).
  - **Codex connection**: the `realm` and `character` categories (`Codex.tsx`) already
    existed as the live mid-campaign edit surface for `campaign.world`/`player` — both
    extended with the new fields (`realm` fully editable, `character` read-only for the
    identity fields, matching how `background` was already read-only there).
  - **Verified live**: `npm run typecheck`/`npm run build` both clean. Drove the actual
    dev server with a real headless browser (Playwright, `chromium-1194` — this
    environment has no `chromium-cli`, so this session used the run skill's documented
    Playwright fallback pattern) at both desktop (1280×900) and the 390px mobile
    viewport: applied the Fourth Wing/Violet Sorrengail templates via the new search
    dropdown (both the full-list-on-focus and filtered-by-typing states), confirmed
    every new field populates correctly on both tabs at both viewport widths, zero
    console errors beyond an expected Google Fonts network failure specific to this
    sandboxed dev environment. **Not verified live**: the actual outgoing Turn-1 Gemini
    request/context slice — no API key is configured in this environment. The
    `firstAction`/context-slice code follows the exact same pattern as the pre-existing,
    already-working `worldLines`/`backgroundLine` code it extends, but a future session
    with a real key should confirm a real Turn 1 reads the new fields correctly at
    least once.
  - Also fixed in passing: `TextField`/search-dropdown a11y basics (proper `<button
    type="button">` on every chip/result so nothing accidentally submits a form), and
    confirmed via `git diff` that no unrelated formatting churn rode along in any of the
    nine touched files.

- **2026-09-04** (Claude Code on the web) — Reusable long-text expand-to-edit modal,
  wired into every long `<textarea>` in the app. New `src/lib/useLongTextEditor.tsx`,
  modeled directly on the existing `useConfirm.tsx` (same promise-based `{ edit,
  dialog }` shape, same backdrop-click-cancels-with-`stopPropagation` nesting safety),
  built entirely from `glassChrome.tsx` primitives — a `GLASS_SURFACE`-styled panel,
  near-fullscreen on mobile (`h-[80vh]`, capped `max-w-lg` on desktop), Cancel/Save
  footer. **No `window.confirm()` anywhere** — Cancel only discards an in-progress
  draft, never the real field (nothing is written back until Save), so there's no
  destructive action to gate behind a confirmation at all, sidestepping the exact bug
  class `useConfirm.tsx`'s own doc comment describes (native `window.confirm()`
  silently resolving `false` with no dialog shown in this app's embedded preview
  environments).
  - **Trigger**: a small `Maximize2` icon in a field's label row, opening the modal
    pre-filled. `GlassField` (`glassChrome.tsx`) gained an optional `onExpand?: () =>
    void` prop for this — covers every `glassChrome.tsx`-based screen (`WorldSetup.tsx`:
    Power System, World Background, Narration Style; `NewGame.tsx`: Background, plus
    the conditional Tale Dive Brief field shown when editing a saved Protagonist
    preset; `TaleBrief.tsx`: both its own textareas).
  - **The single highest-leverage change**: `Codex.tsx`'s shared `TextField` component
    (its `textarea` branch is used by 30+ call sites across every CRUD category — NPCs,
    Locations, Factions, Lore, Quests, Bestiary, Items, Skills, Realm) gained the same
    icon automatically, with zero changes needed at any individual call site. Threading
    `editLongText` through 30+ props would have been a lot of pure mechanical noise for
    one value every call site needed identically, so it's provided once via a small
    `LongTextEditorContext` (local to `Codex.tsx`, not exported) and consumed inside
    `TextField` instead — this codebase's first use of React Context, deliberately
    narrow in scope rather than a new sprawling pattern.
  - **`Codex.tsx` and `SlashCommandManager.tsx` each instantiate their own local
    `useLongTextEditor()`**, matching a convention discovered mid-implementation: both
    already call `useConfirm()` locally themselves (not fed via a prop from `App.tsx`
    the way `WorldSetup`/`NewGame`/`TaleBrief` are) — so `editLongText` follows
    whichever pattern each screen had already established for `confirm`, rather than
    forcing one convention everywhere.
  - **Deliberately excluded**: Chronicle's per-turn action textarea (`Chronicle.tsx`
    ~line 1030) — the game's core live-typing input, wired to autocomplete dropdown
    positioning and a focus ref, typed into on essentially every turn. Not a "long
    field to review," and routing it through an expand-to-modal pattern would break
    the type-and-send interaction it's built for.
  - **Verified live**, real headless browser, both desktop and the 390px mobile
    viewport: opened the modal from `WorldSetup`'s Power System field, confirmed
    Save writes the new text back to the underlying field, Cancel discards without
    touching it, and clicking the backdrop behaves like Cancel. Then the harder
    case — opened the modal *from inside* the already-open `SlashCommandManager`
    overlay dialog (itself `z-30`, the new modal `z-50`) and confirmed it stacks
    correctly on top, typing into it, then clicking *its own* backdrop closed only
    that inner modal and left `SlashCommandManager` fully open and undisturbed
    underneath — the exact nesting behavior the `stopPropagation` pattern (copied
    from `useConfirm.tsx`) exists to guarantee. `npm run typecheck`/`npm run build`
    both clean throughout.

- **2026-09-04** (Claude Code on the web) — Soundtrack converted from mp3 to opus
  (smaller files, same quality), with a new naming pattern the user chose:
  `tale_dives_ost-0.opus`, `tale_dives_ost-1.opus`, ... — 0-indexed, unlike the
  1-indexed `pc_title-bg<N>.webp` background-art convention. `src/lib/
  backgroundMusic.tsx`'s discovery constants (`TRACK_PREFIX`/`TRACK_EXT`) and its
  probe loop's starting index updated to match; still auto-discovered the same way
  (drop a new numbered file in, it joins the rotation, no further code change).
  Removed the now-orphaned `public/tracks/ost_1.mp3`/`ost_2.mp3` — the old pattern
  the code no longer looks for. `npm run build` clean.

  **Follow-up, same day**: the user pushed the real 7 tracks directly (`aad4d71`,
  "Add files via upload" — a GitHub web-upload commit, `tale_dives_ost-0.opus`
  through `-6.opus`, ~2.7-3.2 MB each). Verified live against the real files this
  time (headless Chromium, direct `<audio id="td-soundtrack">` inspection — the only
  way to confirm actual playback, per this file's own established method):
  discovery resolves `tale_dives_ost-0.opus` correctly (`readyState: 4`, fully
  decoded), and after a manual unmute tap, `currentTime` advanced 3.11s → 4.12s
  across two one-second-apart samples — real confirmed audible playback, not just
  a loaded-but-silent element. Opus-in-a-bare-`.opus`-file `<audio>` support is
  solid in Chrome/Firefox/Edge; still worth a real-device check on Safari/iOS
  specifically if that audience matters here, since that combination has
  historically been spottier and this session couldn't test it.

- **2026-09-04** (Claude Code on the web) — Removed the "Audio Auto-Unmute on Title"
  behavior (an `App.tsx` effect that force-called `setMusicMuted(false)` every time
  `screen === 'title'`, added in an earlier AI Studio session) per explicit request
  for the mute toggle to be fully manual. This was overriding the player's own mute
  choice on every visit/return to Title — muting, navigating away, and coming back
  would silently re-enable audio regardless. Now the toggle (Title and Main Menu,
  both already wired to the same shared `toggleMusicMute`) is the only thing that
  changes mute state; nothing auto-overrides it. `setMuted` dropped from `App.tsx`'s
  destructuring of `useBackgroundMusic()` since nothing there calls it anymore (the
  hook itself still exposes it, for whatever future consumer might need direct
  control). **Deliberately left untouched**: the existing muted-autoplay pre-buffer
  and the first-interaction-anywhere `retryOnGesture` listener in
  `backgroundMusic.tsx` — genuinely audible autoplay with zero prior interaction is
  not possible in any browser (a hard platform restriction, confirmed when asked,
  not an app limitation), and this pre-buffering is unrelated to that removed
  auto-unmute — it's what makes the player's *own* first manual unmute tap start
  instantly instead of lagging, so it's still worth keeping. Verified live: muted →
  navigated Title → Main Menu → back to Title → confirmed still muted (previously
  this exact path silently re-enabled audio); the reverse (unmuted → navigate away →
  back) also holds correctly since there's no longer any effect touching mute state
  on screen change. `npm run build` clean.

  **Follow-up, same day**: the fully-manual version above was one step too far —
  the user wanted the *first genuine interaction anywhere* to auto-unmute (a real
  gesture legitimately authorizes audible playback; this is standard practice, not
  fighting the browser), with the mute button taking over as a normal toggle only
  after that. Added a second self-removing `pointerdown`/`keydown` listener in
  `backgroundMusic.tsx` (alongside the existing `retryOnGesture`, which still just
  keeps *muted* pre-buffer playback alive and is unchanged) that calls `setMuted
  (false)` on the first qualifying interaction.

  **The real design problem**: this listener and the mute button's own `onClick`
  (`toggleMute`) can both fire for the exact same tap, if the user's first-ever
  interaction happens to *be* the mute button — `pointerdown` fires before `click`,
  so a naive version would unmute via the listener, then immediately re-toggle back
  to muted when the button's own handler ran a moment later. Fixed by having the
  listener check the event target against both buttons' `aria-label`s ("Mute
  music"/"Unmute music", shared by both Title's and Main Menu's `GlassIconButton`
  instances) and skip entirely when the interaction is on the toggle itself —
  letting the button's own `onClick` be the sole handler for that case, no
  coordination needed. As long as every interaction so far has been the toggle, the
  listener just keeps waiting rather than firing on the wrong one.

  Verified live (same real-`<audio>`-element inspection method as this file's other
  audio entries) against both cases: (1) first interaction is something else (e.g.
  "Dive In") — auto-unmutes, confirmed real playback (`currentTime` advancing); (2)
  first interaction is the mute button itself — no double-toggle bug, ends up
  correctly unmuted and playing from that single tap, and a second tap correctly
  re-mutes, proving the toggle behaves completely normally afterward. `npm run
  build` clean.

- **2026-09-04** (Claude Code on the web) — Removed all 7 `tale_dives_ost-*.opus`
  tracks from `public/tracks/` at the user's request — they're uploading a
  replacement set. `public/tracks/` is now empty; **the app has zero audio tracks
  until the new set lands.** No code change needed either way —
  `backgroundMusic.tsx`'s discovery is still the same auto-probing
  `tale_dives_ost-<N>.opus` (0-indexed) pattern from earlier today; whatever new
  files land there just need to follow that same naming to be picked up with no
  further code change.

- **2026-09-04** (Claude Code on the web) — Soundtrack discovery replaced with an
  explicit manifest, since the user renamed tracks to descriptive names for their
  own library management, breaking the sequential-filename probing scheme entirely.
  **The real constraint that forced this**: browsers have no API to list a
  directory's contents — the old scheme only worked *because* names were guessable
  one by one; there is no way around a manifest once names stop being sequential.
  New `src/data/soundtrackManifest.ts` (`TRACK_FILENAMES: string[]`, matching this
  project's existing hand-maintained `src/data/` convention) lists the actual
  files; `backgroundMusic.tsx`'s `discoverTracks()` rewritten to map that list
  instead of probing an incrementing counter, dropping the now-dead
  `TRACK_PREFIX`/`TRACK_EXT`/`MAX_TRACK_PROBE` constants.

  **Play order** comes from a `_ostNN` suffix on the filename itself (the user's
  own idea, arrived at after first asking about embedded-audio-metadata parsing —
  correctly talked down from that: reading a Vorbis comment tag out of an Ogg
  container would have meant hand-rolling binary parsing or a new dependency for
  one field, when the order can just as well live in the filename itself), parsed
  by a small regex (`ORDER_SUFFIX = /_ost0*(\d+)/i`, applied to the filename minus
  its extension). A name with no such suffix falls back to the manifest's own
  array order rather than being dropped — the same forgiving-fallback spirit the
  old scheme had, just far cheaper to reach now since there's no fetch/parse step
  to fail. Existence is still verified through the *same* `probeTrackExists`
  (`<audio>`-element decode probe) as before — unchanged, still the one piece of
  the old scheme that was already correct.

  The 7 uploaded tracks (`aad4d71`'s successor set — `Lionheart.opus`,
  `NewTales.opus`, `RiseNFall.opus`, `RisingCore.opus`, `Stratosphere.opus`,
  `TempestDive.opus`, `WhoAmI.opus`) landed with no `_ostNN` suffix yet; the user
  then supplied the intended play order directly (a numbered title list, 0-6) and
  asked for the files to be renamed to match, which this session did directly:
  `RisingCore_ost00.opus` → `NewTales_ost01.opus` → `WhoAmI_ost02.opus` →
  `TempestDive_ost03.opus` → `Lionheart_ost04.opus` → `Stratosphere_ost05.opus` →
  `RiseNFall_ost06.opus`, manifest updated to match.

  **Verified live**, real headless browser against the real uploaded/renamed
  files (not a synthetic test, since the files were already in place by the time
  this landed): ran the exact discovery+sort logic standalone in the page against
  the live server, confirmed all 7 resolve and sort into exactly the intended
  order; separately confirmed the actual running app's `<audio id="td-soundtrack">`
  element loads `RisingCore_ost00.opus` first on a fresh load. Also unit-verified
  `parseOrder`'s regex directly (`RisingCore_ost00.opus` → `0`,
  `finale_ost12.opus` → `12`, a no-suffix name → `null`, correctly falling back).
  `npm run typecheck`/`npm run build` both clean.

- **2026-09-04** (Claude Code on the web) — `package-lock.json` added to
  `.gitignore`. AI Studio had deleted it twice this session already — per the
  user, its own environment genuinely needs it absent, not an accident — and this
  repo's deploy workflow uses `npm install`, not `npm ci`, so there was never a
  reproducibility reason to keep committing it either. Ignoring it stops the
  recurring add/delete churn outright rather than leaving it to keep happening.

- **2026-09-04** (AI Studio) — Setup screens overhaul (`WorldSetup.tsx` & `NewGame.tsx`):
  1. Converted subtab navigation from vertical rail to compact horizontal tabs (`GlassTabs`) across both screens.
  2. Repositioned all form controls to span full width, removing the empty indentation left by the removed vertical subtab rail.
  3. Replaced the separate dropdown template selector with a dedicated "Load Preset" subtab containing a search bar and a compact table displaying saved presets, active indicators, and quick-load actions.
  4. Created `GlassLongTextarea` in `src/lib/glassChrome.tsx` and updated `useLongTextEditor.tsx` (added placeholder support and live word count metrics). Long text fields now automatically open the expanded editing modal upon click/tap and keyboard focus (Enter/Space), eliminating the separate expand button (`Maximize2`) in `GlassField`, `WorldSetup`, `NewGame`, `TaleBrief`, and `Codex`.
  5. Verified clean build (`compile_applet`) and type safety (`lint_applet`).

- **2026-09-04** (AI Studio) — Preset Detail Views (`PresetDetailModal.tsx`, `MainMenu.tsx`, `WorldSetup.tsx`, `NewGame.tsx`):
  1. Created `PresetDetailModal.tsx` hosting responsive `WorldDetailModal` and `ProtagonistDetailModal`.
  2. Implemented responsive layout strategy:
     - Mobile view (< 640px): uses compact horizontal tabs (`Overview`, `Depth`, `Style` / `Overview`, `Identity`, `Story`) with smooth transitions to ensure comfortable reading without overwhelming vertical scroll on small touchscreens.
     - PC/Tablet view (>= 640px): multi-column responsive grid layout presenting metadata, lore, and long-form narrative fields with clear visual hierarchy and Lucide icons.
  3. Integrated into `MainMenu.tsx`:
     - Clicking any world or protagonist card in the list opens its comprehensive detail modal.
     - Provides quick actions: "Use in Story", "Set as default", "Edit", and "Delete", with click propagation stopped on inline buttons.
  4. Integrated into `WorldSetup.tsx` and `NewGame.tsx`:
     - Clicking any row in the "Load Preset" table opens the full detail modal with "Load" and "Cancel" buttons.
  5. Styling: Adheres to the single dark-glass design system (`GLASS_SURFACE`), high-contrast cream text (`#fae5b5`, `#fbf4e2`), gold accents (`#f0ca65`), and typography pairings.
  6. Verified type safety with `lint_applet` and successful production build with `compile_applet`.


