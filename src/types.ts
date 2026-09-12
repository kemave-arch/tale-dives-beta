// Shared type definitions for Tale Dives' game state. Kept in one place so
// every lib/screen module agrees on the same shapes — this is the concrete
// payoff of the TypeScript conversion: several real bugs earlier in this
// build (a missing `time` field, a missing `locations` field after a schema
// change) were exactly the class of mistake these types now catch at
// compile time instead of requiring a browser round-trip to discover.

export type Dict<T> = Record<string, T>

// A player-saved snippet for a free-text field (e.g. TaleBrief's Opening
// Brief / Narration Style) — separate from the built-in FormExampleItem
// list in data/formExamples.ts, which ships with the app and can't be
// edited or removed.
export interface SavedPreset {
  id: string
  name: string
  value: string
  savedAt: number
}

// Narrative-First Overhaul — every numeric HP/MP/ST-style pool and delta the
// LLM used to have to compute (a recurring hallucination/desync risk — see
// the since-removed NaN-repair pass this schema bump finally retires) is
// replaced by a small, fixed ordinal-word vocabulary: an internal 1-based
// rank into a closed word scale (lib/tiers.ts's COMPETENCY_TIERS/
// THREAT_TIERS), expressed to and by the model only as the word itself,
// never a number. Kept as a plain `number` rather than a `1|2|3|4|5` literal
// union — see lib/tiers.ts's own comment for why (the existing point-buy
// attribute allocators still hand out a wider raw range, and rescaling that
// UI to a true tier picker is out of scope for this pass); the real anti-
// drift enforcement is wordToTier/reqTierWord at the LLM/XML boundary, not
// the static type of this field.
export type CompetencyTier = number

// Bestiary/hazard severity — the internal, LLM-facing token set (separate
// from any player-facing display reskin, a client-side-only concern layered
// on top in a later pass). Mirrors lib/tiers.ts's THREAT_TIERS 8-word scale,
// plus 'unknown' — a client-only placeholder for a bare {{Name|beast}}
// mention that hasn't actually been established in a scene yet (never a
// value the model itself is asked to emit).
export type ThreatTierToken = 'unknown' | 'trivial' | 'minor' | 'notable' | 'dangerous' | 'severe' | 'extreme' | 'legendary' | 'mythic'

// A skill's qualitative cost — how much a cast visibly takes out of the
// protagonist, judged narratively against their current Condition Tags
// rather than a numeric pool (lib/skills.ts's checkAffordability).
export type EffortTier = 'minor' | 'focused' | 'taxing'

export interface Attributes {
  STR: CompetencyTier
  INT: CompetencyTier
  AGI: CompetencyTier
}

export interface ClassWeights extends Attributes {}

export interface ClassDef {
  id: string
  name: string
  weights: ClassWeights
}

export interface GameTime {
  d: number
  h: string
}

// Condition Tags — replaces the old numeric HP/MP/ST pools entirely
// (lib/conditions.ts). 'duration' conditions clear themselves once enough
// in-fiction time passes (Bleeding, Exhausted); 'narrative' ones persist
// until the story itself lifts them (<cond rem>) — an unrecognized condition
// name always defaults to 'narrative', never auto-expiring silently.
export interface ConditionTag {
  id: string
  label: string
  kind: 'duration' | 'narrative'
  expiresAt?: GameTime // only meaningful when kind === 'duration'
}

// §5.8 Crafting — a local static dictionary, same pattern as the Preset
// Class Dictionary (data/classes.ts, data/recipes.ts). `stationRequired` is
// informational only for now (shown on the recipe card) — there's no
// location-station-type data model yet to enforce "must be at a forge."
export interface RecipeDef {
  id: string
  name: string
  output: { id: string; qty: number }
  ingredients: { id: string; qty: number }[]
  stationRequired?: string
  craftHours: number
}

// §5.8 Crafting Queue — per-Tale local state, never sent to Gemini. Ingredients
// are deducted the instant the job is queued (not on completion), and the
// output lands in inventory the instant `completeTime` is reached regardless
// of the player's location — waiting doesn't require sitting at the station.
export interface CraftingJob {
  jobId: string
  recipeId: string
  stationLocId: string
  startTime: GameTime
  completeTime: GameTime
}

// §5.3 Three-Branch Summoning & Minion Engine — a class-gated, 0-token,
// client-resolved mechanic (same "!" bang-command family as the read-only
// dossiers, just with a real state-mutating side effect): `!arise` (Shadow
// Monarch), `!raise_skeleton` (Necromancer), `!summon` (Summoner).
// A minion persists on the Campaign until dismissed or (for
// a `familiar`) its upkeep can no longer be paid.
//
// Deliberately OUT OF SCOPE for the Narrative-First Overhaul — a separate,
// narrow, class-gated mechanic the user explicitly excluded from it. Minion
// keeps its own numeric hpMax untouched; do not fold it into ConditionTag or
// the Bestiary's qualitative threat model.
export type SummonBranch = 'shadow' | 'skeleton' | 'familiar'

export interface Minion {
  id: string
  name: string
  branch: SummonBranch
  hpMax: number
  mpUpkeep?: number // only `familiar`-branch minions carry ongoing upkeep
  summonedAt: GameTime
}

export interface Player {
  name: string
  gender?: string // free-short-text (e.g. "she/her", "male"), 0 context cost when unset
  age?: number
  background?: string // origin/family history — copied from ProtagonistData at creation so it survives history-window flushes (jitContext.ts), not just told once on Turn 1
  personality?: string // demeanor/traits, e.g. "Stubborn, quietly ambitious"
  motivation?: string // core drive/want, e.g. "Prove she belongs, no matter the cost"
  physicalTrait?: string // a distinguishing feature or flaw
  secret?: string // something the narrator can quietly plant hooks around
  classId: string
  className: string
  level: number
  attrs: Attributes
  conditions: ConditionTag[] // replaces hp/hpMax/mp/mpMax/st/stMax entirely
  copper: number
  locId: string
  locDisp: string
  time: GameTime
  equipped?: Partial<Record<EquipSlot, string>> // §5.9 — slot -> equipped item id
}

