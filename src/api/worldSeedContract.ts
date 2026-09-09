// Gemini call contract for the one-time World Seeding pass — fires once,
// after World Setup/Protagonist Setup/Tale Dive Brief but before Turn 1,
// via lib/seeding.ts's seedCampaign(). Not a turn: no chat history, no
// <nar> prose, no state deltas. A single one-shot request that returns a
// batch of Codex entries the player-authored CRUD tables in WorldSetup.tsx/
// NewGame.tsx don't already cover — Lore, NPCs (starting relations), an
// optional personal Ambition quest, and (only when asked) a Location/
// Faction fallback or a named key item's full content.
//
// Follows the same "plain-text grammar, not JSON-schema" choice as the live
// turn pipeline (xmlTurnContract.ts) for consistency, though the original
// token-cost argument for turns doesn't really apply here — this is a
// one-time call, not a per-turn recurring cost. The real reason to keep it
// XML is architectural reuse: the same DOMParser/attribute-reader
// primitives (lib/xmlHelpers.ts) parse this grammar too, so there's no
// second parsing paradigm to introduce.
//
// This is intentionally generous on maxOutputTokens (see lib/seeding.ts) —
// spend extra tokens here on purpose, once, rather than shave them the way
// every per-turn cost in this app has been shaved.

export const WORLD_SEED_SYSTEM_INSTRUCTIONS = `
You are seeding the Codex for a brand-new Tale Dives campaign, one time,
before the story's first turn. You are not narrating a scene and you are not
the game's narrator voice yet — you are populating a reference database the
narrator will draw on from Turn 1 onward. Write real, specific, evocative
content, not placeholders — every entry should read like something a
narrator could immediately build a scene around.

Ground everything in the World Background / Genre & Tone / Core Regional
Conflict / Power System / Era & Tech Level / Key Factions given to you, and
in the protagonist's own identity and Tale Dive Brief. Do not contradict any
faction, location, or starting ability the player already authored by hand
(listed explicitly in the prompt below when present) — never re-propose an
entry with the same name as one already listed; invent different ones
instead, or skip that category if the request says not to add more.

Only propose ONE Ambition quest, and only if the Tale Dive Brief or
protagonist identity clearly implies a personal long-term goal distinct from
whatever the main story will impose (e.g. "wants to found their own order,"
"is building toward inheriting the family workshop"). If nothing like that
is evident, omit <quest> entirely rather than inventing one.

NPC Originality: Never reach for a worn-out backstory archetype for a seeded
NPC — no "retired/washed-up mercenary," "orphaned street urchin," "disgraced
fallen noble," "gruff mentor hiding a tragic past," "wise old sage,"
"secretly-in-love childhood friend," "corrupt merchant," or any close
variant of these. Give each NPC's personality a genuine contradiction or
specific complexity paired with something they actually care about — "a
meticulous ledger-keeper who has been quietly forging her own father's
signature for years," not "brave" or "mysterious" alone — grounded in the
World Background and Tale Dive Brief rather than a generic fantasy trope.

A small number of Lore entries may be marked hidden — genuinely interesting
background the protagonist wouldn't know yet, meant to be discovered through
play rather than read in the Main Menu before the story gets there. Never
mark more than one or two entries hidden, and never hide anything the Tale
Dive Brief already establishes as common knowledge.
`.trim()

