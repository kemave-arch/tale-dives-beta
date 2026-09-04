import { useMemo, type ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { ArrowLeft } from 'lucide-react'
import { CyclingBackground } from './cyclingBackground.tsx'

// Shared "border-only glassmorphism" chrome for screens that sit directly on
// top of the cycling background art (Title, MainMenu) — transparent fill at
// rest, a thin gradient-gold border, a frosted white tint + blur that only
// appears on hover/press. Two things worth knowing before touching this:
// - The ring is built as its own clipped/masked shape so the gradient can
//   never bleed into the interior (a plain fill behind a "transparent"
//   inner layer just shows straight through — that was the original bug).
// - `backdrop-filter` is deliberately left OUT of any `transition-[...]`
//   list here. Tailwind's `backdrop-blur-none` compiles to `none`, not
//   `blur(0)` — `none` is a keyword, not a numeric function, so most
//   browser engines can't interpolate toward/from it and instead just
//   freeze on the last value that *did* render, leaving hover's blur stuck
//   on after the mouse leaves. Background-color and box-shadow animate
//   fine (real numeric values); backdrop-filter just switches instantly.

// A tapered-corner (chamfered) rectangle instead of a rounded pill.
export const TAPER_CLIP =
  'polygon(10px 0, calc(100% - 10px) 0, 100% 10px, 100% calc(100% - 10px), calc(100% - 10px) 100%, 10px 100%, 0 calc(100% - 10px), 0 10px)'

// Uniform 1.5px hollow perimeter for the tapered rectangle, covering all 8
// edges (4 straight, 4 diagonal taper cuts) via one evenodd cutout — traces
// the outer TAPER_CLIP outline plus an inner copy inset by 1.5px, so the
// fill between them is the ring. Replaces the mask-composite trick (which
// only produces a uniform ring for a plain rectangle/rounded-rect — the
// tapered case needed the ring built taper-aware from the start, not
// clipped after the fact, or the ring reads unevenly thick at the corners).
export const TAPER_BORDER_CLIP =
  'polygon(evenodd, 10px 0, calc(100% - 10px) 0, 100% 10px, 100% calc(100% - 10px), calc(100% - 10px) 100%, 10px 100%, 0 calc(100% - 10px), 0 10px, 10px 0, 10.62px 1.5px, calc(100% - 10.62px) 1.5px, calc(100% - 1.5px) 10.62px, calc(100% - 1.5px) calc(100% - 10.62px), calc(100% - 10.62px) calc(100% - 1.5px), 10.62px calc(100% - 1.5px), 1.5px calc(100% - 10.62px), 1.5px 10.62px, 10.62px 1.5px, 10px 0)'

const RING_GRADIENT = 'linear-gradient(135deg, rgba(245,223,160,0.75), rgba(240,202,101,0.95), rgba(168,127,44,0.65))'

function GradientRing({ tapered }: { tapered?: boolean }) {
  if (tapered) {
    return <span aria-hidden="true" className="absolute inset-0 pointer-events-none" style={{ background: RING_GRADIENT, clipPath: TAPER_BORDER_CLIP }} />
  }
  return (
    <span
      aria-hidden="true"
      className="absolute inset-0 pointer-events-none rounded-[inherit]"
      style={{
        border: '1.5px solid transparent',
        background: `${RING_GRADIENT} border-box`,
        WebkitMask: 'linear-gradient(#fff 0 0) padding-box, linear-gradient(#fff 0 0) border-box',
        WebkitMaskComposite: 'xor',
        maskComposite: 'exclude',
      }}
    />
  )
}

interface GlassCTAButtonProps {
  onClick: () => void
  icon?: LucideIcon
  children: ReactNode
  className?: string
}

// Primary call-to-action — tapered rectangle, gradient ring, glass interior
// that's invisible at rest and blurs + glows on hover/press.
export function GlassCTAButton({ onClick, icon: Icon, children, className = '' }: GlassCTAButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`group relative inline-flex drop-shadow-[0_8px_14px_rgba(0,0,0,0.85)] transition-all duration-150 hover:-translate-y-0.5 hover:brightness-110 active:scale-[0.98] active:brightness-125 ${className}`}
      style={{ clipPath: TAPER_CLIP }}
    >
      {/* Fill sits BELOW the ring so the frosted tint never dulls the gold
          border on hover. bg/box-shadow animate; backdrop-filter deliberately
          doesn't (see the module comment) — it still changes instantly on
          hover/press, just without a transition riding along that can get
          stuck. focus-visible mirrors hover so keyboard users get the same
          affordance. */}
      <span
        className="absolute inset-0 bg-white/0 backdrop-blur-none transition-[background-color,box-shadow] duration-200 group-hover:bg-white/25 group-hover:backdrop-blur-md group-hover:shadow-[0_0_18px_2px_rgba(240,202,101,0.35)] group-focus-visible:bg-white/25 group-focus-visible:backdrop-blur-md group-active:bg-white/30 group-active:backdrop-blur-md group-active:shadow-[0_0_34px_10px_rgba(240,202,101,0.7)]"
        style={{ clipPath: TAPER_CLIP }}
      />
      <GradientRing tapered />
      <span className="relative z-10 flex items-center justify-center gap-2 px-6 py-2.5 font-display text-sm uppercase tracking-[0.2em] text-[#f5dfa0]">
        <span className="text-[#f0ca65]">◆</span>
        {Icon && <Icon size={14} />}
        {children}
        <span className="text-[#f0ca65]">◆</span>
      </span>
    </button>
  )
}

