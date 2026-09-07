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
import type { CombatMode, ProtagonistData, WorldData } from '../../types.ts'
import type { SeedNarrativePreset } from './types.ts'
import { BUILTIN_NARRATIVE_PRESETS } from './defaultPacks.ts'

const STORAGE_KEY_NARRATIVE_PRESETS = 'td_seed_narrative_presets_v1'

interface NarrativeNodeModalProps {
  narrative: {
    title: string
    opening: string
    narrationStyle: string
    combatMode: CombatMode
  }
  protagonist: ProtagonistData
  world: WorldData
  existingTitles?: string[]
  onSave: (data: {
    title: string
    opening: string
    narrationStyle: string
    combatMode: CombatMode
  }) => void
  onLaunchDirect: () => void
  onClose: () => void
}

export default function NarrativeNodeModal({
  narrative: initial,
  protagonist,
  world,
  existingTitles = [],
  onSave,
  onLaunchDirect,
  onClose,
}: NarrativeNodeModalProps) {
  const [data, setData] = useState({ ...initial })

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
      combatMode: preset.combatMode,
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
      combatMode: data.combatMode,
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
      <div className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl bg-[#150d24] border border-purple-400/50 shadow-2xl text-[#f5dfa0] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-[#1d1232] border-b border-purple-500/20">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-purple-500/20 border border-purple-400/40 flex items-center justify-center text-purple-300">
              <BookOpen size={18} />
            </div>
            <div>
              <h2 className="font-display font-bold text-sm sm:text-base text-[#e9d5ff] uppercase tracking-wide">
                Narrative & Prologue Dive
              </h2>
              <p className="font-narrative text-xs text-[#d8b4fe]/70">
                Set the opening scene, narrator voice, and tale chronicle title
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setPresetModalOpen(true)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-[#261742] hover:bg-[#321f57] border border-purple-500/30 text-xs font-display font-semibold text-[#e9d5ff] transition-colors"
              title="Load Narrative Setup Preset"
            >
              <Bookmark size={13} className="text-purple-300" />
              <span>Presets</span>
            </button>
            <button
              onClick={() => setSavePresetModalOpen(true)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 border border-purple-400/40 text-xs font-display font-semibold text-purple-200 transition-colors"
              title="Save current setup as a preset"
            >
              <Save size={13} />
              <span className="hidden sm:inline">Save Preset</span>
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 text-purple-300/80">
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

        {/* Presets panel — inline slide-down instead of a second full-screen
            dialog stacked over this one. */}
        {presetModalOpen && (
          <div className="border-b border-purple-500/20 bg-[#180e2a] flex flex-col max-h-64">
            <div className="p-3 border-b border-purple-500/15 flex items-center gap-2">
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-purple-400/60" />
                <input
                  type="text"
                  value={presetSearch}
                  onChange={(e) => setPresetSearch(e.target.value)}
                  placeholder="Search presets..."
                  className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-[#1f1337] border border-purple-500/30 text-xs text-[#e9d5ff] outline-none"
                />
              </div>
              <button onClick={() => setPresetModalOpen(false)} className="text-purple-300/80 hover:text-white shrink-0">
                <X size={16} />
              </button>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2">
              {filteredPresets.length === 0 ? (
                <div className="text-center py-6 text-xs text-purple-200/60">No matching presets found.</div>
              ) : (
                filteredPresets.map((preset) => (
                  <div
                    key={preset.id}
                    className="p-3 rounded-xl bg-[#1e1433] border border-purple-500/25 hover:border-purple-400/60 transition-all flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-display font-bold text-xs text-purple-200 flex items-center gap-2">
                        <span>{preset.name}</span>
                        {preset.isCustom && (
                          <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            Custom
                          </span>
                        )}
                        <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                          {preset.combatMode}
                        </span>
                      </div>
                      <p className="text-[11px] font-narrative text-[#d8b4fe]/80 line-clamp-2 mt-0.5">{preset.openingHook}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {preset.isCustom && (
                        <button
                          type="button"
                          onClick={(e) => handleDeleteCustomPreset(preset.id, e)}
                          className="p-1.5 text-red-400 hover:text-red-300"
                          title="Delete custom preset"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                      <button
                        onClick={() => handleLoadPreset(preset)}
                        className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-400 hover:to-indigo-400 text-white font-display font-bold text-xs uppercase tracking-wider"
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

        {/* Save Preset panel — inline slide-down instead of a stacked dialog. */}
        {savePresetModalOpen && (
          <div className="border-b border-purple-500/20 bg-[#180e2a] p-3 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="font-display font-bold text-xs uppercase text-purple-200 flex items-center gap-1.5">
                <Save size={13} /> Save Preset
              </h3>
              <button onClick={() => setSavePresetModalOpen(false)} className="text-purple-300/80 hover:text-white">
                <X size={16} />
              </button>
            </div>
            <div className="space-y-2 text-xs">
              <div>
                <label className="block text-[10px] font-mono text-purple-300/80 uppercase mb-1">Title *</label>
                <input
                  type="text"
                  value={presetNameDraft}
                  onChange={(e) => setPresetNameDraft(e.target.value)}
                  placeholder="e.g. Academy Crucible Hook"
                  className="w-full px-3 py-1.5 rounded-xl bg-[#1e1433] border border-purple-500/30 text-purple-100 outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] font-mono text-purple-300/80 uppercase mb-1">Description</label>
                <input
                  type="text"
                  value={presetDescDraft}
                  onChange={(e) => setPresetDescDraft(e.target.value)}
                  placeholder="e.g. High tension opening trial with visceral sensory cues."
                  className="w-full px-3 py-1.5 rounded-xl bg-[#1e1433] border border-purple-500/30 text-purple-100 outline-none"
                />
              </div>
            </div>
            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={handleSaveCurrentPreset}
                className="px-4 py-1.5 rounded-xl bg-purple-500 hover:bg-purple-400 text-white font-display font-bold text-xs uppercase"
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
              <label className="text-xs font-display font-semibold text-purple-200/90">Title *</label>
              {existingTitles.includes(data.title.trim()) && (
                <span className="text-[10px] text-amber-300 font-mono">Title already exists in your vault</span>
              )}
            </div>
            <input
              type="text"
              value={data.title}
              onChange={(e) => setData({ ...data, title: e.target.value })}
              placeholder={`e.g. ${protagonist.name || 'Hero'}'s Conscription in ${world.name || 'Basgiath'}`}
              className="w-full px-3 py-2 rounded-xl bg-[#1e1433] border border-purple-500/30 text-sm font-display font-bold text-[#fbf4e2] focus:border-purple-400 outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-display font-semibold text-purple-200/90 mb-1">Opening Scene</label>
            <textarea
              rows={3}
              value={data.opening}
              onChange={(e) => setData({ ...data, opening: e.target.value })}
              placeholder="The precise situation Turn 1 opens on (e.g. standing before the rain-slicked Parapet, entering the high academy gates)..."
              className="w-full px-3 py-2 rounded-xl bg-[#1e1433] border border-purple-500/30 text-xs font-narrative text-[#fbf4e2] focus:border-purple-400 outline-none resize-none leading-relaxed"
            />
          </div>

          <div>
            <label className="block text-xs font-display font-semibold text-purple-200/90 mb-1">Narration Style</label>
            <textarea
              rows={2}
              value={data.narrationStyle}
              onChange={(e) => setData({ ...data, narrationStyle: e.target.value })}
              placeholder="e.g. Visceral close POV, short breath-tight sentences during peril, rich banter..."
              className="w-full px-3 py-2 rounded-xl bg-[#1e1433] border border-purple-500/30 text-xs font-narrative text-[#fbf4e2] focus:border-purple-400 outline-none resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-display font-semibold text-purple-200/90 mb-1">Combat Mode</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setData({ ...data, combatMode: 'NARRATIVE' })}
                className={`p-3 rounded-xl text-left border transition-all ${
                  data.combatMode === 'NARRATIVE'
                    ? 'bg-purple-500/20 border-purple-400 text-purple-200 shadow-md shadow-purple-500/20'
                    : 'bg-[#1a112c] border-purple-500/15 text-[#d8c49e] hover:border-purple-500/30'
                }`}
              >
                <div className="font-display font-bold text-xs">Narrative Combat</div>
                <div className="text-[10px] font-narrative opacity-75 mt-0.5">
                  Prose-driven duels and tactical maneuvers guided by LLM pacing.
                </div>
              </button>

              <button
                type="button"
                onClick={() => setData({ ...data, combatMode: 'TACTICAL' })}
                className={`p-3 rounded-xl text-left border transition-all ${
                  data.combatMode === 'TACTICAL'
                    ? 'bg-purple-500/20 border-purple-400 text-purple-200 shadow-md shadow-purple-500/20'
                    : 'bg-[#1a112c] border-purple-500/15 text-[#d8c49e] hover:border-purple-500/30'
                }`}
              >
                <div className="font-display font-bold text-xs">Tactical Turn-Based</div>
                <div className="text-[10px] font-narrative opacity-75 mt-0.5">
                  Client-computed stat damage, HP/ST mitigation, and adversary blocks.
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 bg-[#1d1232] border-t border-purple-500/20">
          <button
            onClick={onClose}
            className="px-3.5 sm:px-4 py-2 rounded-xl bg-[#261742] hover:bg-[#321f57] text-xs font-display font-semibold text-[#d8b4fe]"
          >
            Cancel
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onSave(data)}
              className="px-3.5 sm:px-4 py-2 rounded-xl bg-[#2a1a4a] hover:bg-[#392463] text-purple-200 font-display font-semibold text-xs border border-purple-500/30"
            >
              Save Details
            </button>
            <button
              onClick={() => {
                onSave(data)
                onLaunchDirect()
              }}
              className="px-4 sm:px-5 py-2 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-400 hover:to-indigo-400 text-white font-display font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-lg shadow-purple-500/40"
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
