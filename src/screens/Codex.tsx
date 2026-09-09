import { createContext, useState, useMemo, useEffect, useContext } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  Globe, BookOpen, Users, ShieldCheck, Map, ScrollText, Target, Skull, Backpack,
  Pencil, Save, X, Trash2, Plus, Lock, User, Hammer, Clock, Sparkles, CheckCircle2, XCircle, ArrowRight, Ghost,
  Swords, Star, EyeOff, Search, MapPin, Heart, Coins, Gift, Zap, Compass, AlertTriangle, Shield, Flame, Milestone, ListChecks,
  ChevronRight,
} from 'lucide-react'
import { DASHED_ROW_CLASS, GLASS_SURFACE_LIST, GlassHeader, GlassIconButton, GlassScreen, SELECT_CLASS } from '../lib/glassChrome.tsx'
import { slugify } from '../lib/slug.ts'
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
  BestiaryEntry, CompetencyTier, CraftingJob, Discovery, EquipSlot, FactionEntry, ItemEntry, ItemType, LocationEntry, LogEntry, LoreEntry, NpcEntry, Player,
  ProjectEntry, ProjectStage, QuestEntry, RegionEntry, RevealTrigger, SkillEntry, ThreatTierToken, WorldData,
} from '../types.ts'
import { COMPETENCY_TIERS, THREAT_TIERS, tierToWord, wordToTier, displayThreatLabel } from '../lib/tiers.ts'
import { trustWord } from '../lib/npcs.ts'

import codexArchiveBanner from '../assets/images/codex_archive_banner.webp'
import codexRealmArt from '../assets/images/codex_realm_art.webp'
import codexCharactersArt from '../assets/images/codex_characters_art.webp'
import codexBestiaryArt from '../assets/images/codex_bestiary_art.webp'
import codexFactionsArt from '../assets/images/codex_factions_art.webp'
import codexLocationsArt from '../assets/images/codex_locations_art.webp'
import codexSkillsArt from '../assets/images/codex_skills_art.webp'
import codexItemsArt from '../assets/images/codex_items_art.webp'

const CATEGORY_ART: Record<string, string> = {
  campaign: codexRealmArt,
  chapters: codexArchiveBanner,
  npcs: codexCharactersArt,
  factions: codexFactionsArt,
  locations: codexLocationsArt,
  lore: codexArchiveBanner,
  skills: codexSkillsArt,
  items: codexItemsArt,
  quests: codexArchiveBanner,
  crafting: codexItemsArt,
  projects: codexLocationsArt,
  bestiary: codexBestiaryArt,
}

const ITEM_TYPES: ItemType[] = ['weapon', 'armor', 'accessory', 'tool', 'key', 'consumable', 'material']

function traitsText(traits: ItemEntry['traits']): string | null {
  return traits?.length ? traits.join(', ') : null
}

export type CategoryId =
  | 'campaign' | 'crafting' | 'chapters' | 'npcs' | 'factions' | 'locations' | 'regions' | 'lore' | 'quests' | 'bestiary' | 'items' | 'skills' | 'projects'

