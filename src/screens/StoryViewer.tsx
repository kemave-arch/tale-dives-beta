import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import {
  Home, Settings as SettingsIcon, Send, BookOpen, Library, X,
  History, Users, Backpack, Map as MapIcon, ShieldCheck, Skull, Sparkles, ScrollText, Hammer,
  Bug, Heart, Zap, Activity, Swords, Lock, LayoutGrid,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { TapTermHandler } from '../lib/richText.tsx'
import { isHidden } from '../lib/discovery.ts'
import { slugify } from '../lib/slug.ts'
import { BANG_COMMANDS } from '../lib/bangCommands.ts'
import {
  PoolBar, CurrencyBadge, TurnBlock, ApiErrorPanel, SessionPayloadPanel,
  statBonusText, type PopupTarget,
} from './Chronicle.tsx'
import type { CategoryId } from './Codex.tsx'
import type {
  ApiSettings, BestiaryEntry, Campaign, CombatState, CraftingJob, FactionEntry, ItemEntry, KeywordLink, LocationEntry, LogEntry, LoreEntry, NpcEntry,
  Player, ProseDepthConfig, QuestEntry, SkillEntry, SlashCommand,
} from '../types.ts'

// StoryViewer — the isolated flat/opaque alternative to Chronicle.tsx, full
// feature parity by design: same turn log, same HUD data, same drawer of
// Codex shortcuts, same input/bang/slash handling, same edit/retry/delete
// and debug tooling. What differs is presentation only — a solid ink page
// instead of a translucent parchment-over-glass one — so the actual turn
// rendering (TurnBlock), the API error panel, and the debug payload tools
// are imported from Chronicle.tsx and reused verbatim rather than
// reimplemented, which is what makes this a genuine parity build rather
// than a lookalike with its own bugs. See PROJECT_REVISION_NOTES.md.

const WINDOW_SIZE = 20
const INPUT_MAX_HEIGHT = 160

interface StoryViewerProps {
  title: string
  player: Player
  combat?: CombatState
  log: LogEntry[]
  seedDebug?: Campaign['seedDebug']
  busy: boolean
  error: string | null
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
  onOpenChronicle: () => void
  debugMode?: boolean
}

export default function StoryViewer({
  title,
  player,
  combat,
  log,
  seedDebug,
  busy,
  error,
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
  onOpenChronicle,
  debugMode,
}: StoryViewerProps) {
  const [input, setInput] = useState('')
  const [sessionPayloadOpen, setSessionPayloadOpen] = useState(false)
  const [bangHighlight, setBangHighlight] = useState(0)
  const [bangDismissed, setBangDismissed] = useState(false)
  const [slashHighlight, setSlashHighlight] = useState(0)
  const [slashDismissed, setSlashDismissed] = useState(false)
  const [popup, setPopup] = useState<PopupTarget | null>(null)
  const [visibleCount, setVisibleCount] = useState(WINDOW_SIZE)
  const [drawerOpen, setDrawerOpen] = useState(false)

  const scrollRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const blockRefs = useRef(new Map<number, HTMLDivElement>())

  const lastLogEntry = useMemo(() => log[log.length - 1], [log])
  const windowStart = Math.max(0, log.length - visibleCount)
  const visibleLog = log.slice(windowStart)
  const hasEarlierTurns = windowStart > 0

  let lastNarratedIndex = -1
  for (let i = log.length - 1; i >= 0; i--) {
    if (log[i].nar && log[i].rawPayload) {
      lastNarratedIndex = i
      break
    }
  }

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
    if (crafting && crafting.length > 0) actions.push({ icon: Hammer, label: 'Crafting', onClick: () => onOpenCodexCategory('crafting') })
    return actions
  }, [crafting, onOpenCodexCategory])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [log])

  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, INPUT_MAX_HEIGHT)}px`
  }, [input])

  const registerRef = useCallback((index: number, el: HTMLDivElement | null) => {
    if (el) blockRefs.current.set(index, el)
    else blockRefs.current.delete(index)
  }, [])

  function send() {
    const text = input.trim()
    if (!text || busy) return
    if (text.startsWith('!')) {
      onBangCommand(text)
    } else if (text.startsWith('/')) {
      const cmd = slashCommands.find((c) => c.name === text.slice(1).trim().toLowerCase())
      onSend(cmd ? cmd.prompt : text, cmd?.pauseRoleplay)
    } else {
      onSend(text)
    }
    setInput('')
  }

  const bangWordMatch = /^!(\w*)$/.exec(input)
  const bangSuggestions =
    !bangDismissed && bangWordMatch ? BANG_COMMANDS.filter((c) => c.name.startsWith(bangWordMatch[1].toLowerCase())) : []

  const slashWordMatch = /^\/(\w*)$/.exec(input)
  const slashSuggestions =
    !slashDismissed && slashWordMatch ? slashCommands.filter((c) => c.name.startsWith(slashWordMatch[1].toLowerCase())) : []

  function selectBangSuggestion(name: string) {
    setInput(`!${name} `)
    setBangHighlight(0)
    setBangDismissed(false)
    textareaRef.current?.focus()
  }

  function selectSlashSuggestion(cmd: SlashCommand) {
    onSend(cmd.prompt, cmd.pauseRoleplay)
    setInput('')
    setSlashHighlight(0)
    setSlashDismissed(false)
  }

  function loadEarlierTurns() {
    setVisibleCount((n) => Math.min(log.length, n + WINDOW_SIZE))
  }

  const onTapTerm = useCallback<TapTermHandler>(
    (term, category) => {
      const dict = { npc: npcs, loc: locations, faction: factions, lore, quest: quests, beast: bestiary, skill: skills, item: items }[category]
      if (!dict) return
      const bareId = slugify(term)
      if (dict[bareId]) {
        setPopup({ category, id: bareId })
        return
      }
      const needle = term.trim().toLowerCase()
      const match = Object.entries(dict).find(([, entry]) => entry.name.trim().toLowerCase() === needle)
      if (match) setPopup({ category, id: match[0] })
    },
    [npcs, locations, factions, lore, quests, bestiary, skills, items],
  )

  const popupEntry =
    popup &&
    ({ npc: npcs, loc: locations, faction: factions, lore, quest: quests, beast: bestiary, skill: skills, item: items }[popup.category]?.[popup.id] as
      | NpcEntry | LocationEntry | FactionEntry | LoreEntry | QuestEntry | BestiaryEntry | SkillEntry | ItemEntry | undefined)

  return (
    <div className="fixed inset-0 overflow-hidden text-[#f0e9fb] bg-[#0a0812] flex flex-col">
      {/* Header */}
      <header className="shrink-0 flex flex-col bg-[#12101c] border-b border-[#2c2440]">
        <div className="flex items-center justify-between px-3 py-1.5" style={{ paddingTop: 'max(0.375rem, env(safe-area-inset-top))' }}>
          <button onClick={onOpenMenu} aria-label="Home" className="w-8 h-8 rounded-xl inline-flex items-center justify-center text-[#c4a8ff] hover:bg-white/5">
            <Home size={16} />
          </button>
          <div className="font-display text-xs font-semibold tracking-wide text-center flex-1 truncate px-2 text-[#f0e9fb]">{title}</div>
          {debugMode && (
            <button
              onClick={() => setSessionPayloadOpen((v) => !v)}
              aria-label="Session Payload"
              className={`w-8 h-8 rounded-xl inline-flex items-center justify-center hover:bg-white/5 ${sessionPayloadOpen ? 'text-rose' : 'text-[#c4a8ff]'}`}
            >
              <Bug size={16} />
            </button>
          )}
          <button onClick={onOpenChronicle} aria-label="Classic Chronicle" title="Switch to the classic Chronicle view" className="w-8 h-8 rounded-xl inline-flex items-center justify-center text-[#c4a8ff] hover:bg-white/5">
            <BookOpen size={16} />
          </button>
          <button onClick={onOpenCodex} aria-label="Codex" className="w-8 h-8 rounded-xl inline-flex items-center justify-center text-[#c4a8ff] hover:bg-white/5">
            <Library size={16} />
          </button>
          <button onClick={onOpenSettings} aria-label="Settings" className="w-8 h-8 rounded-xl inline-flex items-center justify-center text-[#c4a8ff] hover:bg-white/5">
            <SettingsIcon size={16} />
          </button>
        </div>

        {/* HUD */}
        <div className="px-3 pb-1.5 flex items-center gap-3 flex-wrap sm:flex-nowrap">
          <PoolBar icon={Heart} label="HP" value={player.hp} max={player.hpMax} colorVar="#f8b4c4" />
          <PoolBar icon={Zap} label="MP" value={player.mp} max={player.mpMax} colorVar="#a8c4f4" />
          <PoolBar icon={Activity} label="ST" value={player.st} max={player.stMax} colorVar="#a8f4c4" />
          <CurrencyBadge copper={player.copper} />
        </div>
        {combat?.active && (
          <div className="border-t border-[#5a2440] px-3 py-1 bg-[#2a1420]">
            <PoolBar icon={Swords} label={combat.enemyName?.toUpperCase() ?? 'HOSTILE'} value={combat.enemyHp ?? 0} max={combat.enemyHpMax ?? 1} colorVar="#f8b4c4" />
          </div>
        )}
        {debugMode && sessionPayloadOpen && <SessionPayloadPanel log={log} title={title} seedDebug={seedDebug} />}
      </header>

      {/* Log */}
      <div ref={scrollRef} onClick={() => setDrawerOpen(false)} className="flex-1 min-h-0 overflow-y-auto px-4 py-4" style={{ overscrollBehaviorY: 'contain' }}>
        <div className="max-w-2xl mx-auto w-full space-y-4">
          {log.length === 0 && (
            <p className="font-narrative italic text-sm opacity-60 text-center">The tale hasn't begun. Type an action below to dive in.</p>
          )}
          {hasEarlierTurns && (
            <button
              onClick={loadEarlierTurns}
              className="mx-auto flex items-center gap-1.5 rounded-xl border border-[#2c2440] px-3 py-1.5 font-display text-xs text-[#c4a8ff] hover:bg-white/5"
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
              onOpenRetryEditor={onOpenRetryEditor}
              confirmAction={confirmAction}
              setInput={setInput}
              onSend={onSend}
              items={items}
              locations={locations}
            />
          ))}
          {busy && <p className="font-narrative italic text-sm opacity-50">The thread of fate is being woven...</p>}
          {lastLogEntry?.act && lastLogEntry.act.length > 0 && !busy && !error && (
            <div className="flex flex-col gap-1.5 pt-2 border-t border-[#2c2440]">
              <span className="text-[10px] font-mono tracking-wider text-[#a89bc4] uppercase">Suggested Actions</span>
              <div className="flex flex-wrap gap-1.5">
                {lastLogEntry.act.map((suggestion, idx) => (
                  <button
                    key={idx}
                    onClick={() => setInput(suggestion)}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[#1e1830] hover:bg-[#241c3a] border border-[#2c2440] hover:border-[#4a3d6b] px-3 py-1 font-narrative text-xs text-[#c4a8ff] transition-all"
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

      {/* Input Bar */}
      <div className="shrink-0 flex flex-col border-t border-[#2c2440] bg-[#12101c]">
        {drawerOpen && (
          <div className="p-3 border-b border-[#2c2440]">
            <div className="flex items-center justify-between mb-2 px-1">
              <span className="font-display text-xs font-bold uppercase tracking-wider text-[#c4a8ff] flex items-center gap-1.5">
                <LayoutGrid size={14} /> Codex Navigation
              </span>
              <button onClick={() => setDrawerOpen(false)} className="text-[#a89bc4] hover:text-[#f0e9fb] p-1 rounded-lg hover:bg-white/5">
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
                  className="flex flex-col items-center justify-center p-2 rounded-xl bg-[#1e1830] border border-[#2c2440] hover:border-[#4a3d6b] active:scale-95 text-[#f0e9fb] transition-all aspect-square"
                >
                  {act.icon && <act.icon size={20} className="text-[#c4a8ff] mb-1" />}
                  <span className="font-display text-[10px] font-medium text-[#a89bc4] truncate w-full text-center">{act.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="relative px-3 pt-2 pb-2.5 flex gap-2 items-end">
          {bangSuggestions.length > 0 && (
            <div className="absolute left-3 right-3 bottom-full mb-1.5 rounded-xl border border-[#2c2440] bg-[#161221] shadow-2xl overflow-hidden">
              {bangSuggestions.map((cmd, i) => (
                <button
                  key={cmd.name}
                  onClick={() => selectBangSuggestion(cmd.name)}
                  onMouseEnter={() => setBangHighlight(i)}
                  className={`w-full text-left px-3 py-2 flex items-center justify-between gap-3 ${i === bangHighlight ? 'bg-white/5' : ''}`}
                >
                  <span className="font-mono text-xs font-semibold text-[#c4a8ff] shrink-0">{cmd.usage}</span>
                  <span className="text-[11px] text-[#a89bc4] truncate">{cmd.description}</span>
                </button>
              ))}
            </div>
          )}
          {slashSuggestions.length > 0 && (
            <div className="absolute left-3 right-3 bottom-full mb-1.5 rounded-xl border border-[#2c2440] bg-[#161221] shadow-2xl overflow-hidden">
              {slashSuggestions.map((cmd, i) => (
                <button
                  key={cmd.id}
                  onClick={() => selectSlashSuggestion(cmd)}
                  onMouseEnter={() => setSlashHighlight(i)}
                  className={`w-full text-left px-3 py-2 flex items-center justify-between gap-3 ${i === slashHighlight ? 'bg-white/5' : ''}`}
                >
                  <span className="font-mono text-xs font-semibold text-[#c4a8ff] shrink-0">/{cmd.name}</span>
                  <span className="text-[11px] text-[#a89bc4] truncate">{cmd.prompt}</span>
                </button>
              ))}
              {slashCommands.length === 0 && <p className="px-3 py-2 text-[11px] text-[#a89bc4] italic">No slash commands yet.</p>}
            </div>
          )}

          <button onClick={onOpenSlashManager} aria-label="Slash commands" title="Slash Command Manager" className="shrink-0 w-8 h-8 rounded-xl inline-flex items-center justify-center font-mono text-sm font-bold bg-[#1e1830] text-[#c4a8ff] border border-[#2c2440] hover:border-[#4a3d6b]">
            /
          </button>
          <button
            onClick={() => setDrawerOpen((v) => !v)}
            aria-label={drawerOpen ? 'Close navigation drawer' : 'Open navigation drawer'}
            className={`shrink-0 w-8 h-8 rounded-xl inline-flex items-center justify-center border ${drawerOpen ? 'bg-[#c4a8ff] text-[#0a0812] border-[#c4a8ff]' : 'bg-[#1e1830] text-[#c4a8ff] border-[#2c2440] hover:border-[#4a3d6b]'}`}
          >
            <LayoutGrid size={16} />
          </button>

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
                if (e.key === 'ArrowDown') { e.preventDefault(); setBangHighlight((h) => (h + 1) % bangSuggestions.length); return }
                if (e.key === 'ArrowUp') { e.preventDefault(); setBangHighlight((h) => (h - 1 + bangSuggestions.length) % bangSuggestions.length); return }
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); selectBangSuggestion(bangSuggestions[bangHighlight].name); return }
                if (e.key === 'Escape') { e.preventDefault(); setBangDismissed(true); return }
              }
              if (slashSuggestions.length > 0) {
                if (e.key === 'ArrowDown') { e.preventDefault(); setSlashHighlight((h) => (h + 1) % slashSuggestions.length); return }
                if (e.key === 'ArrowUp') { e.preventDefault(); setSlashHighlight((h) => (h - 1 + slashSuggestions.length) % slashSuggestions.length); return }
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); selectSlashSuggestion(slashSuggestions[slashHighlight]); return }
                if (e.key === 'Escape') { e.preventDefault(); setSlashDismissed(true); return }
              }
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
            }}
            placeholder="What do you do?"
            disabled={busy}
            className="flex-1 resize-none rounded-xl border border-[#2c2440] focus:border-[#c4a8ff]/70 px-3 py-2 font-narrative text-sm leading-relaxed text-[#f0e9fb] placeholder:text-[#a89bc4]/40 min-h-[56px] bg-[#0f0c18] outline-none"
            style={{ maxHeight: INPUT_MAX_HEIGHT }}
          />

          <button
            onClick={send}
            disabled={busy || !input.trim()}
            aria-label="Send"
            className="w-8 h-8 shrink-0 rounded-xl inline-flex items-center justify-center bg-[#c4a8ff] text-[#0a0812] border border-[#c4a8ff] hover:bg-[#dcc8ff] disabled:bg-white/5 disabled:text-white/25 disabled:border-transparent"
          >
            <Send size={14} />
          </button>
        </div>
      </div>

      {/* Popup term card */}
      {popup && popupEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 sm:p-6" onClick={() => setPopup(null)}>
          <div className="bg-[#161221] border border-[#2c2440] rounded-xl p-5 sm:p-6 w-full max-w-sm sm:max-w-md text-left" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <h3 className="font-display text-lg font-bold text-[#f0e9fb] flex items-center gap-2">
                {'discovery' in popupEntry && isHidden(popupEntry) && <Lock size={16} className="text-[#c4a8ff]" />}
                <span>{'discovery' in popupEntry && isHidden(popupEntry) ? '???' : popupEntry.name}</span>
              </h3>
              <button onClick={() => setPopup(null)} className="text-[#a89bc4] hover:text-[#f0e9fb]">
                <X size={18} />
              </button>
            </div>
            <div className="h-px bg-[#2c2440] my-3" />
            {'discovery' in popupEntry && isHidden(popupEntry) ? (
              <p className="font-narrative text-sm italic text-[#a89bc4]">{popupEntry.discovery?.teaser || 'Not yet discovered.'}</p>
            ) : (
              <div className="space-y-3">
                {'description' in popupEntry && popupEntry.description && (
                  <p className="font-narrative text-sm leading-relaxed text-[#d8cef0]">{popupEntry.description}</p>
                )}
                {popup.category === 'item' && 'statBonus' in popupEntry && statBonusText((popupEntry as ItemEntry).statBonus) && (
                  <p className="text-xs font-mono text-[#c4a8ff]">{statBonusText((popupEntry as ItemEntry).statBonus)}</p>
                )}
              </div>
            )}
            <button
              onClick={() => {
                onOpenCodexEntry(popup.category, popup.id)
                setPopup(null)
              }}
              className="mt-4 w-full py-2 rounded-lg bg-[#1e1830] hover:bg-[#241c3a] border border-[#2c2440] text-xs font-display text-[#c4a8ff]"
            >
              Open Full Codex Entry
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
