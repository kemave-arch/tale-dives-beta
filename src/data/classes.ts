import type { ClassDef } from '../types.ts'

// Freeform class resolution — no fixed archetype dictionary. A class is
// whatever label the LLM (or a player) proposes, normalized into a stable
// id/display-name pair. Always succeeds — the same lenient, never-rejected
// treatment Tale Weaving's classHint and (in practice) skill_learn's
// class_id already got, now extended to Class Evolution and every other
// call site too, since a lore-accurate archetype can't be enumerated ahead
// of time the way a generic RPG class dictionary could.
export function getClassById(id?: string): ClassDef {
  const trimmed = (id ?? '').trim()
  if (!trimmed) return { id: 'adventurer', name: 'Adventurer' }
  const words = trimmed.split(/[\s_]+/).filter(Boolean)
  const name = words.map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')
  const slugId = words.map((w) => w.toLowerCase()).join('_')
  return { id: slugId, name }
}
