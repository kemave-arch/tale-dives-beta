import { useEffect, useRef, useState } from 'react'
import {
  ArrowLeft, ArrowRight, ChevronRight, Zap, Sparkles, BookOpen, Users, Landmark, Shield,
  ScrollText, Flag, Save, FolderOpen, X, CheckCircle2, Loader2, Trash2, Info,
} from 'lucide-react'
import { GlassScreen } from '../lib/glassChrome.tsx'
import { useConfirm } from '../lib/useConfirm.tsx'
import type { ApiSettings } from '../types.ts'
import {
  TALE_WEAVER_PHASES, emptyAccumulated, runTaleWeaverPhase, mergeTaleWeaverDraft,
  type TaleWeaverAccumulated, type TaleWeaverPhaseDef,
} from '../lib/taleWeaving.ts'
import {
  getTaleWeaverPresets, saveTaleWeaverPreset, deleteTaleWeaverPreset,
  type TaleWeaverPreset,
} from '../lib/taleWeaverPresets.ts'
import { loadTaleWeaverAutosave, saveTaleWeaverAutosave, clearTaleWeaverAutosave } from '../lib/taleWeaverAutosave.ts'
import { hasAnyContent } from './TaleWeaver.tsx'

// Quick Play — the same full Tale Weaving generator behind the scenes (every
// one of TALE_WEAVER_PHASES actually runs), just asked through 3 plain
// questions instead of 7 guided phases, so a player who wants to dive in
// fast never sees the phase machinery at all. Generation for each question
// fires in the background the moment it's answered — nothing is shown
// inline — and everything lands together on the Tale Initiation Overview
// (step 3) for one compact review pass before Dive In.

interface QuickPlayProps {
  apiSettings: ApiSettings
  onBack: () => void
  onBeginTale: (accumulated: TaleWeaverAccumulated) => void
}

type GenKey = 'world' | 'regions' | 'factions' | 'protagonist' | 'npcs' | 'lore' | 'arc'
type GenStatus = 'idle' | 'running' | 'done' | 'error'

const GEN_LABELS: Record<GenKey, string> = {
  world: 'World Foundation',
  regions: 'Regions & Locations',
  factions: 'Factions',
  protagonist: 'Protagonist',
  npcs: 'Cast of Characters',
  lore: 'Lore & Secrets',
  arc: 'Story Arc',
}

const QUICK_PLAY_QUESTIONS = [
  {
    eyebrow: 'Question I',
    title: 'What Realm Calls to You?',
    prompt:
      "Name a novel, a film, an era — or simply describe the world as your imagination shapes it. Its foundation, key places, powers, and factions will be woven from here.",
    placeholder: 'e.g. "A world like Fourth Wing, but with sea-faring dragon riders" or "A rain-soaked cyberpunk sprawl ruled by five corporations"…',
    keys: ['world', 'regions', 'factions'] as GenKey[],
  },
  {
    eyebrow: 'Question II',
    title: 'Who Shall You Become?',
    prompt:
      "Describe your hero's background, the kind of person you want to play, and — if you like — the powers or skills you begin with. Leave it to the Tale Weaver if you'd rather be surprised.",
    placeholder: 'e.g. "A disgraced knight seeking redemption, quick-tempered but fiercely loyal, wields a cursed blade"…',
    keys: ['protagonist'] as GenKey[],
  },
  {
    eyebrow: 'Question III',
    title: 'How Does Your Story Begin?',
    prompt:
      "Describe a companion or two who already know you, and how you're drawn into this world's opening scene. Leave it to the Tale Weaver if you'd rather be surprised.",
    placeholder: 'e.g. "A childhood friend who now serves the enemy faction, and I begin captured in their dungeon"…',
    keys: ['npcs', 'lore', 'arc'] as GenKey[],
  },
]

function phaseFor(id: GenKey): TaleWeaverPhaseDef {
  return TALE_WEAVER_PHASES.find((p) => p.id === id)!
}