// §5.9 Item Type Taxonomy — a closed set; only these three occupy an equip
// slot (1:1 with ItemType, one slot each) and can carry `traits`.
export type ItemType = 'weapon' | 'armor' | 'accessory' | 'tool' | 'key' | 'consumable' | 'material'
export type EquipSlot = 'weapon' | 'armor' | 'accessory'
export const EQUIPPABLE_TYPES: ItemType[] = ['weapon', 'armor', 'accessory']

// The item Codex — one entry per item id the player has ever carried.
// Deliberately not a full "every item in the world" registry (§5.9 scope is
// the player's own inventory): materials/consumables typically only ever
// get `name`/`type` since the model has no reason to write a description
// for "5x Iron Ore," while key items and personal gear naturally accumulate
// one because the model actually has something to say about them.
export interface ItemEntry {
  name: string
  type: ItemType
  description?: string
  // Freeform narrative flavor tags (e.g. ["reach","heavy"]) — replaces the
  // old numeric StatBonus entirely. Pure narration fuel for the model to
  // factor into how a fight/scene reads; no mechanical bookkeeping on the
  // client (no tier-bump math on equip/unequip).
  traits?: string[]
  rarity?: string // freeform, e.g. "Common"/"Rare"/"Legendary" — flavor, not a game-mechanical gate
  loreText?: string // an evocative line distinct from `description`'s mechanical summary
  value?: number // freeform currency worth, player/CRUD-set only
  tags?: string[]
  loggedAt?: string // see LocationEntry.loggedAt — the turn this item first entered the Codex, e.g. "C1-3"
}

// §5.12 Codex Discovery ("Fog of Lore") — an entry with no `discovery` field
// (or `state: 'known'`) is always fully visible; this is the common case,
// since only hand-authored CRUD entries can currently become `hidden` (there
// is no seeding/grounding call yet that pre-populates masked lore). Reveal
// checks run client-side each turn (§5.12) against the turn's own deltas —
// no new LLM call, no schema field on the turn response itself.
export type RevealTrigger = 'flag' | 'location_visit' | 'npc_met' | 'quest_complete' | 'story' | 'manual'

export interface Discovery {
  state: 'known' | 'hidden'
  revealTrigger?: RevealTrigger
  revealCondition?: string // a flag string, loc_id, npc_id, or quest_id depending on revealTrigger
  teaser?: string // shown in place of real content while hidden
}

// Location Enums & Constants
export const LOCATION_DANGER_LEVELS = ['Safe', 'Low', 'High', 'Lethal'] as const
export type LocationDangerLevel = (typeof LOCATION_DANGER_LEVELS)[number]

export const LOCATION_TYPES = ['Settlement', 'Fortress', 'Wilds', 'Dungeon', 'Ruins', 'Landmark'] as const
export type LocationType = (typeof LOCATION_TYPES)[number]

// §5.10 Locations Codex entry.
export interface LocationEntry {
  name: string
  region: string
  description: string
  dangerLevel: LocationDangerLevel | string
  factionOwner: string | null
  standing: string
  locationType?: LocationType | string // e.g. "Settlement" / "Fortress" / "Wilds" / "Dungeon" / "Ruins" / "Landmark"
  notableFeatures?: string // freeform — what stands out about the place
  inhabitants?: string // freeform — who/what lives or lurks here
  firstVisitedTime?: GameTime // set once, at stub creation — an explicit anchor against invented "it's been weeks" narration drift
  lastVisitedTime?: GameTime // updated whenever the player is here again
  tags?: string[]
  autoLogged?: boolean
  loggedAt?: string // the turn this entry was first created, e.g. "C1-3" (Chapter 1, block 3) — see lib/leveling.ts's turnRefFor
  discovery?: Discovery
  // §7 Region Map Pins — a structured link into Campaign.regions, distinct
  // from the plain `region` display string above (which stays freeform and
  // untouched for backward compat). Write-once: set only at this location's
  // creation time (world seeding or Codex CRUD), never re-derived or
  // overwritten on a later turn — a raw coordinate is only a hallucination
  // risk when a recurring channel re-asserts it every turn, not when it's
  // authored once like any other static Codex fact.
  regionId?: string
  mapX?: number // 0-100, normalized position on the region's own map
  mapY?: number // 0-100, normalized position on the region's own map
  mapRadius?: number // optional — this location's rough area of influence on the map, same 0-100 scale
  // §7 local sub-area graph — named sub-zones within this one location (e.g.
  // a fortress's "Outer Gates"/"Officer's Quarters"/"Dueling Court"),
  // distinct from Regions (which group whole locations, not zones inside
  // one). Deliberately thin, no coordinates of its own — a full per-area
  // visual layout is future/Tier-4 scope, this is just the named list.
  areas?: AreaEntry[]
  // §7 Image Generation — a stable key into the client-side IndexedDB blob
  // store (lib/imageStore.ts), NOT a real URL: images live only on this
  // device (no backend to host them), so the client turns this key into a
  // fresh blob: object URL each time it renders, never persists that URL
  // itself. Absent/undefined means "no image generated (yet)" — the UI
  // falls back to the existing flat parchment treatment, not an error.
  imageKey?: string
  imageHistory?: string[]
  // §7 Image Generation, Lore Accuracy — only populated when the campaign's
  // world has sourceTitle+sourceScope set (lib/canonDescription.ts). A
  // canon-accurate environmental description used as the image prompt's
  // basis instead of `description` directly — the real name AND the source
  // title/author/scope are also cited directly in the final image prompt
  // (see imageGeneration.ts's canonReferenceLine); this field is not about
  // hiding either, it's about pulling out concrete canon visual detail and
  // preserving continuity. Persisted so a later regeneration (reflecting
  // in-story change to the place) starts from this same description and only
  // layers the requested change, rather than re-deriving a different-looking
  // place each time.
  canonDescription?: string
}

