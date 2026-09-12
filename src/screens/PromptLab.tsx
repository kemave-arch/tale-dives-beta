import { useState } from 'react'
import { ArrowLeft, Copy, Image as ImageIcon, Sparkles, RotateCw } from 'lucide-react'
import type { ApiSettings } from '../types.ts'
import { resolveCanonDescription } from '../lib/canonDescription.ts'
import { buildLocationImagePrompt, buildNpcPortraitPrompt, buildRegionMapPrompt, generateImageBytes, type ImageAspectRatio } from '../lib/imageGeneration.ts'

// Dev tool, not a player-facing screen: lets whoever is tuning the image
// pipeline drive the exact real functions (resolveCanonDescription,
// buildNpcPortraitPrompt/buildLocationImagePrompt/buildRegionMapPrompt,
// generateImageBytes) against the exact same in-game fields, with real API
// calls using whatever key is already configured in Settings — so nothing
// here can drift out of sync with what the actual game sends, unlike a
// hand-mirrored copy of this logic living anywhere else.

interface PromptLabProps {
  apiSettings: ApiSettings
  onBack: () => void
}

type EntityKind = 'character' | 'location' | 'map'

const ASPECT_BY_KIND: Record<EntityKind, ImageAspectRatio> = {
  character: '1:1',
  location: '16:9',
  map: '16:9',
}

function Field({ label, value, onChange, textarea, placeholder }: { label: string; value: string; onChange: (v: string) => void; textarea?: boolean; placeholder?: string }) {
  const cls = 'w-full px-2.5 py-1.5 rounded-lg bg-[#0d1017] border border-gold-accent/30 text-xs text-ink outline-none focus:border-gold-primary font-narrative'
  return (
    <label className="flex flex-col gap-1">
      <span className="font-mono text-[10px] uppercase tracking-wider text-gold-primary/70">{label}</span>
      {textarea ? (
        <textarea rows={2} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={`${cls} resize-y`} />
      ) : (
        <input type="text" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={cls} />
      )}
    </label>
  )
}

function OutputPanel({ title, value, busy }: { title: string; value: string; busy?: boolean }) {
  const [copied, setCopied] = useState(false)
  if (!value && !busy) return null
  return (
    <div className="rounded-xl border border-gold-accent/30 bg-[#12151f] p-3 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-wider text-gold-primary/80">{title}</span>
        {value && (
          <button
            type="button"
            onClick={() => {
              navigator.clipboard.writeText(value)
              setCopied(true)
              setTimeout(() => setCopied(false), 1200)
            }}
            className="flex items-center gap-1 text-[10px] text-ink-muted hover:text-gold-primary"
          >
            <Copy size={11} /> {copied ? 'Copied' : 'Copy'}
          </button>
        )}
      </div>
      {busy ? (
        <div className="flex items-center gap-2 text-xs text-ink-muted">
          <RotateCw size={13} className="animate-spin" /> Working...
        </div>
      ) : (
        <pre className="text-[11px] text-ink whitespace-pre-wrap font-mono max-h-56 overflow-y-auto">{value}</pre>
      )}
    </div>
  )
}

