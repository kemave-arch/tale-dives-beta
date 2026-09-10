import { useState, useRef, useEffect } from 'react'
import {
  X, ChevronRight, ChevronLeft, Sparkles, Lock, Unlock,
  BookOpen, AlertCircle, Check, ArrowRight, Pencil, Plus, Save,
  ImagePlus, RotateCw, FolderOpen, Trash2, Bookmark, CheckCircle2
} from 'lucide-react'
import { GlassScreen, GlassHeader } from '../lib/glassChrome.tsx'
import { useConfirm } from '../lib/useConfirm.tsx'
import type { ApiSettings, RevealTrigger } from '../types.ts'
import {
  TALE_WEAVER_PHASES, emptyAccumulated, runTaleWeaverPhase,
  type TaleWeaverAccumulated, type TaleWeaverPhaseDef,
} from '../lib/taleWeaving.ts'
import {
  getTaleWeaverPresets, saveTaleWeaverPreset, deleteTaleWeaverPreset,
  type TaleWeaverPreset
} from '../lib/taleWeaverPresets.ts'
import { useEntityImage } from '../lib/useEntityImage.ts'
import { generateAndStoreEntityImage } from '../lib/entityImages.ts'
import { buildLocationImagePrompt, buildNpcPortraitPrompt, buildRegionMapPrompt } from '../lib/imageGeneration.ts'

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
      return Boolean(acc.world?.name?.trim() || acc.world?.genreTone?.trim() || acc.world?.background?.trim() || acc.world?.conflict?.trim())
    case 'protagonist':
      return Boolean(acc.protagonist?.name?.trim() || acc.protagonist?.background?.trim() || acc.protagonist?.personality?.trim())
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
      return hasPhaseContent('world', acc) ? 1 : 0
    case 'protagonist':
      return hasPhaseContent('protagonist', acc) ? 1 : 0
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

