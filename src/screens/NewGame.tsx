import { useState } from 'react'
import { UserCircle, Save, Plus } from 'lucide-react'
import { PRESET_CLASSES } from '../data/classes.ts'
import {
  FIELD_CLASS, GLASS_SURFACE, GlassButton, GlassCTAButton, GlassField, GlassHeader, GlassScreen, LABEL_CLASS, SELECT_CLASS,
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
  const [templateId, setTemplateId] = useState<string | null | undefined>(initial?.id ?? null)
  const [name, setName] = useState(initial?.name ?? '')
  const [gender, setGender] = useState(initial?.gender ?? '')
  const [age, setAge] = useState(initial?.age !== undefined ? String(initial.age) : '')
  const [classId, setClassId] = useState(initial?.classId ?? PRESET_CLASSES[0].id)
  const [background, setBackground] = useState(initial?.background ?? '')
  const [opening, setOpening] = useState(initial?.opening ?? '')

  function applyTemplate(t: ProtagonistData) {
    setTemplateId(t.id)
    setName(t.name)
    setGender(t.gender ?? '')
    setAge(t.age !== undefined ? String(t.age) : '')
    setClassId(t.classId)
    setBackground(t.background ?? '')
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
      opening,
    }
  }

  return (
    <GlassScreen ground="art" fill>
      <GlassHeader title="Protagonist Setup" subtitle="Step 3 — who the tale follows" onBack={onBack} />

      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4">
        <div className="max-w-md mx-auto flex flex-col gap-4">
          {protagonistTemplates.length > 0 && (
            <div>
              <p className={`${LABEL_CLASS} mb-2`}>Start from a saved Protagonist</p>
              <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4">
                {protagonistTemplates.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => applyTemplate(t)}
                    className={`shrink-0 flex items-center gap-1.5 rounded-full border px-3 py-2 text-xs font-display backdrop-blur-sm transition-colors duration-150 ${
                      templateId === t.id
                        ? 'border-[#f0ca65]/70 bg-[#e8ca8a]/12 text-[#f5dfa0]'
                        : 'border-[#e8ca8a]/25 text-[#e8ca8a]/90 hover:border-[#e8ca8a]/60 hover:text-[#f5dfa0]'
                    }`}
                  >
                    <UserCircle size={13} />
                    {t.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <GlassField label="Name">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Wren of the Ashmark"
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

          <GlassField label="Background" hint="Optional.">
            <textarea
              value={background}
              onChange={(e) => setBackground(e.target.value)}
              placeholder="Origin, family, and history the Narrator should know from Turn 1."
              rows={3}
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

      <div
        className={`shrink-0 ${GLASS_SURFACE} border-x-0 border-b-0 bg-[#07050c]/50 px-4 py-3 flex justify-center`}
        style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
      >
        <GlassCTAButton onClick={() => onBegin(currentData())}>Continue</GlassCTAButton>
      </div>
    </GlassScreen>
  )
}
