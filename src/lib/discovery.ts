import type {
  BestiaryEntry, Dict, Discovery, FactionEntry, KeywordLink, LocationEntry, LoreEntry, NpcEntry, QuestEntry, TurnResponse,
} from '../types.ts'

// §5.12 Codex Discovery ("Fog of Lore") — zero-token reveal checks, run
// client-side every turn against fields the turn response already contains.
// Mirrors the Location Auto-Registration (§5.10) / Faction Standing (§5.11)
// pattern: no new LLM call, no new schema field on the turn response itself.
export interface DiscoveredEntry {
  category: KeywordLink['category']
  id: string
  name: string
}

export function isHidden(entry: { discovery?: Discovery }): boolean {
  return entry.discovery?.state === 'hidden'
}

// Fails a hidden entry open to `known` if its own revealCondition doesn't
// actually reference a real id in the seeded/current dicts — an unreachable
// hidden entry (a typo'd loc_id, a quest_id nothing ever creates) is a worse
// bug than one revealed a little early. Shared by the manual Codex CRUD
// editor and the one-time world-seeding pass (lib/seeding.ts), since both
// can propose a `discovery` block that references an id the other hasn't
// necessarily created yet.
export function validateDiscovery(
  discovery: Discovery | undefined,
  dicts: { locations: Record<string, unknown>; npcs: Record<string, unknown>; quests: Record<string, unknown> },
): Discovery | undefined {
  if (!discovery || discovery.state !== 'hidden' || !discovery.revealCondition) return discovery
  const dict =
    discovery.revealTrigger === 'location_visit' ? dicts.locations :
    discovery.revealTrigger === 'npc_met' ? dicts.npcs :
    discovery.revealTrigger === 'quest_complete' ? dicts.quests :
    null
  if (!dict || dict[discovery.revealCondition]) return discovery
  return { ...discovery, state: 'known' }
}

function matchesReveal(discovery: Discovery, turn: TurnResponse, nextFlags: string[]): boolean {
  if (!discovery.revealTrigger || !discovery.revealCondition) return false
  switch (discovery.revealTrigger) {
    case 'flag':
      return nextFlags.includes(discovery.revealCondition)
    case 'location_visit':
      return turn.loc_id === discovery.revealCondition
    case 'npc_met':
      return turn.npc_mem_up?.some((u) => u.npc_id === discovery.revealCondition) ?? false
    case 'quest_complete':
      return turn.quest_update?.quest_id === discovery.revealCondition && turn.quest_update.status === 'completed'
    case 'manual':
      return false // only the player, via CRUD, ever reveals a manual-trigger entry
  }
}

function revealDict<T extends { name: string; discovery?: Discovery }>(
  dict: Dict<T>,
  category: KeywordLink['category'],
  turn: TurnResponse,
  nextFlags: string[],
): { dict: Dict<T>; revealed: DiscoveredEntry[] } {
  const revealed: DiscoveredEntry[] = []
  let changed = false
  const out: Dict<T> = dict

  for (const [id, entry] of Object.entries(dict)) {
    if (!isHidden(entry) || !matchesReveal(entry.discovery!, turn, nextFlags)) continue
    if (!changed) {
      changed = true
    }
    revealed.push({ category, id, name: entry.name })
  }

  if (!changed) return { dict, revealed }

  const next: Dict<T> = { ...out }
  for (const r of revealed) {
    next[r.id] = { ...next[r.id], discovery: { ...next[r.id].discovery!, state: 'known' } }
  }
  return { dict: next, revealed }
}

export interface DiscoverableDicts {
  npcs: Dict<NpcEntry>
  locations: Dict<LocationEntry>
  factions: Dict<FactionEntry>
  lore: Dict<LoreEntry>
  quests: Dict<QuestEntry>
  bestiary: Dict<BestiaryEntry>
}

// Runs the reveal check across every Codex category in one pass. `nextFlags`
// is the already-merged flag list for this turn (§5.6) since a `flag`-trigger
// reveal should fire the same turn the flag itself lands, not one turn late.
export function checkCodexReveals(dicts: DiscoverableDicts, turn: TurnResponse, nextFlags: string[]): DiscoverableDicts & { revealed: DiscoveredEntry[] } {
  const npcs = revealDict(dicts.npcs, 'npc', turn, nextFlags)
  const locations = revealDict(dicts.locations, 'loc', turn, nextFlags)
  const factions = revealDict(dicts.factions, 'faction', turn, nextFlags)
  const lore = revealDict(dicts.lore, 'lore', turn, nextFlags)
  const quests = revealDict(dicts.quests, 'quest', turn, nextFlags)
  const bestiary = revealDict(dicts.bestiary, 'beast', turn, nextFlags)

  return {
    npcs: npcs.dict,
    locations: locations.dict,
    factions: factions.dict,
    lore: lore.dict,
    quests: quests.dict,
    bestiary: bestiary.dict,
    revealed: [...npcs.revealed, ...locations.revealed, ...factions.revealed, ...lore.revealed, ...quests.revealed, ...bestiary.revealed],
  }
}
