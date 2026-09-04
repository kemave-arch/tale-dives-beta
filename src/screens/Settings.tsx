import { useEffect, useMemo, useRef, useState } from 'react'
import { Cpu, SlidersHorizontal, Database, Info, X, Save, Download, Upload, RotateCcw, FolderOpen, FolderX, Maximize, Minimize } from 'lucide-react'
import { PROSE_DEPTHS } from '../api/turnContract.ts'
import { allProviders, getProvider } from '../api/providers/index.ts'
import { forgetSaveFolder, loadSaveFolder, pickSaveFolder, supportsFileSystemAccess } from '../lib/fsAccess.ts'
import {
  FIELD_CLASS, GLASS_SURFACE, GlassButton, GlassField, GlassIconButton, GlassSegmented, LABEL_CLASS, SELECT_CLASS,
} from '../lib/glassChrome.tsx'
import type { ApiSettings, Campaign, CombatMode, UiPrefs } from '../types.ts'

const TABS = [
  { id: 'model', label: 'AI Model', icon: Cpu },
  { id: 'gameplay', label: 'Gameplay', icon: SlidersHorizontal },
  { id: 'backup', label: 'Backup', icon: Database },
  { id: 'about', label: 'About', icon: Info },
] as const

const CONFETTI_COLORS = ['#f0ca65', '#f5dfa0', '#a9c1f5', '#f2a3c4', '#94e3bd', '#e8ca8a']

function Confetti({ count = 26 }: { count?: number }) {
  const bits = useMemo(
    () =>
      Array.from({ length: count }, () => ({
        left: `${Math.random() * 100}%`,
        color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
        width: `${5 + Math.random() * 4}px`,
        height: `${8 + Math.random() * 6}px`,
        duration: `${3.6 + Math.random() * 3.4}s`,
        // Negative delays so the fall is already in progress on open, rather
        // than every piece starting from the ceiling in one wave.
        delay: `${-(Math.random() * 7)}s`,
      })),
    [count],
  )
  return (
    <div className="bday-confetti" aria-hidden="true">
      {bits.map((b, i) => (
        <span
          key={i}
          style={{ left: b.left, background: b.color, width: b.width, height: b.height, animationDuration: b.duration, animationDelay: b.delay }}
        />
      ))}
    </div>
  )
}

function Gift({ box, ribbon, delay, size }: { box: string; ribbon: string; delay: string; size: number }) {
  return (
    <svg className="bday-gift" width={size} height={size} viewBox="0 0 64 64" style={{ animationDelay: delay }} aria-hidden="true">
      <rect x="10" y="27" width="44" height="29" rx="3" fill={box} />
      <rect x="7" y="19" width="50" height="10" rx="3" fill={box} />
      <rect x="7" y="19" width="50" height="10" rx="3" fill="#ffffff" opacity="0.12" />
      <rect x="28" y="19" width="8" height="37" fill={ribbon} />
      <path d="M32 19c-6-1.5-13-6-9.5-10.5C26 4.5 31 11 32 19Z" fill={ribbon} />
      <path d="M32 19c6-1.5 13-6 9.5-10.5C38 4.5 33 11 32 19Z" fill={ribbon} />
      <circle cx="32" cy="18.5" r="3.2" fill={ribbon} />
      <circle cx="32" cy="18.5" r="1.4" fill={box} opacity="0.55" />
    </svg>
  )
}

