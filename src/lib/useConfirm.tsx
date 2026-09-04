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
      <div className="glass-panel glow-ring rounded-2xl p-5 w-full max-w-xs" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-2.5 mb-4">
          <AlertTriangle size={18} className="text-rose shrink-0 mt-0.5" />
          <p className="font-narrative text-sm text-ink">{message}</p>
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={() => respond(false)} className="rounded-full border border-gold-accent/50 px-4 py-1.5 font-display text-xs">
            Cancel
          </button>
          <button onClick={() => respond(true)} className="rounded-full bg-rose px-4 py-1.5 font-display text-xs font-semibold text-white">
            Confirm
          </button>
        </div>
      </div>
    </div>
  ) : null

  return { confirm, dialog }
}
