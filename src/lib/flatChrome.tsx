// Flat Chrome — the shared visual kit for the "Story Viewer" alternate
// in-session experience (StoryViewer.tsx, CodexViewer.tsx): opaque ink
// panels, sunk/recessed inputs, hairline dividers. No backdrop-filter
// anywhere in this kit, deliberately — this is the isolated alternative to
// the app's default glass language (lib/glassChrome.tsx), built per a
// mobile-dark-fantasy-UI review that argued (correctly, for the technical
// parts) that a text-heavy narrative reader benefits from a static, fully
// opaque reading plane rather than a translucent one: no GPU blur cost, no
// halation from text sitting over a moving/busy background. See
// PROJECT_REVISION_NOTES.md for the fuller rationale and what was and
// wasn't taken from that review.
import { useState, type ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { ChevronDown, X } from 'lucide-react'

// Ink palette — solid, no alpha-over-blur anywhere. Distinct hex ramp from
// glassChrome.tsx's gold/parchment identity so the two skins read as two
// different rooms, not the same one with a filter removed.
export const INK = {
  canvas: '#0a0812',
  panel: '#161221',
  panelRaised: '#1e1830',
  border: '#2c2440',
  borderHover: '#4a3d6b',
  text: '#f0e9fb',
  textMuted: '#a89bc4',
  accent: '#c4a8ff',
  accentBright: '#dcc8ff',
}

export const FIELD_CLASS =
  'w-full px-3 py-2 rounded-lg bg-[#0f0c18] border border-[#2c2440] text-sm text-[#f0e9fb] placeholder:text-[#a89bc4]/40 outline-none focus:border-[#c4a8ff]/70 transition-colors'
export const LABEL_CLASS = 'block text-[10px] font-display font-semibold uppercase tracking-wider text-[#a89bc4] mb-1'

// A flat panel — solid fill, hairline border, no blur. The one primitive
// almost everything else in this kit sits inside.
export function InkPanel({ className = '', children }: { className?: string; children: ReactNode }) {
  return <div className={`bg-[#161221] border border-[#2c2440] rounded-xl ${className}`}>{children}</div>
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
    default: 'bg-[#1e1830] border-[#2c2440] text-[#f0e9fb] hover:border-[#4a3d6b] hover:bg-[#241c3a]',
    action: 'bg-[#c4a8ff] border-[#c4a8ff] text-[#0a0812] hover:bg-[#dcc8ff] font-semibold',
    danger: 'bg-[#2a1420] border-[#5a2440] text-[#f8b4c4] hover:border-[#7a3454]',
    positive: 'bg-[#142a20] border-[#245a40] text-[#a8f4c4] hover:border-[#347a54]',
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
        {tip && <span className="text-[9px] text-[#a89bc4]/50 italic">{tip}</span>}
      </div>
      {children}
    </div>
  )
}

export function InkTagPill({ children, onRemove }: { children: ReactNode; onRemove?: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-[#2c2440] bg-[#0f0c18] px-2 py-0.5 text-[10px] font-mono text-[#c4a8ff]">
      {children}
      {onRemove && (
        <button onClick={onRemove} className="hover:text-[#f8b4c4]">
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
        <span className="flex items-center gap-1.5 font-display text-xs font-semibold text-[#f0e9fb]">
          {Icon && <Icon size={13} className="text-[#c4a8ff]" />}
          {title}
        </span>
        <ChevronDown size={14} className={`text-[#a89bc4] transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="px-3 pb-3 pt-0 border-t border-[#2c2440]">{children}</div>}
    </InkPanel>
  )
}