type IconTone = 'default' | 'action' | 'danger'

const ICON_TONE_CLASS: Record<IconTone, string> = {
  default: 'border-[#e8ca8a]/35 text-[#e8ca8a]/85 hover:border-[#e8ca8a] hover:text-[#f5dfa0]',
  action: 'border-[#f0ca65] text-[#f5dfa0] hover:shadow-[0_0_12px_1px_rgba(240,202,101,0.5)]',
  danger: 'border-rose-400/40 text-rose-300/85 hover:border-rose-400 hover:text-rose-200',
}

interface GlassIconButtonProps {
  icon: LucideIcon
  label: string
  onClick: () => void
  tone?: IconTone
  compact?: boolean
  disabled?: boolean
}

// Small circular border-only glass button — the cycling-background
// equivalent of MainMenu's old skin-token IconButton.
export function GlassIconButton({ icon: Icon, label, onClick, tone = 'default', compact = false, disabled = false }: GlassIconButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={`inline-flex items-center justify-center shrink-0 rounded-full border bg-transparent backdrop-blur-sm transition-colors duration-150 disabled:opacity-35 disabled:pointer-events-none ${compact ? 'w-8 h-8' : 'w-10 h-10'} ${ICON_TONE_CLASS[tone]}`}
    >
      <Icon size={compact ? 15 : 18} />
    </button>
  )
}

const BUTTON_TONE_CLASS: Record<IconTone | 'positive', string> = {
  default: 'border-[#e8ca8a]/35 text-[#e8ca8a]/90 hover:border-[#e8ca8a] hover:text-[#f5dfa0] hover:bg-[#e8ca8a]/10',
  action: 'border-[#f0ca65]/70 text-[#f5dfa0] bg-[#e8ca8a]/10 hover:bg-[#e8ca8a]/20 hover:shadow-[0_0_14px_1px_rgba(240,202,101,0.35)]',
  danger: 'border-rose/40 text-rose hover:border-rose hover:bg-rose/10',
  positive: 'border-emerald/40 text-emerald hover:border-emerald hover:bg-emerald/10',
}

interface GlassButtonProps {
  onClick: () => void
  children: ReactNode
  icon?: LucideIcon
  tone?: IconTone | 'positive'
  disabled?: boolean
  className?: string
}

