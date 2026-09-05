// Shared type definitions for Tale Dives' game state. Kept in one place so
// every lib/screen module agrees on the same shapes — this is the concrete
// payoff of the TypeScript conversion: several real bugs earlier in this
// build (a missing `time` field, a missing `locations` field after a schema
// change) were exactly the class of mistake these types now catch at
// compile time instead of requiring a browser round-trip to discover.

export type Dict<T> = Record<string, T>

export interface Attributes {
  STR: number
  INT: number
  AGI: number
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
  hp: number
  hpMax: number
  mp: number
  mpMax: number
  st: number
  stMax: number
  copper: number
  locId: string
  locDisp: string
  time: GameTime
  equipped?: Partial<Record<EquipSlot, string>> // §5.9 — slot -> equipped item id
}

// §5.9 Item Type Taxonomy — a closed set; only these three carry a
// stat_bonus and occupy an equip slot (1:1 with ItemType, one slot each).
export type ItemType = 'weapon' | 'armor' | 'accessory' | 'tool' | 'key' | 'consumable' | 'material'
export type EquipSlot = 'weapon' | 'armor' | 'accessory'
export const EQUIPPABLE_TYPES: ItemType[] = ['weapon', 'armor', 'accessory']

// Flat, all-optional deltas applied on equip and reversed (negated) on
// unequip — STR/INT/AGI recompute derived HP/MP/ST max (same math as
// stat_grant); hp/mp/st bonuses add directly to that pool's max.
export interface StatBonus {
  STR?: number
  INT?: number
  AGI?: number
  hp?: number
  mp?: number
  st?: number
}

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
  statBonus?: StatBonus // only meaningful when type is weapon/armor/accessory
  rarity?: string // freeform, e.g. "Common"/"Rare"/"Legendary" — flavor, not a game-mechanical gate
  loreText?: string // an evocative line distinct from `description`'s mechanical summary
  value?: number // freeform currency worth, player/CRUD-set only
  tags?: string[]
}

// §5.12 Codex Discovery ("Fog of Lore") — an entry with no `discovery` field
// (or `state: 'known'`) is always fully visible; this is the common case,
// since only hand-authored CRUD entries can currently become `hidden` (there
// is no seeding/grounding call yet that pre-populates masked lore). Reveal
// checks run client-side each turn (§5.12) against the turn's own deltas —
// no new LLM call, no schema field on the turn response itself.
export type RevealTrigger = 'flag' | 'location_visit' | 'npc_met' | 'quest_complete' | 'manual'

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
  discovery?: Discovery
}

// §5.5/§5.14 NPC Codex entry.
export interface NpcEntry {
  name: string
  gender?: string // player-set via Codex CRUD only — never asked of the model (§3.6, no new schema field)
  age?: number
  affection: number
  trust: number
  stage: string
  deeds: string[]
  memSummary: string
  lastSeenLocId: string | null
  role?: string // freeform, e.g. "Blacksmith"/"Rival Cadet"/"Court Advisor"
  appearance?: string // freeform physical description
  heldWeapon?: string // currently wielded weapon, set/updated via npc_mem_up.held_weapon — restated every turn they're present (jitContext.ts) so an established detail can't silently drift turn to turn
  wornArmor?: string // currently worn armor/notable gear, same tracking as heldWeapon
  personality?: string // freeform trait summary
  voiceNotes?: string // how they speak — a steering note for the player, not sent to the model
  factionId?: string | null // affiliation, mirrors LocationEntry's factionOwner
  firstSeenTime?: GameTime // set once, at stub creation — same anti-drift anchor as LocationEntry's
  lastSeenTime?: GameTime // updated on every npc_mem_up touch
  tags?: string[]
  autoLogged?: boolean
  discovery?: Discovery
}

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
  discovery?: Discovery
}

