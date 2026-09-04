import { useState, useRef, useEffect, useCallback, useMemo, memo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Menu, Settings as SettingsIcon, Send, Star, BookOpen, Library, Sparkle, X, ExternalLink,
  ChevronUp, ChevronDown, ChevronsDown, History, Pause, Users, Backpack, Map as MapIcon, ShieldCheck, Target, Skull, HelpCircle,
  Unlock, Lock, Repeat, Hammer, Ghost, Compass, ScrollText, User, Swords, Sparkles,
  AlertTriangle, Copy, Check, RotateCcw,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { renderNarrative, type TapTermHandler } from '../lib/richText.tsx'
import { TURN_STATE_META } from '../lib/turnStates.ts'
import { formatCurrency } from '../lib/currency.ts'
import { slugify } from '../lib/slug.ts'
import { BANG_COMMANDS } from '../lib/bangCommands.ts'
import { isHidden } from '../lib/discovery.ts'
import type { CategoryId } from './Codex.tsx'
import type {
  ApiSettings, BestiaryEntry, CombatState, CraftingJob, FactionEntry, GameTime, KeywordLink, LocationEntry, LogEntry, LoreEntry, NpcEntry, Player,
  ProseDepthConfig, QuestEntry, SkillEntry, SlashCommand,
} from '../types.ts'

interface ChronicleProps {
  title: string
  player: Player
  combat?: CombatState
  log: LogEntry[]
  busy: boolean
  error: string | null
  chromeOpacity: number
  npcs: Record<string, NpcEntry>
  locations: Record<string, LocationEntry>
  factions: Record<string, FactionEntry>
  lore: Record<string, LoreEntry>
  quests: Record<string, QuestEntry>
  bestiary: Record<string, BestiaryEntry>
  skills: Record<string, SkillEntry>
  crafting?: CraftingJob[]
  apiSettings?: ApiSettings
  proseDepth?: ProseDepthConfig
  lastActionText?: string
  onRetry?: () => void
  onDismissError?: () => void
  onSend: (action: string, forcePause?: boolean) => void
  onBangCommand: (raw: string) => void
  slashCommands: SlashCommand[]
  onOpenSlashManager: () => void
  onOpenSettings: () => void
  onOpenMenu: () => void
  onOpenCodex: () => void
  onOpenCodexEntry: (category: KeywordLink['category'], id: string) => void
  onOpenCodexCategory: (category: CategoryId) => void
}

const WINDOW_SIZE = 20 // §9.2 — cap how many turns stay mounted; older ones load in on demand
const INPUT_MAX_HEIGHT = 88

// §6.5 Fantasy Radial Menu — a fan of shortcuts arcing upward from the FAB so
// it never covers the input tray below. Angles are standard math degrees
// (0=right, 90=up); spread across the upper arc rather than a full circle.
const RADIAL_RADIUS = 74
function radialPos(index: number, count: number): { x: number; y: number } {
  const startDeg = 12
  const endDeg = 168
  const deg = count === 1 ? 90 : startDeg + (index * (endDeg - startDeg)) / (count - 1)
  const rad = (deg * Math.PI) / 180
  return { x: Math.cos(rad) * RADIAL_RADIUS, y: -Math.sin(rad) * RADIAL_RADIUS }
}

function PoolBar({ label, value, max, colorVar }: { label: string; value: number; max: number; colorVar: string }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0
  return (
    <div className="flex items-center gap-1.5 flex-1 min-w-0">
      <span className="w-5 shrink-0 font-mono text-[10px] font-semibold" style={{ color: colorVar }}>
        {label}
      </span>
      {/* §mobile — numbers only, no bar; the bar returns at sm: and up. */}
      <div className="hidden sm:block flex-1 h-1.5 rounded-full bg-white/15 overflow-hidden min-w-[24px]">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: colorVar }} />
      </div>
      <span className="shrink-0 font-mono text-[10px] font-semibold" style={{ color: colorVar }}>
        {value}/{max}
      </span>
    </div>
  )
}

function CurrencyBadge({ copper }: { copper: number }) {
  const { p, g, s, c } = formatCurrency(copper)
  const parts = [
    p > 0 && `${p}P`,
    g > 0 && `${g}G`,
    (s > 0 || (p === 0 && g === 0)) && `${s}S`,
    (c > 0 || (p === 0 && g === 0 && s === 0)) && `${c}C`,
  ].filter(Boolean)
  return <span className="font-mono text-[10px] text-[#e8ca8a] shrink-0">{parts.join(' ')}</span>
}

// §6.6 Bang Commands — in-game-styled framing per category (icon + a dossier
// title), no raw "!command" console text, so the paused-roleplay moment
// still reads as part of the game's own UI rather than a debug console.
const BANG_DISPLAY: Record<string, { icon: LucideIcon; label: string }> = {
  npc: { icon: Users, label: 'NPC Dossier' },
  items: { icon: Backpack, label: 'Inventory Ledger' },
  location: { icon: MapIcon, label: 'Known Locations' },
  faction: { icon: ShieldCheck, label: 'Faction Standings' },
  quests: { icon: Target, label: 'Active Quests' },
  bestiary: { icon: Skull, label: 'Bestiary Log' },
  skill: { icon: Sparkles, label: 'Skill Codex' },
  skills: { icon: Sparkles, label: 'Skill Codex' },
  recall: { icon: BookOpen, label: 'Codex Recall' },
  minions: { icon: Users, label: 'Minion Roster' },
  arise: { icon: Ghost, label: 'Shadow Extraction' },
  raise_skeleton: { icon: Skull, label: 'Reanimation' },
  summon: { icon: Sparkle, label: 'Planar Gate' },
  equip: { icon: Swords, label: 'Equipped' },
  unequip: { icon: Swords, label: 'Unequipped' },
}

function bangDisplay(command: string): { icon: LucideIcon; label: string } {
  return BANG_DISPLAY[command.toLowerCase()] ?? { icon: HelpCircle, label: 'Unclear Reference' }
}

function formatTimestamp(time: GameTime, locDisp: string): string {
  return `D-${String(time.d).padStart(2, '0')} ${time.h} | ${locDisp.toUpperCase()}`
}

interface PopupTarget {
  category: KeywordLink['category']
  id: string
}

interface TurnBlockProps {
  entry: LogEntry
  globalIndex: number
  onTapTerm: TapTermHandler
  registerRef: (index: number, el: HTMLDivElement | null) => void
}

