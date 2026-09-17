import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Expand, Globe2, Images, MapPinned, UserCircle2, X } from 'lucide-react'
import type { Campaign, Dict } from '../types.ts'
import { useEntityImage } from '../lib/useEntityImage.ts'
import { GLASS_SURFACE, GLASS_SURFACE_LIST, GlassIconButton, GlassTabs } from '../lib/glassChrome.tsx'

interface GalleryItem {
  key: string
  name: string
}

type GeneratedCategory = 'locations' | 'npcs' | 'regions'

const CATEGORY_TABS = [
  { id: 'locations' as GeneratedCategory, label: 'Locations', icon: MapPinned, accent: 'cyan' as const },
  { id: 'npcs' as GeneratedCategory, label: 'Cast', icon: UserCircle2, accent: 'purple' as const },
  { id: 'regions' as GeneratedCategory, label: 'Region Maps', icon: Globe2, accent: 'gold' as const },
]

// Every generated image lives only in this device's IndexedDB (lib/imageStore.ts)
// — a Campaign only ever carries the string key. This view just walks every
// Tale's own Codex dicts collecting whichever keys are actually populated, so
// it stays correct as new entities pick up images during play without any
// separate index to keep in sync.
function collectItems(campaign: Campaign, category: GeneratedCategory): GalleryItem[] {
  if (category === 'locations') {
    return Object.values(campaign.locations || {})
      .filter((l) => l.imageKey)
      .map((l) => ({ key: l.imageKey!, name: l.name }))
  }
  if (category === 'npcs') {
    return Object.values(campaign.npcs || {})
      .filter((n) => n.portraitKey)
      .map((n) => ({ key: n.portraitKey!, name: n.name }))
  }
  return Object.values(campaign.regions || {})
    .filter((r) => r.mapImageKey)
    .map((r) => ({ key: r.mapImageKey!, name: r.name }))
}

function GeneratedThumb({ imgKey, name, onClick }: { imgKey: string; name: string; onClick: () => void }) {
  const url = useEntityImage(imgKey)
  return (
    <div
      onClick={onClick}
      className={`${GLASS_SURFACE_LIST} bg-[#100b1a]/85 border-[#e8ca8a]/25 hover:border-[#f0ca65]/60 rounded-xl overflow-hidden cursor-pointer group transition-all duration-200 flex flex-col`}
    >
      <div className="relative aspect-video w-full overflow-hidden bg-black/70 flex items-center justify-center">
        {url ? (
          <img src={url} alt={name} loading="lazy" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
        ) : (
          <div className="w-6 h-6 border-2 border-[#e8ca8a]/30 border-t-[#f0ca65] rounded-full animate-spin" />
        )}
        <div className="absolute bottom-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 bg-[#f0ca65] text-black font-display font-bold text-[10px] px-1.5 py-0.5 rounded shadow">
          <Expand size={10} />
          <span>Inspect</span>
        </div>
      </div>
      <p className="px-2 py-1.5 font-narrative text-[11px] text-[#fae5b5] truncate">{name}</p>
    </div>
  )
}

