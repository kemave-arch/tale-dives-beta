import { useState } from 'react'
import { ArrowLeft, Copy, Image as ImageIcon, Sparkles, RotateCw, Globe, User, MapPin, Map, RefreshCw } from 'lucide-react'
import type { ApiSettings, WorldData } from '../types.ts'
import * as store from '../lib/store.ts'
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
  activeWorld?: WorldData | null
}

type EntityKind = 'character' | 'location' | 'map'

const ASPECT_BY_KIND: Record<EntityKind, ImageAspectRatio> = {
  character: '1:1',
  location: '9:16',
  map: '4:3',
}

function SectionCard({
  title,
  subtitle,
  children,
  badge,
  icon: Icon,
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
  badge?: React.ReactNode
  icon?: React.ComponentType<{ size?: number; className?: string }>
}) {
  return (
    <div className="rounded-xl border border-gold-accent/30 bg-[#141824] flex flex-col">
      <div className="px-3.5 py-2.5 flex items-center justify-between bg-[#121522] border-b border-gold-accent/15 rounded-t-xl">
        <div className="flex items-center gap-2 min-w-0">
          {Icon && <Icon size={14} className="text-gold-primary shrink-0" />}
          <span className="font-mono text-xs uppercase tracking-wider text-gold-primary font-bold">{title}</span>
          {badge}
        </div>
        {subtitle && <span className="font-mono text-[10px] text-ink-muted/70 hidden sm:inline">{subtitle}</span>}
      </div>
      <div className="p-3.5 flex flex-col gap-3">{children}</div>
    </div>
  )
}

function Field({ label, value, onChange, textarea, placeholder }: { label: string; value: string; onChange: (v: string) => void; textarea?: boolean; placeholder?: string }) {
  const cls = 'w-full px-3 py-2 rounded-lg bg-[#0d1017] border border-gold-accent/30 text-xs text-ink outline-none focus:border-gold-primary font-narrative transition-colors placeholder:text-ink-muted/40'
  return (
    <label className="flex flex-col gap-1.5 text-left w-full">
      <span className="font-mono text-[10px] uppercase tracking-wider text-gold-primary/90 font-semibold">{label}</span>
      {textarea ? (
        <textarea
          rows={3}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`${cls} resize-y min-h-[84px] leading-relaxed`}
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={cls}
        />
      )}
    </label>
  )
}

function OutputPanel({ title, value, busy }: { title: string; value: string; busy?: boolean }) {
  const [copied, setCopied] = useState(false)

  if (!value && !busy) return null

  return (
    <div className="rounded-xl border border-gold-accent/30 bg-[#12151f] flex flex-col">
      <div className="flex items-center justify-between px-3.5 py-2.5 bg-[#0e101a] border-b border-gold-accent/15 rounded-t-xl">
        <span className="font-mono text-xs uppercase tracking-wider text-gold-primary font-bold">{title}</span>
        {value && (
          <button
            type="button"
            onClick={() => {
              navigator.clipboard.writeText(value)
              setCopied(true)
              setTimeout(() => setCopied(false), 1200)
            }}
            className="flex items-center gap-1 text-[10px] text-ink-muted hover:text-gold-primary px-2 py-0.5 rounded bg-gold-accent/10 hover:bg-gold-accent/20 border border-gold-accent/30 transition-colors shrink-0"
          >
            <Copy size={11} /> {copied ? 'Copied' : 'Copy'}
          </button>
        )}
      </div>
      <div className="p-3.5">
        {busy ? (
          <div className="flex items-center gap-2 text-xs text-ink-muted py-2">
            <RotateCw size={13} className="animate-spin text-gold-primary" /> Working...
          </div>
        ) : (
          <pre className="text-xs text-ink whitespace-pre-wrap font-mono leading-relaxed select-text">{value}</pre>
        )}
      </div>
    </div>
  )
}

