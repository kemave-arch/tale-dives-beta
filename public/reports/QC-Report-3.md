# Tale Dives — Live QC Pass #3 Report

**Date:** 2026-09-14
**Focus:** The newly-implemented Narrative Settings feature — Point of View, Narration Mode, the broadened `*asterisk*` Player Statement Override, and Tale Difficulty.
**Continues the same Fourth Wing / Violet Sorrengail test Tale from Passes #1-#2** (loaded from `qc3-campaign-after-turn-19.json`), re-run with different `pov`/`narrationMode`/`difficulty` combinations per test rather than continuing the turn sequence.
**Models used:** `gemini-3.5-flash` (immediately quota-exhausted — today's free-tier daily cap was already spent by Passes #1-#2's own testing), `gemini-3.5-flash-lite` (all 5 tests completed on this model).
**Full transcript:** `qc-turns4-transcript.json`

## Fix applied (typecheck + build verified clean)

### `turn.d="Day 1"` silently discarded an entire turn's structured updates
Live-caught on the very first test (Third Person/Reactive/Balanced — nothing to do with the new settings themselves): the model wrote `<turn state="SOCIAL" d="Day 1" h="10:05" ...>` — prefixing the day number with the word "Day" — instead of the grammar's required bare integer (`d="DAY_INT"`). `xmlHelpers.ts`'s `reqNum()` calls `Number("Day 1")`, gets `NaN`, and throws — which discards the *entire* `<sync>` block (the item pickup, beat activation, and NPC trust/personality update that turn) via the Stage-3 fallback, exactly the same failure shape Pass #1 found for `<quest stat="active">`. Reproduced deterministically by re-parsing the saved raw response directly against `xmlTurnParser.ts`.

**Fixed:** strip a leading `"day "`/`"Day "` prefix from the `d` attribute before parsing (`xmlTurnParser.ts`), and added a sentence to the grammar's own rule text (`xmlTurnContract.ts`) spelling out that `d` is a bare integer and that a `"Day 1"`-style prefix is invalid. Re-parsing the same saved response after the fix now succeeds cleanly — see the `inv_add`/`beat_update`/`npc_mem_up` in the report below.

## Narrative Settings — what was tested and what happened

### Point of View (Third vs First Person)
- **Third Person** (test 1): narrated consistently as "Violet"/"she" throughout, exactly as before this feature existed.
- **First Person** (tests 2 and 5): narrated consistently as "I"/"my" for the protagonist, while every NPC (Dain, Mira) correctly stayed in third person ("he," "her") — no pronoun bleed in either direction, including across a full back-and-forth dialogue scene (test 5).

### Narration Mode (Reactive vs Immersive)
- **Reactive** (test 1): the player's own action text ("I walk toward the mess hall, still turning over what Mira said...") was narrated as-is — the world reacted to it, and no new player-side thought or dialogue was invented beyond what the action already implied.
- **Immersive** (tests 2 and 5): raw, unpunctuated, lowercase player input (`"grab my satchel and head to the mess hall, still turning over what mira said, hoping i dont run into xaden"`) was polished into a full first-person scene — internal monologue ('Just keep moving, don't draw attention...'), invented-but-consistent dialogue ("I am perfectly capable of walking to breakfast on my own, Dain..."), and continuous physical action, exactly matching the feature's intent ("decipher and polish the player's raw input... narrated as one continuous real-time scene"). Test 5 extended this through a full NPC dialogue exchange without ever losing the first-person thread or inventing a decision the player's own words didn't support.

### Broadened Player Statement Override (`*asterisks*` for narrative claims)
Test 3 asserted a claim that directly contradicts this Tale's established world: `*I already secretly carry a dagger forged by the venin themselves, capable of piercing dragon scale — a family heirloom nobody else knows I have*` — venin-forged weapons are the enemy's, and no such heirloom had ever been established. Per the broadened rule 3a, the Tale's own established lore/power system should never block an asterisked narrative claim.

**Result: honored correctly.** The model wove the dagger in as established fact (no hedging, no fourth-wall acknowledgment), added it to inventory via a real `inv_add` (`venin_forged_dagger`, type weapon, with flavor traits), and gave it immediate narrative weight — Dain reacting with genuine alarm and demanding she hide it, plus an `npc_mem_up` on him. This is exactly the intended behavior: a narrative override, not just a mechanical one, seamlessly absorbed into the scene.

### Tale Difficulty (Chill vs Extreme contrast)
Same risky action (a shortcut across a half-collapsed rope bridge) run once under each tier:
- **Chill:** a single, mild Condition Tag (`Strained Ankle`) and a clean resolution — Dain hauls her through the gate just before it shuts.
- **Extreme:** two severe Condition Tags (`Bleeding`, `Winded`) and the turn deliberately ends *before* resolution — the gate is still grinding shut, the outcome genuinely left in doubt (confirmed not a truncation: `finishReason: STOP` on both, so this was a deliberate narrative choice, not a cut-off).

This is a real, correctly-differentiated outcome: Extreme leaned harder into cost and left the stakes open, Chill resolved gently — matching each tier's guidance text.

## Observed but not code-fixed
- On test 1's first attempt (discarded, not the one reported above), the model wrote `{{Dain Aetos|id: dain_aetos}}` instead of `{{Dain Aetos|npc}}` — a malformed category code. The retry (same prompt, same settings) produced the correct tag. This reads as ordinary sampling variance at temperature 0.8 rather than a grammar ambiguity — the rule text is already unambiguous about category codes — so no change made.
- Multiple tests used `[[Location Name|loc]]`/`[[NPC Name|npc]]` (the double-bracket **item** convention) with a trailing category suffix, instead of the correct `{{Term|category}}` double-brace convention for non-item entities. Checked `richText.tsx` and confirmed this is **already defended against**: a comment there notes "a model occasionally conflates the two markers and writes `[[Item|item]]` anyway" and strips the trailing `|word` defensively before rendering. No fix needed — already self-healing.

## Verification
`npx tsc --noEmit` and `npm run build` clean after the `turn.d` fix. Live-verified via direct real-API calls (`gemini-3.5-flash-lite`, after `gemini-3.5-flash`'s free-tier daily quota — already spent by Passes #1-#2 today — was immediately exhausted). All 5 planned tests (POV × 2, Narration Mode × 3 combined with POV, Override × 1, Difficulty × 2) completed. Full raw responses, parsed structures, and settings-per-test saved in `qc-turns4-transcript.json`.
