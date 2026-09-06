import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Cpu, SlidersHorizontal, Database, X, Download, Upload, RotateCcw,
  FolderOpen, FolderX, Maximize, Minimize, Trash2, Volume2, VolumeX,
  Cloud, CloudUpload, CloudDownload, Loader2, Check, RefreshCw,
} from 'lucide-react'
import { PROSE_DEPTHS } from '../api/turnContract.ts'
import { allProviders, getProvider } from '../api/providers/index.ts'
import { forgetSaveFolder, loadSaveFolder, pickSaveFolder, supportsFileSystemAccess } from '../lib/fsAccess.ts'
import {
  FIELD_CLASS, GLASS_SURFACE, GlassButton, GlassField, GlassIconButton, GlassSegmented, LABEL_CLASS, SELECT_CLASS,
} from '../lib/glassChrome.tsx'
import {
  initGoogleAuth, signOutGoogle, listDriveBackups, signInWithGoogle,
  type GoogleDriveFile, type User,
} from '../lib/googleDrive.ts'
import type { ApiSettings, Campaign, CombatMode, UiPrefs } from '../types.ts'

const TABS = [
  { id: 'model', label: 'AI Model', icon: Cpu },
  { id: 'gameplay', label: 'Gameplay', icon: SlidersHorizontal },
  { id: 'storage', label: 'Storage', icon: Database },
] as const

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
  onClearCache: () => void
  musicMuted?: boolean
  onToggleMusicMute?: () => void
  onBackupCloud?: () => Promise<boolean>
  onRestoreCloud?: (fileId?: string) => Promise<boolean>
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
  onClearCache,
  musicMuted = false,
  onToggleMusicMute,
  onBackupCloud,
  onRestoreCloud,
}: SettingsProps) {
  const [tab, setTab] = useState<(typeof TABS)[number]['id']>('model')
  const [storageSubtab, setStorageSubtab] = useState<'local' | 'cloud'>('local')
  const [provider, setProvider] = useState(apiSettings.provider)
  const [model, setModel] = useState(apiSettings.model)
  const [apiKey, setApiKey] = useState(apiSettings.apiKey)
  const [temperature, setTemperature] = useState(apiSettings.temperature)
  const [chromeOpacity, setChromeOpacity] = useState(uiPrefs.chromeOpacity)
  const [debugMode, setDebugMode] = useState<boolean>(uiPrefs.debugMode ?? false)
  const [introGazeDelay, setIntroGazeDelay] = useState<boolean>(uiPrefs.introGazeDelay ?? true)
  const [proseDepthKey, setProseDepthKey] = useState<keyof typeof PROSE_DEPTHS>(
    (game?.proseDepth?.label as keyof typeof PROSE_DEPTHS) ?? 'BALANCED',
  )
  const [combatMode, setCombatMode] = useState<CombatMode>(game?.combatMode ?? 'NARRATIVE')
  const [folderLinked, setFolderLinked] = useState<boolean | null>(null) // null = still checking
  const [isFullscreen, setIsFullscreen] = useState(!!document.fullscreenElement)
  const [googleUser, setGoogleUser] = useState<User | null>(null)
  const [autoCloudBackup, setAutoCloudBackup] = useState<boolean>(uiPrefs.autoCloudBackup ?? false)
  const [driveFiles, setDriveFiles] = useState<GoogleDriveFile[]>([])
  const [selectedRestoreFileId, setSelectedRestoreFileId] = useState<string>('')
  const [loadingDriveFiles, setLoadingDriveFiles] = useState(false)
  const [cloudBusy, setCloudBusy] = useState<'backup' | 'restore' | null>(null)
  const [cloudFeedback, setCloudFeedback] = useState<string | null>(null)
  const importRef = useRef<HTMLInputElement>(null)

  const refreshDriveFiles = useCallback(async () => {
    setLoadingDriveFiles(true)
    try {
      const files = await listDriveBackups(true)
      setDriveFiles(files)
      if (files.length > 0 && !selectedRestoreFileId) {
        setSelectedRestoreFileId(files[0].id)
      }
    } catch {
      // silent
    } finally {
      setLoadingDriveFiles(false)
    }
  }, [selectedRestoreFileId])

  useEffect(() => {
    const unsub = initGoogleAuth((user) => {
      setGoogleUser(user)
    })
    return () => unsub()
  }, [])

  useEffect(() => {
    if (tab === 'storage' && googleUser) {
      refreshDriveFiles()
    }
  }, [tab, googleUser, refreshDriveFiles])

  async function handleBackupCloud() {
    if (!onBackupCloud || cloudBusy) return
    setCloudBusy('backup')
    try {
      const ok = await onBackupCloud()
      if (ok) {
        setCloudFeedback(`Saved to Google Drive!`)
        setTimeout(() => setCloudFeedback(null), 4000)
        await refreshDriveFiles()
      }
    } finally {
      setCloudBusy(null)
    }
  }

  async function handleRestoreCloud() {
    if (!onRestoreCloud || cloudBusy) return
    setCloudBusy('restore')
    try {
      const target = selectedRestoreFileId || undefined
      const ok = await onRestoreCloud(target)
      if (ok) {
        setCloudFeedback('Restored from Google Drive!')
        setTimeout(() => setCloudFeedback(null), 4000)
        await refreshDriveFiles()
      }
    } finally {
      setCloudBusy(null)
    }
  }

  async function handleSignOutGoogle() {
    await signOutGoogle()
    setGoogleUser(null)
    setDriveFiles([])
    setSelectedRestoreFileId('')
    setCloudFeedback('Signed out of Google Drive.')
    setTimeout(() => setCloudFeedback(null), 3000)
  }

  async function handleSignInGoogle() {
    try {
      const res = await signInWithGoogle()
      if (res?.user) {
        setGoogleUser(res.user)
        setCloudFeedback('Linked Google Drive.')
        setTimeout(() => setCloudFeedback(null), 3000)
        refreshDriveFiles()
      }
    } catch (e) {
      console.error(e)
    }
  }

  function formatBackupDate(isoString?: string): string {
    if (!isoString) return 'Empty'
    try {
      const d = new Date(isoString)
      return d.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    } catch {
      return 'Saved'
    }
  }

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
      uiPrefs: { chromeOpacity, debugMode, introGazeDelay, autoCloudBackup },
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
        className="rounded-3xl w-full p-5 border border-[#e8ca8a]/30 bg-[#0d0a14]/85 backdrop-blur-xl shadow-[0_24px_60px_-12px_rgba(0,0,0,0.8)] transition-[max-width] duration-300 max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display font-bold text-lg text-gold-primary">App Settings</h2>
          <div className="flex items-center gap-1.5">
            {onToggleMusicMute && (
              <GlassIconButton
                icon={musicMuted ? VolumeX : Volume2}
                label={musicMuted ? 'Unmute music' : 'Mute music'}
                compact
                onClick={onToggleMusicMute}
              />
            )}
            <GlassIconButton icon={X} label="Close" compact onClick={onBack} />
          </div>
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
        <h3 className="text-center font-display text-sm font-semibold tracking-wide text-[#e8ca8a] mb-4">
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
                How unpredictable the prose gets. Low (0–0.5) keeps the Narrator steady; high (1.5–2)
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
              {!game && <p className="font-narrative italic text-xs text-[#d8c49e] mt-1.5">Applies once a Tale is active.</p>}
            </div>

            <div>
              <div className="flex items-baseline justify-between">
                <span className={LABEL_CLASS}>HUD Opacity</span>
                <span className="font-mono text-xs font-semibold text-[#fae5b5]">{Math.round(chromeOpacity * 100)}%</span>
              </div>
              <input
                type="range"
                min="0.1"
                max="1"
                step="0.05"
                value={chromeOpacity}
                onChange={(e) => setChromeOpacity(Number(e.target.value))}
                className="w-full mt-2 accent-[#f0ca65] cursor-pointer"
              />
              <p className="font-narrative italic text-xs text-[#d8c49e] mt-1">
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

            <div>
              <p className={LABEL_CLASS}>Developer & Title Mode</p>
              <div className="mt-2 flex flex-col gap-2.5 rounded-xl border border-gold-accent/25 bg-gold-accent/[0.04] p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-display font-bold text-gold-primary">Debug Mode</p>
                    <p className="font-narrative italic text-[11px] text-[#d8c49e] leading-snug">
                      When ON, turns off the 4-second "Initializing..." delay on START for instant navigation.
                    </p>
                  </div>
                  <GlassSegmented
                    className="shrink-0"
                    options={[
                      { id: 'off', label: 'OFF' },
                      { id: 'on', label: 'ON' },
                    ]}
                    value={debugMode ? 'on' : 'off'}
                    onChange={(v) => {
                      const isDbg = v === 'on'
                      setDebugMode(isDbg)
                      if (isDbg) setIntroGazeDelay(false)
                      else setIntroGazeDelay(true)
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === 'storage' && (
          <div className="flex flex-col gap-3">
            <GlassSegmented
              options={[
                { id: 'local', label: 'Local' },
                { id: 'cloud', label: 'Cloud' },
              ]}
              value={storageSubtab}
              onChange={(v) => setStorageSubtab(v as 'local' | 'cloud')}
            />

            {storageSubtab === 'local' && (
              <div className="flex flex-col gap-3 mt-1">
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
                    <p className="font-narrative text-[11px] text-ink-muted leading-tight mt-0.5">
                      {!supportsFileSystemAccess()
                        ? 'This browser has no folder-save support — Export writes a normal download.'
                        : folderLinked
                          ? 'Export & Backup write directly into your chosen folder.'
                          : 'Saves live in this browser only. Link a folder, or use Export to save.'}
                    </p>
                  </div>
                  {supportsFileSystemAccess() && (
                    <GlassButton onClick={folderLinked ? unlinkFolder : linkFolder} className="shrink-0 !py-1.5 !text-[11px]">
                      {folderLinked ? 'Unlink' : 'Choose'}
                    </GlassButton>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 mt-1">
                  <GlassButton onClick={onExportActive} disabled={!game} icon={Download}>
                    Export Active
                  </GlassButton>
                  <GlassButton
                    onClick={onBackupAll}
                    icon={Database}
                    className="border-[#e8ca8a]/50 text-[#f5dfa0] hover:border-[#f0ca65] hover:bg-[#e8ca8a]/15 transition-all shadow-[0_0_12px_rgba(232,202,138,0.1)]"
                  >
                    Backup All
                  </GlassButton>
                  <GlassButton onClick={() => importRef.current?.click()} icon={Upload}>
                    Import JSON
                  </GlassButton>
                  <GlassButton onClick={onResetDefaults} tone="danger" icon={RotateCcw}>
                    Reset Defaults
                  </GlassButton>
                  <GlassButton onClick={onClearCache} tone="danger" icon={Trash2} className="col-span-2 mt-1">
                    Clear Local Data
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

            {storageSubtab === 'cloud' && (
              <div className="flex flex-col gap-3 mt-1">
                <div className="rounded-xl border border-emerald/20 bg-emerald/5 backdrop-blur-sm px-3 py-2.5">
                  <p className="font-narrative text-[11.5px] text-emerald leading-snug">
                    <Check size={12} className="inline mr-1 -mt-0.5" />
                    <strong>Private & Secure:</strong> Your save data is stored directly in your own Google Drive. We never access your files.
                  </p>
                </div>

                <div className="rounded-xl border border-gold-accent/25 bg-gold-accent/[0.04] backdrop-blur-sm px-3 py-2.5 flex flex-col gap-2.5">
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <Cloud size={16} className={googleUser ? 'text-emerald shrink-0' : 'text-gold-primary shrink-0'} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-display">Google Drive Account</p>
                        {googleUser && (
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full border border-emerald/40 text-emerald bg-emerald/10">
                            Linked
                          </span>
                        )}
                      </div>
                      <p className="font-narrative text-[11px] text-ink-muted truncate mt-0.5">
                        {googleUser ? googleUser.email ?? 'Connected' : 'Sync your campaign progress.'}
                      </p>
                    </div>
                  </div>
                  
                  {googleUser ? (
                    <GlassButton
                      onClick={handleSignOutGoogle}
                      className="w-full !py-1.5 !text-[11px] !border-rose-400/30 !text-rose-300 hover:!border-rose-400"
                    >
                      Disconnect Account
                    </GlassButton>
                  ) : (
                    <GlassButton onClick={handleSignInGoogle} className="w-full !py-1.5 !text-[11px]" tone="action">
                      Link Account
                    </GlassButton>
                  )}
                  
                  {cloudFeedback && (
                    <p className="font-narrative text-[11px] text-gold-primary flex items-center justify-center gap-1 mt-1">
                      <Check size={12} className="text-emerald" /> {cloudFeedback}
                    </p>
                  )}
                </div>

                {googleUser && (
                  <>
                    <div className="rounded-xl border border-gold-accent/25 bg-gold-accent/[0.04] backdrop-blur-sm px-3 py-2.5 flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-display text-[#f5dfa0]">Auto-Backup</p>
                        <p className="font-narrative text-[11px] text-ink-muted leading-tight mt-0.5">
                          Automatically upload progress to the cloud when you complete a chapter or manually save.
                        </p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer shrink-0">
                        <input
                          type="checkbox"
                          checked={autoCloudBackup}
                          onChange={(e) => setAutoCloudBackup(e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-black/50 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-ink-muted peer-checked:after:bg-black after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-gold-primary border border-gold-accent/30"></div>
                      </label>
                    </div>

                    <div className="rounded-xl border border-gold-accent/25 bg-gold-accent/[0.04] backdrop-blur-sm px-3 py-3 flex flex-col gap-3">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-display text-gold-primary flex items-center gap-1.5">
                          <Database size={14} /> Cloud Versions
                        </p>
                        <button
                          type="button"
                          onClick={refreshDriveFiles}
                          disabled={loadingDriveFiles}
                          className="text-[10px] text-gold-accent/80 hover:text-gold-primary flex items-center gap-1 font-mono transition-colors"
                        >
                          <RefreshCw size={10} className={loadingDriveFiles ? 'animate-spin' : ''} />
                          <span>Refresh</span>
                        </button>
                      </div>
                      
                      {driveFiles.length > 0 ? (
                        <div className="flex flex-col gap-1.5">
                          <span className="text-[10px] font-mono text-ink-muted uppercase tracking-wider mb-0.5">Restore From:</span>
                          <select
                            value={selectedRestoreFileId}
                            onChange={(e) => setSelectedRestoreFileId(e.target.value)}
                            className="w-full bg-black/50 border border-gold-accent/30 rounded-lg px-2 py-1.5 text-xs text-gold-accent focus:outline-none focus:border-gold-primary font-mono truncate"
                          >
                            {driveFiles.map((f, i) => {
                              const timeStr = formatBackupDate(f.modifiedTime)
                              return (
                                <option key={f.id} value={f.id} className="bg-[#121520] text-gold-accent">
                                  Version {driveFiles.length - i} ({timeStr})
                                </option>
                              )
                            })}
                          </select>
                        </div>
                      ) : (
                        <p className="text-[11px] font-narrative text-ink-muted italic">No cloud backups found yet.</p>
                      )}

                      <div className="grid grid-cols-2 gap-2 mt-1">
                        <GlassButton
                          onClick={handleBackupCloud}
                          disabled={cloudBusy !== null}
                          icon={cloudBusy === 'backup' ? Loader2 : CloudUpload}
                          tone="action"
                          className={cloudBusy === 'backup' ? 'animate-pulse' : ''}
                        >
                          {cloudBusy === 'backup' ? 'Uploading...' : 'Upload Now'}
                        </GlassButton>
                        <GlassButton
                          onClick={handleRestoreCloud}
                          disabled={cloudBusy !== null || driveFiles.length === 0}
                          icon={cloudBusy === 'restore' ? Loader2 : CloudDownload}
                          tone="positive"
                          className={cloudBusy === 'restore' ? 'animate-pulse' : ''}
                        >
                          {cloudBusy === 'restore' ? 'Restoring...' : 'Restore'}
                        </GlassButton>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2 mt-6">
          <GlassIconButton icon={X} label="Cancel" onClick={onBack} />
          <GlassIconButton icon={Check} label="Save Settings" tone="action" onClick={save} disabled={!model || !apiKey} />
        </div>
      </div>
    </div>
  )
}
