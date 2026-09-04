# Tale Dives — Project Revision Notes

**Last updated:** 2026-09-04, Claude Code on the web — a reusable long-text expand-to-edit
modal, wired into every long textarea in the app (see the new entry at the bottom of
this file's log). Previous entry below is from a home-machine session (UI unification
pass plus the Skills system).

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
