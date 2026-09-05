import { Loader2 } from 'lucide-react'
import { AmbientSparks } from '../lib/glassChrome.tsx'

export default function DiveLoadingScreen() {
  return (
    <div
      className="h-dvh relative flex flex-col justify-end items-center text-center px-6 overflow-hidden bg-[#050308]"
      style={{ paddingBottom: 'max(2rem, env(safe-area-inset-bottom))' }}
    >
      <div className="absolute inset-0 pointer-events-none">
        <picture>
          <source media="(min-width: 1024px)" srcSet={`${import.meta.env.BASE_URL}pc_title-bg2.webp`} />
          <img
            src={`${import.meta.env.BASE_URL}m_title-bg2.webp`}
            alt=""
            className="absolute inset-0 w-full h-full object-cover animate-[fade-in_2s_ease-in_forwards]"
          />
        </picture>
      </div>

      <div
        className="absolute inset-x-0 bottom-0 h-2/5 pointer-events-none z-0"
        style={{ background: 'linear-gradient(180deg, transparent, rgba(4,3,7,0.55) 40%, rgba(4,3,7,0.92) 85%)' }}
      />
      <AmbientSparks />

      <div className="relative z-10 w-fit max-w-full flex flex-col items-center gap-3 mb-14">
        <button
          disabled
          className="w-full min-w-[180px] h-12 flex items-center justify-center rounded-[10px] font-display font-bold tracking-widest text-[#fae5b5] transition-all duration-300 opacity-90 border border-[#f0ca65]/80 shadow-[0_0_25px_rgba(240,202,101,0.35)]"
          style={{ background: 'linear-gradient(135deg, rgba(232,202,138,0.1), rgba(240,202,101,0.2), rgba(168,127,44,0.15))' }}
        >
          <span className="inline-flex items-center gap-2">
            <Loader2 size={16} className="animate-spin text-[#f0ca65]" />
            <span>Initializing...</span>
          </span>
        </button>
      </div>
    </div>
  )
}
