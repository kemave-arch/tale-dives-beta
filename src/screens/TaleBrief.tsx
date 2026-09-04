import { useState } from 'react'
import { Info, X } from 'lucide-react'
import {
  FIELD_CLASS, GLASS_SURFACE, GlassCTAButton, GlassField, GlassHeader, GlassScreen, LABEL_CLASS,
} from '../lib/glassChrome.tsx'
import type { CombatMode } from '../types.ts'

interface TaleBriefPayload {
  opening: string
  narrationStyle: string
  temperature: number
  combatMode: CombatMode
}

interface TaleBriefProps {
  initialOpening?: string
  initialNarrationStyle: string
  initialTemperature: number
  initialCombatMode?: CombatMode
  editLongText: (label: string, value: string, hint?: string) => Promise<string | null>
  onBack: () => void
  onBegin: (payload: TaleBriefPayload) => void
}

const COMBAT_MODE_INFO: Record<CombatMode, string> = {
  NARRATIVE: 'The Narrator resolves fights from context — your exact move, footwork, and cleverness matter, the same way SOCIAL or EXPLORE turns are judged. No hidden math.',
  TACTICAL: 'Damage is computed client-side from your stats before the Narrator ever sees it — deterministic and precise, but the Narrator just describes the given result rather than judging your approach.',
}

// Tap-to-reveal, not hover-only — this app is mobile-first, so a tooltip that
// only works on :hover would be invisible on touch devices.
function InfoTooltip({ text }: { text: string }) {
  const [open, setOpen] = useState(false)
  return (
    <span className="relative inline-block align-middle ml-1">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="More info"
        className="w-4 h-4 rounded-full inline-flex items-center justify-center text-gold-primary/70 hover:text-gold-primary"
      >
        <Info size={13} />
      </button>
      {open && (
        <span className="absolute z-10 left-1/2 -translate-x-1/2 top-6 w-56 rounded-lg glass-panel glow-ring p-2.5 text-left">
          <span className="flex items-start justify-between gap-2">
            <span className="font-narrative text-xs text-ink leading-snug">{text}</span>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="shrink-0 text-ink-muted hover:text-ink">
              <X size={12} />
            </button>
          </span>
        </span>
      )}
    </span>
  )
}

// Blueprint Appendix A.3 — the free-text brief entered right before the world
// is fabricated, now its own final creation step. Narration Style/Creativity
// Randomness/Combat Mode are surfaced here too as a last check before diving
// in, even though they're not unique to this screen (Narration Style lives on
// the World, Creativity Randomness is the same global apiSettings.temperature
// Settings edits, Combat Mode is the new campaign's own field).
export default function TaleBrief({
  initialOpening = '',
  initialNarrationStyle,
  initialTemperature,
  initialCombatMode = 'NARRATIVE',
  editLongText,
  onBack,
  onBegin,
}: TaleBriefProps) {
  const [opening, setOpening] = useState(initialOpening)
  const [narrationStyle, setNarrationStyle] = useState(initialNarrationStyle)
  const [temperature, setTemperature] = useState(initialTemperature)
  const [combatMode, setCombatMode] = useState<CombatMode>(initialCombatMode)

  return (
    <GlassScreen ground="art" fill>
      <GlassHeader title="Tale Dive Brief" subtitle="Step 4 — where the first page opens" onBack={onBack} />

      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4">
        <div className="max-w-md mx-auto flex flex-col gap-4">
          <GlassField
            label="Where do you dive in?"
            hint="Optional — leave blank and the Narrator decides."
            onExpand={async () => {
              const result = await editLongText('Where do you dive in?', opening)
              if (result !== null) setOpening(result)
            }}
          >
            <textarea
              value={opening}
              onChange={(e) => setOpening(e.target.value)}
              placeholder="Describe the exact scene, location, and characters present where Turn 1 should open."
              rows={10}
              className={`${FIELD_CLASS} resize-y`}
            />
          </GlassField>

          <GlassField
            label="Narration Style"
            onExpand={async () => {
              const result = await editLongText('Narration Style', narrationStyle)
              if (result !== null) setNarrationStyle(result)
            }}
          >
            <textarea
              value={narrationStyle}
              onChange={(e) => setNarrationStyle(e.target.value)}
              rows={6}
              className={`${FIELD_CLASS} text-xs resize-y`}
            />
          </GlassField>

          <div>
            <p className={LABEL_CLASS}>
              Creativity Randomness <span className="opacity-60 font-mono normal-case tracking-normal">{temperature.toFixed(1)}</span>
            </p>
            <input
              type="range"
              min="0"
              max="2"
              step="0.1"
              value={temperature}
              onChange={(e) => setTemperature(Number(e.target.value))}
              className="w-full mt-2 accent-gold-action"
            />
            <p className="font-narrative text-[11px] text-ink-muted mt-1">
              How unpredictable the prose gets. Low keeps the Narrator steady and consistent; high adds more surprise and flourish.
            </p>
          </div>

          <div>
            <p className={LABEL_CLASS}>Combat Resolution Mode</p>
            {/* Not GlassSegmented: each option carries its own InfoTooltip, so
                the row stays hand-rolled — but matched to GlassSegmented's
                active/inactive treatment so it reads as the same control. */}
            <div className="flex gap-2 mt-2">
              {(['NARRATIVE', 'TACTICAL'] as const).map((m) => (
                <div
                  key={m}
                  className={`flex-1 rounded-xl border px-2 py-2 flex items-center justify-center gap-1 transition-colors duration-150 ${
                    combatMode === m
                      ? 'border-[#f0ca65]/70 bg-[#e8ca8a]/10 text-[#f5dfa0]'
                      : 'border-[#e8ca8a]/25 text-[#e8ca8a]/85 hover:border-[#e8ca8a]/50'
                  }`}
                >
                  <button onClick={() => setCombatMode(m)} className="font-display text-xs">
                    {m === 'NARRATIVE' ? 'Narrative' : 'Tactical'}
                  </button>
                  <InfoTooltip text={COMBAT_MODE_INFO[m]} />
                </div>
              ))}
            </div>
            <p className="font-narrative text-[11px] text-ink-muted mt-1.5">Changeable anytime later from Settings.</p>
          </div>
        </div>
      </div>

      <div
        className={`shrink-0 ${GLASS_SURFACE} border-x-0 border-b-0 bg-[#07050c]/50 px-4 py-3 flex justify-center`}
        style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
      >
        <GlassCTAButton onClick={() => onBegin({ opening, narrationStyle, temperature, combatMode })}>Start</GlassCTAButton>
      </div>
    </GlassScreen>
  )
}