// The dedication this whole app was built around, so it gets the room and the
// occasion rather than a one-line credit at the bottom of a settings tab.
function AboutPanel() {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-[#e8ca8a]/25 bg-[#e8ca8a]/[0.05] px-5 py-7 text-center">
      <Confetti />
      <div className="relative">
        <p className="font-display text-[10px] uppercase tracking-[0.3em] text-[#e8ca8a]/70">Tale Dives is dedicated to</p>
        <h3 className="bday-title font-display font-bold text-3xl sm:text-4xl mt-3 leading-tight">Happy Birthday</h3>
        <p className="font-display font-bold text-xl text-[#f5dfa0] mt-2">Elisah Mirelle R. King</p>
        <p className="font-narrative italic text-sm text-[#e8ca8a]/85 mt-1">My Avid Bookworm</p>

        <div className="flex items-end justify-center gap-4 mt-6">
          <Gift box="#7c3f5d" ribbon="#f5dfa0" delay="0s" size={46} />
          <Gift box="#2f4a7c" ribbon="#f0ca65" delay="-0.9s" size={64} />
          <Gift box="#3f6b4f" ribbon="#f5dfa0" delay="-1.8s" size={42} />
        </div>

        <p className="font-narrative text-sm text-ink mt-6 max-w-sm mx-auto leading-relaxed">
          Every world in here was built so you'd always have one more story to fall into.
        </p>

        <div className="mt-7 pt-4 border-t border-[#e8ca8a]/15">
          <p className="font-display font-bold text-sm text-gold-primary tracking-[0.22em]">TALE DIVES</p>
          <p className="font-narrative text-xs text-ink-muted mt-1.5">App Developer: Kemuel Avenido</p>
          <p className="font-narrative text-xs text-ink-muted mt-0.5">
            An AI text-based fantasy RPG diving engine — local-first, provider-agnostic.
          </p>
        </div>
      </div>
    </div>
  )
}

export interface SettingsSavePayload {
  apiSettings: ApiSettings
  uiPrefs: UiPrefs
  proseDepthKey: keyof typeof PROSE_DEPTHS
  combatMode: CombatMode
}

interface SettingsProps {
  apiSettings: ApiSettings
  uiPrefs: UiPrefs
  game: Campaign | null
  onBack: () => void
  onSave: (payload: SettingsSavePayload) => void
  onExportActive: () => void
  onBackupAll: () => void
  onImportJson: (file: File) => void
  onResetDefaults: () => void
}