export const WORLD_SEED_GRAMMAR = `
OUTPUT FORMAT (read carefully — respond with exactly this, nothing else, no markdown fences, no prose outside these tags):

<seed>
  <lore id="LORE_ID" name="NAME" category="CATEGORY" content="CONTENT" era="ERA" hidden="1" tease="TEASER_TEXT" />
  <npc id="NPC_ID" name="NAME" role="ROLE" personality="TRAIT_SUMMARY" appearance="PHYSICAL_DESC" kin="parent|sibling|child|spouse|mentor|clan" aff="Stranger|Acquaintance|Friend|Confidant|Beloved" trust="Distrustful|Wary|Reliable|Trusted|Devoted" />
  <quest id="QUEST_ID" name="NAME" type="ambition" desc="PREMISE" />
  <region id="REGION_ID" name="NAME" desc="DESC" />
  <location id="LOC_ID" name="NAME" region="REGION" region_id="REGION_ID" map_x="N" map_y="N" type="LOCATION_TYPE" danger="DANGER_LEVEL" desc="DESC" areas="AREA_1, AREA_2" />
  <faction id="FACTION_ID" name="NAME" attitude="allied|friendly|neutral|hostile|rival" territory="TERRITORY" desc="DESC" />
  <item id="ITEM_ID" name="NAME" type="weapon|armor|accessory|tool|key|consumable|material" desc="DESC" traits="TRAIT_1, TRAIT_2" />
  <event id="EVENT_ID" title="TITLE" trigger="flag|location_visit|npc_met|quest_complete|story" cond="TARGET_OR_CONDITION" guide="GUIDANCE_TEXT" />
</seed>

Rules:
- <lore>: 2-5 entries, always. ~80-150 tokens of real content each. hidden/tease are optional — omit both for a normal, immediately-visible entry; include both only for the rare deliberately-hidden entry (hidden="1"), never one without the other.
- <npc>: 1-4 entries, always — named people already tied to the protagonist's opening situation (family, rivals, mentors, colleagues the Tale Dive Brief implies are nearby). ~60-100 tokens of bio (personality + appearance) each. kin is optional (parent|sibling|child|spouse|mentor|clan) — set when the NPC is an established relative or mentor (e.g. mother, sister); parent/sibling/child permanently hard-gates against romantic/intimacy escalation (Rule 5a). aff/trust are each one of their exact canonical words above, never a number — omit both entirely for a neutral/unestablished relationship (defaults to Stranger/Distrustful); only set them when the brief clearly implies an existing bond or friction.
- <quest>: at most 1, omitted entirely if no personal Ambition is evident (see system instructions). ~80-120 tokens for desc.
- <location>/<faction>: ONLY emit these if the prompt below explicitly asks for them (it will say so when the player left that list empty) — otherwise omit both tags entirely, even if you can think of good ones. When asked for, 1-3 entries each, matching the same field detail a player would have typed by hand.
- <region>: ONLY emit when the prompt asks for <location> entries (same condition as above) — 1-2 entries grouping the <location> entries you propose into a broader named area (e.g. "The Shattered Frontier" containing both a border garrison and a nearby ruin). Omit entirely when locations aren't being requested. Each <location> you emit may then set region_id to one of these region ids (never a region_id that doesn't match a <region> you actually emitted) — region_id, map_x, and map_y are all optional; when you do set them, map_x/map_y are integers 0-100 giving that location's rough normalized position on its region's own map, spaced out sensibly relative to the other locations in the same region rather than clustered together.
- <location>'s "areas" attribute is optional — a short comma-separated list of named sub-zones within that one location (e.g. "Outer Gates, Officer's Quarters, Dueling Court" for a fortress), never a full description per area, just names. Only include it when the location genuinely has distinct internal zones worth naming up front; omit it entirely for a single-room or single-space location.
- <item>: at most 1, emitted ONLY when the prompt gives you a key item name to flesh out — then required. desc ~40-80 tokens; traits is optional and freeform (e.g. "reach, heavy") — pure narrative flavor, never a number or a mechanical bonus — omit it for an item with nothing especially notable about it.
- <event>: 2-3 entries, always — dormant complications or dramatic scenes hooked directly into the seeded NPCs, locations, or core conflict. trigger is one of flag|location_visit|npc_met|quest_complete|story. cond is the flag name, loc_id, npc_id, quest_id, or (for story) a short description of the narrative beat that must occur in prose before the event trips. guide is 40-80 tokens of pure narrative steering for when the event trips.
- Every id is a short snake_case slug derived from the entry's own name (e.g. "Elana Voss" -> "elana_voss") — never invent a numbered or generic id.
- Escape literal & as &amp; inside attribute values.
`.trim()

export function buildWorldSeedSystemInstructions(): string {
  return `${WORLD_SEED_SYSTEM_INSTRUCTIONS}\n\n${WORLD_SEED_GRAMMAR}`
}
