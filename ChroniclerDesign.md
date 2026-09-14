# ChroniclerDesign.md — Chronicle "Editorial Vellum" Design System

This documents the visual system used by **Chronicle** (`src/screens/Chronicle.tsx`) only. It is a deliberate departure from the rest of the app's dark "Obsidian & Champagne Gold" theme (see `DESIGN.md`) — every other screen (Codex, Settings, Tale Weaver, the creation flow) keeps that theme untouched. Chronicle is scoped separately because it's the screen a player spends the most continuous time reading, and a warm, paper-like reading surface serves that differently than the rest of the app's utility screens do.

Read this before touching Chronicle's visuals again — it records not just the palette but *why* several things the reference mockup suggested were deliberately left out.

---

## 1. Aesthetic Identity

- **Theme:** "Editorial Vellum" — a warm, light parchment reading surface styled after a well-set printed page (illuminated-manuscript adjacent, not game-HUD adjacent), inspired by a reference mockup + design brief supplied for this redesign.
- **Tone:** Calm, literary, unhurried. No glassmorphism, no neon accents, no drop shadows doing the work color and type should be doing.
- **Explicit rule from the brief that drove every decision below:** *lightweight effects, or none* — flat fills and hairline borders instead of `backdrop-blur`; **`backdrop-blur` does not appear anywhere in `Chronicle.tsx`.**

---

## 2. Color Palette

```css
/* Grounds */
--vellum:        #faf8f5;  /* primary reading ground (bg-[#fbf8f3] / #faf8f5, interchangeably close) */
--vellum-dim:    #f5f0e6;  /* header/input-tray backing, secondary panels */
--flax-card:     #f2eee7;  /* (reserved — close cousin of vellum-dim, same family) */
--bone-border:   #ede7dd;  /* hairline dividers, card borders everywhere */
--white-card:    #ffffff;  /* elevated cards (sidebar tiles, popups, drawer) */

/* Ink */
--ink-jet:       #1a1917;  /* primary text, headings */
--ink-prose:     #2c2825;  /* narrative body text specifically (very slightly warmer than ink-jet) */
--ink-stone:     #6c665e;  /* secondary text, captions, muted prose (mood lines, action-card text) */
--ink-subtle:    #9e968b;  /* placeholders, timestamps, disabled */

/* Gold / Ochre — the one accent family, used for every interactive/emphasis cue */
--ochre-press:   #b08830;  /* primary accent — icons, active states, CTA fills */
--ochre-deep:    #8d6b1d;  /* link/label text on vellum (higher contrast than ochre-press for small text) */
--ochre-light:   #ebdcb8;  /* light tint fills (chip backgrounds at ~30-40% opacity) */
--gold-champagne:#dec48e;  /* borders on emphasized cards (chapter milestone, popups) */

/* Functional (unchanged from the app-wide system, still used on vellum) */
--rose:          #b71c1c;  /* vitals/danger, unchanged in spirit from the dark theme's rose */
```