interface CodexProps {
  world: WorldData
  player: Player
  log: LogEntry[]
  npcs: Record<string, NpcEntry>
  skills: Record<string, SkillEntry>
  factions: Record<string, FactionEntry>
  locations: Record<string, LocationEntry>
  regions: Record<string, RegionEntry>
  lore: Record<string, LoreEntry>
  quests: Record<string, QuestEntry>
  bestiary: Record<string, BestiaryEntry>
  flags: string[]
  inventory: Record<string, number>
  items: Record<string, ItemEntry>
  crafting: CraftingJob[]
  projects: Record<string, ProjectEntry>
  onUpdateNpc: (id: string, patch: Partial<NpcEntry> | null) => void
  onUpdateFaction: (id: string, patch: Partial<FactionEntry> | null) => void
  onUpdateLocation: (id: string, patch: Partial<LocationEntry> | null) => void
  onUpdateRegion: (id: string, patch: Partial<RegionEntry> | null) => void
  onUpdateLore: (id: string, patch: Partial<LoreEntry> | null) => void
  onUpdateQuest: (id: string, patch: Partial<QuestEntry> | null) => void
  onUpdateBestiary: (id: string, patch: Partial<BestiaryEntry> | null) => void
  onUpdateProject: (id: string, patch: Partial<ProjectEntry> | null) => void
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

function StatBar({ label, value, max = 100, displayValue }: { label: string; value: number; max?: number; displayValue?: string }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-14 font-display text-ink-muted">{label}</span>
      <div className="flex-1 h-1.5 rounded-full bg-[#e8ca8a]/12 overflow-hidden">
        <div className="h-full bg-[#e8ca8a]" style={{ width: `${pct}%` }} />
      </div>
      <span className="font-mono text-right text-ink">{displayValue ?? value}</span>
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

function NumberField({
  label,
  value,
  onChange,
  placeholder = '0',
  min,
  max,
  step,
}: {
  label: string
  value: number | string | undefined | null
  onChange: (v: number) => void
  placeholder?: string
  min?: number
  max?: number
  step?: number
}) {
  const [editingText, setEditingText] = useState<string | null>(null)

  const numVal = typeof value === 'number' ? value : (value !== undefined && value !== null && value !== '' ? Number(value) : undefined)
  const displayVal = editingText !== null
    ? editingText
    : (numVal === undefined || Number.isNaN(numVal) ? '' : (numVal === 0 ? '' : String(numVal)))

  return (
    <label className="block">
      <span className="text-[11px] font-display text-ink-muted uppercase tracking-wide">{label}</span>
      <input
        type="number"
        value={displayVal}
        placeholder={placeholder}
        min={min}
        max={max}
        step={step}
        onFocus={(e) => {
          if (editingText === null) {
            setEditingText(numVal !== undefined && !Number.isNaN(numVal) && numVal !== 0 ? String(numVal) : '')
          }
          e.target.select()
        }}
        onChange={(e) => {
          const raw = e.target.value
          setEditingText(raw)
          if (raw === '' || raw === '-') {
            onChange(0)
          } else {
            const parsed = Number(raw)
            if (!Number.isNaN(parsed)) {
              onChange(parsed)
            }
          }
        }}
        onBlur={() => {
          setEditingText(null)
        }}
        className="mt-1 w-full rounded-lg border border-[#e8ca8a]/25 bg-[#e8ca8a]/[0.04] backdrop-blur-sm px-3 py-2 font-mono text-sm text-ink placeholder:text-[#8e94a8]/50"
      />
    </label>
  )
}

// A canonical-word tier picker (CompetencyTier or ThreatTierToken) — the
// same "pick from a fixed word list" pattern the XML grammar itself enforces
// on the model, mirrored here so hand-authored CRUD can't drift off it either.
function TierField<T extends readonly string[]>({
  label, value, scale, onChange,
}: {
  label: string
  value: number
  scale: T
  onChange: (v: number) => void
}) {
  return (
    <label className="block">
      <span className="text-[11px] font-display text-ink-muted uppercase tracking-wide">{label}</span>
      <select
        value={tierToWord(value, scale)}
        onChange={(e) => onChange(wordToTier(e.target.value, scale))}
        className="mt-1 w-full rounded-lg border border-[#e8ca8a]/25 bg-[#e8ca8a]/[0.04] backdrop-blur-sm px-3 py-2 font-mono text-sm text-ink"
      >
        {scale.map((word) => (
          <option key={word} value={word}>{word}</option>
        ))}
      </select>
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

// §6.4D card badge — effort pill in the same cool indigo the [Active Skill]
// markup uses inline in narration (§4.2), so a skill reads as the same
// category of thing whether you meet it in prose or in the Codex.
function SkillCostBadge({ skill }: { skill: SkillEntry }) {
  if (!skill.effort) return null
  return (
    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-skill/40 bg-skill-bg text-skill capitalize">
      {skill.effort}
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
type CoreCategoryId = 'npcs' | 'factions' | 'locations' | 'regions' | 'lore' | 'quests' | 'bestiary' | 'skills' | 'items' | 'projects'

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

// Unified classic antique light-gold / obsidian palette for all Codex categories
const GOLD_CARD_STYLE = `${GLASS_SURFACE_LIST} bg-gradient-to-r from-[#121622] via-[#0e111a] to-[#0a0d14] border-[#c4a259]/30 rounded-xl p-3 sm:p-3.5 flex flex-col gap-1.5 transition-all duration-200 hover:border-[#f0ca65]/70 hover:bg-[#161a28] hover:shadow-[0_4px_16px_rgba(240,202,101,0.18)] cursor-pointer group`
const GOLD_ICON_BADGE = 'w-9 h-9 rounded-full bg-[#18130a] border border-[#c4a259]/40 flex items-center justify-center text-[#f0ca65] shrink-0 group-hover:scale-105 group-hover:border-[#f0ca65]/80 group-hover:shadow-[0_0_10px_rgba(240,202,101,0.25)] transition-all'
const GOLD_KICKER = 'font-mono text-[9px] text-[#a8a18c] uppercase tracking-wider group-hover:text-[#fae5b5]/90'
const GOLD_BADGE = 'rounded-lg bg-[#18130a] border border-[#c4a259]/40 text-[#fae5b5] px-2.5 py-0.5 text-[11px] font-mono shrink-0 group-hover:border-[#f0ca65]/80 group-hover:bg-[#f0ca65]/15 transition-all'
const GOLD_TAG = 'rounded-full border border-[#c4a259]/35 bg-[#c4a259]/10 px-2 py-0.5 text-[9px] font-mono text-[#fae5b5]'
const GOLD_ACTIVE_TAB = 'bg-[#f0ca65]/20 text-[#fae5b5] border-[#f0ca65]/70 shadow-[0_0_12px_rgba(240,202,101,0.25)]'

const CATEGORY_ACCENTS: Record<CoreCategoryId, CategoryAccent> = {
  npcs: {
    icon: Users,
    card: GOLD_CARD_STYLE,
    iconBadge: GOLD_ICON_BADGE,
    kicker: GOLD_KICKER,
    badge: GOLD_BADGE,
    sectionIcon: 'text-[#f0ca65]',
    tag: GOLD_TAG,
    activeTab: GOLD_ACTIVE_TAB,
  },
  factions: {
    icon: ShieldCheck,
    card: GOLD_CARD_STYLE,
    iconBadge: GOLD_ICON_BADGE,
    kicker: GOLD_KICKER,
    badge: GOLD_BADGE,
    sectionIcon: 'text-[#f0ca65]',
    tag: GOLD_TAG,
    solid: 'bg-[#f0ca65]',
    activeTab: GOLD_ACTIVE_TAB,
  },
  locations: {
    icon: Map,
    card: GOLD_CARD_STYLE,
    iconBadge: GOLD_ICON_BADGE,
    kicker: GOLD_KICKER,
    badge: GOLD_BADGE,
    sectionIcon: 'text-[#f0ca65]',
    tag: GOLD_TAG,
    activeTab: GOLD_ACTIVE_TAB,
  },
  regions: {
    icon: Compass,
    card: GOLD_CARD_STYLE,
    iconBadge: GOLD_ICON_BADGE,
    kicker: GOLD_KICKER,
    badge: GOLD_BADGE,
    sectionIcon: 'text-[#f0ca65]',
    tag: GOLD_TAG,
    activeTab: GOLD_ACTIVE_TAB,
  },
  lore: {
    icon: ScrollText,
    card: GOLD_CARD_STYLE,
    iconBadge: GOLD_ICON_BADGE,
    kicker: GOLD_KICKER,
    badge: GOLD_BADGE,
    sectionIcon: 'text-[#f0ca65]',
    tag: GOLD_TAG,
    activeTab: GOLD_ACTIVE_TAB,
  },
  quests: {
    icon: Target,
    card: GOLD_CARD_STYLE,
    iconBadge: GOLD_ICON_BADGE,
    kicker: GOLD_KICKER,
    badge: GOLD_BADGE,
    sectionIcon: 'text-[#f0ca65]',
    tag: GOLD_TAG,
    activeTab: GOLD_ACTIVE_TAB,
  },
  bestiary: {
    icon: Skull,
    card: GOLD_CARD_STYLE,
    iconBadge: GOLD_ICON_BADGE,
    kicker: GOLD_KICKER,
    badge: GOLD_BADGE,
    sectionIcon: 'text-[#f0ca65]',
    tag: GOLD_TAG,
    solid: 'bg-[#f0ca65]',
    activeTab: GOLD_ACTIVE_TAB,
  },
  skills: {
    icon: Sparkles,
    card: GOLD_CARD_STYLE,
    iconBadge: GOLD_ICON_BADGE,
    kicker: GOLD_KICKER,
    badge: GOLD_BADGE,
    sectionIcon: 'text-[#f0ca65]',
    tag: GOLD_TAG,
    activeTab: GOLD_ACTIVE_TAB,
  },
  items: {
    icon: Backpack,
    card: GOLD_CARD_STYLE,
    iconBadge: GOLD_ICON_BADGE,
    kicker: GOLD_KICKER,
    badge: GOLD_BADGE,
    sectionIcon: 'text-[#f0ca65]',
    tag: GOLD_TAG,
    activeTab: GOLD_ACTIVE_TAB,
  },
  projects: {
    icon: Milestone,
    card: GOLD_CARD_STYLE,
    iconBadge: GOLD_ICON_BADGE,
    kicker: GOLD_KICKER,
    badge: GOLD_BADGE,
    sectionIcon: 'text-[#f0ca65]',
    tag: GOLD_TAG,
    solid: 'bg-[#f0ca65]',
    activeTab: GOLD_ACTIVE_TAB,
  },
}

// For non-CRUD categories (Campaign/Crafting/Chapters) — shared light-gold identity
const NEUTRAL_ACCENT: CategoryAccent = {
  icon: Globe,
  card: GOLD_CARD_STYLE,
  iconBadge: GOLD_ICON_BADGE,
  kicker: GOLD_KICKER,
  badge: GOLD_BADGE,
  sectionIcon: 'text-[#f0ca65]',
  tag: GOLD_TAG,
  activeTab: GOLD_ACTIVE_TAB,
}

// Item rarity accents: tasteful RPG borders with subdued ambient glows
const ITEM_RARITY_ACCENTS: Record<string, CategoryAccent> = {
  common: {
    icon: Backpack,
    card: `${GLASS_SURFACE_LIST} bg-[#121622]/90 border-[#3b4256] rounded-xl p-3 flex flex-col gap-1.5 transition-all duration-200 hover:border-[#9ca3af]/80 hover:bg-[#191c2c] cursor-pointer group`,
    iconBadge: 'w-9 h-9 rounded-full bg-[#181d2a] border border-[#3b4256] flex items-center justify-center text-[#9ca3af] shrink-0 group-hover:scale-105 transition-all',
    kicker: 'font-mono text-[9px] text-[#a8a18c] uppercase tracking-wider group-hover:text-[#d1d5db]',
    badge: 'rounded-lg bg-[#181d2a] border border-[#3b4256] text-[#9ca3af] px-2.5 py-0.5 text-[11px] font-mono shrink-0 transition-all',
    sectionIcon: 'text-[#9ca3af]',
    tag: 'rounded-full border border-[#9ca3af]/35 bg-[#9ca3af]/10 px-2 py-0.5 text-[9px] font-mono text-[#d1d5db]',
    activeTab: 'bg-[#9ca3af]/20 text-[#d1d5db] border-[#9ca3af]/60',
  },
  uncommon: {
    icon: Backpack,
    card: `${GLASS_SURFACE_LIST} bg-[#121622]/90 border-[#1f382a] rounded-xl p-3 flex flex-col gap-1.5 transition-all duration-200 hover:border-[#4ade80]/70 hover:bg-[#191c2c] cursor-pointer group`,
    iconBadge: 'w-9 h-9 rounded-full bg-[#102419] border border-[#274836] flex items-center justify-center text-[#4ade80] shrink-0 group-hover:scale-105 transition-all',
    kicker: 'font-mono text-[9px] text-[#a8a18c] uppercase tracking-wider group-hover:text-[#86efac]',
    badge: 'rounded-lg bg-[#102419] border border-[#274836] text-[#86efac] px-2.5 py-0.5 text-[11px] font-mono shrink-0 transition-all',
    sectionIcon: 'text-[#4ade80]',
    tag: 'rounded-full border border-[#4ade80]/35 bg-[#4ade80]/10 px-2 py-0.5 text-[9px] font-mono text-[#86efac]',
    activeTab: 'bg-[#4ade80]/20 text-[#86efac] border-[#4ade80]/60',
  },
  rare: {
    icon: Backpack,
    card: `${GLASS_SURFACE_LIST} bg-[#121622]/90 border-[#1c324b] rounded-xl p-3 flex flex-col gap-1.5 transition-all duration-200 hover:border-[#60a5fa]/70 hover:bg-[#191c2c] cursor-pointer group`,
    iconBadge: 'w-9 h-9 rounded-full bg-[#0e2136] border border-[#224469] flex items-center justify-center text-[#60a5fa] shrink-0 group-hover:scale-105 transition-all',
    kicker: 'font-mono text-[9px] text-[#a8a18c] uppercase tracking-wider group-hover:text-[#93c5fd]',
    badge: 'rounded-lg bg-[#0e2136] border border-[#224469] text-[#93c5fd] px-2.5 py-0.5 text-[11px] font-mono shrink-0 transition-all',
    sectionIcon: 'text-[#60a5fa]',
    tag: 'rounded-full border border-[#60a5fa]/35 bg-[#60a5fa]/10 px-2 py-0.5 text-[9px] font-mono text-[#93c5fd]',
    activeTab: 'bg-[#60a5fa]/20 text-[#93c5fd] border-[#60a5fa]/60',
  },
  epic: {
    icon: Backpack,
    card: `${GLASS_SURFACE_LIST} bg-[#121622]/90 border-[#371f4b] rounded-xl p-3 flex flex-col gap-1.5 transition-all duration-200 hover:border-[#c084fc]/70 hover:bg-[#191c2c] cursor-pointer group`,
    iconBadge: 'w-9 h-9 rounded-full bg-[#251336] border border-[#482869] flex items-center justify-center text-[#c084fc] shrink-0 group-hover:scale-105 transition-all',
    kicker: 'font-mono text-[9px] text-[#a8a18c] uppercase tracking-wider group-hover:text-[#d8b4fe]',
    badge: 'rounded-lg bg-[#251336] border border-[#482869] text-[#d8b4fe] px-2.5 py-0.5 text-[11px] font-mono shrink-0 transition-all',
    sectionIcon: 'text-[#c084fc]',
    tag: 'rounded-full border border-[#c084fc]/35 bg-[#c084fc]/10 px-2 py-0.5 text-[9px] font-mono text-[#d8b4fe]',
    activeTab: 'bg-[#c084fc]/20 text-[#d8b4fe] border-[#c084fc]/60',
  },
  legendary: {
    icon: Backpack,
    card: `${GLASS_SURFACE_LIST} bg-[#121622]/90 border-[#c4a259]/50 rounded-xl p-3 flex flex-col gap-1.5 transition-all duration-200 hover:border-[#f0ca65]/90 hover:bg-[#191c2c] hover:shadow-[0_4px_20px_rgba(240,202,101,0.3)] cursor-pointer group`,
    iconBadge: 'w-9 h-9 rounded-full bg-[#18130a] border border-[#c4a259]/50 flex items-center justify-center text-[#f0ca65] shrink-0 group-hover:scale-105 group-hover:border-[#f0ca65]/80 transition-all',
    kicker: 'font-mono text-[9px] text-[#a8a18c] uppercase tracking-wider group-hover:text-[#fae5b5]',
    badge: 'rounded-lg bg-[#18130a] border border-[#c4a259]/50 text-[#fae5b5] px-2.5 py-0.5 text-[11px] font-mono shrink-0 transition-all',
    sectionIcon: 'text-[#f0ca65]',
    tag: 'rounded-full border border-[#c4a259]/40 bg-[#c4a259]/15 px-2 py-0.5 text-[9px] font-mono text-[#fae5b5]',
    activeTab: 'bg-[#f0ca65]/20 text-[#fae5b5] border-[#f0ca65]/60',
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

// §7 Projects — same colored-ribbon status convention as Quests above.
const PROJECT_STATUS_META: Record<string, { label: string; icon: LucideIcon; className: string }> = {
  completed: { label: 'Completed', icon: CheckCircle2, className: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40' },
  stalled: { label: 'Stalled', icon: AlertTriangle, className: 'bg-amber-500/15 text-amber-300 border-amber-500/40' },
  active: { label: 'Active', icon: Hammer, className: 'bg-[#2dd4bf]/15 text-[#5eead4] border-[#2dd4bf]/40' },
}
function ProjectStatusBadge({ status }: { status?: string }) {
  const meta = PROJECT_STATUS_META[status ?? ''] ?? PROJECT_STATUS_META.active
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

// Codex Archives — the top-level Category List, styled as classic high-end fantasy RPG cards
// with illuminated gold icon rings, warm gold typography, and framed count badges.
function CodexArchiveRow({
  categoryId,
  icon: Icon,
  title,
  subtitle,
  count,
  onClick,
}: {
  categoryId?: CategoryId
  icon: LucideIcon
  title: string
  subtitle: string
  count: number
  onClick: () => void
}) {
  const artImage = categoryId ? CATEGORY_ART[categoryId] : undefined

  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick() }}
      className="group relative flex items-center gap-3.5 sm:gap-4 rounded-xl border border-[#c4a259]/30 hover:border-[#f0ca65]/80 bg-gradient-to-r from-[#121622] via-[#0e111a] to-[#0a0d14] hover:bg-[#161a28] p-2.5 sm:p-3 cursor-pointer transition-all duration-200 active:scale-[0.99] hover:shadow-[0_4px_20px_rgba(240,202,101,0.22)] overflow-hidden"
    >
      {/* Visual Artwork Thumbnail with Gold Frame & Icon Badge */}
      <div className="w-13 h-13 sm:w-14 sm:h-14 shrink-0 rounded-lg border border-[#c4a259]/50 overflow-hidden relative shadow-md group-hover:border-[#f0ca65] group-hover:shadow-[0_0_12px_rgba(240,202,101,0.35)] transition-all bg-[#17130b]">
        {artImage ? (
          <img
            src={artImage}
            alt=""
            className="w-full h-full object-cover object-center group-hover:scale-110 transition-transform duration-300 filter brightness-95 contrast-105"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-[#f0ca65]">
            <Icon size={22} />
          </div>
        )}
        {/* Subtle Scrim & Floating Icon Pill */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
        <div className="absolute bottom-1 right-1 w-5 h-5 rounded-full bg-[#121622]/90 border border-[#f0ca65]/60 flex items-center justify-center text-[#f0ca65] shadow">
          <Icon size={11} />
        </div>
      </div>

      {/* Title & Subtitle */}
      <div className="min-w-0 flex-1">
        <h3 className="font-display font-bold text-sm sm:text-base text-[#fae5b5] group-hover:text-white uppercase tracking-[0.14em] truncate transition-colors">
          {title}
        </h3>
        <p className="font-narrative text-xs text-[#a8a18c] group-hover:text-[#dcd2be] truncate mt-0.5 leading-snug transition-colors">
          {subtitle}
        </p>
      </div>

      {/* Framed Gold Count Box & Arrow */}
      <div className="flex items-center gap-2 shrink-0">
        <div
          className={`w-10 sm:w-11 h-9 sm:h-10 rounded-md border flex items-center justify-center font-serif font-bold text-sm sm:text-base transition-all ${
            count > 0
              ? 'border-[#c4a259]/50 bg-[#16130b] text-[#fae5b5] group-hover:border-[#f0ca65]/80 group-hover:text-[#fff4d1] group-hover:bg-[#f0ca65]/15 shadow-inner'
              : 'border-[#2d3348] bg-[#141724]/60 text-[#5c6178]'
          }`}
        >
          {count}
        </div>
        <ChevronRight
          size={16}
          className="text-[#72788e] group-hover:text-[#f0ca65] group-hover:translate-x-0.5 transition-all shrink-0"
        />
      </div>
    </div>
  )
}

// Compact horizontal filter subtab navigator for category entries.
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
    <div className="w-full max-w-full flex flex-wrap items-center gap-1 sm:gap-1.5 py-0.5 px-0.5 shrink-0">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id
        const Icon = tab.icon
        return (
          <button
            key={tab.id}
            onClick={() => onSelectTab(tab.id)}
            type="button"
            className={`flex items-center justify-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-lg text-xs font-mono font-medium whitespace-nowrap transition-all border cursor-pointer active:scale-95 ${
              isActive
                ? `${accent.activeTab} font-semibold`
                : 'bg-[#141724]/90 border-[#262c3e] text-[#8e94a8] hover:text-[#fae5b5] hover:border-[#c4a259]/40 hover:bg-[#1a1f30]'
            }`}
          >
            {Icon && <Icon size={12} className={`shrink-0 ${isActive ? accent.sectionIcon : 'text-[#7e8498]'}`} />}
            <span>{tab.label}</span>
            {tab.count !== undefined && (
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono shrink-0 ${
                  isActive ? 'bg-black/40 text-[#fae5b5]' : 'bg-[#1e2333] text-[#72788e]'
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
  regions,
  lore,
  quests,
  bestiary,
  flags,
  inventory,
  items,
  crafting,
  projects,
  onUpdateNpc,
  onUpdateFaction,
  onUpdateLocation,
  onUpdateRegion,
  onUpdateLore,
  onUpdateQuest,
  onUpdateBestiary,
  onUpdateProject,
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

  // Reset filters and scroll to top on category or entry navigation
  useEffect(() => {
    setSearchQuery('')
    setActiveSubtab('all')
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior })
  }, [category, entryId])

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
  const isTownLocation = (l: LocationEntry) => {
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
    return !isTownLocation(l) && !isPerilLocation(l)
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
      if (activeSubtab === 'towns' && !isTownLocation(l)) return false
      if (activeSubtab === 'wilderness' && !isWildLocation(l)) return false
      if (activeSubtab === 'perilous' && !isPerilLocation(l)) return false
      return true
    })
  }, [locations, searchQuery, activeSubtab])

  const filteredRegions = useMemo(() => {
    return Object.entries(regions).filter(([, r]) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        if (!r.name.toLowerCase().includes(q) && !r.description?.toLowerCase().includes(q)) return false
      }
      return true
    })
  }, [regions, searchQuery])

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

  const filteredProjects = useMemo(() => {
    return Object.entries(projects).filter(([, p]) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        const matchesName = p.name.toLowerCase().includes(q)
        const matchesNote = p.note?.toLowerCase().includes(q)
        const matchesPrereq = p.prerequisites?.join(' ').toLowerCase().includes(q)
        const matchesTurn = p.loggedAt?.toLowerCase().includes(q)
        if (!matchesName && !matchesNote && !matchesPrereq && !matchesTurn) return false
      }
      if (activeSubtab === 'active' && (p.status === 'completed' || p.status === 'stalled')) return false
      if (activeSubtab === 'stalled' && p.status !== 'stalled') return false
      if (activeSubtab === 'completed' && p.status !== 'completed') return false
      return true
    })
  }, [projects, searchQuery, activeSubtab])

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
        const isActive = Boolean(s.effort) || (s.skillType || '').toLowerCase() === 'active'
        if (!isActive) return false
      }
      if (activeSubtab === 'passive') {
        const isPassive = (s.skillType || '').toLowerCase() === 'passive' || !s.effort
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
        { id: 'allies', label: 'Allies', count: alliesCount, icon: Heart },
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
      const townsCount = Object.values(locations).filter(isTownLocation).length
      const wildCount = Object.values(locations).filter(isWildLocation).length
      const perilCount = Object.values(locations).filter(isPerilLocation).length
      return [
        { id: 'all', label: 'All', count: allCount, icon: Map },
        { id: 'towns', label: 'Towns', count: townsCount, icon: ShieldCheck },
        { id: 'wilderness', label: 'Wilds', count: wildCount, icon: Compass },
        { id: 'perilous', label: 'Perils', count: perilCount, icon: AlertTriangle },
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
        { id: 'main', label: 'Main', count: mainCount, icon: Star },
        { id: 'side', label: 'Side', count: sideCount, icon: Compass },
        { id: 'completed', label: 'Done', count: doneCount, icon: CheckCircle2 },
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
        { id: 'standard', label: 'Beasts', count: standardCount, icon: Swords },
        { id: 'elite', label: 'Elites', count: eliteCount, icon: Flame },
      ]
    }

    if (category === 'projects') {
      const allCount = Object.keys(projects).length
      const activeCount = Object.values(projects).filter((p) => p.status !== 'completed' && p.status !== 'stalled').length
      const stalledCount = Object.values(projects).filter((p) => p.status === 'stalled').length
      const doneCount = Object.values(projects).filter((p) => p.status === 'completed').length
      return [
        { id: 'all', label: 'All', count: allCount, icon: Milestone },
        { id: 'active', label: 'Active', count: activeCount, icon: Hammer },
        { id: 'stalled', label: 'Stalled', count: stalledCount, icon: AlertTriangle },
        { id: 'completed', label: 'Done', count: doneCount, icon: CheckCircle2 },
      ]
    }

    if (category === 'skills') {
      const allCount = Object.keys(skills).length
      const classCount = Object.values(skills).filter((s) => s.classId && s.classId === player.classId).length
      const activeCount = Object.values(skills).filter((s) => Boolean(s.effort) || (s.skillType || '').toLowerCase() === 'active').length
      const passiveCount = Object.values(skills).filter((s) => (s.skillType || '').toLowerCase() === 'passive' || !s.effort).length
      return [
        { id: 'all', label: 'All', count: allCount, icon: Sparkles },
        { id: 'class', label: 'Class', count: classCount, icon: Star },
        { id: 'active', label: 'Active', count: activeCount, icon: Zap },
        { id: 'passive', label: 'Passive', count: passiveCount, icon: Shield },
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
        { id: 'consumables', label: 'Potions', count: consumablesCount, icon: Heart },
        { id: 'materials', label: 'Materials', count: materialsCount, icon: Hammer },
      ]
    }

    return []
  }, [category, npcs, factions, locations, lore, loreCategories, quests, bestiary, skills, inventory, items, player, projects])

