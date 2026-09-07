import { useState } from 'react'
import { Plus, Trash2, Wand2 } from 'lucide-react'
import type { Attributes, ProtagonistData } from '../../types.ts'
import { PRESET_CLASSES, getClassById } from '../../data/classes.ts'
import { COMPETENCY_TIERS, tierToWord, wordToTier } from '../../lib/tiers.ts'
import { ChapterShell, Field, FIELD, GhostButton, LibraryPresetBar, Pill, PrimaryButton } from './shared.tsx'

const BASE_ATTR = 10
const POOL = 12
const SKILL_CAP = 3

interface Props {
  value: ProtagonistData
  onChange: (next: ProtagonistData) => void
  ready: boolean
  onFinalize: () => void
  onBack: () => void
  templates: ProtagonistData[]
  onSavePreset?: (p: ProtagonistData) => void
  onDeletePreset?: (id: string) => void
}

type Sub = 'identity' | 'origin' | 'build'

function blankAttrs(classId: string): Attributes {
  const cls = getClassById(classId)
  const strAdd = Math.round(POOL * cls.weights.STR)
  const intAdd = Math.round(POOL * cls.weights.INT)
  const agiAdd = Math.max(0, POOL - strAdd - intAdd)
  return { STR: BASE_ATTR + strAdd, INT: BASE_ATTR + intAdd, AGI: BASE_ATTR + agiAdd }
}

