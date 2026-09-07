import { useState } from 'react'
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
  // --- Active Seed Data State ---
  // isMaster: false is deliberate, not redundant with App.tsx's own upsert
  // guard — VIOLET_SORRENGAIL/FOURTH_WING_WORLD carry isMaster: true
  // themselves (they ARE the master template), so spreading them onto a
  // fresh seed_*-prefixed draft id without overriding it here would leave
  // this draft mislabeled as "master" for as long as it's only living in
  // local component state (e.g. any live preview before the player ever
  // saves it as a preset).
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
            alt="World Seed Background"
            decoding="async"
            className="w-full h-full object-cover object-center scale-105 filter brightness-[0.7] contrast-[1.1] transition-all duration-1000"
          />
        </picture>
        {/* Mystic Vignette & Astral Gradients */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#050308]/75 via-[#080512]/45 to-[#05030a]/90" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(99,102,241,0.12),transparent_70%)]" />
      </div>

      {/* Atmospheric Central Sparks — purely decorative, and the single
          heaviest continuous cost on this screen (two 384px layers, each
          blurred at a large radius, pulsing forever). Hidden on mobile via
          .sw-spark (index.css) rather than lightened, since they carry no
          information and desktop is where the GPU headroom to render them
          nicely actually exists. Also unmounted outright whenever a node
          modal is open (see the !activeModal gate on <main> below) — a
          node form's own backdrop was sitting over these still-animating
          layers, forcing continuous re-blur on every frame while editing. */}
      {/* Ambient background scrim (GPU-friendly, no distracting pulsing) */}
      {!activeModal && (
        <div className="absolute inset-0 z-0 pointer-events-none opacity-30 overflow-hidden">
          <div className="sw-spark absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-amber-500/10 blur-3xl" />
        </div>
      )}

      {/* Screen Header Bar */}
      <header
        className="relative z-20 shrink-0 flex items-center justify-between px-4 py-3 max-w-5xl mx-auto w-full"
        style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}
      >
        <button
          onClick={onBack}
          aria-label="Back to Main Menu"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#140f24]/80 hover:bg-[#1f1738] border border-[#e8ca8a]/30 text-[#fae5b5] text-xs font-display font-semibold transition-all active:scale-95 shadow-lg shadow-black/40 cursor-pointer"
        >
          <ArrowLeft size={15} />
          <span>Exit</span>
        </button>

        {/* Center Grand Title */}
        <div className="text-center flex flex-col items-center">
          <div className="flex items-center gap-2">
            <span className="w-6 h-[1px] bg-gradient-to-r from-transparent to-[#e8ca8a]/60" />
            <h1 className="font-display font-bold text-xl sm:text-2xl tracking-[0.2em] text-[#fae5b5] drop-shadow-[0_2px_12px_rgba(232,202,138,0.4)] uppercase">
              WORLD SEED
            </h1>
            <span className="w-6 h-[1px] bg-gradient-to-l from-transparent to-[#e8ca8a]/60" />
          </div>
          <div className="flex items-center gap-1.5 text-[10px] tracking-[0.25em] font-display font-medium text-[#d8c49e]/80 uppercase mt-0.5">
            <Sparkles size={10} className="text-[#f0ca65]" />
            <span>SHAPE YOUR JOURNEY</span>
            <Sparkles size={10} className="text-[#f0ca65]" />
          </div>
        </div>

        {/* Quick Reset action */}
        <button
          onClick={() => {
            setProtagonist({ ...VIOLET_SORRENGAIL, id: 'seed_protag_' + Date.now(), isMaster: false })
            setWorld({ ...FOURTH_WING_WORLD, id: 'seed_world_' + Date.now(), isMaster: false })
            setNpcs(DEFAULT_STARTER_NPCS)
            setFinalizedNodes({ protagonist: true, world: true, npcs: true, narrative: false })
          }}
          title="Reset to Template"
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-[#140f24]/80 hover:bg-[#1f1738] border border-[#e8ca8a]/20 text-[#d8c49e] text-xs font-display transition-all active:scale-95 cursor-pointer"
        >
          <RotateCcw size={13} />
          <span className="hidden sm:inline">Reset</span>
        </button>
      </header>

      {/* Main Celestial Nexus / Leyline Constellation Container — gated
          behind !activeModal so it (and its several continuously-animated,
          blurred glow layers) stops rendering entirely the moment a node
          modal opens, instead of running on underneath a backdrop-blur
          that then has to re-sample it every frame. This was the real
          cause of lag on typing/tab-switching inside a node form, not
          just on open — a modal's own React work is cheap; a live,
          animating layer behind a blurred glass sheet is not. */}
      {!activeModal && (
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center p-2 sm:p-4 min-h-0 overflow-y-auto">
        <div className="relative w-full max-w-xl aspect-square max-h-[70vh] flex items-center justify-center my-auto">
          {/* Animated SVG Ley-Lines & Star Nexus */}
          <svg
            className="absolute inset-0 w-full h-full pointer-events-none z-0 overflow-visible"
            viewBox="0 0 400 400"
          >
            <defs>
              <linearGradient id="leyline-gold" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.8" />
              </linearGradient>
              <linearGradient id="leyline-cyan" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#10b981" stopOpacity="0.8" />
              </linearGradient>
              <linearGradient id="leyline-emerald" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#10b981" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#a855f7" stopOpacity="0.8" />
              </linearGradient>
              <linearGradient id="leyline-purple" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#a855f7" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.8" />
              </linearGradient>

              {/* Radiant Diamond Gradients connecting the 4 nodes */}
              <linearGradient id="diamond-gradient" x1="200" y1="65" x2="200" y2="285" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.8" />
                <stop offset="50%" stopColor="#38bdf8" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#c084fc" stopOpacity="0.85" />
              </linearGradient>
              <linearGradient id="leyline-top-left" x1="200" y1="65" x2="90" y2="175" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.85" />
                <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.85" />
              </linearGradient>
              <linearGradient id="leyline-top-right" x1="200" y1="65" x2="310" y2="175" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.85" />
                <stop offset="100%" stopColor="#10b981" stopOpacity="0.85" />
              </linearGradient>
              <linearGradient id="leyline-left-bottom" x1="90" y1="175" x2="200" y2="285" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.85" />
                <stop offset="100%" stopColor="#a855f7" stopOpacity="0.85" />
              </linearGradient>
              <linearGradient id="leyline-right-bottom" x1="310" y1="175" x2="200" y2="285" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#10b981" stopOpacity="0.85" />
                <stop offset="100%" stopColor="#a855f7" stopOpacity="0.85" />
              </linearGradient>

              {/* Glowing Filter */}
              <filter id="glow-leyline" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>

            {/* Spinning Dashed Outer Boundary Ring */}
            <polygon
              points="200,65 310,175 200,285 90,175"
              fill="none"
              stroke="rgba(232,202,138,0.2)"
              strokeWidth="1.5"
              strokeDasharray="4 6"
              className="animate-[spin_120s_linear_infinite]"
              style={{ transformOrigin: '200px 175px' }}
            />

            {/* Fixed Diamond Shape with Gradient aligned to all 4 node centers */}
            <polygon
              points="200,65 310,175 200,285 90,175"
              fill="none"
              stroke="url(#diamond-gradient)"
              strokeWidth="2"
              filter="url(#glow-leyline)"
            />

            {/* Central Leyline Cross connecting all 4 nodes */}
            <line
              x1="200"
              y1="65"
              x2="200"
              y2="285"
              stroke={canUnlockNarrative ? 'url(#leyline-purple)' : 'rgba(232,202,138,0.3)'}
              strokeWidth={canUnlockNarrative ? '2.5' : '1.5'}
              filter="url(#glow-leyline)"
              className="transition-all duration-700"
            />
            <line
              x1="90"
              y1="175"
              x2="310"
              y2="175"
              stroke="url(#leyline-gold)"
              strokeWidth="2"
              filter="url(#glow-leyline)"
            />

            {/* Diagonal Ley Lines connecting corner tips */}
            <line x1="200" y1="65" x2="90" y2="175" stroke="url(#leyline-top-left)" strokeWidth="1.5" filter="url(#glow-leyline)" />
            <line x1="200" y1="65" x2="310" y2="175" stroke="url(#leyline-top-right)" strokeWidth="1.5" filter="url(#glow-leyline)" />
            <line
              x1="90"
              y1="175"
              x2="200"
              y2="285"
              stroke={canUnlockNarrative ? 'url(#leyline-left-bottom)' : 'rgba(56,189,248,0.25)'}
              strokeWidth="1.5"
              filter="url(#glow-leyline)"
            />
            <line
              x1="310"
              y1="175"
              x2="200"
              y2="285"
              stroke={canUnlockNarrative ? 'url(#leyline-right-bottom)' : 'rgba(16,185,129,0.25)'}
              strokeWidth="1.5"
              filter="url(#glow-leyline)"
            />

            {/* Central Astral Starburst Nexus (Stationary, Clean, No Ping) */}
            <circle
              cx="200"
              cy="175"
              r={canUnlockNarrative ? '14' : '10'}
              fill={canUnlockNarrative ? 'rgba(168,85,247,0.25)' : 'rgba(232,202,138,0.15)'}
            />
            <circle
              cx="200"
              cy="175"
              r="7"
              fill={canUnlockNarrative ? '#d8b4fe' : '#f0ca65'}
              filter="url(#glow-leyline)"
            />
            <path
              d="M200,160 L203,172 L215,175 L203,178 L200,190 L197,178 L185,175 L197,172 Z"
              fill="#ffffff"
            />
          </svg>

          {/* ========================================================= */}
          {/* 1. TOP NODE: PROTAGONIST (Gold / Amber) */}
          {/* ========================================================= */}
          <div className="absolute top-[16.25%] left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 flex flex-col items-center">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setActiveModal('protagonist')}
              className="relative group cursor-pointer focus:outline-none"
            >
              {/* Glowing Aura Ring */}
              <div
                className={`sw-aura absolute -inset-2 rounded-full transition-all duration-500 blur-md ${
                  finalizedNodes.protagonist
                    ? 'bg-gradient-to-tr from-amber-500/60 to-yellow-300/40 opacity-100 animate-pulse'
                    : 'bg-amber-500/20 opacity-40 group-hover:opacity-75'
                }`}
              />
              {/* Island Circular Frame */}
              <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-full overflow-hidden border-2 border-[#f0ca65] shadow-[0_0_20px_rgba(245,158,11,0.5)] bg-[#120e1d]">
                <picture>
                  <source media="(min-width: 769px)" srcSet={seedProtagImg} />
                  <img
                    src={seedProtagImgMobile}
                    alt="Protagonist"
                    loading="lazy"
                    decoding="async"
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                  />
                </picture>
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                <div className="absolute bottom-1.5 inset-x-0 flex justify-center">
                  <span className="px-1.5 py-0.5 rounded bg-amber-950/80 border border-amber-400/50 text-[9px] font-mono text-amber-200 uppercase font-bold truncate max-w-[85%]">
                    {protagonist.className || 'Hero'}
                  </span>
                </div>
              </div>

              {/* Ready Indicator Badge */}
              {finalizedNodes.protagonist && (
                <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-amber-500 text-black flex items-center justify-center shadow-lg shadow-amber-500/50">
                  <CheckCircle2 size={14} className="stroke-[3]" />
                </div>
              )}
            </motion.button>

            {/* Information Card Banner */}
            <div
              onClick={() => setActiveModal('protagonist')}
              className="absolute top-full mt-1.5 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-xl bg-[#151022]/90 border border-amber-500/40 backdrop-blur-md shadow-xl text-center w-max max-w-[150px] sm:max-w-[185px] cursor-pointer hover:border-amber-400 transition-colors pointer-events-auto"
            >
              <h3 className="font-display font-bold text-xs sm:text-sm text-[#fae5b5] tracking-wide uppercase flex items-center justify-center gap-1">
                <User size={12} className="text-amber-400" />
                <span>PROTAGONIST</span>
              </h3>
              <p className="font-display text-[10px] text-amber-300/90 truncate font-semibold">
                {protagonist.name || 'Unnamed Hero'}
              </p>
              <ul className="text-[9px] text-[#d8c49e]/80 text-left mt-0.5 space-y-0.2 font-sans">
                <li className="truncate">• Class: {protagonist.className || 'Adventurer'}</li>
                <li className="truncate">• Origin: {protagonist.gender || 'Any'}, {protagonist.age || 20}y</li>
                <li className="truncate">• Skills: {protagonist.startingSkills?.length || 0} Abilities</li>
              </ul>
            </div>
          </div>

          {/* ========================================================= */}
          {/* 2. LEFT NODE: WORLD (Cyan / Azure) */}
          {/* ========================================================= */}
          <div className="absolute top-[43.75%] left-[22.5%] -translate-x-1/2 -translate-y-1/2 z-10 flex flex-col items-center">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setActiveModal('world')}
              className="relative group cursor-pointer focus:outline-none"
            >
              <div
                className={`sw-aura absolute -inset-2 rounded-full transition-all duration-500 blur-md ${
                  finalizedNodes.world
                    ? 'bg-gradient-to-tr from-sky-500/60 to-cyan-300/40 opacity-100 animate-pulse'
                    : 'bg-sky-500/20 opacity-40 group-hover:opacity-75'
                }`}
              />
              <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-full overflow-hidden border-2 border-[#38bdf8] shadow-[0_0_20px_rgba(56,189,248,0.5)] bg-[#0c1a24]">
                <picture>
                  <source media="(min-width: 769px)" srcSet={seedWorldImg} />
                  <img
                    src={seedWorldImgMobile}
                    alt="World"
                    loading="lazy"
                    decoding="async"
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                  />
                </picture>
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                <div className="absolute bottom-1.5 inset-x-0 flex justify-center">
                  <span className="px-1.5 py-0.5 rounded bg-sky-950/80 border border-sky-400/50 text-[9px] font-mono text-sky-200 uppercase font-bold truncate max-w-[85%]">
                    {world.name || 'Realm'}
                  </span>
                </div>
              </div>

              {finalizedNodes.world && (
                <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-sky-400 text-black flex items-center justify-center shadow-lg shadow-sky-400/50">
                  <CheckCircle2 size={14} className="stroke-[3]" />
                </div>
              )}
            </motion.button>

            <div
              onClick={() => setActiveModal('world')}
              className="absolute top-full mt-1.5 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-xl bg-[#0b1622]/90 border border-sky-500/40 backdrop-blur-md shadow-xl text-center w-max max-w-[145px] sm:max-w-[175px] cursor-pointer hover:border-sky-400 transition-colors pointer-events-auto"
            >
              <h3 className="font-display font-bold text-xs sm:text-sm text-[#bae6fd] tracking-wide uppercase flex items-center justify-center gap-1">
                <Globe size={12} className="text-sky-400" />
                <span>WORLD</span>
              </h3>
              <p className="font-display text-[10px] text-sky-300/90 truncate font-semibold">
                {world.name || 'Custom Realm'}
              </p>
              <ul className="text-[9px] text-[#93c5fd]/80 text-left mt-0.5 space-y-0.2 font-sans">
                <li className="truncate">• Tone: {world.genreTone || 'Fantasy'}</li>
                <li className="truncate">• Sites: {world.locationsList?.length || 0} Locations</li>
                <li className="truncate">• Powers: {world.factionsList?.length || 0} Factions</li>
              </ul>
            </div>
          </div>

          {/* ========================================================= */}
          {/* 3. RIGHT NODE: NPCs (Emerald / Jade) */}
          {/* ========================================================= */}
          <div className="absolute top-[43.75%] left-[77.5%] -translate-x-1/2 -translate-y-1/2 z-10 flex flex-col items-center">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setActiveModal('npcs')}
              className="relative group cursor-pointer focus:outline-none"
            >
              <div
                className={`sw-aura absolute -inset-2 rounded-full transition-all duration-500 blur-md ${
                  finalizedNodes.npcs
                    ? 'bg-gradient-to-tr from-emerald-500/60 to-teal-300/40 opacity-100 animate-pulse'
                    : 'bg-emerald-500/20 opacity-40 group-hover:opacity-75'
                }`}
              />
              <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-full overflow-hidden border-2 border-[#10b981] shadow-[0_0_20px_rgba(16,185,129,0.5)] bg-[#0a1a14]">
                <picture>
                  <source media="(min-width: 769px)" srcSet={seedNpcsImg} />
                  <img
                    src={seedNpcsImgMobile}
                    alt="NPCs"
                    loading="lazy"
                    decoding="async"
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                  />
                </picture>
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                <div className="absolute bottom-1.5 inset-x-0 flex justify-center">
                  <span className="px-1.5 py-0.5 rounded bg-emerald-950/80 border border-emerald-400/50 text-[9px] font-mono text-emerald-200 uppercase font-bold">
                    {npcs.length} Cast
                  </span>
                </div>
              </div>

              {finalizedNodes.npcs && (
                <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-emerald-400 text-black flex items-center justify-center shadow-lg shadow-emerald-400/50">
                  <CheckCircle2 size={14} className="stroke-[3]" />
                </div>
              )}
            </motion.button>

            <div
              onClick={() => setActiveModal('npcs')}
              className="absolute top-full mt-1.5 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-xl bg-[#091a13]/90 border border-emerald-500/40 backdrop-blur-md shadow-xl text-center w-max max-w-[145px] sm:max-w-[175px] cursor-pointer hover:border-emerald-400 transition-colors pointer-events-auto"
            >
              <h3 className="font-display font-bold text-xs sm:text-sm text-[#a7f3d0] tracking-wide uppercase flex items-center justify-center gap-1">
                <Users size={12} className="text-emerald-400" />
                <span>NPCs</span>
              </h3>
              <p className="font-display text-[10px] text-emerald-300/90 truncate font-semibold">
                {npcs.length} Key Characters
              </p>
              <ul className="text-[9px] text-[#6ee7b7]/80 text-left mt-0.5 space-y-0.2 font-sans">
                <li className="truncate">• Starting Roster: Mapped</li>
                <li className="truncate">• Bonds & Gear: Configured</li>
              </ul>
            </div>
          </div>

          {/* ========================================================= */}
          {/* 4. BOTTOM NODE: NARRATIVE (Purple / Arcane Violet) */}
          {/* ========================================================= */}
          <div className="absolute top-[71.25%] left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 flex flex-col items-center">
            <motion.button
              whileHover={canUnlockNarrative ? { scale: 1.08 } : {}}
              whileTap={canUnlockNarrative ? { scale: 0.95 } : {}}
              onClick={() => {
                if (canUnlockNarrative) {
                  setActiveModal('narrative')
                }
              }}
              disabled={!canUnlockNarrative}
              className={`relative group cursor-pointer focus:outline-none ${
                !canUnlockNarrative ? 'opacity-70 cursor-not-allowed filter grayscale-[40%]' : ''
              }`}
            >
              {/* Glowing Radiant Purple Aura */}
              <div
                className={`sw-aura absolute -inset-3 rounded-full transition-all duration-700 blur-lg ${
                  canUnlockNarrative
                    ? 'bg-gradient-to-tr from-purple-600 via-fuchsia-500 to-indigo-400 opacity-90 animate-pulse'
                    : 'bg-purple-900/20 opacity-30'
                }`}
              />

              <div
                className={`relative w-20 h-20 sm:w-24 sm:h-24 rounded-full overflow-hidden border-2 transition-all duration-500 bg-[#160c24] ${
                  canUnlockNarrative
                    ? 'border-[#c084fc] shadow-[0_0_30px_rgba(192,132,252,0.8)] ring-4 ring-purple-500/30'
                    : 'border-purple-900/60 shadow-none'
                }`}
              >
                <picture>
                  <source media="(min-width: 769px)" srcSet={seedNarrativeImg} />
                  <img
                    src={seedNarrativeImgMobile}
                    alt="Narrative Portal"
                    loading="lazy"
                    decoding="async"
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                  />
                </picture>
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />

                {/* Arcane Lock overlay when sealed */}
                {!canUnlockNarrative && (
                  <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center text-purple-300">
                    <Lock size={20} className="text-purple-300/80 mb-0.5" />
                    <span className="text-[9px] font-mono tracking-wider uppercase font-bold text-purple-300/70">
                      Sealed
                    </span>
                  </div>
                )}

                {canUnlockNarrative && (
                  <div className="absolute bottom-1.5 inset-x-0 flex justify-center">
                    <span className="px-2 py-0.5 rounded bg-purple-950/90 border border-purple-400/60 text-[9px] font-mono text-purple-200 uppercase font-bold animate-pulse">
                      Ready to Dive
                    </span>
                  </div>
                )}
              </div>
            </motion.button>

            <div
              onClick={() => {
                if (canUnlockNarrative) setActiveModal('narrative')
              }}
              className={`absolute top-full mt-1.5 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-xl backdrop-blur-md shadow-xl text-center w-max max-w-[150px] sm:max-w-[185px] transition-all pointer-events-auto ${
                canUnlockNarrative
                  ? 'bg-[#1b0f2e]/95 border border-purple-400/60 hover:border-purple-300 cursor-pointer shadow-purple-950/50'
                  : 'bg-[#120a20]/75 border border-purple-900/30 text-purple-400/60'
              }`}
            >
              <h3 className="font-display font-bold text-xs sm:text-sm text-[#e9d5ff] tracking-wide uppercase flex items-center justify-center gap-1">
                <BookOpen size={12} className="text-purple-400" />
                <span>NARRATIVE</span>
              </h3>
              <p className="font-display text-[10px] text-purple-300/90 truncate font-semibold">
                {narrative.title || 'Prologue & Dive'}
              </p>
              <ul className="text-[9px] text-[#d8b4fe]/80 text-left mt-0.5 space-y-0.2 font-sans">
                <li className="truncate">• Style: {narrative.narrationStyle ? 'Configured' : 'Default'}</li>
                <li className="truncate">• Hook: {narrative.opening ? 'Defined' : 'Default'}</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Bottom Call to Action Bar */}
        <div className="w-full max-w-md mx-auto mt-auto pt-2 pb-1 flex flex-col items-center gap-2">
          {canUnlockNarrative ? (
            <motion.button
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={handleIgniteDive}
              className="w-full py-2.5 sm:py-3 px-5 sm:px-6 rounded-2xl bg-gradient-to-r from-amber-500 via-purple-600 to-indigo-600 hover:from-amber-400 hover:via-purple-500 hover:to-indigo-500 text-white font-display font-bold text-xs sm:text-sm tracking-wider uppercase shadow-[0_0_25px_rgba(168,85,247,0.6)] flex items-center justify-center gap-2 border border-yellow-200/50 cursor-pointer"
            >
              <Sparkles size={16} className="text-yellow-300 animate-spin shrink-0" />
              <span>Ignite Tale Dive</span>
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
      {/* 5. MODAL DIALOGS FOR EACH NODE — plain conditional render, no
          enter/exit animation (instant open/close, per explicit direction;
          also lets the constellation behind it finish unmounting on the
          same frame instead of an animation racing it). */}
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
