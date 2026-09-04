import { ensureEntry } from './autoRegister.ts'
import { deriveStanding, effectiveStanding } from './factions.ts'
import type { Dict, EnsureResult, FactionEntry, LocationEntry } from '../types.ts'

// §5.10 Location Auto-Registration — stub defaults for a place the model
// named (loc_id/loc_disp) that the Locations Codex doesn't have yet. Closes
// the "visited but can't look up later" gap without a new schema field or
// extra API call.
export function ensureLocation(
  locations: Dict<LocationEntry> | undefined,
  locId: string | undefined,
  locDisp: string,
): EnsureResult<LocationEntry> {
  return ensureEntry(locations, locId, () => ({
    name: locDisp,
    region: 'Unmapped',
    description: '(Auto-logged — visit again or add detail manually.)',
    dangerLevel: 'Unknown',
    factionOwner: null,
    standing: 'neutral',
  }))
}

// §3.1 — the compact re-told line that substitutes for the model's lack of
// persistent memory. Only rendered by the caller when an entry exists.
// §5.11 — Standing shown here is the derived value (from factionOwner's
// current rep tier) when it resolves to a known faction, not the raw
// stored string.
export function describeKnownLocation(entry: LocationEntry, factions: Dict<FactionEntry>): string {
  const owner = entry.factionOwner ? factions[entry.factionOwner] : null
  const standing = effectiveStanding(entry, factions)
  const label = owner ? `${standing} (${owner.name})` : entry.factionOwner ? `${standing} (${entry.factionOwner})` : standing
  return `Known Location: ${entry.name} | Danger: ${entry.dangerLevel} | Standing: ${label}`
}

// §5.11 — the one prompt-side addition: when a location's derived standing
// is Hostile, the model gets a one-line steer toward STEALTH as the expected
// approach rather than free PEACE/EXPLORE movement. Null everywhere else.
export function territoryHostileLine(entry: LocationEntry, factions: Dict<FactionEntry>): string | null {
  if (!entry.factionOwner) return null
  const owner = factions[entry.factionOwner]
  if (!owner || deriveStanding(owner.repTier) !== 'hostile') return null
  return `Territory Standing: HOSTILE (${owner.name}) — stealth approach advised.`
}
