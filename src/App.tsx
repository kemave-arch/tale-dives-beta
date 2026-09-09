import { lazy, Suspense, useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import Title from './screens/Title.tsx'
import MainMenu from './screens/MainMenu.tsx'
import type { SettingsSavePayload } from './screens/Settings.tsx'
import type { CategoryId } from './screens/Codex.tsx'
import type { SeedNpcData } from './components/seedweaver/types.ts'
// Everything below Title/MainMenu is code-split — mobile's first paint only
// needs to parse those two, not the whole app (Codex, TaleDiveWeaver + its
// 4 modals, Chronicle, etc. run well past 5,000 lines combined). Each only
// loads once the player actually navigates to it; the Suspense fallback
// around `content` below covers the brief gap on that first visit.
const Settings = lazy(() => import('./screens/Settings.tsx'))
const StoryMode = lazy(() => import('./screens/StoryMode.tsx'))
const WorldSetup = lazy(() => import('./screens/WorldSetup.tsx'))
const NewGame = lazy(() => import('./screens/NewGame.tsx'))
const TaleBrief = lazy(() => import('./screens/TaleBrief.tsx'))
const DiveLoadingScreen = lazy(() => import('./screens/DiveLoadingScreen.tsx'))
const Chronicle = lazy(() => import('./screens/Chronicle.tsx'))
const Codex = lazy(() => import('./screens/Codex.tsx'))
const SlashCommandManager = lazy(() => import('./screens/SlashCommandManager.tsx'))
const TaleDiveWeaver = lazy(() => import('./screens/TaleDiveWeaver.tsx'))
const NovelWeaver = lazy(() => import('./screens/NovelWeaver.tsx'))
const WeaverCalibrator = lazy(() => import('./components/seedweaver/WeaverCalibrator.tsx'))
import { getClassById, findClassById } from './data/classes.ts'
import { FOURTH_WING_WORLD, VIOLET_SORRENGAIL } from './data/starterTemplates.ts'
import { buildContextSlice } from './lib/jitContext.ts'
import { applyTurn } from './lib/shadowReferee.ts'
import { ensureLocation } from './lib/locations.ts'
import { applyNpcUpdates } from './lib/npcs.ts'
import { applyKeywordLinks, applyEnrichUpdates } from './lib/codex.ts'
import { applyQuestUpdate } from './lib/quests.ts'
import { applyProjectUpdate } from './lib/projects.ts'
import { applyBeatUpdate } from './lib/beats.ts'
import { applySkillLearn } from './lib/skills.ts'
import { applyInventoryChanges, equipItem, unequipSlot } from './lib/inventory.ts'
import { resolveBangCommand, findEntry } from './lib/bangCommands.ts'
import { checkCodexReveals } from './lib/discovery.ts'
import { seedCampaign } from './lib/seeding.ts'
import { queueCraftingJob, resolveCraftingJobs } from './lib/crafting.ts'
import { applyMinionUpkeep, attemptSummon, type SummonCommand } from './lib/summoning.ts'
import { applyFactionRepDeltas, attitudeToRepTier } from './lib/factions.ts'
import { addCondition, removeCondition, expireConditions } from './lib/conditions.ts'
import { ensureEntry } from './lib/autoRegister.ts'
import { tierToWord, COMPETENCY_TIERS } from './lib/tiers.ts'
import { applyLevelUps, isChapterBoundary, CHAPTER_TURN_INTERVAL, turnRefFor } from './lib/leveling.ts'
import { parseKeywordLinks } from './lib/keywordLinks.ts'
import { slugify } from './lib/slug.ts'
import { getProvider } from './api/providers/index.ts'
import { sanitize } from './api/providers/gemini.ts'
import { PROSE_DEPTHS, DEFAULT_NARRATION_STYLE, MAX_OUTPUT_TOKENS_CEILING, MIN_TURN_OUTPUT_CEILING } from './api/turnContract.ts'
import { readJSONFile, saveJSON } from './lib/backup.ts'
import {
  uploadBackupToDrive,
  listDriveBackups,
  downloadDriveBackup,
  signInWithGoogle,
  completeGoogleRedirectSignIn,
  getCurrentGoogleUser,
  getGoogleAccessToken,
  type GoogleDriveFile,
} from './lib/googleDrive.ts'
import { useConfirm } from './lib/useConfirm.tsx'
import { useLongTextEditor } from './lib/useLongTextEditor.tsx'
import { useRetryEditor } from './lib/useRetryEditor.tsx'
import { useBackgroundMusic } from './lib/backgroundMusic.tsx'
import NowPlayingBanner from './components/NowPlayingBanner.tsx'
import * as store from './lib/store.ts'
import { CURRENT_SCHEMA_VERSION, EQUIPPABLE_TYPES } from './types.ts'
import type {
  BestiaryEntry, Campaign, CombatState, ConditionTag, Dict, EquipSlot, FactionEntry, GameTime, HistoryTurn, ItemEntry, KeywordLink, LocationEntry, LogEntry, LoreEntry,
  NpcEntry, Player, ProjectEntry, ProtagonistData, QuestEntry, RegionEntry, SkillEntry, SlashCommand, TaleBeat, TurnState, WorldData,
} from './types.ts'

const KEYWORD_CATEGORY_TO_CODEX: Record<KeywordLink['category'], CategoryId> = {
  npc: 'npcs',
  loc: 'locations',
  faction: 'factions',
  lore: 'lore',
  quest: 'quests',
  beast: 'bestiary',
  skill: 'skills',
  item: 'items',
}

// No 'settings' member: Settings is an overlay rendered ON TOP of whichever
// screen is current (same as SlashCommandManager), not a screen that replaces
// it — that's what lets its glass read against the live Chronicle parchment or
// the Title artwork behind it rather than a flat ground.
type Screen = 'title' | 'mainmenu' | 'storymode' | 'worldsetup' | 'newgame' | 'talebrief' | 'chronicle' | 'codex' | 'diveloading' | 'seedingreview' | 'talediveweaver' | 'novelweaver'
type CreationMode = 'tale' | 'library'

// §5.7 Player Defeat State — soft-fail recovery, client-owned.
const DEFEAT_CURRENCY_PENALTY_FRACTION = 0.15

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

// Folds the seedweaver form's own 0-100 affection/trust sliders (SeedNpcData
// — a Phase 6 UI concern, unchanged by this overhaul) onto NpcEntry's new
// 1-5 CompetencyTier scale. Default (unset) lands at the midpoint tier.
function npcSliderToTier(value: number | undefined): number {
  return Math.max(1, Math.min(5, Math.round(1 + ((value ?? 50) / 100) * 4)))
}

export default function App() {
  const [screen, setScreen] = useState<Screen>(() => {
    const saved = sessionStorage.getItem('td_active_screen') as Screen
    if (!saved) return 'title'
    
    // Safety check: if screen requires an active game but none is loaded, fallback to title.
    const id = store.loadActiveCampaignId()
    const all = store.loadCampaigns()
    const hasGame = !!(id && all[id])
    if ((saved === 'chronicle' || saved === 'codex') && !hasGame) {
      return 'title'
    }
    return saved
  })
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [slashManagerOpen, setSlashManagerOpen] = useState(false)
  const historyDepthRef = useRef(0)

  // Navigate to screen and sync with browser history so mobile hardware back-key works
  const navigateTo = (nextScreen: Screen, replace = false) => {
    if (nextScreen === screen && !replace) return

    if (replace) {
      window.history.replaceState({ screen: nextScreen, depth: historyDepthRef.current }, '')
    } else {
      const nextDepth = historyDepthRef.current + 1
      historyDepthRef.current = nextDepth
      window.history.pushState({ screen: nextScreen, depth: nextDepth }, '')
    }

    try {
      window.scrollTo(0, 0)
    } catch {
      // ignore in environments without scrollTo
    }
    setScreen(nextScreen)
  }

  // Back button helper: pops browser history if available so phone back-key & in-app back stay aligned
  const goBack = (fallbackScreen: Screen) => {
    if (historyDepthRef.current > 0) {
      window.history.back()
    } else {
      navigateTo(fallbackScreen, true)
    }
  }

  // Handle mobile hardware back button / browser popstate events
  useEffect(() => {
    if (!window.history.state || typeof window.history.state.depth !== 'number') {
      window.history.replaceState({ screen, depth: 0 }, '')
      historyDepthRef.current = 0
    } else {
      historyDepthRef.current = window.history.state.depth ?? 0
    }

    const handlePopState = (event: PopStateEvent) => {
      // If the pop event is for an in-app modal (handled by modal listener), do not change screen
      if (event.state?.modal) {
        return
      }

      // Close settings overlay if open
      if (settingsOpen) {
        setSettingsOpen(false)
        return
      }

      // Close slash command manager if open
      if (slashManagerOpen) {
        setSlashManagerOpen(false)
        return
      }

      const nextScreen = event.state?.screen as Screen | undefined
      if (nextScreen) {
        historyDepthRef.current = event.state.depth ?? 0
        setScreen(nextScreen)
      } else {
        historyDepthRef.current = 0
        setScreen((curr) => curr || 'title')
      }
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [settingsOpen, slashManagerOpen])

  const [apiSettings, setApiSettings] = useState(store.loadApiSettings)
  const [uiPrefs, setUiPrefs] = useState(store.loadUiPrefs)
  const [worlds, setWorlds] = useState<Dict<WorldData>>(store.loadWorlds)
  const [protagonists, setProtagonists] = useState<Dict<ProtagonistData>>(store.loadProtagonists)
  const [campaigns, setCampaigns] = useState<Dict<Campaign>>(store.loadCampaigns)
  const [activeCampaignId, setActiveCampaignId] = useState<string | null>(store.loadActiveCampaignId)
  const [globalSlashCommands, setGlobalSlashCommands] = useState<Dict<SlashCommand>>(store.loadGlobalSlashCommands)

  const [game, setGame] = useState<Campaign | null>(() => {
    const id = store.loadActiveCampaignId()
    const all = store.loadCampaigns()
    return id && all[id] ? all[id] : null
  })

  // §Phase A/B — held between the World Setup, Protagonist Setup, and Tale
  // Dive Brief steps.
  const [pendingWorld, setPendingWorld] = useState<WorldData | null>(null)
  const [pendingProtagonist, setPendingProtagonist] = useState<ProtagonistData | null>(null)
  const [loadingGender, setLoadingGender] = useState<string | undefined>()
  // The Prologue turn's action text, built in beginCampaign alongside World
  // Seeding but not fired until the player confirms the Seeding Review screen.
  const [pendingFirstAction, setPendingFirstAction] = useState<string | null>(null)

  useEffect(() => {
    if (screen === 'diveloading' && game && game.log.length > 0) {
      navigateTo('chronicle', true)
    }
  }, [screen, game])
  const [worldSetupMode, setWorldSetupMode] = useState<CreationMode>('tale')
  const [worldSetupInitial, setWorldSetupInitial] = useState<WorldData | null>(null)
  const [newGameMode, setNewGameMode] = useState<CreationMode>('tale')
  const [newGameInitial, setNewGameInitial] = useState<ProtagonistData | null>(null)
  const [codexTarget, setCodexTarget] = useState<{ category: CategoryId; id?: string } | null>(null)

  const [history, setHistory] = useState<HistoryTurn[]>([]) // Gemini `contents` sliding window (§3.1)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastActionText, setLastActionText] = useState<string>('')

  const handleRetry = () => {
    if (lastActionText && game) {
      sendAction(lastActionText)
    }
  }

  const handleDismissError = () => {
    setError(null)
    if (game) {
      setGame((g) => {
        if (!g) return null
        const updatedLog = [...g.log]
        if (updatedLog.length > 0) {
          const lastIndex = updatedLog.length - 1
          updatedLog[lastIndex] = {
            ...updatedLog[lastIndex],
            turnState: 'PAUSE'
          }
        }
        return {
          ...g,
          log: updatedLog,
        }
      })
    }
  }

  const getFullBackupPayload = useCallback(() => ({
    schemaVersion: CURRENT_SCHEMA_VERSION,
    worlds,
    protagonists,
    campaigns,
    globalSlashCommands,
    apiSettings: { ...apiSettings, apiKey: undefined },
    uiPrefs,
    exportedAt: new Date().toISOString(),
  }), [worlds, protagonists, campaigns, globalSlashCommands, apiSettings, uiPrefs])

  const restoreBackupPayload = useCallback((data: any) => {
    if (data.worlds || data.protagonists || data.campaigns) {
      // A backup/import can carry a stray isMaster:true on something other
      // than the canonical world/protagonist (an older build's export, or a
      // duplicate this same bug already planted before it was fixed) —
      // sanitize on the way in so a restore can never (re)plant a second
      // permanently-undeletable "master" entry.
      if (data.worlds) setWorlds((w) => ({ ...w, ...store.sanitizeWorldMasterFlag(data.worlds) }))
      if (data.protagonists) setProtagonists((p) => ({ ...p, ...store.sanitizeProtagonistMasterFlag(data.protagonists) }))
      if (data.campaigns) setCampaigns((c) => ({ ...c, ...data.campaigns }))
      if (data.globalSlashCommands) setGlobalSlashCommands((g) => ({ ...g, ...data.globalSlashCommands }))
      if (data.uiPrefs) setUiPrefs((u) => ({ ...u, ...data.uiPrefs }))
    } else if (data.player && data.log) {
      const id = data.id ?? store.newId('campaign')
      setCampaigns((c) => ({
        ...c,
        [id]: { schemaVersion: CURRENT_SCHEMA_VERSION, ...data, id, lastPlayed: Date.now() },
      }))
    }
  }, [])

  const triggerAutoCloudBackup = useCallback(async () => {
    if (!uiPrefs.autoCloudBackup) return
    const token = await getGoogleAccessToken()
    if (!token) return
    try {
      const payload = getFullBackupPayload()
      await uploadBackupToDrive(payload)
      console.log('[AutoCloudBackup] Successfully backed up to Google Drive')
    } catch (err) {
      console.warn('[AutoCloudBackup] Background auto-backup failed:', err)
    }
  }, [uiPrefs.autoCloudBackup, getFullBackupPayload])

  // Turn CRUD (Edit/Retry/Delete on the last turn only, Chronicle.tsx) —
  // patches just the narrative content inside an already-stored raw payload,
  // leaving every other field (turn_state, deltas, loc_id, etc.) untouched,
  // so an edited turn's context for future API calls stays byte-consistent
  // with what's actually displayed. Tries the current XML format first
  // (<nar>...</nar>, migrated 2026-09-05), then falls back to the pre-
  // migration JSON shape so a save with turns from before that date can
  // still be edited — falls back to the raw text unchanged if neither
  // pattern matches (a fallback-reader turn); the caller still applies the
  // display-only nar edit regardless.
  function patchNarInRawPayload(raw: string, newNar: string): string {
    const xmlMatch = raw.match(/<nar>[\s\S]*?<\/nar>/)
    if (xmlMatch) {
      const escaped = newNar.replace(/&/g, '&amp;').replace(/</g, '&lt;')
      return raw.replace(xmlMatch[0], `<nar>\n${escaped}\n</nar>`)
    }
    try {
      const parsed = JSON.parse(sanitize(raw))
      return JSON.stringify({ ...parsed, nar: newNar })
    } catch {
      return raw
    }
  }

  // A bang command (!inventory, !arise, ...) is its own log entry with no
  // `nar`/`rawPayload` — matches Chronicle.tsx's own eligibility check for
  // Edit/Retry/Delete, so "the last turn" means the last *narrated* one,
  // even if read-only (or state-mutating) bang commands follow it in the log.
  function findLastNarratedIndex(log: LogEntry[]): number {
    for (let i = log.length - 1; i >= 0; i--) {
      if (log[i].nar && log[i].rawPayload) return i
    }
    return -1
  }

  function handleEditLastTurn(newNar: string) {
    setGame((g) => {
      if (!g) return g
      const index = findLastNarratedIndex(g.log)
      if (index === -1) return g
      const log = [...g.log]
      const entry = log[index]
      log[index] = { ...entry, nar: newNar, rawPayload: patchNarInRawPayload(entry.rawPayload!, newNar) }
      return { ...g, log }
    })
    setHistory((h) => {
      if (h.length === 0) return h
      const lastTurn = h[h.length - 1]
      if (lastTurn.role !== 'model') return h
      const newText = patchNarInRawPayload(lastTurn.parts[0].text ?? '', newNar)
      return [...h.slice(0, -1), { role: 'model', parts: [{ text: newText }] }]
    })
  }

  // Retry and Delete both boil down to this: drop the last *narrated* turn,
  // and everything after it (bang commands included — anything since was
  // looked up or acted on against state that's about to change), from both
  // the displayed record (log) and the conversational context the API sees
  // next turn (history — bang commands never touch history at all, so
  // exactly one narrated turn's own user+model pair, the last 2 entries,
  // is ever removed regardless of how many trailing bang entries get cut
  // from log). This corrects the *context*, not game mechanics — HP/
  // inventory/quest deltas (including ones a trailing bang command like
  // !arise already applied) are NOT rolled back, same as this app has never
  // had a general undo system. Retry additionally re-seeds the input box
  // with the original action text (Chronicle.tsx) for the player to revise
  // and resend.
  function handleRemoveLastTurn() {
    setGame((g) => {
      if (!g) return g
      const index = findLastNarratedIndex(g.log)
      if (index === -1) return g
      return { ...g, log: g.log.slice(0, index), turnCount: Math.max(0, (g.turnCount ?? 0) - 1) }
    })
    setHistory((h) => h.slice(0, Math.max(0, h.length - 2)))
  }

  const [pendingRecall, setPendingRecall] = useState<string | null>(null) // §6.6 — a targeted/full !recall snapshot waiting to ride along on the next real turn
  const { confirm, dialog: confirmDialog } = useConfirm()
  const { edit: editLongText, dialog: longTextDialog } = useLongTextEditor()
  const { openRetry, dialog: retryDialog } = useRetryEditor()
  // Mounted here rather than in a screen so the soundtrack keeps playing
  // across navigation instead of restarting whenever a screen unmounts.
  const {
    muted: musicMuted,
    toggleMute: toggleMusicMute,
    isPlaying: musicPlaying,
    currentTime: musicCurrentTime,
    duration: musicDuration,
    currentTrack,
    bannerVisible,
    dismissBanner,
    playTrack: onPlayTrack,
    togglePlayPause: onTogglePlayPause,
    nextTrack: onNextTrack,
    prevTrack: onPrevTrack,
    resumeSoundtrack: onResumeSoundtrack,
    setTurnState: setMusicTurnState,
  } = useBackgroundMusic()

  // Drives combat (etc.) music: whenever the last *narrated* turn's state
  // changes, crossfade into that Turn State's track pool (backgroundMusic.tsx)
  // — or back to ambient rotation once none applies. Keyed off game.log so a
  // fresh turn, a !recall-driven rewrite, or switching to a different
  // campaign entirely (game.log itself points at a different array) all
  // re-evaluate; a bang command with no turnState of its own just re-confirms
  // whatever the last real narration left active.
  useEffect(() => {
    if (!game) {
      setMusicTurnState(null)
      return
    }
    const idx = findLastNarratedIndex(game.log)
    setMusicTurnState(idx >= 0 ? game.log[idx].turnState ?? null : null)
  }, [game?.log])

  // Completes a signInWithGoogle() that had to fall back to signInWithRedirect
  // (real mobile browsers routinely block/silently drop signInWithPopup —
  // see googleDrive.ts) — the token only becomes available once the app
  // reloads after the redirect back from Google, which is exactly now, on
  // this fresh mount. Runs unconditionally at boot, before any screen asks
  // for Google auth state, so it's already cached by the time one does.
  useEffect(() => {
    completeGoogleRedirectSignIn()
  }, [])

  useEffect(() => { store.saveApiSettings(apiSettings) }, [apiSettings])
  useEffect(() => { store.saveUiPrefs(uiPrefs) }, [uiPrefs])
  // Graphics > Performance (Settings) — strips backdrop-filter blur app-wide
  // via a CSS override keyed on this class (index.css), rather than a
  // per-component prop thread — every glass surface in the app picks it up
  // for free since they're all the same Tailwind backdrop-blur-* utilities.
  useEffect(() => {
    document.documentElement.classList.toggle('gfx-performance', uiPrefs.graphicsMode === 'performance')
  }, [uiPrefs.graphicsMode])
  useEffect(() => { store.saveWorlds(worlds) }, [worlds])
  useEffect(() => { store.saveProtagonists(protagonists) }, [protagonists])
  useEffect(() => { store.saveCampaigns(campaigns) }, [campaigns])
  useEffect(() => { if (activeCampaignId) store.saveActiveCampaignId(activeCampaignId) }, [activeCampaignId])
  useEffect(() => { store.saveGlobalSlashCommands(globalSlashCommands) }, [globalSlashCommands])
  useEffect(() => {
    sessionStorage.setItem('td_active_screen', screen)
  }, [screen])

  // The actively-played campaign is kept in `game` for the turn loop, and
  // mirrored into the `campaigns` library on every change.
  useEffect(() => {
    if (!game) return
    setCampaigns((c) => ({ ...c, [game.id]: game }))
  }, [game])

  
  function deleteWorld(id: string) {
    setWorlds((w) => {
      const copy = { ...w }
      delete copy[id]
      return copy
    })
  }

  function deleteProtagonist(id: string) {
    setProtagonists((p) => {
      const copy = { ...p }
      delete copy[id]
      return copy
    })
  }

  function upsertWorld(worldData: WorldData, existingId?: string | null): WorldData {
    const id = existingId ?? store.newId('world')
    const entry: WorldData = {
      ...worldData,
      id,
      savedAt: worldData.savedAt ?? Date.now(),
      isDefault: worlds[id]?.isDefault ?? false,
      // Only the one true canonical master world is ever allowed to carry
      // this flag — closes off the bug where a screen spreading
      // ...FOURTH_WING_WORLD onto a fresh draft id (it carries isMaster:
      // true itself) plants a second, permanently undeletable "master".
      isMaster: id === FOURTH_WING_WORLD.id,
    }
    setWorlds((w) => ({ ...w, [id]: entry }))
    return entry
  }

  function upsertProtagonist(pData: ProtagonistData, existingId: string | null | undefined, className: string): ProtagonistData {
    const id = existingId ?? store.newId('protagonist')
    const entry: ProtagonistData = {
      ...pData,
      id,
      className,
      savedAt: pData.savedAt ?? Date.now(),
      isDefault: protagonists[id]?.isDefault ?? false,
      isMaster: id === VIOLET_SORRENGAIL.id, // same reasoning as upsertWorld above
    }
    setProtagonists((p) => ({ ...p, [id]: entry }))
    return entry
  }

  function resumeCampaign(id: string) {
    setGame(campaigns[id])
    setActiveCampaignId(id)
    setHistory([])
    setLoadingGender(campaigns[id]?.player?.gender)
    navigateTo('diveloading')
    onPlayTrack('TempestDive_ost03.opus')
  }

  // Title's "Continue" shortcut and Main Menu's Tales tab both want the same
  // Tale — whichever was last actually played.
  function mostRecentCampaignId(): string | undefined {
    return Object.values(campaigns).sort((a, b) => (b.lastPlayed ?? 0) - (a.lastPlayed ?? 0))[0]?.id
  }

  async function beginCampaign(
    protagonistData: ProtagonistData,
    worldOverride?: Partial<WorldData>,
    customTitle?: string,
    customNpcs?: SeedNpcData[]
  ) {
    setLoadingGender(protagonistData.gender)
    setPendingProtagonist(protagonistData)
    const cls = getClassById(protagonistData.classId)
    // Narrative-First Overhaul — no more derived HP/MP/ST pools computed from
    // a class weight vector; attrs are CompetencyTiers now, and a protagonist
    // with no custom point-buy just starts at a flat, unweighted middle rank
    // on every attribute (class flavor is expressed narratively, not via a
    // starting-stat skew anymore).
    const attrs = protagonistData.customAttributes ?? { STR: 3, INT: 3, AGI: 3 }

    const player: Player = {
      name: protagonistData.name,
      gender: protagonistData.gender,
      age: protagonistData.age,
      background: protagonistData.background,
      personality: protagonistData.personality,
      motivation: protagonistData.motivation,
      physicalTrait: protagonistData.physicalTrait,
      secret: protagonistData.secret,
      classId: cls.id,
      className: cls.name,
      level: 1,
      attrs,
      conditions: [],
      copper: 10_000, // flat 1 Gold starting wealth (§5.2 Four-Tier Currency Engine, 1G = 10,000 base copper)
      locId: 'loc_start',
      locDisp: 'An Unwritten Place',
      time: { d: 1, h: '08:00 AM' },
    }

    const world: WorldData = {
      ...(pendingWorld ?? {
        name: 'Untitled World',
        mode: 'original',
        background: '',
        genreTone: '',
        conflict: '',
        narrationStyle: DEFAULT_NARRATION_STYLE,
      }),
      ...worldOverride,
    }

    // Seed initial factions from world into Codex
    const initialFactions: Dict<FactionEntry> = {}
    if (world.factionsList && Array.isArray(world.factionsList)) {
      world.factionsList.forEach((f) => {
        if (!f.name?.trim()) return
        const id = 'fac_' + slugify(f.name)
        const repTier = attitudeToRepTier(f.attitude)
        initialFactions[id] = {
          name: f.name.trim(),
          repTier,
          description: f.description?.trim() || undefined,
          territory: f.territory?.trim() || undefined,
          tags: [f.attitude || 'neutral'],
          discovery: { state: 'known' },
        }
      })
    }

    // Seed initial locations from world into Codex
    const initialLocations: Dict<LocationEntry> = {}
    if (world.locationsList && Array.isArray(world.locationsList)) {
      world.locationsList.forEach((loc) => {
        if (!loc.name?.trim()) return
        const id = 'loc_' + slugify(loc.name)
        initialLocations[id] = {
          name: loc.name.trim(),
          region: loc.region?.trim() || 'Known World',
          description: loc.description?.trim() || '',
          dangerLevel: loc.dangerLevel || 'Safe',
          factionOwner: loc.factionOwner?.trim() || null,
          standing: 'neutral',
          locationType: loc.locationType || 'Landmark',
          discovery: { state: 'known' },
        }
      })
    }

    // Seed initial skills from protagonist into Codex
    const initialSkills: Dict<SkillEntry> = {}
    if (protagonistData.startingSkills && Array.isArray(protagonistData.startingSkills)) {
      protagonistData.startingSkills.forEach((s) => {
        if (!s.name?.trim()) return
        const id = 'skill_' + slugify(s.name)
        initialSkills[id] = {
          name: s.name.trim(),
          skillType: s.skillType || 'Active',
          tier: s.tier ?? 2, // Novice
          effort: s.effort,
          description: s.description?.trim() || undefined,
          classId: cls.id,
          discovery: { state: 'known' },
        }
      })
    }

    // Seed initial NPCs if passed from World Seed
    const initialNpcs: Dict<NpcEntry> = {}
    if (customNpcs && Array.isArray(customNpcs)) {
      customNpcs.forEach((npc) => {
        if (!npc.name?.trim()) return
        const id = 'npc_' + slugify(npc.name)
        initialNpcs[id] = {
          name: npc.name.trim(),
          gender: npc.gender || undefined,
          role: npc.role || undefined,
          // SeedNpcData.affection/trust are still the seedweaver form's own
          // 0-100 slider values (a Phase 6 UI concern, unchanged here) —
          // folded onto the new 1-5 CompetencyTier scale rather than passed
          // through raw.
          affection: npcSliderToTier(npc.affection),
          trust: npcSliderToTier(npc.trust),
          heldWeapon: npc.heldWeapon || undefined,
          wornArmor: npc.wornArmor || undefined,
          personality: npc.personality || undefined,
          voiceNotes: npc.secret ? `Secret: ${npc.secret}` : undefined,
          factionId: npc.factionId ? 'fac_' + slugify(npc.factionId) : null,
          stage: 'Acquaintance',
          deeds: [],
          memSummary: npc.description || `${npc.role || 'Key character'} in ${world.name}.`,
          lastSeenLocId: 'loc_start',
          discovery: { state: 'known' },
        }
      })
    }

    // §Phase B.4 — the Prologue turn folds in the World Background/Genre/
    // Conflict/Power System/Era/Key Factions from Phase A so the opening is
    // actually grounded in what was set up rather than fabricated from
    // nothing. Built here, before World Seeding fires below, since the same
    // lines double as the seeding call's own prompt context.
    const worldLines = [
      world.background?.trim() && `World Background: ${world.background.trim()}`,
      world.genreTone?.trim() && `Genre & Tone: ${world.genreTone.trim()}`,
      world.conflict?.trim() && `Core Regional Conflict: ${world.conflict.trim()}`,
      world.powerSystem?.trim() && `Power System: ${world.powerSystem.trim()}`,
      world.eraTechLevel?.trim() && `Era / Tech Level: ${world.eraTechLevel.trim()}`,
      world.keyFactions?.trim() && `Key Factions: ${world.keyFactions.trim()}`,
    ].filter(Boolean) as string[]

    const backgroundLine = protagonistData.background?.trim() && `Protagonist Background: ${protagonistData.background.trim()}`

    const identityLines = [
      protagonistData.personality?.trim() && `Personality: ${protagonistData.personality.trim()}`,
      protagonistData.motivation?.trim() && `Motivation: ${protagonistData.motivation.trim()}`,
      protagonistData.physicalTrait?.trim() && `Physical Trait: ${protagonistData.physicalTrait.trim()}`,
      protagonistData.secret?.trim() && `Secret: ${protagonistData.secret.trim()}`,
    ].filter(Boolean) as string[]

    const briefLine = protagonistData.opening?.trim()
      ? `Tale Dive Brief — open Turn 1 here: ${protagonistData.opening.trim()}`
      : 'No Tale Dive Brief given — invent a fitting, evocative opening scene consistent with the world above.'

    // World Seeding — a one-time call, before Turn 1, covering what the
    // player-authored CRUD above (Key Factions/Locations/Starting Abilities)
    // leaves optional and empty by default: Lore, starting NPC relations, an
    // optional personal Ambition quest, and (only when the lists above came
    // back empty) a small Location/Faction fallback plus a named key item's
    // full content. Never blocks campaign creation — a failed/malformed call
    // just means no enrichment this campaign (lib/seeding.ts never throws).
    navigateTo('diveloading')
    const seeded = await seedCampaign({
      apiSettings,
      worldLines,
      protagonistLines: [backgroundLine, ...identityLines].filter(Boolean) as string[],
      briefLine,
      existingFactions: world.factionsList ?? [],
      existingLocations: world.locationsList ?? [],
      startingSkillNames: Object.values(initialSkills).map((s) => s.name),
      keyItemName: protagonistData.keyItem,
    })

    // Both land in their libraries the moment a Tale begins (§6.4B) —
    // creation IS how the World/Protagonist Library gets populated.
    const worldEntry = upsertWorld(world, world.id)
    const protagonistEntry = upsertProtagonist(protagonistData, protagonistData.id, cls.name)

    const campaignId = store.newId('campaign')
    const campaign: Campaign = {
      id: campaignId,
      schemaVersion: CURRENT_SCHEMA_VERSION,
      title: customTitle?.trim() || `${player.name}'s Tale`, // Tale Dive Brief's title field, guarded there against colliding with an existing Tale's name
      synopsis: (protagonistData.opening || world.background || '').slice(0, 140),
      worldId: worldEntry.id!,
      protagonistId: protagonistEntry.id!,
      world, // §Phase A — kept for reference until the Codex Realm Overview exists
      player,
      proseDepth: PROSE_DEPTHS.IMMERSIVE, // default changed 2026-09-04 per explicit request for the most immersive prose by default; still overridable per-campaign in Settings
      narrationStyle: world.narrationStyle || DEFAULT_NARRATION_STYLE,
      locations: { ...initialLocations, ...seeded.locations }, // §5.10 — player-authored + World Seeding fallback + later auto-registration
      regions: seeded.regions, // §7 Region Map Pins — World Seeding's regions, if any; write-once, no later auto-registration path
      npcs: { ...initialNpcs, ...seeded.npcs }, // §5.5/§5.14 — World Seeding's starting relations, then auto-registration
      factions: { ...initialFactions, ...seeded.factions }, // §5.14 — player-authored + World Seeding fallback + later keyword links
      lore: seeded.lore, // §5.14 — World Seeding, then {{Term|lore}} keyword links
      quests: seeded.quests, // §5.14 — World Seeding's optional Ambition quest, then quest_update/keyword links
      bestiary: {}, // §5.13/§5.14 — populated by {{Term|beast}} keyword links, full stat blocks once combat begins
      skills: initialSkills, // §6.4D — populated by seeded skills and {{Term|skill}} keyword links
      items: Object.keys(seeded.items).length > 0 ? seeded.items : undefined, // §5.9 — World Seeding's key item, if any
      combat: { active: false }, // §2 Phase D.2/§5.13 — ephemeral, reset each encounter
      flags: [], // §5.6 World Impact Ledger
      inventory: seeded.inventory, // §5.9
      log: [],
      createdAt: Date.now(),
      lastPlayed: Date.now(),
      turnCount: 0,
      seedDebug: seeded.debug,
    }

    // The Prologue's own framing — Turn 1 is explicitly the opening chapter,
    // instructed to draw on whatever World Seeding and the player's own setup
    // just populated the Codex with (already sitting in campaign.locations/
    // npcs/factions/lore/quests/skills by the time this fires, so it flows
    // straight into jitContext.ts's existing hooks with no changes there).
    const prologueLine =
      "This is the Prologue — the opening chapter. Alongside narrating the opening scene, establish the protagonist's starting NPC/faction relations (npc_mem_up/fac_rep) for anyone from the Codex context below who is actually present or relevant, and make the protagonist's starting goal or challenge clear. Draw on the Codex context below rather than contradicting it."

    const firstAction = [prologueLine, ...worldLines, backgroundLine, ...identityLines, briefLine].filter(Boolean).join('\n')

    setGame(campaign)
    setActiveCampaignId(campaignId)
    setHistory([])
    setError(null)
    setPendingWorld(null)
    setPendingFirstAction(firstAction)
    if (uiPrefs.autoCloudBackup) {
      triggerAutoCloudBackup()
    }
    navigateTo('seedingreview')
  }

  async function sendAction(actionText: string, forcePauseState?: boolean, overrideGame?: Campaign, overrideHistory?: HistoryTurn[]) {
    setLastActionText(actionText)
    const current = overrideGame ?? game
    if (!current) return
    if (!apiSettings.apiKey) {
      setError('No API key set — open Settings and paste your Gemini API key first.')
      return
    }

    setBusy(true)
    setError(null)

    // §5.8 — a read-only peek at whether any crafting job would resolve at
    // the player's *current* location, purely to decide whether this turn's
    // prompt gets the narration hook. This doesn't mutate anything; the
    // authoritative resolution (which actually updates the queue/inventory)
    // runs after the turn's real resulting time is known, further below.
    const craftPeek = resolveCraftingJobs(current.crafting ?? [], current.inventory, current.player.time)
    const craftReadyHere = craftPeek.completed.filter((c) => c.job.stationLocId === current.player.locId)
    const craftReadyLine = craftReadyHere.length
      ? `Craft Ready: ${craftReadyHere.map((c) => `>${c.recipe.output.id.replace(/_/g, ' ')}<`).join(', ')} awaits collection here.`
      : null

    const baseHistory = overrideHistory ?? history
    const contextSlice = buildContextSlice(current, craftReadyLine)
    // §6.6 — a !recall or targeted bang dossier queued since the last turn
    // rides along here once, then clears; this is the "make the LLM
    // remember" mechanism, distinct from the always-on capped Known
    // Entities line the context slice already carries.
    const recallBlock = pendingRecall ? `\n\n${pendingRecall}` : ''
    const userTurnText = `${contextSlice}${recallBlock}\n\nPlayer Action: ${actionText}`
    if (pendingRecall) setPendingRecall(null)
    const newHistory: HistoryTurn[] = [...baseHistory, { role: 'user', parts: [{ text: userTurnText }] }]

    // World seeding — the campaign's very first turn, establishing the
    // opening scene — always gets the API's own output ceiling rather than
    // the campaign's chosen Prose Depth: beginCampaign's firstAction call is
    // the only sendAction call site that passes an empty overrideHistory, so
    // that's a reliable signal it's this call rather than an ordinary turn.
    const isWorldSeedingTurn = overrideHistory !== undefined && overrideHistory.length === 0
    // §6.6 !conclude — the Tale's own final scene deserves the same
    // unconstrained room as world seeding/chapter recaps get, not whatever
    // ceiling the player's chosen Prose Depth happens to carry.
    const isConcludeTurn = actionText.trim() === '!conclude'
    try {
      const result = await getProvider(apiSettings.provider).runTurn({
        apiKey: apiSettings.apiKey,
        model: apiSettings.model,
        temperature: apiSettings.temperature,
        maxOutputTokens: isWorldSeedingTurn || isConcludeTurn ? MAX_OUTPUT_TOKENS_CEILING : Math.max(current.proseDepth.maxOutputTokens, MIN_TURN_OUTPUT_CEILING),
        history: newHistory,
      })

      if (!result.ok) {
        setGame((g) =>
          g && {
            ...g,
            lastPlayed: Date.now(),
            log: [
              ...g.log,
              {
                action: actionText,
                nar: `[Repairing State] ${result.fallbackText}`,
                time: g.player.time,
                locDisp: g.player.locDisp,
                requestPayload: userTurnText,
                rawPayload: result.raw,
                finishReason: result.finishReason,
              },
            ],
          },
        )
        setHistory([...newHistory, { role: 'model', parts: [{ text: result.historyText }] }])
        return
      }

      const turn = result.turn!
      let nextPlayer: Player = applyTurn(current.player, turn)
      nextPlayer.time = turn.time ?? current.player.time // Shadow Referee doesn't own time

      // Computed early (needs only current.turnCount) so every Codex entry
      // this turn creates can stamp the same trace id it ends up logged
      // under — see LogEntry.turnRef's comment for the full rationale.
      const turnNumber = (current.turnCount ?? 0) + 1 // ?? tolerates saves from before turnCount existed
      const turnRef = turnRefFor(turnNumber)

      // loc_disp is optional now (like loc_desc already was) — omitted on an
      // ordinary same-location turn. Falls back to the Locations registry's
      // own stored name for this loc_id, or the player's current display
      // name as a last resort, rather than requiring the model restate it
      // every turn.
      const locDisp = turn.loc_disp ?? current.locations[turn.loc_id]?.name ?? current.player.locDisp
      nextPlayer = { ...nextPlayer, locId: turn.loc_id, locDisp }

      // The current turn's own loc_id/loc_disp registers FIRST, unlike every
      // other category — its name always comes straight from the model's
      // real loc_disp text (never a derived-id fallback the way npc_mem_up's
      // titleCaseId(npc_id) is), so nothing is lost by it existing before the
      // keyword pass runs. What IS gained: a same-turn {{Term|loc}} mention of
      // this same place (e.g. the region name "Ironheart" alongside a loc_id
      // for "Ironheart - Outer Gates") has something to fuzzy-match against
      // (lib/codex.ts's isKnownByName) instead of forking a duplicate stub
      // before the "real" entry even exists yet.
      const { dict: locationsWithCurrent } = ensureLocation(current.locations, turn.loc_id, locDisp, turn.loc_desc, nextPlayer.time, turnRef)

      // Keyword links run first for every other category so a {{Term|npc}}
      // tag's real name wins over the plainer fallback npc_id-derived stub name.
      const linked = applyKeywordLinks(
        {
          locations: locationsWithCurrent,
          npcs: current.npcs,
          factions: current.factions,
          lore: current.lore,
          quests: current.quests,
          bestiary: current.bestiary,
          skills: current.skills ?? {},
        },
        turn.nar,
        turnRef,
        current.player.name,
      )
      const nextLocations = linked.locations
      const nextNpcs = applyNpcUpdates(linked.npcs, turn.npc_mem_up, turn.loc_id, nextPlayer.time, turnRef)
      const nextQuests = applyQuestUpdate(linked.quests, turn.quest_update, turnRef)
      const nextProjects = applyProjectUpdate(current.projects, turn.project_update, turnRef)
      const nextBeats = applyBeatUpdate(current.beats, turn.beat_update)
      // §6.4D — a skill_learn record fills in (or upgrades) whatever the
      // {{Term|skill}} keyword pass already stubbed out.
      const nextSkills = applySkillLearn(linked.skills, turn.skill_learn, turnRef)
      const nextFlags = turn.flag_add?.length ? Array.from(new Set([...current.flags, ...turn.flag_add])) : current.flags

      // §5.4 App-Side Rivalry — a rep change to one faction mirrors an
      // inverse change onto its `rivalId` counterpart, entirely client-side.
      const nextFactions = applyFactionRepDeltas(linked.factions, turn.fac_rep ?? [])

      // §5.8 — the authoritative crafting resolution, against this turn's
      // actual resulting time/location (nextPlayer.time/.locId, already set
      // above) rather than the pre-call peek's start-of-turn snapshot. Its
      // output lands in inventory as the base applyInventoryChanges below
      // layers this turn's own inv_add/inv_rem on top of.
      const craftResolution = resolveCraftingJobs(current.crafting ?? [], current.inventory, nextPlayer.time)
      const invResult = applyInventoryChanges(craftResolution.inventory, current.items, turn.inv_add, turn.inv_rem, turnRef)

      // Narrative-First Overhaul — combat is fully narrative-adjudicated now
      // (TACTICAL mode is gone); the only client-owned combat bookkeeping
      // left is standing up/tearing down CombatState and applying this
      // turn's own Condition Tag updates (below) to whichever side they
      // target.
      let turnState: TurnState = turn.turn_state
      let nextCombat: CombatState = current.combat ?? { active: false }
      let nextBestiary = linked.bestiary

      if (turnState === 'COMBAT' && !current.combat?.active) {
        // Combat is starting narratively this turn — register a Bestiary
        // stub (§5.13) for whichever adversary got tagged, if any, unless
        // {{Term|beast}}'s own keyword-link pass above already made one.
        const beastLink = parseKeywordLinks(turn.nar).find((l) => l.category === 'beast')
        if (beastLink) {
          const enemyId = slugify(beastLink.term)
          const { dict: withAdversary } = ensureEntry(nextBestiary, enemyId, () => ({ name: beastLink.term, threatTier: 'notable' as const }), turnRef)
          nextBestiary = withAdversary
          nextCombat = { active: true, enemyId, enemyName: beastLink.term, enemyConditions: [] }
        }
      } else if (turnState !== 'COMBAT' && current.combat?.active) {
        // Gemini narratively ended the fight (fled, negotiated, etc.).
        nextCombat = { active: false }
      }

      // §5.3/§7 — every corpse this turn's combat produced becomes
      // harvestable for a future `!arise`, folded directly onto the slain
      // species' own Bestiary entry (corpseCount/lastSlainTime) rather than
      // a separate flat Campaign.corpses tag stack — stubs a Bestiary entry
      // via ensureEntry (same pattern as the COMBAT-start adversary stub
      // just above) for a corpse tag that isn't already a known adversary.
      for (const id of turn.corpse_add ?? []) {
        const { dict: withStub } = ensureEntry(nextBestiary, id, () => ({ name: id, threatTier: 'unknown' as const }), turnRef)
        nextBestiary = withStub
        const existing = nextBestiary[id]
        nextBestiary = { ...nextBestiary, [id]: { ...existing, corpseCount: (existing.corpseCount ?? 0) + 1, lastSlainTime: nextPlayer.time } }
      }

      // §6.6 Slash Command pause override — an explicit player-invoked OOC
      // beat, so it wins over whatever turn state got computed above.
      if (forcePauseState) turnState = 'PAUSE'

      // Condition Tags — replaces the old numeric hp/mp/st deltas entirely.
      // Player-targeted updates land on nextPlayer.conditions; enemy-
      // targeted ones (id="enemy" in the XML) land on the active combat
      // opponent's own conditions instead.
      let playerConditions: ConditionTag[] = nextPlayer.conditions
      let enemyConditions: ConditionTag[] = nextCombat.enemyConditions ?? []
      for (const upd of turn.cond_updates ?? []) {
        const bucket = upd.target === 'enemy' ? 'enemy' : 'player'
        if (upd.action === 'add') {
          const next = addCondition(bucket === 'enemy' ? enemyConditions : playerConditions, upd.label, nextPlayer.time, {
            kind: upd.kind,
            durationHours: upd.durationHours,
          })
          if (bucket === 'enemy') enemyConditions = next
          else playerConditions = next
        } else {
          const next = removeCondition(bucket === 'enemy' ? enemyConditions : playerConditions, upd.label)
          if (bucket === 'enemy') enemyConditions = next
          else playerConditions = next
        }
      }
      // Expire time-based conditions once per turn, same place resolveCraftingJobs already runs.
      playerConditions = expireConditions(playerConditions, nextPlayer.time)
      enemyConditions = expireConditions(enemyConditions, nextPlayer.time)
      if (nextCombat.active) nextCombat = { ...nextCombat, enemyConditions }

      // §5.7 Player Defeat State — signaled by a sentinel "Defeated"
      // Condition Tag (see turnContract.ts's COMBAT rule) rather than a
      // numeric hp<=0 check, since there's no hp pool anymore. Consumed the
      // instant it's read so it never lingers as a literal persistent tag
      // once the recovery beat fires.
      const playerDefeated = playerConditions.some((c) => c.id === 'defeated')
      if (playerDefeated) {
        playerConditions = playerConditions.filter((c) => c.id !== 'defeated')
        nextCombat = { active: false }
      }
      nextPlayer = { ...nextPlayer, conditions: playerConditions }

      // §5.1a Milestone Leveling — +1 per completed quest this turn, +1 at
      // every Chapter Milestone boundary (§8 item 5's Secret-quest question
      // is moot for now since quest_update doesn't track a tier at all yet).
      // turnNumber itself was already computed above (turnRef needs it too).
      const questLevels = turn.quest_update?.status === 'completed' ? 1 : 0
      const chapterLevels = isChapterBoundary(turnNumber) ? 1 : 0
      const { player: leveledPlayer, leveled, breakthrough: milestoneBreakthrough } = applyLevelUps(
        nextPlayer,
        getClassById(current.player.classId).weights,
        questLevels + chapterLevels,
      )

      // §5.1b Class Evolution — the single class slot is replaced outright,
      // never retroactively: this turn's own level-up (if any) above still
      // used the *old* weight vector, and only points earned from the next
      // level-up forward follow the new one. class_id is schema-constrained
      // to a real Preset Class Dictionary entry, but findClassById is still
      // checked directly rather than trusted, and a same-class "evolution"
      // (already this class) is a no-op rather than a banner.
      let evolvedPlayer = leveledPlayer
      let classEvolution: { className: string; reason?: string } | undefined
      if (turn.class_evolution) {
        const newClass = findClassById(turn.class_evolution.class_id)
        if (newClass && newClass.id !== current.player.classId) {
          evolvedPlayer = { ...leveledPlayer, classId: newClass.id, className: newClass.name }
          classEvolution = { className: newClass.name, reason: turn.class_evolution.reason }
        }
      }

      // §Narrative-First Overhaul — <enrich lore/beast> fills in or expands
      // Codex content for an entity type that otherwise has no per-turn
      // update path (Lore) or whose stub the {{Term|beast}} keyword pass
      // alone never grows past a bare name/threatTier (Bestiary).
      const enriched = applyEnrichUpdates(linked.lore, nextBestiary, turn.enrich, turnRef)

      // §5.12 Codex Discovery — zero-token reveal check against this turn's
      // own deltas (flag_add/loc_id/npc_mem_up/quest_update), run last so it
      // sees the final merged flag list from above.
      const reveals = checkCodexReveals(
        { npcs: nextNpcs, locations: nextLocations, factions: nextFactions, lore: enriched.lore, quests: nextQuests, bestiary: enriched.bestiary },
        turn,
        nextFlags,
      )

      // §5.3 — a `familiar`-branch minion's upkeep is a stable no-op now
      // (see lib/summoning.ts's own comment — Player no longer has a
      // numeric MP pool for it to drain).
      const upkeep = applyMinionUpkeep(current.minions ?? {})

      // §5.1c Direct Stat Modification (Event/narrative source) — a genuine
      // permanent attribute breakthrough, never ordinary damage/healing
      // (that's a Condition Tag now). The model already names the resulting
      // canonical tier word; the client just resolves it to its internal
      // rank, no arithmetic of its own.
      let grantedPlayer = evolvedPlayer
      let breakthroughLog: { attr: 'STR' | 'INT' | 'AGI'; tier: string } | undefined
      if (turn.breakthrough) {
        const { attr, tier } = turn.breakthrough
        grantedPlayer = { ...grantedPlayer, attrs: { ...grantedPlayer.attrs, [attr]: tier } }
        breakthroughLog = { attr, tier: tierToWord(tier, COMPETENCY_TIERS) }
      } else if (leveled && milestoneBreakthrough) {
        breakthroughLog = { attr: milestoneBreakthrough.attr, tier: tierToWord(milestoneBreakthrough.tier, COMPETENCY_TIERS) }
      }

      const finalPlayer: Player = grantedPlayer

      const nextCampaign: Campaign = {
        ...current,
        player: finalPlayer,
        minions: upkeep.minions,
        projects: nextProjects,
        beats: nextBeats,
        locations: reveals.locations,
        npcs: reveals.npcs,
        factions: reveals.factions,
        lore: reveals.lore,
        quests: reveals.quests,
        bestiary: reveals.bestiary,
        skills: nextSkills,
        combat: nextCombat,
        flags: nextFlags,
        inventory: invResult.inventory,
        items: invResult.items,
        crafting: craftResolution.jobs,
        lastPlayed: Date.now(),
        turnCount: turnNumber,
        // §6.6 !conclude — once set, stays set: an ending is never
        // overwritten by a later turn (the player may keep exploring an
        // epilogue, but the Tale's own concluded banner persists).
        ...(turn.end ? { concluded: current.concluded ?? { outcome: turn.end.outcome, turnRef } } : {}),
        log: [
          ...current.log,
          {
            action: actionText,
            nar: turn.nar,
            turnRef,
            turnState,
            mood: turn.mood,
            defeated: playerDefeated,
            act: turn.act,
            time: finalPlayer.time,
            locDisp: finalPlayer.locDisp,
            requestPayload: userTurnText,
            rawPayload: result.raw,
            finishReason: result.finishReason,
            ...(leveled ? { levelUp: leveledPlayer.level } : {}),
            ...(breakthroughLog ? { breakthrough: breakthroughLog } : {}),
            ...(reveals.revealed.length ? { discoveries: reveals.revealed } : {}),
            ...(classEvolution ? { classEvolution } : {}),
            ...(craftResolution.completed.length
              ? { craftReady: craftResolution.completed.map((c) => ({ recipeName: c.recipe.name, outputId: c.recipe.output.id, outputQty: c.recipe.output.qty })) }
              : {}),
            ...(upkeep.dissipated.length ? { minionsDissipated: upkeep.dissipated } : {}),
            ...(turn.end ? { ending: turn.end.outcome } : {}),
          },
        ],
      }

      setGame(nextCampaign)
      const historyWithResponse: HistoryTurn[] = [...newHistory, { role: 'model', parts: [{ text: result.historyText }] }]
      setHistory(historyWithResponse)

      // §5.7 Player Defeat State — chains into its own resolution turn once
      // the fatal blow itself is committed, rather than leaving the player
      // stuck mid-fall with nothing to do.
      if (playerDefeated) resolveDefeat(nextCampaign, historyWithResponse)

      // §2 Phase E Chapter Milestone — same boundary trigger as the
      // chapter-level-up above; the recap call reads historyWithResponse
      // (this turn included) before the sliding window gets flushed.
      if (chapterLevels > 0) {
        recapChapter(
          historyWithResponse,
          Math.floor(turnNumber / CHAPTER_TURN_INTERVAL),
          chapterStartTime(nextCampaign.log),
          finalPlayer.time,
        )
        if (uiPrefs.autoCloudBackup) {
          triggerAutoCloudBackup()
        }
      }
    } catch (err) {
      setError(`The thread of fate falters... (${errorMessage(err)})`)
    } finally {
      setBusy(false)
    }
  }

  // §5.7 — a fixed defeat context, no further damage math left to the model;
  // the client owns the recovery/currency outright, Gemini only narrates it.
  // Narrative-First Overhaul: there's no hp pool to restore a fraction of
  // anymore — recovery clears every Condition Tag the fall left behind
  // (a fresh start at the nearest safe location), and only the currency
  // penalty stays a real number.
  async function resolveDefeat(campaign: Campaign, baseHistory: HistoryTurn[]) {
    setBusy(true)
    const defeatAction =
      '[SYSTEM: The protagonist has just fallen. Narrate a brief DESPAIR-tier resolution: they wake, injured but alive, at the nearest safe location. This is a soft-fail recovery beat, not a continuation of the fight — do not narrate death.]'

    const contextSlice = buildContextSlice(campaign)
    const userTurnText = `${contextSlice}\n\nPlayer Action: ${defeatAction}`
    const newHistory: HistoryTurn[] = [...baseHistory, { role: 'user', parts: [{ text: userTurnText }] }]

    const penalizedCopper = Math.max(0, Math.round(campaign.player.copper * (1 - DEFEAT_CURRENCY_PENALTY_FRACTION)))

    try {
      const result = await getProvider(apiSettings.provider).runTurn({
        apiKey: apiSettings.apiKey,
        model: apiSettings.model,
        temperature: apiSettings.temperature,
        maxOutputTokens: Math.max(campaign.proseDepth.maxOutputTokens, MIN_TURN_OUTPUT_CEILING),
        history: newHistory,
      })

      const nar = result.ok ? result.turn!.nar : (result.fallbackText ?? 'Consciousness returns slowly, aching but alive.')
      const resolvedLocId = result.ok ? result.turn!.loc_id : undefined
      const resolvedLocDisp = result.ok ? (result.turn!.loc_disp ?? campaign.locations[result.turn!.loc_id]?.name ?? campaign.player.locDisp) : campaign.player.locDisp
      const nextPlayer: Player = {
        ...campaign.player,
        conditions: [], // a fresh start — the fall's own Condition Tags don't carry into the recovery beat
        copper: penalizedCopper,
        ...(resolvedLocId ? { locId: resolvedLocId, locDisp: resolvedLocDisp } : {}),
        ...(result.ok ? { time: result.turn!.time } : {}),
      }

      setGame((g) =>
        g && {
          ...g,
          player: nextPlayer,
          combat: { active: false },
          lastPlayed: Date.now(),
          log: [...g.log, { nar, turnState: 'DESPAIR', time: nextPlayer.time, locDisp: nextPlayer.locDisp }],
        },
      )
      setHistory([...newHistory, { role: 'model', parts: [{ text: result.historyText }] }])
    } catch (err) {
      setError(`The thread of fate falters... (${errorMessage(err)})`)
    } finally {
      setBusy(false)
    }
  }

  // The real in-game clock span this chapter covers — the "start" is
  // whatever time the turn right after the previous chapterSummary marker
  // logged (or the very first turn, for chapter 1). Passed into the recap
  // prompt as an explicit anchor: without it, a "several full paragraphs,
  // evocative" recap prompt naturally reaches for saga-length language
  // ("a grueling ascent," "days of hardship") even when the record shows
  // only a few in-game hours passed — the exact "temporal hallucination"
  // a live payload surfaced (a player line mockingly quoting the model's own
  // inflated framing: "Wait, days? I just met her this morning.").
  function chapterStartTime(log: LogEntry[]): GameTime | undefined {
    for (let i = log.length - 1; i >= 0; i--) {
      if (log[i].chapterSummary) return log[i + 1]?.time
    }
    return log.find((e) => e.time)?.time
  }

  // §2 Phase E Chapter Milestone — plain-text 2-sentence recap, then flush
  // the sliding history window: "past conversation turns are flushed... while
  // persistent summary cards are saved locally." A missed recap costs only
  // flavor (the log entry), so failures are swallowed rather than surfaced —
  // the window keeps growing and the next boundary just retries.
  async function recapChapter(
    historyForSummary: HistoryTurn[],
    chapterNumber: number,
    startTime?: GameTime,
    endTime?: GameTime,
  ) {
    try {
      const summary = await getProvider(apiSettings.provider).runSummary({
        apiKey: apiSettings.apiKey,
        model: apiSettings.model,
        temperature: apiSettings.temperature,
        maxOutputTokens: MAX_OUTPUT_TOKENS_CEILING,
        history: historyForSummary,
        startTime,
        endTime,
      })

      setGame((g) => g && { ...g, log: [...g.log, { nar: '', chapterSummary: summary, chapterNumber }] })
      setHistory([])
    } catch {
      // swallowed — see comment above
    }
  }

  // §9 Codex CRUD — the manual correction path for auto-logged entries (or
  // anything the player wants to fix directly rather than steering the LLM
  // toward). `patch: null` deletes the entry; otherwise it's merged into
  // whatever's already at that id, so the same call creates a fresh entry
  // when the id doesn't exist yet.
  function patchCodexDict(
    dictKey: 'npcs' | 'factions' | 'locations' | 'regions' | 'lore' | 'quests' | 'bestiary' | 'skills' | 'projects',
    id: string,
    patch: Record<string, unknown> | null,
  ) {
    setGame((g) => {
      if (!g) return g
      // `skills` is optional on Campaign (older saves predate it), so the
      // spread has to tolerate undefined rather than assuming a dict exists.
      const dict = { ...((g[dictKey] ?? {}) as unknown as Dict<Record<string, unknown>>) }
      if (patch === null) delete dict[id]
      else dict[id] = { ...(dict[id] ?? {}), ...patch }
      return { ...g, [dictKey]: dict } as Campaign
    })
  }

  function updateItem(id: string, qty: number | null, entry?: Partial<ItemEntry>) {
    setGame((g) => {
      if (!g) return g
      const inv = { ...g.inventory }
      const items = { ...(g.items ?? {}) }
      if (qty === null || qty <= 0) {
        delete inv[id]
        delete items[id]
      } else {
        inv[id] = qty
        const fallback: ItemEntry = { name: id, type: 'material' }
        if (entry) items[id] = { ...fallback, ...items[id], ...entry }
      }
      return { ...g, inventory: inv, items }
    })
  }

  // §5.9 — Codex's own Equip/Unequip buttons reuse the exact same
  // equipItem/unequipSlot logic as the !equip/!unequip bang commands, just
  // invoked directly from a click instead of parsed from typed text.
  function equipFromCodex(itemId: string) {
    setGame((g) => {
      if (!g) return g
      const item = g.items?.[itemId]
      if (!item || !EQUIPPABLE_TYPES.includes(item.type)) return g
      const result = equipItem(g.player, g.items ?? {}, itemId, item.type as EquipSlot)
      return result.error ? g : { ...g, player: result.player }
    })
  }

  function unequipFromCodex(slot: EquipSlot) {
    setGame((g) => {
      if (!g) return g
      const result = unequipSlot(g.player, slot)
      return result.error ? g : { ...g, player: result.player }
    })
  }

  function updateWorld(patch: Partial<WorldData>) {
    setGame((g) => g && { ...g, world: { ...g.world, ...patch } })
  }

  // §7 Pre-Authored Arc — hand-authored via Codex CRUD today (the whole
  // list is replaced at once, same "own the array" pattern as Codex's other
  // reorderable-list fields like ProjectEntry.stages).
  function updateBeats(beats: TaleBeat[]) {
    setGame((g) => g && { ...g, beats })
  }

  // §5.8 Crafting — the player-triggered "queue a job" action (Codex's
  // Workbenches & Recipes category). Ingredients are deducted immediately by
  // queueCraftingJob itself; a null return (recipe missing or unaffordable)
  // is a silent no-op since the UI already only offers what's affordable.
  function startCraftingJob(recipeId: string) {
    setGame((g) => {
      if (!g) return g
      const result = queueCraftingJob(g.crafting ?? [], g.inventory, recipeId, g.player.locId, g.player.time, store.newId('job'))
      if (!result) return g
      return { ...g, crafting: result.jobs, inventory: result.inventory, lastPlayed: Date.now() }
    })
  }

  // §5.1b Class Evolution — the manual/CRUD trigger path (Codex's Character
  // category), the same "steer state directly" philosophy already used for
  // auto-logged Codex entries and Discovery reveals. A no-op synthetic log
  // entry (no `time`/`locDisp`, matching the bang-command pattern) since this
  // isn't a narrated turn — the Chronicle renders it as its own banner.
  function evolveClass(classId: string) {
    setGame((g) => {
      if (!g) return g
      const newClass = findClassById(classId)
      if (!newClass || newClass.id === g.player.classId) return g
      return {
        ...g,
        player: { ...g.player, classId: newClass.id, className: newClass.name },
        lastPlayed: Date.now(),
        log: [...g.log, { nar: '', classEvolution: { className: newClass.name } }],
      }
    })
  }

  // §5.3 Summoning — arise/raise_skeleton/summon are also "!" bang commands
  // (0 tokens, client-resolved) but, unlike the read-only dossiers in
  // bangCommands.ts, they mutate real state (bestiary corpseCount, inventory,
  // minions). Intercepted here, before the read-only path, since App.tsx is
  // where all state mutation already lives (evolveClass, startCraftingJob).
  const SUMMON_COMMANDS = new Set(['arise', 'raise_skeleton', 'summon'])

  function handleSummonCommand(command: SummonCommand) {
    setGame((g) => {
      if (!g) return g
      const outcome = attemptSummon(command, g, store.newId('minion'))
      const nextMinions = outcome.minion ? { ...(g.minions ?? {}), [outcome.minion.id]: outcome.minion } : g.minions
      return {
        ...g,
        lastPlayed: Date.now(),
        bestiary: outcome.patch?.bestiary ?? g.bestiary,
        inventory: outcome.patch?.inventory ?? g.inventory,
        minions: nextMinions,
        log: [
          ...g.log,
          {
            nar: '',
            bang: {
              command,
              rows: outcome.minion ? [{ name: outcome.minion.name, id: outcome.minion.id, fields: [outcome.minion.branch, `${outcome.minion.hpMax} HP`] }] : [],
              note: outcome.note,
            },
          },
        ],
      }
    })
  }

  // §5.9 Equip/Unequip — deterministic and player-initiated, so (like
  // Summoning above) this is a mutating bang command rather than a schema
  // field: there's no narrative ambiguity for the model to arbitrate.
  const EQUIP_COMMANDS = new Set(['equip', 'unequip'])

  function handleEquipCommand(command: 'equip' | 'unequip', target: string) {
    setGame((g) => {
      if (!g) return g
      const items = g.items ?? {}

      if (command === 'equip') {
        const found = findEntry(items, target)
        if (!found || !EQUIPPABLE_TYPES.includes(found[1].type)) {
          const note = found ? `${found[1].name} can't be equipped.` : `No item matching "${target}" found.`
          return { ...g, lastPlayed: Date.now(), log: [...g.log, { nar: '', bang: { command: 'equip', rows: [], note } }] }
        }
        const [itemId, item] = found
        const result = equipItem(g.player, items, itemId, item.type as EquipSlot)
        return {
          ...g,
          player: result.player,
          lastPlayed: Date.now(),
          log: [
            ...g.log,
            {
              nar: '',
              bang: {
                command: 'equip',
                rows: result.error ? [] : [{ name: item.name, id: itemId, fields: [`equipped (${item.type})`] }],
                note: result.error,
              },
            },
          ],
        }
      }

      const slot = target.trim().toLowerCase() as EquipSlot
      if (!EQUIPPABLE_TYPES.includes(slot)) {
        return {
          ...g,
          lastPlayed: Date.now(),
          log: [...g.log, { nar: '', bang: { command: 'unequip', rows: [], note: 'Usage: !unequip weapon|armor|accessory' } }],
        }
      }
      const currentId = g.player.equipped?.[slot]
      const result = unequipSlot(g.player, slot)
      return {
        ...g,
        player: result.player,
        lastPlayed: Date.now(),
        log: [
          ...g.log,
          {
            nar: '',
            bang: {
              command: 'unequip',
              rows: result.error || !currentId ? [] : [{ name: items[currentId]?.name ?? currentId, id: currentId, fields: [`unequipped (${slot})`] }],
              note: result.error,
            },
          },
        ],
      }
    })
  }

  // §6.6 Bang Commands — 0 API tokens, resolved and rendered entirely
  // client-side. An unrecognized "!word" still renders a small note rather
  // than being silently swallowed, so mistyped commands are visibly not-lost.
  function handleBangCommand(raw: string) {
    if (!game) return
    const match = /^!(\w+)\s*(.*)$/s.exec(raw.trim())
    const word = match?.[1]?.toLowerCase()
    const target = match?.[2]?.trim() ?? ''
    if (word && SUMMON_COMMANDS.has(word)) {
      handleSummonCommand(word as SummonCommand)
      return
    }
    if (word && EQUIP_COMMANDS.has(word)) {
      handleEquipCommand(word as 'equip' | 'unequip', target)
      return
    }
    const result = resolveBangCommand(raw, game)
    const bang = result?.entry ?? { command: raw.slice(1).split(/\s/)[0] || '?', rows: [], note: `Unknown command "${raw}".` }
    setGame((g) => g && { ...g, lastPlayed: Date.now(), log: [...g.log, { nar: '', bang }] })
    if (result?.recallText) {
      setPendingRecall((prev) => (prev ? `${prev}\n\n${result.recallText}` : result.recallText))
    }
  }

  // §6.6 Slash Commands — moving a command between "this Tale" and "Global"
  // means deleting it from whichever dict it used to live in before writing
  // it to the new one, so `previousGlobal` (from the manager's edit state)
  // is required for a move and simply absent for a fresh create.
  function upsertSlashCommand(cmd: SlashCommand, global: boolean, previousGlobal?: boolean) {
    if (previousGlobal !== undefined && previousGlobal !== global) {
      if (previousGlobal) {
        setGlobalSlashCommands((g) => {
          const next = { ...g }
          delete next[cmd.id]
          return next
        })
      } else {
        setGame((g) => {
          if (!g) return g
          const next = { ...(g.slashCommands ?? {}) }
          delete next[cmd.id]
          return { ...g, slashCommands: next }
        })
      }
    }
    if (global) {
      setGlobalSlashCommands((g) => ({ ...g, [cmd.id]: cmd }))
    } else {
      setGame((g) => g && { ...g, slashCommands: { ...(g.slashCommands ?? {}), [cmd.id]: cmd } })
    }
  }

  function deleteSlashCommand(id: string, global: boolean) {
    if (global) {
      setGlobalSlashCommands((g) => {
        const next = { ...g }
        delete next[id]
        return next
      })
    } else {
      setGame((g) => {
        if (!g) return g
        const next = { ...(g.slashCommands ?? {}) }
        delete next[id]
        return { ...g, slashCommands: next }
      })
    }
  }

  function openSettings() {
    window.history.pushState({ modal: 'settings' }, '')
    setSettingsOpen(true)
  }

  function closeSettings() {
    if (window.history.state?.modal === 'settings') {
      window.history.back()
    }
    setSettingsOpen(false)
  }

  function openSlashManager() {
    window.history.pushState({ modal: 'slash_manager' }, '')
    setSlashManagerOpen(true)
  }

  function closeSlashManager() {
    if (window.history.state?.modal === 'slash_manager') {
      window.history.back()
    }
    setSlashManagerOpen(false)
  }

  function startNewStory(worldId?: string, protagonistId?: string) {
    const world = worldId ? worlds[worldId] : null
    const protagonist = protagonistId ? protagonists[protagonistId] : null
    setWorldSetupMode('tale')
    setWorldSetupInitial(world ?? null)
    setNewGameMode('tale')
    setNewGameInitial(protagonist ?? null)
    setPendingWorld(null)
    setPendingProtagonist(null)
    navigateTo('storymode')
  }

  // ---- Screens ----

  let content: ReactNode

  if (screen === 'title') {
    content = (
      <Title
        onEnter={() => navigateTo('mainmenu')}
        onSettings={() => openSettings()}
        onContinue={mostRecentCampaignId() ? () => resumeCampaign(mostRecentCampaignId()!) : undefined}
        musicMuted={musicMuted}
        onToggleMusicMute={toggleMusicMute}
      />
    )
  } else if (screen === 'mainmenu') {
    content = (
      <MainMenu
        worlds={worlds}
        protagonists={protagonists}
        campaigns={campaigns}
        onResume={resumeCampaign}
        onNewSession={(worldId, protagonistId) => startNewStory(worldId, protagonistId)}
        onDeleteCampaign={async (id) => {
          if (!(await confirm('Delete this Tale? This cannot be undone.'))) return
          setCampaigns((c) => {
            const next = { ...c }
            delete next[id]
            return next
          })
          if (activeCampaignId === id) {
            setGame(null)
            setActiveCampaignId(null)
          }
        }}
        onRenameCampaign={async (id) => {
          const current = campaigns[id]
          if (!current) return
          let draft = current.title
          let hint: string | undefined
          // Loops on the same "edit → validate → re-open" modal rather than a
          // one-shot prompt, so a collision or blank name re-prompts with an
          // explanatory hint instead of silently failing or renaming to "".
          for (;;) {
            const result = await editLongText('Rename Tale', draft, hint, 'e.g. The Fall of Basgiath')
            if (result === null) return
            const trimmed = result.trim()
            if (!trimmed) {
              draft = result
              hint = 'Give this Tale a name — it cannot be blank.'
              continue
            }
            const collides = Object.values(campaigns).some((c) => c.id !== id && c.title.trim().toLowerCase() === trimmed.toLowerCase())
            if (collides) {
              draft = result
              hint = 'Another Tale already has this name — choose a different one.'
              continue
            }
            setCampaigns((c) => ({ ...c, [id]: { ...c[id], title: trimmed } }))
            return
          }
        }}
        onExportCampaign={(id) => saveJSON(`${campaigns[id].title}.json`, campaigns[id])}
        onImportCampaign={async (file) => {
          try {
            const data = await readJSONFile(file)
            const id = data.id ?? store.newId('campaign')
            setCampaigns((c) => ({
              ...c,
              [id]: { schemaVersion: CURRENT_SCHEMA_VERSION, ...data, id, lastPlayed: Date.now() },
            }))
          } catch {
            setError('That file could not be read as a Tale save.')
          }
        }}
        onNewWorld={() => {
          setWorldSetupMode('library')
          setWorldSetupInitial(null)
          navigateTo('worldsetup')
        }}
        onEditWorld={(id) => {
          setWorldSetupMode('library')
          setWorldSetupInitial(worlds[id] ?? null)
          navigateTo('worldsetup')
        }}
        onSetDefaultWorld={(id) =>
          setWorlds((w) => Object.fromEntries(Object.entries(w).map(([k, v]) => [k, { ...v, isDefault: k === id }])))
        }
        onDeleteWorld={async (id) => {
          if (worlds[id]?.isMaster || id === 'world_fourth_wing') {
            setError('Master world templates cannot be deleted.')
            return
          }
          if (!(await confirm('Delete this World template?'))) return
          setWorlds((w) => {
            const next = { ...w }
            delete next[id]
            return next
          })
        }}
        onNewProtagonist={() => {
          setNewGameMode('library')
          setNewGameInitial(null)
          navigateTo('newgame')
        }}
        onEditProtagonist={(id) => {
          setNewGameMode('library')
          setNewGameInitial(protagonists[id] ?? null)
          navigateTo('newgame')
        }}
        onSetDefaultProtagonist={(id) =>
          setProtagonists((p) => Object.fromEntries(Object.entries(p).map(([k, v]) => [k, { ...v, isDefault: k === id }])))
        }
        onDeleteProtagonist={async (id) => {
          if (protagonists[id]?.isMaster || id === 'protagonist_violet_sorrengail') {
            setError('Master protagonist templates cannot be deleted.')
            return
          }
          if (!(await confirm('Delete this Protagonist template?'))) return
          setProtagonists((p) => {
            const next = { ...p }
            delete next[id]
            return next
          })
        }}
        onOpenSettings={() => openSettings()}
        onOpenNovelWeaver={() => navigateTo('novelweaver')}
        onBackToTitle={() => goBack('title')}
        musicMuted={musicMuted}
        onToggleMusicMute={toggleMusicMute}
        musicPlaying={musicPlaying}
        musicCurrentTrack={currentTrack}
        musicCurrentTime={musicCurrentTime}
        musicDuration={musicDuration}
        onPlayTrack={onPlayTrack}
        onTogglePlayPause={onTogglePlayPause}
        onNextTrack={onNextTrack}
        onPrevTrack={onPrevTrack}
        onResumeSoundtrack={onResumeSoundtrack}
      />
    )
  } else if (screen === 'talediveweaver') {
    content = (
      <TaleDiveWeaver
        debugMode={uiPrefs.debugMode}
        worldTemplates={Object.values(worlds)}
        protagonistTemplates={Object.values(protagonists)}
        existingTitles={Object.values(campaigns).map((c) => c.title)}
        onBack={() => goBack('mainmenu')}
        onSaveProtagonistPreset={(pData: ProtagonistData) => upsertProtagonist(pData, pData.id, pData.className || getClassById(pData.classId).name)}
        onSaveWorldPreset={(wData: WorldData) => upsertWorld(wData, wData.id)}
        onDeleteProtagonistPreset={deleteProtagonist}
        onDeleteWorldPreset={deleteWorld}
        onBeginTale={(protagonistData: ProtagonistData, worldOverride: Partial<WorldData>, customTitle: string, customNpcs?: SeedNpcData[]) => {
          beginCampaign(protagonistData, worldOverride, customTitle, customNpcs)
        }}
      />
    )
  } else if (screen === 'novelweaver') {
    content = (
      <NovelWeaver
        worldTemplates={Object.values(worlds)}
        protagonistTemplates={Object.values(protagonists)}
        existingTitles={Object.values(campaigns).map((c) => c.title)}
        onBack={() => goBack('mainmenu')}
        onSaveProtagonistPreset={(pData: ProtagonistData) => upsertProtagonist(pData, pData.id, pData.className || getClassById(pData.classId).name)}
        onSaveWorldPreset={(wData: WorldData) => upsertWorld(wData, wData.id)}
        onDeleteProtagonistPreset={deleteProtagonist}
        onDeleteWorldPreset={deleteWorld}
        onBeginTale={(protagonistData, worldOverride, customTitle, cast) => {
          beginCampaign(protagonistData, worldOverride, customTitle, cast.map((c) => ({ ...c, role: c.role ?? '' })))
        }}
      />
    )
  } else if (screen === 'diveloading') {
    content = <DiveLoadingScreen gender={loadingGender ?? pendingProtagonist?.gender ?? game?.player?.gender} />
  } else if (screen === 'storymode') {
    content = (
      <StoryMode onBack={() => goBack('mainmenu')} onSelectOriginal={() => navigateTo('talediveweaver')} />
    )
  } else if (screen === 'worldsetup') {
    content = (
      <WorldSetup
        worldTemplates={Object.values(worlds)}
        initial={worldSetupInitial}
        editLongText={editLongText}
        onBack={() => goBack(worldSetupMode === 'library' ? 'mainmenu' : 'storymode')}
        onContinue={(worldData) => {
          if (worldSetupMode === 'library') {
            upsertWorld(worldData, worldData.id)
            navigateTo('mainmenu')
          } else {
            setPendingWorld(worldData)
            navigateTo('newgame')
          }
        }}
        onSavePreset={(worldData) => upsertWorld(worldData, worldData.id)}
        onSaveAsNewPreset={(worldData) => upsertWorld(worldData, null)}
        onDeletePreset={deleteWorld}
      />
    )
  } else if (screen === 'newgame') {
    content = (
      <NewGame
        protagonistTemplates={Object.values(protagonists)}
        initial={newGameInitial}
        editLongText={editLongText}
        showBriefField={newGameMode === 'library'}
        onBack={() => goBack(newGameMode === 'tale' ? 'worldsetup' : 'mainmenu')}
        onBegin={(protagonistData) => {
          if (newGameMode === 'library') {
            const cls = getClassById(protagonistData.classId)
            upsertProtagonist(protagonistData, protagonistData.id, cls.name)
            navigateTo('mainmenu')
          } else {
            setPendingProtagonist(protagonistData)
            navigateTo('talebrief')
          }
        }}
        onSavePreset={(protagonistData) => upsertProtagonist(protagonistData, protagonistData.id, getClassById(protagonistData.classId).name)}
        onSaveAsNewPreset={(protagonistData) => upsertProtagonist(protagonistData, null, getClassById(protagonistData.classId).name)}
        onDeletePreset={deleteProtagonist}
      />
    )
  } else if (screen === 'talebrief' && pendingWorld && pendingProtagonist) {
    content = (
      <TaleBrief
        initialOpening={pendingProtagonist.opening}
        initialNarrationStyle={pendingWorld.narrationStyle}
        initialTemperature={apiSettings.temperature}
        suggestedTitle={pendingProtagonist.name ? `${pendingProtagonist.name}'s Tale` : 'Untitled Tale'}
        existingTitles={Object.values(campaigns).map((c) => c.title)}
        editLongText={editLongText}
        onBack={() => goBack('newgame')}
        onBegin={({ opening, narrationStyle, temperature, title }) => {
          setApiSettings((a) => ({ ...a, temperature }))
          beginCampaign({ ...pendingProtagonist, opening }, { narrationStyle }, title)
        }}
      />
    )
  } else if (screen === 'seedingreview' && game) {
    // World Seeding review — reuses Codex verbatim (it's a pure props-in/
    // callbacks-out view, no in-progress-campaign coupling) so the player
    // can look over everything just populated (player-authored setup +
    // World Seeding's Lore/NPCs/optional Ambition quest/key item) before the
    // Prologue turn fires. The one behavioral difference from the ordinary
    // Codex screen: its single "back" action confirms and begins the dive
    // instead of returning to Chronicle, since there's no Chronicle to
    // return to yet.
    content = (
      <Codex
        world={game.world}
        player={game.player}
        log={game.log}
        npcs={game.npcs}
        factions={game.factions}
        locations={game.locations}
        regions={game.regions ?? {}}
        lore={game.lore}
        quests={game.quests}
        bestiary={game.bestiary}
        flags={game.flags}
        inventory={game.inventory}
        items={game.items ?? {}}
        crafting={game.crafting ?? []}
        projects={game.projects ?? {}}
        onUpdateNpc={(id: string, patch: Partial<NpcEntry> | null) => patchCodexDict('npcs', id, patch as Record<string, unknown> | null)}
        onUpdateFaction={(id: string, patch: Partial<FactionEntry> | null) => patchCodexDict('factions', id, patch as Record<string, unknown> | null)}
        onUpdateLocation={(id: string, patch: Partial<LocationEntry> | null) => patchCodexDict('locations', id, patch as Record<string, unknown> | null)}
        onUpdateRegion={(id: string, patch: Partial<RegionEntry> | null) => patchCodexDict('regions', id, patch as Record<string, unknown> | null)}
        onUpdateLore={(id: string, patch: Partial<LoreEntry> | null) => patchCodexDict('lore', id, patch as Record<string, unknown> | null)}
        onUpdateQuest={(id: string, patch: Partial<QuestEntry> | null) => patchCodexDict('quests', id, patch as Record<string, unknown> | null)}
        onUpdateBestiary={(id: string, patch: Partial<BestiaryEntry> | null) => patchCodexDict('bestiary', id, patch as Record<string, unknown> | null)}
        onUpdateProject={(id: string, patch: Partial<ProjectEntry> | null) => patchCodexDict('projects', id, patch as Record<string, unknown> | null)}
        skills={game.skills ?? {}}
        onUpdateSkill={(id: string, patch: Partial<SkillEntry> | null) => patchCodexDict('skills', id, patch as Record<string, unknown> | null)}
        onUpdateItem={updateItem}
        onEquipItem={equipFromCodex}
        onUnequipSlot={unequipFromCodex}
        beats={game.beats ?? []}
        onUpdateBeats={updateBeats}
        onUpdateWorld={updateWorld}
        onEvolveClass={evolveClass}
        onStartCraft={startCraftingJob}
        onBack={() => {
          const action = pendingFirstAction
          setPendingFirstAction(null)
          navigateTo('chronicle')
          if (action) sendAction(action, false, game, [])
        }}
      />
    )
  } else if (screen === 'codex' && game) {
    content = (
      <Codex
        world={game.world}
        player={game.player}
        log={game.log}
        npcs={game.npcs}
        factions={game.factions}
        locations={game.locations}
        regions={game.regions ?? {}}
        lore={game.lore}
        quests={game.quests}
        bestiary={game.bestiary}
        flags={game.flags}
        inventory={game.inventory}
        items={game.items ?? {}}
        crafting={game.crafting ?? []}
        projects={game.projects ?? {}}
        onUpdateNpc={(id: string, patch: Partial<NpcEntry> | null) => patchCodexDict('npcs', id, patch as Record<string, unknown> | null)}
        onUpdateFaction={(id: string, patch: Partial<FactionEntry> | null) => patchCodexDict('factions', id, patch as Record<string, unknown> | null)}
        onUpdateLocation={(id: string, patch: Partial<LocationEntry> | null) => patchCodexDict('locations', id, patch as Record<string, unknown> | null)}
        onUpdateRegion={(id: string, patch: Partial<RegionEntry> | null) => patchCodexDict('regions', id, patch as Record<string, unknown> | null)}
        onUpdateLore={(id: string, patch: Partial<LoreEntry> | null) => patchCodexDict('lore', id, patch as Record<string, unknown> | null)}
        onUpdateQuest={(id: string, patch: Partial<QuestEntry> | null) => patchCodexDict('quests', id, patch as Record<string, unknown> | null)}
        onUpdateBestiary={(id: string, patch: Partial<BestiaryEntry> | null) => patchCodexDict('bestiary', id, patch as Record<string, unknown> | null)}
        onUpdateProject={(id: string, patch: Partial<ProjectEntry> | null) => patchCodexDict('projects', id, patch as Record<string, unknown> | null)}
        skills={game.skills ?? {}}
        onUpdateSkill={(id: string, patch: Partial<SkillEntry> | null) => patchCodexDict('skills', id, patch as Record<string, unknown> | null)}
        onUpdateItem={updateItem}
        onEquipItem={equipFromCodex}
        onUnequipSlot={unequipFromCodex}
        beats={game.beats ?? []}
        onUpdateBeats={updateBeats}
        onUpdateWorld={updateWorld}
        onEvolveClass={evolveClass}
        onStartCraft={startCraftingJob}
        initialCategory={codexTarget?.category}
        initialEntryId={codexTarget?.id}
        onBack={() => {
          setCodexTarget(null)
          goBack('chronicle')
        }}
      />
    )
  } else if (screen === 'chronicle' && game) {
    content = (
      <Chronicle
        title={game.title}
        player={game.player}
        combat={game.combat}
        log={game.log}
        seedDebug={game.seedDebug}
        busy={busy}
        error={error}
        chromeOpacity={uiPrefs.chromeOpacity}
        npcs={game.npcs}
        locations={game.locations}
        factions={game.factions}
        lore={game.lore}
        quests={game.quests}
        bestiary={game.bestiary}
        skills={game.skills ?? {}}
        items={game.items ?? {}}
        crafting={game.crafting}
        apiSettings={apiSettings}
        proseDepth={game.proseDepth}
        lastActionText={lastActionText}
        onRetry={handleRetry}
        onDismissError={handleDismissError}
        onEditLastTurn={handleEditLastTurn}
        onRemoveLastTurn={handleRemoveLastTurn}
        editLongText={editLongText}
        onOpenRetryEditor={openRetry}
        confirmAction={confirm}
        onSend={sendAction}
        onBangCommand={handleBangCommand}
        slashCommands={[...Object.values(game.slashCommands ?? {}), ...Object.values(globalSlashCommands)]}
        onOpenSlashManager={() => openSlashManager()}
        onOpenSettings={() => openSettings()}
        onOpenMenu={() => navigateTo('mainmenu')}
        onOpenCodex={() => {
          setCodexTarget(null)
          navigateTo('codex')
        }}
        onOpenCodexEntry={(category, id) => {
          setCodexTarget({ category: KEYWORD_CATEGORY_TO_CODEX[category], id })
          navigateTo('codex')
        }}
        onOpenCodexCategory={(category) => {
          setCodexTarget({ category })
          navigateTo('codex')
        }}
        debugMode={uiPrefs.debugMode}
      />
    )
  } else {
    content = (
      <Title
        onEnter={() => navigateTo('mainmenu')}
        onSettings={() => openSettings()}
        onContinue={mostRecentCampaignId() ? () => resumeCampaign(mostRecentCampaignId()!) : undefined}
        musicMuted={musicMuted}
        onToggleMusicMute={toggleMusicMute}
        debugMode={uiPrefs.debugMode}
        introGazeDelay={uiPrefs.introGazeDelay}
      />
    )
  }

  // §6.0 Motion System — pure cross-fade between screens to avoid vertical bounce on mobile.
  return (
    <>
      <AnimatePresence mode="wait">
        <motion.div
          key={screen}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="w-full min-h-dvh flex flex-col"
        >
          <Suspense fallback={<div className="w-full min-h-dvh bg-[#0b0812]" />}>{content}</Suspense>
        </motion.div>
      </AnimatePresence>

      {/* Now Playing Playlist Banner on top of screen */}
      <NowPlayingBanner
        track={currentTrack}
        visible={uiPrefs.showMusicBanners ? bannerVisible : false}
        muted={musicMuted}
        onDismiss={dismissBanner}
      />

      {/* Overlay, not a screen — the screen underneath stays mounted and
          visible through the modal's glass. */}
      {settingsOpen && (
       <Suspense fallback={null}>
        <Settings
          apiSettings={apiSettings}
          uiPrefs={uiPrefs}
          game={game}
          musicMuted={musicMuted}
          onToggleMusicMute={toggleMusicMute}
          onBack={closeSettings}
          onSave={({ apiSettings: nextApi, uiPrefs: nextUi, proseDepthKey }: SettingsSavePayload) => {
            setApiSettings(nextApi)
            setUiPrefs(nextUi)
            if (game) {
              setGame((g) => g && { ...g, proseDepth: PROSE_DEPTHS[proseDepthKey] })
            }
            closeSettings()
          }}
          onExportActive={() => game && saveJSON(`${game.title}.json`, game)}
          onBackupAll={() => {
            const payload = getFullBackupPayload()
            saveJSON('tale-dives-backup.json', payload)
            if (uiPrefs.autoCloudBackup) {
              triggerAutoCloudBackup()
            }
          }}
          onBackupCloud={async () => {
            try {
              const user = getCurrentGoogleUser()
              const token = await getGoogleAccessToken()
              if (!user || !token) {
                await signInWithGoogle()
              }
              const proceed = await confirm(
                `Upload save data to Google Drive? This will save all your campaigns, worlds, protagonists, commands, and settings.`
              )
              if (!proceed) return false

              const payload = getFullBackupPayload()
              await uploadBackupToDrive(payload)
              return true
            } catch (err: any) {
              console.error('Google Drive backup error:', err)
              setError(errorMessage(err))
              return false
            }
          }}
          onRestoreCloud={async (fileId?: string) => {
            try {
              const user = getCurrentGoogleUser()
              const token = await getGoogleAccessToken()
              if (!user || !token) {
                await signInWithGoogle()
              }
              const files = await listDriveBackups()
              if (files.length === 0) {
                setError('No Tale Dives backups found on your Google Drive.')
                return false
              }
              let target: GoogleDriveFile | undefined
              if (fileId) {
                target = files.find((f) => f.id === fileId)
              }
              if (!target) {
                target = files[0]
              }
              const proceed = await confirm(
                `Restore save data from Google Drive (${target.name})? Current saves and templates will be merged.`
              )
              if (!proceed) return false

              const data = await downloadDriveBackup(target.id)
              restoreBackupPayload(data)
              return true
            } catch (err: any) {
              console.error('Google Drive restore error:', err)
              setError(errorMessage(err))
              return false
            }
          }}
          onImportJson={async (file: File) => {
            try {
              const data = await readJSONFile(file)
              restoreBackupPayload(data)
            } catch {
              setError('That file could not be read as a Tale Dives save.')
            }
          }}
          onResetDefaults={async () => {
            if (!(await confirm('Restore default settings? This will not erase your campaigns.'))) return
            setApiSettings(store.loadApiSettings())
            setUiPrefs(store.loadUiPrefs())
          }}
          onClearCache={async () => {
            if (!(await confirm('Erase all Tales, Worlds, and Protagonists on this device? This cannot be undone.'))) return
            localStorage.clear()
            sessionStorage.clear()
            window.location.reload()
          }}
        />
       </Suspense>
      )}

      {slashManagerOpen && game && (
       <Suspense fallback={null}>
        <SlashCommandManager
          campaignCommands={game.slashCommands ?? {}}
          globalCommands={globalSlashCommands}
          onSave={upsertSlashCommand}
          onDelete={deleteSlashCommand}
          onClose={closeSlashManager}
        />
       </Suspense>
      )}

      {uiPrefs.debugMode && screen !== 'talediveweaver' && (
        <Suspense fallback={null}>
          <WeaverCalibrator isGlobal />
        </Suspense>
      )}

      {confirmDialog}
      {longTextDialog}
      {retryDialog}
    </>
  )
}
