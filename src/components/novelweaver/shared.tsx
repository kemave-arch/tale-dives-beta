import { useState, type ReactNode } from 'react'
import { motion } from 'framer-motion'
import { ChevronLeft, Info, Save, Trash2 } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { SavedPreset } from '../../types.ts'

// Novel Weaver's own small, self-contained visual language — deliberately
// NOT the app's usual glass-over-blurred-artwork chrome (GLASS_SURFACE/
// FIELD_CLASS/GlassButton in lib/glassChrome.tsx). Solid ink panels, thin
// hairline borders, no backdrop-blur anywhere — cheaper to paint, and gives
// this alternate creation flow its own distinct identity rather than
// reading as a reskinned Settings/WorldSetup screen.
export const INK = '#0b0812'
export const PANEL = '#161221'
export const PANEL_RAISED = '#1c1830'
export const GOLD = '#e8ca8a'
export const GOLD_BRIGHT = '#f5dfa0'

export const FIELD =
  'w-full rounded-lg border border-[#3a3252] bg-[#100d1a] px-3 py-2 font-sans text-[13px] text-[#f0e6d2] placeholder:text-[#6b6285] outline-none transition-colors focus:border-[#e8ca8a]'
export const LABEL = 'font-display text-[11px] font-semibold uppercase tracking-[0.1em] text-[#c9b989]'

export function Field({ label, tip, children }: { label: string; tip?: string; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <div>
      <div className="flex items-center gap-1 mb-1">
        <span className={LABEL}>{label}</span>
        {tip && (
          <span className="relative">
            <button type="button" onClick={() => setOpen((v) => !v)} aria-label="Info" className="text-[#c9b989]/60 hover:text-[#e8ca8a]">
              <Info size={12} />
            </button>
            {open && (
              <span
                onClick={() => setOpen(false)}
                className="absolute z-20 left-0 top-5 w-48 rounded-md bg-[#1c1830] border border-[#3a3252] p-2 text-[11px] font-sans text-[#d8cbb0] leading-snug shadow-xl"
              >
                {tip}
              </span>
            )}
          </span>
        )}
      </div>
      {children}
    </div>
  )
}

export function Pill({ children, tone = 'default' }: { children: ReactNode; tone?: 'default' | 'gold' }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-mono uppercase tracking-wide ${
        tone === 'gold' ? 'border-[#e8ca8a]/60 text-[#f5dfa0] bg-[#e8ca8a]/10' : 'border-[#3a3252] text-[#9d93bd]'
      }`}
    >
      {children}
    </span>
  )
}

interface ChapterShellProps {
  numeral: string
  title: string
  subtitle?: string
  accent: string
  onBack: () => void
  children: ReactNode
  footer?: ReactNode
}

// One consistent drill-down surface for all four chapters — sticky header
// (back + title), scrollable body, sticky footer for the confirm action.
export function ChapterShell({ numeral, title, subtitle, accent, onBack, children, footer }: ChapterShellProps) {
  return (
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'tween', duration: 0.22 }}
      className="fixed inset-0 z-40 flex flex-col"
      style={{ background: INK }}
    >
      <div className="shrink-0 flex items-center gap-3 px-4 py-3" style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))', borderBottom: `1px solid ${accent}30` }}>
        <button
          onClick={onBack}
          aria-label="Back to chapters"
          className="w-8 h-8 rounded-full flex items-center justify-center border border-[#3a3252] text-[#d8cbb0] hover:border-[#e8ca8a] transition-colors shrink-0"
        >
          <ChevronLeft size={16} />
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="font-display text-[10px] font-bold" style={{ color: accent }}>
              {numeral}
            </span>
            <h2 className="font-display font-bold text-sm tracking-[0.08em] uppercase text-[#f5dfa0] truncate">{title}</h2>
          </div>
          {subtitle && <p className="font-sans text-[10px] text-[#9d93bd] truncate">{subtitle}</p>}
        </div>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 flex flex-col gap-4">{children}</div>
      {footer && (
        <div className="shrink-0 px-4 py-3 flex gap-2" style={{ borderTop: `1px solid ${accent}30`, paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
          {footer}
        </div>
      )}
    </motion.div>
  )
}

export function PrimaryButton({ onClick, children, icon: Icon, disabled }: { onClick: () => void; children: ReactNode; icon?: LucideIcon; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg py-2.5 font-display text-xs font-bold uppercase tracking-wide text-[#1a1420] transition-transform active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none"
      style={{ background: `linear-gradient(135deg, ${GOLD_BRIGHT}, ${GOLD})` }}
    >
      {Icon && <Icon size={14} />}
      {children}
    </button>
  )
}

export function GhostButton({ onClick, children, icon: Icon, danger }: { onClick: () => void; children: ReactNode; icon?: LucideIcon; danger?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2.5 font-display text-xs font-semibold transition-colors ${
        danger ? 'border-rose-400/40 text-rose-300 hover:bg-rose-400/10' : 'border-[#3a3252] text-[#d8cbb0] hover:border-[#e8ca8a]'
      }`}
    >
      {Icon && <Icon size={13} />}
      {children}
    </button>
  )
}