export interface AreaEntry {
  id: string
  name: string
  description?: string
}

// §7 Region Map Pins — a lightweight named grouping locations attach to via
// LocationEntry.regionId, the write-once backing store for a future visual
// top-down region map (Tier 4 — mapImageUrl lands separately once image
// generation exists). Auto-registered by world seeding, or by hand via
// Codex CRUD; deliberately thin (no Discovery gating of its own) since a
// region is an organizational container, not a narratively-concealable fact.
export interface RegionEntry {
  name: string
  description?: string
  autoLogged?: boolean
  loggedAt?: string
  mapImageKey?: string
  imageHistory?: string[]
}

export type KinshipType = 'parent' | 'sibling' | 'child' | 'spouse' | 'mentor' | 'clan'
export const KINSHIP_VALUES = ['parent', 'sibling', 'child', 'spouse', 'mentor', 'clan'] as const

// §5.5/§5.14 NPC Codex entry. affection/trust are two INDEPENDENT
// CompetencyTier ladders (own words each, see lib/npcs.ts) — never
// collapsed into one shared relationship axis: a mercenary can respect the
// protagonist's competence (high trust) while disliking them personally (low
// affection), a real narrative state the single `stage` ladder (driven by
// affection alone) already supports today and must keep supporting.
export interface NpcEntry {
  name: string
  gender?: string // player-set via Codex CRUD only — never asked of the model (§3.6, no new schema field)
  age?: number
  kinship?: KinshipType // structural relationship anchor: 'parent'|'sibling'|'child' hard-gates against romantic/intimacy escalation (Rule 5a); 'spouse'|'mentor'|'clan' are descriptive
  affection: CompetencyTier
  trust: CompetencyTier
  resolve?: CompetencyTier // this NPC's social/rhetorical resistance — set/revised by the LLM on introduction, same as Bestiary's threatTier; used only for the SOCIAL compareTiers() hint, omitted for minor NPCs who never need it
  stage: string
  deeds: string[]
  memSummary: string
  lastSeenLocId: string | null
  role?: string // freeform, e.g. "Blacksmith"/"Rival Cadet"/"Court Advisor"
  appearance?: string // freeform physical description
  heldWeapon?: string // currently wielded weapon, set/updated via npc_mem_up.held_weapon — restated every turn they're present (jitContext.ts) so an established detail can't silently drift turn to turn
  wornArmor?: string // currently worn armor/notable gear, same tracking as heldWeapon
  personality?: string // freeform trait summary — set/revised by the LLM via npc_mem_up.personality, restated every turn present as ground truth (lib/npcs.ts describePresentNpc), same discipline as heldWeapon/wornArmor
  voiceNotes?: string // how they speak — a steering note for the player, not sent to the model
  factionId?: string | null // affiliation, mirrors LocationEntry's factionOwner — set/revised by the LLM via npc_mem_up.faction_id
  secretTruth?: string // hidden ground truth (motive, history, loyalty) the model always knows for this NPC but must never state directly until the story earns the reveal — never shown to the player, distinct from Discovery's public teaser
  partyStatus?: PartyStatus // §7 — set/revised by the LLM via npc_mem_up.party_status when this NPC actively joins/leaves the protagonist's travelling party; absent means they've never been a companion
  portraitKey?: string
  imageHistory?: string[]
  // Same mechanism as LocationEntry.canonDescription — a canon-accurate
  // physical description used as the portrait prompt's basis instead of
  // `appearance` directly, only populated when the world has sourceTitle+
  // sourceScope set. The character's real name and the source title/author/
  // scope are cited directly in the final image prompt too (see
  // imageGeneration.ts's canonReferenceLine) — this field isn't for hiding
  // that, it's for concrete canon visual detail and cross-regeneration
  // continuity. Persisted so a later portrait (reflecting in-story growth/
  // change) starts from this same description and only layers the requested
  // change, keeping the character visually consistent across regenerations
  // instead of drifting to a different-looking render.
  canonAppearance?: string
  firstSeenTime?: GameTime // set once, at stub creation — same anti-drift anchor as LocationEntry's
  lastSeenTime?: GameTime // updated on every npc_mem_up touch
  tags?: string[]
  autoLogged?: boolean
  loggedAt?: string // see LocationEntry.loggedAt
  discovery?: Discovery
}

// §7 Party Status — an NPC's travelling-companion state, distinct from
// Affection/Trust (which track the *relationship*, not physical presence in
// the party). "companion" means actively travelling with the protagonist
// right now; "departed" means they once were but have since left (so the
// narrator and UI can tell that apart from an NPC who's simply never joined
// at all — absent partyStatus).
export type PartyStatus = 'companion' | 'departed'

export interface FactionEntry {
  name: string
  repTier: number
  rivalId?: string | null // §5.4 App-Side Rivalry — another faction's id; a rep change here mirrors an inverse change there, 0 tokens
  description?: string // freeform — what they stand for or do
  leader?: string // freeform NPC name/reference
  territory?: string // freeform — home region/base
  symbol?: string // freeform — a sigil/emblem description
  tags?: string[]
  autoLogged?: boolean
  loggedAt?: string // see LocationEntry.loggedAt
  discovery?: Discovery
}

// A bare {{Term|lore}} mention only ever registers `name`/`category` — this
// entry had NO body text field at all until 2026-09-04, so a lore stub was
// permanently a title with nothing under it unless hand-authored via CRUD.
export interface LoreEntry {
  name: string
  category: string
  content?: string // the actual lore text — optional so older auto-registered stubs (name/category only) stay valid
  era?: string // freeform, e.g. "Ancient"/"Present Day"
  tags?: string[]
  autoLogged?: boolean
  loggedAt?: string // see LocationEntry.loggedAt
  discovery?: Discovery
}

