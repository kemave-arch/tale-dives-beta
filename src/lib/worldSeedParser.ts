import type { ItemType } from '../types.ts'
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
  aff?: number
  trust?: number
}

export interface SeededQuest {
  id: string
  name: string
  desc?: string
}

export interface SeededLocation {
  id: string
  name: string
  region?: string
  locationType?: string
  danger?: string
  desc?: string
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
  bonus?: string
}

export interface WorldSeedResult {
  lore: SeededLore[]
  npcs: SeededNpc[]
  quest?: SeededQuest
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
    npcs.push({
      id,
      name,
      role: str(el.getAttribute('role')),
      personality: str(el.getAttribute('personality')),
      appearance: str(el.getAttribute('appearance')),
      aff: num(el.getAttribute('aff')),
      trust: num(el.getAttribute('trust')),
    })
  }

  const questEl = doc.querySelector('quest')
  const questId = questEl ? str(questEl.getAttribute('id')) : undefined
  const questName = questEl ? str(questEl.getAttribute('name')) : undefined
  const quest: SeededQuest | undefined =
    questEl && questId && questName ? { id: questId, name: questName, desc: str(questEl.getAttribute('desc')) } : undefined

  const locations: SeededLocation[] = []
  for (const el of Array.from(doc.querySelectorAll('location'))) {
    const id = str(el.getAttribute('id'))
    const name = str(el.getAttribute('name'))
    if (!id || !name) continue
    locations.push({
      id,
      name,
      region: str(el.getAttribute('region')),
      locationType: str(el.getAttribute('type')),
      danger: str(el.getAttribute('danger')),
      desc: str(el.getAttribute('desc')),
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
      ? { id: itemId, name: itemName, type: itemType as ItemType, desc: str(itemEl.getAttribute('desc')), bonus: str(itemEl.getAttribute('bonus')) }
      : undefined

  return { lore, npcs, quest, locations, factions, item }
}

export { XmlParseError as WorldSeedParseError }
