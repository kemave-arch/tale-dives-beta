// Soundtrack filenames in public/tracks/ — hand-maintained since browsers have no
// API to list a directory's contents, so this is the only way the app can know
// what's actually there. Play order comes from a `_ostNN` suffix on the filename
// itself (e.g. `battle_theme_ost01.opus`), parsed in backgroundMusic.tsx — a name
// with no such suffix just falls back to this array's own order, so adding a track
// is always safe even before it's been given an explicit position. Add, remove, or
// rename an entry here to match whatever's actually in public/tracks/ — unlike the
// old sequential-filename scheme this replaced, that step is no longer optional.
export const TRACK_FILENAMES = [
  'RisingCore_ost00.opus',
  'NewTales_ost01.opus',
  'WhoAmI_ost02.opus',
  'TempestDive_ost03.opus',
  'Lionheart_ost04.opus',
  'Stratosphere_ost05.opus',
  'RiseNFall_ost06.opus',
]
