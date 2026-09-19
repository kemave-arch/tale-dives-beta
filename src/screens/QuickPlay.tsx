import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import {
  ArrowLeft, ArrowRight, ChevronRight, Zap, Sparkles, BookOpen, Users, Landmark, Shield,
  ScrollText, Flag, Save, FolderOpen, X, CheckCircle2, Loader2, Trash2, Info, BookMarked, RefreshCw,
} from 'lucide-react'
import { GlassScreen } from '../lib/glassChrome.tsx'
import { useConfirm } from '../lib/useConfirm.tsx'
import { EditableCard, EditPencilButton, type EditField } from '../lib/inlineEdit.tsx'
import type { ApiSettings, WorldData } from '../types.ts'
import {
  TALE_WEAVER_PHASES, emptyAccumulated, runTaleWeaverPhase, mergeTaleWeaverDraft,
  type TaleWeaverAccumulated, type TaleWeaverPhaseDef,
} from '../lib/taleWeaving.ts'
import {
  getTaleWeaverPresets, saveTaleWeaverPreset, deleteTaleWeaverPreset,
  type TaleWeaverPreset,
} from '../lib/taleWeaverPresets.ts'
import { loadTaleWeaverAutosave, saveTaleWeaverAutosave, clearTaleWeaverAutosave } from '../lib/taleWeaverAutosave.ts'
import { hasAnyContent, NarrativeSettingsCard, WeaverLlmButton } from './TaleWeaver.tsx'
import { loadWeaverLlmOverride, saveWeaverLlmOverride, type WeaverLlmOverride } from '../lib/weaverLlmOverride.ts'

// Quick Play — the same full Tale Weaving generator behind the scenes (every
// one of TALE_WEAVER_PHASES actually runs), just asked through 3 plain
// questions instead of 7 guided phases, so a player who wants to dive in
// fast never sees the phase machinery at all.
//
// Each question's generation must finish (successfully or not) before the
// player can move to the next one — a review panel shows exactly what got
// woven for that question, live-updating per section, with its own Retry
// button per section. This used to fire-and-forget in the background while
// letting the player advance immediately; bouncing back and forth between
// questions could requeue the same phases on top of an already-running (or
// already-done) batch, which is what produced the live-reported "weaves and
// fails" bug. Blocking on completion — and letting a slipped section be
// individually retried instead of forcing a full re-answer — fixes both.

interface QuickPlayProps {
  apiSettings: ApiSettings
  onBack: () => void
  onBeginTale: (accumulated: TaleWeaverAccumulated) => void
  // "New Session" from an existing Tale in the campaign browser — reuses that
  // Tale's own starting World Foundation data (not a Library-saved World
  // template) so the player begins in the same world, and skips straight to
  // Question II (Hero) since Question I's own answer is no longer needed.
  // Regions/Factions are deliberately left ungenerated here (not carried
  // over from the source Tale) — a fresh session should discover its own
  // places during play, the same way any other new Tale does.
  seedWorld?: WorldData
}

type GenKey = 'world' | 'regions' | 'factions' | 'protagonist' | 'npcs' | 'lore' | 'arc'
type GenStatus = 'idle' | 'running' | 'done' | 'error'

const GEN_LABELS: Record<GenKey, string> = {
  world: 'World Foundation',
  regions: 'Regions & Locations',
  factions: 'Factions',
  protagonist: 'Protagonist',
  npcs: 'Cast of Characters',
  lore: 'Secrets',
  arc: 'Story Arc',
}

const GEN_ICONS: Record<GenKey, typeof Sparkles> = {
  world: Sparkles,
  regions: Landmark,
  factions: Shield,
  protagonist: BookOpen,
  npcs: Users,
  lore: ScrollText,
  arc: Flag,
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

// Every key belonging to a question is settled (not still running) once
// this reads true for all of them — the gate a review panel's Continue
// button (and the initial-mount/step-change stepPhase resolution) checks.
function keysSettled(keys: GenKey[], status: Record<GenKey, GenStatus>): boolean {
  return keys.every((k) => status[k] !== 'running')
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
  icon: Icon, label, status, defaultOpen = false, onRetry, children,
}: {
  icon: typeof Sparkles; label: string; status: GenStatus; defaultOpen?: boolean; onRetry?: () => void; children: React.ReactNode
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
          {onRetry && status !== 'running' && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => { e.stopPropagation(); onRetry() }}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); onRetry() } }}
              className="p-1 rounded text-ink-muted/60 hover:text-gold-primary hover:bg-gold-accent/10 transition-colors"
              title="Reroll this section"
            >
              <RefreshCw size={12} />
            </span>
          )}
          <ChevronRight size={14} className={`text-gold-primary transition-transform duration-150 ${open ? 'rotate-90' : ''}`} />
        </div>
      </button>
      {open && <div className="px-3.5 pb-3.5 pt-1 border-t border-gold-accent/15 flex flex-col gap-2">{children}</div>}
    </div>
  )
}

