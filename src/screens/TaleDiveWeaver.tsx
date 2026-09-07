import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  Sparkles,
  User,
  Globe,
  Users,
  BookOpen,
  Lock,
  CheckCircle2,
  Play,
  RotateCcw,
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

// Asset imports for the 4 island nodes and background — each is a
// 1024x1024 (or larger) source photo, way past what an 80-104px circular
// thumbnail or a mobile background ever needs. A matching *_mobile.webp
// (generated once via sharp, see PROJECT_REVISION_NOTES.md) is served
// below (min-width:769px) so phones don't pay for ~1MB/image they can't
// even resolve the detail of; desktop keeps the original, untouched.
import seedBgImg from '../assets/images/seed_bg_1788724454395.jpg'
import seedBgImgMobile from '../assets/images/seed_bg_mobile.webp'
import seedProtagImg from '../assets/images/seed_protag_1788724469363.jpg'
import seedProtagImgMobile from '../assets/images/seed_protag_mobile.webp'
import seedWorldImg from '../assets/images/seed_world_1788724489697.jpg'
import seedWorldImgMobile from '../assets/images/seed_world_mobile.webp'
import seedNpcsImg from '../assets/images/seed_npcs_1788724503157.jpg'
import seedNpcsImgMobile from '../assets/images/seed_npcs_mobile.webp'
import seedNarrativeImg from '../assets/images/seed_narrative_1788724534669.jpg'
import seedNarrativeImgMobile from '../assets/images/seed_narrative_mobile.webp'