  const currentAccent = (category ? (CATEGORY_ACCENTS as Record<string, CategoryAccent>)[category] : undefined) ?? NEUTRAL_ACCENT

  const searchFilterBar = useMemo(() => {
    if (!category || entryId || editing) return null

    if (category === 'campaign' || category === 'crafting' || category === 'chapters') {
      return null
    }

    return (
      <div className="w-full max-w-full min-w-0 mb-4 flex flex-col gap-2 p-2.5 sm:p-3 rounded-2xl border border-[#252b3e] bg-[#0f121d]/90 shadow-[0_2px_12px_rgba(0,0,0,0.4)] overflow-hidden">
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

  // Ordered matching classic RPG Codex hierarchy: Realm -> Chapters -> NPCs -> Factions -> Locations -> Lore -> Skills -> Items -> Quests -> Crafting -> Projects -> Bestiary
  const categories: { id: CategoryId; label: string; description: string; icon: LucideIcon; count: number }[] = [
    { id: 'campaign', label: 'Realm', description: 'Cosmology, Setting, Tone & Arcs', icon: Globe, count: 1 },
    { id: 'chapters', label: 'Chapters', description: 'Chronological Records & Turning Points', icon: BookOpen, count: chapters.length },
    { id: 'npcs', label: 'NPCs', description: 'NPCs, Companions & Trust Ratings', icon: Users, count: Object.keys(npcs).length },
    { id: 'factions', label: 'Factions', description: 'Political Cabals, Guilds & Territory', icon: ShieldCheck, count: Object.keys(factions).length },
    { id: 'locations', label: 'Locations', description: 'Regions, Danger Levels & Map Conditions', icon: Map, count: Object.keys(locations).length },
    { id: 'regions', label: 'Regions', description: 'Named Areas Grouping Locations on the Map', icon: Compass, count: Object.keys(regions).length },
    { id: 'lore', label: 'Lore', description: 'Historical Legends, Secrets & Magic', icon: ScrollText, count: Object.keys(lore).length },
    { id: 'skills', label: 'Skills', description: 'Combat Spells, Techniques & Abilities', icon: Sparkles, count: Object.keys(skills).length },
    { id: 'items', label: 'Items', description: 'Equipment, Artifacts & Quest Items', icon: Backpack, count: Object.keys(inventory).length },
    { id: 'quests', label: 'Quests', description: 'Main, Side & Secret Objectives', icon: Target, count: Object.keys(quests).length },
    { id: 'crafting', label: 'Crafting', description: 'Item Recipes & Material Forging', icon: Hammer, count: crafting.length },
    { id: 'projects', label: 'Projects', description: 'Endeavors, Builds & Settlements', icon: Milestone, count: Object.keys(projects).length },
    { id: 'bestiary', label: 'Bestiary', description: 'Adversaries & Field Threats', icon: Skull, count: Object.keys(bestiary).length },
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
      resolve: draft.resolve ? Number(draft.resolve) as CompetencyTier : undefined,
      memSummary: draft.memSummary,
      deeds: typeof draft.deeds === 'string' ? draft.deeds.split(',').map((s: string) => s.trim()).filter(Boolean) : draft.deeds,
      role: draft.role?.trim() || undefined,
      appearance: draft.appearance?.trim() || undefined,
      heldWeapon: draft.heldWeapon?.trim() || undefined,
      wornArmor: draft.wornArmor?.trim() || undefined,
      personality: draft.personality?.trim() || undefined,
      voiceNotes: draft.voiceNotes?.trim() || undefined,
      secretTruth: draft.secretTruth?.trim() || undefined,
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
      // §7 Region Map Pins — hand-edited here the same as any other Codex
      // field; write-once in practice (world seeding sets these once, at
      // creation) but Codex CRUD is still the escape hatch to fix/set them
      // by hand, exactly like every other field on this entry.
      regionId: draft.regionId?.trim() || undefined,
      mapX: draft.mapX === undefined || Number.isNaN(draft.mapX) ? undefined : draft.mapX,
      mapY: draft.mapY === undefined || Number.isNaN(draft.mapY) ? undefined : draft.mapY,
      mapRadius: draft.mapRadius === undefined || Number.isNaN(draft.mapRadius) ? undefined : draft.mapRadius,
    })
    setEntryId(id)
    setEditing(false)
  }

  function saveRegion() {
    const id = entryId === NEW_ID ? genId(draft.name, regions) : entryId!
    onUpdateRegion(id, { name: draft.name, description: draft.description?.trim() || undefined })
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
      threatTier: (draft.threatTier ?? 'unknown') as ThreatTierToken,
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
      // An unset effort must stay undefined rather than collapsing to a
      // default tier — an effortless skill and an unset one read the same
      // in the UI but only the latter skips the §3.2 affordability note.
      effort: draft.effort || undefined,
      skillType: draft.skillType?.trim() || undefined,
      tier: draft.tier !== undefined && draft.tier !== '' ? wordToTier(draft.tier, COMPETENCY_TIERS) : undefined,
      flavorText: draft.flavorText?.trim() || undefined,
      discovery: validateDiscovery(draft.discovery, { locations, npcs, quests }),
    })
    setEntryId(id)
    setEditing(false)
  }

  // §7 Projects CRUD — stages are edited as a comma-separated label list
  // (same convention NPCs' Deeds field already uses for a string array);
  // an existing stage's `done` state survives a re-save as long as its label
  // is unchanged, matched by exact text. Toggling `done` day-to-day happens
  // directly from the detail view instead (toggleProjectStage below), not
  // through this form — no need to re-enter edit mode just to check a box.
  function saveProject() {
    const id = entryId === NEW_ID ? genId(draft.name, projects) : entryId!
    const existingStages = (entryId && entryId !== NEW_ID ? projects[entryId]?.stages : undefined) ?? []
    const stages: ProjectStage[] = (typeof draft.stagesText === 'string' ? draft.stagesText.split(',') : [])
      .map((s: string) => s.trim())
      .filter(Boolean)
      .map((label: string) => ({ label, done: existingStages.find((s) => s.label === label)?.done ?? false }))
    const prerequisites: string[] | undefined =
      typeof draft.prerequisites === 'string' && draft.prerequisites.trim()
        ? draft.prerequisites.split(',').map((s: string) => s.trim()).filter(Boolean)
        : undefined
    const etaDay = draft.etaDay !== undefined && draft.etaDay !== '' ? Number(draft.etaDay) : undefined
    const eta = etaDay !== undefined && Number.isFinite(etaDay) ? { d: etaDay, h: (draft.etaTime ?? '').trim() || '12:00 PM' } : undefined
    onUpdateProject(id, {
      name: draft.name,
      status: draft.status || undefined,
      stages,
      prerequisites,
      eta,
      note: draft.note?.trim() || undefined,
      discovery: validateDiscovery(draft.discovery, { locations, npcs, quests }),
    })
    setEntryId(id)
    setEditing(false)
  }

  // A direct, out-of-edit-mode action — clicking a stage in the detail view
  // flips its own done flag, the same "steer state directly" philosophy
  // already used for Equip/Unequip and Discovery reveals.
  function toggleProjectStage(id: string, stageIndex: number) {
    const project = projects[id]
    if (!project) return
    const stages = project.stages.map((s, i) => (i === stageIndex ? { ...s, done: !s.done } : s))
    onUpdateProject(id, { stages })
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

  async function deleteEntry(kind: Exclude<CategoryId, 'chapters' | 'campaign' | 'items'>) {
    if (!entryId || !(await confirm('Delete this entry? This cannot be undone.'))) return
    if (kind === 'npcs') onUpdateNpc(entryId, null)
    else if (kind === 'factions') onUpdateFaction(entryId, null)
    else if (kind === 'locations') onUpdateLocation(entryId, null)
    else if (kind === 'regions') onUpdateRegion(entryId, null)
    else if (kind === 'lore') onUpdateLore(entryId, null)
    else if (kind === 'quests') onUpdateQuest(entryId, null)
    else if (kind === 'bestiary') onUpdateBestiary(entryId, null)
    else if (kind === 'skills') onUpdateSkill(entryId, null)
    else if (kind === 'projects') onUpdateProject(entryId, null)
    setEntryId(null)
  }

  function saveItem() {
    const name = (draft.name ?? '').trim()
    if (!name) return
    const id = entryId === NEW_ID ? genId(name, inventory) : entryId!
    const qty = Math.max(1, Math.round(Number(draft.qty) || 1))
    const type: ItemType = draft.type ?? 'material'
    const traitsList: string[] | undefined =
      typeof draft.traits === 'string' && draft.traits.trim()
        ? draft.traits.split(',').map((t: string) => t.trim()).filter(Boolean)
        : undefined
    onUpdateItem(id, qty, {
      name,
      type,
      description: draft.description?.trim() || undefined,
      traits: traitsList,
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
    entryId && category === 'regions' ? (regions[entryId]?.name ?? entryId.replace(/_/g, ' ')) :
    entryId && category === 'lore' ? (lore[entryId] && isHidden(lore[entryId]) ? '???' : lore[entryId]?.name) :
    entryId && category === 'quests' ? (quests[entryId] && isHidden(quests[entryId]) ? '???' : quests[entryId]?.name) :
    entryId && category === 'bestiary' ? (bestiary[entryId] && isHidden(bestiary[entryId]) ? '???' : bestiary[entryId]?.name) :
    entryId && category === 'skills' ? (skills[entryId] && isHidden(skills[entryId]) ? '???' : skills[entryId]?.name) :
    entryId && category === 'items' ? (items[entryId]?.name ?? entryId.replace(/_/g, ' ')) :
    entryId && category === 'projects' ? (projects[entryId] && isHidden(projects[entryId]) ? '???' : projects[entryId]?.name) :
    categories.find((c) => c.id === category)?.label ?? 'Codex'

  return (
    // Dark ground, not the creation flow's artwork: the Codex is dense,
    // heavily scrolled reference reading, where a picture behind the text
    // would fight it.
    <LongTextEditorContext.Provider value={editLongText}>
    <GlassScreen ground="dark" className="px-3 sm:px-4 pb-16 pt-2">
      <GlassHeader title={title} onBack={back} className="!px-0 mb-3 sm:mb-4" />

      {searchFilterBar}

      {/* Level 1 — Category List. High-end fantasy RPG cards with per-category
          theming, illuminated icon frames, responsive 1/2-column grid, and clean
          interactive feedback. */}
      {!category && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {categories.map(({ id, label, description, icon: Icon, count }) => (
            <CodexArchiveRow
              key={id}
              categoryId={id}
              icon={Icon}
              title={label}
              subtitle={description}
              count={count}
              onClick={() => setCategory(id)}
            />
          ))}
        </div>
      )}

      {/* Campaign — merges the old separate Character and Realm categories
          into one screen (2026-09-07): both are single-record, no grid, and
          neither is CRUD-deletable, same as before. Since editing/draft is
          one shared piece of state for the whole component, the two sub-
          records discriminate on `entryId` ('__character__' vs '__world__')
          while editing — exactly the sentinel ids each already used when
          they were separate categories — so only the section actually being
          edited swaps into its form; the other stays out of view rather than
          needing a second independent editing flag. */}
      {category === 'campaign' && (
        <>
          {editing && entryId === '__character__' ? (
            <>
              <div className="flex justify-end mb-3">
                <CrudToolbar
                  editing
                  canDelete={false}
                  onEdit={() => {}}
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
            </>
          ) : editing && entryId === '__world__' ? (
            <>
              <div className="flex justify-end mb-3">
                <CrudToolbar editing canDelete={false} onEdit={() => {}} onSave={saveWorld} onCancel={cancelEdit} onDelete={() => {}} />
              </div>
              <DetailPanel>
                <TextField label="World Name" value={draft.name ?? ''} onChange={(v) => setDraft((d) => ({ ...d, name: v }))} />
                <TextField label="Genre & Tone" value={draft.genreTone ?? ''} onChange={(v) => setDraft((d) => ({ ...d, genreTone: v }))} textarea />
                <TextField label="Core Regional Conflict" value={draft.conflict ?? ''} onChange={(v) => setDraft((d) => ({ ...d, conflict: v }))} textarea />
                <TextField label="Power System" value={draft.powerSystem ?? ''} onChange={(v) => setDraft((d) => ({ ...d, powerSystem: v }))} textarea />
                <TextField label="Era / Tech Level" value={draft.eraTechLevel ?? ''} onChange={(v) => setDraft((d) => ({ ...d, eraTechLevel: v }))} />
                <TextField label="Key Factions" value={draft.keyFactions ?? ''} onChange={(v) => setDraft((d) => ({ ...d, keyFactions: v }))} />
                <TextField label="World Background" value={draft.background ?? ''} onChange={(v) => setDraft((d) => ({ ...d, background: v }))} textarea />
              </DetailPanel>
            </>
          ) : (
            <div className="flex flex-col gap-3">
              <SectionCard
                accent={NEUTRAL_ACCENT}
                icon={User}
                title="Character"
                badge={<GlassIconButton icon={Pencil} label="Edit Character" compact onClick={() => startEdit('__character__', { classId: player.classId })} />}
              >
                <FieldRow label="Class" value={player.className} />
                <FieldRow label="Level" value={String(player.level)} />
                <FieldRow
                  label="Attributes"
                  value={`STR ${tierToWord(player.attrs.STR, COMPETENCY_TIERS)} · INT ${tierToWord(player.attrs.INT, COMPETENCY_TIERS)} · AGI ${tierToWord(player.attrs.AGI, COMPETENCY_TIERS)}`}
                />
                <FieldRow label="Conditions" value={player.conditions?.length ? player.conditions.map((c) => c.label).join(', ') : 'None'} />
                {/* Set at creation only (WorldSetup/NewGame) — not editable here,
                    same as Background always was, so the reader can see their
                    own established identity at a glance without a second form. */}
                {player.background && <FieldRow label="Background" value={player.background} />}
                {player.personality && <FieldRow label="Personality" value={player.personality} />}
                {player.motivation && <FieldRow label="Motivation" value={player.motivation} />}
                {player.physicalTrait && <FieldRow label="Physical Trait" value={player.physicalTrait} />}
                {player.secret && <FieldRow label="Secret" value={player.secret} />}
              </SectionCard>
              <SectionCard
                accent={NEUTRAL_ACCENT}
                icon={Globe}
                title="Realm"
                badge={<GlassIconButton icon={Pencil} label="Edit Realm" compact onClick={() => startEdit('__world__', {
                  name: world.name,
                  genreTone: world.genreTone,
                  conflict: world.conflict,
                  background: world.background,
                  powerSystem: world.powerSystem,
                  eraTechLevel: world.eraTechLevel,
                  keyFactions: world.keyFactions,
                })} />}
              >
                <FieldRow label="World" value={world.name} />
                {world.genreTone && <FieldRow label="Genre & Tone" value={world.genreTone} />}
                {world.conflict && <FieldRow label="Core Regional Conflict" value={world.conflict} />}
                {world.powerSystem && <FieldRow label="Power System" value={world.powerSystem} />}
                {world.eraTechLevel && <FieldRow label="Era / Tech Level" value={world.eraTechLevel} />}
                {world.keyFactions && <FieldRow label="Key Factions" value={world.keyFactions} />}
                {world.background && <FieldRow label="World Background" value={world.background} />}
                <FieldRow label="Narration Style" value={world.narrationStyle} />
                {flags.length > 0 && (
                  <FieldRow
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
              </SectionCard>
            </div>
          )}
        </>
      )}

      {/* Workbenches & Recipes — §5.8 Crafting */}
      {category === 'crafting' && (
        <div className="flex flex-col gap-4">
          {crafting.length > 0 && (
            <div>
              <p className="text-[11px] font-display text-[#fbbf24] uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Clock size={12} />
                <span>In Progress</span>
              </p>
              <div className="flex flex-col gap-2">
                {crafting.map((job) => {
                  const recipe = RECIPES.find((r) => r.id === job.recipeId)
                  const remaining = hoursRemaining(player.time, job.completeTime)
                  return (
                    <div
                      key={job.jobId}
                      className="rounded-xl border border-amber-500/30 bg-gradient-to-r from-[#181308]/90 to-[#0e1017]/90 px-3.5 py-2.5 flex items-center justify-between gap-3 shadow-md"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-7 h-7 rounded-lg bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-300 shrink-0">
                          <Hammer size={14} />
                        </div>
                        <span className="font-display font-semibold text-sm text-[#fae5b5] truncate">
                          {recipe?.name ?? job.recipeId}
                        </span>
                      </div>
                      <span className="inline-flex items-center gap-1.5 font-mono text-xs px-2.5 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 shrink-0">
                        <Clock size={12} /> {remaining > 0 ? `${remaining}h left` : 'Ready'}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          <div>
            <p className="text-[11px] font-display text-ink-muted uppercase tracking-wider mb-2">
              Available Blueprints & Recipes
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {RECIPES.map((recipe) => {
                const affordable = canAffordRecipe(inventory, recipe)
                return (
                  <div
                    key={recipe.id}
                    className="rounded-xl p-3.5 flex flex-col justify-between gap-2.5 border border-[#2b3145] bg-gradient-to-br from-[#141724]/90 to-[#0e1017]/90 hover:border-amber-400/60 transition-all shadow-md group"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-display font-bold text-sm text-[#fae5b5] group-hover:text-amber-200 uppercase tracking-wide">
                          {recipe.name}
                        </h3>
                        <span className="inline-flex items-center gap-1 font-mono text-[10px] px-2 py-0.5 rounded-md bg-[#1a1f30] border border-[#2d354e] text-[#a5adc6] shrink-0">
                          <Clock size={10} className="text-amber-400" /> {recipe.craftHours}h
                        </span>
                      </div>
                      {recipe.stationRequired && (
                        <p className="font-mono text-[10px] text-amber-300/80 mt-0.5">
                          Station: {recipe.stationRequired}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {recipe.ingredients.map((i) => {
                          const held = inventory[i.id] ?? 0
                          const hasEnough = held >= i.qty
                          return (
                            <span
                              key={i.id}
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono border ${
                                hasEnough
                                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                                  : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                              }`}
                            >
                              <span>{i.qty}× {i.id.replace(/_/g, ' ')}</span>
                              <span className="opacity-70">({held})</span>
                            </span>
                          )
                        })}
                      </div>
                    </div>
                    <button
                      onClick={() => onStartCraft(recipe.id)}
                      disabled={!affordable}
                      className="mt-1 w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:bg-[#1a1f30] disabled:text-[#64748b] px-3 py-1.5 font-display text-xs font-bold uppercase tracking-wider text-black transition-colors disabled:border disabled:border-[#2d354e]"
                    >
                      <Hammer size={12} /> Craft Item
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Chapters — generated recap, read-only */}
      {category === 'chapters' && (
        <div className="flex flex-col gap-3">
          {chapters.length === 0 && (
            <p className="font-narrative italic text-sm text-ink-muted">No chapters recorded yet.</p>
          )}
          {chapters.map((c, i) => (
            <div
              key={i}
              className="rounded-xl p-4 border border-[#38bdf8]/30 bg-gradient-to-br from-[#0c1829]/90 via-[#0a1422]/90 to-[#070e17]/95 shadow-lg flex flex-col gap-2 relative overflow-hidden"
            >
              <div className="flex items-center justify-between gap-2 border-b border-sky-500/20 pb-2">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-sky-500/20 border border-sky-400/40 flex items-center justify-center text-sky-300 shrink-0">
                    <BookOpen size={14} />
                  </div>
                  <h3 className="font-display font-bold text-sm text-[#bae6fd] uppercase tracking-wide">
                    Chapter {c.chapterNumber}
                  </h3>
                </div>
                <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full bg-sky-500/15 border border-sky-500/30 text-sky-300">
                  Archived
                </span>
              </div>
              <p className="font-narrative text-xs sm:text-sm text-[#d4e7f8] leading-relaxed italic">
                "{c.chapterSummary}"
              </p>
            </div>
          ))}
        </div>
      )}

      {/* NPCs */}
      {category === 'npcs' && !entryId && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <AddButton label="Add NPC" onClick={() => startCreate({ name: '', stage: 'Stranger', trust: 1, affection: 1, memSummary: '', deeds: '' })} />
          {filteredNpcs.map(([id, n]) => {
            const hidden = isHidden(n)
            const metaChips: MetaChip[] = hidden
              ? []
              : [
                  n.stage ? { icon: User, label: n.stage } : null,
                  n.factionId && factions[n.factionId] ? { icon: ShieldCheck, label: factions[n.factionId].name } : null,
                  { icon: Heart, label: `Trust: ${trustWord(n.trust)}` },
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
              <TierField label="Trust" value={draft.trust ?? 1} scale={COMPETENCY_TIERS} onChange={(v) => setDraft((d) => ({ ...d, trust: v }))} />
              <TierField label="Affection" value={draft.affection ?? 1} scale={COMPETENCY_TIERS} onChange={(v) => setDraft((d) => ({ ...d, affection: v }))} />
              <TierField label="Resolve (Social Defense)" value={draft.resolve ?? 1} scale={COMPETENCY_TIERS} onChange={(v) => setDraft((d) => ({ ...d, resolve: v }))} />
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
              <TextField
                label="Secret Truth (hidden — the story knows this, the player doesn't)"
                value={draft.secretTruth ?? ''}
                onChange={(v) => setDraft((d) => ({ ...d, secretTruth: v }))}
                textarea
                placeholder="A motive, history, or loyalty the narration should let shape this NPC without ever stating it outright…"
              />
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
                  <StatBar label="Trust" value={npcs[entryId].trust} max={5} displayValue={trustWord(npcs[entryId].trust)} />
                  <StatBar label="Affection" value={npcs[entryId].affection} max={5} displayValue={npcs[entryId].stage} />
                  {npcs[entryId].resolve !== undefined && (
                    <StatBar label="Resolve" value={npcs[entryId].resolve!} max={5} displayValue={tierToWord(npcs[entryId].resolve!, COMPETENCY_TIERS)} />
                  )}
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
              {(npcs[entryId].personality || npcs[entryId].voiceNotes || npcs[entryId].secretTruth) && (
                <SectionCard accent={CATEGORY_ACCENTS.npcs} icon={ScrollText} title="Persona">
                  {npcs[entryId].personality && <FieldRow label="Traits" value={npcs[entryId].personality} />}
                  {npcs[entryId].voiceNotes && <FieldRow label="Voice" value={npcs[entryId].voiceNotes} />}
                  {npcs[entryId].secretTruth && (
                    <FieldRow label="Secret Truth (hidden from you in-story)" value={npcs[entryId].secretTruth} icon={Lock} />
                  )}
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
                <span className="text-[11px] font-display text-ink-muted uppercase tracking-wide">Region Map Pin (§7)</span>
                <select
                  value={draft.regionId ?? ''}
                  onChange={(e) => setDraft((d) => ({ ...d, regionId: e.target.value || undefined }))}
                  className={SELECT_CLASS}
                >
                  <option value="">Unassigned</option>
                  {Object.entries(regions).map(([id, r]) => (
                    <option key={id} value={id}>{r.name}</option>
                  ))}
                </select>
              </label>
              {draft.regionId && (
                <div className="grid grid-cols-3 gap-2">
                  <TextField label="Map X (0-100)" value={draft.mapX !== undefined ? String(draft.mapX) : ''} onChange={(v) => setDraft((d) => ({ ...d, mapX: v === '' ? undefined : Number(v) }))} />
                  <TextField label="Map Y (0-100)" value={draft.mapY !== undefined ? String(draft.mapY) : ''} onChange={(v) => setDraft((d) => ({ ...d, mapY: v === '' ? undefined : Number(v) }))} />
                  <TextField label="Radius" value={draft.mapRadius !== undefined ? String(draft.mapRadius) : ''} onChange={(v) => setDraft((d) => ({ ...d, mapRadius: v === '' ? undefined : Number(v) }))} />
                </div>
              )}
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
                {locations[entryId].regionId && (
                  <FieldRow
                    label="Map Pin"
                    value={`${regions[locations[entryId].regionId!]?.name ?? locations[entryId].regionId} (${locations[entryId].mapX ?? '?'}, ${locations[entryId].mapY ?? '?'})`}
                    icon={Compass}
                  />
                )}
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

      {/* Regions — §7 Region Map Pins, the write-once backing store for a
          future visual top-down region map (Tier 4). Deliberately thin: no
          Discovery gating (an organizational container, not a
          narratively-concealable fact), no tags. */}
      {category === 'regions' && !entryId && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <AddButton label="Add Region" onClick={() => startCreate({ name: '', description: '' })} />
          {filteredRegions.map(([id, r]) => {
            const locCount = Object.values(locations).filter((l) => l.regionId === id).length
            return (
              <DeckEntryCard
                key={id}
                accent={CATEGORY_ACCENTS.regions}
                title={r.name}
                subtitle={r.description || 'A named region on the map.'}
                badge={<AutoBadge shown={r.autoLogged} />}
                metaChips={[{ icon: MapPin, label: `${locCount} location${locCount === 1 ? '' : 's'}` }]}
                onClick={() => setEntryId(id)}
              />
            )
          })}
          {Object.keys(regions).length === 0 ? (
            <p className="font-narrative italic text-sm text-ink-muted col-span-full">No regions charted yet.</p>
          ) : filteredRegions.length === 0 ? (
            <p className="font-narrative italic text-sm text-ink-muted col-span-full">No regions match current filters.</p>
          ) : null}
        </div>
      )}
      {category === 'regions' && entryId && (editing || regions[entryId]) && (
        <>
          <div className="flex justify-end mb-3">
            <CrudToolbar editing={editing} canDelete={entryId !== NEW_ID} onEdit={() => startEdit(entryId, regions[entryId])} onSave={saveRegion} onCancel={cancelEdit} onDelete={() => deleteEntry('regions')} />
          </div>
          {editing ? (
            <DetailPanel>
              <TextField label="Name" value={draft.name ?? ''} onChange={(v) => setDraft((d) => ({ ...d, name: v }))} />
              <TextField label="Description" value={draft.description ?? ''} onChange={(v) => setDraft((d) => ({ ...d, description: v }))} textarea />
            </DetailPanel>
          ) : (
            <div className="flex flex-col gap-3">
              <EntryHeroHeader accent={CATEGORY_ACCENTS.regions} title={regions[entryId].name} badges={<AutoBadge shown={regions[entryId].autoLogged} />} />
              <SectionCard accent={CATEGORY_ACCENTS.regions} icon={Compass} title="Overview">
                {regions[entryId].description && <FieldRow label="Description" value={regions[entryId].description} />}
                <FieldRow
                  label="Locations"
                  value={
                    Object.entries(locations)
                      .filter(([, l]) => l.regionId === entryId)
                      .map(([, l]) => l.name)
                      .join(', ') || undefined
                  }
                  icon={MapPin}
                />
              </SectionCard>
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
          <AddButton label="Add Adversary" onClick={() => startCreate({ name: '', threatTier: 'notable' })} />
          {filteredBestiary.map(([id, b]) => {
            const hidden = isHidden(b)
            const metaChips: MetaChip[] = hidden
              ? []
              : [
                  b.threatTier ? { icon: Skull, label: displayThreatLabel(b.threatTier, world.tierSkin?.threatLabels) } : null,
                  b.conditions?.length ? { icon: Heart, label: b.conditions.map((c) => c.label).join(', ') } : null,
                  b.weaknesses ? { icon: Zap, label: `Weak: ${b.weaknesses}` } : null,
                  b.corpseCount ? { icon: Ghost, label: `${b.corpseCount} harvestable` } : null,
                ].filter(Boolean) as MetaChip[]
            return (
              <DeckEntryCard
                key={id}
                accent={CATEGORY_ACCENTS.bestiary}
                title={hidden ? '???' : b.name}
                kicker={hidden ? undefined : (b.threatTier ? displayThreatLabel(b.threatTier, world.tierSkin?.threatLabels) : b.habitat)}
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
              onEdit={() => startEdit(entryId, { ...bestiary[entryId] })}
              onSave={saveBestiary}
              onCancel={cancelEdit}
              onDelete={() => deleteEntry('bestiary')}
            />
          </div>
          {editing ? (
            <DetailPanel>
              <TextField label="Name" value={draft.name ?? ''} onChange={(v) => setDraft((d) => ({ ...d, name: v }))} />
              <label className="block">
                <span className="text-[11px] font-display text-ink-muted uppercase tracking-wide">Threat Tier</span>
                <select
                  value={draft.threatTier ?? 'notable'}
                  onChange={(e) => setDraft((d) => ({ ...d, threatTier: e.target.value }))}
                  className={`mt-1 ${SELECT_CLASS}`}
                >
                  {THREAT_TIERS.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </label>
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
                subtitle={displayThreatLabel(bestiary[entryId].threatTier, world.tierSkin?.threatLabels)}
                badges={<AutoBadge shown={bestiary[entryId].autoLogged} />}
              />
              <SectionCard accent={CATEGORY_ACCENTS.bestiary} icon={Skull} title="Combat Profile">
                <FieldRow label="Threat" value={displayThreatLabel(bestiary[entryId].threatTier, world.tierSkin?.threatLabels)} icon={Skull} />
                {bestiary[entryId].conditions?.length ? (
                  <FieldRow label="Conditions" value={bestiary[entryId].conditions!.map((c) => c.label).join(', ')} icon={Heart} />
                ) : null}
                {bestiary[entryId].weaknesses && <FieldRow label="Weaknesses" value={bestiary[entryId].weaknesses} icon={Zap} />}
              </SectionCard>
              {/* §5.3/§7 "recently slain" — folded in from the old standalone
                  Corpses category; corpseCount/lastSlainTime now live directly
                  on this species' own Bestiary record, harvestable via !arise. */}
              {(bestiary[entryId].corpseCount ?? 0) > 0 && (
                <SectionCard accent={CATEGORY_ACCENTS.bestiary} icon={Ghost} title="Recently Slain">
                  <FieldRow label="Harvestable Essence" value={`×${bestiary[entryId].corpseCount}`} icon={Ghost} />
                  {bestiary[entryId].lastSlainTime && (
                    <FieldRow label="Last Slain" value={`Day ${bestiary[entryId].lastSlainTime!.d} ${bestiary[entryId].lastSlainTime!.h}`} icon={Clock} />
                  )}
                </SectionCard>
              )}
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

      {/* §7 Projects — a broader multi-stage endeavor tracker (construction,
          repair, any long-running undertaking), generalizing Crafting per the
          user's own request. CRUD pattern mirrors Quests most closely (name,
          status enum, note, description-like fields), adapted for
          stages/prerequisites/eta. */}
      {category === 'projects' && !entryId && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <AddButton label="Add Project" onClick={() => startCreate({ name: '', status: 'active', stagesText: '', prerequisites: '', note: '' })} />
          {filteredProjects.map(([id, p]) => {
            const hidden = isHidden(p)
            const doneStages = p.stages.filter((s) => s.done).length
            const metaChips: MetaChip[] = hidden
              ? []
              : [
                  p.stages.length > 0 ? { icon: ListChecks, label: `${doneStages}/${p.stages.length} stages` } : null,
                  p.eta ? { icon: Clock, label: `Ready: Day ${p.eta.d} ${p.eta.h}` } : null,
                ].filter(Boolean) as MetaChip[]
            return (
              <DeckEntryCard
                key={id}
                accent={CATEGORY_ACCENTS.projects}
                title={hidden ? '???' : p.name}
                statusBadge={hidden ? undefined : <ProjectStatusBadge status={p.status} />}
                subtitle={hidden ? (p.discovery?.teaser || 'Not yet discovered.') : (p.note || p.prerequisites?.join(', ') || 'No recorded status.')}
                badge={hidden ? <LockBadge /> : <AutoBadge shown={p.autoLogged} />}
                metaChips={metaChips}
                onClick={() => setEntryId(id)}
              />
            )
          })}
          {Object.keys(projects).length === 0 ? (
            <p className="font-narrative italic text-sm text-ink-muted col-span-full">No projects underway yet.</p>
          ) : filteredProjects.length === 0 ? (
            <p className="font-narrative italic text-sm text-ink-muted col-span-full">No projects match current filters.</p>
          ) : null}
        </div>
      )}
      {category === 'projects' && entryId && (editing || projects[entryId]) && (
        <>
          <div className="flex justify-end mb-3">
            <CrudToolbar
              editing={editing}
              canDelete={entryId !== NEW_ID}
              onEdit={() =>
                startEdit(entryId, {
                  ...projects[entryId],
                  status: projects[entryId].status ?? '',
                  stagesText: (projects[entryId].stages ?? []).map((s) => s.label).join(', '),
                  prerequisites: (projects[entryId].prerequisites ?? []).join(', '),
                  etaDay: projects[entryId].eta?.d !== undefined ? String(projects[entryId].eta.d) : '',
                  etaTime: projects[entryId].eta?.h ?? '',
                })
              }
              onSave={saveProject}
              onCancel={cancelEdit}
              onDelete={() => deleteEntry('projects')}
            />
          </div>
          {editing ? (
            <DetailPanel>
              <TextField label="Name" value={draft.name ?? ''} onChange={(v) => setDraft((d) => ({ ...d, name: v }))} />
              <label className="block">
                <span className="text-[11px] font-display text-ink-muted uppercase tracking-wide">Status</span>
                <select
                  value={draft.status ?? 'active'}
                  onChange={(e) => setDraft((d) => ({ ...d, status: e.target.value }))}
                  className={`mt-1 ${SELECT_CLASS}`}
                >
                  <option value="active">Active</option>
                  <option value="completed">Completed</option>
                  <option value="stalled">Stalled</option>
                </select>
              </label>
              <TextField
                label="Stages (comma-separated)"
                value={draft.stagesText ?? ''}
                onChange={(v) => setDraft((d) => ({ ...d, stagesText: v }))}
                placeholder="Foundation laid, Walls raised, Roof sealed…"
              />
              <TextField
                label="Prerequisites (comma-separated)"
                value={draft.prerequisites ?? ''}
                onChange={(v) => setDraft((d) => ({ ...d, prerequisites: v }))}
                placeholder="200 Timber, a master mason…"
              />
              <div className="grid grid-cols-2 gap-2">
                <NumberField label="ETA — Day" value={draft.etaDay ? Number(draft.etaDay) : 0} onChange={(v) => setDraft((d) => ({ ...d, etaDay: String(v) }))} />
                <TextField label="ETA — Time" value={draft.etaTime ?? ''} onChange={(v) => setDraft((d) => ({ ...d, etaTime: v }))} placeholder="08:00 AM" />
              </div>
              <TextField label="Note" value={draft.note ?? ''} onChange={(v) => setDraft((d) => ({ ...d, note: v }))} textarea placeholder="A short current-state blurb…" />
              <DiscoveryEditor discovery={draft.discovery} onChange={(disc) => setDraft((d) => ({ ...d, discovery: disc }))} />
            </DetailPanel>
          ) : isHidden(projects[entryId]) ? (
            <MaskedDetail teaser={projects[entryId].discovery?.teaser} />
          ) : (
            <div className="flex flex-col gap-3">
              <EntryHeroHeader
                accent={CATEGORY_ACCENTS.projects}
                title={projects[entryId].name}
                badges={
                  <>
                    <ProjectStatusBadge status={projects[entryId].status} />
                    <AutoBadge shown={projects[entryId].autoLogged} />
                  </>
                }
              />
              {(projects[entryId].note || projects[entryId].prerequisites?.length || projects[entryId].eta) && (
                <SectionCard accent={CATEGORY_ACCENTS.projects} icon={Milestone} title="Status">
                  {projects[entryId].note && <FieldRow label="Current State" value={projects[entryId].note!} />}
                  {projects[entryId].prerequisites?.length ? (
                    <FieldRow label="Prerequisites" value={projects[entryId].prerequisites!.join(', ')} />
                  ) : null}
                  {projects[entryId].eta && (
                    <FieldRow label="ETA" value={`Ready: Day ${projects[entryId].eta!.d} ${projects[entryId].eta!.h}`} icon={Clock} />
                  )}
                </SectionCard>
              )}
              {projects[entryId].stages.length > 0 && (
                <SectionCard accent={CATEGORY_ACCENTS.projects} icon={ListChecks} title="Stages">
                  <div className="flex flex-col gap-1.5">
                    {projects[entryId].stages.map((stage, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => toggleProjectStage(entryId, i)}
                        className="flex items-center gap-2 text-left rounded-lg px-2 py-1.5 hover:bg-white/5 transition-colors cursor-pointer"
                      >
                        {stage.done ? (
                          <CheckCircle2 size={15} className="text-[#2dd4bf] shrink-0" />
                        ) : (
                          <span className="w-[15px] h-[15px] rounded-full border border-[#4a5170] shrink-0" />
                        )}
                        <span className={`font-narrative text-xs ${stage.done ? 'text-ink-muted line-through' : 'text-ink'}`}>{stage.label}</span>
                      </button>
                    ))}
                  </div>
                </SectionCard>
              )}
            </div>
          )}
        </>
      )}

      {/* Skills */}
      {category === 'skills' && !entryId && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <AddButton label="Add Skill" onClick={() => startCreate({ name: '', description: '', classId: '' })} />
          {filteredSkills.map(([id, s]) => {
            const hidden = isHidden(s)
            const metaChips: MetaChip[] = hidden
              ? []
              : [
                  classNameFor(s.classId) ? { icon: Star, label: classNameFor(s.classId)! } : null,
                  s.tier !== undefined ? { icon: Sparkles, label: tierToWord(s.tier, COMPETENCY_TIERS) } : null,
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
                  tier: skills[entryId].tier !== undefined ? tierToWord(skills[entryId].tier!, COMPETENCY_TIERS) : '',
                  effort: skills[entryId].effort ?? '',
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
              <label className="block">
                <span className="text-[11px] font-display text-ink-muted uppercase tracking-wide">Tier</span>
                <select
                  value={draft.tier || ''}
                  onChange={(e) => setDraft((d) => ({ ...d, tier: e.target.value }))}
                  className={`mt-1 ${SELECT_CLASS}`}
                >
                  <option value="">— unset —</option>
                  {COMPETENCY_TIERS.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </label>
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
              <label className="block">
                <span className="text-[11px] font-display text-ink-muted uppercase tracking-wide">Effort</span>
                <select
                  value={draft.effort ?? ''}
                  onChange={(e) => setDraft((d) => ({ ...d, effort: e.target.value }))}
                  className={`mt-1 ${SELECT_CLASS}`}
                >
                  <option value="">— none —</option>
                  <option value="minor">Minor</option>
                  <option value="focused">Focused</option>
                  <option value="taxing">Taxing</option>
                </select>
              </label>
              <DiscoveryEditor discovery={draft.discovery} onChange={(disc) => setDraft((d) => ({ ...d, discovery: disc }))} />
            </DetailPanel>
          ) : isHidden(skills[entryId]) ? (
            <MaskedDetail teaser={skills[entryId].discovery?.teaser} />
          ) : (
            <div className="flex flex-col gap-3">
              <EntryHeroHeader
                accent={CATEGORY_ACCENTS.skills}
                title={skills[entryId].name}
                subtitle={
                  skills[entryId].flavorText ||
                  [skills[entryId].skillType, skills[entryId].tier !== undefined ? tierToWord(skills[entryId].tier!, COMPETENCY_TIERS) : null]
                    .filter(Boolean)
                    .join(' · ')
                }
                badges={<SkillCostBadge skill={skills[entryId]} />}
              />
              <SectionCard accent={CATEGORY_ACCENTS.skills} icon={Sparkles} title="Ability Profile">
                {classNameFor(skills[entryId].classId) && <FieldRow label="Class" value={classNameFor(skills[entryId].classId)!} icon={Star} />}
                {skills[entryId].skillType && <FieldRow label="Type" value={skills[entryId].skillType!} />}
                {skills[entryId].tier !== undefined && <FieldRow label="Tier" value={tierToWord(skills[entryId].tier!, COMPETENCY_TIERS)} />}
                {skills[entryId].effort && (
                  <div className="flex gap-2">
                    <StatTile label="Effort" value={skills[entryId].effort!} accent={CATEGORY_ACCENTS.skills} />
                  </div>
                )}
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
          <AddButton label="Add Item" onClick={() => startCreate({ name: '', type: 'material', qty: '1', description: '', traits: '' })} />
          {filteredItems.map(([id]) => {
            const qty = inventory[id]
            const item = items[id]
            const slot = equippedSlotFor(id)
            const accent = itemAccentFor(item?.rarity)
            const traits = traitsText(item?.traits)
            const metaChips: MetaChip[] = [
              { icon: Coins, label: `×${qty}` },
              traits ? { icon: Zap, label: traits } : null,
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
                  traits: items[entryId]?.traits?.join(', ') ?? '',
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
                <TextField
                  label="Traits (comma-separated)"
                  value={draft.traits ?? ''}
                  onChange={(v) => setDraft((d) => ({ ...d, traits: v }))}
                  placeholder="reach, heavy — pure narrative flavor, no mechanical effect"
                />
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
                {traitsText(items[entryId]?.traits) && <FieldRow label="Traits" value={traitsText(items[entryId]?.traits)!} icon={Zap} />}
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
