import { str, num, parseXmlBlock } from './xmlHelpers.ts'

// Parses the <phase> grammar (api/taleWeaverContract.ts) — one call's worth
// of draft content for whichever single phase was active. Mirrors
// worldSeedParser.ts's own tolerant style (a missing id/name just drops
// that one entry rather than failing the whole batch) since this is
// content the player reviews and can regenerate, never a state-mutating
// turn. Every field is optional at the type level; the caller only reads
// whichever shape matches the phase it just requested.

export interface TaleWeaverWorldDraft {
  name?: string
  genreTone?: string
  conflict?: string
  powerSystem?: string
  eraTechLevel?: string
  keyFactions?: string
  background?: string
}

export interface TaleWeaverProtagonistDraft {
  name?: string
  background?: string
  personality?: string
  motivation?: string
  physicalTrait?: string
  secret?: string
  opening?: string
}

export interface TaleWeaverRegion {
  id: string
  name: string
  desc?: string
}

export interface TaleWeaverLocation {
  id: string
  name: string
  regionId?: string
  mapX?: number
  mapY?: number
  locationType?: string
  danger?: string
  desc?: string
  areas?: string
}

export interface TaleWeaverFaction {
  id: string
  name: string
  attitude?: string
  territory?: string
  desc?: string
}

export interface TaleWeaverNpc {
  id: string
  name: string
  role?: string
  personality?: string
  appearance?: string
  aff?: string
  trust?: string
}

export interface TaleWeaverLore {
  id: string
  name: string
  category?: string
  content?: string
  era?: string
  hidden?: boolean
  teaser?: string
}

export interface TaleWeaverBeat {
  id: string
  title: string
  summary?: string
}

export interface TaleWeaverDraft {
  world?: TaleWeaverWorldDraft
  protagonist?: TaleWeaverProtagonistDraft
  regions: TaleWeaverRegion[]
  locations: TaleWeaverLocation[]
  factions: TaleWeaverFaction[]
  npcs: TaleWeaverNpc[]
  lore: TaleWeaverLore[]
  beats: TaleWeaverBeat[]
}

export function parseTaleWeaverResponse(raw: string): TaleWeaverDraft {
  const doc = parseXmlBlock(raw, 'phase')

  const worldEl = doc.querySelector('world')
  const world: TaleWeaverWorldDraft | undefined = worldEl
    ? {
        name: str(worldEl.getAttribute('name')),
        genreTone: str(worldEl.getAttribute('genre_tone')),
        conflict: str(worldEl.getAttribute('conflict')),
        powerSystem: str(worldEl.getAttribute('power_system')),
        eraTechLevel: str(worldEl.getAttribute('era_tech')),
        keyFactions: str(worldEl.getAttribute('key_factions')),
        background: str(worldEl.getAttribute('background')),
      }
    : undefined

  const protagEl = doc.querySelector('protagonist')
  const protagonist: TaleWeaverProtagonistDraft | undefined = protagEl
    ? {
        name: str(protagEl.getAttribute('name')),
        background: str(protagEl.getAttribute('background')),
        personality: str(protagEl.getAttribute('personality')),
        motivation: str(protagEl.getAttribute('motivation')),
        physicalTrait: str(protagEl.getAttribute('physical_trait')),
        secret: str(protagEl.getAttribute('secret')),
        opening: str(protagEl.getAttribute('opening')),
      }
    : undefined

  const regions: TaleWeaverRegion[] = []
  for (const el of Array.from(doc.querySelectorAll('region'))) {
    const id = str(el.getAttribute('id'))
    const name = str(el.getAttribute('name'))
    if (!id || !name) continue
    regions.push({ id, name, desc: str(el.getAttribute('desc')) })
  }

  const locations: TaleWeaverLocation[] = []
  for (const el of Array.from(doc.querySelectorAll('location'))) {
    const id = str(el.getAttribute('id'))
    const name = str(el.getAttribute('name'))
    if (!id || !name) continue
    locations.push({
      id,
      name,
      regionId: str(el.getAttribute('region_id')),
      mapX: num(el.getAttribute('map_x')),
      mapY: num(el.getAttribute('map_y')),
      locationType: str(el.getAttribute('type')),
      danger: str(el.getAttribute('danger')),
      desc: str(el.getAttribute('desc')),
      areas: str(el.getAttribute('areas')),
    })
  }

  const factions: TaleWeaverFaction[] = []
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

  const npcs: TaleWeaverNpc[] = []
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
      aff: str(el.getAttribute('aff')),
      trust: str(el.getAttribute('trust')),
    })
  }

  const lore: TaleWeaverLore[] = []
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
      hidden: hidden && !!teaser,
      teaser,
    })
  }

  const beats: TaleWeaverBeat[] = []
  for (const el of Array.from(doc.querySelectorAll('beat'))) {
    const id = str(el.getAttribute('id'))
    const title = str(el.getAttribute('title'))
    if (!id || !title) continue
    beats.push({ id, title, summary: str(el.getAttribute('summary')) })
  }

  return { world, protagonist, regions, locations, factions, npcs, lore, beats }
}
