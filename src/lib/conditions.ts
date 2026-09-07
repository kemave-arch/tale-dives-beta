import { addHoursToGameTime, isTimeReached } from './gameTime.ts'
import type { ConditionTag, GameTime } from '../types.ts'

// Condition Tags — Narrative-First Overhaul Phase 1. Replaces the numeric
// HP/MP/ST pools entirely: instead of a delta chipping away at a bar, a turn
// adds/removes a small, named narrative status (Bleeding, Exhausted,
// Blessed, ...) via the new <cond> sync tag (xmlTurnContract.ts). Two kinds:
//   - 'duration': expires on its own once enough in-fiction time has passed
//     (Bleeding, Exhausted) — no LLM upkeep required to clear it.
//   - 'narrative': persists until the story itself removes it (<cond rem>) —
//     a curse, a broken bone, a debt owed — never silently auto-expires.
// This mirrors lib/crafting.ts's own job-queue shape (start, a duration, a
// resolution check run once per turn) closely enough to reuse its exact time
// primitives rather than inventing a second one.

// Well-known condition names the client recognizes without the model having
// to say anything more than the bare name — <cond add="Bleeding" /> alone is
// enough; `dur_h`/`kind` on the tag are escape hatches for anything not in
// this table (or for deliberately overriding it). Not exhaustive — a mundane
// fantasy-RPG starter set covering the common combat/exposure/blessing cases.
export const COMMON_CONDITIONS: Record<string, { kind: 'duration' | 'narrative'; durationHours?: number }> = {
  bleeding: { kind: 'duration', durationHours: 2 },
  exhausted: { kind: 'duration', durationHours: 6 },
  winded: { kind: 'duration', durationHours: 1 },
  poisoned: { kind: 'duration', durationHours: 8 },
  stunned: { kind: 'duration', durationHours: 0.5 },
  dazed: { kind: 'duration', durationHours: 1 },
  drenched: { kind: 'duration', durationHours: 3 },
  frostbitten: { kind: 'duration', durationHours: 12 },
  nauseated: { kind: 'duration', durationHours: 4 },
  blessed: { kind: 'duration', durationHours: 24 },
  invisible: { kind: 'duration', durationHours: 1 },
  // Persist until the story itself lifts them — never auto-expire.
  cursed: { kind: 'narrative' },
  wounded: { kind: 'narrative' },
  branded: { kind: 'narrative' },
  bonded: { kind: 'narrative' },
}

function slugifyLabel(label: string): string {
  return label.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'condition'
}

// Adds (or refreshes) a condition by display label. Lookup order: the
// COMMON_CONDITIONS table first (the common, zero-extra-attribute case),
// then the caller's own kind/durationHours override (the model's `dur_h`/
// `kind` escape hatch for a genuinely novel condition), and only when
// neither applies does it default to 'narrative' — an unrecognized condition
// is NEVER silently treated as auto-expiring, per the design brief. Adding a
// condition that's already present (by slug) replaces it in place (refreshes
// expiresAt) rather than duplicating the tag.
export function addCondition(
  conditions: ConditionTag[],
  label: string,
  currentTime: GameTime,
  opts?: { kind?: 'duration' | 'narrative'; durationHours?: number },
): ConditionTag[] {
  const trimmed = label.trim()
  if (!trimmed) return conditions
  const id = slugifyLabel(trimmed)
  const known = COMMON_CONDITIONS[id]

  const kind = known?.kind ?? opts?.kind ?? 'narrative'
  const durationHours = known?.durationHours ?? opts?.durationHours
  const expiresAt = kind === 'duration' && durationHours !== undefined ? addHoursToGameTime(currentTime, durationHours) : undefined

  const next: ConditionTag = { id, label: trimmed, kind, expiresAt }
  const withoutExisting = conditions.filter((c) => c.id !== id)
  return [...withoutExisting, next]
}

export function removeCondition(conditions: ConditionTag[], label: string): ConditionTag[] {
  const id = slugifyLabel(label)
  return conditions.filter((c) => c.id !== id)
}

// Drops any duration-based condition whose clock has run out, using the same
// isTimeReached comparison lib/crafting.ts's resolveCraftingJobs already
// relies on for its own job queue — one time-comparison primitive, reused.
export function expireConditions(conditions: ConditionTag[], currentTime: GameTime): ConditionTag[] {
  return conditions.filter((c) => !(c.kind === 'duration' && c.expiresAt && isTimeReached(currentTime, c.expiresAt)))
}
