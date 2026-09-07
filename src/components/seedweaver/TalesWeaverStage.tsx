import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  User,
  Globe,
  Users,
  BookOpen,
  Lock,
  CheckCircle2,
  ChevronRight,
  X,
  Scaling,
} from 'lucide-react'
import type { ProtagonistData, WorldData } from '../../types.ts'
import type { NodeType, SeedNpcData } from './types.ts'
import type { CoverRect } from './useObjectCoverRect.ts'
import type { WeaverCalibrationPreset } from './calibrationData.ts'
import { GlassCTAButton } from '../../lib/glassChrome.tsx'

interface TalesWeaverStageProps {
  isDesktop: boolean
  bgRect: CoverRect
  protagonist: ProtagonistData
  world: WorldData
  npcs: SeedNpcData[]
  narrative: {
    title: string
    opening: string
    narrationStyle: string
  }
  canUnlockNarrative: boolean
  setActiveModal: (modal: NodeType | null) => void
  onIgniteDive: () => void
  calibration: WeaverCalibrationPreset
  isCalibrating?: boolean
  selectedCalibNode?: NodeType
  onSelectCalibNode?: (node: NodeType) => void
  onUpdateNodeCalibration?: (
    node: NodeType,
    updated: { left: number; top: number; diameter: number }
  ) => void
}

