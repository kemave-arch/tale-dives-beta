import { useState } from 'react'
import { Info, Layers, Bookmark, Save, Plus, Search, X, Globe, Eye, Check, CheckCircle2 } from 'lucide-react'
import { DEFAULT_NARRATION_STYLE } from '../api/turnContract.ts'
import {
  FIELD_CLASS, GLASS_SURFACE, GLASS_SURFACE_LIST, GlassButton, GlassCTAButton, GlassField, GlassHeader, GlassLongTextarea, GlassScreen, GlassTabs,
} from '../lib/glassChrome.tsx'
import { GENRE_TONE_EXAMPLES, POWER_SYSTEM_EXAMPLES } from '../data/formExamples.ts'
import type { WorldData } from '../types.ts'
import { WorldDetailModal } from '../components/PresetDetailModal.tsx'

interface WorldSetupProps {
  worldTemplates?: WorldData[]
  initial?: WorldData | null
  editLongText: (label: string, value: string, hint?: string, placeholder?: string) => Promise<string | null>
  onBack: () => void
  onContinue: (world: WorldData) => void
  onSavePreset?: (world: WorldData) => void
  onSaveAsNewPreset?: (world: WorldData) => void
}

const TABS = [
  { id: 'overview' as const, label: 'Overview', icon: Info },
  { id: 'depth' as const, label: 'Depth', icon: Layers },
  { id: 'presets' as const, label: 'Load Preset', icon: Bookmark },
]

