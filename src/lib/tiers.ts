// Canonical tier vocabularies — Narrative-First Overhaul Phase 1. Every
// numeric channel this overhaul removes (HP/MP/ST pools, raw stat_grant
// amounts, NPC affection/trust deltas) is replaced by a small, fixed set of
// ordinal words the LLM must always use verbatim. `wordToTier`/`tierToWord`
// are the anti-drift guard: a word outside the given scale is a bug in the
// model's output, not something to silently coerce into a nearby number —
// same "fail loud, not quiet" posture XmlParseError already takes for a
// malformed <sync> attribute (lib/xmlHelpers.ts).
//
// Two closed scales exist today (a third, non-combat one is just a new call
// site on the same `compareTiers`, not a new scale):
//   - COMPETENCY_TIERS (5 words) — Attributes, SkillEntry.tier, NpcEntry's
//     independent affection/trust/resolve values, Player breakthroughs.
//   - THREAT_TIERS (8 words) — Bestiary adversary/hazard severity.

export const COMPETENCY_TIERS = ['Untrained', 'Novice', 'Adept', 'Expert', 'Master'] as const
export type CompetencyTierWord = (typeof COMPETENCY_TIERS)[number]

export const THREAT_TIERS = ['trivial', 'minor', 'notable', 'dangerous', 'severe', 'extreme', 'legendary', 'mythic'] as const
export type ThreatTierWord = (typeof THREAT_TIERS)[number]

// A player-facing reskin of THREAT_TIERS is purely a client-side display
// substitution (WorldData.tierSkin, set in the TaleDiveWeaver's Narrative
// node) — the LLM only ever emits the canonical words above, never a reskin
// label, so a custom label scheme can never reach the model or cause a
// parse-drift bug. A couple of built-in flavor packs plus "Plain" (the
// canonical words themselves, capitalized) cover the common cases; a fully
// custom 8-entry array is also valid input to displayThreatLabel below.
export const THREAT_LABEL_PRESETS: Record<string, string[]> = {
  plain: ['Trivial', 'Minor', 'Notable', 'Dangerous', 'Severe', 'Extreme', 'Legendary', 'Mythic'],
  rank: ['E', 'D', 'C', 'B', 'A', 'S', 'S+', 'S++'],
}

// Maps a canonical THREAT_TIERS word to its display label under a given
// skin (index-aligned, same position as THREAT_TIERS) — falls back to the
// canonical word itself (capitalized) when no skin is set or the word is
// 'unknown' (a bare {{Name|beast}} mention with no real threat rank yet has
// nothing to reskin).
export function displayThreatLabel(canonical: string, labels?: string[]): string {
  const idx = THREAT_TIERS.findIndex((w) => w === canonical)
  if (idx === -1) return canonical
  return labels?.[idx] ?? THREAT_LABEL_PRESETS.plain[idx]
}

// Player.attrs/SkillEntry.tier/NpcEntry.affection etc. store the plain 1-based
// rank (index+1) into whichever scale applies, not the word itself — the word
// is purely an LLM/UI-facing representation, converted at the boundary. The
// `CompetencyTier` type itself lives in types.ts (kept as a plain `number`,
// not a `1|2|3|4|5` literal union: the existing point-buy attribute
// allocators — NewGame.tsx, ProtagonistNodeModal.tsx — still hand out a wider 10-20-ish raw
// range today, and rescaling those pickers to a true 1-5 tier UI is Phase 6
// UI work, not this pass — see PROJECT_REVISION_NOTES for the call-out). The
// real anti-drift enforcement lives here and at the XML parser boundary
// (reqTierWord in xmlHelpers.ts), not in the static type of the field.

// Converts an internal rank (1-based) to its canonical word. Out-of-range
// ranks clamp rather than throw — this direction only ever renders a value
// the client itself already owns (a UI label), so there's nothing to guard
// against drifting from an external source; `wordToTier` below is the
// direction that actually polices LLM/XML input.
export function tierToWord<T extends readonly string[]>(rank: number, scale: T): T[number] {
  const clamped = Math.max(1, Math.min(scale.length, Math.round(rank)))
  return scale[clamped - 1]
}

// Strict word -> rank. Throws on anything outside `scale` — this is the core
// anti-drift guard: a model that writes "Godlike" or "7" where a canonical
// word belongs is a parse failure, exactly like an XmlParseError for a
// missing required attribute, not a value to coerce or default away.
export function wordToTier<T extends readonly string[]>(word: string, scale: T): number {
  const idx = scale.findIndex((w) => w.toLowerCase() === word.trim().toLowerCase())
  if (idx === -1) {
    throw new Error(`"${word}" is not a recognized tier word (expected one of: ${scale.join(', ')})`)
  }
  return idx + 1
}

// Narrative-adjudication hints — a small fixed vocabulary the JIT context
// slice hands the model as a one-line steer for how lopsided a comparison
// is, so combat/social outcomes stay narratively earned rather than a coin
// flip either way. Modeled on lib/factions.ts's `repTierLabel` (a small
// -2..+2 -> word lookup) — same shape, a lookup over a normalized scalar
// rather than a live computation, so a future call site (INSIGHT, a duel of
// wits) is just another `compareTiers(...)` call, never a new utility.
export type NarrativeHint =
  | 'hopeless — only a miracle or a clean escape saves this'
  | 'outmatched — win by cleverness, not raw force'
  | 'evenly matched — a real, uncertain contest'
  | 'favored — advantage should tell, but not trivially'
  | 'dominant — a quick, decisive resolution'

// Normalizes both ranks to 0..1 of their own scale's length before comparing,
// so a 5-word competency tier and an 8-word threat tier compare on equal
// footing (rank/scaleLen), then buckets the gap into one of the hints above.
// Thresholds are a first tuned guess, not a locked contract — revisit once
// real playtesting shows how these read in practice, same as every other
// placeholder constant in this codebase (§8 tuning items).
export function compareTiers(rankA: number, rankB: number, scaleLenA: number, scaleLenB: number): NarrativeHint {
  const normA = scaleLenA > 0 ? rankA / scaleLenA : 0
  const normB = scaleLenB > 0 ? rankB / scaleLenB : 0
  const gap = normA - normB // positive: A (usually the protagonist) has the edge

  if (gap <= -0.5) return 'hopeless — only a miracle or a clean escape saves this'
  if (gap <= -0.2) return 'outmatched — win by cleverness, not raw force'
  if (gap < 0.2) return 'evenly matched — a real, uncertain contest'
  if (gap < 0.5) return 'favored — advantage should tell, but not trivially'
  return 'dominant — a quick, decisive resolution'
}
