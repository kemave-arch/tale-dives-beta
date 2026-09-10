import { useState, useRef, useEffect } from 'react'
import {
  X, ChevronRight, ChevronLeft, Sparkles, Lock, Unlock,
  BookOpen, AlertCircle, Check, ArrowRight
} from 'lucide-react'
import { GlassScreen, GlassHeader } from '../lib/glassChrome.tsx'
import { useConfirm } from '../lib/useConfirm.tsx'
import type { ApiSettings } from '../types.ts'
import {
  TALE_WEAVER_PHASES, emptyAccumulated, runTaleWeaverPhase,
  type TaleWeaverAccumulated, type TaleWeaverPhaseDef,
} from '../lib/taleWeaving.ts'

// Inspired Mode's "Tale Weaving" screen — a focused, step-guided creation
// experience. One phase at a time, the player describes their vision, the
// model generates rich lore & entities, and the player can inspect, prune,
// or re-weave before advancing. Full safeguards allow safely reverting to
// earlier phases or reviewing the full established world at any moment.

interface TaleWeaverProps {
  apiSettings: ApiSettings
  onBack: () => void
  onBeginTale: (accumulated: TaleWeaverAccumulated) => void
}

const PHASE_SHORT_LABELS = ['World', 'Hero', 'Places', 'Factions', 'Cast', 'Lore', 'Arc']

function fieldSummary(fields: (string | undefined)[]): string {
  return fields.filter(Boolean).join(' · ')
}

function hasPhaseContent(phaseId: TaleWeaverPhaseDef['id'], acc: TaleWeaverAccumulated): boolean {
  switch (phaseId) {
    case 'world':
      return Boolean(acc.world?.name || acc.world?.genreTone)
    case 'protagonist':
      return Boolean(acc.protagonist?.name || acc.protagonist?.background)
    case 'regions':
      return acc.locations.length > 0 || acc.regions.length > 0
    case 'factions':
      return acc.factions.length > 0
    case 'npcs':
      return acc.npcs.length > 0
    case 'lore':
      return acc.lore.length > 0
    case 'arc':
      return acc.beats.length > 0 || (acc.narrativeEvents?.length ?? 0) > 0
    default:
      return false
  }
}

function getPhaseCount(phaseId: TaleWeaverPhaseDef['id'], acc: TaleWeaverAccumulated): number {
  switch (phaseId) {
    case 'world':
      return acc.world ? 1 : 0
    case 'protagonist':
      return acc.protagonist ? 1 : 0
    case 'regions':
      return acc.locations.length + acc.regions.length
    case 'factions':
      return acc.factions.length
    case 'npcs':
      return acc.npcs.length
    case 'lore':
      return acc.lore.length
    case 'arc':
      return acc.beats.length + (acc.narrativeEvents?.length ?? 0)
    default:
      return 0
  }
}

function hasAnyContent(acc: TaleWeaverAccumulated): boolean {
  return (
    Boolean(acc.world) ||
    Boolean(acc.protagonist) ||
    acc.regions.length > 0 ||
    acc.locations.length > 0 ||
    acc.factions.length > 0 ||
    acc.npcs.length > 0 ||
    acc.lore.length > 0 ||
    acc.beats.length > 0 ||
    (acc.narrativeEvents?.length ?? 0) > 0
  )
}

function getTotalEntityCount(acc: TaleWeaverAccumulated): number {
  let count = 0
  if (acc.world) count++
  if (acc.protagonist) count++
  count += acc.regions.length
  count += acc.locations.length
  count += acc.factions.length
  count += acc.npcs.length
  count += acc.lore.length
  count += acc.beats.length
  count += acc.narrativeEvents?.length ?? 0
  return count
}

