import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Bookmark,
  CheckCircle2,
  Edit3,
  Plus,
  Save,
  Search,
  Trash2,
  Users,
  X,
} from 'lucide-react'
import type { SeedCastPack, SeedNpcData } from './types.ts'
import { BUILTIN_CAST_PACKS } from './defaultPacks.ts'

const STORAGE_KEY_CAST_PACKS = 'td_seed_cast_packs_v1'

interface NpcNodeModalProps {
  npcs: SeedNpcData[]
  worldName?: string
  onSave: (npcs: SeedNpcData[]) => void
  onClose: () => void
}

export default function NpcNodeModal({
  npcs: initial,
  worldName,
  onSave,
  onClose,
}: NpcNodeModalProps) {
  const [list, setList] = useState<SeedNpcData[]>([...initial])
  const [editingNpcIdx, setEditingNpcIdx] = useState<number | null>(null)

  // Presets & Packs state
  const [packModalOpen, setPackModalOpen] = useState(false)
  const [savePackModalOpen, setSavePackModalOpen] = useState(false)
  const [packNameDraft, setPackNameDraft] = useState('')
  const [packDescDraft, setPackDescDraft] = useState('')
  const [customPacks, setCustomPacks] = useState<SeedCastPack[]>([])
  const [packSearch, setPackSearch] = useState('')
  const [saveToast, setSaveToast] = useState<string | null>(null)

  // Load custom packs from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_CAST_PACKS)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed)) setCustomPacks(parsed)
      }
    } catch {
      // ignore
    }
  }, [])

  const saveCustomPacksToStorage = (packs: SeedCastPack[]) => {
    setCustomPacks(packs)
    try {
      localStorage.setItem(STORAGE_KEY_CAST_PACKS, JSON.stringify(packs))
    } catch {
      // ignore
    }
  }

  const handleAddNpc = () => {
    const newNpc: SeedNpcData = {
      id: 'npc_' + Date.now(),
      name: 'New Companion',
      role: 'Ally / Companion',
      gender: 'Any',
      attitude: 'friendly',
      affection: 50,
      trust: 50,
      heldWeapon: 'Sidearm Dagger',
      wornArmor: 'Cadet Leathers',
      personality: 'Loyal and watchful under pressure.',
      secret: '',
      description: `A key figure met early in ${worldName || 'the realm'}.`,
    }
    const nextList = [...list, newNpc]
    setList(nextList)
    setEditingNpcIdx(nextList.length - 1)
  }

  const handleRemoveNpc = (idx: number) => {
    setList(list.filter((_, i) => i !== idx))
    if (editingNpcIdx === idx) setEditingNpcIdx(null)
  }

  const handleUpdateNpc = (idx: number, patch: Partial<SeedNpcData>) => {
    const copy = [...list]
    copy[idx] = { ...copy[idx], ...patch }
    setList(copy)
  }

  const handleLoadPack = (pack: SeedCastPack) => {
    setList([...pack.npcs])
    setPackModalOpen(false)
    setSaveToast(`Loaded "${pack.name}" Cast Pack!`)
    setTimeout(() => setSaveToast(null), 2500)
  }

  const handleSaveCurrentPack = () => {
    const name = packNameDraft.trim() || `${worldName || 'Custom'} Party (${list.length})`
    const newPack: SeedCastPack = {
      id: 'custom_pack_' + Date.now(),
      name,
      description: packDescDraft.trim() || `${list.length} characters ready for adventure.`,
      worldTheme: worldName || 'Custom',
      npcs: [...list],
      isCustom: true,
      savedAt: Date.now(),
    }
    const updated = [newPack, ...customPacks]
    saveCustomPacksToStorage(updated)
    setSavePackModalOpen(false)
    setPackNameDraft('')
    setPackDescDraft('')
    setSaveToast(`Saved "${name}" to Cast Presets!`)
    setTimeout(() => setSaveToast(null), 2500)
  }

  const handleDeleteCustomPack = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const updated = customPacks.filter((p) => p.id !== id)
    saveCustomPacksToStorage(updated)
  }

  const allPacks = [...customPacks, ...BUILTIN_CAST_PACKS]
  const filteredPacks = allPacks.filter((p) => {
    if (!packSearch.trim()) return true
    const q = packSearch.toLowerCase()
    return (
      p.name.toLowerCase().includes(q) ||
      p.description.toLowerCase().includes(q) ||
      (p.worldTheme || '').toLowerCase().includes(q)
    )
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl bg-[#091a13] border border-emerald-500/40 shadow-2xl text-[#f5dfa0] overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-[#0d261c] border-b border-emerald-500/20">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-300">
              <Users size={18} />
            </div>
            <div>
              <h2 className="font-display font-bold text-sm sm:text-base text-[#a7f3d0] uppercase tracking-wide">
                Key Cast & NPCs Roster
              </h2>
              <p className="font-narrative text-xs text-[#6ee7b7]/70">
                Companions, rivals, commanders, and starting bonds
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setPackModalOpen(true)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-[#113325] hover:bg-[#184734] border border-emerald-500/30 text-xs font-display font-semibold text-[#a7f3d0] transition-colors"
              title="Load Cast Pack Preset"
            >
              <Bookmark size={13} className="text-emerald-300" />
              <span>Presets</span>
            </button>
            <button
              onClick={() => setSavePackModalOpen(true)}
              disabled={list.length === 0}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/40 text-xs font-display font-semibold text-emerald-200 transition-colors disabled:opacity-40"
              title="Save current cast as a preset pack"
            >
              <Save size={13} />
              <span className="hidden sm:inline">Save Pack</span>
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 text-emerald-300/80">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Save Toast */}
        <AnimatePresence>
          {saveToast && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="bg-emerald-950/90 border-b border-emerald-500/30 px-4 py-1.5 flex items-center gap-2 text-xs font-mono text-emerald-300"
            >
              <CheckCircle2 size={13} className="text-emerald-400 shrink-0" />
              <span>{saveToast}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Action bar */}
        <div className="px-4 py-2 bg-[#0b2017] border-b border-emerald-500/15 flex items-center justify-between">
          <span className="text-xs font-display text-[#6ee7b7]/80">{list.length} Starting Cast Members</span>
          <button
            onClick={handleAddNpc}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/30 text-xs font-display font-semibold text-emerald-200"
          >
            <Plus size={13} /> Add NPC
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-2.5">
          {list.length === 0 ? (
            <div className="text-center py-10 space-y-2">
              <p className="text-xs text-emerald-300/60 font-narrative">No NPCs added yet.</p>
              <button
                onClick={handleAddNpc}
                className="px-3 py-1.5 rounded-xl bg-emerald-500/20 text-emerald-200 text-xs font-display font-semibold border border-emerald-400/30"
              >
                + Add First Character
              </button>
            </div>
          ) : (
            list.map((npc, idx) => (
              <div
                key={npc.id || idx}
                className="p-3 rounded-xl bg-[#0e2a1f] border border-emerald-500/25 space-y-2 transition-all hover:border-emerald-400/50"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className="font-display font-bold text-xs text-emerald-200 truncate">
                      {npc.name || 'Unnamed NPC'}
                    </span>
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shrink-0">
                      {npc.role || 'Ally'}
                    </span>
                    <span
                      className={`text-[9px] font-mono px-1.5 py-0.5 rounded border shrink-0 ${
                        npc.attitude === 'hostile' || npc.attitude === 'rival'
                          ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                          : npc.attitude === 'allied' || npc.attitude === 'friendly'
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                          : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                      }`}
                    >
                      {npc.attitude}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => setEditingNpcIdx(idx)}
                      className="flex items-center gap-1 text-[11px] font-display font-semibold text-emerald-300 hover:text-emerald-200 px-2 py-0.5 rounded bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/30"
                    >
                      <Edit3 size={11} /> Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemoveNpc(idx)}
                      className="text-red-400 hover:text-red-300 p-1"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                {/* Bonds and summary */}
                <div className="flex items-center justify-between text-[10px] font-mono text-emerald-300/80 pt-1 border-t border-emerald-500/15">
                  <span>
                    Affection: <strong className="text-emerald-200">{npc.affection ?? 50}</strong>
                  </span>
                  <span>
                    Trust: <strong className="text-emerald-200">{npc.trust ?? 50}</strong>
                  </span>
                  {npc.heldWeapon && (
                    <span className="truncate max-w-[140px] text-[#d8c49e]/80">🗡️ {npc.heldWeapon}</span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Sub-Editor Modal for NPC */}
        {editingNpcIdx !== null && list[editingNpcIdx] && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-3 bg-black/80 backdrop-blur-sm">
            <div className="w-full max-w-md max-h-[90vh] flex flex-col rounded-2xl bg-[#0c2219] border border-emerald-500/40 text-[#f5dfa0] shadow-2xl overflow-hidden">
              <div className="flex items-center justify-between border-b border-emerald-500/20 px-4 py-2.5 bg-[#0e291e]">
                <h3 className="font-display font-bold text-xs uppercase text-emerald-200 flex items-center gap-1.5">
                  <Edit3 size={13} /> NPC Dossier Editor
                </h3>
                <button onClick={() => setEditingNpcIdx(null)} className="text-emerald-300/80 hover:text-white">
                  <X size={16} />
                </button>
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3 text-xs">
                <div>
                  <label className="block text-[10px] font-mono text-emerald-300/80 uppercase mb-1">Character Name *</label>
                  <input
                    type="text"
                    value={list[editingNpcIdx].name}
                    onChange={(e) => handleUpdateNpc(editingNpcIdx, { name: e.target.value })}
                    placeholder="e.g. Xaden Riorson, Liam Mairi"
                    className="w-full px-3 py-1.5 rounded-xl bg-[#133527] border border-emerald-500/30 text-emerald-100 outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-mono text-emerald-300/80 uppercase mb-1">Role / Station</label>
                    <input
                      type="text"
                      value={list[editingNpcIdx].role || ''}
                      onChange={(e) => handleUpdateNpc(editingNpcIdx, { role: e.target.value })}
                      placeholder="e.g. Wingleader, Cadet, Mentor"
                      className="w-full px-2 py-1.5 rounded-xl bg-[#133527] border border-emerald-500/30 text-emerald-100 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono text-emerald-300/80 uppercase mb-1">Attitude</label>
                    <select
                      value={list[editingNpcIdx].attitude}
                      onChange={(e) => handleUpdateNpc(editingNpcIdx, { attitude: e.target.value as any })}
                      className="w-full px-2 py-1.5 rounded-xl bg-[#133527] border border-emerald-500/30 text-emerald-100 outline-none"
                    >
                      <option value="allied">Allied</option>
                      <option value="friendly">Friendly</option>
                      <option value="neutral">Neutral</option>
                      <option value="rival">Rival</option>
                      <option value="hostile">Hostile</option>
                    </select>
                  </div>
                </div>

                {/* Bonds Sliders */}
                <div className="grid grid-cols-2 gap-3 p-2.5 rounded-xl bg-[#091b13] border border-emerald-500/20">
                  <div>
                    <div className="flex justify-between text-[10px] font-mono text-emerald-300/80 uppercase mb-1">
                      <span>Affection</span>
                      <span className="font-bold text-emerald-200">{list[editingNpcIdx].affection}</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={list[editingNpcIdx].affection}
                      onChange={(e) => handleUpdateNpc(editingNpcIdx, { affection: Number(e.target.value) })}
                      className="w-full accent-emerald-400 h-1.5 bg-emerald-950 rounded cursor-pointer"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between text-[10px] font-mono text-emerald-300/80 uppercase mb-1">
                      <span>Trust</span>
                      <span className="font-bold text-emerald-200">{list[editingNpcIdx].trust}</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={list[editingNpcIdx].trust}
                      onChange={(e) => handleUpdateNpc(editingNpcIdx, { trust: Number(e.target.value) })}
                      className="w-full accent-emerald-400 h-1.5 bg-emerald-950 rounded cursor-pointer"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-mono text-emerald-300/80 uppercase mb-1">Held Weapon</label>
                    <input
                      type="text"
                      value={list[editingNpcIdx].heldWeapon || ''}
                      onChange={(e) => handleUpdateNpc(editingNpcIdx, { heldWeapon: e.target.value })}
                      placeholder="e.g. Broadsword, Daggers"
                      className="w-full px-2 py-1.5 rounded-xl bg-[#133527] border border-emerald-500/30 text-emerald-100 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono text-emerald-300/80 uppercase mb-1">Worn Armor</label>
                    <input
                      type="text"
                      value={list[editingNpcIdx].wornArmor || ''}
                      onChange={(e) => handleUpdateNpc(editingNpcIdx, { wornArmor: e.target.value })}
                      placeholder="e.g. Dragon leathers"
                      className="w-full px-2 py-1.5 rounded-xl bg-[#133527] border border-emerald-500/30 text-emerald-100 outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-mono text-emerald-300/80 uppercase mb-1">Demeanor & Traits</label>
                  <input
                    type="text"
                    value={list[editingNpcIdx].personality || ''}
                    onChange={(e) => handleUpdateNpc(editingNpcIdx, { personality: e.target.value })}
                    placeholder="e.g. Calculating, fiercely protective, cynical..."
                    className="w-full px-3 py-1.5 rounded-xl bg-[#133527] border border-emerald-500/30 text-emerald-100 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-mono text-emerald-300/80 uppercase mb-1">Secret / Narrative Hook</label>
                  <input
                    type="text"
                    value={list[editingNpcIdx].secret || ''}
                    onChange={(e) => handleUpdateNpc(editingNpcIdx, { secret: e.target.value })}
                    placeholder="e.g. Marked leader of the apostate rebellion..."
                    className="w-full px-3 py-1.5 rounded-xl bg-[#133527] border border-emerald-500/30 text-emerald-100 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-mono text-emerald-300/80 uppercase mb-1">Background / Description</label>
                  <textarea
                    rows={2}
                    value={list[editingNpcIdx].description || ''}
                    onChange={(e) => handleUpdateNpc(editingNpcIdx, { description: e.target.value })}
                    placeholder="Role in starting chapter, connection to protagonist..."
                    className="w-full px-3 py-1.5 rounded-xl bg-[#133527] border border-emerald-500/30 text-xs font-narrative text-emerald-100 outline-none resize-none"
                  />
                </div>
              </div>

              <div className="flex justify-end p-3 border-t border-emerald-500/20 bg-[#0e291e]">
                <button
                  type="button"
                  onClick={() => setEditingNpcIdx(null)}
                  className="px-4 py-1.5 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-black font-display font-bold text-xs uppercase"
                >
                  Save Character
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Presets Browser Sub-Modal */}
        {packModalOpen && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-3 bg-black/85 backdrop-blur-md">
            <div className="w-full max-w-lg max-h-[85vh] flex flex-col rounded-2xl bg-[#091a13] border border-emerald-500/50 text-[#f5dfa0] shadow-2xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 bg-[#0d261c] border-b border-emerald-500/20">
                <div className="flex items-center gap-2">
                  <Bookmark size={16} className="text-emerald-300" />
                  <h3 className="font-display font-bold text-sm text-[#a7f3d0] uppercase">Cast Pack Presets</h3>
                </div>
                <button onClick={() => setPackModalOpen(false)} className="text-emerald-300/80 hover:text-white">
                  <X size={16} />
                </button>
              </div>

              <div className="p-3 border-b border-emerald-500/15 bg-[#0b2017]">
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-400/60" />
                  <input
                    type="text"
                    value={packSearch}
                    onChange={(e) => setPackSearch(e.target.value)}
                    placeholder="Search cast packs by name or theme..."
                    className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-[#113325] border border-emerald-500/30 text-xs text-[#a7f3d0] outline-none"
                  />
                </div>
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2">
                {filteredPacks.length === 0 ? (
                  <div className="text-center py-6 text-xs text-emerald-200/60">No matching cast packs found.</div>
                ) : (
                  filteredPacks.map((pack) => (
                    <div
                      key={pack.id}
                      className="p-3 rounded-xl bg-[#0e2a1f] border border-emerald-500/25 hover:border-emerald-400/60 transition-all flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="font-display font-bold text-xs text-emerald-200 flex items-center gap-2">
                          <span>{pack.name}</span>
                          {pack.isCustom && (
                            <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                              Custom
                            </span>
                          )}
                          {pack.worldTheme && (
                            <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                              {pack.worldTheme}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] font-narrative text-[#6ee7b7]/70 line-clamp-1 mt-0.5">
                          {pack.description}
                        </p>
                        <div className="flex items-center gap-2 text-[9px] font-mono text-emerald-300/60 mt-1">
                          <span>👥 {pack.npcs.length} Characters:</span>
                          <span className="truncate">{pack.npcs.map((n) => n.name).join(', ')}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {pack.isCustom && (
                          <button
                            type="button"
                            onClick={(e) => handleDeleteCustomPack(pack.id, e)}
                            className="p-1.5 text-red-400 hover:text-red-300"
                            title="Delete custom pack"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                        <button
                          onClick={() => handleLoadPack(pack)}
                          className="px-3 py-1.5 rounded-lg bg-emerald-400 hover:bg-emerald-300 text-black font-display font-bold text-xs uppercase tracking-wider"
                        >
                          Load
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* Save Pack Modal */}
        {savePackModalOpen && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-3 bg-black/85 backdrop-blur-md">
            <div className="w-full max-w-sm p-4 rounded-2xl bg-[#091a13] border border-emerald-500/50 text-[#f5dfa0] shadow-2xl space-y-3">
              <div className="flex items-center justify-between border-b border-emerald-500/20 pb-2">
                <h3 className="font-display font-bold text-xs uppercase text-emerald-200 flex items-center gap-1.5">
                  <Save size={13} /> Save Cast Preset Pack
                </h3>
                <button onClick={() => setSavePackModalOpen(false)} className="text-emerald-300/80 hover:text-white">
                  <X size={16} />
                </button>
              </div>

              <div className="space-y-2 text-xs">
                <div>
                  <label className="block text-[10px] font-mono text-emerald-300/80 uppercase mb-1">Pack Title *</label>
                  <input
                    type="text"
                    value={packNameDraft}
                    onChange={(e) => setPackNameDraft(e.target.value)}
                    placeholder={`e.g. ${worldName || 'High Fantasy'} Vanguard`}
                    className="w-full px-3 py-1.5 rounded-xl bg-[#113325] border border-emerald-500/30 text-emerald-100 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono text-emerald-300/80 uppercase mb-1">Pack Summary</label>
                  <input
                    type="text"
                    value={packDescDraft}
                    onChange={(e) => setPackDescDraft(e.target.value)}
                    placeholder="e.g. A balanced squad of 3 frontliners and companions."
                    className="w-full px-3 py-1.5 rounded-xl bg-[#113325] border border-emerald-500/30 text-emerald-100 outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-2 border-t border-emerald-500/20">
                <button
                  type="button"
                  onClick={handleSaveCurrentPack}
                  className="px-4 py-1.5 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-black font-display font-bold text-xs uppercase"
                >
                  Save Preset Pack
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 bg-[#0d261c] border-t border-emerald-500/20">
          <button
            onClick={onClose}
            className="px-3.5 sm:px-4 py-2 rounded-xl bg-[#143d2c] hover:bg-[#1a4f39] text-xs font-display font-semibold text-[#6ee7b7]"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(list)}
            disabled={list.length === 0}
            className="px-4 sm:px-5 py-2 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-black font-display font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-lg shadow-emerald-400/30 disabled:opacity-40"
          >
            <CheckCircle2 size={15} />
            <span>Save Cast</span>
          </button>
        </div>
      </motion.div>
    </div>
  )
}
