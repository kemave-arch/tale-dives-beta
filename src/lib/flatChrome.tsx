// Flat Chrome — the shared visual kit for the "Story Viewer" alternate
// in-session experience (StoryViewer.tsx, CodexViewer.tsx): opaque
// near-white parchment panels, sunk/recessed inputs, hairline dividers. No
// backdrop-filter anywhere in this kit, deliberately — built per a
// mobile-dark-fantasy-UI review that argued (correctly, for the technical
// parts) that a text-heavy narrative reader benefits from a static, fully
// opaque reading plane rather than a translucent one: no GPU blur cost, no
// halation from text sitting over a moving/busy background. Same warm
// parchment/gold identity as the rest of the app (and the same values as
// `.parchment-surface` in index.css) — only the blur is gone, not the
// palette. See PROJECT_REVISION_NOTES.md for the fuller rationale.
import { useState, type ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { ChevronDown, X } from 'lucide-react'

// Ink palette — solid, no alpha-over-blur anywhere.
export const INK = {
  canvas: '#f8f1de',
  panel: '#fffdf6',
  panelRaised: '#ede0c0',
  border: '#e0d3ba',
  borderHover: '#c9a961',
  text: '#2a241e',
  textMuted: '#6b6152',
  accent: '#8a6a24',
  accentBright: '#b08d3f',
}

export const FIELD_CLASS =
  'w-full px-3 py-2 rounded-lg bg-[#fdf7e6] border border-[#e0d3ba] text-sm text-[#2a241e] placeholder:text-[#6b6152]/40 outline-none focus:border-[#8a6a24]/70 transition-colors'
export const LABEL_CLASS = 'block text-[10px] font-display font-semibold uppercase tracking-wider text-[#6b6152] mb-1'

// A flat panel — solid fill, hairline border, no blur. The one primitive
// almost everything else in this kit sits inside.
export function InkPanel({ className = '', children }: { className?: string; children: ReactNode }) {
  return <div className={`bg-[#fffdf6] border border-[#e0d3ba] rounded-xl ${className}`}>{children}</div>
}

export function InkButton({
  icon: Icon,
  tone = 'default',
  compact = false,
  disabled,
  className = '',
  children,
  ...rest
}: {
  icon?: LucideIcon
  tone?: 'default' | 'action' | 'danger' | 'positive'
  compact?: boolean
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const toneClass = {
    default: 'bg-[#ede0c0] border-[#e0d3ba] text-[#2a241e] hover:border-[#c9a961] hover:bg-[#e4d4a8]',
    action: 'bg-[#e8ca8a] border-[#e8ca8a] text-[#241a08] hover:bg-[#f0ca65] font-semibold',
    danger: 'bg-[#fce7ea] border-[#e3a9ba] text-[#9f1239] hover:border-[#c76a86]',
    positive: 'bg-[#dff3e8] border-[#a8d9bf] text-[#0f5132] hover:border-[#5fae82]',
  }[tone]
  return (
    <button
      {...rest}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg border font-display text-xs transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer ${
        compact ? 'w-8 h-8' : 'px-3 py-1.5'
      } ${toneClass} ${className}`}
    >
      {Icon && <Icon size={compact ? 15 : 13} />}
      {children}
    </button>
  )
}

export function InkField({ label, tip, children }: { label: string; tip?: string; children: ReactNode }) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <label className={LABEL_CLASS}>{label}</label>
        {tip && <span className="text-[9px] text-[#6b6152]/50 italic">{tip}</span>}
      </div>
      {children}
    </div>
  )
}

export function InkTagPill({ children, onRemove }: { children: ReactNode; onRemove?: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-[#e0d3ba] bg-[#fdf7e6] px-2 py-0.5 text-[10px] font-mono text-[#8a6a24]">
      {children}
      {onRemove && (
        <button onClick={onRemove} className="hover:text-[#9f1239]">
          <X size={9} />
        </button>
      )}
    </span>
  )
}

// A collapsible section — used both for the Codex "which fields to show"
// grouping and for anything else that wants a plain expand/collapse block
// without a modal.
export function InkAccordion({
  title,
  icon: Icon,
  defaultOpen = false,
  children,
}: {
  title: string
  icon?: LucideIcon
  defaultOpen?: boolean
  children: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <InkPanel className="overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-left"
      >
        <span className="flex items-center gap-1.5 font-display text-xs font-semibold text-[#2a241e]">
          {Icon && <Icon size={13} className="text-[#8a6a24]" />}
          {title}
        </span>
        <ChevronDown size={14} className={`text-[#6b6152] transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="px-3 pb-3 pt-0 border-t border-[#e0d3ba]">{children}</div>}
    </InkPanel>
  )
}
