import { SYSTEM_INSTRUCTIONS, TURN_SCHEMA } from './turnContract.ts'

// The live turn-response output format — a compact XML <sync> block (self-
// closing tags, shorthand attributes) in place of JSON, per a live AI Studio
// benchmark this session ran against the real Gemini tokenizer: JSON ~396
// tokens vs XML ~298 tokens for an equivalent turn (~25% smaller output).
// See PROJECT_REVISION_NOTES.md for the full verification trail.
//
// Deliberately does NOT touch <nar> or its existing markup ({{Term|cat}},
// [Skill], [[Item]], 'thought') — those already work, cost nothing extra to
// keep, and converting narration itself to XML tags would collide with a
// bare `<`/`>` in prose (a real parse hazard, not just a style concern) —
// exactly why items moved off angle brackets to [[double brackets]] as part
// of the original XML migration. All of the measured savings come from the
// *mechanical* fields below, not from inline narrative tagging.
//
// Narrative-First Overhaul, Phase 2 — every numeric mechanical channel this
// grammar used to carry (hp/mp/st deltas, stat_grant, signed aff/trust
// magnitudes) is now a small, fixed, ordinal word vocabulary the model must
// always express verbatim (never a number, never an invented synonym) — the
// same anti-drift discipline the app already relies on for quest.stat. The
// client's own XML parser (lib/xmlTurnParser.ts) enforces this at parse
// time via reqTierWord — an off-vocabulary or numeric-looking value throws
// XmlParseError rather than being silently coerced.
//
// inv_add/inv_rem are merged into one <item> tag (its own add/rem attribute
// carries the item id, so there's no separate id= to keep in sync) — one
// fewer tag name to hold in mind, same field coverage. Otherwise tag names
// are left readable rather than squeezed to 2-3 letter mnemonics: the
// measured saving came from switching key:"value" JSON to attribute="value"
// XML, not from shaving tag-name characters — those are a handful of tokens
// each either way, and cryptic names raise the model's own error rate for a
// return that doesn't show up in a real token count.
//
// <plan> (added ahead of <nar>) is a "think before you write" scratchpad —
// a fast model plans mechanics/tone/atmosphere before committing to prose,
// rather than composing narration and continuity simultaneously. It's pure
// output-token cost with no schema payload of its own: the parser never
// reads it into TurnResponse, gemini.ts strips it out of what gets resent as
// `history` (same treatment as <sync>), and it's deliberately placed before
// <nar> rather than after specifically so the model's own planning tokens
// causally precede and inform the prose tokens that follow — an "after"
// placement would just be a second summary with no influence on what
// already got written. The tradeoff accepted here: <nar>'s Stage 3 Fallback
// Reader (extractXmlNarrative in gemini.ts) still finds <nar> fine no matter
// what precedes it, but if MAX_TOKENS truncates a response before <nar> ever
// starts (i.e. mid-<plan>), the fallback has nothing to recover — a real
// regression from when <nar> was the very first tag emitted. Accepted
// because <plan> is intentionally short (a handful of lines) against a
// per-turn budget that's already floored at MIN_TURN_OUTPUT_CEILING
// (turnContract.ts) regardless of Prose Depth, making that failure mode rare
// in practice — worth revisiting only if MAX_TOKENS truncations are ever
// observed to land inside <plan> itself (see the debug payload tools,
// Chronicle.tsx, which show the full raw response including <plan>).