export default function TalesWeaverStage({
  isDesktop,
  bgRect,
  protagonist,
  world,
  npcs,
  narrative,
  canUnlockNarrative,
  setActiveModal,
  onIgniteDive,
  calibration,
  isCalibrating = false,
  selectedCalibNode,
  onSelectCalibNode,
  onUpdateNodeCalibration,
}: TalesWeaverStageProps) {
  const [activePopup, setActivePopup] = useState<NodeType | null>(null)
  const [hoveredNode, setHoveredNode] = useState<NodeType | null>(null)

  const handleCircleClick = (node: NodeType) => {
    if (isCalibrating) {
      onSelectCalibNode?.(node)
      return
    }
    if (activePopup === node) {
      if (node === 'narrative' && !canUnlockNarrative) return
      setActivePopup(null)
      setActiveModal(node)
    } else {
      setActivePopup(node)
    }
  }

  const handleOpenModal = (node: NodeType) => {
    if (node === 'narrative' && !canUnlockNarrative) return
    setActivePopup(null)
    setActiveModal(node)
  }

  // Pointer drag handler to move circles directly when calibrating
  const handleCirclePointerDown = (node: NodeType, e: React.PointerEvent) => {
    if (!isCalibrating) return
    e.preventDefault()
    e.stopPropagation()
    onSelectCalibNode?.(node)

    const startX = e.clientX
    const startY = e.clientY
    const startLeft = calibration[node].left
    const startTop = calibration[node].top

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const deltaX = moveEvent.clientX - startX
      const deltaY = moveEvent.clientY - startY
      const deltaLeftPercent = (deltaX / bgRect.width) * 100
      const deltaTopPercent = (deltaY / bgRect.height) * 100

      const nextLeft = Math.max(
        0,
        Math.min(100, Math.round((startLeft + deltaLeftPercent) * 10) / 10)
      )
      const nextTop = Math.max(
        0,
        Math.min(100, Math.round((startTop + deltaTopPercent) * 10) / 10)
      )

      onUpdateNodeCalibration?.(node, {
        ...calibration[node],
        left: nextLeft,
        top: nextTop,
      })
    }

    const handlePointerUp = () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
  }

  // Pointer drag handler to resize diameter directly when calibrating
  const handleResizePointerDown = (node: NodeType, e: React.PointerEvent) => {
    if (!isCalibrating) return
    e.preventDefault()
    e.stopPropagation()
    onSelectCalibNode?.(node)

    const startX = e.clientX
    const startDiameter = calibration[node].diameter

    const handleResizeMove = (moveEvent: PointerEvent) => {
      const deltaX = moveEvent.clientX - startX
      const deltaDiameterPercent = (deltaX / bgRect.width) * 200
      const nextDiameter = Math.max(
        5,
        Math.min(65, Math.round((startDiameter + deltaDiameterPercent) * 10) / 10)
      )

      onUpdateNodeCalibration?.(node, {
        ...calibration[node],
        diameter: nextDiameter,
      })
    }

    const handleResizeUp = () => {
      window.removeEventListener('pointermove', handleResizeMove)
      window.removeEventListener('pointerup', handleResizeUp)
    }

    window.addEventListener('pointermove', handleResizeMove)
    window.addEventListener('pointerup', handleResizeUp)
  }

  // Node position & size definitions driven directly by calibration props
  const nodeConfigs = {
    protagonist: {
      left: `${calibration.protagonist.left}%`,
      top: `${calibration.protagonist.top}%`,
      diameter: bgRect.width * (calibration.protagonist.diameter / 100),
      color: 'purple',
      title: 'PROTAGONIST',
      name: protagonist.name || 'Unnamed Hero',
      detail: `${protagonist.className || 'Adventurer'} • ${protagonist.gender || 'Hero'}`,
      icon: User,
    },
    world: {
      left: `${calibration.world.left}%`,
      top: `${calibration.world.top}%`,
      diameter: bgRect.width * (calibration.world.diameter / 100),
      color: 'sky',
      title: 'WORLD',
      name: world.name || 'Custom Realm',
      detail: world.genreTone ? `Tone: ${world.genreTone}` : 'Fantasy World',
      icon: Globe,
    },
    npcs: {
      left: `${calibration.npcs.left}%`,
      top: `${calibration.npcs.top}%`,
      diameter: bgRect.width * (calibration.npcs.diameter / 100),
      color: 'emerald',
      title: 'NPCS',
      name: `${npcs.length} Key Cast`,
      detail: npcs.map((n) => n.name).slice(0, 3).join(', ') || 'Cast & Bonds Ready',
      icon: Users,
    },
    narrative: {
      left: `${calibration.narrative.left}%`,
      top: `${calibration.narrative.top}%`,
      diameter: bgRect.width * (calibration.narrative.diameter / 100),
      color: 'amber',
      title: 'NARRATIVE',
      name: narrative.title || 'Prologue & Dive',
      detail: canUnlockNarrative
        ? 'Ready to author & dive'
        : 'Locked — configure 3 nodes',
      icon: BookOpen,
    },
  }

  return (
    <>
      {/* Main Coordinate Stage — matches the rendered background image to the subpixel */}
      <div
        className="fixed pointer-events-none select-none z-20 overflow-visible"
        style={{
          left: `${bgRect.left}px`,
          top: `${bgRect.top}px`,
          width: `${bgRect.width}px`,
          height: `${bgRect.height}px`,
        }}
      >
        {(['protagonist', 'world', 'npcs', 'narrative'] as NodeType[]).map((node) => {
          const cfg = nodeConfigs[node]
          const isSelected = activePopup === node
          const isHovered = hoveredNode === node
          const isNarrative = node === 'narrative'
          const isLocked = isNarrative && !canUnlockNarrative

          // Theme styling based on node category
          const colorStyles = {
            purple: {
              border: isSelected
                ? 'border-2 border-purple-300 ring-2 ring-purple-300 shadow-[0_0_35px_rgba(192,132,252,0.9),inset_0_0_20px_rgba(168,85,247,0.4)]'
                : isHovered
                  ? 'border-2 border-purple-300 shadow-[0_0_28px_rgba(192,132,252,0.8),inset_0_0_15px_rgba(168,85,247,0.3)] scale-105'
                  : 'border border-purple-400/80 shadow-[0_0_18px_rgba(168,85,247,0.55)]',
              badgeBg: 'bg-purple-950/90 border-purple-400 text-purple-300',
              popupCard:
                'bg-[#120a22]/95 border-purple-400/60 shadow-[0_12px_36px_rgba(168,85,247,0.4)]',
              tagText: 'text-purple-300',
              btnBg: 'bg-purple-900/50 hover:bg-purple-800/70 text-purple-200 border-purple-500/40',
            },
            sky: {
              border: isSelected
                ? 'border-2 border-sky-300 ring-2 ring-sky-300 shadow-[0_0_35px_rgba(56,189,248,0.9),inset_0_0_20px_rgba(56,189,248,0.4)]'
                : isHovered
                  ? 'border-2 border-sky-300 shadow-[0_0_28px_rgba(56,189,248,0.8),inset_0_0_15px_rgba(56,189,248,0.3)] scale-105'
                  : 'border border-sky-400/80 shadow-[0_0_18px_rgba(56,189,248,0.55)]',
              badgeBg: 'bg-sky-950/90 border-sky-400 text-sky-300',
              popupCard:
                'bg-[#061524]/95 border-sky-400/60 shadow-[0_12px_36px_rgba(56,189,248,0.4)]',
              tagText: 'text-sky-300',
              btnBg: 'bg-sky-900/50 hover:bg-sky-800/70 text-sky-200 border-sky-500/40',
            },
            emerald: {
              border: isSelected
                ? 'border-2 border-emerald-300 ring-2 ring-emerald-300 shadow-[0_0_35px_rgba(52,211,153,0.9),inset_0_0_20px_rgba(52,211,153,0.4)]'
                : isHovered
                  ? 'border-2 border-emerald-300 shadow-[0_0_28px_rgba(52,211,153,0.8),inset_0_0_15px_rgba(52,211,153,0.3)] scale-105'
                  : 'border border-emerald-400/80 shadow-[0_0_18px_rgba(52,211,153,0.55)]',
              badgeBg: 'bg-emerald-950/90 border-emerald-400 text-emerald-300',
              popupCard:
                'bg-[#061a11]/95 border-emerald-400/60 shadow-[0_12px_36px_rgba(52,211,153,0.4)]',
              tagText: 'text-emerald-300',
              btnBg:
                'bg-emerald-900/50 hover:bg-emerald-800/70 text-emerald-200 border-emerald-500/40',
            },
            amber: {
              border: isLocked
                ? 'border border-[#f0ca65]/35 shadow-[0_0_12px_rgba(240,202,101,0.25)] opacity-60'
                : isSelected
                  ? 'border-2 border-[#fae5b5] ring-2 ring-[#fae5b5] shadow-[0_0_40px_rgba(240,202,101,0.95),inset_0_0_25px_rgba(240,202,101,0.4)]'
                  : isHovered
                    ? 'border-2 border-[#fae5b5] shadow-[0_0_32px_rgba(240,202,101,0.85),inset_0_0_18px_rgba(240,202,101,0.35)] scale-105'
                    : 'border border-[#f0ca65]/80 shadow-[0_0_20px_rgba(240,202,101,0.6)]',
              badgeBg: isLocked
                ? 'bg-black/90 border-[#f0ca65]/40 text-[#f0ca65]/60'
                : 'bg-amber-950/90 border-[#f0ca65] text-[#f0ca65]',
              popupCard:
                'bg-[#1b1304]/95 border-[#f0ca65]/60 shadow-[0_12px_36px_rgba(240,202,101,0.4)]',
              tagText: 'text-[#f0ca65]',
              btnBg: isLocked
                ? 'bg-black/50 text-[#f0ca65]/50 border-[#f0ca65]/20 cursor-not-allowed'
                : 'bg-amber-900/50 hover:bg-amber-800/70 text-[#fae5b5] border-[#f0ca65]/40',
            },
          }[cfg.color as 'purple' | 'sky' | 'emerald' | 'amber']

          return (
            <div
              key={node}
              style={{
                left: cfg.left,
                top: cfg.top,
              }}
              className="absolute -translate-x-1/2 -translate-y-1/2"
            >
              {/* Interactive Orb Trigger Button with Glowing Ring */}
              <button
                type="button"
                style={{
                  width: `${cfg.diameter}px`,
                  height: `${cfg.diameter}px`,
                  touchAction: isCalibrating ? 'none' : 'auto',
                }}
                onPointerDown={(e) => handleCirclePointerDown(node, e)}
                onClick={() => handleCircleClick(node)}
                onMouseEnter={() => setHoveredNode(node)}
                onMouseLeave={() => setHoveredNode(null)}
                aria-label={`Configure ${cfg.title}`}
                className={`relative pointer-events-auto rounded-full cursor-pointer transition-all duration-200 flex items-center justify-center ${
                  isCalibrating && selectedCalibNode === node
                    ? 'ring-4 ring-[#f0ca65] shadow-[0_0_35px_rgba(240,202,101,0.9)] cursor-move'
                    : colorStyles.border
                }`}
              >
                {/* Subtle radiating pulse aura */}
                {!isLocked && !isCalibrating && (
                  <span
                    className={`absolute inset-0 rounded-full transition-opacity duration-300 ${
                      isSelected || isHovered
                        ? 'opacity-40 animate-ping'
                        : 'opacity-20 animate-pulse'
                    }`}
                    style={{
                      border: `1.5px solid ${
                        cfg.color === 'purple'
                          ? '#c084fc'
                          : cfg.color === 'sky'
                            ? '#38bdf8'
                            : cfg.color === 'emerald'
                              ? '#34d399'
                              : '#f0ca65'
                      }`,
                    }}
                  />
                )}

                {/* Status Indicator Badge on the circle's upper edge */}
                <span
                  className={`absolute top-[2%] right-[2%] w-6 h-6 sm:w-7 sm:h-7 rounded-full border flex items-center justify-center shadow-lg transition-transform duration-200 ${colorStyles.badgeBg} ${
                    isSelected ? 'scale-110' : ''
                  }`}
                >
                  {isLocked ? (
                    <Lock size={isDesktop ? 13 : 12} />
                  ) : (
                    <CheckCircle2 size={isDesktop ? 14 : 13} />
                  )}
                </span>
              </button>

              {/* Calibration: Active Node Resize Handle */}
              {isCalibrating && selectedCalibNode === node && (
                <div
                  onPointerDown={(e) => handleResizePointerDown(node, e)}
                  className="absolute right-[-14px] top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-[#f0ca65] text-black flex items-center justify-center cursor-ew-resize shadow-[0_0_15px_rgba(240,202,101,0.8)] z-30 pointer-events-auto border-2 border-black active:scale-110 transition-transform"
                  title="Drag horizontally to resize diameter"
                >
                  <Scaling size={13} />
                </div>
              )}

              {/* Calibration: On-Screen Coordinates readout */}
              {isCalibrating && (
                <div
                  className={`absolute -bottom-7 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full text-[10px] font-mono whitespace-nowrap z-30 pointer-events-none border ${
                    selectedCalibNode === node
                      ? 'bg-[#f0ca65] text-black font-bold border-white shadow-lg'
                      : 'bg-black/90 text-[#fae5b5] border-white/20'
                  }`}
                >
                  {calibration[node].left.toFixed(1)}%, {calibration[node].top.toFixed(1)}% (D: {calibration[node].diameter.toFixed(1)}%)
                </div>
              )}

            </div>
          )
        })}
      </div>

      {/* Uniform Center Popup Modal: Shows at the center of the screen when any node is pressed */}
      <AnimatePresence>
        {!isCalibrating && activePopup && (
          <div
            className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm pointer-events-auto"
            onClick={() => setActivePopup(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 8 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-[320px] sm:max-w-[340px] select-none"
            >
              {(() => {
                const node = activePopup
                const cfg = nodeConfigs[node]
                const isNarrative = node === 'narrative'
                const isLocked = isNarrative && !canUnlockNarrative
                const IconComponent = cfg.icon
                const colorStyles = {
                  purple: {
                    border: 'border-purple-400/60 shadow-[0_12px_36px_rgba(168,85,247,0.45)]',
                    popupCard: 'bg-[#120a22]/95 border-purple-400/60 shadow-[0_12px_36px_rgba(168,85,247,0.45)]',
                    tagText: 'text-purple-300',
                    btnBg: 'bg-purple-900/70 hover:bg-purple-800 text-purple-200 border-purple-500/50',
                  },
                  sky: {
                    border: 'border-sky-400/60 shadow-[0_12px_36px_rgba(56,189,248,0.45)]',
                    popupCard: 'bg-[#061524]/95 border-sky-400/60 shadow-[0_12px_36px_rgba(56,189,248,0.45)]',
                    tagText: 'text-sky-300',
                    btnBg: 'bg-sky-900/70 hover:bg-sky-800 text-sky-200 border-sky-500/50',
                  },
                  emerald: {
                    border: 'border-emerald-400/60 shadow-[0_12px_36px_rgba(52,211,153,0.45)]',
                    popupCard: 'bg-[#061a11]/95 border-emerald-400/60 shadow-[0_12px_36px_rgba(52,211,153,0.45)]',
                    tagText: 'text-emerald-300',
                    btnBg: 'bg-emerald-900/70 hover:bg-emerald-800 text-emerald-200 border-emerald-500/50',
                  },
                  amber: {
                    border: 'border-[#f0ca65]/60 shadow-[0_12px_36px_rgba(240,202,101,0.45)]',
                    popupCard: 'bg-[#1b1304]/95 border-[#f0ca65]/60 shadow-[0_12px_36px_rgba(240,202,101,0.45)]',
                    tagText: 'text-[#f0ca65]',
                    btnBg: isLocked
                      ? 'bg-black/50 text-[#f0ca65]/50 border-[#f0ca65]/20 cursor-not-allowed'
                      : 'bg-amber-900/70 hover:bg-amber-800 text-[#fae5b5] border-[#f0ca65]/50',
                  },
                }[cfg.color as 'purple' | 'sky' | 'emerald' | 'amber']

                return (
                  <div
                    className={`p-4 sm:p-5 rounded-2xl backdrop-blur-2xl border shadow-2xl ${colorStyles.popupCard}`}
                  >
                    {/* Card Header: Category Tag + Close Button */}
                    <div className="flex items-center justify-between gap-1 pb-2 border-b border-white/10">
                      <div
                        className={`flex items-center gap-2 font-display font-bold text-xs tracking-wider uppercase ${colorStyles.tagText}`}
                      >
                        <IconComponent size={15} className="shrink-0" />
                        <span>{cfg.title}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setActivePopup(null)}
                        className="p-1.5 rounded-full text-stone-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                        aria-label="Close card"
                      >
                        <X size={15} />
                      </button>
                    </div>

                    {/* Card Body: Name & Meta Details */}
                    <div
                      className="py-3 cursor-pointer"
                      onClick={() => handleOpenModal(node)}
                    >
                      <p className="font-display font-semibold text-base sm:text-lg text-[#fae5b5] truncate">
                        {cfg.name}
                      </p>
                      <p className="text-xs font-sans text-[#d8c49e]/90 line-clamp-3 mt-1 leading-relaxed">
                        {cfg.detail}
                      </p>
                    </div>

                    {/* Card Footer: Action Button */}
                    <button
                      type="button"
                      disabled={isLocked}
                      onClick={() => handleOpenModal(node)}
                      className={`w-full py-2.5 px-4 rounded-xl border text-xs sm:text-sm font-display font-semibold tracking-wider flex items-center justify-between transition-all duration-200 cursor-pointer shadow-md ${colorStyles.btnBg}`}
                    >
                      <span>
                        {isLocked
                          ? 'Locked'
                          : isNarrative
                            ? 'Author Narrative'
                            : `Configure ${cfg.title}`}
                      </span>
                      {isLocked ? <Lock size={14} /> : <ChevronRight size={15} />}
                    </button>
                  </div>
                )
              })()}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Bottom Action Area: "Dive In" Button pinned cleanly to bottom safe area */}
      <div
        className="fixed left-1/2 -translate-x-1/2 z-30 pointer-events-auto flex flex-col items-center gap-2 max-w-[92vw]"
        style={{
          bottom: 'max(0.75rem, env(safe-area-inset-bottom))',
        }}
      >
        <GlassCTAButton
          onClick={onIgniteDive}
          disabled={!canUnlockNarrative}
          fillClassName="bg-[#0B1118]/60 backdrop-blur-md"
          className={`w-full min-w-[200px] sm:min-w-[260px] transition-all duration-300 ${
            canUnlockNarrative
              ? 'shadow-[0_0_30px_rgba(240,202,101,0.45)]'
              : 'opacity-40 cursor-not-allowed'
          }`}
        >
          DIVE IN
        </GlassCTAButton>

        {!canUnlockNarrative && (
          <span className="text-[11px] sm:text-xs font-narrative italic text-[#d8c49e]/80 flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/50 backdrop-blur-md border border-[#e8ca8a]/15">
            <Lock size={12} className="text-[#f0ca65]/80 shrink-0" />
            <span>Configure Protagonist, World, and NPCs to unlock Dive</span>
          </span>
        )}
      </div>
    </>
  )
}
