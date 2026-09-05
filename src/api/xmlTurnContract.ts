import { SYSTEM_INSTRUCTIONS, TURN_SCHEMA } from './turnContract.ts'

// The live turn-response output format (migrated 2026-09-05 from TURN_SCHEMA's
// JSON-schema mode) — a compact XML <sync> block (self-closing tags,
// shorthand attributes) in place of JSON, per a live AI Studio benchmark
// this session ran against the real Gemini tokenizer: JSON ~396 tokens vs
// XML ~298 tokens for an equivalent turn (~25% smaller output). See
// PROJECT_REVISION_NOTES.md for the full verification trail.
//
// Deliberately does NOT touch <nar> or its existing markup ({{Term|cat}},
// [Skill], [[Item]], 'thought') — those already work, cost nothing extra to
// keep, and converting narration itself to XML tags would collide with a
// bare `<`/`>` in prose (a real parse hazard, not just a style concern) —
// exactly why items moved off angle brackets to [[double brackets]] as part
// of this same migration. All of the measured savings come from the
// *mechanical* fields below, not from inline narrative tagging.
//
// Every tag/attribute here maps 1:1 onto a real TURN_SCHEMA field (types.ts's
// TurnResponse) — no invented currency ladder, buff/debuff system, or
// bestiary rank ladder (the "Gemini Runtime XML Manual" the user brought in
// proposed all three; none of them exist in this game). Reuses
// SYSTEM_INSTRUCTIONS verbatim (the narrative craft rules are format-
// agnostic) and only replaces the "respond in this JSON schema" framing with
// an equivalent XML grammar.
//
// inv_add/inv_rem are merged into one <item> tag (rem="1" signals removal,
// omitting name/type/qty/desc/bonus) — one fewer tag name to hold in mind,
// same field coverage. Otherwise tag names are left readable rather than
// squeezed to 2-3 letter mnemonics: the measured saving came from switching
// key:"value" JSON to attribute="value" XML, not from shaving tag-name
// characters — those are a handful of tokens each either way, and cryptic
// names raise the model's own error rate for a return that doesn't show up
// in a real token count.

export const XML_OUTPUT_GRAMMAR = `
OUTPUT FORMAT (read carefully — this replaces JSON output entirely):
Respond with exactly two top-level elements, in this order, and nothing else — no markdown fences, no prose outside these tags:

<nar>
...your narrative prose, using the existing markup rules above unchanged (double/single quotes, [Skill], [[Item]], {{Term|category}}, CAPITAL LETTERS for shouts)...
</nar>
<sync>
  <turn state="TURN_STATE" d="DAY_INT" h="TIME_STR" loc="LOC_ID" locdisp="LOC_DISPLAY_NAME" desc="LOC_DESC" dist="c|m|f|none" mood="MOOD_TAG" />
  <deltas hp="±N" mp="±N" st="±N" c="±N" />
  <item id="ITEM_ID" name="NAME" type="weapon|armor|accessory|tool|key|consumable|material" qty="N" desc="DESC" bonus="+N STR, +N hp, ..." />
  <item id="ITEM_ID" rem="1" qty="N" />
  <corpse id="ENEMY_ID" />
  <stat_grant attr="STR|INT|AGI" pool="hp|mp|st" amount="N" />
  <act>SUGGESTED ACTION TEXT</act>
  <flag add="FLAG_NAME" />
  <quest id="QUEST_ID" status="advanced|completed|failed" type="main|side|ambition|secret_ambition" note="NOTE" desc="DESC" />
  <npc id="NPC_ID" aff="±N" trust="±N" deed="DEED_TEXT" mem="MEM_SUMMARY" wld="HELD_WEAPON" armor="WORN_ARMOR" />
  <class_evo id="CLASS_ID" reason="REASON" />
  <fac id="FACTION_ID" delta="±N" />
  <skill id="SKILL_ID" name="NAME" desc="DESC" class="CLASS_ID" mp="N" st="N" />
</sync>

Rules for <sync>:
- <turn> is the only always-required tag — attributes state/d/h/loc/locdisp are always present; desc/dist/mood are omitted when not applicable, matching the same "only send loc desc on first visit or genuine change" rule as the JSON field it replaces (loc_desc).
- Every other tag is OMITTED ENTIRELY when that turn has nothing to report for it — do not emit an empty tag as a placeholder. This mirrors each field's own optionality in the schema below; the same "only when it actually changed" rules apply per field exactly as described there.
- <act> repeats 2-4 times (required, same as the JSON schema's "act" array).
- <item> covers BOTH acquiring and losing an item: an acquired item gets id/name/type/qty (desc/bonus optional); a lost/consumed item gets id, rem="1", and qty only — omit name/type/desc/bonus on a removal.
- <item>, <corpse>, <flag>, <npc>, <fac>, <skill> may each repeat 0 or more times — one tag per item/enemy/flag/NPC/faction/skill affected this turn.
- <stat_grant>, <quest>, <class_evo> each appear at most once per turn (or omitted).
- <quest>'s type (main|side|ambition|secret_ambition) follows the same "only on first introduction" economy as desc — omit it on an ordinary advancement turn for a quest already introduced. A secret_ambition quest only ever originates or advances on a turn whose <turn> state is INSIGHT or EXPLORE.
- Numeric deltas are written with an explicit sign (+6, -14), never bare.
- Escape literal & as &amp; inside attribute values and narration text; XML requires this even for narration prose.
`.trim()

export function buildXmlSystemInstructions(): string {
  // SYSTEM_INSTRUCTIONS itself is pure prose about narrative craft — it
  // never describes the JSON output mechanics (those used to live in the API
  // call's separate generationConfig.responseSchema), so it's reused
  // completely unchanged; only the new grammar block is appended.
  return `${SYSTEM_INSTRUCTIONS}\n\n${XML_OUTPUT_GRAMMAR}`
}

// Re-exported so a caller can still reference the "shape of the real
// contract" this grammar mirrors, without importing turnContract.ts twice.
// TURN_SCHEMA itself is no longer sent to the API (see gemini.ts) but stays
// as the authoritative field-shape reference and a rollback path.
export { TURN_SCHEMA }
