import { AmbientSparks } from '../lib/glassChrome.tsx'

interface DiveLoadingScreenProps {
  gender?: string
}

export default function DiveLoadingScreen({ gender }: DiveLoadingScreenProps) {
  const normGender = (gender ?? '').trim().toLowerCase()
  const isFemale = normGender === 'female' || normGender === 'f' || normGender.startsWith('fem')
  const genderKey = isFemale ? 'female' : 'male'

  const pcSrc = `${import.meta.env.BASE_URL}img/loadingscreens/pc_dive-in-${genderKey}.webp`
  const mobileSrc = `${import.meta.env.BASE_URL}img/loadingscreens/m_dive-in-${genderKey}.webp`

  return (
    <div
      className="h-dvh relative flex flex-col justify-end items-center text-center px-6 overflow-hidden bg-[#050308] select-none"
      style={{ paddingBottom: 'max(3rem, env(safe-area-inset-bottom))' }}
    >
      {/* Background artwork with responsive PC vs Mobile selection */}
      <div className="absolute inset-0 pointer-events-none">
        <picture>
          <source media="(min-width: 769px)" srcSet={pcSrc} />
          <img
            src={mobileSrc}
            alt="Diving in..."
            className="absolute inset-0 w-full h-full object-cover animate-[fade-in_1s_ease-in_forwards]"
          />
        </picture>
      </div>

      {/* Atmospheric dark gradient scrim & radial focus */}
      <div
        className="absolute inset-x-0 bottom-0 h-3/5 pointer-events-none z-0"
        style={{
          background:
            'linear-gradient(180deg, transparent 0%, rgba(5,3,9,0.5) 30%, rgba(5,3,9,0.85) 65%, rgba(4,2,8,0.98) 100%)',
        }}
      />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,rgba(5,3,9,0.65)_100%)] pointer-events-none" />
      <AmbientSparks />

      {/* Center/Bottom Loading HUD */}
      <div className="relative z-10 w-full max-w-sm sm:max-w-md flex flex-col items-center gap-3.5 mb-6 sm:mb-10 px-4">
        <div className="flex flex-col items-center gap-1">
          <h2 className="font-display font-bold text-2xl sm:text-3xl tracking-[0.25em] text-[#fae5b5] uppercase drop-shadow-[0_2px_16px_rgba(240,202,101,0.5)]">
            DIVING...
          </h2>
          <p className="font-narrative text-xs sm:text-sm text-[#d8c49e]/80 italic">
            Weaving the tapestry of your tale...
          </p>
        </div>

        {/* Elegant glowing loading bar */}
        <div className="w-full max-w-xs sm:max-w-sm h-2.5 sm:h-3 rounded-full bg-[#120c1f]/90 border border-[#e8ca8a]/40 p-[2px] shadow-[0_0_20px_rgba(0,0,0,0.9)] overflow-hidden relative">
          <div className="h-full rounded-full bg-gradient-to-r from-amber-500 via-[#f0ca65] to-purple-500 shadow-[0_0_12px_rgba(240,202,101,0.6)] w-full relative overflow-hidden">
            {/* Smooth animated shimmer sweep */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/50 to-transparent animate-[shimmer_2s_infinite]" />
          </div>
        </div>
      </div>
    </div>
  )
}

