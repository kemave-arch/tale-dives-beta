import { useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { ChevronLeft, Lock, Sparkles } from 'lucide-react'
import ProtagonistChapter from '../components/novelweaver/ProtagonistChapter.tsx'
import WorldChapter from '../components/novelweaver/WorldChapter.tsx'
import CastChapter from '../components/novelweaver/CastChapter.tsx'
import NarrativeChapter from '../components/novelweaver/NarrativeChapter.tsx'
import { GOLD, INK } from '../components/novelweaver/shared.tsx'
import type { CastMember, ChapterId, FinalizedState, NarrativeSeed, NovelWeaverProps } from '../components/novelweaver/types.ts'
import type { ProtagonistData, WorldData } from '../types.ts'

// Novel Weaver — an isolated alternate Tale-creation UI, reachable from
// MainMenu alongside (not instead of) the existing WorldSetup/NewGame/
// TaleBrief flow and AI Studio's own World Seed Weaver. Same underlying
// idea as that constellation UI — four gated nodes feeding the same Codex
// seeding pipeline — executed as a vertical "manuscript" instead: a chapter
// list the player drills into one at a time, no large painted backgrounds.

const BLANK_PROTAGONIST: ProtagonistData = { name: '', classId: 'warrior', opening: '' }
const BLANK_WORLD: Partial<WorldData> = {}
const BLANK_NARRATIVE: NarrativeSeed = { title: '', opening: '', narrationStyle: '', combatMode: 'NARRATIVE' }

const CHAPTERS: { id: ChapterId; numeral: string; title: string; blurb: string; accent: string }[] = [
  { id: 'protagonist', numeral: 'I', title: 'Protagonist', blurb: 'Who they are', accent: '#e8ca8a' },
  { id: 'world', numeral: 'II', title: 'World', blurb: 'Where it happens', accent: '#8ac6e8' },
  { id: 'cast', numeral: 'III', title: 'Cast', blurb: "Who they'll meet", accent: '#a8e8c6' },
  { id: 'narrative', numeral: 'IV', title: 'Narrative', blurb: 'How it begins', accent: '#e8a8c6' },
]

export default function NovelWeaver({
  worldTemplates = [],
  protagonistTemplates = [],
  existingTitles = [],
  onBack,
  onSaveProtagonistPreset,
  onSaveWorldPreset,
  onDeleteProtagonistPreset,
  onDeleteWorldPreset,
  onBeginTale,
}: NovelWeaverProps) {
  const [protagonist, setProtagonist] = useState<ProtagonistData>(BLANK_PROTAGONIST)
  const [world, setWorld] = useState<Partial<WorldData>>(BLANK_WORLD)
  const [cast, setCast] = useState<CastMember[]>([])
  const [narrative, setNarrative] = useState<NarrativeSeed>(BLANK_NARRATIVE)
  const [finalized, setFinalized] = useState<FinalizedState>({ protagonist: false, world: false, cast: false, narrative: false })
  const [active, setActive] = useState<ChapterId | null>(null)

  const protagonistReady = protagonist.name.trim().length > 0 && Boolean(protagonist.classId)
  const worldReady = Boolean(world.name?.trim()) && Boolean(world.background?.trim())
  const castReady = true
  const allThreeFinalized = finalized.protagonist && finalized.world && finalized.cast

  function finalize(id: Exclude<ChapterId, 'narrative'>) {
    setFinalized((f) => ({ ...f, [id]: true }))
    setActive(null)
  }

  function beginTale() {
    onBeginTale(
      { ...protagonist, opening: narrative.opening },
      narrative.combatMode,
      world,
      narrative.title.trim(),
      cast
    )
  }

  return (
    <div className="fixed inset-0 z-30 flex flex-col" style={{ background: INK }}>
      <div className="shrink-0 flex items-center gap-3 px-4 py-3" style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))', borderBottom: '1px solid #3a325230' }}>
        <button onClick={onBack} aria-label="Back to menu" className="w-8 h-8 rounded-full flex items-center justify-center border border-[#3a3252] text-[#d8cbb0] hover:border-[#e8ca8a] transition-colors shrink-0">
          <ChevronLeft size={16} />
        </button>
        <div>
          <h1 className="font-display font-bold text-sm tracking-[0.1em] uppercase text-[#f5dfa0]">Novel Weaver</h1>
          <p className="font-sans text-[10px] text-[#9d93bd]">Four chapters, one Tale</p>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-5 flex flex-col gap-3">
        {CHAPTERS.map((c) => {
          const isNarrative = c.id === 'narrative'
          const isFinalized = !isNarrative && finalized[c.id]
          const locked = isNarrative && !allThreeFinalized
          return (
            <button
              key={c.id}
              type="button"
              disabled={locked}
              onClick={() => setActive(c.id)}
              className={`relative text-left rounded-2xl p-4 flex items-center gap-3.5 border transition-all ${
                locked ? 'border-[#2a2438] bg-[#0e0b16] opacity-50 cursor-not-allowed' : 'border-[#3a3252] bg-[#161221] hover:border-[#e8ca8a]/50'
              }`}
              style={
                isFinalized
                  ? { borderColor: c.accent, boxShadow: `0 0 18px 1px ${c.accent}40, inset 0 0 12px ${c.accent}18` }
                  : undefined
              }
            >
              <div
                className="w-11 h-11 rounded-full flex items-center justify-center font-display font-bold text-sm shrink-0 border-2"
                style={
                  isFinalized
                    ? { borderColor: c.accent, color: c.accent, boxShadow: `0 0 14px 2px ${c.accent}60`, animation: 'nw-pulse 2.4s ease-in-out infinite' }
                    : { borderColor: '#3a3252', color: '#9d93bd' }
                }
              >
                {locked ? <Lock size={16} /> : c.numeral}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <h2 className="font-display font-bold text-[13px] tracking-wide uppercase text-[#f5dfa0]">{c.title}</h2>
                  {isFinalized && <Sparkles size={12} style={{ color: c.accent }} />}
                </div>
                <p className="font-sans text-[11px] text-[#9d93bd] truncate">
                  {locked ? 'Finalize Protagonist, World & Cast first' : c.blurb}
                </p>
              </div>
              {isFinalized && (
                <span className="shrink-0 font-mono text-[10px] uppercase tracking-wide" style={{ color: c.accent }}>
                  Ready
                </span>
              )}
            </button>
          )
        })}

        <p className="text-center font-sans text-[10.5px] text-[#6b6285] italic mt-1">
          Visit chapters in any order — Narrative unlocks once the first three glow.
        </p>
      </div>

      <style>{`@keyframes nw-pulse { 0%, 100% { box-shadow: 0 0 14px 2px ${GOLD}60; } 50% { box-shadow: 0 0 22px 5px ${GOLD}90; } }`}</style>

      <AnimatePresence>
        {active === 'protagonist' && (
          <ProtagonistChapter
            value={protagonist}
            onChange={setProtagonist}
            ready={protagonistReady}
            onFinalize={() => finalize('protagonist')}
            onBack={() => setActive(null)}
            templates={protagonistTemplates}
            onSavePreset={onSaveProtagonistPreset}
            onDeletePreset={onDeleteProtagonistPreset}
          />
        )}
        {active === 'world' && (
          <WorldChapter
            value={world}
            onChange={setWorld}
            ready={worldReady}
            onFinalize={() => finalize('world')}
            onBack={() => setActive(null)}
            templates={worldTemplates}
            onSavePreset={onSaveWorldPreset}
            onDeletePreset={onDeleteWorldPreset}
          />
        )}
        {active === 'cast' && (
          <CastChapter
            value={cast}
            onChange={setCast}
            ready={castReady}
            onFinalize={() => finalize('cast')}
            onBack={() => setActive(null)}
          />
        )}
        {active === 'narrative' && allThreeFinalized && (
          <NarrativeChapter
            value={narrative}
            onChange={setNarrative}
            existingTitles={existingTitles}
            onBegin={beginTale}
            onBack={() => setActive(null)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
