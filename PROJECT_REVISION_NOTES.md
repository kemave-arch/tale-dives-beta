# Tale Dives — Project Revision Notes

**Last updated:** 2026-09-05, Claude Code on the web — archived this file's
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
slicing), `shadowReferee.ts` (client-side validation of model-proposed deltas), `xmlTurnParser.ts` (DOMParser + regex fallback parser for `<nar>` and `<sync>` XML turn responses), `codex.ts` + `keywordLinks.ts` (`{{Term|category}}` auto-registration and deduplication), `locations.ts` (tracks `firstVisitedTime`/`lastVisitedTime`), `npcs.ts` (tracks `heldWeapon`, `wornArmor`, `firstSeenTime`/`lastSeenTime`),
`quests.ts`, `inventory.ts` (item Codex + qty ledger, `equipItem`/`unequipSlot`), `combat.ts` (Tactical combat math), `leveling.ts` (milestone leveling + chapter boundaries), `bangCommands.ts` (`!` client-side commands), `discovery.ts` (§5.12 Codex Discovery reveal checks), `crafting.ts` + `gameTime.ts` (§5.8 Crafting queue resolution + GameTime arithmetic), `summoning.ts` (§5.3 Summoning/Minion engine), `factions.ts` (§5.4/§5.11 rivalry + derived standing), `skills.ts` (affordability and skill learning), `fsAccess.ts` (§6.4B File System Access API wrapper), `useConfirm.tsx` (in-app confirm modal), `useLongTextEditor.tsx` (auto-expanding modal for long textareas), `cyclingBackground.tsx` (responsive background-slot crossfader), `backgroundMusic.tsx` (ambient rotation + `ts-<state>_` turn-state pools with crossfader, mute toggle), `glassChrome.tsx` (shared border-only glassmorphism components), `currency.ts`, `derivedStats.ts`, `richText.tsx` (inline markup: `[Skill]`, `[[Item]]`, `'thought'`, `{{Term|cat}}`), `slug.ts`, `autoRegister.ts`, `turnStates.ts`, `backup.ts` (`saveJSON`, folder-aware).

**API** (`src/api/`): `turnContract.ts` (system prompt + narrative rules), `xmlTurnContract.ts` (XML grammar definition for `<sync>` tags/attributes), `providers/types.ts` (the `Provider` interface), `providers/index.ts` (the provider registry), `providers/gemini.ts` (Gemini provider implementing `runTurn` with XML instructions and parser, plus `runSummary`).

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
9. **API Failure Diagnostics Panel** — Replace generic error alert banner with a dedicated, polished error modal (masked API key, one-click copyable diagnostic report, Retry / Open Settings actions).
10. **Campaign Seeding & Streaming Turn Rendering** — Deferred creation-flow enhancements (Phase 4-6) to be scoped once the current gameplay loop settles.

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
