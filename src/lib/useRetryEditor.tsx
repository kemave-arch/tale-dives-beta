import { useCallback, useEffect, useRef, useState } from 'react'
import { LABEL_CLASS } from './glassChrome.tsx'

interface EditorState {
  originalAction: string
}

// Retry, revised — a big, keyboard-safe alternative to editing a turn's
// original action text in the cramped bottom input bar (the mobile soft
// keyboard covers most of that bar, making anything past a couple of words
// unreadable while typing — same problem useLongTextEditor.tsx already
// solved for every other long-text field in the app, reused here with the
// same window.visualViewport-driven sizing). Distinct from that hook rather
// than reused as-is: a retry needs TWO things, not one — a short note on
// what's wrong with the previous attempt, and the full original action text
// (often the entire Prologue prompt — world background, protagonist
// identity, brief) still available to fall back to line-editing directly.
// Resolves the COMBINED text to resend: the feedback note prepended ahead
// of the (possibly also hand-edited) original, never in place of it — a
// retry on Turn 0 must never lose the World Seeding/Prologue framing this
// action text carries, only add a note on top of it.
//
// Deliberately plain/solid, not the app's usual glass-over-blurred-artwork
// language (GLASS_SURFACE/FIELD_CLASS/GlassButton) — a dense two-textarea
// editing surface reads better with flat, fully opaque panels than with
// backdrop-blur translucency, and there's no artwork behind it worth
// preserving a view of anyway.
const PANEL_BG = 'bg-[#161220]'
const FIELD = 'w-full rounded-xl border border-[#e8ca8a]/25 bg-[#0d0a13] px-3 py-2.5 font-sans text-[12px] leading-relaxed text-[#fbf4e2] placeholder:text-[#8d7d63] outline-none transition-colors duration-150 focus:border-[#f0ca65]'

export function useRetryEditor() {
  const [state, setState] = useState<EditorState | null>(null)
  const [feedback, setFeedback] = useState('')
  const [actionDraft, setActionDraft] = useState('')
  const [availHeight, setAvailHeight] = useState<number | null>(null)
  const resolveRef = useRef<((v: string | null) => void) | null>(null)

  const openRetry = useCallback((originalAction: string) => {
    setState({ originalAction })
    setFeedback('')
    setActionDraft(originalAction)
    return new Promise<string | null>((resolve) => {
      resolveRef.current = resolve
    })
  }, [])

  function close(result: string | null) {
    resolveRef.current?.(result)
    resolveRef.current = null
    setState(null)
  }

  function handleConfirm() {
    const note = feedback.trim()
    const combined = note ? `Player feedback on the previous attempt — revise accordingly: ${note}\n\n${actionDraft}` : actionDraft
    close(combined)
  }

  useEffect(() => {
    if (!state) return
    const updateHeight = () => {
      if (window.visualViewport) setAvailHeight(window.visualViewport.height - 20)
    }
    updateHeight()
    window.visualViewport?.addEventListener('resize', updateHeight)
    return () => window.visualViewport?.removeEventListener('resize', updateHeight)
  }, [state])

  const dialog = state ? (
    <div
      className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black/70 p-3 sm:p-4 overflow-y-auto"
      onClick={(e) => {
        e.stopPropagation()
        close(null)
      }}
    >
      <div
        className={`${PANEL_BG} border border-[#e8ca8a]/20 rounded-2xl w-full max-w-lg flex flex-col p-4 shadow-2xl transition-[max-height] duration-150 mt-1 sm:mt-0`}
        style={{
          maxHeight: availHeight ? `${Math.max(320, availHeight)}px` : undefined,
          height: availHeight ? `${Math.min(availHeight, 640)}px` : '85vh',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 pb-2">
          <span className={LABEL_CLASS}>Retry This Turn</span>
          <span className="block font-narrative italic text-[11px] text-[#e8ca8a]/70 mt-0.5">
            The turn is removed and resent only once you confirm below — closing this cancels the retry entirely.
          </span>
        </div>

        <div className="shrink-0 pb-3">
          <span className={LABEL_CLASS}>What would you like changed?</span>
          <textarea
            autoFocus
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="e.g. Slow the pacing down, don't let my companion die, add more dialogue..."
            rows={3}
            className={`resize-none mt-1 ${FIELD}`}
          />
        </div>

        <div className="shrink-0 pb-1">
          <span className={LABEL_CLASS}>Original action</span>
          <span className="block font-narrative italic text-[11px] text-[#e8ca8a]/70 mt-0.5">
            Edit directly if you need finer control — your note above is added on top of this, not instead of it.
          </span>
        </div>
        <textarea
          value={actionDraft}
          onChange={(e) => setActionDraft(e.target.value)}
          className={`flex-1 min-h-0 mb-3 mt-1 resize-none ${FIELD}`}
        />

        <div className="shrink-0 flex items-center justify-end gap-2 pt-1">
          <button
            onClick={() => close(null)}
            className="rounded-xl border border-[#e8ca8a]/30 px-3 py-2.5 font-display text-xs text-[#e8ca8a] transition-colors duration-150 hover:bg-white/5"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className="rounded-xl bg-[#f0ca65] px-3 py-2.5 font-display text-xs font-semibold text-[#1a1420] transition-colors duration-150 hover:bg-[#f5d685]"
          >
            Retry with Changes
          </button>
        </div>
      </div>
    </div>
  ) : null

  return { openRetry, dialog }
}