function EmptyNote({ status, error }: { status: GenStatus; error?: string }) {
  if (status === 'error') {
    return (
      <p className="font-narrative italic text-xs text-rose py-1">
        {error ? `This part slipped: ${error}` : 'This part slipped — retry it, or continue without it.'}
      </p>
    )
  }
  return (
    <p className="font-narrative italic text-xs text-ink-muted py-1">
      {status === 'running' ? 'Still being woven…' : 'Nothing woven here yet.'}
    </p>
  )
}

// The one place each section's content is actually rendered — shared by the
// per-question review panel and the final Tale Initiation Overview, so
// fixing "long text gets truncated" (dropping every line-clamp below) only
// has to happen once and both surfaces stay in sync.
type EditableCategory = 'regions' | 'locations' | 'factions' | 'npcs' | 'lore' | 'beats'

function SectionBody({
  genKey, accumulated, status, error, onRemove, onUpdateWorld, onUpdateProtagonist, onUpdateEntry,
}: {
  genKey: GenKey
  accumulated: TaleWeaverAccumulated
  status: GenStatus
  error?: string
  onRemove: (category: EditableCategory, id: string) => void
  onUpdateWorld: (fields: Record<string, string>) => void
  onUpdateProtagonist: (fields: Record<string, string>) => void
  onUpdateEntry: (category: EditableCategory, id: string, fields: Record<string, string>) => void
}) {
  const w = accumulated.world
  const p = accumulated.protagonist

  switch (genKey) {
    case 'world':
      return w?.name || w?.background ? (
        <EditableCard
          fields={[
            { key: 'name', label: 'World Name', value: w.name ?? '' },
            { key: 'genreTone', label: 'Genre & Tone', value: w.genreTone ?? '' },
            { key: 'eraTechLevel', label: 'Era / Tech Level', value: w.eraTechLevel ?? '' },
            { key: 'background', label: 'Background', value: w.background ?? '', multiline: true },
          ]}
          onSave={onUpdateWorld}
          renderView={(openEdit) => (
            <div className="flex flex-col gap-1">
              <div className="flex items-start justify-between gap-2">
                <p className="font-display font-bold text-sm text-ink">{w.name || 'Untitled World'}</p>
                <EditPencilButton onClick={openEdit} />
              </div>
              <p className="font-narrative text-xs text-ink-muted leading-relaxed">
                {[w.genreTone, w.eraTechLevel].filter(Boolean).join(' · ')}
              </p>
              {w.background && <p className="font-narrative text-xs text-ink leading-relaxed whitespace-pre-wrap">{w.background}</p>}
              {w.sourceTitle && (
                <span className="inline-flex items-center gap-1 self-start mt-0.5 font-mono text-[10px] uppercase tracking-wide text-gold-accent/80 border border-gold-accent/30 rounded-full px-2 py-0.5">
                  <BookMarked size={10} /> Source Accurate
                </span>
              )}
            </div>
          )}
        />
      ) : (
        <EmptyNote status={status} error={error} />
      )
    case 'protagonist':
      return p?.name ? (
        <EditableCard
          fields={[
            { key: 'name', label: 'Name', value: p.name ?? '' },
            { key: 'classHint', label: 'Class / Archetype', value: p.classHint ?? '' },
            { key: 'background', label: 'Background', value: p.background ?? '', multiline: true },
          ]}
          onSave={onUpdateProtagonist}
          renderView={(openEdit) => (
            <div className="flex flex-col gap-1">
              <div className="flex items-start justify-between gap-2">
                <p className="font-display font-bold text-sm text-ink">{p.name}{p.classHint ? ` — ${p.classHint}` : ''}</p>
                <EditPencilButton onClick={openEdit} />
              </div>
              {p.background && <p className="font-narrative text-xs text-ink-muted leading-relaxed whitespace-pre-wrap">{p.background}</p>}
              {accumulated.skills.length > 0 && (
                <p className="font-mono text-[10px] text-gold-accent/80 uppercase tracking-wide">
                  Skills: {accumulated.skills.map((s) => s.name).join(', ')}
                </p>
              )}
            </div>
          )}
        />
      ) : (
        <EmptyNote status={status} error={error} />
      )
    case 'regions':
      return accumulated.regions.length || accumulated.locations.length ? (
        <div className="flex flex-col gap-1.5">
          {accumulated.regions.map((r) => (
            <EntryRow
              key={r.id}
              name={r.name}
              desc={r.desc}
              onRemove={() => onRemove('regions', r.id)}
              editFields={[
                { key: 'name', label: 'Region Name', value: r.name },
                { key: 'desc', label: 'Description', value: r.desc ?? '', multiline: true },
              ]}
              onEditSave={(fields) => onUpdateEntry('regions', r.id, fields)}
            />
          ))}
          {accumulated.locations.map((l) => (
            <EntryRow
              key={l.id}
              name={l.name}
              desc={l.desc}
              sub={l.locationType}
              onRemove={() => onRemove('locations', l.id)}
              editFields={[
                { key: 'name', label: 'Location Name', value: l.name },
                { key: 'locationType', label: 'Type', value: l.locationType ?? '' },
                { key: 'desc', label: 'Description', value: l.desc ?? '', multiline: true },
              ]}
              onEditSave={(fields) => onUpdateEntry('locations', l.id, fields)}
            />
          ))}
        </div>
      ) : (
        <EmptyNote status={status} error={error} />
      )
    case 'factions':
      return accumulated.factions.length ? (
        <div className="flex flex-col gap-1.5">
          {accumulated.factions.map((f) => (
            <EntryRow
              key={f.id}
              name={f.name}
              desc={f.desc}
              sub={f.attitude}
              onRemove={() => onRemove('factions', f.id)}
              editFields={[
                { key: 'name', label: 'Faction Name', value: f.name },
                { key: 'attitude', label: 'Attitude', value: f.attitude ?? '' },
                { key: 'desc', label: 'Description', value: f.desc ?? '', multiline: true },
              ]}
              onEditSave={(fields) => onUpdateEntry('factions', f.id, fields)}
            />
          ))}
        </div>
      ) : (
        <EmptyNote status={status} error={error} />
      )
    case 'npcs':
      return accumulated.npcs.length ? (
        <div className="flex flex-col gap-1.5">
          {accumulated.npcs.map((n) => (
            <EntryRow
              key={n.id}
              name={n.name}
              desc={n.personality}
              sub={n.role}
              onRemove={() => onRemove('npcs', n.id)}
              editFields={[
                { key: 'name', label: 'Name', value: n.name },
                { key: 'role', label: 'Role', value: n.role ?? '' },
                { key: 'personality', label: 'Personality', value: n.personality ?? '', multiline: true },
              ]}
              onEditSave={(fields) => onUpdateEntry('npcs', n.id, fields)}
            />
          ))}
        </div>
      ) : (
        <EmptyNote status={status} error={error} />
      )
    case 'lore':
      return accumulated.lore.length ? (
        <div className="flex flex-col gap-1.5">
          {accumulated.lore.map((l) => (
            <EntryRow
              key={l.id}
              name={l.name}
              desc={l.content}
              sub={l.category}
              onRemove={() => onRemove('lore', l.id)}
              editFields={[
                { key: 'name', label: 'Name', value: l.name },
                { key: 'category', label: 'Category', value: l.category ?? '' },
                { key: 'content', label: 'Content', value: l.content ?? '', multiline: true },
              ]}
              onEditSave={(fields) => onUpdateEntry('lore', l.id, fields)}
            />
          ))}
        </div>
      ) : (
        <EmptyNote status={status} error={error} />
      )
    case 'arc':
      return accumulated.beats.length || accumulated.deathRule || accumulated.endGameRules ? (
        <div className="flex flex-col gap-1.5">
          {accumulated.beats.map((b) => (
            <EntryRow
              key={b.id}
              name={b.title}
              desc={b.summary}
              onRemove={() => onRemove('beats', b.id)}
              editFields={[
                { key: 'title', label: 'Beat Title', value: b.title },
                { key: 'summary', label: 'Summary', value: b.summary ?? '', multiline: true },
              ]}
              onEditSave={(fields) => onUpdateEntry('beats', b.id, fields)}
            />
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
        <EmptyNote status={status} error={error} />
      )
  }
}


// TaleWeaverWorldDraft and WorldData share the same field names for
// everything Question I's own generation produces — a direct pick, no
// remapping needed. narrationStyle/mode/tierSkin/flags aren't part of the
// draft shape and are left for the new Tale to set fresh.
function worldToDraft(world: WorldData): TaleWeaverAccumulated['world'] {
  return {
    name: world.name,
    genreTone: world.genreTone,
    conflict: world.conflict,
    powerSystem: world.powerSystem,
    eraTechLevel: world.eraTechLevel,
    keyFactions: world.keyFactions,
    background: world.background,
    sourceTitle: world.sourceTitle,
    sourceAuthor: world.sourceAuthor,
    sourceScope: world.sourceScope,
    sourceAccurate: world.sourceAccurate,
  }
}

export default function QuickPlay({ apiSettings, onBack, onBeginTale, seedWorld }: QuickPlayProps) {
  const [initialAutosave] = useState(() => loadTaleWeaverAutosave('quickplay'))
  const [step, setStep] = useState(initialAutosave?.step ?? (seedWorld ? 1 : 0))
  const [q1, setQ1] = useState(initialAutosave?.q1 ?? '')
  const [q2, setQ2] = useState(initialAutosave?.q2 ?? '')
  const [q3, setQ3] = useState(initialAutosave?.q3 ?? '')
  // "Source Accurate" — a single Quick Play-wide toggle (shared across all 3
  // questions, unlike the full Tale Weaver's dedicated Title/Author/Scope
  // fields on its own World Foundation phase) standing in for the same
  // Lore Accuracy Contract (taleWeaverContract.ts). Enabling it derives
  // world.sourceTitle from Question I's own answer (already "name a novel,
  // film, or era" — the same concept) the moment any question is submitted,
  // which is all every phase call needs to start enforcing accurate canon
  // cast/places/chronology and a sensible spoiler boundary (defaults to the
  // first book/entry only for a multi-part source when Q1 doesn't say
  // otherwise) — no separate Author/Scope fields needed for Quick Play.
  const [sourceAccurate, setSourceAccurate] = useState(initialAutosave?.sourceAccurate ?? seedWorld?.sourceAccurate ?? true)
  const [accumulated, setAccumulated] = useState<TaleWeaverAccumulated>(() => {
    if (initialAutosave?.accumulated) return initialAutosave.accumulated
    const base = emptyAccumulated()
    return seedWorld ? { ...base, world: worldToDraft(seedWorld) } : base
  })
  const [autosaveToast, setAutosaveToast] = useState<string | null>(
    initialAutosave && (hasAnyContent(initialAutosave.accumulated) || initialAutosave.q1 || initialAutosave.q2 || initialAutosave.q3)
      ? 'Resumed your in-progress draft.'
      : null,
  )

  const accRef = useRef(accumulated)
  const chainRef = useRef<Promise<void>>(Promise.resolve())
  // Remembers the guidance text each generated section was last woven with,
  // so a per-section Retry can reroll with the same answer instead of an
  // empty prompt — keyed by GenKey since that's what a single retry acts on.
  const guidanceRef = useRef<Partial<Record<GenKey, string>>>({})

  const initialStatus = {} as Record<GenKey, GenStatus>
  ;(Object.keys(GEN_LABELS) as GenKey[]).forEach((k) => {
    initialStatus[k] = hasGenContent(k, accumulated) ? 'done' : 'idle'
  })
  const [genStatus, setGenStatus] = useState<Record<GenKey, GenStatus>>(initialStatus)
  // The real error message behind a 'error' status (e.g. a 429 rate-limit,
  // a malformed-response parse failure) — shown in place of the old generic
  // "this part slipped" text so a section that keeps failing on Retry is
  // actually diagnosable instead of a black box.
  const [genError, setGenError] = useState<Partial<Record<GenKey, string>>>({})

  // 'input' shows the question's textarea; 'review' shows what got woven
  // for it (live-updating) and gates advancing to the next question until
  // every one of its sections has settled (done or error, never mid-flight).
  // A step whose keys already have content on mount/resume (or after
  // navigating back to an already-answered question) starts in 'review'
  // rather than re-asking the question.
  // Question I's own keys are ['world', 'regions', 'factions'] — a reused
  // seedWorld only ever fills 'world' (regions/factions stay empty by
  // design, see the seedWorld prop's own comment), so the ordinary "every
  // key has content" check would never treat Question I as answered and
  // send the player back to a blank prompt instead of a review of the
  // world they're reusing. Special-cased to 'world' content alone here.
  function questionAnswered(idx: number, acc: TaleWeaverAccumulated): boolean {
    const keys = QUICK_PLAY_QUESTIONS[idx]?.keys
    if (!keys) return false
    if (idx === 0 && seedWorld) return hasGenContent('world', acc)
    return keys.every((k) => hasGenContent(k, acc))
  }

  const [stepPhase, setStepPhase] = useState<'input' | 'review'>(() => questionAnswered(step, accumulated) ? 'review' : 'input')

  const [showSaveModal, setShowSaveModal] = useState(false)
  const [showLoadModal, setShowLoadModal] = useState(false)
  const [presetNameInput, setPresetNameInput] = useState('')
  const [savedPresets, setSavedPresets] = useState<TaleWeaverPreset[]>([])
  const [presetToast, setPresetToast] = useState<string | null>(null)
  const [weaverLlm, setWeaverLlm] = useState<WeaverLlmOverride>(() => loadWeaverLlmOverride())
  function updateWeaverLlm(v: WeaverLlmOverride) {
    setWeaverLlm(v)
    saveWeaverLlmOverride(v)
  }

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
    saveTaleWeaverAutosave('quickplay', { accumulated, step, q1, q2, q3, sourceAccurate })
  }, [accumulated, step, q1, q2, q3, sourceAccurate])

  function mergeAndSet(patch: (prev: TaleWeaverAccumulated) => TaleWeaverAccumulated) {
    accRef.current = patch(accRef.current)
    setAccumulated(accRef.current)
  }

  // Chained on chainRef so no two phase calls (whether from a question
  // submit or an individual section Retry) ever run concurrently — that
  // chain is exactly what previously let bouncing between steps requeue an
  // already-in-flight batch on top of itself.
  function queueStages(keys: GenKey[], guidance: string) {
    keys.forEach((k) => { guidanceRef.current[k] = guidance })
    chainRef.current = chainRef.current.then(async () => {
      for (const key of keys) {
        setGenStatus((s) => ({ ...s, [key]: 'running' }))
        const result = await runTaleWeaverPhase({ apiSettings, phase: phaseFor(key), accumulated: accRef.current, guidance, weaverOverride: weaverLlm })
        if (result.ok && result.draft) {
          mergeAndSet((prev) => mergeTaleWeaverDraft(prev, key, result.draft!))
          setGenStatus((s) => ({ ...s, [key]: 'done' }))
          setGenError((e) => ({ ...e, [key]: undefined }))
        } else {
          setGenStatus((s) => ({ ...s, [key]: 'error' }))
          setGenError((e) => ({ ...e, [key]: result.error }))
        }
      }
    })
  }

  function retryKey(key: GenKey) {
    queueStages([key], guidanceRef.current[key] ?? '')
  }

  function submitQuestion(idx: number, text: string) {
    if (sourceAccurate) {
      // idx===0's own text IS Question I's answer; a later question re-syncs
      // from the already-stored q1 so toggling Source Accurate on AFTER
      // Question I still backfills it for every phase call still to come.
      const title = (idx === 0 ? text : q1).trim()
      if (title) mergeAndSet((prev) => ({ ...prev, world: { ...prev.world, sourceTitle: title } }))
    }
    queueStages(QUICK_PLAY_QUESTIONS[idx].keys, text.trim())
    setStepPhase('review')
  }

  // Moving to a different question: land on 'review' if it's already fully
  // woven (revisiting an answered question), otherwise 'input'.
  function goToStep(idx: number) {
    setStepPhase(questionAnswered(idx, accRef.current) ? 'review' : 'input')
    setStep(idx)
  }

  function removeEntry(category: 'regions' | 'locations' | 'factions' | 'npcs' | 'lore' | 'beats', id: string) {
    mergeAndSet((prev) => ({ ...prev, [category]: (prev[category] as { id: string }[]).filter((e) => e.id !== id) }))
  }

  // Direct hand-editing of a woven section's own text — the counterpart to
  // Retry (reroll) and Remove (delete): lets the player fix a name, trim a
  // paragraph, or correct a detail the model got wrong without spending
  // another API call or losing everything else in that section.
  function updateWorld(fields: Record<string, string>) {
    mergeAndSet((prev) => ({ ...prev, world: prev.world ? { ...prev.world, ...fields } : prev.world }))
  }

  function updateProtagonist(fields: Record<string, string>) {
    mergeAndSet((prev) => ({ ...prev, protagonist: prev.protagonist ? { ...prev.protagonist, ...fields } : prev.protagonist }))
  }

  function updateEntry(category: 'regions' | 'locations' | 'factions' | 'npcs' | 'lore' | 'beats', id: string, fields: Record<string, string>) {
    mergeAndSet((prev) => ({
      ...prev,
      [category]: (prev[category] as { id: string }[]).map((e) => (e.id === id ? { ...e, ...fields } : e)),
    }))
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
    setStep(4)
    setPresetToast(`Loaded preset "${preset.name}"!`)
  }

  function handleDeletePreset(id: string) {
    setSavedPresets(deleteTaleWeaverPreset(id))
  }

  const stepLabels = ['Realm', 'Hero', 'Beginning', 'Narrative Settings', 'Overview']
  const anyRunning = (Object.values(genStatus) as GenStatus[]).some((s) => s === 'running')

  return (
    <GlassScreen ground="dark" fill className="flex flex-col overflow-hidden">
      <div className="relative z-10 flex flex-col h-full overflow-hidden parchment-surface !bg-[#fbf8f3]">
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
                  Step {step + 1} of 5
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
            <WeaverLlmButton apiSettings={apiSettings} override={weaverLlm} onChange={updateWeaverLlm} />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-3">
          {step < 3 && stepPhase === 'input' ? (
            <QuestionScreen
              key={step}
              question={QUICK_PLAY_QUESTIONS[step]}
              value={step === 0 ? q1 : step === 1 ? q2 : q3}
              onChange={step === 0 ? setQ1 : step === 1 ? setQ2 : setQ3}
              onSubmit={(text) => submitQuestion(step, text)}
              onBack={step > 0 ? () => goToStep(step - 1) : undefined}
              isLast={step === 2}
              sourceAccurate={sourceAccurate}
              onToggleSourceAccurate={(v) => {
                setSourceAccurate(v)
                if (!v) mergeAndSet((prev) => ({ ...prev, world: prev.world ? { ...prev.world, sourceTitle: undefined } : prev.world }))
              }}
            />
          ) : step < 3 ? (
            <QuestionReviewPanel
              key={step}
              questionNumber={step + 1}
              keys={QUICK_PLAY_QUESTIONS[step].keys}
              accumulated={accumulated}
              genStatus={genStatus}
              genError={genError}
              onRemove={removeEntry}
              onUpdateWorld={updateWorld}
              onUpdateProtagonist={updateProtagonist}
              onUpdateEntry={updateEntry}
              onRetry={retryKey}
              onBack={() => setStepPhase('input')}
              onContinue={() => goToStep(step + 1)}
              continueLabel={step === 2 ? 'Continue to Narrative Settings' : 'Continue'}
            />
          ) : step === 3 ? (
            <NarrativeSettingsStep
              accumulated={accumulated}
              setAccumulated={setAccumulated}
              onBack={() => goToStep(2)}
              onContinue={() => setStep(4)}
            />
          ) : (
            <TaleInitiationOverview
              accumulated={accumulated}
              genStatus={genStatus}
              genError={genError}
              anyRunning={anyRunning}
              onRemove={removeEntry}
              onUpdateWorld={updateWorld}
              onUpdateProtagonist={updateProtagonist}
              onUpdateEntry={updateEntry}
              onRetry={retryKey}
              onReturn={() => setStep(3)}
              onDiveIn={handleDiveIn}
            />
          )}
        </div>
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
  question, value, onChange, onSubmit, onBack, isLast, sourceAccurate, onToggleSourceAccurate,
}: {
  question: (typeof QUICK_PLAY_QUESTIONS)[number]
  value: string
  onChange: (v: string) => void
  onSubmit: (text: string) => void
  onBack?: () => void
  isLast: boolean
  sourceAccurate: boolean
  onToggleSourceAccurate: (v: boolean) => void
}) {
  return (
    <div className="flex-1 flex flex-col justify-center gap-4 py-4">
      <div className="flex flex-col gap-2">
        <span className="font-mono text-[10px] uppercase tracking-wider text-gold-primary/70">{question.eyebrow}</span>
        <h2 className="font-display font-bold text-xl sm:text-2xl text-ink">{question.title}</h2>
        <p className="font-narrative text-sm text-ink-muted leading-relaxed">{question.prompt}</p>
      </div>
      <label className="flex items-start gap-2.5 rounded-lg border border-gold-accent/25 bg-[#faf8f4] px-3 py-2.5 cursor-pointer hover:border-gold-primary/40 transition-colors">
        <input
          type="checkbox"
          checked={sourceAccurate}
          onChange={(e) => onToggleSourceAccurate(e.target.checked)}
          className="mt-0.5 w-4 h-4 accent-[#b08830] shrink-0 cursor-pointer"
        />
        <span className="flex flex-col gap-0.5 min-w-0">
          <span className="flex items-center gap-1.5 font-display font-bold text-xs text-ink">
            <BookMarked size={13} className="text-gold-primary shrink-0" /> Source Accurate
          </span>
          <span className="font-narrative text-[11px] text-ink-muted leading-snug">
            Stay faithful to a real source named above, if any.
          </span>
        </span>
      </label>
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

// Shown immediately after a question is submitted — live-updates each of
// that question's sections (Weaving… -> Ready/Failed) as its own phase call
// settles. Continue stays disabled until none of them are still running, so
// the player can never advance mid-weave; a slipped section gets its own
// Retry instead of forcing the whole question to be re-answered.
function QuestionReviewPanel({
  questionNumber, keys, accumulated, genStatus, genError, onRemove, onUpdateWorld, onUpdateProtagonist, onUpdateEntry, onRetry, onBack, onContinue, continueLabel,
}: {
  questionNumber: number
  keys: GenKey[]
  accumulated: TaleWeaverAccumulated
  genStatus: Record<GenKey, GenStatus>
  genError: Partial<Record<GenKey, string>>
  onRemove: (category: EditableCategory, id: string) => void
  onUpdateWorld: (fields: Record<string, string>) => void
  onUpdateProtagonist: (fields: Record<string, string>) => void
  onUpdateEntry: (category: EditableCategory, id: string, fields: Record<string, string>) => void
  onRetry: (key: GenKey) => void
  onBack: () => void
  onContinue: () => void
  continueLabel: string
}) {
  const settled = keysSettled(keys, genStatus)
  const anyError = keys.some((k) => genStatus[k] === 'error')

  return (
    <div className="flex-1 flex flex-col gap-3 py-2">
      <div className="flex flex-col gap-1">
        <span className="font-mono text-[10px] uppercase tracking-wider text-gold-primary/70">Question {questionNumber} · Woven</span>
        <h2 className="font-display font-bold text-xl text-ink">Here's What Came of It</h2>
        <p className="font-narrative text-sm text-ink-muted leading-relaxed">
          {settled
            ? anyError
              ? "Most of it's ready — retry anything that slipped, or continue without it."
              : 'Glance it over, trim anything you don’t want, then continue.'
            : 'Weaving now — this only takes a moment.'}
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {keys.map((key) => (
          <AccordionSection
            key={key}
            icon={GEN_ICONS[key]}
            label={GEN_LABELS[key]}
            status={genStatus[key]}
            defaultOpen
            onRetry={() => onRetry(key)}
          >
            <SectionBody
              genKey={key}
              accumulated={accumulated}
              status={genStatus[key]}
              error={genError[key]}
              onRemove={onRemove}
              onUpdateWorld={onUpdateWorld}
              onUpdateProtagonist={onUpdateProtagonist}
              onUpdateEntry={onUpdateEntry}
            />
          </AccordionSection>
        ))}
      </div>

      {/* Same solid pill-row button pattern as QuestionScreen/NarrativeSettingsStep
          (light vellum surface) rather than GlassCTAButton — that component's
          frosted-glass-on-dark-art look was designed for the Overview screen's
          own dark wallpaper background and read as washed-out/low-contrast
          here on the light parchment surface. */}
      <div className="flex items-center w-full rounded-lg border border-gold-accent/30 bg-white shadow-xs overflow-hidden divide-x divide-gold-accent/15">
        <button
          type="button"
          onClick={onBack}
          className="flex-1 flex items-center justify-center gap-1.5 h-11 text-xs font-semibold text-ink-muted hover:text-ink hover:bg-gold-accent/10 transition-colors whitespace-nowrap"
        >
          <ArrowLeft size={15} /><span>Edit Answer</span>
        </button>
        <button
          type="button"
          onClick={onContinue}
          disabled={!settled}
          className="flex-[1.4] flex items-center justify-center gap-1.5 h-11 bg-[#b08830] hover:bg-[#8d6b1d] disabled:opacity-50 disabled:pointer-events-none text-white text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap"
        >
          {settled ? (
            <><span>{continueLabel}</span><ArrowRight size={15} /></>
          ) : (
            <><Loader2 size={15} className="animate-spin" /><span>Weaving…</span></>
          )}
        </button>
      </div>
    </div>
  )
}

function NarrativeSettingsStep({
  accumulated, setAccumulated, onBack, onContinue,
}: {
  accumulated: TaleWeaverAccumulated
  setAccumulated: Dispatch<SetStateAction<TaleWeaverAccumulated>>
  onBack: () => void
  onContinue: () => void
}) {
  return (
    <div className="flex-1 flex flex-col justify-center gap-4 py-4">
      <div className="flex flex-col gap-2">
        <span className="font-mono text-[10px] uppercase tracking-wider text-gold-primary/70">Before You Dive In</span>
        <h2 className="font-display font-bold text-xl sm:text-2xl text-ink">Tune the Telling</h2>
        <p className="font-narrative text-sm text-ink-muted leading-relaxed">
          A few quick preferences for how this Tale is narrated — change these anytime later in Settings.
        </p>
      </div>
      <NarrativeSettingsCard accumulated={accumulated} setAccumulated={setAccumulated} />
      <div className="flex items-center w-full rounded-lg border border-gold-accent/30 bg-white shadow-xs overflow-hidden divide-x divide-gold-accent/15">
        <button
          type="button"
          onClick={onBack}
          className="flex-1 flex items-center justify-center gap-1.5 h-11 text-xs font-semibold text-ink-muted hover:text-ink hover:bg-gold-accent/10 transition-colors"
        >
          <ArrowLeft size={15} /><span>Back</span>
        </button>
        <button
          type="button"
          onClick={onContinue}
          className="flex-[1.4] flex items-center justify-center gap-1.5 h-11 bg-[#b08830] hover:bg-[#8d6b1d] text-white text-xs sm:text-sm font-semibold transition-colors"
        >
          <span>Continue</span><ArrowRight size={15} />
        </button>
      </div>
    </div>
  )
}

function TaleInitiationOverview({
  accumulated, genStatus, genError, anyRunning, onRemove, onUpdateWorld, onUpdateProtagonist, onUpdateEntry, onRetry, onReturn, onDiveIn,
}: {
  accumulated: TaleWeaverAccumulated
  genStatus: Record<GenKey, GenStatus>
  genError: Partial<Record<GenKey, string>>
  anyRunning: boolean
  onRemove: (category: EditableCategory, id: string) => void
  onUpdateWorld: (fields: Record<string, string>) => void
  onUpdateProtagonist: (fields: Record<string, string>) => void
  onUpdateEntry: (category: EditableCategory, id: string, fields: Record<string, string>) => void
  onRetry: (key: GenKey) => void
  onReturn: () => void
  onDiveIn: () => void
}) {
  return (
    <div className="flex-1 flex flex-col gap-3 py-2">
      <div className="flex flex-col gap-1">
        <span className="font-mono text-[10px] uppercase tracking-wider text-gold-primary/70">Final Review</span>
        <h2 className="font-display font-bold text-xl text-ink">Tale Initiation Overview</h2>
        <p className="font-narrative text-sm text-ink-muted leading-relaxed">
          Everything woven so far — glance it over, trim anything you don't want, then Dive In.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {(Object.keys(GEN_LABELS) as GenKey[]).map((key) => (
          <AccordionSection
            key={key}
            icon={GEN_ICONS[key]}
            label={GEN_LABELS[key]}
            status={genStatus[key]}
            defaultOpen={key === 'world'}
            onRetry={() => onRetry(key)}
          >
            <SectionBody
              genKey={key}
              accumulated={accumulated}
              status={genStatus[key]}
              error={genError[key]}
              onRemove={onRemove}
              onUpdateWorld={onUpdateWorld}
              onUpdateProtagonist={onUpdateProtagonist}
              onUpdateEntry={onUpdateEntry}
            />
          </AccordionSection>
        ))}
      </div>

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
          className="flex-[1.4] flex items-center justify-center gap-1.5 h-11 bg-[#b08830] hover:bg-[#8d6b1d] disabled:opacity-50 disabled:pointer-events-none text-white text-xs sm:text-sm font-semibold transition-colors"
        >
          {anyRunning ? (
            <span className="inline-flex items-center gap-1.5"><Loader2 size={15} className="animate-spin" /> Still Weaving…</span>
          ) : (
            <span className="inline-flex items-center gap-1.5"><Zap size={15} /><span>Dive In</span></span>
          )}
        </button>
      </div>
    </div>
  )
}

