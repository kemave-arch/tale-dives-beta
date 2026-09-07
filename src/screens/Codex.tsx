import { createContext, useState, useMemo, useEffect, useContext } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  Globe, BookOpen, Users, ShieldCheck, Map, ScrollText, Target, Skull, Backpack,
  Pencil, Save, X, Trash2, Plus, Lock, User, Hammer, Clock, Sparkles, CheckCircle2, XCircle, ArrowRight, Ghost,
  Swords, Star, EyeOff, Search, MapPin, Heart, Coins, Gift, Zap, Compass, AlertTriangle, Shield, Flame, LayoutGrid,
} from 'lucide-react'
import { DASHED_ROW_CLASS, GLASS_SURFACE_LIST, GlassHeader, GlassIconButton, GlassScreen, SELECT_CLASS } from '../lib/glassChrome.tsx'
import { slugify, titleCaseId } from '../lib/slug.ts'
import { isHidden, validateDiscovery } from '../lib/discovery.ts'
import { checkAffordability } from '../lib/skills.ts'
import { PRESET_CLASSES } from '../data/classes.ts'
import { RECIPES } from '../data/recipes.ts'
import { canAffordRecipe } from '../lib/crafting.ts'
import { hoursRemaining } from '../lib/gameTime.ts'
import { deriveStanding, effectiveStanding, repTierLabel } from '../lib/factions.ts'
import { useConfirm } from '../lib/useConfirm.tsx'
import { useLongTextEditor } from '../lib/useLongTextEditor.tsx'
import { EQUIPPABLE_TYPES, LOCATION_DANGER_LEVELS, LOCATION_TYPES } from '../types.ts'
import type {
  BestiaryEntry, CraftingJob, Discovery, EquipSlot, FactionEntry, ItemEntry, ItemType, LocationEntry, LogEntry, LoreEntry, NpcEntry, Player,
  QuestEntry, RevealTrigger, SkillEntry, StatBonus, WorldData,
} from '../types.ts'

const ITEM_TYPES: ItemType[] = ['weapon', 'armor', 'accessory', 'tool', 'key', 'consumable', 'material']
const STAT_BONUS_KEYS: (keyof StatBonus)[] = ['STR', 'INT', 'AGI', 'hp', 'mp', 'st']

function statBonusText(bonus: StatBonus | undefined): string | null {
  if (!bonus) return null
  const parts = Object.entries(bonus)
    .filter(([, v]) => v)
    .map(([k, v]) => `${v! > 0 ? '+' : ''}${v} ${k}`)
  return parts.length ? parts.join(', ') : null
}

export type CategoryId =
  | 'realm' | 'character' | 'crafting' | 'chapters' | 'npcs' | 'factions' | 'locations' | 'lore' | 'quests' | 'bestiary' | 'items' | 'skills' | 'corpses'

export interface CodexProps {
  world: WorldData
  player: Player
  log: LogEntry[]
  npcs: Record<string, NpcEntry>
  skills: Record<string, SkillEntry>
  factions: Record<string, FactionEntry>
  locations: Record<string, LocationEntry>
  lore: Record<string, LoreEntry>
  quests: Record<string, QuestEntry>
  bestiary: Record<string, BestiaryEntry>
  flags: string[]
  inventory: Record<string, number>
  items: Record<string, ItemEntry>
  crafting: CraftingJob[]
  corpses: string[]
  onUpdateNpc: (id: string, patch: Partial<NpcEntry> | null) => void
  onUpdateFaction: (id: string, patch: Partial<FactionEntry> | null) => void
  onUpdateLocation: (id: string, patch: Partial<LocationEntry> | null) => void
  onUpdateLore: (id: string, patch: Partial<LoreEntry> | null) => void
  onUpdateQuest: (id: string, patch: Partial<QuestEntry> | null) => void
  onUpdateBestiary: (id: string, patch: Partial<BestiaryEntry> | null) => void
  onUpdateSkill: (id: string, entry: Partial<SkillEntry> | null) => void
  onUpdateItem: (id: string, qty: number | null, entry?: Partial<ItemEntry>) => void
  onEquipItem: (id: string) => void
  onUnequipSlot: (slot: EquipSlot) => void
  onUpdateWorld: (patch: Partial<WorldData>) => void
  onEvolveClass: (classId: string) => void
  onStartCraft: (recipeId: string) => void
  initialCategory?: CategoryId | null
  initialEntryId?: string | null
  onBack: () => void
  onOpenCodexViewer?: () => void
}

// §9 Codex CRUD — a new, not-yet-saved entry lives under this sentinel id
// until Save assigns it a real slug.
const NEW_ID = '__new__'

// §5.12 — "A condition that can't be validated fails open to state: 'known'
// rather than shipping an entry the player can never unlock." Only checks
// triggers with a real dict to check against; `flag` conditions are freeform
// strings the model may not have produced yet, so those are trusted as-is.
function genId(name: string, existing: Record<string, unknown>): string {
  const base = slugify(name) || 'entry'
  if (!existing[base]) return base
  let i = 2
  while (existing[`${base}_${i}`]) i++
  return `${base}_${i}`
}

function AutoBadge({ shown }: { shown?: boolean }) {
  if (!shown) return null
  return <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#e8ca8a]/15 text-[#e8ca8a]/80">auto</span>
}

// §5.12 Codex Discovery — a masked card badge; the entry grid otherwise shows AutoBadge.
function LockBadge() {
  return (
    <span className="text-[#e8ca8a]/50 shrink-0">
      <Lock size={13} />
    </span>
  )
}

// §5.12 — masked read view for a hidden entry outside CRUD Edit Mode. No field
// beyond the teaser is exposed here; the full record only ever shows up top
// once `discovery.state` is flipped to `known` (by a matching reveal check, or
// hand-edited back to Known in the CRUD form below).
function MaskedDetail({ teaser }: { teaser?: string }) {
  return (
    <DetailPanel>
      <p className="font-narrative text-sm text-ink-muted flex items-center gap-1.5">
        <Lock size={13} /> ??? — Not yet discovered
      </p>
      {teaser && <p className="font-narrative text-xs italic text-ink-muted">{teaser}</p>}
    </DetailPanel>
  )
}

// §5.12 Codex Discovery CRUD — hand-author or fix reveal logic for any entry,
// exactly like any other Codex field (the "steer state directly" philosophy
// already established for auto-logged entries, §5.10).
function DiscoveryEditor({ discovery, onChange }: { discovery: Discovery | undefined; onChange: (d: Discovery | undefined) => void }) {
  const hidden = discovery?.state === 'hidden'
  return (
    <div className="rounded-lg border border-[#e8ca8a]/25 p-3 flex flex-col gap-2.5">
      <span className="text-[11px] font-display text-ink-muted uppercase tracking-wide flex items-center gap-1">
        <Lock size={11} /> Discovery (Fog of Lore)
      </span>
      <label className="flex items-center gap-2 text-xs text-ink-muted">
        <input
          type="checkbox"
          checked={hidden}
          onChange={(e) =>
            onChange(
              e.target.checked
                ? { state: 'hidden', revealTrigger: discovery?.revealTrigger ?? 'manual', revealCondition: discovery?.revealCondition ?? '', teaser: discovery?.teaser ?? '' }
                : undefined,
            )
          }
          className="accent-[#e8ca8a]"
        />
        Hidden until discovered
      </label>
      {hidden && (
        <>
          <label className="block">
            <span className="text-[11px] font-display text-ink-muted uppercase tracking-wide">Reveal Trigger</span>
            <select
              value={discovery?.revealTrigger ?? 'manual'}
              onChange={(e) => onChange({ ...discovery!, state: 'hidden', revealTrigger: e.target.value as RevealTrigger })}
              className="mt-1 w-full rounded-lg border border-[#e8ca8a]/25 bg-[#e8ca8a]/[0.04] backdrop-blur-sm px-3 py-2 font-mono text-xs text-ink"
            >
              <option value="manual">Manual (CRUD only)</option>
              <option value="flag">World Flag</option>
              <option value="location_visit">Visit Location (id)</option>
              <option value="npc_met">Meet NPC (id)</option>
              <option value="quest_complete">Complete Quest (id)</option>
            </select>
          </label>
          {discovery?.revealTrigger !== 'manual' && (
            <TextField
              label="Reveal Condition"
              value={discovery?.revealCondition ?? ''}
              onChange={(v) => onChange({ ...discovery!, state: 'hidden', revealCondition: v })}
              placeholder="flag text, loc_id, npc_id, or quest_id"
            />
          )}
          <TextField
            label="Teaser"
            value={discovery?.teaser ?? ''}
            onChange={(v) => onChange({ ...discovery!, state: 'hidden', teaser: v })}
            placeholder="A name spoken with unease…"
          />
        </>
      )}
    </div>
  )
}

function StatBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-14 font-display text-ink-muted">{label}</span>
      <div className="flex-1 h-1.5 rounded-full bg-[#e8ca8a]/12 overflow-hidden">
        <div className="h-full bg-[#e8ca8a]" style={{ width: `${value}%` }} />
      </div>
      <span className="font-mono w-8 text-right text-ink">{value}</span>
    </div>
  )
}

function DetailField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-display text-ink-muted uppercase tracking-wide">{label}</p>
      <div className="font-narrative text-sm text-ink">{value}</div>
    </div>
  )
}

function DetailPanel({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl p-5 flex flex-col gap-4 border border-[#e8ca8a]/25 bg-transparent backdrop-blur-sm">{children}</div>
}

// TextField's textarea variant is used across every Codex CRUD form (NPCs,
// Locations, Factions, Lore, Quests, Bestiary, Items, Skills, Realm) — 30+
// call sites. Rather than thread useLongTextEditor.tsx's `edit` fn through
// every one of them as an explicit prop, it's provided once via this local
// context (set up by the main Codex component below) and consumed here, so
// every textarea gets the expand affordance automatically with zero changes
// at any individual call site.
const LongTextEditorContext = createContext<((label: string, value: string, hint?: string) => Promise<string | null>) | null>(null)

function TextField({
  label, value, onChange, textarea, placeholder,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  textarea?: boolean
  placeholder?: string
}) {
  const editLongText = useContext(LongTextEditorContext)
  const cls = 'mt-1 w-full rounded-lg border border-[#e8ca8a]/25 bg-[#e8ca8a]/[0.04] backdrop-blur-sm px-3 py-2 font-sans text-sm text-ink placeholder:text-[#e8ca8a]/35'
  return (
    <label className="block">
      <span className="flex items-center gap-2">
        <span className="text-[11px] font-display text-ink-muted uppercase tracking-wide">{label}</span>
      </span>
      {textarea ? (
        <textarea
          readOnly
          rows={3}
          value={value}
          placeholder={placeholder || 'Tap to edit in expanded view...'}
          onClick={async () => {
            if (!editLongText) return
            const result = await editLongText(label, value)
            if (result !== null) onChange(result)
          }}
          onKeyDown={async (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              if (!editLongText) return
              const result = await editLongText(label, value)
              if (result !== null) onChange(result)
            }
          }}
          className={`${cls} resize-none cursor-pointer transition-colors duration-150 hover:border-[#f0ca65]/60 hover:bg-[#e8ca8a]/[0.08]`}
        />
      ) : (
        <input value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className={cls} />
      )}
    </label>
  )
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="block">
      <span className="text-[11px] font-display text-ink-muted uppercase tracking-wide">{label}</span>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1 w-full rounded-lg border border-[#e8ca8a]/25 bg-[#e8ca8a]/[0.04] backdrop-blur-sm px-3 py-2 font-mono text-sm text-ink"
      />
    </label>
  )
}

// §9 CRUD toolbar — swaps between "view" (Edit/Delete) and "edit" (Save/Cancel)
// affordances, shown next to the header title on any editable detail view.
function CrudToolbar({
  editing, canDelete, onEdit, onSave, onCancel, onDelete,
}: {
  editing: boolean
  canDelete: boolean
  onEdit: () => void
  onSave: () => void
  onCancel: () => void
  onDelete: () => void
}) {
  if (editing) {
    return (
      <div className="flex items-center gap-1 ml-auto">
        <GlassIconButton icon={X} label="Cancel" compact onClick={onCancel} />
        <GlassIconButton icon={Save} label="Save" tone="action" compact onClick={onSave} />
      </div>
    )
  }
  return (
    <div className="flex items-center gap-1 ml-auto">
      <GlassIconButton icon={Pencil} label="Edit" compact onClick={onEdit} />
      {canDelete && <GlassIconButton icon={Trash2} label="Delete" tone="danger" compact onClick={onDelete} />}
    </div>
  )
}

// §6.4D card badge — MP/ST cost pill in the same cool indigo the [Active
// Skill] markup uses inline in narration (§4.2), so a skill reads as the same
// category of thing whether you meet it in prose or in the Codex.
function SkillCostBadge({ skill }: { skill: SkillEntry }) {
  const parts = [skill.mpCost ? `${skill.mpCost} MP` : null, skill.stCost ? `${skill.stCost} ST` : null].filter(Boolean)
  if (!parts.length) return null
  return (
    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-skill/40 bg-skill-bg text-skill">
      {parts.join(' · ')}
    </span>
  )
}

function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className={DASHED_ROW_CLASS}>
      <Plus size={14} /> {label}
    </button>
  )
}

// ---------------------------------------------------------------------------
// Modern-card redesign (2026-09-04) — one accent identity per real CRUD
// category, following the same "hero card" recipe MainMenu's Vault grid and
// PresetDetailModal.tsx already established for Worlds (cyan) and
// Protagonists (purple): a dark hue-tinted card fill, a brighter border on
// hover, an icon badge, and a soft directional glow. Every className string
// below is written out in full rather than built from a shared hex variable
// — Tailwind's build-time scanner only picks up literal class text in the
// source, so a `` `border-[${accent.hex}]/35` `` built at runtime would
// silently never get its CSS generated. This mirrors how MainMenu's own
// cyan/purple cards are written (also full literal strings, not templated).
type CoreCategoryId = 'npcs' | 'factions' | 'locations' | 'lore' | 'quests' | 'bestiary' | 'skills' | 'items'

interface CategoryAccent {
  icon: LucideIcon
  card: string // full list-card className (border/fill/hover/glow)
  iconBadge: string
  kicker: string // small uppercase label under the title
  badge: string // pill badge (default/auto-tagged/etc.)
  sectionIcon: string // just the icon color, for section-card headers
  tag: string // a single tag chip
  solid?: string // a solid fill in the accent hue, for meters/stat tiles
  activeTab: string // styling for active category subtab
}