// Main: world/story-driven, the game world imposes these on the protagonist.
// Side: guild/NPC/tactical support missions alongside the main story.
// Ambition: a player-driven personal goal (founding an order, an empire, ...).
// Secret Ambition: a hidden high-risk/high-reward personal quest, meant to
// surface only when the current turn state is INSIGHT or EXPLORE (§ turn
// state gating is prompt-side, see turnContract.ts — not client-enforced).
export type QuestType = 'main' | 'side' | 'ambition' | 'secret_ambition'

export interface QuestEntry {
  name: string
  status?: 'advanced' | 'completed' | 'failed'
  type?: QuestType
  note?: string
  description?: string // the quest's actual premise/objective, distinct from `note`'s short status update
  questGiver?: string // freeform NPC name/reference
  reward?: string // freeform
  tags?: string[]
  autoLogged?: boolean
  loggedAt?: string // see LocationEntry.loggedAt
  discovery?: Discovery
}

// §5.13 Bestiary entry — threatTier is a fixed canonical word (lib/tiers.ts's
// THREAT_TIERS, or 'unknown' for a bare name-only mention that hasn't been
// established yet). `conditions` mirrors Player's — a beast/hazard can carry
// the same narrative status tags (Bleeding, Stunned, ...) the protagonist can.
// `corpseCount`/`lastSlainTime` fold in what used to be the flat, LIFO
// `Campaign.corpses` tag stack (§5.3) — per-species aggregation directly on
// the Bestiary entry instead of a separate untyped array, so a harvestable
// corpse is always attached to a real, named adversary record.
export interface BestiaryEntry {
  name: string
  threatTier: ThreatTierToken
  conditions?: ConditionTag[]
  description?: string // freeform appearance/behavior
  habitat?: string // freeform
  weaknesses?: string // freeform
  lootTable?: string // freeform, e.g. "Bone Dust, Cursed Fang"
  corpseCount?: number // §5.3 — how many harvestable corpses of this species currently exist, consumed one at a time by `!arise`
  lastSlainTime?: GameTime // when the most recent one was added — same firstSeenTime/lastSeenTime anchor pattern as NpcEntry/LocationEntry
  tags?: string[]
  autoLogged?: boolean
  loggedAt?: string // see LocationEntry.loggedAt
  discovery?: Discovery
}

// §7 Projects — a broader multi-stage tracker generalizing the narrower
// recipe-based Crafting system (`lib/crafting.ts`/`data/recipes.ts`, both
// untouched by this): a city under construction, a satellite module mid-
// repair, any long-running narrative endeavor whose state the player wants
// to check ("this isn't ready yet, so I can't do X") rather than just being
// told about it once. Unlike a CraftingJob, a Project never auto-completes
// on a timer — completion is always an explicit LLM-narrated `stat`
// update (see ProjectUpdate), since a project isn't a fire-and-forget recipe
// queue; `eta` (when set) is a read-only readiness gate, checked via
// lib/projects.ts's isProjectReady.
export interface ProjectStage {
  label: string
  done: boolean
}

export interface ProjectEntry {
  name: string
  stages: ProjectStage[]
  prerequisites?: string[] // freeform description strings, e.g. "200 Timber, a master mason"
  eta?: GameTime // when the next incomplete stage (or the whole project) is expected done — optional, not every project has a firm timeline
  status?: 'active' | 'completed' | 'stalled'
  note?: string // short current-state blurb, mirrors QuestEntry.note
  autoLogged?: boolean
  loggedAt?: string // see LocationEntry.loggedAt
  discovery?: Discovery
}

// §6.4D Codex category 6 — Skills (Spells & Abilities). Every field past the
// name is optional on purpose: a skill is usually *mentioned* in prose (as
// [Shadow Step], §4.2) well before it has agreed particulars, and the
// blueprint deliberately leaves skill specifics open rather than pre-specced
// (§8). §3.2 affordability therefore only gates a skill that actually
// declares an `effort`  — an effortless skill is never blocked, just narrated.
export interface SkillEntry {
  name: string
  description?: string
  classId?: string // owning class, a Preset Class Dictionary id (§6.4D card shows its icon)
  effort?: EffortTier // how taxing a cast visibly is, judged against the player's current Condition Tags — replaces mpCost/stCost
  skillType?: string // freeform, e.g. "Offensive"/"Defensive"/"Utility"/"Passive"
  tier?: CompetencyTier // mastery rank — formalizes the old freeform string field onto the same 5-word scale as Attributes
  flavorText?: string // a short evocative line, distinct from `description`'s mechanical summary
  autoLogged?: boolean
  loggedAt?: string // see LocationEntry.loggedAt
  discovery?: Discovery
}

// §2 Phase D.2 — ephemeral per-encounter state, reset each fight (not part
// of the persistent Bestiary, which tracks per-species knowledge instead).
// Combat is fully narrative-adjudicated now (TACTICAL mode is gone) — the
// opponent's live state is just its own Condition Tags, same shape as the
// player's.
export interface CombatState {
  active: boolean
  enemyId?: string
  enemyName?: string
  enemyConditions?: ConditionTag[]
}

export interface ProseDepthConfig {
  label: string
  targetTokens: string
  maxOutputTokens: number
}

// §Phase A World Setup — also the World Library's stored shape (§6.4B).
export interface WorldFaction {
  id?: string
  name: string
  attitude?: 'allied' | 'friendly' | 'neutral' | 'hostile' | 'rival'
  description?: string
  territory?: string
}

export interface WorldLocation {
  id?: string
  name: string
  region?: string
  description?: string
  dangerLevel?: string
  locationType?: string
  factionOwner?: string
  areas?: string[]
}

// Client-side-only display reskin for the Threat/Power ladder — the LLM
// never sees these labels and never emits one; it only ever emits the fixed
// canonical THREAT_TIERS words (lib/tiers.ts). `labels` is an 8-entry array,
// index-aligned to THREAT_TIERS (trivial..mythic), substituted in purely for
// display wherever a threatTier word would otherwise be shown verbatim.
export interface TierSkin {
  threatLabels?: string[]
}