export default function VaultGeneratedArtView({ campaigns }: { campaigns: Dict<Campaign> }) {
  const talesWithArt = useMemo(
    () =>
      Object.values(campaigns).filter(
        (c) => collectItems(c, 'locations').length || collectItems(c, 'npcs').length || collectItems(c, 'regions').length,
      ),
    [campaigns],
  )
  const [selectedTaleId, setSelectedTaleId] = useState<string | null>(null)
  const [category, setCategory] = useState<GeneratedCategory>('locations')
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)

  const selectedTale = selectedTaleId ? campaigns[selectedTaleId] : null
  const items = selectedTale ? collectItems(selectedTale, category) : []
  const activeItem = lightboxIndex !== null ? items[lightboxIndex] : null

  if (!selectedTale) {
    return (
      <div className="flex flex-col gap-4 flex-1 min-h-0">
        <div className={`shrink-0 ${GLASS_SURFACE} bg-[#140e24]/85 border-[#e8ca8a]/30 rounded-2xl p-4 flex items-center gap-3 shadow-[0_8px_32px_rgba(0,0,0,0.5)]`}>
          <div className="w-10 h-10 rounded-xl bg-[#f0ca65]/15 border border-[#f0ca65]/35 flex items-center justify-center text-[#f0ca65] shrink-0">
            <Images size={20} />
          </div>
          <div>
            <h3 className="font-display font-bold text-sm sm:text-base text-[#fae5b5]">Generated Art ({talesWithArt.length})</h3>
            <p className="font-narrative text-xs text-[#d8c49e]">Portraits, locations, and region maps woven during your Tales.</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto pr-1">
          {talesWithArt.length === 0 ? (
            <div className="h-full flex items-center justify-center text-center px-6">
              <p className="font-narrative text-sm text-[#d8c49e]/80 max-w-sm">
                No generated images yet. Weave portraits, locations, or region maps from within a Tale and they'll appear here.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 pb-4">
              {talesWithArt.map((tale) => {
                const total = collectItems(tale, 'locations').length + collectItems(tale, 'npcs').length + collectItems(tale, 'regions').length
                return (
                  <div
                    key={tale.id}
                    onClick={() => {
                      setSelectedTaleId(tale.id)
                      setCategory('locations')
                    }}
                    className={`${GLASS_SURFACE_LIST} bg-[#100b1a]/85 border-[#e8ca8a]/25 hover:border-[#f0ca65]/60 hover:bg-[#160f24]/95 rounded-2xl p-4 flex flex-col gap-2 cursor-pointer transition-all duration-200 group`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-[#f0ca65]/15 border border-[#f0ca65]/30 flex items-center justify-center text-[#f0ca65] shrink-0 group-hover:scale-105 transition-transform">
                        <Images size={16} />
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-display font-bold text-sm text-[#fae5b5] truncate">{tale.title}</h4>
                        <span className="font-mono text-[10px] text-[#e8ca8a]/70">{total} image{total === 1 ? '' : 's'}</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3 flex-1 min-h-0">
      <div className="shrink-0 flex items-center gap-2">
        <GlassIconButton icon={ChevronLeft} label="Back to Tales" onClick={() => setSelectedTaleId(null)} />
        <h3 className="font-display font-bold text-sm text-[#fae5b5] truncate">{selectedTale.title}</h3>
      </div>

      <div className="shrink-0">
        <GlassTabs tabs={CATEGORY_TABS} value={category} onChange={setCategory} size="sm" />
      </div>

      <div className="flex-1 overflow-y-auto pr-1">
        {items.length === 0 ? (
          <div className="h-full flex items-center justify-center text-center px-6">
            <p className="font-narrative text-sm text-[#d8c49e]/80">No {CATEGORY_TABS.find((t) => t.id === category)?.label.toLowerCase()} images yet in this Tale.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 pb-4">
            {items.map((item, i) => (
              <GeneratedThumb key={item.key} imgKey={item.key} name={item.name} onClick={() => setLightboxIndex(i)} />
            ))}
          </div>
        )}
      </div>

      {activeItem && (
        <Lightbox
          items={items}
          index={lightboxIndex!}
          onClose={() => setLightboxIndex(null)}
          onNav={(i) => setLightboxIndex(i)}
        />
      )}
    </div>
  )
}

function Lightbox({ items, index, onClose, onNav }: { items: GalleryItem[]; index: number; onClose: () => void; onNav: (i: number) => void }) {
  const item = items[index]
  const url = useEntityImage(item.key)

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-xl animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative max-w-3xl w-full bg-[#120c1f] border border-[#f0ca65]/40 rounded-2xl overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.9)] flex flex-col max-h-[92dvh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-3 border-b border-[#e8ca8a]/20 flex items-center justify-between gap-3 bg-black/40">
          <h3 className="font-display font-bold text-sm text-[#fae5b5] truncate">{item.name}</h3>
          <GlassIconButton icon={X} label="Close" compact onClick={onClose} />
        </div>
        <div className="relative flex-1 min-h-0 bg-black/90 flex items-center justify-center p-2 sm:p-4">
          {url ? (
            <img src={url} alt={item.name} className="max-h-[70dvh] w-auto max-w-full object-contain rounded-lg shadow-2xl" />
          ) : (
            <div className="w-8 h-8 border-2 border-[#e8ca8a]/30 border-t-[#f0ca65] rounded-full animate-spin" />
          )}

          {items.length > 1 && (
            <>
              <button
                type="button"
                onClick={() => onNav((index - 1 + items.length) % items.length)}
                aria-label="Previous"
                className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/60 hover:bg-[#f0ca65] text-white hover:text-black border border-white/20 flex items-center justify-center transition-all"
              >
                <ChevronLeft size={18} />
              </button>
              <button
                type="button"
                onClick={() => onNav((index + 1) % items.length)}
                aria-label="Next"
                className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/60 hover:bg-[#f0ca65] text-white hover:text-black border border-white/20 flex items-center justify-center transition-all"
              >
                <ChevronRight size={18} />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