function EntryRow({
  name, desc, sub, onRemove, editFields, onEditSave,
}: {
  name: string
  desc?: string
  sub?: string
  onRemove: () => void
  // When given, a pencil button opens an inline form for exactly these
  // fields (in the entry's own real field names) — Save calls onEditSave
  // with the edited values.
  editFields?: EditField[]
  onEditSave?: (values: Record<string, string>) => void
}) {
  return (
    <EditableCard
      fields={editFields ?? []}
      onSave={(values) => onEditSave?.(values)}
      renderView={(openEdit) => (
        <div className="flex items-start justify-between gap-2 rounded-md bg-[#faf8f4] border border-gold-accent/15 px-2.5 py-1.5">
          <div className="min-w-0">
            <p className="font-display font-semibold text-xs text-ink truncate">
              {name}{sub ? <span className="font-narrative italic font-normal text-ink-muted"> — {sub}</span> : null}
            </p>
            {desc && <p className="font-narrative text-[11px] text-ink-muted leading-snug whitespace-pre-wrap">{desc}</p>}
          </div>
          <div className="flex items-center gap-0.5 shrink-0">
            {editFields && <EditPencilButton onClick={openEdit} />}
            <button type="button" onClick={onRemove} className="p-1 rounded text-ink-muted/60 hover:text-rose shrink-0" title="Remove">
              <Trash2 size={12} />
            </button>
          </div>
        </div>
      )}
    />
  )
}