// Isolated from `input` state (§9.2 perf fix) — memoized so a keystroke in the
// input bar doesn't re-render/re-parse rich text for every mounted turn block.
const TurnBlock = memo(function TurnBlock({ entry, globalIndex, onTapTerm, registerRef }: TurnBlockProps) {
  const setRef = useCallback((el: HTMLDivElement | null) => registerRef(globalIndex, el), [globalIndex, registerRef])

  if (entry.bang) {
    const { command, target, rows, note } = entry.bang
    const { icon: DossierIcon, label } = bangDisplay(command)
    return (
      <div ref={setRef} className="flex flex-col gap-2 py-1">
        {/* §6.6 — bang commands are out-of-fiction, so they're bracketed like a
            chapter boundary: a divider announcing the pause, the result, then
            a matching divider closing it and resuming the tale. Styled as an
            in-game dossier reveal, not a raw "!command" console dump. */}
        <div className="w-full flex items-center gap-3">
          <div className="flex-1 h-px bg-gold-accent/40" />
          <span className="flex items-center gap-1.5 font-display text-[10px] uppercase tracking-wide text-gold-primary/70 shrink-0">
            <Pause size={11} /> Roleplay Paused
          </span>
          <div className="flex-1 h-px bg-gold-accent/40" />
        </div>

        <div className="rounded-xl border border-gold-primary/25 bg-gold-accent/10 px-3 py-2.5">
          <div className="flex items-center gap-1.5 mb-2">
            <DossierIcon size={13} className="text-gold-primary/80 shrink-0" />
            <span className="font-display text-xs font-bold uppercase tracking-wide text-gold-primary">
              {label}
              {target && <span className="text-ink-muted normal-case font-normal"> — {target}</span>}
            </span>
          </div>
          {rows.length > 0 && (
            <div className="space-y-1">
              {rows.map((row, i) => (
                <div key={row.id ?? i} className="flex items-baseline gap-2 text-xs">
                  {row.category ? (
                    <button
                      onClick={() => onTapTerm(row.name, row.category!)}
                      className="font-display font-semibold text-ink hover:text-gold-primary shrink-0 underline decoration-dotted decoration-gold-primary/40 underline-offset-2"
                    >
                      {row.name}
                    </button>
                  ) : (
                    <span className="font-display font-semibold text-ink shrink-0">{row.name}</span>
                  )}
                  <span className="text-ink-muted truncate">{row.fields.join(' · ')}</span>
                </div>
              ))}
            </div>
          )}
          {note && <p className="font-narrative italic text-[11px] text-ink-muted mt-1.5">{note}</p>}
        </div>

        <div className="w-full h-px bg-gold-accent/40" />
      </div>
    )
  }

  if (entry.chapterSummary) {
    return (
      <div ref={setRef} className="flex flex-col items-center gap-2 py-3">
        <div className="w-full flex items-center gap-3">
          <div className="flex-1 h-px bg-gold-accent/30" />
          <span className="flex items-center gap-1.5 font-display text-xs text-gold-primary shrink-0">
            <BookOpen size={13} /> Chapter {entry.chapterNumber}
          </span>
          <div className="flex-1 h-px bg-gold-accent/30" />
        </div>
        <p className="font-narrative italic text-xs text-ink-muted text-center max-w-md">{entry.chapterSummary}</p>
      </div>
    )
  }

  // §5.1b Class Evolution triggered manually (Codex CRUD) rather than by a
  // narrated turn — a synthetic entry (no `nar`) gets its own banner, same
  // bracketed-divider treatment as a bang command's "Roleplay Paused" beat.
  // A story-triggered evolution instead rides along on its real turn's own
  // entry as an inline badge below, since it has narration to attach to.
  if (entry.classEvolution && !entry.nar) {
    return (
      <div ref={setRef} className="flex flex-col items-center gap-2 py-3">
        <div className="w-full flex items-center gap-3">
          <div className="flex-1 h-px bg-gold-accent/40" />
          <span className="flex items-center gap-1.5 font-display text-[10px] uppercase tracking-wide text-gold-primary/70 shrink-0">
            <Repeat size={11} /> Class Evolution
          </span>
          <div className="flex-1 h-px bg-gold-accent/40" />
        </div>
        <p className="font-narrative text-sm text-ink text-center">
          Now a <span className="font-display font-semibold text-gold-primary">{entry.classEvolution.className}</span>
        </p>
      </div>
    )
  }

  const stateMeta = entry.turnState ? TURN_STATE_META[entry.turnState] : null
  const StateIcon = stateMeta?.icon

  return (
    <div
      ref={setRef}
      className="space-y-1 border-l-2 pl-3"
      style={{ borderColor: stateMeta ? `color-mix(in srgb, ${stateMeta.accent} 33%, transparent)` : 'transparent' }}
    >
      {entry.time && entry.locDisp && (
        <p className="font-mono text-[10px] font-semibold uppercase tracking-wide text-gold-primary">
          {formatTimestamp(entry.time, entry.locDisp)}
        </p>
      )}
      <div className="flex items-center gap-2 flex-wrap">
        {/* The player's own typed action — same narrative serif and italic
            treatment as everything else on the page (dropped the old
            font-mono "> " console-prompt prefix, which read like a terminal
            echo rather than part of the story); gold-primary is what still
            marks it as a different voice from the narration beneath it. */}
        {entry.action && <p className="font-narrative italic text-sm text-gold-primary">{entry.action}</p>}
        {StateIcon && stateMeta && (
          <span className="inline-flex items-center gap-1 text-[10px] font-display" style={{ color: stateMeta.accent }}>
            <StateIcon size={11} /> {stateMeta.label}
          </span>
        )}
      </div>
      {entry.mood && (
        <p className="inline-flex items-center gap-1 text-[11px] italic text-ink-muted">
          <Sparkle size={10} /> {entry.mood}
        </p>
      )}
      <p className="font-narrative text-sm leading-relaxed whitespace-pre-wrap">{renderNarrative(entry.nar, onTapTerm)}</p>
      {entry.levelUp && (
        <p className="inline-flex items-center gap-1.5 rounded-full bg-gold-accent/15 border border-gold-accent/40 px-3 py-1 font-display text-xs text-gold-primary">
          <Star size={12} /> Level {entry.levelUp}
        </p>
      )}
      {entry.classEvolution && (
        <p className="inline-flex items-center gap-1.5 rounded-full bg-gold-accent/15 border border-gold-accent/40 px-3 py-1 font-display text-xs text-gold-primary">
          <Repeat size={12} /> Now a {entry.classEvolution.className}
        </p>
      )}
      {entry.discoveries && entry.discoveries.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {entry.discoveries.map((d) => (
            <button
              key={`${d.category}_${d.id}`}
              onClick={() => onTapTerm(d.name, d.category)}
              className="inline-flex items-center gap-1.5 rounded-full bg-gold-accent/15 border border-gold-accent/40 px-3 py-1 font-display text-xs text-gold-primary"
            >
              <Unlock size={12} /> Codex Updated: {d.name}
            </button>
          ))}
        </div>
      )}
      {entry.craftReady && entry.craftReady.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {entry.craftReady.map((c, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1.5 rounded-full bg-gold-accent/15 border border-gold-accent/40 px-3 py-1 font-display text-xs text-gold-primary"
            >
              <Hammer size={12} /> Craft Ready: {c.recipeName}
            </span>
          ))}
        </div>
      )}
      {entry.minionsDissipated && entry.minionsDissipated.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {entry.minionsDissipated.map((name, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1.5 rounded-full bg-white/10 border border-white/20 px-3 py-1 font-display text-xs text-ink-muted"
            >
              <Ghost size={12} /> {name} dissipated (unpaid upkeep)
            </span>
          ))}
        </div>
      )}
    </div>
  )
})