export default function TaleWeaver({ apiSettings, onBack, onBeginTale }: TaleWeaverProps) {
  const [phaseIdx, setPhaseIdx] = useState(0)
  const [maxVisitedIdx, setMaxVisitedIdx] = useState(0)
  const [guidance, setGuidance] = useState('')
  const [busy, setBusy] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [revealedBeats, setRevealedBeats] = useState<Set<string>>(new Set())
  const [accumulated, setAccumulated] = useState<TaleWeaverAccumulated>(emptyAccumulated())
  const [showOverview, setShowOverview] = useState(false)

  const { confirm, dialog: confirmDialog } = useConfirm()
  const contentAreaRef = useRef<HTMLDivElement | null>(null)

  const phase = TALE_WEAVER_PHASES[phaseIdx]
  const isLastPhase = phaseIdx === TALE_WEAVER_PHASES.length - 1
  const currentHasContent = hasPhaseContent(phase.id, accumulated)
  const totalCount = getTotalEntityCount(accumulated)

  // Scroll to top of content area on phase transition
  useEffect(() => {
    contentAreaRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
    setErrorMessage(null)
  }, [phaseIdx])

  async function handleSafeExit() {
    if (hasAnyContent(accumulated)) {
      const ok = await confirm(
        'Leave Tale Weaving? Any progress made crafting this tale will be discarded.'
      )
      if (!ok) return
    }
    onBack()
  }

  async function handleGenerate() {
    if (busy) return

    if (phase.id === 'world' && accumulated.world) {
      if (!(await confirm('Discard your current World Foundation draft and generate a new one?'))) return
    }
    if (phase.id === 'protagonist' && accumulated.protagonist) {
      if (!(await confirm('Discard your current Protagonist draft and generate a new one?'))) return
    }

    const text = guidance.trim()
    setBusy(true)
    setErrorMessage(null)

    const result = await runTaleWeaverPhase({ apiSettings, phase, accumulated, guidance: text })
    setBusy(false)

    if (!result.ok || !result.draft) {
      setErrorMessage(result.error ?? 'The weave slipped — try again, perhaps with different phrasing.')
      return
    }

    const draft = result.draft
    setGuidance('')

    if (phase.id === 'world' && draft.world) {
      setAccumulated((prev) => ({ ...prev, world: draft.world }))
      return
    }
    if (phase.id === 'protagonist' && draft.protagonist) {
      setAccumulated((prev) => ({ ...prev, protagonist: draft.protagonist }))
      return
    }

    setAccumulated((prev) => {
      const next = { ...prev }
      if (draft.regions.length) {
        next.regions = [...prev.regions.filter((r) => !draft.regions.some((d) => d.id === r.id)), ...draft.regions]
      }
      if (draft.locations.length) {
        next.locations = [...prev.locations.filter((l) => !draft.locations.some((d) => d.id === l.id)), ...draft.locations]
      }
      if (draft.factions.length) {
        next.factions = [...prev.factions.filter((f) => !draft.factions.some((d) => d.id === f.id)), ...draft.factions]
      }
      if (draft.npcs.length) {
        next.npcs = [...prev.npcs.filter((n) => !draft.npcs.some((d) => d.id === n.id)), ...draft.npcs]
      }
      if (draft.lore.length) {
        next.lore = [...prev.lore.filter((l) => !draft.lore.some((d) => d.id === l.id)), ...draft.lore]
      }
      if (draft.beats.length) {
        next.beats = [...prev.beats.filter((b) => !draft.beats.some((d) => d.id === b.id)), ...draft.beats]
      }
      if (draft.narrativeEvents.length) {
        const prevEvents = prev.narrativeEvents ?? []
        next.narrativeEvents = [...prevEvents.filter((e) => !draft.narrativeEvents.some((d) => d.id === e.id)), ...draft.narrativeEvents]
      }
      if (draft.deathRule) {
        next.deathRule = draft.deathRule
      }
      if (draft.deathInstructions) {
        next.deathInstructions = draft.deathInstructions
      }
      if (draft.endGameRules) {
        next.endGameRules = { ...prev.endGameRules, ...draft.endGameRules }
      }
      return next
    })
  }

  function removeItem(category: keyof TaleWeaverAccumulated, id: string) {
    setAccumulated((prev) => {
      const list = prev[category]
      if (!Array.isArray(list)) return prev
      return { ...prev, [category]: list.filter((item: { id: string }) => item.id !== id) }
    })
  }

  function clearSingle(category: 'world' | 'protagonist') {
    setAccumulated((prev) => ({ ...prev, [category]: undefined }))
  }

  async function handlePreviousPhase() {
    if (phaseIdx <= 0) return
    const prevTarget = TALE_WEAVER_PHASES[phaseIdx - 1]
    const ok = await confirm(
      `Return to Phase ${phaseIdx}: ${prevTarget.label}? Your existing creations in later phases will be preserved.`
    )
    if (!ok) return
    setPhaseIdx((i) => i - 1)
  }

  async function handleJumpToPhase(targetIdx: number) {
    if (targetIdx === phaseIdx) return
    if (targetIdx < phaseIdx) {
      const targetPhase = TALE_WEAVER_PHASES[targetIdx]
      const ok = await confirm(
        `Return to Phase ${targetIdx + 1}: ${targetPhase.label}? Your existing creations will remain intact.`
      )
      if (!ok) return
      setPhaseIdx(targetIdx)
    } else {
      // Jumping forward: check if skipping an empty phase
      if (!currentHasContent && targetIdx > maxVisitedIdx) {
        const ok = await confirm(
          `No content has been woven for ${phase.label} yet. Skip forward to Phase ${targetIdx + 1}: ${TALE_WEAVER_PHASES[targetIdx].label}?`
        )
        if (!ok) return
      }
      setPhaseIdx(targetIdx)
      setMaxVisitedIdx((m) => Math.max(m, targetIdx))
    }
  }

  async function handleNext() {
    if (isLastPhase) {
      if (!accumulated.beats.length) {
        const ok = await confirm('No story beats have been woven yet. Begin this tale anyway?')
        if (!ok) return
      }
      onBeginTale(accumulated)
      return
    }

    if (!currentHasContent) {
      const ok = await confirm(
        `No ${phase.label.toLowerCase()} have been woven yet. Continue to the next phase without generating content for this step?`
      )
      if (!ok) return
    }

    const nextIdx = phaseIdx + 1
    setPhaseIdx(nextIdx)
    setMaxVisitedIdx((m) => Math.max(m, nextIdx))
  }

  function toggleBeatReveal(id: string) {
    setRevealedBeats((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // Content cards for the currently active phase
  function renderActivePhaseContent() {
    switch (phase.id) {
      case 'world': {
        const w = accumulated.world
        if (!w) return null
        return (
          <div className="rounded-xl border border-gold-accent/35 bg-[#161a28] p-4 flex flex-col gap-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <span className="font-mono text-[10px] uppercase tracking-wider text-gold-primary/70">World Foundation</span>
                <h3 className="font-display font-bold text-base text-gold-primary">{w.name || 'Untitled World'}</h3>
              </div>
              <button
                type="button"
                onClick={() => clearSingle('world')}
                className="text-red-400/70 hover:text-red-300 p-1 rounded hover:bg-red-400/10 transition-colors"
                title="Clear and re-weave world"
              >
                <X size={15} />
              </button>
            </div>
            {w.genreTone && (
              <div>
                <span className="font-mono text-[10px] uppercase text-ink-muted/80">Genre & Tone</span>
                <p className="font-narrative text-xs text-ink">{w.genreTone}</p>
              </div>
            )}
            {w.conflict && (
              <div>
                <span className="font-mono text-[10px] uppercase text-ink-muted/80">Central Conflict</span>
                <p className="font-narrative text-xs text-ink">{w.conflict}</p>
              </div>
            )}
            {w.powerSystem && (
              <div>
                <span className="font-mono text-[10px] uppercase text-ink-muted/80">Power & Magic System</span>
                <p className="font-narrative text-xs text-ink">{w.powerSystem}</p>
              </div>
            )}
            {w.eraTechLevel && (
              <div>
                <span className="font-mono text-[10px] uppercase text-ink-muted/80">Era & Technology</span>
                <p className="font-narrative text-xs text-ink">{w.eraTechLevel}</p>
              </div>
            )}
          </div>
        )
      }

      case 'protagonist': {
        const p = accumulated.protagonist
        if (!p) return null
        return (
          <div className="rounded-xl border border-gold-accent/35 bg-[#161a28] p-4 flex flex-col gap-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <span className="font-mono text-[10px] uppercase tracking-wider text-gold-primary/70">Protagonist</span>
                <h3 className="font-display font-bold text-base text-gold-primary">{p.name || 'Unnamed Protagonist'}</h3>
              </div>
              <button
                type="button"
                onClick={() => clearSingle('protagonist')}
                className="text-red-400/70 hover:text-red-300 p-1 rounded hover:bg-red-400/10 transition-colors"
                title="Clear and re-weave protagonist"
              >
                <X size={15} />
              </button>
            </div>
            {p.background && (
              <div>
                <span className="font-mono text-[10px] uppercase text-ink-muted/80">Origin & Background</span>
                <p className="font-narrative text-xs text-ink">{p.background}</p>
              </div>
            )}
            {p.personality && (
              <div>
                <span className="font-mono text-[10px] uppercase text-ink-muted/80">Demeanor & Traits</span>
                <p className="font-narrative text-xs text-ink">{p.personality}</p>
              </div>
            )}
            {p.motivation && (
              <div>
                <span className="font-mono text-[10px] uppercase text-ink-muted/80">Core Drive & Goal</span>
                <p className="font-narrative text-xs text-ink">{p.motivation}</p>
              </div>
            )}
            {p.opening && (
              <div>
                <span className="font-mono text-[10px] uppercase text-ink-muted/80">Opening Scene</span>
                <p className="font-narrative text-xs italic text-ink-muted">{p.opening}</p>
              </div>
            )}
          </div>
        )
      }

      case 'regions': {
        if (!accumulated.regions.length && !accumulated.locations.length) return null
        return (
          <div className="flex flex-col gap-3">
            {accumulated.regions.length > 0 && (
              <div className="flex flex-col gap-2">
                <span className="font-mono text-[10px] uppercase tracking-wider text-gold-primary/70">Regions</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {accumulated.regions.map((r) => (
                    <div key={r.id} className="rounded-xl border border-gold-accent/30 bg-[#161a28] p-3 flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-display font-semibold text-sm text-gold-primary truncate">{r.name}</p>
                        {r.desc && <p className="font-narrative text-xs text-ink-muted line-clamp-2">{r.desc}</p>}
                      </div>
                      <button
                        type="button"
                        onClick={() => removeItem('regions', r.id)}
                        className="text-red-400/70 hover:text-red-300 p-1 shrink-0"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {accumulated.locations.length > 0 && (
              <div className="flex flex-col gap-2">
                <span className="font-mono text-[10px] uppercase tracking-wider text-gold-primary/70">Locations</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {accumulated.locations.map((l) => {
                    const region = accumulated.regions.find((r) => r.id === l.regionId)
                    return (
                      <div key={l.id} className="rounded-xl border border-gold-accent/30 bg-[#161a28] p-3 flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-display font-semibold text-sm text-gold-primary truncate">{l.name}</p>
                          <p className="font-narrative text-xs text-ink-muted">
                            {fieldSummary([region?.name, l.locationType, l.danger ? `Danger: ${l.danger}` : undefined])}
                          </p>
                          {l.desc && <p className="font-narrative text-xs text-ink/80 mt-1 line-clamp-2">{l.desc}</p>}
                          {l.areas && (
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {l.areas.split(',').map((a, i) => (
                                <span key={i} className="font-mono text-[9px] px-1.5 py-0.5 rounded bg-gold-accent/15 text-gold-primary/80 border border-gold-accent/25">
                                  {a.trim()}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => removeItem('locations', l.id)}
                          className="text-red-400/70 hover:text-red-300 p-1 shrink-0"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )
      }

      case 'factions': {
        if (!accumulated.factions.length) return null
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {accumulated.factions.map((f) => (
              <div key={f.id} className="rounded-xl border border-gold-accent/30 bg-[#161a28] p-3 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-display font-semibold text-sm text-gold-primary truncate">{f.name}</p>
                    {f.attitude && (
                      <span className="font-mono text-[9px] uppercase px-1.5 py-0.5 rounded bg-gold-accent/15 text-gold-primary/90 border border-gold-accent/25 shrink-0">
                        {f.attitude}
                      </span>
                    )}
                  </div>
                  {f.territory && <p className="font-narrative text-xs text-ink-muted truncate">Territory: {f.territory}</p>}
                  {f.desc && <p className="font-narrative text-xs text-ink/80 mt-1 line-clamp-2">{f.desc}</p>}
                </div>
                <button
                  type="button"
                  onClick={() => removeItem('factions', f.id)}
                  className="text-red-400/70 hover:text-red-300 p-1 shrink-0"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        )
      }

      case 'npcs': {
        if (!accumulated.npcs.length) return null
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {accumulated.npcs.map((n) => (
              <div key={n.id} className="rounded-xl border border-gold-accent/30 bg-[#161a28] p-3 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-display font-semibold text-sm text-gold-primary truncate">{n.name}</p>
                    {n.role && (
                      <span className="font-mono text-[9px] uppercase px-1.5 py-0.5 rounded bg-gold-accent/15 text-gold-primary/90 border border-gold-accent/25 shrink-0">
                        {n.role}
                      </span>
                    )}
                  </div>
                  {n.personality && <p className="font-narrative text-xs text-ink-muted line-clamp-1">{n.personality}</p>}
                  {(n.aff || n.trust) && (
                    <p className="font-mono text-[10px] text-gold-primary/70 mt-0.5">
                      {fieldSummary([
                        n.aff ? `Affection: ${n.aff}` : undefined,
                        n.trust ? `Trust: ${n.trust}` : undefined,
                      ])}
                    </p>
                  )}
                  {n.appearance && <p className="font-narrative text-xs text-ink/80 mt-1 line-clamp-2">{n.appearance}</p>}
                </div>
                <button
                  type="button"
                  onClick={() => removeItem('npcs', n.id)}
                  className="text-red-400/70 hover:text-red-300 p-1 shrink-0"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        )
      }

      case 'lore': {
        if (!accumulated.lore.length) return null
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {accumulated.lore.map((l) => (
              <div key={l.id} className="rounded-xl border border-gold-accent/30 bg-[#161a28] p-3 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-display font-semibold text-sm text-gold-primary truncate">
                      {l.name} {l.hidden && <span className="text-[10px] text-ink-muted italic">(Hidden)</span>}
                    </p>
                    {l.category && (
                      <span className="font-mono text-[9px] uppercase px-1.5 py-0.5 rounded bg-gold-accent/15 text-gold-primary/90 border border-gold-accent/25 shrink-0">
                        {l.category}
                      </span>
                    )}
                  </div>
                  {l.era && <p className="font-narrative text-xs text-ink-muted">Era: {l.era}</p>}
                  {l.content && <p className="font-narrative text-xs text-ink/80 mt-1 line-clamp-2">{l.content}</p>}
                </div>
                <button
                  type="button"
                  onClick={() => removeItem('lore', l.id)}
                  className="text-red-400/70 hover:text-red-300 p-1 shrink-0"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        )
      }

      case 'arc': {
        const hasBeats = accumulated.beats.length > 0
        const hasEvents = (accumulated.narrativeEvents?.length ?? 0) > 0
        const hasStakes = Boolean(accumulated.deathRule || accumulated.endGameRules)
        if (!hasBeats && !hasEvents && !hasStakes) return null

        return (
          <div className="flex flex-col gap-3">
            {hasBeats && (
              <div className="flex flex-col gap-2">
                <span className="font-mono text-[10px] uppercase tracking-wider text-gold-primary/70">Story Beats</span>
                <div className="flex flex-col gap-2">
                  {accumulated.beats.map((b, i) => {
                    const revealed = revealedBeats.has(b.id)
                    return (
                      <div key={b.id} className="rounded-xl border border-gold-accent/30 bg-[#161a28] p-3 flex flex-col gap-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-display font-semibold text-sm text-gold-primary">
                            {i + 1}. {b.title}
                          </span>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => toggleBeatReveal(b.id)}
                              className="text-gold-primary/60 hover:text-gold-primary p-1 rounded hover:bg-gold-accent/10 transition-colors"
                              title={revealed ? 'Hide summary' : 'Reveal summary'}
                            >
                              {revealed ? <Unlock size={14} /> : <Lock size={14} />}
                            </button>
                            <button
                              type="button"
                              onClick={() => removeItem('beats', b.id)}
                              className="text-red-400/70 hover:text-red-300 p-1 shrink-0"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        </div>
                        {revealed && b.summary && (
                          <p className="font-narrative text-xs italic text-ink-muted bg-black/30 p-2 rounded-lg border border-gold-accent/10">
                            {b.summary}
                          </p>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {hasEvents && (
              <div className="flex flex-col gap-2">
                <span className="font-mono text-[10px] uppercase tracking-wider text-gold-primary/70">
                  Narrative Events (Complications)
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {accumulated.narrativeEvents!.map((e) => (
                    <div key={e.id} className="rounded-xl border border-gold-accent/30 bg-[#161a28] p-3 flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-display font-semibold text-sm text-gold-primary truncate">{e.title}</p>
                        <p className="font-mono text-[10px] text-ink-muted">
                          Trigger: {e.trigger || 'story'}{e.condition ? ` · ${e.condition}` : ''}
                        </p>
                        {e.guidance && <p className="font-narrative text-xs text-ink/80 mt-1 line-clamp-2">{e.guidance}</p>}
                      </div>
                      <button
                        type="button"
                        onClick={() => removeItem('narrativeEvents', e.id)}
                        className="text-red-400/70 hover:text-red-300 p-1 shrink-0"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {hasStakes && (
              <div className="rounded-xl border border-gold-accent/25 bg-[#161a28]/70 p-3 flex flex-col gap-1.5 text-xs">
                {accumulated.deathRule && (
                  <p className="font-narrative text-ink">
                    <span className="font-mono text-[10px] uppercase text-gold-primary font-bold">Death Rule: </span>
                    {accumulated.deathRule === 'permadeath' ? 'Permadeath' : 'Soft Fail'}
                    {accumulated.deathInstructions ? ` — ${accumulated.deathInstructions}` : ''}
                  </p>
                )}
                {accumulated.endGameRules && (
                  <div className="flex flex-col gap-0.5 mt-0.5">
                    <span className="font-mono text-[10px] uppercase text-gold-primary font-bold">End Game Guidance:</span>
                    {accumulated.endGameRules.win && (
                      <p className="font-narrative text-ink-muted pl-2 border-l border-emerald-500/40">
                        <span className="text-emerald-400 font-medium">Victory:</span> {accumulated.endGameRules.win}
                      </p>
                    )}
                    {accumulated.endGameRules.lose && (
                      <p className="font-narrative text-ink-muted pl-2 border-l border-rose-500/40">
                        <span className="text-rose-400 font-medium">Defeat:</span> {accumulated.endGameRules.lose}
                      </p>
                    )}
                    {accumulated.endGameRules.neutral && (
                      <p className="font-narrative text-ink-muted pl-2 border-l border-gold-accent/40">
                        <span className="text-gold-primary font-medium">Bittersweet:</span> {accumulated.endGameRules.neutral}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )
      }

      default:
        return null
    }
  }

  return (
    <GlassScreen ground="dark" className="px-3 sm:px-4 pb-4 pt-2 flex flex-col h-full overflow-hidden">
      {/* Top Header */}
      <GlassHeader
        title="Tale Weaving"
        subtitle={`Phase ${phaseIdx + 1} of ${TALE_WEAVER_PHASES.length} — ${phase.label}`}
        onBack={handleSafeExit}
      />

      {/* Stepper Bar & Overview Trigger */}
      <div className="shrink-0 flex items-center justify-between gap-2 py-2 border-b border-gold-accent/20">
        <div className="flex items-center gap-1 sm:gap-1.5 overflow-x-auto no-scrollbar py-0.5 flex-1">
          {TALE_WEAVER_PHASES.map((p, idx) => {
            const isActive = idx === phaseIdx
            const isCompleted = hasPhaseContent(p.id, accumulated)
            const count = getPhaseCount(p.id, accumulated)
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => handleJumpToPhase(idx)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-display transition-all shrink-0 ${
                  isActive
                    ? 'bg-gold-primary/20 border border-gold-primary text-gold-primary font-semibold shadow-[0_0_10px_rgba(212,175,55,0.15)]'
                    : isCompleted
                    ? 'bg-gold-accent/10 border border-gold-accent/35 text-gold-primary/85 hover:border-gold-accent/60'
                    : 'bg-transparent border border-gold-accent/15 text-ink-muted/50 hover:text-ink-muted'
                }`}
                title={`Phase ${idx + 1}: ${p.label}`}
              >
                <span className="font-mono text-[10px] w-3.5 h-3.5 rounded-full flex items-center justify-center bg-black/40 border border-current">
                  {isCompleted && !isActive ? <Check size={8} /> : idx + 1}
                </span>
                <span className="hidden sm:inline">{PHASE_SHORT_LABELS[idx]}</span>
                {count > 0 && !isActive && (
                  <span className="font-mono text-[9px] text-gold-accent/80 font-normal">({count})</span>
                )}
              </button>
            )
          })}
        </div>

        {/* Overview Button */}
        <button
          type="button"
          onClick={() => setShowOverview(true)}
          className="shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-gold-accent/30 bg-[#161a28] hover:bg-gold-accent/15 text-gold-primary text-xs font-display transition-colors"
          title="Review all established tale elements"
        >
          <BookOpen size={13} />
          <span className="hidden xs:inline">Overview</span>
          {totalCount > 0 && (
            <span className="font-mono text-[10px] px-1.5 py-0.2 rounded-full bg-gold-accent/20 border border-gold-accent/30">
              {totalCount}
            </span>
          )}
        </button>
      </div>

      {/* Main Content Area */}
      <div ref={contentAreaRef} className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-3 py-3 pr-1">
        {/* Phase Goal Banner */}
        <div className="rounded-xl border border-gold-accent/25 bg-[#161a28]/60 p-3 flex flex-col gap-1">
          <div className="flex items-center justify-between gap-2">
            <span className="font-display font-semibold text-xs text-gold-primary uppercase tracking-wider">
              {phase.label}
            </span>
            <span className="font-mono text-[10px] text-gold-accent/70">
              {currentHasContent ? `${getPhaseCount(phase.id, accumulated)} established` : 'Not yet woven'}
            </span>
          </div>
          <p className="font-narrative text-xs text-ink-muted leading-relaxed">
            {phase.prompt}
          </p>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="rounded-xl border border-red-500/40 bg-red-950/30 p-3 flex items-start gap-2 text-red-300 text-xs">
            <AlertCircle size={15} className="shrink-0 text-red-400 mt-0.5" />
            <div className="flex-1">
              <p className="font-narrative">{errorMessage}</p>
            </div>
            <button
              type="button"
              onClick={() => setErrorMessage(null)}
              className="text-red-400 hover:text-red-200 p-0.5 shrink-0"
            >
              <X size={13} />
            </button>
          </div>
        )}

        {/* Active Phase Content Cards */}
        {renderActivePhaseContent()}

        {/* Empty State */}
        {!currentHasContent && !busy && (
          <div className="rounded-xl border border-dashed border-gold-accent/20 bg-black/20 p-6 flex flex-col items-center justify-center text-center gap-2 my-auto">
            <Sparkles size={24} className="text-gold-primary/40" />
            <p className="font-display font-medium text-sm text-gold-primary/80">
              No {phase.label.toLowerCase()} established yet
            </p>
            <p className="font-narrative text-xs text-ink-muted max-w-sm">
              Type your specific vision in the guidance box below, or leave it blank to let the narrator craft it for you.
            </p>
          </div>
        )}

        {/* Busy Indicator */}
        {busy && (
          <div className="rounded-xl border border-gold-accent/30 bg-[#161a28]/80 p-6 flex flex-col items-center justify-center gap-2.5 my-auto">
            <Sparkles size={20} className="text-gold-primary animate-spin" />
            <p className="font-narrative italic text-sm text-gold-primary">
              Weaving {phase.label.toLowerCase()}...
            </p>
            <p className="font-mono text-[10px] text-ink-muted">Grounded in all established history</p>
          </div>
        )}
      </div>

      {/* Bottom Control Deck */}
      <div className="shrink-0 flex flex-col gap-2 pt-2 border-t border-gold-accent/20">
        {/* Guidance Input & Weave Trigger */}
        <div className="flex items-end gap-2">
          <div className="flex-1 relative">
            <textarea
              value={guidance}
              onChange={(e) => setGuidance(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleGenerate()
                }
              }}
              placeholder={`Guide this phase (e.g. tone, names, themes), or leave blank for a surprise...`}
              rows={2}
              disabled={busy}
              className="w-full px-3 py-2 rounded-xl bg-[#161a28] border border-gold-accent/30 text-sm text-ink placeholder:text-ink-muted/50 outline-none resize-none disabled:opacity-50 focus:border-gold-primary transition-colors"
            />
          </div>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={busy}
            className="shrink-0 px-3 py-2.5 h-[58px] rounded-xl bg-gold-accent/25 hover:bg-gold-accent/40 border border-gold-accent/50 text-gold-primary font-display font-semibold text-xs flex flex-col items-center justify-center gap-1 disabled:opacity-40 transition-colors min-w-[76px]"
          >
            <Sparkles size={15} className={busy ? 'animate-spin' : ''} />
            <span>{currentHasContent ? 'Add More' : 'Weave'}</span>
          </button>
        </div>

        {/* Navigation Actions (Previous vs Next) */}
        <div className="flex items-center gap-2">
          {phaseIdx > 0 ? (
            <button
              type="button"
              onClick={handlePreviousPhase}
              disabled={busy}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border border-gold-accent/30 bg-[#161a28] hover:bg-gold-accent/15 text-gold-primary/90 font-display font-medium text-xs disabled:opacity-40 transition-colors"
            >
              <ChevronLeft size={15} />
              <span>Previous</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSafeExit}
              disabled={busy}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border border-gold-accent/20 bg-black/20 hover:bg-gold-accent/10 text-ink-muted font-display text-xs disabled:opacity-40 transition-colors"
            >
              <span>Cancel</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleNext}
            disabled={busy}
            className={`flex-[2] flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl font-display font-semibold text-sm transition-all ${
              isLastPhase
                ? 'bg-gold-primary hover:bg-gold-primary/90 text-black shadow-[0_0_15px_rgba(212,175,55,0.3)]'
                : 'bg-gold-accent/25 hover:bg-gold-accent/35 border border-gold-accent/50 text-gold-primary'
            } disabled:opacity-40`}
          >
            <span>{isLastPhase ? 'Begin This Tale' : 'Next Phase'}</span>
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Tale Overview Modal */}
      {showOverview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-3 sm:p-4">
          <div className="w-full max-w-2xl max-h-[85vh] rounded-2xl border border-gold-accent/40 bg-[#121520] shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-4 py-3 border-b border-gold-accent/20 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BookOpen size={16} className="text-gold-primary" />
                <h2 className="font-display font-bold text-sm text-gold-primary">Tale Overview</h2>
                <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-gold-accent/20 text-gold-primary/90 border border-gold-accent/30">
                  {totalCount} elements established
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowOverview(false)}
                className="text-ink-muted hover:text-ink p-1 rounded-lg hover:bg-white/5 transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3.5">
              {/* World */}
              <div className="rounded-xl border border-gold-accent/25 bg-[#161a28] p-3 flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] uppercase text-gold-primary/70">1. World Foundation</span>
                  <button
                    type="button"
                    onClick={() => {
                      setShowOverview(false)
                      handleJumpToPhase(0)
                    }}
                    className="font-mono text-[10px] text-gold-primary hover:underline flex items-center gap-1"
                  >
                    Jump <ArrowRight size={10} />
                  </button>
                </div>
                {accumulated.world ? (
                  <div>
                    <p className="font-display font-semibold text-sm text-gold-primary">{accumulated.world.name}</p>
                    <p className="font-narrative text-xs text-ink-muted">{accumulated.world.genreTone}</p>
                  </div>
                ) : (
                  <p className="font-narrative text-xs italic text-ink-muted">Not yet woven</p>
                )}
              </div>

              {/* Protagonist */}
              <div className="rounded-xl border border-gold-accent/25 bg-[#161a28] p-3 flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] uppercase text-gold-primary/70">2. Protagonist</span>
                  <button
                    type="button"
                    onClick={() => {
                      setShowOverview(false)
                      handleJumpToPhase(1)
                    }}
                    className="font-mono text-[10px] text-gold-primary hover:underline flex items-center gap-1"
                  >
                    Jump <ArrowRight size={10} />
                  </button>
                </div>
                {accumulated.protagonist ? (
                  <div>
                    <p className="font-display font-semibold text-sm text-gold-primary">{accumulated.protagonist.name}</p>
                    <p className="font-narrative text-xs text-ink-muted">{accumulated.protagonist.background}</p>
                  </div>
                ) : (
                  <p className="font-narrative text-xs italic text-ink-muted">Not yet woven</p>
                )}
              </div>

              {/* Regions & Locations */}
              <div className="rounded-xl border border-gold-accent/25 bg-[#161a28] p-3 flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] uppercase text-gold-primary/70">
                    3. Places ({accumulated.regions.length} regions, {accumulated.locations.length} locations)
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setShowOverview(false)
                      handleJumpToPhase(2)
                    }}
                    className="font-mono text-[10px] text-gold-primary hover:underline flex items-center gap-1"
                  >
                    Jump <ArrowRight size={10} />
                  </button>
                </div>
                {accumulated.locations.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {accumulated.locations.map((l) => (
                      <span key={l.id} className="font-narrative text-xs px-2 py-0.5 rounded bg-black/40 border border-gold-accent/20 text-ink">
                        {l.name}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="font-narrative text-xs italic text-ink-muted">Not yet woven</p>
                )}
              </div>

              {/* Factions */}
              <div className="rounded-xl border border-gold-accent/25 bg-[#161a28] p-3 flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] uppercase text-gold-primary/70">
                    4. Factions ({accumulated.factions.length})
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setShowOverview(false)
                      handleJumpToPhase(3)
                    }}
                    className="font-mono text-[10px] text-gold-primary hover:underline flex items-center gap-1"
                  >
                    Jump <ArrowRight size={10} />
                  </button>
                </div>
                {accumulated.factions.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {accumulated.factions.map((f) => (
                      <span key={f.id} className="font-narrative text-xs px-2 py-0.5 rounded bg-black/40 border border-gold-accent/20 text-ink">
                        {f.name} {f.attitude && `(${f.attitude})`}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="font-narrative text-xs italic text-ink-muted">Not yet woven</p>
                )}
              </div>

              {/* NPCs */}
              <div className="rounded-xl border border-gold-accent/25 bg-[#161a28] p-3 flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] uppercase text-gold-primary/70">
                    5. Cast of Characters ({accumulated.npcs.length})
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setShowOverview(false)
                      handleJumpToPhase(4)
                    }}
                    className="font-mono text-[10px] text-gold-primary hover:underline flex items-center gap-1"
                  >
                    Jump <ArrowRight size={10} />
                  </button>
                </div>
                {accumulated.npcs.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {accumulated.npcs.map((n) => (
                      <span key={n.id} className="font-narrative text-xs px-2 py-0.5 rounded bg-black/40 border border-gold-accent/20 text-ink">
                        {n.name} {n.role && `— ${n.role}`}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="font-narrative text-xs italic text-ink-muted">Not yet woven</p>
                )}
              </div>

              {/* Lore */}
              <div className="rounded-xl border border-gold-accent/25 bg-[#161a28] p-3 flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] uppercase text-gold-primary/70">
                    6. Lore & Secrets ({accumulated.lore.length})
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setShowOverview(false)
                      handleJumpToPhase(5)
                    }}
                    className="font-mono text-[10px] text-gold-primary hover:underline flex items-center gap-1"
                  >
                    Jump <ArrowRight size={10} />
                  </button>
                </div>
                {accumulated.lore.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {accumulated.lore.map((l) => (
                      <span key={l.id} className="font-narrative text-xs px-2 py-0.5 rounded bg-black/40 border border-gold-accent/20 text-ink">
                        {l.name}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="font-narrative text-xs italic text-ink-muted">Not yet woven</p>
                )}
              </div>

              {/* Arc */}
              <div className="rounded-xl border border-gold-accent/25 bg-[#161a28] p-3 flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] uppercase text-gold-primary/70">
                    7. Story Arc ({accumulated.beats.length} beats, {accumulated.narrativeEvents?.length ?? 0} events)
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setShowOverview(false)
                      handleJumpToPhase(6)
                    }}
                    className="font-mono text-[10px] text-gold-primary hover:underline flex items-center gap-1"
                  >
                    Jump <ArrowRight size={10} />
                  </button>
                </div>
                {accumulated.beats.length > 0 ? (
                  <div className="flex flex-col gap-1">
                    {accumulated.beats.map((b, i) => (
                      <p key={b.id} className="font-narrative text-xs text-ink">
                        <span className="text-gold-primary font-mono">{i + 1}.</span> {b.title}
                      </p>
                    ))}
                  </div>
                ) : (
                  <p className="font-narrative text-xs italic text-ink-muted">Not yet woven</p>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-4 py-3 border-t border-gold-accent/20 flex justify-end">
              <button
                type="button"
                onClick={() => setShowOverview(false)}
                className="px-4 py-1.5 rounded-lg border border-gold-accent/30 bg-gold-accent/20 hover:bg-gold-accent/30 text-gold-primary font-display text-xs transition-colors"
              >
                Close Overview
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Dialog (Modal) */}
      {confirmDialog}
    </GlassScreen>
  )
}
