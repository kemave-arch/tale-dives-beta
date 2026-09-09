import type { BeatUpdate, TaleBeat } from '../types.ts'

// §7 Pre-Authored Arc — unlike Quests/Projects, a beat is never LLM-
// originated: it only ever comes from hand-authored Codex CRUD (or, later,
// the Tale Weaving flow). A beat_id that doesn't match an existing beat is
// a no-op rather than a stub — inventing one here would silently fabricate
// arc structure the player never actually authored.
export function applyBeatUpdate(beats: TaleBeat[] | undefined, update: BeatUpdate | undefined): TaleBeat[] | undefined {
  if (!beats?.length || !update?.beat_id) return beats
  const idx = beats.findIndex((b) => b.id === update.beat_id)
  if (idx === -1) return beats
  const next = [...beats]
  next[idx] = { ...next[idx], status: update.status }
  return next
}
