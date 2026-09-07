import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  Home, Search, Plus, Pencil, Save, X, Trash2, Lock, ChevronRight, LayoutGrid,
  Globe, BookOpen, Users, ShieldCheck, Map, ScrollText, Target, Skull, Backpack,
  User, Hammer, Clock, Sparkles, Ghost,
} from 'lucide-react'
import { FIELD_CLASS, LABEL_CLASS, InkPanel, InkButton, InkField, InkTagPill } from '../lib/flatChrome.tsx'
import { slugify, titleCaseId } from '../lib/slug.ts'
import { isHidden, validateDiscovery } from '../lib/discovery.ts'
import { useConfirm } from '../lib/useConfirm.tsx'
import { PRESET_CLASSES } from '../data/classes.ts'
import { RECIPES } from '../data/recipes.ts'
import { canAffordRecipe } from '../lib/crafting.ts'
import { hoursRemaining } from '../lib/gameTime.ts'
import { EQUIPPABLE_TYPES, LOCATION_DANGER_LEVELS, LOCATION_TYPES } from '../types.ts'
import type {
  BestiaryEntry, CraftingJob, Discovery, EquipSlot, FactionEntry, ItemEntry, ItemType, LocationEntry, LogEntry, LoreEntry, NpcEntry, Player,
  QuestEntry, RevealTrigger, SkillEntry, StatBonus, WorldData,
} from '../types.ts'
import type { CategoryId } from './Codex.tsx'

// CodexViewer — the isolated flat/opaque alternative to Codex.tsx, same CRUD
// capability (view, add, edit, delete, discovery authoring) across every
// category, reusing the exact same handler props App.tsx already threads
// into Codex.tsx. Deliberately NOT reusing Codex.tsx's own shared components
// (DeckEntryCard, CATEGORY_ACCENTS, etc.) — those are the glass-styled/gold
// visual chrome this build exists to replace — so this file is a genuinely
// independent presentation over the same data + callbacks. See
// PROJECT_REVISION_NOTES.md for the fuller rationale.

const NEW_ID = '__new__'
const STAT_BONUS_KEYS: (keyof StatBonus)[] = ['STR', 'INT', 'AGI', 'hp', 'mp', 'st']

function genId(name: string, existing: Record<string, unknown>): string {
  const base = slugify(name) || 'entry'
  if (!existing[base]) return base
  let i = 2
  while (existing[`${base}_${i}`]) i++
  return `${base}_${i}`
}

function statBonusText(bonus: StatBonus | undefined): string | null {
  if (!bonus) return null
  const parts = Object.entries(bonus)
    .filter(([, v]) => v)
    .map(([k, v]) => `${(v as number) > 0 ? '+' : ''}${v} ${k}`)
  return parts.length ? parts.join(', ') : null
}

export interface CodexViewerProps {
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
  onOpenCodex: () => void
}

// ---------------------------------------------------------------------------
// Small shared field primitives — same idea as Codex.tsx's TextField/
// NumberField/TagsField, rebuilt on flatChrome so nothing here pulls in
// glassChrome's backdrop-blur classes.

function EditText({ label, value, onChange, textarea, placeholder }: {
  label: string
  value: string
  onChange: (v: string) => void
  textarea?: boolean
  placeholder?: string
}) {
  return (
    <InkField label={label}>
      {textarea ? (
        <textarea
          rows={3}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className={`${FIELD_CLASS} resize-y mt-1`}
        />
      ) : (
        <input value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className={`${FIELD_CLASS} mt-1`} />
      )}
    </InkField>
  )
}

function EditNumber({ label, value, onChange }: { label: string; value: number | string; onChange: (v: string) => void }) {
  return (
    <InkField label={label}>
      <input type="number" value={value} onChange={(e) => onChange(e.target.value)} className={`${FIELD_CLASS} mt-1 font-mono`} />
    </InkField>
  )
}

function EditSelect({ label, value, onChange, options }: {
  label: string
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <InkField label={label}>
      <select value={value} onChange={(e) => onChange(e.target.value)} className={`${FIELD_CLASS} mt-1`}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </InkField>
  )
}

function EditTags({ value, onChange }: { value: string[] | undefined; onChange: (tags: string[]) => void }) {
  return (
    <InkField label="Tags (comma-separated)">
      <input
        value={(value ?? []).join(', ')}
        onChange={(e) => onChange(e.target.value.split(',').map((t) => t.trim()).filter(Boolean))}
        placeholder="mentor, romance, hidden agenda"
        className={`${FIELD_CLASS} mt-1`}
      />
    </InkField>
  )
}

function ViewField({ label, value }: { label: string; value: ReactNode }) {
  if (value === undefined || value === null || value === '') return null
  return (
    <div>
      <p className={LABEL_CLASS}>{label}</p>
      <div className="font-narrative text-sm text-[#2a241e]">{value}</div>
    </div>
  )
}