export interface WorldData {
  id?: string | null
  name: string
  tierSkin?: TierSkin
  mode: string
  genreTone: string
  conflict: string
  background: string
  narrationStyle: string
  powerSystem?: string // how power works here at all — magic, cultivation/cores, tech, or pure skill; deliberately not magic-only
  eraTechLevel?: string // free-form, e.g. "Medieval high fantasy", "Magitech steampunk"
  keyFactions?: string // 1-2 named factions/nations up front — context only, not yet auto-seeded into the Faction Codex
  factionsList?: WorldFaction[] // Structured factions list for fast CRUD & direct Codex seeding
  locationsList?: WorldLocation[] // Structured locations list for fast CRUD & direct Codex seeding
  sourceTitle?: string // Appendix A.1 "Title" — attribution when adapted from existing work. Original-Mode/Library worlds (e.g. starterTemplates.ts) leave sourceScope unset, so this stays attribution-only and is never sent to the model. Tale Weaving's World Foundation phase can set sourceTitle + sourceScope together to opt into lore-accuracy enforcement (see sourceScope) — presence of sourceScope is what gates that, not sourceTitle alone.
  sourceAuthor?: string // Appendix A.1 "Author" — same caveat as sourceTitle
  sourceScope?: string // Tale Weaving-only: player-declared canon boundary (e.g. "Prologue only", "through Book 1, Chapter 12") when sourceTitle names existing published work. When set alongside sourceTitle, both ARE sent to the model — as a lore-accuracy contract (stay faithful to canon facts up to this point) plus a strict spoiler boundary (never reference or foreshadow anything past it). Absence of this field is what keeps a bare sourceTitle attribution-only.
  isDefault?: boolean
  isMaster?: boolean // Immutable master preset (cannot be deleted)
  savedAt?: number // Timestamp when saved/updated in the library
}

// §Phase B Protagonist Creation — also the Protagonist Library's stored shape.
export interface ProtagonistData {
  id?: string | null
  name: string
  gender?: string
  age?: number
  classId: string
  className?: string
  background?: string // Appendix A.2 "Background" — origin/family history, distinct from `opening`'s Turn-1 scene brief
  personality?: string // demeanor/traits
  motivation?: string // core drive/want
  physicalTrait?: string // a distinguishing feature or flaw
  secret?: string // something the narrator can quietly plant hooks around
  opening: string
  customAttributes?: Attributes // Optional custom point-buy distributed STR, INT, AGI
  startingSkills?: SkillEntry[] // Optional custom starting abilities for Codex seeding
  keyItem?: string // Optional special item name the protagonist brings into the world — fleshed out into a real ItemEntry by world seeding
  isDefault?: boolean
  isMaster?: boolean // Immutable master preset (cannot be deleted)
  savedAt?: number // Timestamp when saved/updated in the library
}

// §6.6 Bang Commands — a client-side (0-token) quick-reference table or
// single-entry dossier rendered straight into the parchment, never sent to
// the model as narration. `recallText` (when set) is the plain-text snapshot
// folded into the *next* real turn's context so a targeted lookup like
// "!NPC Elana" also refreshes the model's memory of her, not just the player's.
export interface BangCommandEntry {
  command: string // display label, e.g. "NPC", "Recall"
  target?: string // the raw text after the command, if any
  rows: { name: string; id?: string; category?: KeywordLink['category']; fields: string[] }[]
  note?: string // dossier detail (deeds/memory), "not found", truncation notice, etc.
}

export interface LogEntry {
  action?: string
  nar: string
  // Chapter-relative trace id, "C{chapter}-{block}" (e.g. "C1-3" = Chapter 1,
  // 3rd narrated turn), computed client-side from turnCount and
  // CHAPTER_TURN_INTERVAL (lib/leveling.ts's turnRefFor) — never sent to the
  // model. Any Codex entry created during this turn stamps the same value on
  // its own `loggedAt`, so "what turn introduced this NPC" is answerable by
  // matching the two. Absent on synthetic entries and turns logged before
  // this field existed.
  turnRef?: string
  turnState?: TurnState
  mood?: string
  defeated?: boolean
  act?: string[]
  levelUp?: number // §5.1a — set when this turn triggered a Milestone Level-up
  breakthrough?: { attr: 'STR' | 'INT' | 'AGI'; tier: string } // §5.1c — a narrated permanent attribute breakthrough (tier is the canonical word, for display)
  chapterSummary?: string // §2 Phase E — a synthetic entry marking a chapter boundary
  chapterNumber?: number
  time?: GameTime // per-turn timestamp, absent on entries logged before this field existed
  locDisp?: string // per-turn location display, same caveat as `time`
  bang?: BangCommandEntry // §6.6 — a rendered bang-command result, not real narration
  discoveries?: { category: KeywordLink['category']; id: string; name: string }[] // §5.12 — Codex entries this turn's deltas just revealed
  eventsActivated?: string[] // §9 — Narrative Event titles this turn's deltas just activated
  classEvolution?: { className: string; reason?: string } // §5.1b — the player's single class slot was just replaced
  craftReady?: { recipeName: string; outputId: string; outputQty: number }[] // §5.8 — crafting jobs that finished this turn
  minionsDissipated?: string[] // §5.3 — familiar-branch minions whose upkeep couldn't be paid this turn
  ending?: EndingOutcome // §6.6 — this turn was the Tale's own !conclude ending; see Campaign.concluded
  // Debug payload — the exact context sent and the raw text the model
  // returned for this turn, so a player can copy it out to report a bug
  // (to a Claude session or AI Studio) without reconstructing it by hand.
  // Absent on synthetic entries (bang/chapterSummary/classEvolution) and on
  // turns logged before this field existed.
  requestPayload?: string
  rawPayload?: string
  // Gemini's own `finishReason` (STOP/MAX_TOKENS/SAFETY/...) for this turn's
  // call — the single fastest way to tell a genuine mid-sentence cutoff
  // (MAX_TOKENS) apart from every other failure mode, so it rides along
  // with the payload above rather than requiring a fresh repro to check.
  finishReason?: string
}

