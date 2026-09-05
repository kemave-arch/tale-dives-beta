import { ensureEntry } from './autoRegister.ts'
import { slugify } from './slug.ts'
import { parseKeywordLinks } from './keywordLinks.ts'
import { ensureLocation } from './locations.ts'
import { emptyNpc } from './npcs.ts'
import { emptySkill } from './skills.ts'
import type { BestiaryEntry, Dict, FactionEntry, LocationEntry, LoreEntry, NpcEntry, QuestEntry, SkillEntry } from '../types.ts'

function ensureStub<T extends { autoLogged?: boolean }>(
  dict: Dict<T> | undefined,
  id: string,
  factory: () => Omit<T, 'autoLogged'>,
): Dict<T> {
  return ensureEntry(dict, id, factory).dict
}

// A {{Term|loc}} tag slugifies its own freeform text (lib/slug.ts), which is
// a different id space than the loc_id the model separately tracks per
// waypoint (App.tsx's ensureLocation) — so "Ironheart" mentioned inline and
// the loc_id-registered "Ironheart - Outer Gates" fork into two Codex
// entries for what's really one place, even after the hyphen/underscore
// slug fix. There's no reliable way to unify the two id spaces outright, so
// this is a heuristic backstop: skip minting a new stub when an existing
// location's name already contains (or is contained by) the tagged term.
function isKnownByName(locations: Dict<LocationEntry>, term: string): boolean {
  const needle = term.trim().toLowerCase()
  if (!needle) return false
  return Object.values(locations).some((l) => {
    const name = l.name.trim().toLowerCase()
    return name.includes(needle) || needle.includes(name)
  })
}

export interface CodexDicts {
  locations: Dict<LocationEntry>
  npcs: Dict<NpcEntry>
  factions: Dict<FactionEntry>
  lore: Dict<LoreEntry>
  quests: Dict<QuestEntry>
  bestiary: Dict<BestiaryEntry>
  skills: Dict<SkillEntry>
}

// §5.14 — applies every {{Term|category}} mention in this turn's prose to the
// matching Codex dictionary, auto-registering anything new. Locations and
// NPCs already have their own richer registration paths (loc_id/loc_disp,
// npc_mem_up) — this ADDS entries for things only mentioned in passing, and
// gives both paths a real display name (a keyword tag's Term) instead of a
// bare id, provided this runs before those other paths each turn.
export function applyKeywordLinks(codex: CodexDicts, nar: string | undefined): CodexDicts {
  let { locations, npcs, factions, lore, quests, bestiary, skills } = codex

  for (const { term, category } of parseKeywordLinks(nar)) {
    const id = slugify(term)
    if (!id) continue

    switch (category) {
      case 'loc':
        if (!isKnownByName(locations, term)) locations = ensureLocation(locations, id, term).dict
        break
      case 'npc':
        npcs = ensureStub(npcs, id, () => emptyNpc(term))
        break
      case 'faction':
        factions = ensureStub(factions, id, () => ({ name: term, repTier: 0 }))
        break
      case 'lore':
        lore = ensureStub(lore, id, () => ({ name: term, category: 'Unknown' }))
        break
      case 'quest':
        quests = ensureStub(quests, id, () => ({ name: term }))
        break
      case 'beast':
        bestiary = ensureStub(bestiary, id, () => ({ name: term, threatTier: 'Unknown' }))
        break
      case 'skill':
        skills = ensureStub(skills, id, () => emptySkill(term))
        break
    }
  }

  return { locations, npcs, factions, lore, quests, bestiary, skills }
}