// Blueprint §Phase A.1 — Original Mode world setup, now also usable as the
// World Library's create/edit form (§6.4B) since both need the same fields.
// Inspired Mode (§Phase A.2, title/author -> grounded world-fabrication call)
// isn't built yet — it needs Gemini's search-grounding tool alongside
// structured JSON output in the same call, which needs its own verification.
// A pre-authored Inspired-mode template (Appendix A's Fourth Wing example)
// can still be picked here and edited by hand — sourceTitle/sourceAuthor are
// attribution metadata only, never sent to the model.
export default function WorldSetup({
  worldTemplates = [],
  initial,
  editLongText,
  onBack,
  onContinue,
  onSavePreset,
  onSaveAsNewPreset,
}: WorldSetupProps) {
  const [tab, setTab] = useState<(typeof TABS)[number]['id']>('overview')
  const [presetSearch, setPresetSearch] = useState('')
  const [selectedPreset, setSelectedPreset] = useState<WorldData | null>(null)
  const [selectedDeckId, setSelectedDeckId] = useState<string | null>(initial?.id ?? null)
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

  function applyTemplate(t: WorldData) {
    setTab('overview')
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

  // Sort presets from latest to oldest
  const sortedTemplates = [...matchedTemplates].sort(
    (a, b) => getPresetTimestamp(b) - getPresetTimestamp(a),
  )

  return (
    <GlassScreen ground="art" fill>
      <GlassHeader title="Build a World" subtitle="Step 2 — the setting your tale grows from" onBack={onBack} />

      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4">
        <div className="max-w-md md:max-w-2xl lg:max-w-3xl mx-auto flex flex-col gap-4">
          <GlassTabs tabs={TABS} value={tab} onChange={setTab} className="w-full" />

          {tab === 'presets' && (
            <div className="flex flex-col gap-3">
              <div className="relative">
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

              {worldTemplates.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[#e8ca8a]/30 p-6 text-center">
                  <p className="font-narrative italic text-sm text-[#e8ca8a]/80 mb-1">No saved Worlds yet.</p>
                  <p className="font-narrative text-xs text-[#e8ca8a]/60">
                    Configure your world in Overview &amp; Depth, then click &ldquo;Save as New Preset&rdquo; below to save it here for future tales.
                  </p>
                </div>
              ) : sortedTemplates.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[#e8ca8a]/30 p-4 text-center">
                  <p className="font-narrative italic text-xs text-[#e8ca8a]/70">No saved worlds match &ldquo;{presetSearch}&rdquo;</p>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  <p className="font-narrative italic text-xs text-[#d8c49e]">
                    Select a world card and confirm to load its lore and power system into this setup.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
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
                              <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 transition-colors ${
                                isSelected
                                  ? 'border-[#38bdf8] bg-[#38bdf8] text-[#040e17]'
                                  : 'border-[#38bdf8]/50 bg-transparent text-transparent'
                              }`}>
                                <Check size={11} strokeWidth={3} />
                              </div>
                              <Globe size={16} className="text-[#38bdf8] shrink-0" />
                              <h3 className="font-display font-bold text-sm text-[#e0f2fe] truncate">{t.name}</h3>
                              <div className="flex items-center gap-1 shrink-0 flex-wrap">
                                {isCurrent && (
                                  <span className="rounded bg-[#38bdf8]/25 text-[#7dd3fc] border border-[#38bdf8]/40 px-1.5 py-0.2 text-[9px] font-mono">
                                    active
                                  </span>
                                )}
                                {t.isDefault && (
                                  <span className="rounded bg-[#38bdf8]/15 text-[#bae6fd] border border-[#38bdf8]/30 px-1.5 py-0.2 text-[9px] font-mono">
                                    default
                                  </span>
                                )}
                                <span className={`rounded px-1.5 py-0.2 text-[9px] font-mono uppercase tracking-wider border ${
                                  isInspired
                                    ? 'bg-[#38bdf8]/10 text-[#7dd3fc] border-[#38bdf8]/25'
                                    : 'bg-[#0284c7]/20 text-[#e0f2fe] border-[#38bdf8]/35'
                                }`}>
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
                    const chosen = sortedTemplates.find((t) => t.id === selectedDeckId) || (sortedTemplates.length > 0 ? sortedTemplates[0] : null)
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
                />
              )}
            </div>
          )}

          {tab === 'overview' && (
            <div className="flex flex-col gap-4">
              <GlassField label="World Name" hint="The realm or setting name">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Navarre (Basgiath War College)"
                  className={FIELD_CLASS}
                />
              </GlassField>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <GlassField label="Adapted Novel / Work" hint="Optional attribution">
                  <input
                    value={sourceTitle}
                    onChange={(e) => setSourceTitle(e.target.value)}
                    placeholder="e.g. Fourth Wing"
                    className={FIELD_CLASS}
                  />
                </GlassField>

                <GlassField label="Original Author" hint="Optional attribution">
                  <input
                    value={sourceAuthor}
                    onChange={(e) => setSourceAuthor(e.target.value)}
                    placeholder="e.g. Rebecca Yarros"
                    className={FIELD_CLASS}
                  />
                </GlassField>
              </div>

              <GlassField
                label="Genre & Tone"
                hint="Core atmosphere & narrative style"
                examples={GENRE_TONE_EXAMPLES}
                onPickExample={(val) => setGenreTone(val)}
              >
                <input
                  value={genreTone}
                  onChange={(e) => setGenreTone(e.target.value)}
                  placeholder="e.g. Romantasy, lethal dragon rider war academy, high stakes & visceral"
                  className={FIELD_CLASS}
                />
              </GlassField>
            </div>
          )}

          {tab === 'depth' && (
            <div className="flex flex-col gap-4">
              <GlassField label="Core Regional Conflict" hint="The primary struggle driving events">
                <input
                  value={conflict}
                  onChange={(e) => setConflict(e.target.value)}
                  placeholder="e.g. Lethal trials in the Riders Quadrant against border war and hidden venin threats"
                  className={FIELD_CLASS}
                />
              </GlassField>

              <GlassField
                label="Power System"
                hint="Magic, cultivation, tech, or pure skill"
                examples={POWER_SYSTEM_EXAMPLES}
                onPickExample={(val) => setPowerSystem(val)}
              >
                <GlassLongTextarea
                  value={powerSystem}
                  onOpenModal={async () => {
                    const result = await editLongText(
                      'Power System',
                      powerSystem,
                      'Magic, cultivation, tech, or pure skill — however power works here.',
                      'e.g. Signet magic drawn from bonded dragons with severe physical burnout risk, plus runic wards.',
                    )
                    if (result !== null) setPowerSystem(result)
                  }}
                  placeholder="e.g. Signet magic drawn from bonded dragons with severe physical burnout risk, plus runic wards..."
                  rows={3}
                />
              </GlassField>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <GlassField label="Era / Tech Level" hint="Setting tech or historical era">
                  <input
                    value={eraTechLevel}
                    onChange={(e) => setEraTechLevel(e.target.value)}
                    placeholder="e.g. High fantasy war college, dragon aerial combat, ancient wards"
                    className={FIELD_CLASS}
                  />
                </GlassField>

                <GlassField label="Key Factions" hint="Named factions driving tension">
                  <input
                    value={keyFactions}
                    onChange={(e) => setKeyFactions(e.target.value)}
                    placeholder="e.g. Navarre (Riders, Scribes) vs. Poromiel fliers & hidden venin"
                    className={FIELD_CLASS}
                  />
                </GlassField>
              </div>

              <GlassField label="World Background" hint="The setting's key backdrop & geography">
                <GlassLongTextarea
                  value={background}
                  onOpenModal={async () => {
                    const result = await editLongText(
                      'World Background',
                      background,
                      "The setting's key backdrop, e.g. the continent of Navarre.",
                      'e.g. Navarre relies on dragon wards centered at Basgiath War College while cadet riders face lethal trials against encroaching venin.',
                    )
                    if (result !== null) setBackground(result)
                  }}
                  placeholder="e.g. Navarre relies on dragon wards centered at Basgiath War College against encroaching venin..."
                  rows={3}
                />
              </GlassField>

              <GlassField label="Narration Style" hint="Custom narrator tone and voice directives">
                <GlassLongTextarea
                  value={narrationStyle}
                  onOpenModal={async () => {
                    const result = await editLongText(
                      'Narration Style',
                      narrationStyle,
                      'Custom narrator tone instructions or voice directives.',
                      'e.g. Visceral close POV with high-stakes urgency; short, breath-tight sentences during danger; sharp, banter-driven dialogue with simmering romantic tension; tactile physical strain over abstraction.',
                    )
                    if (result !== null) setNarrationStyle(result)
                  }}
                  placeholder="e.g. Visceral close POV with high-stakes urgency, staccato tension during danger, and sharp banter..."
                  rows={4}
                />
              </GlassField>
            </div>
          )}

          {(onSavePreset || onSaveAsNewPreset) && (
            <div className="flex gap-2 pt-1">
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

      {/* Back lives in the header now, so the footer carries only the single
          forward action. It needs its own blur/tint because the artwork keeps
          scrolling underneath it. */}
      <div
        className={`shrink-0 ${GLASS_SURFACE} border-x-0 border-b-0 bg-[#07050c]/50 px-4 py-3 flex justify-center`}
        style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
      >
        <div className="w-full max-w-md md:max-w-2xl lg:max-w-3xl flex justify-center">
          <GlassCTAButton onClick={() => onContinue(currentData())}>Continue</GlassCTAButton>
        </div>
      </div>
    </GlassScreen>
  )
}
