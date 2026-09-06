import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Cpu, SlidersHorizontal, HardDrive, Cloud, X, Download, Upload, RotateCcw,
  FolderOpen, FolderX, Maximize, Minimize, Trash2, Volume2, VolumeX,
  CloudUpload, CloudDownload, Loader2, Check, RefreshCw, KeyRound, Bot, Server,
  Dice5, Layers, Swords, Monitor, Bug, UserCircle, History, AlertTriangle, LogOut,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { PROSE_DEPTHS } from '../api/turnContract.ts'
import { allProviders, getProvider } from '../api/providers/index.ts'
import { forgetSaveFolder, loadSaveFolder, pickSaveFolder, supportsFileSystemAccess } from '../lib/fsAccess.ts'
import {
  FIELD_CLASS, GlassButton, GlassIconButton, GlassSegmented, InfoTooltip, LABEL_CLASS, SELECT_CLASS,
} from '../lib/glassChrome.tsx'
import {
  initGoogleAuth, signOutGoogle, listDriveBackups, signInWithGoogle, getGoogleAccessToken,
  type GoogleDriveFile, type User,
} from '../lib/googleDrive.ts'
import type { ApiSettings, Campaign, CombatMode, UiPrefs } from '../types.ts'

const TABS = [
  { id: 'model', label: 'AI Model', icon: Cpu },
  { id: 'gameplay', label: 'Gameplay', icon: SlidersHorizontal },
  { id: 'local', label: 'Local', icon: HardDrive },
  { id: 'cloud', label: 'Cloud', icon: Cloud },
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

// A field's label row: an icon (the "prefer icons" ask) + text, with an
// optional tap-to-reveal tooltip for anything that needs more than a
// glance to understand — replaces the old always-on italic caption
// paragraphs, which ate a lot of vertical space on a small phone screen
// across 4 tabs' worth of settings.
function FieldLabel({ icon: Icon, children, tip }: { icon: LucideIcon; children: string; tip?: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <Icon size={13} className="text-gold-primary/80 shrink-0" />
      <span className={LABEL_CLASS}>{children}</span>
      {tip && <InfoTooltip text={tip} />}
    </div>
  )
}

// Blueprint §6.4E — one drawer, reused pre-campaign and in-story. Gameplay
// controls (Prose Depth/Combat Mode) only apply once a Tale is active.
//
// Refactored for mobile: a near-full-height sheet instead of a floating
// card (more room, no wasted margin), 4 flat icon tabs instead of 3 with a
// nested Storage subtab (Local/Cloud were a tab-inside-a-tab — now peers,
// so neither reads as buried), a sticky Save/Cancel footer that's always
// reachable regardless of how tall a tab's content gets (the old layout
// put Save at the very bottom of the whole scrollable panel — on the Cloud
// tab, once Drive linking/auto-backup/version list are all showing, that
// meant scrolling past all of it just to save), and icon+tooltip field
// labels instead of permanent caption paragraphs under every control.
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
  const [hasGoogleToken, setHasGoogleToken] = useState(false)
  const [autoCloudBackup, setAutoCloudBackup] = useState<boolean>(uiPrefs.autoCloudBackup ?? false)
  const [driveFiles, setDriveFiles] = useState<GoogleDriveFile[]>([])
  const [selectedRestoreFileId, setSelectedRestoreFileId] = useState<string>('')
  const [loadingDriveFiles, setLoadingDriveFiles] = useState(false)
  const [cloudBusy, setCloudBusy] = useState<'backup' | 'restore' | null>(null)
  const [cloudFeedback, setCloudFeedback] = useState<string | null>(null)
  const [isSigningInGoogle, setIsSigningInGoogle] = useState(false)
  const [availHeight, setAvailHeight] = useState<number | null>(null)
  const importRef = useRef<HTMLInputElement>(null)

  // Same window.visualViewport-driven sizing already used by the retry/
  // long-text editors — the panel shrinks to fit above the mobile soft
  // keyboard (relevant here for the API Key field) instead of the keyboard
  // just covering whatever's underneath it.
  useEffect(() => {
    const updateHeight = () => {
      if (window.visualViewport) setAvailHeight(window.visualViewport.height - 16)
    }
    updateHeight()
    window.visualViewport?.addEventListener('resize', updateHeight)
    return () => window.visualViewport?.removeEventListener('resize', updateHeight)
  }, [])

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

  // Auto-Backup silently no-ops if enabled but the (memory-only, by design
  // — see googleDrive.ts) access token was lost on a page refresh. Rather
  // than leave that invisible, check on tab-open and surface a reconnect
  // prompt instead of a toggle that quietly does nothing.
  useEffect(() => {
    if (tab !== 'cloud') return
    getGoogleAccessToken().then((t) => setHasGoogleToken(!!t))
  }, [tab, googleUser])

  useEffect(() => {
    if (tab === 'cloud' && googleUser) {
      refreshDriveFiles()
    }
  }, [tab, googleUser, refreshDriveFiles])

  async function handleBackupCloud() {
    if (!onBackupCloud || cloudBusy) return
    setCloudBusy('backup')
    try {
      const ok = await onBackupCloud()
      if (ok) {
        setHasGoogleToken(true)
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
    setHasGoogleToken(false)
    setDriveFiles([])
    setSelectedRestoreFileId('')
    setCloudFeedback('Signed out of Google Drive.')
    setTimeout(() => setCloudFeedback(null), 3000)
  }

  async function handleSignInGoogle() {
    if (isSigningInGoogle) return
    setIsSigningInGoogle(true)
    setCloudFeedback(null)
    try {
      const res = await signInWithGoogle()
      if (res?.user) {
        setGoogleUser(res.user)
        setHasGoogleToken(true)
        setCloudFeedback('Linked Google Drive.')
        setTimeout(() => setCloudFeedback(null), 3000)
        refreshDriveFiles()
      }
    } catch (e: any) {
      const msg = e?.message ?? ''
      const code = e?.code
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        return
      }
      if (code === 'auth/unauthorized-domain' || msg.includes('unauthorized-domain')) {
        const domain = typeof window !== 'undefined' ? window.location.hostname : 'this domain'
        setCloudFeedback(`Domain unauthorized: Add "${domain}" to Firebase Console -> Authentication -> Settings -> Authorized domains.`)
        setTimeout(() => setCloudFeedback(null), 12000)
        return
      }
      if (msg.includes('Redirecting to Google sign-in')) {
        setCloudFeedback('Redirecting to Google sign-in...')
        return
      }
      setCloudFeedback(msg || 'Sign-in was interrupted. Please check popup permissions.')
      setTimeout(() => setCloudFeedback(null), 6000)
    } finally {
      setIsSigningInGoogle(false)
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

  const needsReconnect = autoCloudBackup && googleUser && !hasGoogleToken

  return (
    // A modal over whatever screen is current (App renders it as an overlay,
    // not a route) — but now a near-full-height sheet on mobile rather than
    // a floating card with margins on every side, so there's actually room
    // for 4 tabs' worth of settings without everything feeling cramped.
    <div
      className="fixed inset-0 z-30 flex items-stretch sm:items-center justify-center bg-black/55 backdrop-blur-[3px] sm:px-4 sm:py-8"
      onClick={onBack}
    >
      <div
        className="flex flex-col w-full sm:max-w-md sm:rounded-3xl border-0 sm:border border-[#e8ca8a]/30 bg-[#0d0a14]/95 sm:bg-[#0d0a14]/85 backdrop-blur-xl shadow-[0_24px_60px_-12px_rgba(0,0,0,0.8)]"
        style={{ height: availHeight ? `${Math.min(availHeight, window.innerWidth >= 640 ? 720 : availHeight)}px` : undefined, maxHeight: '100dvh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header — shrink-0, always visible regardless of tab content height */}
        <div className="shrink-0 flex items-center justify-between px-5 pt-5 sm:pt-4 pb-3">
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

        {/* 4 flat icon tabs — Local/Cloud used to be a subtab nested inside
            a 3rd "Storage" tab; now peers, so nothing reads as buried a
            level down, and each tab's own content stays shorter. */}
        <nav className="shrink-0 grid grid-cols-4 gap-1 px-5 pb-1">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              aria-label={label}
              className={`flex flex-col items-center gap-1 rounded-xl py-2 border transition-colors duration-150 ${
                tab === id
                  ? 'border-[#f0ca65]/70 text-[#f5dfa0] bg-[#f0ca65]/10'
                  : 'border-transparent text-[#e8ca8a]/70 hover:text-[#f5dfa0] hover:bg-white/5'
              }`}
            >
              <Icon size={18} />
              <span className="font-display text-[9.5px] uppercase tracking-wide">{label}</span>
            </button>
          ))}
        </nav>

        {/* Scrollable body — the ONLY part that scrolls, so header/tabs/
            footer stay put no matter how tall a tab's content gets. */}
        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4">
          {tab === 'model' && (
            <div className="flex flex-col gap-4">
              <div>
                <FieldLabel icon={Server}>Provider</FieldLabel>
                <select
                  value={provider}
                  onChange={(e) => {
                    const nextProvider = e.target.value
                    setProvider(nextProvider)
                    const models = getProvider(nextProvider).models
                    if (!models.some((m) => m.id === model)) setModel(models[0]?.id ?? '')
                  }}
                  className={`${SELECT_CLASS} mt-1.5`}
                >
                  {allProviders().map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <FieldLabel icon={Bot}>Model ID</FieldLabel>
                <select value={model} onChange={(e) => setModel(e.target.value)} className={`${SELECT_CLASS} mt-1.5`}>
                  {!getProvider(provider).models.some((m) => m.id === model) && model && (
                    <option value={model}>{model} (custom)</option>
                  )}
                  {getProvider(provider).models.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <FieldLabel icon={KeyRound}>API Key</FieldLabel>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={`Paste your ${getProvider(provider).label} API key`}
                  className={`${FIELD_CLASS} font-mono mt-1.5`}
                />
              </div>

              <div>
                <div className="flex items-baseline justify-between">
                  <FieldLabel icon={Dice5} tip="How unpredictable the prose gets. Low (0–0.5) keeps the Narrator steady; high (1.5–2) adds more surprise and flourish but risks losing coherence.">
                    Creativity Randomness
                  </FieldLabel>
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
              </div>
            </div>
          )}

          {tab === 'gameplay' && (
            <div className="flex flex-col gap-5">
              <div>
                <FieldLabel icon={Layers} tip="How long each turn's prose runs — CONCISE for a tighter, faster-paced read; IMMERSIVE for the fullest scene-by-scene detail.">
                  Prose Depth
                </FieldLabel>
                <GlassSegmented
                  className="mt-2"
                  options={(Object.keys(PROSE_DEPTHS) as (keyof typeof PROSE_DEPTHS)[]).map((key) => ({ id: key, label: key }))}
                  value={proseDepthKey}
                  onChange={setProseDepthKey}
                />
              </div>

              <div>
                <FieldLabel
                  icon={Swords}
                  tip="Narrative: the Narrator resolves fights from context — your move, footwork, and cleverness matter, no hidden math. Tactical: damage is computed client-side from your stats before the Narrator ever sees it."
                >
                  Combat Resolution Mode
                </FieldLabel>
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
                  <FieldLabel icon={Monitor} tip="How solid the header, HUD, and input bar glass look over the ambient background. Lower is more see-through; 100% is fully solid.">
                    HUD Opacity
                  </FieldLabel>
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
              </div>

              <div>
                <FieldLabel icon={isFullscreen ? Minimize : Maximize}>Display</FieldLabel>
                <div className="mt-2">
                  <GlassButton onClick={toggleFullscreen} icon={isFullscreen ? Minimize : Maximize} tone="default" className="w-full">
                    {isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
                  </GlassButton>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 rounded-xl border border-gold-accent/25 bg-gold-accent/[0.04] p-3">
                <FieldLabel icon={Bug} tip='When ON, turns off the 4-second "Initializing..." delay on START for instant navigation — useful while iterating, not meant to stay on for real play.'>
                  Debug Mode
                </FieldLabel>
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
          )}

          {tab === 'local' && (
            <div className="flex flex-col gap-3">
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
                  icon={HardDrive}
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

          {tab === 'cloud' && (
            <div className="flex flex-col gap-3">
              <div className="rounded-xl border border-gold-accent/25 bg-gold-accent/[0.04] backdrop-blur-sm px-3 py-2.5 flex flex-col gap-2.5">
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <UserCircle size={16} className={googleUser ? 'text-emerald shrink-0' : 'text-gold-primary shrink-0'} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-display inline-flex items-center gap-1">
                        Google Drive
                        <InfoTooltip text="Saves go to your own Google Drive under drive.file access — the app can only see files it creates itself, never the rest of your Drive." />
                      </span>
                      {googleUser && (
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full border border-emerald/40 text-emerald bg-emerald/10 shrink-0">
                          Linked
                        </span>
                      )}
                    </div>
                    <p className="font-narrative text-[11px] text-ink-muted leading-tight mt-0.5">
                      {googleUser ? googleUser.email ?? 'Connected' : 'Sync online to privately access your Tales anywhere.'}
                    </p>
                  </div>
                </div>

                {googleUser ? (
                  <GlassButton onClick={handleSignOutGoogle} tone="danger" icon={LogOut} className="w-full !py-1.5 !text-[11px]">
                    Disconnect Account
                  </GlassButton>
                ) : (
                  <GlassButton
                    type="button"
                    onClick={handleSignInGoogle}
                    disabled={isSigningInGoogle}
                    icon={isSigningInGoogle ? Loader2 : undefined}
                    tone="action"
                    className={`w-full !py-1.5 !text-[11px] ${isSigningInGoogle ? 'animate-pulse' : ''}`}
                  >
                    {isSigningInGoogle ? 'Connecting to Google...' : 'Link Account'}
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
                    <FieldLabel icon={RefreshCw} tip="Uploads a new version to Google Drive automatically whenever you finish a chapter or start a new Tale — same 3-slot rotation as a manual Upload Now.">
                      Auto-Backup
                    </FieldLabel>
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

                  {needsReconnect && (
                    <div className="rounded-xl border border-amber-400/30 bg-amber-400/10 px-3 py-2 flex items-center gap-2">
                      <AlertTriangle size={14} className="text-amber-300 shrink-0" />
                      <p className="font-narrative text-[11px] text-amber-200 leading-snug flex-1">
                        Auto-Backup is paused — your Drive link expired on reload. Upload once below to reconnect it.
                      </p>
                    </div>
                  )}

                  <div className="rounded-xl border border-gold-accent/25 bg-gold-accent/[0.04] backdrop-blur-sm px-3 py-3 flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-display text-gold-primary flex items-center gap-1.5">
                        <History size={14} /> Cloud Versions
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

        {/* Footer — shrink-0, sticky regardless of tab scroll position. */}
        <div className="shrink-0 flex justify-end gap-2 px-5 py-4 border-t border-[#e8ca8a]/15">
          <GlassIconButton icon={X} label="Cancel" onClick={onBack} />
          <GlassIconButton icon={Check} label="Save Settings" tone="action" onClick={save} disabled={!model || !apiKey} />
        </div>
      </div>
    </div>
  )
}
