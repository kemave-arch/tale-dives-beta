import { useState, useRef, useEffect, useCallback, useMemo, memo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Home, Settings as SettingsIcon, Send, Star, BookOpen, Library, Sparkle, X, ExternalLink,
  ChevronUp, ChevronDown, ChevronsDown, History, Pause, Users, Backpack, Map as MapIcon, ShieldCheck, Target, Skull, HelpCircle,
  Unlock, Lock, Repeat, Hammer, Ghost, ScrollText, Swords, Sparkles, LayoutGrid,
  AlertTriangle, Copy, Check, RotateCcw, Bug, Pencil, MoreHorizontal, Trash2, Heart, Zap, Activity, Coins,
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
  ProseDepthConfig, QuestEntry, SkillEntry, SlashCommand, ItemEntry, StatBonus,
} from '../types.ts'

function statBonusText(bonus: StatBonus | undefined): string | null {
  if (!bonus) return null
  const parts = Object.entries(bonus)
    .filter(([, v]) => v)
    .map(([k, v]) => `${v! > 0 ? '+' : ''}${v} ${k.toUpperCase()}`)
  return parts.length ? parts.join(', ') : null
}

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
  items?: Record<string, ItemEntry>
  crafting?: CraftingJob[]
  apiSettings?: ApiSettings
  proseDepth?: ProseDepthConfig
  lastActionText?: string
  onRetry?: () => void
  onDismissError?: () => void
  onEditLastTurn?: (newNar: string) => void
  onRemoveLastTurn?: () => void
  editLongText?: (label: string, value: string, hint?: string, placeholder?: string) => Promise<string | null>
  confirmAction?: (message: string) => Promise<boolean>
  onSend: (action: string, forcePause?: boolean) => void
  onBangCommand: (raw: string) => void
  slashCommands: SlashCommand[]
  onOpenSlashManager: () => void
  onOpenSettings: () => void
  onOpenMenu: () => void
  onOpenCodex: () => void
  onOpenCodexEntry: (category: KeywordLink['category'], id: string) => void
  onOpenCodexCategory: (category: CategoryId) => void
  debugMode?: boolean // Settings' own toggle — also gates the per-turn/session debug-payload tools below
}

const WINDOW_SIZE = 20 // §9.2 — cap how many turns stay mounted; older ones load in on demand
const INPUT_MAX_HEIGHT = 160

function PoolBar({
  icon: Icon,
  label,
  value,
  max,
  colorVar,
}: {
  icon: LucideIcon
  label: string
  value: number
  max: number
  colorVar: string
}) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0
  return (
    <div className="flex items-center gap-1.5 flex-1 min-w-0" title={`${label}: ${value}/${max}`}>
      <div className="flex items-center gap-1 shrink-0 max-w-[150px] sm:max-w-none">
        <Icon size={12} style={{ color: colorVar }} className="shrink-0" />
        <span className="font-mono text-[10px] font-bold uppercase tracking-wider truncate" style={{ color: colorVar }}>
          {label}
        </span>
      </div>
      <div className="hidden sm:block flex-1 h-1.5 rounded-full bg-white/15 overflow-hidden min-w-[20px]">
        <div className="h-full rounded-full transition-all duration-300" style={{ width: `${pct}%`, background: colorVar }} />
      </div>
      <span className="shrink-0 font-mono text-[10px] font-semibold tabular-nums" style={{ color: colorVar }}>
        {value}/{max}
      </span>
    </div>
  )
}

function CurrencyBadge({ copper }: { copper: number }) {
  const { p, g, s, c } = formatCurrency(copper)
  return (
    <div className="flex items-center gap-1.5 shrink-0 font-mono text-[10px] font-semibold bg-black/30 border border-white/10 px-2 py-0.5 rounded-full">
      <Coins size={12} className="text-[#fbbf24] shrink-0" />
      <div className="flex items-center gap-1">
        {p > 0 && <span className="text-[#e2e8f0]">{p}<span className="text-[#cbd5e1] text-[9px] font-normal">P</span></span>}
        {g > 0 && <span className="text-[#fbbf24]">{g}<span className="text-[#f59e0b] text-[9px] font-normal">G</span></span>}
        {(s > 0 || (p === 0 && g === 0)) && <span className="text-[#cbd5e1]">{s}<span className="text-[#94a3b8] text-[9px] font-normal">S</span></span>}
        {(c > 0 || (p === 0 && g === 0 && s === 0)) && <span className="text-[#f97316]">{c}<span className="text-[#ea580c] text-[9px] font-normal">C</span></span>}
      </div>
    </div>
  )
}

