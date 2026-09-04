import { BookOpen, Play, Settings as SettingsIcon, Volume2, VolumeX } from 'lucide-react'
import { CyclingBackground } from '../lib/cyclingBackground.tsx'
import { AmbientSparks, GlassCTAButton } from '../lib/glassChrome.tsx'

interface TitleProps {
  onEnter: () => void
  onSettings: () => void
  // Jumps straight into the most recently played Tale, skipping Main Menu.
  // Omitted (no button rendered) when there's no Tale to resume yet.
  onContinue?: () => void
  musicMuted: boolean
  onToggleMusicMute: () => void
}

// AmbientSparks now lives in lib/glassChrome.tsx so every ground="art" screen
// shares it, not just this one.

// Shared by the mute toggle and the Settings gear so the two read as one set.
const TOP_ICON_BUTTON =
  'w-10 h-10 rounded-full inline-flex items-center justify-center text-[#e8ca8a]/80 bg-black/30 backdrop-blur-sm hover:text-[#e8ca8a]'

// Blueprint §6.4A — Title/entry screen. The artwork (auto-discovered by
// lib/cyclingBackground.tsx — see useDiscoveredSlots) already carries the
// wordmark, tagline and dedication, so this screen adds nothing on top of it
// but a slow crossfade between images (once more than one slot exists),
// ambient sparks, a bottom scrim, and the buttons that lead somewhere real.
// No Worlds/Journal/Profile/Inventory/Achievements row — those aren't
// separate screens yet, so a button for them would just be decoration.
export default function Title({ onEnter, onSettings, onContinue, musicMuted, onToggleMusicMute }: TitleProps) {
  return (
    <div
      className="h-dvh relative flex flex-col justify-end items-center text-center px-6 overflow-hidden bg-[#050308]"
      style={{ paddingBottom: 'max(2rem, env(safe-area-inset-bottom))' }}
    >
      <CyclingBackground />
      <div
        className="absolute inset-x-0 bottom-0 h-2/5 pointer-events-none"
        style={{ background: 'linear-gradient(180deg, transparent, rgba(4,3,7,0.55) 40%, rgba(4,3,7,0.92) 85%)' }}
      />
      <AmbientSparks />

      {/* Positioning lives on the row so both icons share one identical
          button style — see TOP_ICON_BUTTON above. */}
      <div className="absolute top-0 right-0 z-10 mt-[max(1rem,env(safe-area-inset-top))] mr-4 flex items-center gap-2">
        <button
          onClick={onToggleMusicMute}
          aria-label={musicMuted ? 'Unmute music' : 'Mute music'}
          className={TOP_ICON_BUTTON}
        >
          {musicMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
        </button>
        <button onClick={onSettings} aria-label="Settings" className={TOP_ICON_BUTTON}>
          <SettingsIcon size={18} />
        </button>
      </div>

      {/* `w-fit` sizes this column to its WIDEST child, and the flex default
          `items-stretch` then pulls the narrower button out to match it. That
          keeps Dive In and Continue the same width (they read as one pair of
          equal-weight choices, not a button and a footnote) WITHOUT stretching
          either to the full container — which is what a fixed `max-w-xs` +
          `w-full` did, leaving a lone Dive In as a 320px slab across the
          artwork. `max-w-full` is the guard for a narrow phone. */}
      <div className="relative z-10 w-fit max-w-full flex flex-col gap-3 mb-14">
        <GlassCTAButton onClick={onEnter} icon={BookOpen}>
          Dive In
        </GlassCTAButton>
        {onContinue && (
          <GlassCTAButton onClick={onContinue} icon={Play}>
            Continue
          </GlassCTAButton>
        )}
      </div>
    </div>
  )
}
