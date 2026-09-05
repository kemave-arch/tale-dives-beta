import type { Dict, FactionEntry, FactionRepChange, LocationEntry } from '../types.ts'

// §5.4 5-Tier Faction Reputation & Rivalry System.
export const REP_TIER_LABELS: Record<number, string> = {
  '-2': 'Hostile',
  '-1': 'Suspicious',
  '0': 'Neutral',
  '1': 'Favored',
  '2': 'Allied',
}

function clampTier(tier: number): number {
  return Math.max(-2, Math.min(2, Math.round(tier)))
}

export function repTierLabel(tier: number): string {
  return REP_TIER_LABELS[clampTier(tier)] ?? 'Neutral'
}

// Shared by App.tsx's player-authored Key Factions seeding and the one-time
// world-seeding pass (lib/seeding.ts) for any faction the LLM proposes —
// one mapping, not two copies of the same allied/friendly/hostile/rival ladder.
export function attitudeToRepTier(attitude: string | undefined): number {
  return attitude === 'allied' ? 2 : attitude === 'friendly' ? 1 : attitude === 'hostile' || attitude === 'rival' ? -1 : 0
}

// §5.4 App-Side Rivalry — gaining standing with a faction costs its `rivalId`
// counterpart the same amount, purely in local state, 0 API tokens. An
// unrecognized faction_id is ignored rather than fabricating an entry with
// no name — the model only ever proposes ids for factions already in the
// Codex (auto-registered via {{Term|faction}} keyword links, §5.14).
export function applyFactionRepDeltas(factions: Dict<FactionEntry>, deltas: FactionRepChange[]): Dict<FactionEntry> {
  if (!deltas || deltas.length === 0) return factions
  let next = factions
  let changed = false
  for (const d of deltas) {
    const entry = next[d.faction_id]
    if (!entry) continue
    if (!changed) {
      next = { ...next }
      changed = true
    }
    next[d.faction_id] = { ...entry, repTier: clampTier(entry.repTier + d.delta) }
    if (entry.rivalId && next[entry.rivalId]) {
      const rival = next[entry.rivalId]
      next[entry.rivalId] = { ...rival, repTier: clampTier(rival.repTier - d.delta) }
    }
  }
  return next
}

// §5.11 Faction-Owned Locations & Territory Standing.
export type TerritoryStanding = 'friendly' | 'neutral' | 'hostile'

export function deriveStanding(repTier: number): TerritoryStanding {
  if (repTier >= 1) return 'friendly'
  if (repTier <= -1) return 'hostile'
  return 'neutral'
}

// `standing` is derived, not stored, whenever `factionOwner` resolves to a
// real Faction Codex entry — recomputed from that faction's *current*
// reputation tier every time it's read, so a rep change (and its rivalry
// mirror) updates every location that faction owns for free. A location
// with no `factionOwner`, or one that doesn't resolve to a known faction id,
// falls back to its own stored `standing` string exactly as before §5.11.
export function effectiveStanding(location: LocationEntry, factions: Dict<FactionEntry>): string {
  if (!location.factionOwner) return location.standing
  const owner = factions[location.factionOwner]
  if (!owner) return location.standing
  return deriveStanding(owner.repTier)
}