**Rule of thumb:** `ochre-deep` (#8d6b1d) for small text that needs to read as a link/label; `ochre-press` (#b08830) for icons and larger accent fills; `gold-champagne` (#dec48e) for borders on anything that should feel "illuminated" (chapter milestones, popups, the recap card). Never introduce a second accent hue — everything warm-toned routes through this one family.

**Token reuse, not new tokens:** Chronicle does not add new global CSS custom properties for this palette. Every color above is written as a Tailwind arbitrary-value class (`bg-[#f5f0e6]`, `text-[#8d6b1d]`, …) directly in `Chronicle.tsx`, matching how the file already mixed token classes with literal hex before this redesign. The one exception is `.parchment-surface` (`src/index.css`), a pre-existing class that re-points the shared `--td-ink` / `--td-gold-primary` / `--td-gold-accent` / `--td-emerald` / `--td-rose` / `--td-skill` / `--td-state-*` tokens to light-appropriate values — it already existed for the reading pane and now wraps the **entire** Chronicle screen root, so every token-based class from `richText.tsx` (inline lore/item/skill highlights) and `turnStates.ts` (turn-state badge colors) resolves correctly without those files knowing anything changed.

---

## 3. Typography

| Role | Font | Where |
| :--- | :--- | :--- |
| **Display / eyebrows** | `Cinzel` (already a global token, `font-display`) | Header title, chapter milestone label, drop cap |
| **Narrative prose** | `Literata` (new — falls back to `Lora`, then Georgia) | Turn narration, chapter beats, Story So Far text, popup descriptions |
| **UI labels** | `Plus Jakarta Sans` (already global, `font-sans`) | Eyebrow uppercase labels, recap row labels, buttons |
| **Timestamps / mono** | `JetBrains Mono` (already global, `font-mono`) | Turn/Chapter eyebrow, currency, debug tools |

**How Literata is scoped:** `--font-narrative` (the CSS variable `font-narrative` Tailwind classes resolve to) is overridden inside `.parchment-surface` in `src/index.css` to `'Literata', 'Lora', Georgia, serif`. Since that class now wraps the whole Chronicle screen, every `font-narrative` class inside it renders in Literata automatically — no new utility class was needed, and no other screen is affected (`.parchment-surface` is only ever applied inside `Chronicle.tsx`). Literata is loaded via the existing Google Fonts `<link>` in `index.html`.

**Drop cap:** `.editorial-drop-cap` (`src/index.css`) is a `::first-letter` rule in Cinzel at `3rem`, ochre-press colored, floated left. Applied to exactly one paragraph per chapter — see §5.

---

## 4. Layout

- **Mobile:** single column, full-bleed hero banner at the top of the scrollable content, reading column with `pl-4 pr-6` gutters, fixed light header, fixed input tray at the bottom.
- **Desktop (`lg:` and up):** a **Bento-style two-pane layout** — `DesktopLeftSidebar` (character overview / vitals & wealth / equipped gear / tactical combat, each its own white card on a `--vellum-dim` ground) on the left, the parchment reading pane filling the rest. This exists because **the reference mockup has no desktop mode at all** (it's a single mobile-width design) — the sidebar is how the same editorial language extends to a wider viewport instead of just stretching the reading column uncomfortably wide.
- **No glassmorphism anywhere in this screen.** Cards are flat fills (`white` or `--vellum-dim`) with a 1px `--bone-border` border and, at most, a soft `shadow-sm`. Modals use a plain `bg-black/50` scrim with no blur.

---

## 5. Components

### Hero Banner (location presentation)
Full-bleed image (the current location's generated art, when one exists) at the top of the scroll content, `220–280px` tall, `object-cover`. A gradient (`rgba(vellum,0) → rgba(vellum,0.55) → vellum`) fades it into the reading ground rather than tinting the whole page behind every turn (the pre-redesign approach). A small bottom-overlay badge shows the location name (left, with an ochre dot) and Day/time (right). No image → no hero renders at all; the ground is just flat vellum.

### NPC Presence (graphic NPC presentation)
Present-NPC portraits render as small (48px) circular medallions with a champagne-gold ring, each with the NPC's name in a tiny caption underneath, in a horizontal row just above the reading column. **Deliberately not** a "character voice plate" with a fabricated attributed quote (the mockup's card-with-dialogue treatment) — the turn data has no structured per-line speaker attribution, so inventing one would be presenting fiction as fact. This is "their photo, inline, then the narration" — nothing more — per direct instruction.

### Turn Eyebrow (context presentation)
`Turn {n} · Chapter {m}` on the left (mono, uppercase, ink-subtle), parsed from the real `LogEntry.turnRef` string (`"C{chapter}-{block}"`) — not fabricated per-turn titles. The current location name repeats on the right. Falls back to the older plain `D-xx location` timestamp format for a log entry from before `turnRef` existed.

### Chapter-Opener Drop Cap
Applied only to the first narrated turn following a chapter boundary (the log's own start, or the entry right after a `chapterBeats`/`chapterSummary` synthetic entry) — computed in the parent map, passed down as `isChapterOpener`. Not applied to every turn, unlike a literal reading of the mockup's single-example screenshot — a drop cap on every one of twenty stacked turns in a scrolling log would read as visual noise, not illumination.

### End of Turn Recap (`TurnRecapAccordion`)
A collapsed-by-default accordion — "— End of Turn N · Recap ▾ —" as a centered pill between two hairlines — expanding into a **single-column dossier list**: one row per kind of delta the turn actually produced (icon, small uppercase label, value), built only from real `LogEntry` fields (`levelUp`, `classEvolution`, `discoveries`, `eventsActivated`, `craftReady`, `minionsDissipated`). Renders nothing at all — no toggle, no empty affordance — when a turn produced zero such facts.

This is intentionally **not** the reference mockup's fixed 2-column grid of four hardcoded categories ("Narrative State / Companion Bond / Dragon Attunement / Codex Catalogued"): those are fixed slots that would have to be padded with filler prose on a turn that didn't actually produce four kinds of news, and two of them (Companion Bond phrasing, Dragon Attunement percentage) are flavor specific to the mockup's own Fourth Wing example, not real state this game tracks generically. The dossier-list approach is never longer or emptier than what's true.

`entry.ending` (the Tale Concludes banner) stays outside the accordion, always visible — an ending is dramatic enough that it shouldn't be one tap away from invisible.

### Inline Lore/Item/Skill Highlights
Untouched — `src/lib/richText.tsx` was deliberately not modified. Its `text-gold-primary` / `text-skill` / `text-ink-muted` classes are token-based and already resolve to legible values once `.parchment-surface` wraps the whole screen (see §2's token-reuse note).

### System Copy
Plain, universally-understood labels — never in-fiction/roleplay flavor language for system chrome. E.g. "Request Failed" (not "Fate Thread Faltered"), "Generating..." (not "The thread of fate is being woven..."), "No turns yet. Type an action below to begin." The one screen-specific exception, `ApiErrorPanel`, keeps its own fixed dark palette regardless of the skin around it (a pre-existing, still-valid decision — see its own comment in `Chronicle.tsx`).

---

## 6. What Was Deliberately Left Out

Per direct feedback during this redesign, the following mockup ideas were **not** built — noted here so a future pass doesn't have to rediscover why:

- **Tap-to-inspect image lightbox** (full-screen zoom on the hero image or a popup portrait). Not implemented anywhere yet — a real gap if a future pass wants it, not an oversight to leave alone.
- **A persistent bottom tab bar** (Story/Chronicle/Codex/Weaver) — this app navigates via the existing header icons + a slide-up drawer, not a mockup-style tab bar; out of scope for a Chronicle-only visual pass.
- **A font-size scaler (A-/A+)** in the header.
- **NPC dialogue "voice plate" cards** with attributed quotes (see §5, NPC Presence).

---

## 7. Scope Boundary

Everything above applies to `src/screens/Chronicle.tsx` and the two shared files it touches (`src/index.css`'s `.parchment-surface`/`.editorial-drop-cap`/`.turn-glow`/`.turn-nav` rules, `index.html`'s font `<link>`). It does **not** apply to Codex, Settings, Tale Weaver, or any creation-flow screen — those remain exactly as documented in `DESIGN.md`. If a future task extends this look to another screen, update both documents rather than letting them drift out of sync about which screen uses which system.