function DesktopLeftSidebar({
  player,
  items,
  combat,
  locationName,
}: {
  player: Player
  items?: Record<string, ItemEntry>
  combat?: CombatState
  locationName?: string
}) {
  const equippedWeapon = player.equipped?.weapon ? items?.[player.equipped.weapon] : null
  const equippedArmor = player.equipped?.armor ? items?.[player.equipped.armor] : null
  const equippedAccessory = player.equipped?.accessory ? items?.[player.equipped.accessory] : null

  return (
    <aside className="hidden lg:flex lg:w-80 xl:w-96 shrink-0 flex-col gap-4 overflow-y-auto p-4 bg-[#0e1017]/90 border-r border-[#c89d51]/25 backdrop-blur-md text-[#f5ebd7] z-10 h-full">
      {/* 1. Character Overview */}
      <div className="bg-[#181324] border border-[#c89d51]/40 rounded-xl p-4 shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 w-24 h-24 bg-[#c89d51]/5 rounded-full blur-2xl pointer-events-none" />
        <div className="flex items-center gap-3 mb-3">
          <div className="w-12 h-12 rounded-xl bg-[#2b1e38] border border-[#c89d51]/60 flex items-center justify-center text-[#d4af37] shadow-inner font-serif text-lg font-bold shrink-0">
            {player.name ? player.name.charAt(0).toUpperCase() : 'P'}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="font-serif text-lg font-bold text-[#f5ebd7] leading-tight truncate">{player.name || 'Hero'}</h2>
            <div className="flex items-center gap-2 mt-1">
              <span className="font-display text-xs font-semibold text-[#d4af37] bg-[#c89d51]/15 px-2 py-0.5 rounded-md border border-[#c89d51]/30 shrink-0">
                Lvl {player.level}
              </span>
              <span className="font-serif text-xs text-[#c8b8a2] truncate">{player.className || 'Adventurer'}</span>
            </div>
          </div>
        </div>

        {/* Attrs Grid */}
        <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-[#c89d51]/20">
          <div className="bg-[#100b1a] border border-[#c89d51]/20 p-2 rounded-lg text-center">
            <span className="block font-mono text-[10px] text-[#a89575] font-bold uppercase">STR</span>
            <span className="font-mono text-sm font-bold text-[#f5ebd7]">{player.attrs?.STR ?? 10}</span>
          </div>
          <div className="bg-[#100b1a] border border-[#c89d51]/20 p-2 rounded-lg text-center">
            <span className="block font-mono text-[10px] text-[#a89575] font-bold uppercase">INT</span>
            <span className="font-mono text-sm font-bold text-[#f5ebd7]">{player.attrs?.INT ?? 10}</span>
          </div>
          <div className="bg-[#100b1a] border border-[#c89d51]/20 p-2 rounded-lg text-center">
            <span className="block font-mono text-[10px] text-[#a89575] font-bold uppercase">AGI</span>
            <span className="font-mono text-sm font-bold text-[#f5ebd7]">{player.attrs?.AGI ?? 10}</span>
          </div>
        </div>
      </div>

      {/* 2. Stats & Pools HUD */}
      <div className="bg-[#181324] border border-[#c89d51]/40 rounded-xl p-4 shadow-lg space-y-3">
        <div className="flex items-center justify-between border-b border-[#c89d51]/20 pb-2">
          <h3 className="font-serif text-xs font-bold text-[#d4af37] tracking-wider uppercase">
            Vitals & Wealth
          </h3>
          <CurrencyBadge copper={player.copper} />
        </div>
        <div className="space-y-2.5">
          <PoolBar icon={Heart} label="Health" value={player.hp} max={player.hpMax} colorVar="#fb3552" />
          <PoolBar icon={Zap} label="Mana" value={player.mp} max={player.mpMax} colorVar="#22d3ee" />
          <PoolBar icon={Activity} label="Stamina" value={player.st} max={player.stMax} colorVar="#34d399" />
        </div>
        {(player.locDisp || locationName) && (
          <div className="pt-2 border-t border-[#c89d51]/20 flex items-center gap-2 text-xs text-[#c8b8a2] font-serif">
            <MapIcon size={14} className="text-[#d4af37] shrink-0" />
            <span className="truncate">{player.locDisp || locationName}</span>
            {player.time && (
              <span className="ml-auto font-mono text-[11px] text-[#a89575] shrink-0">
                D{player.time.d} {player.time.h}
              </span>
            )}
          </div>
        )}
      </div>

      {/* 3. Equip Slots */}
      <div className="bg-[#181324] border border-[#c89d51]/40 rounded-xl p-4 shadow-lg space-y-2.5">
        <h3 className="font-serif text-xs font-bold text-[#d4af37] tracking-wider uppercase border-b border-[#c89d51]/20 pb-2">
          Equipped Gear
        </h3>
        {/* Weapon Slot */}
        <div className="flex items-center gap-3 p-2 rounded-lg bg-[#100b1a] border border-[#c89d51]/20">
          <div className="w-8 h-8 rounded-md bg-[#251933] border border-[#c89d51]/40 flex items-center justify-center text-[#d4af37] shrink-0">
            <Swords size={16} />
          </div>
          <div className="min-w-0 flex-1">
            <span className="block font-mono text-[9px] uppercase tracking-wider text-[#a89575]">Weapon</span>
            <span className="font-serif text-xs font-medium text-[#f5ebd7] truncate block">
              {equippedWeapon ? equippedWeapon.name : player.equipped?.weapon || 'Empty Hand'}
            </span>
          </div>
        </div>

        {/* Armor Slot */}
        <div className="flex items-center gap-3 p-2 rounded-lg bg-[#100b1a] border border-[#c89d51]/20">
          <div className="w-8 h-8 rounded-md bg-[#251933] border border-[#c89d51]/40 flex items-center justify-center text-[#d4af37] shrink-0">
            <ShieldCheck size={16} />
          </div>
          <div className="min-w-0 flex-1">
            <span className="block font-mono text-[9px] uppercase tracking-wider text-[#a89575]">Armor</span>
            <span className="font-serif text-xs font-medium text-[#f5ebd7] truncate block">
              {equippedArmor ? equippedArmor.name : player.equipped?.armor || 'No Armor'}
            </span>
          </div>
        </div>

        {/* Accessory Slot */}
        <div className="flex items-center gap-3 p-2 rounded-lg bg-[#100b1a] border border-[#c89d51]/20">
          <div className="w-8 h-8 rounded-md bg-[#251933] border border-[#c89d51]/40 flex items-center justify-center text-[#d4af37] shrink-0">
            <Sparkles size={16} />
          </div>
          <div className="min-w-0 flex-1">
            <span className="block font-mono text-[9px] uppercase tracking-wider text-[#a89575]">Accessory</span>
            <span className="font-serif text-xs font-medium text-[#f5ebd7] truncate block">
              {equippedAccessory ? equippedAccessory.name : player.equipped?.accessory || 'None'}
            </span>
          </div>
        </div>
      </div>

      {/* 4. Active Tactical Combat */}
      {combat?.active && (
        <div className="bg-[#2a0e14] border border-rose/50 rounded-xl p-4 shadow-lg space-y-2 mt-auto">
          <div className="flex items-center justify-between text-rose-300 font-serif text-xs font-bold uppercase tracking-wider">
            <span className="flex items-center gap-1.5">
              <Swords size={14} className="text-rose-500" /> Tactical Encounter
            </span>
          </div>
          <p className="font-serif text-sm font-bold text-white truncate">
            {combat.enemyName?.toUpperCase() ?? 'HOSTILE'}
          </p>
          <PoolBar icon={Heart} label="Enemy HP" value={combat.enemyHp ?? 0} max={combat.enemyHpMax ?? 1} colorVar="#f43f5e" />
        </div>
      )}
    </aside>
  )
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
  corpses: { icon: Ghost, label: 'Harvestable Corpses' },
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
  debugMode?: boolean
  isLastTurn?: boolean
  onEditLastTurn?: (newNar: string) => void
  onRemoveLastTurn?: () => void
  editLongText?: (label: string, value: string, hint?: string, placeholder?: string) => Promise<string | null>
  confirmAction?: (message: string) => Promise<boolean>
  setInput?: (val: string) => void
  items?: Record<string, ItemEntry>
  locations?: Record<string, LocationEntry>
}

// Debugging tool — every real narrated turn's request/response/finishReason
// since turn 0, for reporting a pattern across a whole session rather than
// one turn at a time (DebugPayloadButton below covers the single-turn case).
// Synthetic entries (bang/chapter-recap/class-evolution) carry no
// `rawPayload` and are skipped — there's no API call to show.
function buildSessionPayloadText(log: LogEntry[], title: string): string {
  const withPayload = log
    .map((entry, index) => ({ entry, index }))
    .filter(({ entry }) => entry.rawPayload)

  const header = [
    '# Tale Dives — Session Payload',
    `# Tale: ${title}`,
    `# Total log entries: ${log.length}, narrated turns with a recorded payload: ${withPayload.length}`,
    '',
  ].join('\n')

  const turns = withPayload.map(({ entry, index }) => {
    const when = [entry.time ? `${entry.time.d}d ${entry.time.h}` : null, entry.locDisp].filter(Boolean).join(' @ ')
    return [
      '='.repeat(80),
      `Turn #${index}${when ? ` — ${when}` : ''}`,
      `Action: ${entry.action ?? '(none recorded)'}`,
      `finishReason: ${entry.finishReason ?? '(not recorded)'}`,
      '-'.repeat(80),
      '### REQUEST (context sent)',
      entry.requestPayload ?? '(not recorded)',
      '',
      '### RESPONSE (raw model output)',
      entry.rawPayload,
    ].join('\n')
  })

  return [header, ...turns, '='.repeat(80)].join('\n\n')
}

// The "whole session" counterpart to DebugPayloadButton below — pinned to
// the top of the screen (inside the fixed header, so the ResizeObserver
// that already measures header height picks up the extra space and the
// parchment reflows underneath it automatically) rather than living inline
// in the scrolling log, since this covers every turn at once, not one.
// Only ever rendered when Debug Mode is on (see Chronicle's own render).
function SessionPayloadPanel({ log, title }: { log: LogEntry[]; title: string }) {
  const [copied, setCopied] = useState(false)
  const text = useMemo(() => buildSessionPayloadText(log, title), [log, title])

  function handleCopy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="px-3 pb-2">
      <div className="rounded-lg border border-rose/30 bg-black/30 overflow-hidden">
        <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-rose/20">
          <span className="text-[10px] font-mono uppercase tracking-wide text-rose">Session Payload — since Turn 0</span>
          <button onClick={handleCopy} className="inline-flex items-center gap-1 text-[10px] font-mono text-ink-muted hover:text-ink">
            {copied ? (
              <>
                <Check size={11} className="text-emerald" /> Copied
              </>
            ) : (
              <>
                <Copy size={11} /> Copy All
              </>
            )}
          </button>
        </div>
        <pre className="max-h-[35vh] overflow-auto p-2.5 text-[10px] font-mono leading-snug text-ink-muted whitespace-pre-wrap break-words">
          {text}
        </pre>
      </div>
    </div>
  )
}