export default function TaleDiveWeaver({
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

  return (
    <div className="relative min-h-dvh max-h-dvh flex flex-col text-[#f5dfa0] overflow-hidden bg-[#07050d] select-none">
      {/* Background artwork with atmospheric parallax & celestial light */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <picture>
          <source media="(min-width: 769px)" srcSet={seedBgImg} />
          <img
            src={seedBgImgMobile}
            alt="Tales Weaver Background"
            decoding="async"
            className="w-full h-full object-cover object-center scale-105 filter brightness-[0.7] contrast-[1.1] transition-all duration-1000"
          />
        </picture>
        {/* Mystic Vignette & Astral Gradients */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#050308]/75 via-[#080512]/45 to-[#05030a]/90" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(99,102,241,0.12),transparent_70%)]" />
      </div>

      {/* Ambient background scrim (GPU-friendly, no distracting pulsing) */}
      {!activeModal && (
        <div className="absolute inset-0 z-0 pointer-events-none opacity-30 overflow-hidden">
          <div className="sw-spark absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-amber-500/10 blur-3xl" />
        </div>
      )}

      {/* Screen Header Bar */}
      <header
        className="relative z-20 shrink-0 flex items-center justify-between px-3 sm:px-4 py-2.5 sm:py-3 max-w-5xl mx-auto w-full"
        style={{ paddingTop: 'max(0.6rem, env(safe-area-inset-top))' }}
      >
        {/* Circle Lucide Icon Button for Exit */}
        <GlassIconButton
          icon={ArrowLeft}
          label="Exit"
          onClick={onBack}
        />

        {/* Center Grand Title: TALES WEAVER */}
        <div className="text-center flex flex-col items-center">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <span className="w-5 sm:w-8 h-[1px] bg-gradient-to-r from-transparent to-[#e8ca8a]/60" />
            <h1 className="font-display font-bold text-lg sm:text-2xl tracking-[0.2em] text-[#fae5b5] drop-shadow-[0_2px_12px_rgba(232,202,138,0.4)] uppercase">
              TALES WEAVER
            </h1>
            <span className="w-5 sm:w-8 h-[1px] bg-gradient-to-l from-transparent to-[#e8ca8a]/60" />
          </div>
          <div className="flex items-center gap-1.5 text-[9px] sm:text-[10px] tracking-[0.25em] font-display font-medium text-[#d8c49e]/80 uppercase mt-0.5">
            <Sparkles size={9} className="text-[#f0ca65]" />
            <span>SHAPE YOUR JOURNEY</span>
            <Sparkles size={9} className="text-[#f0ca65]" />
          </div>
        </div>

        {/* Circle Lucide Icon Button for Reset */}
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
      </header>

      {/* Main Celestial Nexus / Leyline Constellation Container */}
      {!activeModal && (
        <main className="relative z-10 flex-1 flex flex-col items-center justify-between px-2 sm:px-4 py-1 sm:py-2 min-h-0 overflow-y-auto">
          {/* ========================================================================= */}
          {/* 1. MOBILE RESPONSIVE CONSTELLATION LAYOUT (< 768px)                       */}
          {/*    Uncrowded, spacious portrait hierarchy matching user reference image   */}
          {/* ========================================================================= */}
          {!isDesktop ? (
            <div className="relative w-full max-w-[360px] h-[440px] my-auto shrink-0 select-none">
              {/* Mobile SVG Ley-Lines & Star Nexus */}
              <svg
                className="absolute inset-0 w-full h-full pointer-events-none z-0 overflow-visible"
                viewBox="0 0 360 440"
              >
                <defs>
                  <linearGradient id="m-leyline-gold" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.85" />
                    <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.85" />
                  </linearGradient>
                  <linearGradient id="m-leyline-protag-npcs" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.85" />
                    <stop offset="100%" stopColor="#10b981" stopOpacity="0.85" />
                  </linearGradient>
                  <linearGradient id="m-leyline-world-npcs" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.85" />
                    <stop offset="100%" stopColor="#10b981" stopOpacity="0.85" />
                  </linearGradient>
                  <linearGradient id="m-leyline-world-narrative" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.85" />
                    <stop offset="100%" stopColor="#c084fc" stopOpacity="0.85" />
                  </linearGradient>
                  <linearGradient id="m-leyline-npcs-narrative" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#10b981" stopOpacity="0.85" />
                    <stop offset="100%" stopColor="#c084fc" stopOpacity="0.85" />
                  </linearGradient>
                  <linearGradient id="m-leyline-vertical" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.85" />
                    <stop offset="50%" stopColor="#38bdf8" stopOpacity="0.8" />
                    <stop offset="100%" stopColor="#c084fc" stopOpacity="0.9" />
                  </linearGradient>
                  <linearGradient id="m-diamond-gradient" x1="180" y1="42" x2="180" y2="305" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.8" />
                    <stop offset="50%" stopColor="#38bdf8" stopOpacity="0.8" />
                    <stop offset="100%" stopColor="#c084fc" stopOpacity="0.85" />
                  </linearGradient>
                  <filter id="m-glow-leyline" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="2.5" result="blur" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                  </filter>
                </defs>

                {/* Subtle outer dashed diamond boundary */}
                <polygon
                  points="180,42 292,190 180,305 68,190"
                  fill="none"
                  stroke="rgba(232,202,138,0.2)"
                  strokeWidth="1.2"
                  strokeDasharray="4 5"
                />

                {/* Fixed Diamond Shape with Radiant Gradient aligned to node centers */}
                <polygon
                  points="180,42 292,190 180,305 68,190"
                  fill="none"
                  stroke="url(#m-diamond-gradient)"
                  strokeWidth="1.8"
                  filter="url(#m-glow-leyline)"
                />

                {/* Connecting Ley Lines */}
                <line x1="180" y1="42" x2="68" y2="190" stroke="url(#m-leyline-gold)" strokeWidth="1.8" filter="url(#m-glow-leyline)" />
                <line x1="180" y1="42" x2="292" y2="190" stroke="url(#m-leyline-protag-npcs)" strokeWidth="1.8" filter="url(#m-glow-leyline)" />
                <line x1="68" y1="190" x2="292" y2="190" stroke="url(#m-leyline-world-npcs)" strokeWidth="1.5" filter="url(#m-glow-leyline)" />
                <line
                  x1="68"
                  y1="190"
                  x2="180"
                  y2="305"
                  stroke={canUnlockNarrative ? 'url(#m-leyline-world-narrative)' : 'rgba(56,189,248,0.3)'}
                  strokeWidth="1.8"
                  filter="url(#m-glow-leyline)"
                />
                <line
                  x1="292"
                  y1="190"
                  x2="180"
                  y2="305"
                  stroke={canUnlockNarrative ? 'url(#m-leyline-npcs-narrative)' : 'rgba(16,185,129,0.3)'}
                  strokeWidth="1.8"
                  filter="url(#m-glow-leyline)"
                />
                <line
                  x1="180"
                  y1="42"
                  x2="180"
                  y2="305"
                  stroke={canUnlockNarrative ? 'url(#m-leyline-vertical)' : 'rgba(232,202,138,0.3)'}
                  strokeWidth="2"
                  filter="url(#m-glow-leyline)"
                />

                {/* Central Astral Starburst Nexus at (180, 190) */}
                <circle cx="180" cy="190" r="10" fill={canUnlockNarrative ? 'rgba(192,132,252,0.25)' : 'rgba(232,202,138,0.15)'} />
                <circle cx="180" cy="190" r="5" fill={canUnlockNarrative ? '#d8b4fe' : '#f0ca65'} filter="url(#m-glow-leyline)" />
                <path d="M180,178 L182,187 L192,190 L182,193 L180,202 L178,193 L168,190 L178,187 Z" fill="#ffffff" />
              </svg>

              {/* M1. TOP NODE: PROTAGONIST */}
              <div className="absolute top-[42px] left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 flex flex-col items-center">
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setActiveModal('protagonist')}
                  className="relative group cursor-pointer focus:outline-none"
                >
                  <div
                    className={`sw-aura absolute -inset-1.5 rounded-full transition-all duration-500 blur-sm ${
                      finalizedNodes.protagonist
                        ? 'bg-gradient-to-tr from-amber-500/60 to-yellow-300/40 opacity-100'
                        : 'bg-amber-500/20 opacity-40'
                    }`}
                  />
                  <div className="relative w-[70px] h-[70px] rounded-full overflow-hidden border-2 border-[#f0ca65] shadow-[0_0_15px_rgba(245,158,11,0.5)] bg-[#120e1d]">
                    <img
                      src={seedProtagImgMobile}
                      alt="Protagonist"
                      loading="lazy"
                      decoding="async"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                    <div className="absolute bottom-1 inset-x-0 flex justify-center">
                      <span className="px-1.5 py-0.2 rounded bg-amber-950/80 border border-amber-400/50 text-[8px] font-mono text-amber-200 uppercase font-bold truncate max-w-[85%]">
                        {protagonist.className || 'Hero'}
                      </span>
                    </div>
                  </div>
                  {finalizedNodes.protagonist && (
                    <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-amber-500 text-black flex items-center justify-center shadow-md shadow-amber-500/50">
                      <CheckCircle2 size={12} className="stroke-[3]" />
                    </div>
                  )}
                </motion.button>

                {/* Protagonist Card: Directly Below Node */}
                <div
                  onClick={() => setActiveModal('protagonist')}
                  className="absolute top-[44px] px-2 py-1 rounded-lg bg-[#151022]/95 border border-amber-500/40 backdrop-blur-sm shadow-xl text-center w-[168px] cursor-pointer hover:border-amber-400 transition-colors pointer-events-auto"
                >
                  <h3 className="font-display font-bold text-[11px] text-[#fae5b5] tracking-wide uppercase flex items-center justify-center gap-1">
                    <User size={10} className="text-amber-400" />
                    <span>PROTAGONIST</span>
                  </h3>
                  <p className="font-display text-[9.5px] text-amber-300/90 truncate font-semibold">
                    {protagonist.name || 'Unnamed Hero'}
                  </p>
                  <ul className="text-[8.5px] text-[#d8c49e]/90 text-left mt-0.5 space-y-0.2 font-sans">
                    <li className="truncate">• Class: {protagonist.className || 'Adventurer'}</li>
                    <li className="truncate">• Origin: {protagonist.gender || 'Any'}, {protagonist.age || 20}y</li>
                    <li className="truncate">• Skills: {protagonist.startingSkills?.length || 0} Abilities</li>
                  </ul>
                </div>
              </div>

              {/* M2. MID-LEFT NODE: WORLD */}
              <div className="absolute top-[190px] left-[68px] -translate-x-1/2 -translate-y-1/2 z-10 flex flex-col items-center">
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setActiveModal('world')}
                  className="relative group cursor-pointer focus:outline-none"
                >
                  <div
                    className={`sw-aura absolute -inset-1.5 rounded-full transition-all duration-500 blur-sm ${
                      finalizedNodes.world
                        ? 'bg-gradient-to-tr from-sky-500/60 to-cyan-300/40 opacity-100'
                        : 'bg-sky-500/20 opacity-40'
                    }`}
                  />
                  <div className="relative w-[66px] h-[66px] rounded-full overflow-hidden border-2 border-[#38bdf8] shadow-[0_0_15px_rgba(56,189,248,0.5)] bg-[#0c1a24]">
                    <img
                      src={seedWorldImgMobile}
                      alt="World"
                      loading="lazy"
                      decoding="async"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                    <div className="absolute bottom-1 inset-x-0 flex justify-center">
                      <span className="px-1.5 py-0.2 rounded bg-sky-950/80 border border-sky-400/50 text-[8px] font-mono text-sky-200 uppercase font-bold truncate max-w-[85%]">
                        {world.name || 'Realm'}
                      </span>
                    </div>
                  </div>
                  {finalizedNodes.world && (
                    <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-sky-400 text-black flex items-center justify-center shadow-md shadow-sky-400/50">
                      <CheckCircle2 size={12} className="stroke-[3]" />
                    </div>
                  )}
                </motion.button>

                {/* World Card: Directly Below Node on the Left */}
                <div
                  onClick={() => setActiveModal('world')}
                  className="absolute top-[42px] -left-8 px-2 py-1 rounded-lg bg-[#0b1622]/95 border border-sky-500/40 backdrop-blur-sm shadow-xl text-center w-[148px] cursor-pointer hover:border-sky-400 transition-colors pointer-events-auto"
                >
                  <h3 className="font-display font-bold text-[11px] text-[#bae6fd] tracking-wide uppercase flex items-center justify-center gap-1">
                    <Globe size={10} className="text-sky-400" />
                    <span>WORLD</span>
                  </h3>
                  <p className="font-display text-[9.5px] text-sky-300/90 truncate font-semibold">
                    {world.name || 'Custom Realm'}
                  </p>
                  <ul className="text-[8.5px] text-[#93c5fd]/90 text-left mt-0.5 space-y-0.2 font-sans">
                    <li className="truncate">• Tone: {world.genreTone || 'Fantasy'}</li>
                    <li className="truncate">• Sites: {world.locationsList?.length || 0} Locations</li>
                    <li className="truncate">• Powers: {world.factionsList?.length || 0} Factions</li>
                  </ul>
                </div>
              </div>

              {/* M3. MID-RIGHT NODE: NPCs */}
              <div className="absolute top-[190px] left-[292px] -translate-x-1/2 -translate-y-1/2 z-10 flex flex-col items-center">
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setActiveModal('npcs')}
                  className="relative group cursor-pointer focus:outline-none"
                >
                  <div
                    className={`sw-aura absolute -inset-1.5 rounded-full transition-all duration-500 blur-sm ${
                      finalizedNodes.npcs
                        ? 'bg-gradient-to-tr from-emerald-500/60 to-teal-300/40 opacity-100'
                        : 'bg-emerald-500/20 opacity-40'
                    }`}
                  />
                  <div className="relative w-[66px] h-[66px] rounded-full overflow-hidden border-2 border-[#10b981] shadow-[0_0_15px_rgba(16,185,129,0.5)] bg-[#0a1a14]">
                    <img
                      src={seedNpcsImgMobile}
                      alt="NPCs"
                      loading="lazy"
                      decoding="async"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                    <div className="absolute bottom-1 inset-x-0 flex justify-center">
                      <span className="px-1.5 py-0.2 rounded bg-emerald-950/80 border border-emerald-400/50 text-[8px] font-mono text-emerald-200 uppercase font-bold">
                        {npcs.length} Cast
                      </span>
                    </div>
                  </div>
                  {finalizedNodes.npcs && (
                    <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-emerald-400 text-black flex items-center justify-center shadow-md shadow-emerald-400/50">
                      <CheckCircle2 size={12} className="stroke-[3]" />
                    </div>
                  )}
                </motion.button>

                {/* NPCs Card: Directly Below Node on the Right */}
                <div
                  onClick={() => setActiveModal('npcs')}
                  className="absolute top-[42px] -right-8 px-2 py-1 rounded-lg bg-[#091a13]/95 border border-emerald-500/40 backdrop-blur-sm shadow-xl text-center w-[148px] cursor-pointer hover:border-emerald-400 transition-colors pointer-events-auto"
                >
                  <h3 className="font-display font-bold text-[11px] text-[#a7f3d0] tracking-wide uppercase flex items-center justify-center gap-1">
                    <Users size={10} className="text-emerald-400" />
                    <span>NPCS</span>
                  </h3>
                  <p className="font-display text-[9.5px] text-emerald-300/90 truncate font-semibold">
                    {npcs.length} Key Characters
                  </p>
                  <ul className="text-[8.5px] text-[#6ee7b7]/90 text-left mt-0.5 space-y-0.2 font-sans">
                    <li className="truncate">• Starting Roster: Mapped</li>
                    <li className="truncate">• Bonds & Gear: Configured</li>
                  </ul>
                </div>
              </div>

              {/* M4. BOTTOM-CENTER NODE: NARRATIVE */}
              <div className="absolute top-[305px] left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 flex flex-col items-center">
                <motion.button
                  whileTap={canUnlockNarrative ? { scale: 0.95 } : {}}
                  onClick={() => {
                    if (canUnlockNarrative) setActiveModal('narrative')
                  }}
                  disabled={!canUnlockNarrative}
                  className={`relative group cursor-pointer focus:outline-none ${
                    !canUnlockNarrative ? 'opacity-70 cursor-not-allowed filter grayscale-[40%]' : ''
                  }`}
                >
                  <div
                    className={`sw-aura absolute -inset-1.5 rounded-full transition-all duration-700 blur-sm ${
                      canUnlockNarrative
                        ? 'bg-gradient-to-tr from-purple-600 via-fuchsia-500 to-indigo-400 opacity-90'
                        : 'bg-purple-900/20 opacity-30'
                    }`}
                  />
                  <div
                    className={`relative w-[70px] h-[70px] rounded-full overflow-hidden border-2 transition-all duration-500 bg-[#160c24] ${
                      canUnlockNarrative
                        ? 'border-[#c084fc] shadow-[0_0_20px_rgba(192,132,252,0.8)] ring-2 ring-purple-500/30'
                        : 'border-purple-900/60 shadow-none'
                    }`}
                  >
                    <img
                      src={seedNarrativeImgMobile}
                      alt="Narrative Portal"
                      loading="lazy"
                      decoding="async"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />

                    {/* Arcane Lock when sealed */}
                    {!canUnlockNarrative && (
                      <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center text-purple-300">
                        <Lock size={16} className="text-purple-300/80 mb-0.5" />
                        <span className="text-[8px] font-mono tracking-wider uppercase font-bold text-purple-300/70">
                          Sealed
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Circular Check Indicator matching other 3 nodes (No "Ready to Dive" text) */}
                  {canUnlockNarrative && (
                    <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-purple-500 text-black flex items-center justify-center shadow-md shadow-purple-500/50">
                      <CheckCircle2 size={12} className="stroke-[3]" />
                    </div>
                  )}
                </motion.button>

                {/* Narrative Card: Centered at Bottom */}
                <div
                  onClick={() => {
                    if (canUnlockNarrative) setActiveModal('narrative')
                  }}
                  className={`absolute top-[44px] px-2 py-1 rounded-lg backdrop-blur-sm shadow-xl text-center w-[172px] transition-all pointer-events-auto ${
                    canUnlockNarrative
                      ? 'bg-[#1b0f2e]/95 border border-purple-400/60 hover:border-purple-300 cursor-pointer shadow-purple-950/50'
                      : 'bg-[#120a20]/80 border border-purple-900/30 text-purple-400/60'
                  }`}
                >
                  <h3 className="font-display font-bold text-[11px] text-[#e9d5ff] tracking-wide uppercase flex items-center justify-center gap-1">
                    <BookOpen size={10} className="text-purple-400" />
                    <span>NARRATIVE</span>
                  </h3>
                  <p className="font-display text-[9.5px] text-purple-300/90 truncate font-semibold">
                    {narrative.title || 'Prologue & Dive'}
                  </p>
                  <ul className="text-[8.5px] text-[#d8b4fe]/90 text-left mt-0.5 space-y-0.2 font-sans">
                    <li className="truncate">• Style: {narrative.narrationStyle ? 'Configured' : 'Default'}</li>
                    <li className="truncate">• Hook: {narrative.opening ? 'Defined' : 'Default'}</li>
                  </ul>
                </div>
              </div>
            </div>
          ) : (
            /* ========================================================================= */
            /* 2. PC / DESKTOP GRAND CONSTELLATION LAYOUT (>= 768px)                     */
            /*    Scaled up nodes, cards, typography, and radiant ley-lines             */
            /* ========================================================================= */
            <div className="relative w-full max-w-2xl lg:max-w-3xl aspect-square max-h-[72vh] flex items-center justify-center my-auto">
              {/* Scaled-up SVG Ley-Lines & Star Nexus */}
              <svg
                className="absolute inset-0 w-full h-full pointer-events-none z-0 overflow-visible"
                viewBox="0 0 600 600"
              >
                <defs>
                  <linearGradient id="pc-leyline-gold" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.85" />
                    <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.85" />
                  </linearGradient>
                  <linearGradient id="pc-leyline-protag-npcs" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.85" />
                    <stop offset="100%" stopColor="#10b981" stopOpacity="0.85" />
                  </linearGradient>
                  <linearGradient id="pc-leyline-world-npcs" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.85" />
                    <stop offset="100%" stopColor="#10b981" stopOpacity="0.85" />
                  </linearGradient>
                  <linearGradient id="pc-leyline-world-narrative" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.85" />
                    <stop offset="100%" stopColor="#c084fc" stopOpacity="0.85" />
                  </linearGradient>
                  <linearGradient id="pc-leyline-npcs-narrative" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#10b981" stopOpacity="0.85" />
                    <stop offset="100%" stopColor="#c084fc" stopOpacity="0.85" />
                  </linearGradient>
                  <linearGradient id="pc-diamond-gradient" x1="300" y1="95" x2="300" y2="455" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.8" />
                    <stop offset="50%" stopColor="#38bdf8" stopOpacity="0.8" />
                    <stop offset="100%" stopColor="#c084fc" stopOpacity="0.85" />
                  </linearGradient>
                  <filter id="pc-glow-leyline" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="3.5" result="blur" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                  </filter>
                </defs>

                {/* Dashed outer diamond guide */}
                <polygon
                  points="300,95 480,275 300,455 120,275"
                  fill="none"
                  stroke="rgba(232,202,138,0.25)"
                  strokeWidth="1.5"
                  strokeDasharray="6 8"
                />

                {/* Radiant Scaled Diamond connecting all 4 node centers */}
                <polygon
                  points="300,95 480,275 300,455 120,275"
                  fill="none"
                  stroke="url(#pc-diamond-gradient)"
                  strokeWidth="2.5"
                  filter="url(#pc-glow-leyline)"
                />

                {/* Scaled-up Leylines */}
                <line x1="300" y1="95" x2="120" y2="275" stroke="url(#pc-leyline-gold)" strokeWidth="2.2" filter="url(#pc-glow-leyline)" />
                <line x1="300" y1="95" x2="480" y2="275" stroke="url(#pc-leyline-protag-npcs)" strokeWidth="2.2" filter="url(#pc-glow-leyline)" />
                <line x1="120" y1="275" x2="480" y2="275" stroke="url(#pc-leyline-world-npcs)" strokeWidth="2.2" filter="url(#pc-glow-leyline)" />
                <line
                  x1="120"
                  y1="275"
                  x2="300"
                  y2="455"
                  stroke={canUnlockNarrative ? 'url(#pc-leyline-world-narrative)' : 'rgba(56,189,248,0.3)'}
                  strokeWidth="2.2"
                  filter="url(#pc-glow-leyline)"
                />
                <line
                  x1="480"
                  y1="275"
                  x2="300"
                  y2="455"
                  stroke={canUnlockNarrative ? 'url(#pc-leyline-npcs-narrative)' : 'rgba(16,185,129,0.3)'}
                  strokeWidth="2.2"
                  filter="url(#pc-glow-leyline)"
                />
                <line
                  x1="300"
                  y1="95"
                  x2="300"
                  y2="455"
                  stroke={canUnlockNarrative ? 'url(#pc-diamond-gradient)' : 'rgba(232,202,138,0.3)'}
                  strokeWidth="2.5"
                  filter="url(#pc-glow-leyline)"
                />

                {/* Grand Astral Starburst Nexus at (300, 275) */}
                <circle cx="300" cy="275" r={canUnlockNarrative ? '18' : '14'} fill={canUnlockNarrative ? 'rgba(168,85,247,0.3)' : 'rgba(232,202,138,0.15)'} />
                <circle cx="300" cy="275" r="9" fill={canUnlockNarrative ? '#d8b4fe' : '#f0ca65'} filter="url(#pc-glow-leyline)" />
                <path d="M300,254 L304,271 L321,275 L304,279 L300,296 L296,279 L279,275 L296,271 Z" fill="#ffffff" />
              </svg>

              {/* PC 1. PROTAGONIST NODE (TOP) */}
              <div className="absolute top-[15.8%] left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 flex flex-col items-center">
                <motion.button
                  whileHover={{ scale: 1.06 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setActiveModal('protagonist')}
                  className="relative group cursor-pointer focus:outline-none"
                >
                  <div
                    className={`sw-aura absolute -inset-2.5 rounded-full transition-all duration-500 blur-md ${
                      finalizedNodes.protagonist
                        ? 'bg-gradient-to-tr from-amber-500/60 to-yellow-300/40 opacity-100 animate-pulse'
                        : 'bg-amber-500/20 opacity-40 group-hover:opacity-75'
                    }`}
                  />
                  <div className="relative w-24 h-24 lg:w-28 lg:h-28 rounded-full overflow-hidden border-2 border-[#f0ca65] shadow-[0_0_24px_rgba(245,158,11,0.5)] bg-[#120e1d]">
                    <img
                      src={seedProtagImg}
                      alt="Protagonist"
                      loading="lazy"
                      decoding="async"
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                    <div className="absolute bottom-2 inset-x-0 flex justify-center">
                      <span className="px-2 py-0.5 rounded bg-amber-950/80 border border-amber-400/50 text-[10px] font-mono text-amber-200 uppercase font-bold truncate max-w-[85%]">
                        {protagonist.className || 'Hero'}
                      </span>
                    </div>
                  </div>
                  {finalizedNodes.protagonist && (
                    <div className="absolute -top-1 -right-1 w-7 h-7 rounded-full bg-amber-500 text-black flex items-center justify-center shadow-lg shadow-amber-500/50">
                      <CheckCircle2 size={16} className="stroke-[3]" />
                    </div>
                  )}
                </motion.button>

                <div
                  onClick={() => setActiveModal('protagonist')}
                  className="absolute top-full mt-2 px-3.5 py-2 rounded-xl bg-[#151022]/95 border border-amber-500/40 backdrop-blur-md shadow-2xl text-center w-max max-w-[210px] lg:max-w-[240px] cursor-pointer hover:border-amber-400 transition-colors pointer-events-auto"
                >
                  <h3 className="font-display font-bold text-xs sm:text-sm text-[#fae5b5] tracking-wider uppercase flex items-center justify-center gap-1.5">
                    <User size={13} className="text-amber-400" />
                    <span>PROTAGONIST</span>
                  </h3>
                  <p className="font-display text-xs text-amber-300/90 truncate font-semibold mt-0.5">
                    {protagonist.name || 'Unnamed Hero'}
                  </p>
                  <ul className="text-[10px] sm:text-[11px] text-[#d8c49e]/90 text-left mt-1 space-y-0.5 font-sans">
                    <li className="truncate">• Class: {protagonist.className || 'Adventurer'}</li>
                    <li className="truncate">• Origin: {protagonist.gender || 'Any'}, {protagonist.age || 20}y</li>
                    <li className="truncate">• Skills: {protagonist.startingSkills?.length || 0} Abilities</li>
                  </ul>
                </div>
              </div>

              {/* PC 2. WORLD NODE (LEFT) */}
              <div className="absolute top-[45.8%] left-[20%] -translate-x-1/2 -translate-y-1/2 z-10 flex flex-col items-center">
                <motion.button
                  whileHover={{ scale: 1.06 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setActiveModal('world')}
                  className="relative group cursor-pointer focus:outline-none"
                >
                  <div
                    className={`sw-aura absolute -inset-2.5 rounded-full transition-all duration-500 blur-md ${
                      finalizedNodes.world
                        ? 'bg-gradient-to-tr from-sky-500/60 to-cyan-300/40 opacity-100 animate-pulse'
                        : 'bg-sky-500/20 opacity-40 group-hover:opacity-75'
                    }`}
                  />
                  <div className="relative w-24 h-24 lg:w-28 lg:h-28 rounded-full overflow-hidden border-2 border-[#38bdf8] shadow-[0_0_24px_rgba(56,189,248,0.5)] bg-[#0c1a24]">
                    <img
                      src={seedWorldImg}
                      alt="World"
                      loading="lazy"
                      decoding="async"
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                    <div className="absolute bottom-2 inset-x-0 flex justify-center">
                      <span className="px-2 py-0.5 rounded bg-sky-950/80 border border-sky-400/50 text-[10px] font-mono text-sky-200 uppercase font-bold truncate max-w-[85%]">
                        {world.name || 'Realm'}
                      </span>
                    </div>
                  </div>
                  {finalizedNodes.world && (
                    <div className="absolute -top-1 -right-1 w-7 h-7 rounded-full bg-sky-400 text-black flex items-center justify-center shadow-lg shadow-sky-400/50">
                      <CheckCircle2 size={16} className="stroke-[3]" />
                    </div>
                  )}
                </motion.button>

                <div
                  onClick={() => setActiveModal('world')}
                  className="absolute top-full mt-2 px-3.5 py-2 rounded-xl bg-[#0b1622]/95 border border-sky-500/40 backdrop-blur-md shadow-2xl text-center w-max max-w-[210px] lg:max-w-[240px] cursor-pointer hover:border-sky-400 transition-colors pointer-events-auto"
                >
                  <h3 className="font-display font-bold text-xs sm:text-sm text-[#bae6fd] tracking-wider uppercase flex items-center justify-center gap-1.5">
                    <Globe size={13} className="text-sky-400" />
                    <span>WORLD</span>
                  </h3>
                  <p className="font-display text-xs text-sky-300/90 truncate font-semibold mt-0.5">
                    {world.name || 'Custom Realm'}
                  </p>
                  <ul className="text-[10px] sm:text-[11px] text-[#93c5fd]/90 text-left mt-1 space-y-0.5 font-sans">
                    <li className="truncate">• Tone: {world.genreTone || 'Fantasy'}</li>
                    <li className="truncate">• Sites: {world.locationsList?.length || 0} Locations</li>
                    <li className="truncate">• Powers: {world.factionsList?.length || 0} Factions</li>
                  </ul>
                </div>
              </div>

              {/* PC 3. NPCs NODE (RIGHT) */}
              <div className="absolute top-[45.8%] left-[80%] -translate-x-1/2 -translate-y-1/2 z-10 flex flex-col items-center">
                <motion.button
                  whileHover={{ scale: 1.06 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setActiveModal('npcs')}
                  className="relative group cursor-pointer focus:outline-none"
                >
                  <div
                    className={`sw-aura absolute -inset-2.5 rounded-full transition-all duration-500 blur-md ${
                      finalizedNodes.npcs
                        ? 'bg-gradient-to-tr from-emerald-500/60 to-teal-300/40 opacity-100 animate-pulse'
                        : 'bg-emerald-500/20 opacity-40 group-hover:opacity-75'
                    }`}
                  />
                  <div className="relative w-24 h-24 lg:w-28 lg:h-28 rounded-full overflow-hidden border-2 border-[#10b981] shadow-[0_0_24px_rgba(16,185,129,0.5)] bg-[#0a1a14]">
                    <img
                      src={seedNpcsImg}
                      alt="NPCs"
                      loading="lazy"
                      decoding="async"
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                    <div className="absolute bottom-2 inset-x-0 flex justify-center">
                      <span className="px-2 py-0.5 rounded bg-emerald-950/80 border border-emerald-400/50 text-[10px] font-mono text-emerald-200 uppercase font-bold">
                        {npcs.length} Cast
                      </span>
                    </div>
                  </div>
                  {finalizedNodes.npcs && (
                    <div className="absolute -top-1 -right-1 w-7 h-7 rounded-full bg-emerald-400 text-black flex items-center justify-center shadow-lg shadow-emerald-400/50">
                      <CheckCircle2 size={16} className="stroke-[3]" />
                    </div>
                  )}
                </motion.button>

                <div
                  onClick={() => setActiveModal('npcs')}
                  className="absolute top-full mt-2 px-3.5 py-2 rounded-xl bg-[#091a13]/95 border border-emerald-500/40 backdrop-blur-md shadow-2xl text-center w-max max-w-[210px] lg:max-w-[240px] cursor-pointer hover:border-emerald-400 transition-colors pointer-events-auto"
                >
                  <h3 className="font-display font-bold text-xs sm:text-sm text-[#a7f3d0] tracking-wider uppercase flex items-center justify-center gap-1.5">
                    <Users size={13} className="text-emerald-400" />
                    <span>NPCS</span>
                  </h3>
                  <p className="font-display text-xs text-emerald-300/90 truncate font-semibold mt-0.5">
                    {npcs.length} Key Characters
                  </p>
                  <ul className="text-[10px] sm:text-[11px] text-[#6ee7b7]/90 text-left mt-1 space-y-0.5 font-sans">
                    <li className="truncate">• Starting Roster: Mapped</li>
                    <li className="truncate">• Bonds & Gear: Configured</li>
                  </ul>
                </div>
              </div>

              {/* PC 4. NARRATIVE NODE (BOTTOM) */}
              <div className="absolute top-[75.8%] left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 flex flex-col items-center">
                <motion.button
                  whileHover={canUnlockNarrative ? { scale: 1.08 } : {}}
                  whileTap={canUnlockNarrative ? { scale: 0.95 } : {}}
                  onClick={() => {
                    if (canUnlockNarrative) setActiveModal('narrative')
                  }}
                  disabled={!canUnlockNarrative}
                  className={`relative group cursor-pointer focus:outline-none ${
                    !canUnlockNarrative ? 'opacity-70 cursor-not-allowed filter grayscale-[40%]' : ''
                  }`}
                >
                  <div
                    className={`sw-aura absolute -inset-3 rounded-full transition-all duration-700 blur-lg ${
                      canUnlockNarrative
                        ? 'bg-gradient-to-tr from-purple-600 via-fuchsia-500 to-indigo-400 opacity-90 animate-pulse'
                        : 'bg-purple-900/20 opacity-30'
                    }`}
                  />
                  <div
                    className={`relative w-24 h-24 lg:w-28 lg:h-28 rounded-full overflow-hidden border-2 transition-all duration-500 bg-[#160c24] ${
                      canUnlockNarrative
                        ? 'border-[#c084fc] shadow-[0_0_30px_rgba(192,132,252,0.8)] ring-4 ring-purple-500/30'
                        : 'border-purple-900/60 shadow-none'
                    }`}
                  >
                    <img
                      src={seedNarrativeImg}
                      alt="Narrative Portal"
                      loading="lazy"
                      decoding="async"
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />

                    {!canUnlockNarrative && (
                      <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center text-purple-300">
                        <Lock size={20} className="text-purple-300/80 mb-0.5" />
                        <span className="text-[9px] font-mono tracking-wider uppercase font-bold text-purple-300/70">
                          Sealed
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Circular Check Indicator matching other 3 nodes (No "Ready to Dive" text) */}
                  {canUnlockNarrative && (
                    <div className="absolute -top-1 -right-1 w-7 h-7 rounded-full bg-purple-500 text-black flex items-center justify-center shadow-lg shadow-purple-500/50">
                      <CheckCircle2 size={16} className="stroke-[3]" />
                    </div>
                  )}
                </motion.button>

                <div
                  onClick={() => {
                    if (canUnlockNarrative) setActiveModal('narrative')
                  }}
                  className={`absolute top-full mt-2 px-3.5 py-2 rounded-xl backdrop-blur-md shadow-2xl text-center w-max max-w-[210px] lg:max-w-[240px] transition-all pointer-events-auto ${
                    canUnlockNarrative
                      ? 'bg-[#1b0f2e]/95 border border-purple-400/60 hover:border-purple-300 cursor-pointer shadow-purple-950/50'
                      : 'bg-[#120a20]/80 border border-purple-900/30 text-purple-400/60'
                  }`}
                >
                  <h3 className="font-display font-bold text-xs sm:text-sm text-[#e9d5ff] tracking-wider uppercase flex items-center justify-center gap-1.5">
                    <BookOpen size={13} className="text-purple-400" />
                    <span>NARRATIVE</span>
                  </h3>
                  <p className="font-display text-xs text-purple-300/90 truncate font-semibold mt-0.5">
                    {narrative.title || 'Prologue & Dive'}
                  </p>
                  <ul className="text-[10px] sm:text-[11px] text-[#d8b4fe]/90 text-left mt-1 space-y-0.5 font-sans">
                    <li className="truncate">• Style: {narrative.narrationStyle ? 'Configured' : 'Default'}</li>
                    <li className="truncate">• Hook: {narrative.opening ? 'Defined' : 'Default'}</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Bottom Call to Action Bar: "Dive In" */}
          <div className="w-full max-w-sm sm:max-w-md mx-auto mt-auto pt-2 pb-1 flex flex-col items-center gap-2">
            {canUnlockNarrative ? (
              <motion.button
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={handleIgniteDive}
                className="w-full py-2.5 sm:py-3.5 px-6 rounded-2xl bg-gradient-to-r from-amber-500 via-purple-600 to-indigo-600 hover:from-amber-400 hover:via-purple-500 hover:to-indigo-500 text-white font-display font-bold text-xs sm:text-sm tracking-widest uppercase shadow-[0_0_25px_rgba(168,85,247,0.6)] flex items-center justify-center gap-2 border border-yellow-200/50 cursor-pointer transition-all"
              >
                <Sparkles size={16} className="text-yellow-300 animate-spin shrink-0" />
                <span>Dive In</span>
                <Play size={14} className="fill-current shrink-0" />
              </motion.button>
            ) : (
              <div className="w-full py-2 px-3.5 rounded-xl bg-[#110c1c]/80 border border-[#e8ca8a]/20 text-center flex items-center justify-center gap-2 text-xs font-narrative italic text-[#d8c49e]/90">
                <Lock size={13} className="text-purple-400 shrink-0" />
                <span>Finalize Protagonist, World, and NPCs to unlock the Narrative Dive.</span>
              </div>
            )}
          </div>
        </main>
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
