import { AnimatePresence, motion } from 'framer-motion'
import { Disc3, VolumeX } from 'lucide-react'
import type { TrackMetadata } from '../data/soundtrackManifest.ts'

interface NowPlayingBannerProps {
  track: TrackMetadata | null
  visible: boolean
  muted: boolean
  onDismiss?: () => void
}

export default function NowPlayingBanner({ track, visible, muted, onDismiss }: NowPlayingBannerProps) {
  if (!track) return null

  return (
    <aside
      aria-label="Now Playing"
      className="fixed top-0 left-0 right-0 z-50 pointer-events-none"
      style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}
    >
      <div className="px-4 sm:px-6 w-full flex items-center justify-start">
        <AnimatePresence>
          {visible && (
            <motion.div
              id="td-now-playing-banner"
              key={track.filename}
              initial={{ opacity: 0, x: -40, scale: 0.94 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: -28, scale: 0.95, transition: { duration: 0.3 } }}
              transition={{ type: 'spring', stiffness: 350, damping: 26 }}
              onClick={onDismiss}
              title={`${track.title} - ${track.album} (${track.artist})`}
              className="pointer-events-auto cursor-pointer group relative flex items-center gap-2.5 px-3.5 py-1.5 rounded-full border border-[#e8ca8a]/30 bg-black/60 backdrop-blur-md shadow-[0_8px_28px_rgba(0,0,0,0.65)] max-w-[calc(100vw-115px)] sm:max-w-sm md:max-w-md select-none transition-all hover:bg-black/75 hover:border-[#f0ca65]/50 active:scale-[0.98]"
            >
              {/* Subtle top-edge sheen */}
              <div
                className="absolute inset-x-4 top-0 h-[1px] pointer-events-none opacity-40"
                style={{ background: 'linear-gradient(90deg, transparent, rgba(245,223,160,0.7), transparent)' }}
              />

              {/* Icon pill */}
              <div className="w-6 h-6 rounded-full bg-black/45 border border-[#f0ca65]/30 flex items-center justify-center shrink-0 text-[#f5dfa0] shadow-[0_0_8px_rgba(240,202,101,0.15)]">
                {muted ? (
                  <VolumeX size={12} className="text-[#e8ca8a]/60" />
                ) : (
                  <Disc3 size={13} className="animate-spin text-[#f0ca65]" style={{ animationDuration: '4s' }} />
                )}
              </div>

              {/* Track Metadata Text */}
              <div className="flex-1 min-w-0 pr-1 flex flex-col justify-center">
                <div className="flex items-center gap-1.5">
                  <span className="font-display font-bold text-[11px] sm:text-xs text-[#fae5b5] tracking-wide truncate leading-tight">
                    {track.title}
                  </span>
                  {muted && (
                    <span className="text-[9px] font-mono uppercase px-1 py-0.2 bg-black/40 rounded border border-white/10 text-[#e8ca8a]/70 shrink-0">
                      Muted
                    </span>
                  )}
                </div>
                <span className="font-narrative italic text-[9.5px] sm:text-[10px] text-[#d8c49e]/85 truncate leading-tight mt-0.5">
                  {track.album} &bull; {track.artist}
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </aside>
  )
}
