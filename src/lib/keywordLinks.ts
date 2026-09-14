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

// Items deliberately sit outside LINK_RE/parseKeywordLinks above — real
// inventory items are meant to arrive through the dedicated inv_add/<item>
// channel, not a passing mention. But turnContract.ts rule 6 has the model
// wrap ANY named item in [[Double Brackets]] purely for narration styling —
// a scabbard at an NPC's hip, a relic glimpsed on a shelf — with no
// expectation that mention alone grants or registers it. richText.tsx
// already renders every such mention as a tappable span (indistinguishable
// from one that IS registered), so a mention with no backing Codex entry
// silently no-ops when tapped — the "still unclickable" bug a live report
// traced back to a narrated [[Item]] the turn's own <sync> never granted.
// This extracts those mentions so lib/codex.ts can give each one a minimal
// stub, same economy as a {{Term|loc}}/{{Term|npc}} mention above.
const ITEM_MENTION_RE = /\[\[([^\]]+)\]\]/g

export function parseItemMentions(nar: string | undefined): string[] {
  if (!nar) return []
  const terms: string[] = []
  let match: RegExpExecArray | null
  ITEM_MENTION_RE.lastIndex = 0
  while ((match = ITEM_MENTION_RE.exec(nar))) {
    const term = match[1].replace(/\|\w+$/, '').trim()
    if (term) terms.push(term)
  }
  return terms
}
