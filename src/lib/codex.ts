import { ensureEntry } from './autoRegister.ts'
import { slugify } from './slug.ts'
import { parseKeywordLinks } from './keywordLinks.ts'
import { ensureLocation } from './locations.ts'
import { emptyNpc } from './npcs.ts'
import { emptySkill } from './skills.ts'
import type { BestiaryEntry, Dict, FactionEntry, LocationEntry, LoreEntry, NpcEntry, QuestEntry, SkillEntry } from '../types.ts'

function ensureStub<T extends { autoLogged?: boolean; loggedAt?: string }>(
  dict: Dict<T> | undefined,
  id: string,
  factory: () => Omit<T, 'autoLogged'>,
  turnRef?: string,
): Dict<T> {
  return ensureEntry(dict, id, factory, turnRef).dict
}

// A {{Term|category}} tag slugifies its own freeform text (lib/slug.ts),
// which is a different id space than a loc_id/npc_mem_up id the model
// separately tracks (App.tsx's ensureLocation/applyNpcUpdates) — so
// "Ironheart" mentioned inline and the loc_id-registered "Ironheart - Outer
// Gates" fork into two Codex entries for what's really one place, even
// after the hyphen/underscore slug fix. There's no reliable way to unify
// the two id spaces outright, so this is a heuristic backstop: skip minting
// a new stub when an existing entry's name already contains (or is
// contained by) the tagged term — e.g. "Navarre" tagged as a faction when
// "Navarre High Command" is already a registered faction.
function isKnownByName<T extends { name: string }>(dict: Dict<T> | undefined, term: string): boolean {
  const needle = term.trim().toLowerCase()
  if (!needle || !dict) return false
  return Object.values(dict).some((entry) => {
    const name = entry.name.trim().toLowerCase()
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
//
// `playerName` guards a distinct failure mode from the dedup heuristic
// above: the model occasionally self-tags the protagonist as {{Name|npc}}
// (they're the player, not an NPC) — there's no existing "Kei Ashborn" NPC
// entry to fuzzy-match against, so this needs its own explicit check.
export function applyKeywordLinks(codex: CodexDicts, nar: string | undefined, turnRef?: string, playerName?: string): CodexDicts {
  let { locations, npcs, factions, lore, quests, bestiary, skills } = codex
  const playerNameLower = playerName?.trim().toLowerCase()

  for (const { term, category } of parseKeywordLinks(nar)) {
    const id = slugify(term)
    if (!id) continue

    switch (category) {
      case 'loc':
        if (!isKnownByName(locations, term)) locations = ensureLocation(locations, id, term, undefined, undefined, turnRef).dict
        break
      case 'npc':
        if (term.trim().toLowerCase() === playerNameLower) break
        if (!isKnownByName(npcs, term)) npcs = ensureStub(npcs, id, () => emptyNpc(term), turnRef)
        break
      case 'faction':
        if (!isKnownByName(factions, term)) factions = ensureStub(factions, id, () => ({ name: term, repTier: 0 }), turnRef)
        break
      case 'lore':
        lore = ensureStub(lore, id, () => ({ name: term, category: 'Unknown' }), turnRef)
        break
      case 'quest':
        quests = ensureStub(quests, id, () => ({ name: term }), turnRef)
        break
      case 'beast':
        bestiary = ensureStub(bestiary, id, () => ({ name: term, threatTier: 'unknown' as const }), turnRef)
        break
      case 'skill':
        skills = ensureStub(skills, id, () => emptySkill(term), turnRef)
        break
    }
  }

  return { locations, npcs, factions, lore, quests, bestiary, skills }
}
