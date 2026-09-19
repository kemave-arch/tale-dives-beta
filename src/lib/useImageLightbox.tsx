import { useCallback, useState } from 'react'
import { X } from 'lucide-react'

// §7 Tap-to-inspect lightbox — a full-screen enlarged view for a generated
// or Codex-stored image. Pure display, no pan/zoom gesture; just a bigger
// look at art that's otherwise cropped small in its own card. Originally
// built inline in Chronicle.tsx for the hero location plate and Codex-popup
// entity images; extracted here so Tale Weaver's own generated images (and
// any future call site) get the exact same behavior instead of a re-write.
export function useImageLightbox() {
  const [lightbox, setLightbox] = useState<{ url: string; caption: string } | null>(null)

  const open = useCallback((url: string, caption: string) => {
    setLightbox({ url, caption })
  }, [])

  const dialog = lightbox && (
    <div
      className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-black/85 p-4 sm:p-6"
      onClick={() => setLightbox(null)}
    >
      <button
        onClick={() => setLightbox(null)}
        aria-label="Close artwork preview"
        className="absolute top-4 right-4 sm:top-6 sm:right-6 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
      >
        <X size={20} />
      </button>
      <img
        src={lightbox.url}
        alt={lightbox.caption}
        className="max-h-[80vh] max-w-full object-contain rounded-lg"
        onClick={(e) => e.stopPropagation()}
      />
      <p className="mt-4 font-display text-sm text-white/80 tracking-wide text-center">{lightbox.caption}</p>
    </div>
  )

  return { open, dialog }
}