const CATEGORY_ACCENTS: Record<CoreCategoryId, CategoryAccent> = {
  npcs: {
    icon: Users,
    card: `${GLASS_SURFACE_LIST} bg-[#131622]/90 border-[#23283b] rounded-xl p-3 flex flex-col gap-1.5 transition-all duration-200 hover:border-[#fb7185]/80 hover:bg-[#191c2c] hover:shadow-[0_4px_16px_rgba(251,113,133,0.2)] cursor-pointer group`,
    iconBadge: 'w-8 h-8 rounded-xl bg-[#1b1f2e] border border-[#2b3145] flex items-center justify-center text-[#fb7185] shrink-0 group-hover:scale-105 group-hover:border-[#fb7185]/60 group-hover:bg-[#2e1823] transition-all',
    kicker: 'font-mono text-[9px] text-[#a0a5b8] uppercase tracking-wider group-hover:text-[#fb7185]/90',
    badge: 'rounded-lg bg-[#1a1d2b] border border-[#2d3348] text-[#a0a5b8] px-2.5 py-0.5 text-[11px] font-mono shrink-0 group-hover:border-[#fb7185]/60 group-hover:text-[#fecdd3] group-hover:bg-[#fb7185]/20 transition-all',
    sectionIcon: 'text-[#fb7185]',
    tag: 'rounded-full border border-[#fb7185]/35 bg-[#fb7185]/10 px-1.5 py-0.25 text-[9px] font-mono text-[#fecdd3]',
    activeTab: 'bg-[#fb7185]/20 text-[#fecdd3] border-[#fb7185]/60 shadow-[0_0_12px_rgba(251,113,133,0.25)]',
  },
  factions: {
    icon: ShieldCheck,
    card: `${GLASS_SURFACE_LIST} bg-[#131622]/90 border-[#23283b] rounded-xl p-3 flex flex-col gap-1.5 transition-all duration-200 hover:border-[#fbbf24]/80 hover:bg-[#191c2c] hover:shadow-[0_4px_16px_rgba(251,191,36,0.2)] cursor-pointer group`,
    iconBadge: 'w-8 h-8 rounded-xl bg-[#1b1f2e] border border-[#2b3145] flex items-center justify-center text-[#fbbf24] shrink-0 group-hover:scale-105 group-hover:border-[#fbbf24]/60 group-hover:bg-[#2b2414] transition-all',
    kicker: 'font-mono text-[9px] text-[#a0a5b8] uppercase tracking-wider group-hover:text-[#fde68a]/90',
    badge: 'rounded-lg bg-[#1a1d2b] border border-[#2d3348] text-[#a0a5b8] px-2.5 py-0.5 text-[11px] font-mono shrink-0 group-hover:border-[#fbbf24]/60 group-hover:text-[#fde68a] group-hover:bg-[#fbbf24]/20 transition-all',
    sectionIcon: 'text-[#fbbf24]',
    tag: 'rounded-full border border-[#fbbf24]/35 bg-[#fbbf24]/10 px-1.5 py-0.25 text-[9px] font-mono text-[#fde68a]',
    solid: 'bg-[#fbbf24]',
    activeTab: 'bg-[#fbbf24]/20 text-[#fde68a] border-[#fbbf24]/60 shadow-[0_0_12px_rgba(251,191,36,0.25)]',
  },
  locations: {
    icon: Map,
    card: `${GLASS_SURFACE_LIST} bg-[#131622]/90 border-[#23283b] rounded-xl p-3 flex flex-col gap-1.5 transition-all duration-200 hover:border-[#38bdf8]/80 hover:bg-[#191c2c] hover:shadow-[0_4px_16px_rgba(56,189,248,0.2)] cursor-pointer group`,
    iconBadge: 'w-8 h-8 rounded-xl bg-[#1b1f2e] border border-[#2b3145] flex items-center justify-center text-[#38bdf8] shrink-0 group-hover:scale-105 group-hover:border-[#38bdf8]/60 group-hover:bg-[#142636] transition-all',
    kicker: 'font-mono text-[9px] text-[#a0a5b8] uppercase tracking-wider group-hover:text-[#7dd3fc]/90',
    badge: 'rounded-lg bg-[#1a1d2b] border border-[#2d3348] text-[#a0a5b8] px-2.5 py-0.5 text-[11px] font-mono shrink-0 group-hover:border-[#38bdf8]/60 group-hover:text-[#7dd3fc] group-hover:bg-[#38bdf8]/20 transition-all',
    sectionIcon: 'text-[#38bdf8]',
    tag: 'rounded-full border border-[#38bdf8]/35 bg-[#38bdf8]/10 px-1.5 py-0.25 text-[9px] font-mono text-[#7dd3fc]',
    activeTab: 'bg-[#38bdf8]/20 text-[#7dd3fc] border-[#38bdf8]/60 shadow-[0_0_12px_rgba(56,189,248,0.25)]',
  },
  lore: {
    icon: ScrollText,
    card: `${GLASS_SURFACE_LIST} bg-[#131622]/90 border-[#23283b] rounded-xl p-3 flex flex-col gap-1.5 transition-all duration-200 hover:border-[#c084fc]/80 hover:bg-[#191c2c] hover:shadow-[0_4px_16px_rgba(192,132,252,0.2)] cursor-pointer group`,
    iconBadge: 'w-8 h-8 rounded-xl bg-[#1b1f2e] border border-[#2b3145] flex items-center justify-center text-[#c084fc] shrink-0 group-hover:scale-105 group-hover:border-[#c084fc]/60 group-hover:bg-[#251838] transition-all',
    kicker: 'font-mono text-[9px] text-[#a0a5b8] uppercase tracking-wider group-hover:text-[#d8b4fe]/90',
    badge: 'rounded-lg bg-[#1a1d2b] border border-[#2d3348] text-[#a0a5b8] px-2.5 py-0.5 text-[11px] font-mono shrink-0 group-hover:border-[#c084fc]/60 group-hover:text-[#d8b4fe] group-hover:bg-[#c084fc]/20 transition-all',
    sectionIcon: 'text-[#c084fc]',
    tag: 'rounded-full border border-[#c084fc]/35 bg-[#c084fc]/10 px-1.5 py-0.25 text-[9px] font-mono text-[#d8b4fe]',
    activeTab: 'bg-[#c084fc]/20 text-[#d8b4fe] border-[#c084fc]/60 shadow-[0_0_12px_rgba(192,132,252,0.25)]',
  },
  quests: {
    icon: Target,
    card: `${GLASS_SURFACE_LIST} bg-[#131622]/90 border-[#23283b] rounded-xl p-3 flex flex-col gap-1.5 transition-all duration-200 hover:border-[#34d399]/80 hover:bg-[#191c2c] hover:shadow-[0_4px_16px_rgba(52,211,153,0.2)] cursor-pointer group`,
    iconBadge: 'w-8 h-8 rounded-xl bg-[#1b1f2e] border border-[#2b3145] flex items-center justify-center text-[#34d399] shrink-0 group-hover:scale-105 group-hover:border-[#34d399]/60 group-hover:bg-[#142e23] transition-all',
    kicker: 'font-mono text-[9px] text-[#a0a5b8] uppercase tracking-wider group-hover:text-[#6ee7b7]/90',
    badge: 'rounded-lg bg-[#1a1d2b] border border-[#2d3348] text-[#a0a5b8] px-2.5 py-0.5 text-[11px] font-mono shrink-0 group-hover:border-[#34d399]/60 group-hover:text-[#6ee7b7] group-hover:bg-[#34d399]/20 transition-all',
    sectionIcon: 'text-[#34d399]',
    tag: 'rounded-full border border-[#34d399]/35 bg-[#34d399]/10 px-1.5 py-0.25 text-[9px] font-mono text-[#6ee7b7]',
    activeTab: 'bg-[#34d399]/20 text-[#6ee7b7] border-[#34d399]/60 shadow-[0_0_12px_rgba(52,211,153,0.25)]',
  },
  bestiary: {
    icon: Skull,
    card: `${GLASS_SURFACE_LIST} bg-[#131622]/90 border-[#23283b] rounded-xl p-3 flex flex-col gap-1.5 transition-all duration-200 hover:border-[#ef4444]/80 hover:bg-[#191c2c] hover:shadow-[0_4px_16px_rgba(239,68,68,0.2)] cursor-pointer group`,
    iconBadge: 'w-8 h-8 rounded-xl bg-[#1b1f2e] border border-[#2b3145] flex items-center justify-center text-[#ef4444] shrink-0 group-hover:scale-105 group-hover:border-[#ef4444]/60 group-hover:bg-[#2e1414] transition-all',
    kicker: 'font-mono text-[9px] text-[#a0a5b8] uppercase tracking-wider group-hover:text-[#fca5a5]/90',
    badge: 'rounded-lg bg-[#1a1d2b] border border-[#2d3348] text-[#a0a5b8] px-2.5 py-0.5 text-[11px] font-mono shrink-0 group-hover:border-[#ef4444]/60 group-hover:text-[#fca5a5] group-hover:bg-[#ef4444]/20 transition-all',
    sectionIcon: 'text-[#ef4444]',
    tag: 'rounded-full border border-[#ef4444]/35 bg-[#ef4444]/10 px-1.5 py-0.25 text-[9px] font-mono text-[#fca5a5]',
    solid: 'bg-[#ef4444]',
    activeTab: 'bg-[#ef4444]/20 text-[#fca5a5] border-[#ef4444]/60 shadow-[0_0_12px_rgba(239,68,68,0.25)]',
  },
  skills: {
    icon: Sparkles,
    card: `${GLASS_SURFACE_LIST} bg-[#131622]/90 border-[#23283b] rounded-xl p-3 flex flex-col gap-1.5 transition-all duration-200 hover:border-[#818cf8]/80 hover:bg-[#191c2c] hover:shadow-[0_4px_16px_rgba(129,140,248,0.2)] cursor-pointer group`,
    iconBadge: 'w-8 h-8 rounded-xl bg-[#1b1f2e] border border-[#2b3145] flex items-center justify-center text-[#818cf8] shrink-0 group-hover:scale-105 group-hover:border-[#818cf8]/60 group-hover:bg-[#1e1a38] transition-all',
    kicker: 'font-mono text-[9px] text-[#a0a5b8] uppercase tracking-wider group-hover:text-[#c7d2fe]/90',
    badge: 'rounded-lg bg-[#1a1d2b] border border-[#2d3348] text-[#a0a5b8] px-2.5 py-0.5 text-[11px] font-mono shrink-0 group-hover:border-[#818cf8]/60 group-hover:text-[#c7d2fe] group-hover:bg-[#818cf8]/20 transition-all',
    sectionIcon: 'text-[#818cf8]',
    tag: 'rounded-full border border-[#818cf8]/35 bg-[#818cf8]/10 px-1.5 py-0.25 text-[9px] font-mono text-[#c7d2fe]',
    activeTab: 'bg-[#818cf8]/20 text-[#c7d2fe] border-[#818cf8]/60 shadow-[0_0_12px_rgba(129,140,248,0.25)]',
  },
  items: {
    icon: Backpack,
    card: `${GLASS_SURFACE_LIST} bg-[#131622]/90 border-[#23283b] rounded-xl p-3 flex flex-col gap-1.5 transition-all duration-200 hover:border-[#f0ca65]/80 hover:bg-[#191c2c] hover:shadow-[0_4px_16px_rgba(240,202,101,0.2)] cursor-pointer group`,
    iconBadge: 'w-8 h-8 rounded-xl bg-[#1b1f2e] border border-[#2b3145] flex items-center justify-center text-[#f0ca65] shrink-0 group-hover:scale-105 group-hover:border-[#f0ca65]/60 group-hover:bg-[#2b2414] transition-all',
    kicker: 'font-mono text-[9px] text-[#a0a5b8] uppercase tracking-wider group-hover:text-[#fae5b5]/90',
    badge: 'rounded-lg bg-[#1a1d2b] border border-[#2d3348] text-[#a0a5b8] px-2.5 py-0.5 text-[11px] font-mono shrink-0 group-hover:border-[#f0ca65]/60 group-hover:text-[#fae5b5] group-hover:bg-[#f0ca65]/20 transition-all',
    sectionIcon: 'text-[#f0ca65]',
    tag: 'rounded-full border border-[#f0ca65]/35 bg-[#f0ca65]/10 px-1.5 py-0.25 text-[9px] font-mono text-[#fae5b5]',
    activeTab: 'bg-[#f0ca65]/20 text-[#fae5b5] border-[#f0ca65]/60 shadow-[0_0_12px_rgba(240,202,101,0.25)]',
  },
}

// For the non-CRUD categories (Character/Realm/Crafting/Chapters) at the
// top-level category grid — a shared gold-accent identity matching the sleek dark deck.
const NEUTRAL_ACCENT: CategoryAccent = {
  icon: Globe,
  card: `${GLASS_SURFACE_LIST} bg-[#131622]/90 border-[#23283b] rounded-xl p-3 flex flex-col gap-1.5 transition-all duration-200 hover:border-[#f0ca65]/80 hover:bg-[#191c2c] hover:shadow-[0_4px_16px_rgba(240,202,101,0.18)] cursor-pointer group`,
  iconBadge: 'w-8 h-8 rounded-xl bg-[#1b1f2e] border border-[#2b3145] flex items-center justify-center text-[#e8ca8a] shrink-0 group-hover:scale-105 group-hover:border-[#f0ca65]/60 group-hover:text-[#f0ca65] group-hover:bg-[#2b2414] transition-all',
  kicker: 'font-mono text-[9px] text-[#a0a5b8] uppercase tracking-wider group-hover:text-[#fae5b5]/90',
  badge: 'rounded-lg bg-[#1a1d2b] border border-[#2d3348] text-[#a0a5b8] px-2.5 py-0.5 text-[11px] font-mono shrink-0 group-hover:border-[#f0ca65]/60 group-hover:text-[#fae5b5] group-hover:bg-[#f0ca65]/20 transition-all',
  sectionIcon: 'text-[#e8ca8a]',
  tag: 'rounded-full border border-[#e8ca8a]/35 bg-[#e8ca8a]/10 px-1.5 py-0.25 text-[9px] font-mono text-[#fae5b5]',
  activeTab: 'bg-[#f0ca65]/20 text-[#fae5b5] border-[#f0ca65]/60 shadow-[0_0_12px_rgba(240,202,101,0.25)]',
}

// Item rarity gets its own accent set, in the same shape as CATEGORY_ACCENTS
// — the classic loot-tier convention (grey/green/blue/purple/gold border and
// glow, rising in intensity) reads instantly to anyone who's played an RPG,
// and does more to distinguish one item from another than a single flat
// "gold = item" color ever could. Falls back to CATEGORY_ACCENTS.items
// (plain gold) when `rarity` is unset or doesn't match one of these five.
const ITEM_RARITY_ACCENTS: Record<string, CategoryAccent> = {
  common: {
    icon: Backpack,
    card: `${GLASS_SURFACE_LIST} bg-[#131622]/90 border-[#2d3348] rounded-xl p-3 flex flex-col gap-1.5 transition-all duration-200 hover:border-[#9ca3af]/80 hover:bg-[#191c2c] hover:shadow-[0_4px_16px_rgba(156,163,175,0.15)] cursor-pointer group`,
    iconBadge: 'w-8 h-8 rounded-xl bg-[#1b1f2e] border border-[#2b3145] flex items-center justify-center text-[#9ca3af] shrink-0 group-hover:scale-105 group-hover:border-[#9ca3af]/60 transition-all',
    kicker: 'font-mono text-[9px] text-[#a0a5b8] uppercase tracking-wider group-hover:text-[#d1d5db]',
    badge: 'rounded-lg bg-[#1a1d2b] border border-[#2d3348] text-[#a0a5b8] px-2.5 py-0.5 text-[11px] font-mono shrink-0 group-hover:border-[#9ca3af]/60 group-hover:text-[#d1d5db] transition-all',
    sectionIcon: 'text-[#9ca3af]',
    tag: 'rounded-full border border-[#9ca3af]/35 bg-[#9ca3af]/10 px-1.5 py-0.25 text-[9px] font-mono text-[#d1d5db]',
    activeTab: 'bg-[#9ca3af]/20 text-[#d1d5db] border-[#9ca3af]/60',
  },
  uncommon: {
    icon: Backpack,
    card: `${GLASS_SURFACE_LIST} bg-[#131622]/90 border-[#23283b] rounded-xl p-3 flex flex-col gap-1.5 transition-all duration-200 hover:border-[#4ade80]/80 hover:bg-[#191c2c] hover:shadow-[0_4px_16px_rgba(74,222,128,0.2)] cursor-pointer group`,
    iconBadge: 'w-8 h-8 rounded-xl bg-[#1b1f2e] border border-[#2b3145] flex items-center justify-center text-[#4ade80] shrink-0 group-hover:scale-105 group-hover:border-[#4ade80]/60 group-hover:bg-[#142e23] transition-all',
    kicker: 'font-mono text-[9px] text-[#a0a5b8] uppercase tracking-wider group-hover:text-[#86efac]',
    badge: 'rounded-lg bg-[#1a1d2b] border border-[#2d3348] text-[#a0a5b8] px-2.5 py-0.5 text-[11px] font-mono shrink-0 group-hover:border-[#4ade80]/60 group-hover:text-[#86efac] group-hover:bg-[#4ade80]/20 transition-all',
    sectionIcon: 'text-[#4ade80]',
    tag: 'rounded-full border border-[#4ade80]/35 bg-[#4ade80]/10 px-1.5 py-0.25 text-[9px] font-mono text-[#86efac]',
    activeTab: 'bg-[#4ade80]/20 text-[#86efac] border-[#4ade80]/60',
  },
  rare: {
    icon: Backpack,
    card: `${GLASS_SURFACE_LIST} bg-[#131622]/90 border-[#23283b] rounded-xl p-3 flex flex-col gap-1.5 transition-all duration-200 hover:border-[#60a5fa]/80 hover:bg-[#191c2c] hover:shadow-[0_4px_16px_rgba(96,165,250,0.2)] cursor-pointer group`,
    iconBadge: 'w-8 h-8 rounded-xl bg-[#1b1f2e] border border-[#2b3145] flex items-center justify-center text-[#60a5fa] shrink-0 group-hover:scale-105 group-hover:border-[#60a5fa]/60 group-hover:bg-[#142636] transition-all',
    kicker: 'font-mono text-[9px] text-[#a0a5b8] uppercase tracking-wider group-hover:text-[#93c5fd]',
    badge: 'rounded-lg bg-[#1a1d2b] border border-[#2d3348] text-[#a0a5b8] px-2.5 py-0.5 text-[11px] font-mono shrink-0 group-hover:border-[#60a5fa]/60 group-hover:text-[#93c5fd] group-hover:bg-[#60a5fa]/20 transition-all',
    sectionIcon: 'text-[#60a5fa]',
    tag: 'rounded-full border border-[#60a5fa]/35 bg-[#60a5fa]/10 px-1.5 py-0.25 text-[9px] font-mono text-[#93c5fd]',
    activeTab: 'bg-[#60a5fa]/20 text-[#93c5fd] border-[#60a5fa]/60',
  },
  epic: {
    icon: Backpack,
    card: `${GLASS_SURFACE_LIST} bg-[#131622]/90 border-[#23283b] rounded-xl p-3 flex flex-col gap-1.5 transition-all duration-200 hover:border-[#c084fc]/80 hover:bg-[#191c2c] hover:shadow-[0_4px_16px_rgba(192,132,252,0.25)] cursor-pointer group`,
    iconBadge: 'w-8 h-8 rounded-xl bg-[#1b1f2e] border border-[#2b3145] flex items-center justify-center text-[#c084fc] shrink-0 group-hover:scale-105 group-hover:border-[#c084fc]/60 group-hover:bg-[#251838] transition-all',
    kicker: 'font-mono text-[9px] text-[#a0a5b8] uppercase tracking-wider group-hover:text-[#d8b4fe]',
    badge: 'rounded-lg bg-[#1a1d2b] border border-[#2d3348] text-[#a0a5b8] px-2.5 py-0.5 text-[11px] font-mono shrink-0 group-hover:border-[#c084fc]/60 group-hover:text-[#d8b4fe] group-hover:bg-[#c084fc]/20 transition-all',
    sectionIcon: 'text-[#c084fc]',
    tag: 'rounded-full border border-[#c084fc]/35 bg-[#c084fc]/10 px-1.5 py-0.25 text-[9px] font-mono text-[#d8b4fe]',
    activeTab: 'bg-[#c084fc]/20 text-[#d8b4fe] border-[#c084fc]/60',
  },
  legendary: {
    icon: Backpack,
    card: `${GLASS_SURFACE_LIST} bg-[#131622]/90 border-[#fbbf24]/40 rounded-xl p-3 flex flex-col gap-1.5 transition-all duration-200 hover:border-[#fbbf24]/90 hover:bg-[#191c2c] hover:shadow-[0_4px_20px_rgba(251,191,36,0.35)] cursor-pointer group`,
    iconBadge: 'w-8 h-8 rounded-xl bg-[#1b1f2e] border border-[#fbbf24]/40 flex items-center justify-center text-[#fbbf24] shrink-0 group-hover:scale-105 group-hover:border-[#fbbf24]/70 group-hover:bg-[#2b2414] transition-all',
    kicker: 'font-mono text-[9px] text-[#a0a5b8] uppercase tracking-wider group-hover:text-[#fde68a]',
    badge: 'rounded-lg bg-[#1a1d2b] border border-[#fbbf24]/40 text-[#a0a5b8] px-2.5 py-0.5 text-[11px] font-mono shrink-0 group-hover:border-[#fbbf24]/70 group-hover:text-[#fde68a] group-hover:bg-[#fbbf24]/20 transition-all',
    sectionIcon: 'text-[#fbbf24]',
    tag: 'rounded-full border border-[#fbbf24]/40 bg-[#fbbf24]/15 px-1.5 py-0.25 text-[9px] font-mono text-[#fde68a]',
    activeTab: 'bg-[#fbbf24]/20 text-[#fde68a] border-[#fbbf24]/60',
  },
}

