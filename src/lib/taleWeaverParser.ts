import type { Attributes, DeathRule, EndingOutcome, RevealTrigger } from '../types.ts'
import { str, num, parseXmlBlock, sanitizeXmlForParsing, decodeXmlEntities } from './xmlHelpers.ts'
import { COMPETENCY_TIERS, wordToTier } from './tiers.ts'

// Lenient tier-word parse for a creation-time convenience hint (the
// Protagonist phase's proposed starting attributes) — unlike a turn's own
// anti-drift-guarded fields, a missing or unrecognized word here should just
// fall through to App.tsx's own default, not fail the whole phase the way
// wordToTier's strict throw is meant to for live turn parsing.
function lenientTierWord(word: string | undefined): number | undefined {
  if (!word) return undefined
  try {
    return wordToTier(word, COMPETENCY_TIERS)
  } catch {
    return undefined
  }
}

// Codex Discovery (lib/discovery.ts's matchesReveal) auto-resolves flag/
// location_visit/npc_met/quest_complete for a hidden Codex entry — but at
// Tale Weaving time, Campaign.quests always starts empty (quests only ever
// originate from actual play, never from Tale Weaving), so a quest_complete
// reveal_cond can never reference a quest that exists yet. validateDiscovery
// (lib/discovery.ts) fails a hidden entry open to "known" the moment its own
// revealCondition doesn't resolve against the current dict — so a
// Tale-Weaving-authored quest_complete trigger would un-hide itself
// immediately at Campaign creation, before play even starts. Deliberately
// excluded here (along with 'story', Narrative-Event-only, and 'manual', the
// safe "never auto-reveals" default) — only flag/location_visit/npc_met are
// meaningful for content the model authors before any quest exists.
const DISCOVERY_REVEAL_TRIGGERS = ['flag', 'location_visit', 'npc_met'] as const

function parseRevealTrigger(el: Element): RevealTrigger | undefined {
  const trg = str(el.getAttribute('reveal_trigger'))
  return trg && (DISCOVERY_REVEAL_TRIGGERS as readonly string[]).includes(trg) ? (trg as RevealTrigger) : undefined
}

function parseXmlWithRegexFallback(raw: string): Document {
  try {
    return parseXmlBlock(raw, 'phase')
  } catch {
    const clean = sanitizeXmlForParsing(
      raw.replace(/```xml\n?/gi, '').replace(/```\n?/g, '').trim()
    )
    const doc = new DOMParser().parseFromString(`<root>${clean}</root>`, 'text/xml')
    const parseError = doc.querySelector('parsererror')
    if (!parseError) return doc

    // Secondary repair attempt: fix unclosed quotes before > or />
    const repaired = clean.replace(/=([a-zA-Z0-9_\-\.\:\/]+)([\s/>])/g, '="$1"$2')
    const repairedDoc = new DOMParser().parseFromString(`<root>${repaired}</root>`, 'text/xml')
    if (!repairedDoc.querySelector('parsererror')) return repairedDoc

    // Ultimate resilient fallback: construct a DOM Document directly via regex extraction
    const mockDoc = document.implementation.createDocument(null, 'root', null)
    const root = mockDoc.documentElement

    const tagRegex = /<([a-zA-Z0-9_]+)\s+([^>]*)\/?>/g
    let match: RegExpExecArray | null
    while ((match = tagRegex.exec(clean)) !== null) {
      const [, tagName, attrChunk] = match
      if (tagName === 'root' || tagName === 'phase') continue
      const el = mockDoc.createElement(tagName)
      const attrRegex = /([a-zA-Z0-9_-]+)=(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g
      let attrMatch: RegExpExecArray | null
      while ((attrMatch = attrRegex.exec(attrChunk)) !== null) {
        const key = attrMatch[1]
        const val = attrMatch[2] ?? attrMatch[3] ?? attrMatch[4] ?? ''
        el.setAttribute(key, decodeXmlEntities(val))
      }
      root.appendChild(el)
    }
    return mockDoc
  }
}

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
  // Player-typed, not model-produced — TaleWeaver.tsx's World Foundation phase
  // sets these directly from its own form fields and merges them onto
  // whatever draft.world the phase call returns, the same way it already
  // owns `name` as an editable field post-generation. See WorldData's own
  // sourceScope comment (types.ts) for the lore-accuracy contract this gates.
  sourceTitle?: string
  sourceAuthor?: string
  sourceScope?: string
  // The "Source Accurate" toggle (TaleWeaver.tsx's own checkbox, and Quick
  // Play's — see QuickPlay.tsx) — a separate on/off signal from sourceTitle
  // itself, so a player can name a novel purely as loose flavor/inspiration
  // (toggle off) without committing to strict canon fidelity, or leave it on
  // (the default) for real accuracy enforcement. Undefined (an old save/
  // preset predating this field) reads as on, matching this field's
  // pre-existing behavior of gating purely on sourceTitle's own presence.
  sourceAccurate?: boolean
}