// Ordinary labelled button — the workhorse for rows of actions (Settings'
// backup grid, Codex's editor controls). GlassCTAButton stays reserved for a
// screen's single primary action; using it everywhere flattens the hierarchy.
export function GlassButton({ onClick, children, icon: Icon, tone = 'default', disabled = false, className = '' }: GlassButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-1.5 rounded-xl border bg-transparent backdrop-blur-sm px-3 py-2.5 font-display text-xs transition-colors duration-150 disabled:opacity-35 disabled:pointer-events-none ${BUTTON_TONE_CLASS[tone]} ${className}`}
    >
      {Icon && <Icon size={14} className="shrink-0" />}
      {children}
    </button>
  )
}

// Plain rounded-corner glass surface for cards/rows/panels — no gradient
// ring, just a thin solid border, transparent fill, blur. className string
// (not a component) so it composes freely with layout classes per call site.
export const GLASS_SURFACE = 'border border-[#e8ca8a]/25 bg-transparent backdrop-blur-sm'
export const GLASS_SURFACE_HOVER = 'transition-colors duration-150 hover:border-[#e8ca8a]/60'

// ---------------------------------------------------------------------------
// Screen-level shell
// ---------------------------------------------------------------------------

// Two grounds, deliberately. Screens on the way INTO a tale — Title, Main Menu
// and the four creation steps — sit on the cycling artwork, so building a story
// reads as continuous with the front door. Screens you use INSIDE one —
// Chronicle, Codex, Settings — sit on a flat dark ground, where dense forms and
// long scrollable lists need to stay legible and the artwork would just be
// noise competing with the text.
export type Ground = 'art' | 'dark'

// Rising gold embers over the artwork, echoing the illustrations' own painted
// light-streaks. Started life inside Title; shared here so every ground="art"
// screen gets the same ambience rather than the effect stopping dead the
// moment you leave the front door. Positions randomized once per mount, with
// negative delays so they don't all ignite on the same beat.
export function AmbientSparks({ count = 22 }: { count?: number }) {
  const sparks = useMemo(
    () =>
      Array.from({ length: count }, () => {
        const size = 2 + Math.random() * 2.5
        return {
          left: `${Math.random() * 100}%`,
          bottom: `${Math.random() * 25}%`,
          size,
          duration: `${9 + Math.random() * 8}s`,
          delay: `${-(Math.random() * 17)}s`,
        }
      }),
    [count],
  )
  return (
    <div className="title-sparks" aria-hidden="true">
      {sparks.map((s, i) => (
        <span
          key={i}
          style={{ left: s.left, bottom: s.bottom, width: `${s.size}px`, height: `${s.size}px`, animationDuration: s.duration, animationDelay: s.delay }}
        />
      ))}
    </div>
  )
}

// Uniform (not bottom-only like Title's) so a long scrolling page stays
// readable over its whole length, not just the last screenful.
const ART_SCRIM = 'linear-gradient(180deg, rgba(4,3,7,0.62), rgba(4,3,7,0.72) 30%, rgba(4,3,7,0.8))'

interface GlassScreenProps {
  ground: Ground
  children: ReactNode
  // Pin the root to viewport height as a flex column, for screens built as
  // fixed header + scrolling middle + fixed footer. Left off, the page
  // scrolls as one document (MainMenu, Codex).
  fill?: boolean
  className?: string
}

export function GlassScreen({ ground, children, fill = false, className = '' }: GlassScreenProps) {
  return (
    <div className={`relative text-ink ${fill ? 'h-dvh flex flex-col overflow-hidden' : 'min-h-dvh'} ${ground === 'dark' ? 'bg-canvas' : ''} ${className}`}>
      {ground === 'art' && (
        <>
          <CyclingBackground fixed />
          <div className="fixed inset-0 z-0 pointer-events-none" style={{ background: ART_SCRIM }} />
          {/* Above the art and its scrim, below every panel — see .title-sparks. */}
          <AmbientSparks />
        </>
      )}
      <div className={`relative z-10 ${fill ? 'flex-1 min-h-0 flex flex-col' : ''}`}>{children}</div>
    </div>
  )
}

interface GlassHeaderProps {
  title?: string
  subtitle?: string
  onBack?: () => void
  right?: ReactNode
  className?: string
}

// One header for every screen: optional back arrow, a title/subtitle block
// that truncates rather than wraps (so the row stays one line on a phone),
// and a right-hand slot for per-screen controls.
export function GlassHeader({ title, subtitle, onBack, right, className = '' }: GlassHeaderProps) {
  return (
    <header
      className={`shrink-0 flex items-center gap-3 px-4 pb-3 ${className}`}
      style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}
    >
      {onBack && <GlassIconButton icon={ArrowLeft} label="Back" onClick={onBack} />}
      <div className="flex-1 min-w-0">
        {title && <h2 className="font-display font-bold text-lg text-[#f0ca65] truncate">{title}</h2>}
        {subtitle && <p className="font-narrative italic text-xs text-[#e8ca8a]/95 truncate">{subtitle}</p>}
      </div>
      {right && <div className="flex items-center gap-1 shrink-0">{right}</div>}
    </header>
  )
}

interface GlassTabsProps<T extends string> {
  tabs: readonly { id: T; label: string; icon?: LucideIcon }[]
  value: T
  onChange: (id: T) => void
  className?: string
}

// The tab strip MainMenu introduced, extracted so Codex and Settings stop
// each shipping their own slightly-different version.
export function GlassTabs<T extends string>({ tabs, value, onChange, className = '' }: GlassTabsProps<T>) {
  return (
    <nav className={`${GLASS_SURFACE} rounded-2xl p-1 flex gap-1 ${className}`}>
      {tabs.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          onClick={() => onChange(id)}
          className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2 px-1 border font-display text-xs transition-colors duration-150 ${
            value === id ? 'border-[#f0ca65]/70 text-[#f5dfa0]' : 'border-transparent text-[#e8ca8a]/85 hover:text-[#f5dfa0]'
          }`}
        >
          {Icon && <Icon size={15} className="shrink-0" />}
          <span className="truncate">{label}</span>
        </button>
      ))}
    </nav>
  )
}