// Protagonist/World chapters save into the app's existing named-template
// libraries (protagonists/worlds — the same ones WorldSetup/NewGame use),
// not the plain-string SavedPreset store PresetBar below wraps. Same save/
// load/delete pill UI, but keyed off whatever id/name shape the caller's
// library already uses instead of a name typed at save time — the
// protagonist/world's own Name field IS its preset name, matching how
// World Seed Weaver's own save-to-library button behaves.
export function LibraryPresetBar({
  items,
  onLoad,
  onSaveCurrent,
  onDelete,
  saveLabel = 'Save Current',
}: {
  items: { id: string; name: string; subtitle?: string }[]
  onLoad: (id: string) => void
  onSaveCurrent: () => void
  onDelete?: (id: string) => void
  saveLabel?: string
}) {
  return (
    <div className="rounded-lg border border-[#3a3252] bg-[#100d1a] p-2.5 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className={LABEL}>Library</span>
        <button
          type="button"
          onClick={onSaveCurrent}
          className="inline-flex items-center gap-1 text-[10px] font-mono text-[#e8ca8a]/80 hover:text-[#f5dfa0]"
        >
          <Save size={11} /> {saveLabel}
        </button>
      </div>
      {items.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {items.map((it) => (
            <span key={it.id} className="inline-flex items-center gap-1 rounded-full border border-[#3a3252] bg-[#1c1830] pl-2.5 pr-1 py-1">
              <button type="button" onClick={() => onLoad(it.id)} className="text-[11px] font-sans text-[#d8cbb0] hover:text-[#f5dfa0]" title={it.subtitle}>
                {it.name}
              </button>
              {onDelete && (
                <button type="button" onClick={() => onDelete(it.id)} aria-label={`Delete ${it.name}`} className="w-4 h-4 rounded-full flex items-center justify-center text-[#9d93bd] hover:text-rose-300">
                  <Trash2 size={10} />
                </button>
              )}
            </span>
          ))}
        </div>
      ) : (
        <p className="text-[10.5px] font-sans italic text-[#6b6285]">No saved entries yet.</p>
      )}
    </div>
  )
}

// A compact save/load bar reused by every chapter — "include save/load
// presets for each node." Presets are plain SavedPreset[] (id/name/value/
// savedAt) with `value` holding either the raw text (Narrative sub-fields
// elsewhere) or a JSON-stringified structured blob (Cast roster, or this
// chapter's full field set) that the caller parses back.
export function PresetBar({
  presets,
  onLoad,
  onSave,
  onDelete,
}: {
  presets: SavedPreset[]
  onLoad: (preset: SavedPreset) => void
  onSave: (name: string) => void
  onDelete?: (id: string) => void
}) {
  const [naming, setNaming] = useState(false)
  const [name, setName] = useState('')

  return (
    <div className="rounded-lg border border-[#3a3252] bg-[#100d1a] p-2.5 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className={LABEL}>Presets</span>
        {!naming && (
          <button
            type="button"
            onClick={() => setNaming(true)}
            className="inline-flex items-center gap-1 text-[10px] font-mono text-[#e8ca8a]/80 hover:text-[#f5dfa0]"
          >
            <Save size={11} /> Save Current
          </button>
        )}
      </div>
      {naming && (
        <div className="flex gap-1.5">
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Preset name..."
            className={`${FIELD} !py-1.5 !text-[12px]`}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && name.trim()) {
                onSave(name.trim())
                setName('')
                setNaming(false)
              }
            }}
          />
          <button
            type="button"
            onClick={() => {
              if (name.trim()) {
                onSave(name.trim())
                setName('')
                setNaming(false)
              }
            }}
            className="shrink-0 rounded-lg px-2.5 text-[11px] font-display font-bold text-[#1a1420]"
            style={{ background: GOLD }}
          >
            Save
          </button>
          <button type="button" onClick={() => { setNaming(false); setName('') }} className="shrink-0 text-[11px] text-[#9d93bd] px-1">
            Cancel
          </button>
        </div>
      )}
      {presets.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {presets.map((p) => (
            <span key={p.id} className="inline-flex items-center gap-1 rounded-full border border-[#3a3252] bg-[#1c1830] pl-2.5 pr-1 py-1">
              <button type="button" onClick={() => onLoad(p)} className="text-[11px] font-sans text-[#d8cbb0] hover:text-[#f5dfa0]">
                {p.name}
              </button>
              {onDelete && (
                <button type="button" onClick={() => onDelete(p.id)} aria-label={`Delete ${p.name}`} className="w-4 h-4 rounded-full flex items-center justify-center text-[#9d93bd] hover:text-rose-300">
                  <Trash2 size={10} />
                </button>
              )}
            </span>
          ))}
        </div>
      ) : (
        <p className="text-[10.5px] font-sans italic text-[#6b6285]">No saved presets yet.</p>
      )}
    </div>
  )
}
