import type { KeywordLink } from '../types.ts'

// §4.2/§5.14 — {{Term|category}} keyword links. Pure client-side string
// parsing over the streamed `nar` text; the model only tags, the client
// decides what becomes a Codex entry (§5.14), so this costs nothing extra
// to run — no new API call, no new schema field.
const LINK_RE = /\{\{([^{}|]+)\|(npc|loc|faction|lore|quest|beast|skill)\}\}/g

export function parseKeywordLinks(nar: string | undefined): KeywordLink[] {
  if (!nar) return []
  const links: KeywordLink[] = []
  let match: RegExpExecArray | null
  LINK_RE.lastIndex = 0
  while ((match = LINK_RE.exec(nar))) {
    links.push({ term: match[1].trim(), category: match[2] as KeywordLink['category'] })
  }
  return links
}

// Display-only cleanup — renders "{{Mira Sorrengail|npc}}" as "Mira Sorrengail"
// rather than leaking the raw tag syntax into what the player reads.
export function stripKeywordLinks(nar: string | undefined): string | undefined {
  if (!nar) return nar
  return nar.replace(LINK_RE, '$1')
}