// ---------------------------------------------------------------------------
// Form primitives
// ---------------------------------------------------------------------------

// Shared by input/textarea. Transparent at rest, warming slightly on focus —
// same "invisible until you touch it" logic as GlassCTAButton's interior.
export const FIELD_CLASS =
  'w-full rounded-xl border border-[#e8ca8a]/25 bg-[#e8ca8a]/[0.04] backdrop-blur-sm px-3 py-2 font-narrative text-sm text-ink placeholder:text-[#e8ca8a]/50 outline-none transition-colors duration-150 focus:border-[#f0ca65]/70 focus:bg-[#e8ca8a]/[0.08]'

// A <select>'s dropdown list is painted by the OS, and it inherits the
// element's own background — a near-transparent select gets an unreadable
// near-white popup on Windows/Chrome. The option overrides are not optional.
export const SELECT_CLASS = `${FIELD_CLASS} [&>option]:bg-[#14101c] [&>option]:text-[#ecdcb8]`

export const LABEL_CLASS = 'font-display text-[11px] uppercase tracking-[0.14em] text-[#f0d9a4]'

// The hint sits on the label's own line, not under the input — trailing it
// below the field left it floating between one field and the next label, so it
// read as a caption for the wrong control. `items-baseline` keeps it sitting
// on the label's baseline despite the two different fonts and sizes, and
// `flex-wrap` lets a long hint drop to its own line on a narrow screen rather
// than crushing the label beside it.
export function GlassField({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="flex flex-wrap items-baseline gap-x-2">
        <span className={LABEL_CLASS}>{label}</span>
        {hint && <span className="font-narrative italic text-[11px] text-[#e8ca8a]/70">{hint}</span>}
      </span>
      {children}
    </label>
  )
}

interface GlassSegmentedProps<T extends string> {
  options: readonly { id: T; label: string }[]
  value: T
  onChange: (id: T) => void
  className?: string
}

// The "pick one of two or three" row used all over Settings and Tale Brief,
// which had been hand-rolled with slightly different borders each time.
export function GlassSegmented<T extends string>({ options, value, onChange, className = '' }: GlassSegmentedProps<T>) {
  return (
    <div className={`flex gap-2 ${className}`}>
      {options.map(({ id, label }) => (
        <button
          key={id}
          onClick={() => onChange(id)}
          className={`flex-1 rounded-xl border px-2 py-2 font-display text-xs transition-colors duration-150 ${
            value === id
              ? 'border-[#f0ca65]/70 bg-[#e8ca8a]/10 text-[#f5dfa0]'
              : 'border-[#e8ca8a]/25 text-[#e8ca8a]/85 hover:border-[#e8ca8a]/50 hover:text-[#f5dfa0]'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Dashed "add new" affordances (moved out of MainMenu so every screen's
// empty-state / add-row control matches)
// ---------------------------------------------------------------------------

export const DASHED_ROW_CLASS =
  'flex items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-[#e8ca8a]/35 text-[#e8ca8a]/80 py-2.5 font-display text-sm bg-transparent backdrop-blur-sm transition-colors duration-150 hover:border-[#e8ca8a] hover:text-[#f5dfa0]'

export function DashedCard({ icon: Icon, label, onClick, children }: { icon: LucideIcon; label: string; onClick: () => void; children?: ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="group flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-[#e8ca8a]/35 text-[#e8ca8a]/80 py-10 bg-transparent backdrop-blur-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-[#e8ca8a] hover:text-[#f5dfa0] hover:shadow-[0_0_18px_2px_rgba(240,202,101,0.2)]"
    >
      <span className="w-12 h-12 rounded-full border border-[#e8ca8a]/50 flex items-center justify-center transition-all duration-200 group-hover:border-[#f0ca65] group-hover:scale-110">
        <Icon size={22} />
      </span>
      <span className="font-display text-sm">{label}</span>
      {children}
    </button>
  )
}