// Debugging tool — a turn's exact request context and the model's raw
// response text, collapsed by default so it doesn't compete with the prose,
// with a one-click copy so a player can paste a broken turn to a Claude
// session or AI Studio without reconstructing it by hand. Only turns that
// actually hit the API carry `rawPayload` (App.tsx's sendAction) — bang
// commands, chapter recaps, and other synthetic entries never render this.
// Gated behind Debug Mode by its caller (TurnBlock), same as
// SessionPayloadPanel above.
function DebugPayloadButton({ entry }: { entry: LogEntry }) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  if (!entry.rawPayload) return null

  // MAX_TOKENS on a real narrated turn means the model got cut off
  // mid-response — flagged right on the collapsed toggle, not just buried
  // inside the expanded payload, since that's the one finishReason value
  // that means "this turn is visibly broken," not just "here's some info."
  const truncated = entry.finishReason === 'MAX_TOKENS'
  const payloadText = `### REQUEST (context sent)\n${entry.requestPayload ?? '(not recorded)'}\n\n### RESPONSE (raw model output)\n${entry.rawPayload}\n\n### finishReason: ${entry.finishReason ?? '(not recorded)'}`

  function handleCopy() {
    navigator.clipboard.writeText(payloadText).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-wide ${
          truncated ? 'text-rose hover:text-rose' : 'text-ink-muted/70 hover:text-ink-muted'
        }`}
      >
        <Bug size={11} /> {open ? 'Hide Payload' : 'View Payload'}
        {truncated && !open && ' — cut off (MAX_TOKENS)'}
      </button>
      {open && (
        <div className="mt-1.5 rounded-lg border border-ink-muted/25 bg-black/[0.04] overflow-hidden">
          <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-ink-muted/20">
            <span className={`text-[10px] font-mono uppercase tracking-wide ${truncated ? 'text-rose' : 'text-ink-muted'}`}>
              Debug Payload{entry.finishReason ? ` · ${entry.finishReason}` : ''}
            </span>
            <button
              onClick={handleCopy}
              className="inline-flex items-center gap-1 text-[10px] font-mono text-ink-muted hover:text-ink"
            >
              {copied ? (
                <>
                  <Check size={11} className="text-emerald" /> Copied
                </>
              ) : (
                <>
                  <Copy size={11} /> Copy
                </>
              )}
            </button>
          </div>
          <pre className="max-h-64 overflow-auto p-2.5 text-[10px] font-mono leading-snug text-ink-muted whitespace-pre-wrap break-words">
            {payloadText}
          </pre>
        </div>
      )}
    </div>
  )
}

interface TurnActionsRowProps {
  entry: LogEntry
  debugMode?: boolean
  onEdit: () => void
  onRetry: () => void
  onDelete: () => void
}

// Edit/Retry/Delete — only ever rendered for the single most recent real
// narrated turn (TurnBlock below decides that), so a player can correct a
// bad turn without it drifting from what the AI actually remembers next
// turn. View Payload stays tucked under "More" here too, alongside Delete,
// rather than duplicating DebugPayloadButton's own standalone rendering —
// gated on Debug Mode same as everywhere else; Edit/Retry/Delete are not.
function TurnActionsRow({ entry, debugMode, onEdit, onRetry, onDelete }: TurnActionsRowProps) {
  const [moreOpen, setMoreOpen] = useState(false)
  if (!entry.rawPayload) return null

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <button onClick={onEdit} className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-wide text-ink-muted/70 hover:text-ink-muted">
          <Pencil size={11} /> Edit
        </button>
        <button onClick={onRetry} className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-wide text-ink-muted/70 hover:text-ink-muted">
          <RotateCcw size={11} /> Retry
        </button>
        <button onClick={() => setMoreOpen((v) => !v)} className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-wide text-ink-muted/70 hover:text-ink-muted">
          <MoreHorizontal size={11} /> {moreOpen ? 'Less' : 'More'}
        </button>
      </div>
      {moreOpen && (
        <div className="flex flex-col gap-2 pl-0.5">
          {debugMode && <DebugPayloadButton entry={entry} />}
          <button onClick={onDelete} className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-wide text-rose/80 hover:text-rose">
            <Trash2 size={11} /> Delete Turn
          </button>
        </div>
      )}
    </div>
  )
}

// Isolated from `input` state (§9.2 perf fix) — memoized so a keystroke in the
// input bar doesn't re-render/re-parse rich text for every mounted turn block.
const TurnBlock = memo(function TurnBlock({
  entry,
  globalIndex,
  onTapTerm,
  registerRef,
  debugMode,
  isLastTurn,
  onEditLastTurn,
  onRemoveLastTurn,
  editLongText,
  confirmAction,
  setInput,
  items,
  locations,
}: TurnBlockProps) {
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
        <p className="font-mono text-[10px] font-semibold uppercase tracking-wide text-gold-primary text-left">
          {formatTimestamp(entry.time, entry.locDisp)}
        </p>
      )}
      <div className="flex items-center gap-2 flex-wrap">
        {/* The player's own typed action — same narrative serif and italic
            treatment as everything else on the page (dropped the old
            font-mono "> " console-prompt prefix, which read like a terminal
            echo rather than part of the story); gold-primary is what still
            marks it as a different voice from the narration beneath it. */}
        {entry.action && <p className="font-narrative italic text-sm text-gold-primary text-left whitespace-pre-wrap">{entry.action}</p>}
        {StateIcon && stateMeta && (
          <span className="inline-flex items-center gap-1 text-[10px] font-display" style={{ color: stateMeta.accent }}>
            <StateIcon size={11} /> {stateMeta.label}
          </span>
        )}
      </div>
      {entry.mood && (
        <p className="inline-flex items-center gap-1 text-[11px] italic text-ink-muted text-left">
          <Sparkle size={10} /> {entry.mood}
        </p>
      )}
      <div className="font-narrative text-sm leading-relaxed whitespace-pre-wrap text-left">
        {renderNarrative(entry.nar, onTapTerm, items, locations)}
      </div>
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
      {isLastTurn ? (
        <TurnActionsRow
          entry={entry}
          debugMode={debugMode}
          onEdit={async () => {
            if (!editLongText || !onEditLastTurn) return
            const result = await editLongText(
              'Edit Narration',
              entry.nar,
              "Rewrite this turn's prose. This also updates what the AI remembers for future turns.",
            )
            if (result !== null) onEditLastTurn(result)
          }}
          onRetry={async () => {
            if (!confirmAction || !onRemoveLastTurn) return
            const ok = await confirmAction(
              'Retry this turn? It — and anything since, like a bang command lookup — will be removed so you can revise and resend your action.',
            )
            if (ok) {
              onRemoveLastTurn()
              setInput?.(entry.action ?? '')
            }
          }}
          onDelete={async () => {
            if (!confirmAction || !onRemoveLastTurn) return
            const ok = await confirmAction(
              "Delete this turn? It — and anything since, like a bang command lookup — will be removed from the tale and the AI's memory.",
            )
            if (ok) onRemoveLastTurn()
          }}
        />
      ) : (
        debugMode && <DebugPayloadButton entry={entry} />
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
    // Deliberately hardcoded colors throughout, not the `text-ink`/`text-gold-primary`
    // tokens: this panel renders inside `.parchment-surface` (Chronicle's reading
    // area), which re-points those exact token names to *dark* values meant for its
    // cream background. This box stays dark and opaque regardless of where it's
    // mounted, so it needs its own fixed, non-glassmorphic palette rather than
    // inheriting the ambient theme.
    <div className="my-4 p-4 rounded-xl border border-rose-500/40 bg-[#181022] text-[#f5ecd8] shadow-[0_8px_32px_rgba(0,0,0,0.6)] space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-white/10 pb-2.5">
        <AlertTriangle className="text-rose-400 shrink-0" size={18} />
        <h3 className="font-display text-sm font-bold tracking-wide text-rose-400 flex-1">
          FATE THREAD FALTERED
        </h3>
        <button
          onClick={handleDismissAndPause}
          className="text-[#b8a888] hover:text-[#f5ecd8] transition-colors"
          title="Dismiss"
        >
          <X size={16} />
        </button>
      </div>

      {/* Grid of details */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-[11px] font-mono text-[#b8a888]">
        <div>
          <span className="opacity-80">Provider:</span>{' '}
          <span className="text-[#f0ca65] font-semibold">{apiSettings?.provider || 'gemini'}</span>
        </div>
        <div>
          <span className="opacity-80">Model:</span>{' '}
          <span className="text-[#f0ca65] font-semibold">{apiSettings?.model || 'Unknown'}</span>
        </div>
        <div>
          <span className="opacity-80">Temp:</span>{' '}
          <span className="text-cyan-300 font-semibold">{apiSettings?.temperature ?? 0.7}</span>
        </div>
        <div>
          <span className="opacity-80">Key:</span>{' '}
          <span className="text-emerald-300 font-semibold">{maskApiKey(apiSettings?.apiKey || '')}</span>
        </div>
        <div className="col-span-1 sm:col-span-2">
          <span className="opacity-80">Depth:</span>{' '}
          <span className="text-amber-300 font-semibold">
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
              className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 py-2.5 font-display text-xs font-semibold tracking-wider text-white shadow-[0_2px_10px_rgba(225,29,72,0.4)] transition-all active:scale-[0.98] cursor-pointer"
            >
              <RotateCcw size={13} /> Retry Now
            </button>
          )}
          <button
            onClick={onOpenSettings}
            className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-white/10 hover:bg-white/20 border border-white/15 py-2.5 font-display text-xs tracking-wider text-[#f5ecd8] transition-all active:scale-[0.98] cursor-pointer"
          >
            <SettingsIcon size={13} className="text-[#e8ca8a]" /> Open Settings
          </button>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <button
            onClick={handleCopyReport}
            className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-white/10 hover:bg-white/20 border border-white/15 py-2.5 font-display text-xs tracking-wider text-[#f5ecd8] transition-all cursor-pointer"
          >
            {copied ? (
              <>
                <Check size={13} className="text-emerald-400" /> Copied!
              </>
            ) : (
              <>
                <Copy size={13} className="text-[#e8ca8a]" /> Copy Diagnostic Report
              </>
            )}
          </button>
          <button
            onClick={handleDismissAndPause}
            className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-white/10 hover:bg-white/20 border border-white/15 py-2.5 font-display text-xs tracking-wider text-[#f5ecd8] transition-all cursor-pointer"
            title="Dismiss error and let you edit text"
          >
            <Pause size={13} className="text-amber-300" /> Dismiss to PAUSE
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
  items,
  crafting,
  apiSettings,
  proseDepth,
  lastActionText,
  onRetry,
  onDismissError,
  onEditLastTurn,
  onRemoveLastTurn,
  editLongText,
  confirmAction,
  onSend,
  onBangCommand,
  slashCommands,
  onOpenSlashManager,
  onOpenSettings,
  onOpenMenu,
  onOpenCodex,
  onOpenCodexEntry,
  onOpenCodexCategory,
  debugMode,
}: ChronicleProps) {
  const [input, setInput] = useState('')
  const [sessionPayloadOpen, setSessionPayloadOpen] = useState(false)
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
  const [drawerOpen, setDrawerOpen] = useState(false)

  const lastLogEntry = useMemo(() => log[log.length - 1], [log])

  const drawerActions = useMemo(() => {
    const actions: { icon: LucideIcon; label: string; onClick: () => void }[] = [
      { icon: Backpack, label: 'Items', onClick: () => onOpenCodexCategory('items') },
      { icon: Sparkles, label: 'Spells', onClick: () => onOpenCodexCategory('skills') },
      { icon: ScrollText, label: 'Quests', onClick: () => onOpenCodexCategory('quests') },
      { icon: Skull, label: 'Monsters', onClick: () => onOpenCodexCategory('bestiary') },
      { icon: MapIcon, label: 'World', onClick: () => onOpenCodexCategory('locations') },
      { icon: Users, label: 'NPCs', onClick: () => onOpenCodexCategory('npcs') },
      { icon: ShieldCheck, label: 'Factions', onClick: () => onOpenCodexCategory('factions') },
      { icon: BookOpen, label: 'Lore', onClick: () => onOpenCodexCategory('lore') },
    ]
    if (crafting && crafting.length > 0) {
      actions.push({ icon: Hammer, label: 'Crafting', onClick: () => onOpenCodexCategory('crafting') })
    }
    return actions
  }, [crafting, onOpenCodexCategory])

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

  // Edit/Retry/Delete eligibility (TurnBlock's isLastTurn prop): the last
  // *narrated* entry, not necessarily the literal last log entry — a bang
  // command (!inventory, !arise, ...) is its own entry with no nar/
  // rawPayload, and shouldn't make the real turn before it uneditable just
  // because the player looked something up afterward. App.tsx's
  // onRemoveLastTurn mirrors this same "last narrated" search.
  let lastNarratedIndex = -1
  for (let i = log.length - 1; i >= 0; i--) {
    if (log[i].nar && log[i].rawPayload) {
      lastNarratedIndex = i
      break
    }
  }

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
      const dict = { npc: npcs, loc: locations, faction: factions, lore, quest: quests, beast: bestiary, skill: skills, item: items }[category]
      if (dict?.[id]) setPopup({ category, id })
    },
    [npcs, locations, factions, lore, quests, bestiary, skills, items],
  )

  const popupEntry =
    popup &&
    ({ npc: npcs, loc: locations, faction: factions, lore, quest: quests, beast: bestiary, skill: skills, item: items }[popup.category]?.[popup.id] as
      | NpcEntry
      | LocationEntry
      | FactionEntry
      | LoreEntry
      | QuestEntry
      | BestiaryEntry
      | SkillEntry
      | ItemEntry
      | undefined)

  return (
    <div className="fixed inset-0 overflow-hidden text-ink bg-canvas flex flex-col lg:flex-row">
      {/* PC Left Sidebar (Character Info, Equipment Slots, Stats HUD, Tactical Combat) */}
      <DesktopLeftSidebar
        player={player}
        items={items}
        combat={combat}
        locationName={locations[player.locId]?.name || player.locDisp}
      />

      {/* Main Story Container */}
      <div className="flex-1 flex flex-col h-full relative overflow-hidden">
        {/* Mobile/Tablet Header Bar */}
        <header
          ref={headerRef}
          className="absolute top-0 inset-x-0 z-10 flex flex-col border-b shadow-2xl transition-[background,border-color] duration-700 ease-out"
          style={{
            background: `rgba(11,13,20,${chromeAlpha})`,
            borderColor: `${stateAccent}45`,
          }}
        >
          <div
            className="flex items-center justify-between px-3 py-1.5"
            style={{ paddingTop: 'max(0.375rem, env(safe-area-inset-top))' }}
          >
            <button onClick={onOpenMenu} aria-label="Home" title="Main Menu" className="w-8 h-8 rounded-xl inline-flex items-center justify-center text-[#e8ca8a] hover:bg-white/10">
              <Home size={16} />
            </button>
            <div className="font-display text-xs font-semibold tracking-wide text-center flex-1 truncate px-2 text-[#e8ca8a]">
              {title}
            </div>
            {debugMode && (
              <button
                onClick={() => setSessionPayloadOpen((v) => !v)}
                aria-label="Session Payload"
                title="This session's turn-by-turn request/response/finishReason since turn 0, for debugging"
                className={`w-8 h-8 rounded-xl inline-flex items-center justify-center hover:bg-white/10 ${sessionPayloadOpen ? 'text-rose' : 'text-[#e8ca8a]'}`}
              >
                <Bug size={16} />
              </button>
            )}
            <button onClick={onOpenCodex} aria-label="Codex" className="w-8 h-8 rounded-xl inline-flex items-center justify-center text-[#e8ca8a] hover:bg-white/10">
              <Library size={16} />
            </button>
            <button onClick={onOpenSettings} aria-label="Settings" className="w-8 h-8 rounded-xl inline-flex items-center justify-center text-[#e8ca8a] hover:bg-white/10">
              <SettingsIcon size={16} />
            </button>
          </div>

          {/* Player Vitals HUD Bar placed below header bar (mobile / tablet) */}
          <div className="lg:hidden px-3 border-t border-white/10 bg-black/25 backdrop-blur-sm">
            <div className="flex items-center justify-between py-0.5">
              <button
                onClick={() => setStatsCollapsed((v) => !v)}
                aria-label={statsCollapsed ? 'Expand stats' : 'Collapse stats'}
                className="w-full flex items-center justify-center leading-none text-white/40 hover:text-[#e8ca8a] py-0.5 cursor-pointer"
              >
                {statsCollapsed ? <ChevronDown size={11} /> : <ChevronUp size={11} />}
              </button>
            </div>
            <div
              className="grid transition-[grid-template-rows] duration-200 ease-out"
              style={{ gridTemplateRows: statsCollapsed ? '0fr' : '1fr' }}
            >
              <div className="overflow-hidden">
                <div className="px-1 pb-1.5 flex items-center gap-3 text-white/80 flex-wrap sm:flex-nowrap">
                  <PoolBar icon={Heart} label="HP" value={player.hp} max={player.hpMax} colorVar="#fb3552" />
                  <PoolBar icon={Zap} label="MP" value={player.mp} max={player.mpMax} colorVar="#22d3ee" />
                  <PoolBar icon={Activity} label="ST" value={player.st} max={player.stMax} colorVar="#34d399" />
                  <CurrencyBadge copper={player.copper} />
                </div>
              </div>
            </div>
          </div>

          {combat?.active && (
            <div className="lg:hidden border-t border-rose/30 px-4 py-1 text-white/80 bg-rose-950/40">
              <PoolBar icon={Swords} label={combat.enemyName?.toUpperCase() ?? 'HOSTILE'} value={combat.enemyHp ?? 0} max={combat.enemyHpMax ?? 1} colorVar="#e11d48" />
            </div>
          )}

          {debugMode && sessionPayloadOpen && <SessionPayloadPanel log={log} title={title} />}
        </header>

        {/* Parchment Log Container */}
        <div
          ref={scrollRef}
          onClick={() => setDrawerOpen(false)}
          className="parchment-surface absolute inset-0 overflow-y-auto bg-parchment parchment-texture rounded-xl pl-4 pr-6 space-y-4 cursor-default"
          style={{ top: 6, bottom: 6, left: 6, right: 6, paddingTop: headerHeight + 16, paddingBottom: bottomHeight + 40 }}
        >
          <div className="max-w-2xl sm:max-w-3xl mx-auto w-full space-y-4">
            {log.length === 0 && (
              <p className="font-narrative italic text-sm opacity-60 text-center">
                The tale hasn't begun. Type an action below to dive in.
              </p>
            )}
            {hasEarlierTurns && (
              <button
                onClick={loadEarlierTurns}
                className="mx-auto flex items-center gap-1.5 rounded-xl border border-gold-accent/40 px-3 py-1.5 font-display text-xs text-gold-primary cursor-pointer hover:bg-gold-accent/10"
              >
                <History size={12} /> Load Earlier Turns
              </button>
            )}
            {visibleLog.map((entry, i) => (
              <TurnBlock
                key={windowStart + i}
                entry={entry}
                globalIndex={windowStart + i}
                onTapTerm={onTapTerm}
                registerRef={registerRef}
                debugMode={debugMode}
                isLastTurn={windowStart + i === lastNarratedIndex}
                onEditLastTurn={onEditLastTurn}
                onRemoveLastTurn={onRemoveLastTurn}
                editLongText={editLongText}
                confirmAction={confirmAction}
                setInput={setInput}
                items={items}
                locations={locations}
              />
            ))}
            {busy && <p className="font-narrative italic text-sm opacity-50 text-left">The thread of fate is being woven...</p>}
            {lastLogEntry?.act && lastLogEntry.act.length > 0 && !busy && !error && (
              <div className="flex flex-col gap-1.5 pt-2 border-t border-gold-accent/15">
                <span className="text-[10px] font-mono tracking-wider text-gold-primary opacity-60 uppercase text-left">Suggested Actions</span>
                <div className="flex flex-wrap gap-1.5 justify-start">
                  {lastLogEntry.act.map((suggestion, idx) => (
                    <button
                      key={idx}
                      onClick={() => setInput(suggestion)}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-gold-accent/10 hover:bg-gold-accent/20 border border-gold-accent/35 hover:border-gold-accent/60 px-3 py-1 font-narrative text-xs text-gold-primary transition-all cursor-pointer active:scale-[0.98]"
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
        </div>

        {/* Turn Navigator */}
        {log.length > 0 && (
          <div
            ref={navRef}
            onPointerDown={onNavPointerDown}
            onPointerMove={onNavPointerMove}
            onPointerUp={onNavPointerUp}
            onPointerCancel={onNavPointerUp}
            className="turn-nav group fixed z-10 flex flex-col items-center gap-0.5 rounded-xl backdrop-blur-sm px-1 py-1.5 cursor-grab active:cursor-grabbing touch-none"
            style={{
              right: 14,
              ...(navDragPos ? { top: navDragPos.y } : { bottom: bottomHeight + 16 }),
              ['--turn-accent' as string]: stateAccent,
              ...(navDragging ? { background: 'rgba(20,22,34,0.88)' } : {}),
            }}
          >
            <button
              onClick={goPrevious}
              aria-label="Previous turn"
              className="w-6 h-6 rounded-lg inline-flex items-center justify-center text-white/40 hover:!text-[#e8ca8a] group-hover:text-white/70 hover:bg-white/10 transition-colors cursor-pointer"
            >
              <ChevronUp size={13} />
            </button>
            <span className="font-mono text-[10px] tabular-nums text-white/40 group-hover:text-white/80 transition-colors">
              {navPosition || ''}
            </span>
            <button
              onClick={goNext}
              aria-label="Next turn"
              className="w-6 h-6 rounded-lg inline-flex items-center justify-center text-white/40 hover:!text-[#e8ca8a] group-hover:text-white/70 hover:bg-white/10 transition-colors cursor-pointer"
            >
              <ChevronDown size={13} />
            </button>
            <div className="w-3 h-px my-0.5 bg-white/10 group-hover:bg-white/20 transition-colors" />
            <button
              onClick={jumpToLatest}
              aria-label="Jump to latest"
              className="w-6 h-6 rounded-lg inline-flex items-center justify-center text-white/40 hover:!text-[#e8ca8a] group-hover:text-white/70 hover:bg-white/10 transition-colors cursor-pointer"
            >
              <ChevronsDown size={13} />
            </button>
          </div>
        )}

        {/* Elevated Input Bar Tray with Extending Drawer Menu */}
        <div
          ref={bottomRef}
          className="absolute bottom-0 inset-x-0 lg:bottom-5 lg:inset-x-6 lg:max-w-4xl lg:mx-auto z-20 flex flex-col rounded-t-2xl lg:rounded-2xl border-t border-x-0 border-b-0 lg:border shadow-2xl transition-[background,border-color] duration-700 ease-out backdrop-blur-md"
          style={{
            background: `rgba(11,13,20,${chromeAlpha})`,
            borderColor: `${stateAccent}45`,
          }}
        >
          {/* Drawer Menu Popup */}
          <AnimatePresence>
            {drawerOpen && (
              <motion.div
                initial={{ opacity: 0, y: 12, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.97 }}
                transition={{ duration: 0.18, ease: 'easeOut' }}
                className="absolute bottom-full mb-3 left-0 right-0 p-3 sm:p-4 rounded-2xl bg-[#14101d]/95 border border-[#c89d51]/50 backdrop-blur-xl shadow-[0_20px_50px_rgba(0,0,0,0.9)] z-30"
              >
                <div className="flex items-center justify-between mb-2.5 px-1 border-b border-[#c89d51]/20 pb-1.5">
                  <span className="font-serif text-xs font-bold uppercase tracking-wider text-[#d4af37] flex items-center gap-1.5">
                    <LayoutGrid size={14} /> Codex Navigation
                  </span>
                  <button
                    onClick={() => setDrawerOpen(false)}
                    className="text-[#a89575] hover:text-[#f5ebd7] p-1 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
                  >
                    <X size={14} />
                  </button>
                </div>
                <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                  {drawerActions.map((act) => (
                    <button
                      key={act.label}
                      onClick={() => {
                        act.onClick()
                        setDrawerOpen(false)
                      }}
                      className="group flex flex-col items-center justify-center p-2 rounded-xl bg-[#23172e] border border-[#c89d51]/30 hover:border-[#f0ca65] hover:bg-[#322042] active:scale-95 text-[#f5ebd7] transition-all shadow-md cursor-pointer aspect-square"
                    >
                      <act.icon size={20} className="text-[#d4af37] group-hover:text-[#fff5dd] transition-colors mb-1 shrink-0" />
                      <span className="font-serif text-[10px] font-medium text-[#c8b8a2] group-hover:text-[#ffffff] truncate w-full text-center">
                        {act.label}
                      </span>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="relative px-3 pt-2 pb-2.5 flex gap-2 items-end">
            {/* Bang Suggestions */}
            {bangSuggestions.length > 0 && (
              <div className="absolute left-3 right-3 bottom-full mb-1.5 rounded-xl border border-[#e8ca8a]/25 bg-[#141622]/90 backdrop-blur-md shadow-2xl overflow-hidden">
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
            {/* Slash Suggestions */}
            {slashSuggestions.length > 0 && (
              <div className="absolute left-3 right-3 bottom-full mb-1.5 rounded-xl border border-[#e8ca8a]/25 bg-[#141622]/90 backdrop-blur-md shadow-2xl overflow-hidden">
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
                  <p className="px-3 py-2 text-[11px] text-white/40 italic">No slash commands yet — tap / below to create one.</p>
                )}
              </div>
            )}

            {/* Slash Command Button */}
            <button
              onClick={onOpenSlashManager}
              aria-label="Slash commands"
              title="Slash Command Manager"
              className="shrink-0 w-8 h-8 rounded-xl inline-flex items-center justify-center font-mono text-sm font-bold bg-[#1e142a] text-[#e8ca8a] border border-[#c89d51]/40 hover:bg-[#2c1d3e] hover:border-[#f0ca65] hover:text-[#f0ca65] transition-all cursor-pointer"
            >
              /
            </button>

            {/* Drawer Menu Button */}
            <button
              onClick={() => setDrawerOpen((v) => !v)}
              aria-label={drawerOpen ? 'Close navigation drawer' : 'Open navigation drawer'}
              title="Quick Codex Navigation Drawer"
              className={`shrink-0 w-8 h-8 rounded-xl inline-flex items-center justify-center transition-all border cursor-pointer ${
                drawerOpen
                  ? 'bg-[#c89d51] text-[#0e1017] border-[#f0ca65] shadow-[0_0_12px_rgba(200,157,81,0.5)]'
                  : 'bg-[#1e142a] text-[#e8ca8a] border-[#c89d51]/40 hover:bg-[#2c1d3e] hover:border-[#f0ca65] hover:text-[#f0ca65]'
              }`}
            >
              <LayoutGrid size={16} />
            </button>

            {/* Input Textarea */}
            <textarea
              ref={textareaRef}
              rows={2}
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
              className="turn-glow flex-1 resize-none rounded-xl border backdrop-blur-sm px-3 py-2 font-narrative text-sm leading-relaxed text-white/90 placeholder:text-white/35 min-h-[56px]"
              style={{
                maxHeight: INPUT_MAX_HEIGHT,
                ['--turn-accent' as string]: stateAccent,
                ['--chrome-alpha-idle' as string]: inputIdleAlpha,
                ['--chrome-alpha-focus' as string]: inputFocusAlpha,
              }}
            />

            {/* Send Button */}
            <button
              onClick={send}
              disabled={busy || !input.trim()}
              aria-label="Send"
              className="turn-glow-btn w-8 h-8 shrink-0 rounded-xl inline-flex items-center justify-center transition-all bg-[#e8ca8a] text-[#0e1017] border border-[#f0ca65] hover:bg-[#f0ca65] hover:shadow-[0_0_12px_rgba(200,157,81,0.5)] disabled:bg-white/10 disabled:text-white/25 disabled:border-transparent cursor-pointer"
            >
              <Send size={14} />
            </button>
          </div>
        </div>
      </div>

      {popup && popupEntry && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 sm:p-6"
          onClick={() => setPopup(null)}
        >
          <div
            className="relative bg-[#120d1b] border border-[#c89d51]/50 shadow-[0_20px_50px_rgba(0,0,0,0.95),0_0_30px_rgba(200,157,81,0.2)] rounded-xl p-5 sm:p-6 w-full max-w-sm sm:max-w-md overflow-hidden text-left"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Ambient Background Watermark / Glow Accent */}
            <div className="absolute -top-16 -right-16 w-36 h-36 bg-[#d4af37]/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-10 -right-10 w-32 h-32 text-[#c89d51]/5 pointer-events-none">
              <svg viewBox="0 0 100 100" fill="currentColor">
                <path d="M50 0 C60 30, 70 40, 100 50 C70 60, 60 70, 50 100 C40 70, 30 60, 0 50 C30 40, 40 30, 50 0 Z" />
              </svg>
            </div>

            {/* Header: Title + Lock + Close */}
            <div className="flex items-start justify-between gap-3 pr-1">
              <h3 className="font-serif text-xl sm:text-2xl font-normal text-[#f5ebd7] tracking-wide flex items-center gap-2 drop-shadow-sm">
                {'discovery' in popupEntry && isHidden(popupEntry) && <Lock size={18} className="text-[#c89d51] shrink-0" />}
                <span>{'discovery' in popupEntry && isHidden(popupEntry) ? '???' : popupEntry.name}</span>
              </h3>
              <button
                onClick={() => setPopup(null)}
                aria-label="Close"
                className="text-[#a89575] hover:text-[#f5ebd7] transition-colors p-1.5 -mr-1.5 -mt-1 rounded-md hover:bg-white/5 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Ornamental Gold Line with Flourish */}
            <div className="flex items-center gap-1 my-3">
              <svg className="w-7 h-5 text-[#c89d51] shrink-0 -mr-1" viewBox="0 0 28 20" fill="currentColor">
                <path d="M 2 10 C 2 6, 6 3, 10 3 C 13 3, 15 5, 14 8 C 13 11, 10 11, 9 9 C 8 7, 10 6, 11 6 C 10 4, 7 4, 5 8 C 3 12, 7 15, 12 14 C 16 13, 18 10, 22 10 L 28 10 L 28 11 L 22 11 C 18 11, 16 14, 12 15 C 6 16, 2 14, 2 10 Z" />
                <circle cx="10" cy="8" r="1.5" />
              </svg>
              <div className="h-[1.5px] flex-1 bg-gradient-to-r from-[#c89d51] via-[#c89d51]/70 to-transparent" />
            </div>

            {/* Content Body */}
            {'discovery' in popupEntry && isHidden(popupEntry) ? (
              <p className="font-serif text-sm italic text-[#b8a892] leading-relaxed my-3">
                {popupEntry.discovery?.teaser || 'Not yet discovered.'}
              </p>
            ) : (
              <div className="space-y-3">
                {/* Attribute Badges Row */}
                <div className="flex items-center gap-2 flex-wrap">
                  {popup.category === 'item' && 'type' in popupEntry && (
                    <>
                      <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-[#231710] border border-[#a87034]/60 shadow-sm">
                        <span className="font-serif text-[#d4af37] text-xs uppercase tracking-wider font-medium">Type</span>
                        <span className="font-sans font-bold text-xs text-[#f5ebd7] capitalize">{popupEntry.type}</span>
                      </div>
                      {popupEntry.rarity && (
                        <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-[#231710] border border-[#a87034]/60 shadow-sm">
                          <span className="font-serif text-[#d4af37] text-xs uppercase tracking-wider font-medium">Rarity</span>
                          <span className="font-sans font-bold text-xs text-[#f5ebd7]">{popupEntry.rarity}</span>
                        </div>
                      )}
                      {popupEntry.statBonus && statBonusText(popupEntry.statBonus) && (
                        <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-[#231710] border border-[#a87034]/60 shadow-sm">
                          <span className="font-serif text-[#d4af37] text-xs uppercase tracking-wider font-medium">Bonus</span>
                          <span className="font-sans font-bold text-xs text-[#f5ebd7]">{statBonusText(popupEntry.statBonus)}</span>
                        </div>
                      )}
                      {popupEntry.value !== undefined && (
                        <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-[#231710] border border-[#a87034]/60 shadow-sm">
                          <span className="font-serif text-[#d4af37] text-xs uppercase tracking-wider font-medium">Worth</span>
                          <span className="font-sans font-bold text-xs text-[#f5ebd7]">{popupEntry.value} C</span>
                        </div>
                      )}
                    </>
                  )}

                  {popup.category === 'npc' && 'stage' in popupEntry && (
                    <>
                      <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-[#231710] border border-[#a87034]/60 shadow-sm">
                        <span className="font-serif text-[#d4af37] text-xs uppercase tracking-wider font-medium">{popupEntry.role || 'NPC'}</span>
                        <span className="font-sans font-bold text-xs text-[#f5ebd7] capitalize">{popupEntry.stage}</span>
                      </div>
                      <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-[#231710] border border-[#a87034]/60 shadow-sm">
                        <span className="font-serif text-[#d4af37] text-xs uppercase tracking-wider font-medium">Trust</span>
                        <span className="font-sans font-bold text-xs text-[#f5ebd7]">{popupEntry.trust}</span>
                      </div>
                      <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-[#231710] border border-[#a87034]/60 shadow-sm">
                        <span className="font-serif text-[#d4af37] text-xs uppercase tracking-wider font-medium">Affection</span>
                        <span className="font-sans font-bold text-xs text-[#f5ebd7]">{popupEntry.affection}</span>
                      </div>
                    </>
                  )}

                  {popup.category === 'loc' && 'region' in popupEntry && (
                    <>
                      <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-[#231710] border border-[#a87034]/60 shadow-sm">
                        <span className="font-serif text-[#d4af37] text-xs uppercase tracking-wider font-medium">Region</span>
                        <span className="font-sans font-bold text-xs text-[#f5ebd7]">{popupEntry.region || 'Realm'}</span>
                      </div>
                      <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-[#231710] border border-[#a87034]/60 shadow-sm">
                        <span className="font-serif text-[#d4af37] text-xs uppercase tracking-wider font-medium">Danger</span>
                        <span className="font-sans font-bold text-xs text-[#f5ebd7]">{popupEntry.dangerLevel || 'Safe'}</span>
                      </div>
                    </>
                  )}

                  {popup.category === 'faction' && 'repTier' in popupEntry && (
                    <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-[#231710] border border-[#a87034]/60 shadow-sm">
                      <span className="font-serif text-[#d4af37] text-xs uppercase tracking-wider font-medium">Reputation</span>
                      <span className="font-sans font-bold text-xs text-[#f5ebd7]">{popupEntry.repTier > 0 ? '+' : ''}{popupEntry.repTier}</span>
                    </div>
                  )}

                  {popup.category === 'skill' && (
                    <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-[#231710] border border-[#a87034]/60 shadow-sm">
                      <span className="font-serif text-[#d4af37] text-xs uppercase tracking-wider font-medium">Cost</span>
                      <span className="font-sans font-bold text-xs text-[#f5ebd7]">
                        {'mpCost' in popupEntry && popupEntry.mpCost ? `${popupEntry.mpCost} MP` : ''}
                        {'mpCost' in popupEntry && popupEntry.mpCost && 'stCost' in popupEntry && popupEntry.stCost ? ' · ' : ''}
                        {'stCost' in popupEntry && popupEntry.stCost ? `${popupEntry.stCost} ST` : ''}
                        {!('mpCost' in popupEntry && popupEntry.mpCost) && !('stCost' in popupEntry && popupEntry.stCost) ? 'Ability' : ''}
                      </span>
                    </div>
                  )}

                  {popup.category === 'beast' && 'threatTier' in popupEntry && (
                    <>
                      <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-[#231710] border border-[#a87034]/60 shadow-sm">
                        <span className="font-serif text-[#d4af37] text-xs uppercase tracking-wider font-medium">Threat</span>
                        <span className="font-sans font-bold text-xs text-[#f5ebd7]">{popupEntry.threatTier}</span>
                      </div>
                      {popupEntry.hpMax !== undefined && (
                        <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-[#231710] border border-[#a87034]/60 shadow-sm">
                          <span className="font-serif text-[#d4af37] text-xs uppercase tracking-wider font-medium">HP</span>
                          <span className="font-sans font-bold text-xs text-[#f5ebd7]">{popupEntry.hpMax}</span>
                        </div>
                      )}
                      {popupEntry.dmgBase !== undefined && (
                        <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-[#231710] border border-[#a87034]/60 shadow-sm">
                          <span className="font-serif text-[#d4af37] text-xs uppercase tracking-wider font-medium">DMG</span>
                          <span className="font-sans font-bold text-xs text-[#f5ebd7]">{popupEntry.dmgBase}</span>
                        </div>
                      )}
                    </>
                  )}

                  {popup.category === 'quest' && 'status' in popupEntry && (
                    <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-[#231710] border border-[#a87034]/60 shadow-sm">
                      <span className="font-serif text-[#d4af37] text-xs uppercase tracking-wider font-medium">Status</span>
                      <span className="font-sans font-bold text-xs text-[#f5ebd7] capitalize">{popupEntry.status ?? 'active'}</span>
                    </div>
                  )}

                  {popup.category === 'lore' && 'category' in popupEntry && (
                    <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-[#231710] border border-[#a87034]/60 shadow-sm">
                      <span className="font-serif text-[#d4af37] text-xs uppercase tracking-wider font-medium">Category</span>
                      <span className="font-sans font-bold text-xs text-[#f5ebd7] capitalize">{popupEntry.category || 'General'}</span>
                    </div>
                  )}
                </div>

                {/* Prose Text / Descriptions */}
                <div className="font-serif text-sm leading-relaxed text-[#ded2be] space-y-2 pt-1">
                  {'description' in popupEntry && popupEntry.description && (
                    <p>{popupEntry.description}</p>
                  )}
                  {popup.category === 'npc' && 'memSummary' in popupEntry && popupEntry.memSummary && (
                    <p className="italic text-[#c8b8a2]">"{popupEntry.memSummary}"</p>
                  )}
                  {popup.category === 'item' && 'loreText' in popupEntry && popupEntry.loreText && (
                    <p className="italic text-[#c8b8a2]">{popupEntry.loreText}</p>
                  )}
                  {popup.category === 'loc' && 'notableFeatures' in popupEntry && popupEntry.notableFeatures && (
                    <p className="text-xs text-[#b3a48e]"><strong className="text-[#d4af37] font-normal">Features:</strong> {popupEntry.notableFeatures}</p>
                  )}
                </div>
              </div>
            )}

            {/* Action Button */}
            <button
              onClick={() => {
                onOpenCodexEntry(popup.category, popup.id)
                setPopup(null)
              }}
              className="mt-5 w-full py-2.5 px-4 rounded-lg bg-gradient-to-r from-[#2a1b35] via-[#20142b] to-[#180e22] border border-[#c89d51]/50 hover:border-[#f0ca65] text-[#f0ca65] hover:text-[#fff5dd] font-serif text-xs font-semibold tracking-wider uppercase flex items-center justify-center gap-2 transition-all shadow-md active:scale-[0.98] cursor-pointer"
            >
              <span>Open in Codex</span>
              <ExternalLink size={13} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