export default function PromptLab({ apiSettings, onBack, activeWorld }: PromptLabProps) {
  const [kind, setKind] = useState<EntityKind>('character')

  // Resolve session world: activeWorld prop first, fallback to store's active campaign world
  const sessionWorld = activeWorld ?? (() => {
    try {
      const activeId = store.loadActiveCampaignId()
      const campaigns = store.loadCampaigns()
      return activeId && campaigns[activeId] ? campaigns[activeId].world : null
    } catch {
      return null
    }
  })()

  // World Foundation fields — imported by default from in-game session's parameters
  const [genreTone, setGenreTone] = useState(() => sessionWorld?.genreTone ?? '')
  const [eraTechLevel, setEraTechLevel] = useState(() => sessionWorld?.eraTechLevel ?? '')
  const [powerSystem, setPowerSystem] = useState(() => sessionWorld?.powerSystem ?? '')
  const [sourceTitle, setSourceTitle] = useState(() => sessionWorld?.sourceTitle ?? '')
  const [sourceAuthor, setSourceAuthor] = useState(() => sessionWorld?.sourceAuthor ?? '')
  const [sourceScope, setSourceScope] = useState(() => sessionWorld?.sourceScope ?? '')

  function handleReimportSession() {
    if (!sessionWorld) return
    setGenreTone(sessionWorld.genreTone ?? '')
    setEraTechLevel(sessionWorld.eraTechLevel ?? '')
    setPowerSystem(sessionWorld.powerSystem ?? '')
    setSourceTitle(sessionWorld.sourceTitle ?? '')
    setSourceAuthor(sessionWorld.sourceAuthor ?? '')
    setSourceScope(sessionWorld.sourceScope ?? '')
  }

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

  const world = { genreTone, eraTechLevel, powerSystem, sourceTitle, sourceAuthor, sourceScope }
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
    // Mirrors the real Codex.tsx call sites: the real name always reaches the
    // image prompt, and whenever loreAccuracyActive, buildXPrompt's own
    // canonReferenceLine (imageGeneration.ts) appends a direct citation of the
    // source title/author/scope too — live testing showed direct references
    // to real novels/characters aren't refused and land far closer to canon
    // than a name-redacted description does.
    if (kind === 'character') {
      setFinalPrompt(buildNpcPortraitPrompt(name, description, role, world))
    } else if (kind === 'location') {
      setFinalPrompt(buildLocationImagePrompt(name, description, world))
    } else {
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

  const kindIcon = kind === 'character' ? User : kind === 'location' ? MapPin : Map

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

      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 pt-4 pb-36 flex flex-col gap-4 max-w-2xl mx-auto w-full">
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

        <SectionCard
          title="World Foundation"
          subtitle={loreAccuracyActive ? `Canon: ${sourceTitle}` : sessionWorld ? `Session: ${sessionWorld.name}` : 'Novel inspiration & world parameters'}
          icon={Globe}
          badge={
            loreAccuracyActive ? (
              <span className="font-mono text-[9px] uppercase px-1.5 py-0.5 rounded bg-gold-primary/20 text-gold-primary border border-gold-primary/30">
                Lore Active
              </span>
            ) : sessionWorld ? (
              <span className="font-mono text-[9px] uppercase px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">
                Session Synced
              </span>
            ) : undefined
          }
        >
          {sessionWorld && (
            <div className="flex items-center justify-between gap-2 pb-2 border-b border-gold-accent/15">
              <span className="font-mono text-[10px] text-ink-muted">
                Imported from session: <strong className="text-gold-primary font-semibold">{sessionWorld.name}</strong>
              </span>
              <button
                type="button"
                onClick={handleReimportSession}
                className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-mono bg-gold-accent/10 hover:bg-gold-accent/20 border border-gold-accent/30 text-gold-primary transition-colors shrink-0"
                title="Reset World Foundation parameters to current in-game session values"
              >
                <RefreshCw size={11} /> Re-import Session
              </button>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <Field label="Novel Inspiration" value={sourceTitle} onChange={setSourceTitle} placeholder="e.g. Fourth Wing" />
            <Field label="Author" value={sourceAuthor} onChange={setSourceAuthor} placeholder="e.g. Rebecca Yarros" />
          </div>
          <Field label="Canon Scope Boundary" value={sourceScope} onChange={setSourceScope} placeholder="e.g. Prologue only, Book 1, through Chapter 12" />
          {sourceTitle && !sourceScope && (
            <p className="text-[10px] text-amber-300/80 font-mono">⚠ No scope set — same as in-game, sourceTitle alone stays attribution-only and won't gate lore-accuracy mode.</p>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 border-t border-gold-accent/15">
            <Field label="Genre & Tone" value={genreTone} onChange={setGenreTone} placeholder="e.g. Dark gothic fantasy, gritty" />
            <Field label="Era & Technology" value={eraTechLevel} onChange={setEraTechLevel} placeholder="e.g. Late medieval, iron and timber" />
          </div>
          <Field label="Power System" value={powerSystem} onChange={setPowerSystem} placeholder="e.g. Blood-oaths and glowing rune carving" />
        </SectionCard>

        <SectionCard
          title={kind === 'character' ? 'Character Details' : kind === 'location' ? 'Location Details' : 'Region Details'}
          subtitle={name ? name : 'Name, role & visual parameters'}
          icon={kindIcon}
        >
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
        </SectionCard>

        <div className="flex flex-wrap gap-2">
          {kind !== 'map' && (
            <button
              type="button"
              onClick={handleResolve}
              disabled={busy !== null || !name.trim() || !apiSettings.apiKey}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#e8ca8a]/20 border border-[#e8ca8a]/50 text-[#e8ca8a] text-xs font-display font-semibold hover:bg-[#e8ca8a]/30 disabled:opacity-50 transition-colors"
            >
              <Sparkles size={13} /> Resolve Canon Description {loreAccuracyActive ? '' : '(no source set — will just clean up notes)'}
            </button>
          )}
          <button
            type="button"
            onClick={handleBuildPrompt}
            disabled={!name.trim()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#161a28] border border-gold-accent/40 text-gold-primary text-xs font-display font-semibold hover:bg-gold-accent/10 disabled:opacity-50 transition-colors"
          >
            Build Final Image Prompt
          </button>
          <button
            type="button"
            onClick={handleGenerateImage}
            disabled={busy !== null || !finalPrompt.trim() || !apiSettings.apiKey}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-[#f7e7ce] via-[#e8ca8a] to-[#d4af37] text-zinc-950 text-xs font-display font-bold hover:brightness-110 disabled:opacity-50 transition-all"
          >
            <ImageIcon size={13} /> Generate Test Image
          </button>
        </div>
        {!apiSettings.apiKey && <p className="text-[10px] text-amber-300/80 font-mono">⚠ No API key configured — set one in Settings → AI Model first.</p>}
        {error && <p className="text-[11px] text-red-300 font-mono bg-red-950/40 border border-red-500/30 rounded-lg p-2">{error}</p>}

        <OutputPanel title="Resolved Canon Description" value={resolvedDescription} busy={busy === 'resolve'} />
        <OutputPanel title="Final Image Generation Prompt" value={finalPrompt} />

        {(imageUrl || busy === 'image') && (
          <div className="rounded-xl border border-gold-accent/30 bg-[#12151f] overflow-hidden">
            <div className="flex items-center justify-between px-3.5 py-2.5 bg-[#0e101a] border-b border-gold-accent/15">
              <span className="font-mono text-[10px] uppercase tracking-wider text-gold-primary/90 font-bold">Generated Test Image</span>
              {modelUsed && <span className="font-mono text-[10px] text-ink-muted">Model: {modelUsed}</span>}
            </div>
            <div className="p-3 flex flex-col gap-2 items-center">
              {busy === 'image' ? (
                <div className="flex items-center gap-2 text-xs text-ink-muted py-6">
                  <RotateCw size={14} className="animate-spin" /> Generating...
                </div>
              ) : (
                imageUrl && (
                  <img src={imageUrl} alt="" className="max-h-96 rounded-lg border border-gold-accent/20" />
                )
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