// §6.6 Slash Commands — an in-fiction shortcut: selecting one sends `prompt`
// through the normal turn pipeline exactly like typed prose (costs tokens,
// gets narrated). `pauseRoleplay` forces that one turn's state to PAUSE
// client-side regardless of what the model returns, for OOC-flavored prompts
// (rules questions, meta requests) that shouldn't read as in-scene action.
export interface SlashCommand {
  id: string
  name: string // invoked as /name
  prompt: string
  pauseRoleplay: boolean
}

// §8 — bump this whenever a change to Campaign's shape would need old saves
// migrated on load rather than just picking up a new field as `undefined`.
// Written on every new campaign and export; backfilled onto any older
// campaign missing it the first time it's loaded (see store.ts's
// loadCampaigns). Bumped to 2 for the Narrative-First Overhaul (numeric HP/
// MP/ST pools, StatGrant/StatBonus, and TACTICAL combat mode all gone) — no
// migration logic exists for this bump: a pre-2 save is qualitatively a
// different shape (numeric pools, not Condition Tags) that can't be
// mechanically transformed into the new one, so store.ts's loadCampaigns
// rejects/flags it rather than attempting one.
export const CURRENT_SCHEMA_VERSION = 2

// A Tale — the full persisted campaign shape (§6.4B Tales library).
export interface Campaign {
  id: string
  schemaVersion?: number // §8 — see CURRENT_SCHEMA_VERSION; optional since older saves predate this field
  title: string
  synopsis: string
  worldId?: string
  protagonistId?: string
  world: WorldData
  player: Player
  proseDepth: ProseDepthConfig
  narrationStyle: string
  locations: Dict<LocationEntry>
  regions?: Dict<RegionEntry> // §7 Region Map Pins — optional since older saves predate it
  npcs: Dict<NpcEntry>
  factions: Dict<FactionEntry>
  lore: Dict<LoreEntry>
  quests: Dict<QuestEntry>
  bestiary: Dict<BestiaryEntry>
  skills?: Dict<SkillEntry> // §6.4D — the player's known spells & abilities
  combat: CombatState
  flags: string[] // §5.6 World Impact Ledger
  inventory: Dict<number> // item id -> quantity (§5.9)
  items?: Dict<ItemEntry> // §5.9 — item id -> name/type/description/traits, the item Codex
  crafting?: CraftingJob[] // §5.8 — queued/in-progress crafting jobs, never sent to Gemini
  minions?: Dict<Minion> // §5.3 — the player's persistent summoned army
  projects?: Dict<ProjectEntry> // §7 — long-running multi-stage endeavors (construction, repair, ...), distinct from Crafting
  slashCommands?: Dict<SlashCommand> // §6.6 — this Tale's own commands, not marked global in the manager
  log: LogEntry[]
  createdAt?: number // when this Tale was first begun — optional since older saves predate the field; falls back to lastPlayed for display
  lastPlayed: number
  turnCount: number // real narrated turns only — decoupled from log.length, which also holds synthetic chapter-recap entries
  // One-time World Seeding call's raw request/response (or failure reason) —
  // there's no turn/log entry to attach this to since seeding isn't a turn.
  // Surfaced only under Debug Mode; never re-sent to the model.
  seedDebug?: { prompt: string; response?: string; error?: string }
  // §6.6 !conclude — set once the model narrates this Tale's own ending
  // turn; the client never blocks further play on it (the player may keep
  // going, e.g. to explore an epilogue), but the Chronicle surfaces it as a
  // permanent banner once present.
  concluded?: { outcome: EndingOutcome; turnRef: string }
  // §7 Pre-Authored Arc — an optional ordered outline of major story beats
  // (hand-authored via Codex CRUD today; the future Tale Weaving flow is
  // meant to author these interactively). Reaching and completing the LAST
  // beat is this Tale's "real" ending condition, superseding !conclude's
  // player-invoked quick version — turnContract.ts instructs the model to
  // also emit <end> the same turn it completes that final beat. Titles are
  // always sent to the model; a beat's `summary` is the spoiler-bearing
  // premise/goal text and is only ever surfaced once that beat is "active"
  // or later — same title-only-until-earned discipline as everything else
  // concealment-gated in this app.
  beats?: TaleBeat[]
  // §9 Narrative Events — condition-triggered story complications/scenes,
  // hand-authored via Codex CRUD, distinct from `beats` above: a beat is a
  // strictly linear main-arc spine the model advances one at a time, while a
  // Narrative Event is reactive — any number can be dormant at once, each
  // firing independently whenever real gameplay state (a flag, a location
  // visit, an NPC met, a quest completed) matches its own trigger, entirely
  // client-checked at zero LLM cost (see lib/narrativeEvents.ts, the same
  // pass discovery.ts's checkCodexReveals already runs every turn). Gives
  // the author "some control on storyline" — reactive complications that can
  // land at any point — the way `beats` gives control over the main spine.
  narrativeEvents?: Dict<NarrativeEvent>
  // §9 Death Rules — governs what happens when the player is defeated.
  // undefined/'soft_fail' (default) preserves today's only behavior exactly:
  // App.tsx's resolveDefeat() auto-chains a DESPAIR-tier recovery beat (a
  // currency penalty, Condition Tags cleared, the protagonist wakes at the
  // nearest safe location — no real death). 'permadeath' instead auto-chains
  // a genuine lose-ending via the existing <end>/Campaign.concluded
  // mechanism. `deathInstructions` is pure narration-steering prose (mirrors
  // Voyage's own `death.instructions`) applied to whichever of the two beats
  // above actually fires, regardless of which rule is active.
  deathRule?: DeathRule
  deathInstructions?: string
  // §9 End Game Rules — per-outcome narration-style instructions for the
  // Tale's own three possible endings, so a Tale's configured tone for each
  // outcome type is honored whenever the model narrates a real <end>
  // (via !conclude, the final beat completing, or a Narrative Event's own
  // guidance calling for one). Pure prose guidance, never a new triggering
  // mechanism of its own — mirrors Voyage's `endGame.win/lose/end` blocks.
  endGameRules?: Partial<Record<EndingOutcome, string>>
}

