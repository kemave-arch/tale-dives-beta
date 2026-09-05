import { useState } from 'react'
import {
  Bookmark,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Edit2,
  Eye,
  Heart,
  HelpCircle,
  Plus,
  PlusCircle,
  RotateCcw,
  Save,
  Search,
  Sparkles,
  Sword,
  Trash2,
  UserCircle,
  Wand2,
  Wind,
  X,
  Zap,
} from 'lucide-react'
import { PRESET_CLASSES } from '../data/classes.ts'
import {
  FIELD_CLASS,
  GLASS_SURFACE,
  GLASS_SURFACE_LIST,
  GlassButton,
  GlassCTAButton,
  GlassField,
  GlassHeader,
  GlassIconButton,
  GlassLongTextarea,
  GlassScreen,
  GlassTabs,
  SELECT_CLASS,
} from '../lib/glassChrome.tsx'
import { useConfirm } from '../lib/useConfirm.tsx'
import {
  MOTIVATION_EXAMPLES,
  OPENING_BRIEF_EXAMPLES,
  PERSONALITY_EXAMPLES,
  PHYSICAL_TRAIT_EXAMPLES,
  PROTAGONIST_BACKGROUND_EXAMPLES,
  SECRET_EXAMPLES,
} from '../data/formExamples.ts'
import type { Attributes, ProtagonistData, SkillEntry } from '../types.ts'
import { derivedPools } from '../lib/derivedStats.ts'
import { ProtagonistDetailModal } from '../components/PresetDetailModal.tsx'

interface NewGameProps {
  protagonistTemplates?: ProtagonistData[]
  initial?: ProtagonistData | null
  showBriefField?: boolean
  editLongText: (label: string, value: string, hint?: string, placeholder?: string) => Promise<string | null>
  onBack: () => void
  onBegin: (protagonist: ProtagonistData) => void
  onSavePreset?: (protagonist: ProtagonistData) => void
  onSaveAsNewPreset?: (protagonist: ProtagonistData) => void
  onDeletePreset?: (id: string) => void
}

const TABS = [
  { id: 'basics' as const, label: 'Identity', icon: UserCircle },
  { id: 'identity' as const, label: 'Origin', icon: Sparkles },
  { id: 'skills' as const, label: 'Skills', icon: Sword },
]

const TOTAL_ASSIGNABLE_POINTS = 12
const BASE_ATTR_VALUE = 10

function getInitialClassName(data?: ProtagonistData | null): string {
  if (!data) return PRESET_CLASSES[0].name
  if (data.className) return data.className
  const found = PRESET_CLASSES.find((c) => c.id === data.classId)
  if (found) return found.name
  if (data.classId) {
    return data.classId.includes('_')
      ? data.classId.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
      : data.classId
  }
  return PRESET_CLASSES[0].name
}

// Suggested starter skills by class archetype
const CLASS_STARTER_SKILLS: Record<string, SkillEntry[]> = {
  warrior: [
    { name: 'Power Strike', skillType: 'Active', tier: 'Novice', mpCost: 0, stCost: 8, description: 'A heavy martial strike with weapon force, dealing enhanced physical damage.' },
    { name: 'Shield Block', skillType: 'Martial', tier: 'Novice', mpCost: 0, stCost: 10, description: 'Brace behind shield or guard, mitigating incoming physical impact.' },
    { name: 'Battle Roar', skillType: 'Utility', tier: 'Novice', mpCost: 0, stCost: 12, description: 'Intimidating battle cry that bolsters resolve and rattles enemy focus.' },
  ],
  mage: [
    { name: 'Arcane Bolt', skillType: 'Spell', tier: 'Novice', mpCost: 8, stCost: 0, description: 'Channels raw arcane energy into a concentrated piercing projectile.' },
    { name: 'Mana Barrier', skillType: 'Spell', tier: 'Novice', mpCost: 14, stCost: 0, description: 'Erects a shimmering mana shield absorbing magical and physical harm.' },
    { name: 'Elemental Spark', skillType: 'Utility', tier: 'Novice', mpCost: 5, stCost: 0, description: 'Conjures small controllable elemental fire or light for utility and ignition.' },
  ],
  assassin: [
    { name: 'Shadow Step', skillType: 'Martial', tier: 'Novice', mpCost: 0, stCost: 10, description: 'Rapid, silent burst of movement through shadows to flank unaware targets.' },
    { name: 'Backstab', skillType: 'Active', tier: 'Novice', mpCost: 0, stCost: 14, description: 'High-damage precision strike exploiting weak points and blind spots.' },
    { name: 'Venom Coat', skillType: 'Utility', tier: 'Novice', mpCost: 4, stCost: 6, description: 'Coats blade in paralyzing or damaging venom for subsequent strikes.' },
  ],
  paladin: [
    { name: 'Holy Smite', skillType: 'Spell', tier: 'Novice', mpCost: 10, stCost: 8, description: 'Infuses weapon strike with righteous radiance to punish dark beings.' },
    { name: 'Divine Ward', skillType: 'Spell', tier: 'Novice', mpCost: 12, stCost: 0, description: 'Bestows protective sacred blessing upon self or a nearby ally.' },
    { name: 'Lay on Hands', skillType: 'Utility', tier: 'Novice', mpCost: 16, stCost: 0, description: 'Channels restoring divine energy to knit flesh and stabilize vitals.' },
  ],
  dragon_rider: [
    { name: 'Bond Channel', skillType: 'Active', tier: 'Novice', mpCost: 8, stCost: 6, description: 'Channels empathic dragon bond to enhance reflex and sensory clarity.' },
    { name: 'Dragon Dive', skillType: 'Martial', tier: 'Novice', mpCost: 0, stCost: 16, description: 'Leaping descent strike carrying immense kinetic velocity.' },
    { name: 'Searing Breath', skillType: 'Spell', tier: 'Novice', mpCost: 18, stCost: 0, description: 'Invokes dragon-fire embers across a forward cone.' },
  ],
  dark_monarch: [
    { name: 'Shadow Extraction', skillType: 'Active', tier: 'Innate', mpCost: 20, stCost: 0, description: 'Extracts mana and lingering will from defeated foes into shadowy thralls.' },
    { name: 'Monarch Step', skillType: 'Martial', tier: 'Novice', mpCost: 5, stCost: 10, description: 'Instantaneous stride across shadowy ground.' },
    { name: 'Dagger Flurry', skillType: 'Active', tier: 'Novice', mpCost: 0, stCost: 12, description: 'Rapid succession of dual-dagger thrusts and slashes.' },
  ],
  necromancer: [
    { name: 'Soul Drain', skillType: 'Spell', tier: 'Novice', mpCost: 12, stCost: 0, description: 'Siphons vitality from targets to replenish caster reserves.' },
    { name: 'Grave Chill', skillType: 'Spell', tier: 'Novice', mpCost: 8, stCost: 0, description: 'Releases numbing frost that slows enemy movement and reactions.' },
    { name: 'Bone Armor', skillType: 'Spell', tier: 'Novice', mpCost: 14, stCost: 0, description: 'Hardens calcified bone armor around body to blunt physical trauma.' },
  ],
}