// Blueprint §6.4E — one drawer, reused pre-campaign and in-story. Gameplay
// controls (Prose Depth/Combat Mode) only apply once a Tale is active.
export default function Settings({
  apiSettings,
  uiPrefs,
  game,
  onBack,
  onSave,
  onExportActive,
  onBackupAll,
  onImportJson,
  onResetDefaults,
}: SettingsProps) {
  const [tab, setTab] = useState<(typeof TABS)[number]['id']>('model')
  const [provider, setProvider] = useState(apiSettings.provider)
  const [model, setModel] = useState(apiSettings.model)
  const [apiKey, setApiKey] = useState(apiSettings.apiKey)
  const [temperature, setTemperature] = useState(apiSettings.temperature)
  const [chromeOpacity, setChromeOpacity] = useState(uiPrefs.chromeOpacity)
  const [proseDepthKey, setProseDepthKey] = useState<keyof typeof PROSE_DEPTHS>(
    (game?.proseDepth?.label as keyof typeof PROSE_DEPTHS) ?? 'BALANCED',
  )
  const [combatMode, setCombatMode] = useState<CombatMode>(game?.combatMode ?? 'NARRATIVE')
  const [folderLinked, setFolderLinked] = useState<boolean | null>(null) // null = still checking
  const [isFullscreen, setIsFullscreen] = useState(!!document.fullscreenElement)
  const importRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const handleFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  const toggleFullscreen = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {})
    } else {
      document.documentElement.requestFullscreen().catch(() => {})
    }
  }

  // §6.4B Local Save status — re-checked on mount since a granted folder
  // handle's permission doesn't survive a page reload.
  useEffect(() => {
    let cancelled = false
    loadSaveFolder().then((handle) => {
      if (!cancelled) setFolderLinked(!!handle)
    })
    return () => {
      cancelled = true
    }
  }, [])

  async function linkFolder() {
    const handle = await pickSaveFolder()
    setFolderLinked(!!handle)
  }

  async function unlinkFolder() {
    await forgetSaveFolder()
    setFolderLinked(false)
  }

  function save() {
    onSave({
      apiSettings: { provider, model, apiKey, temperature },
      uiPrefs: { chromeOpacity },
      proseDepthKey,
      combatMode,
    })
  }

  return (
    // A modal over whatever screen is current (App renders it as an overlay,
    // not a route), so the artwork or the Chronicle's parchment stays visible
    // through it. The backdrop dims and blurs what's behind rather than hiding
    // it — the panel itself has to stay fairly opaque regardless, because its
    // text is light gold and would be unreadable over the cream reading
    // surface otherwise.
    <div
      className="fixed inset-0 z-30 flex items-start justify-center overflow-y-auto bg-black/55 backdrop-blur-[3px] px-4 py-8"
      onClick={onBack}
    >
      <div
        className={`rounded-3xl w-full p-5 border border-[#e8ca8a]/30 bg-[#0d0a14]/85 backdrop-blur-xl shadow-[0_24px_60px_-12px_rgba(0,0,0,0.8)] transition-[max-width] duration-300 ${
          tab === 'about' ? 'max-w-xl' : 'max-w-md'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display font-bold text-lg text-gold-primary">App Settings</h2>
          <GlassIconButton icon={X} label="Close" compact onClick={onBack} />
        </div>

        {/* Icon-only tabs — the shared GlassTabs (MainMenu/Codex) labels each
            button, but here 4 labels ("AI Model", "Gameplay", ...) don't fit
            this modal's narrower width without overflowing. The active
            tab's name moves to a header below instead, so nothing is lost. */}
        <nav className={`${GLASS_SURFACE} rounded-2xl p-1 flex items-center justify-center gap-1 mb-2.5`}>
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              aria-label={label}
              title={label}
              className={`w-11 h-11 rounded-xl inline-flex items-center justify-center border transition-colors duration-150 ${
                tab === id ? 'border-[#f0ca65]/70 text-[#f5dfa0]' : 'border-transparent text-[#e8ca8a]/85 hover:text-[#f5dfa0]'
              }`}
            >
              <Icon size={18} />
            </button>
          ))}
        </nav>
        <h3 className="text-center font-display text-sm font-semibold tracking-wide text-[#f0ca65] mb-4">
          {TABS.find((t) => t.id === tab)?.label}
        </h3>

        {tab === 'model' && (
          <div className="flex flex-col gap-4">
            <GlassField label="Provider">
              <select
                value={provider}
                onChange={(e) => {
                  const nextProvider = e.target.value
                  setProvider(nextProvider)
                  const models = getProvider(nextProvider).models
                  if (!models.some((m) => m.id === model)) setModel(models[0]?.id ?? '')
                }}
                className={SELECT_CLASS}
              >
                {allProviders().map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </GlassField>

            <GlassField label="Model ID">
              <select value={model} onChange={(e) => setModel(e.target.value)} className={SELECT_CLASS}>
                {!getProvider(provider).models.some((m) => m.id === model) && model && (
                  <option value={model}>{model} (custom)</option>
                )}
                {getProvider(provider).models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
            </GlassField>

            <GlassField label="API Key">
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={`Paste your ${getProvider(provider).label} API key`}
                className={`${FIELD_CLASS} font-mono`}
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
                How unpredictable the prose gets. Low (0–0.5) keeps the Narrator steady and consistent; high (1.5–2)
                adds more surprise and flourish but risks losing coherence.
              </p>
            </div>
          </div>
        )}

        {tab === 'gameplay' && (
          <div className="flex flex-col gap-5">
            {/* The Skin picker (Parchment/Obsidian) used to sit here. It was
                retired with the move to a single dark-glass theme — the light
                Parchment skin was the default, and was why this screen and the
                Codex read as a different app from Title/MainMenu. The reading
                surface in Chronicle is still warm paper; that's now a scoped
                override in index.css rather than a whole-app skin. */}
            <div>
              <p className={LABEL_CLASS}>Prose Depth</p>
              <GlassSegmented
                className="mt-2"
                options={(Object.keys(PROSE_DEPTHS) as (keyof typeof PROSE_DEPTHS)[]).map((key) => ({ id: key, label: key }))}
                value={proseDepthKey}
                onChange={setProseDepthKey}
              />
            </div>

            <div>
              <p className={LABEL_CLASS}>Combat Resolution Mode</p>
              <GlassSegmented
                className="mt-2"
                options={[
                  { id: 'TACTICAL', label: 'Tactical' },
                  { id: 'NARRATIVE', label: 'Narrative' },
                ] as const}
                value={combatMode}
                onChange={setCombatMode}
              />
              {!game && <p className="font-narrative text-[11px] text-ink-muted mt-1.5">Applies once a Tale is active.</p>}
            </div>

            <div>
              <p className={LABEL_CLASS}>
                HUD Opacity <span className="opacity-60 font-mono normal-case tracking-normal">{Math.round(chromeOpacity * 100)}%</span>
              </p>
              <input
                type="range"
                min="0.1"
                max="1"
                step="0.05"
                value={chromeOpacity}
                onChange={(e) => setChromeOpacity(Number(e.target.value))}
                className="w-full mt-2 accent-gold-action"
              />
              <p className="font-narrative text-[11px] text-ink-muted mt-1">
                How solid the header, HUD, and input bar glass look over the ambient background. Lower is more see-through; 100% is fully solid.
              </p>
            </div>

            <div>
              <p className={LABEL_CLASS}>Display</p>
              <div className="mt-2">
                <GlassButton onClick={toggleFullscreen} icon={isFullscreen ? Minimize : Maximize} tone="default" className="w-full">
                  {isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
                </GlassButton>
              </div>
            </div>
          </div>
        )}

        {tab === 'backup' && (
          <div className="flex flex-col gap-3">
            {/* §6.4B Local Save status — a status indicator, not a freely
                reversible toggle: On-Device Folder writes Export/Backup
                directly to a chosen folder; Browser Only (the fallback
                everywhere without File System Access API support) keeps
                using the plain download flow below. */}
            <div className="rounded-xl border border-gold-accent/25 bg-gold-accent/[0.04] backdrop-blur-sm px-3 py-2.5 flex items-center gap-2.5">
              {folderLinked ? <FolderOpen size={16} className="text-gold-primary shrink-0" /> : <FolderX size={16} className="text-ink-muted shrink-0" />}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-display">
                  {!supportsFileSystemAccess()
                    ? 'Browser Only'
                    : folderLinked
                      ? 'On-Device Folder'
                      : 'Browser Only'}
                </p>
                <p className="font-narrative text-[11px] text-ink-muted">
                  {!supportsFileSystemAccess()
                    ? 'This browser has no folder-save support — Export writes a normal download.'
                    : folderLinked
                      ? 'Export & Backup write directly into your chosen folder.'
                      : 'Saves live in this browser only — clearing site data erases them. Link a folder, or use Export for backup.'}
                </p>
              </div>
              {supportsFileSystemAccess() && (
                <GlassButton onClick={folderLinked ? unlinkFolder : linkFolder} className="shrink-0 !py-1.5 !text-[11px]">
                  {folderLinked ? 'Unlink' : 'Choose Folder'}
                </GlassButton>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <GlassButton onClick={onExportActive} disabled={!game} icon={Download}>
                Export Active
              </GlassButton>
              <GlassButton onClick={onBackupAll} icon={Database}>
                Backup All
              </GlassButton>
              <GlassButton onClick={() => importRef.current?.click()} tone="positive" icon={Upload}>
                Import JSON
              </GlassButton>
              <GlassButton onClick={onResetDefaults} tone="danger" icon={RotateCcw}>
                Reset Defaults
              </GlassButton>
              <input
                ref={importRef}
                type="file"
                accept="application/json"
                hidden
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) onImportJson(file)
                  e.target.value = ''
                }}
              />
            </div>
          </div>
        )}

        {tab === 'about' && <AboutPanel />}

        <div className="flex justify-end gap-2 mt-6">
          <GlassIconButton icon={X} label="Cancel" onClick={onBack} />
          <GlassIconButton icon={Save} label="Save Settings" tone="action" onClick={save} disabled={!model || !apiKey} />
        </div>
      </div>
    </div>
  )
}