export interface TaleWeaverProtagonistDraft {
  name?: string
  // Male/female, model-inferred from the protagonist described — used purely
  // to pick the matching Dive-In/setup wallpaper art (lib/setupBgResolver.ts),
  // never narrated or treated as a story trait.
  gender?: string
  background?: string
  personality?: string
  motivation?: string
  physicalTrait?: string
  secret?: string
  opening?: string
  portraitKey?: string
  // Free-text class/archetype name (e.g. "Warrior", "Dragon Rider", or an
  // original one fitting the world) — normalized at Tale creation via
  // data/classes.ts's getClassById, which always succeeds (no fixed
  // dictionary to fail against), so the model is free to propose anything.
  classHint?: string
  // Starting STR/INT/AGI, proposed by the model to fit the character's own
  // lore-accurate archetype (a fragile scribe-hopeful starts low STR/AGI,
  // high INT) rather than a generic RPG-class stat curve. Per-attribute —
  // a missing or unrecognized tier word just falls through to App.tsx's own
  // flat default, not a parse failure.
  attrs?: Partial<Attributes>
}

export interface TaleWeaverSkill {
  id: string
  name: string
  desc?: string
  effort?: string
  tier?: string
}

export interface TaleWeaverRegion {
  id: string
  name: string
  desc?: string
  mapImageKey?: string
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
  imageKey?: string
  hidden?: boolean
  teaser?: string
  revealTrigger?: RevealTrigger
  revealCondition?: string
}

export interface TaleWeaverFaction {
  id: string
  name: string
  attitude?: string
  territory?: string
  desc?: string
  hidden?: boolean
  teaser?: string
  revealTrigger?: RevealTrigger
  revealCondition?: string
}

export interface TaleWeaverNpc {
  id: string
  name: string
  role?: string
  personality?: string
  appearance?: string
  aff?: string
  trust?: string
  portraitKey?: string
  hidden?: boolean
  teaser?: string
  revealTrigger?: RevealTrigger
  revealCondition?: string
}

export interface TaleWeaverLore {
  id: string
  name: string
  category?: string
  content?: string
  era?: string
  hidden?: boolean
  teaser?: string
  revealTrigger?: RevealTrigger
  revealCondition?: string
}

export interface TaleWeaverBeat {
  id: string
  title: string
  summary?: string
}

export interface TaleWeaverNarrativeEvent {
  id: string
  title: string
  trigger?: RevealTrigger
  condition?: string
  guidance?: string
}

export interface TaleWeaverDraft {
  world?: TaleWeaverWorldDraft
  protagonist?: TaleWeaverProtagonistDraft
  regions: TaleWeaverRegion[]
  locations: TaleWeaverLocation[]
  factions: TaleWeaverFaction[]
  npcs: TaleWeaverNpc[]
  lore: TaleWeaverLore[]
  skills: TaleWeaverSkill[]
  beats: TaleWeaverBeat[]
  narrativeEvents: TaleWeaverNarrativeEvent[]
  deathRule?: DeathRule
  deathInstructions?: string
  endGameRules?: Partial<Record<EndingOutcome, string>>
}

