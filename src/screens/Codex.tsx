import { createContext, useState, useMemo, useEffect, useContext } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  ChevronRight, Globe, BookOpen, Users, ShieldCheck, Map, ScrollText, Target, Skull, Backpack,
  Pencil, Save, X, Trash2, Plus, Lock, User, Hammer, Clock, Sparkles,
} from 'lucide-react'
import { DASHED_ROW_CLASS, GlassHeader, GlassIconButton, GlassScreen, SELECT_CLASS } from '../lib/glassChrome.tsx'
import { slugify } from '../lib/slug.ts'
import { isHidden } from '../lib/discovery.ts'
import { checkAffordability } from '../lib/skills.ts'
import { PRESET_CLASSES } from '../data/classes.ts'
import { RECIPES } from '../data/recipes.ts'
import { canAffordRecipe } from '../lib/crafting.ts'
import { hoursRemaining } from '../lib/gameTime.ts'
import { deriveStanding, effectiveStanding, repTierLabel } from '../lib/factions.ts'
import { useConfirm } from '../lib/useConfirm.tsx'
import { useLongTextEditor } from '../lib/useLongTextEditor.tsx'
import { EQUIPPABLE_TYPES } from '../types.ts'
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
  | 'realm' | 'character' | 'crafting' | 'chapters' | 'npcs' | 'factions' | 'locations' | 'lore' | 'quests' | 'bestiary' | 'items' | 'skills'

interface CodexProps {
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
}

// §9 Codex CRUD — a new, not-yet-saved entry lives under this sentinel id
// until Save assigns it a real slug.
const NEW_ID = '__new__'

// §5.12 — "A condition that can't be validated fails open to state: 'known'
// rather than shipping an entry the player can never unlock." Only checks
// triggers with a real dict to check against; `flag` conditions are freeform
// strings the model may not have produced yet, so those are trusted as-is.
function validateDiscovery(
  discovery: Discovery | undefined,
  dicts: { locations: Record<string, unknown>; npcs: Record<string, unknown>; quests: Record<string, unknown> },
): Discovery | undefined {
  if (!discovery || discovery.state !== 'hidden' || !discovery.revealCondition) return discovery
  const dict =
    discovery.revealTrigger === 'location_visit' ? dicts.locations :
    discovery.revealTrigger === 'npc_met' ? dicts.npcs :
    discovery.revealTrigger === 'quest_complete' ? dicts.quests :
    null
  if (!dict || dict[discovery.revealCondition]) return discovery
  return { ...discovery, state: 'known' }
}

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