export default function ProtagonistChapter({ value, onChange, ready, onFinalize, onBack, templates, onSavePreset, onDeletePreset }: Props) {
  const [sub, setSub] = useState<Sub>('identity')
  const [skillOpen, setSkillOpen] = useState(false)
  // Local draft keeps `tier` as its display word (for the <select> below) —
  // converted to SkillEntry's numeric CompetencyTier only when added.
  const [draft, setDraft] = useState({ name: '', skillType: 'Active', tier: 'Novice' })

  const attrs = value.customAttributes ?? blankAttrs(value.classId || 'warrior')
  const spent = Math.max(0, attrs.STR - BASE_ATTR) + Math.max(0, attrs.INT - BASE_ATTR) + Math.max(0, attrs.AGI - BASE_ATTR)
  const left = POOL - spent
  const skills = value.startingSkills ?? []

  function set<K extends keyof ProtagonistData>(k: K, v: ProtagonistData[K]) {
    onChange({ ...value, [k]: v })
  }

  function bumpAttr(key: keyof Attributes, delta: number) {
    if (delta > 0 && left <= 0) return
    if (delta < 0 && attrs[key] <= BASE_ATTR) return
    set('customAttributes', { ...attrs, [key]: attrs[key] + delta })
  }

  function addSkill() {
    if (!draft.name.trim() || skills.length >= SKILL_CAP) return
    set('startingSkills', [...skills, { name: draft.name.trim(), skillType: draft.skillType, tier: wordToTier(draft.tier, COMPETENCY_TIERS) }])
    setDraft({ name: '', skillType: 'Active', tier: 'Novice' })
    setSkillOpen(false)
  }

  function removeSkill(i: number) {
    set('startingSkills', skills.filter((_, idx) => idx !== i))
  }

  return (
    <ChapterShell
      numeral="I"
      title="Protagonist"
      subtitle="Who they are"
      accent="#e8ca8a"
      onBack={onBack}
      footer={
        <>
          <GhostButton onClick={onBack}>Later</GhostButton>
          <PrimaryButton onClick={onFinalize} disabled={!ready}>{ready ? 'Finalize' : 'Name + Class needed'}</PrimaryButton>
        </>
      }
    >
      <div className="flex gap-1.5">
        {(['identity', 'origin', 'build'] as Sub[]).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setSub(s)}
            className={`flex-1 rounded-lg py-1.5 font-display text-[11px] font-bold uppercase tracking-wide transition-colors ${
              sub === s ? 'bg-[#e8ca8a] text-[#1a1420]' : 'bg-[#100d1a] border border-[#3a3252] text-[#9d93bd]'
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      <LibraryPresetBar
        items={templates.map((t) => ({ id: t.id || t.name, name: t.name, subtitle: t.className }))}
        onLoad={(id) => {
          const t = templates.find((x) => (x.id || x.name) === id)
          if (t) onChange({ ...t, id: value.id })
        }}
        onSaveCurrent={() => value.name.trim() && onSavePreset?.(value)}
        onDelete={onDeletePreset}
      />

      {sub === 'identity' && (
        <div className="flex flex-col gap-3">
          <Field label="Name">
            <input className={FIELD} value={value.name} onChange={(e) => set('name', e.target.value)} placeholder="Kei Ashborn" />
          </Field>
          <Field label="Class">
            <div className="grid grid-cols-3 gap-1.5">
              {PRESET_CLASSES.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => set('classId', c.id)}
                  className={`rounded-lg py-2 font-sans text-[11px] transition-colors ${
                    value.classId === c.id ? 'bg-[#e8ca8a] text-[#1a1420] font-bold' : 'bg-[#100d1a] border border-[#3a3252] text-[#d8cbb0]'
                  }`}
                >
                  {c.name}
                </button>
              ))}
            </div>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Age">
              <input
                type="number"
                min="0"
                max="999"
                placeholder="24"
                className={FIELD}
                value={value.age ?? ''}
                onFocus={(e) => e.target.select()}
                onChange={(e) => set('age', e.target.value ? Number(e.target.value) : undefined)}
              />
            </Field>
            <Field label="Gender">
              <input className={FIELD} value={value.gender ?? ''} onChange={(e) => set('gender', e.target.value)} />
            </Field>
          </div>
        </div>
      )}

      {sub === 'origin' && (
        <div className="flex flex-col gap-3">
          <Field label="Origin" tip="Backstory, family, upbringing.">
            <textarea rows={3} className={FIELD} value={value.background ?? ''} onChange={(e) => set('background', e.target.value)} />
          </Field>
          <Field label="Drive" tip="What they want most.">
            <textarea rows={2} className={FIELD} value={value.motivation ?? ''} onChange={(e) => set('motivation', e.target.value)} />
          </Field>
          <Field label="Trait" tip="A distinguishing feature or flaw.">
            <input className={FIELD} value={value.physicalTrait ?? ''} onChange={(e) => set('physicalTrait', e.target.value)} />
          </Field>
          <Field label="Secret" tip="Something the narrator can plant hooks around.">
            <textarea rows={2} className={FIELD} value={value.secret ?? ''} onChange={(e) => set('secret', e.target.value)} />
          </Field>
        </div>
      )}

      {sub === 'build' && (
        <div className="flex flex-col gap-4">
          <Field label="Attributes" tip={`${POOL} points over base ${BASE_ATTR}.`}>
            <div className="flex items-center gap-2 mb-2">
              <Pill tone={left === 0 ? 'gold' : 'default'}>{left} left</Pill>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {(['STR', 'INT', 'AGI'] as (keyof Attributes)[]).map((k) => (
                <div key={k} className="rounded-lg border border-[#3a3252] bg-[#100d1a] p-2 flex flex-col items-center gap-1">
                  <span className="font-mono text-[10px] text-[#9d93bd]">{k}</span>
                  <span className="font-display text-lg font-bold text-[#f5dfa0]">{attrs[k]}</span>
                  <div className="flex gap-1">
                    <button type="button" onClick={() => bumpAttr(k, -1)} className="w-6 h-6 rounded bg-[#1c1830] text-[#d8cbb0] text-xs">−</button>
                    <button type="button" onClick={() => bumpAttr(k, 1)} className="w-6 h-6 rounded bg-[#1c1830] text-[#d8cbb0] text-xs">+</button>
                  </div>
                </div>
              ))}
            </div>
          </Field>

          <Field label={`Abilities (${skills.length}/${SKILL_CAP})`} tip="Optional — stronger skills mean tougher opposition from Turn 1.">
            <div className="flex flex-col gap-1.5">
              {skills.map((s, i) => (
                <div key={i} className="flex items-center justify-between rounded-lg border border-[#3a3252] bg-[#100d1a] px-2.5 py-1.5">
                  <span className="font-sans text-[12px] text-[#d8cbb0] truncate">{s.name} <span className="text-[#6b6285]">· {s.tier !== undefined ? tierToWord(s.tier, COMPETENCY_TIERS) : 'Novice'}</span></span>
                  <button type="button" onClick={() => removeSkill(i)} className="text-[#9d93bd] hover:text-rose-300 shrink-0"><Trash2 size={12} /></button>
                </div>
              ))}
              {skills.length < SKILL_CAP && !skillOpen && (
                <button type="button" onClick={() => setSkillOpen(true)} className="flex items-center justify-center gap-1 rounded-lg border border-dashed border-[#3a3252] py-2 text-[11px] font-mono text-[#9d93bd]">
                  <Plus size={12} /> Add ability
                </button>
              )}
              {skillOpen && (
                <div className="rounded-lg border border-[#3a3252] bg-[#100d1a] p-2.5 flex flex-col gap-2">
                  <input className={`${FIELD} !py-1.5`} placeholder="Name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
                  <div className="grid grid-cols-2 gap-1.5">
                    <select className={`${FIELD} !py-1.5`} value={draft.skillType} onChange={(e) => setDraft({ ...draft, skillType: e.target.value })}>
                      {['Active', 'Passive', 'Utility'].map((t) => <option key={t}>{t}</option>)}
                    </select>
                    <select className={`${FIELD} !py-1.5`} value={draft.tier} onChange={(e) => setDraft({ ...draft, tier: e.target.value })}>
                      {['Novice', 'Adept', 'Master'].map((t) => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                  <div className="flex gap-2">
                    <PrimaryButton onClick={addSkill} icon={Wand2}>Add</PrimaryButton>
                    <GhostButton onClick={() => setSkillOpen(false)}>Cancel</GhostButton>
                  </div>
                </div>
              )}
            </div>
          </Field>

          <Field label="Key Item" tip="Optional — a special item they carry in.">
            <input className={FIELD} value={value.keyItem ?? ''} onChange={(e) => set('keyItem', e.target.value)} placeholder="Skip if none" />
          </Field>
        </div>
      )}
    </ChapterShell>
  )
}
