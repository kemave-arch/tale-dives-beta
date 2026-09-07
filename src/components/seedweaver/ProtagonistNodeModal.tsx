import { useMemo, useState } from 'react'
import {
  Bookmark,
  Check,
  CheckCircle2,
  ChevronDown,
  Flame,
  Plus,
  RotateCcw,
  Save,
  Search,
  Sparkles,
  Sword,
  Trash2,
  User,
  Wand2,
  X,
} from 'lucide-react'
import type { Attributes, ProtagonistData, SkillEntry } from '../../types.ts'
import { PRESET_CLASSES, getClassById } from '../../data/classes.ts'
import { startingAttributes, derivedPools } from '../../lib/derivedStats.ts'

interface ProtagonistNodeModalProps {
  protagonist: ProtagonistData
  protagonistTemplates: ProtagonistData[]
  onSave: (data: ProtagonistData) => void
  onSavePreset?: (data: ProtagonistData) => void
  onDeletePreset?: (id: string) => void
  onClose: () => void
}

const TOTAL_ASSIGNABLE_POINTS = 12
const BASE_ATTR_VALUE = 10

export default function ProtagonistNodeModal({
  protagonist: initial,
  protagonistTemplates = [],
  onSave,
  onSavePreset,
  onClose,
}: ProtagonistNodeModalProps) {
  const [subTab, setSubTab] = useState<'identity' | 'archetype' | 'personality'>('archetype')
  const [data, setData] = useState<ProtagonistData>({ ...initial })

  // Custom Class State
  const [isCustomClass, setIsCustomClass] = useState<boolean>(() => {
    if (data.classId === 'custom') return true
    const isPreset = PRESET_CLASSES.some((c) => c.id === data.classId)
    return !isPreset || Boolean(data.className && data.className !== getClassById(data.classId).name)
  })
  const [customClassNameDraft, setCustomClassNameDraft] = useState<string>(
    data.className || (data.classId ? getClassById(data.classId).name : 'Custom Champion')
  )

  // Presets Browser Modal
  const [presetModalOpen, setPresetModalOpen] = useState(false)
  const [presetSearch, setPresetSearch] = useState('')
  const [saveToast, setSaveToast] = useState<string | null>(null)

  // Skill Editor Sub-Modal
  const [editingSkillIdx, setEditingSkillIdx] = useState<number | null>(null)

  const currentClass = getClassById(data.classId)
  const currentAttrs: Attributes = data.customAttributes || startingAttributes(currentClass.weights)
  const pools = derivedPools(currentAttrs)

  // Point math
  const spentPoints =
    Math.max(0, (currentAttrs.STR || BASE_ATTR_VALUE) - BASE_ATTR_VALUE) +
    Math.max(0, (currentAttrs.INT || BASE_ATTR_VALUE) - BASE_ATTR_VALUE) +
    Math.max(0, (currentAttrs.AGI || BASE_ATTR_VALUE) - BASE_ATTR_VALUE)
  const unassignedPoints = Math.max(0, TOTAL_ASSIGNABLE_POINTS - spentPoints)

  const handleAttrChange = (key: keyof Attributes, delta: number) => {
    if (delta > 0 && unassignedPoints <= 0) return
    const currentVal = currentAttrs[key] || BASE_ATTR_VALUE
    if (delta < 0 && currentVal <= BASE_ATTR_VALUE) return

    const nextVal = Math.max(BASE_ATTR_VALUE, currentVal + delta)
    const updatedAttrs = { ...currentAttrs, [key]: nextVal }
    setData((d) => ({ ...d, customAttributes: updatedAttrs }))
  }

  const handleSelectPresetClass = (clsId: string) => {
    const cls = PRESET_CLASSES.find((c) => c.id === clsId) || PRESET_CLASSES[0]
    setIsCustomClass(false)
    const strAdd = Math.round(TOTAL_ASSIGNABLE_POINTS * cls.weights.STR)
    const intAdd = Math.round(TOTAL_ASSIGNABLE_POINTS * cls.weights.INT)
    const agiAdd = TOTAL_ASSIGNABLE_POINTS - strAdd - intAdd

    setData((d) => ({
      ...d,
      classId: cls.id,
      className: cls.name,
      customAttributes: {
        STR: BASE_ATTR_VALUE + strAdd,
        INT: BASE_ATTR_VALUE + intAdd,
        AGI: BASE_ATTR_VALUE + Math.max(0, agiAdd),
      },
    }))
  }

  const handleSelectCustomClass = () => {
    setIsCustomClass(true)
    const fallbackName = customClassNameDraft.trim() || 'Custom Champion'
    setData((d) => ({
      ...d,
      classId: 'custom',
      className: fallbackName,
    }))
  }

  const handleCustomClassNameChange = (val: string) => {
    setCustomClassNameDraft(val)
    setData((d) => ({
      ...d,
      className: val,
      classId: 'custom',
    }))
  }

  const handleResetAttributes = () => {
    setData((d) => ({
      ...d,
      customAttributes: {
        STR: BASE_ATTR_VALUE,
        INT: BASE_ATTR_VALUE,
        AGI: BASE_ATTR_VALUE,
      },
    }))
  }

  const handleAddSkill = () => {
    const newSkill: SkillEntry = {
      name: 'New Ability',
      skillType: 'Active',
      tier: 'Novice',
      stCost: 5,
      mpCost: 0,
      description: 'A martial strike or magical technique.',
      flavorText: '',
    }
    const nextList = [...(data.startingSkills || []), newSkill]
    setData((d) => ({
      ...d,
      startingSkills: nextList,
    }))
    setEditingSkillIdx(nextList.length - 1)
  }

  const handleRemoveSkill = (idx: number) => {
    setData((d) => ({
      ...d,
      startingSkills: (d.startingSkills || []).filter((_, i) => i !== idx),
    }))
    if (editingSkillIdx === idx) setEditingSkillIdx(null)
  }

  const handleUpdateSkill = (idx: number, patch: Partial<SkillEntry>) => {
    setData((d) => {
      const copy = [...(d.startingSkills || [])]
      copy[idx] = { ...copy[idx], ...patch }
      return { ...d, startingSkills: copy }
    })
  }

  const handleSaveToPresets = () => {
    if (onSavePreset) {
      onSavePreset(data)
    }
    setSaveToast(`Saved "${data.name || 'Hero'}" to Presets!`)
    setTimeout(() => setSaveToast(null), 2500)
  }

  const handleLoadPreset = (template: ProtagonistData) => {
    setData({
      ...template,
      id: data.id || template.id,
    })
    setIsCustomClass(
      template.classId === 'custom' ||
        (Boolean(template.className) && template.className !== getClassById(template.classId).name)
    )
    if (template.className) {
      setCustomClassNameDraft(template.className)
    }
    setPresetModalOpen(false)
    setSaveToast(`Loaded "${template.name}" Preset!`)
    setTimeout(() => setSaveToast(null), 2000)
  }

  const filteredPresets = useMemo(
    () =>
      protagonistTemplates.filter((t) => {
        if (!presetSearch.trim()) return true
        const q = presetSearch.toLowerCase()
        return (
          t.name.toLowerCase().includes(q) ||
          (t.className || '').toLowerCase().includes(q) ||
          (t.background || '').toLowerCase().includes(q)
        )
      }),
    [protagonistTemplates, presetSearch]
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80">
      <div className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl bg-[#120d1c] border border-amber-500/40 shadow-2xl text-[#f5dfa0] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-[#181126] border-b border-amber-500/20">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-300">
              <User size={18} />
            </div>
            <div>
              <h2 className="font-display font-bold text-sm sm:text-base text-[#fae5b5] uppercase tracking-wide">
                Protagonist Forge
              </h2>
              <p className="font-narrative text-xs text-[#d8c49e]/70">
                Shape class archetype, abilities, attributes, and origin
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setPresetModalOpen(true)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-[#201734] hover:bg-[#2c2048] border border-amber-500/30 text-xs font-display font-semibold text-[#fae5b5] transition-colors"
              title="Load Hero Preset"
            >
              <Bookmark size={13} className="text-amber-300" />
              <span>Presets</span>
            </button>
            <button
              onClick={handleSaveToPresets}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/40 text-xs font-display font-semibold text-amber-200 transition-colors"
              title="Save current hero as a preset"
            >
              <Save size={13} />
              <span className="hidden sm:inline">Save Preset</span>
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 text-amber-300/80">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Save Toast */}
        {saveToast && (
          <div className="bg-emerald-950/90 border-b border-emerald-500/30 px-4 py-1.5 flex items-center gap-2 text-xs font-mono text-emerald-300">
            <CheckCircle2 size={13} className="text-emerald-400 shrink-0" />
            <span>{saveToast}</span>
          </div>
        )}

        {/* Presets panel — slides into the normal document flow rather than
            floating as a second full-screen dialog over this one; one
            overlay layer instead of two. */}
        {presetModalOpen && (
          <div className="border-b border-amber-500/20 bg-[#140c22] flex flex-col max-h-64">
            <div className="p-3 border-b border-amber-500/15 flex items-center gap-2">
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-amber-400/60" />
                <input
                  type="text"
                  value={presetSearch}
                  onChange={(e) => setPresetSearch(e.target.value)}
                  placeholder="Search presets..."
                  className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-[#1b102e] border border-amber-500/30 text-xs text-[#fae5b5] outline-none"
                />
              </div>
              <button onClick={() => setPresetModalOpen(false)} className="text-amber-300/80 hover:text-white shrink-0">
                <X size={16} />
              </button>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2">
              {filteredPresets.length === 0 ? (
                <div className="text-center py-6 text-xs text-amber-200/60">No matching presets found.</div>
              ) : (
                filteredPresets.map((t) => (
                  <div
                    key={t.id || t.name}
                    className="p-3 rounded-xl bg-[#1e1333] border border-amber-500/25 hover:border-amber-400/60 transition-all flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-display font-bold text-xs text-amber-200 flex items-center gap-2">
                        <span>{t.name}</span>
                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                          {t.className || (t.classId ? getClassById(t.classId).name : 'Hero')}
                        </span>
                      </div>
                      {t.background && (
                        <p className="text-[11px] font-narrative text-[#d8c49e]/70 line-clamp-1 mt-0.5">{t.background}</p>
                      )}
                    </div>
                    <button
                      onClick={() => handleLoadPreset(t)}
                      className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-display font-bold text-xs shrink-0 uppercase tracking-wider"
                    >
                      Load
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Subtabs (Reorganized with Archetype & Skills, Identity, Personality) */}
        <div className="flex border-b border-amber-500/20 bg-[#140e22] px-3 pt-2 gap-2">
          {[
            { id: 'archetype', label: 'Archetype & Skills', icon: Sword },
            { id: 'identity', label: 'Identity & Origin', icon: User },
            { id: 'personality', label: 'Personality & Secret', icon: Wand2 },
          ].map((tab) => {
            const Icon = tab.icon
            const active = subTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setSubTab(tab.id as any)}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-display font-semibold transition-colors border-b-2 ${
                  active
                    ? 'border-amber-400 text-amber-300 bg-amber-500/10'
                    : 'border-transparent text-[#d8c49e]/70 hover:text-white'
                }`}
              >
                <Icon size={14} />
                <span>{tab.label}</span>
              </button>
            )
          })}
        </div>

        {/* Content Area */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
          {/* TAB 1: ARCHETYPE & SKILLS */}
          {subTab === 'archetype' && (
            <div className="space-y-4">
              {/* Class & Archetype Presets + Custom Class Grid */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-display font-semibold text-amber-200/90 flex items-center gap-1.5">
                    <Sparkles size={13} className="text-amber-300" />
                    <span>Class</span>
                  </label>
                  <span className="text-[10px] font-mono text-amber-300/70">
                    Active: <strong>{data.className || currentClass.name}</strong>
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {/* Preset Classes */}
                  {PRESET_CLASSES.map((cls) => {
                    const selected = !isCustomClass && data.classId === cls.id
                    const strPct = (cls.weights.STR * 100).toFixed(0)
                    const intPct = (cls.weights.INT * 100).toFixed(0)
                    const agiPct = (cls.weights.AGI * 100).toFixed(0)

                    return (
                      <button
                        key={cls.id}
                        type="button"
                        onClick={() => handleSelectPresetClass(cls.id)}
                        className={`p-2.5 rounded-xl text-left border transition-all relative ${
                          selected
                            ? 'bg-amber-500/25 border-amber-400 text-amber-200 shadow-md shadow-amber-500/20'
                            : 'bg-[#181126] border-amber-500/15 text-[#d8c49e] hover:border-amber-500/40 hover:bg-[#201734]'
                        }`}
                      >
                        <div className="font-display font-bold text-xs flex items-center justify-between">
                          <span>{cls.name}</span>
                          {selected && <Check size={12} className="text-amber-300" />}
                        </div>
                        {/* Displaying STR%, INT%, and AGI% clearly */}
                        <div className="text-[10px] font-mono opacity-80 mt-0.5 text-amber-300/80">
                          STR {strPct}% • INT {intPct}% • AGI {agiPct}%
                        </div>
                      </button>
                    )
                  })}

                  {/* Custom Class Option */}
                  <button
                    type="button"
                    onClick={handleSelectCustomClass}
                    className={`p-2.5 rounded-xl text-left border transition-all relative col-span-2 sm:col-span-1 ${
                      isCustomClass
                        ? 'bg-gradient-to-r from-amber-500/25 to-purple-500/25 border-amber-300 text-amber-100 shadow-md shadow-amber-500/25'
                        : 'bg-[#1e1530] border-amber-500/30 text-amber-200/90 hover:border-amber-400 hover:bg-[#281c40]'
                    }`}
                  >
                    <div className="font-display font-bold text-xs flex items-center justify-between">
                      <span className="flex items-center gap-1 text-amber-300">
                        <Wand2 size={12} /> Custom Class
                      </span>
                      {isCustomClass && <Check size={12} className="text-amber-300" />}
                    </div>
                    <div className="text-[10px] font-mono opacity-80 mt-0.5 text-amber-300/80">
                      User-Defined Discipline
                    </div>
                  </button>
                </div>
              </div>

              {/* Custom Class Configuration Panel */}
              {isCustomClass && (
                <div className="p-3.5 rounded-xl bg-[#1d1430] border border-amber-400/40 space-y-2.5 shadow-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-display font-bold text-amber-200 flex items-center gap-1.5">
                      <Wand2 size={13} className="text-amber-300" />
                      <span>Custom Class</span>
                    </span>
                  </div>

                  <div>
                    <label className="block text-[10px] font-mono text-amber-300/80 uppercase mb-1">Class Name *</label>
                    <input
                      type="text"
                      value={customClassNameDraft}
                      onChange={(e) => handleCustomClassNameChange(e.target.value)}
                      placeholder="e.g. Shadow Bladesinger, Rune Engineer, Blood Alchemist"
                      className="w-full px-3 py-2 rounded-xl bg-[#140e22] border border-amber-500/40 text-sm font-display font-semibold text-[#fbf4e2] focus:border-amber-300 outline-none"
                    />
                  </div>
                </div>
              )}

              {/* Derived Pools HUD */}
              <div className="grid grid-cols-3 gap-2 p-3 rounded-xl bg-[#1b132c] border border-amber-500/20">
                <div className="text-center">
                  <span className="text-[10px] font-mono text-red-400 uppercase">HP POOL</span>
                  <div className="font-display font-bold text-base text-red-300">{pools.hpMax}</div>
                </div>
                <div className="text-center">
                  <span className="text-[10px] font-mono text-sky-400 uppercase">MP POOL</span>
                  <div className="font-display font-bold text-base text-sky-300">{pools.mpMax}</div>
                </div>
                <div className="text-center">
                  <span className="text-[10px] font-mono text-emerald-400 uppercase">STAMINA</span>
                  <div className="font-display font-bold text-base text-emerald-300">{pools.stMax}</div>
                </div>
              </div>

              {/* Attributes Allocator */}
              <div className="space-y-2 p-3 rounded-xl bg-[#181126] border border-amber-500/20">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-display font-semibold text-amber-200/90">Attributes</label>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono text-amber-300">
                      Points: <strong className="text-amber-100">{unassignedPoints}</strong> / {TOTAL_ASSIGNABLE_POINTS}
                    </span>
                    <button
                      type="button"
                      onClick={handleResetAttributes}
                      className="text-[10px] font-mono text-amber-400/80 hover:text-amber-200 flex items-center gap-1"
                      title="Reset attributes to base 10"
                    >
                      <RotateCcw size={10} /> Reset
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {(['STR', 'INT', 'AGI'] as const).map((attr) => (
                    <div
                      key={attr}
                      className="flex flex-col items-center justify-between p-2 rounded-xl bg-[#140e22] border border-amber-500/20"
                    >
                      <span className="font-display text-xs font-bold text-[#fae5b5]">{attr}</span>
                      <span className="my-1 font-mono font-bold text-base text-amber-200">
                        {currentAttrs[attr] || BASE_ATTR_VALUE}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleAttrChange(attr, -1)}
                          disabled={(currentAttrs[attr] || BASE_ATTR_VALUE) <= BASE_ATTR_VALUE}
                          className="w-7 h-6 rounded-lg bg-amber-500/20 hover:bg-amber-500/40 disabled:opacity-30 text-amber-300 flex items-center justify-center font-mono font-bold text-xs"
                        >
                          -
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAttrChange(attr, 1)}
                          disabled={unassignedPoints <= 0}
                          className="w-7 h-6 rounded-lg bg-amber-500/20 hover:bg-amber-500/40 disabled:opacity-30 text-amber-300 flex items-center justify-center font-mono font-bold text-xs"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Starting Abilities & Spells List */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-display font-semibold text-amber-200/90 flex items-center gap-1.5">
                    <Flame size={13} className="text-amber-300" />
                    <span>Abilities</span>
                  </label>
                  <button
                    type="button"
                    onClick={handleAddSkill}
                    className="flex items-center gap-1 text-[11px] font-display font-semibold text-amber-300 hover:text-amber-200 px-2 py-0.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/30"
                  >
                    <Plus size={13} /> Add Ability
                  </button>
                </div>

                <div className="space-y-2">
                  {(data.startingSkills || []).map((skill, idx) => {
                    const expanded = editingSkillIdx === idx
                    return (
                      <div key={idx} className="rounded-xl bg-[#181126] border border-amber-500/20 overflow-hidden">
                        <button
                          type="button"
                          onClick={() => setEditingSkillIdx(expanded ? null : idx)}
                          className="w-full p-2.5 flex items-center justify-between gap-2 text-left"
                        >
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <span className="font-display font-bold text-xs text-amber-200 truncate">
                              {skill.name || 'Unnamed Ability'}
                            </span>
                            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 shrink-0">
                              {skill.skillType || 'Active'}
                            </span>
                            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 shrink-0">
                              {skill.tier || 'Novice'}
                            </span>
                            {((skill.stCost || 0) > 0 || (skill.mpCost || 0) > 0) && (
                              <span className="text-[9px] font-mono text-emerald-300 shrink-0">
                                {skill.stCost ? `${skill.stCost} ST` : ''} {skill.mpCost ? `${skill.mpCost} MP` : ''}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <span
                              onClick={(e) => {
                                e.stopPropagation()
                                handleRemoveSkill(idx)
                              }}
                              className="text-red-400 hover:text-red-300 p-1"
                            >
                              <Trash2 size={13} />
                            </span>
                            <ChevronDown
                              size={15}
                              className={`text-amber-300/80 transition-transform ${expanded ? 'rotate-180' : ''}`}
                            />
                          </div>
                        </button>

                        {!expanded && skill.description && (
                          <p className="px-2.5 pb-2 text-xs font-narrative text-[#d8c49e]/80 line-clamp-1">
                            {skill.description}
                          </p>
                        )}

                        {/* Inline editor — was a stacked full-screen sub-modal;
                            expanding in place avoids a second overlay layer
                            on top of this already-open form. */}
                        {expanded && (
                          <div className="p-2.5 pt-0 space-y-2.5 text-xs border-t border-amber-500/20">
                            <div>
                              <label className="block text-[10px] font-mono text-amber-300/80 uppercase mb-1">Name *</label>
                              <input
                                type="text"
                                value={skill.name}
                                onChange={(e) => handleUpdateSkill(idx, { name: e.target.value })}
                                placeholder="e.g. Lightning Strike, Shadow Step"
                                className="w-full px-3 py-1.5 rounded-xl bg-[#221735] border border-amber-500/30 text-amber-100 outline-none"
                              />
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="block text-[10px] font-mono text-amber-300/80 uppercase mb-1">Type</label>
                                <select
                                  value={skill.skillType || 'Active'}
                                  onChange={(e) => handleUpdateSkill(idx, { skillType: e.target.value })}
                                  className="w-full px-2 py-1.5 rounded-xl bg-[#221735] border border-amber-500/30 text-amber-100 outline-none"
                                >
                                  <option value="Active">Active</option>
                                  <option value="Spell">Spell</option>
                                  <option value="Martial">Martial</option>
                                  <option value="Passive">Passive</option>
                                  <option value="Utility">Utility</option>
                                </select>
                              </div>
                              <div>
                                <label className="block text-[10px] font-mono text-amber-300/80 uppercase mb-1">Tier</label>
                                <select
                                  value={skill.tier || 'Novice'}
                                  onChange={(e) => handleUpdateSkill(idx, { tier: e.target.value })}
                                  className="w-full px-2 py-1.5 rounded-xl bg-[#221735] border border-amber-500/30 text-amber-100 outline-none"
                                >
                                  <option value="Novice">Novice</option>
                                  <option value="Adept">Adept</option>
                                  <option value="Expert">Expert</option>
                                  <option value="Master">Master</option>
                                  <option value="Innate">Innate</option>
                                </select>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="block text-[10px] font-mono text-amber-300/80 uppercase mb-1">ST Cost</label>
                                <input
                                  type="number"
                                  value={skill.stCost ?? 0}
                                  onChange={(e) => handleUpdateSkill(idx, { stCost: Number(e.target.value) })}
                                  className="w-full px-3 py-1.5 rounded-xl bg-[#221735] border border-amber-500/30 text-amber-100 outline-none"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] font-mono text-amber-300/80 uppercase mb-1">MP Cost</label>
                                <input
                                  type="number"
                                  value={skill.mpCost ?? 0}
                                  onChange={(e) => handleUpdateSkill(idx, { mpCost: Number(e.target.value) })}
                                  className="w-full px-3 py-1.5 rounded-xl bg-[#221735] border border-amber-500/30 text-amber-100 outline-none"
                                />
                              </div>
                            </div>

                            <div>
                              <label className="block text-[10px] font-mono text-amber-300/80 uppercase mb-1">Description</label>
                              <textarea
                                rows={2}
                                value={skill.description || ''}
                                onChange={(e) => handleUpdateSkill(idx, { description: e.target.value })}
                                placeholder="Mechanical combat effect, range, impact..."
                                className="w-full px-3 py-1.5 rounded-xl bg-[#221735] border border-amber-500/30 text-xs font-narrative text-amber-100 outline-none resize-none"
                              />
                            </div>

                            <div>
                              <label className="block text-[10px] font-mono text-amber-300/80 uppercase mb-1">Flavor Quote</label>
                              <input
                                type="text"
                                value={skill.flavorText || ''}
                                onChange={(e) => handleUpdateSkill(idx, { flavorText: e.target.value })}
                                placeholder="e.g. 'A single arc of lightning clears the horizon.'"
                                className="w-full px-3 py-1.5 rounded-xl bg-[#221735] border border-amber-500/30 text-xs italic font-narrative text-amber-200/80 outline-none"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: IDENTITY & ORIGIN */}
          {subTab === 'identity' && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-display font-semibold text-amber-200/90 mb-1">Name *</label>
                <input
                  type="text"
                  value={data.name}
                  onChange={(e) => setData({ ...data, name: e.target.value })}
                  placeholder="e.g. Violet Sorrengail, Roland Deschain"
                  className="w-full px-3 py-2 rounded-xl bg-[#1b1429] border border-amber-500/30 text-sm text-[#fbf4e2] focus:border-amber-400 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-display font-semibold text-amber-200/90 mb-1">Gender</label>
                  <input
                    type="text"
                    value={data.gender || ''}
                    onChange={(e) => setData({ ...data, gender: e.target.value })}
                    placeholder="e.g. Female, Male, Non-binary"
                    className="w-full px-3 py-2 rounded-xl bg-[#1b1429] border border-amber-500/30 text-sm text-[#fbf4e2] focus:border-amber-400 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-display font-semibold text-amber-200/90 mb-1">Age</label>
                  <input
                    type="number"
                    value={data.age || 20}
                    onChange={(e) => setData({ ...data, age: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl bg-[#1b1429] border border-amber-500/30 text-sm text-[#fbf4e2] focus:border-amber-400 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-display font-semibold text-amber-200/90 mb-1">Background</label>
                <textarea
                  rows={3}
                  value={data.background || ''}
                  onChange={(e) => setData({ ...data, background: e.target.value })}
                  placeholder="Where do they hail from? Family lineage, upbringing, or past training..."
                  className="w-full px-3 py-2 rounded-xl bg-[#1b1429] border border-amber-500/30 text-xs font-narrative text-[#fbf4e2] focus:border-amber-400 outline-none resize-none leading-relaxed"
                />
              </div>

              <div>
                <label className="block text-xs font-display font-semibold text-amber-200/90 mb-1">Key Item</label>
                <input
                  type="text"
                  value={data.keyItem || ''}
                  onChange={(e) => setData({ ...data, keyItem: e.target.value })}
                  placeholder="e.g. Mother's poisoned dagger, grandfather's pocket watch, cipher crystal"
                  className="w-full px-3 py-2 rounded-xl bg-[#1b1429] border border-amber-500/30 text-xs font-narrative text-[#fbf4e2] focus:border-amber-400 outline-none"
                />
              </div>
            </div>
          )}

          {/* TAB 3: PERSONALITY & SECRET */}
          {subTab === 'personality' && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-display font-semibold text-amber-200/90 mb-1">Personality</label>
                <textarea
                  rows={2}
                  value={data.personality || ''}
                  onChange={(e) => setData({ ...data, personality: e.target.value })}
                  placeholder="e.g. Sharp-tongued under pressure, book-smart, unyielding stubbornness..."
                  className="w-full px-3 py-2 rounded-xl bg-[#1b1429] border border-amber-500/30 text-xs font-narrative text-[#fbf4e2] focus:border-amber-400 outline-none resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-display font-semibold text-amber-200/90 mb-1">Motivation</label>
                <textarea
                  rows={2}
                  value={data.motivation || ''}
                  onChange={(e) => setData({ ...data, motivation: e.target.value })}
                  placeholder="e.g. Survive the Parapet, bond a dragon, avenge her betrayed father..."
                  className="w-full px-3 py-2 rounded-xl bg-[#1b1429] border border-amber-500/30 text-xs font-narrative text-[#fbf4e2] focus:border-amber-400 outline-none resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-display font-semibold text-amber-200/90 mb-1">Trait</label>
                <input
                  type="text"
                  value={data.physicalTrait || ''}
                  onChange={(e) => setData({ ...data, physicalTrait: e.target.value })}
                  placeholder="e.g. Frail bone density, silver hair tips, runic scar on forearm..."
                  className="w-full px-3 py-2 rounded-xl bg-[#1b1429] border border-amber-500/30 text-sm text-[#fbf4e2] focus:border-amber-400 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-display font-semibold text-amber-200/90 mb-1">Secret</label>
                <textarea
                  rows={2}
                  value={data.secret || ''}
                  onChange={(e) => setData({ ...data, secret: e.target.value })}
                  placeholder="e.g. Carries concealed vial of dragon poison, holds secret rebellion notes..."
                  className="w-full px-3 py-2 rounded-xl bg-[#1b1429] border border-amber-500/30 text-xs font-narrative text-[#fbf4e2] focus:border-amber-400 outline-none resize-none"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 bg-[#181126] border-t border-amber-500/20">
          <button
            onClick={onClose}
            className="px-3.5 sm:px-4 py-2 rounded-xl bg-[#221836] hover:bg-[#2c2045] text-xs font-display font-semibold text-[#d8c49e]"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(data)}
            disabled={!data.name.trim()}
            className="px-4 sm:px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-display font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-lg shadow-amber-500/30 disabled:opacity-40"
          >
            <CheckCircle2 size={15} />
            <span>Save Hero</span>
          </button>
        </div>
      </div>
    </div>
  )
}
