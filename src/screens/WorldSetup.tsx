import { useState } from 'react'
import { Globe, Save, Plus } from 'lucide-react'
import { DEFAULT_NARRATION_STYLE } from '../api/turnContract.ts'
import {
  FIELD_CLASS, GLASS_SURFACE, GlassButton, GlassCTAButton, GlassField, GlassHeader, GlassScreen, LABEL_CLASS,
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
  const [templateId, setTemplateId] = useState<string | null | undefined>(initial?.id ?? null)
  const [mode, setMode] = useState(initial?.mode ?? 'original')
  const [name, setName] = useState(initial?.name ?? '')
  const [sourceTitle, setSourceTitle] = useState(initial?.sourceTitle ?? '')
  const [sourceAuthor, setSourceAuthor] = useState(initial?.sourceAuthor ?? '')
  const [genreTone, setGenreTone] = useState(initial?.genreTone ?? '')
  const [conflict, setConflict] = useState(initial?.conflict ?? '')
  const [background, setBackground] = useState(initial?.background ?? '')
  const [narrationStyle, setNarrationStyle] = useState(initial?.narrationStyle ?? DEFAULT_NARRATION_STYLE)

  function applyTemplate(t: WorldData) {
    setTemplateId(t.id)
    setMode(t.mode ?? 'original')
    setName(t.name)
    setSourceTitle(t.sourceTitle ?? '')
    setSourceAuthor(t.sourceAuthor ?? '')
    setGenreTone(t.genreTone ?? '')
    setConflict(t.conflict ?? '')
    setBackground(t.background ?? '')
    setNarrationStyle(t.narrationStyle ?? DEFAULT_NARRATION_STYLE)
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
    }
  }

  return (
    <GlassScreen ground="art" fill>
      <GlassHeader title="Build a World" subtitle="Step 2 — the setting your tale grows from" onBack={onBack} />

      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4">
        <div className="max-w-md mx-auto flex flex-col gap-4">
          {worldTemplates.length > 0 && (
            <div>
              <p className={`${LABEL_CLASS} mb-2`}>Start from a saved World</p>
              <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4">
                {worldTemplates.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => applyTemplate(t)}
                    className={`shrink-0 flex items-center gap-1.5 rounded-full border px-3 py-2 text-xs font-display backdrop-blur-sm transition-colors duration-150 ${
                      templateId === t.id
                        ? 'border-[#f0ca65]/70 bg-[#e8ca8a]/12 text-[#f5dfa0]'
                        : 'border-[#e8ca8a]/25 text-[#e8ca8a]/90 hover:border-[#e8ca8a]/60 hover:text-[#f5dfa0]'
                    }`}
                  >
                    <Globe size={13} />
                    {t.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <GlassField label="World Name">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Navarre" className={FIELD_CLASS} />
          </GlassField>

          <GlassField label="Adapted From" hint="Optional — attribution only, never sent to the Narrator.">
            <div className="flex gap-2">
              <input
                value={sourceTitle}
                onChange={(e) => setSourceTitle(e.target.value)}
                placeholder="Novel/Series title"
                className={FIELD_CLASS}
              />
              <input
                value={sourceAuthor}
                onChange={(e) => setSourceAuthor(e.target.value)}
                placeholder="Author"
                className={FIELD_CLASS}
              />
            </div>
          </GlassField>

          <GlassField label="Genre & Tone" hint="Optional.">
            <input
              value={genreTone}
              onChange={(e) => setGenreTone(e.target.value)}
              placeholder="Dark fantasy, morally grey"
              className={FIELD_CLASS}
            />
          </GlassField>

          <GlassField label="Core Regional Conflict" hint="Optional.">
            <input
              value={conflict}
              onChange={(e) => setConflict(e.target.value)}
              placeholder="A border war between two rival holds"
              className={FIELD_CLASS}
            />
          </GlassField>

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
