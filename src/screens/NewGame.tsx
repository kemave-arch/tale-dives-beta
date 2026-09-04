import { useState } from 'react'
import { Bookmark, Check, CheckCircle2, Eye, Fingerprint, Plus, Save, Search, UserCircle, X } from 'lucide-react'
import { PRESET_CLASSES } from '../data/classes.ts'
import {
  FIELD_CLASS, GLASS_SURFACE, GlassButton, GlassCTAButton, GlassField, GlassHeader, GlassLongTextarea, GlassScreen, GlassTabs,
  SELECT_CLASS,
} from '../lib/glassChrome.tsx'
import { PERSONALITY_EXAMPLES, MOTIVATION_EXAMPLES } from '../data/formExamples.ts'
import type { ProtagonistData } from '../types.ts'
import { ProtagonistDetailModal } from '../components/PresetDetailModal.tsx'

interface NewGameProps {
  protagonistTemplates?: ProtagonistData[]
  initial?: ProtagonistData | null
  showBriefField?: boolean // §Phase B.4 — the Tale Dive Brief screen owns this step for the 'tale' flow; library-preset editing still sets a stored default here
  editLongText: (label: string, value: string, hint?: string, placeholder?: string) => Promise<string | null>
  onBack: () => void
  onBegin: (protagonist: ProtagonistData) => void
  onSavePreset?: (protagonist: ProtagonistData) => void
  onSaveAsNewPreset?: (protagonist: ProtagonistData) => void
}

const TABS = [
  { id: 'basics' as const, label: 'Basics', icon: UserCircle },
  { id: 'identity' as const, label: 'Identity', icon: Fingerprint },
  { id: 'presets' as const, label: 'Load Preset', icon: Bookmark },
]