export type TaleBeatStatus = 'pending' | 'active' | 'completed' | 'skipped'

export interface TaleBeat {
  id: string
  title: string
  summary?: string
  status: TaleBeatStatus
}

export type DeathRule = 'soft_fail' | 'permadeath'

export type NarrativeEventStatus = 'dormant' | 'active' | 'completed'

// §9 Narrative Events — see Campaign.narrativeEvents. `trigger`/`condition`
// reuse Discovery's own RevealTrigger vocabulary verbatim (same "flag /
// location_visit / npc_met / quest_complete / manual" activation concept,
// checked the same way) rather than inventing a second condition language.
// `guidance` is the event's own pure narration-steering text once active —
// mirrors Voyage's freeform `story`/`instruction` effect type, never a
// mechanical state mutation; any actual state change still goes through the
// ordinary turn channels (flag_add, npc_mem_up, quest_update, ...), exactly
// like an ordinary beat. Title-only-until-active spoiler discipline mirrors
// TaleBeat: the title always shows in context (so the model knows an event
// exists), `guidance` only once `status` is 'active'.
export interface NarrativeEvent {
  id: string
  title: string
  guidance?: string
  status: NarrativeEventStatus
  trigger?: RevealTrigger
  condition?: string
}

// §9 — mirrors BeatUpdate's shape/discipline exactly: an event is never
// LLM-originated (dormant->active is the client's own trigger check, never
// the model's call), so this channel only ever lets the model mark an
// already-active event 'completed' once its guidance has played out.
export interface EventUpdate {
  event_id: string
  status: 'completed'
}

export interface ApiSettings {
  provider: string
  model: string
  apiKey: string
  temperature: number
  premiumApiKey?: string
}

// The parchment/obsidian skin toggle was retired when the app collapsed to a
// single dark-glass theme (see index.css) — a stale `skin` key may still sit in
// older saved prefs, and is simply ignored on load.
export interface UiPrefs {
  chromeOpacity: number // §3.2 — 0.1-0.9, how opaque the Chronicle header/HUD/input glass is
  debugMode?: boolean // Debug mode toggle in Settings — when ON, bypasses 4s Title delay & enables dev diagnostics
  introGazeDelay?: boolean // When true (default), Dive In pauses for 4s showing "Initializing..." to admire wallpapers
  autoCloudBackup?: boolean // Automatically save backup to Google Drive Slot 1 on chapter completion & milestones
  graphicsMode?: 'glass' | 'performance' // Graphics tab — 'performance' strips backdrop-filter blur app-wide (flat transparency, same colors) for weaker mobile GPUs
  showMusicBanners?: boolean // Toggle for Now Playing music track notification banner — default OFF
}

export interface InventoryChange {
  id: string
  qty: number
}

// §5.9 — inv_add's richer shape: item metadata arrives atomically with the
// quantity change itself, so there's no separate registration step for it
// to fall out of sync with. name/type re-supplied on a restock of an
// already-known item just re-confirms/refreshes the existing ItemEntry.
export interface InventoryAcquisition extends InventoryChange {
  name: string
  type: ItemType
  description?: string
  traits?: string[] // freeform narrative flavor tags — replaces the old numeric statBonus
}

// A single Condition Tag add/remove this turn — player-targeted by default,
// or the current combat opponent via `target: 'enemy'`. `kind`/`durationHours`
// are optional escape hatches for a genuinely novel condition name the
// client's COMMON_CONDITIONS table (lib/conditions.ts) doesn't recognize;
// the common case (a known name) needs neither.
export interface ConditionUpdate {
  target: 'player' | 'enemy'
  action: 'add' | 'remove'
  label: string
  kind?: 'duration' | 'narrative'
  durationHours?: number
}

// §5.1c Direct Stat Modification — a genuine permanent attribute breakthrough
// (a blessing, a hard-won transformation), narrated the same way
// class_evolution already is. `tier` is the canonical word for the
// attribute's new rank (never a raw number, never an increment amount) —
// the client resolves what that means for play, the model just names it.
export interface BreakthroughUpdate {
  attr: 'STR' | 'INT' | 'AGI'
  tier: CompetencyTier
}

// A per-turn content-enrichment update for an entity type that otherwise has
// no update path of its own — Lore has none at all today, and Bestiary's is
// being rebuilt in this same pass anyway. `kind` doubles as the discriminant
// and the entity-type key, mirroring the new <enrich lore="ID"|beast="ID">
// tag's own "the attribute key IS the type" grammar.
export interface EnrichUpdate {
  kind: 'lore' | 'beast'
  id: string
  desc: string
}

// §7 Pre-Authored Arc — mirrors QuestUpdate's "stat" full-word convention.
// At most one per turn (or omitted) — a beat transition is a significant
// narrative marker, not a routine per-turn field.
export interface BeatUpdate {
  beat_id: string
  status: 'active' | 'completed' | 'skipped'
}

export interface QuestUpdate {
  quest_id: string
  status: 'advanced' | 'completed' | 'failed'
  type?: QuestType // only sent the turn it's first introduced, same economy as description below
  note?: string
  description?: string // the quest's premise/objective — only sent the turn it's first introduced or its scope changes; see QuestEntry.description
}

