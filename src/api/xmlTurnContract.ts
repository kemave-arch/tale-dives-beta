import { SYSTEM_INSTRUCTIONS, TURN_SCHEMA } from './turnContract.ts'

// PROTOTYPE — not wired into the live turn pipeline. Exists to test whether
// a compact XML <sync> block (self-closing tags, shorthand attributes) beats
// TURN_SCHEMA's JSON output on real token count, per a live AI Studio
// benchmark this session ran: JSON ~396 tokens vs XML ~298 tokens for an
// equivalent turn (~25% smaller output). See PROJECT_REVISION_NOTES.md.
//
// Deliberately does NOT touch <nar> or its existing markup ({{Term|cat}},
// [Skill], >Item<, 'thought') — those already work, cost nothing extra to
// keep, and converting narration itself to XML tags would collide with the
// >Item< convention's angle brackets (a real <tag> immediately before/after
// a bare `<`/`>` in prose is a genuine XML parse hazard, not just a style
// concern). All of the measured savings come from the *mechanical* fields —
// exactly what this grammar replaces.
//
// Every tag/attribute here maps 1:1 onto a real TURN_SCHEMA field (types.ts's
// TurnResponse) — no invented currency ladder, buff/debuff system, or
// bestiary rank ladder. Reuses SYSTEM_INSTRUCTIONS verbatim (the narrative
// craft rules are format-agnostic) and only replaces the "respond in this
// JSON schema" framing with an equivalent XML grammar.

export const XML_OUTPUT_GRAMMAR = `
OUTPUT FORMAT (read carefully — this replaces JSON output entirely):
Respond with exactly two top-level elements, in this order, and nothing else — no markdown fences, no prose outside these tags:

<nar>
...your narrative prose, using the existing markup rules above unchanged (double/single quotes, [Skill], >Item<, {{Term|category}}, CAPITAL LETTERS for shouts)...
</nar>
<sync>
  <turn state="TURN_STATE" d="DAY_INT" h="TIME_STR" loc="LOC_ID" locdisp="LOC_DISPLAY_NAME" desc="LOC_DESC" dist="c|m|f|none" mood="MOOD_TAG" />
  <deltas hp="±N" mp="±N" st="±N" c="±N" />
  <inv_add id="ITEM_ID" name="NAME" type="weapon|armor|accessory|tool|key|consumable|material" qty="N" desc="DESC" bonus="+N STR, +N hp, ..." />
  <inv_rem id="ITEM_ID" qty="N" />
  <corpse id="ENEMY_ID" />
  <stat_grant attr="STR|INT|AGI" pool="hp|mp|st" amount="N" />
  <act>SUGGESTED ACTION TEXT</act>
  <flag add="FLAG_NAME" />
  <quest id="QUEST_ID" status="advanced|completed|failed" note="NOTE" desc="DESC" />
  <npc id="NPC_ID" aff="±N" trust="±N" deed="DEED_TEXT" mem="MEM_SUMMARY" wld="HELD_WEAPON" armor="WORN_ARMOR" />
  <class_evo id="CLASS_ID" reason="REASON" />
  <fac id="FACTION_ID" delta="±N" />
  <skill id="SKILL_ID" name="NAME" desc="DESC" class="CLASS_ID" mp="N" st="N" />
</sync>

Rules for <sync>:
- <turn> is the only always-required tag — attributes state/d/h/loc/locdisp are always present; desc/dist/mood are omitted when not applicable, matching the same "only send loc desc on first visit or genuine change" rule as the JSON field it replaces (loc_desc).
- Every other tag is OMITTED ENTIRELY when that turn has nothing to report for it — do not emit an empty tag as a placeholder. This mirrors each field's own optionality in the schema below; the same "only when it actually changed" rules apply per field exactly as described there.
- <act> repeats 2-4 times (required, same as the JSON schema's "act" array).
- <inv_add>, <inv_rem>, <corpse>, <flag>, <npc>, <fac>, <skill> may each repeat 0 or more times — one tag per item/enemy/flag/NPC/faction/skill affected this turn.
- <stat_grant>, <quest>, <class_evo> each appear at most once per turn (or omitted).
- Numeric deltas are written with an explicit sign (+6, -14), never bare.
- Escape literal & as &amp; inside attribute values and narration text; XML requires this even for narration prose.
`.trim()

export function buildXmlSystemInstructions(): string {
  // Splice out TURN_SCHEMA's JSON-specific framing isn't needed since
  // SYSTEM_INSTRUCTIONS itself is pure prose about narrative craft — it
  // never describes the JSON output mechanics (those live in the API call's
  // separate generationConfig.responseSchema, not in this string). So it's
  // reused completely unchanged; only the new grammar block is appended.
  return `${SYSTEM_INSTRUCTIONS}\n\n${XML_OUTPUT_GRAMMAR}`
}

// Re-exported so a caller can still reference the "shape of the real
// contract" this grammar mirrors, without importing turnContract.ts twice.
export { TURN_SCHEMA }