export default function NewGame({
  protagonistTemplates = [],
  initial,
  showBriefField = false,
  editLongText,
  onBack,
  onBegin,
  onSavePreset,
  onSaveAsNewPreset,
  onDeletePreset,
}: NewGameProps) {
  const { confirm, dialog: confirmDialog } = useConfirm()

  // If initial is supplied (e.g. from library edit), open directly in editor; otherwise show the gateway
  const [viewMode, setViewMode] = useState<'gateway' | 'editor' | 'presets'>(() => (initial ? 'editor' : 'gateway'))
  const [mobileTab, setMobileTab] = useState<'basics' | 'identity' | 'skills'>('basics')

  // Core Identity State
  const [templateId, setTemplateId] = useState<string | null | undefined>(initial?.id ?? null)
  const [name, setName] = useState(initial?.name ?? '')
  const [gender, setGender] = useState(() => {
    if (!initial?.gender) return 'F'
    if (initial.gender === 'Female' || initial.gender === 'F') return 'F'
    if (initial.gender === 'Male' || initial.gender === 'M') return 'M'
    return initial.gender
  })
  const [age, setAge] = useState(initial?.age !== undefined ? String(initial.age) : '')
  const [classId, setClassId] = useState(initial?.classId ?? PRESET_CLASSES[0].id)
  const [customClassName, setCustomClassName] = useState(() => getInitialClassName(initial))
  const [background, setBackground] = useState(initial?.background ?? '')
  const [personality, setPersonality] = useState(initial?.personality ?? '')
  const [motivation, setMotivation] = useState(initial?.motivation ?? '')
  const [physicalTrait, setPhysicalTrait] = useState(initial?.physicalTrait ?? '')
  const [secret, setSecret] = useState(initial?.secret ?? '')
  const [opening, setOpening] = useState(initial?.opening ?? '')

  // Attribute Point Buy System (STR / INT / AGI)
  const [attrs, setAttrs] = useState<Attributes>(() => {
    if (initial?.customAttributes) return initial.customAttributes
    // Default starting distribution: base 10 + class weighted distribution
    const cls = PRESET_CLASSES.find((c) => c.id === initial?.classId) ?? PRESET_CLASSES[0]
    return {
      STR: Math.round(BASE_ATTR_VALUE + TOTAL_ASSIGNABLE_POINTS * cls.weights.STR),
      INT: Math.round(BASE_ATTR_VALUE + TOTAL_ASSIGNABLE_POINTS * cls.weights.INT),
      AGI: Math.round(BASE_ATTR_VALUE + TOTAL_ASSIGNABLE_POINTS * cls.weights.AGI),
    }
  })

  // Starting Skills CRUD State
  const [startingSkills, setStartingSkills] = useState<SkillEntry[]>(() => {
    if (initial?.startingSkills && initial.startingSkills.length > 0) return initial.startingSkills.slice(0, 3)
    const baseClassId = initial?.classId ?? 'warrior'
    return CLASS_STARTER_SKILLS[baseClassId] || CLASS_STARTER_SKILLS['warrior']
  })

  // Custom Class Modal State
  const [customModalOpen, setCustomModalOpen] = useState(false)
  const [customDraftName, setCustomDraftName] = useState('')
  const [customDraftArchetype, setCustomDraftArchetype] = useState(PRESET_CLASSES[0].id)

  // Skill Modal State
  const [skillModalOpen, setSkillModalOpen] = useState(false)
  const [editingSkillIdx, setEditingSkillIdx] = useState<number | null>(null)
  const [skillDraftName, setSkillDraftName] = useState('')
  const [skillDraftType, setSkillDraftType] = useState('Active')
  const [skillDraftTier, setSkillDraftTier] = useState('Novice')
  const [skillDraftMp, setSkillDraftMp] = useState(0)
  const [skillDraftSt, setSkillDraftSt] = useState(0)
  const [skillDraftDesc, setSkillDraftDesc] = useState('')

  // Special Key Item — one optional item name the protagonist brings into
  // the world; world seeding (not this form) fleshes it into a real ItemEntry.
  const [keyItem, setKeyItem] = useState(initial?.keyItem ?? '')

  // Tooltip / Popover state for stat explanations
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null)

  // Presets browser state
  const [presetSearch, setPresetSearch] = useState('')
  const [selectedPreset, setSelectedPreset] = useState<ProtagonistData | null>(null)
  const [selectedDeckId, setSelectedDeckId] = useState<string | null>(initial?.id ?? null)

  // Point math
  const spentPoints =
    Math.max(0, attrs.STR - BASE_ATTR_VALUE) +
    Math.max(0, attrs.INT - BASE_ATTR_VALUE) +
    Math.max(0, attrs.AGI - BASE_ATTR_VALUE)
  const unassignedPoints = Math.max(0, TOTAL_ASSIGNABLE_POINTS - spentPoints)

  // Live derived vitals
  const vitals = derivedPools(attrs)

  function modifyAttr(key: keyof Attributes, delta: number) {
    if (delta > 0 && unassignedPoints <= 0) return
    if (delta < 0 && attrs[key] <= BASE_ATTR_VALUE) return

    setAttrs((prev) => ({
      ...prev,
      [key]: Math.max(BASE_ATTR_VALUE, prev[key] + delta),
    }))
  }

  function autoDistributeForClass(targetClassId: string) {
    const cls = PRESET_CLASSES.find((c) => c.id === targetClassId) ?? PRESET_CLASSES[0]
    const strAdd = Math.round(TOTAL_ASSIGNABLE_POINTS * cls.weights.STR)
    const intAdd = Math.round(TOTAL_ASSIGNABLE_POINTS * cls.weights.INT)
    const agiAdd = TOTAL_ASSIGNABLE_POINTS - strAdd - intAdd

    setAttrs({
      STR: BASE_ATTR_VALUE + strAdd,
      INT: BASE_ATTR_VALUE + intAdd,
      AGI: BASE_ATTR_VALUE + Math.max(0, agiAdd),
    })
  }

  function resetAttributes() {
    setAttrs({
      STR: BASE_ATTR_VALUE,
      INT: BASE_ATTR_VALUE,
      AGI: BASE_ATTR_VALUE,
    })
  }

  const activePreset = PRESET_CLASSES.find((c) => c.id === classId)
  const isCustom = !activePreset || activePreset.name.toLowerCase() !== customClassName.trim().toLowerCase()

  function openCustomClassModal() {
    setCustomDraftName(isCustom ? customClassName : '')
    setCustomDraftArchetype(classId && PRESET_CLASSES.some((c) => c.id === classId) ? classId : PRESET_CLASSES[0].id)
    setCustomModalOpen(true)
  }

  function handleSelectClass(value: string) {
    if (value === 'custom') {
      openCustomClassModal()
    } else {
      const preset = PRESET_CLASSES.find((c) => c.id === value)
      if (preset) {
        setClassId(preset.id)
        setCustomClassName(preset.name)
        if (CLASS_STARTER_SKILLS[preset.id]) {
          setStartingSkills(CLASS_STARTER_SKILLS[preset.id])
        }
        autoDistributeForClass(preset.id)
      }
    }
  }

  function openAddSkill() {
    if (startingSkills.length >= 3) return
    setSkillDraftName('')
    setSkillDraftType('Active')
    setSkillDraftTier('Novice')
    setSkillDraftMp(0)
    setSkillDraftSt(10)
    setSkillDraftDesc('')
    setEditingSkillIdx(null)
    setSkillModalOpen(true)
  }

  function openEditSkill(index: number) {
    const s = startingSkills[index]
    if (!s) return
    setSkillDraftName(s.name)
    setSkillDraftType(s.skillType || 'Active')
    setSkillDraftTier(s.tier || 'Novice')
    setSkillDraftMp(s.mpCost ?? 0)
    setSkillDraftSt(s.stCost ?? 0)
    setSkillDraftDesc(s.description ?? '')
    setEditingSkillIdx(index)
    setSkillModalOpen(true)
  }

  function saveSkillDraft() {
    if (!skillDraftName.trim()) return
    const updated: SkillEntry = {
      name: skillDraftName.trim(),
      skillType: skillDraftType,
      tier: skillDraftTier,
      mpCost: Number(skillDraftMp) || 0,
      stCost: Number(skillDraftSt) || 0,
      description: skillDraftDesc.trim() || undefined,
    }

    if (editingSkillIdx !== null) {
      setStartingSkills(startingSkills.map((s, i) => (i === editingSkillIdx ? updated : s)))
    } else {
      setStartingSkills([...startingSkills, updated])
    }
    setSkillModalOpen(false)
    setEditingSkillIdx(null)
  }

  function deleteSkill(index: number) {
    setStartingSkills(startingSkills.filter((_, i) => i !== index))
  }

  function applyTemplate(t: ProtagonistData) {
    setTemplateId(t.id)
    setName(t.name)
    setGender(t.gender ?? '')
    setAge(t.age !== undefined ? String(t.age) : '')
    setClassId(t.classId)
    setCustomClassName(getInitialClassName(t))
    setBackground(t.background ?? '')
    setPersonality(t.personality ?? '')
    setMotivation(t.motivation ?? '')
    setPhysicalTrait(t.physicalTrait ?? '')
    setSecret(t.secret ?? '')
    setOpening(t.opening ?? '')
    setKeyItem(t.keyItem ?? '')

    if (t.customAttributes) {
      setAttrs(t.customAttributes)
    } else {
      autoDistributeForClass(t.classId)
    }

    if (t.startingSkills && t.startingSkills.length > 0) {
      setStartingSkills(t.startingSkills)
    } else if (CLASS_STARTER_SKILLS[t.classId]) {
      setStartingSkills(CLASS_STARTER_SKILLS[t.classId])
    }

    setViewMode('editor')
  }

  function startCleanProtagonist() {
    setTemplateId(null)
    setName('')
    setGender('')
    setAge('')
    setClassId(PRESET_CLASSES[0].id)
    setCustomClassName(PRESET_CLASSES[0].name)
    setBackground('')
    setPersonality('')
    setMotivation('')
    setPhysicalTrait('')
    setSecret('')
    setOpening('')
    setKeyItem('')
    resetAttributes()
    setStartingSkills((CLASS_STARTER_SKILLS['warrior'] || []).slice(0, 3))
    setViewMode('editor')
  }

  function currentData(): ProtagonistData {
    const matched = PRESET_CLASSES.find((c) => c.id === classId)
    const finalClassId = classId || 'warrior'
    const finalClassName = customClassName.trim() || (matched ? matched.name : 'Adventurer')

    return {
      id: templateId,
      name: name || 'The Wanderer',
      gender: gender.trim() || undefined,
      age: age.trim() ? Number(age) : undefined,
      classId: finalClassId,
      className: finalClassName,
      background,
      personality: personality.trim() || undefined,
      motivation: motivation.trim() || undefined,
      physicalTrait: physicalTrait.trim() || undefined,
      secret: secret.trim() || undefined,
      opening,
      customAttributes: attrs,
      startingSkills: startingSkills.length > 0 ? startingSkills : undefined,
      keyItem: keyItem.trim() || undefined,
    }
  }

  function getPresetTimestamp(item: { id?: string | null; savedAt?: number }): number {
    if (item.savedAt) return item.savedAt
    if (item.id) {
      const match = item.id.match(/_(\d{10,14})/)
      if (match) {
        const parsed = parseInt(match[1], 10)
        if (!isNaN(parsed) && parsed > 0) return parsed
      }
    }
    return 0
  }

  function formatSavedDate(ts: number): string {
    if (!ts) return 'Preset'
    const d = new Date(ts)
    if (isNaN(d.getTime())) return 'Preset'
    return d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  const q = presetSearch.trim().toLowerCase()
  const matchedTemplates = q
    ? protagonistTemplates.filter((t) => {
        const cName = t.className || PRESET_CLASSES.find((c) => c.id === t.classId)?.name || t.classId
        return (
          t.name.toLowerCase().includes(q) ||
          cName.toLowerCase().includes(q) ||
          (t.personality && t.personality.toLowerCase().includes(q)) ||
          (t.motivation && t.motivation.toLowerCase().includes(q))
        )
      })
    : protagonistTemplates

  const sortedTemplates = [...matchedTemplates].sort(
    (a, b) => getPresetTimestamp(b) - getPresetTimestamp(a),
  )

  // ================= GATEWAY SCREEN =================
  if (viewMode === 'gateway') {
    return (
      <GlassScreen ground="art" fill>
        <GlassHeader title="Protagonist Creation" subtitle="Step 3 — Shape who the tale follows" onBack={onBack} />

        <div className="flex-1 min-h-0 overflow-y-auto px-4 py-8 flex flex-col justify-center">
          <div className="max-w-xl mx-auto w-full flex flex-col gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* New Protagonist Card */}
              <button
                type="button"
                onClick={startCleanProtagonist}
                className="glass-panel glass-panel-hover rounded-2xl p-6 flex flex-col items-center gap-3 text-center group cursor-pointer transition-all border-[#e8ca8a]/40 hover:border-[#f0ca65] hover:shadow-[0_0_24px_rgba(240,202,101,0.2)]"
              >
                <div className="w-14 h-14 rounded-2xl border border-[#e8ca8a]/50 bg-[#e8ca8a]/10 flex items-center justify-center text-[#f0ca65] group-hover:scale-105 transition-transform">
                  <UserCircle size={28} />
                </div>
                <h3 className="font-display font-bold text-lg text-[#f5dfa0]">New Protagonist</h3>
                <p className="font-narrative text-xs sm:text-sm text-ink-muted leading-relaxed">
                  Forge an original hero from scratch — customize STR/INT/AGI attributes, derived vitals, and starting skills.
                </p>
                <span className="mt-2 font-display text-xs text-[#f0ca65] flex items-center gap-1">
                  Create Hero &rarr;
                </span>
              </button>

              {/* Load Preset Card */}
              <button
                type="button"
                onClick={() => setViewMode('presets')}
                className="glass-panel glass-panel-hover rounded-2xl p-6 flex flex-col items-center gap-3 text-center group cursor-pointer transition-all border-[#c084fc]/40 hover:border-[#c084fc] hover:shadow-[0_0_24px_rgba(192,132,252,0.25)]"
              >
                <div className="w-14 h-14 rounded-2xl border border-[#c084fc]/50 bg-[#c084fc]/10 flex items-center justify-center text-[#c084fc] group-hover:scale-105 transition-transform">
                  <Bookmark size={28} />
                </div>
                <h3 className="font-display font-bold text-lg text-[#f3e8ff]">Load Preset</h3>
                <p className="font-narrative text-xs sm:text-sm text-ink-muted leading-relaxed">
                  Select from master archetypes or saved character presets to jump right into the tale.
                </p>
                <span className="mt-2 font-display text-xs text-[#c084fc] flex items-center gap-1">
                  Browse Saved Heroes &rarr;
                </span>
              </button>
            </div>
          </div>
        </div>
      </GlassScreen>
    )
  }

  // ================= PRESETS BROWSER SCREEN =================
  if (viewMode === 'presets') {
    return (
      <GlassScreen ground="art" fill>
        <GlassHeader
          title="Protagonist Presets"
          subtitle="Select a saved character to load into your story"
          onBack={() => setViewMode(initial ? 'editor' : 'gateway')}
        />

        <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4">
          <div className="max-w-md md:max-w-2xl lg:max-w-4xl mx-auto flex flex-col gap-4">
            <div className="flex items-center justify-between gap-3">
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#e8ca8a]/50 pointer-events-none" />
                <input
                  value={presetSearch}
                  onChange={(e) => setPresetSearch(e.target.value)}
                  placeholder="Search saved Protagonists..."
                  className={`${FIELD_CLASS} pl-8.5 pr-8`}
                />
                {presetSearch && (
                  <button
                    type="button"
                    onClick={() => setPresetSearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#e8ca8a]/50 hover:text-[#f5dfa0]"
                    aria-label="Clear search"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>
              <GlassButton onClick={startCleanProtagonist} icon={Sparkles} tone="action">
                New Blank Hero
              </GlassButton>
            </div>

            {protagonistTemplates.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[#e8ca8a]/30 p-8 text-center bg-[#07050c]/40">
                <p className="font-narrative italic text-sm text-[#e8ca8a]/80 mb-1">No saved Protagonists yet.</p>
                <p className="font-narrative text-xs text-[#e8ca8a]/60">
                  Configure your character, then click &ldquo;Save as New Preset&rdquo; to store them in your library.
                </p>
                <div className="mt-4">
                  <GlassButton onClick={startCleanProtagonist} tone="action">
                    Start Blank Hero
                  </GlassButton>
                </div>
              </div>
            ) : sortedTemplates.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[#e8ca8a]/30 p-6 text-center bg-[#07050c]/40">
                <p className="font-narrative italic text-xs text-[#e8ca8a]/70">
                  No saved protagonists match &ldquo;{presetSearch}&rdquo;
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <p className="font-narrative italic text-xs text-[#d8c49e]">
                  Select a protagonist card and confirm to load their identity, attributes, and starting skills.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {sortedTemplates.map((t) => {
                    const isCurrent = templateId === t.id
                    const isSelected = selectedDeckId === t.id
                    const ts = getPresetTimestamp(t)
                    const cName = t.className || PRESET_CLASSES.find((c) => c.id === t.classId)?.name || t.classId
                    const details = [t.gender, t.age !== undefined ? `Age ${t.age}` : null].filter(Boolean).join(' • ')

                    return (
                      <div
                        key={t.id ?? t.name}
                        onClick={() => setSelectedDeckId(t.id ?? null)}
                        className={`${GLASS_SURFACE_LIST} rounded-xl p-3.5 flex flex-col gap-2 transition-all duration-150 cursor-pointer ${
                          isSelected
                            ? 'bg-[#23123a]/95 border-[#c084fc] shadow-[0_0_16px_rgba(192,132,252,0.25)] ring-1 ring-[#c084fc]/60'
                            : isCurrent
                              ? 'bg-[#190d29]/85 border-[#c084fc]/60 hover:border-[#c084fc]/90 hover:bg-[#23123a]/90'
                              : 'bg-[#190d29]/80 border-[#c084fc]/35 hover:border-[#c084fc]/75 hover:bg-[#23123a]/90'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <div
                              className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 transition-colors ${
                                isSelected
                                  ? 'border-[#c084fc] bg-[#c084fc] text-[#190d29]'
                                  : 'border-[#c084fc]/50 bg-transparent text-transparent'
                              }`}
                            >
                              <Check size={11} strokeWidth={3} />
                            </div>
                            <UserCircle size={16} className="text-[#c084fc] shrink-0" />
                            <h3 className="font-display font-bold text-sm text-[#f3e8ff] truncate">{t.name}</h3>
                            <div className="flex items-center gap-1 shrink-0 flex-wrap">
                              {isCurrent && (
                                <span className="rounded bg-[#c084fc]/25 text-[#d8b4fe] border border-[#c084fc]/40 px-1.5 py-0.2 text-[9px] font-mono font-normal">
                                  active
                                </span>
                              )}
                              {t.isMaster && (
                                <span className="rounded bg-[#f0ca65]/20 text-[#f5dfa0] border border-[#f0ca65]/35 px-1.5 py-0.2 text-[9px] font-mono font-normal uppercase tracking-wider">
                                  Master
                                </span>
                              )}
                              {t.isDefault && (
                                <span className="rounded bg-[#c084fc]/15 text-[#e9d5ff] border border-[#c084fc]/30 px-1.5 py-0.2 text-[9px] font-mono font-normal">
                                  default
                                </span>
                              )}
                              <span className="rounded px-1.5 py-0.2 text-[9px] font-mono font-normal uppercase tracking-wider bg-[#a855f7]/20 text-[#f3e8ff] border border-[#c084fc]/35">
                                {cName}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={() => setSelectedPreset(t)}
                              className="flex items-center gap-1 text-[11px] font-display text-[#d8b4fe] hover:text-white px-2 py-1 rounded-lg border border-[#c084fc]/30 bg-[#c084fc]/10 hover:bg-[#c084fc]/25 transition-colors"
                            >
                              <Eye size={12} /> Inspect
                            </button>
                          </div>
                        </div>

                        {details && <p className="font-sans italic text-[13px] text-[#e9d5ff]/85">{details}</p>}

                        {(t.personality || t.motivation || t.physicalTrait) && (
                          <p className="font-sans text-[13px] text-[#f3e8ff]/85 line-clamp-2 leading-relaxed">
                            {t.personality || t.motivation || t.physicalTrait}
                          </p>
                        )}

                        {t.background && (
                          <p className="font-sans text-[13px] text-[#d8b4fe]/75 line-clamp-1">{t.background}</p>
                        )}

                        <div className="flex items-center justify-between pt-1.5 border-t border-[#c084fc]/15 text-[10px] font-mono text-[#d8b4fe]/70">
                          <span>{t.secret ? 'Secret Defined' : 'Open Archetype'}</span>
                          <span>{formatSavedDate(ts)}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Confirm & Load Button */}
                {(() => {
                  const chosen =
                    sortedTemplates.find((t) => t.id === selectedDeckId) ||
                    (sortedTemplates.length > 0 ? sortedTemplates[0] : null)
                  return chosen ? (
                    <div className="pt-2 sticky bottom-0 z-10 bg-gradient-to-t from-[#190d29] via-[#190d29]/90 to-transparent pb-1">
                      <button
                        type="button"
                        onClick={() => applyTemplate(chosen)}
                        className="w-full py-3 px-4 rounded-xl border border-[#c084fc]/80 bg-[#c084fc]/20 hover:bg-[#c084fc]/35 text-[#f3e8ff] hover:text-white font-display font-bold text-xs uppercase tracking-wider shadow-[0_0_18px_rgba(192,132,252,0.3)] transition-all flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <CheckCircle2 size={16} className="text-[#c084fc]" />
                        Confirm &amp; Load &ldquo;{chosen.name}&rdquo;
                      </button>
                    </div>
                  ) : null
                })()}
              </div>
            )}

            {selectedPreset && (
              <ProtagonistDetailModal
                protagonist={selectedPreset}
                isDefault={selectedPreset.isDefault}
                onClose={() => setSelectedPreset(null)}
                onLoad={() => applyTemplate(selectedPreset)}
                loadLabel="Load Protagonist"
                onDelete={onDeletePreset ? async () => {
                  if (await confirm('Delete this Protagonist preset?')) {
                    if (selectedPreset.id) onDeletePreset(selectedPreset.id)
                    setSelectedPreset(null)
                  }
                } : undefined}
              />
            )}
          </div>
        </div>
      </GlassScreen>
    )
  }

  // ================= MAIN EDITOR VIEW =================
  const basicsFields = (
    <div className="flex flex-col gap-4">
      <div className="flex gap-3 items-end">
        <div className="flex-1 min-w-0">
          <GlassField label="Name" hint="Protagonist's full name">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Katherine Vance..."
              className={FIELD_CLASS}
            />
          </GlassField>
        </div>
        <div className="w-20 shrink-0">
          <GlassField label="Age" hint="">
            <input
              type="number"
              min="0"
              max="999"
              value={age}
              onChange={(e) => setAge(e.target.value)}
              placeholder="24"
              className={FIELD_CLASS}
            />
          </GlassField>
        </div>
      </div>

      <div className="flex gap-3 items-end">
        <div className="flex-1 min-w-0">
          <GlassField label="Archetype / Class" hint="Choose a class preset or Custom Class">
            <div className="flex gap-2">
              <select
                value={isCustom ? 'custom' : classId}
                onChange={(e) => handleSelectClass(e.target.value)}
                className={SELECT_CLASS + " cursor-pointer flex-1"}
              >
                {PRESET_CLASSES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
                <option value="custom">
                  {isCustom && customClassName.trim() ? `Custom (${customClassName.trim()})` : 'Custom Class...'}
                </option>
              </select>
              {isCustom && (
                <button
                  type="button"
                  onClick={openCustomClassModal}
                  className="px-2.5 py-1.5 rounded-lg border border-[#e8ca8a]/30 bg-[#e8ca8a]/10 hover:bg-[#e8ca8a]/20 text-[#f5dfa0] text-xs font-display flex items-center gap-1 shrink-0"
                  title="Edit Custom Class"
                >
                  <Edit2 size={13} />
                  <span>Edit</span>
                </button>
              )}
            </div>
          </GlassField>
        </div>
        <div className="w-20 shrink-0">
          <GlassField label="Gender" hint="">
            <select
              value={gender || 'N/A'}
              onChange={(e) => setGender(e.target.value === 'N/A' ? '' : e.target.value)}
              className={FIELD_CLASS + " appearance-none cursor-pointer"}
              style={{ backgroundImage: 'none' }}
            >
              <option value="N/A">N/A</option>
              <option value="M">M</option>
              <option value="F">F</option>
            </select>
          </GlassField>
        </div>
      </div>

      {/* Main Attributes Point Buy Block */}
      <div className="flex flex-col gap-3 rounded-xl p-3.5 border border-[#e8ca8a]/25 bg-[#07050c]/50">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <Zap size={15} className="text-[#f0ca65]" />
            <span className="font-display font-bold text-xs uppercase tracking-wider text-[#f5dfa0]">
              Attributes
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`font-mono text-[10px] px-2 py-0.5 rounded border font-normal ${
                unassignedPoints > 0
                  ? 'bg-[#f0ca65]/20 text-[#f5dfa0] border-[#f0ca65]/40 animate-pulse'
                  : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
              }`}
            >
              {unassignedPoints > 0 ? `${unassignedPoints} Pts Available` : 'All Assigned'}
            </span>
            <button
              type="button"
              onClick={() => autoDistributeForClass(classId)}
              className="p-1 text-[#e8ca8a]/60 hover:text-[#f5dfa0] rounded hover:bg-white/5 cursor-pointer"
              title="Auto-Distribute for Class"
            >
              <RotateCcw size={16} />
            </button>
          </div>
        </div>

        {/* Compact Attribute Stepper Controls */}
        <div className="grid grid-cols-3 gap-2">
          {(['STR', 'INT', 'AGI'] as const).map((attr) => (
            <div key={attr} className="flex flex-col items-center gap-2 p-2 rounded-lg border border-[#e8ca8a]/15 bg-[#120e1b]/70">
              <div className="flex items-center gap-1">
                <span className="font-display font-bold text-xs text-[#f5dfa0]">{attr}</span>
                <button
                  type="button"
                  onClick={() => setActiveTooltip(activeTooltip === attr ? null : attr)}
                  className="text-[#e8ca8a]/40 hover:text-[#f5dfa0] cursor-pointer"
                >
                  <HelpCircle size={10} />
                </button>
              </div>
              
              <div className="flex items-center gap-2">
                <div className="flex flex-col items-center">
                  <span className="font-mono font-bold text-lg text-[#f0ca65] leading-none">{attrs[attr]}</span>
                  
                </div>
                <div className="flex flex-col gap-1">
                  <button
                    type="button"
                    disabled={unassignedPoints <= 0}
                    onClick={() => modifyAttr(attr, 1)}
                    className="w-6 h-5 rounded bg-[#f0ca65]/20 hover:bg-[#f0ca65]/35 border border-[#f0ca65]/40 flex items-center justify-center text-[#f0ca65] disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                  >
                    <ChevronUp size={14} />
                  </button>
                  <button
                    type="button"
                    disabled={attrs[attr] <= BASE_ATTR_VALUE}
                    onClick={() => modifyAttr(attr, -1)}
                    className="w-6 h-5 rounded bg-[#e8ca8a]/10 hover:bg-[#e8ca8a]/25 border border-[#e8ca8a]/30 flex items-center justify-center text-[#f5dfa0] disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                  >
                    <ChevronDown size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Active Tooltip explanation banner */}
        {activeTooltip && (
          <div className="p-2.5 rounded-lg border border-[#f0ca65]/30 bg-[#190d29]/90 text-[11px] font-narrative text-[#f5dfa0] flex items-start justify-between gap-2">
            <div>
              {activeTooltip === 'STR' && (
                <p>
                  <strong>Strength (STR):</strong> Governs raw physical power, weapon damage, and carry capacity. Directly increases Health pool (+2.5 HP / STR point).
                </p>
              )}
              {activeTooltip === 'INT' && (
                <p>
                  <strong>Intelligence (INT):</strong> Governs spell potency, magical affinity, and arcane knowledge. Directly increases Mana pool (+2.0 MP / INT point).
                </p>
              )}
              {activeTooltip === 'AGI' && (
                <p>
                  <strong>Agility (AGI):</strong> Governs speed, reflexes, stealth, and evasion. Directly increases Stamina pool (+1.5 ST / AGI point).
                </p>
              )}
              {activeTooltip === 'VITALS' && (
                <p>
                  <strong>Derived Vitals:</strong> Calculated using the universal engine formulas (HP = 20 + 2.5×STR, MP = 10 + 2×INT, ST = 15 + 1×STR + 1.5×AGI).
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => setActiveTooltip(null)}
              className="text-[#e8ca8a]/50 hover:text-white shrink-0"
            >
              <X size={12} />
            </button>
          </div>
        )}

        {/* Derived Vitals Live Preview */}
        <div className="pt-2 border-t border-[#e8ca8a]/15 flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase tracking-wider text-[#e8ca8a]/70 flex items-center gap-1">
              Derived Vitals Preview
              <button
                type="button"
                onClick={() => setActiveTooltip(activeTooltip === 'VITALS' ? null : 'VITALS')}
                className="text-[#e8ca8a]/50 hover:text-[#f5dfa0]"
              >
                <HelpCircle size={10} />
              </button>
            </span>
            <span className="font-mono text-[10px] text-[#e8ca8a]/50">Shadow Referee Validated</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="flex items-center gap-2 p-2 rounded-lg bg-rose-950/30 border border-rose-500/30">
              <Heart size={14} className="text-rose-400 shrink-0" />
              <div className="min-w-0">
                <span className="block font-mono text-[9px] uppercase tracking-wider text-rose-300/80">HP Max</span>
                <span className="font-mono font-bold text-sm text-rose-200">{vitals.hpMax}</span>
              </div>
            </div>
            <div className="flex items-center gap-2 p-2 rounded-lg bg-sky-950/30 border border-sky-500/30">
              <Wand2 size={14} className="text-sky-400 shrink-0" />
              <div className="min-w-0">
                <span className="block font-mono text-[9px] uppercase tracking-wider text-sky-300/80">MP Max</span>
                <span className="font-mono font-bold text-sm text-sky-200">{vitals.mpMax}</span>
              </div>
            </div>
            <div className="flex items-center gap-2 p-2 rounded-lg bg-emerald-950/30 border border-emerald-500/30">
              <Wind size={14} className="text-emerald-400 shrink-0" />
              <div className="min-w-0">
                <span className="block font-mono text-[9px] uppercase tracking-wider text-emerald-300/80">ST Max</span>
                <span className="font-mono font-bold text-sm text-emerald-200">{vitals.stMax}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  const identityFields = (
    <div className="flex flex-col gap-4">
      <GlassField
        label="Origin Story"
        examples={PROTAGONIST_BACKGROUND_EXAMPLES}
        onPickExample={(val) => setBackground(val)}
      >
        <GlassLongTextarea
          value={background}
          onOpenModal={async () => {
            const result = await editLongText(
              'Origin Story',
              background,
              'Origin, upbringing, lineage, and history the Narrator should know from Turn 1.',
              'e.g. Veteran frontline sellsword, elite dragon rider academy cadet, disgraced noble scion, or street-smart undercity rogue...',
            )
            if (result !== null) setBackground(result)
          }}
          placeholder="e.g. Veteran frontline sellsword, elite dragon rider academy cadet, disgraced noble scion, or street-smart undercity rogue..."
          rows={3}
        />
      </GlassField>

      <GlassField
        label="Personality"
        hint="Demeanor & behavioral traits"
        examples={PERSONALITY_EXAMPLES}
        onPickExample={(val) => setPersonality(val)}
      >
        <input
          value={personality}
          onChange={(e) => setPersonality(e.target.value)}
          placeholder="e.g. Calculating and disciplined, guarded with strangers, wry sense of humor under pressure"
          className={FIELD_CLASS}
        />
      </GlassField>

      <GlassField
        label="Motivation"
        hint="Core driving ambition"
        examples={MOTIVATION_EXAMPLES}
        onPickExample={(val) => setMotivation(val)}
      >
        <input
          value={motivation}
          onChange={(e) => setMotivation(e.target.value)}
          placeholder="e.g. Protect a younger sibling, reach the pinnacle of sword mastery, earn absolute freedom"
          className={FIELD_CLASS}
        />
      </GlassField>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <GlassField
          label="Physical Trait"
          hint="Appearance or condition"
          examples={PHYSICAL_TRAIT_EXAMPLES}
          onPickExample={(val) => setPhysicalTrait(val)}
        >
          <input
            value={physicalTrait}
            onChange={(e) => setPhysicalTrait(e.target.value)}
            placeholder="e.g. Piercing heterochromia eyes, duel scars across face"
            className={FIELD_CLASS}
          />
        </GlassField>

        <GlassField
          label="Secret"
          hint="Concealed narrative truth"
          examples={SECRET_EXAMPLES}
          onPickExample={(val) => setSecret(val)}
        >
          <input
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            placeholder="e.g. Harbors a forbidden seal, secretly a lost royal heir"
            className={FIELD_CLASS}
          />
        </GlassField>
      </div>

      {showBriefField && (
        <GlassField
          label="Tale Dive Brief"
          hint="Opening scene description — optional"
          examples={OPENING_BRIEF_EXAMPLES}
          onPickExample={(val) => setOpening(val)}
        >
          <GlassLongTextarea
            value={opening}
            onOpenModal={async () => {
              const result = await editLongText(
                'Tale Dive Brief',
                opening,
                'Describe the exact scene, location, immediate crisis, and characters present where Turn 1 should open.',
                'e.g. Standing on the rain-slicked deck of an airship as alarms blare and harpoons strike the hull...',
              )
              if (result !== null) setOpening(result)
            }}
            placeholder="e.g. Standing on the rain-slicked deck of an airship as alarms blare and harpoons strike the hull..."
            rows={3}
          />
        </GlassField>
      )}
    </div>
  )

  const skillsFields = (
    <div className="flex flex-col gap-4">
      {/* Starting Skills Fast CRUD Table */}
      <div className="flex flex-col gap-2 rounded-xl p-3.5 border border-[#e8ca8a]/25 bg-[#07050c]/50">
        <div className="flex items-center justify-between gap-2">
          <span className="font-narrative text-xs text-[#e8ca8a]/80">
            Initial abilities in your Codex ({startingSkills.length}/3).
          </span>
          <div className="flex items-center gap-3">
            {CLASS_STARTER_SKILLS[classId] && (
              <button
                type="button"
                onClick={() => setStartingSkills((CLASS_STARTER_SKILLS[classId] || []).slice(0, 3))}
                className="font-mono text-[10px] text-[#f0ca65] hover:underline"
              >
                Suggest for {customClassName}
              </button>
            )}
            <button
              type="button"
              disabled={startingSkills.length >= 3}
              onClick={openAddSkill}
              className="flex items-center gap-1 text-[11px] font-display text-[#f0ca65] hover:text-white px-2.5 py-1 rounded-lg border border-[#f0ca65]/35 bg-[#f0ca65]/10 hover:bg-[#f0ca65]/25 transition-colors disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
            >
              <PlusCircle size={12} /> Add Ability
            </button>
          </div>
        </div>

        <p className="font-narrative italic text-[11px] text-[#e8ca8a]/60 leading-relaxed">
          Optional — and every skill you start with is one the world already expects of you.
          Great power invites great responsibility: stronger starting skills mean tougher
          opposition and higher stakes from Turn 1, not a free advantage.
        </p>

        {startingSkills.length === 0 ? (
          <div className="rounded-lg border border-dashed border-[#e8ca8a]/20 p-4 text-center">
            <p className="font-narrative italic text-xs text-[#e8ca8a]/70">
              No starting skills selected. Tap &ldquo;Suggest for {customClassName}&rdquo; or &ldquo;Add Ability&rdquo; to customize.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {startingSkills.map((s, idx) => (
              <div
                key={s.name + idx}
                className="flex items-start justify-between gap-2.5 p-2.5 rounded-lg border border-[#e8ca8a]/20 bg-[#120e1b]/70 hover:border-[#e8ca8a]/40 transition-colors"
              >
                <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-display font-bold text-xs text-[#f5dfa0] truncate">{s.name}</span>
                    <span className="text-[9px] font-mono px-1.5 py-0.2 rounded border bg-[#e8ca8a]/10 text-[#f5dfa0] border-[#e8ca8a]/25 font-normal uppercase">
                      {s.skillType || 'Active'}
                    </span>
                    {(s.mpCost ?? 0) > 0 && (
                      <span className="text-[9px] font-mono px-1.5 py-0.2 rounded border bg-sky-500/15 text-sky-300 border-sky-500/30">
                        {s.mpCost} MP
                      </span>
                    )}
                    {(s.stCost ?? 0) > 0 && (
                      <span className="text-[9px] font-mono px-1.5 py-0.2 rounded border bg-emerald-500/15 text-emerald-300 border-emerald-500/30">
                        {s.stCost} ST
                      </span>
                    )}
                  </div>
                  {s.description && (
                    <p className="font-narrative text-[11px] text-ink-muted line-clamp-2 leading-relaxed mt-0.5">
                      {s.description}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => openEditSkill(idx)}
                    className="p-1 rounded text-[#e8ca8a]/70 hover:text-[#f5dfa0] hover:bg-white/5"
                    title="Edit Ability"
                  >
                    <Edit2 size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteSkill(idx)}
                    className="p-1 rounded text-rose-400/70 hover:text-rose-300 hover:bg-rose-500/10"
                    title="Delete Ability"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-1.5 rounded-xl p-3.5 border border-[#e8ca8a]/25 bg-[#07050c]/50">
        <span className="font-narrative text-xs text-[#e8ca8a]/80">Special Key Item (optional)</span>
        <input
          type="text"
          value={keyItem}
          onChange={(e) => setKeyItem(e.target.value)}
          placeholder="e.g. a late brother's signet ring, a cracked mana core, a family blade"
          className={FIELD_CLASS}
        />
        <p className="font-narrative italic text-[11px] text-[#e8ca8a]/60 leading-relaxed">
          One item the protagonist brings into the world — a keepsake, a weapon, a strange
          artifact. Just name it; the world seeding pass fleshes out its full description.
        </p>
      </div>

      {(onSavePreset || onSaveAsNewPreset) && (
        <div className="flex gap-2 mt-2 pt-4 border-t border-[#e8ca8a]/15">
          {templateId && onSavePreset && (
            <GlassButton
              onClick={async () => {
                const ok = await confirm('Save changes to this Protagonist preset?')
                if (ok) onSavePreset(currentData())
              }}
              icon={Save}
              className="flex-1"
            >
              Save Preset
            </GlassButton>
          )}
          {onSaveAsNewPreset && (
            <GlassButton
              onClick={async () => {
                const ok = await confirm('Save current hero as a new Protagonist preset?')
                if (ok) onSaveAsNewPreset({ ...currentData(), id: null })
              }}
              icon={Plus}
              className="flex-1"
            >
              Save as New Preset
            </GlassButton>
          )}
        </div>
      )}
    </div>
  )

  return (
    <GlassScreen ground="art" fill>
      <GlassHeader
        title="Protagonist Setup"
        subtitle="Step 3 — Forge the hero who anchors the story"
        onBack={() => {
          if (!initial) setViewMode('gateway')
          else onBack()
        }}
        right={<GlassIconButton icon={Bookmark} label="Load Preset" onClick={() => setViewMode('presets')} />}
      />

      {/* Mobile subtabs (< lg) outside scroll area */}
      <div className="lg:hidden px-4 pb-2 shrink-0">
        <div className="max-w-md mx-auto">
          <GlassTabs
            tabs={TABS}
            value={mobileTab}
            onChange={(id) => setMobileTab(id as 'basics' | 'identity' | 'skills')}
            className="w-full"
          />
        </div>
      </div>

      {/* Main Form Body */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-4 lg:py-4">
        <div className="max-w-md md:max-w-3xl lg:max-w-6xl mx-auto flex flex-col gap-5">
          {/* Mobile subtabs (< lg) */}
          <div className="lg:hidden">
            {mobileTab === 'basics' && basicsFields}
            {mobileTab === 'identity' && identityFields}
            {mobileTab === 'skills' && skillsFields}
          </div>

          {/* PC Multi-Column Layout (>= lg) */}
          <div className="hidden lg:grid lg:grid-cols-2 gap-8 relative items-start">
            {/* Column 1: Basics & Attributes */}
            <div className="pr-4">{basicsFields}</div>

            {/* Vertical Ornate Center Divider */}
            <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-px bg-gradient-to-b from-transparent via-[#e8ca8a]/30 to-transparent pointer-events-none" />

            {/* Column 2: Identity & Starting Skills */}
            <div className="pl-4 flex flex-col gap-6">
              {identityFields}
              <div className="pt-2 border-t border-[#e8ca8a]/15">{skillsFields}</div>
            </div>
          </div>


        </div>
      </div>

      {/* Fixed Sticky Action Footer */}
      <div
        className={`shrink-0 ${GLASS_SURFACE} border-x-0 border-b-0 bg-[#07050c]/60 px-4 py-2 flex justify-center`}
        style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
      >
        <div className="w-full max-w-md md:max-w-3xl lg:max-w-6xl flex justify-center">
          <GlassCTAButton onClick={() => onBegin(currentData())}>Continue</GlassCTAButton>
        </div>
      </div>

      {/* Custom Class Setup Modal */}
      {customModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          onClick={() => setCustomModalOpen(false)}
        >
          <div
            className={`${GLASS_SURFACE} rounded-2xl w-full max-w-md flex flex-col p-5 shadow-2xl bg-[#120e1b]/95 border-[#f0ca65]/40`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#e8ca8a]/20">
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-[#f0ca65]" />
                <h3 className="font-display font-semibold text-sm uppercase tracking-[0.12em] text-[#fae5b5]">
                  Custom Class Setup
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setCustomModalOpen(false)}
                className="p-1 rounded-full text-[#e8ca8a]/60 hover:text-[#f5dfa0] hover:bg-white/10 transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex flex-col gap-4 py-4">
              <GlassField label="Custom Class Name" hint="e.g. Shadow Assassin, Star Knight">
                <input
                  autoFocus
                  type="text"
                  value={customDraftName}
                  onChange={(e) => setCustomDraftName(e.target.value)}
                  placeholder="e.g. Shadow Assassin, Spellblade, Star Knight..."
                  className={FIELD_CLASS}
                />
              </GlassField>

              <GlassField label="Base Archetype (Stat Curve)" hint="Select base archetype for vitals & attribute growth">
                <select
                  value={customDraftArchetype}
                  onChange={(e) => setCustomDraftArchetype(e.target.value)}
                  className={SELECT_CLASS}
                >
                  {PRESET_CLASSES.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </GlassField>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#e8ca8a]/20">
              <GlassButton onClick={() => setCustomModalOpen(false)}>Cancel</GlassButton>
              <GlassButton
                tone="action"
                onClick={() => {
                  const finalName = customDraftName.trim() || 'Custom Hero'
                  const archetypeId = customDraftArchetype
                  setCustomClassName(finalName)
                  setClassId(archetypeId)
                  autoDistributeForClass(archetypeId)
                  if (CLASS_STARTER_SKILLS[archetypeId]) {
                    setStartingSkills(CLASS_STARTER_SKILLS[archetypeId])
                  }
                  setCustomModalOpen(false)
                }}
              >
                Save Custom Class
              </GlassButton>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Skill Modal */}
      {skillModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setSkillModalOpen(false)}
        >
          <div
            className={`${GLASS_SURFACE} rounded-2xl w-full max-w-md flex flex-col p-5 shadow-2xl bg-[#120e1b]/95 border-[#f0ca65]/40`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#e8ca8a]/20">
              <h4 className="font-display font-bold text-base text-[#f5dfa0]">
                {editingSkillIdx !== null ? 'Edit Starting Ability' : 'Add Starting Ability'}
              </h4>
              <button
                type="button"
                onClick={() => setSkillModalOpen(false)}
                className="text-[#e8ca8a]/60 hover:text-white p-1"
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex flex-col gap-3.5 py-4">
              <GlassField label="Ability Name *" hint="e.g. Flame Dart, Shield Bash">
                <input
                  autoFocus
                  value={skillDraftName}
                  onChange={(e) => setSkillDraftName(e.target.value)}
                  placeholder="e.g. Power Strike, Shadow Step, Arcane Bolt"
                  className={FIELD_CLASS}
                />
              </GlassField>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <GlassField label="Type">
                  <select
                    value={skillDraftType}
                    onChange={(e) => setSkillDraftType(e.target.value)}
                    className={SELECT_CLASS}
                  >
                    <option value="Active">Active</option>
                    <option value="Martial">Martial</option>
                    <option value="Spell">Spell</option>
                    <option value="Passive">Passive</option>
                    <option value="Utility">Utility</option>
                  </select>
                </GlassField>

                <GlassField label="Tier">
                  <select
                    value={skillDraftTier}
                    onChange={(e) => setSkillDraftTier(e.target.value)}
                    className={SELECT_CLASS}
                  >
                    <option value="Novice">Novice</option>
                    <option value="Adept">Adept</option>
                    <option value="Innate">Innate</option>
                    <option value="Master">Master</option>
                  </select>
                </GlassField>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <GlassField label="MP Cost" hint="0 for martial skills">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={skillDraftMp}
                    onChange={(e) => setSkillDraftMp(Number(e.target.value))}
                    className={FIELD_CLASS}
                  />
                </GlassField>

                <GlassField label="ST Cost" hint="0 for pure spells">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={skillDraftSt}
                    onChange={(e) => setSkillDraftSt(Number(e.target.value))}
                    className={FIELD_CLASS}
                  />
                </GlassField>
              </div>

              <GlassField label="Description & Effect" hint="Mechanical or narrative outcome">
                <textarea
                  rows={2}
                  value={skillDraftDesc}
                  onChange={(e) => setSkillDraftDesc(e.target.value)}
                  placeholder="e.g. Heavy physical strike dealing bonus damage and staggering smaller beasts..."
                  className={`${FIELD_CLASS} resize-none`}
                />
              </GlassField>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#e8ca8a]/20">
              <GlassButton onClick={() => setSkillModalOpen(false)}>Cancel</GlassButton>
              <GlassButton tone="action" onClick={saveSkillDraft}>
                {editingSkillIdx !== null ? 'Save Changes' : 'Add Ability'}
              </GlassButton>
            </div>
          </div>
        </div>
      )}

      {confirmDialog}
    </GlassScreen>
  )
}
