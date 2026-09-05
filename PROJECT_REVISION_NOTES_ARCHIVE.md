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

---

## Archived forward from PROJECT_REVISION_NOTES.md on 2026-09-05

The main file's own log section grew past ~2,300 lines again — everything below
was its "Last updated" stack (most recent first) plus its own prior
"Full revision history" batch (the 2026-09-04 entries), moved here verbatim,
unedited, per this archive's own standing instruction above. `PROJECT_REVISION_NOTES.md`
now carries only the current-state reference sections and a fresh, empty log.

# Tale Dives — Project Revision Notes

**Last updated:** 2026-09-05, Claude Code on the web — three small requests
addressed in one pass:
1. Confirmed debug tools and JSON export/import need no changes for the XML
   migration: `backup.ts`'s `downloadJSON`/`saveJSON`/`readJSONFile` serialize
   the whole campaign object generically (`rawPayload` is just an opaque
   string field inside it either way), and `Chronicle.tsx`'s debug payload
   view already displays `rawPayload` as plain text regardless of format. The
   only spot that ever parsed it as JSON specifically (`patchNarInRawPayload`)
   was already fixed with dual-format handling during the migration itself.
2. `Title.tsx`: renamed the primary CTA from "Dive In" to "START" (button
   label, plus the matching help text in `Settings.tsx`'s Debug Mode
   description — left unrelated "dive in" prose elsewhere, e.g. TaleBrief's
   "Where do you dive in?" field label, alone since that's a different concept).
3. `Title.tsx`: both START and Continue now call `document.documentElement
   .requestFullscreen()` (best-effort, `?.().catch(() => {})`) synchronously
   inside their click handlers before anything else runs — the Fullscreen API
   only honors a request made directly off a user gesture, so for START this
   has to happen before the 4-second gaze-delay branch, not inside the
   `setTimeout` callback that follows it.

Verified: `npm run typecheck`/`npm run build` clean; live Playwright check
against the real dev server confirmed the button renders "START" (not "Dive
In"), `document.fullscreenElement` is set immediately after a click, and
navigation past the title screen still proceeds normally.

**Last updated:** 2026-09-05, Claude Code on the web — "Climax Overflow": a
turn carrying a `class_evolution`, a completed quest, or a major kill is now
allowed to exceed the player's chosen Prose Depth, not just reach it.
- `turnContract.ts` rule 2a (new, right after rule 2/Length): tells the model
  those three markers lift Prose Depth's target from a ceiling to a floor for
  that turn only — explicitly scoped as the exception, not license to pad an
  ordinary turn.
- A prompt instruction alone can't make that real, since each Prose Depth tier
  also carries its own hard `maxOutputTokens` API ceiling (CONCISE 1280,
  BALANCED 2048, IMMERSIVE 6144) — telling the model to write longer without
  raising that ceiling just produces mid-sentence truncation, the same
  lesson from this session's earlier truncation-bug fix. Added
  `MIN_TURN_OUTPUT_CEILING = PROSE_DEPTHS.IMMERSIVE.maxOutputTokens` and had
  both `App.tsx` `runTurn` call sites take
  `Math.max(depth.maxOutputTokens, MIN_TURN_OUTPUT_CEILING)` instead of the
  bare per-depth value, so a CONCISE or BALANCED player's own climax moment
  gets the same generous ceiling an IMMERSIVE player's ordinary turn already
  has, regardless of which depth they picked. Reuses IMMERSIVE's own tuned
  number rather than inventing a new one.
- Verified: `npm run typecheck`/`npm run build` clean; unit-checked the
  `Math.max` wiring directly against all three tiers (CONCISE/BALANCED/
  IMMERSIVE all correctly floor to 6144).

**Last updated:** 2026-09-05, Claude Code on the web — migrated the live turn
pipeline off JSON-schema structured output onto the XML prototype from
earlier this session, per the user's explicit go-ahead ("go with the XML
migration... overhaul the whole thing in the app"). This is now what the app
actually runs, not a side prototype:
- `gemini.ts`'s `runTurn` no longer sends `responseMimeType`/`responseSchema`
  — `system_instruction` is `buildXmlSystemInstructions()` (the real
  narrative rules, unchanged, plus the XML `<sync>` grammar), and the
  response is parsed with `parseXmlTurnResponse` instead of `JSON.parse`.
  Kept the same 3-stage self-healing shape: sanitize (strip ```xml fences)
  → parse → a Stage 3 fallback (`extractXmlNarrative`) that pulls whatever
  prose made it into `<nar>` even if `<sync>` is broken or the response was
  cut off mid-generation by MAX_TOKENS before the closing tag arrived.
- **Item markup moved from `>Item<` to `[[Item]]`** (`richText.tsx`,
  `turnContract.ts` rule 6, `xmlTurnContract.ts`) — this was the collision
  flagged earlier in the session: a literal `>`/`<` in narration is a genuine
  parse hazard now that the model's raw output also carries real XML tags.
  `[[Double brackets]]` never collide with XML and sit naturally alongside
  the existing `[Skill]` single-bracket convention; the double-bracket
  alternative has to come first in `richText.tsx`'s regex alternation or
  `[Skill]`'s pattern would wrongly eat into `[[Item`'s second bracket.
- **Compacted the grammar further** per explicit request: merged
  `inv_add`/`inv_rem` into one `<item>` tag (`rem="1"` signals removal).
  Deliberately did NOT chase cryptic 2-3 letter tag names beyond that — the
  measured ~25% saving came from switching JSON `key:"value"` to XML
  `attribute="value"`, not from shaving tag-name characters, and unlike a
  verified token count, "shorter tag = fewer tokens" for names this short
  isn't something this session could verify at all, while raising real
  correctness risk (the model has to hold more cryptic mnemonics exactly
  right). Documented that reasoning in `xmlTurnContract.ts` rather than
  silently ignoring the request.
- **Found and fixed a real bug during this pass**: `<nar>` is deliberately
  extracted with a raw regex (not run through the XML parser) so a
  MAX_TOKENS-truncated response still yields partial prose — but that means
  it never gets entity-decoded the way `<sync>`'s real XML attributes do.
  Without a fix, a model-escaped `&amp;` would have shown up as literal
  "&amp;" text to the player. Added `decodeXmlEntities` (handles the 5
  predefined XML entities plus numeric character references) and applied it
  to both the main parse path and the fallback extractor.
- `App.tsx`'s Edit Turn CRUD (`patchNarInRawPayload`) now tries the XML
  `<nar>...</nar>` pattern first, falling back to the old JSON-parse logic
  — so a save with turns from before this migration can still be edited.
  Chronicle.tsx needed no changes at all: its debug payload view just
  displays `rawPayload` as plain text, format-agnostic already.
- Also caught a real bug in my own edit: writing `` `>Item<` `` (backticks)
  inside `turnContract.ts`'s outer template-literal string terminated that
  string early, corrupting the rest of the file into a cascade of unrelated
  syntax errors — a good reminder that a large prompt-text string is still
  live code, not inert content.
- **Live-verified the complete pipeline**, not just the parser in isolation:
  intercepted the actual `generateContent` network call (Playwright
  `page.route`, matching `**:generateContent` — the real endpoint uses
  `MODEL:generateContent`, colon not slash, which the first attempt at this
  pattern missed) with a realistic XML response, seeded a campaign, and
  submitted a real player action through the live UI. Confirmed: HP/ST/
  copper deltas applied correctly, an item acquired AND a different item
  removed in the same turn via the merged `<item>` tag, NPC trust/memory/
  held-weapon updated, a world flag added, turn state and mood rendered
  correctly, and — visually — `[[Item]]` and `{{Term|npc}}` render exactly
  like they always did (icon-decorated italic gold / tappable underline)
  with zero stray raw markup leaking into the display. No live Gemini API
  key is available in this environment, so this is the most rigorous
  verification possible here short of a real model call; a real-world
  session is still the final proof once the user plays with it.
- Not done, and deliberately out of scope for this pass: the "Novel App Tier
  Architecture" (a 3-tier prose-length/paragraph-template system) the user
  also surfaced from a chat session — see this session's actual response for
  why it wasn't adopted as proposed (mostly duplicates this app's existing
  Prose Depth mechanism, and its rigid fixed-paragraph template would cut
  against the per-turn-state craft directions already in place).

**Last updated:** 2026-09-05, Claude Code on the web — a "Gemini Runtime XML
Manual" the user got from a chat session claimed a full XML rewrite of Tale
Dives (a fabricated 4-tier currency ladder, a buff/debuff system that doesn't
exist, a bestiary rank ladder, "IndexedDB JIT retrieval") would save massive
tokens — verified line-by-line against the real codebase and found mostly
invented (checked: `Player.copper` is one denomination not four; `ItemEntry`
does track rarity, contradicting the doc's claim it doesn't; no buff/debuff
system exists anywhere in `types.ts`; state persists via plain `localStorage`,
not IndexedDB). A follow-up "AI Studio tokenizer comparison" table (claiming
Gemini/Claude/GPT-4o/GPT-4 counts side by side) was also mostly fabricated —
Google's AI Studio has no access to Anthropic's or OpenAI's tokenizers, so a
cross-vendor table can't be real, and re-counting the actual characters/words
of the sample snippets against the table's own numbers showed 20-30%
discrepancies on two of the four rows. The user then re-measured for real
using AI Studio's actual live token counter (one snippet at a time, no
comparison-table framing) and got genuine numbers — coincidentally matching
the earlier table's Gemini-only column exactly, meaning that specific column
was likely real all along (Gemini can honestly self-report its own token
count; it just can't know a competitor's). Real result: JSON turn output
~396 tokens vs. an equivalent compact-XML output ~298 tokens — a genuine
~25% reduction; the input context side only saved ~2%.

Given a real, verified ~25% output-token saving, built a **prototype** (not
wired into the live pipeline) to test the idea properly rather than
theorize further: `src/api/xmlTurnContract.ts` (a compact `<sync>` XML
grammar mirroring every real `TurnResponse` field — no invented currency/
buff/bestiary mechanics, reusing `SYSTEM_INSTRUCTIONS`'s narrative rules
completely unchanged) and `src/lib/xmlTurnParser.ts` (parses that XML back
into the exact same `TurnResponse` shape `applyTurn`/`App.tsx` already
consume, so nothing downstream needs to change). Deliberately keeps `<nar>`
as plain prose with the existing markup unchanged ({{Term|cat}}, [Skill],
>Item<, 'thought') rather than also XML-tagging inline narration — the
`>Item<` convention's literal angle brackets would be a genuine parse hazard
next to real `<tag>` markup, and the manual's own inline-tagging didn't
account for that collision. All of the measured savings come from the
*mechanical* fields anyway, which is exactly what the new grammar replaces.
Live-verified: fed the parser two hand-authored XML samples (one matching
the "Kaelen/cider" scenario at moderate complexity, one a "kitchen sink"
sample exercising nearly every field — combat deltas, multi-item loot,
corpses, a stat grant, quest completion, two NPC updates including a new
held-weapon field, a rare class evolution, faction rep on two factions, and
a learned skill) and confirmed both parse into exactly the same shape the
JSON path already produces. Not yet done: a real round-trip test against
actual Gemini-generated XML (only hand-authored fixtures so far) — next
step is to hand the user the real system-instruction grammar to test live in
AI Studio, then run whatever Gemini actually outputs back through this same
parser as the final proof before considering wiring it into the live app.

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


