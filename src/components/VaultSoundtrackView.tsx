import { Disc3, FastForward, Music, Pause, Play, Rewind, Volume2, VolumeX } from 'lucide-react'
import { SOUNDTRACK_TRACKS, type TrackMetadata } from '../data/soundtrackManifest.ts'
import { GLASS_SURFACE, GLASS_SURFACE_LIST, GlassButton, GlassIconButton } from '../lib/glassChrome.tsx'

interface VaultSoundtrackViewProps {
  currentTrack: TrackMetadata | null
  isPlaying: boolean
  muted: boolean
  currentTime: number
  duration: number
  onPlayTrack: (filenameOrIndex: string | number) => void
  onTogglePlayPause: () => void
  onNextTrack: () => void
  onPrevTrack: () => void
  onToggleMute: () => void
  onResumeSoundtrack: () => void
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

// Lightweight, 60fps pure-CSS performance audio visualizer
function AudioVisualizer({ isPlaying, muted }: { isPlaying: boolean; muted: boolean }) {
  const active = isPlaying && !muted
  const barHeights = [45, 80, 60, 95, 40, 75, 90, 55, 85, 50, 70, 40]

  return (
    <div className="flex items-end gap-[2px] sm:gap-[3px] h-4 sm:h-5 px-1 shrink-0" aria-hidden="true">
      {barHeights.map((baseH, i) => (
        <span
          key={i}
          className={`w-[2px] sm:w-[2.5px] rounded-full bg-gradient-to-t from-[#d4af37] via-[#f0ca65] to-[#fae5b5] transition-all duration-200 ${
            active ? 'animate-pulse' : 'opacity-25'
          }`}
          style={{
            height: active ? `${baseH}%` : '20%',
            animationDuration: active ? `${0.42 + (i % 4) * 0.16}s` : '0s',
            animationDelay: `${(i * 0.07)}s`,
          }}
        />
      ))}
    </div>
  )
}

export default function VaultSoundtrackView({
  currentTrack,
  isPlaying,
  muted,
  currentTime,
  duration,
  onPlayTrack,
  onTogglePlayPause,
  onNextTrack,
  onPrevTrack,
  onToggleMute,
  onResumeSoundtrack,
}: VaultSoundtrackViewProps) {
  const activeTrack = currentTrack ?? SOUNDTRACK_TRACKS[0]
  const progressPercent = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0

  return (
    <div className="flex flex-col gap-3 sm:gap-3.5 flex-1 min-h-0 overflow-hidden">
      {/* Featured Jukebox / Now Playing Deck - Compact on Mobile, Spacious on Tablet/PC (Fixed) */}
      <div
        className={`shrink-0 ${GLASS_SURFACE} bg-[#140e24]/85 border-[#f0ca65]/40 rounded-2xl p-3.5 sm:p-5 shadow-[0_10px_35px_rgba(0,0,0,0.6)] relative overflow-hidden`}
      >
        {/* Ambient background glow */}
        <div
          className="absolute -top-12 -right-12 w-48 h-48 rounded-full pointer-events-none opacity-20 blur-3xl bg-[#f0ca65]"
          aria-hidden="true"
        />

        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-3 sm:gap-4 relative z-10">
          {/* Top row for mobile (Vinyl + Visualizer), Side column on tablet/PC */}
          <div className="flex items-center justify-between w-full sm:w-auto sm:justify-start gap-3">
            {/* Vinyl Disc Artwork */}
            <div className="relative w-14 h-14 sm:w-22 sm:h-22 rounded-full bg-gradient-to-tr from-black via-[#1a1429] to-black border-2 border-[#f0ca65]/40 flex items-center justify-center shrink-0 shadow-[0_0_18px_rgba(240,202,101,0.2)]">
              <Disc3
                size={34}
                className={`text-[#f0ca65] sm:hidden ${isPlaying && !muted ? 'animate-spin' : ''}`}
                style={{ animationDuration: '6s' }}
              />
              <Disc3
                size={50}
                className={`text-[#f0ca65] hidden sm:block ${isPlaying && !muted ? 'animate-spin' : ''}`}
                style={{ animationDuration: '6s' }}
              />
              {/* Center spindle */}
              <div className="absolute w-3 h-3 sm:w-4 sm:h-4 rounded-full bg-[#fae5b5] border border-black" />
            </div>

            {/* Mobile-only header block inline with vinyl */}
            <div className="flex-1 min-w-0 sm:hidden">
              <div className="flex items-center justify-between gap-1">
                <span className="font-mono text-[9px] uppercase tracking-wider text-[#e8ca8a]/80 px-1.5 py-0.2 rounded bg-black/40 border border-[#f0ca65]/20">
                  Vault Player
                </span>
                <AudioVisualizer isPlaying={isPlaying} muted={muted} />
              </div>
              <h3 className="font-display font-bold text-sm text-[#fae5b5] mt-1 truncate">
                {activeTrack?.title || 'Rising Core'}
              </h3>
              <p className="font-narrative text-[11px] text-[#d8c49e] truncate mt-0.5">
                <span className="text-[#e8ca8a]/70 font-mono text-[9px] tracking-wide uppercase mr-1">Album:</span>
                <span className="text-[#fae5b5] font-semibold mr-1.5">{activeTrack?.album || 'Tale Dives OST'}</span>
                <span className="text-[#e8ca8a]/70 font-mono text-[9px] tracking-wide uppercase mr-1">Artist:</span>
                <span>{activeTrack?.artist || 'Kem.Ave'}</span>
              </p>
            </div>
          </div>

          {/* Track Details & Timeline */}
          <div className="flex-1 min-w-0 w-full">
            {/* Tablet/Desktop Header bar */}
            <div className="hidden sm:flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] uppercase tracking-widest text-[#e8ca8a]/80 px-2 py-0.5 rounded bg-black/40 border border-[#f0ca65]/20">
                  Tale Dives Vault Player
                </span>
                <AudioVisualizer isPlaying={isPlaying} muted={muted} />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="font-mono text-xs text-[#fae5b5]">
                  {formatTime(currentTime)} / {formatTime(duration)}
                </span>
                <GlassIconButton
                  icon={muted ? VolumeX : Volume2}
                  label={muted ? 'Unmute' : 'Mute'}
                  compact
                  onClick={onToggleMute}
                />
              </div>
            </div>

            {/* Desktop Track Titles */}
            <div className="hidden sm:block mt-1">
              <h3 className="font-display font-bold text-lg sm:text-xl text-[#fae5b5] truncate">
                {activeTrack?.title || 'Rising Core'}
              </h3>
              <p className="font-narrative text-xs text-[#d8c49e] mt-0.5">
                <span className="text-[#e8ca8a]/70 font-mono text-[10px] tracking-wide uppercase mr-1">Album:</span>
                <span className="text-[#fae5b5] font-semibold">{activeTrack?.album || 'Tale Dives OST'}</span>
                <span className="mx-2 text-[#e8ca8a]/50">•</span>
                <span className="text-[#e8ca8a]/70 font-mono text-[10px] tracking-wide uppercase mr-1">Artist:</span>
                <span>{activeTrack?.artist || 'Kem.Ave'}</span>
              </p>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-black/50 rounded-full h-1.5 mt-2 sm:mt-3 overflow-hidden border border-white/10">
              <div
                className="bg-gradient-to-r from-[#d4af37] via-[#f0ca65] to-[#fae5b5] h-full transition-all duration-200"
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            {/* Audio Controls */}
            <div className="flex items-center justify-between sm:justify-start gap-2 sm:gap-2.5 mt-2 sm:mt-3">
              {/* Mobile timestamp and quick mute */}
              <div className="flex items-center gap-1 sm:hidden">
                <span className="font-mono text-[10px] text-[#fae5b5]">
                  {formatTime(currentTime)} / {formatTime(duration)}
                </span>
              </div>

              {/* Center Playback Buttons */}
              <div className="flex items-center gap-2">
                <GlassIconButton
                  icon={Rewind}
                  label="Previous Track"
                  compact
                  onClick={onPrevTrack}
                />
                <button
                  type="button"
                  onClick={onTogglePlayPause}
                  aria-label={isPlaying && !muted ? 'Pause' : 'Play'}
                  className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-[#f0ca65] hover:bg-[#fae5b5] text-black font-bold flex items-center justify-center transition-transform hover:scale-105 active:scale-95 shadow-[0_0_15px_rgba(240,202,101,0.4)]"
                >
                  {isPlaying && !muted ? (
                    <Pause size={15} fill="currentColor" className="sm:w-[18px] sm:h-[18px]" />
                  ) : (
                    <Play size={15} fill="currentColor" className="ml-0.5 sm:w-[18px] sm:h-[18px]" />
                  )}
                </button>
                <GlassIconButton
                  icon={FastForward}
                  label="Next Track"
                  compact
                  onClick={onNextTrack}
                />
              </div>

              {/* Mobile quick mute & desktop soundtrack restoration */}
              <div className="sm:hidden">
                <GlassIconButton
                  icon={muted ? VolumeX : Volume2}
                  label={muted ? 'Unmute' : 'Mute'}
                  compact
                  onClick={onToggleMute}
                />
              </div>

              <div className="ml-auto hidden sm:block">
                <GlassButton
                  onClick={onResumeSoundtrack}
                  icon={Music}
                  tone="action"
                  className="!py-1.5 !text-xs"
                >
                  Fade In Soundtrack
                </GlassButton>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Playlist Track Cards */}
      <div className="flex flex-col gap-2 flex-1 min-h-0">
        <div className="flex items-center justify-between px-1 shrink-0">
          <h4 className="font-display font-bold text-xs uppercase tracking-wider text-[#fae5b5]">
            Playlist ({SOUNDTRACK_TRACKS.length})
          </h4>
        </div>

        <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-2 pb-4">
          {SOUNDTRACK_TRACKS.map((track, idx) => {
          const isThisPlaying =
            currentTrack?.filename.toLowerCase() === track.filename.toLowerCase() &&
            isPlaying &&
            !muted

          const isThisActive = currentTrack?.filename.toLowerCase() === track.filename.toLowerCase()

          return (
            <div
              key={track.filename}
              onClick={() => onPlayTrack(track.filename)}
              className={`${GLASS_SURFACE_LIST} ${
                isThisActive
                  ? 'bg-[#1e1533]/90 border-[#f0ca65]/80 shadow-[0_0_16px_rgba(240,202,101,0.2)] ring-1 ring-[#f0ca65]/50'
                  : 'bg-[#100b1a]/75 border-[#e8ca8a]/25 hover:border-[#f0ca65]/50 hover:bg-[#160f24]/90'
              } rounded-xl px-3 py-2.5 sm:px-3.5 sm:py-3 flex items-center gap-2.5 sm:gap-3 transition-all cursor-pointer group`}
            >
              {/* Play Button / Track Number */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  if (isThisPlaying) {
                    onTogglePlayPause()
                  } else {
                    onPlayTrack(track.filename)
                  }
                }}
                className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center shrink-0 transition-all ${
                  isThisPlaying
                    ? 'bg-[#f0ca65] text-black shadow-[0_0_10px_rgba(240,202,101,0.5)]'
                    : 'bg-black/40 text-[#f5dfa0] border border-[#f0ca65]/30 group-hover:bg-[#f0ca65]/20 group-hover:text-white'
                }`}
              >
                {isThisPlaying ? (
                  <Pause size={13} fill="currentColor" />
                ) : (
                  <Play size={13} fill="currentColor" className="ml-0.5" />
                )}
              </button>

              {/* Track Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <span className="font-mono text-[10px] text-[#e8ca8a]/70">#{String(idx + 1).padStart(2, '0')}</span>
                  <h5 className="font-display font-bold text-xs sm:text-sm text-[#fae5b5] group-hover:text-white truncate">
                    {track.title}
                  </h5>
                  {isThisActive && (
                    <span className="rounded bg-[#f0ca65]/20 text-[#fae5b5] border border-[#f0ca65]/40 px-1.5 py-0.2 text-[8.5px] sm:text-[9px] font-mono shrink-0 animate-pulse">
                      NOW PLAYING
                    </span>
                  )}
                </div>
                <p className="font-narrative text-[11px] sm:text-xs text-[#d8c49e] truncate mt-0.5 flex items-center flex-wrap gap-x-1">
                  <span className="text-[#e8ca8a]/70 font-mono text-[9px] sm:text-[10px] tracking-wide uppercase">Album:</span>
                  <span className="text-[#fae5b5] font-semibold">{track.album}</span>
                  <span className="text-[#e8ca8a]/40 mx-0.5">•</span>
                  <span className="text-[#e8ca8a]/70 font-mono text-[9px] sm:text-[10px] tracking-wide uppercase">Artist:</span>
                  <span>{track.artist}</span>
                </p>
              </div>

              {/* Right Side Visualizer / Format Indicator */}
              <div className="shrink-0 flex items-center gap-1.5 sm:gap-2">
                {isThisPlaying && (
                  <div className="hidden sm:block">
                    <AudioVisualizer isPlaying={isPlaying} muted={muted} />
                  </div>
                )}
                <span className="font-mono text-[9px] sm:text-[10px] text-[#e8ca8a]/60 px-1.5 py-0.5 rounded bg-black/40 border border-white/5">
                  OPUS
                </span>
              </div>
            </div>
          )
        })}
        </div>
      </div>
    </div>
  )
}
