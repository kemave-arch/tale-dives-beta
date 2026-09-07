import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { loadTextPresets, saveTextPreset, deleteTextPreset, newId } from '../../lib/store.ts'
import type { SavedPreset } from '../../types.ts'
import { ChapterShell, Field, FIELD, GhostButton, PresetBar, PrimaryButton } from './shared.tsx'
import type { CastMember } from './types.ts'

interface Props {
  value: CastMember[]
  onChange: (next: CastMember[]) => void
  ready: boolean
  onFinalize: () => void
  onBack: () => void
}

const ATTITUDES: CastMember['attitude'][] = ['allied', 'friendly', 'neutral', 'hostile', 'rival']

function blankMember(): CastMember {
  return { id: newId('cast'), name: '', attitude: 'neutral', affection: 0, trust: 0 }
}

export default function CastChapter({ value, onChange, ready, onFinalize, onBack }: Props) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<CastMember>(blankMember())
  const [presets, setPresets] = useState<SavedPreset[]>(() => loadTextPresets('novelCast'))

  function add() {
    if (!draft.name.trim()) return
    onChange([...value, { ...draft, name: draft.name.trim() }])
    setDraft(blankMember())
    setOpen(false)
  }

  function remove(id: string) {
    onChange(value.filter((m) => m.id !== id))
  }

  return (
    <ChapterShell
      numeral="III"
      title="Cast"
      subtitle="Who they'll meet"
      accent="#a8e8c6"
      onBack={onBack}
      footer={
        <>
          <GhostButton onClick={onBack}>Later</GhostButton>
          <PrimaryButton onClick={onFinalize} disabled={!ready}>Finalize</PrimaryButton>
        </>
      }
    >
      <PresetBar
        presets={presets}
        onSave={(name) => setPresets(saveTextPreset('novelCast', name, JSON.stringify(value)))}
        onLoad={(p) => {
          try {
            const parsed = JSON.parse(p.value) as CastMember[]
            onChange(parsed.map((m) => ({ ...m, id: m.id || newId('cast') })))
          } catch { /* corrupt preset, ignore */ }
        }}
        onDelete={(id) => setPresets(deleteTextPreset('novelCast', id))}
      />

      <div className="flex flex-col gap-1.5">
        {value.length === 0 && !open && (
          <p className="text-[11px] font-sans italic text-[#6b6285] text-center py-3">No starting companions yet — optional.</p>
        )}
        {value.map((m) => (
          <div key={m.id} className="flex items-center justify-between rounded-lg border border-[#3a3252] bg-[#100d1a] px-2.5 py-1.5">
            <span className="font-sans text-[12px] text-[#d8cbb0] truncate">
              {m.name} <span className="text-[#6b6285]">· {m.role || 'unspecified'} · {m.attitude}</span>
            </span>
            <button type="button" onClick={() => remove(m.id)} className="text-[#9d93bd] hover:text-rose-300 shrink-0"><Trash2 size={12} /></button>
          </div>
        ))}
        {!open && (
          <button type="button" onClick={() => setOpen(true)} className="flex items-center justify-center gap-1 rounded-lg border border-dashed border-[#3a3252] py-2 text-[11px] font-mono text-[#9d93bd]">
            <Plus size={12} /> Add companion
          </button>
        )}
        {open && (
          <div className="rounded-lg border border-[#3a3252] bg-[#100d1a] p-2.5 flex flex-col gap-2">
            <div className="grid grid-cols-2 gap-1.5">
              <input className={`${FIELD} !py-1.5`} placeholder="Name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
              <input className={`${FIELD} !py-1.5`} placeholder="Role" value={draft.role ?? ''} onChange={(e) => setDraft({ ...draft, role: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <input className={`${FIELD} !py-1.5`} placeholder="Gender" value={draft.gender ?? ''} onChange={(e) => setDraft({ ...draft, gender: e.target.value })} />
              <select className={`${FIELD} !py-1.5`} value={draft.attitude} onChange={(e) => setDraft({ ...draft, attitude: e.target.value as CastMember['attitude'] })}>
                {ATTITUDES.map((a) => <option key={a}>{a}</option>)}
              </select>
            </div>
            <Field label="Affection / Trust">
              <div className="grid grid-cols-2 gap-1.5">
                <input
                  type="number"
                  min={-100}
                  max={100}
                  placeholder="0"
                  className={`${FIELD} !py-1.5`}
                  value={draft.affection === 0 ? '' : draft.affection}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => setDraft({ ...draft, affection: e.target.value === '' || e.target.value === '-' ? 0 : (Number(e.target.value) || 0) })}
                />
                <input
                  type="number"
                  min={-100}
                  max={100}
                  placeholder="0"
                  className={`${FIELD} !py-1.5`}
                  value={draft.trust === 0 ? '' : draft.trust}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => setDraft({ ...draft, trust: e.target.value === '' || e.target.value === '-' ? 0 : (Number(e.target.value) || 0) })}
                />
              </div>
            </Field>
            <div className="grid grid-cols-2 gap-1.5">
              <input className={`${FIELD} !py-1.5`} placeholder="Held weapon" value={draft.heldWeapon ?? ''} onChange={(e) => setDraft({ ...draft, heldWeapon: e.target.value })} />
              <input className={`${FIELD} !py-1.5`} placeholder="Worn armor" value={draft.wornArmor ?? ''} onChange={(e) => setDraft({ ...draft, wornArmor: e.target.value })} />
            </div>
            <input className={`${FIELD} !py-1.5`} placeholder="Faction (optional)" value={draft.factionId ?? ''} onChange={(e) => setDraft({ ...draft, factionId: e.target.value })} />
            <textarea rows={2} className={`${FIELD} !py-1.5`} placeholder="Personality" value={draft.personality ?? ''} onChange={(e) => setDraft({ ...draft, personality: e.target.value })} />
            <textarea rows={2} className={`${FIELD} !py-1.5`} placeholder="Secret (optional)" value={draft.secret ?? ''} onChange={(e) => setDraft({ ...draft, secret: e.target.value })} />
            <textarea rows={2} className={`${FIELD} !py-1.5`} placeholder="Description (optional)" value={draft.description ?? ''} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
            <div className="flex gap-2">
              <PrimaryButton onClick={add}>Add</PrimaryButton>
              <GhostButton onClick={() => setOpen(false)}>Cancel</GhostButton>
            </div>
          </div>
        )}
      </div>
    </ChapterShell>
  )
}
