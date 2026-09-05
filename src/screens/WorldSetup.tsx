import { useState } from 'react'
import {
  Bookmark,
  Check,
  CheckCircle2,
  Edit2,
  Eye,
  Globe,
  Info,
  Layers,
  MapPin,
  Plus,
  Save,
  Search,
  Shield,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react'
import { DEFAULT_NARRATION_STYLE } from '../api/turnContract.ts'
import {
  FIELD_CLASS,
  GLASS_SURFACE,
  GLASS_SURFACE_LIST,
  GlassButton,
  GlassCTAButton,
  GlassField,
  GlassHeader,
  GlassIconButton,
  GlassLongTextarea,
  GlassScreen,
  GlassTabs,
  SELECT_CLASS,
} from '../lib/glassChrome.tsx'
import {
  ERA_TECH_EXAMPLES,
  POWER_SYSTEM_EXAMPLES,
  WORLD_BACKGROUND_EXAMPLES,
} from '../data/formExamples.ts'
import { LOCATION_DANGER_LEVELS, LOCATION_TYPES } from '../types.ts'
import type { WorldData, WorldFaction, WorldLocation } from '../types.ts'
import { useConfirm } from '../lib/useConfirm.tsx'
import { WorldDetailModal } from '../components/PresetDetailModal.tsx'

interface WorldSetupProps {
  worldTemplates?: WorldData[]
  initial?: WorldData | null
  editLongText: (label: string, value: string, hint?: string, placeholder?: string) => Promise<string | null>
  onBack: () => void
  onContinue: (world: WorldData) => void
  onSavePreset?: (world: WorldData) => void
  onSaveAsNewPreset?: (world: WorldData) => void
  onDeletePreset?: (id: string) => void
}

const TABS = [
  { id: 'overview' as const, label: 'Overview', icon: Info },
  { id: 'depth' as const, label: 'Depth', icon: Layers },
  { id: 'locations' as const, label: 'Locations', icon: MapPin },
]

export default function WorldSetup({
  worldTemplates = [],
  initial,
  editLongText,
  onBack,
  onContinue,
  onSavePreset,
  onSaveAsNewPreset,
  onDeletePreset,
}: WorldSetupProps) {
  const { confirm, dialog: confirmDialog } = useConfirm()

  // If initial world is supplied (e.g. from library edit), open directly in editor; otherwise show the gateway
  const [viewMode, setViewMode] = useState<'gateway' | 'editor' | 'presets'>(() => (initial ? 'editor' : 'gateway'))
  const [activeTab, setActiveTab] = useState<'overview' | 'depth' | 'locations'>('overview')

  // Form State
  const [templateId, setTemplateId] = useState<string | null | undefined>(initial?.id ?? null)
  const [mode, setMode] = useState(initial?.mode ?? 'original')
  const [name, setName] = useState(initial?.name ?? '')
  const [sourceTitle, setSourceTitle] = useState(initial?.sourceTitle ?? '')
  const [sourceAuthor, setSourceAuthor] = useState(initial?.sourceAuthor ?? '')
  const [genreTone, setGenreTone] = useState(initial?.genreTone ?? '')
  const [conflict, setConflict] = useState(initial?.conflict ?? '')
  const [background, setBackground] = useState(initial?.background ?? '')
  const [narrationStyle, setNarrationStyle] = useState(initial?.narrationStyle ?? DEFAULT_NARRATION_STYLE)
  const [powerSystem, setPowerSystem] = useState(initial?.powerSystem ?? '')
  const [eraTechLevel, setEraTechLevel] = useState(initial?.eraTechLevel ?? '')
  const [keyFactions, setKeyFactions] = useState(initial?.keyFactions ?? '')

  // Structured Factions list
  const [factionsList, setFactionsList] = useState<WorldFaction[]>(() => {
    if (initial?.factionsList && initial.factionsList.length > 0) return initial.factionsList
    if (initial?.keyFactions) {
      return initial.keyFactions
        .split(/[,;\n]+/)
        .map((f) => f.trim())
        .filter(Boolean)
        .map((fName, idx) => ({
          id: `fac_${idx}`,
          name: fName,
          attitude: 'neutral' as const,
        }))
    }
    return []
  })

  // Faction Edit Modal state
  const [editingFaction, setEditingFaction] = useState<{ index: number; faction: WorldFaction } | null>(null)
  const [newFactionModalOpen, setNewFactionModalOpen] = useState(false)
  const [factionDraftName, setFactionDraftName] = useState('')
  const [factionDraftAttitude, setFactionDraftAttitude] = useState<'allied' | 'friendly' | 'neutral' | 'hostile' | 'rival'>('neutral')
  const [factionDraftTerritory, setFactionDraftTerritory] = useState('')
  const [factionDraftDesc, setFactionDraftDesc] = useState('')

  // Structured Locations list
  const [locationsList, setLocationsList] = useState<WorldLocation[]>(() => {
    if (initial?.locationsList && initial.locationsList.length > 0) return initial.locationsList
    return []
  })

  // Location Edit Modal state
  const [editingLocation, setEditingLocation] = useState<{ index: number; location: WorldLocation } | null>(null)
  const [newLocationModalOpen, setNewLocationModalOpen] = useState(false)
  const [locationDraftName, setLocationDraftName] = useState('')
  const [locationDraftRegion, setLocationDraftRegion] = useState('')
  const [locationDraftType, setLocationDraftType] = useState('Landmark')
  const [locationDraftDanger, setLocationDraftDanger] = useState('Safe')
  const [locationDraftFaction, setLocationDraftFaction] = useState('')
  const [locationDraftDesc, setLocationDraftDesc] = useState('')

  // Presets browser state
  const [presetSearch, setPresetSearch] = useState('')
  const [selectedPreset, setSelectedPreset] = useState<WorldData | null>(null)
  const [selectedDeckId, setSelectedDeckId] = useState<string | null>(initial?.id ?? null)

  function openAddFaction() {
    setFactionDraftName('')
    setFactionDraftAttitude('neutral')
    setFactionDraftTerritory('')
    setFactionDraftDesc('')
    setEditingFaction(null)
    setNewFactionModalOpen(true)
  }

  function openEditFaction(index: number) {
    const f = factionsList[index]
    if (!f) return
    setFactionDraftName(f.name)
    setFactionDraftAttitude(f.attitude ?? 'neutral')
    setFactionDraftTerritory(f.territory ?? '')
    setFactionDraftDesc(f.description ?? '')
    setEditingFaction({ index, faction: f })
    setNewFactionModalOpen(true)
  }

  function saveFactionDraft() {
    if (!factionDraftName.trim()) return
    const updated: WorldFaction = {
      id: editingFaction?.faction.id ?? `fac_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: factionDraftName.trim(),
      attitude: factionDraftAttitude,
      territory: factionDraftTerritory.trim() || undefined,
      description: factionDraftDesc.trim() || undefined,
    }

    let nextList: WorldFaction[]
    if (editingFaction !== null) {
      nextList = factionsList.map((f, i) => (i === editingFaction.index ? updated : f))
    } else {
      nextList = [...factionsList, updated]
    }
    setFactionsList(nextList)

    // Sync summary string to keyFactions
    const summary = nextList.map((f) => (f.attitude && f.attitude !== 'neutral' ? `${f.name} (${f.attitude})` : f.name)).join(', ')
    setKeyFactions(summary)

    setNewFactionModalOpen(false)
    setEditingFaction(null)
  }

  function deleteFaction(index: number) {
    const nextList = factionsList.filter((_, i) => i !== index)
    setFactionsList(nextList)
    const summary = nextList.map((f) => (f.attitude && f.attitude !== 'neutral' ? `${f.name} (${f.attitude})` : f.name)).join(', ')
    setKeyFactions(summary)
  }

  function openAddLocation() {
    setLocationDraftName('')
    setLocationDraftRegion('')
    setLocationDraftType('Landmark')
    setLocationDraftDanger('Safe')
    setLocationDraftFaction('')
    setLocationDraftDesc('')
    setEditingLocation(null)
    setNewLocationModalOpen(true)
  }

  function openEditLocation(index: number) {
    const loc = locationsList[index]
    if (!loc) return
    setEditingLocation({ index, location: loc })
    setLocationDraftName(loc.name)
    setLocationDraftRegion(loc.region || '')
    setLocationDraftType(loc.locationType || 'Landmark')
    setLocationDraftDanger(loc.dangerLevel || 'Safe')
    setLocationDraftFaction(loc.factionOwner || '')
    setLocationDraftDesc(loc.description || '')
    setNewLocationModalOpen(true)
  }

  function saveLocationDraft() {
    if (!locationDraftName.trim()) return
    const updated: WorldLocation = {
      id: editingLocation?.location.id ?? `loc_${Date.now()}`,
      name: locationDraftName.trim(),
      region: locationDraftRegion.trim() || undefined,
      locationType: locationDraftType.trim() || undefined,
      dangerLevel: locationDraftDanger,
      factionOwner: locationDraftFaction.trim() || undefined,
      description: locationDraftDesc.trim() || undefined,
    }

    let nextList: WorldLocation[]
    if (editingLocation !== null) {
      nextList = locationsList.map((loc, i) => (i === editingLocation.index ? updated : loc))
    } else {
      nextList = [...locationsList, updated]
    }
    setLocationsList(nextList)
    setNewLocationModalOpen(false)
    setEditingLocation(null)
  }

  function deleteLocation(index: number) {
    const nextList = locationsList.filter((_, i) => i !== index)
    setLocationsList(nextList)
  }

  function applyTemplate(t: WorldData) {
    setTemplateId(t.id)
    setMode(t.mode ?? 'original')
    setName(t.name)
    setSourceTitle(t.sourceTitle ?? '')
    setSourceAuthor(t.sourceAuthor ?? '')
    setGenreTone(t.genreTone ?? '')
    setConflict(t.conflict ?? '')
    setBackground(t.background ?? '')
    setNarrationStyle(t.narrationStyle ?? DEFAULT_NARRATION_STYLE)
    setPowerSystem(t.powerSystem ?? '')
    setEraTechLevel(t.eraTechLevel ?? '')
    setKeyFactions(t.keyFactions ?? '')

    if (t.factionsList && t.factionsList.length > 0) {
      setFactionsList(t.factionsList)
    } else if (t.keyFactions) {
      setFactionsList(
        t.keyFactions
          .split(/[,;\n]+/)
          .map((f) => f.trim())
          .filter(Boolean)
          .map((fName, idx) => ({
            id: `fac_${idx}`,
            name: fName,
            attitude: 'neutral' as const,
          })),
      )
    } else {
      setFactionsList([])
    }

    if (t.locationsList && t.locationsList.length > 0) {
      setLocationsList(t.locationsList)
    } else {
      setLocationsList([])
    }

    setViewMode('editor')
  }

  function startCleanWorld() {
    setTemplateId(null)
    setMode('original')
    setName('')
    setSourceTitle('')
    setSourceAuthor('')
    setGenreTone('')
    setConflict('')
    setBackground('')
    setNarrationStyle(DEFAULT_NARRATION_STYLE)
    setPowerSystem('')
    setEraTechLevel('')
    setKeyFactions('')
    setFactionsList([])
    setLocationsList([])
    setViewMode('editor')
  }

  function currentData(): WorldData {
    return {
      id: templateId,
      name: name.trim() || 'Untitled World',
      mode,
      sourceTitle: sourceTitle.trim() || undefined,
      sourceAuthor: sourceAuthor.trim() || undefined,
      genreTone,
      conflict,
      background,
      narrationStyle,
      powerSystem: powerSystem.trim() || undefined,
      eraTechLevel: eraTechLevel.trim() || undefined,
      keyFactions: keyFactions.trim() || undefined,
      factionsList: factionsList.length > 0 ? factionsList : undefined,
      locationsList: locationsList.length > 0 ? locationsList : undefined,
    }
  }

  function getPresetTimestamp(item: { id?: string | null; savedAt?: number }): number {
    if (item.savedAt) return item.savedAt
    if (item.id) {
      const match = item.id.match(/_(\d{10,14})/)
      if (match) {
        const parsed = parseInt(match[1], 10)
        if (!isNaN(parsed) && parsed > 0) return parsed
      }
    }
    return 0
  }

  function formatSavedDate(ts: number): string {
    if (!ts) return 'Preset'
    const d = new Date(ts)
    if (isNaN(d.getTime())) return 'Preset'
    return d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  const q = presetSearch.trim().toLowerCase()
  const matchedTemplates = q
    ? worldTemplates.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          (t.genreTone && t.genreTone.toLowerCase().includes(q)) ||
          (t.eraTechLevel && t.eraTechLevel.toLowerCase().includes(q)) ||
          (t.sourceTitle && t.sourceTitle.toLowerCase().includes(q)),
      )
    : worldTemplates

  const sortedTemplates = [...matchedTemplates].sort(
    (a, b) => getPresetTimestamp(b) - getPresetTimestamp(a),
  )

  // ================= GATEWAY SCREEN =================
  if (viewMode === 'gateway') {
    return (
      <GlassScreen ground="art" fill>
        <GlassHeader title="World Creation" subtitle="Step 2 — Shape the realm your tale takes root in" onBack={onBack} />

        <div className="flex-1 min-h-0 overflow-y-auto px-4 py-8 flex flex-col justify-center">
          <div className="max-w-xl mx-auto w-full flex flex-col gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* New World Card */}
              <button
                type="button"
                onClick={startCleanWorld}
                className="glass-panel glass-panel-hover rounded-2xl p-6 flex flex-col items-center gap-3 text-center group cursor-pointer transition-all border-[#e8ca8a]/40 hover:border-[#f0ca65] hover:shadow-[0_0_24px_rgba(240,202,101,0.2)]"
              >
                <div className="w-14 h-14 rounded-2xl border border-[#e8ca8a]/50 bg-[#e8ca8a]/10 flex items-center justify-center text-[#f0ca65] group-hover:scale-105 transition-transform">
                  <Sparkles size={28} />
                </div>
                <h3 className="font-display font-bold text-lg text-[#f5dfa0]">New World</h3>
                <p className="font-narrative text-xs sm:text-sm text-ink-muted leading-relaxed">
                  Start with a clean slate — author your realm&apos;s tone, power system, and factions from scratch.
                </p>
                <span className="mt-2 font-display text-xs text-[#f0ca65] flex items-center gap-1">
                  Create Blank Realm &rarr;
                </span>
              </button>

              {/* Load Preset Card */}
              <button
                type="button"
                onClick={() => setViewMode('presets')}
                className="glass-panel glass-panel-hover rounded-2xl p-6 flex flex-col items-center gap-3 text-center group cursor-pointer transition-all border-[#38bdf8]/40 hover:border-[#38bdf8] hover:shadow-[0_0_24px_rgba(56,189,248,0.25)]"
              >
                <div className="w-14 h-14 rounded-2xl border border-[#38bdf8]/50 bg-[#38bdf8]/10 flex items-center justify-center text-[#38bdf8] group-hover:scale-105 transition-transform">
                  <Bookmark size={28} />
                </div>
                <h3 className="font-display font-bold text-lg text-[#e0f2fe]">Load Preset</h3>
                <p className="font-narrative text-xs sm:text-sm text-ink-muted leading-relaxed">
                  Select from master presets or your saved realms to populate world lore instantly.
                </p>
                <span className="mt-2 font-display text-xs text-[#38bdf8] flex items-center gap-1">
                  Browse Saved Worlds &rarr;
                </span>
              </button>
            </div>
          </div>
        </div>
      </GlassScreen>
    )
  }

  // ================= PRESETS BROWSER SCREEN =================
  if (viewMode === 'presets') {
    return (
      <GlassScreen ground="art" fill>
        <GlassHeader
          title="World Presets"
          subtitle="Select a saved realm to load into your story"
          onBack={() => setViewMode(initial ? 'editor' : 'gateway')}
        />

        <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4">
          <div className="max-w-md md:max-w-2xl lg:max-w-4xl mx-auto flex flex-col gap-4">
            <div className="flex items-center justify-between gap-3">
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#e8ca8a]/50 pointer-events-none" />
                <input
                  value={presetSearch}
                  onChange={(e) => setPresetSearch(e.target.value)}
                  placeholder="Search saved Worlds..."
                  className={`${FIELD_CLASS} pl-8.5 pr-8`}
                />
                {presetSearch && (
                  <button
                    type="button"
                    onClick={() => setPresetSearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#e8ca8a]/50 hover:text-[#f5dfa0]"
                    aria-label="Clear search"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>
              <GlassButton onClick={startCleanWorld} icon={Sparkles} tone="action">
                New Blank World
              </GlassButton>
            </div>

            {worldTemplates.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[#e8ca8a]/30 p-8 text-center bg-[#07050c]/40">
                <p className="font-narrative italic text-sm text-[#e8ca8a]/80 mb-1">No saved Worlds yet.</p>
                <p className="font-narrative text-xs text-[#e8ca8a]/60">
                  Configure your world, then click &ldquo;Save as New Preset&rdquo; to store it in your library for future tales.
                </p>
                <div className="mt-4">
                  <GlassButton onClick={startCleanWorld} tone="action">
                    Start Blank World
                  </GlassButton>
                </div>
              </div>
            ) : sortedTemplates.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[#e8ca8a]/30 p-6 text-center bg-[#07050c]/40">
                <p className="font-narrative italic text-xs text-[#e8ca8a]/70">
                  No saved worlds match &ldquo;{presetSearch}&rdquo;
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <p className="font-narrative italic text-xs text-[#d8c49e]">
                  Select a world card and confirm to load its lore, power system, and key factions.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {sortedTemplates.map((t) => {
                    const isCurrent = templateId === t.id
                    const isSelected = selectedDeckId === t.id
                    const isInspired = t.mode === 'inspired' || Boolean(t.sourceTitle)
                    const ts = getPresetTimestamp(t)

                    return (
                      <div
                        key={t.id ?? t.name}
                        onClick={() => setSelectedDeckId(t.id ?? null)}
                        className={`${GLASS_SURFACE_LIST} rounded-xl p-3.5 flex flex-col gap-2 transition-all duration-150 cursor-pointer ${
                          isSelected
                            ? 'bg-[#0c2234]/95 border-[#38bdf8] shadow-[0_0_16px_rgba(56,189,248,0.25)] ring-1 ring-[#38bdf8]/60'
                            : isCurrent
                              ? 'bg-[#091824]/85 border-[#38bdf8]/60 hover:border-[#38bdf8]/90 hover:bg-[#0c2234]/90'
                              : 'bg-[#091824]/80 border-[#38bdf8]/35 hover:border-[#38bdf8]/75 hover:bg-[#0c2234]/90'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <div
                              className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 transition-colors ${
                                isSelected
                                  ? 'border-[#38bdf8] bg-[#38bdf8] text-[#040e17]'
                                  : 'border-[#38bdf8]/50 bg-transparent text-transparent'
                              }`}
                            >
                              <Check size={11} strokeWidth={3} />
                            </div>
                            <Globe size={16} className="text-[#38bdf8] shrink-0" />
                            <h3 className="font-display font-bold text-sm text-[#e0f2fe] truncate">{t.name}</h3>
                            <div className="flex items-center gap-1 shrink-0 flex-wrap">
                              {isCurrent && (
                                <span className="rounded bg-[#38bdf8]/25 text-[#7dd3fc] border border-[#38bdf8]/40 px-1.5 py-0.2 text-[9px] font-mono font-normal">
                                  active
                                </span>
                              )}
                              {t.isMaster && (
                                <span className="rounded bg-[#f0ca65]/20 text-[#f5dfa0] border border-[#f0ca65]/35 px-1.5 py-0.2 text-[9px] font-mono font-normal uppercase tracking-wider">
                                  Master
                                </span>
                              )}
                              {t.isDefault && (
                                <span className="rounded bg-[#38bdf8]/15 text-[#bae6fd] border border-[#38bdf8]/30 px-1.5 py-0.2 text-[9px] font-mono font-normal">
                                  default
                                </span>
                              )}
                              <span
                                className={`rounded px-1.5 py-0.2 text-[9px] font-mono font-normal uppercase tracking-wider border ${
                                  isInspired
                                    ? 'bg-[#38bdf8]/10 text-[#7dd3fc] border-[#38bdf8]/25'
                                    : 'bg-[#0284c7]/20 text-[#e0f2fe] border-[#38bdf8]/35'
                                }`}
                              >
                                {isInspired ? 'Inspired' : 'Original'}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={() => setSelectedPreset(t)}
                              className="flex items-center gap-1 text-[11px] font-display text-[#7dd3fc] hover:text-white px-2 py-1 rounded-lg border border-[#38bdf8]/30 bg-[#38bdf8]/10 hover:bg-[#38bdf8]/25 transition-colors"
                            >
                              <Eye size={12} /> Inspect
                            </button>
                          </div>
                        </div>

                        {t.sourceTitle ? (
                          <p className="font-narrative italic text-xs text-[#bae6fd]/90">
                            from {t.sourceTitle} {t.sourceAuthor ? `(${t.sourceAuthor})` : ''}
                          </p>
                        ) : t.genreTone ? (
                          <p className="font-narrative text-xs text-[#7dd3fc]/80">{t.genreTone}</p>
                        ) : null}

                        {t.background && (
                          <p className="font-narrative text-xs text-[#e0f2fe]/85 line-clamp-2 leading-relaxed">
                            {t.background}
                          </p>
                        )}

                        <div className="flex items-center justify-between pt-1.5 border-t border-[#38bdf8]/15 text-[10px] font-mono text-[#7dd3fc]/70">
                          <span>{t.powerSystem ? `Power: ${t.powerSystem}` : (t.eraTechLevel || 'Standard Setting')}</span>
                          <span>{formatSavedDate(ts)}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Confirm & Load Button */}
                {(() => {
                  const chosen =
                    sortedTemplates.find((t) => t.id === selectedDeckId) ||
                    (sortedTemplates.length > 0 ? sortedTemplates[0] : null)
                  return chosen ? (
                    <div className="pt-2 sticky bottom-0 z-10 bg-gradient-to-t from-[#091824] via-[#091824]/90 to-transparent pb-1">
                      <button
                        type="button"
                        onClick={() => applyTemplate(chosen)}
                        className="w-full py-3 px-4 rounded-xl border border-[#38bdf8]/80 bg-[#38bdf8]/20 hover:bg-[#38bdf8]/35 text-[#e0f2fe] hover:text-white font-display font-bold text-xs uppercase tracking-wider shadow-[0_0_18px_rgba(56,189,248,0.3)] transition-all flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <CheckCircle2 size={16} className="text-[#38bdf8]" />
                        Confirm &amp; Load &ldquo;{chosen.name}&rdquo;
                      </button>
                    </div>
                  ) : null
                })()}
              </div>
            )}

            {selectedPreset && (
              <WorldDetailModal
                world={selectedPreset}
                isDefault={selectedPreset.isDefault}
                onClose={() => setSelectedPreset(null)}
                onLoad={() => applyTemplate(selectedPreset)}
                loadLabel="Load World"
                onDelete={onDeletePreset ? async () => {
                  if (await confirm('Delete this World preset?')) {
                    if (selectedPreset.id) onDeletePreset(selectedPreset.id)
                    setSelectedPreset(null)
                  }
                } : undefined}
              />
            )}
          </div>
        </div>
      </GlassScreen>
    )
  }

  // ================= MAIN EDITOR VIEW =================
  const overviewFields = (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="font-display font-semibold text-sm text-[#f5dfa0] flex items-center gap-1.5">
          <Globe size={15} className="text-[#f0ca65]" />
          World Identity &amp; Overview
        </h3>
      </div>

      <GlassField label="World Name" hint="The realm or universe name">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Eldoria, The Sunken Expanse, Neo-Kowloon, Nine Heavens"
          className={FIELD_CLASS}
        />
      </GlassField>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <GlassField label="Adapted Novel / Work" hint="Optional attribution">
          <input
            value={sourceTitle}
            onChange={(e) => setSourceTitle(e.target.value)}
            placeholder="e.g. Dune, The Name of the Wind, Lord of the Mysteries"
            className={FIELD_CLASS}
          />
        </GlassField>
        <GlassField label="Original Author" hint="Optional attribution">
          <input
            value={sourceAuthor}
            onChange={(e) => setSourceAuthor(e.target.value)}
            placeholder="e.g. Frank Herbert, Brandon Sanderson, Patrick Rothfuss"
            className={FIELD_CLASS}
          />
        </GlassField>
      </div>

      <GlassField
        label="World Background"
        hint="Describe the setting, genre, tone, and core conflicts"
        examples={WORLD_BACKGROUND_EXAMPLES}
        onPickExample={(val) => setBackground(val)}
      >
        <GlassLongTextarea
          value={background}
          onOpenModal={async () => {
            const result = await editLongText(
              'World Background',
              background,
              "The setting's primary geography, history, tone, and looming crisis.",
              'e.g. A realm of floating islands drifting above a toxic cloud sea, shielded by ancient titan cores while sky-corsairs raid trade routes...',
            )
            if (result !== null) setBackground(result)
          }}
          placeholder="e.g. A realm of floating islands drifting above a toxic cloud sea, shielded by ancient titan cores while sky-corsairs raid trade routes..."
          rows={3}
        />
      </GlassField>
    </div>
  )

  const depthFields = (

    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="font-display font-semibold text-sm text-[#f5dfa0] flex items-center gap-1.5">
          <Layers size={15} className="text-[#f0ca65]" />
          Power System &amp; Factions
        </h3>
      </div>

      <GlassField
        label="Power System"
        hint="Combat skills, magic, beast bonding, mana cores, or cultivation"
        examples={POWER_SYSTEM_EXAMPLES}
        onPickExample={(val) => setPowerSystem(val)}
      >
        <GlassLongTextarea
          value={powerSystem}
          onOpenModal={async () => {
            const result = await editLongText(
              'Power System',
              powerSystem,
              'Combat skills, elemental magic, beast/dragon bonding, mana cores, game levels, or cultivation.',
              'e.g. Grounded combat skill & martial stamina, elemental magic with mana pools, dragon/beast bonding with signet abilities, mana cores, or litRPG status system...',
            )
            if (result !== null) setPowerSystem(result)
          }}
          placeholder="e.g. Grounded combat skill & martial stamina, elemental magic with mana pools, dragon/beast bonding with signet abilities, mana cores, or litRPG status system..."
          rows={2}
        />
      </GlassField>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <GlassField
          label="Era / Tech Level"
          hint="Setting tech or historical era"
          examples={ERA_TECH_EXAMPLES}
          onPickExample={(val) => setEraTechLevel(val)}
        >
          <input
            value={eraTechLevel}
            onChange={(e) => setEraTechLevel(e.target.value)}
            placeholder="e.g. Medieval High Fantasy, Early Modern Flintlock, Victorian Gaslamp"
            className={FIELD_CLASS}
          />
        </GlassField>
      </div>

      {/* Key Factions Fast CRUD Table */}
      <div className="flex flex-col gap-2 rounded-xl p-3.5 border border-[#e8ca8a]/25 bg-[#07050c]/50">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <Shield size={14} className="text-[#f0ca65]" />
            <span className="font-display font-bold text-xs uppercase tracking-wider text-[#f5dfa0]">
              Key Factions ({factionsList.length})
            </span>
          </div>
          <button
            type="button"
            onClick={openAddFaction}
            title="Add Faction"
            className="flex items-center justify-center w-7 h-7 rounded-full border border-[#f0ca65]/35 bg-[#f0ca65]/10 text-[#f0ca65] hover:bg-[#f0ca65]/25 hover:text-white transition-colors cursor-pointer"
          >
            <Plus size={14} />
          </button>
        </div>

        {factionsList.length === 0 ? (
          <div className="rounded-lg border border-dashed border-[#e8ca8a]/20 p-4 text-center">
            <p className="font-narrative italic text-xs text-[#e8ca8a]/70">
              No structured factions seeded yet. Add factions to ground world politics and seed the Factions Codex on Turn 1!
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {factionsList.map((f, idx) => (
              <div
                key={f.id ?? idx}
                className="flex items-center justify-between gap-2.5 px-3 py-2 rounded-lg border border-[#e8ca8a]/20 bg-[#120e1b]/70 hover:border-[#e8ca8a]/40 transition-colors"
              >
                <span className="font-display font-bold text-xs text-[#f5dfa0] truncate">{f.name}</span>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => openEditFaction(idx)}
                    className="p-1 rounded text-[#e8ca8a]/70 hover:text-[#f5dfa0] hover:bg-white/5"
                    title="Edit Faction"
                  >
                    <Edit2 size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteFaction(idx)}
                    className="p-1 rounded text-rose-400/70 hover:text-rose-300 hover:bg-rose-500/10"
                    title="Delete Faction"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )

  const locationsFields = (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="font-display font-semibold text-sm text-[#f5dfa0] flex items-center gap-1.5">
          <MapPin size={15} className="text-[#f0ca65]" />
          Key Locations ({locationsList.length})
        </h3>
        <button
          type="button"
          onClick={openAddLocation}
          title="Add Location"
          className="flex items-center gap-1 px-2.5 py-1 rounded-full border border-[#f0ca65]/35 bg-[#f0ca65]/10 text-[#f0ca65] hover:bg-[#f0ca65]/25 hover:text-white text-xs font-display transition-colors cursor-pointer"
        >
          <Plus size={13} />
          <span>Add Location</span>
        </button>
      </div>

      <p className="font-narrative text-xs text-[#e8ca8a]/80 italic">
        Define key cities, fortresses, ruins, or landmarks. Locations created here are automatically seeded directly into the Story's Locations Codex on Turn 1!
      </p>

      {locationsList.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[#e8ca8a]/20 p-5 text-center">
          <p className="font-narrative italic text-xs text-[#e8ca8a]/70">
            No locations seeded yet. Click "Add Location" above to define key landmarks for your world!
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {locationsList.map((loc, idx) => (
            <div
              key={loc.id ?? idx}
              className="flex flex-col gap-1.5 p-3 rounded-xl border border-[#e8ca8a]/20 bg-[#120e1b]/70 hover:border-[#e8ca8a]/40 transition-colors"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-display font-bold text-sm text-[#f5dfa0]">{loc.name}</span>
                  {loc.region && (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-md border border-[#e8ca8a]/30 bg-[#e8ca8a]/10 text-[#e8ca8a]">
                      {loc.region}
                    </span>
                  )}
                  {loc.locationType && (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-md border border-[#f0ca65]/30 bg-[#f0ca65]/10 text-[#f0ca65]">
                      {loc.locationType}
                    </span>
                  )}
                  {loc.dangerLevel && (
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded-md border ${
                        loc.dangerLevel === 'Lethal' || loc.dangerLevel === 'High' || loc.dangerLevel === 'Deadly'
                          ? 'border-rose-500/40 bg-rose-500/15 text-rose-300'
                          : loc.dangerLevel === 'Low' || loc.dangerLevel === 'Moderate'
                          ? 'border-amber-500/40 bg-amber-500/15 text-amber-300'
                          : 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300'
                      }`}
                    >
                      {loc.dangerLevel}
                    </span>
                  )}
                  {loc.factionOwner && (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-md border border-purple-500/30 bg-purple-500/10 text-purple-300">
                      {loc.factionOwner}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => openEditLocation(idx)}
                    className="p-1 rounded text-[#e8ca8a]/70 hover:text-[#f5dfa0] hover:bg-white/5"
                    title="Edit Location"
                  >
                    <Edit2 size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteLocation(idx)}
                    className="p-1 rounded text-rose-400/70 hover:text-rose-300 hover:bg-rose-500/10"
                    title="Delete Location"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
              {loc.description && (
                <p className="font-narrative text-xs text-[#e8ca8a]/85 line-clamp-2">
                  {loc.description}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )

  return (
    <GlassScreen ground="art" fill>
      <GlassHeader
        title="Build a World"
        subtitle="Step 2 — Shape the realm your tale grows from"
        onBack={() => {
          if (!initial) setViewMode('gateway')
          else onBack()
        }}
        right={<GlassIconButton icon={Bookmark} label="Load Preset" onClick={() => setViewMode('presets')} />}
      />

      {/* Subtabs strip */}
      <div className="px-4 pb-2 shrink-0">
        <div className="max-w-md md:max-w-3xl lg:max-w-6xl mx-auto">
          <GlassTabs tabs={TABS} value={activeTab} onChange={(id) => setActiveTab(id as 'overview' | 'depth' | 'locations')} className="w-full" />
        </div>
      </div>

      {/* Main Form Body */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-4">
        <div className="max-w-md md:max-w-3xl lg:max-w-6xl mx-auto flex flex-col gap-5">
          {activeTab === 'overview' && overviewFields}
          {activeTab === 'depth' && depthFields}
          {activeTab === 'locations' && locationsFields}

          {(onSavePreset || onSaveAsNewPreset) && (
            <div className="flex gap-2 pt-4 border-t border-[#e8ca8a]/15">
              {templateId && onSavePreset && (
                <GlassButton
                  onClick={async () => {
                    const ok = await confirm('Save changes to this World preset?')
                    if (ok) onSavePreset(currentData())
                  }}
                  icon={Save}
                  className="flex-1"
                >
                  Save Preset
                </GlassButton>
              )}
              {onSaveAsNewPreset && (
                <GlassButton
                  onClick={async () => {
                    const ok = await confirm('Save current world as a new World preset?')
                    if (ok) onSaveAsNewPreset({ ...currentData(), id: null })
                  }}
                  icon={Plus}
                  className="flex-1"
                >
                  Save as New Preset
                </GlassButton>
              )}
            </div>
          )}
        </div>
      </div>
      {/* Fixed Sticky Action Footer */}
      <div
        className={`shrink-0 ${GLASS_SURFACE} border-x-0 border-b-0 bg-[#07050c]/60 px-4 py-2 flex justify-center`}
        style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
      >
        <div className="w-full max-w-md md:max-w-3xl lg:max-w-6xl flex justify-center">
          <GlassCTAButton onClick={() => onContinue(currentData())}>Continue</GlassCTAButton>
        </div>
      </div>

      {/* Add / Edit Location Modal */}
      {newLocationModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          onClick={() => setNewLocationModalOpen(false)}
        >
          <div
            className={`${GLASS_SURFACE} rounded-2xl w-full max-w-lg flex flex-col p-5 shadow-2xl bg-[#120e1b]/95 border-[#f0ca65]/40 max-h-[90vh] overflow-y-auto`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#e8ca8a]/20">
              <div className="flex items-center gap-2">
                <MapPin size={16} className="text-[#f0ca65]" />
                <h3 className="font-display font-semibold text-sm uppercase tracking-[0.12em] text-[#fae5b5]">
                  {editingLocation !== null ? 'Edit Location' : 'Add Key Location'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setNewLocationModalOpen(false)}
                className="p-1 rounded-full text-[#e8ca8a]/60 hover:text-[#f5dfa0] hover:bg-white/10 transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex flex-col gap-3.5 py-4">
              <GlassField label="Location Name *" hint="e.g. Basgiath War College">
                <input
                  autoFocus
                  type="text"
                  value={locationDraftName}
                  onChange={(e) => setLocationDraftName(e.target.value)}
                  placeholder="e.g. Basgiath War College..."
                  className={FIELD_CLASS}
                />
              </GlassField>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <GlassField label="Region / Territory" hint="e.g. Navarre Highlands">
                  <input
                    type="text"
                    value={locationDraftRegion}
                    onChange={(e) => setLocationDraftRegion(e.target.value)}
                    placeholder="e.g. Navarre Highlands..."
                    className={FIELD_CLASS}
                  />
                </GlassField>

                <GlassField label="Location Type" hint="Category">
                  <select
                    value={locationDraftType}
                    onChange={(e) => setLocationDraftType(e.target.value)}
                    className={SELECT_CLASS}
                  >
                    {LOCATION_TYPES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </GlassField>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <GlassField label="Danger Level">
                  <select
                    value={locationDraftDanger}
                    onChange={(e) => setLocationDraftDanger(e.target.value)}
                    className={SELECT_CLASS}
                  >
                    {LOCATION_DANGER_LEVELS.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </GlassField>

                <GlassField label="Faction Owner / Affiliation" hint="Optional">
                  <input
                    type="text"
                    value={locationDraftFaction}
                    onChange={(e) => setLocationDraftFaction(e.target.value)}
                    placeholder="e.g. Riders Quadrant..."
                    className={FIELD_CLASS}
                  />
                </GlassField>
              </div>

              <GlassField label="Description & History" hint="Key details for narration">
                <textarea
                  rows={3}
                  value={locationDraftDesc}
                  onChange={(e) => setLocationDraftDesc(e.target.value)}
                  placeholder="Describe what makes this location significant in your world..."
                  className={`${FIELD_CLASS} resize-none`}
                />
              </GlassField>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#e8ca8a]/20">
              <GlassButton onClick={() => setNewLocationModalOpen(false)}>Cancel</GlassButton>
              <GlassButton tone="action" onClick={saveLocationDraft}>
                {editingLocation !== null ? 'Save Changes' : 'Add Location'}
              </GlassButton>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Faction Modal */}
      {newFactionModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setNewFactionModalOpen(false)}
        >
          <div
            className={`${GLASS_SURFACE} rounded-2xl w-full max-w-md flex flex-col p-5 shadow-2xl bg-[#120e1b]/95 border-[#f0ca65]/40`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#e8ca8a]/20">
              <h4 className="font-display font-bold text-base text-[#f5dfa0]">
                {editingFaction !== null ? 'Edit Faction' : 'Add Key Faction'}
              </h4>
              <button
                type="button"
                onClick={() => setNewFactionModalOpen(false)}
                className="text-[#e8ca8a]/60 hover:text-white p-1"
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex flex-col gap-3.5 py-4">
              <GlassField label="Faction Name *" hint="e.g. Nightfall Sentinels">
                <input
                  autoFocus
                  value={factionDraftName}
                  onChange={(e) => setFactionDraftName(e.target.value)}
                  placeholder="e.g. Crown Imperium, Shadow Syndicate, Silver Concord"
                  className={FIELD_CLASS}
                />
              </GlassField>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <GlassField label="Attitude">
                  <select
                    value={factionDraftAttitude}
                    onChange={(e) => setFactionDraftAttitude(e.target.value as any)}
                    className={SELECT_CLASS}
                  >
                    <option value="allied">Allied</option>
                    <option value="friendly">Friendly</option>
                    <option value="neutral">Neutral</option>
                    <option value="rival">Rival</option>
                    <option value="hostile">Hostile</option>
                  </select>
                </GlassField>

                <GlassField label="Territory" hint="Optional">
                  <input
                    value={factionDraftTerritory}
                    onChange={(e) => setFactionDraftTerritory(e.target.value)}
                    placeholder="e.g. Northern Citadel"
                    className={FIELD_CLASS}
                  />
                </GlassField>
              </div>

              <GlassField label="Description & Agenda" hint="What they stand for">
                <textarea
                  rows={2}
                  value={factionDraftDesc}
                  onChange={(e) => setFactionDraftDesc(e.target.value)}
                  placeholder="e.g. Imperial military enforcement guarding the celestial gates against incursions..."
                  className={`${FIELD_CLASS} resize-none`}
                />
              </GlassField>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#e8ca8a]/20">
              <GlassButton onClick={() => setNewFactionModalOpen(false)}>Cancel</GlassButton>
              <GlassButton tone="action" onClick={saveFactionDraft}>
                {editingFaction !== null ? 'Save Changes' : 'Add Faction'}
              </GlassButton>
            </div>
          </div>
        </div>
      )}

      {confirmDialog}
    </GlassScreen>
  )
}
