import { useState, useEffect, useRef } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  Expand,
  Image as ImageIcon,
  Monitor,
  Smartphone,
  X,
  Sparkles,
  Maximize,
  Minimize
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useDiscoveredSlots } from '../lib/cyclingBackground.tsx'
import { GLASS_SURFACE, GlassIconButton } from '../lib/glassChrome.tsx'

const WALLPAPER_METADATA: Record<string, { title: string; subtitle: string; description: string }> = {
  'title-bg1': {
    title: 'The Novel-Verse',
    subtitle: 'The Imagination is the Limit',
    description: 'Dive into boundless novel fantasy realms of your own making and play as a protagonist woven seamlessly into the living world.',
  },
  'title-bg2': {
    title: 'Tempest Dive',
    subtitle: 'Explore, Build & Master the Arcane',
    description: 'Explore, interact, build, and shape your imaginative journey while forging potent skills across deep realm power systems.',
  },
  'title-bg3': {
    title: 'Empires & Towers',
    subtitle: 'Factions, Bonds & World Crises',
    description: 'Navigate sprawling factions, dynamic NPC relationships, and epochal world crises that rise to challenge your ascension.',
  },
}

export default function VaultArtGalleryView() {
  const slots = useDiscoveredSlots()
  const [selectedSlotIndex, setSelectedSlotIndex] = useState<number | null>(null)
  const [viewVariant, setViewVariant] = useState<'pc' | 'm'>('pc')
  const [isZoomed, setIsZoomed] = useState(false)
  const [scale, setScale] = useState(1.6)
  const initialTouchDistanceRef = useRef<number | null>(null)
  const initialScaleRef = useRef<number>(1.6)
  const dragConstraintsRef = useRef<HTMLDivElement>(null)

  // Reset zoom on slot change
  useEffect(() => {
    setIsZoomed(false)
    setScale(1.6)
  }, [selectedSlotIndex, viewVariant])

  const handleWheel = (e: React.WheelEvent) => {
    const delta = e.deltaY < 0 ? 0.15 : -0.15
    setScale((prev) => Math.min(Math.max(0.4, prev + delta), 4))
  }

  const getTouchDistance = (touches: React.TouchList) => {
    const dx = touches[0].clientX - touches[1].clientX
    const dy = touches[0].clientY - touches[1].clientY
    return Math.sqrt(dx * dx + dy * dy)
  }

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      initialTouchDistanceRef.current = getTouchDistance(e.touches)
      initialScaleRef.current = scale
    }
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && initialTouchDistanceRef.current !== null) {
      const currentDistance = getTouchDistance(e.touches)
      const factor = currentDistance / initialTouchDistanceRef.current
      setScale(Math.min(Math.max(0.4, initialScaleRef.current * factor), 4))
    }
  }

  const handleTouchEnd = () => {
    initialTouchDistanceRef.current = null
  }

  const baseUrl = import.meta.env.BASE_URL

  // Step through PC -> Mobile -> Next Slot PC -> Next Slot Mobile
  const handleNext = () => {
    if (selectedSlotIndex === null || slots.length === 0) return
    if (viewVariant === 'pc') {
      setViewVariant('m')
    } else {
      setViewVariant('pc')
      setSelectedSlotIndex((prev) => (prev !== null ? (prev + 1) % slots.length : 0))
    }
  }

  const handlePrev = () => {
    if (selectedSlotIndex === null || slots.length === 0) return
    if (viewVariant === 'm') {
      setViewVariant('pc')
    } else {
      setViewVariant('m')
      setSelectedSlotIndex((prev) => (prev !== null ? (prev - 1 + slots.length) % slots.length : 0))
    }
  }

  // Keyboard navigation for the lightbox
  useEffect(() => {
    if (selectedSlotIndex === null) return
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setSelectedSlotIndex(null)
      } else if (e.key === 'ArrowRight') {
        handleNext()
      } else if (e.key === 'ArrowLeft') {
        handlePrev()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedSlotIndex, viewVariant, slots.length])

  const activeStem = selectedSlotIndex !== null ? slots[selectedSlotIndex] : null
  const activeMeta = activeStem
    ? WALLPAPER_METADATA[activeStem] || {
        title: `Wallpaper #${activeStem.replace('title-bg', '')}`,
        subtitle: 'Tale Dives Realm Artwork',
        description: 'Atmospheric visual piece illustrating the expansive fantasy cosmos of Tale Dives.',
      }
    : null

  const activeImageSrc = activeStem ? `${baseUrl}img/${viewVariant}_${activeStem}.webp` : ''

  return (
    <div className="flex flex-col gap-4 flex-1 min-h-0">
      {/* Header Info Banner */}
      <div
        className={`shrink-0 ${GLASS_SURFACE} bg-[#140e24]/85 border-[#e8ca8a]/30 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-[0_8px_32px_rgba(0,0,0,0.5)]`}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#f0ca65]/15 border border-[#f0ca65]/35 flex items-center justify-center text-[#f0ca65] shrink-0">
            <ImageIcon size={20} />
          </div>
          <div>
            <h3 className="font-display font-bold text-sm sm:text-base text-[#fae5b5]">
              World Gallery & Wallpapers ({slots.length})
            </h3>
            <p className="font-narrative text-xs text-[#d8c49e]">
              Original fantasy backdrops cycling across Tale Dives title and main chronicles.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-center">
          <span className="font-mono text-[10px] uppercase text-[#fae5b5] bg-black/40 border border-[#f0ca65]/20 px-2.5 py-1 rounded-full flex items-center gap-1.5">
            <Sparkles size={11} className="text-[#f0ca65]" />
            Ultra WebP 16:9 & 2:3
          </span>
        </div>
      </div>

      {/* Gallery Grid */}
      <div className="flex-1 overflow-y-auto pr-1">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pb-4">
          {slots.map((stem, index) => {
          const meta = WALLPAPER_METADATA[stem] || {
            title: `Wallpaper #${stem.replace('title-bg', '')}`,
            subtitle: 'Tale Dives Environment',
            description: 'Ambient concept illustration.',
          }
          const thumbSrc = `${baseUrl}img/pc_${stem}.webp`

          return (
            <div
              key={stem}
              onClick={() => {
                setSelectedSlotIndex(index)
                setViewVariant('pc')
              }}
              className={`${GLASS_SURFACE} bg-[#100b1a]/85 border-[#e8ca8a]/25 hover:border-[#f0ca65]/60 hover:bg-[#160f24]/95 rounded-2xl overflow-hidden cursor-pointer group transition-all duration-200 shadow-[0_6px_24px_rgba(0,0,0,0.45)] hover:shadow-[0_10px_32px_rgba(240,202,101,0.2)] flex flex-col`}
            >
              {/* Image Preview Container */}
              <div className="relative aspect-video w-full overflow-hidden bg-black/70">
                <img
                  src={thumbSrc}
                  alt={meta.title}
                  loading="lazy"
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  onError={(e) => {
                    // Fallback to mobile image if PC image fails
                    const target = e.currentTarget
                    target.src = `${baseUrl}img/m_${stem}.webp`
                  }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-80 group-hover:opacity-60 transition-opacity" />

                {/* Top Badge */}
                <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5">
                  <span className="font-mono text-[10px] font-bold text-[#fae5b5] bg-black/60 backdrop-blur-sm border border-white/10 px-2 py-0.5 rounded">
                    #{String(index + 1).padStart(2, '0')}
                  </span>
                </div>

                {/* Inspect Button overlay */}
                <div className="absolute bottom-2.5 right-2.5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1.5 bg-[#f0ca65] text-black font-display font-bold text-xs px-2.5 py-1 rounded-lg shadow-lg">
                  <Expand size={13} />
                  <span>Inspect</span>
                </div>
              </div>

              {/* Card Meta Content */}
              <div className="p-3.5 flex-1 flex flex-col justify-between gap-2">
                <div>
                  <h4 className="font-display font-bold text-sm text-[#fae5b5] group-hover:text-[#fff5db] transition-colors">
                    {meta.title}
                  </h4>
                  <p className="font-narrative italic text-xs text-[#d8c49e] line-clamp-1 mt-0.5">
                    {meta.subtitle}
                  </p>
                  <p className="font-narrative text-[11px] text-[#e8ca8a]/75 line-clamp-2 mt-1.5 leading-relaxed">
                    {meta.description}
                  </p>
                </div>

                <div className="pt-2 border-t border-[#e8ca8a]/15 flex items-center justify-between text-[10px] font-mono text-[#e8ca8a]/70">
                  <span className="flex items-center gap-1">
                    <Monitor size={11} className="text-[#f0ca65]" /> PC & Mobile Dual Art
                  </span>
                  <span className="text-[#fae5b5]">WebP HD</span>
                </div>
              </div>
            </div>
          )
        })}
        </div>
      </div>

      {/* Lightbox Modal */}
      {selectedSlotIndex !== null && activeMeta && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-xl animate-in fade-in duration-200"
          onClick={() => setSelectedSlotIndex(null)}
        >
          <div
            className="relative max-w-5xl w-full bg-[#120c1f] border border-[#f0ca65]/40 rounded-2xl overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.9)] flex flex-col max-h-[92dvh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-4 py-3 border-b border-[#e8ca8a]/20 flex items-center justify-between gap-3 bg-black/40">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10px] text-[#f0ca65] bg-[#f0ca65]/15 px-1.5 py-0.5 rounded border border-[#f0ca65]/30">
                    SLOT #{String(selectedSlotIndex + 1).padStart(2, '0')}
                  </span>
                  <h3 className="font-display font-bold text-sm sm:text-base text-[#fae5b5] truncate">
                    {activeMeta.title}
                  </h3>
                </div>
                <p className="font-narrative italic text-xs text-[#d8c49e] truncate mt-0.5">
                  {activeMeta.subtitle}
                </p>
              </div>

              {/* Format Toggle and Close */}
              <div className="flex items-center gap-2 shrink-0">
                {/* Variant Switcher */}
                <div className="flex items-center p-0.5 rounded-lg bg-black/50 border border-white/10 text-xs">
                  <button
                    type="button"
                    onClick={() => setViewVariant('pc')}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded font-display text-[11px] transition-all ${
                      viewVariant === 'pc'
                        ? 'bg-[#f0ca65] text-black font-bold shadow'
                        : 'text-[#e8ca8a]/70 hover:text-white'
                    }`}
                  >
                    <Monitor size={12} />
                    <span className="hidden sm:inline">Landscape (16:9)</span>
                    <span className="sm:hidden">PC</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewVariant('m')}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded font-display text-[11px] transition-all ${
                      viewVariant === 'm'
                        ? 'bg-[#f0ca65] text-black font-bold shadow'
                        : 'text-[#e8ca8a]/70 hover:text-white'
                    }`}
                  >
                    <Smartphone size={12} />
                    <span className="hidden sm:inline">Portrait (2:3)</span>
                    <span className="sm:hidden">Mobile</span>
                  </button>
                </div>

                <GlassIconButton
                  icon={Maximize}
                  label="Zoom In"
                  compact
                  onClick={() => setIsZoomed(true)}
                />

                <GlassIconButton
                  icon={X}
                  label="Close"
                  compact
                  onClick={() => setSelectedSlotIndex(null)}
                />
              </div>
            </div>

            {/* Image Stage */}
            <div className="relative flex-1 min-h-0 bg-black/90 flex items-center justify-center p-2 sm:p-4 overflow-hidden">
              <img
                key={`${activeStem}-${viewVariant}`}
                src={activeImageSrc}
                alt={activeMeta.title}
                onClick={() => setIsZoomed(true)}
                className={`max-h-[60dvh] w-auto max-w-full object-contain rounded-lg shadow-2xl transition-all cursor-zoom-in hover:brightness-110 ${
                  viewVariant === 'm' ? 'aspect-[2/3]' : 'aspect-video'
                }`}
              />

              {/* Prev / Next Nav Buttons */}
              <button
                type="button"
                onClick={handlePrev}
                aria-label="Previous Wallpaper or Format"
                className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/60 hover:bg-[#f0ca65] text-white hover:text-black border border-white/20 hover:border-[#f0ca65] flex items-center justify-center transition-all shadow-lg"
              >
                <ChevronLeft size={22} />
              </button>

              <button
                type="button"
                onClick={handleNext}
                aria-label="Next Wallpaper or Format"
                className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/60 hover:bg-[#f0ca65] text-white hover:text-black border border-white/20 hover:border-[#f0ca65] flex items-center justify-center transition-all shadow-lg"
              >
                <ChevronRight size={22} />
              </button>
            </div>

            {/* Modal Footer Description */}
            <div className="px-4 py-3 bg-black/50 border-t border-[#e8ca8a]/15 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              <p className="font-narrative text-xs text-[#fbf4e2] leading-relaxed flex-1">
                {activeMeta.description}
              </p>
              <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                <span className="font-mono text-[11px] text-[#fae5b5] bg-black/40 px-2 py-0.5 rounded border border-white/10">
                  #{selectedSlotIndex + 1} of {slots.length} &bull; {viewVariant === 'pc' ? 'Landscape (16:9)' : 'Portrait (2:3)'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Fullscreen Zoom Overlay */}
      <AnimatePresence>
        {isZoomed && activeImageSrc && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center overflow-hidden touch-none"
            ref={dragConstraintsRef}
            onWheel={handleWheel}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            <div className="absolute top-4 right-4 sm:top-6 sm:right-6 z-[110] flex items-center gap-2 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full border border-[#f0ca65]/50 shadow-[0_0_20px_rgba(240,202,101,0.3)]">
              <span className="font-mono text-xs text-[#fae5b5] font-bold">Press to Go Back</span>
              <GlassIconButton
                icon={Minimize}
                label="Close Zoom"
                tone="action"
                onClick={() => setIsZoomed(false)}
              />
            </div>

            <motion.img
              src={activeImageSrc}
              alt={activeMeta?.title || 'Zoomed Image'}
              drag
              dragConstraints={false}
              dragElastic={0.1}
              style={{ scale }}
              initial={{ x: 0, y: 0 }}
              animate={{ x: 0, y: 0 }}
              transition={{ type: 'spring', bounce: 0.1, duration: 0.2 }}
              className="max-w-none w-full h-full object-contain cursor-grab active:cursor-grabbing select-none"
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