// Stand-in for the full Phase A/B creation pipeline (§2) — just enough to get
// a protagonist onto the board and prove the turn loop. Grounded/free-form
// classes (§Phase B.2a) aren't built yet. Also doubles as the Protagonist
// Library's create/edit form (§6.4B).
export default function NewGame({
  protagonistTemplates = [],
  initial,
  showBriefField = false,
  editLongText,
  onBack,
  onBegin,
  onSavePreset,
  onSaveAsNewPreset,
}: NewGameProps) {
  const [tab, setTab] = useState<(typeof TABS)[number]['id']>('basics')
  const [presetSearch, setPresetSearch] = useState('')
  const [selectedPreset, setSelectedPreset] = useState<ProtagonistData | null>(null)
  const [selectedDeckId, setSelectedDeckId] = useState<string | null>(initial?.id ?? null)
  const [templateId, setTemplateId] = useState<string | null | undefined>(initial?.id ?? null)
  const [name, setName] = useState(initial?.name ?? '')
  const [gender, setGender] = useState(initial?.gender ?? '')
  const [age, setAge] = useState(initial?.age !== undefined ? String(initial.age) : '')
  const [classId, setClassId] = useState(initial?.classId ?? PRESET_CLASSES[0].id)
  const [background, setBackground] = useState(initial?.background ?? '')
  const [personality, setPersonality] = useState(initial?.personality ?? '')
  const [motivation, setMotivation] = useState(initial?.motivation ?? '')
  const [physicalTrait, setPhysicalTrait] = useState(initial?.physicalTrait ?? '')
  const [secret, setSecret] = useState(initial?.secret ?? '')
  const [opening, setOpening] = useState(initial?.opening ?? '')

  function applyTemplate(t: ProtagonistData) {
    setTab('basics')
    setTemplateId(t.id)
    setName(t.name)
    setGender(t.gender ?? '')
    setAge(t.age !== undefined ? String(t.age) : '')
    setClassId(t.classId)
    setBackground(t.background ?? '')
    setPersonality(t.personality ?? '')
    setMotivation(t.motivation ?? '')
    setPhysicalTrait(t.physicalTrait ?? '')
    setSecret(t.secret ?? '')
    setOpening(t.opening ?? '')
  }

  function currentData(): ProtagonistData {
    return {
      id: templateId,
      name: name || 'The Wanderer',
      gender: gender.trim() || undefined,
      age: age.trim() ? Number(age) : undefined,
      classId,
      background,
      personality: personality.trim() || undefined,
      motivation: motivation.trim() || undefined,
      physicalTrait: physicalTrait.trim() || undefined,
      secret: secret.trim() || undefined,
      opening,
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
        const className = PRESET_CLASSES.find((c) => c.id === t.classId)?.name || t.classId
        return (
          t.name.toLowerCase().includes(q) ||
          className.toLowerCase().includes(q) ||
          (t.personality && t.personality.toLowerCase().includes(q)) ||
          (t.motivation && t.motivation.toLowerCase().includes(q))
        )
      })
    : protagonistTemplates

  const sortedTemplates = [...matchedTemplates].sort(
    (a, b) => getPresetTimestamp(b) - getPresetTimestamp(a),
  )

  return (
    <GlassScreen ground="art" fill>
      <GlassHeader title="Protagonist Setup" subtitle="Step 3 — who the tale follows" onBack={onBack} />

      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4">
        <div className="max-w-md mx-auto flex flex-col gap-4">
          <GlassTabs tabs={TABS} value={tab} onChange={setTab} className="w-full" />

          {tab === 'presets' && (
            <div className="flex flex-col gap-3">
              <div className="relative">
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

              {protagonistTemplates.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[#e8ca8a]/30 p-6 text-center">
                  <p className="font-narrative italic text-sm text-[#e8ca8a]/80 mb-1">No saved Protagonists yet.</p>
                  <p className="font-narrative text-xs text-[#e8ca8a]/60">
                    Configure your character in Basics &amp; Identity, then click &ldquo;Save as New Preset&rdquo; below to save it here for future tales.
                  </p>
                </div>
              ) : sortedTemplates.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[#e8ca8a]/30 p-4 text-center">
                  <p className="font-narrative italic text-xs text-[#e8ca8a]/70">No saved protagonists match &ldquo;{presetSearch}&rdquo;</p>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  <p className="font-narrative italic text-xs text-[#d8c49e]">
                    Select a protagonist card and confirm to load their identity and background into this setup.
                  </p>
                  <div className="flex flex-col gap-2.5">
                    {sortedTemplates.map((t) => {
                      const isCurrent = templateId === t.id
                      const isSelected = selectedDeckId === t.id
                      const ts = getPresetTimestamp(t)
                      const className = PRESET_CLASSES.find((c) => c.id === t.classId)?.name || t.classId
                      const details = [t.gender, t.age !== undefined ? `Age ${t.age}` : null].filter(Boolean).join(' • ')

                      return (
                        <div
                          key={t.id ?? t.name}
                          onClick={() => setSelectedDeckId(t.id ?? null)}
                          className={`${GLASS_SURFACE} rounded-xl p-3.5 flex flex-col gap-2 transition-all duration-150 cursor-pointer ${
                            isSelected
                              ? 'bg-[#23123a]/95 border-[#c084fc] shadow-[0_0_16px_rgba(192,132,252,0.25)] ring-1 ring-[#c084fc]/60'
                              : isCurrent
                                ? 'bg-[#190d29]/85 border-[#c084fc]/60 hover:border-[#c084fc]/90 hover:bg-[#23123a]/90'
                                : 'bg-[#190d29]/80 border-[#c084fc]/35 hover:border-[#c084fc]/75 hover:bg-[#23123a]/90'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 transition-colors ${
                                isSelected
                                  ? 'border-[#c084fc] bg-[#c084fc] text-[#190d29]'
                                  : 'border-[#c084fc]/50 bg-transparent text-transparent'
                              }`}>
                                <Check size={11} strokeWidth={3} />
                              </div>
                              <UserCircle size={16} className="text-[#c084fc] shrink-0" />
                              <h3 className="font-display font-bold text-sm text-[#f3e8ff] truncate">{t.name}</h3>
                              <div className="flex items-center gap-1 shrink-0 flex-wrap">
                                {isCurrent && (
                                  <span className="rounded bg-[#c084fc]/25 text-[#d8b4fe] border border-[#c084fc]/40 px-1.5 py-0.2 text-[9px] font-mono">
                                    active
                                  </span>
                                )}
                                {t.isDefault && (
                                  <span className="rounded bg-[#c084fc]/15 text-[#e9d5ff] border border-[#c084fc]/30 px-1.5 py-0.2 text-[9px] font-mono">
                                    default
                                  </span>
                                )}
                                <span className="rounded px-1.5 py-0.2 text-[9px] font-mono uppercase tracking-wider bg-[#a855f7]/20 text-[#f3e8ff] border border-[#c084fc]/35">
                                  {className}
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

                          {details && (
                            <p className="font-narrative italic text-xs text-[#e9d5ff]/85">
                              {details}
                            </p>
                          )}

                          {(t.personality || t.motivation || t.physicalTrait) && (
                            <p className="font-narrative text-xs text-[#f3e8ff]/85 line-clamp-2 leading-relaxed">
                              {t.personality || t.motivation || t.physicalTrait}
                            </p>
                          )}

                          {t.background && (
                            <p className="font-narrative text-xs text-[#d8b4fe]/75 line-clamp-1">
                              {t.background}
                            </p>
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
                    const chosen = sortedTemplates.find((t) => t.id === selectedDeckId) || (sortedTemplates.length > 0 ? sortedTemplates[0] : null)
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
                />
              )}
            </div>
          )}

          {tab === 'basics' && (
            <div className="flex flex-col gap-4">
              <GlassField label="Name" hint="Protagonist's full name">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Violet Sorrengail"
                  className={FIELD_CLASS}
                />
              </GlassField>

              <div className="flex gap-2">
                <div className="flex-1">
                  <GlassField label="Gender" hint="Optional">
                    <input
                      value={gender}
                      onChange={(e) => setGender(e.target.value)}
                      placeholder="e.g. female (she/her)"
                      className={FIELD_CLASS}
                    />
                  </GlassField>
                </div>
                <div className="w-28 shrink-0">
                  <GlassField label="Age" hint="Optional">
                    <input
                      type="number"
                      min="0"
                      max="999"
                      value={age}
                      onChange={(e) => setAge(e.target.value)}
                      placeholder="20"
                      className={FIELD_CLASS}
                    />
                  </GlassField>
                </div>
              </div>

              <GlassField label="Archetype / Class" hint="Starting skillset & abilities">
                <select value={classId} onChange={(e) => setClassId(e.target.value)} className={SELECT_CLASS}>
                  {PRESET_CLASSES.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </GlassField>
            </div>
          )}

          {tab === 'identity' && (
            <div className="flex flex-col gap-4">
              <GlassField
                label="Background & Origin"
                hint="History known to the Narrator from Turn 1"
              >
                <GlassLongTextarea
                  value={background}
                  onOpenModal={async () => {
                    const result = await editLongText(
                      'Background & Origin',
                      background,
                      'Origin, family, and history the Narrator should know from Turn 1.',
                      'e.g. Youngest child of General Lilith Sorrengail. Trained as a scholar for the Scribe Quadrant, but forced into the lethal Riders Quadrant at Basgiath War College on Conscription Day.',
                    )
                    if (result !== null) setBackground(result)
                  }}
                  placeholder="e.g. Trained for the Scribe Quadrant, forced into the lethal Riders Quadrant at Basgiath War College..."
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
                  placeholder="e.g. Fiercely intelligent, relentlessly determined, compensates for frailty with tactical cunning and poison craft"
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
                  placeholder="e.g. Survive the deadly Parapet, bond a dragon, and prove she belongs despite everyone expecting her to die"
                  className={FIELD_CLASS}
                />
              </GlassField>

              <GlassField label="Physical Trait" hint="Distinguishing appearance or condition">
                <input
                  value={physicalTrait}
                  onChange={(e) => setPhysicalTrait(e.target.value)}
                  placeholder="e.g. Silver-tipped hair, hypermobile/fragile joints requiring braces, agile with twin daggers"
                  className={FIELD_CLASS}
                />
              </GlassField>

              <GlassField label="Secret" hint="Concealed truth the world doesn't know yet">
                <input
                  value={secret}
                  onChange={(e) => setSecret(e.target.value)}
                  placeholder="e.g. Carries concealed poisoned daggers, knows classified military lore from her scribe archives that contradicts official Navarre records"
                  className={FIELD_CLASS}
                />
              </GlassField>

              {showBriefField && (
                <GlassField
                  label="Tale Dive Brief"
                  hint="Opening scene description — optional"
                >
                  <GlassLongTextarea
                    value={opening}
                    onOpenModal={async () => {
                      const result = await editLongText(
                        'Tale Dive Brief',
                        opening,
                        'Describe the exact scene, location, and characters present where Turn 1 should open.',
                        'e.g. Standing atop the turret in torrential rain, staring across the narrow, slick stone Parapet suspended two hundred feet above the jagged gorge as the rider ahead slips into the abyss.',
                      )
                      if (result !== null) setOpening(result)
                    }}
                    placeholder="e.g. Standing atop the turret in torrential rain before the lethal stone Parapet suspended high above the gorge..."
                    rows={4}
                  />
                </GlassField>
              )}
            </div>
          )}

          {(onSavePreset || onSaveAsNewPreset) && (
            <div className="flex gap-2 pt-1">
              {templateId && onSavePreset && (
                <GlassButton onClick={() => onSavePreset(currentData())} icon={Save} className="flex-1">
                  Save Preset
                </GlassButton>
              )}
              {onSaveAsNewPreset && (
                <GlassButton onClick={() => onSaveAsNewPreset({ ...currentData(), id: null })} icon={Plus} className="flex-1">
                  Save as New Preset
                </GlassButton>
              )}
            </div>
          )}
        </div>
      </div>

      <div
        className={`shrink-0 ${GLASS_SURFACE} border-x-0 border-b-0 bg-[#07050c]/50 px-4 py-3 flex justify-center`}
        style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
      >
        <GlassCTAButton onClick={() => onBegin(currentData())}>Continue</GlassCTAButton>
      </div>
    </GlassScreen>
  )
}