export interface QuestEntry {
  name: string
  status?: 'advanced' | 'completed' | 'failed'
  note?: string
  description?: string // the quest's actual premise/objective, distinct from `note`'s short status update
  questGiver?: string // freeform NPC name/reference
  reward?: string // freeform
  tags?: string[]
  autoLogged?: boolean
  discovery?: Discovery
}

// §5.13 Bestiary entry — hpMax/dmgBase are only present once a beast has
// actually entered Tactical combat (§2 Phase D.2); a passing {{Name|beast}}
// mention alone only registers name/threatTier.
export interface BestiaryEntry {
  name: string
  threatTier: string
  hpMax?: number
  dmgBase?: number
  description?: string // freeform appearance/behavior
  habitat?: string // freeform
  weaknesses?: string // freeform
  lootTable?: string // freeform, e.g. "Bone Dust, Cursed Fang"
  tags?: string[]
  autoLogged?: boolean
  discovery?: Discovery
}

// §6.4D Codex category 6 — Skills (Spells & Abilities). Every field past the
// name is optional on purpose: a skill is usually *mentioned* in prose (as
// [Shadow Step], §4.2) well before it has agreed numbers, and the blueprint
// deliberately leaves skill base values open rather than pre-specced (§8).
// §3.2 affordability therefore only gates a skill that actually declares a
// cost — an unpriced skill is never blocked, just narrated.
export interface SkillEntry {
  name: string
  description?: string
  classId?: string // owning class, a Preset Class Dictionary id (§6.4D card shows its icon)
  mpCost?: number
  stCost?: number
  skillType?: string // freeform, e.g. "Offensive"/"Defensive"/"Utility"/"Passive"
  tier?: string // freeform progression marker, e.g. "Novice"/"Adept"/"Master"
  flavorText?: string // a short evocative line, distinct from `description`'s mechanical summary
  autoLogged?: boolean
  discovery?: Discovery
}

// §2 Phase D.2 — ephemeral per-encounter state, reset each fight (not part
// of the persistent Bestiary, which tracks per-species knowledge instead).
export interface CombatState {
  active: boolean
  enemyId?: string
  enemyName?: string
  enemyHp?: number
  enemyHpMax?: number
  enemyDmgBase?: number
}

export interface ProseDepthConfig {
  label: string
  targetTokens: string
  maxOutputTokens: number
}

export type CombatMode = 'TACTICAL' | 'NARRATIVE'

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
}

export interface WorldData {
  id?: string | null
  name: string
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
  sourceTitle?: string // Appendix A.1 "Title" — attribution only when adapted from existing work; never sent to the model
  sourceAuthor?: string // Appendix A.1 "Author" — same caveat as sourceTitle
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
  turnState?: TurnState
  mood?: string
  defeated?: boolean
  act?: string[]
  levelUp?: number // §5.1a — set when this turn triggered a Milestone Level-up
  chapterSummary?: string // §2 Phase E — a synthetic entry marking a chapter boundary
  chapterNumber?: number
  time?: GameTime // per-turn timestamp, absent on entries logged before this field existed
  locDisp?: string // per-turn location display, same caveat as `time`
  bang?: BangCommandEntry // §6.6 — a rendered bang-command result, not real narration
  discoveries?: { category: KeywordLink['category']; id: string; name: string }[] // §5.12 — Codex entries this turn's deltas just revealed
  classEvolution?: { className: string; reason?: string } // §5.1b — the player's single class slot was just replaced
  craftReady?: { recipeName: string; outputId: string; outputQty: number }[] // §5.8 — crafting jobs that finished this turn
  minionsDissipated?: string[] // §5.3 — familiar-branch minions whose upkeep couldn't be paid this turn
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
// loadCampaigns). No migration logic exists yet because nothing has needed
// one yet — this only pays off the day something does.
export const CURRENT_SCHEMA_VERSION = 1

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
  combatMode: CombatMode
  proseDepth: ProseDepthConfig
  narrationStyle: string
  locations: Dict<LocationEntry>
  npcs: Dict<NpcEntry>
  factions: Dict<FactionEntry>
  lore: Dict<LoreEntry>
  quests: Dict<QuestEntry>
  bestiary: Dict<BestiaryEntry>
  skills?: Dict<SkillEntry> // §6.4D — the player's known spells & abilities
  combat: CombatState
  flags: string[] // §5.6 World Impact Ledger
  inventory: Dict<number> // item id -> quantity (§5.9)
  items?: Dict<ItemEntry> // §5.9 — item id -> name/type/description/statBonus, the item Codex
  crafting?: CraftingJob[] // §5.8 — queued/in-progress crafting jobs, never sent to Gemini
  minions?: Dict<Minion> // §5.3 — the player's persistent summoned army
  corpses?: string[] // §5.3 — harvestable slain-enemy tags accumulated from corpse_add, consumed by `!arise`
  slashCommands?: Dict<SlashCommand> // §6.6 — this Tale's own commands, not marked global in the manager
  log: LogEntry[]
  lastPlayed: number
  turnCount: number // real narrated turns only — decoupled from log.length, which also holds synthetic chapter-recap entries
}