function itemAccentFor(rarity: string | undefined): CategoryAccent {
  const key = rarity?.toLowerCase().trim()
  return (key && ITEM_RARITY_ACCENTS[key]) || CATEGORY_ACCENTS.items
}

// A small numeric stat tile — Bestiary's HP/Base Damage, side by side, read
// like a monster-manual stat block rather than another label/value row.
function StatTile({ label, value, accent }: { label: string; value: string | number; accent: CategoryAccent }) {
  return (
    <div className="flex-1 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-center">
      <div className={`font-display font-bold text-lg leading-tight ${accent.sectionIcon}`}>{value}</div>
      <div className="font-mono text-[9px] uppercase tracking-wider text-ink-muted mt-0.5">{label}</div>
    </div>
  )
}

// §5.4's 5-Tier scale (lib/factions.ts's REP_TIER_LABELS) as a segmented
// gauge — Hostile through Allied filled up to the current tier, the same
// "reputation meter" convention most RPGs use instead of a bare number.
const REP_TIER_STEPS = [-2, -1, 0, 1, 2]
function ReputationMeter({ tier, accent }: { tier: number; accent: CategoryAccent }) {
  const clamped = Math.max(-2, Math.min(2, Math.round(tier)))
  return (
    <div className="flex gap-1 mt-1">
      {REP_TIER_STEPS.map((step) => (
        <div key={step} className={`flex-1 h-2 rounded-full ${step <= clamped ? (accent.solid ?? 'bg-[#e8ca8a]') : 'bg-white/10'}`} />
      ))}
    </div>
  )
}

// A quest'status as a colored ribbon — the checklist/tracker feel a quest
// log needs, rather than plain status text sitting next to everything else.
const QUEST_STATUS_META: Record<string, { label: string; icon: LucideIcon; className: string }> = {
  completed: { label: 'Completed', icon: CheckCircle2, className: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40' },
  failed: { label: 'Failed', icon: XCircle, className: 'bg-rose-500/15 text-rose-300 border-rose-500/40' },
  advanced: { label: 'In Progress', icon: ArrowRight, className: 'bg-[#34d399]/15 text-[#6ee7b7] border-[#34d399]/40' },
}
function QuestStatusBadge({ status }: { status?: string }) {
  const meta = QUEST_STATUS_META[status ?? ''] ?? { label: status || 'Active', icon: Target, className: 'bg-[#34d399]/15 text-[#6ee7b7] border-[#34d399]/40' }
  const Icon = meta.icon
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-mono uppercase tracking-wide shrink-0 ${meta.className}`}>
      <Icon size={11} /> {meta.label}
    </span>
  )
}

// Main/Side/Ambition/Secret Ambition — a second, independent badge alongside
// status: status tracks progress, type tracks who the quest belongs to
// (the game world, a guild, or the player's own personal goals).
const QUEST_TYPE_META: Record<string, { label: string; icon: LucideIcon; className: string }> = {
  main: { label: 'Main', icon: Swords, className: 'bg-[#e8ca8a]/15 text-[#f5dfa0] border-[#e8ca8a]/40' },
  side: { label: 'Side', icon: Users, className: 'bg-sky-500/15 text-sky-300 border-sky-500/40' },
  ambition: { label: 'Ambition', icon: Star, className: 'bg-violet-500/15 text-violet-300 border-violet-500/40' },
  secret_ambition: { label: 'Secret Ambition', icon: EyeOff, className: 'bg-rose-500/15 text-rose-300 border-rose-500/40' },
}
function QuestTypeBadge({ type }: { type?: string }) {
  const meta = type ? QUEST_TYPE_META[type] : undefined
  if (!meta) return null
  const Icon = meta.icon
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-mono uppercase tracking-wide shrink-0 ${meta.className}`}>
      <Icon size={11} /> {meta.label}
    </span>
  )
}

// The list-view "deck card" — mobile-first, shows Entry name + prominent description,
// with Lucide icons, status pill, and compact meta chips.
interface MetaChip {
  icon?: LucideIcon
  label: string
}

