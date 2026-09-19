import { useState } from 'react'
import { Pencil, Check, X } from 'lucide-react'

// Shared "click a pencil, edit the generated text in place, Save or Cancel"
// affordance — used by both Quick Play's per-section review/Tale Initiation
// Overview (screens/QuickPlay.tsx) and Inspired Mode's Tale Overview modal
// (screens/TaleWeaver.tsx) so a woven World/Protagonist/Region/Location/
// Faction/NPC/Lore/Beat can be hand-corrected without a full reroll or a
// trip back to that phase's own chat screen.

export interface EditField {
  key: string
  label: string
  value: string
  multiline?: boolean
  placeholder?: string
}

// Renders whatever `renderView` gives it (the read-only card/row, plus an
// "open edit" trigger it decides where to place) until editing starts, then
// swaps to a plain field-by-field form in the same spot. `renderView` gets
// an `openEdit` callback to wire up its own pencil button/icon.
export function EditableCard({
  fields, onSave, renderView, className,
}: {
  fields: EditField[]
  onSave: (values: Record<string, string>) => void
  renderView: (openEdit: () => void) => React.ReactNode
  className?: string
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<Record<string, string>>({})

  function openEdit() {
    setDraft(Object.fromEntries(fields.map((f) => [f.key, f.value])))
    setEditing(true)
  }

  if (!editing) return <>{renderView(openEdit)}</>

  return (
    <div className={className ?? 'flex flex-col gap-1.5 w-full'}>
      {fields.map((f, i) => (
        <div key={f.key} className="flex flex-col gap-0.5">
          <span className="font-mono text-[9px] uppercase tracking-wide text-ink-muted/60">{f.label}</span>
          {f.multiline ? (
            <textarea
              autoFocus={i === 0}
              rows={3}
              value={draft[f.key] ?? ''}
              onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))}
              placeholder={f.placeholder}
              className="w-full px-2 py-1.5 rounded-md bg-white border border-gold-accent/30 text-xs text-ink shadow-xs outline-none focus:border-gold-primary focus:ring-1 focus:ring-gold-primary resize-none leading-relaxed"
            />
          ) : (
            <input
              type="text"
              autoFocus={i === 0}
              value={draft[f.key] ?? ''}
              onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))}
              placeholder={f.placeholder}
              className="w-full px-2 py-1.5 rounded-md bg-white border border-gold-accent/30 text-xs text-ink shadow-xs outline-none focus:border-gold-primary focus:ring-1 focus:ring-gold-primary"
            />
          )}
        </div>
      ))}
      <div className="flex items-center gap-1.5 pt-0.5">
        <button
          type="button"
          onClick={() => { onSave(draft); setEditing(false) }}
          className="flex items-center gap-1 px-2 py-1 rounded-md bg-[#b08830] hover:bg-[#8d6b1d] text-white text-[10px] font-bold transition-colors"
        >
          <Check size={11} /> Save
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="flex items-center gap-1 px-2 py-1 rounded-md border border-gold-accent/30 text-ink-muted hover:bg-gold-accent/10 text-[10px] font-semibold transition-colors"
        >
          <X size={11} /> Cancel
        </button>
      </div>
    </div>
  )
}

// The pencil trigger itself, factored out since almost every `renderView`
// places an identical small icon button — just wired to a different
// `openEdit`.
export function EditPencilButton({ onClick, title = 'Edit' }: { onClick: () => void; title?: string }) {
  return (
    <span
      role="button"
      tabIndex={0}
      onClick={(e) => { e.stopPropagation(); onClick() }}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); onClick() } }}
      className="p-1 rounded text-ink-muted/60 hover:text-gold-primary hover:bg-gold-accent/10 transition-colors cursor-pointer shrink-0"
      title={title}
    >
      <Pencil size={12} />
    </span>
  )
}
