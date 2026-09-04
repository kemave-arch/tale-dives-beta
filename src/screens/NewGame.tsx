import { useState } from 'react'
import { UserCircle, Fingerprint, Save, Plus } from 'lucide-react'
import { PRESET_CLASSES } from '../data/classes.ts'
import {
  FIELD_CLASS, GLASS_SURFACE, GlassButton, GlassCTAButton, GlassField, GlassHeader, GlassScreen, GlassTabs,
  SELECT_CLASS, SuggestionChips, TemplateSearchDropdown,
} from '../lib/glassChrome.tsx'
import type { ProtagonistData } from '../types.ts'

interface NewGameProps {
  protagonistTemplates?: ProtagonistData[]
  initial?: ProtagonistData | null
  showBriefField?: boolean // §Phase B.4 — the Tale Dive Brief screen owns this step for the 'tale' flow; library-preset editing still sets a stored default here
  onBack: () => void
  onBegin: (protagonist: ProtagonistData) => void
  onSavePreset?: (protagonist: ProtagonistData) => void
  onSaveAsNewPreset?: (protagonist: ProtagonistData) => void
}

const TABS = [
  { id: 'basics' as const, label: 'Basics', icon: UserCircle },
  { id: 'identity' as const, label: 'Identity', icon: Fingerprint },
]

const PERSONALITY_CHIPS = ['Stubborn', 'Guarded', 'Reckless', 'Calculating', 'Warm-hearted']
const MOTIVATION_CHIPS = ['Prove myself', 'Protect someone', 'Revenge', 'Survive', 'Uncover a secret']

// Stand-in for the full Phase A/B creation pipeline (§2) — just enough to get
// a protagonist onto the board and prove the turn loop. Grounded/free-form
// classes (§Phase B.2a) aren't built yet. Also doubles as the Protagonist
// Library's create/edit form (§6.4B).
export default function NewGame({
  protagonistTemplates = [],
  initial,
  showBriefField = false,
  onBack,
  onBegin,
  onSavePreset,
  onSaveAsNewPreset,
}: NewGameProps) {
  const [tab, setTab] = useState<(typeof TABS)[number]['id']>('basics')
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

  return (
    <GlassScreen ground="art" fill>
      <GlassHeader title="Protagonist Setup" subtitle="Step 3 — who the tale follows" onBack={onBack} />

      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4">
        <div className="max-w-md mx-auto flex flex-col gap-4">
          <TemplateSearchDropdown templates={protagonistTemplates} onSelect={applyTemplate} placeholder="Search saved Protagonists..." />

          <div className="flex gap-3 items-start">
            <GlassTabs tabs={TABS} value={tab} onChange={setTab} orientation="vertical" className="w-20 shrink-0" />

            <div className="flex-1 min-w-0 flex flex-col gap-4">
              {tab === 'basics' && (
                <>
                  <GlassField label="Name">
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Violet Sorrengail"
                      className={FIELD_CLASS}
                    />
                  </GlassField>

                  <div className="flex gap-2">
                    <div className="flex-1">
                      <GlassField label="Gender" hint="Optional.">
                        <input
                          value={gender}
                          onChange={(e) => setGender(e.target.value)}
                          placeholder="she/her"
                          className={FIELD_CLASS}
                        />
                      </GlassField>
                    </div>
                    <div className="w-24 shrink-0">
                      <GlassField label="Age" hint="Opt.">
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

                  <GlassField label="Class">
                    <select value={classId} onChange={(e) => setClassId(e.target.value)} className={SELECT_CLASS}>
                      {PRESET_CLASSES.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </GlassField>
                </>
              )}

              {tab === 'identity' && (
                <>
                  <GlassField label="Background" hint="Optional.">
                    <textarea
                      value={background}
                      onChange={(e) => setBackground(e.target.value)}
                      placeholder="Origin, family, and history the Narrator should know from Turn 1."
                      rows={3}
                      className={FIELD_CLASS}
                    />
                  </GlassField>

                  <GlassField label="Personality" hint="Optional.">
                    <div className="flex flex-col gap-2">
                      <SuggestionChips options={PERSONALITY_CHIPS} onPick={setPersonality} />
                      <input
                        value={personality}
                        onChange={(e) => setPersonality(e.target.value)}
                        placeholder="Quietly stubborn, hides fear behind sharp wit"
                        className={FIELD_CLASS}
                      />
                    </div>
                  </GlassField>

                  <GlassField label="Motivation" hint="Optional.">
                    <div className="flex flex-col gap-2">
                      <SuggestionChips options={MOTIVATION_CHIPS} onPick={setMotivation} />
                      <input
                        value={motivation}
                        onChange={(e) => setMotivation(e.target.value)}
                        placeholder="Prove she belongs, despite everyone expecting her to fail"
                        className={FIELD_CLASS}
                      />
                    </div>
                  </GlassField>

                  <GlassField label="Physical Trait" hint="Optional.">
                    <input
                      value={physicalTrait}
                      onChange={(e) => setPhysicalTrait(e.target.value)}
                      placeholder="Hypermobile joints — strong grip, injures easily"
                      className={FIELD_CLASS}
                    />
                  </GlassField>

                  <GlassField label="Secret" hint="Optional.">
                    <input
                      value={secret}
                      onChange={(e) => setSecret(e.target.value)}
                      placeholder="Keeps a smuggled dagger her mother doesn't know about"
                      className={FIELD_CLASS}
                    />
                  </GlassField>

                  {showBriefField && (
                    <GlassField label="Tale Dive Brief" hint="Optional.">
                      <textarea
                        value={opening}
                        onChange={(e) => setOpening(e.target.value)}
                        placeholder="Describe the exact scene, location, and characters present where Turn 1 should open."
                        rows={4}
                        className={FIELD_CLASS}
                      />
                    </GlassField>
                  )}
                </>
              )}

              {(onSavePreset || onSaveAsNewPreset) && (
                <div className="flex gap-2">
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
