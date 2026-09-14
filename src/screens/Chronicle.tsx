import { useState, useRef, useEffect, useCallback, useMemo, memo, type ReactNode } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Home, Settings as SettingsIcon, Send, Star, BookOpen, Library, Sparkle, X, ExternalLink,
  ChevronUp, ChevronDown, ChevronsDown, History, Pause, Users, Backpack, Map as MapIcon, ShieldCheck, Target, Skull, HelpCircle,
  Unlock, Lock, Repeat, Hammer, Ghost, ScrollText, Swords, Sparkles, LayoutGrid, ZoomIn, Shield,
  AlertTriangle, Copy, Check, RotateCcw, Bug, Pencil, MoreHorizontal, Trash2, Heart, Coins, Flag, Feather,
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
  ApiSettings, BestiaryEntry, Campaign, CombatState, CraftingJob, EndingOutcome, FactionEntry, GameTime, KeywordLink, LocationEntry, LogEntry, LoreEntry, NpcEntry, Player,
  ProseDepthConfig, QuestEntry, RegionEntry, SkillEntry, SlashCommand, ItemEntry,
} from '../types.ts'
import { trustWord, presentNpcs } from '../lib/npcs.ts'
import { useEntityImage } from '../lib/useEntityImage.ts'

function traitsText(traits: ItemEntry['traits']): string | null {
  return traits?.length ? traits.join(', ') : null
}

// §6.6 !conclude — display words for LogEntry.ending's fixed outcome set.
const ENDING_LABELS: Record<EndingOutcome, string> = { win: 'Victory', lose: 'Defeat', neutral: 'A Costly End' }

// §7 Image Generation — one present-NPC's portrait chip. A separate small
// component (not inlined in a .map()) because useEntityImage is a hook —
// it needs its own component instance per NPC, not one call shared across
// a loop. No image yet (never generated) just renders nothing: the rail
// only shows chips for NPCs that actually have art, never an empty frame.
// Editorial vellum treatment — a small illuminated portrait medallion with
// its name in the champagne-gold ring beneath, echoing the "character voice
// plate" look of the reference mockup without fabricating dialogue
// attribution the turn data doesn't actually carry.
function NpcPortraitChip({ name, portraitKey, role }: { name: string; portraitKey?: string; role?: string }) {
  const url = useEntityImage(portraitKey)
  if (!url) return null
  return (
    <div className="flex flex-col items-center gap-1 shrink-0 w-14">
      <img
        src={url}
        alt={name}
        title={role ? `${name} — ${role}` : name}
        className="w-12 h-12 rounded-full object-cover border-2 border-[#dec48e] shadow-[0_2px_8px_rgba(176,136,48,0.25)]"
      />
      <span className="font-sans text-[9px] font-semibold uppercase tracking-wide text-[#6c665e] truncate w-full text-center">
        {name}
      </span>
    </div>
  )
}