function AddRow({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-[#c9a961] py-2.5 text-xs font-display text-[#8a6a24] hover:bg-black/5"
    >
      <Plus size={14} /> {label}
    </button>
  )
}

function EntryRow({ icon: Icon, title, subtitle, badge, onClick }: {
  icon?: LucideIcon
  title: string
  subtitle?: string
  badge?: ReactNode
  onClick: () => void
}) {
  return (
    <button onClick={onClick} className="w-full text-left bg-[#fffdf6] border border-[#e0d3ba] hover:border-[#c9a961] rounded-xl p-3 flex items-center gap-3 transition-colors">
      {Icon && (
        <div className="w-8 h-8 rounded-lg bg-[#ede0c0] border border-[#e0d3ba] flex items-center justify-center text-[#8a6a24] shrink-0">
          <Icon size={15} />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="font-display font-semibold text-sm text-[#2a241e] truncate">{title}</p>
        {subtitle && <p className="font-narrative text-xs text-[#6b6152] truncate">{subtitle}</p>}
      </div>
      {badge}
      <ChevronRight size={14} className="text-[#c9a961] shrink-0" />
    </button>
  )
}

function CrudBar({ editing, canDelete, onEdit, onSave, onCancel, onDelete }: {
  editing: boolean
  canDelete: boolean
  onEdit: () => void
  onSave: () => void
  onCancel: () => void
  onDelete: () => void
}) {
  if (editing) {
    return (
      <div className="flex items-center gap-1.5 ml-auto">
        <InkButton icon={X} compact onClick={onCancel}>Cancel</InkButton>
        <InkButton icon={Save} tone="action" compact onClick={onSave}>Save</InkButton>
      </div>
    )
  }
  return (
    <div className="flex items-center gap-1.5 ml-auto">
      <InkButton icon={Pencil} compact onClick={onEdit}>Edit</InkButton>
      {canDelete && <InkButton icon={Trash2} tone="danger" compact onClick={onDelete}>Delete</InkButton>}
    </div>
  )
}

function DiscoveryEditor({ discovery, onChange }: { discovery: Discovery | undefined; onChange: (d: Discovery | undefined) => void }) {
  const hidden = discovery?.state === 'hidden'
  return (
    <div className="rounded-lg border border-[#e0d3ba] p-3 flex flex-col gap-2.5">
      <span className="text-[10px] font-display text-[#6b6152] uppercase tracking-wider flex items-center gap-1">
        <Lock size={11} /> Discovery (Fog of Lore)
      </span>
      <label className="flex items-center gap-2 text-xs text-[#6b6152]">
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
          className="accent-[#8a6a24]"
        />
        Hidden until discovered
      </label>
      {hidden && (
        <>
          <EditSelect
            label="Reveal Trigger"
            value={discovery?.revealTrigger ?? 'manual'}
            onChange={(v) => onChange({ ...discovery!, state: 'hidden', revealTrigger: v as RevealTrigger })}
            options={[
              { value: 'manual', label: 'Manual (CRUD only)' },
              { value: 'flag', label: 'World Flag' },
              { value: 'location_visit', label: 'Visit Location (id)' },
              { value: 'npc_met', label: 'Meet NPC (id)' },
              { value: 'quest_complete', label: 'Complete Quest (id)' },
            ]}
          />
          {discovery?.revealTrigger !== 'manual' && (
            <EditText
              label="Reveal Condition"
              value={discovery?.revealCondition ?? ''}
              onChange={(v) => onChange({ ...discovery!, state: 'hidden', revealCondition: v })}
              placeholder="flag text, loc_id, npc_id, or quest_id"
            />
          )}
          <EditText
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

const CATEGORY_ICONS: Record<CategoryId, LucideIcon> = {
  realm: Globe, character: User, crafting: Hammer, chapters: BookOpen,
  npcs: Users, factions: ShieldCheck, locations: Map, lore: ScrollText,
  quests: Target, bestiary: Skull, items: Backpack, skills: Sparkles, corpses: Ghost,
}

export default function CodexViewer({
  world, player, log, npcs, factions, locations, lore, quests, bestiary, flags, inventory, items, crafting, corpses,
  onUpdateNpc, onUpdateFaction, onUpdateLocation, onUpdateLore, onUpdateQuest, onUpdateBestiary, onUpdateSkill, onUpdateItem,
  onEquipItem, onUnequipSlot, onUpdateWorld, onEvolveClass, onStartCraft, skills,
  initialCategory, initialEntryId, onBack, onOpenCodex,
}: CodexViewerProps) {
  const [category, setCategory] = useState<CategoryId | null>(initialCategory ?? null)
  const [entryId, setEntryId] = useState<string | null>(initialEntryId ?? null)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<Record<string, any>>({})
  const [searchQuery, setSearchQuery] = useState('')
  const { confirm, dialog: confirmDialog } = useConfirm()

  useEffect(() => setSearchQuery(''), [category])

  function equippedSlotFor(itemId: string): EquipSlot | undefined {
    return (Object.entries(player.equipped ?? {}) as [EquipSlot, string][]).find(([, id]) => id === itemId)?.[0]
  }

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
      trust: Number(draft.trust) || 0,
      affection: Number(draft.affection) || 0,
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
      repTier: Number(draft.repTier) || 0,
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

  async function deleteEntry(kind: Exclude<CategoryId, 'chapters' | 'realm' | 'items' | 'character' | 'crafting' | 'corpses'>) {
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

  async function deleteItemEntry() {
    if (!entryId || !(await confirm('Delete this item? This cannot be undone.'))) return
    onUpdateItem(entryId, null)
    setEntryId(null)
  }

  const chapters = log.filter((e) => e.chapterSummary)
  const corpseCountsRecord: Record<string, number> = {}
  for (const tag of corpses) corpseCountsRecord[tag] = (corpseCountsRecord[tag] ?? 0) + 1
  const corpseCounts = Object.entries(corpseCountsRecord)

  const categories: { id: CategoryId; label: string; count: number }[] = [
    { id: 'quests', label: 'Quests', count: Object.keys(quests).length },
    { id: 'npcs', label: 'NPCs', count: Object.keys(npcs).length },
    { id: 'skills', label: 'Skills', count: Object.keys(skills).length },
    { id: 'items', label: 'Items', count: Object.keys(inventory).length },
    { id: 'locations', label: 'Locations', count: Object.keys(locations).length },
    { id: 'bestiary', label: 'Bestiary', count: Object.keys(bestiary).length },
    { id: 'corpses', label: 'Corpses', count: corpses.length },
    { id: 'factions', label: 'Factions', count: Object.keys(factions).length },
    { id: 'lore', label: 'Lore', count: Object.keys(lore).length },
    { id: 'chapters', label: 'Chapters', count: chapters.length },
    { id: 'character', label: 'Character', count: 1 },
    { id: 'crafting', label: 'Crafting', count: crafting.length },
    { id: 'realm', label: 'Realm', count: 1 },
  ]

  function matchesQuery(...vals: (string | undefined)[]) {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return vals.some((v) => v?.toLowerCase().includes(q))
  }

  const title =
    editing ? (entryId === NEW_ID ? 'New Entry' : 'Edit Entry') :
    entryId ? (
      category === 'npcs' ? (isHidden(npcs[entryId]) ? '???' : npcs[entryId]?.name) :
      category === 'factions' ? (isHidden(factions[entryId]) ? '???' : factions[entryId]?.name) :
      category === 'locations' ? (isHidden(locations[entryId]) ? '???' : locations[entryId]?.name) :
      category === 'lore' ? (isHidden(lore[entryId]) ? '???' : lore[entryId]?.name) :
      category === 'quests' ? (isHidden(quests[entryId]) ? '???' : quests[entryId]?.name) :
      category === 'bestiary' ? (isHidden(bestiary[entryId]) ? '???' : bestiary[entryId]?.name) :
      category === 'skills' ? (isHidden(skills[entryId]) ? '???' : skills[entryId]?.name) :
      category === 'items' ? (items[entryId]?.name ?? titleCaseId(entryId)) :
      'Entry'
    ) : categories.find((c) => c.id === category)?.label ?? 'Codex'

  return (
    <div className="fixed inset-0 overflow-hidden text-[#2a241e] bg-[#f8f1de] flex flex-col">
      <header className="shrink-0 flex items-center gap-3 px-3 py-2 border-b border-[#e0d3ba] bg-[#f3ead2]" style={{ paddingTop: 'max(0.5rem, env(safe-area-inset-top))' }}>
        <button onClick={back} aria-label="Back" className="w-8 h-8 rounded-xl inline-flex items-center justify-center text-[#8a6a24] hover:bg-black/5">
          <Home size={16} />
        </button>
        <h2 className="font-display font-bold text-sm text-[#2a241e] truncate flex-1">{title}</h2>
        <button onClick={onOpenCodex} aria-label="Classic Codex" title="Switch to the classic Codex view" className="w-8 h-8 rounded-xl inline-flex items-center justify-center text-[#8a6a24] hover:bg-black/5">
          <LayoutGrid size={16} />
        </button>
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto px-3 py-4">
        <div className="max-w-2xl mx-auto w-full flex flex-col gap-3">
          {/* Search — shown for the 8 CRUD list views only */}
          {category && !entryId && ['npcs', 'factions', 'locations', 'lore', 'quests', 'bestiary', 'skills', 'items'].includes(category) && (
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6b6152]" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search entries..."
                className="w-full h-9 rounded-xl border border-[#e0d3ba] bg-[#fffdf6] pl-8 pr-8 text-xs text-[#2a241e] placeholder:text-[#6b6152]/50 outline-none focus:border-[#8a6a24]/60"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#6b6152] hover:text-[#2a241e]">
                  <X size={13} />
                </button>
              )}
            </div>
          )}

          {/* Level 1 — category grid */}
          {!category && (
            <div className="grid grid-cols-2 gap-2.5">
              {categories.map((c) => {
                const Icon = CATEGORY_ICONS[c.id]
                return (
                  <button
                    key={c.id}
                    onClick={() => setCategory(c.id)}
                    className="bg-[#fffdf6] border border-[#e0d3ba] hover:border-[#c9a961] rounded-xl p-3 flex flex-col gap-1.5 text-left transition-colors"
                  >
                    <div className="w-8 h-8 rounded-lg bg-[#ede0c0] border border-[#e0d3ba] flex items-center justify-center text-[#8a6a24]">
                      <Icon size={16} />
                    </div>
                    <span className="font-display font-semibold text-xs text-[#2a241e]">{c.label}</span>
                    <span className="font-mono text-[10px] text-[#6b6152]">{c.count}</span>
                  </button>
                )
              })}
            </div>
          )}

          {/* NPCs */}
          {category === 'npcs' && !entryId && (
            <div className="flex flex-col gap-2">
              <AddRow label="Add NPC" onClick={() => startCreate({ name: '', stage: 'Stranger', trust: 0, affection: 0, memSummary: '', deeds: '' })} />
              {Object.entries(npcs).filter(([, n]) => matchesQuery(n.name, n.memSummary, n.role, n.stage)).map(([id, n]) => {
                const hidden = isHidden(n)
                return (
                  <EntryRow
                    key={id}
                    icon={Users}
                    title={hidden ? '???' : n.name}
                    subtitle={hidden ? n.discovery?.teaser || 'Not yet discovered.' : n.role || n.stage}
                    badge={hidden ? <Lock size={13} className="text-[#8a6a24]" /> : undefined}
                    onClick={() => setEntryId(id)}
                  />
                )
              })}
              {Object.keys(npcs).length === 0 && <p className="font-narrative italic text-sm text-[#6b6152]">No NPCs met yet.</p>}
            </div>
          )}
          {category === 'npcs' && entryId && (editing || npcs[entryId]) && (
            <>
              <div className="flex justify-end">
                <CrudBar editing={editing} canDelete={entryId !== NEW_ID} onEdit={() => startEdit(entryId, { ...npcs[entryId], factionId: npcs[entryId].factionId ?? '' })} onSave={saveNpc} onCancel={cancelEdit} onDelete={() => deleteEntry('npcs')} />
              </div>
              {editing ? (
                <InkPanel className="p-4 flex flex-col gap-3">
                  <EditText label="Name" value={draft.name ?? ''} onChange={(v) => setDraft((d) => ({ ...d, name: v }))} />
                  <div className="grid grid-cols-2 gap-3">
                    <EditText label="Role" value={draft.role ?? ''} onChange={(v) => setDraft((d) => ({ ...d, role: v }))} />
                    <EditText label="Stage" value={draft.stage ?? ''} onChange={(v) => setDraft((d) => ({ ...d, stage: v }))} />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <EditNumber label="Trust" value={draft.trust ?? 0} onChange={(v) => setDraft((d) => ({ ...d, trust: v }))} />
                    <EditNumber label="Affection" value={draft.affection ?? 0} onChange={(v) => setDraft((d) => ({ ...d, affection: v }))} />
                    <EditText label="Age" value={draft.age !== undefined ? String(draft.age) : ''} onChange={(v) => setDraft((d) => ({ ...d, age: v }))} />
                  </div>
                  <EditText label="Gender" value={draft.gender ?? ''} onChange={(v) => setDraft((d) => ({ ...d, gender: v }))} />
                  <EditText label="Memory Summary" value={draft.memSummary ?? ''} onChange={(v) => setDraft((d) => ({ ...d, memSummary: v }))} textarea />
                  <EditText label="Deeds (comma-separated)" value={typeof draft.deeds === 'string' ? draft.deeds : (draft.deeds ?? []).join(', ')} onChange={(v) => setDraft((d) => ({ ...d, deeds: v }))} />
                  <EditText label="Appearance" value={draft.appearance ?? ''} onChange={(v) => setDraft((d) => ({ ...d, appearance: v }))} textarea />
                  <div className="grid grid-cols-2 gap-3">
                    <EditText label="Held Weapon" value={draft.heldWeapon ?? ''} onChange={(v) => setDraft((d) => ({ ...d, heldWeapon: v }))} />
                    <EditText label="Worn Armor" value={draft.wornArmor ?? ''} onChange={(v) => setDraft((d) => ({ ...d, wornArmor: v }))} />
                  </div>
                  <EditText label="Personality" value={draft.personality ?? ''} onChange={(v) => setDraft((d) => ({ ...d, personality: v }))} textarea />
                  <EditText label="Voice Notes" value={draft.voiceNotes ?? ''} onChange={(v) => setDraft((d) => ({ ...d, voiceNotes: v }))} textarea />
                  <EditSelect
                    label="Faction"
                    value={draft.factionId ?? ''}
                    onChange={(v) => setDraft((d) => ({ ...d, factionId: v }))}
                    options={[{ value: '', label: 'None' }, ...Object.entries(factions).map(([id, f]) => ({ value: id, label: f.name }))]}
                  />
                  <EditTags value={draft.tags} onChange={(tags) => setDraft((d) => ({ ...d, tags }))} />
                  <DiscoveryEditor discovery={draft.discovery} onChange={(d) => setDraft((dr) => ({ ...dr, discovery: d }))} />
                </InkPanel>
              ) : isHidden(npcs[entryId]) ? (
                <InkPanel className="p-4"><p className="font-narrative text-sm text-[#6b6152] italic">{npcs[entryId].discovery?.teaser || 'Not yet discovered.'}</p></InkPanel>
              ) : (
                <InkPanel className="p-4 flex flex-col gap-3">
                  <ViewField label="Role" value={npcs[entryId].role} />
                  <ViewField label="Stage" value={npcs[entryId].stage} />
                  <ViewField label="Trust / Affection" value={`${npcs[entryId].trust} / ${npcs[entryId].affection}`} />
                  <ViewField label="Gender / Age" value={[npcs[entryId].gender, npcs[entryId].age].filter(Boolean).join(' · ')} />
                  <ViewField label="Memory Summary" value={npcs[entryId].memSummary} />
                  <ViewField label="Deeds" value={npcs[entryId].deeds?.length ? npcs[entryId].deeds.join(', ') : undefined} />
                  <ViewField label="Appearance" value={npcs[entryId].appearance} />
                  <ViewField label="Held Weapon" value={npcs[entryId].heldWeapon} />
                  <ViewField label="Worn Armor" value={npcs[entryId].wornArmor} />
                  <ViewField label="Personality" value={npcs[entryId].personality} />
                  <ViewField label="Voice Notes" value={npcs[entryId].voiceNotes} />
                  <ViewField label="Faction" value={npcs[entryId].factionId ? factions[npcs[entryId].factionId!]?.name : undefined} />
                  {npcs[entryId].tags && npcs[entryId].tags!.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">{npcs[entryId].tags!.map((t) => <InkTagPill key={t}>{t}</InkTagPill>)}</div>
                  )}
                </InkPanel>
              )}
            </>
          )}

          {/* Factions */}
          {category === 'factions' && !entryId && (
            <div className="flex flex-col gap-2">
              <AddRow label="Add Faction" onClick={() => startCreate({ name: '', repTier: 0 })} />
              {Object.entries(factions).filter(([, f]) => matchesQuery(f.name, f.description)).map(([id, f]) => {
                const hidden = isHidden(f)
                return (
                  <EntryRow key={id} icon={ShieldCheck} title={hidden ? '???' : f.name} subtitle={hidden ? f.discovery?.teaser || 'Not yet discovered.' : `Rep ${f.repTier}`} badge={hidden ? <Lock size={13} className="text-[#8a6a24]" /> : undefined} onClick={() => setEntryId(id)} />
                )
              })}
              {Object.keys(factions).length === 0 && <p className="font-narrative italic text-sm text-[#6b6152]">No factions known yet.</p>}
            </div>
          )}
          {category === 'factions' && entryId && (editing || factions[entryId]) && (
            <>
              <div className="flex justify-end">
                <CrudBar editing={editing} canDelete={entryId !== NEW_ID} onEdit={() => startEdit(entryId, factions[entryId])} onSave={saveFaction} onCancel={cancelEdit} onDelete={() => deleteEntry('factions')} />
              </div>
              {editing ? (
                <InkPanel className="p-4 flex flex-col gap-3">
                  <EditText label="Name" value={draft.name ?? ''} onChange={(v) => setDraft((d) => ({ ...d, name: v }))} />
                  <EditNumber label="Reputation Tier (-2 to 2)" value={draft.repTier ?? 0} onChange={(v) => setDraft((d) => ({ ...d, repTier: v }))} />
                  <EditSelect
                    label="Rival Faction"
                    value={draft.rivalId ?? ''}
                    onChange={(v) => setDraft((d) => ({ ...d, rivalId: v }))}
                    options={[{ value: '', label: 'None' }, ...Object.entries(factions).filter(([id]) => id !== entryId).map(([id, f]) => ({ value: id, label: f.name }))]}
                  />
                  <EditText label="Description" value={draft.description ?? ''} onChange={(v) => setDraft((d) => ({ ...d, description: v }))} textarea />
                  <EditText label="Leader" value={draft.leader ?? ''} onChange={(v) => setDraft((d) => ({ ...d, leader: v }))} />
                  <EditText label="Territory" value={draft.territory ?? ''} onChange={(v) => setDraft((d) => ({ ...d, territory: v }))} />
                  <EditText label="Symbol" value={draft.symbol ?? ''} onChange={(v) => setDraft((d) => ({ ...d, symbol: v }))} />
                  <EditTags value={draft.tags} onChange={(tags) => setDraft((d) => ({ ...d, tags }))} />
                  <DiscoveryEditor discovery={draft.discovery} onChange={(d) => setDraft((dr) => ({ ...dr, discovery: d }))} />
                </InkPanel>
              ) : isHidden(factions[entryId]) ? (
                <InkPanel className="p-4"><p className="font-narrative text-sm text-[#6b6152] italic">{factions[entryId].discovery?.teaser || 'Not yet discovered.'}</p></InkPanel>
              ) : (
                <InkPanel className="p-4 flex flex-col gap-3">
                  <ViewField label="Reputation Tier" value={factions[entryId].repTier} />
                  <ViewField label="Rival" value={factions[entryId].rivalId ? factions[factions[entryId].rivalId!]?.name : undefined} />
                  <ViewField label="Description" value={factions[entryId].description} />
                  <ViewField label="Leader" value={factions[entryId].leader} />
                  <ViewField label="Territory" value={factions[entryId].territory} />
                  <ViewField label="Symbol" value={factions[entryId].symbol} />
                  {factions[entryId].tags && factions[entryId].tags!.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">{factions[entryId].tags!.map((t) => <InkTagPill key={t}>{t}</InkTagPill>)}</div>
                  )}
                </InkPanel>
              )}
            </>
          )}

          {/* Locations */}
          {category === 'locations' && !entryId && (
            <div className="flex flex-col gap-2">
              <AddRow label="Add Location" onClick={() => startCreate({ name: '', region: '', description: '', dangerLevel: 'Safe', standing: 'neutral' })} />
              {Object.entries(locations).filter(([, l]) => matchesQuery(l.name, l.region, l.description)).map(([id, l]) => {
                const hidden = isHidden(l)
                return (
                  <EntryRow key={id} icon={Map} title={hidden ? '???' : l.name} subtitle={hidden ? l.discovery?.teaser || 'Not yet discovered.' : `${l.region} · ${l.dangerLevel}`} badge={hidden ? <Lock size={13} className="text-[#8a6a24]" /> : undefined} onClick={() => setEntryId(id)} />
                )
              })}
              {Object.keys(locations).length === 0 && <p className="font-narrative italic text-sm text-[#6b6152]">No locations visited yet.</p>}
            </div>
          )}
          {category === 'locations' && entryId && (editing || locations[entryId]) && (
            <>
              <div className="flex justify-end">
                <CrudBar editing={editing} canDelete={entryId !== NEW_ID} onEdit={() => startEdit(entryId, { ...locations[entryId], factionOwner: locations[entryId].factionOwner ?? '' })} onSave={saveLocation} onCancel={cancelEdit} onDelete={() => deleteEntry('locations')} />
              </div>
              {editing ? (
                <InkPanel className="p-4 flex flex-col gap-3">
                  <EditText label="Name" value={draft.name ?? ''} onChange={(v) => setDraft((d) => ({ ...d, name: v }))} />
                  <EditText label="Region" value={draft.region ?? ''} onChange={(v) => setDraft((d) => ({ ...d, region: v }))} />
                  <EditText label="Description" value={draft.description ?? ''} onChange={(v) => setDraft((d) => ({ ...d, description: v }))} textarea />
                  <div className="grid grid-cols-2 gap-3">
                    <EditSelect label="Danger Level" value={draft.dangerLevel ?? 'Safe'} onChange={(v) => setDraft((d) => ({ ...d, dangerLevel: v }))} options={LOCATION_DANGER_LEVELS.map((v) => ({ value: v, label: v }))} />
                    <EditSelect label="Location Type" value={draft.locationType ?? ''} onChange={(v) => setDraft((d) => ({ ...d, locationType: v }))} options={[{ value: '', label: 'Unset' }, ...LOCATION_TYPES.map((v) => ({ value: v, label: v }))]} />
                  </div>
                  <EditSelect
                    label="Faction Owner"
                    value={draft.factionOwner ?? ''}
                    onChange={(v) => setDraft((d) => ({ ...d, factionOwner: v }))}
                    options={[{ value: '', label: 'None' }, ...Object.entries(factions).map(([id, f]) => ({ value: id, label: f.name }))]}
                  />
                  <EditText label="Standing" value={draft.standing ?? ''} onChange={(v) => setDraft((d) => ({ ...d, standing: v }))} />
                  <EditText label="Notable Features" value={draft.notableFeatures ?? ''} onChange={(v) => setDraft((d) => ({ ...d, notableFeatures: v }))} textarea />
                  <EditText label="Inhabitants" value={draft.inhabitants ?? ''} onChange={(v) => setDraft((d) => ({ ...d, inhabitants: v }))} textarea />
                  <EditTags value={draft.tags} onChange={(tags) => setDraft((d) => ({ ...d, tags }))} />
                  <DiscoveryEditor discovery={draft.discovery} onChange={(d) => setDraft((dr) => ({ ...dr, discovery: d }))} />
                </InkPanel>
              ) : isHidden(locations[entryId]) ? (
                <InkPanel className="p-4"><p className="font-narrative text-sm text-[#6b6152] italic">{locations[entryId].discovery?.teaser || 'Not yet discovered.'}</p></InkPanel>
              ) : (
                <InkPanel className="p-4 flex flex-col gap-3">
                  <ViewField label="Region" value={locations[entryId].region} />
                  <ViewField label="Description" value={locations[entryId].description} />
                  <ViewField label="Danger Level" value={locations[entryId].dangerLevel} />
                  <ViewField label="Type" value={locations[entryId].locationType} />
                  <ViewField label="Faction Owner" value={locations[entryId].factionOwner ? factions[locations[entryId].factionOwner!]?.name : undefined} />
                  <ViewField label="Standing" value={locations[entryId].standing} />
                  <ViewField label="Notable Features" value={locations[entryId].notableFeatures} />
                  <ViewField label="Inhabitants" value={locations[entryId].inhabitants} />
                  {locations[entryId].tags && locations[entryId].tags!.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">{locations[entryId].tags!.map((t) => <InkTagPill key={t}>{t}</InkTagPill>)}</div>
                  )}
                </InkPanel>
              )}
            </>
          )}

          {/* Lore */}
          {category === 'lore' && !entryId && (
            <div className="flex flex-col gap-2">
              <AddRow label="Add Lore" onClick={() => startCreate({ name: '', category: 'General' })} />
              {Object.entries(lore).filter(([, l]) => matchesQuery(l.name, l.category, l.content)).map(([id, l]) => {
                const hidden = isHidden(l)
                return (
                  <EntryRow key={id} icon={ScrollText} title={hidden ? '???' : l.name} subtitle={hidden ? l.discovery?.teaser || 'Not yet discovered.' : l.category} badge={hidden ? <Lock size={13} className="text-[#8a6a24]" /> : undefined} onClick={() => setEntryId(id)} />
                )
              })}
              {Object.keys(lore).length === 0 && <p className="font-narrative italic text-sm text-[#6b6152]">No lore discovered yet.</p>}
            </div>
          )}
          {category === 'lore' && entryId && (editing || lore[entryId]) && (
            <>
              <div className="flex justify-end">
                <CrudBar editing={editing} canDelete={entryId !== NEW_ID} onEdit={() => startEdit(entryId, lore[entryId])} onSave={saveLore} onCancel={cancelEdit} onDelete={() => deleteEntry('lore')} />
              </div>
              {editing ? (
                <InkPanel className="p-4 flex flex-col gap-3">
                  <EditText label="Name" value={draft.name ?? ''} onChange={(v) => setDraft((d) => ({ ...d, name: v }))} />
                  <EditText label="Category" value={draft.category ?? ''} onChange={(v) => setDraft((d) => ({ ...d, category: v }))} />
                  <EditText label="Content" value={draft.content ?? ''} onChange={(v) => setDraft((d) => ({ ...d, content: v }))} textarea />
                  <EditText label="Era" value={draft.era ?? ''} onChange={(v) => setDraft((d) => ({ ...d, era: v }))} />
                  <EditTags value={draft.tags} onChange={(tags) => setDraft((d) => ({ ...d, tags }))} />
                  <DiscoveryEditor discovery={draft.discovery} onChange={(d) => setDraft((dr) => ({ ...dr, discovery: d }))} />
                </InkPanel>
              ) : isHidden(lore[entryId]) ? (
                <InkPanel className="p-4"><p className="font-narrative text-sm text-[#6b6152] italic">{lore[entryId].discovery?.teaser || 'Not yet discovered.'}</p></InkPanel>
              ) : (
                <InkPanel className="p-4 flex flex-col gap-3">
                  <ViewField label="Category" value={lore[entryId].category} />
                  <ViewField label="Content" value={lore[entryId].content} />
                  <ViewField label="Era" value={lore[entryId].era} />
                  {lore[entryId].tags && lore[entryId].tags!.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">{lore[entryId].tags!.map((t) => <InkTagPill key={t}>{t}</InkTagPill>)}</div>
                  )}
                </InkPanel>
              )}
            </>
          )}

          {/* Quests */}
          {category === 'quests' && !entryId && (
            <div className="flex flex-col gap-2">
              <AddRow label="Add Quest" onClick={() => startCreate({ name: '', status: 'advanced' })} />
              {Object.entries(quests).filter(([, q]) => matchesQuery(q.name, q.note, q.description)).map(([id, q]) => {
                const hidden = isHidden(q)
                return (
                  <EntryRow key={id} icon={Target} title={hidden ? '???' : q.name} subtitle={hidden ? q.discovery?.teaser || 'Not yet discovered.' : [q.status, q.type].filter(Boolean).join(' · ')} badge={hidden ? <Lock size={13} className="text-[#8a6a24]" /> : undefined} onClick={() => setEntryId(id)} />
                )
              })}
              {Object.keys(quests).length === 0 && <p className="font-narrative italic text-sm text-[#6b6152]">No quests tracked yet.</p>}
            </div>
          )}
          {category === 'quests' && entryId && (editing || quests[entryId]) && (
            <>
              <div className="flex justify-end">
                <CrudBar editing={editing} canDelete={entryId !== NEW_ID} onEdit={() => startEdit(entryId, { ...quests[entryId], status: quests[entryId].status ?? '' })} onSave={saveQuest} onCancel={cancelEdit} onDelete={() => deleteEntry('quests')} />
              </div>
              {editing ? (
                <InkPanel className="p-4 flex flex-col gap-3">
                  <EditText label="Name" value={draft.name ?? ''} onChange={(v) => setDraft((d) => ({ ...d, name: v }))} />
                  <div className="grid grid-cols-2 gap-3">
                    <EditSelect label="Status" value={draft.status ?? ''} onChange={(v) => setDraft((d) => ({ ...d, status: v }))} options={[{ value: '', label: 'Active' }, { value: 'advanced', label: 'In Progress' }, { value: 'completed', label: 'Completed' }, { value: 'failed', label: 'Failed' }]} />
                    <EditSelect label="Type" value={draft.type ?? ''} onChange={(v) => setDraft((d) => ({ ...d, type: v }))} options={[{ value: '', label: 'Unset' }, { value: 'main', label: 'Main' }, { value: 'side', label: 'Side' }, { value: 'ambition', label: 'Ambition' }, { value: 'secret_ambition', label: 'Secret Ambition' }]} />
                  </div>
                  <EditText label="Description" value={draft.description ?? ''} onChange={(v) => setDraft((d) => ({ ...d, description: v }))} textarea />
                  <EditText label="Note" value={draft.note ?? ''} onChange={(v) => setDraft((d) => ({ ...d, note: v }))} textarea />
                  <EditText label="Quest Giver" value={draft.questGiver ?? ''} onChange={(v) => setDraft((d) => ({ ...d, questGiver: v }))} />
                  <EditText label="Reward" value={draft.reward ?? ''} onChange={(v) => setDraft((d) => ({ ...d, reward: v }))} />
                  <EditTags value={draft.tags} onChange={(tags) => setDraft((d) => ({ ...d, tags }))} />
                  <DiscoveryEditor discovery={draft.discovery} onChange={(d) => setDraft((dr) => ({ ...dr, discovery: d }))} />
                </InkPanel>
              ) : isHidden(quests[entryId]) ? (
                <InkPanel className="p-4"><p className="font-narrative text-sm text-[#6b6152] italic">{quests[entryId].discovery?.teaser || 'Not yet discovered.'}</p></InkPanel>
              ) : (
                <InkPanel className="p-4 flex flex-col gap-3">
                  <ViewField label="Status" value={quests[entryId].status} />
                  <ViewField label="Type" value={quests[entryId].type} />
                  <ViewField label="Description" value={quests[entryId].description} />
                  <ViewField label="Note" value={quests[entryId].note} />
                  <ViewField label="Quest Giver" value={quests[entryId].questGiver} />
                  <ViewField label="Reward" value={quests[entryId].reward} />
                  {quests[entryId].tags && quests[entryId].tags!.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">{quests[entryId].tags!.map((t) => <InkTagPill key={t}>{t}</InkTagPill>)}</div>
                  )}
                </InkPanel>
              )}
            </>
          )}

          {/* Bestiary */}
          {category === 'bestiary' && !entryId && (
            <div className="flex flex-col gap-2">
              <AddRow label="Add Beast" onClick={() => startCreate({ name: '', threatTier: 'Standard' })} />
              {Object.entries(bestiary).filter(([, b]) => matchesQuery(b.name, b.threatTier, b.description)).map(([id, b]) => {
                const hidden = isHidden(b)
                return (
                  <EntryRow key={id} icon={Skull} title={hidden ? '???' : b.name} subtitle={hidden ? b.discovery?.teaser || 'Not yet discovered.' : b.threatTier} badge={hidden ? <Lock size={13} className="text-[#8a6a24]" /> : undefined} onClick={() => setEntryId(id)} />
                )
              })}
              {Object.keys(bestiary).length === 0 && <p className="font-narrative italic text-sm text-[#6b6152]">No adversaries encountered yet.</p>}
            </div>
          )}
          {category === 'bestiary' && entryId && (editing || bestiary[entryId]) && (
            <>
              <div className="flex justify-end">
                <CrudBar editing={editing} canDelete={entryId !== NEW_ID} onEdit={() => startEdit(entryId, bestiary[entryId])} onSave={saveBestiary} onCancel={cancelEdit} onDelete={() => deleteEntry('bestiary')} />
              </div>
              {editing ? (
                <InkPanel className="p-4 flex flex-col gap-3">
                  <EditText label="Name" value={draft.name ?? ''} onChange={(v) => setDraft((d) => ({ ...d, name: v }))} />
                  <EditText label="Threat Tier" value={draft.threatTier ?? ''} onChange={(v) => setDraft((d) => ({ ...d, threatTier: v }))} />
                  <div className="grid grid-cols-2 gap-3">
                    <EditText label="HP Max" value={draft.hpMax ?? ''} onChange={(v) => setDraft((d) => ({ ...d, hpMax: v }))} />
                    <EditText label="Base Damage" value={draft.dmgBase ?? ''} onChange={(v) => setDraft((d) => ({ ...d, dmgBase: v }))} />
                  </div>
                  <EditText label="Description" value={draft.description ?? ''} onChange={(v) => setDraft((d) => ({ ...d, description: v }))} textarea />
                  <EditText label="Habitat" value={draft.habitat ?? ''} onChange={(v) => setDraft((d) => ({ ...d, habitat: v }))} />
                  <EditText label="Weaknesses" value={draft.weaknesses ?? ''} onChange={(v) => setDraft((d) => ({ ...d, weaknesses: v }))} textarea />
                  <EditText label="Loot Table" value={draft.lootTable ?? ''} onChange={(v) => setDraft((d) => ({ ...d, lootTable: v }))} />
                  <EditTags value={draft.tags} onChange={(tags) => setDraft((d) => ({ ...d, tags }))} />
                  <DiscoveryEditor discovery={draft.discovery} onChange={(d) => setDraft((dr) => ({ ...dr, discovery: d }))} />
                </InkPanel>
              ) : isHidden(bestiary[entryId]) ? (
                <InkPanel className="p-4"><p className="font-narrative text-sm text-[#6b6152] italic">{bestiary[entryId].discovery?.teaser || 'Not yet discovered.'}</p></InkPanel>
              ) : (
                <InkPanel className="p-4 flex flex-col gap-3">
                  <ViewField label="Threat Tier" value={bestiary[entryId].threatTier} />
                  <ViewField label="HP / Damage" value={bestiary[entryId].hpMax !== undefined ? `${bestiary[entryId].hpMax} HP · ${bestiary[entryId].dmgBase} DMG` : undefined} />
                  <ViewField label="Description" value={bestiary[entryId].description} />
                  <ViewField label="Habitat" value={bestiary[entryId].habitat} />
                  <ViewField label="Weaknesses" value={bestiary[entryId].weaknesses} />
                  <ViewField label="Loot Table" value={bestiary[entryId].lootTable} />
                  {bestiary[entryId].tags && bestiary[entryId].tags!.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">{bestiary[entryId].tags!.map((t) => <InkTagPill key={t}>{t}</InkTagPill>)}</div>
                  )}
                </InkPanel>
              )}
            </>
          )}

          {/* Skills */}
          {category === 'skills' && !entryId && (
            <div className="flex flex-col gap-2">
              <AddRow label="Add Skill" onClick={() => startCreate({ name: '' })} />
              {Object.entries(skills).filter(([, s]) => matchesQuery(s.name, s.description, s.flavorText)).map(([id, s]) => {
                const hidden = isHidden(s)
                const parts = [s.mpCost ? `${s.mpCost} MP` : null, s.stCost ? `${s.stCost} ST` : null].filter(Boolean).join(' · ')
                return (
                  <EntryRow key={id} icon={Sparkles} title={hidden ? '???' : s.name} subtitle={hidden ? s.discovery?.teaser || 'Not yet discovered.' : parts || s.skillType} badge={hidden ? <Lock size={13} className="text-[#8a6a24]" /> : undefined} onClick={() => setEntryId(id)} />
                )
              })}
              {Object.keys(skills).length === 0 && <p className="font-narrative italic text-sm text-[#6b6152]">No skills learned yet.</p>}
            </div>
          )}
          {category === 'skills' && entryId && (editing || skills[entryId]) && (
            <>
              <div className="flex justify-end">
                <CrudBar editing={editing} canDelete={entryId !== NEW_ID} onEdit={() => startEdit(entryId, skills[entryId])} onSave={saveSkill} onCancel={cancelEdit} onDelete={() => deleteEntry('skills')} />
              </div>
              {editing ? (
                <InkPanel className="p-4 flex flex-col gap-3">
                  <EditText label="Name" value={draft.name ?? ''} onChange={(v) => setDraft((d) => ({ ...d, name: v }))} />
                  <EditText label="Description" value={draft.description ?? ''} onChange={(v) => setDraft((d) => ({ ...d, description: v }))} textarea />
                  <EditSelect
                    label="Owning Class"
                    value={draft.classId ?? ''}
                    onChange={(v) => setDraft((d) => ({ ...d, classId: v }))}
                    options={[{ value: '', label: 'None' }, ...PRESET_CLASSES.map((c) => ({ value: c.id, label: c.name }))]}
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <EditText label="MP Cost" value={draft.mpCost ?? ''} onChange={(v) => setDraft((d) => ({ ...d, mpCost: v }))} />
                    <EditText label="ST Cost" value={draft.stCost ?? ''} onChange={(v) => setDraft((d) => ({ ...d, stCost: v }))} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <EditText label="Skill Type" value={draft.skillType ?? ''} onChange={(v) => setDraft((d) => ({ ...d, skillType: v }))} />
                    <EditText label="Tier" value={draft.tier ?? ''} onChange={(v) => setDraft((d) => ({ ...d, tier: v }))} />
                  </div>
                  <EditText label="Flavor Text" value={draft.flavorText ?? ''} onChange={(v) => setDraft((d) => ({ ...d, flavorText: v }))} textarea />
                  <DiscoveryEditor discovery={draft.discovery} onChange={(d) => setDraft((dr) => ({ ...dr, discovery: d }))} />
                </InkPanel>
              ) : isHidden(skills[entryId]) ? (
                <InkPanel className="p-4"><p className="font-narrative text-sm text-[#6b6152] italic">{skills[entryId].discovery?.teaser || 'Not yet discovered.'}</p></InkPanel>
              ) : (
                <InkPanel className="p-4 flex flex-col gap-3">
                  <ViewField label="Description" value={skills[entryId].description} />
                  <ViewField label="Owning Class" value={skills[entryId].classId ? PRESET_CLASSES.find((c) => c.id === skills[entryId].classId)?.name : undefined} />
                  <ViewField label="Cost" value={statBonusText(undefined) ?? ([skills[entryId].mpCost ? `${skills[entryId].mpCost} MP` : null, skills[entryId].stCost ? `${skills[entryId].stCost} ST` : null].filter(Boolean).join(' · ') || undefined)} />
                  <ViewField label="Type" value={skills[entryId].skillType} />
                  <ViewField label="Tier" value={skills[entryId].tier} />
                  <ViewField label="Flavor Text" value={skills[entryId].flavorText} />
                </InkPanel>
              )}
            </>
          )}

          {/* Items */}
          {category === 'items' && !entryId && (
            <div className="flex flex-col gap-2">
              <AddRow label="Add Item" onClick={() => startCreate({ name: '', type: 'material', qty: 1 })} />
              {Object.entries(inventory).filter(([id]) => {
                const item = items[id]
                return matchesQuery(item?.name ?? id.replace(/_/g, ' '), item?.description, item?.loreText)
              }).map(([id, qty]) => {
                const item = items[id]
                const equippedSlot = equippedSlotFor(id)
                return (
                  <EntryRow
                    key={id}
                    icon={Backpack}
                    title={item?.name ?? titleCaseId(id)}
                    subtitle={[item?.type, `x${qty}`, equippedSlot ? 'Equipped' : null].filter(Boolean).join(' · ')}
                    onClick={() => setEntryId(id)}
                  />
                )
              })}
              {Object.keys(inventory).length === 0 && <p className="font-narrative italic text-sm text-[#6b6152]">No items carried yet.</p>}
            </div>
          )}
          {category === 'items' && entryId && (editing || inventory[entryId] !== undefined) && (
            <>
              <div className="flex justify-end">
                <CrudBar
                  editing={editing}
                  canDelete={entryId !== NEW_ID}
                  onEdit={() => startEdit(entryId, { ...items[entryId], qty: inventory[entryId] })}
                  onSave={saveItem}
                  onCancel={cancelEdit}
                  onDelete={deleteItemEntry}
                />
              </div>
              {editing ? (
                <InkPanel className="p-4 flex flex-col gap-3">
                  <EditText label="Name" value={draft.name ?? ''} onChange={(v) => setDraft((d) => ({ ...d, name: v }))} />
                  <div className="grid grid-cols-2 gap-3">
                    <EditSelect label="Type" value={draft.type ?? 'material'} onChange={(v) => setDraft((d) => ({ ...d, type: v }))} options={(['weapon', 'armor', 'accessory', 'tool', 'key', 'consumable', 'material'] as ItemType[]).map((t) => ({ value: t, label: t }))} />
                    <EditNumber label="Quantity" value={draft.qty ?? 1} onChange={(v) => setDraft((d) => ({ ...d, qty: v }))} />
                  </div>
                  <EditText label="Description" value={draft.description ?? ''} onChange={(v) => setDraft((d) => ({ ...d, description: v }))} textarea />
                  {EQUIPPABLE_TYPES.includes(draft.type ?? 'material') && (
                    <div className="grid grid-cols-3 gap-3">
                      {STAT_BONUS_KEYS.map((k) => (
                        <EditText key={k} label={k} value={draft.statBonus?.[k] ?? ''} onChange={(v) => setDraft((d) => ({ ...d, statBonus: { ...d.statBonus, [k]: v } }))} />
                      ))}
                    </div>
                  )}
                  <EditText label="Rarity" value={draft.rarity ?? ''} onChange={(v) => setDraft((d) => ({ ...d, rarity: v }))} />
                  <EditText label="Lore Text" value={draft.loreText ?? ''} onChange={(v) => setDraft((d) => ({ ...d, loreText: v }))} textarea />
                  <EditText label="Value" value={draft.value ?? ''} onChange={(v) => setDraft((d) => ({ ...d, value: v }))} />
                  <EditTags value={draft.tags} onChange={(tags) => setDraft((d) => ({ ...d, tags }))} />
                </InkPanel>
              ) : (
                <InkPanel className="p-4 flex flex-col gap-3">
                  <ViewField label="Type" value={items[entryId]?.type} />
                  <ViewField label="Quantity" value={inventory[entryId]} />
                  <ViewField label="Description" value={items[entryId]?.description} />
                  <ViewField label="Stat Bonus" value={statBonusText(items[entryId]?.statBonus)} />
                  <ViewField label="Rarity" value={items[entryId]?.rarity} />
                  <ViewField label="Lore Text" value={items[entryId]?.loreText} />
                  <ViewField label="Value" value={items[entryId]?.value} />
                  {items[entryId]?.tags && items[entryId]!.tags!.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">{items[entryId]!.tags!.map((t) => <InkTagPill key={t}>{t}</InkTagPill>)}</div>
                  )}
                  {EQUIPPABLE_TYPES.includes(items[entryId]?.type ?? 'material') && (
                    equippedSlotFor(entryId) ? (
                      <InkButton tone="danger" onClick={() => onUnequipSlot(equippedSlotFor(entryId)!)}>Unequip</InkButton>
                    ) : (
                      <InkButton tone="action" onClick={() => onEquipItem(entryId)}>Equip</InkButton>
                    )
                  )}
                </InkPanel>
              )}
            </>
          )}

          {/* Corpses — read-only */}
          {category === 'corpses' && (
            <div className="flex flex-col gap-2">
              <p className="font-narrative text-xs text-[#6b6152]">Harvestable essence from the slain — extracted via <span className="font-mono">!arise</span>, most recently fallen first.</p>
              {corpseCounts.length === 0 ? (
                <p className="font-narrative italic text-sm text-[#6b6152]">No harvestable corpses yet — defeat an enemy first.</p>
              ) : (
                corpseCounts.map(([tag, qty]) => {
                  const beast = bestiary[slugify(tag)]
                  return (
                    <InkPanel key={tag} className="p-3 flex items-center justify-between">
                      <div>
                        <p className="font-display font-semibold text-sm text-[#2a241e]">{beast?.name ?? titleCaseId(tag)}</p>
                        {beast?.threatTier && <p className="font-narrative text-xs text-[#6b6152]">{beast.threatTier}</p>}
                      </div>
                      <span className="font-mono text-xs text-[#6b6152]">×{qty}</span>
                    </InkPanel>
                  )
                })
              )}
            </div>
          )}

          {/* Character — read-only + class evolution */}
          {category === 'character' && (
            <>
              <div className="flex justify-end">
                <CrudBar editing={editing} canDelete={false} onEdit={() => startEdit('__character__', { classId: player.classId })} onSave={async () => {
                  if (draft.classId && draft.classId !== player.classId) {
                    const target = PRESET_CLASSES.find((c) => c.id === draft.classId)
                    if (target && (await confirm(`Evolve into ${target.name}? Attribute points already earned keep their history — only points earned from here forward follow the new class.`))) {
                      onEvolveClass(draft.classId)
                    }
                  }
                  setEditing(false)
                  setDraft({})
                }} onCancel={cancelEdit} onDelete={() => {}} />
              </div>
              {editing ? (
                <InkPanel className="p-4 flex flex-col gap-3">
                  <EditSelect label="Class" value={draft.classId ?? player.classId} onChange={(v) => setDraft((d) => ({ ...d, classId: v }))} options={PRESET_CLASSES.map((c) => ({ value: c.id, label: c.name }))} />
                  <p className="font-narrative text-xs italic text-[#6b6152]">
                    Class Evolution — the class slot is replaced outright, no blending. Points already earned are never recalculated; only points earned from here forward follow the new class's growth.
                  </p>
                </InkPanel>
              ) : (
                <InkPanel className="p-4 flex flex-col gap-3">
                  <ViewField label="Class" value={player.className} />
                  <ViewField label="Level" value={String(player.level)} />
                  <ViewField label="Attributes" value={`STR ${Math.round(player.attrs.STR)} · INT ${Math.round(player.attrs.INT)} · AGI ${Math.round(player.attrs.AGI)}`} />
                  <ViewField label="Pools" value={`HP ${player.hpMax} · MP ${player.mpMax} · ST ${player.stMax}`} />
                  <ViewField label="Background" value={player.background} />
                  <ViewField label="Personality" value={player.personality} />
                  <ViewField label="Motivation" value={player.motivation} />
                  <ViewField label="Physical Trait" value={player.physicalTrait} />
                  <ViewField label="Secret" value={player.secret} />
                </InkPanel>
              )}
            </>
          )}

          {/* Crafting */}
          {category === 'crafting' && (
            <div className="flex flex-col gap-4">
              {crafting.length > 0 && (
                <div className="flex flex-col gap-2">
                  <p className={LABEL_CLASS}>In Progress</p>
                  {crafting.map((job) => {
                    const recipe = RECIPES.find((r) => r.id === job.recipeId)
                    const remaining = hoursRemaining(player.time, job.completeTime)
                    return (
                      <InkPanel key={job.jobId} className="px-3 py-2.5 flex items-center justify-between">
                        <span className="font-display font-semibold text-sm text-[#2a241e]">{recipe?.name ?? job.recipeId}</span>
                        <span className="inline-flex items-center gap-1 font-mono text-xs text-[#6b6152]">
                          <Clock size={12} /> {remaining > 0 ? `${remaining}h remaining` : 'Ready'}
                        </span>
                      </InkPanel>
                    )
                  })}
                </div>
              )}
              <div className="flex flex-col gap-2">
                <p className={LABEL_CLASS}>Recipes</p>
                {RECIPES.map((recipe) => {
                  const affordable = canAffordRecipe(inventory, recipe)
                  return (
                    <InkPanel key={recipe.id} className="p-3 flex flex-col gap-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="font-display font-bold text-sm text-[#2a241e]">{recipe.name}</h3>
                        <span className="inline-flex items-center gap-1 font-mono text-[10px] text-[#6b6152]"><Clock size={11} /> {recipe.craftHours}h</span>
                      </div>
                      {recipe.stationRequired && <p className="font-narrative text-[11px] text-[#6b6152]">Station: {recipe.stationRequired}</p>}
                      <p className="font-narrative text-xs text-[#6b6152]">
                        {recipe.ingredients.map((i) => `${i.qty}x ${i.id.replace(/_/g, ' ')} (${inventory[i.id] ?? 0} held)`).join(', ')}
                      </p>
                      <InkButton tone="action" disabled={!affordable} onClick={() => onStartCraft(recipe.id)} className="mt-1 self-start">
                        <Hammer size={13} /> Craft
                      </InkButton>
                    </InkPanel>
                  )
                })}
              </div>
            </div>
          )}

          {/* Realm */}
          {category === 'realm' && (
            <>
              <div className="flex justify-end">
                <CrudBar editing={editing} canDelete={false} onEdit={() => startEdit('__world__', {
                  name: world.name, genreTone: world.genreTone, conflict: world.conflict, background: world.background,
                  powerSystem: world.powerSystem, eraTechLevel: world.eraTechLevel, keyFactions: world.keyFactions,
                })} onSave={saveWorld} onCancel={cancelEdit} onDelete={() => {}} />
              </div>
              {editing ? (
                <InkPanel className="p-4 flex flex-col gap-3">
                  <EditText label="World Name" value={draft.name ?? ''} onChange={(v) => setDraft((d) => ({ ...d, name: v }))} />
                  <EditText label="Genre & Tone" value={draft.genreTone ?? ''} onChange={(v) => setDraft((d) => ({ ...d, genreTone: v }))} textarea />
                  <EditText label="Core Regional Conflict" value={draft.conflict ?? ''} onChange={(v) => setDraft((d) => ({ ...d, conflict: v }))} textarea />
                  <EditText label="Power System" value={draft.powerSystem ?? ''} onChange={(v) => setDraft((d) => ({ ...d, powerSystem: v }))} textarea />
                  <EditText label="Era / Tech Level" value={draft.eraTechLevel ?? ''} onChange={(v) => setDraft((d) => ({ ...d, eraTechLevel: v }))} />
                  <EditText label="Key Factions" value={draft.keyFactions ?? ''} onChange={(v) => setDraft((d) => ({ ...d, keyFactions: v }))} />
                  <EditText label="World Background" value={draft.background ?? ''} onChange={(v) => setDraft((d) => ({ ...d, background: v }))} textarea />
                </InkPanel>
              ) : (
                <InkPanel className="p-4 flex flex-col gap-3">
                  <ViewField label="World" value={world.name} />
                  <ViewField label="Genre & Tone" value={world.genreTone} />
                  <ViewField label="Core Regional Conflict" value={world.conflict} />
                  <ViewField label="Power System" value={world.powerSystem} />
                  <ViewField label="Era / Tech Level" value={world.eraTechLevel} />
                  <ViewField label="Key Factions" value={world.keyFactions} />
                  <ViewField label="World Background" value={world.background} />
                  <ViewField label="Narration Style" value={world.narrationStyle} />
                  {flags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">{flags.map((f) => <InkTagPill key={f}>{f}</InkTagPill>)}</div>
                  )}
                </InkPanel>
              )}
            </>
          )}

          {/* Chapters — read-only */}
          {category === 'chapters' && (
            <div className="flex flex-col gap-2">
              {chapters.length === 0 && <p className="font-narrative italic text-sm text-[#6b6152]">No chapters recorded yet.</p>}
              {chapters.map((c, i) => (
                <InkPanel key={i} className="p-4">
                  <h3 className="font-display font-bold text-sm text-[#2a241e] mb-1">Chapter {c.chapterNumber}</h3>
                  <p className="font-narrative text-sm italic text-[#6b6152]">{c.chapterSummary}</p>
                </InkPanel>
              ))}
            </div>
          )}
        </div>
      </div>

      {confirmDialog}
    </div>
  )
}