// §7 — mirrors QuestUpdate's shape exactly (same `stat` key convention).
// Plural on TurnResponse (project_update?: ProjectUpdate[]) unlike the
// single-quest-per-turn cap — more than one project could plausibly update
// in the same turn (a construction beat AND a repair beat), and there's no
// stated reason to forbid that.
export interface ProjectUpdate {
  project_id: string
  stat: 'advanced' | 'completed' | 'stalled'
  note?: string
  stageIndex?: number // which stage in `stages` just got marked done — only meaningful on 'advanced'
}

// aff_delta/trust_delta are bare +1/-1 single-step nudges against the
// receiving CompetencyTier ladder — never a raw magnitude, never both
// omitted-as-zero vs. genuinely zero ambiguity (omit the field entirely for
// "no change"). This is the strictest version of this channel after several
// rounds of review: no signed integer string, no small-int allowance.
export interface NpcMemoryUpdate {
  npc_id: string
  aff_delta?: -1 | 1
  trust_delta?: -1 | 1
  resolve?: CompetencyTier // sets/revises this NPC's social resistance — see NpcEntry.resolve
  deed?: string
  mem_summary?: string
  held_weapon?: string // only sent when first established or visibly changed — see NpcEntry.heldWeapon
  worn_armor?: string // only sent when first established or visibly changed — see NpcEntry.wornArmor
  personality?: string // sets/revises NpcEntry.personality — only on introduction or a genuine change, restated every turn thereafter as ground truth (lib/npcs.ts describePresentNpc)
  faction_id?: string | null // sets/revises NpcEntry.factionId
  secret_truth?: string // sets/revises NpcEntry.secretTruth — known to the model as ground truth, never player-visible, never to be recited as exposition until the story itself earns the reveal
  kinship?: KinshipType // sets/revises NpcEntry.kinship — structural anchor: parent|sibling|child hard-gates against intimacy escalation (Rule 5a)
  party_status?: PartyStatus // sets/revises NpcEntry.partyStatus — only sent the turn this NPC actually joins or leaves the travelling party, never restated on an ordinary turn
}

// §5.1b Class Evolution — the model may propose replacing the player's
// single class slot outright on a rare, story-defining turn. `class_id`
// is schema-constrained (an enum of the Preset Class Dictionary) so this
// can never resolve to a class the client doesn't recognize.
export interface ClassEvolutionUpdate {
  class_id: string
  reason?: string
}

// §5.4 5-Tier Faction Reputation — a small, event-driven nudge to a named
// faction's standing (-2 to +2 scale). App-Side Rivalry (§5.4) then mirrors
// an inverse delta onto that faction's `rivalId`, entirely client-side.
export interface FactionRepChange {
  faction_id: string
  delta: number
}

export type TurnState =
  | 'PEACE'
  | 'COMBAT'
  | 'STEALTH'
  | 'DESPAIR'
  | 'EXPLORE'
  | 'INSIGHT'
  | 'SOCIAL'
  | 'INTIMACY'
  | 'PAUSE'

// §6.6 !conclude — a Tale's genuine ending, never inferred, only ever set on
// a turn the client explicitly marked as a conclusion request (see App.tsx's
// sendAction and Chronicle.tsx's `!conclude` interception).
export type EndingOutcome = 'win' | 'lose' | 'neutral'

export interface TurnResponse {
  nar: string
  turn_state: TurnState
  time: GameTime
  loc_id: string
  // Optional now, like loc_desc already was — sent only on first visit or a
  // genuine rename; the client falls back to locations[loc_id].name
  // (App.tsx) when it's omitted on an ordinary same-location turn.
  loc_disp?: string
  loc_desc?: string // only sent when loc_id is first visited or its description genuinely changes — see lib/locations.ts
  mood?: string
  copper_delta?: number // currency delta only — the numeric HP/MP/ST deltas this used to ride alongside are gone, replaced by cond_updates
  cond_updates?: ConditionUpdate[]
  inv_add?: InventoryAcquisition[]
  inv_rem?: InventoryChange[]
  corpse_add?: string[]
  breakthrough?: BreakthroughUpdate
  act: string[]
  flag_add?: string[]
  quest_update?: QuestUpdate
  beat_update?: BeatUpdate
  event_update?: EventUpdate
  event_trips?: string[] // event IDs tripped this turn via <event_trip id="..."/> for 'story' trigger narrative events
  project_update?: ProjectUpdate[]
  npc_mem_up?: NpcMemoryUpdate[]
  class_evolution?: ClassEvolutionUpdate
  fac_rep?: FactionRepChange[]
  skill_learn?: SkillLearn[]
  enrich?: EnrichUpdate[]
  // §6.6 — only present on the turn the client marked as a !conclude
  // request; never inferred from ordinary narration. See turnContract.ts
  // rule 2d.
  end?: { outcome: EndingOutcome }
}

// §6.4D — the model's side of a newly-learned skill. Snake_case mirrors the
// turn schema exactly; lib/skills.ts converts it into a SkillEntry.
export interface SkillLearn {
  id: string
  name: string
  description?: string
  class_id?: string
  effort?: EffortTier
  tier?: CompetencyTier
}

// Gemini `contents` sliding window (§3.1).
export interface HistoryPart {
  text: string
}
export interface HistoryTurn {
  role: 'user' | 'model'
  parts: HistoryPart[]
}

export interface RunTurnResult {
  ok: boolean
  turn?: TurnResponse
  fallbackText?: string
  finishReason?: string
  raw: string // the full model response, <sync> included — kept for the debug-payload tools (LogEntry.rawPayload)
  historyText: string // `raw` with <sync>...</sync> stripped — what actually gets resent as this turn's own `model` history entry, so a turn's mechanical bookkeeping isn't replayed back to the model on every later call
}

export interface KeywordLink {
  term: string
  category: 'npc' | 'loc' | 'faction' | 'lore' | 'quest' | 'beast' | 'skill' | 'item'
}

export interface EnsureResult<T> {
  dict: Dict<T>
  entry: T | null
  created: boolean
}
