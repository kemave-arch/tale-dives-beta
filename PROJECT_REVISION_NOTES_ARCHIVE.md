# Tale Dives — Project Revision Notes: Full History Archive

This is the complete, unabridged chronological revision log — every session's entries in
full, oldest first. It was split out of `PROJECT_REVISION_NOTES.md` on 2026-09-04 once
that file passed ~1,650 lines and finding "where are we right now" inside it meant
scrolling past most of this history first.

**Read `PROJECT_REVISION_NOTES.md` first, always.** It carries the current state, the
"read this before touching X" warnings, and the pending-work list — everything a session
actually needs to resume work. Come here only when you need the full story behind a
specific past decision that the current-state file's summary doesn't cover in enough
detail.

Nothing below has been edited or condensed — it's a verbatim continuation of the same log
that used to live at the bottom of the main file. New entries stop being added here; once
`PROJECT_REVISION_NOTES.md`'s own log section grows too long again, archive it forward
into this same file (append, don't replace) so there's still just one place to look.

---

## Revision log

- **2026-09-03** — Initial version of this document, written after committing and pushing
  the Slash Command Manager feature (`72f7ef9`). Tier 3 list above is the starting point
  for all future work; nothing in §4 has been started yet.
- **2026-09-03** — Codex Discovery / "Fog of Lore" (blueprint §5.12) implemented and
  pushed (`fbdef88`). This closes the Codex Discovery half of what was originally Tier 3
  item #14 — that item is now faction-rivalry-only. Verified live in the dev server:
  created a hidden Lore entry via CRUD with a `flag`-trigger reveal condition, confirmed
  it renders as `???` + teaser + Lock badge in both the Codex grid and the Chronicle's
  tap-to-open popup, confirmed CRUD Edit Mode still shows the full record while hidden
  (masking exception per spec), and confirmed toggling the state back to Known correctly
  un-masks it everywhere. Did not verify the automatic in-turn reveal path (that would
  require spending a real Gemini API call) — that logic (`checkCodexReveals` in
  `src/lib/discovery.ts`) is straightforward, typechecked, and code-reviewed, but a
  future session should watch for it the first time a real flag/location/NPC/quest
  reveal fires during actual play, since it hasn't been observed live yet. `npm run
  typecheck` and `npm run build` both clean. Next up per §6: Tier 3 item #10 (Class
  Evolution), which can now reuse the `entry.discoveries` inline-badge pattern in
  `Chronicle.tsx`'s `TurnBlock` for its own reveal banner.
- **2026-09-03** — Class Evolution (blueprint §5.1b) implemented and pushed (`3597869`).
  Added `class_evolution` as an optional schema-constrained field on `TurnResponse` (enum
  of the Preset Class Dictionary — the model can never propose a class the client doesn't
  recognize), applied non-retroactively in `App.tsx`'s `sendAction` (this turn's own
  level-up, if any, still uses the old weight vector; only future level-ups follow the
  new class), plus a manual trigger via a new "Character" Codex category. The Chronicle
  banner reuses the Codex Discovery badge pattern as intended. Verified live end-to-end:
  opened the new Character category (showed real Warrior/Level 3/attrs/pools data),
  edited the class to Mage, confirmed the change persisted and the Chronicle log showed a
  "CLASS EVOLUTION — Now a MAGE" banner. **Tooling note for future sessions**: the first
  save attempt silently no-op'd because the browser-automation tool auto-dismisses native
  `window.confirm()` dialogs (returns false) — had to override `window.confirm = () =>
  true` via the JS-exec tool before the save handler's logic could be verified. This is a
  testing-environment quirk, not an app bug; §6 above now carries this as a standing note.
  Did not verify the story-driven (model-proposed) trigger path live, since that would
  need a real Gemini call narrating an undeniable, permanent role change — the manual
  trigger path exercises the same `evolveClass`-adjacent logic (weight vector re-pointing,
  banner rendering) so this is lower-risk than it sounds, but a future session should
  watch for it the first time a real campaign's story actually fires `class_evolution`.
  `npm run typecheck` and `npm run build` both clean. Next up per §6: Tier 3 item #12
  (Crafting) or #13 (Summoning), either order — both are independent of everything shipped
  so far.
- **2026-09-03** — Crafting & Resource Management (blueprint §5.8, crafting-queue half)
  implemented and pushed (`ccec6d1`). Added `src/data/recipes.ts` (Recipe Dictionary),
  `src/lib/gameTime.ts` (arithmetic on the model's freeform time string) and
  `src/lib/crafting.ts` (queue/resolve logic), wired into `App.tsx`'s `sendAction` with a
  two-pass resolution (a read-only pre-turn peek for the narration hook, an authoritative
  post-turn pass using the turn's real resulting time for what actually persists), plus a
  new "Workbenches & Recipes" Codex category and a "Craft Ready" Chronicle badge. Verified
  live end-to-end, including a real Gemini turn: added Iron Ore via Codex CRUD, queued an
  Iron Dagger (ingredients deducted immediately, 1h timer shown), sent an actual turn that
  advanced game time past completion, and confirmed the dagger appeared in inventory with
  the "Craft Ready: Iron Dagger" badge on that turn's log entry, narrated context hook
  included (player happened to still be at the same location). `npm run typecheck` and
  `npm run build` both clean. Scope cuts (station-location enforcement, perishable decay)
  are documented in §3/§4 above — read those before assuming either exists.
  Next up per §6: Tier 3 item #13 (Summoning & Minion Engine).
- **2026-09-03** — Three-Branch Summoning & Minion Engine (blueprint §5.3) implemented and
  pushed (`9a3158e`). Added `src/lib/summoning.ts` (class-branch gating, the three
  `attemptSummon` outcomes, per-turn `applyMinionUpkeep`), extended `bangCommands.ts` with
  a read-only `!minions` roster, and intercepted `!arise`/`!raise_skeleton`/`!summon` in
  `App.tsx`'s `handleBangCommand` before the read-only path (these mutate real state —
  MP, inventory, corpses, minions — unlike every other bang command). `turn.corpse_add`
  now feeds a running `Campaign.corpses` pool every turn, consumed by `!arise`. Verified
  live end-to-end with a real Gemini turn: evolved the test character into Contract Gate
  Summoner (reusing this session's Class Evolution feature), ran `!summon` (MP 25→10, a
  "Planar Gate" dossier rendered with the new minion), confirmed `!minions` lists the
  roster, then took a real turn and confirmed MP drained 10→8 from the familiar's 2 MP/turn
  upkeep. Did not verify the `!arise`/`!raise_skeleton` paths live (would need a Dark
  Monarch/Necromancer test character and, for skeletons, Bone Dust in inventory) — the
  logic is symmetric to `!summon`'s already-verified path and code-reviewed, but a future
  session should spot-check those two specifically before assuming they're bug-free in
  practice. `npm run typecheck` and `npm run build` both clean. Next up per §6: the
  remainder of Tier 3 item #14 (faction rivalry/standing derivation, §5.4/§5.11).
- **2026-09-03** — Faction Reputation Rivalry + Territory Standing (blueprint §5.4/§5.11)
  implemented and pushed (`52591e0`). This closes Tier 3 item #14 fully (both the Codex
  Discovery half from earlier and this rivalry/standing half) — **items #10, #12, #13,
  #14 are now all done**; only #15 (Inspired Mode) and #16 (multi-provider + on-device
  saves) remain. Added `src/lib/factions.ts` (`applyFactionRepDeltas`, `deriveStanding`,
  `effectiveStanding`, `repTierLabel`), a `fac_rep` turn-schema field, `FactionEntry.
  rivalId`, and changed `LocationEntry.factionOwner`'s Codex CRUD field from free text to
  an id-based dropdown so standing derivation can actually resolve it. Verified live:
  created two factions with a bidirectional rival link, assigned one as a location's
  owner (Codex UI showed a live derived-standing preview in place of the old manual
  Standing field), then dropped that faction's rep to -2 via CRUD and confirmed the
  location's standing automatically flipped from "neutral" to "hostile" with zero direct
  edits to the location — the core derivation-with-zero-extra-writes behavior §5.11 asks
  for. Took a real Gemini turn afterward with the new `fac_rep` schema field present;
  resolved normally, no errors, and the model spontaneously referenced "Shadow Guild" by
  name in its own narration (picked up from Known Entities context) — a good sign the
  data is actually reaching the model, though the automatic rivalry-mirror path itself
  (a model-driven `fac_rep` delta, as opposed to the manual CRUD edit tested) was not
  observed live this session — it's a simple, pure, typechecked function
  (`applyFactionRepDeltas`), same confidence level as the `!arise`/`!raise_skeleton` gap
  noted in Summoning's entry above. Also noticed and logged (not fixed) a possible ST
  clamping gap — see §5 above. `npm run typecheck` and `npm run build` both clean. Next
  up per §6: Tier 3 item #15 (Inspired Mode) or #16 (multi-provider + on-device saves) —
  #16 is lower-risk and may be worth doing first if #15's grounding+schema spike doesn't
  pan out quickly.
- **2026-09-03** — Multi-provider abstraction + on-device folder saves (blueprint §3.4 /
  §6.4B) implemented and pushed (`9a2fed0`). **This clears Tier 3 item #16 — every item
  on the original list except #15 (Inspired Mode) is now done.** Added the `Provider`
  interface + registry (`src/api/providers/types.ts`, `providers/index.ts`), wrapped
  Gemini's existing `runTurn`/`runSummary` as `GEMINI_PROVIDER`, and rerouted `App.tsx`'s
  three call sites through `getProvider(apiSettings.provider)`; Settings' AI Model tab
  gained a real Provider dropdown (previously `provider: 'gemini'` was hardcoded in the
  save handler, dead field). Separately added `src/lib/fsAccess.ts` (File System Access
  API wrapper + IndexedDB handle persistence — needed a small ambient-types file,
  `src/types/fileSystemAccess.d.ts`, since TS's bundled DOM lib doesn't have this API
  yet) and `backup.ts`'s new `saveJSON()`, wired into all three existing Export/Backup
  call sites; Settings' Backup tab gained the Local Save status row from §6.4B. Verified:
  typecheck/build clean, the Provider/Model dropdowns render and persist correctly live,
  and — importantly — confirmed the fallback path is unbroken (feature detection and the
  IndexedDB get/set plumbing were exercised directly via the browser console and returned
  cleanly with nothing linked, meaning `saveJSON` correctly falls through to the
  unchanged `downloadJSON` path when no folder is linked, i.e. the common case for every
  user until they explicitly opt in). **Could not verify**: the actual native
  folder-picker dialog (`showDirectoryPicker()`) — clicking "Choose Folder" produced no
  visible dialog and no error, consistent with the picker either requiring a stricter
  user-activation gesture than an automated click provides, or opening as a native OS
  window outside anything the browser-automation tool can see or interact with. This is
  a testing-environment ceiling, not a diagnosed bug, but it means the link → write →
  unlink flow specifically has never been exercised end-to-end by anything other than
  code review. **If a human is available, the highest-value thing they could do for this
  project right now is spend two minutes clicking "Choose Folder" in Settings → Backup,
  picking a real folder, and confirming Export Active drops a file there** — that one
  manual check would close the last verification gap on this entire session's work.
  `npm run typecheck` and `npm run build` both clean. Next up per §6: Tier 3 item #15
  (Inspired Mode), the last remaining item, or the verify-and-fix pass if a time-boxed
  spike on #15's grounding+schema combination doesn't pan out quickly.
- **2026-09-03** — Spiked Tier 3 item #15 (Inspired Mode) per the plan above, no code
  changed. Three raw test calls against this session's live API key (bypassing the app,
  run directly from the browser console): plain `generateContent` succeeded (200); adding
  `tools: [{ google_search: {} }]` failed (429 RESOURCE_EXHAUSTED); adding
  `responseSchema` on top of that also failed the same way. Google Search grounding is
  quota-blocked on this key independent of the regular generation quota (which is fine),
  and reproduced identically across calls seconds apart with a successful plain call in
  between — not a transient per-minute cap. **This means the core question — can Gemini
  accept `tools` + `responseSchema` in one call — is still unanswered**, since the
  request never reached that validation; a genuine 400 would have settled it either way.
  Deferring #15 with this evidence recorded (§4 above has the full detail and the
  re-spike procedure) rather than building UI/schema code around an unverified API
  capability, consistent with this session's standard for every other scope cut. **Every
  other Tier 3 list item is now done.** Pivoting to the explicitly-requested
  verify-and-fix pass next, since it needs no further Gemini API calls (mostly code
  review + local-state UI exercises) and the grounding-quota block doesn't affect it.
- **2026-09-03** — Verify-and-fix pass, first batch (commits `f43488d`, `43d5ad8`). Started
  by investigating the earlier-flagged "negative ST" lead directly against live
  `localStorage` state (not another screenshot read) — **correction: it was actually MP
  that was negative (`-2`), not ST** — the earlier lead misread which HUD column was
  affected. Traced the actual cause as far as code review allowed: every individual pool
  mutation (`applyTurn`'s clamp in `shadowReferee.ts`, `applyLevelUps` in `leveling.ts`,
  `applyMinionUpkeep` in `summoning.ts`) is correct in isolation, so the exact repro
  wasn't conclusively pinned down — spent real time on this before concluding a
  root-cause diagnosis wasn't going to be reachable through static review alone, and
  pivoted to a defensive fix instead of continuing to guess. While investigating, found
  and fixed a real, separate, unrelated bug: `turn.stat_grant` (§5.1c) has been fully
  defined in the schema and prompted to the model since before this session started, but
  nothing anywhere in the client ever read or applied it — a silent, complete no-op every
  time the model used it. Also fixed quest auto-registration's display-name casing
  (shared the existing NPC pattern via a new `titleCaseId` export in `slug.ts`) and a
  cosmetic JSX indentation issue in Settings.tsx. Verified live: the corrupted test
  campaign's `mp` (-2) self-healed to 0 on the very next turn after the defensive clamp
  shipped. `npm run typecheck` and `npm run build` both clean after every change.
  **This is a first batch, not a completed pass** — §5/§6 above list concrete remaining
  work (Quests/Bestiary CRUD live click-through, defeat/recovery flow, chapter recap).
  Next up: continue the verify pass or move to the beautification pass — see §6's
  reasoning for why either order is defensible at this point.
- **2026-09-03** — Started the beautification pass (commit `5f271d1`), scoped to the
  newest UI added this session (Character/Crafting Codex categories, Local Save status)
  on the theory that older screens were already polished in earlier session batches (per
  `git log`: "Obsidian dark chrome redesign", "Tier 2 batch" commits, etc.) and are the
  lower-risk place to spend a bounded pass. Walked Title → Main Menu → Chronicle →
  Character → Workbenches & Recipes → Settings live in the browser. Found one real
  inconsistency: the Character screen's Attributes line showed raw fractional values
  (`STR 5.6`) next to whole-number pools (`HP 34 · MP 20 · ST 29`) on the same card,
  since STR/INT/AGI accumulate fractional amounts from level-up weight math while
  HP/MP/ST are always rounded — fixed for display-only consistency. Everything else
  reviewed (Chronicle badge stacking with multiple simultaneous badges, the Crafting
  recipe grid's live-affordability highlighting, the Settings Local Save status row)
  already read as clean and intentional — this app's existing visual language is
  genuinely solid, not neglected. **This is a light pass, not the full "entire app"
  scope the standing instruction asked for** — it covered the screens most likely to
  have rough edges (this session's own new work) but not, e.g., WorldSetup, NewGame, or
  a mobile-viewport pass. A future session picking this up should treat it as a
  continuation, not a restart — the newest UI has already had one honest look.
  `npm run typecheck` and `npm run build` both clean.

  **Where this leaves the project, for whoever reads this next**: every Tier 3 priority
  item is done except Inspired Mode (deliberately deferred with evidence, not skipped
  out of neglect — see #15's entry in §4). The verify-and-fix and beautification passes
  are both genuinely started with real, verified work landed, but neither is complete,
  and this file says exactly where each one left off. There is no unstated or hidden
  work — if it isn't written down above, it either doesn't exist yet or wasn't checked.
- **2026-09-03** — User directly reported the narration-wall-of-text bug (pointed at a
  specific broken paragraph in the live Chronicle, saying it had come up before). Fixed
  and pushed as commit `087b413` — see §5 above for the full detail (root cause,
  client-side fix design, and verification against real saved turns from this session).
  This is exactly the kind of thing the "not yet covered" list in §5 exists to be
  replaced by — a live user report, verified end-to-end, not a guess. `npm run
  typecheck` and `npm run build` both clean.

---

**The entries above are the overnight session's. Everything below is a separate session on
the office machine, picking up directly afterward — same repo, same `master` branch.**

- **2026-09-03** — GitHub Pages deployment set up (commit `7d9c22f`). `vite.config.ts` got
  `base: './'` (relative, so it works from the Pages project subpath without hardcoding the
  repo name — safe since there's no URL router) and `.github/workflows/deploy.yml` builds +
  deploys via GitHub Actions on every push to `master`. Confirmed no secrets are committed
  anywhere before making the repo's Pages source public (the API key is entered per-user
  into Settings and lives only in that browser's `localStorage`, never in the bundle).
  Verified: the actual production build (not just Vite dev mode) boots clean via `vite
  preview`, and the first live deploy completed successfully — the app is live at
  `https://kemave-arch.github.io/tale-dives/`. Also renamed the AI Model tab's
  "Temperature" field to "Narrative Variance" then, per follow-up feedback, to "Creativity
  Randomness" and converted it from a number input to a slider (matching the existing HUD
  Opacity slider pattern) — the underlying `apiSettings.temperature` field name is
  unchanged, this was UI-label-only.
