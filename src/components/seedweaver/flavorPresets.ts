// Tier 1 static flavor idea banks — zero-LLM-cost inspiration data feeding
// the seedweaver's node modals as small "spark" chips. Distinct from
// defaultPacks.ts's full bundled presets (a whole NPC cast, a whole
// narrative setup loaded wholesale): these are atomic flavor ingredients
// meant to be mixed into a setup already in progress, either appended onto
// existing free-text (Encounter Elements, Region Archetypes) or used to
// quick-fill a few related fields at once (Location Archetypes), never
// silently overwriting text the player already wrote unless the field is
// still empty.

export interface FlavorChip {
  id: string
  label: string // short chip text
  text: string // the flavor line inserted/appended into a free-text field
}

// Encounter Elements — a spark for the Opening Scene, or any later
// combat/tension beat the player wants to seed inspiration for. Appended
// onto whatever's already written, never replacing it.
export const ENCOUNTER_ELEMENTS: FlavorChip[] = [
  { id: 'enc_rival_claim', label: 'Rival Claim', text: 'A rival with an equal claim to the same prize arrives at the worst possible moment.' },
  { id: 'enc_hostile_terrain', label: 'Hostile Terrain', text: 'The terrain itself turns hostile mid-scene — collapsing footing, rising water, closing walls.' },
  { id: 'enc_unexpected_ally', label: 'Unexpected Ally', text: "An unlikely figure intervenes on the protagonist's behalf, for reasons not yet clear." },
  { id: 'enc_wrong_target', label: 'Wrong Target', text: 'The threat turns out to be aimed at someone else nearby, not the protagonist.' },
  { id: 'enc_ticking_clock', label: 'Ticking Clock', text: 'A hard time limit is suddenly imposed — a collapsing structure, a closing gate, a fading window.' },
  { id: 'enc_costly_choice', label: 'Costly Choice', text: "Victory is only possible at a real cost — an injury, a debt, a betrayal of someone's trust." },
  { id: 'enc_false_victory', label: 'False Victory', text: 'What looks like the resolution turns out to be only the first layer of a larger threat.' },
  { id: 'enc_unwanted_witness', label: 'Unwanted Witness', text: "Someone who shouldn't be there sees what just happened, and reacts to it." },
]

// Location Archetypes — quick-fill for the World node's inline location
// editor: sets type + danger + description together (Name/Region/Faction
// stay whatever the player already typed).
export interface LocationArchetype {
  id: string
  label: string
  locationType: string
  dangerLevel: string
  description: string
}
export const LOCATION_ARCHETYPES: LocationArchetype[] = [
  {
    id: 'loc_sunken_temple',
    label: 'Sunken Temple',
    locationType: 'Dungeon',
    dangerLevel: 'High',
    description: 'Half-flooded ruins of a temple older than the current faith, its idols worn faceless by centuries underwater.',
  },
  {
    id: 'loc_border_garrison',
    label: 'Border Garrison Town',
    locationType: 'Settlement',
    dangerLevel: 'Low',
    description: 'A fortified frontier town living under permanent readiness, its markets built directly into the walls.',
  },
  {
    id: 'loc_floating_market',
    label: 'Floating Market',
    locationType: 'Settlement',
    dangerLevel: 'Safe',
    description: 'A sprawling raft-bazaar lashed together over open water, reassembled fresh at every tide.',
  },
  {
    id: 'loc_ashen_battlefield',
    label: 'Ashen Battlefield',
    locationType: 'Wilderness',
    dangerLevel: 'High',
    description: 'A field where a war ended badly, still scarred black, where scavengers and worse pick through what was left.',
  },
  {
    id: 'loc_academy_spire',
    label: 'Academy Spire',
    locationType: 'Academy',
    dangerLevel: 'Low',
    description: 'A vertical campus of stacked lecture halls and dueling courts, rank determined as much by altitude as by grade.',
  },
  {
    id: 'loc_smugglers_warren',
    label: "Smugglers' Warren",
    locationType: 'Dungeon',
    dangerLevel: 'High',
    description: 'A tunnel-city beneath the legitimate one, lit by stolen lanterns, run by whoever controls the exits.',
  },
]

// Region Archetypes — quick-fill for a location's Region text field (a
// short evocative descriptor, not a full bundle). Replaces the field's
// current value outright, same as picking a Narration Style spark below.
export const REGION_ARCHETYPES: FlavorChip[] = [
  { id: 'reg_shattered_frontier', label: 'Shattered Frontier', text: 'The Shattered Frontier — contested borderlands still recovering from a war nobody quite won.' },
  { id: 'reg_gilded_capital', label: 'Gilded Capital', text: 'The Gilded Capital — the seat of power, where every kindness has a price and every enemy wears a smile.' },
  { id: 'reg_drowned_coast', label: 'Drowned Coast', text: 'The Drowned Coast — a shoreline slowly losing ground to the sea, its people building upward instead of fighting it.' },
  { id: 'reg_ashlands', label: 'Ashlands', text: 'The Ashlands — scorched wastes where the old magic burned too hot and never quite cooled.' },
  { id: 'reg_high_marches', label: 'High Marches', text: 'The High Marches — thin-aired mountain holds where isolation bred both fierce independence and old grudges.' },
]

// Author-style Narration Presets — style archetypes (never a real living
// author's name) for the Narration Style field. Replaces the field's
// current value outright, mirroring BUILTIN_NARRATIVE_PRESETS' own "load"
// semantics in defaultPacks.ts, just for style alone rather than a whole
// title/opening/style bundle.
export const AUTHOR_STYLE_PRESETS: FlavorChip[] = [
  {
    id: 'style_grimdark',
    label: 'Grimdark Survivalist',
    text: 'Terse, unsentimental close-third prose; violence described plainly and without flourish; dark humor as the only relief valve.',
  },
  {
    id: 'style_romantic',
    label: 'Romantic Tension-First',
    text: 'Warm, interiority-heavy prose that lingers on glances, proximity, and unspoken want; banter carries as much charge as action.',
  },
  {
    id: 'style_epic',
    label: 'Sweeping Epic',
    text: 'Wide-lens, slightly formal prose with a real sense of scale and consequence; scenes framed as part of something larger unfolding.',
  },
  {
    id: 'style_whimsical',
    label: 'Whimsical High Fantasy',
    text: 'Light, playful narration with a genuine sense of wonder at the world itself; humor woven through even the tense moments.',
  },
  {
    id: 'style_hardmil',
    label: 'Hard Military',
    text: 'Clipped, procedural, technically precise prose; chain of command and tactical detail matter; emotion shows through restraint, not declaration.',
  },
  {
    id: 'style_gothic',
    label: 'Gothic Atmospheric',
    text: 'Dense, sensory, slow-building dread; long atmospheric passages punctuated by sudden sharp violence; the setting itself feels alive and watching.',
  },
]
