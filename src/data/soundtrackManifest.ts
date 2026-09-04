// Soundtrack filenames in public/tracks/ — hand-maintained since browsers have no
// API to list a directory's contents, so this is the only way the app can know
// what's actually there. Play order comes from a `_ostNN` suffix on the filename
// itself (e.g. `battle_theme_ost01.opus`), parsed in backgroundMusic.tsx — a name
// with no such suffix just falls back to this array's own order, so adding a track
// is always safe even before it's been given an explicit position. Add, remove, or
// rename an entry here to match whatever's actually in public/tracks/ — unlike the
// old sequential-filename scheme this replaced, that step is no longer optional.

export interface TrackMetadata {
  filename: string
  title: string
  album: string
  artist: string
  durationEstimate?: string
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

export function getTrackMetadata(srcOrFilename: string): TrackMetadata {
  const filename = srcOrFilename.split('/').pop() || srcOrFilename
  const found = SOUNDTRACK_TRACKS.find((t) => t.filename.toLowerCase() === filename.toLowerCase())
  if (found) return found

  // Clean fallback if a new track is added
  const cleanTitle = filename
    .replace(/\.[^.]+$/, '')
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


