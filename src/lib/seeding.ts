import type { ApiSettings, Dict, FactionEntry, ItemEntry, LocationEntry, LoreEntry, NpcEntry, QuestEntry, WorldFaction, WorldLocation } from '../types.ts'
import { getProvider } from '../api/providers/index.ts'
import { buildWorldSeedSystemInstructions } from '../api/worldSeedContract.ts'
import { MAX_OUTPUT_TOKENS_CEILING } from '../api/turnContract.ts'
import { parseWorldSeedResponse } from './worldSeedParser.ts'
import { validateDiscovery } from './discovery.ts'
import { attitudeToRepTier } from './factions.ts'
import { slugify } from './slug.ts'
import { parseStatBonus } from './xmlHelpers.ts'

// The one-time World Seeding pass — fires once at campaign creation,
// between the player-authored setup (World Setup's Key Factions/Locations
// CRUD, Protagonist Setup's Starting Abilities/Key Item) and Turn 1. It
// exists to cover what that player-authored CRUD deliberately leaves
// optional and empty by default: Lore, starting NPC relations, an optional
// personal Ambition quest, and — only when the player left those lists
// blank — a small Location/Faction fallback, plus fleshing a named key item
// into a real ItemEntry.
//
// Deliberately never throws and never blocks campaign creation: a failed or
// malformed seeding call degrades to "no enrichment this campaign," not a
// broken Tale Dive. Debug info (the raw prompt/response, or the failure
// reason) is always returned so Debug Mode can show what happened.

export interface SeedCampaignInput {
  apiSettings: ApiSettings
  worldLines: string[]
  protagonistLines: string[]
  briefLine: string
  existingFactions: WorldFaction[]
  existingLocations: WorldLocation[]
  startingSkillNames: string[]
  keyItemName?: string
}

export interface SeedCampaignResult {
  lore: Dict<LoreEntry>
  npcs: Dict<NpcEntry>
  quests: Dict<QuestEntry>
  locations: Dict<LocationEntry>
  factions: Dict<FactionEntry>
  items: Dict<ItemEntry>
  inventory: Dict<number>
  debug: { prompt: string; response?: string; error?: string }
}

function buildSeedPrompt(input: SeedCampaignInput): string {
  const lines = [...input.worldLines, ...input.protagonistLines, input.briefLine]

  lines.push(
    input.existingFactions.length > 0
      ? `Player-authored factions already in the Codex (do not duplicate, do not re-propose under a different name): ${input.existingFactions.map((f) => f.name).join(', ')}. Do NOT emit any <faction> tags.`
      : 'No factions exist yet for this world — propose 1-3 <faction> entries.',
  )
  lines.push(
    input.existingLocations.length > 0
      ? `Player-authored locations already in the Codex (do not duplicate): ${input.existingLocations.map((l) => l.name).join(', ')}. Do NOT emit any <location> tags.`
      : 'No locations exist yet for this world — propose 1-3 <location> entries.',
  )
  if (input.startingSkillNames.length > 0) {
    lines.push(`The protagonist already knows these starting abilities (fully defined elsewhere — for narrative awareness only, do not re-invent them): ${input.startingSkillNames.join(', ')}.`)
  }
  if (input.keyItemName?.trim()) {
    lines.push(`Flesh out this key item the protagonist is bringing into the world: "${input.keyItemName.trim()}" — emit exactly one <item> tag for it.`)
  }

  return lines.filter(Boolean).join('\n')
}

// A seeded location/faction only fires when the player's own list came back
// empty (see buildSeedPrompt), so there's no player-authored id to collide
// with in practice — this guard exists anyway as a defensive backstop in
// case the model ignores the "do not duplicate" instruction.
function uniqueId(name: string, existingIds: Set<string>, prefix = ''): string {
  const base = prefix + slugify(name)
  if (!existingIds.has(base)) return base
  let i = 2
  while (existingIds.has(`${base}_${i}`)) i++
  return `${base}_${i}`
}