export const XML_OUTPUT_GRAMMAR = `
OUTPUT FORMAT (read carefully — this replaces JSON output entirely):
Respond with exactly three top-level elements, in this order, and nothing else — no markdown fences, no prose outside these tags:

<plan>
...a brief private scratchpad, never shown to the player: work out the mechanics and craft of this turn BEFORE you write it, so "nar" below actually delivers what you just planned instead of you discovering the scene as you write it. A few short lines, not a draft of the scene itself:
tone: the emotional register and turn-state craft direction this beat should hit
senses: 2-3 concrete sensory details (sound, smell, texture, light) you intend to actually use in "nar"
beat: the one thing that moves — a reveal, an NPC's reaction, a plot movement, a choice point taking shape
...</plan>
<nar>
...your narrative prose, using the existing markup rules above unchanged (double/single quotes, [Skill], [[Item]], {{Term|category}}, CAPITAL LETTERS for shouts)...
</nar>
<sync>
  <turn state="TURN_STATE" d="DAY_INT" h="TIME_STR" loc="LOC_ID" locdisp="LOC_DISPLAY_NAME" desc="LOC_DESC" mood="MOOD_TAG" c="±N" />
  <cond add="CONDITION_NAME" />
  <cond rem="CONDITION_NAME" />
  <cond id="enemy" add="CONDITION_NAME" />
  <item add="ITEM_ID" name="NAME" type="weapon|armor|accessory|tool|key|consumable|material" qty="N" desc="DESC" traits="TRAIT_1, TRAIT_2" />
  <item rem="ITEM_ID" qty="N" />
  <corpse id="ENEMY_ID" />
  <breakthrough attr="STR|INT|AGI" tier="Novice|Adept|Expert|Master" />
  <act>SUGGESTED ACTION TEXT</act>
  <flag add="FLAG_NAME" />
  <quest id="QUEST_ID" stat="advanced|completed|failed" type="main|side|ambition|secret_ambition" note="NOTE" desc="DESC" />
  <project id="PROJECT_ID" stat="advanced|completed|stalled" stage="N" note="NOTE" />
  <npc id="NPC_ID" aff="+|-" trust="+|-" resolve="Untrained|Novice|Adept|Expert|Master" deed="DEED_TEXT" mem="MEM_SUMMARY" wld="HELD_WEAPON" armor="WORN_ARMOR" />
  <enrich lore="LORE_ID" desc="NEW OR EXPANDED LORE TEXT" />
  <enrich beast="BEAST_ID" desc="NEW OR EXPANDED BESTIARY TEXT" />
  <class_evo id="CLASS_ID" reason="REASON" />
  <fac id="FACTION_ID" delta="±N" />
  <skill id="SKILL_ID" name="NAME" desc="DESC" class="CLASS_ID" effort="minor|focused|taxing" tier="Untrained|Novice|Adept|Expert|Master" />
</sync>

Rules for <plan>:
- <plan> always comes first, before <nar>. It is never shown to the player and never read by the game engine — think of it as thinking out loud before committing to prose, not a fourth mechanical channel. Keep it to a handful of short lines (tone/senses/beat as shown above), not a second copy of the scene.
- Do this planning step on every turn, including a short CONCISE-depth one — a few seconds of "what am I about to write and why" measurably improves the prose that follows, which is the entire point of the tag.

Rules for <sync>:
- <turn> is the only always-required tag — attributes state/d/h/loc are always present; locdisp/desc/mood/c are omitted when not applicable. locdisp follows the same "only on first visit or genuine change" economy loc_desc already has — the client already knows a visited place's display name from its own registry, so don't restate it on an ordinary same-location turn. "c" is a currency delta in base copper (e.g. c="+500", c="-1200") — omit entirely when nothing was gained or spent this turn.
- Every other tag is OMITTED ENTIRELY when that turn has nothing to report for it — do not emit an empty tag as a placeholder. This mirrors each field's own optionality in the schema below; the same "only when it actually changed" rules apply per field exactly as described there.
- <act> repeats 2-4 times (required, same as the JSON schema's "act" array).
- <cond> reports a Condition Tag change — a named narrative status (Bleeding, Exhausted, Blessed, Cursed, ...), never a numeric pool. Exactly one of add="NAME" or rem="NAME" per tag. Omit the "id" attribute for the protagonist (the default target); set id="enemy" to target the current combat opponent instead — there is no other valid value for "id" on <cond>. "kind" ("duration" or "narrative") and "dur_h" (a number of in-fiction hours) are OPTIONAL ESCAPE HATCHES, not routine attributes — the client already knows how common conditions like Bleeding or Exhausted expire on their own; only set kind/dur_h when adding a genuinely novel condition name the client wouldn't recognize, and even then only if it should wear off on its own rather than persist until the story lifts it. <cond> may repeat 0 or more times.
- <item> covers BOTH acquiring and losing an item, keyed off which of add/rem is present: an acquired item's id is the add="" value, with name/type/qty required (desc/traits optional); a lost/consumed item's id is the rem="" value, with qty required and everything else omitted. "traits" is a comma-separated freeform flavor-tag list (e.g. "reach, heavy") — pure narrative color for a genuinely notable weapon/armor/accessory, not a mechanical bonus; most routine loot has none.
- <item>, <corpse>, <flag>, <npc>, <fac>, <skill>, <enrich>, <project> may each repeat 0 or more times — one tag per item/enemy/flag/NPC/faction/skill/entity/project affected this turn.
- <breakthrough>, <quest>, <class_evo> each appear at most once per turn (or omitted).
- <breakthrough> marks a genuine PERMANENT attribute advancement (a blessing, a hard-won transformation) — never for a temporary in-the-moment surge, which belongs in a Condition Tag instead. "tier" is the attribute's new canonical rank word (Novice/Adept/Expert/Master only — never "Untrained," since a breakthrough always moves a rank forward) — never a number, never an increment amount; the client resolves what that new rank means.
- <quest>'s "stat" (advanced/completed/failed — always the full word, never abbreviated) and "type" (main/side/ambition/secret_ambition) follow the same "only on first introduction" economy as desc for type — omit type on an ordinary advancement turn for a quest already introduced. A secret_ambition quest only ever originates or advances on a turn whose <turn> state is INSIGHT or EXPLORE.
- <npc>'s "aff" and "trust" are a BARE "+" or "-" character ONLY — never a number, never a signed integer, never omitted-as-zero vs. absent ambiguity (simply omit the attribute entirely for "no change" to that axis this turn). Affection and Trust are independent — an NPC can gain Trust while losing Affection in the same update, or move on only one axis. "resolve" (Untrained/Novice/Adept/Expert/Master) sets or revises this NPC's social/rhetorical resistance, used for SOCIAL-scene adjudication — set it only when first establishing an NPC who'll matter socially, or when their resolve has genuinely changed; omit for minor NPCs who never need it.
- <enrich> fills in or expands Lore/Bestiary content using the entity type as the attribute key itself (lore="ID" or beast="ID", never both on the same tag) — use it whenever the story reveals something substantive about an already-registered Lore entry or Bestiary adversary that its Codex entry doesn't yet capture.
- <project> tracks a long-running multi-stage endeavor the PLAYER's own action is advancing (a city under construction, a piece of equipment mid-repair, any narrative undertaking with real duration) — a broader, client-tracked-but-LLM-narrated cousin of Crafting, not a replacement for it. "stat" uses the exact same full-word convention as Quest's "stat" (never abbreviated: advanced/completed/stalled). "stage" is optional — the 0-based index into that project's stage list that just got marked done this turn, meaningful only when stat="advanced". "note" is a short current-state blurb (e.g. "Scaffolding up on the east wall; masons want more timber"). Only emit <project> when the player's own action genuinely moved an already-established or brand-new endeavor forward — never invent construction/repair mechanics wholesale, and never use it for an ordinary Crafting-recipe item (that stays fully client-resolved, see the "c" currency rule above).
- <skill>'s "effort" (minor/focused/taxing) is how visibly taxing a cast is — judged by the client against the protagonist's current Condition Tags, never a numeric MP/ST cost. "tier" is the skill's mastery rank on the same 5-word scale as attributes. Both are optional; omit either that doesn't apply.
- Every fixed-vocabulary attribute above (breakthrough tier, skill effort/tier, npc resolve, quest stat/type) MUST use one of its exact canonical words, spelled and cased as shown — never a number, never a close synonym, never an invented variant.
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
