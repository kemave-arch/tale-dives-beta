import { useMemo, useState } from 'react'
import {
  Bookmark,
  CheckCircle2,
  ChevronDown,
  Flag,
  Globe,
  MapPin,
  Plus,
  Save,
  Search,
  Trash2,
  X,
} from 'lucide-react'
import type { WorldData, WorldFaction, WorldLocation } from '../../types.ts'

interface WorldNodeModalProps {
  world: WorldData
  worldTemplates: WorldData[]
  onSave: (data: WorldData) => void
  onSavePreset?: (data: WorldData) => void
  onDeletePreset?: (id: string) => void
  onClose: () => void
}

export default function WorldNodeModal({
  world: initial,
  worldTemplates = [],
  onSave,
  onSavePreset,
  onClose,
}: WorldNodeModalProps) {
  const [subTab, setSubTab] = useState<'overview' | 'locations' | 'factions'>('overview')
  const [data, setData] = useState<WorldData>({ ...initial })

  // Presets Browser Modal
  const [presetModalOpen, setPresetModalOpen] = useState(false)
  const [presetSearch, setPresetSearch] = useState('')
  const [saveToast, setSaveToast] = useState<string | null>(null)

  // Sub-Editor states
  const [editingLocIdx, setEditingLocIdx] = useState<number | null>(null)
  const [editingFacIdx, setEditingFacIdx] = useState<number | null>(null)

  const handleAddLocation = () => {
    const newLoc: WorldLocation = {
      name: 'New Site / Stronghold',
      region: 'Frontier Region',
      locationType: 'Fortress',
      dangerLevel: 'High',
      factionOwner: '',
      description: 'A fortified stronghold or tactical terrain.',
    }
    const nextList = [...(data.locationsList || []), newLoc]
    setData((d) => ({ ...d, locationsList: nextList }))
    setEditingLocIdx(nextList.length - 1)
  }

  const handleRemoveLocation = (idx: number) => {
    setData((d) => ({
      ...d,
      locationsList: (d.locationsList || []).filter((_, i) => i !== idx),
    }))
    if (editingLocIdx === idx) setEditingLocIdx(null)
  }

  const handleUpdateLocation = (idx: number, patch: Partial<WorldLocation>) => {
    setData((d) => {
      const copy = [...(d.locationsList || [])]
      copy[idx] = { ...copy[idx], ...patch }
      return { ...d, locationsList: copy }
    })
  }

  const handleAddFaction = () => {
    const newFac: WorldFaction = {
      id: 'fac_' + Date.now(),
      name: 'New Faction',
      attitude: 'neutral',
      description: 'A powerful guild, military wing, or political council.',
      territory: '',
    }
    const nextList = [...(data.factionsList || []), newFac]
    setData((d) => ({ ...d, factionsList: nextList }))
    setEditingFacIdx(nextList.length - 1)
  }

  const handleRemoveFaction = (idx: number) => {
    setData((d) => ({
      ...d,
      factionsList: (d.factionsList || []).filter((_, i) => i !== idx),
    }))
    if (editingFacIdx === idx) setEditingFacIdx(null)
  }

  const handleUpdateFaction = (idx: number, patch: Partial<WorldFaction>) => {
    setData((d) => {
      const copy = [...(d.factionsList || [])]
      copy[idx] = { ...copy[idx], ...patch }
      return { ...d, factionsList: copy }
    })
  }

  const handleSaveToPresets = () => {
    if (onSavePreset) {
      onSavePreset(data)
    }
    setSaveToast(`Saved "${data.name || 'World'}" to Presets!`)
    setTimeout(() => setSaveToast(null), 2500)
  }

  const handleLoadPreset = (template: WorldData) => {
    setData({
      ...template,
      id: data.id || template.id,
    })
    setPresetModalOpen(false)
    setSaveToast(`Loaded "${template.name}" Preset!`)
    setTimeout(() => setSaveToast(null), 2000)
  }

  const filteredPresets = useMemo(
    () =>
      worldTemplates.filter((t) => {
        if (!presetSearch.trim()) return true
        const q = presetSearch.toLowerCase()
        return (
          t.name.toLowerCase().includes(q) ||
          (t.genreTone || '').toLowerCase().includes(q) ||
          (t.conflict || '').toLowerCase().includes(q)
        )
      }),
    [worldTemplates, presetSearch]
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80">
      <div className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl bg-[#091524] border border-sky-500/40 shadow-2xl text-[#f5dfa0] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-[#0f2034] border-b border-sky-500/20">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-sky-500/20 border border-sky-400/40 flex items-center justify-center text-sky-300">
              <Globe size={18} />
            </div>
            <div>
              <h2 className="font-display font-bold text-sm sm:text-base text-[#bae6fd] uppercase tracking-wide">
                World & Realm Crucible
              </h2>
              <p className="font-narrative text-xs text-[#93c5fd]/70">
                Define the setting, magic laws, locations, and faction dynamics
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setPresetModalOpen(true)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-[#142842] hover:bg-[#1a365a] border border-sky-500/30 text-xs font-display font-semibold text-[#bae6fd] transition-colors"
              title="Load World Preset"
            >
              <Bookmark size={13} className="text-sky-300" />
              <span>Presets</span>
            </button>
            <button
              onClick={handleSaveToPresets}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-sky-500/20 hover:bg-sky-500/30 border border-sky-400/40 text-xs font-display font-semibold text-sky-200 transition-colors"
              title="Save current world as a preset"
            >
              <Save size={13} />
              <span className="hidden sm:inline">Save Preset</span>
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 text-sky-300/80">
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
          <div className="border-b border-sky-500/20 bg-[#0b1b2d] flex flex-col max-h-64">
            <div className="p-3 border-b border-sky-500/15 flex items-center gap-2">
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-sky-400/60" />
                <input
                  type="text"
                  value={presetSearch}
                  onChange={(e) => setPresetSearch(e.target.value)}
                  placeholder="Search presets..."
                  className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-[#122238] border border-sky-500/30 text-xs text-[#bae6fd] outline-none"
                />
              </div>
              <button onClick={() => setPresetModalOpen(false)} className="text-sky-300/80 hover:text-white shrink-0">
                <X size={16} />
              </button>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2">
              {filteredPresets.length === 0 ? (
                <div className="text-center py-6 text-xs text-sky-200/60">No matching presets found.</div>
              ) : (
                filteredPresets.map((t) => (
                  <div
                    key={t.id || t.name}
                    className="p-3 rounded-xl bg-[#0e1d30] border border-sky-500/25 hover:border-sky-400/60 transition-all flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-display font-bold text-xs text-sky-200 flex items-center gap-2">
                        <span>{t.name}</span>
                        {t.genreTone && (
                          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30">
                            {t.genreTone}
                          </span>
                        )}
                      </div>
                      {t.conflict && (
                        <p className="text-[11px] font-narrative text-[#93c5fd]/70 line-clamp-1 mt-0.5">{t.conflict}</p>
                      )}
                      <div className="flex items-center gap-2 text-[9px] font-mono text-[#93c5fd]/60 mt-1">
                        <span>📍 {t.locationsList?.length || 0} Sites</span>
                        <span>🚩 {t.factionsList?.length || 0} Factions</span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleLoadPreset(t)}
                      className="px-3 py-1.5 rounded-lg bg-sky-400 hover:bg-sky-300 text-black font-display font-bold text-xs shrink-0 uppercase tracking-wider"
                    >
                      Load
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Subtabs */}
        <div className="flex border-b border-sky-500/20 bg-[#0c1a2d] px-3 pt-2 gap-2">
          {[
            { id: 'overview', label: 'Realm & Laws', icon: Globe },
            { id: 'locations', label: 'Key Sites & Geography', icon: MapPin },
            { id: 'factions', label: 'Factions & Powers', icon: Flag },
          ].map((tab) => {
            const Icon = tab.icon
            const active = subTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setSubTab(tab.id as any)}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-display font-semibold transition-colors border-b-2 ${
                  active
                    ? 'border-sky-400 text-sky-300 bg-sky-500/10'
                    : 'border-transparent text-[#93c5fd]/70 hover:text-white'
                }`}
              >
                <Icon size={14} />
                <span>{tab.label}</span>
              </button>
            )
          })}
        </div>

        {/* Content Area */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
          {subTab === 'overview' && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-display font-semibold text-sky-200/90 mb-1">Name *</label>
                <input
                  type="text"
                  value={data.name}
                  onChange={(e) => setData({ ...data, name: e.target.value })}
                  placeholder="e.g. Navarre, Midkemia, The Continent"
                  className="w-full px-3 py-2 rounded-xl bg-[#122238] border border-sky-500/30 text-sm text-sky-100 focus:border-sky-400 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-display font-semibold text-sky-200/90 mb-1">
                    Genre Tone
                  </label>
                  <input
                    type="text"
                    value={data.genreTone || ''}
                    onChange={(e) => setData({ ...data, genreTone: e.target.value })}
                    placeholder="e.g. Dark Romantasy, High Epic, Grimdark"
                    className="w-full px-3 py-2 rounded-xl bg-[#122238] border border-sky-500/30 text-sm text-sky-100 focus:border-sky-400 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-display font-semibold text-sky-200/90 mb-1">Era</label>
                  <input
                    type="text"
                    value={data.eraTechLevel || ''}
                    onChange={(e) => setData({ ...data, eraTechLevel: e.target.value })}
                    placeholder="e.g. Medieval Dragon-Rider, Arcane Renaissance"
                    className="w-full px-3 py-2 rounded-xl bg-[#122238] border border-sky-500/30 text-sm text-sky-100 focus:border-sky-400 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-display font-semibold text-sky-200/90 mb-1">Power System</label>
                <textarea
                  rows={2}
                  value={data.powerSystem || ''}
                  onChange={(e) => setData({ ...data, powerSystem: e.target.value })}
                  placeholder="e.g. Dragon signets channel raw energy; wards require bonded relics..."
                  className="w-full px-3 py-2 rounded-xl bg-[#122238] border border-sky-500/30 text-xs font-narrative text-sky-100 focus:border-sky-400 outline-none resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-display font-semibold text-sky-200/90 mb-1">Conflict</label>
                <textarea
                  rows={3}
                  value={data.conflict || ''}
                  onChange={(e) => setData({ ...data, conflict: e.target.value })}
                  placeholder="e.g. Poromiel flyers raid the border; venin shadows threaten the dying wards..."
                  className="w-full px-3 py-2 rounded-xl bg-[#122238] border border-sky-500/30 text-xs font-narrative text-sky-100 focus:border-sky-400 outline-none resize-none leading-relaxed"
                />
              </div>
            </div>
          )}

          {subTab === 'locations' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-display font-semibold text-sky-200/90">Sites</span>
                <button
                  onClick={handleAddLocation}
                  className="flex items-center gap-1 text-[11px] font-display font-semibold text-sky-300 hover:text-sky-200 px-2 py-1 rounded bg-sky-500/20 hover:bg-sky-500/30 border border-sky-400/30"
                >
                  <Plus size={13} /> Add Site
                </button>
              </div>

              <div className="space-y-2">
                {(data.locationsList || []).map((loc, idx) => {
                  const expanded = editingLocIdx === idx
                  return (
                    <div key={idx} className="rounded-xl bg-[#122238] border border-sky-500/20 overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setEditingLocIdx(expanded ? null : idx)}
                        className="w-full p-3 flex items-center justify-between gap-2 text-left"
                      >
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <span className="font-display font-bold text-xs text-sky-200 truncate">{loc.name || 'Unnamed Site'}</span>
                          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30 shrink-0">
                            {loc.locationType || 'Fortress'}
                          </span>
                          <span
                            className={`text-[9px] font-mono px-1.5 py-0.5 rounded border shrink-0 ${
                              loc.dangerLevel === 'Lethal' || loc.dangerLevel === 'High'
                                ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                                : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                            }`}
                          >
                            {loc.dangerLevel || 'Safe'}
                          </span>
                          {loc.region && (
                            <span className="text-[9px] font-mono text-[#93c5fd]/70 truncate hidden sm:inline">
                              📍 {loc.region}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <span
                            onClick={(e) => {
                              e.stopPropagation()
                              handleRemoveLocation(idx)
                            }}
                            className="text-red-400 hover:text-red-300 p-1"
                          >
                            <Trash2 size={13} />
                          </span>
                          <ChevronDown
                            size={15}
                            className={`text-sky-300/80 transition-transform ${expanded ? 'rotate-180' : ''}`}
                          />
                        </div>
                      </button>

                      {!expanded && loc.description && (
                        <p className="px-3 pb-2 text-xs font-narrative text-[#93c5fd]/80 line-clamp-1">{loc.description}</p>
                      )}

                      {expanded && (
                        <div className="p-3 pt-0 space-y-2.5 text-xs border-t border-sky-500/20">
                          <div>
                            <label className="block text-[10px] font-mono text-sky-300/80 uppercase mb-1">Name *</label>
                            <input
                              type="text"
                              value={loc.name}
                              onChange={(e) => handleUpdateLocation(idx, { name: e.target.value })}
                              placeholder="e.g. The Parapet, Basgiath Academic Quad"
                              className="w-full px-3 py-1.5 rounded-xl bg-[#162a42] border border-sky-500/30 text-sky-100 outline-none"
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[10px] font-mono text-sky-300/80 uppercase mb-1">Region</label>
                              <input
                                type="text"
                                value={loc.region || ''}
                                onChange={(e) => handleUpdateLocation(idx, { region: e.target.value })}
                                placeholder="e.g. Basgiath, Eastern Frontier"
                                className="w-full px-2 py-1.5 rounded-xl bg-[#162a42] border border-sky-500/30 text-sky-100 outline-none"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-mono text-sky-300/80 uppercase mb-1">Danger</label>
                              <select
                                value={loc.dangerLevel || 'Low'}
                                onChange={(e) => handleUpdateLocation(idx, { dangerLevel: e.target.value })}
                                className="w-full px-2 py-1.5 rounded-xl bg-[#162a42] border border-sky-500/30 text-sky-100 outline-none"
                              >
                                <option value="Safe">Safe</option>
                                <option value="Low">Low</option>
                                <option value="High">High</option>
                                <option value="Lethal">Lethal</option>
                              </select>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[10px] font-mono text-sky-300/80 uppercase mb-1">Type</label>
                              <select
                                value={loc.locationType || 'Fortress'}
                                onChange={(e) => handleUpdateLocation(idx, { locationType: e.target.value })}
                                className="w-full px-2 py-1.5 rounded-xl bg-[#162a42] border border-sky-500/30 text-sky-100 outline-none"
                              >
                                <option value="Fortress">Fortress</option>
                                <option value="Academy">Academy / College</option>
                                <option value="Settlement">City / Settlement</option>
                                <option value="Dungeon">Dungeon / Cavern</option>
                                <option value="Wilderness">Wilderness / Frontier</option>
                                <option value="Landmark">Landmark / Shrine</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-[10px] font-mono text-sky-300/80 uppercase mb-1">Faction</label>
                              <input
                                type="text"
                                value={loc.factionOwner || ''}
                                onChange={(e) => handleUpdateLocation(idx, { factionOwner: e.target.value })}
                                placeholder="e.g. Navarre Riders"
                                className="w-full px-2 py-1.5 rounded-xl bg-[#162a42] border border-sky-500/30 text-sky-100 outline-none"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="block text-[10px] font-mono text-sky-300/80 uppercase mb-1">Description</label>
                            <textarea
                              rows={2}
                              value={loc.description || ''}
                              onChange={(e) => handleUpdateLocation(idx, { description: e.target.value })}
                              placeholder="Visual atmosphere, environmental hazards, tactical landmarks..."
                              className="w-full px-3 py-1.5 rounded-xl bg-[#162a42] border border-sky-500/30 text-xs font-narrative text-sky-100 outline-none resize-none"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {subTab === 'factions' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-display font-semibold text-sky-200/90">Factions</span>
                <button
                  onClick={handleAddFaction}
                  className="flex items-center gap-1 text-[11px] font-display font-semibold text-sky-300 hover:text-sky-200 px-2 py-1 rounded bg-sky-500/20 hover:bg-sky-500/30 border border-sky-400/30"
                >
                  <Plus size={13} /> Add Faction
                </button>
              </div>

              <div className="space-y-2">
                {(data.factionsList || []).map((fac, idx) => {
                  const expanded = editingFacIdx === idx
                  return (
                    <div key={fac.id || idx} className="rounded-xl bg-[#122238] border border-sky-500/20 overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setEditingFacIdx(expanded ? null : idx)}
                        className="w-full p-3 flex items-center justify-between gap-2 text-left"
                      >
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <span className="font-display font-bold text-xs text-sky-200 truncate">{fac.name || 'Unnamed Faction'}</span>
                          <span
                            className={`text-[9px] font-mono px-1.5 py-0.5 rounded border shrink-0 ${
                              fac.attitude === 'hostile' || fac.attitude === 'rival'
                                ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                                : fac.attitude === 'allied' || fac.attitude === 'friendly'
                                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                                : 'bg-sky-500/20 text-sky-300 border-sky-500/30'
                            }`}
                          >
                            {fac.attitude || 'neutral'}
                          </span>
                          {fac.territory && (
                            <span className="text-[9px] font-mono text-[#93c5fd]/70 truncate hidden sm:inline">
                              📍 {fac.territory}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <span
                            onClick={(e) => {
                              e.stopPropagation()
                              handleRemoveFaction(idx)
                            }}
                            className="text-red-400 hover:text-red-300 p-1"
                          >
                            <Trash2 size={13} />
                          </span>
                          <ChevronDown
                            size={15}
                            className={`text-sky-300/80 transition-transform ${expanded ? 'rotate-180' : ''}`}
                          />
                        </div>
                      </button>

                      {!expanded && fac.description && (
                        <p className="px-3 pb-2 text-xs font-narrative text-[#93c5fd]/80 line-clamp-1">{fac.description}</p>
                      )}

                      {expanded && (
                        <div className="p-3 pt-0 space-y-2.5 text-xs border-t border-sky-500/20">
                          <div>
                            <label className="block text-[10px] font-mono text-sky-300/80 uppercase mb-1">Name *</label>
                            <input
                              type="text"
                              value={fac.name}
                              onChange={(e) => handleUpdateFaction(idx, { name: e.target.value })}
                              placeholder="e.g. Riders Quadrant, High Senate"
                              className="w-full px-3 py-1.5 rounded-xl bg-[#162a42] border border-sky-500/30 text-sky-100 outline-none"
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[10px] font-mono text-sky-300/80 uppercase mb-1">Attitude</label>
                              <select
                                value={fac.attitude || 'neutral'}
                                onChange={(e) => handleUpdateFaction(idx, { attitude: e.target.value as any })}
                                className="w-full px-2 py-1.5 rounded-xl bg-[#162a42] border border-sky-500/30 text-sky-100 outline-none"
                              >
                                <option value="allied">Allied</option>
                                <option value="friendly">Friendly</option>
                                <option value="neutral">Neutral</option>
                                <option value="rival">Rival</option>
                                <option value="hostile">Hostile</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-[10px] font-mono text-sky-300/80 uppercase mb-1">Territory</label>
                              <input
                                type="text"
                                value={fac.territory || ''}
                                onChange={(e) => handleUpdateFaction(idx, { territory: e.target.value })}
                                placeholder="e.g. Western Spire, Citadel"
                                className="w-full px-2 py-1.5 rounded-xl bg-[#162a42] border border-sky-500/30 text-sky-100 outline-none"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="block text-[10px] font-mono text-sky-300/80 uppercase mb-1">Description</label>
                            <textarea
                              rows={2}
                              value={fac.description || ''}
                              onChange={(e) => handleUpdateFaction(idx, { description: e.target.value })}
                              placeholder="Goals, philosophy, political power, or military strength..."
                              className="w-full px-3 py-1.5 rounded-xl bg-[#162a42] border border-sky-500/30 text-xs font-narrative text-sky-100 outline-none resize-none"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 bg-[#0f2034] border-t border-sky-500/20">
          <button
            onClick={onClose}
            className="px-3.5 sm:px-4 py-2 rounded-xl bg-[#142842] hover:bg-[#1a365a] text-xs font-display font-semibold text-[#93c5fd]"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(data)}
            disabled={!data.name.trim()}
            className="px-4 sm:px-5 py-2 rounded-xl bg-sky-400 hover:bg-sky-300 text-black font-display font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-lg shadow-sky-400/30 disabled:opacity-40"
          >
            <CheckCircle2 size={15} />
            <span>Save Realm</span>
          </button>
        </div>
      </div>
    </div>
  )
}
