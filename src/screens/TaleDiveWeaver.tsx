import { useEffect, useState } from 'react'
import {
  ArrowLeft,
  Sparkles,
  RotateCcw,
  Sliders,
} from 'lucide-react'
import type { ProtagonistData, WorldData } from '../types.ts'
import { FOURTH_WING_WORLD, VIOLET_SORRENGAIL } from '../data/starterTemplates.ts'
import { DEFAULT_NARRATION_STYLE } from '../api/turnContract.ts'
import type { NodeType, SeedNpcData, TaleDiveWeaverProps } from '../components/seedweaver/types.ts'
export type { SeedNpcData, TaleDiveWeaverProps } from '../components/seedweaver/types.ts'
import { DEFAULT_STARTER_NPCS } from '../components/seedweaver/defaultPacks.ts'
import { GlassIconButton } from '../lib/glassChrome.tsx'
import ProtagonistNodeModal from '../components/seedweaver/ProtagonistNodeModal.tsx'
import WorldNodeModal from '../components/seedweaver/WorldNodeModal.tsx'
import NpcNodeModal from '../components/seedweaver/NpcNodeModal.tsx'
import NarrativeNodeModal from '../components/seedweaver/NarrativeNodeModal.tsx'
import TalesWeaverStage from '../components/seedweaver/TalesWeaverStage.tsx'
import { useObjectCoverRect } from '../components/seedweaver/useObjectCoverRect.ts'
import WeaverCalibrator from '../components/seedweaver/WeaverCalibrator.tsx'
import {
  getSavedCalibration,
  saveSavedCalibration,
  clearSavedCalibration,
  type WeaverCalibrationPreset,
} from '../components/seedweaver/calibrationData.ts'
import { useSetupScreenBg, preloadAllSetupAssets } from '../lib/setupBgResolver.ts'

