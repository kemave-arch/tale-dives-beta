import { useState } from 'react'
import { loadTextPresets, saveTextPreset, deleteTextPreset } from '../../lib/store.ts'
import type { SavedPreset } from '../../types.ts'
import { ChapterShell, Field, FIELD, GhostButton, Pill, PresetBar, PrimaryButton } from './shared.tsx'
import type { NarrativeSeed } from './types.ts'

interface Props {
  value: NarrativeSeed
  onChange: (next: NarrativeSeed) => void
  existingTitles: string[]
  onBegin: () => void
  onBack: () => void
}

export default function NarrativeChapter({ value, onChange, existingTitles, onBegin, onBack }: Props) {
  const [presets, setPresets] = useState<SavedPreset[]>(() => loadTextPresets('novelNarrative'))

  const titleTaken = value.title.trim().length > 0 && existingTitles.includes(value.title.trim())
  const ready = value.title.trim().length > 0 && value.opening.trim().length > 0 && !titleTaken

  function set<K extends keyof NarrativeSeed>(k: K, v: NarrativeSeed[K]) {
    onChange({ ...value, [k]: v })
  }

  return (
    <ChapterShell
      numeral="IV"
      title="Narrative"
      subtitle="How it begins"
      accent="#e8a8c6"
      onBack={onBack}
      footer={
        <>
          <GhostButton onClick={onBack}>Back</GhostButton>
          <PrimaryButton onClick={onBegin} disabled={!ready}>Begin the Tale</PrimaryButton>
        </>
      }
    >
      <PresetBar
        presets={presets}
        onSave={(name) => setPresets(saveTextPreset('novelNarrative', name, JSON.stringify(value)))}
        onLoad={(p) => {
          try {
            onChange(JSON.parse(p.value) as NarrativeSeed)
          } catch { /* corrupt preset, ignore */ }
        }}
        onDelete={(id) => setPresets(deleteTextPreset('novelNarrative', id))}
      />

      <Field label="Tale Title">
        <input className={FIELD} value={value.title} onChange={(e) => set('title', e.target.value)} placeholder="Kei Ashborn's Tale" />
        {titleTaken && <p className="mt-1 text-[10.5px] font-mono text-rose-300">Already used by another Tale.</p>}
      </Field>

      <Field label="Opening Scene" tip="What the protagonist is doing the moment the Tale starts.">
        <textarea rows={5} className={FIELD} value={value.opening} onChange={(e) => set('opening', e.target.value)} />
      </Field>

      <Field label="Narration Style" tip="Voice, pacing, tense — leave blank to inherit the World's.">
        <textarea rows={2} className={FIELD} value={value.narrationStyle} onChange={(e) => set('narrationStyle', e.target.value)} />
      </Field>

      <Field label="Combat Mode">
        <div className="flex gap-2">
          {(['NARRATIVE', 'TACTICAL'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => set('combatMode', m)}
              className={`flex-1 rounded-lg py-2 font-display text-[11px] font-bold uppercase tracking-wide transition-colors ${
                value.combatMode === m ? 'bg-[#e8a8c6] text-[#22101a]' : 'bg-[#100d1a] border border-[#3a3252] text-[#9d93bd]'
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </Field>

      <Pill>Turn 1 fires the moment you begin — this is the last stop.</Pill>
    </ChapterShell>
  )
}