function hasGenContent(key: GenKey, acc: TaleWeaverAccumulated): boolean {
  switch (key) {
    case 'world':
      return Boolean(acc.world?.name?.trim() || acc.world?.background?.trim())
    case 'protagonist':
      return Boolean(acc.protagonist?.name?.trim())
    case 'regions':
      return acc.regions.length > 0 || acc.locations.length > 0
    case 'factions':
      return acc.factions.length > 0
    case 'npcs':
      return acc.npcs.length > 0
    case 'lore':
      return acc.lore.length > 0
    case 'arc':
      return acc.beats.length > 0 || Boolean(acc.deathRule) || Boolean(acc.endGameRules)
  }
}

function StatusPip({ status }: { status: GenStatus }) {
  if (status === 'running') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-wide text-gold-primary">
        <Loader2 size={11} className="animate-spin" /> Weaving…
      </span>
    )
  }
  if (status === 'error') {
    return <span className="text-[10px] font-mono uppercase tracking-wide text-rose">Failed</span>
  }
  if (status === 'done') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-wide text-emerald">
        <CheckCircle2 size={11} /> Ready
      </span>
    )
  }
  return <span className="text-[10px] font-mono uppercase tracking-wide text-ink-muted/50">Pending</span>
}

function AccordionSection({
  icon: Icon, label, status, defaultOpen = false, children,
}: {
  icon: typeof Sparkles; label: string; status: GenStatus; defaultOpen?: boolean; children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="rounded-xl border border-gold-accent/25 bg-white shadow-xs overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-2 px-3.5 py-2.5 text-left hover:bg-gold-accent/5 transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0">
          <Icon size={15} className="text-gold-primary shrink-0" />
          <span className="font-display font-bold text-xs uppercase tracking-wider text-ink truncate">{label}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <StatusPip status={status} />
          <ChevronRight size={14} className={`text-gold-primary transition-transform duration-150 ${open ? 'rotate-90' : ''}`} />
        </div>
      </button>
      {open && <div className="px-3.5 pb-3.5 pt-1 border-t border-gold-accent/15 flex flex-col gap-2">{children}</div>}
    </div>
  )
}

function EmptyNote({ status }: { status: GenStatus }) {
  return (
    <p className="font-narrative italic text-xs text-ink-muted py-1">
      {status === 'running' ? 'Still being woven…' : status === 'error' ? 'This part slipped — you can still Dive In without it.' : 'Nothing woven here yet.'}
    </p>
  )
}

