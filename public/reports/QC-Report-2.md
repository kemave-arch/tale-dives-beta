# Tale Dives — Live QC Pass #2 Report

**Date:** 2026-09-14
**Focus:** Item generation/handling, skill generation/handling, Codex Discovery (fog of war) reveal mechanics, plus a deliberate `*asterisk*`-override stress test for duplicates and a nickname/alias check.
**Continues the same Fourth Wing / Violet Sorrengail test Tale from Pass #1**, with added context: Lilith Sorrengail's tough-love motive and her secret request to Xaden to protect Violet, injected as each NPC's `secretTruth` (the same field the app already uses for this exact purpose).
**Models used:** `gemini-3.5-flash` (a few calls, until its free-tier daily quota was hit again), `gemini-3.5-flash-lite` (the full 20-turn override pass — all 20 turns completed successfully).
**Full transcripts:** `qc-turns2-transcript.json` (item/skill/context turns), `qc-turns3-transcript.json` (the 20-turn override pass)

## Fixes applied (typecheck + build verified clean after each)

### 1. Fog-of-war reveals were architecturally impossible for Tale-Weaving hidden entries
Pass #1 added `hidden`/`teaser` support for Locations/Factions/NPCs, copying Lore's existing pattern — but that pattern hardcodes `revealTrigger: 'manual'`, and `lib/discovery.ts`'s `matchesReveal()` never auto-resolves a `'manual'` trigger (only actual Codex CRUD can). So every hidden entry Tale Weaving creates — lore included — could *only* ever be revealed by the player manually editing it in the Codex, never by playing the story forward.

**Fixed:** added optional `reveal_trigger`/`reveal_cond` (`flag`/`location_visit`/`npc_met`) to the grammar, parser, and Campaign-assembly for all four hidden-capable categories, with `'manual'` staying the default when omitted. Deliberately excluded `quest_complete` — `Campaign.quests` is always empty at Tale Weaving time, so a quest-gated reveal would resolve itself open to "known" the instant the Tale begins. Also restructured the Campaign-assembly to resolve all reveal conditions in one pass *after* every category is fully built, so a reveal condition naming an entity from a category built later in the function (e.g. a hidden Location naming an NPC) validates correctly instead of failing open on build-order alone.

### 2. Deeper finding from live testing: `npc_met`/`location_visit` can't reveal one hidden thing via another
Seeded a live test — gave the already-hidden NPC "Tairnageon" (the dragon, from Pass #1) a real `revealTrigger: 'npc_met'` — then ran a turn where the player's own action directly named him ("*Tairn's mind brushes against mine, unbidden*"). The narration was excellent (see transcript), but **the reveal never fired**: the model never emitted an `<npc id="tairnageon">` update tag for the encounter at all.

Root cause: a hidden entity's id is never shown to the model in the first place (the same "a dormant thing is invisible to you" design already used for Narrative Events) — so even when the player's own words name the entity, the model has no way to know that maps to the Codex id `tairnageon` specifically, and can't cite an id it was never told exists. This makes `npc_met`/`location_visit` reveal conditions **fundamentally unable to gate on another hidden entity** — they only work when the target is already known. Documented this directly in the grammar's rule text (a hidden entry's reveal condition must name something *not itself hidden*, or use `flag` instead) rather than leaving it as a silent dead end.

### 3. Item id drift silently breaks inventory removal
Live-caught, not hypothetical: the model added `healing_draught` (singular) via `inv_add`, then one turn later tried to remove it via `inv_rem id="healing_draughts"` (plural) — a small, easy id slip. The old exact-match-only lookup in `lib/inventory.ts` silently no-ops on a miss (`if (!item.id || !nextInventory[item.id]) continue`), so **the player's healing-draught count never actually decreased** even though the narration said they drank one — no error, no visible sign anything went wrong, just a quietly wrong inventory count from then on.

**Fixed:** `applyInventoryChanges`'s removal path now tries the id as given, then its plural-or-singular counterpart against what's actually in the inventory, before giving up — the same "self-healing over silent failure" spirit as `lib/codex.ts`'s existing fuzzy dedup guard for locations.

## What worked well (no changes needed)

- **Item pickup**: "*I already have three healing draughts*" correctly produced one `inv_add` with `qty: 3` (not three separate entries or a duplicate id) — quantity claims via override are handled correctly.
- **Skill duplicate handling**: teaching "the exact same Iron Grip technique again, as if for the first time" correctly produced **no** second `skill_learn` — the model recognized the skill was already known and didn't re-emit it, matching Rule 8a's intent without needing any code change.
- **Nicknames/aliases — tested live, no bug found**: player action text used "Vi" (for Violet) and "Riorson" (for Xaden) casually; the model's actual `{{Term|npc}}` tags stayed on the full canonical names (`{{Mira Sorrengail|npc}}`, `{{Xaden Riorson|npc}}`) every time — no duplicate or drifted id was ever created from a nickname. **Recommendation: don't add a dedicated `aliases` field** — the existing "reuse the exact established name/id in every tag" rule (2b) already covers this, and this pass found no case where it didn't. Add the field only if a future pass actually catches a nickname-driven duplicate.
- **Faction-reveal-via-narration (a real UX gap, not a bug)**: the player discovered hidden sigils proving "The Revolutionaries" operate inside Basgiath — genuinely well-written, tense prose — but since that faction's `hidden` entry (created in Pass #1) was never given a `reveal_trigger`, it correctly stayed hidden in the Codex per current design. This surfaces a real, separate gap worth a future look: **there's no equivalent of Narrative Events' `<event_trip>` for Codex Discovery** — no way for the model to explicitly say "this specific hidden thing was just revealed in the story" on an ordinary turn. Right now a hidden entry only ever updates via the four structural triggers (and, per finding #2, `npc_met`/`location_visit` only work against already-known targets) — an explicit `<reveal id="..." category="...">`-style tag, mirroring `event_trip`, would close this gap. Flagging as a recommendation, not implemented in this pass.
- **Death/injury handling, quest tracking, prose quality**: all consistent with Pass #1's findings — no new issues.

## Recommended follow-ups (not done in this pass)
- Consider an explicit "reveal this hidden Codex entry now" tag for the model (see finding above) — the more reliable long-term fix for story-driven fog-of-war reveals, beyond what `flag` alone can cover gracefully.
- Re-verify Turn 0-style prologue parsing and a genuine `npc_met` reveal (against an *already-known* target this time) once quota allows a longer uninterrupted run.