- **2026-09-03** — Settings layout polish per live user feedback (commit `8581af3`, bundled
  with the Fourth Wing work below): renamed the modal from "Chronicle & Narrator Settings"
  to "App Settings"; converted the tab bar from icon+text to icon-only buttons (saves real
  width on mobile) with the active tab's label moved to a section header below the tab row
  instead of being lost; fixed a stray "Chronicle HUD Opacity" label down to "HUD Opacity".
  Separately, per an app-wide "prefer icon buttons over text unless the function is
  complex" request: converted Settings' footer Cancel/Save and SlashCommandManager's
  edit-form Cancel/Save from text buttons to icon-only circular buttons, matching the style
  Codex's CRUD toolbar and MainMenu's card actions already used. Deliberately left
  everything else as-is after actually checking it: Codex/MainMenu were already icon-only;
  WorldSetup's Continue/NewGame's Begin, and the "Add NPC"/"New Command" style buttons,
  were judged to fall under the stated "complex function" exception (a primary multi-field
  form submit, or a button whose text is the only thing disambiguating which category it
  adds to) and left as icon+text on purpose, not overlooked.
- **2026-09-03** — Added a Fourth Wing (Rebecca Yarros) World + Violet Sorrengail
  Protagonist starter template (commit `8581af3`), taken directly from the blueprint's own
  Appendix A worked example rather than invented fresh. New file `src/data/
  starterTemplates.ts` holds both constants; `src/lib/store.ts`'s `loadWorlds`/
  `loadProtagonists` seed them once, gated on the raw `localStorage` key being genuinely
  absent (not just an empty `{}`), so deleting the template afterward is respected exactly
  like any other Library entry rather than being silently re-seeded. Added a new
  `apprentice_scribe` preset class (`src/data/classes.ts`, weights STR 0.1/INT 0.65/AGI
  0.25 — a genuinely non-combat, INT-heavy starter) to back Violet's class, matching
  Appendix A.2's description of her as scholarly and frail, not combat-ready.

  **New fields, since the existing types couldn't represent Appendix A's own example
  faithfully**: `WorldData.sourceTitle`/`sourceAuthor` (attribution metadata only —
  deliberately never sent to the model, to avoid nudging generation toward reproducing
  copyrighted specifics; the actual grounding-equivalent signal is entirely carried by the
  existing Genre/Conflict/Background/Narration Style fields, hand-authored here to match
  Appendix A.1's own values) and `ProtagonistData.background` (origin/family history — the
  app previously conflated this with `opening`'s Turn-1 scene brief into one field, but
  Appendix A.2 "Background" and A.3 "Tale Dive Brief" are explicitly two different things).
  `background` now also feeds a new `Protagonist Background:` line into Turn 1's context in
  `App.tsx`'s `beginCampaign`, alongside the existing World Background/Genre/Conflict lines.

  **WorldSetup and NewGame redesigned mobile-first** in the same commit (these two hadn't
  had a dedicated pass yet — see the beautification-pass note earlier in this log): both
  moved from a plain top-to-bottom page to a pinned header + scrollable middle + pinned
  full-width primary-action footer (matching the pattern already established in
  Chronicle/Settings), template chips got larger touch targets, and the new fields were
  worked into the existing field order rather than bolted on at the end. WorldSetup's
  Original/Inspired mode toggle now always shows Original as visually active regardless of
  a loaded template's `mode` value, since Inspired Mode has no clickable alternative yet —
  showing neither box as "selected" when a template carried `mode: 'inspired'` read as a
  rendering bug even though it wasn't one.

  **Verified live, end to end**: cleared `td_worlds`/`td_protagonists` to simulate a
  genuinely fresh install, confirmed both templates seed with the exact expected content,
  then walked Main Menu → New Story → World Setup (applied the Fourth Wing chip, confirmed
  every field including the new Title/Author inputs populated correctly) → New Game
  (applied the Violet Sorrengail chip, confirmed Name/Class/Background/Tale Dive Brief all
  populated with Appendix A's exact text) in both desktop and mobile viewports. `npm run
  typecheck` and `npm run build` both clean. Hit the click-delivery tooling issue described
  in §0 above while doing this verification — see that entry for the workaround (real
  `computer`-tool clicks, expect to click twice after a navigation) before assuming a
  future session's screen-transition testing is hitting a real regression.

  **Not done, and deliberately so**: did not hand-seed the Codex (NPCs/Locations/Factions/
  Lore) with Appendix A.4's example entries (Lilith Sorrengail, The Parapet, etc.) — that
  table is what a *live* Inspired Mode grounding call would produce, and hand-writing it as
  static seed data would have meant partially reimplementing Inspired Mode by hand outside
  the deliberate deferral in §4/§7 above. The existing `{{Term|category}}` auto-registration
  path already picks these up naturally the first time a real turn's narration references
  them, at zero extra scope.
- **2026-09-03** — Continued the verify-and-fix pass (§5/§6 item 1 in this session's
  priority list): live click-through of Quests and Bestiary Codex CRUD, the two categories
  the overnight session had flagged as sharing the generic CRUD path but never directly
  exercised. Using the fresh Violet Sorrengail campaign from the entry above (API key
  temporarily cleared first, so this ran with zero API cost): created a Quest ("Survive the
  Parapet", status `advanced`), edited its status to `completed`, then deleted it —
  confirmed the list correctly returns to the empty state each step. Did the same for
  Bestiary (created "Rift Stalker", edited HP/Base Damage to 85/12, deleted it). Both
  categories work exactly like the already-verified ones; no bugs found. Zero console
  errors throughout. This closes the "Not yet covered" Codex CRUD gap from §5 above —
  defeat/recovery (`resolveDefeat`) and chapter recap (`recapChapter`) remain the only
  unverified items from that list, since both require a real Gemini API call
  (`getProvider(...).runTurn`/`runSummary`) to exercise — deliberately not spent without
  checking with the user first (see the priority list above, item 1).

  **Follow-up, same day**: with the user's explicit go-ahead to spend a small amount of
  real API quota, verified the last two items on the verify-and-fix list this way — set a
  test campaign's `player.hp` to 0 directly in `localStorage` (deterministic: `applyTurn`'s
  `defeated: next.hp <= 0` check needs no cooperation from the model) and sent one real
  turn: `resolveDefeat` fired correctly, restoring HP to 11/28 (exactly `hpMax * 0.4`) and
  narrating a full DESPAIR recovery beat with its own timestamp/location header. Then set
  the same campaign's `turnCount` to 14 and sent one more turn: `isChapterBoundary(15)`
  fired correctly, producing a real "Chapter 1" recap card ("After sustaining a near-fatal
  injury...") alongside the milestone level-up that rides the same boundary. Zero console
  errors on either call. **This closes every remaining item from the verify-and-fix pass
  — nothing outstanding except on-device folder saves, which still needs a human's actual
  click on a native OS picker (§3 above).**

  Also spent a few minutes on this session's priority item 3 (continuing the
  beautification pass to Title/Main Menu, since WorldSetup/NewGame got theirs in the entry
  above but Title/MainMenu hadn't had a dedicated look yet). Walked both live, desktop and
  mobile viewports, all three MainMenu tabs (Tales — including the icon action row on a
  populated card; Worlds; Protagonists) and the seeded Fourth Wing/Violet entries rendering
  correctly. **Found nothing to fix** — both screens already read as clean, consistent with
  the icon-only/glass-panel conventions established elsewhere, matching the overnight
  session's own assessment that these were "already read as clean and intentional." No
  code changes made here; recording the check itself so a future session doesn't re-walk
  the same ground without cause.
- **2026-09-03** — Built the Fantasy Radial Menu (blueprint §6.5, commit `7ec0e36`), the
  last unbuilt Tier 3 backlog item. A FAB (`Wand2`) centered on the Chronicle input tray's
  top edge fans out to Quest Log/Inventory/Character/Settings shortcuts plus a conditional
  Crafting one (only appears while `campaign.crafting` has a queued/ready job), each
  jumping straight into a Codex category via a new `onOpenCodexCategory` prop threaded
  through `App.tsx` (required loosening `codexTarget`'s type so `id` is optional — a
  category-only jump has no entry to preselect). Fan positions are plain trigonometry
  across a 12°-168° upper arc (`RADIAL_RADIUS` 108px in `Chronicle.tsx`) so the fan always
  opens upward, never covering the input tray; collapses on selecting an action or tapping
  a same-layer backdrop one z-index below the fan. Deliberately skipped the blueprint's
  "FAB tints per active turn state" detail — this app's chrome was already and
  deliberately made turn-state-independent everywhere else in an earlier session (fixed
  gold accent throughout, see the "§6.0" chrome comments in `Chronicle.tsx`), and
  reintroducing per-state tinting for just this one control would contradict that
  standing decision rather than extend it.

  **Not verified live** — `npm run typecheck` and `npm run build` are both clean, and the
  implementation was reviewed carefully against already-proven patterns elsewhere in this
  file (the memoized-block pattern, the icon-button convention, `framer-motion`'s stagger
  approach already used for screen transitions in `App.tsx`), but the browser-automation
  tool went fully click-unresponsive partway through this session — see §0's third
  tooling-trap entry for the specifics. This is shipped on code review + a clean build
  only; **a live spot-check is the single most valuable thing a human or a future working
  session could do next** (open Chronicle, tap the FAB, confirm the fan opens correctly
  and each shortcut lands on the right Codex category).

  **Follow-up, same session (commit `bfd8792`)**: the browser tool recovered on its own
  partway through, and the user gave direct visual feedback on the shipped design — too
  large/visually loud, wrong icon. Shrunk both the FAB and fan buttons to 40px (from
  44-48px) and the fan radius to 74px (from 108px), switched the FAB fill from a solid
  gold circle to the same dark-glass style as the fan buttons (much lower visual weight
  at rest), swapped `Wand2` for `Compass`, and added a layered border+glow treatment (a
  thin gold ring at rest via a two-part `box-shadow`, brightening on hover, peaking when
  pressed or while the menu is open) instead of the original flat single border. **This
  time actually verified live**: opened the fan (all 5 shortcuts render correctly,
  Crafting absent since no job was queued, matching the conditional design), confirmed
  the Settings shortcut opens Settings and the Quest Log shortcut opens the Codex at the
  right category. Also fixed two things the user flagged in the same message: Settings'
  HUD Opacity slider was hard-capped at `max="0.9"`, so "100%" in the UI never actually
  produced a fully solid header/footer — raised to `max="1"` and confirmed live (computed
  background resolves to a plain opaque `rgb()`, no residual alpha); and added a small
  pure-CSS ambient sparkle layer (`.chrome-motes`, new `@keyframes chrome-mote-twinkle`
  in `index.css`, respects `prefers-reduced-motion`) inside the header and footer bars
  specifically, since the existing `AmbientBackground` canvas sits behind the chrome
  (z-0) and gets fully masked at high HUD Opacity — it could never provide ambience *on*
  the chrome itself, only in gaps around it. `npm run build` clean.

---

**Everything below is a separate session, home machine, 2026-09-03, picking up after the
office session above — same repo, same `master` branch.**

- **2026-09-03** — Smaller UI feedback batch, each addressed immediately and independently
  of the larger creation-flow work below: made Chronicle's header more vertically compact
  and fixed the Block Navigator's scroll-to offset to account for the shorter-but-still-
  present fixed header (it was scrolling a target block's header line directly behind the
  header, not past it — `scrollBlockIntoView` now offsets by `headerHeight + 16` instead of
  a flat `8`); changed Settings' default HUD Opacity from 50% to 80%
  (`store.ts`'s `loadUiPrefs()`); widened the Tale Dive Brief screen's opening/narration-
  style textareas (`rows={10}`/`rows={6}`, both `resize-y`) since the fields were cramped
  for the amount of text they're meant to hold.
- **2026-09-03** — Requested and planned (via `EnterPlanMode`, approved by the user) a
  6-phase effort covering a 4-screen new-story creation flow plus campaign
  seeding/prologue/streaming. **Phases 1-3 shipped this session** (commits `3e7dcee`,
  `a53ec11`); **phases 4-6 did not** — see §4's new numbered item above for the carried-
  forward plan detail (kept here since the original plan file isn't part of this repo).
  Phase 1 (default `combatMode: 'NARRATIVE'`) and phase 2 (`gender`/`age` fields) were
  small, uneventful, and verified via typecheck/build plus code review. Phase 3 (the
  4-screen restructure: `StoryMode.tsx` and `TaleBrief.tsx` new, `WorldSetup.tsx`/
  `NewGame.tsx` gained preset-save buttons and had their old inline mode toggle/Tale-Dive-
  Brief field moved) hit one real bug caught by console inspection during live testing: a
  `<button>` nested inside another `<button>` in `TaleBrief.tsx`'s combat-mode selector
  (each option's tooltip button was a child of the option's own selection button) — invalid
  HTML that silently broke click handling past that point in the flow. Fixed by
  restructuring each combat-mode option into a non-interactive wrapper `<div>` holding two
  sibling `<button>`s. Verified live end-to-end: Story Mode → World Setup (Save Preset
  confirmed landing in Main Menu's Worlds tab) → Protagonist Setup (same, via
  `upsertProtagonist`) → Tale Dive Brief (tooltips open on tap, textareas take input, Start
  correctly threads `opening`/`combatMode`/`narrationStyle`/`temperature` through to
  `beginCampaign`). Also fixed a stale-closure bug caught by code review before any live
  testing: `beginCampaign` originally tried to read a just-dispatched `setPendingWorld`
  update in the same synchronous handler (React state updates aren't synchronous) — fixed
  by adding a `worldOverride?: Partial<WorldData>` parameter merged directly into the
  locally-constructed `world` object instead of relying on state timing. `npm run
  typecheck`/`npm run build` clean throughout.
- **2026-09-03** — Fixed a real, previously-invisible bug the user reported via an
  annotated screenshot ("the delete button ain't working"), pointing at MainMenu's Delete
  action. Root-caused with `javascript_exec`, not guessed: `window.confirm('test')`
  returned `false` **instantly with no dialog ever shown** in this app's embedded preview
  environment — meaning every `window.confirm()`-gated action in the entire app (Tale/
  World/Protagonist/Codex-entry deletion, Settings' Reset Defaults, Class Evolution's
  manual-trigger save, slash-command deletion — 7 call sites total) had likely been
  silently no-oping for an unknown period, not just the one button the user happened to
  click. Fixed by building `src/lib/useConfirm.tsx` (a `useCallback`+`Promise`-based hook
  returning `{ confirm, dialog }`; the rendered confirm modal's backdrop click calls
  `e.stopPropagation()` deliberately, so it can safely nest inside another modal — e.g.
  `SlashCommandManager` — without a Cancel click bubbling into the host modal's own
  backdrop-close handler) and migrating all 7 call sites in `App.tsx`, `Codex.tsx`, and
  `SlashCommandManager.tsx` to the async `await confirm(...)` pattern (commit `a53ec11`).
  User directly confirmed the fix worked after this shipped ("yes it worked wonderfully").
  Also added, same batch: an Edit button to MainMenu's Worlds/Protagonists tabs (the
  underlying `WorldSetup`/`NewGame` "library" edit mode already existed and worked, just
  had no button anywhere to trigger it — a real, previously-unnoticed UX gap), compacted
  both tabs' rows from tall padded cards to a single-row icon+detail+action layout, and
  brightened the Tales tab's `DashedCard` ("New Story"/"Import Tale") hover treatment per
  separate user feedback (commit `cc1c955`). **Verification note**: end-to-end live click-
  through of every one of these did not fully complete due to the browser-automation
  tool's instability that session (see §0's tooling-trap entries) — shipped on typecheck/
  build plus careful code review for the harder-to-verify paths, disclosed as such in the
  commit messages at the time.
- **2026-09-03** — Title screen redesign, prompted by the user sharing a reference image
  (an AI-generated "book portal" mockup) and asking for "an alternate menu screen we can
  switch to first for this trial" with a real background photo. Built `TitleAlt.tsx` as a
  genuinely separate, toggleable screen first (a new `'titlealt'` Screen union member in
  `App.tsx`, with "Try the alt look"/"Switch to classic look" links on each screen) rather
  than touching the shipping `Title.tsx` directly — deliberate, since this was explicitly
  framed as a trial. Iterated through several rounds of live feedback before promotion:
  (1) first pass included a Worlds/Journal/Profile/Inventory/Achievements button dock
  mirroring the reference image's layout; user then supplied the actual final artwork
  (which already had the wordmark/tagline/dedication baked into the image itself) and said
  to drop every button that doesn't lead to a real screen — cut down to just Dive In +
  Settings. (2) User asked to move the button up (it was covering the artwork's own
  "BETA 0.8 RELEASE" dedication text), make it transparent with bright-gold text/border
  instead of a solid cream fill, glow on press, and add light-particle animation matching
  the artwork, layered **above** the image (an explicit correction after the first particle
  pass was added below/behind by default) — all four addressed in one pass: `mb-14` lift,
  `border-2 border-[#e8ca8a] bg-black/20` with `active:shadow-[...]` glow, and a new
  `.title-sparks` CSS class (22 randomly-positioned rising-ember spans, `z-index` ordered
  between the image/scrim and the buttons). (3) User then said "make this the default...
  remove the old one... clean up the classic one and remove its related files" — at that
  point `TitleAlt.tsx`'s content was moved into `Title.tsx` verbatim (renamed export, drop
  the now-unnecessary "Switch to classic look" link), `TitleAlt.tsx` was deleted outright,
  and every `'titlealt'` reference was removed from `App.tsx` (Screen union, both render
  branches) — grepped afterward to confirm zero stragglers. Pushed as commit `9a0ce8f`.
  Separately, per a forward-looking question about a future rotating/crossfading title
  background ("I might add title-bg1, title-bg2..."), confirmed that numbering convention
  is correct and proactively renamed the current file to `title-bg1.png` (no cycling logic
  built — the user said "might," not "do it now"), then per immediate follow-up moved the
  whole thing into `public/img/` (`title-bg1.png` + an already-uploaded, not-yet-wired
  `title-bg2.png`) — commit `ce63a71`. **Verification**: this session hit a new, milder
  tooling quirk (§0's fourth variant, documented above) where nearly every reported
  `left_click` timeout had, in fact, landed — caught by cross-checking `get_page_text`
  after each reported failure rather than trusting the error or retrying blind. Confirmed
  live: full-bleed layout via direct `getBoundingClientRect()` (not just a screenshot, since
  this session's screenshot capture itself glitched mid-session), 22 spark elements present
  in the DOM, `/img/title-bg1.png` loading with a real `200` (checked via
  `read_network_requests`), and the Dive In button actually navigating to Main Menu.
  `npm run typecheck`/`npm run build` clean at every step.
- **2026-09-03** — Committed and pushed all of the above. Local `master` had diverged from
  `origin/master` (2 local commits vs. 1 remote-only commit — a blueprint-doc-only update
  from the office machine, consistent with this project's multi-machine workflow) —
  reconciled with a plain `git merge origin/master --no-edit` (clean, no conflicts, since
  the remote commit only touched `Tale-Dives-Blueprint-v2_4.md`) rather than a rebase or
  force-push. Final state: `master` and `origin/master` both at `ce63a71`. **Where this
  leaves the project**: creation-flow phases 1-3 and the Title redesign are done and
  pushed; phases 4-6 (campaign seeding, prologue beat, streaming turn rendering — §4's new
  item above) are genuinely unstarted and are the most substantial piece of designed-but-
  not-built work in the project right now. The verify-and-fix and beautification passes
  from the office session remain exactly where that session's log left them — untouched
  this session.
- **2026-09-03** — Follow-up to the Title redesign above, same session: the user asked to
  verify the background actually cycles and to check the mobile/desktop fit, which surfaced
  that cycling had never actually been built yet (only two unwired static image files
  existed) — built it for real this time (commit `2b8f4a5`). Along the way the user
  clarified the real intended convention isn't one image per slot but a **pair**: a
  phone-composed `m_<stem>.png` and a tablet/desktop-composed `pc_<stem>.png`, with `pc_`
  as the always-present default fallback. Renamed the two existing files to
  `m_title-bg1.png`/`pc_title-bg1.png` (one slot, both variants of the same artwork — the
  user hadn't supplied a distinct wide/desktop composition yet, this is a placeholder
  pairing) and rebuilt `Title.tsx`'s background layer around this: `useResponsiveBg(stem)`
  picks `m_` on a `(max-width: 767px)` match, probing it first via `new Image()` and
  silently falling back to `pc_` if that file 404s (so a slot can ship `pc_`-only and still
  work everywhere); a `BackgroundLayer` component wraps that hook per stem so each slot's
  responsive resolution is an independent hook instance (avoids calling hooks inside a
  `.map()`); `CyclingBackground` stacks one `BackgroundLayer` per entry in
  `BACKGROUND_SLOTS` and crossfades between them on a timer — but since `BACKGROUND_SLOTS`
  has exactly one entry today, that timer never starts (`stems.length < 2` guard), so the
  cycler is real, tested-ready code that is currently a no-op by design, not a stub.
  Dropped the earlier `md:bg-contain` letterbox hack from the previous entry entirely —
  once purpose-composed per-breakpoint art exists, `bg-cover` on both variants is the
  right call, no CSS fallback needed.

  **Verified live**: at a 375px-wide viewport, confirmed via direct DOM inspection
  (`el.style.backgroundImage`) that the rendered layer resolves to `m_title-bg1.png`, and a
  screenshot showed the same full-bleed, uncropped-top/bottom rendering as before (only
  minor side-cropping from `bg-cover`, unchanged from the original single-image version).
  At 1440x900, confirmed the same inspection resolves to `pc_title-bg1.png` — but **only
  after a full page reload**, not through the automation tool's live viewport resize
  (`resize_window`) — `matchMedia('(max-width: 767px)').matches` updated correctly, but
  its `'change'` event listener never fired on that resize, meaning `useResponsiveBg`
  never re-ran there. This reads as a limitation of the CDP-driven viewport emulation
  tool specifically (it changes layout metrics without necessarily dispatching every
  event a real OS-level window resize would), not a bug in the hook — a real user's
  browser firing an actual `resize` reliably fires `matchMedia`'s `change` event, a
  standard, well-supported platform guarantee. Flagging this so a future session doesn't
  waste time trying to "fix" `useResponsiveBg` reacting on live automated resize; if it
  ever matters for real users (e.g. a tablet rotated across the breakpoint), verify against
  a real device/browser, not this tool's `resize_window`. Confirmed the pc_ placeholder
  image crops significantly on a 1440px-wide viewport (it's the same 1024×1536 portrait
  aspect as the mobile image, not an actual wide composition) — expected and not a bug;
  will resolve itself once a real desktop-composed `pc_title-bg1.png` replaces the
  placeholder, no code change needed for that. `npm run typecheck`/`npm run build` clean.
- **2026-09-03** — Same-day continuation: second background slot completed (real
  `pc_title-bg2.webp` supplied, not a placeholder) and the crossfade cycler is now live for
  real, not dormant; separately converted all four background images from `.png` to
  `.webp` (~90% smaller, no visible quality loss) and moved images into `public/img/`
  (from a flat `public/` root) per user request — both are pure asset/path changes, no
  logic changes beyond updating the `.webp` extension in `useResponsiveBg`.
- **2026-09-03** — Dive In button, three real bugs found and fixed via live verification,
  each one a case of "looked right in a screenshot, was wrong under inspection":
  1. The gradient-border technique (padding + a "transparent" inner layer) let the
     gradient paint straight through the whole button, not just a thin ring — a plain
     transparent fill doesn't mask what's underneath, it just reveals it. Fixed with
     `mask-composite: exclude` on a dedicated border-only layer (real CSS `border` width,
     not padding — the mask geometry boxes `padding-box`/`border-box` only differ when an
     actual border exists).
  2. Per a follow-up request, changed the button from a pill to a tapered-corner
     (chamfered) rectangle via a shared `clipPath` polygon applied to all three stacked
     layers, and switched `box-shadow` to `drop-shadow` (the former ignores `clip-path`,
     the latter follows it).
  3. Per "the interior should have zero blur/fill at rest, only on hover/press": scoping
     blur to `group-hover`/`group-active` initially left it **stuck on** after unhovering.
     Root cause: Tailwind's `backdrop-blur-none` compiles to an *empty* CSS custom
     property (not an explicit `blur(0)`), and a `transition-all` that includes
     `backdrop-filter` can get stuck trying to interpolate toward that empty value and
     never actually reach it. Fixed by scoping the transition to `box-shadow` only, so
     `backdrop-filter` snaps instantly instead of animating.
  All three verified live via direct `getComputedStyle`/`:hover` inspection, not just
  screenshots (screenshots don't reveal "the whole shape is tinted" vs "just a thin
  border is" reliably at this size). `npm run typecheck`/`npm run build` clean throughout.
- **2026-09-03** — Extracted Title's background-cycling and glass-button code into
  `src/lib/cyclingBackground.tsx` and `src/lib/glassChrome.tsx` (no behavior change — Title
  just imports them now) so Main Menu could reuse them, then rebuilt Main Menu per user
  request: the same cycling background (pinned via `position: fixed` so it stays put while
  the tale/world/protagonist list scrolls, unlike Title which never scrolls and uses the
  cheaper `absolute`), the "TALE DIVES" wordmark/tagline header dropped (the art already
  carries it), and every tab/card/row/icon-button restyled to border-only glass
  (`GLASS_SURFACE`, `GlassIconButton` — transparent fill, thin border, blur) instead of the
  old skin-token `glass-panel`. This retires the light/dark "parchment"/"obsidian" skin
  toggle's relevance on this screen entirely — real photo art behind it makes a light skin
  option meaningless here, so Main Menu now always uses the same hardcoded obsidian-gold
  palette Title and Chronicle already use unconditionally.

  **A real regression, found and fixed while verifying this**: after these changes,
  clicking "Dive In" stopped navigating anywhere. Extensive bisection (see below) proved
  it was **not** actually an app bug: `screen` state updated correctly every time (verified
  by walking the React fiber tree directly), but the DOM never followed — and critically,
  the *exact same* stuck behavior reproduced on the completely untouched, pre-today
  original `Title.tsx` (`git checkout cc1c955 -- src/screens/Title.tsx`), on a fully
  restarted dev server, and on a brand-new browser tab. `tabs_context` reported "the
  Browser pane is currently hidden" throughout — this is the same documented tooling-trap
  family from earlier sessions (§0 above), not a new one, just re-triggered by this
  session's long runtime. **Verified Main Menu's actual code correctness a different way**:
  temporarily changed `App.tsx`'s initial `screen` state to `'mainmenu'` (a one-line,
  fully-reverted diagnostic, not a real change), confirmed the new design renders and its
  local interactions (tab switching) work correctly, then reverted. A brief false alarm
  during this check — the active-tab border looked like it was on the wrong tab in a
  screenshot — turned out to be a misread of a small/busy screenshot; `getComputedStyle`
  confirmed the active-tab class was on the correct button the whole time. **The
  Title→MainMenu click transition itself was never re-confirmed live this session** —
  a human (or a future session, once the tool recovers) should do that one check.
  `npm run typecheck`/`npm run build` clean throughout.
- **2026-09-03** — User reported the background not rendering on the live GitHub Pages
  site (`kemave-arch.github.io/tale-dives/`) despite working fine locally. Root cause:
  `useResponsiveBg` built image paths with a hardcoded leading slash (`/img/...`), which
  resolves from the **domain root** — correct for the dev server (mounted at
  `localhost:5173/`) but wrong for GitHub Pages, which serves this app from the
  `/tale-dives/` **subpath**, so the request actually hit `kemave-arch.github.io/img/...`
  (a real path on someone else's Pages site, or nothing) and 404'd. Fixed by building the
  path off `import.meta.env.BASE_URL` instead, matching how `vite.config.ts`'s
  `base: './'` already handles every Vite-processed asset — confirmed in the actual built
  `dist/assets/*.js` output that the compiled path template is `` `./img/pc_${e}.webp` ``,
  a relative path that resolves correctly under any subpath. **This class of bug — a
  hand-written `url(/...)` or fetch path that bypasses Vite's asset pipeline — will recur
  for any future asset referenced the same way; always build such paths off
  `import.meta.env.BASE_URL`, never a bare leading slash.** `npm run build` clean; the
  user confirmed the live site renders correctly after the next Pages Actions deploy.
- **2026-09-03** — User handed over a 6-item punch list from a blueprint gap-scan and
  chose "cheap wins first." Shipped the Title "Continue" shortcut and the save
  schema-version field in one pass (commit `23eafda`) — see §3/§4 above for the detail.
  Verified live via direct React-fiber state inspection rather than screenshots, since
  the browser tool's screen-transition paint stall (§0's fourth variant) was still active
  this session: confirmed `!continue`'s click correctly drove `screen` to `'chronicle'`
  and `resumeCampaign`'s side effects ran, and confirmed both existing campaigns in
  `localStorage` picked up `schemaVersion: 1` via the new `loadCampaigns` backfill.
- **2026-09-03** — Equipment system (§5.9, commit `817c90d`) — the third item on the same
  punch list, and per the user's own note the highest-value one. Full detail in §3/§4
  above; the short version: items get real name/type/description now instead of a raw
  slug, Weapon/Armor/Accessory can carry a `statBonus` and be equipped via a new
  `!equip`/`!unequip` bang command, and the Codex Items tab was rebuilt from a bare
  inline qty-editor into the same grid-to-detail pattern every other category uses. Two
  design decisions worth flagging for whoever touches this next: (1) equip/unequip is
  deliberately a bang command, not a schema field — it's a deterministic, player-
  initiated action with no narrative ambiguity, so spending a turn on it would be pure
  waste, same reasoning as Summoning; (2) the item Codex (`Campaign.items`) is explicitly
  scoped to the player's own inventory, not a general "every item that exists in the
  world" registry — an NPC's or a shop's items have no representation here at all.
  Verified live end-to-end via direct DOM/localStorage inspection (the same tooling
  caveat as the entry above applies): created a weapon with a stat bonus via Codex CRUD,
  round-tripped Equip/Unequip through both the Codex buttons and the `!equip`/`!unequip`/
  `!items` bang commands typed directly in Chronicle, confirmed derived HP/MP/ST
  recompute correctly on both directions, and found+fixed a real bug along the way
  (`!equip`/`!unequip` had no entry in Chronicle's `BANG_DISPLAY` map, so they rendered
  under the generic "Unclear Reference" label instead of "Equipped"/"Unequipped"). Test
  data (the sample weapon and its bang-command log entries) was cleaned out of the user's
  real `localStorage` save afterward rather than left behind. `npm run typecheck`/
  `npm run build` clean throughout. Next up per the punch list: Skills & the Quick-Slot
  Tray (Ley-Arts explicitly cut — just Skills), then the API Failure Diagnostics Panel,
  Action Suggestion Pills (the `act` schema field already exists and is populated but is
  read nowhere in `src/` — confirmed via grep), and a Codex filters pass.
- **2026-09-03** — Glass-button pass on the shared `GlassCTAButton` (commits `91c5f40`,
  `85b2340`), prompted by the user relaying changes another AI had made to
  `glassChrome.tsx`. Reviewed rather than copied wholesale; adopted most of it, deviated
  on one point, and the other AI's own follow-up analysis independently confirmed the
  deviation was right. What landed:
  - **`TAPER_BORDER_CLIP`** — replaces the old mask-composite ring. This fixed a real
    bug I had shipped: the mask approach builds a ring from *rectangular* border-box
    geometry, so chamfer-clipping it afterward left the four diagonal taper edges with no
    ring drawn on them at all. The user saw exactly that ("now only the top bottom left
    and right are colored"). The replacement is a single `polygon(evenodd, …)` tracing the
    outer tapered outline plus an inner copy inset 1.5px, filling between them — uniform
    thickness across all eight edges.
  - **Frosted hover fill** — `bg-white/0` → 25% on hover, 30% on press, plus blur and the
    gold glow. Ring now renders *after* the fill so the tint can't wash out the border;
    `group-focus-visible:` mirrors hover for keyboard users.
  - **`backdrop-filter` deliberately excluded from the `transition-[…]` list.** Tailwind's
    `backdrop-blur-none` compiles to the keyword `none`, not a numeric `blur(0)`, and
    engines can't interpolate a keyword against a filter function — the blur sticks on
    after the pointer leaves. bg-color and box-shadow still animate; the blur just
    switches instantly, which is imperceptible at 200ms on an element this size.
  **The expensive lesson from this session is in §0's new "hover trap" subsection — read
  it before debugging any hover style.** Short version: the preview pane was stuck in
  touch emulation, `(hover: hover)` was false, and Tailwind gates every `hover:` rule
  behind that media query, so hover was disabled at the CSS level. Verification failed
  100% of the time and convincingly imitated both broken code and a dead input pipeline;
  a five-commit bisect of `Title.tsx`, a dev-server restart, and fresh tabs were all spent
  chasing it. One `matchMedia('(hover: hover)').matches` check answers it instantly.
  After resetting the viewport to `desktop`, hover verified first try with real pointer
  input, both directions: on → white@25% + `blur(12px)` + gold glow; off → transparent /
  `none`, reverting immediately with no stuck blur. `npm run build` clean.

  **Where this leaves things (end-of-session handoff):** `master` == `origin/master` ==
  `85b2340`, working tree clean, nothing uncommitted. The pending list is at the top of
  this file and in §4 item 8 — Skills is next up, and Action Suggestion Pills is the
  cheapest of the four if a short session is all that's available.
- **2026-09-03** — User supplied a real `title-bg3` pair (commit `45884cc`), verified live
  (3-slot rotation confirmed via polling: bg1→bg2→bg3→bg1). Then, per the user asking
  whether dropping files in `public/img/` could "just work" without a code edit each time,
  replaced the hardcoded `BACKGROUND_SLOTS` list with runtime probing (commit `c270b8f`):
  `CyclingBackground` now discovers slots itself by requesting `pc_title-bg<N>.webp` from 1
  upward and stopping at the first failure. Verified this is robust against the dev
  server's SPA-fallback quirk (a genuinely missing file still gets a `200` serving
  `index.html`, not a real 404) — confirmed live that `Image`'s `onerror` still fires
  correctly since fallback HTML isn't decodable as an image, so a phantom `title-bg4`
  was correctly NOT picked up. Both `tale-dives` and `TaleDivesGem` pushed and confirmed
  byte-identical on the changed files (see the new §"How to push to `backup`" note above
  for the cherry-pick workflow used, now that the two repos have diverged).
- **2026-09-03** — Background soundtrack shipped (`4ff2177`). **This entry is written
  retroactively** — the commit landed without a revision-log entry, and the header
  paragraph still claimed `master` was at `c270b8f` for a while afterward. Added
  `src/lib/backgroundMusic.tsx` (`useBackgroundMusic`), mounted once in `App.tsx` so the
  music survives screen navigation, plus a mute toggle on Title next to the Settings gear
  and two real tracks in `public/tracks/`. Track discovery copies the background-art
  convention exactly (probe `ost_<N>.mp3` from 1, stop at the first gap), and the fade
  logic uses `setInterval` rather than `requestAnimationFrame` on purpose — rAF does not
  fire in a hidden document, which had stranded a fade at volume 0 in the preview pane.
  All of that still stands. What did **not** stand is the autoplay assumption baked into
  its comments; see the next entry.
- **2026-09-03** — **The soundtrack was completely silent in production**, and the fix
  plus a small Title/MainMenu control pass landed on branch
  `claude/tale-dives-audio-ui-w6ka4c` (`5a5b455`). ⚠️ **Not merged to `master`, so not
  live** — Pages deploys from `master` only.

  **Diagnosis, and two wrong theories worth not repeating.** The user arrived with an
  analysis from another AI blaming asset paths: that the `<audio>` metadata probe hangs
  and blocks discovery, and that `import.meta.env.BASE_URL` needed trailing-slash
  normalization for the Pages subpath. Both were tested directly and both are false. The
  built `dist/` was served under `/tale-dives/` by a server that emulates Pages properly
  — **real 404s, no SPA fallback**, which matters because the dev server's fallback
  returns `200 index.html` for missing files and masks exactly this class of bug — and
  driven in headless Chromium. Result: discovery completed fine and correctly stopped at
  `ost_3`'s 404; the URL resolved to `/tale-dives/tracks/ost_1.mp3` and was served `200`;
  `readyState` reached 4 (fully decoded). `BASE_URL` compiles to the literal `./`, which
  resolves against the document and is already correct — and already ends in a slash, so
  the proposed normalization is a no-op.

  **The actual bug**: the element sat at `paused: true` after loading, and *stayed* paused
  after clicking unmute. Autoplay had been refused, which rejects a promise silently and
  leaves no other trace, and `toggleMute()` only flipped `.muted` — it never called
  `play()`, so there was nothing to unmute however many times you clicked. The code's own
  comment ("every browser permits muted autoplay") was the false premise. It reproduces
  under Chrome's **default** policy, not only the strict flag. Full write-up, including
  the verification recipe, is in §0's new **muted-autoplay trap** — read that before
  touching audio.

  **What landed:** a `resume()` that restarts playback without rewinding, called from the
  mute toggle (the click is itself the user gesture browsers demand) and from a
  self-removing first-interaction listener for players who never touch the toggle;
  muted autoplay is still attempted, just no longer trusted. The existence probe also got
  a timeout — not the bug, but real hardening, since probes are awaited in sequence and
  one stalled request could otherwise block music forever. UI, per the user's asks: the
  mute toggle now also appears in **Main Menu** beside Settings, with a **"Back to title"**
  button on the left of that same header row (both `GlassIconButton`, so the row reads as
  one set; the tagline truncates so it holds one line at 390px), and Title's **Continue**
  was promoted from a small underlined text link to a full `GlassCTAButton` matching
  **Dive In**, both `w-full` so their widths match despite different label lengths.

  **Verified**, under both the default autoplay policy and
  `--autoplay-policy=document-user-activation-required`: unmute → `paused: false`,
  `muted: false`, **`currentTime` advancing** (the only real proof of playback — screenshots
  cannot confirm sound). Also verified the gesture-elsewhere path (click Dive In → element
  running silently → unmute in Main Menu → audible) and that music survives Main Menu →
  Title navigation. Screenshots confirmed both new layouts at 1280px and 390px.
  `npm run build` (tsc + vite) clean.

  **Where this leaves things (end-of-session handoff):** the branch was fast-forwarded
  into `master` and pushed, which fired the Pages deploy, so the fix is live — nothing is
  left outstanding from this session's own work. The pending feature list at the top of
  this file is **untouched**: Skills is still next up, and Action Suggestion Pills is still
  the cheapest of the four if a short session is all that's available. One optional
  loose end: the `backup` remote (`TaleDivesGem`) has **not** been given these commits —
  use the cherry-pick workflow documented near the top of this file if that repo is still
  being kept in step.