export function parseTaleWeaverResponse(raw: string): TaleWeaverDraft {
  const doc = parseXmlWithRegexFallback(raw)

  const worldEl = doc.querySelector('world')
  const world: TaleWeaverWorldDraft | undefined = worldEl
    ? {
        name: str(worldEl.getAttribute('name')),
        genreTone: str(worldEl.getAttribute('genre_tone')) || str(worldEl.getAttribute('genre')) || str(worldEl.getAttribute('tone')),
        conflict: str(worldEl.getAttribute('conflict')) || str(worldEl.getAttribute('core_conflict')) || str(worldEl.getAttribute('regional_conflict')),
        powerSystem: str(worldEl.getAttribute('power_system')) || str(worldEl.getAttribute('magic_system')) || str(worldEl.getAttribute('magic')),
        eraTechLevel:
          str(worldEl.getAttribute('era_tech')) ||
          str(worldEl.getAttribute('era_technology')) ||
          str(worldEl.getAttribute('tech_era')) ||
          str(worldEl.getAttribute('era_tech_level')) ||
          [
            str(worldEl.getAttribute('era')),
            str(worldEl.getAttribute('technology') || worldEl.getAttribute('tech') || worldEl.getAttribute('tech_level')),
          ]
            .filter(Boolean)
            .join(' / ') ||
          undefined,
        keyFactions: str(worldEl.getAttribute('key_factions')) || str(worldEl.getAttribute('factions')),
        background: str(worldEl.getAttribute('background')) || str(worldEl.getAttribute('world_background')) || str(worldEl.getAttribute('desc')),
      }
    : undefined

  const protagEl = doc.querySelector('protagonist')
  const protagonist: TaleWeaverProtagonistDraft | undefined = protagEl
    ? {
        name: str(protagEl.getAttribute('name')),
        gender: str(protagEl.getAttribute('gender')),
        background: str(protagEl.getAttribute('background')) || str(protagEl.getAttribute('backstory')),
        personality: str(protagEl.getAttribute('personality')) || str(protagEl.getAttribute('traits')),
        motivation: str(protagEl.getAttribute('motivation')) || str(protagEl.getAttribute('goal')),
        physicalTrait: str(protagEl.getAttribute('physical_trait')) || str(protagEl.getAttribute('appearance')) || str(protagEl.getAttribute('trait')),
        secret: str(protagEl.getAttribute('secret')) || str(protagEl.getAttribute('hidden')),
        opening: str(protagEl.getAttribute('opening')) || str(protagEl.getAttribute('opening_scene')),
        classHint: str(protagEl.getAttribute('class')) || str(protagEl.getAttribute('archetype')),
        attrs: {
          STR: lenientTierWord(str(protagEl.getAttribute('str'))),
          INT: lenientTierWord(str(protagEl.getAttribute('int'))),
          AGI: lenientTierWord(str(protagEl.getAttribute('agi'))),
        },
      }
    : undefined

  const skills: TaleWeaverSkill[] = []
  for (const el of Array.from(doc.querySelectorAll('skill'))) {
    const id = str(el.getAttribute('id'))
    const name = str(el.getAttribute('name'))
    if (!id || !name) continue
    skills.push({
      id,
      name,
      desc: str(el.getAttribute('desc')),
      effort: str(el.getAttribute('effort')),
      tier: str(el.getAttribute('tier')),
    })
  }

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
      hidden: el.getAttribute('hidden') === '1' && !!str(el.getAttribute('tease')),
      teaser: str(el.getAttribute('tease')),
      revealTrigger: parseRevealTrigger(el),
      revealCondition: str(el.getAttribute('reveal_cond')),
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
      hidden: el.getAttribute('hidden') === '1' && !!str(el.getAttribute('tease')),
      teaser: str(el.getAttribute('tease')),
      revealTrigger: parseRevealTrigger(el),
      revealCondition: str(el.getAttribute('reveal_cond')),
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
      hidden: el.getAttribute('hidden') === '1' && !!str(el.getAttribute('tease')),
      teaser: str(el.getAttribute('tease')),
      revealTrigger: parseRevealTrigger(el),
      revealCondition: str(el.getAttribute('reveal_cond')),
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
      revealTrigger: parseRevealTrigger(el),
      revealCondition: str(el.getAttribute('reveal_cond')),
    })
  }

  const beats: TaleWeaverBeat[] = []
  for (const el of Array.from(doc.querySelectorAll('beat'))) {
    const id = str(el.getAttribute('id'))
    const title = str(el.getAttribute('title'))
    if (!id || !title) continue
    beats.push({ id, title, summary: str(el.getAttribute('summary')) })
  }

  const narrativeEvents: TaleWeaverNarrativeEvent[] = []
  for (const el of Array.from(doc.querySelectorAll('narrative_event'))) {
    const id = str(el.getAttribute('id'))
    const title = str(el.getAttribute('title'))
    if (!id || !title) continue
    const trg = str(el.getAttribute('trigger'))
    const trigger: RevealTrigger | undefined =
      trg && (['flag', 'location_visit', 'npc_met', 'quest_complete', 'story', 'manual'] as const).includes(trg as any)
        ? (trg as RevealTrigger)
        : undefined
    narrativeEvents.push({
      id,
      title,
      trigger,
      condition: str(el.getAttribute('cond')),
      guidance: str(el.getAttribute('guide')),
    })
  }

  const deathRuleEl = doc.querySelector('death_rule')
  const deathMode = deathRuleEl ? str(deathRuleEl.getAttribute('mode')) : undefined
  const deathRule: DeathRule | undefined = deathMode === 'permadeath' || deathMode === 'soft_fail' ? deathMode : undefined
  const deathInstructions = deathRuleEl ? str(deathRuleEl.getAttribute('instructions')) : undefined

  const endEl = doc.querySelector('end_game')
  const win = endEl ? str(endEl.getAttribute('win')) : undefined
  const lose = endEl ? str(endEl.getAttribute('lose')) : undefined
  const neutral = endEl ? str(endEl.getAttribute('neutral')) : undefined
  const endGameRules: Partial<Record<EndingOutcome, string>> | undefined =
    win || lose || neutral ? { ...(win ? { win } : {}), ...(lose ? { lose } : {}), ...(neutral ? { neutral } : {}) } : undefined

  return { world, protagonist, regions, locations, factions, npcs, lore, skills, beats, narrativeEvents, deathRule, deathInstructions, endGameRules }
}
