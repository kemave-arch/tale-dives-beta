import { useEffect, useMemo, useState } from 'react'
import {
  BookOpen,
  Bookmark,
  CheckCircle2,
  Save,
  Search,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react'
import type { ProtagonistData, TierSkin, WorldData } from '../../types.ts'
import type { SeedNarrativePreset } from './types.ts'
import { BUILTIN_NARRATIVE_PRESETS } from './defaultPacks.ts'
import { THREAT_LABEL_PRESETS } from '../../lib/tiers.ts'

const STORAGE_KEY_NARRATIVE_PRESETS = 'td_seed_narrative_presets_v1'

interface NarrativeNodeModalProps {
  narrative: {
    title: string
    opening: string
    narrationStyle: string
  }
  protagonist: ProtagonistData
  world: WorldData
  existingTitles?: string[]
  onSave: (data: {
    title: string
    opening: string
    narrationStyle: string
  }) => void
  onUpdateWorld: (patch: Partial<WorldData>) => void
  onLaunchDirect: () => void
  onClose: () => void
}

// Which built-in preset (if any) the world's current threatLabels array
// matches — 'custom' when it doesn't match a known preset (player-typed) or
// nothing is set yet (falls back to 'plain', the default display anyway).
function detectThreatSkinKey(labels: string[] | undefined): string {
  if (!labels) return 'plain'
  const match = Object.entries(THREAT_LABEL_PRESETS).find(([, preset]) => preset.every((l, i) => l === labels[i]))
  return match?.[0] ?? 'custom'
}

export default function NarrativeNodeModal({
  narrative: initial,
  protagonist,
  world,
  existingTitles = [],
  onSave,
  onUpdateWorld,
  onLaunchDirect,
  onClose,
}: NarrativeNodeModalProps) {
  const [data, setData] = useState({ ...initial })

  // §Narrative-First Overhaul — Threat/Power ladder display reskin. Purely
  // cosmetic and client-side only (lib/tiers.ts's displayThreatLabel): the
  // LLM always emits the fixed canonical THREAT_TIERS word regardless of
  // what's picked here, so a custom label scheme can never reach the model.
  const [threatSkinKey, setThreatSkinKey] = useState(() => detectThreatSkinKey(world.tierSkin?.threatLabels))
  const [customThreatLabels, setCustomThreatLabels] = useState<string[]>(
    () => world.tierSkin?.threatLabels ?? THREAT_LABEL_PRESETS.plain,
  )

  function applyThreatSkin(key: string, labels: string[]) {
    setThreatSkinKey(key)
    setCustomThreatLabels(labels)
    const skin: TierSkin = { ...world.tierSkin, threatLabels: key === 'plain' ? undefined : labels }
    onUpdateWorld({ tierSkin: skin })
  }

  // Presets State
  const [presetModalOpen, setPresetModalOpen] = useState(false)
  const [savePresetModalOpen, setSavePresetModalOpen] = useState(false)
  const [presetNameDraft, setPresetNameDraft] = useState('')
  const [presetDescDraft, setPresetDescDraft] = useState('')
  const [customPresets, setCustomPresets] = useState<SeedNarrativePreset[]>([])
  const [presetSearch, setPresetSearch] = useState('')
  const [saveToast, setSaveToast] = useState<string | null>(null)

  // Load custom presets from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_NARRATIVE_PRESETS)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed)) setCustomPresets(parsed)
      }
    } catch {
      // ignore
    }
  }, [])

  const saveCustomPresetsToStorage = (presets: SeedNarrativePreset[]) => {
    setCustomPresets(presets)
    try {
      localStorage.setItem(STORAGE_KEY_NARRATIVE_PRESETS, JSON.stringify(presets))
    } catch {
      // ignore
    }
  }

  const handleLoadPreset = (preset: SeedNarrativePreset) => {
    const formattedTitle = preset.titleTemplate
      ? preset.titleTemplate.replace('{hero}', protagonist.name || 'Hero').replace('{world}', world.name || 'Realm')
      : data.title

    setData({
      title: formattedTitle || data.title,
      opening: preset.openingHook,
      narrationStyle: preset.narrationStyle,
    })
    setPresetModalOpen(false)
    setSaveToast(`Loaded "${preset.name}" Setup!`)
    setTimeout(() => setSaveToast(null), 2500)
  }

  const handleSaveCurrentPreset = () => {
    const name = presetNameDraft.trim() || data.title || 'Custom Narrative Setup'
    const newPreset: SeedNarrativePreset = {
      id: 'custom_narrative_' + Date.now(),
      titleTemplate: data.title,
      name,
      description: presetDescDraft.trim() || 'Custom opening dive and tone configuration.',
      openingHook: data.opening,
      narrationStyle: data.narrationStyle,
      isCustom: true,
      savedAt: Date.now(),
    }
    const updated = [newPreset, ...customPresets]
    saveCustomPresetsToStorage(updated)
    setSavePresetModalOpen(false)
    setPresetNameDraft('')
    setPresetDescDraft('')
    setSaveToast(`Saved "${name}" to Narrative Presets!`)
    setTimeout(() => setSaveToast(null), 2500)
  }

  const handleDeleteCustomPreset = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const updated = customPresets.filter((p) => p.id !== id)
    saveCustomPresetsToStorage(updated)
  }

  const allPresets = useMemo(() => [...customPresets, ...BUILTIN_NARRATIVE_PRESETS], [customPresets])
  const filteredPresets = useMemo(
    () =>
      allPresets.filter((p) => {
        if (!presetSearch.trim()) return true
        const q = presetSearch.toLowerCase()
        return (
          p.name.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          p.openingHook.toLowerCase().includes(q)
        )
      }),
    [allPresets, presetSearch]
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80">
      <div className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl bg-[#161006] border border-[#f0ca65]/50 shadow-2xl text-[#f5dfa0] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-[#1e1508] border-b border-amber-500/20">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-300">
              <BookOpen size={18} />
            </div>
            <div>
              <h2 className="font-display font-bold text-sm sm:text-base text-[#fae5b5] uppercase tracking-wide">
                Narrative & Prologue Dive
              </h2>
              <p className="font-narrative text-xs text-[#d8c49e]/70">
                Set the opening scene, narrator voice, and tale chronicle title
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setPresetModalOpen(true)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-[#2a1d0b] hover:bg-[#38270f] border border-amber-500/30 text-xs font-display font-semibold text-[#fae5b5] transition-colors"
              title="Load Narrative Setup Preset"
            >
              <Bookmark size={13} className="text-amber-300" />
              <span>Presets</span>
            </button>
            <button
              onClick={() => setSavePresetModalOpen(true)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/40 text-xs font-display font-semibold text-amber-200 transition-colors"
              title="Save current setup as a preset"
            >
              <Save size={13} />
              <span className="hidden sm:inline">Save Preset</span>
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 text-amber-300/80">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Save Toast */}
        {saveToast && (
            <div className="bg-emerald-950/90 border-b border-emerald-500/30 px-4 py-1.5 flex items-center gap-2 text-xs font-mono text-emerald-300">
              <CheckCircle2 size={13} className="text-emerald-400 shrink-0" />
              <span>{saveToast}</span>
            </div>
          )}

        {/* Presets panel — inline slide-down */}
        {presetModalOpen && (
          <div className="border-b border-amber-500/20 bg-[#1a1207] flex flex-col max-h-64">
            <div className="p-3 border-b border-amber-500/15 flex items-center gap-2">
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-amber-400/60" />
                <input
                  type="text"
                  value={presetSearch}
                  onChange={(e) => setPresetSearch(e.target.value)}
                  placeholder="Search presets..."
                  className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-[#241a0a] border border-amber-500/30 text-xs text-[#fae5b5] outline-none"
                />
              </div>
              <button onClick={() => setPresetModalOpen(false)} className="text-amber-300/80 hover:text-white shrink-0">
                <X size={16} />
              </button>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2">
              {filteredPresets.length === 0 ? (
                <div className="text-center py-6 text-xs text-amber-200/60 font-narrative italic">No matching presets found.</div>
              ) : (
                filteredPresets.map((preset) => (
                  <div
                    key={preset.id}
                    className="p-3 rounded-xl bg-[#221708] border border-amber-500/30 hover:border-amber-400/80 transition-all flex items-center justify-between gap-3 shadow-md group"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-display font-bold text-xs text-[#fae5b5] flex items-center gap-2">
                        <span className="truncate">{preset.name}</span>
                        {preset.isCustom && (
                          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 shrink-0">
                            Custom
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] font-narrative text-[#d8c49e]/80 line-clamp-2 mt-0.5">{preset.openingHook}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {preset.isCustom && (
                        <button
                          type="button"
                          onClick={(e) => handleDeleteCustomPreset(preset.id, e)}
                          className="p-1.5 text-red-400 hover:text-red-300 transition-colors"
                          title="Delete custom preset"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                      <button
                        onClick={() => handleLoadPreset(preset)}
                        className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-display font-bold text-xs uppercase tracking-wider transition-colors shadow"
                      >
                        Load
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Save Preset panel — inline slide-down */}
        {savePresetModalOpen && (
          <div className="border-b border-amber-500/20 bg-[#1a1207] p-3 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="font-display font-bold text-xs uppercase text-amber-200 flex items-center gap-1.5">
                <Save size={13} /> Save Preset
              </h3>
              <button onClick={() => setSavePresetModalOpen(false)} className="text-amber-300/80 hover:text-white">
                <X size={16} />
              </button>
            </div>
            <div className="space-y-2 text-xs">
              <div>
                <label className="block text-[10px] font-mono text-amber-300/80 uppercase mb-1">Title *</label>
                <input
                  type="text"
                  value={presetNameDraft}
                  onChange={(e) => setPresetNameDraft(e.target.value)}
                  placeholder="e.g. Academy Crucible Hook"
                  className="w-full px-3 py-1.5 rounded-xl bg-[#221708] border border-amber-500/30 text-amber-100 outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] font-mono text-amber-300/80 uppercase mb-1">Description</label>
                <input
                  type="text"
                  value={presetDescDraft}
                  onChange={(e) => setPresetDescDraft(e.target.value)}
                  placeholder="e.g. High tension opening trial with visceral sensory cues."
                  className="w-full px-3 py-1.5 rounded-xl bg-[#221708] border border-amber-500/30 text-amber-100 outline-none"
                />
              </div>
            </div>
            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={handleSaveCurrentPreset}
                className="px-4 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-display font-bold text-xs uppercase"
              >
                Save Preset
              </button>
            </div>
          </div>
        )}

        {/* Content Area */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-display font-semibold text-amber-200/90">Title *</label>
              {existingTitles.includes(data.title.trim()) && (
                <span className="text-[10px] text-amber-300 font-mono">Title already exists in your vault</span>
              )}
            </div>
            <input
              type="text"
              value={data.title}
              onChange={(e) => setData({ ...data, title: e.target.value })}
              placeholder={`e.g. ${protagonist.name || 'Hero'}'s Conscription in ${world.name || 'Basgiath'}`}
              className="w-full px-3 py-2 rounded-xl bg-[#221708] border border-amber-500/30 text-sm font-display font-bold text-[#fbf4e2] focus:border-amber-400 outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-display font-semibold text-amber-200/90 mb-1">Opening Scene</label>
            <textarea
              rows={3}
              value={data.opening}
              onChange={(e) => setData({ ...data, opening: e.target.value })}
              placeholder="The precise situation Turn 1 opens on (e.g. standing before the rain-slicked Parapet, entering the high academy gates)..."
              className="w-full px-3 py-2 rounded-xl bg-[#221708] border border-amber-500/30 text-xs font-narrative text-[#fbf4e2] focus:border-amber-400 outline-none resize-none leading-relaxed"
            />
          </div>

          <div>
            <label className="block text-xs font-display font-semibold text-amber-200/90 mb-1">Narration Style</label>
            <textarea
              rows={2}
              value={data.narrationStyle}
              onChange={(e) => setData({ ...data, narrationStyle: e.target.value })}
              placeholder="e.g. Visceral close POV, short breath-tight sentences during peril, rich banter..."
              className="w-full px-3 py-2 rounded-xl bg-[#221708] border border-amber-500/30 text-xs font-narrative text-[#fbf4e2] focus:border-amber-400 outline-none resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-display font-semibold text-amber-200/90 mb-1">Threat Ladder Display</label>
            <p className="text-[10px] font-narrative text-[#d8c49e]/60 mb-1.5">
              Purely cosmetic — the narrator always reasons in the same fixed internal ranks either way.
            </p>
            <div className="flex items-center gap-1.5 mb-2">
              {(['plain', 'rank', 'custom'] as const).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => applyThreatSkin(key, key === 'custom' ? customThreatLabels : THREAT_LABEL_PRESETS[key])}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-mono uppercase tracking-wide border transition-colors ${
                    threatSkinKey === key
                      ? 'bg-amber-500/30 border-amber-400 text-amber-100'
                      : 'bg-[#221708] border-amber-500/25 text-amber-300/70 hover:border-amber-400/50'
                  }`}
                >
                  {key === 'plain' ? 'Plain' : key === 'rank' ? 'E–S++' : 'Custom'}
                </button>
              ))}
            </div>
            {threatSkinKey === 'custom' ? (
              <div className="grid grid-cols-4 gap-1.5">
                {customThreatLabels.map((label, i) => (
                  <input
                    key={i}
                    type="text"
                    value={label}
                    onChange={(e) => {
                      const next = [...customThreatLabels]
                      next[i] = e.target.value
                      applyThreatSkin('custom', next)
                    }}
                    className="w-full px-2 py-1 rounded-lg bg-[#221708] border border-amber-500/30 text-[11px] text-[#fbf4e2] outline-none focus:border-amber-400"
                  />
                ))}
              </div>
            ) : (
              <div className="flex flex-wrap gap-1 text-[10px] font-mono text-amber-300/70">
                {(threatSkinKey === 'plain' ? THREAT_LABEL_PRESETS.plain : THREAT_LABEL_PRESETS.rank).map((l) => (
                  <span key={l} className="px-1.5 py-0.5 rounded bg-[#221708] border border-amber-500/25">{l}</span>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 bg-[#1e1508] border-t border-amber-500/20">
          <button
            onClick={onClose}
            className="px-3.5 sm:px-4 py-2 rounded-xl bg-[#2a1d0b] hover:bg-[#38270f] text-xs font-display font-semibold text-[#d8c49e]"
          >
            Cancel
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onSave(data)}
              className="px-3.5 sm:px-4 py-2 rounded-xl bg-[#2f200c] hover:bg-[#3d2a10] text-amber-200 font-display font-semibold text-xs border border-amber-500/30"
            >
              Save Details
            </button>
            <button
              onClick={() => {
                onSave(data)
                onLaunchDirect()
              }}
              className="px-4 sm:px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-display font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-lg shadow-amber-500/40"
            >
              <Sparkles size={15} />
              <span>Launch Dive</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