interface ChronicleProps {
  title: string
  player: Player
  combat?: CombatState
  log: LogEntry[]
  lastAcknowledgedChapter?: number
  onAcknowledgeChapterStory?: (chapterNumber: number) => void
  seedDebug?: Campaign['seedDebug']
  busy: boolean
  error: string | null
  chromeOpacity: number
  npcs: Record<string, NpcEntry>
  locations: Record<string, LocationEntry>
  regions?: Record<string, RegionEntry>
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
  onOpenRetryEditor?: (originalAction: string) => Promise<string | null>
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

// Narrative-First Overhaul — replaces the old numeric HP/MP/ST PoolBar
// entirely. There's no pool to fill a bar with anymore; a coarse condition-
// derived status word (Fine -> Hurt -> Bloodied -> Critical, per the design
// brief's HUD default) stands in for "how bad is it right now" at a glance,
// with the actual active Condition Tags listed alongside/on hover for detail.
// A full visual-polish pass (pips, a proper banner) is later UI work — this
// keeps the HUD honest about the new data shape without redesigning it.
function vitalsStatus(count: number): string {
  if (count === 0) return 'Fine'
  if (count === 1) return 'Hurt'
  if (count === 2) return 'Bloodied'
  return 'Critical'
}

function ConditionBadge({
  icon: Icon,
  label,
  conditions,
  colorVar,
}: {
  icon: LucideIcon
  label: string
  conditions: { label: string }[] | undefined
  colorVar: string
}) {
  const list = conditions ?? []
  const tags = list.map((c) => c.label).join(', ')
  return (
    <div className="flex items-center gap-1.5 flex-1 min-w-0" title={tags ? `${label}: ${tags}` : `${label}: no active conditions`}>
      <div className="flex items-center gap-1 shrink-0 max-w-[150px] sm:max-w-none">
        <Icon size={12} style={{ color: colorVar }} className="shrink-0" />
        <span className="font-mono text-[10px] font-bold uppercase tracking-wider truncate" style={{ color: colorVar }}>
          {label}
        </span>
      </div>
      <span className="shrink-0 font-mono text-[10px] font-semibold truncate" style={{ color: colorVar }}>
        {vitalsStatus(list.length)}
        {tags ? ` — ${tags}` : ''}
      </span>
    </div>
  )
}

function CurrencyBadge({ copper }: { copper: number }) {
  const { p, g, s, c } = formatCurrency(copper)
  return (
    <div className="flex items-center gap-1.5 shrink-0 font-mono text-[10px] font-semibold bg-[#f5f0e6] border border-[#ede7dd] px-2 py-0.5 rounded-full">
      <Coins size={12} className="text-[#b08830] shrink-0" />
      <div className="flex items-center gap-1">
        {p > 0 && <span className="text-[#2c2825]">{p}<span className="text-[#6c665e] text-[9px] font-normal">P</span></span>}
        {g > 0 && <span className="text-[#84631f]">{g}<span className="text-[#8d6b1d] text-[9px] font-normal">G</span></span>}
        {(s > 0 || (p === 0 && g === 0)) && <span className="text-[#52525b]">{s}<span className="text-[#9e968b] text-[9px] font-normal">S</span></span>}
        {(c > 0 || (p === 0 && g === 0 && s === 0)) && <span className="text-[#a15c2f]">{c}<span className="text-[#8a4c26] text-[9px] font-normal">C</span></span>}
      </div>
    </div>
  )
}

function DesktopLeftSidebar({
  player,
  items,
  combat,
  locationName,
  areaName,
}: {
  player: Player
  items?: Record<string, ItemEntry>
  combat?: CombatState
  locationName?: string
  areaName?: string
}) {
  const equippedWeapon = player.equipped?.weapon ? items?.[player.equipped.weapon] : null
  const equippedOffhand = player.equipped?.offhand ? items?.[player.equipped.offhand] : null
  const equippedArmor = player.equipped?.armor ? items?.[player.equipped.armor] : null
  const equippedAccessory = player.equipped?.accessory ? items?.[player.equipped.accessory] : null

  return (
    <aside className="hidden lg:flex lg:w-80 xl:w-96 shrink-0 flex-col gap-4 overflow-y-auto p-4 bg-[#f5f0e6] border-r border-[#ede7dd] text-[#1a1917] z-10 h-full">
      {/* 1. Character Overview */}
      <div className="bg-white border border-[#ede7dd] rounded-xl p-4 shadow-sm relative overflow-hidden">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-12 h-12 rounded-xl bg-[#ebdcb8]/50 border border-[#dec48e] flex items-center justify-center text-[#8d6b1d] shadow-inner font-serif text-lg font-bold shrink-0">
            {player.name ? player.name.charAt(0).toUpperCase() : 'P'}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="font-serif text-lg font-bold text-[#1a1917] leading-tight truncate">{player.name || 'Hero'}</h2>
            <div className="flex items-center gap-2 mt-1">
              <span className="font-display text-xs font-semibold text-[#8d6b1d] bg-[#ebdcb8]/40 px-2 py-0.5 rounded-md border border-[#dec48e] shrink-0">
                Lvl {player.level}
              </span>
              <span className="font-serif text-xs text-[#6c665e] truncate">{player.className || 'Adventurer'}</span>
            </div>
          </div>
        </div>

        {/* Attrs Grid */}
        <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-[#ede7dd]">
          <div className="bg-[#f5f0e6] border border-[#ede7dd] p-2 rounded-lg text-center">
            <span className="block font-mono text-[10px] text-[#9e968b] font-bold uppercase">STR</span>
            <span className="font-mono text-sm font-bold text-[#1a1917]">{player.attrs?.STR ?? 10}</span>
          </div>
          <div className="bg-[#f5f0e6] border border-[#ede7dd] p-2 rounded-lg text-center">
            <span className="block font-mono text-[10px] text-[#9e968b] font-bold uppercase">INT</span>
            <span className="font-mono text-sm font-bold text-[#1a1917]">{player.attrs?.INT ?? 10}</span>
          </div>
          <div className="bg-[#f5f0e6] border border-[#ede7dd] p-2 rounded-lg text-center">
            <span className="block font-mono text-[10px] text-[#9e968b] font-bold uppercase">AGI</span>
            <span className="font-mono text-sm font-bold text-[#1a1917]">{player.attrs?.AGI ?? 10}</span>
          </div>
        </div>
      </div>

      {/* 2. Stats & Pools HUD */}
      <div className="bg-white border border-[#ede7dd] rounded-xl p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between border-b border-[#ede7dd] pb-2">
          <h3 className="font-serif text-xs font-bold text-[#8d6b1d] tracking-wider uppercase">
            Vitals & Wealth
          </h3>
          <CurrencyBadge copper={player.copper} />
        </div>
        <div className="space-y-2.5">
          <ConditionBadge icon={Heart} label="Vitals" conditions={player.conditions} colorVar="#b71c1c" />
        </div>
        {(player.locDisp || locationName) && (
          <div className="pt-2 border-t border-[#ede7dd] flex items-center gap-2 text-xs text-[#6c665e] font-serif">
            <MapIcon size={14} className="text-[#8d6b1d] shrink-0" />
            <span className="truncate">
              {player.locDisp || locationName}
              {areaName && <span className="text-[#9e968b]"> — {areaName}</span>}
            </span>
            {player.time && (
              <span className="ml-auto font-mono text-[11px] text-[#9e968b] shrink-0">
                D{player.time.d} {player.time.h}
              </span>
            )}
          </div>
        )}
      </div>

      {/* 3. Equip Slots */}
      <div className="bg-white border border-[#ede7dd] rounded-xl p-4 shadow-sm space-y-2.5">
        <h3 className="font-serif text-xs font-bold text-[#8d6b1d] tracking-wider uppercase border-b border-[#ede7dd] pb-2">
          Equipped Gear
        </h3>
        {/* Weapon Slot */}
        <div className="flex items-center gap-3 p-2 rounded-lg bg-[#f5f0e6] border border-[#ede7dd]">
          <div className="w-8 h-8 rounded-md bg-white border border-[#dec48e]/60 flex items-center justify-center text-[#8d6b1d] shrink-0">
            <Swords size={16} />
          </div>
          <div className="min-w-0 flex-1">
            <span className="block font-mono text-[9px] uppercase tracking-wider text-[#9e968b]">Weapon</span>
            <span className="font-serif text-xs font-medium text-[#1a1917] truncate block">
              {equippedWeapon ? equippedWeapon.name : player.equipped?.weapon || 'Empty Hand'}
            </span>
          </div>
        </div>

        {/* Off-Hand Slot — the second weapon-type slot (dual-wielding, or a weapon paired with a shield) */}
        <div className="flex items-center gap-3 p-2 rounded-lg bg-[#f5f0e6] border border-[#ede7dd]">
          <div className="w-8 h-8 rounded-md bg-white border border-[#dec48e]/60 flex items-center justify-center text-[#8d6b1d] shrink-0">
            <Shield size={16} />
          </div>
          <div className="min-w-0 flex-1">
            <span className="block font-mono text-[9px] uppercase tracking-wider text-[#9e968b]">Off-Hand</span>
            <span className="font-serif text-xs font-medium text-[#1a1917] truncate block">
              {equippedOffhand ? equippedOffhand.name : player.equipped?.offhand || 'Empty Hand'}
            </span>
          </div>
        </div>

        {/* Armor Slot */}
        <div className="flex items-center gap-3 p-2 rounded-lg bg-[#f5f0e6] border border-[#ede7dd]">
          <div className="w-8 h-8 rounded-md bg-white border border-[#dec48e]/60 flex items-center justify-center text-[#8d6b1d] shrink-0">
            <ShieldCheck size={16} />
          </div>
          <div className="min-w-0 flex-1">
            <span className="block font-mono text-[9px] uppercase tracking-wider text-[#9e968b]">Armor</span>
            <span className="font-serif text-xs font-medium text-[#1a1917] truncate block">
              {equippedArmor ? equippedArmor.name : player.equipped?.armor || 'No Armor'}
            </span>
          </div>
        </div>

        {/* Accessory Slot */}
        <div className="flex items-center gap-3 p-2 rounded-lg bg-[#f5f0e6] border border-[#ede7dd]">
          <div className="w-8 h-8 rounded-md bg-white border border-[#dec48e]/60 flex items-center justify-center text-[#8d6b1d] shrink-0">
            <Sparkles size={16} />
          </div>
          <div className="min-w-0 flex-1">
            <span className="block font-mono text-[9px] uppercase tracking-wider text-[#9e968b]">Accessory</span>
            <span className="font-serif text-xs font-medium text-[#1a1917] truncate block">
              {equippedAccessory ? equippedAccessory.name : player.equipped?.accessory || 'None'}
            </span>
          </div>
        </div>
      </div>

      {/* 4. Active Tactical Combat */}
      {combat?.active && (
        <div className="bg-[#fdecec] border border-[#b71c1c]/30 rounded-xl p-4 shadow-sm space-y-2 mt-auto">
          <div className="flex items-center justify-between text-[#b71c1c] font-serif text-xs font-bold uppercase tracking-wider">
            <span className="flex items-center gap-1.5">
              <Swords size={14} className="text-[#b71c1c]" /> Tactical Encounter
            </span>
          </div>
          <p className="font-serif text-sm font-bold text-[#1a1917] truncate">
            {combat.enemyName?.toUpperCase() ?? 'HOSTILE'}
          </p>
          <ConditionBadge icon={Heart} label="Enemy" conditions={combat.enemyConditions} colorVar="#b71c1c" />
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

// §2 Phase E Chapter Milestone, incremental redesign — a beat's timestamp in
// the vertical timeline, distinct from formatTimestamp above (no location,
// and phrased for a standalone reader rather than a live HUD line).
function formatChapterBeatTime(time: GameTime): string {
  return `Day ${time.d} · ${time.h}`
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
  isChapterOpener?: boolean
  onEditLastTurn?: (newNar: string) => void
  onRemoveLastTurn?: () => void
  editLongText?: (label: string, value: string, hint?: string, placeholder?: string) => Promise<string | null>
  onOpenRetryEditor?: (originalAction: string) => Promise<string | null>
  confirmAction?: (message: string) => Promise<boolean>
  setInput?: (val: string) => void
  onSend?: (action: string, forcePause?: boolean) => void
  items?: Record<string, ItemEntry>
  locations?: Record<string, LocationEntry>
}

// Debugging tool — every real narrated turn's request/response/finishReason
// since turn 0, for reporting a pattern across a whole session rather than
// one turn at a time (DebugPayloadButton below covers the single-turn case).
// Synthetic entries (bang/chapter-recap/class-evolution) carry no
// `rawPayload` and are skipped — there's no API call to show.
function buildSessionPayloadText(log: LogEntry[], title: string, seedDebug?: Campaign['seedDebug']): string {
  const withPayload = log
    .map((entry, index) => ({ entry, index }))
    .filter(({ entry }) => entry.rawPayload)

  const header = [
    '# Tale Dives — Session Payload',
    `# Tale: ${title}`,
    `# Total log entries: ${log.length}, narrated turns with a recorded payload: ${withPayload.length}`,
    '',
  ].join('\n')

  // World Seeding isn't a turn (no history, no log entry) — its own
  // request/response is kept on campaign.seedDebug and shown here so a
  // "why didn't X get seeded" question is answerable without leaving the app.
  const seedSection = seedDebug
    ? [
        '='.repeat(80),
        'World Seeding (one-time call, before Turn 0)',
        '-'.repeat(80),
        '### PROMPT',
        seedDebug.prompt,
        '',
        seedDebug.error ? `### ERROR\n${seedDebug.error}` : `### RESPONSE (raw model output)\n${seedDebug.response ?? '(not recorded)'}`,
      ].join('\n')
    : null

  const turns = withPayload.map(({ entry, index }) => {
    const when = [entry.time ? `${entry.time.d}d ${entry.time.h}` : null, entry.locDisp].filter(Boolean).join(' @ ')
    return [
      '='.repeat(80),
      `Turn #${index}${entry.turnRef ? ` [${entry.turnRef}]` : ''}${when ? ` — ${when}` : ''}`,
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

  return [header, ...(seedSection ? [seedSection] : []), ...turns, '='.repeat(80)].join('\n\n')
}

// The "whole session" counterpart to DebugPayloadButton below — pinned to
// the top of the screen (inside the fixed header, so the ResizeObserver
// that already measures header height picks up the extra space and the
// parchment reflows underneath it automatically) rather than living inline
// in the scrolling log, since this covers every turn at once, not one.
// Only ever rendered when Debug Mode is on (see Chronicle's own render).
function SessionPayloadPanel({ log, title, seedDebug }: { log: LogEntry[]; title: string; seedDebug?: Campaign['seedDebug'] }) {
  const [copied, setCopied] = useState(false)
  const text = useMemo(() => buildSessionPayloadText(log, title, seedDebug), [log, title, seedDebug])

  function handleCopy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="px-3 pb-2">
      <div className="rounded-lg border border-rose/30 bg-[#f5f0e6] overflow-hidden">
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
// Just the <sync> block — the part of a turn's raw response that actually
// touched the Codex (npc_mem_up/quest_update/fac_rep/inv_add/etc.) — pulled
// out separately from the full request+response so it can be copied on its
// own, e.g. to cross-check against what actually landed in the Codex without
// wading through the narrative prose alongside it.
function extractSyncBlock(raw: string): string | null {
  return raw.match(/<sync>[\s\S]*?<\/sync>/)?.[0] ?? null
}

function DebugPayloadButton({ entry }: { entry: LogEntry }) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const [syncCopied, setSyncCopied] = useState(false)
  if (!entry.rawPayload) return null

  // MAX_TOKENS on a real narrated turn means the model got cut off
  // mid-response — flagged right on the collapsed toggle, not just buried
  // inside the expanded payload, since that's the one finishReason value
  // that means "this turn is visibly broken," not just "here's some info."
  const truncated = entry.finishReason === 'MAX_TOKENS'
  const payloadText = `### REQUEST (context sent)\n${entry.requestPayload ?? '(not recorded)'}\n\n### RESPONSE (raw model output)\n${entry.rawPayload}\n\n### finishReason: ${entry.finishReason ?? '(not recorded)'}`
  const syncBlock = extractSyncBlock(entry.rawPayload)

  function handleCopy() {
    navigator.clipboard.writeText(payloadText).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  function handleCopySync() {
    if (!syncBlock) return
    navigator.clipboard.writeText(syncBlock).then(() => {
      setSyncCopied(true)
      setTimeout(() => setSyncCopied(false), 2000)
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
        {entry.turnRef ? ` (${entry.turnRef})` : ''}
        {truncated && !open && ' — cut off (MAX_TOKENS)'}
      </button>
      {open && (
        <div className="mt-1.5 rounded-lg border border-ink-muted/25 bg-black/[0.04] overflow-hidden">
          <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-ink-muted/20">
            <span className={`text-[10px] font-mono uppercase tracking-wide ${truncated ? 'text-rose' : 'text-ink-muted'}`}>
              Debug Payload{entry.turnRef ? ` · ${entry.turnRef}` : ''}{entry.finishReason ? ` · ${entry.finishReason}` : ''}
            </span>
            <div className="flex items-center gap-2.5">
              {syncBlock && (
                <button
                  onClick={handleCopySync}
                  title="Copy just the <sync> block — the Codex-affecting part of this turn"
                  className="inline-flex items-center gap-1 text-[10px] font-mono text-ink-muted hover:text-ink"
                >
                  {syncCopied ? (
                    <>
                      <Check size={11} className="text-emerald" /> Copied
                    </>
                  ) : (
                    <>
                      <Copy size={11} /> Codex Changes
                    </>
                  )}
                </button>
              )}
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

// §Editorial Vellum "End of Turn Recap" — a collapsed-by-default accordion
// folding every mechanical delta a turn produced (Codex reveals, Narrative
// Events, crafting, minion losses, level-ups, class evolutions) behind one
// toggle, so the reading surface stays tidy but the detail is still one tap
// away. Deliberately NOT the reference mockup's fixed 2-column grid of
// always-shown categories (Narrative State / Companion Bond / Dragon
// Attunement / Codex Catalogued) — those are fixed slots that would have to
// be padded with filler on a turn that didn't actually produce four kinds of
// news. This is a single-column dossier list instead: one row per kind of
// delta, built only from what this turn's own LogEntry actually carries, so
// it's never longer or emptier than the truth. Returns null (no divider, no
// empty affordance) when a turn produced nothing worth recapping.
interface RecapRow {
  icon: LucideIcon
  label: string
  content: ReactNode
}

function buildRecapRows(entry: LogEntry, onTapTerm: TapTermHandler): RecapRow[] {
  const rows: RecapRow[] = []
  if (entry.levelUp) {
    rows.push({ icon: Star, label: 'Level Up', content: `Level ${entry.levelUp}` })
  }
  if (entry.classEvolution) {
    rows.push({ icon: Repeat, label: 'Class Evolution', content: `Now a ${entry.classEvolution.className}` })
  }
  if (entry.discoveries?.length) {
    rows.push({
      icon: Unlock,
      label: `Codex Updated${entry.discoveries.length > 1 ? ` (${entry.discoveries.length})` : ''}`,
      content: (
        <div className="flex flex-wrap gap-x-2.5 gap-y-1">
          {entry.discoveries.map((d) => (
            <button
              key={`${d.category}_${d.id}`}
              onClick={() => onTapTerm(d.name, d.category)}
              className="underline decoration-dotted decoration-[#b08830]/50 hover:text-[#8d6b1d] cursor-pointer"
            >
              {d.name}
            </button>
          ))}
        </div>
      ),
    })
  }
  if (entry.eventsActivated?.length) {
    rows.push({
      icon: Sparkles,
      label: `Narrative Event${entry.eventsActivated.length > 1 ? 's' : ''}`,
      content: entry.eventsActivated.join(', '),
    })
  }
  if (entry.craftReady?.length) {
    rows.push({
      icon: Hammer,
      label: `Crafting Ready${entry.craftReady.length > 1 ? ` (${entry.craftReady.length})` : ''}`,
      content: entry.craftReady.map((c) => `${c.recipeName}${c.outputQty > 1 ? ` ×${c.outputQty}` : ''}`).join(', '),
    })
  }
  if (entry.minionsDissipated?.length) {
    rows.push({
      icon: Ghost,
      label: `Minion${entry.minionsDissipated.length > 1 ? 's' : ''} Lost`,
      content: `${entry.minionsDissipated.join(', ')} — unpaid upkeep`,
    })
  }
  return rows
}

function TurnRecapAccordion({
  entry,
  turnRefMatch,
  onTapTerm,
}: {
  entry: LogEntry
  turnRefMatch: RegExpExecArray | null
  onTapTerm: TapTermHandler
}) {
  const [open, setOpen] = useState(false)
  const rows = useMemo(() => buildRecapRows(entry, onTapTerm), [entry, onTapTerm])
  if (rows.length === 0) return null

  const turnLabel = turnRefMatch ? `Turn ${turnRefMatch[2]}` : 'This Turn'

  return (
    <div className="w-full flex flex-col items-center gap-2 pt-1">
      <div className="w-full flex items-center gap-3">
        <div className="flex-1 h-px bg-[#ede7dd]" />
        <button
          onClick={() => setOpen((v) => !v)}
          className="px-3 py-1 rounded-full bg-[#f5f0e6] hover:bg-[#ebdcb8]/40 border border-[#ede7dd] text-[#6c665e] hover:text-[#1a1917] flex items-center gap-1.5 font-sans text-[10px] uppercase tracking-widest font-semibold transition-colors cursor-pointer"
        >
          <span>End of {turnLabel} · Recap</span>
          {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>
        <div className="flex-1 h-px bg-[#ede7dd]" />
      </div>
      {open && (
        <div className="w-full bg-[#fbf8f3] border border-[#ede7dd] rounded-xl divide-y divide-[#ede7dd] overflow-hidden">
          {rows.map((row, i) => (
            <div key={i} className="flex items-start gap-3 px-3 py-2">
              <row.icon size={13} className="text-[#b08830] shrink-0 mt-0.5" />
              <div className="flex flex-col gap-0.5 min-w-0">
                <span className="font-sans text-[9px] uppercase tracking-wider text-[#9e968b] font-semibold">{row.label}</span>
                <span className="font-narrative text-[13px] text-[#2c2825] leading-snug">{row.content}</span>
              </div>
            </div>
          ))}
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
  isChapterOpener,
  onEditLastTurn,
  onRemoveLastTurn,
  editLongText,
  onOpenRetryEditor,
  confirmAction,
  setInput,
  onSend,
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
          <div className="flex-1 h-px bg-[#dec48e]" />
          <span className="flex items-center gap-1.5 font-display text-[10px] uppercase tracking-wide text-[#8d6b1d]/80 shrink-0">
            <Pause size={11} /> Roleplay Paused
          </span>
          <div className="flex-1 h-px bg-[#dec48e]" />
        </div>

        <div className="rounded-xl border border-[#dec48e] bg-white px-3 py-2.5 shadow-sm">
          <div className="flex items-center gap-1.5 mb-2">
            <DossierIcon size={13} className="text-[#8d6b1d] shrink-0" />
            <span className="font-display text-xs font-bold uppercase tracking-wide text-[#8d6b1d]">
              {label}
              {target && <span className="text-[#6c665e] normal-case font-normal"> — {target}</span>}
            </span>
          </div>
          {rows.length > 0 && (
            <div className="space-y-1">
              {rows.map((row, i) => (
                <div key={row.id ?? i} className="flex items-baseline gap-2 text-xs">
                  {row.category ? (
                    <button
                      onClick={() => onTapTerm(row.name, row.category!)}
                      className="font-display font-semibold text-[#1a1917] hover:text-[#8d6b1d] shrink-0 underline decoration-dotted decoration-[#b08830]/40 underline-offset-2"
                    >
                      {row.name}
                    </button>
                  ) : (
                    <span className="font-display font-semibold text-[#1a1917] shrink-0">{row.name}</span>
                  )}
                  <span className="text-[#6c665e] truncate">{row.fields.join(' · ')}</span>
                </div>
              ))}
            </div>
          )}
          {note && <p className="font-narrative italic text-[11px] text-[#6c665e] mt-1.5">{note}</p>}
        </div>

        <div className="w-full h-px bg-[#dec48e]" />
      </div>
    )
  }

  if (entry.chapterSummary || entry.chapterBeats) {
    return (
      <div ref={setRef} className="my-4 p-4 sm:p-5 rounded-2xl bg-[#fbf8f3] border border-[#dec48e] shadow-sm relative overflow-hidden flex flex-col items-center gap-3">
        <div className="w-full flex items-center gap-3">
          <div className="flex-1 h-px bg-[#dec48e]" />
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-[#ebdcb8]/40 border border-[#dec48e] text-[#8d6b1d] font-display font-bold text-xs uppercase tracking-wider shrink-0">
            <BookOpen size={13} className="text-[#b08830]" />
            <span>Chapter {entry.chapterNumber} Milestone</span>
          </div>
          <div className="flex-1 h-px bg-[#dec48e]" />
        </div>
        {entry.chapterBeats?.length ? (
          <div className="w-full max-w-xl flex flex-col gap-2.5 pl-1">
            {entry.chapterBeats.map((b, i) => (
              <div key={i} className="flex gap-3">
                <div className="flex flex-col items-center shrink-0 pt-0.5">
                  <div className="w-2 h-2 rounded-full bg-[#b08830]" />
                  {i < entry.chapterBeats!.length - 1 && <div className="w-px flex-1 bg-[#dec48e] mt-1" />}
                </div>
                <div className="pb-1 min-w-0">
                  <p className="font-mono text-[10px] uppercase tracking-wide text-[#8d6b1d]/70">{formatChapterBeatTime(b.time)}</p>
                  <p className="font-narrative text-xs sm:text-sm text-[#2c2825] leading-relaxed">{b.text}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="font-narrative italic text-xs sm:text-sm text-[#2c2825] text-center leading-relaxed max-w-xl">
            "{entry.chapterSummary}"
          </p>
        )}
        {entry.chapterNarrative && (
          <div className="w-full max-w-xl border-t border-[#dec48e]/60 pt-3 flex flex-col gap-2">
            {entry.chapterNarrative.split('\n\n').map((para, i) => (
              <p key={i} className="font-narrative italic text-xs sm:text-sm text-[#6c665e] leading-relaxed">
                {para}
              </p>
            ))}
          </div>
        )}
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

  const renderedNarrative = useMemo(
    () => renderNarrative(entry.nar, onTapTerm, items, locations),
    [entry.nar, onTapTerm, items, locations]
  )

  // §Editorial Vellum eyebrow — "Turn {block} · Chapter {chapter}", parsed
  // from the same turnRef every entry already carries ("C{chapter}-{block}",
  // see LogEntry.turnRef), so this is real data rather than fabricated
  // per-turn framing. Falls back to the plain D-xx/location timestamp for an
  // entry logged before turnRef existed.
  const turnRefMatch = entry.turnRef ? /^C(\d+)-(\d+)$/.exec(entry.turnRef) : null

  return (
    <div ref={setRef} className="space-y-2">
      {(turnRefMatch || (entry.time && entry.locDisp)) && (
        <div className="flex items-center justify-between gap-3 border-b border-[#ede7dd] pb-1.5">
          {turnRefMatch ? (
            <span className="font-sans text-[10px] tracking-[0.14em] uppercase text-[#9e968b]">
              Turn {turnRefMatch[2]} &nbsp;·&nbsp; Chapter {turnRefMatch[1]}
            </span>
          ) : (
            <span className="font-mono text-[10px] font-semibold uppercase tracking-wide text-[#8d6b1d]">
              {entry.time && entry.locDisp ? formatTimestamp(entry.time, entry.locDisp) : ''}
            </span>
          )}
          {entry.locDisp && (
            <span className="font-mono text-[10px] text-[#8d6b1d] shrink-0 truncate max-w-[45%] text-right">
              {entry.locDisp}
            </span>
          )}
        </div>
      )}
      {/* The player's own typed action — still the same narrative serif and
          italic treatment as everything else on the page (dropped the old
          font-mono "> " console-prompt prefix, which read like a terminal
          echo rather than part of the story), now given its own soft card
          so it reads as a distinct voice from the narration beneath it
          instead of blending straight into the timestamp above it — and no
          longer forced onto the same line as the turn-state badge, which
          used to wrap awkwardly against a short action. */}
      {entry.action && (
        <div className="flex items-start gap-1.5 rounded-lg bg-[#f5f0e6] border border-[#ede7dd] px-2.5 py-1.5">
          <Feather size={12} className="text-[#b08830] shrink-0 mt-0.5" />
          <p className="font-narrative italic text-sm text-[#6c665e] leading-snug text-left whitespace-pre-wrap">{entry.action}</p>
        </div>
      )}
      {((StateIcon && stateMeta) || entry.mood) && (
        <div className="flex items-center gap-3 flex-wrap">
          {StateIcon && stateMeta && (
            <span className="inline-flex items-center gap-1 text-[10px] font-display" style={{ color: stateMeta.accent }}>
              <StateIcon size={11} /> {stateMeta.label}
            </span>
          )}
          {entry.mood && (
            <span className="inline-flex items-center gap-1 text-[11px] italic text-[#8a8378]">
              <Sparkle size={10} /> {entry.mood}
            </span>
          )}
        </div>
      )}
      <div
        className={`font-narrative text-[15.5px] sm:text-[16.5px] text-[#2c2825] leading-[1.85] whitespace-pre-wrap text-left ${isChapterOpener ? 'editorial-drop-cap' : ''}`}
      >
        {renderedNarrative}
      </div>
      {entry.ending && (
        <div className="flex flex-col items-center gap-2 py-2">
          <div className="w-full flex items-center gap-3">
            <div className="flex-1 h-px bg-[#dec48e]" />
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#ebdcb8]/40 border border-[#dec48e] px-3 py-1 font-display text-xs uppercase tracking-wide text-[#8d6b1d] shrink-0">
              <Flag size={12} /> The Tale Concludes — {ENDING_LABELS[entry.ending]}
            </span>
            <div className="flex-1 h-px bg-[#dec48e]" />
          </div>
        </div>
      )}
      <TurnRecapAccordion entry={entry} turnRefMatch={turnRefMatch} onTapTerm={onTapTerm} />
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
            // A big, keyboard-safe popup (useRetryEditor) rather than
            // re-seeding the cramped bottom input bar — the mobile soft
            // keyboard covers most of that bar, making a long action (Turn
            // 0's Prologue prompt especially) unreadable while editing.
            // Nothing is removed until the player actually confirms a
            // revised action in the popup; cancelling it aborts the whole
            // retry, same as never having opened it.
            if (onOpenRetryEditor && onSend) {
              const ok = await confirmAction('Retry this turn? It — and anything since, like a bang command lookup — will be removed once you confirm your revised action.')
              if (!ok) return
              const revised = await onOpenRetryEditor(entry.action ?? '')
              if (revised === null) return
              onRemoveLastTurn()
              onSend(revised)
              return
            }
            // Fallback (older callers not yet wired to the popup): re-seed the input bar as before.
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
          Request Failed
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
  lastAcknowledgedChapter,
  onAcknowledgeChapterStory,
  seedDebug,
  busy,
  error,
  chromeOpacity: _chromeOpacity,
  npcs,
  locations,
  regions = {},
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
  onOpenRetryEditor,
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
  // §7 Tap-to-inspect lightbox — a full-screen enlarged view for the hero
  // location plate and any Codex-popup entity image. Pure display, no pan/
  // zoom gesture; just a bigger look at art that's otherwise cropped small.
  const [lightbox, setLightbox] = useState<{ url: string; caption: string } | null>(null)
  // §2 Phase E Chapter Milestone — a one-time "Story So Far" welcome-back
  // memo, shown when this screen is freshly entered (mount) and the most
  // recently closed chapter is newer than what's already been acknowledged.
  // A chapter closing while the player is already IN this screen never
  // triggers it (no dependency on `log` — checked once, on mount, matching
  // "the next time the player enters and continues," not live play).
  const [storySoFar, setStorySoFar] = useState<LogEntry | null>(null)

  useEffect(() => {
    const closedChapters = log.filter((e) => e.chapterBeats?.length || e.chapterSummary)
    const latest = closedChapters[closedChapters.length - 1]
    if (latest?.chapterNumber !== undefined && latest.chapterNumber > (lastAcknowledgedChapter ?? 0)) {
      setStorySoFar(latest)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const lastLogEntry = useMemo(() => log[log.length - 1], [log])

  // §7 Image Generation — the current location's own art becomes the
  // parchment's background when one exists; absent/still-loading falls
  // back to the existing flat parchment texture untouched (see the
  // container's className below), never an error state.
  const currentLocationImageUrl = useEntityImage(locations[player.locId]?.imageKey)
  // Present-NPC portrait rail — same "0 tokens, purely a display nicety"
  // spirit as everything else keyed off presentNpcs; an NPC with no
  // generated portrait yet simply doesn't render a chip (NpcPortraitChip
  // returns null), so the rail never shows an empty placeholder frame.
  const presentNpcList = useMemo(() => presentNpcs(npcs, player.locId), [npcs, player.locId])

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

  // §6.0 — the chrome (header/frame/input/motes) uses a fixed ochre accent; it
  // no longer retints per turn state. Per-entry turn-state badges in the log
  // (TurnBlock, below) are unrelated and keep their own per-entry coloring.
  const stateAccent = '#b08830'

  // Non-chapter-summary entries only — those are what the navigator steps between.
  const narratedIndices = log.reduce<number[]>((acc, e, i) => {
    if (!e.chapterSummary) acc.push(i)
    return acc
  }, [])
  const navPosition = narratedIndices.length
    ? narratedIndices.indexOf(currentBlock ?? narratedIndices[narratedIndices.length - 1]) + 1
    : 0

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

  // A freshly-generated turn used to jump the view to the very bottom of the
  // page — landing on the END of the narration the player hasn't read yet,
  // forcing them to scroll back up to actually start reading it. Landing on
  // the new block's own top edge instead (same offset math scrollToBlock
  // already uses for the block navigator) means the player opens on its
  // first line, exactly where reading should start.
  useEffect(() => {
    if (currentBlock === null && log.length > 0) {
      const el = blockRefs.current.get(log.length - 1)
      if (el) scrollBlockIntoView(el)
    }
  }, [log, currentBlock, scrollBlockIntoView])

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
    // §6.6 !conclude — unlike every other bang command, this one costs a
    // real API call (it asks the model to narrate the Tale's own ending),
    // so it's intercepted before the 0-token bang branch below and routed
    // through the normal onSend turn pipeline instead.
    if (text.toLowerCase() === '!conclude') {
      onSend('!conclude') // canonical casing — the exact trigger both App.tsx and the model's own rule (turnContract.ts 2d) match against
    } else if (text.startsWith('!')) {
      // §6.6 Bang Commands — resolved entirely client-side (0 API tokens), so
      // they bypass the busy-gated turn pipeline and never touch onSend.
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
      const dict = { npc: npcs, loc: locations, faction: factions, lore, quest: quests, beast: bestiary, skill: skills, item: items }[category]
      if (dict) {
        const bareId = slugify(term)
        if (dict[bareId]) {
          setPopup({ category, id: bareId })
          return
        }
        const needle = term.trim().toLowerCase()
        const match = Object.entries(dict).find(([, entry]) => entry.name.trim().toLowerCase() === needle)
        if (match) {
          setPopup({ category, id: match[0] })
          return
        }
      }

      if (category === 'loc' && regions) {
        const bareId = slugify(term)
        if (regions[bareId]) {
          setPopup({ category: 'loc', id: bareId })
          return
        }
        const needle = term.trim().toLowerCase()
        const matchRegion = Object.entries(regions).find(([, entry]) => entry.name.trim().toLowerCase() === needle)
        if (matchRegion) {
          setPopup({ category: 'loc', id: matchRegion[0] })
          return
        }
      }

      // A location's own named sub-area (e.g. "The Mess Hall" inside "Riders
      // Quadrant") lives nested in that location's own `areas` array, not as
      // a top-level Location/Region entry — the lookups above never find it,
      // so a {{Term|loc}} tag naming one used to silently do nothing. Areas
      // have no Codex card of their own (deliberately thin, no popup
      // rendering path), so the closest useful thing to show is the parent
      // location that actually contains it.
      if (category === 'loc' && locations) {
        const needle = term.trim().toLowerCase()
        const parent = Object.entries(locations).find(([, entry]) =>
          entry.areas?.some((a) => a.name.trim().toLowerCase() === needle || a.id === slugify(term)),
        )
        if (parent) {
          setPopup({ category: 'loc', id: parent[0] })
          return
        }
      }
    },
    [npcs, locations, regions, factions, lore, quests, bestiary, skills, items],
  )

  const popupEntry = useMemo(() => {
    if (!popup) return undefined
    const baseDict = { npc: npcs, loc: locations, faction: factions, lore, quest: quests, beast: bestiary, skill: skills, item: items }[popup.category]
    const entry = baseDict?.[popup.id]
    if (popup.category === 'loc' && regions) {
      const locEntry = entry as LocationEntry | undefined
      if (!locEntry || locEntry.autoLogged || locEntry.description === '(Auto-logged — visit again or add detail manually.)' || !locEntry.description) {
        if (regions[popup.id]) return regions[popup.id] as unknown as LocationEntry
        const matchReg = Object.values(regions).find((r) => r.name.trim().toLowerCase() === popup.id.replace(/_/g, ' ').toLowerCase())
        if (matchReg) return matchReg as unknown as LocationEntry
      }
    }
    return entry as
      | NpcEntry
      | LocationEntry
      | FactionEntry
      | LoreEntry
      | QuestEntry
      | BestiaryEntry
      | SkillEntry
      | ItemEntry
      | undefined
  }, [popup, npcs, locations, regions, factions, lore, quests, bestiary, skills, items])

  const popupImageKey = useMemo<string | undefined>(() => {
    if (!popupEntry) return undefined
    const entry = (popupEntry as unknown) as Record<string, unknown>
    if (typeof entry.portraitKey === 'string' && entry.portraitKey) return entry.portraitKey
    if (typeof entry.imageKey === 'string' && entry.imageKey) return entry.imageKey
    if (typeof entry.mapImageKey === 'string' && entry.mapImageKey) return entry.mapImageKey
    return undefined
  }, [popupEntry])

  const popupImageUrl = useEntityImage(popupImageKey)

  return (
    <div className="parchment-surface fixed inset-0 overflow-hidden text-[#1a1917] bg-[#fbf8f3] flex flex-col lg:flex-row">
      {/* PC Left Sidebar (Character Info, Equipment Slots, Stats HUD, Tactical Combat) —
          a Bento-style column of distinct light cards. The reference mockup is
          mobile-only; this is how the same editorial vellum language extends
          to a wider desktop viewport instead of just stretching the reading
          column, keeping every stat/equipment panel it already carried. */}
      <DesktopLeftSidebar
        player={player}
        items={items}
        combat={combat}
        locationName={locations[player.locId]?.name || player.locDisp || 'Unknown'}
        areaName={player.areaId ? locations[player.locId]?.areas?.find((a) => a.id === player.areaId)?.name : undefined}
      />

      {/* Main Story Container */}
      <div className="flex-1 flex flex-col h-full relative overflow-hidden">
        {/* Mobile/Tablet Header Bar */}
        <header
          ref={headerRef}
          className="absolute top-0 inset-x-0 z-10 flex flex-col bg-[#faf8f5]/95 border-b border-[#ede7dd]"
        >
          <div
            className="flex items-center justify-between px-3 py-1.5"
            style={{ paddingTop: 'max(0.375rem, env(safe-area-inset-top))' }}
          >
            <button onClick={onOpenMenu} aria-label="Home" title="Main Menu" className="w-8 h-8 rounded-xl inline-flex items-center justify-center text-[#8d6b1d] hover:bg-[#f5f0e6]">
              <Home size={16} />
            </button>
            <div className="font-display text-xs font-semibold tracking-[0.08em] text-center flex-1 truncate px-2 text-[#1a1917]">
              {title}
            </div>
            {debugMode && (
              <button
                onClick={() => setSessionPayloadOpen((v) => !v)}
                aria-label="Session Payload"
                title="This session's turn-by-turn request/response/finishReason since turn 0, for debugging"
                className={`w-8 h-8 rounded-xl inline-flex items-center justify-center hover:bg-[#f5f0e6] ${sessionPayloadOpen ? 'text-rose' : 'text-[#8d6b1d]'}`}
              >
                <Bug size={16} />
              </button>
            )}
            <button onClick={onOpenCodex} aria-label="Codex" className="w-8 h-8 rounded-xl inline-flex items-center justify-center text-[#8d6b1d] hover:bg-[#f5f0e6]">
              <Library size={16} />
            </button>
            <button onClick={onOpenSettings} aria-label="Settings" className="w-8 h-8 rounded-xl inline-flex items-center justify-center text-[#8d6b1d] hover:bg-[#f5f0e6]">
              <SettingsIcon size={16} />
            </button>
          </div>

          {/* Player Vitals HUD Bar placed below header bar (mobile / tablet) */}
          <div className="lg:hidden px-3 border-t border-[#ede7dd] bg-[#f5f0e6]/70">
            <div className="flex items-center justify-between py-0.5">
              <button
                onClick={() => setStatsCollapsed((v) => !v)}
                aria-label={statsCollapsed ? 'Expand stats' : 'Collapse stats'}
                className="w-full flex items-center justify-center leading-none text-[#9e968b] hover:text-[#8d6b1d] py-0.5 cursor-pointer"
              >
                {statsCollapsed ? <ChevronDown size={11} /> : <ChevronUp size={11} />}
              </button>
            </div>
            <div
              className="grid transition-[grid-template-rows] duration-200 ease-out"
              style={{ gridTemplateRows: statsCollapsed ? '0fr' : '1fr' }}
            >
              <div className="overflow-hidden">
                <div className="px-1 pb-1.5 flex items-center gap-3 text-[#2c2825] flex-wrap sm:flex-nowrap">
                  <ConditionBadge icon={Heart} label="Vitals" conditions={player.conditions} colorVar="#b71c1c" />
                  <CurrencyBadge copper={player.copper} />
                </div>
              </div>
            </div>
          </div>

          {combat?.active && (
            <div className="lg:hidden border-t border-[#b71c1c]/25 px-4 py-1 text-[#2c2825] bg-[#fdecec]">
              <ConditionBadge icon={Swords} label={combat.enemyName?.toUpperCase() ?? 'HOSTILE'} conditions={combat.enemyConditions} colorVar="#b71c1c" />
            </div>
          )}

          {debugMode && sessionPayloadOpen && <SessionPayloadPanel log={log} title={title} seedDebug={seedDebug} />}
        </header>

        {/* Parchment Log Container — flat vellum ground; the current
            location's own generated art (§7 Image Generation) now runs as a
            proper hero banner at the top of the scroll content instead of a
            tinted full-bleed wash behind every turn, matching the reference
            mockup's "Cinematic Scene Plate" treatment. */}
        <div
          ref={scrollRef}
          onClick={() => setDrawerOpen(false)}
          className="parchment-surface absolute inset-0 overflow-y-auto cursor-default bg-[#fbf8f3]"
          style={{
            top: 6,
            bottom: 6,
            left: 6,
            right: 6,
            paddingTop: headerHeight,
            paddingBottom: bottomHeight + 40,
          }}
        >
          {/* §7 Cinematic hero plate — the current location's generated art,
              full-bleed with a gradient fade into the vellum ground below,
              carrying the location name + day/time as an overlay badge. Only
              rendered when art actually exists; no fallback texture needed
              now that the ground is a flat, considered vellum on its own. */}
          {currentLocationImageUrl && (
            <button
              onClick={() =>
                setLightbox({
                  url: currentLocationImageUrl,
                  caption: player.locDisp || locations[player.locId]?.name || 'Current location',
                })
              }
              aria-label="Inspect location artwork"
              className="relative w-full h-[220px] sm:h-[280px] overflow-hidden block cursor-pointer group"
            >
              <img
                src={currentLocationImageUrl}
                alt={locations[player.locId]?.name || player.locDisp || 'Current location'}
                className="w-full h-full object-cover object-center transition-transform duration-300 group-hover:scale-[1.02]"
              />
              <div
                className="absolute inset-0 pointer-events-none"
                style={{ background: 'linear-gradient(to bottom, rgba(251,248,243,0) 55%, rgba(251,248,243,0.55) 82%, #fbf8f3 100%)' }}
              />
              <span className="absolute top-3 right-3 flex items-center gap-1 px-2 py-1 rounded-full bg-black/40 text-white/90 text-[10px] font-sans tracking-wide">
                <ZoomIn size={12} /> Inspect
              </span>
              <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between text-[11px] font-mono tracking-wider text-[#4e4637] uppercase">
                <span className="flex items-center gap-1.5 truncate">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#b08830] shrink-0" />
                  <span className="truncate">{player.locDisp || locations[player.locId]?.name || 'Unknown'}</span>
                </span>
                {player.time && (
                  <span className="shrink-0 pl-2">Day {player.time.d} · {player.time.h}</span>
                )}
              </div>
            </button>
          )}

          {/* §7 Present-NPC portrait rail — a row of illuminated medallions
              for whoever's in the scene, just above the reading column. Only
              rendered when at least one present NPC actually has art. */}
          {presentNpcList.length > 0 && (
            <div className="max-w-2xl sm:max-w-3xl mx-auto w-full px-4 pt-3 flex gap-3 overflow-x-auto">
              {presentNpcList.map(([id, n]) => (
                <NpcPortraitChip key={id} name={n.name} portraitKey={n.portraitKey} role={n.role} />
              ))}
            </div>
          )}

          <div className="pl-4 pr-6 pt-3">
          <div className="max-w-2xl sm:max-w-3xl mx-auto w-full space-y-4">
            {log.length === 0 && (
              <p className="font-narrative italic text-sm text-[#6c665e] text-center">
                No turns yet. Type an action below to begin.
              </p>
            )}
            {hasEarlierTurns && (
              <button
                onClick={loadEarlierTurns}
                className="mx-auto flex items-center gap-1.5 rounded-full border border-[#ede7dd] bg-[#f5f0e6] px-3 py-1.5 font-display text-xs text-[#8d6b1d] cursor-pointer hover:bg-[#ebdcb8]/40"
              >
                <History size={12} /> Load Earlier Turns
              </button>
            )}
            {visibleLog.map((entry, i) => {
              const globalIndex = windowStart + i
              // §Editorial Vellum drop cap — only the first real narrated
              // entry of a chapter (the log's own start, or the first entry
              // after a chapter-boundary synthetic entry) gets the
              // illuminated opening letter, matching the mockup's "opening
              // chapter paragraph" use rather than repeating it on every turn.
              const prevEntry = globalIndex > 0 ? log[globalIndex - 1] : undefined
              const isChapterOpener = !!entry.nar && (globalIndex === 0 || !!prevEntry?.chapterBeats?.length || !!prevEntry?.chapterSummary)
              return (
                <TurnBlock
                  key={globalIndex}
                  entry={entry}
                  globalIndex={globalIndex}
                  onTapTerm={onTapTerm}
                  registerRef={registerRef}
                  debugMode={debugMode}
                  isLastTurn={globalIndex === lastNarratedIndex}
                  isChapterOpener={isChapterOpener}
                  onEditLastTurn={onEditLastTurn}
                  onRemoveLastTurn={onRemoveLastTurn}
                  editLongText={editLongText}
                  onOpenRetryEditor={onOpenRetryEditor}
                  confirmAction={confirmAction}
                  setInput={setInput}
                  onSend={onSend}
                  items={items}
                  locations={locations}
                />
              )
            })}
            {busy && <p className="font-narrative italic text-sm text-[#6c665e] text-left">Generating...</p>}
            {lastLogEntry?.act && lastLogEntry.act.length > 0 && !busy && !error && (
              <div className="flex flex-col gap-1.5 pt-2 border-t border-[#ede7dd]">
                <span className="text-[10px] font-mono tracking-wider text-[#8d6b1d]/70 uppercase text-left">Suggested Actions</span>
                <div className="flex flex-wrap gap-1.5 justify-start">
                  {lastLogEntry.act.map((suggestion, idx) => (
                    <button
                      key={idx}
                      onClick={() => setInput(suggestion)}
                      className="inline-flex items-center gap-1.5 rounded-full bg-[#f5f0e6] hover:bg-[#ebdcb8]/40 border border-[#ede7dd] hover:border-[#dec48e] px-3 py-1 font-narrative text-xs text-[#8d6b1d] transition-all cursor-pointer active:scale-[0.98]"
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
        </div>

        {/* Turn Navigator */}
        {log.length > 0 && (
          <div
            ref={navRef}
            onPointerDown={onNavPointerDown}
            onPointerMove={onNavPointerMove}
            onPointerUp={onNavPointerUp}
            onPointerCancel={onNavPointerUp}
            className="turn-nav group fixed z-10 flex flex-col items-center gap-0.5 rounded-xl px-1 py-1.5 cursor-grab active:cursor-grabbing touch-none"
            style={{
              right: 14,
              ...(navDragPos ? { top: navDragPos.y } : { bottom: bottomHeight + 16 }),
              ['--turn-accent' as string]: stateAccent,
              ...(navDragging ? { background: 'rgba(255,255,255,0.96)', border: '1px solid #ede7dd' } : {}),
            }}
          >
            <button
              onClick={goPrevious}
              aria-label="Previous turn"
              className="w-6 h-6 rounded-lg inline-flex items-center justify-center text-[#9e968b] hover:!text-[#8d6b1d] group-hover:text-[#6c665e] hover:bg-[#f5f0e6] transition-colors cursor-pointer"
            >
              <ChevronUp size={13} />
            </button>
            <span className="font-mono text-[10px] tabular-nums text-[#9e968b] group-hover:text-[#6c665e] transition-colors">
              {navPosition || ''}
            </span>
            <button
              onClick={goNext}
              aria-label="Next turn"
              className="w-6 h-6 rounded-lg inline-flex items-center justify-center text-[#9e968b] hover:!text-[#8d6b1d] group-hover:text-[#6c665e] hover:bg-[#f5f0e6] transition-colors cursor-pointer"
            >
              <ChevronDown size={13} />
            </button>
            <div className="w-3 h-px my-0.5 bg-[#ede7dd] transition-colors" />
            <button
              onClick={jumpToLatest}
              aria-label="Jump to latest"
              className="w-6 h-6 rounded-lg inline-flex items-center justify-center text-[#9e968b] hover:!text-[#8d6b1d] group-hover:text-[#6c665e] hover:bg-[#f5f0e6] transition-colors cursor-pointer"
            >
              <ChevronsDown size={13} />
            </button>
          </div>
        )}

        {/* Elevated Input Bar Tray with Extending Drawer Menu */}
        <div
          ref={bottomRef}
          className="absolute bottom-0 inset-x-0 lg:bottom-5 lg:inset-x-6 lg:max-w-4xl lg:mx-auto z-20 flex flex-col rounded-t-2xl lg:rounded-2xl border-t border-x-0 border-b-0 lg:border shadow-[0_-2px_16px_rgba(0,0,0,0.04)] bg-[#faf8f5] border-[#ede7dd]"
        >
          {/* Drawer Menu Popup */}
          <AnimatePresence>
            {drawerOpen && (
              <motion.div
                initial={{ opacity: 0, y: 12, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.97 }}
                transition={{ duration: 0.18, ease: 'easeOut' }}
                className="absolute bottom-full mb-3 left-0 right-0 p-3 sm:p-4 rounded-2xl bg-white border border-[#ede7dd] shadow-[0_12px_32px_rgba(0,0,0,0.1)] z-30"
              >
                <div className="flex items-center justify-between mb-2.5 px-1 border-b border-[#ede7dd] pb-1.5">
                  <span className="font-serif text-xs font-bold uppercase tracking-wider text-[#8d6b1d] flex items-center gap-1.5">
                    <LayoutGrid size={14} /> Codex
                  </span>
                  <button
                    onClick={() => setDrawerOpen(false)}
                    className="text-[#9e968b] hover:text-[#1a1917] p-1 rounded-lg hover:bg-[#f5f0e6] transition-colors cursor-pointer"
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
                      className="group flex flex-col items-center justify-center p-2 rounded-xl bg-[#f5f0e6] border border-[#ede7dd] hover:border-[#dec48e] hover:bg-[#ebdcb8]/30 active:scale-95 text-[#1a1917] transition-all cursor-pointer aspect-square"
                    >
                      <act.icon size={20} className="text-[#8d6b1d] transition-colors mb-1 shrink-0" />
                      <span className="font-serif text-[10px] font-medium text-[#6c665e] group-hover:text-[#1a1917] truncate w-full text-center">
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
              <div className="absolute left-3 right-3 bottom-full mb-1.5 rounded-xl border border-[#ede7dd] bg-white shadow-[0_12px_32px_rgba(0,0,0,0.1)] overflow-hidden">
                {bangSuggestions.map((cmd, i) => (
                  <button
                    key={cmd.name}
                    onClick={() => selectBangSuggestion(cmd.name)}
                    onMouseEnter={() => setBangHighlight(i)}
                    className={`w-full text-left px-3 py-2 flex items-center justify-between gap-3 transition-colors ${
                      i === bangHighlight ? 'bg-[#f5f0e6]' : ''
                    }`}
                  >
                    <span className="font-mono text-xs font-semibold text-[#8d6b1d] shrink-0">{cmd.usage}</span>
                    <span className="text-[11px] text-[#9e968b] truncate">{cmd.description}</span>
                  </button>
                ))}
              </div>
            )}
            {/* Slash Suggestions */}
            {slashSuggestions.length > 0 && (
              <div className="absolute left-3 right-3 bottom-full mb-1.5 rounded-xl border border-[#ede7dd] bg-white shadow-[0_12px_32px_rgba(0,0,0,0.1)] overflow-hidden">
                {slashSuggestions.map((cmd, i) => (
                  <button
                    key={cmd.id}
                    onClick={() => selectSlashSuggestion(cmd)}
                    onMouseEnter={() => setSlashHighlight(i)}
                    className={`w-full text-left px-3 py-2 flex items-center justify-between gap-3 transition-colors ${
                      i === slashHighlight ? 'bg-[#f5f0e6]' : ''
                    }`}
                  >
                    <span className="font-mono text-xs font-semibold text-[#8d6b1d] shrink-0">/{cmd.name}</span>
                    <span className="text-[11px] text-[#9e968b] truncate">{cmd.prompt}</span>
                  </button>
                ))}
                {slashCommands.length === 0 && (
                  <p className="px-3 py-2 text-[11px] text-[#9e968b] italic">No slash commands yet — tap / below to create one.</p>
                )}
              </div>
            )}

            {/* Slash Command Button */}
            <button
              onClick={onOpenSlashManager}
              aria-label="Slash commands"
              title="Slash Command Manager"
              className="shrink-0 w-8 h-8 rounded-xl inline-flex items-center justify-center font-mono text-sm font-bold bg-[#f5f0e6] text-[#8d6b1d] border border-[#ede7dd] hover:bg-[#ebdcb8]/40 hover:border-[#dec48e] transition-all cursor-pointer"
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
                  ? 'bg-[#b08830] text-white border-[#b08830]'
                  : 'bg-[#f5f0e6] text-[#8d6b1d] border-[#ede7dd] hover:bg-[#ebdcb8]/40 hover:border-[#dec48e]'
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
              className="turn-glow flex-1 resize-none rounded-xl border px-3 py-2 font-narrative text-[13px] leading-relaxed text-[#1a1917] placeholder:text-[#9e968b] min-h-[56px]"
              style={{
                maxHeight: INPUT_MAX_HEIGHT,
                ['--turn-accent' as string]: stateAccent,
              }}
            />

            {/* Send Button */}
            <button
              onClick={send}
              disabled={busy || !input.trim()}
              aria-label="Send"
              className="turn-glow-btn w-8 h-8 shrink-0 rounded-xl inline-flex items-center justify-center transition-all bg-[#b08830] text-white border border-[#b08830] hover:bg-[#8d6b1d] disabled:bg-[#ede7dd] disabled:text-[#9e968b] disabled:border-transparent cursor-pointer"
            >
              <Send size={14} />
            </button>
          </div>
        </div>
      </div>

      {popup && popupEntry && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 sm:p-6"
          onClick={() => setPopup(null)}
        >
          <div
            className="relative bg-[#fbf8f3] border border-[#dec48e] shadow-[0_20px_50px_rgba(0,0,0,0.25)] rounded-xl p-5 sm:p-6 w-full max-w-sm sm:max-w-md overflow-hidden text-left"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header: Title + Lock + Close */}
            <div className="flex items-start justify-between gap-3 pr-1">
              <h3 className="font-serif text-xl sm:text-2xl font-normal text-[#1a1917] tracking-wide flex items-center gap-2">
                {'discovery' in popupEntry && isHidden(popupEntry) && <Lock size={18} className="text-[#b08830] shrink-0" />}
                <span>{'discovery' in popupEntry && isHidden(popupEntry) ? '???' : popupEntry.name}</span>
              </h3>
              <button
                onClick={() => setPopup(null)}
                aria-label="Close"
                className="text-[#9e968b] hover:text-[#1a1917] transition-colors p-1.5 -mr-1.5 -mt-1 rounded-md hover:bg-[#f5f0e6] cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Gold Divider */}
            <div className="h-[1.5px] my-3 bg-gradient-to-r from-[#dec48e] via-[#dec48e]/70 to-transparent" />

            {/* Entity Image preview if generated */}
            {popupImageUrl && (!('discovery' in popupEntry) || !isHidden(popupEntry)) && (
              <button
                onClick={() => setLightbox({ url: popupImageUrl, caption: popupEntry.name })}
                aria-label={`Inspect ${popupEntry.name} artwork`}
                className="relative w-full h-44 sm:h-52 rounded-lg overflow-hidden border border-[#dec48e] bg-[#f5f0e6] shadow-sm my-3 block cursor-pointer group"
              >
                <img
                  src={popupImageUrl}
                  alt={popupEntry.name}
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                />
                <span className="absolute top-2 right-2 flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/40 text-white/90 text-[10px] font-sans tracking-wide">
                  <ZoomIn size={11} /> Inspect
                </span>
              </button>
            )}

            {/* Content Body */}
            {'discovery' in popupEntry && isHidden(popupEntry) ? (
              <p className="font-serif text-sm italic text-[#6c665e] leading-relaxed my-3">
                {popupEntry.discovery?.teaser || 'Not yet discovered.'}
              </p>
            ) : (
              <div className="space-y-3">
                {/* Attribute Badges Row */}
                <div className="flex items-center gap-2 flex-wrap">
                  {popup.category === 'item' && 'type' in popupEntry && (() => {
                    // QuestEntry also carries an optional `type` (Main/Side/Ambition/
                    // Secret Ambition) now, so `'type' in popupEntry` alone no longer
                    // narrows the union down to just ItemEntry — popup.category === 'item'
                    // is the real discriminant here, so cast explicitly instead.
                    const item = popupEntry as ItemEntry
                    return (
                      <>
                        <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-[#f5f0e6] border border-[#ede7dd]">
                          <span className="font-serif text-[#8d6b1d] text-xs uppercase tracking-wider font-medium">Type</span>
                          <span className="font-sans font-bold text-xs text-[#1a1917] capitalize">{item.type}</span>
                        </div>
                        {item.rarity && (
                          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-[#f5f0e6] border border-[#ede7dd]">
                            <span className="font-serif text-[#8d6b1d] text-xs uppercase tracking-wider font-medium">Rarity</span>
                            <span className="font-sans font-bold text-xs text-[#1a1917]">{item.rarity}</span>
                          </div>
                        )}
                        {traitsText(item.traits) && (
                          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-[#f5f0e6] border border-[#ede7dd]">
                            <span className="font-serif text-[#8d6b1d] text-xs uppercase tracking-wider font-medium">Traits</span>
                            <span className="font-sans font-bold text-xs text-[#1a1917]">{traitsText(item.traits)}</span>
                          </div>
                        )}
                        {item.value !== undefined && (
                          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-[#f5f0e6] border border-[#ede7dd]">
                            <span className="font-serif text-[#8d6b1d] text-xs uppercase tracking-wider font-medium">Worth</span>
                            <span className="font-sans font-bold text-xs text-[#1a1917]">{item.value} C</span>
                          </div>
                        )}
                      </>
                    )
                  })()}

                  {popup.category === 'npc' && 'stage' in popupEntry && (
                    <>
                      <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-[#f5f0e6] border border-[#ede7dd]">
                        <span className="font-serif text-[#8d6b1d] text-xs uppercase tracking-wider font-medium">{popupEntry.role || 'NPC'}</span>
                        <span className="font-sans font-bold text-xs text-[#1a1917] capitalize">{popupEntry.stage}</span>
                      </div>
                      <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-[#f5f0e6] border border-[#ede7dd]">
                        <span className="font-serif text-[#8d6b1d] text-xs uppercase tracking-wider font-medium">Trust</span>
                        <span className="font-sans font-bold text-xs text-[#1a1917]">{trustWord(popupEntry.trust)}</span>
                      </div>
                    </>
                  )}

                  {popup.category === 'loc' && 'region' in popupEntry && (
                    <>
                      <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-[#f5f0e6] border border-[#ede7dd]">
                        <span className="font-serif text-[#8d6b1d] text-xs uppercase tracking-wider font-medium">Region</span>
                        <span className="font-sans font-bold text-xs text-[#1a1917]">{popupEntry.region || 'Realm'}</span>
                      </div>
                      <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-[#f5f0e6] border border-[#ede7dd]">
                        <span className="font-serif text-[#8d6b1d] text-xs uppercase tracking-wider font-medium">Danger</span>
                        <span className="font-sans font-bold text-xs text-[#1a1917]">{popupEntry.dangerLevel || 'Safe'}</span>
                      </div>
                    </>
                  )}

                  {popup.category === 'faction' && 'repTier' in popupEntry && (
                    <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-[#f5f0e6] border border-[#ede7dd]">
                      <span className="font-serif text-[#8d6b1d] text-xs uppercase tracking-wider font-medium">Reputation</span>
                      <span className="font-sans font-bold text-xs text-[#1a1917]">{popupEntry.repTier > 0 ? '+' : ''}{popupEntry.repTier}</span>
                    </div>
                  )}

                  {popup.category === 'skill' && (
                    <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-[#f5f0e6] border border-[#ede7dd]">
                      <span className="font-serif text-[#8d6b1d] text-xs uppercase tracking-wider font-medium">Effort</span>
                      <span className="font-sans font-bold text-xs text-[#1a1917] capitalize">
                        {'effort' in popupEntry && popupEntry.effort ? popupEntry.effort : 'Ability'}
                      </span>
                    </div>
                  )}

                  {popup.category === 'beast' && 'threatTier' in popupEntry && (
                    <>
                      <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-[#f5f0e6] border border-[#ede7dd]">
                        <span className="font-serif text-[#8d6b1d] text-xs uppercase tracking-wider font-medium">Threat</span>
                        <span className="font-sans font-bold text-xs text-[#1a1917]">{popupEntry.threatTier}</span>
                      </div>
                      {popupEntry.conditions?.length ? (
                        <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-[#f5f0e6] border border-[#ede7dd]">
                          <span className="font-serif text-[#8d6b1d] text-xs uppercase tracking-wider font-medium">Conditions</span>
                          <span className="font-sans font-bold text-xs text-[#1a1917]">{popupEntry.conditions.map((c) => c.label).join(', ')}</span>
                        </div>
                      ) : null}
                    </>
                  )}

                  {popup.category === 'quest' && 'status' in popupEntry && (
                    <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-[#f5f0e6] border border-[#ede7dd]">
                      <span className="font-serif text-[#8d6b1d] text-xs uppercase tracking-wider font-medium">Status</span>
                      <span className="font-sans font-bold text-xs text-[#1a1917] capitalize">{popupEntry.status ?? 'active'}</span>
                    </div>
                  )}

                  {popup.category === 'lore' && 'category' in popupEntry && (
                    <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-[#f5f0e6] border border-[#ede7dd]">
                      <span className="font-serif text-[#8d6b1d] text-xs uppercase tracking-wider font-medium">Category</span>
                      <span className="font-sans font-bold text-xs text-[#1a1917] capitalize">{popupEntry.category || 'General'}</span>
                    </div>
                  )}
                </div>

                {/* Prose Text / Descriptions */}
                <div className="font-serif text-sm leading-relaxed text-[#2c2825] space-y-2 pt-1">
                  {'description' in popupEntry && popupEntry.description && (
                    <p>{popupEntry.description}</p>
                  )}
                  {popup.category === 'npc' && 'memSummary' in popupEntry && popupEntry.memSummary && (
                    <p className="italic text-[#6c665e]">"{popupEntry.memSummary}"</p>
                  )}
                  {popup.category === 'item' && 'loreText' in popupEntry && popupEntry.loreText && (
                    <p className="italic text-[#6c665e]">{popupEntry.loreText}</p>
                  )}
                  {popup.category === 'loc' && 'notableFeatures' in popupEntry && popupEntry.notableFeatures && (
                    <p className="text-xs text-[#6c665e]"><strong className="text-[#8d6b1d] font-normal">Features:</strong> {popupEntry.notableFeatures}</p>
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
              className="mt-5 w-full py-2.5 px-4 rounded-lg bg-[#f5f0e6] hover:bg-[#ebdcb8]/40 border border-[#ede7dd] hover:border-[#dec48e] text-[#8d6b1d] font-serif text-xs font-semibold tracking-wider uppercase flex items-center justify-center gap-2 transition-all active:scale-[0.98] cursor-pointer"
            >
              <span>Open in Codex</span>
              <ExternalLink size={13} />
            </button>
          </div>
        </div>
      )}

      {storySoFar && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 sm:p-6"
          onClick={() => {
            onAcknowledgeChapterStory?.(storySoFar.chapterNumber!)
            setStorySoFar(null)
          }}
        >
          <div
            className="relative bg-[#fbf8f3] border border-[#dec48e] shadow-[0_20px_50px_rgba(0,0,0,0.25)] rounded-xl p-5 sm:p-6 w-full max-w-md overflow-hidden text-left max-h-[80vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 pr-1 shrink-0">
              <h3 className="font-serif text-lg sm:text-xl font-normal text-[#1a1917] tracking-wide flex items-center gap-2">
                <BookOpen size={18} className="text-[#b08830]" />
                <span>Story So Far</span>
              </h3>
              <button
                onClick={() => {
                  onAcknowledgeChapterStory?.(storySoFar.chapterNumber!)
                  setStorySoFar(null)
                }}
                aria-label="Close"
                className="text-[#9e968b] hover:text-[#1a1917] transition-colors p-1.5 -mr-1.5 -mt-1 rounded-md hover:bg-[#f5f0e6] cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>
            <div className="h-[1.5px] my-3 bg-gradient-to-r from-[#dec48e] via-[#dec48e]/70 to-transparent shrink-0" />
            <div className="overflow-y-auto flex flex-col gap-2.5 pr-1">
              <span className="font-mono text-[10px] uppercase tracking-wider text-[#8d6b1d]/70">
                Chapter {storySoFar.chapterNumber}
              </span>
              {storySoFar.chapterNarrative ? (
                storySoFar.chapterNarrative.split('\n\n').map((para, i) => (
                  <p key={i} className="font-narrative text-sm text-[#2c2825] leading-relaxed">
                    {para}
                  </p>
                ))
              ) : storySoFar.chapterBeats?.length ? (
                storySoFar.chapterBeats.map((b, i) => (
                  <p key={i} className="font-narrative text-sm text-[#2c2825] leading-relaxed">
                    {b.text}
                  </p>
                ))
              ) : (
                <p className="font-narrative italic text-sm text-[#2c2825] leading-relaxed">"{storySoFar.chapterSummary}"</p>
              )}
            </div>
            <button
              onClick={() => {
                onAcknowledgeChapterStory?.(storySoFar.chapterNumber!)
                setStorySoFar(null)
              }}
              className="mt-4 w-full py-2.5 px-4 rounded-lg bg-[#f5f0e6] hover:bg-[#ebdcb8]/40 border border-[#ede7dd] hover:border-[#dec48e] text-[#8d6b1d] font-serif text-xs font-semibold tracking-wider uppercase flex items-center justify-center gap-2 transition-all active:scale-[0.98] cursor-pointer shrink-0"
            >
              <span>Continue the Tale</span>
            </button>
          </div>
        </div>
      )}

      {/* §7 Tap-to-inspect lightbox — sits above every other overlay (popup
          card, Story So Far memo) since it can be triggered from inside
          either one. */}
      {lightbox && (
        <div
          className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-black/85 p-4 sm:p-6"
          onClick={() => setLightbox(null)}
        >
          <button
            onClick={() => setLightbox(null)}
            aria-label="Close artwork preview"
            className="absolute top-4 right-4 sm:top-6 sm:right-6 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
          <img
            src={lightbox.url}
            alt={lightbox.caption}
            className="max-h-[80vh] max-w-full object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
          <p className="mt-4 font-display text-sm text-white/80 tracking-wide text-center">{lightbox.caption}</p>
        </div>
      )}
    </div>
  )
}
