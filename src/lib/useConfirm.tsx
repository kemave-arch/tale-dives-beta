import { useCallback, useRef, useState } from 'react'
import { AlertTriangle } from 'lucide-react'

// window.confirm() is unreliable inside this app's embedded preview
// environments — it can resolve to `false` immediately with no dialog ever
// shown, rather than actually blocking for a real answer, silently no-oping
// every destructive action gated behind it. Every one of those now routes
// through this in-app modal instead, which has no such dependency on the
// host's native dialog plumbing.
export function useConfirm() {
  const [message, setMessage] = useState<string | null>(null)
  const resolveRef = useRef<((v: boolean) => void) | null>(null)

  const confirm = useCallback((msg: string) => {
    setMessage(msg)
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve
    })
  }, [])

  function respond(value: boolean) {
    resolveRef.current?.(value)
    resolveRef.current = null
    setMessage(null)
  }

  const dialog = message ? (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-6"
      onClick={(e) => {
        e.stopPropagation() // never let this bubble into a host modal's own backdrop-close handler
        respond(false)
      }}
    >
      {/* Solid vellum surface, not the near-transparent .glass-panel fill —
          that class is tuned to sit over Title/MainMenu's dark cycling
          artwork, so a confirm dialog fired from a light parchment screen
          (Quick Play, Tale Weaving, Codex, ...) rendered with almost no
          background of its own and washed-out, low-contrast text.
          `parchment-surface` is required here, not just the light bg color:
          this dialog mounts as a sibling of whatever screen called confirm()
          (often outside that screen's own .parchment-surface wrapper), so
          without re-scoping here `text-ink`/`text-rose`/`text-gold-accent`
          would still resolve to the dark-chrome token values (light cream,
          light red) — unreadable against this solid light card regardless
          of which screen triggered it. */}
      <div
        className="parchment-surface rounded-2xl p-5 w-full max-w-xs bg-[#fbf8f3] border border-gold-accent/30 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-2.5 mb-4">
          <AlertTriangle size={18} className="text-rose shrink-0 mt-0.5" />
          <p className="font-narrative text-sm text-ink">{message}</p>
        </div>
        <div className="flex justify-end gap-2">
          <button
            onClick={() => respond(false)}
            className="rounded-full border border-gold-accent/40 px-4 py-1.5 font-display text-xs font-semibold text-ink hover:bg-gold-accent/10 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => respond(true)}
            className="rounded-full bg-rose px-4 py-1.5 font-display text-xs font-semibold text-white hover:brightness-95 transition-[filter]"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  ) : null

  return { confirm, dialog }
}
