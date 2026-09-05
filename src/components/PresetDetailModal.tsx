import { useEffect, useState, useRef } from 'react'
import {
  Award,
  BookMarked,
  BookOpen,
  Check,
  Compass,
  Eye,
  Feather,
  Globe,
  Heart,
  Key,
  Layers,
  Pencil,
  Play,
  Scroll,
  Shield,
  Star,
  Swords,
  Target,
  Trash2,
  User,
  UserCircle,
  X,
  Zap,
} from 'lucide-react'
import { PRESET_CLASSES } from '../data/classes.ts'
import { GLASS_SURFACE, GlassIconButton } from '../lib/glassChrome.tsx'
import type { ProtagonistData, WorldData } from '../types.ts'

// ===========================================================================
// WORLD DETAIL MODAL
// ===========================================================================

export interface WorldDetailModalProps {
  world: WorldData
  onClose: () => void
  onLoad?: () => void
  loadLabel?: string
  onUseInStory?: () => void
  onEdit?: () => void
  onDelete?: () => void
  onSetDefault?: () => void
  isDefault?: boolean
}

export function WorldDetailModal({
  world,
  onClose,
  onLoad,
  loadLabel = 'Load World',
  onUseInStory,
  onEdit,
  onDelete,
  onSetDefault,
  isDefault = false,
}: WorldDetailModalProps) {
  const [mobileTab, setMobileTab] = useState<'overview' | 'depth' | 'voice'>('overview')
  const [depthSubTab, setDepthSubTab] = useState<'all' | 'lore' | 'power' | 'factions'>('all')

  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  // Mobile hardware/gesture back-key handler: close modal rather than exiting website
  useEffect(() => {
    const modalId = 'preset_world_' + Date.now()
    window.history.pushState({ modal: modalId }, '')
    let closedByPopState = false

    const handlePopState = () => {
      closedByPopState = true
      onCloseRef.current()
    }

    window.addEventListener('popstate', handlePopState)
    return () => {
      window.removeEventListener('popstate', handlePopState)
      if (!closedByPopState && window.history.state?.modal === modalId) {
        window.history.back()
      }
    }
  }, [])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-3 sm:p-5"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className={`${GLASS_SURFACE} w-full max-w-3xl h-[86dvh] sm:h-auto sm:max-h-[88vh] flex flex-col rounded-2xl border border-[#f0ca65]/40 bg-[#120e1b]/95 shadow-[0_0_35px_rgba(240,202,101,0.2)] text-ink overflow-hidden`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="shrink-0 flex items-start justify-between gap-3 p-4 sm:p-5 border-b border-[#e8ca8a]/20 bg-[#171224]/80">
          <div className="flex items-start gap-3 min-w-0">
            <span className="w-10 h-10 rounded-full border border-[#f0ca65]/60 bg-[#f0ca65]/10 flex items-center justify-center text-[#f0ca65] shrink-0 mt-0.5">
              <Globe size={20} />
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="font-display text-base sm:text-xl font-bold tracking-wide text-[#fae5b5]">
                  {world.name}
                </h2>
                {isDefault && (
                  <span className="rounded bg-[#f0ca65]/20 text-[#f5dfa0] px-2 py-0.5 text-[10px] font-mono border border-[#f0ca65]/30">
                    default world
                  </span>
                )}
                {world.mode === 'inspired' && (
                  <span className="rounded bg-[#e8ca8a]/15 text-[#fae5b5] px-2 py-0.5 text-[10px] font-mono border border-[#e8ca8a]/25">
                    inspired
                  </span>
                )}
              </div>
              <p className="font-narrative italic text-[10px] text-[#d8c49e] mt-1 line-clamp-1">
                {world.sourceTitle ? (
                  <>
                    Adapted from <span className="text-[#f5dfa0]">{world.sourceTitle}</span>
                    {world.sourceAuthor ? ` by ${world.sourceAuthor}` : ''}
                  </>
                ) : (
                  world.genreTone || 'Original World Setting'
                )}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-full p-1.5 text-[#e8ca8a]/70 hover:text-white hover:bg-white/10 transition-colors shrink-0"
          >
            <X size={18} />
          </button>
        </div>

        {/* Mobile Tab Switcher (sm:hidden) */}
        <div className="sm:hidden shrink-0 border-b border-[#e8ca8a]/15 bg-[#171224]/50 px-3 py-2 flex flex-col gap-2">
          <div className="grid grid-cols-3 gap-1 bg-[#120e1b]/80 p-1 rounded-xl border border-[#e8ca8a]/20">
            <button
              type="button"
              onClick={() => setMobileTab('overview')}
              className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-display transition-colors ${
                mobileTab === 'overview'
                  ? 'bg-[#f0ca65]/20 text-[#fae5b5] font-semibold border border-[#f0ca65]/50'
                  : 'text-[#e8ca8a]/70 hover:text-[#fbf4e2]'
              }`}
            >
              <Compass size={13} />
              <span>Overview</span>
            </button>
            <button
              type="button"
              onClick={() => setMobileTab('depth')}
              className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-display transition-colors ${
                mobileTab === 'depth'
                  ? 'bg-[#f0ca65]/20 text-[#fae5b5] font-semibold border border-[#f0ca65]/50'
                  : 'text-[#e8ca8a]/70 hover:text-[#fbf4e2]'
              }`}
            >
              <Layers size={13} />
              <span>Depth</span>
            </button>
            <button
              type="button"
              onClick={() => setMobileTab('voice')}
              className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-display transition-colors ${
                mobileTab === 'voice'
                  ? 'bg-[#f0ca65]/20 text-[#fae5b5] font-semibold border border-[#f0ca65]/50'
                  : 'text-[#e8ca8a]/70 hover:text-[#fbf4e2]'
              }`}
            >
              <Feather size={13} />
              <span>Voice</span>
            </button>
          </div>

          {/* Concise Depth Subtabs below the main tab */}
          {mobileTab === 'depth' && (
            <div className="flex items-center gap-1.5 pt-1 border-t border-[#e8ca8a]/10 overflow-x-auto no-scrollbar">
              <button
                type="button"
                onClick={() => setDepthSubTab('all')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-display flex items-center gap-1 shrink-0 transition-all ${
                  depthSubTab === 'all'
                    ? 'bg-[#f0ca65]/25 text-[#fae5b5] font-semibold border border-[#f0ca65]/60 shadow-[0_0_8px_rgba(240,202,101,0.2)]'
                    : 'bg-[#120e1b]/70 text-[#e8ca8a]/70 hover:text-[#fbf4e2] border border-[#e8ca8a]/15'
                }`}
              >
                <Layers size={11} />
                <span>All</span>
              </button>
              <button
                type="button"
                onClick={() => setDepthSubTab('lore')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-display flex items-center gap-1.5 shrink-0 transition-all ${
                  depthSubTab === 'lore'
                    ? 'bg-[#f0ca65]/25 text-[#fae5b5] font-semibold border border-[#f0ca65]/60 shadow-[0_0_8px_rgba(240,202,101,0.2)]'
                    : 'bg-[#120e1b]/70 text-[#e8ca8a]/70 hover:text-[#fbf4e2] border border-[#e8ca8a]/15'
                }`}
              >
                <Scroll size={11} />
                <span>Lore</span>
              </button>
              <button
                type="button"
                onClick={() => setDepthSubTab('power')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-display flex items-center gap-1.5 shrink-0 transition-all ${
                  depthSubTab === 'power'
                    ? 'bg-[#f0ca65]/25 text-[#fae5b5] font-semibold border border-[#f0ca65]/60 shadow-[0_0_8px_rgba(240,202,101,0.2)]'
                    : 'bg-[#120e1b]/70 text-[#e8ca8a]/70 hover:text-[#fbf4e2] border border-[#e8ca8a]/15'
                }`}
              >
                <Zap size={11} />
                <span>Power</span>
              </button>
              <button
                type="button"
                onClick={() => setDepthSubTab('factions')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-display flex items-center gap-1.5 shrink-0 transition-all ${
                  depthSubTab === 'factions'
                    ? 'bg-[#f0ca65]/25 text-[#fae5b5] font-semibold border border-[#f0ca65]/60 shadow-[0_0_8px_rgba(240,202,101,0.2)]'
                    : 'bg-[#120e1b]/70 text-[#e8ca8a]/70 hover:text-[#fbf4e2] border border-[#e8ca8a]/15'
                }`}
              >
                <Shield size={11} />
                <span>Factions</span>
              </button>
            </div>
          )}
        </div>

        {/* Modal Body */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5">
          {/* Mobile View (Tabbed) */}
          <div className="sm:hidden flex flex-col gap-3">
            {mobileTab === 'overview' && (
              <>
                <div className="bg-[#171224]/60 border border-[#e8ca8a]/20 rounded-xl p-3.5 flex flex-col gap-3">
                  <div className="flex items-center gap-1.5 font-display text-xs font-semibold uppercase tracking-[0.12em] text-[#fae5b5]">
                    <Compass size={14} className="text-[#f0ca65]" />
                    <span>Setting Classification</span>
                  </div>
                  {world.genreTone && (
                    <div>
                      <span className="font-display text-[10px] uppercase tracking-wider text-[#fae5b5] font-semibold block">
                        Genre &amp; Tone
                      </span>
                      <p className="font-sans text-xs text-[#fbf4e2] mt-0.5">{world.genreTone}</p>
                    </div>
                  )}
                  {world.eraTechLevel && (
                    <div>
                      <span className="font-display text-[10px] uppercase tracking-wider text-[#fae5b5] font-semibold block">
                        Era &amp; Tech Level
                      </span>
                      <p className="font-sans text-xs text-[#fbf4e2] mt-0.5">{world.eraTechLevel}</p>
                    </div>
                  )}
                  {world.sourceTitle && (
                    <div className="pt-2 border-t border-[#e8ca8a]/15">
                      <span className="font-display text-[10px] uppercase tracking-wider text-[#fae5b5] font-semibold block flex items-center gap-1">
                        <BookMarked size={11} className="text-[#f0ca65]" />
                        Source Material
                      </span>
                      <p className="font-sans text-xs text-[#fbf4e2] mt-0.5">
                        {world.sourceTitle} {world.sourceAuthor ? `by ${world.sourceAuthor}` : ''}
                      </p>
                    </div>
                  )}
                </div>

                {world.conflict && (
                  <div className="bg-[#171224]/60 border border-[#e8ca8a]/20 rounded-xl p-3.5 flex flex-col gap-2">
                    <div className="flex items-center gap-1.5 font-display text-xs font-semibold uppercase tracking-[0.12em] text-[#fae5b5]">
                      <Swords size={14} className="text-[#f0ca65]" />
                      <span>Core Conflict &amp; Stakes</span>
                    </div>
                    <p className="font-narrative text-xs text-[#fbf4e2] leading-relaxed whitespace-pre-wrap">{world.conflict}</p>
                  </div>
                )}
              </>
            )}

            {mobileTab === 'depth' && (
              <>
                {(depthSubTab === 'all' || depthSubTab === 'lore') && (
                  world.background ? (
                    <div className="bg-[#171224]/60 border border-[#e8ca8a]/20 rounded-xl p-3.5 flex flex-col gap-2">
                      <div className="flex items-center gap-1.5 font-display text-xs font-semibold uppercase tracking-[0.12em] text-[#fae5b5]">
                        <Scroll size={14} className="text-[#f0ca65]" />
                        <span>Background Lore &amp; History</span>
                      </div>
                      <p className="font-narrative text-xs text-[#fbf4e2] leading-relaxed whitespace-pre-wrap">{world.background}</p>
                    </div>
                  ) : depthSubTab === 'lore' ? (
                    <div className="bg-[#171224]/40 border border-[#e8ca8a]/15 rounded-xl p-4 text-center">
                      <p className="font-narrative italic text-xs text-[#e8ca8a]/60">No background lore or history recorded for this setting.</p>
                    </div>
                  ) : null
                )}

                {(depthSubTab === 'all' || depthSubTab === 'power') && (
                  world.powerSystem ? (
                    <div className="bg-[#171224]/60 border border-[#e8ca8a]/20 rounded-xl p-3.5 flex flex-col gap-2">
                      <div className="flex items-center gap-1.5 font-display text-xs font-semibold uppercase tracking-[0.12em] text-[#fae5b5]">
                        <Zap size={14} className="text-[#f0ca65]" />
                        <span>Power &amp; Magic System</span>
                      </div>
                      <p className="font-narrative text-xs text-[#fbf4e2] leading-relaxed whitespace-pre-wrap">{world.powerSystem}</p>
                    </div>
                  ) : depthSubTab === 'power' ? (
                    <div className="bg-[#171224]/40 border border-[#e8ca8a]/15 rounded-xl p-4 text-center">
                      <p className="font-narrative italic text-xs text-[#e8ca8a]/60">No magic or power system rules specified for this world.</p>
                    </div>
                  ) : null
                )}

                {(depthSubTab === 'all' || depthSubTab === 'factions') && (
                  world.keyFactions ? (
                    <div className="bg-[#171224]/60 border border-[#e8ca8a]/20 rounded-xl p-3.5 flex flex-col gap-2">
                      <div className="flex items-center gap-1.5 font-display text-xs font-semibold uppercase tracking-[0.12em] text-[#fae5b5]">
                        <Shield size={14} className="text-[#f0ca65]" />
                        <span>Key Factions &amp; Powers</span>
                      </div>
                      <p className="font-narrative text-xs text-[#fbf4e2] leading-relaxed whitespace-pre-wrap">{world.keyFactions}</p>
                    </div>
                  ) : depthSubTab === 'factions' ? (
                    <div className="bg-[#171224]/40 border border-[#e8ca8a]/15 rounded-xl p-4 text-center">
                      <p className="font-narrative italic text-xs text-[#e8ca8a]/60">No regional factions or political powers recorded.</p>
                    </div>
                  ) : null
                )}

                {depthSubTab === 'all' && !world.background && !world.powerSystem && !world.keyFactions && (
                  <div className="bg-[#171224]/40 border border-[#e8ca8a]/15 rounded-xl p-4 text-center">
                    <p className="font-narrative italic text-xs text-[#e8ca8a]/60">No depth or lore entries defined for this world.</p>
                  </div>
                )}
              </>
            )}

            {mobileTab === 'voice' && (
              <>
                {world.narrationStyle ? (
                  <div className="bg-[#171224]/60 border border-[#e8ca8a]/20 rounded-xl p-3.5 flex flex-col gap-2">
                    <div className="flex items-center gap-1.5 font-display text-xs font-semibold uppercase tracking-[0.12em] text-[#fae5b5]">
                      <Feather size={14} className="text-[#f0ca65]" />
                      <span>Narration Style &amp; Directives</span>
                    </div>
                    <p className="font-narrative text-xs text-[#fbf4e2] leading-relaxed whitespace-pre-wrap">{world.narrationStyle}</p>
                  </div>
                ) : (
                  <div className="text-center py-6 text-xs text-[#e8ca8a]/60 italic font-narrative">
                    Standard narrator tone applied for this world.
                  </div>
                )}
              </>
            )}
          </div>

          {/* PC / Tablet Multi-Column Layout (sm:grid) */}
          <div className="hidden sm:grid sm:grid-cols-12 gap-4">
            {/* Left Column (5 cols) */}
            <div className="sm:col-span-5 flex flex-col gap-3.5">
              {/* Classification Card */}
              <div className="bg-[#171224]/70 border border-[#e8ca8a]/25 rounded-xl p-4 flex flex-col gap-3">
                <div className="flex items-center gap-2 pb-2 border-b border-[#e8ca8a]/15">
                  <Compass size={16} className="text-[#f0ca65]" />
                  <span className="font-display text-xs font-semibold uppercase tracking-[0.12em] text-[#fae5b5]">
                    Setting &amp; Systems
                  </span>
                </div>

                {world.genreTone && (
                  <div>
                    <span className="font-display text-[10px] uppercase tracking-wider text-[#fae5b5] font-semibold block">
                      Genre &amp; Tone
                    </span>
                    <p className="font-sans text-xs text-[#fbf4e2] mt-0.5 leading-relaxed">{world.genreTone}</p>
                  </div>
                )}

                {world.eraTechLevel && (
                  <div>
                    <span className="font-display text-[10px] uppercase tracking-wider text-[#fae5b5] font-semibold block">
                      Era &amp; Tech Level
                    </span>
                    <p className="font-sans text-xs text-[#fbf4e2] mt-0.5 leading-relaxed">{world.eraTechLevel}</p>
                  </div>
                )}

                {world.powerSystem && (
                  <div>
                    <span className="font-display text-[10px] uppercase tracking-wider text-[#fae5b5] font-semibold block flex items-center gap-1">
                      <Zap size={11} className="text-[#f0ca65]" />
                      Power System
                    </span>
                    <p className="font-sans text-xs text-[#fbf4e2] mt-0.5 leading-relaxed">{world.powerSystem}</p>
                  </div>
                )}

                {world.keyFactions && (
                  <div>
                    <span className="font-display text-[10px] uppercase tracking-wider text-[#fae5b5] font-semibold block flex items-center gap-1">
                      <Shield size={11} className="text-[#f0ca65]" />
                      Key Factions
                    </span>
                    <p className="font-sans text-xs text-[#fbf4e2] mt-0.5 leading-relaxed">{world.keyFactions}</p>
                  </div>
                )}
              </div>

              {/* Attribution Card (if adapted) */}
              {world.sourceTitle && (
                <div className="bg-[#171224]/70 border border-[#e8ca8a]/25 rounded-xl p-3.5 flex flex-col gap-1.5">
                  <div className="flex items-center gap-1.5 text-[#f0ca65]">
                    <BookMarked size={14} />
                    <span className="font-display text-[11px] font-semibold uppercase tracking-wider text-[#fae5b5]">Source Material</span>
                  </div>
                  <p className="font-sans text-xs text-[#fbf4e2] mt-0.5 leading-relaxed">
                    Adapted from <span className="text-[#f5dfa0] font-medium">{world.sourceTitle}</span>
                    {world.sourceAuthor ? ` by ${world.sourceAuthor}` : ''}
                  </p>
                </div>
              )}
            </div>

            {/* Right Column (7 cols) */}
            <div className="sm:col-span-7 flex flex-col gap-3.5">
              {/* Conflict Card */}
              {world.conflict && (
                <div className="bg-[#171224]/70 border border-[#e8ca8a]/25 rounded-xl p-4 flex flex-col gap-2">
                  <div className="flex items-center gap-2 pb-2 border-b border-[#e8ca8a]/15">
                    <Swords size={16} className="text-[#f0ca65]" />
                    <span className="font-display text-xs font-semibold uppercase tracking-[0.12em] text-[#fae5b5]">
                      Core Conflict &amp; Stakes
                    </span>
                  </div>
                  <p className="font-narrative text-xs text-[#fbf4e2] leading-relaxed whitespace-pre-wrap">{world.conflict}</p>
                </div>
              )}

              {/* Background Card */}
              {world.background && (
                <div className="bg-[#171224]/70 border border-[#e8ca8a]/25 rounded-xl p-4 flex flex-col gap-2">
                  <div className="flex items-center gap-2 pb-2 border-b border-[#e8ca8a]/15">
                    <Scroll size={16} className="text-[#f0ca65]" />
                    <span className="font-display text-xs font-semibold uppercase tracking-[0.12em] text-[#fae5b5]">
                      Background Lore &amp; History
                    </span>
                  </div>
                  <p className="font-narrative text-xs text-[#fbf4e2] leading-relaxed whitespace-pre-wrap">{world.background}</p>
                </div>
              )}

              {/* Narration Style Card */}
              {world.narrationStyle && (
                <div className="bg-[#171224]/70 border border-[#e8ca8a]/25 rounded-xl p-4 flex flex-col gap-2">
                  <div className="flex items-center gap-2 pb-2 border-b border-[#e8ca8a]/15">
                    <Feather size={16} className="text-[#f0ca65]" />
                    <span className="font-display text-xs font-semibold uppercase tracking-[0.12em] text-[#fae5b5]">
                      Narration Voice &amp; Directives
                    </span>
                  </div>
                  <p className="font-narrative text-xs text-[#fbf4e2] leading-relaxed whitespace-pre-wrap">{world.narrationStyle}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="shrink-0 flex items-center justify-between gap-3 p-3.5 sm:p-4 border-t border-[#e8ca8a]/20 bg-[#171224]/80">
          <div className="flex items-center gap-2 sm:gap-2.5">
            {onSetDefault && !isDefault && (
              <GlassIconButton
                icon={Star}
                label="Set as Default World"
                onClick={onSetDefault}
                className="text-[#f0ca65] hover:text-[#fae5b5]"
              />
            )}
            {onEdit && (
              <GlassIconButton
                icon={Pencil}
                label="Edit World"
                onClick={onEdit}
              />
            )}
            {onDelete && (
              <GlassIconButton
                icon={Trash2}
                label="Delete World"
                tone="danger"
                onClick={onDelete}
              />
            )}
          </div>

          <div className="flex items-center gap-2 sm:gap-2.5">
            <GlassIconButton
              icon={X}
              label="Close"
              onClick={onClose}
            />
            {onLoad && (
              <GlassIconButton
                icon={Check}
                label={loadLabel}
                tone="action"
                onClick={() => {
                  onLoad()
                  onClose()
                }}
              />
            )}
            {onUseInStory && (
              <GlassIconButton
                icon={Play}
                label="New Story Here"
                tone="action"
                onClick={() => {
                  onUseInStory()
                  onClose()
                }}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ===========================================================================
// PROTAGONIST DETAIL MODAL
// ===========================================================================

export interface ProtagonistDetailModalProps {
  protagonist: ProtagonistData
  onClose: () => void
  onLoad?: () => void
  loadLabel?: string
  onUseInStory?: () => void
  onEdit?: () => void
  onDelete?: () => void
  onSetDefault?: () => void
  isDefault?: boolean
}

export function ProtagonistDetailModal({
  protagonist,
  onClose,
  onLoad,
  loadLabel = 'Load Protagonist',
  onUseInStory,
  onEdit,
  onDelete,
  onSetDefault,
  isDefault = false,
}: ProtagonistDetailModalProps) {
  const [mobileTab, setMobileTab] = useState<'profile' | 'hooks' | 'origin'>('profile')

  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  // Mobile hardware/gesture back-key handler: close modal rather than exiting website
  useEffect(() => {
    const modalId = 'preset_protag_' + Date.now()
    window.history.pushState({ modal: modalId }, '')
    let closedByPopState = false

    const handlePopState = () => {
      closedByPopState = true
      onCloseRef.current()
    }

    window.addEventListener('popstate', handlePopState)
    return () => {
      window.removeEventListener('popstate', handlePopState)
      if (!closedByPopState && window.history.state?.modal === modalId) {
        window.history.back()
      }
    }
  }, [])

  const className =
    protagonist.className ||
    PRESET_CLASSES.find((c) => c.id === protagonist.classId)?.name ||
    protagonist.classId

  const demographics = [
    className,
    protagonist.gender,
    protagonist.age !== undefined ? `Age ${protagonist.age}` : null,
  ]
    .filter(Boolean)
    .join(' • ')

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-3 sm:p-5"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className={`${GLASS_SURFACE} w-full max-w-3xl h-[86dvh] sm:h-auto sm:max-h-[88vh] flex flex-col rounded-2xl border border-[#f0ca65]/40 bg-[#120e1b]/95 shadow-[0_0_35px_rgba(240,202,101,0.2)] text-ink overflow-hidden`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="shrink-0 flex items-start justify-between gap-3 p-4 sm:p-5 border-b border-[#e8ca8a]/20 bg-[#171224]/80">
          <div className="flex items-start gap-3 min-w-0">
            <span className="w-10 h-10 rounded-full border border-[#f0ca65]/60 bg-[#f0ca65]/10 flex items-center justify-center text-[#f0ca65] shrink-0 mt-0.5">
              <UserCircle size={22} />
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="font-display text-base sm:text-xl font-bold tracking-wide text-[#fae5b5]">
                  {protagonist.name}
                </h2>
                {isDefault && (
                  <span className="rounded bg-[#f0ca65]/20 text-[#f5dfa0] px-2 py-0.5 text-[10px] font-mono border border-[#f0ca65]/30">
                    default protagonist
                  </span>
                )}
                {className && (
                  <span className="rounded bg-[#e8ca8a]/15 text-[#fae5b5] px-2 py-0.5 text-[10px] font-mono border border-[#e8ca8a]/25">
                    {className}
                  </span>
                )}
              </div>
              <p className="font-narrative italic text-[10px] text-[#d8c49e] mt-1 line-clamp-1">
                {demographics || 'Adventurer'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-full p-1.5 text-[#e8ca8a]/70 hover:text-white hover:bg-white/10 transition-colors shrink-0"
          >
            <X size={18} />
          </button>
        </div>

        {/* Mobile Tab Switcher (sm:hidden) */}
        <div className="sm:hidden shrink-0 border-b border-[#e8ca8a]/15 bg-[#171224]/50 px-3 py-2">
          <div className="grid grid-cols-3 gap-1 bg-[#120e1b]/80 p-1 rounded-xl border border-[#e8ca8a]/20">
            <button
              type="button"
              onClick={() => setMobileTab('profile')}
              className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-display transition-colors ${
                mobileTab === 'profile'
                  ? 'bg-[#f0ca65]/20 text-[#fae5b5] font-semibold border border-[#f0ca65]/50'
                  : 'text-[#e8ca8a]/70 hover:text-[#fbf4e2]'
              }`}
            >
              <User size={13} />
              <span>Profile</span>
            </button>
            <button
              type="button"
              onClick={() => setMobileTab('hooks')}
              className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-display transition-colors ${
                mobileTab === 'hooks'
                  ? 'bg-[#f0ca65]/20 text-[#fae5b5] font-semibold border border-[#f0ca65]/50'
                  : 'text-[#e8ca8a]/70 hover:text-[#fbf4e2]'
              }`}
            >
              <Target size={13} />
              <span>Drive</span>
            </button>
            <button
              type="button"
              onClick={() => setMobileTab('origin')}
              className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-display transition-colors ${
                mobileTab === 'origin'
                  ? 'bg-[#f0ca65]/20 text-[#fae5b5] font-semibold border border-[#f0ca65]/50'
                  : 'text-[#e8ca8a]/70 hover:text-[#fbf4e2]'
              }`}
            >
              <Scroll size={13} />
              <span>Origin</span>
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5">
          {/* Mobile View (Tabbed) */}
          <div className="sm:hidden flex flex-col gap-3">
            {mobileTab === 'profile' && (
              <div className="bg-[#171224]/60 border border-[#e8ca8a]/20 rounded-xl p-3.5 flex flex-col gap-3">
                <div className="flex items-center gap-1.5 font-display text-xs font-semibold uppercase tracking-[0.12em] text-[#fae5b5]">
                  <Award size={14} className="text-[#f0ca65]" />
                  <span>Attributes &amp; Physical Traits</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="font-display text-[10px] uppercase tracking-wider text-[#fae5b5] font-semibold block">
                      Class
                    </span>
                    <p className="font-sans text-xs text-[#fbf4e2] mt-0.5">{className}</p>
                  </div>
                  <div>
                    <span className="font-display text-[10px] uppercase tracking-wider text-[#fae5b5] font-semibold block">
                      Age &amp; Gender
                    </span>
                    <p className="font-sans text-xs text-[#fbf4e2] mt-0.5">
                      {[protagonist.gender, protagonist.age !== undefined ? `Age ${protagonist.age}` : null]
                        .filter(Boolean)
                        .join(', ') || '—'}
                    </p>
                  </div>
                </div>
                {protagonist.physicalTrait && (
                  <div className="pt-2 border-t border-[#e8ca8a]/15">
                    <span className="font-display text-[10px] uppercase tracking-wider text-[#fae5b5] font-semibold block flex items-center gap-1">
                      <Eye size={11} className="text-[#f0ca65]" />
                      Physical Trait / Distinguishing Feature
                    </span>
                    <p className="font-sans text-xs text-[#fbf4e2] mt-0.5 leading-relaxed">{protagonist.physicalTrait}</p>
                  </div>
                )}
              </div>
            )}

            {mobileTab === 'hooks' && (
              <div className="flex flex-col gap-3">
                {protagonist.personality && (
                  <div className="bg-[#171224]/60 border border-[#e8ca8a]/20 rounded-xl p-3.5 flex flex-col gap-1.5">
                    <div className="flex items-center gap-1.5 font-display text-xs font-semibold uppercase tracking-[0.12em] text-[#fae5b5]">
                      <Heart size={14} className="text-[#f0ca65]" />
                      <span>Personality &amp; Demeanor</span>
                    </div>
                    <p className="font-narrative text-xs text-[#fbf4e2] mt-0.5 leading-relaxed">{protagonist.personality}</p>
                  </div>
                )}
                {protagonist.motivation && (
                  <div className="bg-[#171224]/60 border border-[#e8ca8a]/20 rounded-xl p-3.5 flex flex-col gap-1.5">
                    <div className="flex items-center gap-1.5 font-display text-xs font-semibold uppercase tracking-[0.12em] text-[#fae5b5]">
                      <Target size={14} className="text-[#f0ca65]" />
                      <span>Core Motivation &amp; Want</span>
                    </div>
                    <p className="font-narrative text-xs text-[#fbf4e2] mt-0.5 leading-relaxed">{protagonist.motivation}</p>
                  </div>
                )}
                {protagonist.secret && (
                  <div className="bg-[#171224]/60 border border-amber-400/30 rounded-xl p-3.5 flex flex-col gap-1.5">
                    <div className="flex items-center gap-1.5 font-display text-xs font-semibold uppercase tracking-[0.12em] text-[#f5dfa0]">
                      <Key size={14} className="text-amber-400" />
                      <span>Concealed Secret / Plot Hook</span>
                    </div>
                    <p className="font-narrative text-xs text-[#fbf4e2] mt-0.5 leading-relaxed">{protagonist.secret}</p>
                  </div>
                )}
              </div>
            )}

            {mobileTab === 'origin' && (
              <div className="flex flex-col gap-3">
                {protagonist.background && (
                  <div className="bg-[#171224]/60 border border-[#e8ca8a]/20 rounded-xl p-3.5 flex flex-col gap-2">
                    <div className="flex items-center gap-1.5 font-display text-xs font-semibold uppercase tracking-[0.12em] text-[#fae5b5]">
                      <BookOpen size={14} className="text-[#f0ca65]" />
                      <span>Background &amp; History</span>
                    </div>
                    <p className="font-narrative text-xs text-[#fbf4e2] leading-relaxed whitespace-pre-wrap">{protagonist.background}</p>
                  </div>
                )}
                {protagonist.opening && (
                  <div className="bg-[#171224]/60 border border-[#f0ca65]/30 rounded-xl p-3.5 flex flex-col gap-2">
                    <div className="flex items-center gap-1.5 font-display text-xs font-semibold uppercase tracking-[0.12em] text-[#fae5b5]">
                      <Compass size={14} className="text-[#f0ca65]" />
                      <span>Turn 1 Opening Scene Brief</span>
                    </div>
                    <p className="font-narrative text-xs text-[#fbf4e2] leading-relaxed whitespace-pre-wrap">{protagonist.opening}</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* PC / Tablet Multi-Column Layout (sm:grid) */}
          <div className="hidden sm:grid sm:grid-cols-12 gap-4">
            {/* Left Column (5 cols) */}
            <div className="sm:col-span-5 flex flex-col gap-3.5">
              {/* Identity Card */}
              <div className="bg-[#171224]/70 border border-[#e8ca8a]/25 rounded-xl p-4 flex flex-col gap-3">
                <div className="flex items-center gap-2 pb-2 border-b border-[#e8ca8a]/15">
                  <Award size={16} className="text-[#f0ca65]" />
                  <span className="font-display text-xs font-semibold uppercase tracking-[0.12em] text-[#fae5b5]">
                    Class &amp; Identity
                  </span>
                </div>

                <div>
                  <span className="font-display text-[10px] uppercase tracking-wider text-[#fae5b5] font-semibold block">
                    Starting Class
                  </span>
                  <p className="font-sans text-xs text-[#fbf4e2] mt-0.5 leading-relaxed font-medium text-[#f5dfa0]">{className}</p>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="font-display text-[10px] uppercase tracking-wider text-[#fae5b5] font-semibold block">
                      Gender
                    </span>
                    <p className="font-sans text-xs text-[#fbf4e2] mt-0.5">{protagonist.gender || '—'}</p>
                  </div>
                  <div>
                    <span className="font-display text-[10px] uppercase tracking-wider text-[#fae5b5] font-semibold block">
                      Age
                    </span>
                    <p className="font-sans text-xs text-[#fbf4e2] mt-0.5">
                      {protagonist.age !== undefined ? protagonist.age : '—'}
                    </p>
                  </div>
                </div>

                {protagonist.physicalTrait && (
                  <div>
                    <span className="font-display text-[10px] uppercase tracking-wider text-[#fae5b5] font-semibold block flex items-center gap-1">
                      <Eye size={11} className="text-[#f0ca65]" />
                      Physical Trait
                    </span>
                    <p className="font-sans text-xs text-[#fbf4e2] mt-0.5 leading-relaxed">{protagonist.physicalTrait}</p>
                  </div>
                )}
              </div>

              {/* Persona & Secret Card */}
              <div className="bg-[#171224]/70 border border-[#e8ca8a]/25 rounded-xl p-4 flex flex-col gap-3">
                <div className="flex items-center gap-2 pb-2 border-b border-[#e8ca8a]/15">
                  <Target size={16} className="text-[#f0ca65]" />
                  <span className="font-display text-xs font-semibold uppercase tracking-[0.12em] text-[#fae5b5]">
                    Demeanor &amp; Motive
                  </span>
                </div>

                {protagonist.personality && (
                  <div>
                    <span className="font-display text-[10px] uppercase tracking-wider text-[#fae5b5] font-semibold block flex items-center gap-1">
                      <Heart size={11} className="text-[#f0ca65]" />
                      Personality
                    </span>
                    <p className="font-sans text-xs text-[#fbf4e2] mt-0.5 leading-relaxed">{protagonist.personality}</p>
                  </div>
                )}

                {protagonist.motivation && (
                  <div>
                    <span className="font-display text-[10px] uppercase tracking-wider text-[#fae5b5] font-semibold block flex items-center gap-1">
                      <Target size={11} className="text-[#f0ca65]" />
                      Core Motivation
                    </span>
                    <p className="font-sans text-xs text-[#fbf4e2] mt-0.5 leading-relaxed">{protagonist.motivation}</p>
                  </div>
                )}

                {protagonist.secret && (
                  <div className="p-2.5 rounded-lg bg-[#e8ca8a]/[0.05] border border-amber-400/30">
                    <span className="font-display text-[10px] uppercase tracking-wider text-amber-300 font-semibold block flex items-center gap-1">
                      <Key size={11} className="text-amber-400" />
                      Concealed Secret
                    </span>
                    <p className="font-narrative text-xs text-[#fbf4e2] mt-0.5 leading-relaxed">{protagonist.secret}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Right Column (7 cols) */}
            <div className="sm:col-span-7 flex flex-col gap-3.5">
              {/* Background Card */}
              {protagonist.background && (
                <div className="bg-[#171224]/70 border border-[#e8ca8a]/25 rounded-xl p-4 flex flex-col gap-2">
                  <div className="flex items-center gap-2 pb-2 border-b border-[#e8ca8a]/15">
                    <BookOpen size={16} className="text-[#f0ca65]" />
                    <span className="font-display text-xs font-semibold uppercase tracking-[0.12em] text-[#fae5b5]">
                      Background &amp; Origin
                    </span>
                  </div>
                  <p className="font-narrative text-xs text-[#fbf4e2] leading-relaxed whitespace-pre-wrap">{protagonist.background}</p>
                </div>
              )}

              {/* Turn 1 Opening Scene Brief */}
              {protagonist.opening && (
                <div className="bg-[#171224]/70 border border-[#f0ca65]/35 rounded-xl p-4 flex flex-col gap-2">
                  <div className="flex items-center gap-2 pb-2 border-b border-[#e8ca8a]/15">
                    <Compass size={16} className="text-[#f0ca65]" />
                    <span className="font-display text-xs font-semibold uppercase tracking-[0.12em] text-[#fae5b5]">
                      Turn 1 Opening Scene Brief
                    </span>
                  </div>
                  <p className="font-narrative text-xs text-[#fbf4e2] leading-relaxed whitespace-pre-wrap">{protagonist.opening}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="shrink-0 flex items-center justify-between gap-3 p-3.5 sm:p-4 border-t border-[#e8ca8a]/20 bg-[#171224]/80">
          <div className="flex items-center gap-2 sm:gap-2.5">
            {onSetDefault && !isDefault && (
              <GlassIconButton
                icon={Star}
                label="Set as Default Protagonist"
                onClick={onSetDefault}
                className="text-[#f0ca65] hover:text-[#fae5b5]"
              />
            )}
            {onEdit && (
              <GlassIconButton
                icon={Pencil}
                label="Edit Protagonist"
                onClick={onEdit}
              />
            )}
            {onDelete && (
              <GlassIconButton
                icon={Trash2}
                label="Delete Protagonist"
                tone="danger"
                onClick={onDelete}
              />
            )}
          </div>

          <div className="flex items-center gap-2 sm:gap-2.5">
            <GlassIconButton
              icon={X}
              label="Close"
              onClick={onClose}
            />
            {onLoad && (
              <GlassIconButton
                icon={Check}
                label={loadLabel}
                tone="action"
                onClick={() => {
                  onLoad()
                  onClose()
                }}
              />
            )}
            {onUseInStory && (
              <GlassIconButton
                icon={Play}
                label="Play Protagonist"
                tone="action"
                onClick={() => {
                  onUseInStory()
                  onClose()
                }}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
