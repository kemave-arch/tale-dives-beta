import { ensureEntry } from './autoRegister.ts'
import { deriveStanding, effectiveStanding } from './factions.ts'
import type { Dict, EnsureResult, FactionEntry, GameTime, LocationEntry } from '../types.ts'

// §5.10 Location Auto-Registration — stub defaults for a place the model
// named (loc_id/loc_disp) that the Locations Codex doesn't have yet. Closes
// the "visited but can't look up later" gap without a new schema field or
// extra API call. `description`/`time` are optional so callers that only
// have loc_id/loc_disp (e.g. a keyword-tag alias, see lib/codex.ts) still
// work — a stub without a real description falls back to the placeholder,
// same as before this field existed.
export function ensureLocation(
  locations: Dict<LocationEntry> | undefined,
  locId: string | undefined,
  locDisp: string,
  description?: string,
  time?: GameTime,
): EnsureResult<LocationEntry> {
  const result = ensureEntry(locations, locId, () => ({
    name: locDisp,
    region: 'Unmapped',
    description: description || '(Auto-logged — visit again or add detail manually.)',
    dangerLevel: 'Unknown',
    factionOwner: null,
    standing: 'neutral',
    firstVisitedTime: time,
    lastVisitedTime: time,
  }))
  if (!result.entry || !locId) return result

  // Re-visiting an already-known location: refresh lastVisitedTime every
  // time, but only overwrite description when the model actually sent a new
  // one (§5.10 — "only on first visit or a genuine change", same economy as
  // quest_update.description) rather than re-asserting the placeholder.
  const updated: LocationEntry = {
    ...result.entry,
    lastVisitedTime: time ?? result.entry.lastVisitedTime,
    description: (!result.created && description) || result.entry.description,
  }
  return { dict: { ...result.dict, [locId]: updated }, entry: updated, created: result.created }
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
  // First Seen is an explicit real-clock anchor — a check against invented
  // "it's been weeks since you were last here" narration when the record
  // says otherwise (§temporal grounding, alongside the chapter-recap fix).
  const firstSeen = entry.firstVisitedTime ? ` | First Seen: Day ${entry.firstVisitedTime.d} ${entry.firstVisitedTime.h}` : ''
  return `Known Location: ${entry.name} | Danger: ${entry.dangerLevel} | Standing: ${label}${firstSeen}`
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
