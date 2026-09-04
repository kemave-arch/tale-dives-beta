import { useState, useRef, useEffect } from 'react'
import { Loader2, Settings as SettingsIcon, Volume2, VolumeX } from 'lucide-react'
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
  debugMode?: boolean
  introGazeDelay?: boolean
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
export default function Title({
  onEnter,
  onSettings,
  onContinue,
  musicMuted,
  onToggleMusicMute,
  debugMode = false,
  introGazeDelay = true,
}: TitleProps) {
  const [isInitializing, setIsInitializing] = useState(false)
  const timerRef = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current)
      }
    }
  }, [])

  function handleDiveIn() {
    if (isInitializing) return
    // If Debug mode is active or gaze delay is explicitly turned off in settings, enter immediately
    if (debugMode || introGazeDelay === false) {
      onEnter()
      return
    }

    // 4-second wallpaper gaze delay with Initializing state
    setIsInitializing(true)
    timerRef.current = window.setTimeout(() => {
      onEnter()
    }, 4000)
  }

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
      <div className="relative z-10 w-fit max-w-full flex flex-col items-center gap-3 mb-14">
        <GlassCTAButton
          onClick={handleDiveIn}
          disabled={isInitializing}
          className={`w-full min-w-[180px] transition-all duration-300 ${
            isInitializing ? 'opacity-90 border-[#f0ca65]/80 shadow-[0_0_25px_rgba(240,202,101,0.35)]' : ''
          }`}
        >
          {isInitializing ? (
            <span className="inline-flex items-center gap-2 text-[#fae5b5]">
              <Loader2 size={16} className="animate-spin text-[#f0ca65]" />
              <span>Initializing...</span>
            </span>
          ) : (
            'Dive In'
          )}
        </GlassCTAButton>
        {onContinue && !isInitializing && (
          <GlassCTAButton onClick={onContinue} className="w-full">
            Continue
          </GlassCTAButton>
        )}
      </div>
    </div>
  )
}
