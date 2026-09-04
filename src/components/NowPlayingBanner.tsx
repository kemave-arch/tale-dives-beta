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
      className="fixed top-0 right-0 z-50 pointer-events-none"
      style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}
    >
      <div className="px-4 sm:px-6 w-full flex items-center justify-end">
        <AnimatePresence>
          {visible && (
            <motion.div
              id="td-now-playing-banner"
              key={track.filename}
              initial={{ opacity: 0, y: -24, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -18, scale: 0.96, transition: { duration: 0.22 } }}
              transition={{ type: 'spring', stiffness: 340, damping: 26 }}
              onClick={onDismiss}
              title={`${track.title} - ${track.album} (${track.artist})`}
              className="pointer-events-auto cursor-pointer group relative flex items-center gap-2.5 px-3.5 sm:px-4 py-1.5 sm:py-2 mr-[84px] sm:mr-[96px] rounded-full border border-[#e8ca8a]/25 bg-black/40 backdrop-blur-md shadow-[0_8px_24px_rgba(0,0,0,0.5)] w-auto max-w-[calc(100vw-130px)] sm:max-w-md md:max-w-lg lg:max-w-xl select-none transition-all hover:bg-black/60 hover:border-[#f0ca65]/50 active:scale-[0.98]"
            >
              {/* Subtle top-edge sheen */}
              <div
                className="absolute inset-x-6 top-0 h-[1px] pointer-events-none opacity-40"
                style={{ background: 'linear-gradient(90deg, transparent, rgba(245,223,160,0.7), transparent)' }}
              />

              {/* Icon pill */}
              <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-black/45 border border-[#f0ca65]/35 flex items-center justify-center shrink-0 text-[#f5dfa0] shadow-[0_0_8px_rgba(240,202,101,0.2)]">
                {muted ? (
                  <VolumeX size={12} className="text-[#e8ca8a]/60" />
                ) : (
                  <Disc3 size={13} className="animate-spin text-[#f0ca65]" style={{ animationDuration: '4s' }} />
                )}
              </div>

              {/* Track Metadata Text */}
              <div className="flex-1 min-w-0 pr-1 flex flex-col justify-center">
                <div className="flex items-center gap-2">
                  <span className="font-display font-bold text-xs sm:text-sm text-[#fae5b5] tracking-wide truncate leading-tight">
                    {track.title}
                  </span>
                  {muted && (
                    <span className="text-[8.5px] font-mono uppercase px-1.5 py-0.2 bg-black/50 rounded border border-white/10 text-[#e8ca8a]/80 shrink-0">
                      Muted
                    </span>
                  )}
                </div>
                <span className="font-narrative italic text-[10px] sm:text-xs text-[#d8c49e]/90 truncate leading-tight mt-0.5">
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