function DeckEntryCard({
  accent, icon, title, kicker, statusBadge, subtitle, badge, metaChips, tags, onClick,
}: {
  accent: CategoryAccent
  icon?: LucideIcon
  title: string
  kicker?: string
  statusBadge?: React.ReactNode
  subtitle?: string
  badge?: React.ReactNode
  metaChips?: MetaChip[]
  tags?: string[]
  onClick: () => void
}) {
  const Icon = icon ?? accent.icon
  return (
    <div
      onClick={onClick}
      className={`${accent.card} p-3 sm:p-3.5 flex flex-col gap-2 rounded-xl transition-all duration-200 cursor-pointer active:scale-[0.99]`}
    >
      {/* Title & Badge Row */}
      <div className="flex items-start justify-between gap-2.5">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <div className={accent.iconBadge}>
            <Icon size={15} />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-display font-bold text-xs sm:text-sm text-[#fae5b5] group-hover:text-[#fde68a] uppercase tracking-wider truncate">
              {title}
            </h3>
            {kicker && (
              <p className={`${accent.kicker} truncate mt-0.5`}>
                {kicker}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {statusBadge}
          {badge}
        </div>
      </div>

      {/* Main Description (Prominent, Compact, High Readability) */}
      {subtitle && (
        <p className="font-narrative text-xs text-[#d2d6e4] group-hover:text-[#f1f3f9] line-clamp-2 leading-relaxed">
          {subtitle}
        </p>
      )}

      {/* Meta Chips & Tags Row */}
      {((metaChips && metaChips.length > 0) || (tags && tags.length > 0)) && (
        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
          {metaChips?.map((chip, idx) => {
            const ChipIcon = chip.icon
            return (
              <span
                key={idx}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#181d2a] border border-[#2c3349] text-[10px] font-mono text-[#a5adc6]"
              >
                {ChipIcon && <ChipIcon size={10} className={accent.sectionIcon} />}
                <span className="truncate max-w-[140px]">{chip.label}</span>
              </span>
            )
          })}
          {tags?.slice(0, 3).map((t) => (
            <span key={t} className={accent.tag}>
              #{t}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

// Modern horizontal subtab navigator for category entries.
interface SubtabItem {
  id: string
  label: string
  count?: number
  icon?: LucideIcon
}

function SubtabsBar({
  tabs,
  activeTab,
  onSelectTab,
  accent,
}: {
  tabs: SubtabItem[]
  activeTab: string
  onSelectTab: (id: string) => void
  accent: CategoryAccent
}) {
  return (
    <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1 px-0.5 -mx-0.5 shrink-0 scroll-smooth">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id
        const Icon = tab.icon
        return (
          <button
            key={tab.id}
            onClick={() => onSelectTab(tab.id)}
            type="button"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-medium shrink-0 transition-all border cursor-pointer active:scale-95 ${
              isActive
                ? `${accent.activeTab} font-semibold`
                : 'bg-[#141724]/90 border-[#262c3e] text-[#8e94a8] hover:text-[#cdd2e5] hover:border-[#384058] hover:bg-[#1a1f30]'
            }`}
          >
            {Icon && <Icon size={12} className={isActive ? accent.sectionIcon : 'text-[#7e8498]'} />}
            <span>{tab.label}</span>
            {tab.count !== undefined && (
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                  isActive ? 'bg-black/30 text-ink' : 'bg-[#1e2333] text-[#72788e]'
                }`}
              >
                {tab.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

// The detail-view "hero header" — an icon avatar + title + subtitle
function EntryHeroHeader({
  accent, title, subtitle, badges,
}: {
  accent: CategoryAccent
  title: string
  subtitle?: string
  badges?: React.ReactNode
}) {
  const Icon = accent.icon
  return (
    <div className={`${accent.card.split(' cursor-pointer')[0]} !p-4 flex items-start gap-3 mb-3`}>
      <div className={accent.iconBadge}>
        <Icon size={18} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          <h2 className="font-display font-bold text-base text-ink truncate">{title}</h2>
          {badges}
        </div>
        {subtitle && <p className="font-narrative italic text-xs text-ink-muted mt-0.5 line-clamp-2">{subtitle}</p>}
      </div>
    </div>
  )
}

// A resting content card inside the detail view — bespoke tailored container
function SectionCard({
  accent, icon, title, badge, children,
}: {
  accent: CategoryAccent
  icon: LucideIcon
  title: string
  badge?: React.ReactNode
  children: React.ReactNode
}) {
  const Icon = icon
  return (
    <div className="bg-[#141826]/90 border border-[#272d42] rounded-xl p-3.5 sm:p-4 flex flex-col gap-3 shadow-[0_2px_12px_rgba(0,0,0,0.3)]">
      <div className="flex items-center justify-between gap-2 pb-2 border-b border-[#252a3d]">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-[#1a1f30] border border-[#2d344d] flex items-center justify-center shrink-0">
            <Icon size={13} className={accent.sectionIcon} />
          </div>
          <span className="font-display text-xs font-semibold uppercase tracking-[0.14em] text-[#fae5b5]">{title}</span>
        </div>
        {badge}
      </div>
      {children}
    </div>
  )
}

// Field label/value pair — concise and controlled
function FieldRow({ label, value, icon }: { label: string; value: React.ReactNode; icon?: LucideIcon }) {
  if (value === undefined || value === null || value === '') return null
  const Icon = icon
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center gap-1.5">
        {Icon && <Icon size={11} className="text-[#a0a5b8]" />}
        <span className="font-display text-[10px] uppercase tracking-wider text-[#a0a5b8] font-semibold">{label}</span>
      </div>
      <div className="font-narrative text-xs text-[#f4efe4] leading-relaxed break-words">{value}</div>
    </div>
  )
}

function TagPills({ tags, accent }: { tags: string[] | undefined; accent: CategoryAccent }) {
  if (!tags || tags.length === 0) return null
  return (
    <div className="flex flex-wrap gap-1.5">
      {tags.map((t) => (
        <span key={t} className={accent.tag}>{t}</span>
      ))}
    </div>
  )
}

// Freeform comma-separated tags input — parses to/from string[] so the CRUD
// draft state (a plain Record<string, any>) can keep storing the same shape
// the rest of the app persists, without a dedicated multi-select widget.
function TagsField({ value, onChange }: { value: string[] | undefined; onChange: (tags: string[]) => void }) {
  return (
    <label className="block">
      <span className="text-[11px] font-display text-ink-muted uppercase tracking-wide">Tags (comma-separated)</span>
      <input
        value={(value ?? []).join(', ')}
        onChange={(e) => onChange(e.target.value.split(',').map((t) => t.trim()).filter(Boolean))}
        placeholder="mentor, romance, hidden agenda"
        className="mt-1 w-full rounded-lg border border-[#e8ca8a]/25 bg-[#e8ca8a]/[0.04] backdrop-blur-sm px-3 py-2 font-narrative text-sm text-ink placeholder:text-[#e8ca8a]/35"
      />
    </label>
  )
}

// Blueprint §6.4D — Category List -> Entry Grid -> Entry Detail. Discovery
// masking (§5.12) is implemented (see isHidden/MaskedDetail/DiscoveryEditor
// above) — an entry only ever becomes hidden via hand-authored CRUD, though,
// since there is still no seeding/grounding call that pre-populates masked
// lore on its own.
//
// §9 Codex CRUD — every category except Chapters (a generated recap) and
// Realm's identity fields (narration style stays owned by Settings) supports
// hand-authored add/edit/delete. `entryId === NEW_ID` is an unsaved draft.
export default function Codex({
  world,
  player,
  log,
  npcs,
  factions,
  locations,
  lore,
  quests,
  bestiary,
  flags,
  inventory,
  items,
  crafting,
  corpses,
  onUpdateNpc,
  onUpdateFaction,
  onUpdateLocation,
  onUpdateLore,
  onUpdateQuest,
  onUpdateBestiary,
  onUpdateItem,
  onEquipItem,
  onUnequipSlot,
  onUpdateWorld,
  onEvolveClass,
  onStartCraft,
  skills,
  onUpdateSkill,
  initialCategory,
  initialEntryId,
  onBack,
  onOpenCodexViewer,
}: CodexProps) {
  const [category, setCategory] = useState<CategoryId | null>(initialCategory ?? null)
  const [entryId, setEntryId] = useState<string | null>(initialEntryId ?? null)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<Record<string, any>>({})
  const { confirm, dialog: confirmDialog } = useConfirm()
  const { edit: editLongText, dialog: longTextDialog } = useLongTextEditor()

  const classNameFor = (id?: string) =>
    id
      ? PRESET_CLASSES.find((c) => c.id === id)?.name ||
        (id === player.classId && player.className
          ? player.className
          : id.includes('_')
            ? id
                .split('_')
                .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                .join(' ')
            : id)
      : undefined

  function equippedSlotFor(itemId: string): EquipSlot | undefined {
    return (Object.entries(player.equipped ?? {}) as [EquipSlot, string][]).find(([, id]) => id === itemId)?.[0]
  }

  // Search & Subtab Navigation State
  const [searchQuery, setSearchQuery] = useState('')
  const [activeSubtab, setActiveSubtab] = useState('all')

  // Reset filters on category change
  useEffect(() => {
    setSearchQuery('')
    setActiveSubtab('all')
  }, [category])

  // Unique collections for filter selectors
  const loreCategories = useMemo(() => {
    const cats = new Set<string>()
    Object.values(lore).forEach((l) => {
      if (l.category) cats.add(l.category)
    })
    return Array.from(cats)
  }, [lore])

  // Helper stage checkers
  const isAllyStage = (stage?: string) => {
    const s = (stage || '').toLowerCase()
    return ['party', 'companion', 'trusted', 'ally', 'friend', 'confidant', 'devoted'].some((k) => s.includes(k))
  }
  const isContactStage = (stage?: string) => {
    const s = (stage || '').toLowerCase()
    return ['acquaintance', 'contact', 'associate', 'neutral', 'merchant', 'informant', 'patron'].some((k) => s.includes(k))
  }
  const isStrangerStage = (stage?: string) => {
    return !isAllyStage(stage) && !isContactStage(stage)
  }

  // Helper location checkers
  const isHavenLocation = (l: LocationEntry) => {
    const danger = (l.dangerLevel || '').toLowerCase()
    const type = (l.locationType || '').toLowerCase()
    return ['safe', 'low', 'minimal'].includes(danger) || ['settlement', 'city', 'town', 'tavern', 'temple', 'haven', 'sanctuary', 'camp'].includes(type)
  }
  const isPerilLocation = (l: LocationEntry) => {
    const danger = (l.dangerLevel || '').toLowerCase()
    const type = (l.locationType || '').toLowerCase()
    return ['deadly', 'extreme', 'high', 'cursed', 'lethal'].includes(danger) || ['dungeon', 'ruin', 'cave', 'lair', 'abyss', 'crypt', 'tomb'].includes(type)
  }
  const isWildLocation = (l: LocationEntry) => {
    return !isHavenLocation(l) && !isPerilLocation(l)
  }

  // Helper bestiary threat checkers
  const isMinionTier = (tier?: string) => /low|minor|minion|nuisance|trash|scout|tier\s*1\b|tier\s*i\b/i.test(tier || '')
  const isEliteTier = (tier?: string) => /elite|boss|calamity|deadly|overlord|legendary|nemesis|tier\s*[345]\b|tier\s*(iii|iv|v)\b/i.test(tier || '')
  const isStandardTier = (tier?: string) => !isMinionTier(tier) && !isEliteTier(tier)

  // Filtered lists with both Search and Subtab criteria
  const filteredNpcs = useMemo(() => {
    return Object.entries(npcs).filter(([, n]) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        const matchesName = n.name.toLowerCase().includes(q)
        const matchesMem = n.memSummary?.toLowerCase().includes(q)
        const matchesTeaser = n.discovery?.teaser?.toLowerCase().includes(q)
        const matchesRole = n.role?.toLowerCase().includes(q)
        const matchesStage = n.stage?.toLowerCase().includes(q)
        const matchesTurn = n.loggedAt?.toLowerCase().includes(q)
        if (!matchesName && !matchesMem && !matchesTeaser && !matchesRole && !matchesStage && !matchesTurn) return false
      }
      if (activeSubtab === 'allies' && !isAllyStage(n.stage)) return false
      if (activeSubtab === 'contacts' && !isContactStage(n.stage)) return false
      if (activeSubtab === 'strangers' && !isStrangerStage(n.stage)) return false
      return true
    })
  }, [npcs, searchQuery, activeSubtab])

  const filteredFactions = useMemo(() => {
    return Object.entries(factions).filter(([, f]) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        const matchesName = f.name.toLowerCase().includes(q)
        const matchesDesc = f.description?.toLowerCase().includes(q)
        const matchesRival = f.rivalId?.toLowerCase().includes(q)
        const matchesTurn = f.loggedAt?.toLowerCase().includes(q)
        if (!matchesName && !matchesDesc && !matchesRival && !matchesTurn) return false
      }
      if (activeSubtab === 'allied' && f.repTier <= 0) return false
      if (activeSubtab === 'neutral' && f.repTier !== 0) return false
      if (activeSubtab === 'hostile' && f.repTier >= 0) return false
      return true
    })
  }, [factions, searchQuery, activeSubtab])

  const filteredLocations = useMemo(() => {
    return Object.entries(locations).filter(([, l]) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        const matchesName = l.name.toLowerCase().includes(q)
        const matchesRegion = l.region?.toLowerCase().includes(q)
        const matchesDesc = l.description?.toLowerCase().includes(q)
        const matchesType = l.locationType?.toLowerCase().includes(q)
        const matchesTurn = l.loggedAt?.toLowerCase().includes(q)
        if (!matchesName && !matchesRegion && !matchesDesc && !matchesType && !matchesTurn) return false
      }
      if (activeSubtab === 'havens' && !isHavenLocation(l)) return false
      if (activeSubtab === 'wilderness' && !isWildLocation(l)) return false
      if (activeSubtab === 'perilous' && !isPerilLocation(l)) return false
      return true
    })
  }, [locations, searchQuery, activeSubtab])

  const filteredLore = useMemo(() => {
    return Object.entries(lore).filter(([, l]) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        const matchesName = l.name.toLowerCase().includes(q)
        const matchesCat = l.category?.toLowerCase().includes(q)
        const matchesContent = l.content?.toLowerCase().includes(q)
        const matchesTurn = l.loggedAt?.toLowerCase().includes(q)
        if (!matchesName && !matchesCat && !matchesContent && !matchesTurn) return false
      }
      if (activeSubtab !== 'all' && l.category !== activeSubtab) return false
      return true
    })
  }, [lore, searchQuery, activeSubtab])

  const filteredQuests = useMemo(() => {
    return Object.entries(quests).filter(([, q_entry]) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        const matchesName = q_entry.name.toLowerCase().includes(q)
        const matchesNote = q_entry.note?.toLowerCase().includes(q)
        const matchesDesc = q_entry.description?.toLowerCase().includes(q)
        const matchesStatus = q_entry.status?.toLowerCase().includes(q)
        const matchesTurn = q_entry.loggedAt?.toLowerCase().includes(q)
        if (!matchesName && !matchesNote && !matchesDesc && !matchesStatus && !matchesTurn) return false
      }
      if (activeSubtab === 'active' && (q_entry.status === 'completed' || q_entry.status === 'failed')) return false
      if (activeSubtab === 'completed' && q_entry.status !== 'completed') return false
      if (activeSubtab === 'failed' && q_entry.status !== 'failed') return false
      if (activeSubtab === 'main' && q_entry.type !== 'main') return false
      if (activeSubtab === 'side' && q_entry.type === 'main') return false
      return true
    })
  }, [quests, searchQuery, activeSubtab])

  const filteredBestiary = useMemo(() => {
    return Object.entries(bestiary).filter(([, b]) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        const matchesName = b.name.toLowerCase().includes(q)
        const matchesTier = b.threatTier?.toLowerCase().includes(q)
        const matchesDesc = b.description?.toLowerCase().includes(q)
        const matchesHabitat = b.habitat?.toLowerCase().includes(q)
        const matchesTurn = b.loggedAt?.toLowerCase().includes(q)
        if (!matchesName && !matchesTier && !matchesDesc && !matchesHabitat && !matchesTurn) return false
      }
      if (activeSubtab === 'minions' && !isMinionTier(b.threatTier)) return false
      if (activeSubtab === 'standard' && !isStandardTier(b.threatTier)) return false
      if (activeSubtab === 'elite' && !isEliteTier(b.threatTier)) return false
      return true
    })
  }, [bestiary, searchQuery, activeSubtab])

  const filteredSkills = useMemo(() => {
    return Object.entries(skills).filter(([, s]) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        const matchesName = s.name.toLowerCase().includes(q)
        const matchesDesc = s.description?.toLowerCase().includes(q)
        const matchesFlavor = s.flavorText?.toLowerCase().includes(q)
        const matchesTurn = s.loggedAt?.toLowerCase().includes(q)
        if (!matchesName && !matchesDesc && !matchesFlavor && !matchesTurn) return false
      }
      if (activeSubtab === 'class' && (!s.classId || s.classId !== player.classId)) return false
      if (activeSubtab === 'active') {
        const isActive = (s.mpCost ?? 0) > 0 || (s.stCost ?? 0) > 0 || (s.skillType || '').toLowerCase() === 'active'
        if (!isActive) return false
      }
      if (activeSubtab === 'passive') {
        const isPassive = (s.skillType || '').toLowerCase() === 'passive' || (!(s.mpCost ?? 0) && !(s.stCost ?? 0))
        if (!isPassive) return false
      }
      return true
    })
  }, [skills, searchQuery, activeSubtab, player.classId])

  const filteredItems = useMemo(() => {
    return Object.entries(inventory).filter(([id]) => {
      const item = items[id]
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        const matchesName = (item?.name ?? id.replace(/_/g, ' ')).toLowerCase().includes(q)
        const matchesDesc = item?.description?.toLowerCase().includes(q)
        const matchesLore = item?.loreText?.toLowerCase().includes(q)
        const matchesTurn = item?.loggedAt?.toLowerCase().includes(q)
        if (!matchesName && !matchesDesc && !matchesLore && !matchesTurn) return false
      }
      if (activeSubtab === 'equipped' && !equippedSlotFor(id)) return false
      if (activeSubtab === 'weapons' && item?.type !== 'weapon') return false
      if (activeSubtab === 'armor' && item?.type !== 'armor') return false
      if (activeSubtab === 'accessories' && item?.type !== 'accessory') return false
      if (activeSubtab === 'consumables' && item?.type !== 'consumable') return false
      if (activeSubtab === 'materials' && !['material', 'tool', 'key'].includes(item?.type ?? 'material')) return false
      return true
    })
  }, [inventory, items, searchQuery, activeSubtab, player.equipped])

  // Subtabs generator per active category
  const categorySubtabs = useMemo((): SubtabItem[] => {
    if (!category) return []

    if (category === 'npcs') {
      const allCount = Object.keys(npcs).length
      const alliesCount = Object.values(npcs).filter((n) => isAllyStage(n.stage)).length
      const contactsCount = Object.values(npcs).filter((n) => isContactStage(n.stage)).length
      const strangersCount = Object.values(npcs).filter((n) => isStrangerStage(n.stage)).length
      return [
        { id: 'all', label: 'All', count: allCount, icon: Users },
        { id: 'allies', label: 'Allies & Bonds', count: alliesCount, icon: Heart },
        { id: 'contacts', label: 'Contacts', count: contactsCount, icon: User },
        { id: 'strangers', label: 'Strangers', count: strangersCount, icon: EyeOff },
      ]
    }

    if (category === 'factions') {
      const allCount = Object.keys(factions).length
      const alliedCount = Object.values(factions).filter((f) => f.repTier > 0).length
      const neutralCount = Object.values(factions).filter((f) => f.repTier === 0).length
      const hostileCount = Object.values(factions).filter((f) => f.repTier < 0).length
      return [
        { id: 'all', label: 'All', count: allCount, icon: ShieldCheck },
        { id: 'allied', label: 'Allied', count: alliedCount, icon: Shield },
        { id: 'neutral', label: 'Neutral', count: neutralCount, icon: Compass },
        { id: 'hostile', label: 'Hostile', count: hostileCount, icon: Swords },
      ]
    }

    if (category === 'locations') {
      const allCount = Object.keys(locations).length
      const havensCount = Object.values(locations).filter(isHavenLocation).length
      const wildCount = Object.values(locations).filter(isWildLocation).length
      const perilCount = Object.values(locations).filter(isPerilLocation).length
      return [
        { id: 'all', label: 'All', count: allCount, icon: Map },
        { id: 'havens', label: 'Havens & Towns', count: havensCount, icon: ShieldCheck },
        { id: 'wilderness', label: 'Wilds', count: wildCount, icon: Compass },
        { id: 'perilous', label: 'Perilous & Ruins', count: perilCount, icon: AlertTriangle },
      ]
    }

    if (category === 'lore') {
      const allCount = Object.keys(lore).length
      const tabs: SubtabItem[] = [{ id: 'all', label: 'All', count: allCount, icon: ScrollText }]
      loreCategories.forEach((cat) => {
        const count = Object.values(lore).filter((l) => l.category === cat).length
        tabs.push({ id: cat, label: cat, count, icon: BookOpen })
      })
      return tabs
    }

    if (category === 'quests') {
      const allCount = Object.keys(quests).length
      const activeCount = Object.values(quests).filter((q) => q.status !== 'completed' && q.status !== 'failed').length
      const mainCount = Object.values(quests).filter((q) => q.type === 'main').length
      const sideCount = Object.values(quests).filter((q) => q.type !== 'main').length
      const doneCount = Object.values(quests).filter((q) => q.status === 'completed').length
      return [
        { id: 'all', label: 'All', count: allCount, icon: Target },
        { id: 'active', label: 'Active', count: activeCount, icon: Zap },
        { id: 'main', label: 'Main Story', count: mainCount, icon: Star },
        { id: 'side', label: 'Side Quests', count: sideCount, icon: Compass },
        { id: 'completed', label: 'Completed', count: doneCount, icon: CheckCircle2 },
      ]
    }

    if (category === 'bestiary') {
      const allCount = Object.keys(bestiary).length
      const minionCount = Object.values(bestiary).filter((b) => isMinionTier(b.threatTier)).length
      const standardCount = Object.values(bestiary).filter((b) => isStandardTier(b.threatTier)).length
      const eliteCount = Object.values(bestiary).filter((b) => isEliteTier(b.threatTier)).length
      return [
        { id: 'all', label: 'All', count: allCount, icon: Skull },
        { id: 'minions', label: 'Minions', count: minionCount, icon: Skull },
        { id: 'standard', label: 'Beasts & Foes', count: standardCount, icon: Swords },
        { id: 'elite', label: 'Elites & Bosses', count: eliteCount, icon: Flame },
      ]
    }

    if (category === 'skills') {
      const allCount = Object.keys(skills).length
      const classCount = Object.values(skills).filter((s) => s.classId && s.classId === player.classId).length
      const activeCount = Object.values(skills).filter((s) => (s.mpCost ?? 0) > 0 || (s.stCost ?? 0) > 0 || (s.skillType || '').toLowerCase() === 'active').length
      const passiveCount = Object.values(skills).filter((s) => (s.skillType || '').toLowerCase() === 'passive' || (!(s.mpCost ?? 0) && !(s.stCost ?? 0))).length
      return [
        { id: 'all', label: 'All', count: allCount, icon: Sparkles },
        { id: 'class', label: 'Class Skills', count: classCount, icon: Star },
        { id: 'active', label: 'Spells & Arts', count: activeCount, icon: Zap },
        { id: 'passive', label: 'Passives', count: passiveCount, icon: Shield },
      ]
    }

    if (category === 'items') {
      const allCount = Object.keys(inventory).length
      const equippedCount = Object.keys(inventory).filter((id) => equippedSlotFor(id) !== undefined).length
      const weaponsCount = Object.keys(inventory).filter((id) => items[id]?.type === 'weapon').length
      const armorCount = Object.keys(inventory).filter((id) => items[id]?.type === 'armor').length
      const accessoryCount = Object.keys(inventory).filter((id) => items[id]?.type === 'accessory').length
      const consumablesCount = Object.keys(inventory).filter((id) => items[id]?.type === 'consumable').length
      const materialsCount = Object.keys(inventory).filter((id) => ['material', 'tool', 'key'].includes(items[id]?.type ?? 'material')).length
      return [
        { id: 'all', label: 'All', count: allCount, icon: Backpack },
        { id: 'equipped', label: 'Equipped', count: equippedCount, icon: ShieldCheck },
        { id: 'weapons', label: 'Weapons', count: weaponsCount, icon: Swords },
        { id: 'armor', label: 'Armor', count: armorCount, icon: Shield },
        { id: 'accessories', label: 'Relics', count: accessoryCount, icon: Sparkles },
        { id: 'consumables', label: 'Potions & Food', count: consumablesCount, icon: Heart },
        { id: 'materials', label: 'Materials', count: materialsCount, icon: Hammer },
      ]
    }

    return []
  }, [category, npcs, factions, locations, lore, loreCategories, quests, bestiary, skills, inventory, items, player])

  const currentAccent = (category ? (CATEGORY_ACCENTS as Record<string, CategoryAccent>)[category] : undefined) ?? NEUTRAL_ACCENT

  const searchFilterBar = useMemo(() => {
    if (!category || entryId || editing) return null

    if (category === 'character' || category === 'realm' || category === 'crafting' || category === 'chapters' || category === 'corpses') {
      return null
    }

    return (
      <div className="mb-4 flex flex-col gap-2 p-2.5 sm:p-3 rounded-2xl border border-[#252b3e] bg-[#0f121d]/90 shadow-[0_2px_12px_rgba(0,0,0,0.4)]">
        {/* Search Input */}
        <div className="relative flex-1">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[#7f869e] pointer-events-none">
            <Search size={14} />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search entries by name, traits, or description..."
            className="w-full text-xs h-9 rounded-xl border border-[#272d42] bg-[#141826] pl-8 pr-8 py-1.5 text-[#f4efe4] placeholder:text-[#6a7187] focus:border-[#e8ca8a]/60 outline-none transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              type="button"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#82889e] hover:text-[#f4efe4] text-xs cursor-pointer p-0.5"
            >
              <X size={13} />
            </button>
          )}
        </div>

        {/* Subtabs Bar */}
        {categorySubtabs.length > 0 && (
          <SubtabsBar
            tabs={categorySubtabs}
            activeTab={activeSubtab}
            onSelectTab={setActiveSubtab}
            accent={currentAccent}
          />
        )}
      </div>
    )
  }, [category, entryId, editing, searchQuery, activeSubtab, categorySubtabs, currentAccent])

  const chapters = log.filter((e) => e.chapterSummary)

  // Grouped by tag with a count — the same adversary type is commonly slain
  // more than once, and corpse_add's bare tag carries no identity of its own
  // to key a Dict by. A plain object, not a Map — this file imports `Map`
  // as the Locations category icon (lucide-react), shadowing the built-in.
  const corpseCountsRecord: Record<string, number> = {}
  for (const tag of corpses) corpseCountsRecord[tag] = (corpseCountsRecord[tag] ?? 0) + 1
  const corpseCounts = Object.entries(corpseCountsRecord)

  // Ordered by how often a player actually opens each category during play —
  // quests/NPCs/items/locations/bestiary are live-reference lookups made mid-turn,
  // faction/lore are occasional check-ins, chapters/realm are read once and rarely revisited.
  const categories: { id: CategoryId; label: string; description: string; icon: LucideIcon; count: number }[] = [
    { id: 'quests', label: 'Quests', description: 'Active, completed & tracked objectives', icon: Target, count: Object.keys(quests).length },
    { id: 'npcs', label: 'NPCs', description: 'Companions, allies & trust ratings', icon: Users, count: Object.keys(npcs).length },
    { id: 'skills', label: 'Skills', description: 'Spells & abilities you have learned', icon: Sparkles, count: Object.keys(skills).length },
    { id: 'items', label: 'Items', description: 'Equipment, relics & carried goods', icon: Backpack, count: Object.keys(inventory).length },
    { id: 'locations', label: 'Locations', description: 'Regions, danger levels & standing', icon: Map, count: Object.keys(locations).length },
    { id: 'bestiary', label: 'Bestiary', description: 'Adversaries encountered in the field', icon: Skull, count: Object.keys(bestiary).length },
    { id: 'corpses', label: 'Corpses', description: 'Harvestable essence — necromancy & Shadow Monarch', icon: Ghost, count: corpses.length },
    { id: 'factions', label: 'Faction', description: 'Political groups, guilds & reputation', icon: ShieldCheck, count: Object.keys(factions).length },
    { id: 'lore', label: 'Lore', description: 'Legends, myths & discovered secrets', icon: ScrollText, count: Object.keys(lore).length },
    { id: 'chapters', label: 'Chapters', description: 'Chronological recap of the tale so far', icon: BookOpen, count: chapters.length },
    { id: 'character', label: 'Character', description: 'Attributes, class & derived pools', icon: User, count: 1 },
    { id: 'crafting', label: 'Crafting', description: 'Craft items from held materials', icon: Hammer, count: crafting.length },
    { id: 'realm', label: 'Realm', description: 'Cosmology, setting, tone & core conflict', icon: Globe, count: 1 },
  ]

  function back() {
    if (editing) return cancelEdit()
    if (entryId) return setEntryId(null)
    if (category) return setCategory(null)
    onBack()
  }

  function cancelEdit() {
    setEditing(false)
    setDraft({})
    if (entryId === NEW_ID) setEntryId(null)
  }

  function startCreate(defaults: Record<string, any>) {
    setEntryId(NEW_ID)
    setDraft(defaults)
    setEditing(true)
  }

  function startEdit(id: string, entry: Record<string, any>) {
    setEntryId(id)
    setDraft({ ...entry })
    setEditing(true)
  }

  function saveNpc() {
    const id = entryId === NEW_ID ? genId(draft.name, npcs) : entryId!
    const age = typeof draft.age === 'string' ? draft.age.trim() : draft.age
    onUpdateNpc(id, {
      name: draft.name,
      gender: draft.gender?.trim() || undefined,
      age: age !== undefined && age !== '' ? Number(age) : undefined,
      stage: draft.stage,
      trust: draft.trust,
      affection: draft.affection,
      memSummary: draft.memSummary,
      deeds: typeof draft.deeds === 'string' ? draft.deeds.split(',').map((s: string) => s.trim()).filter(Boolean) : draft.deeds,
      role: draft.role?.trim() || undefined,
      appearance: draft.appearance?.trim() || undefined,
      heldWeapon: draft.heldWeapon?.trim() || undefined,
      wornArmor: draft.wornArmor?.trim() || undefined,
      personality: draft.personality?.trim() || undefined,
      voiceNotes: draft.voiceNotes?.trim() || undefined,
      factionId: draft.factionId || null,
      tags: draft.tags,
      discovery: validateDiscovery(draft.discovery, { locations, npcs, quests }),
    })
    setEntryId(id)
    setEditing(false)
  }

  function saveFaction() {
    const id = entryId === NEW_ID ? genId(draft.name, factions) : entryId!
    onUpdateFaction(id, {
      name: draft.name,
      repTier: draft.repTier,
      rivalId: draft.rivalId || null,
      description: draft.description?.trim() || undefined,
      leader: draft.leader?.trim() || undefined,
      territory: draft.territory?.trim() || undefined,
      symbol: draft.symbol?.trim() || undefined,
      tags: draft.tags,
      discovery: validateDiscovery(draft.discovery, { locations, npcs, quests }),
    })
    setEntryId(id)
    setEditing(false)
  }

  function saveLocation() {
    const id = entryId === NEW_ID ? genId(draft.name, locations) : entryId!
    onUpdateLocation(id, {
      name: draft.name,
      region: draft.region,
      description: draft.description,
      dangerLevel: draft.dangerLevel,
      factionOwner: draft.factionOwner || null,
      standing: draft.standing,
      locationType: draft.locationType?.trim() || undefined,
      notableFeatures: draft.notableFeatures?.trim() || undefined,
      inhabitants: draft.inhabitants?.trim() || undefined,
      tags: draft.tags,
      discovery: validateDiscovery(draft.discovery, { locations, npcs, quests }),
    })
    setEntryId(id)
    setEditing(false)
  }

  function saveLore() {
    const id = entryId === NEW_ID ? genId(draft.name, lore) : entryId!
    onUpdateLore(id, {
      name: draft.name,
      category: draft.category,
      content: draft.content?.trim() || undefined,
      era: draft.era?.trim() || undefined,
      tags: draft.tags,
      discovery: validateDiscovery(draft.discovery, { locations, npcs, quests }),
    })
    setEntryId(id)
    setEditing(false)
  }

  function saveQuest() {
    const id = entryId === NEW_ID ? genId(draft.name, quests) : entryId!
    onUpdateQuest(id, {
      name: draft.name,
      status: draft.status || undefined,
      type: draft.type || undefined,
      note: draft.note,
      description: draft.description?.trim() || undefined,
      questGiver: draft.questGiver?.trim() || undefined,
      reward: draft.reward?.trim() || undefined,
      tags: draft.tags,
      discovery: validateDiscovery(draft.discovery, { locations, npcs, quests }),
    })
    setEntryId(id)
    setEditing(false)
  }

  function saveBestiary() {
    const id = entryId === NEW_ID ? genId(draft.name, bestiary) : entryId!
    onUpdateBestiary(id, {
      name: draft.name,
      threatTier: draft.threatTier,
      hpMax: draft.hpMax === '' || draft.hpMax === undefined ? undefined : Number(draft.hpMax),
      dmgBase: draft.dmgBase === '' || draft.dmgBase === undefined ? undefined : Number(draft.dmgBase),
      description: draft.description?.trim() || undefined,
      habitat: draft.habitat?.trim() || undefined,
      weaknesses: draft.weaknesses?.trim() || undefined,
      lootTable: draft.lootTable?.trim() || undefined,
      tags: draft.tags,
      discovery: validateDiscovery(draft.discovery, { locations, npcs, quests }),
    })
    setEntryId(id)
    setEditing(false)
  }

  function saveSkill() {
    const name = (draft.name ?? '').trim()
    if (!name) return
    const id = entryId === NEW_ID ? genId(name, skills) : entryId!
    onUpdateSkill(id, {
      name,
      description: draft.description?.trim() || undefined,
      classId: draft.classId || undefined,
      // '' means "no cost declared" and must stay undefined rather than
      // collapsing to 0 — a 0-cost skill and an unpriced one read the same
      // in the UI but only the latter skips the §3.2 affordability note.
      mpCost: draft.mpCost === '' || draft.mpCost === undefined ? undefined : Number(draft.mpCost),
      stCost: draft.stCost === '' || draft.stCost === undefined ? undefined : Number(draft.stCost),
      skillType: draft.skillType?.trim() || undefined,
      tier: draft.tier?.trim() || undefined,
      flavorText: draft.flavorText?.trim() || undefined,
      discovery: validateDiscovery(draft.discovery, { locations, npcs, quests }),
    })
    setEntryId(id)
    setEditing(false)
  }

  function saveWorld() {
    onUpdateWorld({
      name: draft.name,
      genreTone: draft.genreTone,
      conflict: draft.conflict,
      background: draft.background,
      powerSystem: draft.powerSystem,
      eraTechLevel: draft.eraTechLevel,
      keyFactions: draft.keyFactions,
    })
    setEditing(false)
  }

  async function deleteEntry(kind: Exclude<CategoryId, 'chapters' | 'realm' | 'items'>) {
    if (!entryId || !(await confirm('Delete this entry? This cannot be undone.'))) return
    if (kind === 'npcs') onUpdateNpc(entryId, null)
    else if (kind === 'factions') onUpdateFaction(entryId, null)
    else if (kind === 'locations') onUpdateLocation(entryId, null)
    else if (kind === 'lore') onUpdateLore(entryId, null)
    else if (kind === 'quests') onUpdateQuest(entryId, null)
    else if (kind === 'bestiary') onUpdateBestiary(entryId, null)
    else if (kind === 'skills') onUpdateSkill(entryId, null)
    setEntryId(null)
  }

  function saveItem() {
    const name = (draft.name ?? '').trim()
    if (!name) return
    const id = entryId === NEW_ID ? genId(name, inventory) : entryId!
    const qty = Math.max(1, Math.round(Number(draft.qty) || 1))
    const type: ItemType = draft.type ?? 'material'
    const statBonus: StatBonus | undefined =
      EQUIPPABLE_TYPES.includes(type) && draft.statBonus && STAT_BONUS_KEYS.some((k) => draft.statBonus[k])
        ? Object.fromEntries(STAT_BONUS_KEYS.filter((k) => draft.statBonus[k]).map((k) => [k, Number(draft.statBonus[k])]))
        : undefined
    onUpdateItem(id, qty, {
      name,
      type,
      description: draft.description?.trim() || undefined,
      statBonus,
      rarity: draft.rarity?.trim() || undefined,
      loreText: draft.loreText?.trim() || undefined,
      value: draft.value === '' || draft.value === undefined ? undefined : Number(draft.value),
      tags: draft.tags,
    })
    setEntryId(id)
    setEditing(false)
  }

  async function deleteItemEntry() {
    if (!entryId || !(await confirm('Delete this item? This cannot be undone.'))) return
    onUpdateItem(entryId, null)
    setEntryId(null)
  }

  // §5.12 — a hidden entry's own title bar reads "???" too, not just its card/detail.
  const title =
    editing ? (entryId === NEW_ID ? 'New Entry' : 'Edit Entry') :
    entryId && category === 'npcs' ? (npcs[entryId] && isHidden(npcs[entryId]) ? '???' : npcs[entryId]?.name) :
    entryId && category === 'factions' ? (factions[entryId] && isHidden(factions[entryId]) ? '???' : factions[entryId]?.name) :
    entryId && category === 'locations' ? (locations[entryId] && isHidden(locations[entryId]) ? '???' : locations[entryId]?.name) :
    entryId && category === 'lore' ? (lore[entryId] && isHidden(lore[entryId]) ? '???' : lore[entryId]?.name) :
    entryId && category === 'quests' ? (quests[entryId] && isHidden(quests[entryId]) ? '???' : quests[entryId]?.name) :
    entryId && category === 'bestiary' ? (bestiary[entryId] && isHidden(bestiary[entryId]) ? '???' : bestiary[entryId]?.name) :
    entryId && category === 'skills' ? (skills[entryId] && isHidden(skills[entryId]) ? '???' : skills[entryId]?.name) :
    entryId && category === 'items' ? (items[entryId]?.name ?? entryId.replace(/_/g, ' ')) :
    categories.find((c) => c.id === category)?.label ?? 'Codex'

  return (
    // Dark ground, not the creation flow's artwork: the Codex is dense,
    // heavily scrolled reference reading, where a picture behind the text
    // would fight it.
    <LongTextEditorContext.Provider value={editLongText}>
    <GlassScreen ground="dark" className="px-4 pb-16">
      <GlassHeader
        title={title}
        onBack={back}
        className="!px-0 mb-5"
        right={
          onOpenCodexViewer && (
            <GlassIconButton icon={LayoutGrid} label="Flat Codex Viewer" compact onClick={onOpenCodexViewer} />
          )
        }
      />

      {searchFilterBar}

      {/* Level 1 — Category List, one accent identity per category (see
          CATEGORY_ACCENTS above) so this reads as a deck of distinct card
          kinds rather than a flat settings-style list. */}
      {!category && (
        <div className="rounded-2xl border border-[#23283b] bg-[#0d0f18]/80 p-3.5 sm:p-4">
          <div className="flex items-center justify-between mb-3 px-1">
            <h2 className="font-display font-bold text-xs uppercase tracking-widest text-[#e8ca8a]/90">
              CODEX ARCHIVES
            </h2>
            <span className="font-mono text-[10px] text-[#a0a5b8]">
              {categories.length} CATEGORIES
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {categories.map(({ id, label, description, icon: Icon, count }) => {
              const accent = (CATEGORY_ACCENTS as Record<string, CategoryAccent>)[id] ?? NEUTRAL_ACCENT
              return (
                <DeckEntryCard
                  key={id}
                  accent={accent}
                  icon={Icon}
                  title={label}
                  subtitle={description}
                  badge={
                    <span className={count > 0 ? accent.badge : `${accent.badge} opacity-60`}>
                      {count}
                    </span>
                  }
                  onClick={() => setCategory(id)}
                />
              )
            })}
          </div>
        </div>
      )}

      {/* Character — single record, no grid. The only editable field is Class:
          §5.1b Class Evolution's manual/CRUD trigger path, same "steer state
          directly" philosophy as auto-logged entries and Discovery reveals. */}
      {category === 'character' && (
        <>
          <div className="flex justify-end mb-3">
            <CrudToolbar
              editing={editing}
              canDelete={false}
              onEdit={() => startEdit('__character__', { classId: player.classId })}
              onSave={async () => {
                if (draft.classId && draft.classId !== player.classId) {
                  const target = PRESET_CLASSES.find((c) => c.id === draft.classId)
                  if (target && (await confirm(`Evolve into ${target.name}? Attribute points already earned keep their history — only points earned from here forward follow the new class.`))) {
                    onEvolveClass(draft.classId)
                  }
                }
                setEditing(false)
                setDraft({})
              }}
              onCancel={cancelEdit}
              onDelete={() => {}}
            />
          </div>
          {editing ? (
            <DetailPanel>
              <label className="block">
                <span className="text-[11px] font-display text-ink-muted uppercase tracking-wide">Class</span>
                <select
                  value={draft.classId ?? player.classId}
                  onChange={(e) => setDraft((d) => ({ ...d, classId: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-[#e8ca8a]/25 bg-[#e8ca8a]/[0.04] backdrop-blur-sm px-3 py-2 font-mono text-sm text-ink"
                >
                  {PRESET_CLASSES.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </label>
              <p className="font-narrative text-xs italic text-ink-muted">
                §5.1b Class Evolution — the class slot is replaced outright, no blending. Attribute
                points already earned are never recalculated; only points earned from here forward
                follow the new class's growth.
              </p>
            </DetailPanel>
          ) : (
            <DetailPanel>
              <DetailField label="Class" value={player.className} />
              <DetailField label="Level" value={String(player.level)} />
              <DetailField
                label="Attributes"
                value={`STR ${Math.round(player.attrs.STR)} · INT ${Math.round(player.attrs.INT)} · AGI ${Math.round(player.attrs.AGI)}`}
              />
              <DetailField label="Pools" value={`HP ${player.hpMax} · MP ${player.mpMax} · ST ${player.stMax}`} />
              {/* Set at creation only (WorldSetup/NewGame) — not editable here,
                  same as Background always was, so the reader can see their
                  own established identity at a glance without a second form. */}
              {player.background && <DetailField label="Background" value={<span className="text-xs text-ink-muted">{player.background}</span>} />}
              {player.personality && <DetailField label="Personality" value={player.personality} />}
              {player.motivation && <DetailField label="Motivation" value={player.motivation} />}
              {player.physicalTrait && <DetailField label="Physical Trait" value={player.physicalTrait} />}
              {player.secret && <DetailField label="Secret" value={player.secret} />}
            </DetailPanel>
          )}
        </>
      )}

      {/* Workbenches & Recipes — §5.8 Crafting, its own category (v1.7) rather
          than an eighth Relics & Vault filter. Station requirements are shown
          as flavor text only — there's no location-station-type data model
          yet, so any recipe can currently be queued from wherever the player
          is standing (see the scope note in lib/crafting.ts). */}
      {category === 'crafting' && (
        <div className="flex flex-col gap-4">
          {crafting.length > 0 && (
            <div>
              <p className="text-[11px] font-display text-ink-muted uppercase tracking-wide mb-1.5">In Progress</p>
              <div className="flex flex-col gap-2">
                {crafting.map((job) => {
                  const recipe = RECIPES.find((r) => r.id === job.recipeId)
                  const remaining = hoursRemaining(player.time, job.completeTime)
                  return (
                    <div key={job.jobId} className="rounded-xl border border-[#e8ca8a]/25 bg-transparent backdrop-blur-sm px-3 py-2.5 flex items-center justify-between gap-2">
                      <span className="font-display font-semibold text-sm text-[#e8ca8a]">{recipe?.name ?? job.recipeId}</span>
                      <span className="inline-flex items-center gap-1 font-mono text-xs text-ink-muted">
                        <Clock size={12} /> {remaining > 0 ? `${remaining}h remaining` : 'Ready'}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          <div>
            <p className="text-[11px] font-display text-ink-muted uppercase tracking-wide mb-1.5">Recipes</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {RECIPES.map((recipe) => {
                const affordable = canAffordRecipe(inventory, recipe)
                return (
                  <div key={recipe.id} className="rounded-xl p-3 flex flex-col gap-1.5 border border-[#e8ca8a]/25 bg-transparent backdrop-blur-sm">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-display font-bold text-sm text-[#e8ca8a]">{recipe.name}</h3>
                      <span className="inline-flex items-center gap-1 font-mono text-[10px] text-ink-muted">
                        <Clock size={11} /> {recipe.craftHours}h
                      </span>
                    </div>
                    {recipe.stationRequired && <p className="font-narrative text-[11px] text-ink-muted">Station: {recipe.stationRequired}</p>}
                    <p className="font-narrative text-xs text-ink-muted">
                      {recipe.ingredients.map((i) => `${i.qty}x ${i.id.replace(/_/g, ' ')} (${inventory[i.id] ?? 0} held)`).join(', ')}
                    </p>
                    <button
                      onClick={() => onStartCraft(recipe.id)}
                      disabled={!affordable}
                      className="mt-1 inline-flex items-center justify-center gap-1.5 rounded-full bg-[#e8ca8a] px-4 py-1.5 font-display text-xs font-semibold text-[#0e1017] disabled:opacity-30"
                    >
                      <Hammer size={13} /> Craft
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Corpses — read-only, array-backed like Crafting: corpse_add tags have
          no CRUD identity of their own (a player doesn't author/edit a slain
          enemy), just a bare identifier tag consumed LIFO by `!arise`. Grouped
          by tag with a count, cross-referencing the Bestiary for a real name/
          threat tier where the tag matches one already registered there. */}
      {category === 'corpses' && (
        <div className="flex flex-col gap-3">
          <p className="font-narrative text-xs text-ink-muted">
            Harvestable essence from the slain — extracted via <span className="font-mono">!arise</span> (Shadow Monarch), most recently fallen first.
          </p>
          {corpseCounts.length === 0 ? (
            <p className="font-narrative italic text-sm text-ink-muted">No harvestable corpses yet — defeat an enemy first.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {corpseCounts.map(([tag, qty]) => {
                const beast = bestiary[slugify(tag)]
                return (
                  <div key={tag} className="rounded-xl p-3 flex flex-col gap-1 border border-[#e8ca8a]/25 bg-transparent backdrop-blur-sm">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-display font-bold text-sm text-[#e8ca8a]">{beast?.name ?? titleCaseId(tag)}</h3>
                      <span className="font-mono text-xs text-ink-muted">×{qty}</span>
                    </div>
                    {beast?.threatTier && <p className="font-narrative text-[11px] text-ink-muted">{beast.threatTier}</p>}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Realm — single record, no grid; identity fields editable, narration style stays owned by Settings */}
      {category === 'realm' && (
        <>
          <div className="flex justify-end mb-3">
            <CrudToolbar
              editing={editing}
              canDelete={false}
              onEdit={() =>
                startEdit('__world__', {
                  name: world.name,
                  genreTone: world.genreTone,
                  conflict: world.conflict,
                  background: world.background,
                  powerSystem: world.powerSystem,
                  eraTechLevel: world.eraTechLevel,
                  keyFactions: world.keyFactions,
                })
              }
              onSave={saveWorld}
              onCancel={cancelEdit}
              onDelete={() => {}}
            />
          </div>
          {editing ? (
            <DetailPanel>
              <TextField label="World Name" value={draft.name ?? ''} onChange={(v) => setDraft((d) => ({ ...d, name: v }))} />
              <TextField label="Genre & Tone" value={draft.genreTone ?? ''} onChange={(v) => setDraft((d) => ({ ...d, genreTone: v }))} textarea />
              <TextField label="Core Regional Conflict" value={draft.conflict ?? ''} onChange={(v) => setDraft((d) => ({ ...d, conflict: v }))} textarea />
              <TextField label="Power System" value={draft.powerSystem ?? ''} onChange={(v) => setDraft((d) => ({ ...d, powerSystem: v }))} textarea />
              <TextField label="Era / Tech Level" value={draft.eraTechLevel ?? ''} onChange={(v) => setDraft((d) => ({ ...d, eraTechLevel: v }))} />
              <TextField label="Key Factions" value={draft.keyFactions ?? ''} onChange={(v) => setDraft((d) => ({ ...d, keyFactions: v }))} />
              <TextField label="World Background" value={draft.background ?? ''} onChange={(v) => setDraft((d) => ({ ...d, background: v }))} textarea />
            </DetailPanel>
          ) : (
            <DetailPanel>
              <DetailField label="World" value={world.name} />
              {world.genreTone && <DetailField label="Genre & Tone" value={world.genreTone} />}
              {world.conflict && <DetailField label="Core Regional Conflict" value={world.conflict} />}
              {world.powerSystem && <DetailField label="Power System" value={world.powerSystem} />}
              {world.eraTechLevel && <DetailField label="Era / Tech Level" value={world.eraTechLevel} />}
              {world.keyFactions && <DetailField label="Key Factions" value={world.keyFactions} />}
              {world.background && <DetailField label="World Background" value={world.background} />}
              <DetailField label="Narration Style" value={<span className="text-xs text-ink-muted">{world.narrationStyle}</span>} />
              {flags.length > 0 && (
                <DetailField
                  label="World Flags"
                  value={
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {flags.map((f) => (
                        <span key={f} className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-[#e8ca8a]/15 text-[#e8ca8a]">
                          {f}
                        </span>
                      ))}
                    </div>
                  }
                />
              )}
            </DetailPanel>
          )}
        </>
      )}

      {/* Chapters — generated recap, read-only, no CRUD */}
      {category === 'chapters' && (
        <div className="flex flex-col gap-3">
          {chapters.length === 0 && <p className="font-narrative italic text-sm text-ink-muted">No chapters recorded yet.</p>}
          {chapters.map((c, i) => (
            <div key={i} className="rounded-2xl p-4 border border-[#e8ca8a]/25 bg-transparent backdrop-blur-sm">
              <h3 className="font-display font-bold text-sm text-[#e8ca8a] mb-1">Chapter {c.chapterNumber}</h3>
              <p className="font-narrative text-sm italic text-ink-muted">{c.chapterSummary}</p>
            </div>
          ))}
        </div>
      )}

      {/* NPCs */}
      {category === 'npcs' && !entryId && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <AddButton label="Add NPC" onClick={() => startCreate({ name: '', stage: 'Stranger', trust: 0, affection: 0, memSummary: '', deeds: '' })} />
          {filteredNpcs.map(([id, n]) => {
            const hidden = isHidden(n)
            const metaChips: MetaChip[] = hidden
              ? []
              : [
                  n.stage ? { icon: User, label: n.stage } : null,
                  n.factionId && factions[n.factionId] ? { icon: ShieldCheck, label: factions[n.factionId].name } : null,
                  { icon: Heart, label: `Trust ${n.trust} · Aff ${n.affection}` },
                ].filter(Boolean) as MetaChip[]
            return (
              <DeckEntryCard
                key={id}
                accent={CATEGORY_ACCENTS.npcs}
                title={hidden ? '???' : n.name}
                kicker={hidden ? undefined : n.role || n.stage}
                subtitle={
                  hidden
                    ? n.discovery?.teaser || 'Not yet discovered.'
                    : n.memSummary || n.personality || n.appearance || 'Met during your travels.'
                }
                badge={hidden ? <LockBadge /> : <AutoBadge shown={n.autoLogged} />}
                metaChips={metaChips}
                tags={hidden ? undefined : n.tags}
                onClick={() => setEntryId(id)}
              />
            )
          })}
          {Object.keys(npcs).length === 0 ? (
            <p className="font-narrative italic text-sm text-ink-muted col-span-full">No NPCs met yet.</p>
          ) : filteredNpcs.length === 0 ? (
            <p className="font-narrative italic text-sm text-ink-muted col-span-full">No NPCs match current filters.</p>
          ) : null}
        </div>
      )}
      {category === 'npcs' && entryId && (editing || npcs[entryId]) && (
        <>
          <div className="flex justify-end mb-3">
            <CrudToolbar editing={editing} canDelete={entryId !== NEW_ID} onEdit={() => startEdit(entryId, { ...npcs[entryId], factionId: npcs[entryId].factionId ?? '' })} onSave={saveNpc} onCancel={cancelEdit} onDelete={() => deleteEntry('npcs')} />
          </div>
          {editing ? (
            <DetailPanel>
              <TextField label="Name" value={draft.name ?? ''} onChange={(v) => setDraft((d) => ({ ...d, name: v }))} />
              <TextField label="Role" value={draft.role ?? ''} onChange={(v) => setDraft((d) => ({ ...d, role: v }))} placeholder="Blacksmith, Rival Cadet, Court Advisor…" />
              <TextField label="Gender" value={draft.gender ?? ''} onChange={(v) => setDraft((d) => ({ ...d, gender: v }))} placeholder="she/her (optional)" />
              <TextField label="Age" value={draft.age !== undefined ? String(draft.age) : ''} onChange={(v) => setDraft((d) => ({ ...d, age: v }))} placeholder="Optional" />
              <TextField label="Stage" value={draft.stage ?? ''} onChange={(v) => setDraft((d) => ({ ...d, stage: v }))} placeholder="Stranger, Acquaintance, Friend…" />
              <NumberField label="Trust" value={draft.trust ?? 0} onChange={(v) => setDraft((d) => ({ ...d, trust: v }))} />
              <NumberField label="Affection" value={draft.affection ?? 0} onChange={(v) => setDraft((d) => ({ ...d, affection: v }))} />
              <label className="block">
                <span className="text-[11px] font-display text-ink-muted uppercase tracking-wide">Faction</span>
                <select
                  value={draft.factionId ?? ''}
                  onChange={(e) => setDraft((d) => ({ ...d, factionId: e.target.value || null }))}
                  className={SELECT_CLASS}
                >
                  <option value="">None</option>
                  {Object.entries(factions).map(([id, f]) => (
                    <option key={id} value={id}>{f.name}</option>
                  ))}
                </select>
              </label>
              <TextField label="Appearance" value={draft.appearance ?? ''} onChange={(v) => setDraft((d) => ({ ...d, appearance: v }))} textarea placeholder="Physical description…" />
              <TextField label="Held Weapon" value={draft.heldWeapon ?? ''} onChange={(v) => setDraft((d) => ({ ...d, heldWeapon: v }))} placeholder="Currently wielded weapon…" />
              <TextField label="Worn Armor" value={draft.wornArmor ?? ''} onChange={(v) => setDraft((d) => ({ ...d, wornArmor: v }))} placeholder="Currently worn armor/gear…" />
              <TextField label="Personality" value={draft.personality ?? ''} onChange={(v) => setDraft((d) => ({ ...d, personality: v }))} textarea placeholder="Brief trait summary…" />
              <TextField label="Voice Notes" value={draft.voiceNotes ?? ''} onChange={(v) => setDraft((d) => ({ ...d, voiceNotes: v }))} textarea placeholder="How they speak — a steering note for your own reference." />
              <TextField label="Memory" value={draft.memSummary ?? ''} onChange={(v) => setDraft((d) => ({ ...d, memSummary: v }))} textarea />
              <TextField
                label="Deeds (comma-separated)"
                value={Array.isArray(draft.deeds) ? draft.deeds.join(', ') : (draft.deeds ?? '')}
                onChange={(v) => setDraft((d) => ({ ...d, deeds: v }))}
              />
              <TagsField value={draft.tags} onChange={(tags) => setDraft((d) => ({ ...d, tags }))} />
              <DiscoveryEditor discovery={draft.discovery} onChange={(disc) => setDraft((d) => ({ ...d, discovery: disc }))} />
            </DetailPanel>
          ) : isHidden(npcs[entryId]) ? (
            <MaskedDetail teaser={npcs[entryId].discovery?.teaser} />
          ) : (
            <div className="flex flex-col gap-3">
              <EntryHeroHeader
                accent={CATEGORY_ACCENTS.npcs}
                title={npcs[entryId].name}
                subtitle={npcs[entryId].role || npcs[entryId].stage}
                badges={<AutoBadge shown={npcs[entryId].autoLogged} />}
              />
              <SectionCard accent={CATEGORY_ACCENTS.npcs} icon={Heart} title="Bond & Status">
                <FieldRow label="Stage" value={npcs[entryId].stage} icon={User} />
                <div className="flex flex-col gap-2 pt-1">
                  <StatBar label="Trust" value={npcs[entryId].trust} />
                  <StatBar label="Affection" value={npcs[entryId].affection} />
                </div>
              </SectionCard>
              <SectionCard accent={CATEGORY_ACCENTS.npcs} icon={User} title="Profile">
                {(npcs[entryId].gender || npcs[entryId].age !== undefined) && (
                  <FieldRow
                    label="Identity"
                    value={[npcs[entryId].gender, npcs[entryId].age !== undefined && `Age ${npcs[entryId].age}`].filter(Boolean).join(' · ')}
                  />
                )}
                {npcs[entryId].factionId && factions[npcs[entryId].factionId!] && (
                  <FieldRow label="Affiliation" value={factions[npcs[entryId].factionId!].name} icon={ShieldCheck} />
                )}
              </SectionCard>
              {(npcs[entryId].appearance || npcs[entryId].heldWeapon || npcs[entryId].wornArmor) && (
                <SectionCard accent={CATEGORY_ACCENTS.npcs} icon={Shield} title="Appearance & Gear">
                  {npcs[entryId].appearance && <FieldRow label="Looks" value={npcs[entryId].appearance} />}
                  {npcs[entryId].heldWeapon && <FieldRow label="Weapon" value={npcs[entryId].heldWeapon} />}
                  {npcs[entryId].wornArmor && <FieldRow label="Armor" value={npcs[entryId].wornArmor} />}
                </SectionCard>
              )}
              {(npcs[entryId].personality || npcs[entryId].voiceNotes) && (
                <SectionCard accent={CATEGORY_ACCENTS.npcs} icon={ScrollText} title="Persona">
                  {npcs[entryId].personality && <FieldRow label="Traits" value={npcs[entryId].personality} />}
                  {npcs[entryId].voiceNotes && <FieldRow label="Voice" value={npcs[entryId].voiceNotes} />}
                </SectionCard>
              )}
              <SectionCard accent={CATEGORY_ACCENTS.npcs} icon={Clock} title="Chronicle">
                <FieldRow label="Memory" value={npcs[entryId].memSummary || 'No chronicled deeds.'} />
                {npcs[entryId].deeds.length > 0 && <FieldRow label="Deeds" value={npcs[entryId].deeds.join(', ')} />}
              </SectionCard>
              <TagPills tags={npcs[entryId].tags} accent={CATEGORY_ACCENTS.npcs} />
            </div>
          )}
        </>
      )}

      {/* Faction */}
      {category === 'factions' && !entryId && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <AddButton label="Add Faction" onClick={() => startCreate({ name: '', repTier: 0 })} />
          {filteredFactions.map(([id, f]) => {
            const hidden = isHidden(f)
            const metaChips: MetaChip[] = hidden
              ? []
              : [
                  { icon: ShieldCheck, label: `${repTierLabel(f.repTier)} (${f.repTier > 0 ? '+' : ''}${f.repTier})` },
                  f.territory ? { icon: MapPin, label: f.territory } : null,
                  f.rivalId && factions[f.rivalId] ? { icon: Swords, label: `vs ${factions[f.rivalId].name}` } : null,
                ].filter(Boolean) as MetaChip[]
            return (
              <DeckEntryCard
                key={id}
                accent={CATEGORY_ACCENTS.factions}
                title={hidden ? '???' : f.name}
                kicker={hidden ? undefined : f.leader ? `Leader: ${f.leader}` : f.territory}
                subtitle={hidden ? (f.discovery?.teaser || 'Not yet discovered.') : (f.description || 'An active realm faction.')}
                badge={hidden ? <LockBadge /> : <AutoBadge shown={f.autoLogged} />}
                metaChips={metaChips}
                tags={hidden ? undefined : f.tags}
                onClick={() => setEntryId(id)}
              />
            )
          })}
          {Object.keys(factions).length === 0 ? (
            <p className="font-narrative italic text-sm text-ink-muted col-span-full">No factions encountered yet.</p>
          ) : filteredFactions.length === 0 ? (
            <p className="font-narrative italic text-sm text-ink-muted col-span-full">No factions match current filters.</p>
          ) : null}
        </div>
      )}
      {category === 'factions' && entryId && (editing || factions[entryId]) && (
        <>
          <div className="flex justify-end mb-3">
            <CrudToolbar editing={editing} canDelete={entryId !== NEW_ID} onEdit={() => startEdit(entryId, factions[entryId])} onSave={saveFaction} onCancel={cancelEdit} onDelete={() => deleteEntry('factions')} />
          </div>
          {editing ? (
            <DetailPanel>
              <TextField label="Name" value={draft.name ?? ''} onChange={(v) => setDraft((d) => ({ ...d, name: v }))} />
              <NumberField label="Reputation Tier (-2 to 2)" value={draft.repTier ?? 0} onChange={(v) => setDraft((d) => ({ ...d, repTier: v }))} />
              <label className="block">
                <span className="text-[11px] font-display text-ink-muted uppercase tracking-wide">Rival Faction (§5.4)</span>
                <select
                  value={draft.rivalId ?? ''}
                  onChange={(e) => setDraft((d) => ({ ...d, rivalId: e.target.value || null }))}
                  className={SELECT_CLASS}
                >
                  <option value="">None</option>
                  {Object.entries(factions).filter(([id]) => id !== entryId).map(([id, f]) => (
                    <option key={id} value={id}>{f.name}</option>
                  ))}
                </select>
                <span className="text-[10px] text-ink-muted/70">A rep change here mirrors an inverse change on the rival, automatically.</span>
              </label>
              <TextField label="Description" value={draft.description ?? ''} onChange={(v) => setDraft((d) => ({ ...d, description: v }))} textarea placeholder="What do they stand for, or do?" />
              <TextField label="Leader" value={draft.leader ?? ''} onChange={(v) => setDraft((d) => ({ ...d, leader: v }))} placeholder="A named NPC, if any" />
              <TextField label="Territory" value={draft.territory ?? ''} onChange={(v) => setDraft((d) => ({ ...d, territory: v }))} placeholder="Home region or base" />
              <TextField label="Symbol" value={draft.symbol ?? ''} onChange={(v) => setDraft((d) => ({ ...d, symbol: v }))} placeholder="A sigil or emblem" />
              <TagsField value={draft.tags} onChange={(tags) => setDraft((d) => ({ ...d, tags }))} />
              <DiscoveryEditor discovery={draft.discovery} onChange={(disc) => setDraft((d) => ({ ...d, discovery: disc }))} />
            </DetailPanel>
          ) : isHidden(factions[entryId]) ? (
            <MaskedDetail teaser={factions[entryId].discovery?.teaser} />
          ) : (
            <div className="flex flex-col gap-3">
              <EntryHeroHeader
                accent={CATEGORY_ACCENTS.factions}
                title={factions[entryId].name}
                subtitle={factions[entryId].description}
                badges={<AutoBadge shown={factions[entryId].autoLogged} />}
              />
              <SectionCard accent={CATEGORY_ACCENTS.factions} icon={ShieldCheck} title="Standing & Feuds">
                <div>
                  <FieldRow
                    label="Standing"
                    value={`${repTierLabel(factions[entryId].repTier)} (${factions[entryId].repTier > 0 ? '+' : ''}${factions[entryId].repTier} of -2 to +2)`}
                  />
                  <ReputationMeter tier={factions[entryId].repTier} accent={CATEGORY_ACCENTS.factions} />
                </div>
                {factions[entryId].rivalId && factions[factions[entryId].rivalId!] && (
                  <FieldRow label="Rival" value={factions[factions[entryId].rivalId!].name} icon={Swords} />
                )}
              </SectionCard>
              {(factions[entryId].leader || factions[entryId].territory || factions[entryId].symbol) && (
                <SectionCard accent={CATEGORY_ACCENTS.factions} icon={ScrollText} title="Domain">
                  {factions[entryId].leader && <FieldRow label="Leader" value={factions[entryId].leader} icon={User} />}
                  {factions[entryId].territory && <FieldRow label="Territory" value={factions[entryId].territory} icon={MapPin} />}
                  {factions[entryId].symbol && <FieldRow label="Emblem" value={factions[entryId].symbol} icon={Sparkles} />}
                </SectionCard>
              )}
              <TagPills tags={factions[entryId].tags} accent={CATEGORY_ACCENTS.factions} />
            </div>
          )}
        </>
      )}

      {/* Locations */}
      {category === 'locations' && !entryId && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <AddButton label="Add Location" onClick={() => startCreate({ name: '', region: '', description: '', dangerLevel: '', factionOwner: '', standing: '' })} />
          {filteredLocations.map(([id, l]) => {
            const hidden = isHidden(l)
            const metaChips: MetaChip[] = hidden
              ? []
              : [
                  l.dangerLevel ? { icon: AlertTriangle, label: l.dangerLevel } : null,
                  l.region ? { icon: MapPin, label: l.region } : null,
                  l.factionOwner && factions[l.factionOwner] ? { icon: ShieldCheck, label: factions[l.factionOwner].name } : null,
                ].filter(Boolean) as MetaChip[]
            return (
              <DeckEntryCard
                key={id}
                accent={CATEGORY_ACCENTS.locations}
                title={hidden ? '???' : l.name}
                kicker={hidden ? undefined : [l.locationType, l.region].filter(Boolean).join(' · ')}
                subtitle={hidden ? (l.discovery?.teaser || 'Not yet discovered.') : (l.description || l.notableFeatures || 'An uncharted site in the realm.')}
                badge={hidden ? <LockBadge /> : <AutoBadge shown={l.autoLogged} />}
                metaChips={metaChips}
                tags={hidden ? undefined : l.tags}
                onClick={() => setEntryId(id)}
              />
            )
          })}
          {Object.keys(locations).length === 0 ? (
            <p className="font-narrative italic text-sm text-ink-muted col-span-full">No locations visited yet.</p>
          ) : filteredLocations.length === 0 ? (
            <p className="font-narrative italic text-sm text-ink-muted col-span-full">No locations match current filters.</p>
          ) : null}
        </div>
      )}
      {category === 'locations' && entryId && (editing || locations[entryId]) && (
        <>
          <div className="flex justify-end mb-3">
            <CrudToolbar editing={editing} canDelete={entryId !== NEW_ID} onEdit={() => startEdit(entryId, { ...locations[entryId], factionOwner: locations[entryId].factionOwner ?? '' })} onSave={saveLocation} onCancel={cancelEdit} onDelete={() => deleteEntry('locations')} />
          </div>
          {editing ? (
            <DetailPanel>
              <TextField label="Name" value={draft.name ?? ''} onChange={(v) => setDraft((d) => ({ ...d, name: v }))} />
              <label className="block">
                <span className="text-[11px] font-display text-ink-muted uppercase tracking-wide">Location Type</span>
                <select
                  value={draft.locationType ?? ''}
                  onChange={(e) => setDraft((d) => ({ ...d, locationType: e.target.value }))}
                  className={SELECT_CLASS}
                >
                  <option value="">(Select Type)</option>
                  {LOCATION_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </label>
              <TextField label="Region" value={draft.region ?? ''} onChange={(v) => setDraft((d) => ({ ...d, region: v }))} />
              <label className="block">
                <span className="text-[11px] font-display text-ink-muted uppercase tracking-wide">Danger Level</span>
                <select
                  value={draft.dangerLevel ?? ''}
                  onChange={(e) => setDraft((d) => ({ ...d, dangerLevel: e.target.value }))}
                  className={SELECT_CLASS}
                >
                  <option value="">(Select Danger)</option>
                  {LOCATION_DANGER_LEVELS.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-[11px] font-display text-ink-muted uppercase tracking-wide">Faction Owner (§5.11)</span>
                <select
                  value={draft.factionOwner ?? ''}
                  onChange={(e) => setDraft((d) => ({ ...d, factionOwner: e.target.value || null }))}
                  className={SELECT_CLASS}
                >
                  <option value="">None (independent territory)</option>
                  {Object.entries(factions).map(([id, f]) => (
                    <option key={id} value={id}>{f.name}</option>
                  ))}
                </select>
              </label>
              {draft.factionOwner && factions[draft.factionOwner] ? (
                <p className="font-narrative text-xs text-ink-muted italic">
                  Standing is derived from {factions[draft.factionOwner].name}'s reputation:{' '}
                  <span className="text-ink not-italic">{deriveStanding(factions[draft.factionOwner].repTier)}</span>
                </p>
              ) : (
                <TextField label="Standing" value={draft.standing ?? ''} onChange={(v) => setDraft((d) => ({ ...d, standing: v }))} />
              )}
              <TextField label="Description" value={draft.description ?? ''} onChange={(v) => setDraft((d) => ({ ...d, description: v }))} textarea />
              <TextField label="Notable Features" value={draft.notableFeatures ?? ''} onChange={(v) => setDraft((d) => ({ ...d, notableFeatures: v }))} textarea placeholder="What stands out about the place…" />
              <TextField label="Inhabitants" value={draft.inhabitants ?? ''} onChange={(v) => setDraft((d) => ({ ...d, inhabitants: v }))} textarea placeholder="Who or what lives or lurks here…" />
              <TagsField value={draft.tags} onChange={(tags) => setDraft((d) => ({ ...d, tags }))} />
              <DiscoveryEditor discovery={draft.discovery} onChange={(disc) => setDraft((d) => ({ ...d, discovery: disc }))} />
            </DetailPanel>
          ) : isHidden(locations[entryId]) ? (
            <MaskedDetail teaser={locations[entryId].discovery?.teaser} />
          ) : (
            <div className="flex flex-col gap-3">
              <EntryHeroHeader
                accent={CATEGORY_ACCENTS.locations}
                title={locations[entryId].name}
                subtitle={locations[entryId].locationType ? `${locations[entryId].locationType} · ${locations[entryId].region}` : locations[entryId].region}
                badges={<AutoBadge shown={locations[entryId].autoLogged} />}
              />
              <SectionCard accent={CATEGORY_ACCENTS.locations} icon={MapPin} title="Geography">
                <FieldRow label="Region" value={locations[entryId].region} icon={MapPin} />
                <FieldRow label="Danger" value={locations[entryId].dangerLevel} icon={AlertTriangle} />
                <FieldRow label="Standing" value={effectiveStanding(locations[entryId], factions)} icon={ShieldCheck} />
                {locations[entryId].factionOwner && (
                  <FieldRow label="Ruler" value={factions[locations[entryId].factionOwner!]?.name ?? locations[entryId].factionOwner!} icon={Shield} />
                )}
                {locations[entryId].description && <FieldRow label="Overview" value={locations[entryId].description} />}
              </SectionCard>
              {(locations[entryId].notableFeatures || locations[entryId].inhabitants) && (
                <SectionCard accent={CATEGORY_ACCENTS.locations} icon={ScrollText} title="Landmarks & Denizens">
                  {locations[entryId].notableFeatures && <FieldRow label="Landmarks" value={locations[entryId].notableFeatures} />}
                  {locations[entryId].inhabitants && <FieldRow label="Denizens" value={locations[entryId].inhabitants} />}
                </SectionCard>
              )}
              <TagPills tags={locations[entryId].tags} accent={CATEGORY_ACCENTS.locations} />
            </div>
          )}
        </>
      )}

      {/* Lore */}
      {category === 'lore' && !entryId && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <AddButton label="Add Lore" onClick={() => startCreate({ name: '', category: '' })} />
          {filteredLore.map(([id, l]) => {
            const hidden = isHidden(l)
            const metaChips: MetaChip[] = hidden
              ? []
              : [
                  l.category ? { icon: ScrollText, label: l.category } : null,
                  l.era ? { icon: Clock, label: l.era } : null,
                ].filter(Boolean) as MetaChip[]
            return (
              <DeckEntryCard
                key={id}
                accent={CATEGORY_ACCENTS.lore}
                title={hidden ? '???' : l.name}
                kicker={hidden ? undefined : [l.category, l.era].filter(Boolean).join(' · ')}
                subtitle={hidden ? (l.discovery?.teaser || 'Not yet discovered.') : (l.content || 'An ancient lore entry.')}
                badge={hidden ? <LockBadge /> : <AutoBadge shown={l.autoLogged} />}
                metaChips={metaChips}
                tags={hidden ? undefined : l.tags}
                onClick={() => setEntryId(id)}
              />
            )
          })}
          {Object.keys(lore).length === 0 ? (
            <p className="font-narrative italic text-sm text-ink-muted col-span-full">No lore uncovered yet.</p>
          ) : filteredLore.length === 0 ? (
            <p className="font-narrative italic text-sm text-ink-muted col-span-full">No lore entries match current filters.</p>
          ) : null}
        </div>
      )}
      {category === 'lore' && entryId && (editing || lore[entryId]) && (
        <>
          <div className="flex justify-end mb-3">
            <CrudToolbar editing={editing} canDelete={entryId !== NEW_ID} onEdit={() => startEdit(entryId, lore[entryId])} onSave={saveLore} onCancel={cancelEdit} onDelete={() => deleteEntry('lore')} />
          </div>
          {editing ? (
            <DetailPanel>
              <TextField label="Name" value={draft.name ?? ''} onChange={(v) => setDraft((d) => ({ ...d, name: v }))} />
              <TextField label="Category" value={draft.category ?? ''} onChange={(v) => setDraft((d) => ({ ...d, category: v }))} placeholder="Cosmology, Magic, History…" />
              <TextField label="Era" value={draft.era ?? ''} onChange={(v) => setDraft((d) => ({ ...d, era: v }))} placeholder="Ancient, Present Day…" />
              <TextField label="Lore Text" value={draft.content ?? ''} onChange={(v) => setDraft((d) => ({ ...d, content: v }))} textarea placeholder="The actual legend, myth, or secret…" />
              <TagsField value={draft.tags} onChange={(tags) => setDraft((d) => ({ ...d, tags }))} />
              <DiscoveryEditor discovery={draft.discovery} onChange={(disc) => setDraft((d) => ({ ...d, discovery: disc }))} />
            </DetailPanel>
          ) : isHidden(lore[entryId]) ? (
            <MaskedDetail teaser={lore[entryId].discovery?.teaser} />
          ) : (
            <div className="flex flex-col gap-3">
              <EntryHeroHeader
                accent={CATEGORY_ACCENTS.lore}
                title={lore[entryId].name}
                subtitle={[lore[entryId].category, lore[entryId].era].filter(Boolean).join(' · ')}
                badges={<AutoBadge shown={lore[entryId].autoLogged} />}
              />
              <SectionCard accent={CATEGORY_ACCENTS.lore} icon={ScrollText} title="Chronicle Archive">
                <FieldRow label="Classification" value={[lore[entryId].category, lore[entryId].era].filter(Boolean).join(' · ')} />
                <div className="mt-1 p-3.5 rounded-xl bg-[#0f121d]/80 border border-[#2b3046] font-narrative text-xs sm:text-sm text-[#f6eedb] italic leading-relaxed whitespace-pre-wrap">
                  {lore[entryId].content || 'No text chronicled yet.'}
                </div>
              </SectionCard>
              <TagPills tags={lore[entryId].tags} accent={CATEGORY_ACCENTS.lore} />
            </div>
          )}
        </>
      )}

      {/* Quests */}
      {category === 'quests' && !entryId && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <AddButton label="Add Quest" onClick={() => startCreate({ name: '', status: '', note: '' })} />
          {filteredQuests.map(([id, q]) => {
            const hidden = isHidden(q)
            const metaChips: MetaChip[] = hidden
              ? []
              : [
                  q.questGiver ? { icon: User, label: `By: ${q.questGiver}` } : null,
                  q.reward ? { icon: Gift, label: q.reward } : null,
                ].filter(Boolean) as MetaChip[]
            return (
              <DeckEntryCard
                key={id}
                accent={CATEGORY_ACCENTS.quests}
                title={hidden ? '???' : q.name}
                kicker={hidden ? undefined : q.questGiver ? `Patron: ${q.questGiver}` : undefined}
                statusBadge={hidden ? undefined : <QuestStatusBadge status={q.status} />}
                subtitle={hidden ? (q.discovery?.teaser || 'Not yet discovered.') : (q.description || q.note || 'No recorded objective.')}
                badge={hidden ? <LockBadge /> : <><QuestTypeBadge type={q.type} /><AutoBadge shown={q.autoLogged} /></>}
                metaChips={metaChips}
                tags={hidden ? undefined : q.tags}
                onClick={() => setEntryId(id)}
              />
            )
          })}
          {Object.keys(quests).length === 0 ? (
            <p className="font-narrative italic text-sm text-ink-muted col-span-full">No quests tracked yet.</p>
          ) : filteredQuests.length === 0 ? (
            <p className="font-narrative italic text-sm text-ink-muted col-span-full">No quests match current filters.</p>
          ) : null}
        </div>
      )}
      {category === 'quests' && entryId && (editing || quests[entryId]) && (
        <>
          <div className="flex justify-end mb-3">
            <CrudToolbar editing={editing} canDelete={entryId !== NEW_ID} onEdit={() => startEdit(entryId, { ...quests[entryId], status: quests[entryId].status ?? '' })} onSave={saveQuest} onCancel={cancelEdit} onDelete={() => deleteEntry('quests')} />
          </div>
          {editing ? (
            <DetailPanel>
              <TextField label="Name" value={draft.name ?? ''} onChange={(v) => setDraft((d) => ({ ...d, name: v }))} />
              <TextField label="Status" value={draft.status ?? ''} onChange={(v) => setDraft((d) => ({ ...d, status: v }))} placeholder="advanced, completed, failed" />
              <TextField label="Type" value={draft.type ?? ''} onChange={(v) => setDraft((d) => ({ ...d, type: v }))} placeholder="main, side, ambition, secret_ambition" />
              <TextField label="Description" value={draft.description ?? ''} onChange={(v) => setDraft((d) => ({ ...d, description: v }))} textarea placeholder="The quest's actual premise/objective…" />
              <TextField label="Quest Giver" value={draft.questGiver ?? ''} onChange={(v) => setDraft((d) => ({ ...d, questGiver: v }))} placeholder="A named NPC, if any" />
              <TextField label="Reward" value={draft.reward ?? ''} onChange={(v) => setDraft((d) => ({ ...d, reward: v }))} />
              <TextField label="Note" value={draft.note ?? ''} onChange={(v) => setDraft((d) => ({ ...d, note: v }))} textarea placeholder="A short status update, distinct from the description above." />
              <TagsField value={draft.tags} onChange={(tags) => setDraft((d) => ({ ...d, tags }))} />
              <DiscoveryEditor discovery={draft.discovery} onChange={(disc) => setDraft((d) => ({ ...d, discovery: disc }))} />
            </DetailPanel>
          ) : isHidden(quests[entryId]) ? (
            <MaskedDetail teaser={quests[entryId].discovery?.teaser} />
          ) : (
            <div className="flex flex-col gap-3">
              <EntryHeroHeader
                accent={CATEGORY_ACCENTS.quests}
                title={quests[entryId].name}
                badges={
                  <>
                    <QuestStatusBadge status={quests[entryId].status} />
                    <QuestTypeBadge type={quests[entryId].type} />
                    <AutoBadge shown={quests[entryId].autoLogged} />
                  </>
                }
              />
              <SectionCard accent={CATEGORY_ACCENTS.quests} icon={Target} title="Mission Brief">
                {quests[entryId].questGiver && <FieldRow label="Patron" value={quests[entryId].questGiver} icon={User} />}
                {quests[entryId].reward && <FieldRow label="Bounty" value={quests[entryId].reward} icon={Gift} />}
                {quests[entryId].description && <FieldRow label="Premise" value={quests[entryId].description} />}
              </SectionCard>
              {quests[entryId].note && (
                <SectionCard accent={CATEGORY_ACCENTS.quests} icon={Clock} title="Journal Log">
                  <FieldRow label="Latest Log" value={quests[entryId].note!} />
                </SectionCard>
              )}
              <TagPills tags={quests[entryId].tags} accent={CATEGORY_ACCENTS.quests} />
            </div>
          )}
        </>
      )}

      {/* Bestiary */}
      {category === 'bestiary' && !entryId && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <AddButton label="Add Adversary" onClick={() => startCreate({ name: '', threatTier: '', hpMax: '', dmgBase: '' })} />
          {filteredBestiary.map(([id, b]) => {
            const hidden = isHidden(b)
            const metaChips: MetaChip[] = hidden
              ? []
              : [
                  b.threatTier ? { icon: Skull, label: b.threatTier } : null,
                  b.hpMax !== undefined ? { icon: Heart, label: `HP ${b.hpMax}` } : null,
                  b.weaknesses ? { icon: Zap, label: `Weak: ${b.weaknesses}` } : null,
                ].filter(Boolean) as MetaChip[]
            return (
              <DeckEntryCard
                key={id}
                accent={CATEGORY_ACCENTS.bestiary}
                title={hidden ? '???' : b.name}
                kicker={hidden ? undefined : b.threatTier || b.habitat}
                subtitle={hidden ? (b.discovery?.teaser || 'Not yet discovered.') : (b.description || b.weaknesses || 'A creature roaming the dark.')}
                badge={hidden ? <LockBadge /> : <AutoBadge shown={b.autoLogged} />}
                metaChips={metaChips}
                tags={hidden ? undefined : b.tags}
                onClick={() => setEntryId(id)}
              />
            )
          })}
          {Object.keys(bestiary).length === 0 ? (
            <p className="font-narrative italic text-sm text-ink-muted col-span-full">No adversaries encountered yet.</p>
          ) : filteredBestiary.length === 0 ? (
            <p className="font-narrative italic text-sm text-ink-muted col-span-full">No adversaries match current filters.</p>
          ) : null}
        </div>
      )}
      {category === 'bestiary' && entryId && (editing || bestiary[entryId]) && (
        <>
          <div className="flex justify-end mb-3">
            <CrudToolbar
              editing={editing}
              canDelete={entryId !== NEW_ID}
              onEdit={() => startEdit(entryId, { ...bestiary[entryId], hpMax: bestiary[entryId].hpMax ?? '', dmgBase: bestiary[entryId].dmgBase ?? '' })}
              onSave={saveBestiary}
              onCancel={cancelEdit}
              onDelete={() => deleteEntry('bestiary')}
            />
          </div>
          {editing ? (
            <DetailPanel>
              <TextField label="Name" value={draft.name ?? ''} onChange={(v) => setDraft((d) => ({ ...d, name: v }))} />
              <TextField label="Threat Tier" value={draft.threatTier ?? ''} onChange={(v) => setDraft((d) => ({ ...d, threatTier: v }))} />
              <NumberField label="HP" value={draft.hpMax === '' ? 0 : (draft.hpMax ?? 0)} onChange={(v) => setDraft((d) => ({ ...d, hpMax: v }))} />
              <NumberField label="Base Damage" value={draft.dmgBase === '' ? 0 : (draft.dmgBase ?? 0)} onChange={(v) => setDraft((d) => ({ ...d, dmgBase: v }))} />
              <TextField label="Description" value={draft.description ?? ''} onChange={(v) => setDraft((d) => ({ ...d, description: v }))} textarea placeholder="Appearance and behavior…" />
              <TextField label="Habitat" value={draft.habitat ?? ''} onChange={(v) => setDraft((d) => ({ ...d, habitat: v }))} />
              <TextField label="Weaknesses" value={draft.weaknesses ?? ''} onChange={(v) => setDraft((d) => ({ ...d, weaknesses: v }))} />
              <TextField label="Loot Table" value={draft.lootTable ?? ''} onChange={(v) => setDraft((d) => ({ ...d, lootTable: v }))} placeholder="Bone Dust, Cursed Fang…" />
              <TagsField value={draft.tags} onChange={(tags) => setDraft((d) => ({ ...d, tags }))} />
              <DiscoveryEditor discovery={draft.discovery} onChange={(disc) => setDraft((d) => ({ ...d, discovery: disc }))} />
            </DetailPanel>
          ) : isHidden(bestiary[entryId]) ? (
            <MaskedDetail teaser={bestiary[entryId].discovery?.teaser} />
          ) : (
            <div className="flex flex-col gap-3">
              <EntryHeroHeader
                accent={CATEGORY_ACCENTS.bestiary}
                title={bestiary[entryId].name}
                subtitle={bestiary[entryId].threatTier}
                badges={<AutoBadge shown={bestiary[entryId].autoLogged} />}
              />
              <SectionCard accent={CATEGORY_ACCENTS.bestiary} icon={Skull} title="Combat Profile">
                <FieldRow label="Threat" value={bestiary[entryId].threatTier} icon={Skull} />
                {(bestiary[entryId].hpMax !== undefined || bestiary[entryId].dmgBase !== undefined) && (
                  <div className="flex gap-2">
                    {bestiary[entryId].hpMax !== undefined && <StatTile label="HP" value={bestiary[entryId].hpMax!} accent={CATEGORY_ACCENTS.bestiary} />}
                    {bestiary[entryId].dmgBase !== undefined && <StatTile label="Damage" value={bestiary[entryId].dmgBase!} accent={CATEGORY_ACCENTS.bestiary} />}
                  </div>
                )}
                {bestiary[entryId].weaknesses && <FieldRow label="Weaknesses" value={bestiary[entryId].weaknesses} icon={Zap} />}
              </SectionCard>
              {(bestiary[entryId].habitat || bestiary[entryId].description || bestiary[entryId].lootTable) && (
                <SectionCard accent={CATEGORY_ACCENTS.bestiary} icon={ScrollText} title="Ecology & Spoils">
                  {bestiary[entryId].habitat && <FieldRow label="Habitat" value={bestiary[entryId].habitat} icon={MapPin} />}
                  {bestiary[entryId].lootTable && <FieldRow label="Loot" value={bestiary[entryId].lootTable} icon={Gift} />}
                  {bestiary[entryId].description && <FieldRow label="Notes" value={bestiary[entryId].description} />}
                </SectionCard>
              )}
              <TagPills tags={bestiary[entryId].tags} accent={CATEGORY_ACCENTS.bestiary} />
            </div>
          )}
        </>
      )}

      {/* Skills */}
      {category === 'skills' && !entryId && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <AddButton label="Add Skill" onClick={() => startCreate({ name: '', description: '', classId: '', mpCost: '', stCost: '' })} />
          {filteredSkills.map(([id, s]) => {
            const hidden = isHidden(s)
            const metaChips: MetaChip[] = hidden
              ? []
              : [
                  classNameFor(s.classId) ? { icon: Star, label: classNameFor(s.classId)! } : null,
                  s.tier ? { icon: Sparkles, label: s.tier } : null,
                ].filter(Boolean) as MetaChip[]
            return (
              <DeckEntryCard
                key={id}
                accent={CATEGORY_ACCENTS.skills}
                title={hidden ? '???' : s.name}
                kicker={hidden ? undefined : [s.skillType, classNameFor(s.classId)].filter(Boolean).join(' · ')}
                subtitle={
                  hidden
                    ? s.discovery?.teaser || 'Not yet discovered.'
                    : s.flavorText || s.description || 'A martial or magical technique.'
                }
                badge={hidden ? <LockBadge /> : <SkillCostBadge skill={s} />}
                metaChips={metaChips}
                onClick={() => setEntryId(id)}
              />
            )
          })}
          {Object.keys(skills).length === 0 ? (
            <p className="font-narrative italic text-sm text-ink-muted col-span-full">
              No skills learned yet. They register automatically as the Narrator names them, or add one by hand.
            </p>
          ) : filteredSkills.length === 0 ? (
            <p className="font-narrative italic text-sm text-ink-muted col-span-full">No skills match current filters.</p>
          ) : null}
        </div>
      )}
      {category === 'skills' && entryId && (editing || skills[entryId]) && (
        <>
          <div className="flex justify-end mb-3">
            <CrudToolbar
              editing={editing}
              canDelete={entryId !== NEW_ID}
              onEdit={() =>
                startEdit(entryId, {
                  ...skills[entryId],
                  classId: skills[entryId].classId ?? '',
                  mpCost: skills[entryId].mpCost ?? '',
                  stCost: skills[entryId].stCost ?? '',
                })
              }
              onSave={saveSkill}
              onCancel={cancelEdit}
              onDelete={() => deleteEntry('skills')}
            />
          </div>
          {editing ? (
            <DetailPanel>
              <TextField label="Name" value={draft.name ?? ''} onChange={(v) => setDraft((d) => ({ ...d, name: v }))} />
              <TextField label="Description" value={draft.description ?? ''} onChange={(v) => setDraft((d) => ({ ...d, description: v }))} />
              <TextField label="Flavor Text" value={draft.flavorText ?? ''} onChange={(v) => setDraft((d) => ({ ...d, flavorText: v }))} placeholder="A short evocative line, distinct from the mechanical description." />
              <TextField label="Skill Type" value={draft.skillType ?? ''} onChange={(v) => setDraft((d) => ({ ...d, skillType: v }))} placeholder="Offensive, Defensive, Utility, Passive…" />
              <TextField label="Tier" value={draft.tier ?? ''} onChange={(v) => setDraft((d) => ({ ...d, tier: v }))} placeholder="Novice, Adept, Master…" />
              <label className="block">
                <span className="text-[11px] font-display uppercase tracking-[0.14em] text-[#f0d9a4]">Owning Class</span>
                <select
                  value={draft.classId ?? ''}
                  onChange={(e) => setDraft((d) => ({ ...d, classId: e.target.value }))}
                  className={`mt-1 ${SELECT_CLASS}`}
                >
                  <option value="">— none —</option>
                  {PRESET_CLASSES.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <NumberField label="MP Cost" value={draft.mpCost === '' ? 0 : (draft.mpCost ?? 0)} onChange={(v) => setDraft((d) => ({ ...d, mpCost: v }))} />
              <NumberField label="ST Cost" value={draft.stCost === '' ? 0 : (draft.stCost ?? 0)} onChange={(v) => setDraft((d) => ({ ...d, stCost: v }))} />
              <DiscoveryEditor discovery={draft.discovery} onChange={(disc) => setDraft((d) => ({ ...d, discovery: disc }))} />
            </DetailPanel>
          ) : isHidden(skills[entryId]) ? (
            <MaskedDetail teaser={skills[entryId].discovery?.teaser} />
          ) : (
            <div className="flex flex-col gap-3">
              <EntryHeroHeader
                accent={CATEGORY_ACCENTS.skills}
                title={skills[entryId].name}
                subtitle={skills[entryId].flavorText || [skills[entryId].skillType, skills[entryId].tier].filter(Boolean).join(' · ')}
                badges={<SkillCostBadge skill={skills[entryId]} />}
              />
              <SectionCard accent={CATEGORY_ACCENTS.skills} icon={Sparkles} title="Ability Profile">
                {classNameFor(skills[entryId].classId) && <FieldRow label="Class" value={classNameFor(skills[entryId].classId)!} icon={Star} />}
                {skills[entryId].skillType && <FieldRow label="Type" value={skills[entryId].skillType!} />}
                {skills[entryId].tier && <FieldRow label="Tier" value={skills[entryId].tier!} />}
                <div className="flex gap-2">
                  {skills[entryId].mpCost !== undefined && <StatTile label="MP Cost" value={skills[entryId].mpCost!} accent={CATEGORY_ACCENTS.skills} />}
                  {skills[entryId].stCost !== undefined && <StatTile label="ST Cost" value={skills[entryId].stCost!} accent={CATEGORY_ACCENTS.skills} />}
                </div>
                {/* Affordability preview */}
                {(() => {
                  const { affordable, missing } = checkAffordability(skills[entryId], player)
                  if (affordable) return null
                  return (
                    <p className="font-narrative text-xs text-rose">
                      Not enough reserves right now — short {missing}.
                    </p>
                  )
                })()}
              </SectionCard>
              {(skills[entryId].description || skills[entryId].flavorText) && (
                <SectionCard accent={CATEGORY_ACCENTS.skills} icon={ScrollText} title="Effect & Lore">
                  {skills[entryId].description && <FieldRow label="Mechanics" value={skills[entryId].description!} />}
                  {skills[entryId].flavorText && (
                    <div className="mt-1 p-3 rounded-lg bg-[#0f121d]/70 border border-[#2b3046] font-narrative text-xs italic text-[#f6eedb]/90">
                      "{skills[entryId].flavorText}"
                    </div>
                  )}
                </SectionCard>
              )}
            </div>
          )}
        </>
      )}

      {/* Items */}
      {category === 'items' && !entryId && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <AddButton label="Add Item" onClick={() => startCreate({ name: '', type: 'material', qty: '1', description: '', statBonus: {} })} />
          {filteredItems.map(([id]) => {
            const qty = inventory[id]
            const item = items[id]
            const slot = equippedSlotFor(id)
            const accent = itemAccentFor(item?.rarity)
            const bonus = statBonusText(item?.statBonus)
            const metaChips: MetaChip[] = [
              { icon: Coins, label: `×${qty}` },
              bonus ? { icon: Zap, label: bonus } : null,
              item?.value ? { icon: Coins, label: `${item.value}g` } : null,
            ].filter(Boolean) as MetaChip[]
            return (
              <DeckEntryCard
                key={id}
                accent={accent}
                title={item?.name ?? id.replace(/_/g, ' ')}
                kicker={[item?.type ?? 'unknown', item?.rarity].filter(Boolean).join(' · ')}
                subtitle={item?.description || item?.loreText || 'Stored in your gear pouch.'}
                badge={slot ? <span className={accent.badge}>equipped</span> : undefined}
                metaChips={metaChips}
                tags={item?.tags}
                onClick={() => setEntryId(id)}
              />
            )
          })}
          {Object.keys(inventory).length === 0 ? (
            <p className="font-narrative italic text-sm text-ink-muted col-span-full">Nothing carried yet.</p>
          ) : filteredItems.length === 0 ? (
            <p className="font-narrative italic text-sm text-ink-muted col-span-full">No items match current filters.</p>
          ) : null}
        </div>
      )}
      {category === 'items' && entryId && (editing || inventory[entryId] !== undefined) && (
        <>
          <div className="flex justify-end mb-3">
            <CrudToolbar
              editing={editing}
              canDelete={entryId !== NEW_ID}
              onEdit={() =>
                startEdit(entryId, {
                  name: items[entryId]?.name ?? entryId.replace(/_/g, ' '),
                  type: items[entryId]?.type ?? 'material',
                  qty: String(inventory[entryId] ?? 1),
                  description: items[entryId]?.description ?? '',
                  statBonus: items[entryId]?.statBonus ?? {},
                  rarity: items[entryId]?.rarity ?? '',
                  loreText: items[entryId]?.loreText ?? '',
                  value: items[entryId]?.value ?? '',
                  tags: items[entryId]?.tags,
                })
              }
              onSave={saveItem}
              onCancel={cancelEdit}
              onDelete={deleteItemEntry}
            />
          </div>
          {editing ? (
            <DetailPanel>
              <TextField label="Name" value={draft.name ?? ''} onChange={(v) => setDraft((d) => ({ ...d, name: v }))} />
              <label className="block">
                <span className="text-[11px] font-display text-ink-muted uppercase tracking-wide">Type</span>
                <select
                  value={draft.type ?? 'material'}
                  onChange={(e) => setDraft((d) => ({ ...d, type: e.target.value as ItemType }))}
                  className="mt-1 w-full rounded-lg border border-[#e8ca8a]/25 bg-[#e8ca8a]/[0.04] backdrop-blur-sm px-3 py-2 font-mono text-sm text-ink"
                >
                  {ITEM_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </label>
              <NumberField label="Quantity" value={Number(draft.qty) || 1} onChange={(v) => setDraft((d) => ({ ...d, qty: String(v) }))} />
              <TextField
                label="Description"
                value={draft.description ?? ''}
                onChange={(v) => setDraft((d) => ({ ...d, description: v }))}
                textarea
                placeholder="Optional — worth writing for key items and notable gear, not routine loot"
              />
              {EQUIPPABLE_TYPES.includes(draft.type) && (
                <div className="rounded-lg border border-[#e8ca8a]/25 p-3 flex flex-col gap-2">
                  <span className="text-[11px] font-display text-ink-muted uppercase tracking-wide">Stat Bonus (applied on equip)</span>
                  <div className="grid grid-cols-3 gap-2">
                    {STAT_BONUS_KEYS.map((k) => (
                      <NumberField
                        key={k}
                        label={k}
                        value={draft.statBonus?.[k] ?? 0}
                        onChange={(v) => setDraft((d) => ({ ...d, statBonus: { ...d.statBonus, [k]: v || undefined } }))}
                      />
                    ))}
                  </div>
                </div>
              )}
              <TextField label="Rarity" value={draft.rarity ?? ''} onChange={(v) => setDraft((d) => ({ ...d, rarity: v }))} placeholder="Common, Rare, Legendary…" />
              <TextField label="Lore Text" value={draft.loreText ?? ''} onChange={(v) => setDraft((d) => ({ ...d, loreText: v }))} textarea placeholder="An evocative line, distinct from the mechanical description above." />
              <NumberField label="Value" value={draft.value === '' ? 0 : (draft.value ?? 0)} onChange={(v) => setDraft((d) => ({ ...d, value: v }))} />
              <TagsField value={draft.tags} onChange={(tags) => setDraft((d) => ({ ...d, tags }))} />
            </DetailPanel>
          ) : (
            <div className="flex flex-col gap-3">
              <EntryHeroHeader
                accent={itemAccentFor(items[entryId]?.rarity)}
                title={items[entryId]?.name ?? entryId.replace(/_/g, ' ')}
                subtitle={[items[entryId]?.type ?? 'unknown', items[entryId]?.rarity].filter(Boolean).join(' · ')}
                badges={equippedSlotFor(entryId) ? <span className={itemAccentFor(items[entryId]?.rarity).badge}>equipped</span> : undefined}
              />
              <SectionCard accent={itemAccentFor(items[entryId]?.rarity)} icon={Backpack} title="Item Dossier">
                <FieldRow label="Type" value={items[entryId]?.type ?? 'unknown'} />
                <FieldRow label="Quantity" value={String(inventory[entryId] ?? 0)} />
                {items[entryId]?.value !== undefined && <FieldRow label="Value" value={`${items[entryId]!.value} gold`} icon={Coins} />}
                {statBonusText(items[entryId]?.statBonus) && <FieldRow label="Stat Bonus" value={statBonusText(items[entryId]?.statBonus)!} icon={Zap} />}
                {items[entryId]?.description && <FieldRow label="Description" value={items[entryId]!.description!} />}
                {items[entryId] && EQUIPPABLE_TYPES.includes(items[entryId]!.type) && (
                  <div className="mt-2 pt-2 border-t border-[#e8ca8a]/15">
                    {equippedSlotFor(entryId) ? (
                      <button
                        onClick={() => onUnequipSlot(equippedSlotFor(entryId)!)}
                        className="rounded-full px-4 py-1.5 font-display text-xs font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/30"
                      >
                        Unequip
                      </button>
                    ) : (
                      <button onClick={() => onEquipItem(entryId)} className="rounded-full px-4 py-1.5 font-display text-xs font-semibold bg-[#e8ca8a] text-[#0e1017]">
                        Equip
                      </button>
                    )}
                  </div>
                )}
              </SectionCard>
              {items[entryId]?.loreText && (
                <SectionCard accent={itemAccentFor(items[entryId]?.rarity)} icon={ScrollText} title="Inscription">
                  <div className="p-3 rounded-lg bg-[#0f121d]/70 border border-[#2b3046] font-narrative text-xs italic text-[#f6eedb]/90">
                    "{items[entryId]!.loreText}"
                  </div>
                </SectionCard>
              )}
              <TagPills tags={items[entryId]?.tags} accent={itemAccentFor(items[entryId]?.rarity)} />
            </div>
          )}
        </>
      )}

      {confirmDialog}
    </GlassScreen>
    {longTextDialog}
    </LongTextEditorContext.Provider>
  )
}