interface ApiErrorPanelProps {
  error: string
  apiSettings?: ApiSettings
  proseDepth?: ProseDepthConfig
  lastActionText?: string
  onRetry?: () => void
  onDismissError?: () => void
  onOpenSettings: () => void
  setInput: (val: string) => void
}

function ApiErrorPanel({
  error,
  apiSettings,
  proseDepth,
  lastActionText,
  onRetry,
  onDismissError,
  onOpenSettings,
  setInput,
}: ApiErrorPanelProps) {
  const [copied, setCopied] = useState(false)

  const maskApiKey = (key: string): string => {
    if (!key) return 'Not set'
    if (key.length <= 8) return '••••' + key.slice(-2)
    return key.slice(0, 3) + '••••' + key.slice(-4)
  }

  const handleCopyReport = () => {
    const reportText = `### TALE DIVES DIAGNOSTIC REPORT
- **Timestamp**: ${new Date().toISOString()}
- **Provider**: ${apiSettings?.provider || 'Unknown'}
- **Model**: ${apiSettings?.model || 'Unknown'}
- **Temperature**: ${apiSettings?.temperature ?? 'Default'}
- **Prose Depth**: ${proseDepth?.label || 'Unknown'} (Target: ${proseDepth?.targetTokens || 'Unknown'}, Max: ${proseDepth?.maxOutputTokens || 'Unknown'})
- **API Key**: ${maskApiKey(apiSettings?.apiKey || '')}
- **Error Description**: ${error}
- **Failed Action**: ${lastActionText || 'None'}`

    navigator.clipboard.writeText(reportText).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const handleDismissAndPause = () => {
    if (onDismissError) onDismissError()
    setInput(lastActionText || '')
  }

  return (
    <div className="my-4 p-4 rounded-xl border border-rose-500/30 bg-surface-raised/80 backdrop-blur-md text-ink shadow-[0_8px_32px_rgba(0,0,0,0.6)] space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-white/10 pb-2.5">
        <AlertTriangle className="text-rose-400 shrink-0" size={18} />
        <h3 className="font-display text-sm font-bold tracking-wide text-rose-400 flex-1">
          FATE THREAD FALTERED
        </h3>
        <button
          onClick={handleDismissAndPause}
          className="text-ink-muted hover:text-ink transition-colors"
          title="Dismiss"
        >
          <X size={16} />
        </button>
      </div>

      {/* Grid of details */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-[11px] font-mono text-ink-muted">
        <div>
          <span className="opacity-60">Provider:</span>{' '}
          <span className="text-gold-primary">{apiSettings?.provider || 'gemini'}</span>
        </div>
        <div>
          <span className="opacity-60">Model:</span>{' '}
          <span className="text-gold-primary">{apiSettings?.model || 'Unknown'}</span>
        </div>
        <div>
          <span className="opacity-60">Temp:</span>{' '}
          <span className="text-cyan-400">{apiSettings?.temperature ?? 0.7}</span>
        </div>
        <div>
          <span className="opacity-60">Key:</span>{' '}
          <span className="text-emerald-400">{maskApiKey(apiSettings?.apiKey || '')}</span>
        </div>
        <div className="col-span-1 sm:col-span-2">
          <span className="opacity-60">Depth:</span>{' '}
          <span className="text-amber-400">
            {proseDepth?.label || 'Standard'} (Max: {proseDepth?.maxOutputTokens || 800})
          </span>
        </div>
      </div>

      {/* Error Message Section */}
      <div className="p-3 bg-black/40 rounded-lg border border-rose-950 text-xs font-mono text-rose-200 break-words whitespace-pre-wrap max-h-36 overflow-y-auto">
        {error}
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col gap-2 pt-1">
        <div className="flex flex-col sm:flex-row gap-2">
          {onRetry && (
            <button
              onClick={onRetry}
              className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-rose-900/30 hover:bg-rose-900/50 border border-rose-500/30 py-2.5 font-display text-xs tracking-wider text-rose-200 transition-all active:scale-[0.98] cursor-pointer"
            >
              <RotateCcw size={13} /> Retry Now
            </button>
          )}
          <button
            onClick={onOpenSettings}
            className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 py-2.5 font-display text-xs tracking-wider text-ink-muted hover:text-ink transition-all active:scale-[0.98] cursor-pointer"
          >
            <SettingsIcon size={13} /> Open Settings
          </button>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <button
            onClick={handleCopyReport}
            className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 py-2.5 font-display text-xs tracking-wider text-ink-muted hover:text-ink transition-all cursor-pointer"
          >
            {copied ? (
              <>
                <Check size={13} className="text-emerald-400" /> Copied!
              </>
            ) : (
              <>
                <Copy size={13} /> Copy Diagnostic Report
              </>
            )}
          </button>
          <button
            onClick={handleDismissAndPause}
            className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 py-2.5 font-display text-xs tracking-wider text-ink-muted hover:text-ink transition-all cursor-pointer"
            title="Dismiss error and let you edit text"
          >
            <Pause size={13} className="text-amber-400" /> Dismiss to PAUSE
          </button>
        </div>
      </div>
    </div>
  )
}

// Blueprint §6.4C — v1 scaffold: no parchment pagination/quick-slots yet,
// just enough surface to prove the turn loop (§2 Phase D) actually works.
export default function Chronicle({
  title,
  player,
  combat,
  log,
  busy,
  error,
  chromeOpacity,
  npcs,
  locations,
  factions,
  lore,
  quests,
  bestiary,
  skills,
  crafting,
  apiSettings,
  proseDepth,
  lastActionText,
  onRetry,
  onDismissError,
  onSend,
  onBangCommand,
  slashCommands,
  onOpenSlashManager,
  onOpenSettings,
  onOpenMenu,
  onOpenCodex,
  onOpenCodexEntry,
  onOpenCodexCategory,
}: ChronicleProps) {
  const [input, setInput] = useState('')
  const [bangHighlight, setBangHighlight] = useState(0)
  const [bangDismissed, setBangDismissed] = useState(false)
  const [slashHighlight, setSlashHighlight] = useState(0)
  const [slashDismissed, setSlashDismissed] = useState(false)
  const [popup, setPopup] = useState<PopupTarget | null>(null)
  const [visibleCount, setVisibleCount] = useState(WINDOW_SIZE)
  const [currentBlock, setCurrentBlock] = useState<number | null>(null)
  const [bottomHeight, setBottomHeight] = useState(0)
  const [headerHeight, setHeaderHeight] = useState(0)
  const [statsCollapsed, setStatsCollapsed] = useState(false)
  const [navDragPos, setNavDragPos] = useState<{ y: number } | null>(null)
  const [navDragging, setNavDragging] = useState(false)
  const [radialOpen, setRadialOpen] = useState(false)

  const lastLogEntry = useMemo(() => log[log.length - 1], [log])

  // §6.5 Fantasy Radial Menu — Codex/Settings already have one-tap header
  // buttons, so the ring's value is fast shortcuts straight into the
  // categories actually checked mid-scene; Crafting only appears while a job
  // is queued or ready, keeping the resting ring uncluttered otherwise.
  const radialActions = useMemo(() => {
    const actions: { icon: LucideIcon; label: string; onClick: () => void }[] = [
      { icon: BookOpen, label: 'Codex', onClick: onOpenCodex },
      { icon: ScrollText, label: 'Quest Log', onClick: () => onOpenCodexCategory('quests') },
      { icon: Backpack, label: 'Inventory', onClick: () => onOpenCodexCategory('items') },
      { icon: User, label: 'Character', onClick: () => onOpenCodexCategory('character') },
      { icon: SettingsIcon, label: 'Settings', onClick: onOpenSettings },
    ]
    if (crafting && crafting.length > 0) {
      actions.push({ icon: Hammer, label: 'Crafting', onClick: () => onOpenCodexCategory('crafting') })
    }
    return actions
  }, [crafting, onOpenCodex, onOpenCodexCategory, onOpenSettings])

  const scrollRef = useRef<HTMLDivElement>(null)
  const headerRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const navRef = useRef<HTMLDivElement>(null)
  const navDragOffset = useRef<{ dx: number; dy: number } | null>(null)
  const blockRefs = useRef(new Map<number, HTMLDivElement>())
  const pendingScrollTo = useRef<number | null>(null)

  const windowStart = Math.max(0, log.length - visibleCount)
  const visibleLog = log.slice(windowStart)
  const hasEarlierTurns = windowStart > 0

  // §6.0 — the chrome (header/frame/input/motes) uses a fixed gold accent; it
  // no longer retints per turn state. Per-entry turn-state badges in the log
  // (TurnBlock, below) are unrelated and keep their own per-entry coloring.
  const stateAccent = '#e8ca8a'

  // §Settings "Chronicle HUD Transparency" — chromeOpacity (0.1-0.9) scales how
  // solid the header/HUD/input glass reads. Flat obsidian, no color-wash gradient
  // — the gold accent lives only in the border/ring, matching the reference app.
  const chromeAlpha = chromeOpacity
  const inputIdleAlpha = +(chromeOpacity * 0.8).toFixed(2)
  const inputFocusAlpha = +Math.min(chromeOpacity + 0.25, 0.95).toFixed(2)

  // Non-chapter-summary entries only — those are what the navigator steps between.
  const narratedIndices = log.reduce<number[]>((acc, e, i) => {
    if (!e.chapterSummary) acc.push(i)
    return acc
  }, [])
  const navPosition = narratedIndices.length
    ? narratedIndices.indexOf(currentBlock ?? narratedIndices[narratedIndices.length - 1]) + 1
    : 0

  useEffect(() => {
    if (currentBlock === null) {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
    }
  }, [log])

  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, INPUT_MAX_HEIGHT)}px`
  }, [input])

  useEffect(() => {
    const el = bottomRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => setBottomHeight(entries[0].contentRect.height))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    const el = headerRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => setHeaderHeight(entries[0].contentRect.height))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // scrollIntoView() is unreliable on a `position: fixed` scroll container
  // in some environments — it silently no-ops instead of moving. Computing
  // the target's offset and driving the container's own scrollTo() directly
  // sidesteps that entirely and works everywhere.
  const scrollBlockIntoView = useCallback(
    (el: HTMLDivElement) => {
      const container = scrollRef.current
      if (!container) return
      // The fixed header floats on top of the scroll container rather than
      // pushing it down, so landing a block's own header right at scrollTop=0
      // tucks it directly behind the header bar — offset by the header's
      // actual height (plus a little breathing room) so the navigator always
      // reveals the block's timestamp/header line, not just its body text.
      container.scrollTo({ top: Math.max(0, el.offsetTop - headerHeight - 16), behavior: 'smooth' })
    },
    [headerHeight],
  )

  useEffect(() => {
    if (pendingScrollTo.current !== null) {
      const idx = pendingScrollTo.current
      pendingScrollTo.current = null
      requestAnimationFrame(() => {
        const el = blockRefs.current.get(idx)
        if (el) scrollBlockIntoView(el)
      })
    }
  }, [visibleCount, scrollBlockIntoView])

  const registerRef = useCallback((index: number, el: HTMLDivElement | null) => {
    if (el) blockRefs.current.set(index, el)
    else blockRefs.current.delete(index)
  }, [])

  function send() {
    const text = input.trim()
    if (!text || busy) return
    // §6.6 Bang Commands — resolved entirely client-side (0 API tokens), so
    // they bypass the busy-gated turn pipeline and never touch onSend.
    if (text.startsWith('!')) {
      onBangCommand(text)
    } else if (text.startsWith('/')) {
      // A completed slash command sends its saved prompt instead of the raw
      // "/name" text; anything that doesn't match a known command just goes
      // through as normal typed prose — "/" isn't a reserved character here.
      const cmd = slashCommands.find((c) => c.name === text.slice(1).trim().toLowerCase())
      onSend(cmd ? cmd.prompt : text, cmd?.pauseRoleplay)
    } else {
      onSend(text)
    }
    setInput('')
  }

  // §6.6 Command Palette — suggestions only while the player is still typing
  // the command word itself ("!"/"/" or "!np"/"/me"); once a space appears
  // they've moved on to a target (bang) or finished (slash never takes one),
  // so the dropdown gets out of the way.
  const bangWordMatch = /^!(\w*)$/.exec(input)
  const bangSuggestions =
    !bangDismissed && bangWordMatch
      ? BANG_COMMANDS.filter((c) => c.name.startsWith(bangWordMatch[1].toLowerCase()))
      : []

  const slashWordMatch = /^\/(\w*)$/.exec(input)
  const slashSuggestions =
    !slashDismissed && slashWordMatch
      ? slashCommands.filter((c) => c.name.startsWith(slashWordMatch[1].toLowerCase()))
      : []

  function selectBangSuggestion(name: string) {
    setInput(`!${name} `)
    setBangHighlight(0)
    setBangDismissed(false)
    textareaRef.current?.focus()
  }

  // Slash commands never take a free-form target, so selecting one sends
  // immediately — matching the blueprint's "shorthand for typed prose" intent.
  function selectSlashSuggestion(cmd: SlashCommand) {
    onSend(cmd.prompt, cmd.pauseRoleplay)
    setInput('')
    setSlashHighlight(0)
    setSlashDismissed(false)
  }

  function loadEarlierTurns() {
    setVisibleCount((n) => Math.min(log.length, n + WINDOW_SIZE))
  }

  // §9.2 Block Navigator — `currentBlock` tracks a stable index into the full
  // `log`, not the windowed slice, since "Load Earlier Turns" shifts the
  // slice's own local indices out from under anything that isn't global.
  function scrollToBlock(globalIndex: number) {
    const needed = log.length - globalIndex
    if (needed > visibleCount) {
      pendingScrollTo.current = globalIndex
      setVisibleCount(needed)
    } else {
      const el = blockRefs.current.get(globalIndex)
      if (el) scrollBlockIntoView(el)
    }
    setCurrentBlock(globalIndex)
  }

  function goPrevious() {
    const base = currentBlock ?? log.length
    const idx = [...narratedIndices].reverse().find((i) => i < base)
    if (idx !== undefined) scrollToBlock(idx)
  }

  function goNext() {
    const base = currentBlock ?? -1
    const idx = narratedIndices.find((i) => i > base)
    if (idx !== undefined) scrollToBlock(idx)
  }

  function jumpToLatest() {
    setCurrentBlock(null)
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }

  // §9.2 Navigator drag — Y-axis only, grabbing the pill's own padding (not a
  // button); clamped strictly to the visible strip between the floating header
  // and footer, not the full (now header/footer-covered) parchment card.
  function onNavPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (e.target !== e.currentTarget) return
    const el = navRef.current
    if (!el) return
    const elRect = el.getBoundingClientRect()
    navDragOffset.current = { dx: e.clientX - elRect.left, dy: e.clientY - elRect.top }
    el.setPointerCapture(e.pointerId)
    setNavDragging(true)
  }

  function onNavPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const offset = navDragOffset.current
    const el = navRef.current
    if (!offset || !el) return
    // Live rects, not the headerHeight/bottomHeight state — those store the
    // ResizeObserver content-box height (excludes padding/border), which
    // undershoots the header/footer's actual visual (border-box) extent.
    const headerBottom = headerRef.current?.getBoundingClientRect().bottom ?? 0
    const footerTop = bottomRef.current?.getBoundingClientRect().top ?? window.innerHeight
    const minY = headerBottom + 6
    const maxY = footerTop - 6 - el.offsetHeight
    const y = Math.max(minY, Math.min(e.clientY - offset.dy, Math.max(minY, maxY)))
    setNavDragPos({ y })
  }

  function onNavPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    navDragOffset.current = null
    setNavDragging(false)
    navRef.current?.releasePointerCapture(e.pointerId)
  }

  // §6.4C Codex Popup Card — tapping a {{Term|category}} keyword link opens
  // this instead of a full-screen navigation. A miss (the model tagged
  // something not yet auto-registered, or a category with no entry) just
  // does nothing rather than showing an empty/broken card.
  const onTapTerm = useCallback<TapTermHandler>(
    (term, category) => {
      const id = slugify(term)
      const dict = { npc: npcs, loc: locations, faction: factions, lore, quest: quests, beast: bestiary, skill: skills }[category]
      if (dict?.[id]) setPopup({ category, id })
    },
    [npcs, locations, factions, lore, quests, bestiary, skills],
  )

  const popupEntry =
    popup &&
    ({ npc: npcs, loc: locations, faction: factions, lore, quest: quests, beast: bestiary, skill: skills }[popup.category]?.[popup.id] as
      | NpcEntry
      | LocationEntry
      | FactionEntry
      | LoreEntry
      | QuestEntry
      | BestiaryEntry
      | SkillEntry
      | undefined)

  return (
    <div className="fixed inset-0 overflow-hidden text-ink bg-canvas">
      {/* Full-bleed dark obsidian header — flat, no color-wash gradient; the
          gold accent lives only in the border. */}
      <header
        ref={headerRef}
        className="fixed top-0 inset-x-0 z-10 flex items-center justify-between px-3 py-1.5 border-b shadow-2xl transition-[background,border-color] duration-700 ease-out"
        style={{
          paddingTop: 'max(0.375rem, env(safe-area-inset-top))',
          background: `rgba(11,13,20,${chromeAlpha})`,
          borderColor: `${stateAccent}45`,
        }}
      >
        <button onClick={onOpenMenu} aria-label="Menu" className="w-7 h-7 rounded-full inline-flex items-center justify-center text-[#e8ca8a] hover:bg-white/10">
          <Menu size={16} />
        </button>
        <div className="font-display text-xs font-semibold tracking-wide text-center flex-1 truncate px-2 text-[#e8ca8a]">
          {title}
        </div>
        <button onClick={onOpenCodex} aria-label="Codex" className="w-7 h-7 rounded-full inline-flex items-center justify-center text-[#e8ca8a] hover:bg-white/10">
          <Library size={16} />
        </button>
        <button onClick={onOpenSettings} aria-label="Settings" className="w-7 h-7 rounded-full inline-flex items-center justify-center text-[#e8ca8a] hover:bg-white/10">
          <SettingsIcon size={16} />
        </button>
      </header>

      <div
        ref={scrollRef}
        // `parchment-surface` (index.css) re-declares the ink/gold/semantic
        // tokens for this subtree only. Without it every text-ink descendant
        // here would use the dark-chrome palette — warm near-white on cream
        // paper, i.e. invisible. This is the one place in the app that
        // deliberately inverts to a light ground.
        className="parchment-surface fixed overflow-y-auto bg-parchment parchment-texture rounded-xl pl-4 pr-6 space-y-4"
        style={{ top: 6, bottom: 6, left: 6, right: 6, paddingTop: headerHeight + 16, paddingBottom: bottomHeight + 16 }}
      >
        {log.length === 0 && (
          <p className="font-narrative italic text-sm opacity-60">
            The tale hasn't begun. Type an action below to dive in.
          </p>
        )}
        {hasEarlierTurns && (
          <button
            onClick={loadEarlierTurns}
            className="mx-auto flex items-center gap-1.5 rounded-full border border-gold-accent/40 px-3 py-1.5 font-display text-xs text-gold-primary"
          >
            <History size={12} /> Load Earlier Turns
          </button>
        )}
        {visibleLog.map((entry, i) => (
          <TurnBlock key={windowStart + i} entry={entry} globalIndex={windowStart + i} onTapTerm={onTapTerm} registerRef={registerRef} />
        ))}
        {busy && <p className="font-narrative italic text-sm opacity-50">The thread of fate is being woven...</p>}
        {lastLogEntry?.act && lastLogEntry.act.length > 0 && !busy && !error && (
          <div className="flex flex-col gap-1.5 pt-2 border-t border-gold-accent/15">
            <span className="text-[10px] font-mono tracking-wider text-gold-primary opacity-60 uppercase">Suggested Actions</span>
            <div className="flex flex-wrap gap-1.5">
              {lastLogEntry.act.map((suggestion, idx) => (
                <button
                  key={idx}
                  onClick={() => setInput(suggestion)}
                  className="inline-flex items-center gap-1.5 rounded-full bg-gold-accent/10 hover:bg-gold-accent/20 border border-gold-accent/35 hover:border-gold-accent/60 px-3 py-1 font-narrative text-xs text-gold-primary transition-all cursor-pointer active:scale-[0.98]"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}
        {error && (
          <ApiErrorPanel
            error={error}
            apiSettings={apiSettings}
            proseDepth={proseDepth}
            lastActionText={lastActionText}
            onRetry={onRetry}
            onDismissError={onDismissError}
            onOpenSettings={onOpenSettings}
            setInput={setInput}
          />
        )}
      </div>

      {/* §9.2 Block Navigator — idle: nearly invisible; hover/focus: lights up
          solid, matching the reference's idle-transparent/active-solid chrome. */}
      {log.length > 0 && (
        <div
          ref={navRef}
          onPointerDown={onNavPointerDown}
          onPointerMove={onNavPointerMove}
          onPointerUp={onNavPointerUp}
          onPointerCancel={onNavPointerUp}
          className="turn-nav group fixed z-10 flex flex-col items-center gap-0.5 rounded-xl backdrop-blur-sm px-1 py-1.5 cursor-grab active:cursor-grabbing touch-none"
          style={{
            right: 10,
            ...(navDragPos ? { top: navDragPos.y } : { bottom: bottomHeight + 10 }),
            ['--turn-accent' as string]: stateAccent,
            ...(navDragging ? { background: 'rgba(20,22,34,0.88)' } : {}),
          }}
        >
          <button
            onClick={goPrevious}
            aria-label="Previous turn"
            className="w-6 h-6 rounded-full inline-flex items-center justify-center text-white/40 hover:!text-[#e8ca8a] group-hover:text-white/70 hover:bg-white/10 transition-colors"
          >
            <ChevronUp size={13} />
          </button>
          <span className="font-mono text-[10px] tabular-nums text-white/40 group-hover:text-white/80 transition-colors">
            {navPosition || ''}
          </span>
          <button
            onClick={goNext}
            aria-label="Next turn"
            className="w-6 h-6 rounded-full inline-flex items-center justify-center text-white/40 hover:!text-[#e8ca8a] group-hover:text-white/70 hover:bg-white/10 transition-colors"
          >
            <ChevronDown size={13} />
          </button>
          <div className="w-3 h-px my-0.5 bg-white/10 group-hover:bg-white/20 transition-colors" />
          <button
            onClick={jumpToLatest}
            aria-label="Jump to latest"
            className="w-6 h-6 rounded-full inline-flex items-center justify-center text-white/40 hover:!text-[#e8ca8a] group-hover:text-white/70 hover:bg-white/10 transition-colors"
          >
            <ChevronsDown size={13} />
          </button>
        </div>
      )}

      {/* §6.5 Fantasy Radial Menu — Codex/Settings already have header buttons,
          so this ring exists for the shortcuts that don't: Quest Log,
          Inventory, Character, and Crafting once a job is queued. Kept small
          and quiet (matches the block navigator's low-visual-weight style)
          rather than a bold floating action button — a thin gold ring at
          rest, brightening into a glow on hover and peaking on press. The
          FAB sits centered on the input tray's top edge, reading as the hub
          the tray radiates from. Backdrop sits one layer below the FAB/fan
          so an outside tap collapses it without swallowing taps on the fan
          itself. */}
      {radialOpen && <div className="fixed inset-0 z-[15]" onClick={() => setRadialOpen(false)} aria-hidden="true" />}
      <div className="fixed left-1/2 z-20" style={{ bottom: bottomHeight - 18, transform: 'translateX(-50%)' }}>
        <AnimatePresence>
          {radialOpen &&
            radialActions.map((action, i) => {
              const { x, y } = radialPos(i, radialActions.length)
              return (
                <motion.button
                  key={action.label}
                  onClick={() => {
                    action.onClick()
                    setRadialOpen(false)
                  }}
                  aria-label={action.label}
                  title={action.label}
                  initial={{ opacity: 0, x: 0, y: 0, scale: 0.4 }}
                  animate={{ opacity: 1, x, y, scale: 1 }}
                  exit={{ opacity: 0, x: 0, y: 0, scale: 0.4 }}
                  transition={{ type: 'spring', stiffness: 320, damping: 22, delay: i * 0.03 }}
                  className="absolute left-1/2 top-1/2 w-10 h-10 rounded-full flex items-center justify-center text-[#e8ca8a] transition-shadow duration-150 shadow-[0_0_0_1px_rgba(232,202,138,0.18),0_2px_8px_rgba(0,0,0,0.45)] hover:shadow-[0_0_0_1px_rgba(232,202,138,0.4),0_0_16px_3px_rgba(232,202,138,0.5)] active:shadow-[0_0_0_1.5px_rgba(232,202,138,0.6),0_0_22px_5px_rgba(232,202,138,0.75)]"
                  style={{ marginLeft: -20, marginTop: -20, background: 'rgba(20,22,34,0.92)', border: '1px solid rgba(232,202,138,0.35)' }}
                >
                  <action.icon size={15} />
                </motion.button>
              )
            })}
        </AnimatePresence>
        <button
          onClick={() => setRadialOpen((v) => !v)}
          aria-label={radialOpen ? 'Close quick actions' : 'Quick actions'}
          className={`relative w-10 h-10 rounded-full inline-flex items-center justify-center transition-shadow duration-150 ${
            radialOpen
              ? 'text-[#e8ca8a] shadow-[0_0_0_1.5px_rgba(232,202,138,0.6),0_0_20px_4px_rgba(232,202,138,0.65)]'
              : 'text-[#e8ca8a] shadow-[0_0_0_1px_rgba(232,202,138,0.25),0_2px_8px_rgba(0,0,0,0.45)] hover:shadow-[0_0_0_1px_rgba(232,202,138,0.4),0_0_14px_3px_rgba(232,202,138,0.45)]'
          }`}
          style={{ background: 'rgba(20,22,34,0.92)', border: '1px solid rgba(232,202,138,0.4)' }}
        >
          {radialOpen ? <X size={17} /> : <Compass size={17} />}
        </button>
      </div>

      <div
        ref={bottomRef}
        className="fixed bottom-0 inset-x-0 z-10 flex flex-col border-t shadow-2xl transition-[background,border-color] duration-700 ease-out"
        style={{
          background: `rgba(11,13,20,${chromeAlpha})`,
          borderColor: `${stateAccent}45`,
        }}
      >
        {combat?.active && (
          <div className="border-b border-rose/30 px-4 py-1 text-white/80">
            <PoolBar label={combat.enemyName?.slice(0, 3).toUpperCase() ?? 'ENM'} value={combat.enemyHp ?? 0} max={combat.enemyHpMax ?? 1} colorVar="#e11d48" />
          </div>
        )}

        <div className="px-3">
          <button
            onClick={() => setStatsCollapsed((v) => !v)}
            aria-label={statsCollapsed ? 'Expand stats' : 'Collapse stats'}
            className="w-full flex items-center justify-center leading-none text-white/40 hover:text-[#e8ca8a]"
          >
            {statsCollapsed ? <ChevronUp size={9} /> : <ChevronDown size={9} />}
          </button>
          <div
            className="grid transition-[grid-template-rows] duration-200 ease-out"
            style={{ gridTemplateRows: statsCollapsed ? '0fr' : '1fr' }}
          >
            <div className="overflow-hidden">
              <div className="px-1 pb-0.5 flex items-center gap-3 text-white/80">
                <PoolBar label="HP" value={player.hp} max={player.hpMax} colorVar="#fb3552" />
                <PoolBar label="MP" value={player.mp} max={player.mpMax} colorVar="#22d3ee" />
                <PoolBar label="ST" value={player.st} max={player.stMax} colorVar="#34d399" />
                <CurrencyBadge copper={player.copper} />
              </div>
            </div>
          </div>
        </div>

        <div className="relative px-3 pt-0.5 pb-1.5 flex gap-2 items-end">
          {/* §6.6 Command Palette — pops up above the input while the "!word"
              itself is being typed; arrow keys/Enter navigate it, matching
              regular typed text once a target follows the space. */}
          {bangSuggestions.length > 0 && (
            <div className="absolute left-3 right-3 bottom-full mb-1.5 rounded-xl border border-[#e8ca8a]/25 bg-[#141622]/60 backdrop-blur-sm shadow-2xl overflow-hidden">
              {bangSuggestions.map((cmd, i) => (
                <button
                  key={cmd.name}
                  onClick={() => selectBangSuggestion(cmd.name)}
                  onMouseEnter={() => setBangHighlight(i)}
                  className={`w-full text-left px-3 py-2 flex items-center justify-between gap-3 transition-colors ${
                    i === bangHighlight ? 'bg-[#e8ca8a]/15' : ''
                  }`}
                >
                  <span className="font-mono text-xs font-semibold text-[#e8ca8a] shrink-0">{cmd.usage}</span>
                  <span className="text-[11px] text-white/50 truncate">{cmd.description}</span>
                </button>
              ))}
            </div>
          )}
          {slashSuggestions.length > 0 && (
            <div className="absolute left-3 right-3 bottom-full mb-1.5 rounded-xl border border-[#e8ca8a]/25 bg-[#141622]/60 backdrop-blur-sm shadow-2xl overflow-hidden">
              {slashSuggestions.map((cmd, i) => (
                <button
                  key={cmd.id}
                  onClick={() => selectSlashSuggestion(cmd)}
                  onMouseEnter={() => setSlashHighlight(i)}
                  className={`w-full text-left px-3 py-2 flex items-center justify-between gap-3 transition-colors ${
                    i === slashHighlight ? 'bg-[#e8ca8a]/15' : ''
                  }`}
                >
                  <span className="font-mono text-xs font-semibold text-[#e8ca8a] shrink-0">/{cmd.name}</span>
                  <span className="text-[11px] text-white/50 truncate">{cmd.prompt}</span>
                </button>
              ))}
              {slashCommands.length === 0 && (
                <p className="px-3 py-2 text-[11px] text-white/40 italic">No slash commands yet — tap /  below to create one.</p>
              )}
            </div>
          )}
          <button
            onClick={onOpenSlashManager}
            aria-label="Slash commands"
            className="shrink-0 w-8 h-8 rounded-full inline-flex items-center justify-center text-[#e8ca8a]/70 hover:bg-white/10 hover:text-[#e8ca8a] font-mono text-sm font-bold"
          >
            /
          </button>
          <textarea
            ref={textareaRef}
            rows={1}
            value={input}
            onChange={(e) => {
              setInput(e.target.value)
              setBangHighlight(0)
              setBangDismissed(false)
              setSlashHighlight(0)
              setSlashDismissed(false)
            }}
            onKeyDown={(e) => {
              if (bangSuggestions.length > 0) {
                if (e.key === 'ArrowDown') {
                  e.preventDefault()
                  setBangHighlight((h) => (h + 1) % bangSuggestions.length)
                  return
                }
                if (e.key === 'ArrowUp') {
                  e.preventDefault()
                  setBangHighlight((h) => (h - 1 + bangSuggestions.length) % bangSuggestions.length)
                  return
                }
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  selectBangSuggestion(bangSuggestions[bangHighlight].name)
                  return
                }
                if (e.key === 'Escape') {
                  e.preventDefault()
                  setBangDismissed(true)
                  return
                }
              }
              if (slashSuggestions.length > 0) {
                if (e.key === 'ArrowDown') {
                  e.preventDefault()
                  setSlashHighlight((h) => (h + 1) % slashSuggestions.length)
                  return
                }
                if (e.key === 'ArrowUp') {
                  e.preventDefault()
                  setSlashHighlight((h) => (h - 1 + slashSuggestions.length) % slashSuggestions.length)
                  return
                }
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  selectSlashSuggestion(slashSuggestions[slashHighlight])
                  return
                }
                if (e.key === 'Escape') {
                  e.preventDefault()
                  setSlashDismissed(true)
                  return
                }
              }
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                send()
              }
            }}
            placeholder="What do you do?"
            disabled={busy}
            className="turn-glow flex-1 resize-none rounded-xl border backdrop-blur-sm px-3 py-1 font-narrative text-sm leading-snug text-white/90 placeholder:text-white/35"
            style={{
              maxHeight: INPUT_MAX_HEIGHT,
              ['--turn-accent' as string]: stateAccent,
              ['--chrome-alpha-idle' as string]: inputIdleAlpha,
              ['--chrome-alpha-focus' as string]: inputFocusAlpha,
            }}
          />
          <button
            onClick={send}
            disabled={busy || !input.trim()}
            aria-label="Send"
            className="turn-glow-btn w-8 h-8 shrink-0 rounded-full inline-flex items-center justify-center transition-colors bg-[#e8ca8a] text-[#0e1017] disabled:bg-white/10 disabled:text-white/25"
          >
            <Send size={14} />
          </button>
        </div>
      </div>

      {popup && popupEntry && (
        <div
          className="fixed inset-0 z-20 flex items-center justify-center bg-black/30 px-6"
          onClick={() => setPopup(null)}
        >
          <div className="glass-panel glow-ring rounded-2xl p-4 w-full max-w-xs" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-display font-bold text-sm text-gold-primary flex items-center gap-1.5">
                {isHidden(popupEntry) && <Lock size={13} />}
                {isHidden(popupEntry) ? '???' : popupEntry.name}
              </h3>
              <button onClick={() => setPopup(null)} aria-label="Close" className="text-ink-muted hover:text-ink">
                <X size={16} />
              </button>
            </div>
            {/* §5.12 — hidden entries never show real content outside CRUD Edit Mode. */}
            {isHidden(popupEntry) ? (
              <p className="font-narrative text-xs italic text-ink-muted">
                {popupEntry.discovery?.teaser || 'Not yet discovered.'}
              </p>
            ) : (
            <div className="font-narrative text-xs space-y-1 text-ink-muted">
              {popup.category === 'npc' && 'stage' in popupEntry && (
                <>
                  <p>{popupEntry.stage} · Trust {popupEntry.trust} · Affection {popupEntry.affection}</p>
                  {popupEntry.memSummary && <p className="italic">"{popupEntry.memSummary}"</p>}
                </>
              )}
              {popup.category === 'loc' && 'region' in popupEntry && (
                <p>{popupEntry.region} · Danger: {popupEntry.dangerLevel} · {popupEntry.standing}</p>
              )}
              {popup.category === 'faction' && 'repTier' in popupEntry && (
                <p>Reputation {popupEntry.repTier > 0 ? '+' : ''}{popupEntry.repTier}</p>
              )}
              {popup.category === 'lore' && 'category' in popupEntry && <p>{popupEntry.category}</p>}
              {popup.category === 'skill' && (
                <>
                  {'description' in popupEntry && popupEntry.description && <p>{popupEntry.description}</p>}
                  {'mpCost' in popupEntry && (popupEntry.mpCost || popupEntry.stCost) && (
                    <p className="font-mono">
                      {popupEntry.mpCost ? `${popupEntry.mpCost} MP` : ''}
                      {popupEntry.mpCost && popupEntry.stCost ? ' · ' : ''}
                      {popupEntry.stCost ? `${popupEntry.stCost} ST` : ''}
                    </p>
                  )}
                </>
              )}
              {popup.category === 'quest' && 'status' in popupEntry && <p>{popupEntry.status ?? 'active'}</p>}
              {popup.category === 'beast' && 'threatTier' in popupEntry && (
                <p>
                  {popupEntry.threatTier}
                  {popupEntry.hpMax !== undefined && ` · HP ${popupEntry.hpMax}`}
                  {popupEntry.dmgBase !== undefined && ` · DMG ${popupEntry.dmgBase}`}
                </p>
              )}
            </div>
            )}
            <button
              onClick={() => {
                onOpenCodexEntry(popup.category, popup.id)
                setPopup(null)
              }}
              className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-gold-accent/40 px-3 py-1.5 font-display text-xs text-gold-primary"
            >
              Open in Codex <ExternalLink size={12} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