export default function TaleDiveWeaver({
  debugMode = false,
  worldTemplates = [],
  protagonistTemplates = [],
  existingTitles = [],
  onBack,
  onSaveProtagonistPreset,
  onSaveWorldPreset,
  onDeleteProtagonistPreset,
  onDeleteWorldPreset,
  onBeginTale,
}: TaleDiveWeaverProps) {
  // Screen resize tracker for responsive layout adaptation
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 768 : true
  )

  useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth >= 768)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // --- Active Seed Data State ---
  const [protagonist, setProtagonist] = useState<ProtagonistData>(() => ({
    ...VIOLET_SORRENGAIL,
    id: 'seed_protag_' + Date.now(),
    isMaster: false,
  }))
  const [world, setWorld] = useState<WorldData>(() => ({
    ...FOURTH_WING_WORLD,
    id: 'seed_world_' + Date.now(),
    isMaster: false,
  }))
  const [npcs, setNpcs] = useState<SeedNpcData[]>(DEFAULT_STARTER_NPCS)
  const [narrative, setNarrative] = useState({
    title: `${VIOLET_SORRENGAIL.name}'s Journey`,
    opening: VIOLET_SORRENGAIL.opening || '',
    narrationStyle: FOURTH_WING_WORLD.narrationStyle || DEFAULT_NARRATION_STYLE,
  })

  // Finalization status for each node
  const [finalizedNodes, setFinalizedNodes] = useState<{
    protagonist: boolean
    world: boolean
    npcs: boolean
    narrative: boolean
  }>({
    protagonist: true,
    world: true,
    npcs: true,
    narrative: false,
  })

  // Active open modal
  const [activeModal, setActiveModal] = useState<NodeType | null>(null)

  // Validation checks
  const isProtagonistReady = Boolean(protagonist.name.trim() && (protagonist.classId || protagonist.className))
  const isWorldReady = Boolean(world.name.trim() && (world.background || world.genreTone || world.conflict))
  const isNpcsReady = npcs.length > 0 && npcs.every((n) => n.name.trim())
  const canUnlockNarrative =
    finalizedNodes.protagonist &&
    finalizedNodes.world &&
    finalizedNodes.npcs &&
    isProtagonistReady &&
    isWorldReady &&
    isNpcsReady

  // Calibration mode state (temporary isolated tool for positioning/sizing nodes)
  const [isCalibrating, setIsCalibrating] = useState(false)
  const [selectedCalibNode, setSelectedCalibNode] = useState<NodeType>('protagonist')
  const [calibration, setCalibration] = useState<WeaverCalibrationPreset>(() =>
    getSavedCalibration(isDesktop)
  )

  // Sync calibration when viewport mode changes
  useEffect(() => {
    setCalibration(getSavedCalibration(isDesktop))
  }, [isDesktop])

  const handleCalibrationChange = (updated: WeaverCalibrationPreset) => {
    setCalibration(updated)
    saveSavedCalibration(isDesktop, updated)
  }

  const handleCalibrationReset = () => {
    clearSavedCalibration(isDesktop)
    setCalibration(getSavedCalibration(isDesktop))
  }

  const handleNodeCalibrationUpdate = (
    node: NodeType,
    updated: { left: number; top: number; diameter: number }
  ) => {
    const nextCalib = {
      ...calibration,
      [node]: updated,
    }
    setCalibration(nextCalib)
    saveSavedCalibration(isDesktop, nextCalib)
  }

  // Handle final dive launch
  const handleIgniteDive = () => {
    if (!canUnlockNarrative) return
    const finalTitle = narrative.title.trim() || `${protagonist.name || 'Hero'}'s Tale`
    onBeginTale(
      {
        ...protagonist,
        opening: narrative.opening,
      },
      {
        ...world,
        narrationStyle: narrative.narrationStyle,
      },
      finalTitle,
      npcs
    )
  }

  // Preload all setupscreen & loading screen photo assets for fast performance
  useEffect(() => {
    preloadAllSetupAssets()
  }, [])

  // Dynamic gender & device background image selection with probing & caching
  const { pcUrl, mobileUrl } = useSetupScreenBg(protagonist.gender)
  const bgRect = useObjectCoverRect(isDesktop ? 1366 : 714, isDesktop ? 768 : 1270)

  return (
    <div className="relative min-h-dvh max-h-dvh flex flex-col text-[#f5dfa0] overflow-hidden bg-[#07050d] select-none">
      {/* Background artwork — mathematically aligned to coverRect with responsive gender & device matching */}
      <div
        className="fixed pointer-events-none overflow-hidden select-none z-0 transition-opacity duration-500"
        style={{
          left: `${bgRect.left}px`,
          top: `${bgRect.top}px`,
          width: `${bgRect.width}px`,
          height: `${bgRect.height}px`,
        }}
      >
        <picture>
          <source media="(min-width: 768px)" srcSet={pcUrl} />
          <img
            src={mobileUrl}
            alt="Tales Weaver Background"
            decoding="async"
            fetchPriority="high"
            className="w-full h-full object-fill pointer-events-none"
          />
        </picture>
      </div>

      {/* Screen Header Bar */}
      <header
        className="relative z-20 shrink-0 flex items-center justify-between px-3 sm:px-4 py-2 sm:py-3 max-w-5xl mx-auto w-full min-h-[52px] sm:min-h-[58px]"
        style={{ paddingTop: 'max(0.5rem, env(safe-area-inset-top))' }}
      >
        {/* Circle Lucide Icon Button for Exit */}
        <div className="relative z-10 flex items-center">
          <GlassIconButton
            icon={ArrowLeft}
            label="Exit"
            onClick={onBack}
          />
        </div>

        {/* Center Grand Title: TALES WEAVER - Absolute centered across all viewports */}
        <div className="absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 text-center flex flex-col items-center pointer-events-none max-w-[calc(100%-140px)] sm:max-w-none">
          <div className="flex items-center justify-center gap-1.5 sm:gap-2 w-full">
            <span className="w-5 sm:w-8 h-[1px] bg-gradient-to-r from-transparent to-[#e8ca8a]/60 shrink-0" />
            <h1 className="font-display font-bold text-base sm:text-2xl tracking-[0.2em] text-[#fae5b5] drop-shadow-[0_2px_12px_rgba(232,202,138,0.4)] uppercase whitespace-nowrap">
              TALES WEAVER
            </h1>
            <span className="w-5 sm:w-8 h-[1px] bg-gradient-to-l from-transparent to-[#e8ca8a]/60 shrink-0" />
          </div>
          <div className="flex items-center justify-center gap-1.5 text-[9px] sm:text-[10px] tracking-[0.25em] font-display font-medium text-[#d8c49e]/80 uppercase mt-0.5 whitespace-nowrap">
            <Sparkles size={9} className="text-[#f0ca65] shrink-0" />
            <span>SHAPE YOUR JOURNEY</span>
            <Sparkles size={9} className="text-[#f0ca65] shrink-0" />
          </div>
        </div>

        {/* Action Controls: Calibrator & Reset */}
        <div className="relative z-10 flex items-center gap-2">
          {debugMode && (
            <button
              type="button"
              onClick={() => setIsCalibrating(!isCalibrating)}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-display tracking-wider border transition-all cursor-pointer ${
                isCalibrating
                  ? 'bg-[#f0ca65] text-black font-bold border-white shadow-[0_0_15px_rgba(240,202,101,0.6)]'
                  : 'bg-black/40 hover:bg-black/60 text-[#f0ca65] border-[#f0ca65]/40 hover:border-[#f0ca65]'
              }`}
              title="Toggle Node Calibration Tool"
            >
              <Sliders size={13} />
              <span className="hidden sm:inline">Calibrate</span>
            </button>
          )}

          <GlassIconButton
            icon={RotateCcw}
            label="Reset to Template"
            onClick={() => {
              setProtagonist({ ...VIOLET_SORRENGAIL, id: 'seed_protag_' + Date.now(), isMaster: false })
              setWorld({ ...FOURTH_WING_WORLD, id: 'seed_world_' + Date.now(), isMaster: false })
              setNpcs(DEFAULT_STARTER_NPCS)
              setFinalizedNodes({ protagonist: true, world: true, npcs: true, narrative: false })
            }}
          />
        </div>
      </header>

      {/* Main Interactive Stage Container */}
      {!activeModal && (
        <TalesWeaverStage
          isDesktop={isDesktop}
          bgRect={bgRect}
          protagonist={protagonist}
          world={world}
          npcs={npcs}
          narrative={narrative}
          canUnlockNarrative={canUnlockNarrative}
          setActiveModal={setActiveModal}
          onIgniteDive={handleIgniteDive}
          calibration={calibration}
          isCalibrating={isCalibrating}
          selectedCalibNode={selectedCalibNode}
          onSelectCalibNode={setSelectedCalibNode}
          onUpdateNodeCalibration={handleNodeCalibrationUpdate}
        />
      )}

      {/* Calibration Overlay HUD */}
      {debugMode && isCalibrating && !activeModal && (
        <WeaverCalibrator
          isDesktop={isDesktop}
          calibration={calibration}
          onChange={handleCalibrationChange}
          onReset={handleCalibrationReset}
          selectedNode={selectedCalibNode}
          onSelectNode={setSelectedCalibNode}
        />
      )}

      {/* ========================================================================= */}
      {/* 3. MODAL DIALOGS FOR EACH NODE                                            */}
      {/* ========================================================================= */}
      <>
        {activeModal === 'protagonist' && (
          <ProtagonistNodeModal
            protagonist={protagonist}
            protagonistTemplates={protagonistTemplates}
            onSavePreset={onSaveProtagonistPreset}
            onDeletePreset={onDeleteProtagonistPreset}
            onSave={(updated) => {
              setProtagonist(updated)
              setFinalizedNodes((prev) => ({ ...prev, protagonist: true }))
              setActiveModal(null)
            }}
            onClose={() => setActiveModal(null)}
          />
        )}

        {activeModal === 'world' && (
          <WorldNodeModal
            world={world}
            worldTemplates={worldTemplates}
            onSavePreset={onSaveWorldPreset}
            onDeletePreset={onDeleteWorldPreset}
            onSave={(updated) => {
              setWorld(updated)
              setFinalizedNodes((prev) => ({ ...prev, world: true }))
              setActiveModal(null)
            }}
            onClose={() => setActiveModal(null)}
          />
        )}

        {activeModal === 'npcs' && (
          <NpcNodeModal
            npcs={npcs}
            worldName={world.name}
            onSave={(updated) => {
              setNpcs(updated)
              setFinalizedNodes((prev) => ({ ...prev, npcs: true }))
              setActiveModal(null)
            }}
            onClose={() => setActiveModal(null)}
          />
        )}

        {activeModal === 'narrative' && (
          <NarrativeNodeModal
            narrative={narrative}
            protagonist={protagonist}
            world={world}
            existingTitles={existingTitles}
            onSave={(updated) => {
              setNarrative(updated)
              setFinalizedNodes((prev) => ({ ...prev, narrative: true }))
              setActiveModal(null)
            }}
            onUpdateWorld={(patch) => setWorld((w) => ({ ...w, ...patch }))}
            onLaunchDirect={() => {
              setActiveModal(null)
              handleIgniteDive()
            }}
            onClose={() => setActiveModal(null)}
          />
        )}
      </>
    </div>
  )
}