export interface ApiSettings {
  provider: string
  model: string
  apiKey: string
  temperature: number
}

// The parchment/obsidian skin toggle was retired when the app collapsed to a
// single dark-glass theme (see index.css) — a stale `skin` key may still sit in
// older saved prefs, and is simply ignored on load.
export interface UiPrefs {
  chromeOpacity: number // §3.2 — 0.1-0.9, how opaque the Chronicle header/HUD/input glass is
  debugMode?: boolean // Debug mode toggle in Settings — when ON, bypasses 4s Title delay & enables dev diagnostics
  introGazeDelay?: boolean // When true (default), Dive In pauses for 4s showing "Initializing..." to admire wallpapers
}

// §7.3 JSON Schema — the shape of a single turn response from the model.
export interface TurnDelta {
  hp?: number
  mp?: number
  st?: number
  c?: number
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
  statBonus?: StatBonus
}

export interface StatGrant {
  attr?: 'STR' | 'INT' | 'AGI'
  pool?: 'hp' | 'mp' | 'st'
  amount: number
}

export interface QuestUpdate {
  quest_id: string
  status: 'advanced' | 'completed' | 'failed'
  note?: string
  description?: string // the quest's premise/objective — only sent the turn it's first introduced or its scope changes; see QuestEntry.description
}

export interface NpcMemoryUpdate {
  npc_id: string
  aff_delta?: number
  trust_delta?: number
  deed?: string
  mem_summary?: string
  held_weapon?: string // only sent when first established or visibly changed — see NpcEntry.heldWeapon
  worn_armor?: string // only sent when first established or visibly changed — see NpcEntry.wornArmor
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

export interface TurnResponse {
  nar: string
  turn_state: TurnState
  time: GameTime
  loc_disp: string
  loc_id: string
  loc_desc?: string // only sent when loc_id is first visited or its description genuinely changes — see lib/locations.ts
  dist?: 'c' | 'm' | 'f' | 'none'
  mood?: string
  deltas?: TurnDelta
  inv_add?: InventoryAcquisition[]
  inv_rem?: InventoryChange[]
  corpse_add?: string[]
  stat_grant?: StatGrant
  act: string[]
  flag_add?: string[]
  quest_update?: QuestUpdate
  npc_mem_up?: NpcMemoryUpdate[]
  class_evolution?: ClassEvolutionUpdate
  fac_rep?: FactionRepChange[]
  skill_learn?: SkillLearn[]
}

// §6.4D — the model's side of a newly-learned skill. Snake_case mirrors the
// turn schema exactly; lib/skills.ts converts it into a SkillEntry.
export interface SkillLearn {
  id: string
  name: string
  description?: string
  class_id?: string
  mp_cost?: number
  st_cost?: number
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
  raw: string
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