function EntryCard({ title, subtitle, badge, onClick }: { title: string; subtitle?: string; badge?: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="rounded-2xl p-4 text-left flex flex-col gap-1 w-full border border-[#e8ca8a]/25 bg-transparent backdrop-blur-sm"
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-display font-bold text-sm text-[#e8ca8a]">{title}</h3>
        {badge}
      </div>
      {subtitle && <p className="font-narrative text-xs text-ink-muted line-clamp-2">{subtitle}</p>}
    </button>
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
  const cls = 'mt-1 w-full rounded-lg border border-[#e8ca8a]/25 bg-[#e8ca8a]/[0.04] backdrop-blur-sm px-3 py-2 font-narrative text-sm text-ink placeholder:text-[#e8ca8a]/35'
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
}: CodexProps) {
  const [category, setCategory] = useState<CategoryId | null>(initialCategory ?? null)
  const [entryId, setEntryId] = useState<string | null>(initialEntryId ?? null)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<Record<string, any>>({})
  const { confirm, dialog: confirmDialog } = useConfirm()
  const { edit: editLongText, dialog: longTextDialog } = useLongTextEditor()

  const classNameFor = (id?: string) => (id ? PRESET_CLASSES.find((c) => c.id === id)?.name : undefined)

  function equippedSlotFor(itemId: string): EquipSlot | undefined {
    return (Object.entries(player.equipped ?? {}) as [EquipSlot, string][]).find(([, id]) => id === itemId)?.[0]
  }

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('')
  const [activeFilter1, setActiveFilter1] = useState('')
  const [activeFilter2, setActiveFilter2] = useState('')

  // Reset filters on category change
  useEffect(() => {
    setSearchQuery('')
    setActiveFilter1('')
    setActiveFilter2('')
  }, [category])

  // Unique collections for filter selectors
  const npcStages = useMemo(() => {
    const stages = new Set<string>()
    Object.values(npcs).forEach((n) => {
      if (n.stage) stages.add(n.stage)
    })
    return Array.from(stages)
  }, [npcs])

  const factionStandings = useMemo(() => {
    const standings = new Set<string>()
    Object.values(factions).forEach((f) => {
      standings.add(repTierLabel(f.repTier))
    })
    return Array.from(standings)
  }, [factions])

  const dangerLevels = useMemo(() => {
    const levels = new Set<string>()
    Object.values(locations).forEach((l) => {
      if (l.dangerLevel) levels.add(l.dangerLevel)
    })
    return Array.from(levels)
  }, [locations])

  const locationOwners = useMemo(() => {
    const owners = new Set<string>()
    Object.values(locations).forEach((l) => {
      if (l.factionOwner) owners.add(l.factionOwner)
    })
    return Array.from(owners)
  }, [locations])

  const loreCategories = useMemo(() => {
    const cats = new Set<string>()
    Object.values(lore).forEach((l) => {
      if (l.category) cats.add(l.category)
    })
    return Array.from(cats)
  }, [lore])

  const questStatuses = useMemo(() => {
    const statuses = new Set<string>()
    Object.values(quests).forEach((q) => {
      if (q.status) statuses.add(q.status)
    })
    return Array.from(statuses)
  }, [quests])

  const threatTiers = useMemo(() => {
    const tiers = new Set<string>()
    Object.values(bestiary).forEach((b) => {
      if (b.threatTier) tiers.add(b.threatTier)
    })
    return Array.from(tiers)
  }, [bestiary])

  const skillClasses = useMemo(() => {
    const classes = new Set<string>()
    Object.values(skills).forEach((s) => {
      if (s.classId) classes.add(s.classId)
    })
    return Array.from(classes)
  }, [skills])

  // Filtered lists
  const filteredNpcs = useMemo(() => {
    return Object.entries(npcs).filter(([, n]) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        const matchesName = n.name.toLowerCase().includes(q)
        const matchesMem = n.memSummary?.toLowerCase().includes(q)
        const matchesTeaser = n.discovery?.teaser?.toLowerCase().includes(q)
        if (!matchesName && !matchesMem && !matchesTeaser) return false
      }
      if (activeFilter1 && n.stage !== activeFilter1) return false
      return true
    })
  }, [npcs, searchQuery, activeFilter1])

  const filteredFactions = useMemo(() => {
    return Object.entries(factions).filter(([, f]) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        const matchesName = f.name.toLowerCase().includes(q)
        const matchesRival = f.rivalId?.toLowerCase().includes(q)
        if (!matchesName && !matchesRival) return false
      }
      if (activeFilter1 && repTierLabel(f.repTier) !== activeFilter1) return false
      return true
    })
  }, [factions, searchQuery, activeFilter1])

  const filteredLocations = useMemo(() => {
    return Object.entries(locations).filter(([, l]) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        const matchesName = l.name.toLowerCase().includes(q)
        const matchesRegion = l.region?.toLowerCase().includes(q)
        const matchesDesc = l.description?.toLowerCase().includes(q)
        if (!matchesName && !matchesRegion && !matchesDesc) return false
      }
      if (activeFilter1 && l.dangerLevel !== activeFilter1) return false
      if (activeFilter2 && l.factionOwner !== activeFilter2) return false
      return true
    })
  }, [locations, searchQuery, activeFilter1, activeFilter2])

  const filteredLore = useMemo(() => {
    return Object.entries(lore).filter(([, l]) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        const matchesName = l.name.toLowerCase().includes(q)
        const matchesCat = l.category?.toLowerCase().includes(q)
        if (!matchesName && !matchesCat) return false
      }
      if (activeFilter1 && l.category !== activeFilter1) return false
      return true
    })
  }, [lore, searchQuery, activeFilter1])

  const filteredQuests = useMemo(() => {
    return Object.entries(quests).filter(([, q_entry]) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        const matchesName = q_entry.name.toLowerCase().includes(q)
        const matchesNote = q_entry.note?.toLowerCase().includes(q)
        const matchesStatus = q_entry.status?.toLowerCase().includes(q)
        if (!matchesName && !matchesNote && !matchesStatus) return false
      }
      if (activeFilter1 && (q_entry.status ?? 'active') !== activeFilter1) return false
      return true
    })
  }, [quests, searchQuery, activeFilter1])

  const filteredBestiary = useMemo(() => {
    return Object.entries(bestiary).filter(([, b]) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        const matchesName = b.name.toLowerCase().includes(q)
        const matchesTier = b.threatTier?.toLowerCase().includes(q)
        if (!matchesName && !matchesTier) return false
      }
      if (activeFilter1 && b.threatTier !== activeFilter1) return false
      return true
    })
  }, [bestiary, searchQuery, activeFilter1])

  const filteredSkills = useMemo(() => {
    return Object.entries(skills).filter(([, s]) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        const matchesName = s.name.toLowerCase().includes(q)
        const matchesDesc = s.description?.toLowerCase().includes(q)
        if (!matchesName && !matchesDesc) return false
      }
      if (activeFilter1 && s.classId !== activeFilter1) return false
      return true
    })
  }, [skills, searchQuery, activeFilter1])

  const filteredItems = useMemo(() => {
    return Object.entries(inventory).filter(([id]) => {
      const item = items[id]
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        const matchesName = (item?.name ?? id.replace(/_/g, ' ')).toLowerCase().includes(q)
        const matchesDesc = item?.description?.toLowerCase().includes(q)
        if (!matchesName && !matchesDesc) return false
      }
      if (activeFilter1 && (item?.type ?? 'material') !== activeFilter1) return false
      return true
    })
  }, [inventory, items, searchQuery, activeFilter1])

  const searchFilterBar = useMemo(() => {
    if (!category || entryId || editing) return null

    let filter1Select = null
    let filter2Select = null

    if (category === 'npcs') {
      filter1Select = (
        <select
          value={activeFilter1}
          onChange={(e) => setActiveFilter1(e.target.value)}
          className={`text-xs px-2.5 py-1.5 h-9 rounded-xl border border-[#e8ca8a]/20 bg-[#14101c]/80 text-[#ecdcb8] focus:border-[#f0ca65]/60 outline-none w-full sm:w-40 cursor-pointer`}
        >
          <option value="">All Stages</option>
          {npcStages.map((stage) => (
            <option key={stage} value={stage}>{stage}</option>
          ))}
        </select>
      )
    } else if (category === 'factions') {
      filter1Select = (
        <select
          value={activeFilter1}
          onChange={(e) => setActiveFilter1(e.target.value)}
          className={`text-xs px-2.5 py-1.5 h-9 rounded-xl border border-[#e8ca8a]/20 bg-[#14101c]/80 text-[#ecdcb8] focus:border-[#f0ca65]/60 outline-none w-full sm:w-40 cursor-pointer`}
        >
          <option value="">All Standings</option>
          {factionStandings.map((standing) => (
            <option key={standing} value={standing}>{standing}</option>
          ))}
        </select>
      )
    } else if (category === 'locations') {
      filter1Select = (
        <select
          value={activeFilter1}
          onChange={(e) => setActiveFilter1(e.target.value)}
          className={`text-xs px-2.5 py-1.5 h-9 rounded-xl border border-[#e8ca8a]/20 bg-[#14101c]/80 text-[#ecdcb8] focus:border-[#f0ca65]/60 outline-none w-full sm:w-40 cursor-pointer`}
        >
          <option value="">All Danger Levels</option>
          {dangerLevels.map((lvl) => (
            <option key={lvl} value={lvl}>{lvl}</option>
          ))}
        </select>
      )
      filter2Select = (
        <select
          value={activeFilter2}
          onChange={(e) => setActiveFilter2(e.target.value)}
          className={`text-xs px-2.5 py-1.5 h-9 rounded-xl border border-[#e8ca8a]/20 bg-[#14101c]/80 text-[#ecdcb8] focus:border-[#f0ca65]/60 outline-none w-full sm:w-40 cursor-pointer`}
        >
          <option value="">All Faction Owners</option>
          {locationOwners.map((owner) => {
            const factionName = factions[owner]?.name ?? owner
            return (
              <option key={owner} value={owner}>{factionName}</option>
            )
          })}
        </select>
      )
    } else if (category === 'lore') {
      filter1Select = (
        <select
          value={activeFilter1}
          onChange={(e) => setActiveFilter1(e.target.value)}
          className={`text-xs px-2.5 py-1.5 h-9 rounded-xl border border-[#e8ca8a]/20 bg-[#14101c]/80 text-[#ecdcb8] focus:border-[#f0ca65]/60 outline-none w-full sm:w-40 cursor-pointer`}
        >
          <option value="">All Categories</option>
          {loreCategories.map((cat) => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
      )
    } else if (category === 'quests') {
      filter1Select = (
        <select
          value={activeFilter1}
          onChange={(e) => setActiveFilter1(e.target.value)}
          className={`text-xs px-2.5 py-1.5 h-9 rounded-xl border border-[#e8ca8a]/20 bg-[#14101c]/80 text-[#ecdcb8] focus:border-[#f0ca65]/60 outline-none w-full sm:w-40 cursor-pointer`}
        >
          <option value="">All Statuses</option>
          <option value="active">Active/Advanced</option>
          {questStatuses.map((status) => {
            if (status === 'active' || status === 'advanced') return null
            return (
              <option key={status} value={status}>{status}</option>
            )
          })}
        </select>
      )
    } else if (category === 'bestiary') {
      filter1Select = (
        <select
          value={activeFilter1}
          onChange={(e) => setActiveFilter1(e.target.value)}
          className={`text-xs px-2.5 py-1.5 h-9 rounded-xl border border-[#e8ca8a]/20 bg-[#14101c]/80 text-[#ecdcb8] focus:border-[#f0ca65]/60 outline-none w-full sm:w-40 cursor-pointer`}
        >
          <option value="">All Threat Tiers</option>
          {threatTiers.map((tier) => (
            <option key={tier} value={tier}>{tier}</option>
          ))}
        </select>
      )
    } else if (category === 'skills') {
      filter1Select = (
        <select
          value={activeFilter1}
          onChange={(e) => setActiveFilter1(e.target.value)}
          className={`text-xs px-2.5 py-1.5 h-9 rounded-xl border border-[#e8ca8a]/20 bg-[#14101c]/80 text-[#ecdcb8] focus:border-[#f0ca65]/60 outline-none w-full sm:w-40 cursor-pointer`}
        >
          <option value="">All Classes</option>
          {skillClasses.map((clsId) => (
            <option key={clsId} value={clsId}>{classNameFor(clsId) || clsId}</option>
          ))}
        </select>
      )
    } else if (category === 'items') {
      filter1Select = (
        <select
          value={activeFilter1}
          onChange={(e) => setActiveFilter1(e.target.value)}
          className={`text-xs px-2.5 py-1.5 h-9 rounded-xl border border-[#e8ca8a]/20 bg-[#14101c]/80 text-[#ecdcb8] focus:border-[#f0ca65]/60 outline-none w-full sm:w-40 cursor-pointer`}
        >
          <option value="">All Types</option>
          {ITEM_TYPES.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      )
    }

    if (category === 'character' || category === 'realm' || category === 'crafting' || category === 'chapters') {
      return null
    }

    return (
      <div className="mb-4 flex flex-col gap-2 p-3 rounded-2xl border border-[#e8ca8a]/15 bg-[#e8ca8a]/[0.02]">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, tags, description..."
              className="w-full text-xs h-9 rounded-xl border border-[#e8ca8a]/20 bg-[#e8ca8a]/[0.04] px-3.5 py-1.5 text-ink placeholder:text-[#e8ca8a]/45 focus:border-[#f0ca65]/60 outline-none"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#e8ca8a]/50 hover:text-[#e8ca8a] text-xs cursor-pointer"
              >
                Clear
              </button>
            )}
          </div>

          {(filter1Select || filter2Select) && (
            <div className="flex flex-row gap-2 shrink-0">
              {filter1Select}
              {filter2Select}
            </div>
          )}
        </div>
      </div>
    )
  }, [category, entryId, editing, searchQuery, activeFilter1, activeFilter2, npcStages, factionStandings, dangerLevels, locationOwners, loreCategories, questStatuses, threatTiers, skillClasses, factions])

  const chapters = log.filter((e) => e.chapterSummary)

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
    { id: 'factions', label: 'Faction', description: 'Political groups, guilds & reputation', icon: ShieldCheck, count: Object.keys(factions).length },
    { id: 'lore', label: 'Lore', description: 'Legends, myths & discovered secrets', icon: ScrollText, count: Object.keys(lore).length },
    { id: 'chapters', label: 'Chapters', description: 'Chronological recap of the tale so far', icon: BookOpen, count: chapters.length },
    { id: 'character', label: 'Character', description: 'Attributes, class & derived pools', icon: User, count: 1 },
    { id: 'crafting', label: 'Workbenches & Recipes', description: 'Craft items from held materials', icon: Hammer, count: crafting.length },
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
      discovery: validateDiscovery(draft.discovery, { locations, npcs, quests }),
    })
    setEntryId(id)
    setEditing(false)
  }

  function saveFaction() {
    const id = entryId === NEW_ID ? genId(draft.name, factions) : entryId!
    onUpdateFaction(id, { name: draft.name, repTier: draft.repTier, rivalId: draft.rivalId || null, discovery: validateDiscovery(draft.discovery, { locations, npcs, quests }) })
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
      discovery: validateDiscovery(draft.discovery, { locations, npcs, quests }),
    })
    setEntryId(id)
    setEditing(false)
  }

  function saveLore() {
    const id = entryId === NEW_ID ? genId(draft.name, lore) : entryId!
    onUpdateLore(id, { name: draft.name, category: draft.category, discovery: validateDiscovery(draft.discovery, { locations, npcs, quests }) })
    setEntryId(id)
    setEditing(false)
  }

  function saveQuest() {
    const id = entryId === NEW_ID ? genId(draft.name, quests) : entryId!
    onUpdateQuest(id, { name: draft.name, status: draft.status || undefined, note: draft.note, discovery: validateDiscovery(draft.discovery, { locations, npcs, quests }) })
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
    onUpdateItem(id, qty, { name, type, description: draft.description?.trim() || undefined, statBonus })
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
      <GlassHeader title={title} onBack={back} className="!px-0 mb-5" />

      {searchFilterBar}

      {/* Level 1 — Category List */}
      {!category && (
        <div className="flex flex-col gap-3">
          {categories.map(({ id, label, description, icon: Icon, count }) => (
            <button
              key={id}
              onClick={() => setCategory(id)}
              className="rounded-xl px-4 py-3 flex items-center gap-3 text-left border border-[#e8ca8a]/25 bg-transparent backdrop-blur-sm hover:border-[#e8ca8a]/50 transition-colors"
            >
              <span className="w-10 h-10 shrink-0 rounded-full bg-[#e8ca8a]/10 inline-flex items-center justify-center text-[#e8ca8a]">
                <Icon size={18} />
              </span>
              <span className="flex-1 min-w-0">
                <span className="block font-display font-bold text-sm text-ink">{label}</span>
                <span className="block font-narrative text-xs text-ink-muted truncate">{description}</span>
              </span>
              <span
                className={`font-mono text-xs font-semibold px-2 py-0.5 rounded-md shrink-0 ${
                  count > 0 ? 'bg-[#e8ca8a]/20 text-[#e8ca8a]' : 'bg-[#e8ca8a]/10 text-ink-muted/60'
                }`}
              >
                {count}
              </span>
              <ChevronRight size={16} className="text-[#e8ca8a]/60 shrink-0" />
            </button>
          ))}
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
                  <div key={recipe.id} className="rounded-2xl p-4 flex flex-col gap-2 border border-[#e8ca8a]/25 bg-transparent backdrop-blur-sm">
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
          {filteredNpcs.map(([id, n]) => (
            <EntryCard
              key={id}
              title={isHidden(n) ? '???' : n.name}
              subtitle={isHidden(n) ? (n.discovery?.teaser || 'Not yet discovered.') : `${n.stage} · Trust ${n.trust}`}
              badge={isHidden(n) ? <LockBadge /> : <AutoBadge shown={n.autoLogged} />}
              onClick={() => setEntryId(id)}
            />
          ))}
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
            <CrudToolbar editing={editing} canDelete={entryId !== NEW_ID} onEdit={() => startEdit(entryId, npcs[entryId])} onSave={saveNpc} onCancel={cancelEdit} onDelete={() => deleteEntry('npcs')} />
          </div>
          {editing ? (
            <DetailPanel>
              <TextField label="Name" value={draft.name ?? ''} onChange={(v) => setDraft((d) => ({ ...d, name: v }))} />
              <TextField label="Gender" value={draft.gender ?? ''} onChange={(v) => setDraft((d) => ({ ...d, gender: v }))} placeholder="she/her (optional)" />
              <TextField label="Age" value={draft.age !== undefined ? String(draft.age) : ''} onChange={(v) => setDraft((d) => ({ ...d, age: v }))} placeholder="Optional" />
              <TextField label="Stage" value={draft.stage ?? ''} onChange={(v) => setDraft((d) => ({ ...d, stage: v }))} placeholder="Stranger, Acquaintance, Friend…" />
              <NumberField label="Trust" value={draft.trust ?? 0} onChange={(v) => setDraft((d) => ({ ...d, trust: v }))} />
              <NumberField label="Affection" value={draft.affection ?? 0} onChange={(v) => setDraft((d) => ({ ...d, affection: v }))} />
              <TextField label="Memory" value={draft.memSummary ?? ''} onChange={(v) => setDraft((d) => ({ ...d, memSummary: v }))} textarea />
              <TextField
                label="Deeds (comma-separated)"
                value={Array.isArray(draft.deeds) ? draft.deeds.join(', ') : (draft.deeds ?? '')}
                onChange={(v) => setDraft((d) => ({ ...d, deeds: v }))}
              />
              <DiscoveryEditor discovery={draft.discovery} onChange={(disc) => setDraft((d) => ({ ...d, discovery: disc }))} />
            </DetailPanel>
          ) : isHidden(npcs[entryId]) ? (
            <MaskedDetail teaser={npcs[entryId].discovery?.teaser} />
          ) : (
            <DetailPanel>
              {(npcs[entryId].gender || npcs[entryId].age !== undefined) && (
                <DetailField
                  label="Identity"
                  value={[npcs[entryId].gender, npcs[entryId].age !== undefined && `Age ${npcs[entryId].age}`].filter(Boolean).join(' · ')}
                />
              )}
              <DetailField label="Stage" value={npcs[entryId].stage} />
              <StatBar label="Trust" value={npcs[entryId].trust} />
              <StatBar label="Affection" value={npcs[entryId].affection} />
              <DetailField label="Memory" value={npcs[entryId].memSummary || '—'} />
              {npcs[entryId].deeds.length > 0 && <DetailField label="Deeds" value={npcs[entryId].deeds.join(', ')} />}
            </DetailPanel>
          )}
        </>
      )}

      {/* Faction */}
      {category === 'factions' && !entryId && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <AddButton label="Add Faction" onClick={() => startCreate({ name: '', repTier: 0 })} />
          {filteredFactions.map(([id, f]) => (
            <EntryCard
              key={id}
              title={isHidden(f) ? '???' : f.name}
              subtitle={isHidden(f) ? (f.discovery?.teaser || 'Not yet discovered.') : `${repTierLabel(f.repTier)} (${f.repTier > 0 ? '+' : ''}${f.repTier})`}
              badge={isHidden(f) ? <LockBadge /> : <AutoBadge shown={f.autoLogged} />}
              onClick={() => setEntryId(id)}
            />
          ))}
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
                  className="mt-1 w-full rounded-lg border border-[#e8ca8a]/25 bg-[#e8ca8a]/[0.04] backdrop-blur-sm px-3 py-2 font-mono text-sm text-ink"
                >
                  <option value="">None</option>
                  {Object.entries(factions).filter(([id]) => id !== entryId).map(([id, f]) => (
                    <option key={id} value={id}>{f.name}</option>
                  ))}
                </select>
                <span className="text-[10px] text-ink-muted/70">A rep change here mirrors an inverse change on the rival, automatically.</span>
              </label>
              <DiscoveryEditor discovery={draft.discovery} onChange={(disc) => setDraft((d) => ({ ...d, discovery: disc }))} />
            </DetailPanel>
          ) : isHidden(factions[entryId]) ? (
            <MaskedDetail teaser={factions[entryId].discovery?.teaser} />
          ) : (
            <DetailPanel>
              <DetailField
                label="Reputation Tier"
                value={`${repTierLabel(factions[entryId].repTier)} (${factions[entryId].repTier > 0 ? '+' : ''}${factions[entryId].repTier} of -2 to +2)`}
              />
              {factions[entryId].rivalId && factions[factions[entryId].rivalId!] && (
                <DetailField label="Rival Faction" value={factions[factions[entryId].rivalId!].name} />
              )}
            </DetailPanel>
          )}
        </>
      )}

      {/* Locations */}
      {category === 'locations' && !entryId && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <AddButton label="Add Location" onClick={() => startCreate({ name: '', region: '', description: '', dangerLevel: '', factionOwner: '', standing: '' })} />
          {filteredLocations.map(([id, l]) => (
            <EntryCard
              key={id}
              title={isHidden(l) ? '???' : l.name}
              subtitle={isHidden(l) ? (l.discovery?.teaser || 'Not yet discovered.') : `${l.region} · Danger: ${l.dangerLevel}`}
              badge={isHidden(l) ? <LockBadge /> : <AutoBadge shown={l.autoLogged} />}
              onClick={() => setEntryId(id)}
            />
          ))}
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
              <TextField label="Region" value={draft.region ?? ''} onChange={(v) => setDraft((d) => ({ ...d, region: v }))} />
              <TextField label="Danger Level" value={draft.dangerLevel ?? ''} onChange={(v) => setDraft((d) => ({ ...d, dangerLevel: v }))} />
              <label className="block">
                <span className="text-[11px] font-display text-ink-muted uppercase tracking-wide">Faction Owner (§5.11)</span>
                <select
                  value={draft.factionOwner ?? ''}
                  onChange={(e) => setDraft((d) => ({ ...d, factionOwner: e.target.value || null }))}
                  className="mt-1 w-full rounded-lg border border-[#e8ca8a]/25 bg-[#e8ca8a]/[0.04] backdrop-blur-sm px-3 py-2 font-mono text-sm text-ink"
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
              <DiscoveryEditor discovery={draft.discovery} onChange={(disc) => setDraft((d) => ({ ...d, discovery: disc }))} />
            </DetailPanel>
          ) : isHidden(locations[entryId]) ? (
            <MaskedDetail teaser={locations[entryId].discovery?.teaser} />
          ) : (
            <DetailPanel>
              <DetailField label="Region" value={locations[entryId].region} />
              <DetailField label="Danger Level" value={locations[entryId].dangerLevel} />
              <DetailField label="Standing" value={effectiveStanding(locations[entryId], factions)} />
              {locations[entryId].factionOwner && (
                <DetailField label="Faction Owner" value={factions[locations[entryId].factionOwner!]?.name ?? locations[entryId].factionOwner!} />
              )}
              <DetailField label="Description" value={locations[entryId].description} />
            </DetailPanel>
          )}
        </>
      )}

      {/* Lore */}
      {category === 'lore' && !entryId && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <AddButton label="Add Lore" onClick={() => startCreate({ name: '', category: '' })} />
          {filteredLore.map(([id, l]) => (
            <EntryCard
              key={id}
              title={isHidden(l) ? '???' : l.name}
              subtitle={isHidden(l) ? (l.discovery?.teaser || 'Not yet discovered.') : l.category}
              badge={isHidden(l) ? <LockBadge /> : <AutoBadge shown={l.autoLogged} />}
              onClick={() => setEntryId(id)}
            />
          ))}
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
              <DiscoveryEditor discovery={draft.discovery} onChange={(disc) => setDraft((d) => ({ ...d, discovery: disc }))} />
            </DetailPanel>
          ) : isHidden(lore[entryId]) ? (
            <MaskedDetail teaser={lore[entryId].discovery?.teaser} />
          ) : (
            <DetailPanel>
              <DetailField label="Category" value={lore[entryId].category} />
            </DetailPanel>
          )}
        </>
      )}

      {/* Quests */}
      {category === 'quests' && !entryId && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <AddButton label="Add Quest" onClick={() => startCreate({ name: '', status: '', note: '' })} />
          {filteredQuests.map(([id, q]) => (
            <EntryCard
              key={id}
              title={isHidden(q) ? '???' : q.name}
              subtitle={isHidden(q) ? (q.discovery?.teaser || 'Not yet discovered.') : (q.status ?? 'active')}
              badge={isHidden(q) ? <LockBadge /> : <AutoBadge shown={q.autoLogged} />}
              onClick={() => setEntryId(id)}
            />
          ))}
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
              <TextField label="Note" value={draft.note ?? ''} onChange={(v) => setDraft((d) => ({ ...d, note: v }))} textarea />
              <DiscoveryEditor discovery={draft.discovery} onChange={(disc) => setDraft((d) => ({ ...d, discovery: disc }))} />
            </DetailPanel>
          ) : isHidden(quests[entryId]) ? (
            <MaskedDetail teaser={quests[entryId].discovery?.teaser} />
          ) : (
            <DetailPanel>
              <DetailField label="Status" value={quests[entryId].status ?? 'active'} />
              {quests[entryId].note && <DetailField label="Note" value={quests[entryId].note!} />}
            </DetailPanel>
          )}
        </>
      )}

      {/* Bestiary */}
      {category === 'bestiary' && !entryId && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <AddButton label="Add Adversary" onClick={() => startCreate({ name: '', threatTier: '', hpMax: '', dmgBase: '' })} />
          {filteredBestiary.map(([id, b]) => (
            <EntryCard
              key={id}
              title={isHidden(b) ? '???' : b.name}
              subtitle={isHidden(b) ? (b.discovery?.teaser || 'Not yet discovered.') : b.threatTier}
              badge={isHidden(b) ? <LockBadge /> : <AutoBadge shown={b.autoLogged} />}
              onClick={() => setEntryId(id)}
            />
          ))}
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
              <DiscoveryEditor discovery={draft.discovery} onChange={(disc) => setDraft((d) => ({ ...d, discovery: disc }))} />
            </DetailPanel>
          ) : isHidden(bestiary[entryId]) ? (
            <MaskedDetail teaser={bestiary[entryId].discovery?.teaser} />
          ) : (
            <DetailPanel>
              <DetailField label="Threat Tier" value={bestiary[entryId].threatTier} />
              {bestiary[entryId].hpMax !== undefined && <DetailField label="HP" value={String(bestiary[entryId].hpMax)} />}
              {bestiary[entryId].dmgBase !== undefined && <DetailField label="Base Damage" value={String(bestiary[entryId].dmgBase)} />}
            </DetailPanel>
          )}
        </>
      )}

      {/* Skills — §6.4D category 6. Entries arrive two ways: a {{Term|skill}}
          mention in prose auto-registers a bare stub, and `skill_learn` fills
          in the real record when the protagonist actually gains an ability.
          Costs are shown as pills matching the [Active Skill] indigo accent
          the same skills already use inline in narration (§4.2). */}
      {category === 'skills' && !entryId && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <AddButton label="Add Skill" onClick={() => startCreate({ name: '', description: '', classId: '', mpCost: '', stCost: '' })} />
          {filteredSkills.map(([id, s]) => (
            <EntryCard
              key={id}
              title={isHidden(s) ? '???' : s.name}
              subtitle={
                isHidden(s)
                  ? s.discovery?.teaser || 'Not yet discovered.'
                  : s.description || classNameFor(s.classId) || 'No description yet.'
              }
              badge={isHidden(s) ? <LockBadge /> : <SkillCostBadge skill={s} />}
              onClick={() => setEntryId(id)}
            />
          ))}
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
            <DetailPanel>
              {skills[entryId].description && <DetailField label="Description" value={skills[entryId].description!} />}
              {classNameFor(skills[entryId].classId) && <DetailField label="Owning Class" value={classNameFor(skills[entryId].classId)!} />}
              {skills[entryId].mpCost !== undefined && <DetailField label="MP Cost" value={String(skills[entryId].mpCost)} />}
              {skills[entryId].stCost !== undefined && <DetailField label="ST Cost" value={String(skills[entryId].stCost)} />}
              {/* §3.2 — affordability is surfaced, never enforced: the check
                  tells the narrator whether to describe a clean cast or an
                  exhaustion penalty, it does not block the player. */}
              {(() => {
                const { affordable, missing } = checkAffordability(skills[entryId], player)
                if (affordable) return null
                return (
                  <p className="font-narrative text-xs text-rose">
                    Not enough reserves right now — short {missing}.
                  </p>
                )
              })()}
            </DetailPanel>
          )}
        </>
      )}

      {/* Items — §5.9 Item Type Taxonomy. `items` (name/type/description/
          statBonus) is a separate dict from `inventory` (id -> qty): every
          item that's ever entered inventory gets at least a minimal entry
          here (no more raw-slug display names), while only Weapon/Armor/
          Accessory can carry a statBonus and be equipped. */}
      {category === 'items' && !entryId && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <AddButton label="Add Item" onClick={() => startCreate({ name: '', type: 'material', qty: '1', description: '', statBonus: {} })} />
          {filteredItems.map(([id]) => {
            const qty = inventory[id]
            const item = items[id]
            const slot = equippedSlotFor(id)
            return (
              <EntryCard
                key={id}
                title={item?.name ?? id.replace(/_/g, ' ')}
                subtitle={`${item?.type ?? 'unknown'} · ×${qty}${statBonusText(item?.statBonus) ? ` · ${statBonusText(item?.statBonus)}` : ''}`}
                badge={slot ? <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#e8ca8a]/15 text-[#e8ca8a]/80">equipped</span> : undefined}
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
            </DetailPanel>
          ) : (
            <DetailPanel>
              <DetailField label="Type" value={items[entryId]?.type ?? 'unknown'} />
              <DetailField label="Quantity" value={String(inventory[entryId] ?? 0)} />
              {items[entryId]?.description && <DetailField label="Description" value={items[entryId]!.description!} />}
              {statBonusText(items[entryId]?.statBonus) && <DetailField label="Stat Bonus" value={statBonusText(items[entryId]?.statBonus)!} />}
              {items[entryId] && EQUIPPABLE_TYPES.includes(items[entryId]!.type) && (
                <div className="mt-1">
                  {equippedSlotFor(entryId) ? (
                    <button
                      onClick={() => onUnequipSlot(equippedSlotFor(entryId)!)}
                      className="rounded-full px-4 py-1.5 font-display text-xs font-semibold bg-rose-500/20 text-rose-300"
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
            </DetailPanel>
          )}
        </>
      )}

      {confirmDialog}
    </GlassScreen>
    {longTextDialog}
    </LongTextEditorContext.Provider>
  )
}
