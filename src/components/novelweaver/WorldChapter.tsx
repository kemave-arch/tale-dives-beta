import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import type { WorldData, WorldFaction, WorldLocation } from '../../types.ts'
import { ChapterShell, Field, FIELD, GhostButton, LibraryPresetBar, PrimaryButton } from './shared.tsx'

interface Props {
  value: Partial<WorldData>
  onChange: (next: Partial<WorldData>) => void
  ready: boolean
  onFinalize: () => void
  onBack: () => void
  templates: WorldData[]
  onSavePreset?: (w: WorldData) => void
  onDeletePreset?: (id: string) => void
}

type Sub = 'overview' | 'depth' | 'factions' | 'locations'

const ATTITUDES: WorldFaction['attitude'][] = ['allied', 'friendly', 'neutral', 'hostile', 'rival']

export default function WorldChapter({ value, onChange, ready, onFinalize, onBack, templates, onSavePreset, onDeletePreset }: Props) {
  const [sub, setSub] = useState<Sub>('overview')
  const [facOpen, setFacOpen] = useState(false)
  const [facDraft, setFacDraft] = useState<WorldFaction>({ name: '', attitude: 'neutral' })
  const [locOpen, setLocOpen] = useState(false)
  const [locDraft, setLocDraft] = useState<WorldLocation>({ name: '' })

  const factions = value.factionsList ?? []
  const locations = value.locationsList ?? []

  function set<K extends keyof WorldData>(k: K, v: WorldData[K]) {
    onChange({ ...value, [k]: v })
  }

  function addFaction() {
    if (!facDraft.name.trim()) return
    set('factionsList', [...factions, { ...facDraft, name: facDraft.name.trim() }])
    setFacDraft({ name: '', attitude: 'neutral' })
    setFacOpen(false)
  }

  function addLocation() {
    if (!locDraft.name.trim()) return
    set('locationsList', [...locations, { ...locDraft, name: locDraft.name.trim() }])
    setLocDraft({ name: '' })
    setLocOpen(false)
  }

  return (
    <ChapterShell
      numeral="II"
      title="World"
      subtitle="Where it happens"
      accent="#8ac6e8"
      onBack={onBack}
      footer={
        <>
          <GhostButton onClick={onBack}>Later</GhostButton>
          <PrimaryButton onClick={onFinalize} disabled={!ready}>{ready ? 'Finalize' : 'Name + Setting needed'}</PrimaryButton>
        </>
      }
    >
      <div className="flex gap-1.5 flex-wrap">
        {(['overview', 'depth', 'factions', 'locations'] as Sub[]).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setSub(s)}
            className={`flex-1 min-w-[70px] rounded-lg py-1.5 font-display text-[10.5px] font-bold uppercase tracking-wide transition-colors ${
              sub === s ? 'bg-[#8ac6e8] text-[#0d1a22]' : 'bg-[#100d1a] border border-[#3a3252] text-[#9d93bd]'
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      <LibraryPresetBar
        items={templates.map((t) => ({ id: t.id || t.name, name: t.name, subtitle: t.genreTone }))}
        onLoad={(id) => {
          const t = templates.find((x) => (x.id || x.name) === id)
          if (t) onChange({ ...t, id: value.id })
        }}
        onSaveCurrent={() => value.name?.trim() && onSavePreset?.(value as WorldData)}
        onDelete={onDeletePreset}
      />

      {sub === 'overview' && (
        <div className="flex flex-col gap-3">
          <Field label="Name">
            <input className={FIELD} value={value.name ?? ''} onChange={(e) => set('name', e.target.value)} placeholder="Navarre" />
          </Field>
          <Field label="Tone" tip="Genre and mood in a phrase.">
            <input className={FIELD} value={value.genreTone ?? ''} onChange={(e) => set('genreTone', e.target.value)} placeholder="Grimdark war fantasy" />
          </Field>
          <Field label="Conflict" tip="The central tension driving the world.">
            <textarea rows={2} className={FIELD} value={value.conflict ?? ''} onChange={(e) => set('conflict', e.target.value)} />
          </Field>
          <Field label="Setting" tip="The world itself — geography, history, stakes.">
            <textarea rows={4} className={FIELD} value={value.background ?? ''} onChange={(e) => set('background', e.target.value)} />
          </Field>
        </div>
      )}

      {sub === 'depth' && (
        <div className="flex flex-col gap-3">
          <Field label="Power System" tip="How power works here — magic, tech, pure skill.">
            <textarea rows={2} className={FIELD} value={value.powerSystem ?? ''} onChange={(e) => set('powerSystem', e.target.value)} />
          </Field>
          <Field label="Era" tip="e.g. Medieval high fantasy, Magitech steampunk.">
            <input className={FIELD} value={value.eraTechLevel ?? ''} onChange={(e) => set('eraTechLevel', e.target.value)} />
          </Field>
          <Field label="Narration Style" tip="Voice and pacing for the narrator.">
            <textarea rows={2} className={FIELD} value={value.narrationStyle ?? ''} onChange={(e) => set('narrationStyle', e.target.value)} />
          </Field>
        </div>
      )}

      {sub === 'factions' && (
        <div className="flex flex-col gap-1.5">
          {factions.map((f, i) => (
            <div key={i} className="flex items-center justify-between rounded-lg border border-[#3a3252] bg-[#100d1a] px-2.5 py-1.5">
              <span className="font-sans text-[12px] text-[#d8cbb0] truncate">{f.name} <span className="text-[#6b6285]">· {f.attitude}</span></span>
              <button type="button" onClick={() => set('factionsList', factions.filter((_, idx) => idx !== i))} className="text-[#9d93bd] hover:text-rose-300 shrink-0"><Trash2 size={12} /></button>
            </div>
          ))}
          {!facOpen && (
            <button type="button" onClick={() => setFacOpen(true)} className="flex items-center justify-center gap-1 rounded-lg border border-dashed border-[#3a3252] py-2 text-[11px] font-mono text-[#9d93bd]">
              <Plus size={12} /> Add faction
            </button>
          )}
          {facOpen && (
            <div className="rounded-lg border border-[#3a3252] bg-[#100d1a] p-2.5 flex flex-col gap-2">
              <input className={`${FIELD} !py-1.5`} placeholder="Name" value={facDraft.name} onChange={(e) => setFacDraft({ ...facDraft, name: e.target.value })} />
              <select className={`${FIELD} !py-1.5`} value={facDraft.attitude} onChange={(e) => setFacDraft({ ...facDraft, attitude: e.target.value as WorldFaction['attitude'] })}>
                {ATTITUDES.map((a) => <option key={a}>{a}</option>)}
              </select>
              <input className={`${FIELD} !py-1.5`} placeholder="Territory (optional)" value={facDraft.territory ?? ''} onChange={(e) => setFacDraft({ ...facDraft, territory: e.target.value })} />
              <textarea rows={2} className={`${FIELD} !py-1.5`} placeholder="Description (optional)" value={facDraft.description ?? ''} onChange={(e) => setFacDraft({ ...facDraft, description: e.target.value })} />
              <div className="flex gap-2">
                <PrimaryButton onClick={addFaction}>Add</PrimaryButton>
                <GhostButton onClick={() => setFacOpen(false)}>Cancel</GhostButton>
              </div>
            </div>
          )}
        </div>
      )}

      {sub === 'locations' && (
        <div className="flex flex-col gap-1.5">
          {locations.map((l, i) => (
            <div key={i} className="flex items-center justify-between rounded-lg border border-[#3a3252] bg-[#100d1a] px-2.5 py-1.5">
              <span className="font-sans text-[12px] text-[#d8cbb0] truncate">{l.name} <span className="text-[#6b6285]">· {l.locationType || 'place'}</span></span>
              <button type="button" onClick={() => set('locationsList', locations.filter((_, idx) => idx !== i))} className="text-[#9d93bd] hover:text-rose-300 shrink-0"><Trash2 size={12} /></button>
            </div>
          ))}
          {!locOpen && (
            <button type="button" onClick={() => setLocOpen(true)} className="flex items-center justify-center gap-1 rounded-lg border border-dashed border-[#3a3252] py-2 text-[11px] font-mono text-[#9d93bd]">
              <Plus size={12} /> Add location
            </button>
          )}
          {locOpen && (
            <div className="rounded-lg border border-[#3a3252] bg-[#100d1a] p-2.5 flex flex-col gap-2">
              <input className={`${FIELD} !py-1.5`} placeholder="Name" value={locDraft.name} onChange={(e) => setLocDraft({ ...locDraft, name: e.target.value })} />
              <div className="grid grid-cols-2 gap-1.5">
                <input className={`${FIELD} !py-1.5`} placeholder="Region" value={locDraft.region ?? ''} onChange={(e) => setLocDraft({ ...locDraft, region: e.target.value })} />
                <input className={`${FIELD} !py-1.5`} placeholder="Type" value={locDraft.locationType ?? ''} onChange={(e) => setLocDraft({ ...locDraft, locationType: e.target.value })} />
              </div>
              <input className={`${FIELD} !py-1.5`} placeholder="Danger level (optional)" value={locDraft.dangerLevel ?? ''} onChange={(e) => setLocDraft({ ...locDraft, dangerLevel: e.target.value })} />
              <textarea rows={2} className={`${FIELD} !py-1.5`} placeholder="Description (optional)" value={locDraft.description ?? ''} onChange={(e) => setLocDraft({ ...locDraft, description: e.target.value })} />
              <div className="flex gap-2">
                <PrimaryButton onClick={addLocation}>Add</PrimaryButton>
                <GhostButton onClick={() => setLocOpen(false)}>Cancel</GhostButton>
              </div>
            </div>
          )}
        </div>
      )}
    </ChapterShell>
  )
}
