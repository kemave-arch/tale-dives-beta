# Tale Dives — Live QC Pass #4 Report

**Date:** 2026-09-14
**Focus:** Newly-implemented turn-by-turn Region/Location/Area logic — surfacing a location's own named sub-areas and known regions/coordinates to the narrator every turn, letting the model move the player between (or discover new) sub-areas, and letting a genuinely new location introduced mid-play get a real region + map coordinates instead of always defaulting to `region: 'Unmapped'`.
**Continues the same Fourth Wing / Violet Sorrengail test Tale** (loaded from `qc3-campaign-after-turn-19.json`, which already carries 6 pre-authored locations across 2 regions, several with their own named areas, from Tale Weaving).
**Model used:** `gemini-3.5-flash-lite` (today's `gemini-3.5-flash` free-tier quota was already spent by earlier passes).
**Full transcripts:** `qc-turns5-transcript.json` (first pass, caught 2 bugs), `qc-turns6-transcript.json` (re-verification pass, both fixes confirmed live)

## Context: what this pass is testing

A direct follow-up to the user's own question about whether Region → Location → Area generation and handling actually works end-to-end. Code inspection had already confirmed Tale Weaving generates regions/locations/areas correctly at Tale creation, but turn-by-turn play had a real architecture gap: the per-turn context slice never told the model a location's own areas or region existed, there was no XML channel for moving between areas, and any location created mid-play (via `ensureLocation`) always got `region: 'Unmapped'` with no coordinates — regardless of how well Tale Weaving generation itself worked. This pass implements and then live-tests the fix.

## Bugs found and fixed (both live-caught, both verified fixed)

### 1. Model confused the new `area` channel with the existing `loc` channel
Live-caught on the very first test: asked to head to "the mess hall" (a pre-authored named area *within* the already-current location, "Riders Quadrant"), the model emitted `loc="the_mess_hall"` instead of `area="the_mess_hall"` — forking "The Mess Hall" into a second, disconnected top-level Location entry, with the player's own `locId` wrongly leaving Riders Quadrant entirely. The new `area` mechanism is unfamiliar territory for the model; a mess hall reads as "a place" just as readily via the old, heavily-reinforced `loc` channel.

**Fixed two ways:**
- **Client-side self-heal** (`App.tsx`): if a turn's own `loc_id` isn't already a known location but exactly matches one of the *current* location's own area ids, treat it as an area move within that same location instead of forking a new one.
- **Prompt-side**: added a concrete worked example to the grammar's rule text naming this exact scenario ("Riders Quadrant" → "The Mess Hall") so the model has a template to pattern-match against, not just abstract instructions.

**Verified fixed twice**: replaying the original buggy response through the fixed code offline resolves it correctly (`locId` stays `riders_quadrant`, `areaId` becomes `the_mess_hall`, no duplicate location); a fresh live re-run of the identical scenario then had the model get it right *natively* — `loc="riders_quadrant" area="the_mess_hall"` — confirming the rule-text fix works at the prompt level too, not just as a client-side safety net.

### 2. The `{{Term|loc}}` keyword-tag path had the same fork, one level down
The model's own narration also tagged `{{The Mess Hall|loc}}` inline — a completely separate auto-registration path (`lib/codex.ts`'s `applyKeywordLinks`) from the `<turn>` tag's own `loc`/`area` attributes. Its existing dedup guard (`isKnownByName`) only checks top-level Location/Region *names* — a term matching an already-known *area* name (nested inside some location's own `areas` array) was invisible to it, so this path would have forked its own duplicate even after fix #1 above.

**Fixed:** added `isKnownAreaName()` — scans every known location's own areas for a name match — and added it to the `'loc'` case's existing dedup check alongside `isKnownByName`.

**Verified fixed**: offline replay of the same buggy turn now produces zero duplicate location entries through either path.

## Verified working correctly (no changes needed)

- **New-location region/coordinate assignment, live**: forced (via a fait-accompli `*asterisk*` override) an actual arrival at a brand-new location, "Zenithal Watch," described as being in "the far eastern mountains beyond Athebyne." The model correctly **reused the existing "The Outskirts & Borders" region** (since Athebyne — already known to be in that region — was given as the anchor point) rather than inventing a redundant new one, and assigned plausible, non-degenerate coordinates (`mapx=88, mapy=15`, the far corner of the region's 0-100 grid) consistent with "remote eastern outpost" — genuine, sensible geographic reasoning, not arbitrary numbers.
- **Write-once economy enforced client-side even when the model doesn't perfectly follow it**: on the very next turn (still at Zenithal Watch), the model restated `region`/`mapx`/`mapy` with slightly different coordinates (`78.5, 22`) despite the rule saying not to — the client correctly ignored the restatement (the `!campaign.locations[effectiveLocId]` guard only fires for a genuinely new location) and the original coordinates stayed exactly as first registered.
- **Area persistence across a revisit**: returning to an earlier-visited location with its own pre-authored areas (The Parapet) left its region link and both its named areas untouched — no corruption from any of the turns in between.
- **Dedup across the full test sequence**: 8 combined turns across both rounds of this pass produced exactly the expected location/region counts throughout — no duplicate regions, and (after the fixes above) no duplicate locations either.

## Verification
`npx tsc --noEmit` and `npm run build` clean after both fixes. Live-verified via direct real-API calls against `gemini-3.5-flash-lite`. Full raw responses and applied-state snapshots saved in `qc-turns5-transcript.json`/`qc-turns6-transcript.json` and `qc4-campaign-after-*.json`.