export async function seedCampaign(input: SeedCampaignInput): Promise<SeedCampaignResult> {
  const prompt = buildSeedPrompt(input)
  const empty: SeedCampaignResult = { lore: {}, npcs: {}, quests: {}, locations: {}, factions: {}, items: {}, inventory: {}, debug: { prompt } }

  let raw: string
  try {
    raw = await getProvider(input.apiSettings.provider).runSeed({
      apiKey: input.apiSettings.apiKey,
      model: input.apiSettings.model,
      temperature: input.apiSettings.temperature,
      maxOutputTokens: MAX_OUTPUT_TOKENS_CEILING,
      systemInstructions: buildWorldSeedSystemInstructions(),
      prompt,
    })
  } catch (err) {
    return { ...empty, debug: { prompt, error: err instanceof Error ? err.message : String(err) } }
  }

  let seed: ReturnType<typeof parseWorldSeedResponse>
  try {
    seed = parseWorldSeedResponse(raw)
  } catch (err) {
    return { ...empty, debug: { prompt, response: raw, error: err instanceof Error ? err.message : String(err) } }
  }

  const lore: Dict<LoreEntry> = {}
  for (const l of seed.lore) {
    const id = slugify(l.id) || slugify(l.name)
    if (!id || lore[id]) continue
    lore[id] = {
      name: l.name,
      category: l.category?.trim() || 'General',
      content: l.content?.trim() || undefined,
      era: l.era?.trim() || undefined,
      discovery: l.hidden ? validateDiscovery({ state: 'hidden', revealTrigger: 'manual', teaser: l.teaser }, { locations: {}, npcs: {}, quests: {} }) : undefined,
    }
  }

  const npcs: Dict<NpcEntry> = {}
  for (const n of seed.npcs) {
    const id = slugify(n.id) || slugify(n.name)
    if (!id || npcs[id]) continue
    npcs[id] = {
      name: n.name,
      role: n.role?.trim() || undefined,
      personality: n.personality?.trim() || undefined,
      appearance: n.appearance?.trim() || undefined,
      affection: n.aff ?? 0,
      trust: n.trust ?? 0,
      stage: 'Stranger',
      deeds: [],
      memSummary: '',
      lastSeenLocId: null,
    }
  }

  const quests: Dict<QuestEntry> = {}
  if (seed.quest) {
    const id = slugify(seed.quest.id) || slugify(seed.quest.name)
    if (id) {
      quests[id] = { name: seed.quest.name, description: seed.quest.desc?.trim() || undefined, type: 'ambition' }
    }
  }

  const existingLocIds = new Set(input.existingLocations.map((l) => 'loc_' + slugify(l.name)))
  const locations: Dict<LocationEntry> = {}
  for (const l of seed.locations) {
    const id = uniqueId(l.name, existingLocIds, 'loc_')
    existingLocIds.add(id)
    locations[id] = {
      name: l.name,
      region: l.region?.trim() || 'Known World',
      description: l.desc?.trim() || '',
      dangerLevel: l.danger || 'Safe',
      factionOwner: null,
      standing: 'neutral',
      locationType: l.locationType || 'Landmark',
      discovery: { state: 'known' },
    }
  }

  const existingFacIds = new Set(input.existingFactions.map((f) => 'fac_' + slugify(f.name)))
  const factions: Dict<FactionEntry> = {}
  for (const f of seed.factions) {
    const id = uniqueId(f.name, existingFacIds, 'fac_')
    existingFacIds.add(id)
    factions[id] = {
      name: f.name,
      repTier: attitudeToRepTier(f.attitude),
      description: f.desc?.trim() || undefined,
      territory: f.territory?.trim() || undefined,
      tags: f.attitude ? [f.attitude] : undefined,
      discovery: { state: 'known' },
    }
  }

  const items: Dict<ItemEntry> = {}
  const inventory: Dict<number> = {}
  if (seed.item) {
    const id = slugify(seed.item.id) || slugify(seed.item.name)
    if (id) {
      items[id] = {
        name: seed.item.name,
        type: seed.item.type,
        description: seed.item.desc?.trim() || undefined,
        statBonus: seed.item.bonus?.trim() ? parseStatBonus(seed.item.bonus) : undefined,
      }
      inventory[id] = 1
    }
  }

  return { lore, npcs, quests, locations, factions, items, inventory, debug: { prompt, response: raw } }
}
