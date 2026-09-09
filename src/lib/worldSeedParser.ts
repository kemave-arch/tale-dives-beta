import type { ItemType, KinshipType } from '../types.ts'
import { KINSHIP_VALUES } from '../types.ts'
import { XmlParseError, str, num, parseXmlBlock } from './xmlHelpers.ts'

// Parses the <seed> grammar (api/worldSeedContract.ts) returned by the
// one-time world-seeding call. Unlike parseXmlTurnResponse, a single
// malformed *entry* doesn't fail the whole batch — only a missing id/name
// (the two fields lib/seeding.ts needs to mint a Codex key at all) drops
// that one entry; everything else is best-effort optional, since this is a
// one-time content-enrichment pass, not a state-mutating turn where a
// missing field could desync the game.

export interface SeededLore {
  id: string
  name: string
  category?: string
  content?: string
  era?: string
  hidden?: boolean
  teaser?: string
}

export interface SeededNpc {
  id: string
  name: string
  role?: string
  personality?: string
  appearance?: string
  kinship?: KinshipType
  // Starting relationship, expressed as the same canonical tier word the
  // rest of the app already displays (npcs.ts's AFFECTION_STAGES/
  // TRUST_WORDS) — never a numeric offset. Absent means "unset/neutral,"
  // resolved to the floor tier by lib/seeding.ts.
  aff?: string
  trust?: string
}

export interface SeededQuest {
  id: string
  name: string
  desc?: string
}

export interface SeededRegion {
  id: string
  name: string
  desc?: string
}

export interface SeededLocation {
  id: string
  name: string
  region?: string
  regionId?: string
  mapX?: number
  mapY?: number
  locationType?: string
  danger?: string
  desc?: string
  areas?: string // comma-separated sub-area names, same shape as a turn's <item traits="...">
}

export interface SeededFaction {
  id: string
  name: string
  attitude?: string
  territory?: string
  desc?: string
}

export interface SeededItem {
  id: string
  name: string
  type: ItemType
  desc?: string
  traits?: string // freeform narrative flavor tags, comma-separated — same shape as a turn's <item traits="...">, never a numeric stat bonus
}

export interface WorldSeedResult {
  lore: SeededLore[]
  npcs: SeededNpc[]
  quest?: SeededQuest
  regions: SeededRegion[]
  locations: SeededLocation[]
  factions: SeededFaction[]
  item?: SeededItem
}

export function parseWorldSeedResponse(raw: string): WorldSeedResult {
  const doc = parseXmlBlock(raw, 'seed')

  const lore: SeededLore[] = []
  for (const el of Array.from(doc.querySelectorAll('lore'))) {
    const id = str(el.getAttribute('id'))
    const name = str(el.getAttribute('name'))
    if (!id || !name) continue
    const hidden = el.getAttribute('hidden') === '1'
    const teaser = str(el.getAttribute('tease'))
    lore.push({
      id,
      name,
      category: str(el.getAttribute('category')),
      content: str(el.getAttribute('content')),
      era: str(el.getAttribute('era')),
      hidden: hidden && !!teaser, // never hidden without a teaser — same "both or neither" rule the grammar asks for
      teaser,
    })
  }

  const npcs: SeededNpc[] = []
  for (const el of Array.from(doc.querySelectorAll('npc'))) {
    const id = str(el.getAttribute('id'))
    const name = str(el.getAttribute('name'))
    if (!id || !name) continue
    const kinWord = str(el.getAttribute('kin'))
    const kinship = kinWord && (KINSHIP_VALUES as readonly string[]).includes(kinWord) ? (kinWord as KinshipType) : undefined
    npcs.push({
      id,
      name,
      role: str(el.getAttribute('role')),
      personality: str(el.getAttribute('personality')),
      appearance: str(el.getAttribute('appearance')),
      kinship,
      aff: str(el.getAttribute('aff')),
      trust: str(el.getAttribute('trust')),
    })
  }

  const questEl = doc.querySelector('quest')
  const questId = questEl ? str(questEl.getAttribute('id')) : undefined
  const questName = questEl ? str(questEl.getAttribute('name')) : undefined
  const quest: SeededQuest | undefined =
    questEl && questId && questName ? { id: questId, name: questName, desc: str(questEl.getAttribute('desc')) } : undefined

  const regions: SeededRegion[] = []
  for (const el of Array.from(doc.querySelectorAll('region'))) {
    const id = str(el.getAttribute('id'))
    const name = str(el.getAttribute('name'))
    if (!id || !name) continue
    regions.push({ id, name, desc: str(el.getAttribute('desc')) })
  }

  const locations: SeededLocation[] = []
  for (const el of Array.from(doc.querySelectorAll('location'))) {
    const id = str(el.getAttribute('id'))
    const name = str(el.getAttribute('name'))
    if (!id || !name) continue
    locations.push({
      id,
      name,
      region: str(el.getAttribute('region')),
      regionId: str(el.getAttribute('region_id')),
      mapX: num(el.getAttribute('map_x')),
      mapY: num(el.getAttribute('map_y')),
      locationType: str(el.getAttribute('type')),
      danger: str(el.getAttribute('danger')),
      desc: str(el.getAttribute('desc')),
      areas: str(el.getAttribute('areas')),
    })
  }

  const factions: SeededFaction[] = []
  for (const el of Array.from(doc.querySelectorAll('faction'))) {
    const id = str(el.getAttribute('id'))
    const name = str(el.getAttribute('name'))
    if (!id || !name) continue
    factions.push({
      id,
      name,
      attitude: str(el.getAttribute('attitude')),
      territory: str(el.getAttribute('territory')),
      desc: str(el.getAttribute('desc')),
    })
  }

  const itemEl = doc.querySelector('item')
  const itemId = itemEl ? str(itemEl.getAttribute('id')) : undefined
  const itemName = itemEl ? str(itemEl.getAttribute('name')) : undefined
  const itemType = itemEl ? str(itemEl.getAttribute('type')) : undefined
  const item: SeededItem | undefined =
    itemEl && itemId && itemName && itemType
      ? { id: itemId, name: itemName, type: itemType as ItemType, desc: str(itemEl.getAttribute('desc')), traits: str(itemEl.getAttribute('traits')) }
      : undefined

  return { lore, npcs, quest, regions, locations, factions, item }
}

export { XmlParseError as WorldSeedParseError }
