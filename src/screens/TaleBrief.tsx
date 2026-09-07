import { useState } from 'react'
import {
  GLASS_SURFACE, GlassCTAButton, GlassField, GlassHeader, GlassLongTextarea, GlassScreen, LABEL_CLASS,
} from '../lib/glassChrome.tsx'
import { NARRATION_STYLE_EXAMPLES, OPENING_BRIEF_EXAMPLES } from '../data/formExamples.ts'
import { deleteTextPreset, loadTextPresets, saveTextPreset } from '../lib/store.ts'

interface TaleBriefPayload {
  opening: string
  narrationStyle: string
  temperature: number
  title: string
}

interface TaleBriefProps {
  initialOpening?: string
  initialNarrationStyle: string
  initialTemperature: number
  // A pre-filled suggestion (e.g. "Violet Sorrengail's Tale"), not a locked
  // value — the player can freely overwrite it before diving in.
  suggestedTitle: string
  // Other Tales' titles already in the library, checked case/whitespace-
  // insensitively so two saves never look identical in the Tales list.
  existingTitles: string[]
  editLongText: (label: string, value: string, hint?: string, placeholder?: string) => Promise<string | null>
  onBack: () => void
  onBegin: (payload: TaleBriefPayload) => void
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
  suggestedTitle,
  existingTitles,
  editLongText,
  onBack,
  onBegin,
}: TaleBriefProps) {
  const [opening, setOpening] = useState(initialOpening)
  const [narrationStyle, setNarrationStyle] = useState(initialNarrationStyle)
  const [temperature, setTemperature] = useState(initialTemperature)
  const [title, setTitle] = useState(suggestedTitle)

  const [openingPresets, setOpeningPresets] = useState(() => loadTextPresets('openingBrief'))
  const [narrationPresets, setNarrationPresets] = useState(() => loadTextPresets('narrationStyle'))

  const trimmedTitle = title.trim()
  const isDuplicateTitle = trimmedTitle.length > 0 && existingTitles.some((t) => t.trim().toLowerCase() === trimmedTitle.toLowerCase())
  const titleError = trimmedTitle.length === 0 ? 'Give this Tale a name.' : isDuplicateTitle ? 'Another Tale already has this name — choose a different one.' : null

  return (
    <GlassScreen ground="art" fill>
      <GlassHeader title="Tale Dive Brief" subtitle="Step 4 — where the first page opens" onBack={onBack} />

      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 focus-within:pb-[75vh] md:focus-within:pb-4">
        <div className="max-w-md md:max-w-2xl lg:max-w-3xl mx-auto flex flex-col gap-5">
          <GlassField label="Tale Title" hint="Shown in your Tales library — rename it anytime later from there.">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={suggestedTitle}
              className={`w-full rounded-lg bg-[#181324]/60 border px-3 py-2 font-display text-sm text-[#fbf4e2] outline-none transition-colors ${
                titleError ? 'border-red-400/60 focus:border-red-400' : 'border-[#e8ca8a]/25 focus:border-[#f0ca65]/60'
              }`}
            />
            {titleError && <p className="font-narrative italic text-xs text-red-300 mt-1">{titleError}</p>}
          </GlassField>

          <GlassField
            label="Where do you dive in?"
            hint="Optional — leave blank and the Narrator decides."
            examples={OPENING_BRIEF_EXAMPLES}
            onPickExample={(val) => setOpening(val)}
            presets={openingPresets}
            onPickPreset={(val) => setOpening(val)}
            onSavePreset={(name) => setOpeningPresets(saveTextPreset('openingBrief', name, opening))}
            onDeletePreset={(id) => setOpeningPresets(deleteTextPreset('openingBrief', id))}
            canSavePreset={opening.trim().length > 0}
          >
            <GlassLongTextarea
              value={opening}
              onOpenModal={async () => {
                const result = await editLongText(
                  'Where do you dive in?',
                  opening,
                  'Describe the exact scene, location, immediate crisis, and characters present where Turn 1 should open.',
                  'e.g. Standing on the rain-slicked deck of an airship as alarms blare and harpoons strike the hull, weapon drawn alongside your squad...',
                )
                if (result !== null) setOpening(result)
              }}
              placeholder="e.g. Standing on the rain-slicked deck of an airship as alarms blare and harpoons strike the hull, weapon drawn alongside your squad..."
              rows={6}
            />
          </GlassField>

          <GlassField
            label="Narration Style"
            hint="Custom narrator tone instructions or voice directives"
            examples={NARRATION_STYLE_EXAMPLES}
            onPickExample={(val) => setNarrationStyle(val)}
            presets={narrationPresets}
            onPickPreset={(val) => setNarrationStyle(val)}
            onSavePreset={(name) => setNarrationPresets(saveTextPreset('narrationStyle', name, narrationStyle))}
            onDeletePreset={(id) => setNarrationPresets(deleteTextPreset('narrationStyle', id))}
            canSavePreset={narrationStyle.trim().length > 0}
          >
            <GlassLongTextarea
              value={narrationStyle}
              onOpenModal={async () => {
                const result = await editLongText(
                  'Narration Style',
                  narrationStyle,
                  'Custom narrator tone instructions, author voice emulation, or sentence cadence.',
                  'e.g. Visceral close POV with high-stakes urgency; Poetic, atmospheric grimdark with sensory weight; Witty first-person with sharp banter...',
                )
                if (result !== null) setNarrationStyle(result)
              }}
              placeholder="e.g. Visceral close POV with high-stakes urgency; Poetic, atmospheric grimdark with sensory weight; Witty first-person with sharp banter..."
              rows={4}
            />
          </GlassField>

          <div>
            <div className="flex items-baseline justify-between">
              <span className={LABEL_CLASS}>Creativity Randomness</span>
              <span className="font-mono text-xs font-semibold text-[#fae5b5]">{temperature.toFixed(1)}</span>
            </div>
            <input
              type="range"
              min="0"
              max="2"
              step="0.1"
              value={temperature}
              onChange={(e) => setTemperature(Number(e.target.value))}
              className="w-full mt-2 accent-[#f0ca65] cursor-pointer"
            />
            <p className="font-narrative italic text-xs text-[#d8c49e] mt-1">
              How unpredictable the prose gets. Low keeps the Narrator steady; high adds more creative flourish.
            </p>
          </div>
        </div>
      </div>

      <div
        className={`shrink-0 ${GLASS_SURFACE} border-x-0 border-b-0 bg-[#07050c]/50 px-4 py-3 flex justify-center`}
        style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
      >
        <div className="w-full max-w-md md:max-w-2xl lg:max-w-3xl flex justify-center">
          <GlassCTAButton
            disabled={!!titleError}
            onClick={() => onBegin({ opening, narrationStyle, temperature, title: trimmedTitle })}
          >
            DIVE IN
          </GlassCTAButton>
        </div>
      </div>
    </GlassScreen>
  )
}