export default function PromptLab({ apiSettings, onBack }: PromptLabProps) {
  const [kind, setKind] = useState<EntityKind>('character')

  // World Foundation fields — same as WorldData's own image-relevant subset.
  const [genreTone, setGenreTone] = useState('')
  const [eraTechLevel, setEraTechLevel] = useState('')
  const [powerSystem, setPowerSystem] = useState('')
  const [sourceTitle, setSourceTitle] = useState('')
  const [sourceAuthor, setSourceAuthor] = useState('')
  const [sourceScope, setSourceScope] = useState('')

  // Entity fields — same shape as NpcEntry/LocationEntry/RegionEntry's own.
  const [name, setName] = useState('')
  const [role, setRole] = useState('')
  const [notes, setNotes] = useState('') // appearance (character) / description (location, map)
  const [locationNames, setLocationNames] = useState('') // map only
  const [existingDescription, setExistingDescription] = useState('')
  const [developmentNote, setDevelopmentNote] = useState('')

  const [resolvedDescription, setResolvedDescription] = useState('')
  const [finalPrompt, setFinalPrompt] = useState('')
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [modelUsed, setModelUsed] = useState<string | null>(null)
  const [busy, setBusy] = useState<'resolve' | 'image' | null>(null)
  const [error, setError] = useState<string | null>(null)

  const world = { genreTone, eraTechLevel, powerSystem }
  const loreAccuracyActive = Boolean(sourceTitle.trim() && sourceScope.trim())

  async function handleResolve() {
    setBusy('resolve')
    setError(null)
    try {
      const text = await resolveCanonDescription({
        apiSettings,
        kind: kind === 'map' ? 'location' : kind,
        name,
        role: kind === 'character' ? role : undefined,
        currentNotes: notes,
        existingDescription: existingDescription || undefined,
        developmentNote: developmentNote || undefined,
        source: { title: sourceTitle, author: sourceAuthor, scope: sourceScope },
      })
      setResolvedDescription(text)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(null)
    }
  }

  function handleBuildPrompt() {
    const description = resolvedDescription || notes
    // Mirrors the real Codex.tsx call sites: in lore-accuracy mode, the real
    // proper name is never embedded in the final image prompt — only the
    // resolved, name-free description is. Stage 1 keeping the description
    // name-free is pointless if Stage 2's own template still spells the name
    // out, so the redaction has to happen here too, not just in Stage 1.
    if (kind === 'character') {
      setFinalPrompt(buildNpcPortraitPrompt(loreAccuracyActive ? 'this character' : name, description, role, world))
    } else if (kind === 'location') {
      setFinalPrompt(buildLocationImagePrompt(loreAccuracyActive ? 'this location' : name, description, world))
    } else {
      // Region maps are NOT redacted, even in lore-accuracy mode: a map's
      // job is to depict several distinctly-named places, so blanket name
      // redaction here would just produce a useless prompt. This is a real,
      // currently-unresolved gap in lore-accuracy coverage for maps — see
      // the in-game Codex.tsx comment at the same call site.
      const names = locationNames.split(',').map((n) => n.trim()).filter(Boolean)
      setFinalPrompt(buildRegionMapPrompt(name, description, names, world))
    }
  }

  async function handleGenerateImage() {
    if (!finalPrompt.trim()) return
    setBusy('image')
    setError(null)
    setImageUrl(null)
    setModelUsed(null)
    try {
      const result = await generateImageBytes({
        apiKey: apiSettings.apiKey,
        prompt: finalPrompt,
        aspectRatio: ASPECT_BY_KIND[kind],
      })
      setImageUrl(URL.createObjectURL(result.blob))
      setModelUsed(result.modelUsed)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="fixed inset-0 z-30 bg-[#0b0812] text-ink flex flex-col">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gold-accent/20">
        <button type="button" onClick={onBack} className="p-1.5 rounded-lg hover:bg-gold-accent/10 text-gold-primary">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="font-display font-bold text-gold-primary text-sm">Image Prompt Lab</h1>
          <p className="font-mono text-[10px] text-ink-muted">Drives the real canon-description + image-prompt functions directly — nothing here is a mock.</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4 max-w-2xl mx-auto w-full">
        <div className="flex gap-2">
          {(['character', 'location', 'map'] as EntityKind[]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-display font-semibold border transition-colors ${
                kind === k ? 'bg-gold-primary text-black border-gold-primary' : 'bg-[#161a28] text-ink-muted border-gold-accent/30 hover:text-gold-primary'
              }`}
            >
              {k === 'character' ? 'NPC' : k === 'location' ? 'Location' : 'Region Map'}
            </button>
          ))}
        </div>

        <div className="rounded-xl border border-gold-accent/30 bg-[#161a28] p-3 flex flex-col gap-2.5">
          <span className="font-mono text-[10px] uppercase tracking-wider text-gold-primary font-bold">World Foundation</span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <Field label="Genre & Tone" value={genreTone} onChange={setGenreTone} placeholder="e.g. Dark gothic fantasy, gritty" />
            <Field label="Era & Technology" value={eraTechLevel} onChange={setEraTechLevel} placeholder="e.g. Late medieval, iron and timber" />
          </div>
          <Field label="Power System" value={powerSystem} onChange={setPowerSystem} placeholder="e.g. Blood-oaths and glowing rune carving" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 border-t border-gold-accent/15">
            <Field label="Novel Inspiration" value={sourceTitle} onChange={setSourceTitle} placeholder="e.g. Fourth Wing" />
            <Field label="Author" value={sourceAuthor} onChange={setSourceAuthor} placeholder="e.g. Rebecca Yarros" />
          </div>
          <Field label="Canon Scope Boundary" value={sourceScope} onChange={setSourceScope} placeholder="e.g. Prologue only, Book 1, through Chapter 12" />
          {sourceTitle && !sourceScope && (
            <p className="text-[10px] text-amber-300/80 font-mono">⚠ No scope set — same as in-game, sourceTitle alone stays attribution-only and won't gate lore-accuracy mode.</p>
          )}
        </div>

        <div className="rounded-xl border border-gold-accent/30 bg-[#161a28] p-3 flex flex-col gap-2.5">
          <span className="font-mono text-[10px] uppercase tracking-wider text-gold-primary font-bold">
            {kind === 'character' ? 'Character' : kind === 'location' ? 'Location' : 'Region'}
          </span>
          <Field label="Name" value={name} onChange={setName} placeholder="Entity name" />
          {kind === 'character' && <Field label="Role" value={role} onChange={setRole} placeholder="e.g. Rival Cadet" />}
          <Field
            label={kind === 'character' ? 'Appearance (freeform notes)' : 'Description (freeform notes)'}
            value={notes}
            onChange={setNotes}
            textarea
            placeholder="Whatever's already on the Codex entry"
          />
          {kind === 'map' && <Field label="Location Names (comma-separated)" value={locationNames} onChange={setLocationNames} placeholder="Fort Daggerpoint, Blackmoss Crossing" />}
          {kind !== 'map' && (
            <>
              <Field label="Established Description (for continuity testing)" value={existingDescription} onChange={setExistingDescription} textarea placeholder="Paste a prior resolved description to test the 'preserve unless changed' behavior" />
              <Field label="What's Changed (development note)" value={developmentNote} onChange={setDevelopmentNote} placeholder="e.g. now has a scar over one eyebrow, cropped hair" />
            </>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {kind !== 'map' && (
            <button
              type="button"
              onClick={handleResolve}
              disabled={busy !== null || !name.trim() || !apiSettings.apiKey}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#e8ca8a]/20 border border-[#e8ca8a]/50 text-[#e8ca8a] text-xs font-display font-semibold hover:bg-[#e8ca8a]/30 disabled:opacity-50"
            >
              <Sparkles size={13} /> Resolve Canon Description {loreAccuracyActive ? '' : '(no source set — will just clean up notes)'}
            </button>
          )}
          <button
            type="button"
            onClick={handleBuildPrompt}
            disabled={!name.trim()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#161a28] border border-gold-accent/40 text-gold-primary text-xs font-display font-semibold hover:bg-gold-accent/10 disabled:opacity-50"
          >
            Build Final Image Prompt
          </button>
          <button
            type="button"
            onClick={handleGenerateImage}
            disabled={busy !== null || !finalPrompt.trim() || !apiSettings.apiKey}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-[#f7e7ce] via-[#e8ca8a] to-[#d4af37] text-zinc-950 text-xs font-display font-bold disabled:opacity-50"
          >
            <ImageIcon size={13} /> Generate Test Image
          </button>
        </div>
        {!apiSettings.apiKey && <p className="text-[10px] text-amber-300/80 font-mono">⚠ No API key configured — set one in Settings → AI Model first.</p>}
        {error && <p className="text-[11px] text-red-300 font-mono bg-red-950/40 border border-red-500/30 rounded-lg p-2">{error}</p>}

        <OutputPanel title="Resolved Canon Description" value={resolvedDescription} busy={busy === 'resolve'} />
        <OutputPanel title="Final Image Generation Prompt" value={finalPrompt} />

        {(imageUrl || busy === 'image') && (
          <div className="rounded-xl border border-gold-accent/30 bg-[#12151f] p-3 flex flex-col gap-2 items-center">
            {busy === 'image' ? (
              <div className="flex items-center gap-2 text-xs text-ink-muted py-6">
                <RotateCw size={14} className="animate-spin" /> Generating...
              </div>
            ) : (
              imageUrl && (
                <>
                  <img src={imageUrl} alt="" className="max-h-96 rounded-lg border border-gold-accent/20" />
                  {modelUsed && <span className="font-mono text-[10px] text-ink-muted">Generated using {modelUsed}</span>}
                </>
              )
            )}
          </div>
        )}
      </div>
    </div>
  )
}
