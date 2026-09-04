import { useCallback, useRef, useState } from 'react'
import { FIELD_CLASS, GLASS_SURFACE, GlassButton, LABEL_CLASS } from './glassChrome.tsx'

interface EditorState {
  label: string
  hint?: string
  value: string
}

// A reusable "expand to edit" modal for any long-text field in the app —
// same promise-based shape as useConfirm.tsx (same backdrop-click-cancels
// with stopPropagation nesting safety, so it can open from inside another
// modal, e.g. a Codex CRUD panel, without the click bubbling into that
// modal's own backdrop-close handler), and same reason to exist: Cancel
// here only discards an in-progress draft, never the real field, so there's
// no destructive action to gate behind window.confirm() (or any confirm at
// all) in the first place — no foothold for that bug class.
export function useLongTextEditor() {
  const [state, setState] = useState<EditorState | null>(null)
  const [draft, setDraft] = useState('')
  const resolveRef = useRef<((v: string | null) => void) | null>(null)

  const edit = useCallback((label: string, value: string, hint?: string) => {
    setState({ label, hint, value })
    setDraft(value)
    return new Promise<string | null>((resolve) => {
      resolveRef.current = resolve
    })
  }, [])

  function close(result: string | null) {
    resolveRef.current?.(result)
    resolveRef.current = null
    setState(null)
  }

  const dialog = state ? (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => {
        e.stopPropagation()
        close(null)
      }}
    >
      <div
        className={`${GLASS_SURFACE} rounded-2xl w-full max-w-lg h-[80vh] sm:h-[70vh] flex flex-col`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 px-4 pt-4 pb-2">
          <span className={LABEL_CLASS}>{state.label}</span>
          {state.hint && <span className="block font-narrative italic text-[11px] text-[#e8ca8a]/70 mt-0.5">{state.hint}</span>}
        </div>
        <textarea
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className={`flex-1 min-h-0 mx-4 mb-3 resize-none ${FIELD_CLASS}`}
        />
        <div className="shrink-0 flex justify-end gap-2 px-4 pb-4">
          <GlassButton onClick={() => close(null)}>Cancel</GlassButton>
          <GlassButton tone="action" onClick={() => close(draft)}>Save</GlassButton>
        </div>
      </div>
    </div>
  ) : null

  return { edit, dialog }
}
