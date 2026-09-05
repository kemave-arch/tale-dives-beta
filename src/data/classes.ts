import type { ClassDef } from '../types.ts'

// Preset Class Dictionary — Blueprint §5.1a. Each weight vector sums to 1.0.
export const PRESET_CLASSES: ClassDef[] = [
  { id: 'warrior', name: 'Warrior', weights: { STR: 0.6, INT: 0.1, AGI: 0.3 } },
  { id: 'assassin', name: 'Assassin', weights: { STR: 0.15, INT: 0.15, AGI: 0.7 } },
  { id: 'dragon_rider', name: 'Dragon Rider', weights: { STR: 0.35, INT: 0.3, AGI: 0.35 } },
  { id: 'dark_monarch', name: 'Shadow Monarch', weights: { STR: 0.55, INT: 0.2, AGI: 0.25 } },
  { id: 'necromancer', name: 'Necromancer', weights: { STR: 0.2, INT: 0.55, AGI: 0.25 } },
  { id: 'summoner', name: 'Summoner', weights: { STR: 0.15, INT: 0.45, AGI: 0.4 } },
  { id: 'mage', name: 'Mage', weights: { STR: 0.05, INT: 0.7, AGI: 0.25 } },
  { id: 'tank', name: 'Tank', weights: { STR: 0.7, INT: 0.05, AGI: 0.25 } },
  { id: 'paladin', name: 'Paladin', weights: { STR: 0.4, INT: 0.4, AGI: 0.2 } },
  // Blueprint Appendix A.2 — a genuinely non-combat, INT-heavy starting class
  // (trained for scholarly work, not the battlefield); a valid Class Evolution
  // target can still move a character out of this later (§5.1b).
  { id: 'apprentice_scribe', name: 'Scribe', weights: { STR: 0.1, INT: 0.65, AGI: 0.25 } },
]

export function getClassById(id: string): ClassDef {
  const norm = id.toLowerCase()
  const found = PRESET_CLASSES.find(
    (c) => c.id === norm || c.name.toLowerCase() === norm || (norm === 'scribe' && c.id === 'apprentice_scribe')
  )
  if (found) return found
  const displayName = id.includes('_')
    ? id.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
    : (id.charAt(0).toUpperCase() + id.slice(1))
  return {
    id: norm.replace(/\s+/g, '_'),
    name: displayName || 'Adventurer',
    weights: { STR: 0.34, INT: 0.33, AGI: 0.33 },
  }
}

// Strict lookup for §5.1b Class Evolution — unlike getClassById's lenient
// fallback (used for resolving an already-persisted, trusted classId), a
// model- or CRUD-proposed evolution target must be validated as real before
// anything is changed, so an unrecognized id here means "reject," not "warrior."
export function findClassById(id: string): ClassDef | undefined {
  const norm = id.toLowerCase()
  return PRESET_CLASSES.find(
    (c) => c.id === norm || c.name.toLowerCase() === norm || (norm === 'scribe' && c.id === 'apprentice_scribe')
  )
}
