import { useState } from 'react'
import { Info, Layers, Save, Plus } from 'lucide-react'
import { DEFAULT_NARRATION_STYLE } from '../api/turnContract.ts'
import {
  FIELD_CLASS, GLASS_SURFACE, GlassButton, GlassCTAButton, GlassField, GlassHeader, GlassScreen, GlassTabs,
  SuggestionChips, TemplateSearchDropdown,
} from '../lib/glassChrome.tsx'
import type { WorldData } from '../types.ts'

interface WorldSetupProps {
  worldTemplates?: WorldData[]
  initial?: WorldData | null
  onBack: () => void
  onContinue: (world: WorldData) => void
  onSavePreset?: (world: WorldData) => void
  onSaveAsNewPreset?: (world: WorldData) => void
}

const TABS = [
  { id: 'overview' as const, label: 'Overview', icon: Info },
  { id: 'depth' as const, label: 'Depth', icon: Layers },
]

const TONE_CHIPS = ['Grimdark', 'Noblebright', 'Lighthearted', 'Wholesome', 'Graphic & Visceral']
const POWER_SYSTEM_CHIPS = ['Hard magic, costly', 'Soft magic, mysterious', 'Cultivation & cores', 'Tech-augmented', 'No powers — pure skill']

// Blueprint §Phase A.1 — Original Mode world setup, now also usable as the
// World Library's create/edit form (§6.4B) since both need the same fields.
// Inspired Mode (§Phase A.2, title/author -> grounded world-fabrication call)
// isn't built yet — it needs Gemini's search-grounding tool alongside
// structured JSON output in the same call, which needs its own verification.
// A pre-authored Inspired-mode template (Appendix A's Fourth Wing example)
// can still be picked here and edited by hand — sourceTitle/sourceAuthor are
// attribution metadata only, never sent to the model.
export default function WorldSetup({
  worldTemplates = [],
  initial,
  onBack,
  onContinue,
  onSavePreset,
  onSaveAsNewPreset,
}: WorldSetupProps) {
  const [tab, setTab] = useState<(typeof TABS)[number]['id']>('overview')
  const [templateId, setTemplateId] = useState<string | null | undefined>(initial?.id ?? null)
  const [mode, setMode] = useState(initial?.mode ?? 'original')
  const [name, setName] = useState(initial?.name ?? '')
  const [sourceTitle, setSourceTitle] = useState(initial?.sourceTitle ?? '')
  const [sourceAuthor, setSourceAuthor] = useState(initial?.sourceAuthor ?? '')
  const [genreTone, setGenreTone] = useState(initial?.genreTone ?? '')
  const [conflict, setConflict] = useState(initial?.conflict ?? '')
  const [background, setBackground] = useState(initial?.background ?? '')
  const [narrationStyle, setNarrationStyle] = useState(initial?.narrationStyle ?? DEFAULT_NARRATION_STYLE)
  const [powerSystem, setPowerSystem] = useState(initial?.powerSystem ?? '')
  const [eraTechLevel, setEraTechLevel] = useState(initial?.eraTechLevel ?? '')
  const [keyFactions, setKeyFactions] = useState(initial?.keyFactions ?? '')

  function applyTemplate(t: WorldData) {
    setTab('overview')
    setTemplateId(t.id)
    setMode(t.mode ?? 'original')
    setName(t.name)
    setSourceTitle(t.sourceTitle ?? '')
    setSourceAuthor(t.sourceAuthor ?? '')
    setGenreTone(t.genreTone ?? '')
    setConflict(t.conflict ?? '')
    setBackground(t.background ?? '')
    setNarrationStyle(t.narrationStyle ?? DEFAULT_NARRATION_STYLE)
    setPowerSystem(t.powerSystem ?? '')
    setEraTechLevel(t.eraTechLevel ?? '')
    setKeyFactions(t.keyFactions ?? '')
  }

  function currentData(): WorldData {
    return {
      id: templateId,
      name: name.trim() || 'Untitled World',
      mode,
      sourceTitle: sourceTitle.trim() || undefined,
      sourceAuthor: sourceAuthor.trim() || undefined,
      genreTone,
      conflict,
      background,
      narrationStyle,
      powerSystem: powerSystem.trim() || undefined,
      eraTechLevel: eraTechLevel.trim() || undefined,
      keyFactions: keyFactions.trim() || undefined,
    }
  }

  return (
    <GlassScreen ground="art" fill>
      <GlassHeader title="Build a World" subtitle="Step 2 — the setting your tale grows from" onBack={onBack} />

      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4">
        <div className="max-w-md mx-auto flex flex-col gap-4">
          <TemplateSearchDropdown templates={worldTemplates} onSelect={applyTemplate} placeholder="Search saved Worlds..." />

          <div className="flex gap-3 items-start">
            <GlassTabs tabs={TABS} value={tab} onChange={setTab} orientation="vertical" className="w-20 shrink-0" />

            <div className="flex-1 min-w-0 flex flex-col gap-4">
              {tab === 'overview' && (
                <>
                  <GlassField label="World Name">
                    <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Navarre" className={FIELD_CLASS} />
                  </GlassField>

                  <GlassField label="Adapted From" hint="Optional — attribution only, never sent to the Narrator.">
                    <div className="flex gap-2">
                      <input
                        value={sourceTitle}
                        onChange={(e) => setSourceTitle(e.target.value)}
                        placeholder="Fourth Wing"
                        className={FIELD_CLASS}
                      />
                      <input
                        value={sourceAuthor}
                        onChange={(e) => setSourceAuthor(e.target.value)}
                        placeholder="Rebecca Yarros"
                        className={FIELD_CLASS}
                      />
                    </div>
                  </GlassField>

                  <GlassField label="Genre & Tone" hint="Optional.">
                    <div className="flex flex-col gap-2">
                      <SuggestionChips options={TONE_CHIPS} onPick={setGenreTone} />
                      <input
                        value={genreTone}
                        onChange={(e) => setGenreTone(e.target.value)}
                        placeholder="Dark fantasy, morally grey"
                        className={FIELD_CLASS}
                      />
                    </div>
                  </GlassField>
                </>
              )}

              {tab === 'depth' && (
                <>
                  <GlassField label="Core Regional Conflict" hint="Optional.">
                    <input
                      value={conflict}
                      onChange={(e) => setConflict(e.target.value)}
                      placeholder="A border war between two rival holds"
                      className={FIELD_CLASS}
                    />
                  </GlassField>

                  <GlassField label="Power System" hint="Magic, cultivation, tech, or pure skill — however power works here. Optional.">
                    <div className="flex flex-col gap-2">
                      <SuggestionChips options={POWER_SYSTEM_CHIPS} onPick={setPowerSystem} />
                      <textarea
                        value={powerSystem}
                        onChange={(e) => setPowerSystem(e.target.value)}
                        placeholder="Signet magic — granted only after bonding a dragon, drains mental and physical reserves fast."
                        rows={3}
                        className={FIELD_CLASS}
                      />
                    </div>
                  </GlassField>

                  <div className="flex gap-2">
                    <div className="flex-1">
                      <GlassField label="Era / Tech Level" hint="Optional.">
                        <input
                          value={eraTechLevel}
                          onChange={(e) => setEraTechLevel(e.target.value)}
                          placeholder="Medieval high fantasy war-college"
                          className={FIELD_CLASS}
                        />
                      </GlassField>
                    </div>
                    <div className="flex-1">
                      <GlassField label="Key Factions" hint="Named factions only — the Core Conflict field above already covers the why.">
                        <input
                          value={keyFactions}
                          onChange={(e) => setKeyFactions(e.target.value)}
                          placeholder="Navarre vs. Poromiel"
                          className={FIELD_CLASS}
                        />
                      </GlassField>
                    </div>
                  </div>

                  <GlassField label="World Background">
                    <textarea
                      value={background}
                      onChange={(e) => setBackground(e.target.value)}
                      placeholder="The setting's key backdrop, e.g. the continent of Navarre"
                      rows={3}
                      className={FIELD_CLASS}
                    />
                  </GlassField>

                  <GlassField label="Narration Style">
                    <textarea
                      value={narrationStyle}
                      onChange={(e) => setNarrationStyle(e.target.value)}
                      rows={4}
                      className={`${FIELD_CLASS} text-xs`}
                    />
                  </GlassField>
                </>
              )}

              {(onSavePreset || onSaveAsNewPreset) && (
                <div className="flex gap-2">
                  {templateId && onSavePreset && (
                    <GlassButton onClick={() => onSavePreset(currentData())} icon={Save} className="flex-1">
                      Save Preset
                    </GlassButton>
                  )}
                  {onSaveAsNewPreset && (
                    <GlassButton onClick={() => onSaveAsNewPreset({ ...currentData(), id: null })} icon={Plus} className="flex-1">
                      Save as New Preset
                    </GlassButton>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Back lives in the header now, so the footer carries only the single
          forward action. It needs its own blur/tint because the artwork keeps
          scrolling underneath it. */}
      <div
        className={`shrink-0 ${GLASS_SURFACE} border-x-0 border-b-0 bg-[#07050c]/50 px-4 py-3 flex justify-center`}
        style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
      >
        <GlassCTAButton onClick={() => onContinue(currentData())}>Continue</GlassCTAButton>
      </div>
    </GlassScreen>
  )
}
