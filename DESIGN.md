# DESIGN.md — Tale Dives Design System & UI Specifications

This document outlines the visual identity, typography, color palette, layout constraints, and component architecture for **Tale Dives**. Use these rules when designing or generating UI components to ensure total consistency with the application's aesthetic and performance standards.

---

## 1. Aesthetic Identity & Persona
**Tale Dives** is an immersive fantasy novel game driven by an LLM narrator. Its visual identity balances the intimate atmosphere of a classic leather-bound fantasy tome with the sleek ergonomics of a modern dark-glass game interface.

- **Theme:** Single unified dark-glass aesthetic ("Obsidian & Champagne Gold"). No light theme or selectable visual skins.
- **Atmosphere:** Deep, moody, high-contrast, and eye-safe for long reading sessions.
- **Tone:** Literate, mysterious, and refined — avoids arcade "gamified" badges, floating damage numbers, or bright rainbow saturated accents.

---

## 2. Canvas Grounds & Surface Hierarchy

The application employs two surface ground modes:

1. **`"art"` Ground (Immersive / Atmospheric):**
   - **Used on:** Title, Main Menu, Story Mode, World Setup, Protagonist Setup, Tale Brief.
   - **Characteristics:** Full-screen cycling background wallpaper (`pc_title-bg<N>.webp`), dark scrim overlay for legibility, full `backdrop-blur` glassmorphic panels (`.glass-panel`).

2. **`"dark"` Ground (Data-Dense / Reading Focus):**
   - **Used on:** Chronicle (Parchment View), Codex, Tale Weaver, Settings.
   - **Characteristics:** Flat, semi-opaque obsidian surfaces (`#121520` / `#161a28`). Avoids heavy background artwork and full blur transparency behind dense text grids to maximize reading legibility and frame rates.

---

## 3. Color Palette & Tokens

```css
/* Core Color Tokens */
--bg-obsidian:     #0d1017; /* Deepest canvas background */
--panel-dark:      #121520; /* Primary card & modal container backing */
--panel-subcard:   #161a28; /* Sub-card, field, & input container backing */

/* Gold & Champagne Accents */
--gold-primary:    #d4af37; /* Primary action text, headings, active states */
--gold-accent:     #e8ca8a; /* Soft borders, secondary highlights, icons */
--gold-champagne:  #f7e7ce; /* Gradient highlight for 'Premium' actions */

/* Typography Ink Colors */
--ink-primary:     #f4eedd; /* Main narrative prose text (high contrast AA+) */
--ink-muted:       #a1a1aa; /* Secondary subtitles, metadata, field labels */

/* Functional Accents */
--color-emerald:   #10b981; /* Affirmative states, victory conditions, positive deltas */
--color-rose:      #f43f5e; /* Warnings, permadeath rules, destructive triggers */
```

---

## 4. Typography System

Tale Dives uses a harmonized **three-font system**:

| Role | Font Family | Usage |
| :--- | :--- | :--- |
| **Headers & Titles** | `Cinzel` (Serif) | Screen headings, campaign titles, turn state badges, button labels. |
| **Narrative Prose** | `Lora` (Serif, 400/500/Italic) | Story text, NPC dialogue, campaign lore, Tale Weaver descriptions. |
| **Player Inputs** | `Plus Jakarta Sans` (Sans) | Textarea input fields, search bars, guidance input boxes. |
| **Metadata & Code** | `JetBrains Mono` (Monospace) | Timestamps, day/time counters, currency, system status codes. |

---

## 5. UI Layout & Viewport Rules

- **Mobile-First & Game Viewport:**
  - Designed mobile-first for touch screens (minimum 44px touch targets).
  - Fixed viewport height (`100dvh`) with `overscroll-behavior: none` on the body — background scrolling or panning on touch drag is strictly disabled.
  - Scrollbars are hidden globally except inside long textareas and the Parchment reading view.
- **PC & Wide-Display Discipline:**
  - Main interactive screens (Tale Weaver, Codex, Settings) are constrained to `max-w-4xl` or `max-w-5xl` and centered (`mx-auto`).
  - Text input areas and action buttons must never stretch unconstrained across ultra-wide monitors.

---

## 6. Shared Component Reference (`src/lib/glassChrome.tsx`)

When co-designing new UI surfaces, always compose from the existing `glassChrome.tsx` primitive library:

- **`GlassScreen`**: Root screen wrapper taking `ground="art" | "dark"`.
- **`GlassHeader`**: Top navigation bar with title, subtitle, and back chevron.
- **`GlassCTAButton`**: Primary glowing gold action trigger.
- **`GlassButton`**: Secondary icon or text button.
- **`GlassSegmented` / `GlassTabs`**: Horizontal tab selectors for multi-step or filtered views.
- **`GlassField`**: Labelled input or textarea container.

---

## 7. Performance & Graphics Mode Compatibility

- **Two-Mode Graphics System:**
  - **Glass Mode:** Renders backdrop blurs and subtle reflections.
  - **Performance Mode (Default):** Replaces `backdrop-filter` with solid/opaque glass fallbacks using CSS inset shadows and subtle gradients.
- **Rule for New Components:**
  All new containers must use `.glass-panel` or `#161a28` solid backing rather than hand-rolled `backdrop-blur-xl` classes to ensure high frame rates on mobile GPUs.

---

## 8. Prose vs. UI Formatting Rules

- **Narrative Text:** Read like a fantasy novel. Use *italics* for monologue/emphasis and standard quotation marks for dialogue. Colored badges belong exclusively in UI chrome outside prose blocks.
- **Inline Entity Highlights:** The client automatically renders `[Skill]` (gold), `[[Item]]` (emerald/purple), `'thought'` (italic gold), and `{{Term|category}}` (interactive codex popup links) within story text.
