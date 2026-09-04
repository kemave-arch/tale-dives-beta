// Turns a display name into a stable dictionary key, e.g. "Commander Valen
// Thorne" -> "valen_thorne". Stripping common titles means a {{Term|npc}}
// keyword tag and an npc_mem_up update for the same person converge on the
// same id even when only one of them includes the honorific.
const TITLES = new Set([
  'commander', 'captain', 'sir', 'lady', 'lord', 'king', 'queen', 'prince', 'princess',
  'dr', 'mr', 'mrs', 'ms', 'general', 'colonel', 'sergeant', 'father', 'mother', 'elder',
])

export function slugify(text: string): string {
  const words = text
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s_-]/g, '')
    .split(/\s+/)
    .filter(Boolean)

  const stripped = words.length > 1 ? words.filter((w) => !TITLES.has(w)) : words
  return (stripped.length ? stripped : words).join('_')
}

// The inverse direction — a schema field that only ever carries an id
// (npc_id, quest_id, etc.) needs a readable fallback display name when no
// nicer {{Term|category}} keyword link (§4.2/§5.14) has already registered
// one for that same id.
export function titleCaseId(id: string): string {
  return id.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}