export default function QuickPlay({ apiSettings, onBack, onBeginTale }: QuickPlayProps) {
  const [initialAutosave] = useState(() => loadTaleWeaverAutosave('quickplay'))
  const [step, setStep] = useState(initialAutosave?.step ?? 0)
  const [q1, setQ1] = useState(initialAutosave?.q1 ?? '')
  const [q2, setQ2] = useState(initialAutosave?.q2 ?? '')
  const [q3, setQ3] = useState(initialAutosave?.q3 ?? '')
  const [accumulated, setAccumulated] = useState<TaleWeaverAccumulated>(initialAutosave?.accumulated ?? emptyAccumulated())
  const [autosaveToast, setAutosaveToast] = useState<string | null>(
    initialAutosave && (hasAnyContent(initialAutosave.accumulated) || initialAutosave.q1 || initialAutosave.q2 || initialAutosave.q3)
      ? 'Resumed your in-progress draft.'
      : null,
  )

  const accRef = useRef(accumulated)
  const chainRef = useRef<Promise<void>>(Promise.resolve())

  const initialStatus = {} as Record<GenKey, GenStatus>
  ;(Object.keys(GEN_LABELS) as GenKey[]).forEach((k) => {
    initialStatus[k] = hasGenContent(k, accumulated) ? 'done' : 'idle'
  })
  const [genStatus, setGenStatus] = useState<Record<GenKey, GenStatus>>(initialStatus)

  const [showSaveModal, setShowSaveModal] = useState(false)
  const [showLoadModal, setShowLoadModal] = useState(false)
  const [presetNameInput, setPresetNameInput] = useState('')
  const [savedPresets, setSavedPresets] = useState<TaleWeaverPreset[]>([])
  const [presetToast, setPresetToast] = useState<string | null>(null)

  const { confirm, dialog: confirmDialog } = useConfirm()

  useEffect(() => {
    if (!autosaveToast && !presetToast) return
    const t = setTimeout(() => {
      setAutosaveToast(null)
      setPresetToast(null)
    }, 3500)
    return () => clearTimeout(t)
  }, [autosaveToast, presetToast])

  useEffect(() => {
    if (!hasAnyContent(accumulated) && !q1.trim() && !q2.trim() && !q3.trim()) return
    saveTaleWeaverAutosave('quickplay', { accumulated, step, q1, q2, q3 })
  }, [accumulated, step, q1, q2, q3])

  function mergeAndSet(patch: (prev: TaleWeaverAccumulated) => TaleWeaverAccumulated) {
    accRef.current = patch(accRef.current)
    setAccumulated(accRef.current)
  }

  function queueStages(keys: GenKey[], guidance: string) {
    chainRef.current = chainRef.current.then(async () => {
      for (const key of keys) {
        setGenStatus((s) => ({ ...s, [key]: 'running' }))
        const result = await runTaleWeaverPhase({ apiSettings, phase: phaseFor(key), accumulated: accRef.current, guidance })
        if (result.ok && result.draft) {
          mergeAndSet((prev) => mergeTaleWeaverDraft(prev, key, result.draft!))
          setGenStatus((s) => ({ ...s, [key]: 'done' }))
        } else {
          setGenStatus((s) => ({ ...s, [key]: 'error' }))
        }
      }
    })
  }

  function submitQuestion(idx: number, text: string) {
    queueStages(QUICK_PLAY_QUESTIONS[idx].keys, text.trim())
    setStep(idx + 1)
  }

  function removeEntry(category: 'regions' | 'locations' | 'factions' | 'npcs' | 'lore' | 'beats', id: string) {
    mergeAndSet((prev) => ({ ...prev, [category]: (prev[category] as { id: string }[]).filter((e) => e.id !== id) }))
  }

  async function handleSafeExit() {
    const hasDraftText = q1.trim() || q2.trim() || q3.trim()
    if (hasAnyContent(accumulated) || hasDraftText) {
      const ok = await confirm('Leave Quick Play? Your progress is saved automatically — you can pick up right where you left off.')
      if (!ok) return
    }
    onBack()
  }

  function handleDiveIn() {
    if (!hasAnyContent(accumulated)) return
    clearTaleWeaverAutosave('quickplay')
    onBeginTale(accumulated)
  }

  function handleSavePreset() {
    if (!presetNameInput.trim()) return
    saveTaleWeaverPreset(presetNameInput.trim(), accumulated)
    setShowSaveModal(false)
    setPresetToast(`Saved preset "${presetNameInput.trim()}"!`)
  }

  function handleOpenLoadModal() {
    setSavedPresets(getTaleWeaverPresets())
    setShowLoadModal(true)
  }

  function handleLoadPreset(preset: TaleWeaverPreset) {
    accRef.current = preset.accumulated
    setAccumulated(preset.accumulated)
    ;(Object.keys(GEN_LABELS) as GenKey[]).forEach((k) => {
      setGenStatus((s) => ({ ...s, [k]: hasGenContent(k, preset.accumulated) ? 'done' : 'idle' }))
    })
    setShowLoadModal(false)
    setStep(3)
    setPresetToast(`Loaded preset "${preset.name}"!`)
  }

  function handleDeletePreset(id: string) {
    setSavedPresets(deleteTaleWeaverPreset(id))
  }

  const stepLabels = ['Realm', 'Hero', 'Beginning', 'Overview']
  const anyRunning = (Object.values(genStatus) as GenStatus[]).some((s) => s === 'running')

  return (
    <GlassScreen ground="dark" className="parchment-surface !bg-[#fbf8f3] flex flex-col h-full overflow-hidden">
      <div className="max-w-2xl mx-auto w-full flex flex-col h-full overflow-hidden px-4 sm:px-6 pt-3 pb-4 gap-3">
        {/* Header */}
        <div className="flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <button type="button" onClick={handleSafeExit} className="p-1.5 rounded-md hover:bg-gold-accent/10 text-gold-primary shrink-0" title="Back">
              <ArrowLeft size={17} />
            </button>
            <div className="flex flex-col min-w-0">
              <span className="font-mono text-[9px] uppercase tracking-wider text-ink-muted/70 truncate">Tale Dives / Quick Play</span>
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-1.5 h-1.5 rounded-full bg-gold-primary shrink-0" />
                <span className="font-display text-[11px] sm:text-xs font-bold uppercase tracking-wider text-gold-primary shrink-0">
                  Step {step + 1} of 4
                </span>
                <span className="text-gold-accent/40 shrink-0">/</span>
                <span className="font-display text-[11px] sm:text-xs font-bold uppercase tracking-wider text-ink truncate">
                  {stepLabels[step]}
                </span>
              </div>
            </div>
          </div>
          <div className="shrink-0 inline-flex rounded-md border border-gold-accent/25 divide-x divide-gold-accent/15 bg-white shadow-xs overflow-hidden">
            <button
              type="button"
              onClick={handleOpenLoadModal}
              className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium text-ink-muted hover:text-ink hover:bg-gold-accent/10 transition-colors"
              title="Load a saved World & Character Preset"
            >
              <FolderOpen size={13} className="text-gold-primary" /><span>Load</span>
            </button>
            <button
              type="button"
              onClick={() => { setPresetNameInput(accumulated.world?.name || accumulated.title || ''); setShowSaveModal(true) }}
              disabled={!hasAnyContent(accumulated)}
              className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium text-ink-muted hover:text-ink hover:bg-gold-accent/10 disabled:opacity-40 transition-colors"
              title="Save current settings as a World & Character Preset"
            >
              <Save size={13} className="text-gold-primary" /><span>Save</span>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-3">
          {step < 3 ? (
            <QuestionScreen
              key={step}
              question={QUICK_PLAY_QUESTIONS[step]}
              value={step === 0 ? q1 : step === 1 ? q2 : q3}
              onChange={step === 0 ? setQ1 : step === 1 ? setQ2 : setQ3}
              onSubmit={(text) => submitQuestion(step, text)}
              onBack={step > 0 ? () => setStep(step - 1) : undefined}
              isLast={step === 2}
            />
          ) : (
            <TaleInitiationOverview
              accumulated={accumulated}
              genStatus={genStatus}
              anyRunning={anyRunning}
              onRemove={removeEntry}
              onReturn={() => setStep(2)}
              onDiveIn={handleDiveIn}
            />
          )}
        </div>
      </div>

      {(presetToast || autosaveToast) && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#b08830] text-white font-display font-bold text-xs shadow-2xl animate-in fade-in slide-in-from-top-3 duration-200">
          <CheckCircle2 size={15} />
          <span>{presetToast ?? autosaveToast}</span>
        </div>
      )}

      {showSaveModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setShowSaveModal(false)}>
          <div className="bg-white rounded-2xl p-5 w-full max-w-sm flex flex-col gap-3 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <span className="font-display font-bold text-sm text-gold-primary">Save Preset</span>
              <button type="button" onClick={() => setShowSaveModal(false)} className="text-ink-muted hover:text-ink"><X size={16} /></button>
            </div>
            <input
              type="text"
              autoFocus
              value={presetNameInput}
              onChange={(e) => setPresetNameInput(e.target.value)}
              placeholder="Preset name…"
              className="px-3 py-2 rounded-md bg-white border border-gold-accent/25 text-sm text-ink shadow-xs outline-none focus:border-gold-primary focus:ring-1 focus:ring-gold-primary"
            />
            <button
              type="button"
              onClick={handleSavePreset}
              disabled={!presetNameInput.trim()}
              className="px-4 py-2 rounded-lg bg-[#b08830] hover:bg-[#8d6b1d] text-white text-sm font-bold disabled:opacity-40 transition-colors"
            >
              Save
            </button>
          </div>
        </div>
      )}

      {showLoadModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setShowLoadModal(false)}>
          <div className="bg-white rounded-2xl p-5 w-full max-w-md max-h-[70vh] flex flex-col gap-3 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between shrink-0">
              <span className="font-display font-bold text-sm text-gold-primary">Load Preset</span>
              <button type="button" onClick={() => setShowLoadModal(false)} className="text-ink-muted hover:text-ink"><X size={16} /></button>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-2">
              {savedPresets.length === 0 ? (
                <p className="font-narrative italic text-sm text-ink-muted text-center py-6">No saved presets yet.</p>
              ) : (
                savedPresets.map((p) => (
                  <div key={p.id} className="rounded-lg border border-gold-accent/25 bg-[#faf8f4] px-3 py-2 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-display font-semibold text-xs text-ink truncate">{p.name}</p>
                      <p className="font-mono text-[10px] text-ink-muted/70">{new Date(p.createdAt).toLocaleDateString()}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button type="button" onClick={() => handleLoadPreset(p)} className="px-2.5 py-1 rounded-md bg-[#b08830] hover:bg-[#8d6b1d] text-white text-[11px] font-bold transition-colors">
                        Load
                      </button>
                      <button type="button" onClick={() => handleDeletePreset(p.id)} className="p-1.5 rounded-md text-ink-muted hover:text-rose hover:bg-rose-bg transition-colors">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {confirmDialog}
    </GlassScreen>
  )
}

function QuestionScreen({
  question, value, onChange, onSubmit, onBack, isLast,
}: {
  question: (typeof QUICK_PLAY_QUESTIONS)[number]
  value: string
  onChange: (v: string) => void
  onSubmit: (text: string) => void
  onBack?: () => void
  isLast: boolean
}) {
  return (
    <div className="flex-1 flex flex-col justify-center gap-4 py-4">
      <div className="flex flex-col gap-2">
        <span className="font-mono text-[10px] uppercase tracking-wider text-gold-primary/70">{question.eyebrow}</span>
        <h2 className="font-display font-bold text-xl sm:text-2xl text-ink">{question.title}</h2>
        <p className="font-narrative text-sm text-ink-muted leading-relaxed">{question.prompt}</p>
      </div>
      <textarea
        autoFocus
        rows={6}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={question.placeholder}
        className="w-full px-3.5 py-3 rounded-md bg-[#faf8f4] border border-gold-accent/25 text-sm text-ink placeholder:text-ink-muted/50 shadow-xs outline-none focus:border-gold-primary focus:ring-1 focus:ring-gold-primary resize-none leading-relaxed"
      />
      <p className="font-narrative italic text-xs text-ink-muted/70 flex items-center gap-1.5">
        <Info size={12} className="shrink-0" /> Leave this blank to let the Tale Weaver decide.
      </p>
      <div className="flex items-center w-full rounded-lg border border-gold-accent/30 bg-white shadow-xs overflow-hidden divide-x divide-gold-accent/15">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            className="flex-1 flex items-center justify-center gap-1.5 h-11 text-xs font-semibold text-ink-muted hover:text-ink hover:bg-gold-accent/10 transition-colors"
          >
            <ArrowLeft size={15} /><span>Back</span>
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => onSubmit(value)}
          className="flex-[1.4] flex items-center justify-center gap-1.5 h-11 bg-[#b08830] hover:bg-[#8d6b1d] text-white text-xs sm:text-sm font-semibold transition-colors"
        >
          <span>{isLast ? 'Weave the Tale' : 'Next'}</span><ArrowRight size={15} />
        </button>
      </div>
    </div>
  )
}

function TaleInitiationOverview({
  accumulated, genStatus, anyRunning, onRemove, onReturn, onDiveIn,
}: {
  accumulated: TaleWeaverAccumulated
  genStatus: Record<GenKey, GenStatus>
  anyRunning: boolean
  onRemove: (category: 'regions' | 'locations' | 'factions' | 'npcs' | 'lore' | 'beats', id: string) => void
  onReturn: () => void
  onDiveIn: () => void
}) {
  const w = accumulated.world
  const p = accumulated.protagonist

  return (
    <div className="flex-1 flex flex-col gap-3 py-2">
      <div className="flex flex-col gap-1">
        <span className="font-mono text-[10px] uppercase tracking-wider text-gold-primary/70">Question IV · Review</span>
        <h2 className="font-display font-bold text-xl text-ink">Tale Initiation Overview</h2>
        <p className="font-narrative text-sm text-ink-muted leading-relaxed">
          Everything woven so far — glance it over, trim anything you don't want, then Dive In.
        </p>
      </div>

      <AccordionSection icon={Sparkles} label="World Foundation" status={genStatus.world} defaultOpen>
        {w?.name || w?.background ? (
          <div className="flex flex-col gap-1">
            <p className="font-display font-bold text-sm text-ink">{w.name || 'Untitled World'}</p>
            <p className="font-narrative text-xs text-ink-muted leading-relaxed">
              {[w.genreTone, w.eraTechLevel].filter(Boolean).join(' · ')}
            </p>
            {w.background && <p className="font-narrative text-xs text-ink leading-relaxed line-clamp-4">{w.background}</p>}
          </div>
        ) : (
          <EmptyNote status={genStatus.world} />
        )}
      </AccordionSection>

      <AccordionSection icon={BookOpen} label="Protagonist" status={genStatus.protagonist}>
        {p?.name ? (
          <div className="flex flex-col gap-1">
            <p className="font-display font-bold text-sm text-ink">{p.name}{p.classHint ? ` — ${p.classHint}` : ''}</p>
            {p.background && <p className="font-narrative text-xs text-ink-muted leading-relaxed line-clamp-3">{p.background}</p>}
            {accumulated.skills.length > 0 && (
              <p className="font-mono text-[10px] text-gold-accent/80 uppercase tracking-wide">
                Skills: {accumulated.skills.map((s) => s.name).join(', ')}
              </p>
            )}
          </div>
        ) : (
          <EmptyNote status={genStatus.protagonist} />
        )}
      </AccordionSection>

      <AccordionSection icon={Landmark} label="Regions & Locations" status={genStatus.regions}>
        {accumulated.regions.length || accumulated.locations.length ? (
          <div className="flex flex-col gap-1.5">
            {accumulated.regions.map((r) => (
              <EntryRow key={r.id} name={r.name} desc={r.desc} onRemove={() => onRemove('regions', r.id)} />
            ))}
            {accumulated.locations.map((l) => (
              <EntryRow key={l.id} name={l.name} desc={l.desc} sub={l.locationType} onRemove={() => onRemove('locations', l.id)} />
            ))}
          </div>
        ) : (
          <EmptyNote status={genStatus.regions} />
        )}
      </AccordionSection>

      <AccordionSection icon={Shield} label="Factions" status={genStatus.factions}>
        {accumulated.factions.length ? (
          <div className="flex flex-col gap-1.5">
            {accumulated.factions.map((f) => (
              <EntryRow key={f.id} name={f.name} desc={f.desc} sub={f.attitude} onRemove={() => onRemove('factions', f.id)} />
            ))}
          </div>
        ) : (
          <EmptyNote status={genStatus.factions} />
        )}
      </AccordionSection>

      <AccordionSection icon={Users} label="Cast of Characters" status={genStatus.npcs}>
        {accumulated.npcs.length ? (
          <div className="flex flex-col gap-1.5">
            {accumulated.npcs.map((n) => (
              <EntryRow key={n.id} name={n.name} desc={n.personality} sub={n.role} onRemove={() => onRemove('npcs', n.id)} />
            ))}
          </div>
        ) : (
          <EmptyNote status={genStatus.npcs} />
        )}
      </AccordionSection>

      <AccordionSection icon={ScrollText} label="Lore & Secrets" status={genStatus.lore}>
        {accumulated.lore.length ? (
          <div className="flex flex-col gap-1.5">
            {accumulated.lore.map((l) => (
              <EntryRow key={l.id} name={l.name} desc={l.content} sub={l.category} onRemove={() => onRemove('lore', l.id)} />
            ))}
          </div>
        ) : (
          <EmptyNote status={genStatus.lore} />
        )}
      </AccordionSection>

      <AccordionSection icon={Flag} label="Story Arc" status={genStatus.arc}>
        {accumulated.beats.length || accumulated.deathRule || accumulated.endGameRules ? (
          <div className="flex flex-col gap-1.5">
            {accumulated.beats.map((b) => (
              <EntryRow key={b.id} name={b.title} desc={b.summary} onRemove={() => onRemove('beats', b.id)} />
            ))}
            <div className="pt-1.5 mt-1 border-t border-gold-accent/15 flex flex-wrap gap-1.5">
              <span className="font-mono text-[10px] uppercase tracking-wide text-gold-accent/80 border border-gold-accent/30 rounded-full px-2 py-0.5">
                {accumulated.pov === 'first' ? 'First Person' : 'Third Person'}
              </span>
              <span className="font-mono text-[10px] uppercase tracking-wide text-gold-accent/80 border border-gold-accent/30 rounded-full px-2 py-0.5">
                {accumulated.narrationMode === 'reactive' ? 'Reactive' : 'Immersive'}
              </span>
              <span className="font-mono text-[10px] uppercase tracking-wide text-gold-accent/80 border border-gold-accent/30 rounded-full px-2 py-0.5">
                {accumulated.difficulty ?? 'EXTREME'}
              </span>
            </div>
          </div>
        ) : (
          <EmptyNote status={genStatus.arc} />
        )}
      </AccordionSection>

      <div className="flex items-center w-full rounded-lg border border-gold-accent/30 bg-white shadow-xs overflow-hidden divide-x divide-gold-accent/15 mt-1 shrink-0">
        <button
          type="button"
          onClick={onReturn}
          className="flex-1 flex items-center justify-center gap-1.5 h-11 text-xs font-semibold text-ink-muted hover:text-ink hover:bg-gold-accent/10 transition-colors"
        >
          <ArrowLeft size={15} /><span>Back</span>
        </button>
        <button
          type="button"
          onClick={onDiveIn}
          disabled={anyRunning || !hasAnyContent(accumulated)}
          className="flex-[1.4] flex items-center justify-center gap-1.5 h-11 bg-[#b08830] hover:bg-[#8d6b1d] text-white text-xs sm:text-sm font-semibold disabled:opacity-40 transition-colors"
        >
          {anyRunning ? (
            <>
              <Loader2 size={15} className="animate-spin" /><span>Still Weaving…</span>
            </>
          ) : (
            <>
              <Zap size={15} /><span>Dive In</span>
            </>
          )}
        </button>
      </div>
    </div>
  )
}

function EntryRow({ name, desc, sub, onRemove }: { name: string; desc?: string; sub?: string; onRemove: () => void }) {
  return (
    <div className="flex items-start justify-between gap-2 rounded-md bg-[#faf8f4] border border-gold-accent/15 px-2.5 py-1.5">
      <div className="min-w-0">
        <p className="font-display font-semibold text-xs text-ink truncate">
          {name}{sub ? <span className="font-narrative italic font-normal text-ink-muted"> — {sub}</span> : null}
        </p>
        {desc && <p className="font-narrative text-[11px] text-ink-muted leading-snug line-clamp-2">{desc}</p>}
      </div>
      <button type="button" onClick={onRemove} className="p-1 rounded text-ink-muted/60 hover:text-rose shrink-0" title="Remove">
        <Trash2 size={12} />
      </button>
    </div>
  )
}
