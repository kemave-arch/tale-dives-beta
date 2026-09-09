// Soundtrack filenames in public/tracks/ — hand-maintained since browsers have no
// API to list a directory's contents, so this is the only way the app can know
// what's actually there. Play order comes from a `_ostNN` suffix on the filename
// itself (e.g. `battle_theme_ost01.opus`), parsed in backgroundMusic.tsx — a name
// with no such suffix just falls back to this array's own order, so adding a track
// is always safe even before it's been given an explicit position. Add, remove, or
// rename an entry here to match whatever's actually in public/tracks/ — unlike the
// old sequential-filename scheme this replaced, that step is no longer optional.
//
// A `ts-<state>_` prefix (e.g. `ts-combat_ironclash_ost00.opus`) opts a track
// into a Turn State pool instead of the ambient rotation — see TURN_STATE_PREFIX
// in backgroundMusic.tsx, which switches to that pool whenever the active turn
// enters that state and crossfades back to ambient when it leaves. The state
// name is case-insensitive and must match a TurnState value (peace, combat,
// stealth, despair, explore, insight, social, intimacy, pause); anything else
// is just treated as part of the ambient rotation instead.

import type { TurnState } from '../types.ts'

export interface TrackMetadata {
  filename: string
  title: string
  album: string
  artist: string
  durationEstimate?: string
  // §7 Mood Tag Matching — freeform lowercase words (e.g. "tense", "triumphant",
  // "melancholy") describing this track's own emotional register, matched
  // against a turn's "mood" ambient sensory tag (turnContract.ts's own
  // "3-6 word ambient sensory tag" field) to pick a better-fitting track
  // within a Turn State pool that has more than one. Entirely optional —
  // an untagged track (every one shipped today) just keeps the existing
  // sequential-rotation behavior; this only activates once real dual-mixed
  // variants with distinct moods exist for the same Turn State.
  moodTags?: string[]
}

export const SOUNDTRACK_TRACKS: TrackMetadata[] = [
  {
    filename: 'RisingCore_ost00.opus',
    title: 'Rising Core',
    album: 'Tale Dives OST',
    artist: 'Kem.Ave',
  },
  {
    filename: 'NewTales_ost01.opus',
    title: 'New Tales',
    album: 'Tale Dives OST',
    artist: 'Kem.Ave',
  },
  {
    filename: 'WhoAmI_ost02.opus',
    title: 'Who Am I',
    album: 'Tale Dives OST',
    artist: 'Kem.Ave',
  },
  {
    filename: 'TempestDive_ost03.opus',
    title: 'Tempest Dive',
    album: 'Tale Dives OST',
    artist: 'Kem.Ave',
  },
  {
    filename: 'Lionheart_ost04.opus',
    title: 'Lionheart',
    album: 'Tale Dives OST',
    artist: 'Kem.Ave',
  },
  {
    filename: 'Stratosphere_ost05.opus',
    title: 'Stratosphere',
    album: 'Tale Dives OST',
    artist: 'Kem.Ave',
  },
  {
    filename: 'RiseNFall_ost06.opus',
    title: 'Rise & Fall',
    album: 'Tale Dives OST',
    artist: 'Kem.Ave',
  },
]

export const TRACK_FILENAMES = SOUNDTRACK_TRACKS.map((t) => t.filename)

export const TURN_STATES: TurnState[] = ['PEACE', 'COMBAT', 'STEALTH', 'DESPAIR', 'EXPLORE', 'INSIGHT', 'SOCIAL', 'INTIMACY', 'PAUSE']
const TURN_STATE_PREFIX = /^ts-([a-z]+)_/i

// Parses the `ts-<state>_` prefix, e.g. `ts-combat_ironclash_ost00.opus` -> 'COMBAT'.
// Unrecognized or absent prefixes return null — the track just stays ambient.
export function parseTurnState(filename: string): TurnState | null {
  const match = filename.match(TURN_STATE_PREFIX)
  if (!match) return null
  const candidate = match[1].toUpperCase() as TurnState
  return TURN_STATES.includes(candidate) ? candidate : null
}

// §7 Mood Tag Matching — scores each candidate in `pool` (full src paths,
// same shape backgroundMusic.tsx's pools already use) against a turn's
// mood string by counting whole-word tag hits, case-insensitive. Returns
// the single best-scoring src, or null when nothing scores above zero —
// the caller (backgroundMusic.tsx's enterState) falls back to its existing
// sequential rotation in that case, so a pool with no tagged tracks (every
// pool today) is completely unaffected. Never throws.
export function pickTrackByMood(pool: string[], mood: string | undefined | null): string | null {
  if (!mood?.trim() || pool.length === 0) return null
  const words = mood.toLowerCase().match(/[a-z']+/g)
  if (!words) return null
  const wordSet = new Set(words)

  let best: { src: string; score: number } | null = null
  for (const src of pool) {
    const tags = getTrackMetadata(src).moodTags
    if (!tags?.length) continue
    const score = tags.reduce((n, tag) => n + (wordSet.has(tag.toLowerCase()) ? 1 : 0), 0)
    if (score > 0 && (!best || score > best.score)) best = { src, score }
  }
  return best?.src ?? null
}

export function getTrackMetadata(srcOrFilename: string): TrackMetadata {
  const filename = srcOrFilename.split('/').pop() || srcOrFilename
  const found = SOUNDTRACK_TRACKS.find((t) => t.filename.toLowerCase() === filename.toLowerCase())
  if (found) return found

  // Clean fallback if a new track is added
  const cleanTitle = filename
    .replace(/\.[^.]+$/, '')
    .replace(TURN_STATE_PREFIX, '')
    .replace(/_ost\d+/i, '')
    .replace(/([A-Z])/g, ' $1')
    .trim()

  return {
    filename,
    title: cleanTitle || 'Atmospheric Theme',
    album: 'Tale Dives OST',
    artist: 'Kem.Ave',
  }
}


