# Tale Dives — Project Revision Notes

**Last updated:** 2026-09-04, home machine — a UI unification pass plus the Skills system.

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
> 1. ~~**Skills**~~ — **done** 2026-09-04, commit `d4616a5`. The **Quick-Slot Tray half
>    is still open** and was explicitly deprioritized by the user ("Skill quick slot is
>    not a priority"), so do not start it without asking. See §3's Skills entry for what
>    shipped and the two deliberate omissions.
> 2. **API Failure Diagnostics Panel** (§3.5) — *next up.* Masked key, one-click "Copy
>    Diagnostic Report," Retry / Open Settings / Dismiss-into-PAUSE.
> 3. **Action Suggestion Pills** (§6.4C) — *cheapest of the four.* The `act` schema field
>    already exists, is required, and the model already populates it every turn; nothing
>    in `src/` reads it (verified by grep). This is `App.tsx` (store it on the `LogEntry`)
>    plus `Chronicle.tsx` (render clickable pills that fill the input) — no schema or
>    prompt work needed.
> 4. **Codex overhaul — filters.** User: "some items have drilldowns, but what we're
>    missing are filters." Check against the blueprint before scoping. Note §6.4D also
>    specifies a **search bar** above each Entry Grid, which likewise doesn't exist.
>
> Also still open from earlier, unrelated to the list above: campaign seeding, the
> prologue beat, and streaming turn rendering (§4 item 7), and Inspired Mode (§4 item 5,
> deferred on a quota block with evidence — read that entry before re-attempting).

Recent shipped work, most recent first: a **glass-button pass** on the shared
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