export function hasAnyContent(acc: TaleWeaverAccumulated): boolean {
  return TALE_WEAVER_PHASES.some((p) => hasPhaseContent(p.id, acc))
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

function TaleWeaverImageGenerator({
  imageKey,
  prompt,
  apiSettings,
  onSaveKey,
  aspectRatio = '16:9',
  label = 'Generate Image',
}: {
  imageKey?: string
  prompt: string
  apiSettings: ApiSettings
  onSaveKey: (key: string) => void
  aspectRatio?: '1:1' | '16:9' | '9:16' | '4:3' | '3:2'
  label?: string
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [modelUsed, setModelUsed] = useState<string | null>(null)
  const [refreshToken, setRefreshToken] = useState(0)
  const url = useEntityImage(imageKey, refreshToken)

  async function handleGenerate() {
    if (!apiSettings.apiKey) {
      setError('No API key set — configure your Gemini API key in Settings first.')
      return
    }
    setBusy(true)
    setError(null)
    setModelUsed(null)
    try {
      const key = imageKey || `img_${Math.random().toString(36).slice(2)}_${Date.now()}`
      const usedModel = await generateAndStoreEntityImage({ apiKey: apiSettings.apiKey, prompt, key, aspectRatio })
      setModelUsed(usedModel)
      onSaveKey(key)
      setRefreshToken((t) => t + 1)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(msg)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-1.5 mt-1.5">
      {url && (
        <div className="relative rounded-lg overflow-hidden border border-gold-accent/30 bg-black/60 shadow-md">
          <img
            src={url}
            alt=""
            className={`w-full ${aspectRatio === '1:1' ? 'max-h-36 max-w-[144px] aspect-square object-cover' : 'max-h-36 object-cover'}`}
          />
        </div>
      )}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={handleGenerate}
          disabled={busy}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-gold-accent/15 border border-gold-accent/40 text-gold-primary text-[11px] font-display font-semibold hover:bg-gold-accent/25 transition-colors disabled:opacity-50"
        >
          {busy ? <RotateCw size={12} className="animate-spin" /> : url ? <RotateCw size={12} /> : <ImagePlus size={12} />}
          {busy ? 'Weaving image...' : url ? 'Retry Image' : label}
        </button>
        {modelUsed && !busy && (
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-emerald-950/70 border border-emerald-500/40 text-emerald-300 text-[10.5px] font-mono animate-fade-in shadow-sm">
            <CheckCircle2 size={12} className="text-emerald-400 shrink-0" />
            <span>Generated using <strong className="text-emerald-200 font-semibold">{modelUsed}</strong></span>
          </div>
        )}
      </div>
      {error && (
        <div className="rounded-lg bg-red-950/50 border border-red-500/30 p-2 text-[11px] font-narrative flex flex-col gap-1 text-red-300">
          <div className="flex items-center gap-1.5 font-semibold text-red-200">
            <AlertCircle size={13} className="shrink-0 text-red-400" />
            <span>Image Generation Failed</span>
          </div>
          <p className="text-red-300/90 text-[10.5px] leading-snug">
            {(() => {
              const lower = error.toLowerCase()
              if (lower.includes('403') || lower.includes('permission_denied') || lower.includes('permission') || lower.includes('caller does not have permission')) {
                return 'API Permission error (403: Permission Denied). Check your Gemini API Key in Settings to ensure Image Generation access is enabled.'
              }
              if (lower.includes('429') || lower.includes('quota') || lower.includes('resource_exhausted')) {
                return 'AI model quota or rate limit reached. You can try again now, or retry later after your quota resets.'
              }
              return `${error}. You can retry now, or regenerate later in the Codex.`
            })()}
          </p>
        </div>
      )}
    </div>
  )
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

  const [showSaveModal, setShowSaveModal] = useState(false)
  const [showLoadModal, setShowLoadModal] = useState(false)
  const [presetNameInput, setPresetNameInput] = useState('')
  const [savedPresets, setSavedPresets] = useState<TaleWeaverPreset[]>([])
  const [presetToast, setPresetToast] = useState<string | null>(null)

  function handleSavePreset() {
    if (!presetNameInput.trim()) return
    saveTaleWeaverPreset(presetNameInput.trim(), accumulated)
    setShowSaveModal(false)
    setPresetToast(`Saved preset "${presetNameInput.trim()}"!`)
    setTimeout(() => setPresetToast(null), 3500)
  }

  function handleOpenLoadModal() {
    setSavedPresets(getTaleWeaverPresets())
    setShowLoadModal(true)
  }

  function handleLoadPreset(preset: TaleWeaverPreset) {
    setAccumulated(preset.accumulated)
    setShowLoadModal(false)
    setShowOverview(true)
    setPresetToast(`Loaded preset "${preset.name}"!`)
    setTimeout(() => setPresetToast(null), 3500)
  }

  function handleDeletePreset(id: string) {
    const updated = deleteTaleWeaverPreset(id)
    setSavedPresets(updated)
  }

  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [editFormData, setEditFormData] = useState<any>({})

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
    setEditingKey(null)
    setEditFormData({})
  }, [phaseIdx])

  function startEditing(key: string, initialData: any) {
    setEditingKey(key)
    setEditFormData({ ...initialData })
  }

  function cancelEditing() {
    setEditingKey(null)
    setEditFormData({})
  }

  function saveEditing(key: string) {
    setAccumulated((prev) => {
      const next = { ...prev }
      if (key === 'world') {
        next.world = { ...editFormData }
      } else if (key === 'protagonist') {
        next.protagonist = { ...editFormData }
      } else if (key.startsWith('region_')) {
        const id = key.replace('region_', '')
        next.regions = prev.regions.map((r) => (r.id === id ? { ...r, ...editFormData } : r))
      } else if (key.startsWith('location_')) {
        const id = key.replace('location_', '')
        next.locations = prev.locations.map((l) => (l.id === id ? { ...l, ...editFormData } : l))
      } else if (key.startsWith('faction_')) {
        const id = key.replace('faction_', '')
        next.factions = prev.factions.map((f) => (f.id === id ? { ...f, ...editFormData } : f))
      } else if (key.startsWith('npc_')) {
        const id = key.replace('npc_', '')
        next.npcs = prev.npcs.map((n) => (n.id === id ? { ...n, ...editFormData } : n))
      } else if (key.startsWith('lore_')) {
        const id = key.replace('lore_', '')
        next.lore = prev.lore.map((l) => (l.id === id ? { ...l, ...editFormData } : l))
      } else if (key.startsWith('beat_')) {
        const id = key.replace('beat_', '')
        next.beats = prev.beats.map((b) => (b.id === id ? { ...b, ...editFormData } : b))
      } else if (key.startsWith('event_')) {
        const id = key.replace('event_', '')
        next.narrativeEvents = (prev.narrativeEvents || []).map((e) => (e.id === id ? { ...e, ...editFormData } : e))
      } else if (key === 'stakes') {
        next.deathRule = editFormData.deathRule
        next.deathInstructions = editFormData.deathInstructions
        next.endGameRules = { ...editFormData.endGameRules }
      }
      return next
    })
    setEditingKey(null)
    setEditFormData({})
  }

  function addCustomItem(category: 'regions' | 'locations' | 'factions' | 'npcs' | 'lore' | 'beats' | 'narrativeEvents') {
    const timeId = `${category.slice(0, 3)}_${Date.now().toString(36)}`
    if (category === 'regions') {
      const newRegion = { id: timeId, name: 'New Region', desc: '' }
      setAccumulated((prev) => ({ ...prev, regions: [...prev.regions, newRegion] }))
      startEditing(`region_${timeId}`, newRegion)
    } else if (category === 'locations') {
      const newLoc = { id: timeId, name: 'New Location', locationType: 'Landmark', danger: 'Safe', desc: '', regionId: accumulated.regions[0]?.id }
      setAccumulated((prev) => ({ ...prev, locations: [...prev.locations, newLoc] }))
      startEditing(`location_${timeId}`, newLoc)
    } else if (category === 'factions') {
      const newFaction = { id: timeId, name: 'New Faction', attitude: 'neutral' as const, territory: '', desc: '' }
      setAccumulated((prev) => ({ ...prev, factions: [...prev.factions, newFaction] }))
      startEditing(`faction_${timeId}`, newFaction)
    } else if (category === 'npcs') {
      const newNpc = { id: timeId, name: 'New Character', role: 'Ally', personality: '', appearance: '' }
      setAccumulated((prev) => ({ ...prev, npcs: [...prev.npcs, newNpc] }))
      startEditing(`npc_${timeId}`, newNpc)
    } else if (category === 'lore') {
      const newLore = { id: timeId, name: 'New Secret / History', category: 'History', content: '' }
      setAccumulated((prev) => ({ ...prev, lore: [...prev.lore, newLore] }))
      startEditing(`lore_${timeId}`, newLore)
    } else if (category === 'beats') {
      const newBeat = { id: timeId, title: 'New Story Beat', summary: '' }
      setAccumulated((prev) => ({ ...prev, beats: [...prev.beats, newBeat] }))
      startEditing(`beat_${timeId}`, newBeat)
    } else if (category === 'narrativeEvents') {
      const newEvent = { id: timeId, title: 'New Complication', trigger: 'story' as RevealTrigger, condition: '', guidance: '' }
      setAccumulated((prev) => ({
        ...prev,
        narrativeEvents: [...(prev.narrativeEvents || []), newEvent],
      }))
      startEditing(`event_${timeId}`, newEvent)
    }
  }

  function startManualWorld() {
    const defaultWorld = {
      name: 'A Custom Realm',
      genreTone: 'Dark Fantasy',
      conflict: '',
      powerSystem: '',
      eraTechLevel: 'Late Medieval',
      keyFactions: '',
      background: '',
    }
    setAccumulated((prev) => ({ ...prev, world: defaultWorld }))
    startEditing('world', defaultWorld)
  }

  function startManualProtagonist() {
    const defaultProtag = {
      name: 'Hero',
      background: '',
      personality: '',
      motivation: '',
      physicalTrait: '',
      secret: '',
      opening: '',
    }
    setAccumulated((prev) => ({ ...prev, protagonist: defaultProtag }))
    startEditing('protagonist', defaultProtag)
  }

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
        const ok = await confirm('No story beats have been woven yet. View the Tale Overview anyway?')
        if (!ok) return
      }
      setShowOverview(true)
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
        if (!w) {
          return (
            <div className="flex justify-center pt-2">
              <button
                type="button"
                onClick={startManualWorld}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gold-accent/30 bg-[#161a28] hover:bg-gold-accent/15 text-gold-primary text-xs font-display transition-colors"
              >
                <Plus size={14} />
                <span>Create World Foundation Manually</span>
              </button>
            </div>
          )
        }

        if (editingKey === 'world') {
          return (
            <div className="rounded-xl border border-gold-primary/60 bg-[#161a28] p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between border-b border-gold-accent/20 pb-2">
                <span className="font-mono text-[10px] uppercase tracking-wider text-gold-primary font-bold">Edit World Foundation</span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => saveEditing('world')}
                    className="px-2.5 py-1 rounded-lg bg-gold-primary text-black font-display font-bold text-xs flex items-center gap-1 hover:bg-gold-primary/90 transition-colors"
                  >
                    <Save size={13} /> Save
                  </button>
                  <button
                    type="button"
                    onClick={cancelEditing}
                    className="px-2 py-1 rounded-lg border border-gold-accent/30 text-ink-muted font-display text-xs hover:text-ink transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="flex flex-col gap-1">
                  <label className="font-mono text-[10px] uppercase text-gold-primary/70">World Name</label>
                  <input
                    type="text"
                    value={editFormData.name || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                    className="px-2.5 py-1.5 rounded-lg bg-[#0d1017] border border-gold-accent/30 text-xs text-ink outline-none focus:border-gold-primary"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-mono text-[10px] uppercase text-gold-primary/70">Genre & Tone</label>
                  <input
                    type="text"
                    value={editFormData.genreTone || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, genreTone: e.target.value })}
                    className="px-2.5 py-1.5 rounded-lg bg-[#0d1017] border border-gold-accent/30 text-xs text-ink outline-none focus:border-gold-primary"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-mono text-[10px] uppercase text-gold-primary/70">Era & Technology</label>
                  <input
                    type="text"
                    value={editFormData.eraTechLevel || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, eraTechLevel: e.target.value })}
                    className="px-2.5 py-1.5 rounded-lg bg-[#0d1017] border border-gold-accent/30 text-xs text-ink outline-none focus:border-gold-primary"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-mono text-[10px] uppercase text-gold-primary/70">Power & Magic System</label>
                  <input
                    type="text"
                    value={editFormData.powerSystem || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, powerSystem: e.target.value })}
                    className="px-2.5 py-1.5 rounded-lg bg-[#0d1017] border border-gold-accent/30 text-xs text-ink outline-none focus:border-gold-primary"
                  />
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <label className="font-mono text-[10px] uppercase text-gold-primary/70">Key Factions Summary</label>
                <input
                  type="text"
                  value={editFormData.keyFactions || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, keyFactions: e.target.value })}
                  className="px-2.5 py-1.5 rounded-lg bg-[#0d1017] border border-gold-accent/30 text-xs text-ink outline-none focus:border-gold-primary"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="font-mono text-[10px] uppercase text-gold-primary/70">Central Conflict</label>
                <textarea
                  rows={2}
                  value={editFormData.conflict || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, conflict: e.target.value })}
                  className="px-2.5 py-1.5 rounded-lg bg-[#0d1017] border border-gold-accent/30 text-xs text-ink outline-none focus:border-gold-primary resize-none"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="font-mono text-[10px] uppercase text-gold-primary/70">World Background / Lore</label>
                <textarea
                  rows={3}
                  value={editFormData.background || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, background: e.target.value })}
                  className="px-2.5 py-1.5 rounded-lg bg-[#0d1017] border border-gold-accent/30 text-xs text-ink outline-none focus:border-gold-primary resize-none"
                />
              </div>
            </div>
          )
        }

        return (
          <div className="rounded-xl border border-gold-accent/35 bg-[#161a28] p-4 flex flex-col gap-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <span className="font-mono text-[10px] uppercase tracking-wider text-gold-primary/70">World Foundation</span>
                <h3 className="font-display font-bold text-base text-gold-primary">{w.name || 'Untitled World'}</h3>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => startEditing('world', w)}
                  className="text-gold-primary/70 hover:text-gold-primary p-1 rounded hover:bg-gold-accent/10 transition-colors"
                  title="Edit World Foundation"
                >
                  <Pencil size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => clearSingle('world')}
                  className="text-red-400/70 hover:text-red-300 p-1 rounded hover:bg-red-400/10 transition-colors"
                  title="Clear world"
                >
                  <X size={15} />
                </button>
              </div>
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
            {w.background && (
              <div>
                <span className="font-mono text-[10px] uppercase text-ink-muted/80">Background & History</span>
                <p className="font-narrative text-xs text-ink/80">{w.background}</p>
              </div>
            )}
          </div>
        )
      }

      case 'protagonist': {
        const p = accumulated.protagonist
        if (!p) {
          return (
            <div className="flex justify-center pt-2">
              <button
                type="button"
                onClick={startManualProtagonist}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gold-accent/30 bg-[#161a28] hover:bg-gold-accent/15 text-gold-primary text-xs font-display transition-colors"
              >
                <Plus size={14} />
                <span>Create Protagonist Manually</span>
              </button>
            </div>
          )
        }

        if (editingKey === 'protagonist') {
          return (
            <div className="rounded-xl border border-gold-primary/60 bg-[#161a28] p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between border-b border-gold-accent/20 pb-2">
                <span className="font-mono text-[10px] uppercase tracking-wider text-gold-primary font-bold">Edit Protagonist</span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => saveEditing('protagonist')}
                    className="px-2.5 py-1 rounded-lg bg-gold-primary text-black font-display font-bold text-xs flex items-center gap-1 hover:bg-gold-primary/90 transition-colors"
                  >
                    <Save size={13} /> Save
                  </button>
                  <button
                    type="button"
                    onClick={cancelEditing}
                    className="px-2 py-1 rounded-lg border border-gold-accent/30 text-ink-muted font-display text-xs hover:text-ink transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="flex flex-col gap-1">
                  <label className="font-mono text-[10px] uppercase text-gold-primary/70">Name</label>
                  <input
                    type="text"
                    value={editFormData.name || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                    className="px-2.5 py-1.5 rounded-lg bg-[#0d1017] border border-gold-accent/30 text-xs text-ink outline-none focus:border-gold-primary"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-mono text-[10px] uppercase text-gold-primary/70">Demeanor & Traits</label>
                  <input
                    type="text"
                    value={editFormData.personality || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, personality: e.target.value })}
                    className="px-2.5 py-1.5 rounded-lg bg-[#0d1017] border border-gold-accent/30 text-xs text-ink outline-none focus:border-gold-primary"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-mono text-[10px] uppercase text-gold-primary/70">Core Drive & Goal</label>
                  <input
                    type="text"
                    value={editFormData.motivation || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, motivation: e.target.value })}
                    className="px-2.5 py-1.5 rounded-lg bg-[#0d1017] border border-gold-accent/30 text-xs text-ink outline-none focus:border-gold-primary"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-mono text-[10px] uppercase text-gold-primary/70">Physical Trait</label>
                  <input
                    type="text"
                    value={editFormData.physicalTrait || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, physicalTrait: e.target.value })}
                    className="px-2.5 py-1.5 rounded-lg bg-[#0d1017] border border-gold-accent/30 text-xs text-ink outline-none focus:border-gold-primary"
                  />
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <label className="font-mono text-[10px] uppercase text-gold-primary/70">Origin & Background</label>
                <textarea
                  rows={2}
                  value={editFormData.background || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, background: e.target.value })}
                  className="px-2.5 py-1.5 rounded-lg bg-[#0d1017] border border-gold-accent/30 text-xs text-ink outline-none focus:border-gold-primary resize-none"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="font-mono text-[10px] uppercase text-gold-primary/70">Hidden Secret</label>
                <input
                  type="text"
                  value={editFormData.secret || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, secret: e.target.value })}
                  className="px-2.5 py-1.5 rounded-lg bg-[#0d1017] border border-gold-accent/30 text-xs text-ink outline-none focus:border-gold-primary"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="font-mono text-[10px] uppercase text-gold-primary/70">Opening Scene Setup</label>
                <textarea
                  rows={2}
                  value={editFormData.opening || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, opening: e.target.value })}
                  className="px-2.5 py-1.5 rounded-lg bg-[#0d1017] border border-gold-accent/30 text-xs text-ink outline-none focus:border-gold-primary resize-none"
                />
              </div>
            </div>
          )
        }

        return (
          <div className="rounded-xl border border-gold-accent/35 bg-[#161a28] p-4 flex flex-col gap-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <span className="font-mono text-[10px] uppercase tracking-wider text-gold-primary/70">Protagonist</span>
                <h3 className="font-display font-bold text-base text-gold-primary">{p.name || 'Unnamed Protagonist'}</h3>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => startEditing('protagonist', p)}
                  className="text-gold-primary/70 hover:text-gold-primary p-1 rounded hover:bg-gold-accent/10 transition-colors"
                  title="Edit Protagonist"
                >
                  <Pencil size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => clearSingle('protagonist')}
                  className="text-red-400/70 hover:text-red-300 p-1 rounded hover:bg-red-400/10 transition-colors"
                  title="Clear protagonist"
                >
                  <X size={15} />
                </button>
              </div>
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
        const hasRegions = accumulated.regions.length > 0
        const hasLocations = accumulated.locations.length > 0
        if (!hasRegions && !hasLocations) {
          return (
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => addCustomItem('regions')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gold-accent/30 bg-[#161a28] hover:bg-gold-accent/15 text-gold-primary text-xs font-display transition-colors"
              >
                <Plus size={14} />
                <span>Add Region</span>
              </button>
              <button
                type="button"
                onClick={() => addCustomItem('locations')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gold-accent/30 bg-[#161a28] hover:bg-gold-accent/15 text-gold-primary text-xs font-display transition-colors"
              >
                <Plus size={14} />
                <span>Add Location</span>
              </button>
            </div>
          )
        }

        return (
          <div className="flex flex-col gap-4">
            {/* Regions Section */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] uppercase tracking-wider text-gold-primary/70">Regions</span>
                <button
                  type="button"
                  onClick={() => addCustomItem('regions')}
                  className="flex items-center gap-1 font-mono text-[10px] text-gold-primary hover:underline"
                >
                  <Plus size={12} /> Add Region
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {accumulated.regions.map((r) => {
                  const isEditing = editingKey === `region_${r.id}`
                  if (isEditing) {
                    return (
                      <div key={r.id} className="rounded-xl border border-gold-primary/60 bg-[#161a28] p-3 flex flex-col gap-2 col-span-1 sm:col-span-2">
                        <div className="flex items-center justify-between border-b border-gold-accent/20 pb-1.5">
                          <span className="font-mono text-[10px] uppercase text-gold-primary font-bold">Edit Region</span>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => saveEditing(`region_${r.id}`)}
                              className="px-2 py-0.5 rounded bg-gold-primary text-black font-display font-bold text-xs flex items-center gap-1"
                            >
                              <Save size={12} /> Save
                            </button>
                            <button type="button" onClick={cancelEditing} className="px-2 py-0.5 rounded border border-gold-accent/30 text-xs">
                              Cancel
                            </button>
                          </div>
                        </div>
                        <input
                          type="text"
                          value={editFormData.name || ''}
                          onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                          placeholder="Region Name"
                          className="px-2.5 py-1 rounded-lg bg-[#0d1017] border border-gold-accent/30 text-xs text-ink outline-none focus:border-gold-primary"
                        />
                        <textarea
                          rows={2}
                          value={editFormData.desc || ''}
                          onChange={(e) => setEditFormData({ ...editFormData, desc: e.target.value })}
                          placeholder="Region Description"
                          className="px-2.5 py-1 rounded-lg bg-[#0d1017] border border-gold-accent/30 text-xs text-ink outline-none focus:border-gold-primary resize-none"
                        />
                      </div>
                    )
                  }
                  return (
                    <div key={r.id} className="rounded-xl border border-gold-accent/30 bg-[#161a28] p-3 flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-display font-semibold text-sm text-gold-primary truncate">{r.name}</p>
                        {r.desc && <p className="font-narrative text-xs text-ink-muted line-clamp-2">{r.desc}</p>}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => startEditing(`region_${r.id}`, r)}
                          className="text-gold-primary/70 hover:text-gold-primary p-1"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeItem('regions', r.id)}
                          className="text-red-400/70 hover:text-red-300 p-1"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Locations Section */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] uppercase tracking-wider text-gold-primary/70">Locations</span>
                <button
                  type="button"
                  onClick={() => addCustomItem('locations')}
                  className="flex items-center gap-1 font-mono text-[10px] text-gold-primary hover:underline"
                >
                  <Plus size={12} /> Add Location
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {accumulated.locations.map((l) => {
                  const region = accumulated.regions.find((r) => r.id === l.regionId)
                  const isEditing = editingKey === `location_${l.id}`
                  if (isEditing) {
                    return (
                      <div key={l.id} className="rounded-xl border border-gold-primary/60 bg-[#161a28] p-3 flex flex-col gap-2 col-span-1 sm:col-span-2">
                        <div className="flex items-center justify-between border-b border-gold-accent/20 pb-1.5">
                          <span className="font-mono text-[10px] uppercase text-gold-primary font-bold">Edit Location</span>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => saveEditing(`location_${l.id}`)}
                              className="px-2 py-0.5 rounded bg-gold-primary text-black font-display font-bold text-xs flex items-center gap-1"
                            >
                              <Save size={12} /> Save
                            </button>
                            <button type="button" onClick={cancelEditing} className="px-2 py-0.5 rounded border border-gold-accent/30 text-xs">
                              Cancel
                            </button>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <input
                            type="text"
                            value={editFormData.name || ''}
                            onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                            placeholder="Location Name"
                            className="px-2.5 py-1 rounded-lg bg-[#0d1017] border border-gold-accent/30 text-xs text-ink outline-none"
                          />
                          <select
                            value={editFormData.regionId || ''}
                            onChange={(e) => setEditFormData({ ...editFormData, regionId: e.target.value })}
                            className="px-2 py-1 rounded-lg bg-[#0d1017] border border-gold-accent/30 text-xs text-ink outline-none"
                          >
                            <option value="">No Specific Region</option>
                            {accumulated.regions.map((r) => (
                              <option key={r.id} value={r.id}>
                                {r.name}
                              </option>
                            ))}
                          </select>
                          <input
                            type="text"
                            value={editFormData.locationType || ''}
                            onChange={(e) => setEditFormData({ ...editFormData, locationType: e.target.value })}
                            placeholder="Type (e.g. Landmark, Settlement)"
                            className="px-2.5 py-1 rounded-lg bg-[#0d1017] border border-gold-accent/30 text-xs text-ink outline-none"
                          />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <input
                            type="text"
                            value={editFormData.danger || ''}
                            onChange={(e) => setEditFormData({ ...editFormData, danger: e.target.value })}
                            placeholder="Danger Level (e.g. Safe, Perilous)"
                            className="px-2.5 py-1 rounded-lg bg-[#0d1017] border border-gold-accent/30 text-xs text-ink outline-none"
                          />
                          <input
                            type="text"
                            value={editFormData.areas || ''}
                            onChange={(e) => setEditFormData({ ...editFormData, areas: e.target.value })}
                            placeholder="Sub-areas (comma separated)"
                            className="px-2.5 py-1 rounded-lg bg-[#0d1017] border border-gold-accent/30 text-xs text-ink outline-none"
                          />
                        </div>
                        <textarea
                          rows={2}
                          value={editFormData.desc || ''}
                          onChange={(e) => setEditFormData({ ...editFormData, desc: e.target.value })}
                          placeholder="Location Description"
                          className="px-2.5 py-1 rounded-lg bg-[#0d1017] border border-gold-accent/30 text-xs text-ink outline-none resize-none"
                        />
                      </div>
                    )
                  }
                  return (
                    <div key={l.id} className="rounded-xl border border-gold-accent/30 bg-[#161a28] p-3 flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
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
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => startEditing(`location_${l.id}`, l)}
                          className="text-gold-primary/70 hover:text-gold-primary p-1"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeItem('locations', l.id)}
                          className="text-red-400/70 hover:text-red-300 p-1"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )
      }

      case 'factions': {
        return (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] uppercase tracking-wider text-gold-primary/70">Factions</span>
              <button
                type="button"
                onClick={() => addCustomItem('factions')}
                className="flex items-center gap-1 font-mono text-[10px] text-gold-primary hover:underline"
              >
                <Plus size={12} /> Add Faction
              </button>
            </div>
            {!accumulated.factions.length ? (
              <div className="flex justify-center pt-2">
                <button
                  type="button"
                  onClick={() => addCustomItem('factions')}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gold-accent/30 bg-[#161a28] hover:bg-gold-accent/15 text-gold-primary text-xs font-display transition-colors"
                >
                  <Plus size={14} />
                  <span>Add Faction Manually</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {accumulated.factions.map((f) => {
                  const isEditing = editingKey === `faction_${f.id}`
                  if (isEditing) {
                    return (
                      <div key={f.id} className="rounded-xl border border-gold-primary/60 bg-[#161a28] p-3 flex flex-col gap-2 col-span-1 sm:col-span-2">
                        <div className="flex items-center justify-between border-b border-gold-accent/20 pb-1.5">
                          <span className="font-mono text-[10px] uppercase text-gold-primary font-bold">Edit Faction</span>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => saveEditing(`faction_${f.id}`)}
                              className="px-2 py-0.5 rounded bg-gold-primary text-black font-display font-bold text-xs flex items-center gap-1"
                            >
                              <Save size={12} /> Save
                            </button>
                            <button type="button" onClick={cancelEditing} className="px-2 py-0.5 rounded border border-gold-accent/30 text-xs">
                              Cancel
                            </button>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <input
                            type="text"
                            value={editFormData.name || ''}
                            onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                            placeholder="Faction Name"
                            className="px-2.5 py-1 rounded-lg bg-[#0d1017] border border-gold-accent/30 text-xs text-ink outline-none"
                          />
                          <select
                            value={editFormData.attitude || 'neutral'}
                            onChange={(e) => setEditFormData({ ...editFormData, attitude: e.target.value })}
                            className="px-2 py-1 rounded-lg bg-[#0d1017] border border-gold-accent/30 text-xs text-ink outline-none"
                          >
                            <option value="allied">Allied</option>
                            <option value="friendly">Friendly</option>
                            <option value="neutral">Neutral</option>
                            <option value="hostile">Hostile</option>
                            <option value="rival">Rival</option>
                          </select>
                          <input
                            type="text"
                            value={editFormData.territory || ''}
                            onChange={(e) => setEditFormData({ ...editFormData, territory: e.target.value })}
                            placeholder="Territory / Domain"
                            className="px-2.5 py-1 rounded-lg bg-[#0d1017] border border-gold-accent/30 text-xs text-ink outline-none"
                          />
                        </div>
                        <textarea
                          rows={2}
                          value={editFormData.desc || ''}
                          onChange={(e) => setEditFormData({ ...editFormData, desc: e.target.value })}
                          placeholder="Faction Description"
                          className="px-2.5 py-1 rounded-lg bg-[#0d1017] border border-gold-accent/30 text-xs text-ink outline-none resize-none"
                        />
                      </div>
                    )
                  }

                  return (
                    <div key={f.id} className="rounded-xl border border-gold-accent/30 bg-[#161a28] p-3 flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
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
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => startEditing(`faction_${f.id}`, f)}
                          className="text-gold-primary/70 hover:text-gold-primary p-1"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeItem('factions', f.id)}
                          className="text-red-400/70 hover:text-red-300 p-1"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      }

      case 'npcs': {
        return (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] uppercase tracking-wider text-gold-primary/70">Cast of Characters</span>
              <button
                type="button"
                onClick={() => addCustomItem('npcs')}
                className="flex items-center gap-1 font-mono text-[10px] text-gold-primary hover:underline"
              >
                <Plus size={12} /> Add Character
              </button>
            </div>
            {!accumulated.npcs.length ? (
              <div className="flex justify-center pt-2">
                <button
                  type="button"
                  onClick={() => addCustomItem('npcs')}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gold-accent/30 bg-[#161a28] hover:bg-gold-accent/15 text-gold-primary text-xs font-display transition-colors"
                >
                  <Plus size={14} />
                  <span>Add Character Manually</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {accumulated.npcs.map((n) => {
                  const isEditing = editingKey === `npc_${n.id}`
                  if (isEditing) {
                    return (
                      <div key={n.id} className="rounded-xl border border-gold-primary/60 bg-[#161a28] p-3 flex flex-col gap-2 col-span-1 sm:col-span-2">
                        <div className="flex items-center justify-between border-b border-gold-accent/20 pb-1.5">
                          <span className="font-mono text-[10px] uppercase text-gold-primary font-bold">Edit Character</span>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => saveEditing(`npc_${n.id}`)}
                              className="px-2 py-0.5 rounded bg-gold-primary text-black font-display font-bold text-xs flex items-center gap-1"
                            >
                              <Save size={12} /> Save
                            </button>
                            <button type="button" onClick={cancelEditing} className="px-2 py-0.5 rounded border border-gold-accent/30 text-xs">
                              Cancel
                            </button>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <input
                            type="text"
                            value={editFormData.name || ''}
                            onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                            placeholder="Character Name"
                            className="px-2.5 py-1 rounded-lg bg-[#0d1017] border border-gold-accent/30 text-xs text-ink outline-none"
                          />
                          <input
                            type="text"
                            value={editFormData.role || ''}
                            onChange={(e) => setEditFormData({ ...editFormData, role: e.target.value })}
                            placeholder="Role / Title"
                            className="px-2.5 py-1 rounded-lg bg-[#0d1017] border border-gold-accent/30 text-xs text-ink outline-none"
                          />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <select
                            value={editFormData.aff || ''}
                            onChange={(e) => setEditFormData({ ...editFormData, aff: e.target.value })}
                            className="px-2 py-1 rounded-lg bg-[#0d1017] border border-gold-accent/30 text-xs text-ink outline-none"
                          >
                            <option value="">Affection (Default: Neutral)</option>
                            <option value="Stranger">Stranger</option>
                            <option value="Acquaintance">Acquaintance</option>
                            <option value="Friend">Friend</option>
                            <option value="Confidant">Confidant</option>
                            <option value="Beloved">Beloved</option>
                          </select>
                          <select
                            value={editFormData.trust || ''}
                            onChange={(e) => setEditFormData({ ...editFormData, trust: e.target.value })}
                            className="px-2 py-1 rounded-lg bg-[#0d1017] border border-gold-accent/30 text-xs text-ink outline-none"
                          >
                            <option value="">Trust (Default: Neutral)</option>
                            <option value="Distrustful">Distrustful</option>
                            <option value="Wary">Wary</option>
                            <option value="Reliable">Reliable</option>
                            <option value="Trusted">Trusted</option>
                            <option value="Devoted">Devoted</option>
                          </select>
                        </div>
                        <input
                          type="text"
                          value={editFormData.personality || ''}
                          onChange={(e) => setEditFormData({ ...editFormData, personality: e.target.value })}
                          placeholder="Personality & Behavior"
                          className="px-2.5 py-1 rounded-lg bg-[#0d1017] border border-gold-accent/30 text-xs text-ink outline-none"
                        />
                        <textarea
                          rows={2}
                          value={editFormData.appearance || ''}
                          onChange={(e) => setEditFormData({ ...editFormData, appearance: e.target.value })}
                          placeholder="Physical Appearance & Attire"
                          className="px-2.5 py-1 rounded-lg bg-[#0d1017] border border-gold-accent/30 text-xs text-ink outline-none resize-none"
                        />
                      </div>
                    )
                  }

                  return (
                    <div key={n.id} className="rounded-xl border border-gold-accent/30 bg-[#161a28] p-3 flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
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
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => startEditing(`npc_${n.id}`, n)}
                          className="text-gold-primary/70 hover:text-gold-primary p-1"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeItem('npcs', n.id)}
                          className="text-red-400/70 hover:text-red-300 p-1"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      }

      case 'lore': {
        return (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] uppercase tracking-wider text-gold-primary/70">Lore & Secrets</span>
              <button
                type="button"
                onClick={() => addCustomItem('lore')}
                className="flex items-center gap-1 font-mono text-[10px] text-gold-primary hover:underline"
              >
                <Plus size={12} /> Add Lore
              </button>
            </div>
            {!accumulated.lore.length ? (
              <div className="flex justify-center pt-2">
                <button
                  type="button"
                  onClick={() => addCustomItem('lore')}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gold-accent/30 bg-[#161a28] hover:bg-gold-accent/15 text-gold-primary text-xs font-display transition-colors"
                >
                  <Plus size={14} />
                  <span>Add Lore Manually</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {accumulated.lore.map((l) => {
                  const isEditing = editingKey === `lore_${l.id}`
                  if (isEditing) {
                    return (
                      <div key={l.id} className="rounded-xl border border-gold-primary/60 bg-[#161a28] p-3 flex flex-col gap-2 col-span-1 sm:col-span-2">
                        <div className="flex items-center justify-between border-b border-gold-accent/20 pb-1.5">
                          <span className="font-mono text-[10px] uppercase text-gold-primary font-bold">Edit Lore</span>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => saveEditing(`lore_${l.id}`)}
                              className="px-2 py-0.5 rounded bg-gold-primary text-black font-display font-bold text-xs flex items-center gap-1"
                            >
                              <Save size={12} /> Save
                            </button>
                            <button type="button" onClick={cancelEditing} className="px-2 py-0.5 rounded border border-gold-accent/30 text-xs">
                              Cancel
                            </button>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <input
                            type="text"
                            value={editFormData.name || ''}
                            onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                            placeholder="Lore Name"
                            className="px-2.5 py-1 rounded-lg bg-[#0d1017] border border-gold-accent/30 text-xs text-ink outline-none"
                          />
                          <input
                            type="text"
                            value={editFormData.category || ''}
                            onChange={(e) => setEditFormData({ ...editFormData, category: e.target.value })}
                            placeholder="Category (e.g. History, Myth)"
                            className="px-2.5 py-1 rounded-lg bg-[#0d1017] border border-gold-accent/30 text-xs text-ink outline-none"
                          />
                          <input
                            type="text"
                            value={editFormData.era || ''}
                            onChange={(e) => setEditFormData({ ...editFormData, era: e.target.value })}
                            placeholder="Era / Period"
                            className="px-2.5 py-1 rounded-lg bg-[#0d1017] border border-gold-accent/30 text-xs text-ink outline-none"
                          />
                        </div>
                        <textarea
                          rows={2}
                          value={editFormData.content || ''}
                          onChange={(e) => setEditFormData({ ...editFormData, content: e.target.value })}
                          placeholder="Lore Content"
                          className="px-2.5 py-1 rounded-lg bg-[#0d1017] border border-gold-accent/30 text-xs text-ink outline-none resize-none"
                        />
                      </div>
                    )
                  }

                  return (
                    <div key={l.id} className="rounded-xl border border-gold-accent/30 bg-[#161a28] p-3 flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
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
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => startEditing(`lore_${l.id}`, l)}
                          className="text-gold-primary/70 hover:text-gold-primary p-1"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeItem('lore', l.id)}
                          className="text-red-400/70 hover:text-red-300 p-1"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      }

      case 'arc': {
        const hasBeats = accumulated.beats.length > 0
        const hasEvents = (accumulated.narrativeEvents?.length ?? 0) > 0
        const hasStakes = Boolean(accumulated.deathRule || accumulated.endGameRules)

        return (
          <div className="flex flex-col gap-4">
            {/* Story Beats */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] uppercase tracking-wider text-gold-primary/70">Story Beats</span>
                <button
                  type="button"
                  onClick={() => addCustomItem('beats')}
                  className="flex items-center gap-1 font-mono text-[10px] text-gold-primary hover:underline"
                >
                  <Plus size={12} /> Add Beat
                </button>
              </div>
              {!hasBeats ? (
                <div className="flex justify-center pt-1">
                  <button
                    type="button"
                    onClick={() => addCustomItem('beats')}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gold-accent/30 bg-[#161a28] hover:bg-gold-accent/15 text-gold-primary text-xs font-display transition-colors"
                  >
                    <Plus size={14} />
                    <span>Add Story Beat Manually</span>
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {accumulated.beats.map((b, i) => {
                    const revealed = revealedBeats.has(b.id)
                    const isEditing = editingKey === `beat_${b.id}`
                    if (isEditing) {
                      return (
                        <div key={b.id} className="rounded-xl border border-gold-primary/60 bg-[#161a28] p-3 flex flex-col gap-2">
                          <div className="flex items-center justify-between border-b border-gold-accent/20 pb-1.5">
                            <span className="font-mono text-[10px] uppercase text-gold-primary font-bold">Edit Story Beat #{i + 1}</span>
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => saveEditing(`beat_${b.id}`)}
                                className="px-2 py-0.5 rounded bg-gold-primary text-black font-display font-bold text-xs flex items-center gap-1"
                              >
                                <Save size={12} /> Save
                              </button>
                              <button type="button" onClick={cancelEditing} className="px-2 py-0.5 rounded border border-gold-accent/30 text-xs">
                                Cancel
                              </button>
                            </div>
                          </div>
                          <input
                            type="text"
                            value={editFormData.title || ''}
                            onChange={(e) => setEditFormData({ ...editFormData, title: e.target.value })}
                            placeholder="Beat Title"
                            className="px-2.5 py-1 rounded-lg bg-[#0d1017] border border-gold-accent/30 text-xs text-ink outline-none"
                          />
                          <textarea
                            rows={2}
                            value={editFormData.summary || ''}
                            onChange={(e) => setEditFormData({ ...editFormData, summary: e.target.value })}
                            placeholder="Beat Summary / Spoiler Premise"
                            className="px-2.5 py-1 rounded-lg bg-[#0d1017] border border-gold-accent/30 text-xs text-ink outline-none resize-none"
                          />
                        </div>
                      )
                    }

                    return (
                      <div key={b.id} className="rounded-xl border border-gold-accent/30 bg-[#161a28] p-3 flex flex-col gap-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-display font-semibold text-sm text-gold-primary">
                            {i + 1}. {b.title}
                          </span>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => startEditing(`beat_${b.id}`, b)}
                              className="text-gold-primary/70 hover:text-gold-primary p-1 rounded hover:bg-gold-accent/10 transition-colors"
                              title="Edit Beat"
                            >
                              <Pencil size={13} />
                            </button>
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
              )}
            </div>

            {/* Complications */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] uppercase tracking-wider text-gold-primary/70">
                  Complications / Narrative Events
                </span>
                <button
                  type="button"
                  onClick={() => addCustomItem('narrativeEvents')}
                  className="flex items-center gap-1 font-mono text-[10px] text-gold-primary hover:underline"
                >
                  <Plus size={12} /> Add Event
                </button>
              </div>
              {hasEvents && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {accumulated.narrativeEvents!.map((e) => {
                    const isEditing = editingKey === `event_${e.id}`
                    if (isEditing) {
                      return (
                        <div key={e.id} className="rounded-xl border border-gold-primary/60 bg-[#161a28] p-3 flex flex-col gap-2 col-span-1 sm:col-span-2">
                          <div className="flex items-center justify-between border-b border-gold-accent/20 pb-1.5">
                            <span className="font-mono text-[10px] uppercase text-gold-primary font-bold">Edit Complication</span>
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => saveEditing(`event_${e.id}`)}
                                className="px-2 py-0.5 rounded bg-gold-primary text-black font-display font-bold text-xs flex items-center gap-1"
                              >
                                <Save size={12} /> Save
                              </button>
                              <button type="button" onClick={cancelEditing} className="px-2 py-0.5 rounded border border-gold-accent/30 text-xs">
                                Cancel
                              </button>
                            </div>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <input
                              type="text"
                              value={editFormData.title || ''}
                              onChange={(ev) => setEditFormData({ ...editFormData, title: ev.target.value })}
                              placeholder="Event Title"
                              className="px-2.5 py-1 rounded-lg bg-[#0d1017] border border-gold-accent/30 text-xs text-ink outline-none"
                            />
                            <input
                              type="text"
                              value={editFormData.trigger || ''}
                              onChange={(ev) => setEditFormData({ ...editFormData, trigger: ev.target.value })}
                              placeholder="Trigger Type (story, location_visit, etc.)"
                              className="px-2.5 py-1 rounded-lg bg-[#0d1017] border border-gold-accent/30 text-xs text-ink outline-none"
                            />
                          </div>
                          <input
                            type="text"
                            value={editFormData.condition || ''}
                            onChange={(ev) => setEditFormData({ ...editFormData, condition: ev.target.value })}
                            placeholder="Condition / Target"
                            className="px-2.5 py-1 rounded-lg bg-[#0d1017] border border-gold-accent/30 text-xs text-ink outline-none"
                          />
                          <textarea
                            rows={2}
                            value={editFormData.guidance || ''}
                            onChange={(ev) => setEditFormData({ ...editFormData, guidance: ev.target.value })}
                            placeholder="Steering Guidance"
                            className="px-2.5 py-1 rounded-lg bg-[#0d1017] border border-gold-accent/30 text-xs text-ink outline-none resize-none"
                          />
                        </div>
                      )
                    }

                    return (
                      <div key={e.id} className="rounded-xl border border-gold-accent/30 bg-[#161a28] p-3 flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="font-display font-semibold text-sm text-gold-primary truncate">{e.title}</p>
                          <p className="font-mono text-[10px] text-ink-muted">
                            Trigger: {e.trigger || 'story'}{e.condition ? ` · ${e.condition}` : ''}
                          </p>
                          {e.guidance && <p className="font-narrative text-xs text-ink/80 mt-1 line-clamp-2">{e.guidance}</p>}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => startEditing(`event_${e.id}`, e)}
                            className="text-gold-primary/70 hover:text-gold-primary p-1"
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => removeItem('narrativeEvents', e.id)}
                            className="text-red-400/70 hover:text-red-300 p-1 shrink-0"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Death / End Game Stakes */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] uppercase tracking-wider text-gold-primary/70">Death & End Game Stakes</span>
                {!hasStakes && (
                  <button
                    type="button"
                    onClick={() =>
                      startEditing('stakes', {
                        deathRule: 'soft_fail',
                        deathInstructions: '',
                        endGameRules: { win: '', lose: '', neutral: '' },
                      })
                    }
                    className="flex items-center gap-1 font-mono text-[10px] text-gold-primary hover:underline"
                  >
                    <Plus size={12} /> Configure Stakes
                  </button>
                )}
              </div>

              {editingKey === 'stakes' ? (
                <div className="rounded-xl border border-gold-primary/60 bg-[#161a28] p-3 flex flex-col gap-2.5">
                  <div className="flex items-center justify-between border-b border-gold-accent/20 pb-1.5">
                    <span className="font-mono text-[10px] uppercase text-gold-primary font-bold">Edit Death & Stakes</span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => saveEditing('stakes')}
                        className="px-2 py-0.5 rounded bg-gold-primary text-black font-display font-bold text-xs flex items-center gap-1"
                      >
                        <Save size={12} /> Save
                      </button>
                      <button type="button" onClick={cancelEditing} className="px-2 py-0.5 rounded border border-gold-accent/30 text-xs">
                        Cancel
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div className="flex flex-col gap-1">
                      <label className="font-mono text-[10px] uppercase text-gold-primary/70">Death Rule</label>
                      <select
                        value={editFormData.deathRule || 'soft_fail'}
                        onChange={(e) => setEditFormData({ ...editFormData, deathRule: e.target.value })}
                        className="px-2.5 py-1 rounded-lg bg-[#0d1017] border border-gold-accent/30 text-xs text-ink outline-none"
                      >
                        <option value="soft_fail">Soft Fail (Knockout / Retreat / Rescue)</option>
                        <option value="permadeath">Permadeath (Permanent End)</option>
                      </select>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="font-mono text-[10px] uppercase text-gold-primary/70">Death / Defeat Instructions</label>
                      <input
                        type="text"
                        value={editFormData.deathInstructions || ''}
                        onChange={(e) => setEditFormData({ ...editFormData, deathInstructions: e.target.value })}
                        placeholder="Instructions upon defeat..."
                        className="px-2.5 py-1 rounded-lg bg-[#0d1017] border border-gold-accent/30 text-xs text-ink outline-none"
                      />
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 pt-1 border-t border-gold-accent/15">
                    <span className="font-mono text-[10px] uppercase text-gold-primary/70">End Game Outcome Guidance</span>
                    <input
                      type="text"
                      value={editFormData.endGameRules?.win || ''}
                      onChange={(e) =>
                        setEditFormData({
                          ...editFormData,
                          endGameRules: { ...(editFormData.endGameRules || {}), win: e.target.value },
                        })
                      }
                      placeholder="Victory Outcome Guidance..."
                      className="px-2.5 py-1 rounded-lg bg-[#0d1017] border border-gold-accent/30 text-xs text-ink outline-none"
                    />
                    <input
                      type="text"
                      value={editFormData.endGameRules?.lose || ''}
                      onChange={(e) =>
                        setEditFormData({
                          ...editFormData,
                          endGameRules: { ...(editFormData.endGameRules || {}), lose: e.target.value },
                        })
                      }
                      placeholder="Defeat Outcome Guidance..."
                      className="px-2.5 py-1 rounded-lg bg-[#0d1017] border border-gold-accent/30 text-xs text-ink outline-none"
                    />
                    <input
                      type="text"
                      value={editFormData.endGameRules?.neutral || ''}
                      onChange={(e) =>
                        setEditFormData({
                          ...editFormData,
                          endGameRules: { ...(editFormData.endGameRules || {}), neutral: e.target.value },
                        })
                      }
                      placeholder="Bittersweet / Neutral Outcome Guidance..."
                      className="px-2.5 py-1 rounded-lg bg-[#0d1017] border border-gold-accent/30 text-xs text-ink outline-none"
                    />
                  </div>
                </div>
              ) : (
                hasStakes && (
                  <div className="rounded-xl border border-gold-accent/25 bg-[#161a28]/70 p-3 flex flex-col gap-1.5 text-xs relative">
                    <button
                      type="button"
                      onClick={() =>
                        startEditing('stakes', {
                          deathRule: accumulated.deathRule,
                          deathInstructions: accumulated.deathInstructions,
                          endGameRules: accumulated.endGameRules,
                        })
                      }
                      className="absolute top-2.5 right-2.5 text-gold-primary/70 hover:text-gold-primary p-1"
                      title="Edit Stakes"
                    >
                      <Pencil size={13} />
                    </button>
                    {accumulated.deathRule && (
                      <p className="font-narrative text-ink pr-6">
                        <span className="font-mono text-[10px] uppercase text-gold-primary font-bold">Death Rule: </span>
                        {accumulated.deathRule === 'permadeath' ? 'Permadeath' : 'Soft Fail'}
                        {accumulated.deathInstructions ? ` — ${accumulated.deathInstructions}` : ''}
                      </p>
                    )}
                    {accumulated.endGameRules && (
                      <div className="flex flex-col gap-0.5 mt-0.5 pr-6">
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
                )
              )}
            </div>
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

        {/* Preset & Overview Action Bar */}
        <div className="shrink-0 flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              setPresetNameInput(`${accumulated.world?.name || 'Custom World'} - ${accumulated.protagonist?.name || 'Hero'}`)
              setShowSaveModal(true)
            }}
            disabled={!hasAnyContent(accumulated)}
            className="flex items-center gap-1 px-2 py-1 rounded-lg border border-gold-accent/30 bg-[#161a28] hover:bg-gold-accent/15 text-gold-primary text-xs font-display transition-colors disabled:opacity-40"
            title="Save current settings as a World & Character Preset"
          >
            <Save size={13} />
            <span className="hidden sm:inline">Save Draft</span>
          </button>

          <button
            type="button"
            onClick={handleOpenLoadModal}
            className="flex items-center gap-1 px-2 py-1 rounded-lg border border-gold-accent/30 bg-[#161a28] hover:bg-gold-accent/15 text-gold-primary text-xs font-display transition-colors"
            title="Load a saved World & Character Preset"
          >
            <FolderOpen size={13} />
            <span className="hidden sm:inline">Load Draft</span>
          </button>

          {/* Overview Button */}
          <button
            type="button"
            onClick={() => setShowOverview(true)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-gold-accent/30 bg-[#161a28] hover:bg-gold-accent/15 text-gold-primary text-xs font-display transition-colors"
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
        <div className="flex items-stretch gap-2">
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
              className="w-full block px-3 py-2 rounded-xl bg-[#161a28] border border-gold-accent/30 text-[13px] text-ink placeholder:text-ink-muted/50 outline-none resize-none disabled:opacity-50 focus:border-gold-primary transition-colors"
            />
          </div>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={busy}
            className="shrink-0 px-3 py-2 rounded-xl bg-gold-accent/25 hover:bg-gold-accent/40 border border-gold-accent/50 text-gold-primary font-display font-semibold text-xs flex flex-col items-center justify-center gap-1 disabled:opacity-40 transition-colors min-w-[76px]"
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
            <span>{isLastPhase ? 'Tale Overview' : 'Next Phase'}</span>
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Tale Overview Modal */}
      {showOverview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-3 sm:p-4">
          <div className="w-full max-w-2xl max-h-[85vh] rounded-2xl border border-gold-accent/40 bg-[#121520] shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-4 py-3 border-b border-gold-accent/20 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <BookOpen size={16} className="text-gold-primary shrink-0" />
                <h2 className="font-display font-bold text-sm text-gold-primary truncate">Tale Overview</h2>
                <span className="hidden xs:inline font-mono text-[10px] px-2 py-0.5 rounded-full bg-gold-accent/20 text-gold-primary/90 border border-gold-accent/30 shrink-0">
                  {totalCount} elements
                </span>
              </div>

              {/* Draft Preset Action Buttons */}
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setPresetNameInput(`${accumulated.world?.name || 'Custom World'} - ${accumulated.protagonist?.name || 'Hero'}`)
                    setShowSaveModal(true)
                  }}
                  disabled={!hasAnyContent(accumulated)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-gold-accent/15 border border-gold-accent/40 text-gold-primary text-xs font-display font-semibold hover:bg-gold-accent/25 transition-colors disabled:opacity-40"
                  title="Save current settings as a World & Character Preset"
                >
                  <Save size={13} />
                  <span className="hidden sm:inline">Save Draft</span>
                </button>
                <button
                  type="button"
                  onClick={handleOpenLoadModal}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#161a28] border border-gold-accent/30 text-gold-primary text-xs font-display font-semibold hover:bg-gold-accent/15 transition-colors"
                  title="Load a saved World & Character Preset"
                >
                  <FolderOpen size={13} />
                  <span className="hidden sm:inline">Load Draft</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowOverview(false)}
                  className="text-ink-muted hover:text-ink p-1 rounded-lg hover:bg-white/5 transition-colors ml-1"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3.5">
              {!hasAnyContent(accumulated) && (
                <div className="rounded-xl border border-amber-500/40 bg-amber-950/30 p-3 flex items-start gap-2.5 text-amber-200 text-xs">
                  <AlertCircle size={16} className="shrink-0 text-amber-400 mt-0.5" />
                  <div className="flex flex-col gap-0.5">
                    <p className="font-display font-semibold text-amber-300">All 7 phases are currently blank</p>
                    <p className="font-narrative text-amber-200/80 leading-relaxed">
                      Please weave or manually create elements in at least one phase before diving in.
                    </p>
                  </div>
                </div>
              )}

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
                    {accumulated.protagonist.background && (
                      <p className="font-narrative text-xs text-ink-muted">{accumulated.protagonist.background}</p>
                    )}
                    <TaleWeaverImageGenerator
                      imageKey={accumulated.protagonist.portraitKey}
                      prompt={buildNpcPortraitPrompt(
                        accumulated.protagonist.name || 'Hero',
                        accumulated.protagonist.physicalTrait || accumulated.protagonist.background,
                        'Protagonist',
                        accumulated.world,
                      )}
                      apiSettings={apiSettings}
                      aspectRatio="1:1"
                      label="Illustrate Hero Portrait"
                      onSaveKey={(key) => {
                        setAccumulated((prev) => ({
                          ...prev,
                          protagonist: prev.protagonist ? { ...prev.protagonist, portraitKey: key } : undefined,
                        }))
                      }}
                    />
                  </div>
                ) : (
                  <p className="font-narrative text-xs italic text-ink-muted">Not yet woven</p>
                )}
              </div>

              {/* Regions & Locations */}
              <div className="rounded-xl border border-gold-accent/25 bg-[#161a28] p-3 flex flex-col gap-2">
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
                {accumulated.locations.length > 0 || accumulated.regions.length > 0 ? (
                  <div className="flex flex-col gap-2.5">
                    {accumulated.locations.map((l, idx) => (
                      <div key={l.id} className="rounded-lg bg-black/40 border border-gold-accent/20 p-2 flex flex-col gap-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-display font-semibold text-gold-primary">{l.name}</span>
                          <span className="font-mono text-[10px] text-ink-muted">{l.locationType || 'Landmark'}</span>
                        </div>
                        {l.desc && <p className="font-narrative text-[11px] text-ink-muted line-clamp-2">{l.desc}</p>}
                        <TaleWeaverImageGenerator
                          imageKey={l.imageKey}
                          prompt={buildLocationImagePrompt(l.name, l.desc, accumulated.world)}
                          apiSettings={apiSettings}
                          aspectRatio="16:9"
                          label="Illustrate Location"
                          onSaveKey={(key) => {
                            setAccumulated((prev) => ({
                              ...prev,
                              locations: prev.locations.map((loc, i) => (i === idx ? { ...loc, imageKey: key } : loc)),
                            }))
                          }}
                        />
                      </div>
                    ))}

                    {accumulated.regions.map((r, idx) => (
                      <div key={r.id} className="rounded-lg bg-black/40 border border-gold-accent/20 p-2 flex flex-col gap-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-display font-semibold text-gold-primary">Region: {r.name}</span>
                        </div>
                        {r.desc && <p className="font-narrative text-[11px] text-ink-muted line-clamp-2">{r.desc}</p>}
                        <TaleWeaverImageGenerator
                          imageKey={r.mapImageKey}
                          prompt={buildRegionMapPrompt(
                            r.name,
                            r.desc,
                            accumulated.locations.filter((loc) => loc.regionId === r.id).map((loc) => loc.name),
                            accumulated.world,
                          )}
                          apiSettings={apiSettings}
                          aspectRatio="16:9"
                          label="Illustrate Region Map"
                          onSaveKey={(key) => {
                            setAccumulated((prev) => ({
                              ...prev,
                              regions: prev.regions.map((reg, i) => (i === idx ? { ...reg, mapImageKey: key } : reg)),
                            }))
                          }}
                        />
                      </div>
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
              <div className="rounded-xl border border-gold-accent/25 bg-[#161a28] p-3 flex flex-col gap-2">
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
                  <div className="flex flex-col gap-2">
                    {accumulated.npcs.map((n, idx) => (
                      <div key={n.id} className="rounded-lg bg-black/40 border border-gold-accent/20 p-2 flex flex-col gap-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-display font-semibold text-gold-primary">{n.name}</span>
                          {n.role && <span className="font-mono text-[10px] text-ink-muted">{n.role}</span>}
                        </div>
                        {n.appearance && <p className="font-narrative text-[11px] text-ink-muted line-clamp-2">{n.appearance}</p>}
                        <TaleWeaverImageGenerator
                          imageKey={n.portraitKey}
                          prompt={buildNpcPortraitPrompt(n.name, n.appearance, n.role, accumulated.world)}
                          apiSettings={apiSettings}
                          aspectRatio="1:1"
                          label="Illustrate Character Portrait"
                          onSaveKey={(key) => {
                            setAccumulated((prev) => ({
                              ...prev,
                              npcs: prev.npcs.map((npc, i) => (i === idx ? { ...npc, portraitKey: key } : npc)),
                            }))
                          }}
                        />
                      </div>
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
            <div className="px-4 py-3 border-t border-gold-accent/20 flex justify-between items-center bg-[#0d1017]">
              <button
                type="button"
                onClick={() => setShowOverview(false)}
                className="px-4 py-1.5 rounded-lg border border-gold-accent/30 hover:bg-gold-accent/10 text-gold-primary font-display text-xs transition-colors"
              >
                Return to Editing
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!hasAnyContent(accumulated)) return
                  setShowOverview(false)
                  onBeginTale(accumulated)
                }}
                disabled={busy || !hasAnyContent(accumulated)}
                className="px-6 py-2 rounded-xl bg-gold-primary hover:bg-gold-primary/90 text-black shadow-[0_0_15px_rgba(212,175,55,0.3)] font-display text-sm font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-gold-primary disabled:shadow-none"
                title={!hasAnyContent(accumulated) ? 'Weave at least one phase before diving in' : 'Begin campaign'}
              >
                Dive in
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notice Banner */}
      {presetToast && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2 px-3.5 py-2 rounded-xl bg-gold-primary text-black font-display font-bold text-xs shadow-2xl animate-in fade-in slide-in-from-top-3 duration-200">
          <CheckCircle2 size={15} />
          <span>{presetToast}</span>
        </div>
      )}

      {/* Save Preset Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-gold-accent/40 bg-[#121520] p-4 shadow-2xl flex flex-col gap-3 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-gold-accent/20 pb-2">
              <div className="flex items-center gap-2">
                <Save size={16} className="text-gold-primary" />
                <h3 className="font-display font-bold text-sm text-gold-primary">Save Draft Preset</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowSaveModal(false)}
                className="text-ink-muted hover:text-ink p-1 rounded-lg hover:bg-white/5 transition-colors"
              >
                <X size={15} />
              </button>
            </div>

            <p className="font-narrative text-xs text-ink-muted leading-relaxed">
              Save your current World foundation, Protagonist, Regions, Locations, Factions, NPCs, Lore, and Arc settings as a reusable preset.
            </p>

            <div className="flex flex-col gap-1 mt-1">
              <label className="font-mono text-[10px] uppercase text-gold-primary/80">Preset Title</label>
              <input
                type="text"
                value={presetNameInput}
                onChange={(e) => setPresetNameInput(e.target.value)}
                placeholder="e.g. Fourth Wing - Navarre & Basgiath"
                className="w-full px-3 py-2 rounded-xl bg-[#161a28] border border-gold-accent/30 text-xs text-ink placeholder:text-ink-muted/50 outline-none focus:border-gold-primary transition-colors font-display"
                autoFocus
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-gold-accent/20">
              <button
                type="button"
                onClick={() => setShowSaveModal(false)}
                className="px-3 py-1.5 rounded-xl border border-gold-accent/20 bg-black/20 text-ink-muted font-display text-xs hover:bg-white/5 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSavePreset}
                disabled={!presetNameInput.trim()}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-gold-primary text-black font-display font-semibold text-xs hover:bg-gold-primary/90 transition-colors disabled:opacity-40"
              >
                <Save size={13} />
                <span>Save Preset</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Load Preset Modal */}
      {showLoadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg max-h-[80vh] rounded-2xl border border-gold-accent/40 bg-[#121520] p-4 shadow-2xl flex flex-col gap-3 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-gold-accent/20 pb-2">
              <div className="flex items-center gap-2">
                <FolderOpen size={16} className="text-gold-primary" />
                <h3 className="font-display font-bold text-sm text-gold-primary">Load Draft Preset</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowLoadModal(false)}
                className="text-ink-muted hover:text-ink p-1 rounded-lg hover:bg-white/5 transition-colors"
              >
                <X size={15} />
              </button>
            </div>

            <p className="font-narrative text-xs text-ink-muted leading-relaxed">
              Select a previously saved World & Character preset to populate your Tale Weaver setup.
            </p>

            <div className="flex-1 overflow-y-auto flex flex-col gap-2.5 my-1 pr-1">
              {savedPresets.length === 0 ? (
                <div className="py-8 text-center flex flex-col items-center justify-center gap-2 text-ink-muted font-narrative text-xs">
                  <Bookmark size={24} className="text-gold-primary/30" />
                  <p>No saved draft presets found.</p>
                  <p className="text-[11px] text-ink-muted/70">Click "Save Draft" in Tale Overview to save your first preset.</p>
                </div>
              ) : (
                savedPresets.map((preset) => {
                  const acc = preset.accumulated
                  const dateStr = new Date(preset.createdAt).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                  return (
                    <div
                      key={preset.id}
                      className="rounded-xl border border-gold-accent/25 bg-[#161a28] p-3 flex flex-col gap-2 hover:border-gold-accent/50 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h4 className="font-display font-bold text-sm text-gold-primary">{preset.name}</h4>
                          <span className="font-mono text-[10px] text-ink-muted">{dateStr}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeletePreset(preset.id)}
                          className="p-1 rounded text-red-400 hover:text-red-200 hover:bg-red-950/40 transition-colors shrink-0"
                          title="Delete preset"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>

                      {/* Preset Content Badges */}
                      <div className="flex flex-wrap items-center gap-1.5 font-mono text-[10px]">
                        {acc.world?.name && (
                          <span className="px-2 py-0.5 rounded-full bg-gold-accent/15 border border-gold-accent/30 text-gold-primary">
                            World: {acc.world.name}
                          </span>
                        )}
                        {acc.protagonist?.name && (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300">
                            Hero: {acc.protagonist.name}
                          </span>
                        )}
                        {acc.regions.length > 0 && (
                          <span className="px-2 py-0.5 rounded-full bg-blue-500/15 border border-blue-500/30 text-blue-300">
                            {acc.regions.length} Regions / {acc.locations.length} Locs
                          </span>
                        )}
                        {acc.npcs.length > 0 && (
                          <span className="px-2 py-0.5 rounded-full bg-purple-500/15 border border-purple-500/30 text-purple-300">
                            {acc.npcs.length} NPCs
                          </span>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => handleLoadPreset(preset)}
                        className="mt-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-gold-accent/20 border border-gold-accent/40 text-gold-primary font-display text-xs font-semibold hover:bg-gold-accent/35 transition-colors"
                      >
                        <FolderOpen size={13} />
                        <span>Load Preset</span>
                      </button>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Dialog (Modal) */}
      {confirmDialog}
    </GlassScreen>
  )
}
