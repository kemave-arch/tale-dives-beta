import { useEffect, useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import Title from './screens/Title.tsx'
import Settings, { type SettingsSavePayload } from './screens/Settings.tsx'
import MainMenu from './screens/MainMenu.tsx'
import StoryMode from './screens/StoryMode.tsx'
import WorldSetup from './screens/WorldSetup.tsx'
import NewGame from './screens/NewGame.tsx'
import TaleBrief from './screens/TaleBrief.tsx'
import Chronicle from './screens/Chronicle.tsx'
import Codex, { type CategoryId } from './screens/Codex.tsx'
import SlashCommandManager from './screens/SlashCommandManager.tsx'
import { getClassById, findClassById } from './data/classes.ts'
import { startingAttributes, derivedPools } from './lib/derivedStats.ts'
import { buildContextSlice } from './lib/jitContext.ts'
import { applyTurn, type TacticalOverride } from './lib/shadowReferee.ts'
import { ensureLocation } from './lib/locations.ts'
import { applyNpcUpdates } from './lib/npcs.ts'
import { applyKeywordLinks } from './lib/codex.ts'
import { applyQuestUpdate } from './lib/quests.ts'
import { applySkillLearn } from './lib/skills.ts'
import { applyInventoryChanges, equipItem, unequipSlot } from './lib/inventory.ts'
import { resolveBangCommand, findEntry } from './lib/bangCommands.ts'
import { checkCodexReveals } from './lib/discovery.ts'
import { queueCraftingJob, resolveCraftingJobs } from './lib/crafting.ts'
import { applyMinionUpkeep, attemptSummon, type SummonCommand } from './lib/summoning.ts'
import { applyFactionRepDeltas } from './lib/factions.ts'
import { computePlayerAttack, isDisengaging, describeCombatResult, ensureAdversary } from './lib/combat.ts'
import { applyLevelUps, isChapterBoundary, CHAPTER_TURN_INTERVAL } from './lib/leveling.ts'
import { parseKeywordLinks } from './lib/keywordLinks.ts'
import { slugify } from './lib/slug.ts'
import { getProvider } from './api/providers/index.ts'
import { sanitize } from './api/providers/gemini.ts'
import { PROSE_DEPTHS, DEFAULT_NARRATION_STYLE, MAX_OUTPUT_TOKENS_CEILING } from './api/turnContract.ts'
import { readJSONFile, saveJSON } from './lib/backup.ts'
import { useConfirm } from './lib/useConfirm.tsx'
import { useLongTextEditor } from './lib/useLongTextEditor.tsx'
import { useBackgroundMusic } from './lib/backgroundMusic.tsx'
import NowPlayingBanner from './components/NowPlayingBanner.tsx'
import * as store from './lib/store.ts'
import { CURRENT_SCHEMA_VERSION, EQUIPPABLE_TYPES } from './types.ts'
import type {
  BestiaryEntry, Campaign, CombatMode, CombatState, Dict, EquipSlot, FactionEntry, HistoryTurn, ItemEntry, KeywordLink, LocationEntry, LoreEntry,
  NpcEntry, Player, ProtagonistData, QuestEntry, SkillEntry, SlashCommand, TurnState, WorldData,
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
type Screen = 'title' | 'mainmenu' | 'storymode' | 'worldsetup' | 'newgame' | 'talebrief' | 'chronicle' | 'codex'
type CreationMode = 'tale' | 'library'

// §5.7 Player Defeat State — soft-fail recovery, client-owned.
const DEFEAT_HP_RESTORE_FRACTION = 0.4
const DEFEAT_CURRENCY_PENALTY_FRACTION = 0.15

function findDefault<T extends { isDefault?: boolean }>(dict: Dict<T>): T | null {
  return Object.values(dict).find((e) => e.isDefault) ?? null
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
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

  // Turn CRUD (Edit/Retry/Delete on the last turn only, Chronicle.tsx) —
  // patches just the `nar` field inside an already-stored raw payload,
  // leaving every other field (turn_state, deltas, loc_id, etc.) untouched,
  // so an edited turn's context for future API calls stays byte-consistent
  // with what's actually displayed. Falls back to the raw text unchanged if
  // it isn't valid JSON (a fallback-reader turn) — the caller still applies
  // the display-only nar edit regardless.
  function patchNarInRawPayload(raw: string, newNar: string): string {
    try {
      const parsed = JSON.parse(sanitize(raw))
      return JSON.stringify({ ...parsed, nar: newNar })
    } catch {
      return raw
    }
  }

  function handleEditLastTurn(newNar: string) {
    setGame((g) => {
      if (!g || g.log.length === 0) return g
      const log = [...g.log]
      const lastIndex = log.length - 1
      const entry = log[lastIndex]
      if (!entry.nar || !entry.rawPayload) return g
      log[lastIndex] = { ...entry, nar: newNar, rawPayload: patchNarInRawPayload(entry.rawPayload, newNar) }
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

  // Retry and Delete both boil down to this: drop the last turn from the
  // displayed record (log) and from the conversational context the API sees
  // next turn (history — a user+model pair per turn, so the last 2 entries).
  // This corrects the *context*, not game mechanics — HP/inventory/quest
  // deltas that turn already applied are NOT rolled back, same as this app
  // has never had a general undo system. Retry additionally re-seeds the
  // input box with the original action text (Chronicle.tsx) for the player
  // to revise and resend.
  function handleRemoveLastTurn() {
    setGame((g) => {
      if (!g || g.log.length === 0) return g
      return { ...g, log: g.log.slice(0, -1), turnCount: Math.max(0, (g.turnCount ?? 0) - 1) }
    })
    setHistory((h) => h.slice(0, Math.max(0, h.length - 2)))
  }

  const [pendingRecall, setPendingRecall] = useState<string | null>(null) // §6.6 — a targeted/full !recall snapshot waiting to ride along on the next real turn
  const { confirm, dialog: confirmDialog } = useConfirm()
  const { edit: editLongText, dialog: longTextDialog } = useLongTextEditor()
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
  } = useBackgroundMusic()

  useEffect(() => { store.saveApiSettings(apiSettings) }, [apiSettings])
  useEffect(() => { store.saveUiPrefs(uiPrefs) }, [uiPrefs])
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

  function upsertWorld(worldData: WorldData, existingId?: string | null): WorldData {
    const id = existingId ?? store.newId('world')
    const entry: WorldData = {
      ...worldData,
      id,
      savedAt: worldData.savedAt ?? Date.now(),
      isDefault: worlds[id]?.isDefault ?? false,
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
    }
    setProtagonists((p) => ({ ...p, [id]: entry }))
    return entry
  }

  function resumeCampaign(id: string) {
    setGame(campaigns[id])
    setActiveCampaignId(id)
    setHistory([])
    navigateTo('chronicle')
  }

  // Title's "Continue" shortcut and Main Menu's Tales tab both want the same
  // Tale — whichever was last actually played.
  function mostRecentCampaignId(): string | undefined {
    return Object.values(campaigns).sort((a, b) => (b.lastPlayed ?? 0) - (a.lastPlayed ?? 0))[0]?.id
  }

  function beginCampaign(protagonistData: ProtagonistData, combatMode: CombatMode = 'NARRATIVE', worldOverride?: Partial<WorldData>) {
    const cls = getClassById(protagonistData.classId)
    const attrs = startingAttributes(cls.weights)
    const { hpMax, mpMax, stMax } = derivedPools(attrs)

    const player = {
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
      hp: hpMax,
      hpMax,
      mp: mpMax,
      mpMax,
      st: stMax,
      stMax,
      copper: 14580,
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

    // Both land in their libraries the moment a Tale begins (§6.4B) —
    // creation IS how the World/Protagonist Library gets populated.
    const worldEntry = upsertWorld(world, world.id)
    const protagonistEntry = upsertProtagonist(protagonistData, protagonistData.id, cls.name)

    const campaignId = store.newId('campaign')
    const campaign: Campaign = {
      id: campaignId,
      schemaVersion: CURRENT_SCHEMA_VERSION,
      title: `${player.name}'s Tale`,
      synopsis: (protagonistData.opening || world.background || '').slice(0, 140),
      worldId: worldEntry.id!,
      protagonistId: protagonistEntry.id!,
      world, // §Phase A — kept for reference until the Codex Realm Overview exists
      player,
      combatMode, // §5.1d — defaults to NARRATIVE (see the Tale Dive Brief screen's toggle)
      proseDepth: PROSE_DEPTHS.IMMERSIVE, // default changed 2026-09-04 per explicit request for the most immersive prose by default; still overridable per-campaign in Settings
      narrationStyle: world.narrationStyle || DEFAULT_NARRATION_STYLE,
      locations: {}, // §5.10 Locations Codex — populated by auto-registration
      npcs: {}, // §5.5/§5.14 NPC Codex — populated by auto-registration
      factions: {}, // §5.14 — populated by {{Term|faction}} keyword links
      lore: {}, // §5.14 — populated by {{Term|lore}} keyword links
      quests: {}, // §5.14 — populated by {{Term|quest}} keyword links (quest_update integration is still pending)
      bestiary: {}, // §5.13/§5.14 — populated by {{Term|beast}} keyword links, full stat blocks once combat begins
      skills: {}, // §6.4D — populated by {{Term|skill}} keyword links and skill_learn
      combat: { active: false }, // §2 Phase D.2/§5.13 — ephemeral, reset each encounter
      flags: [], // §5.6 World Impact Ledger
      inventory: {}, // §5.9
      log: [],
      lastPlayed: Date.now(),
      turnCount: 0,
    }

    setGame(campaign)
    setActiveCampaignId(campaignId)
    setHistory([])
    setError(null)
    setPendingWorld(null)
    navigateTo('chronicle')

    // §Phase B.4 — the Tale Dive Brief fires Turn 1, folding in the World
    // Background/Genre/Conflict/Power System/Era/Key Factions from Phase A so
    // the opening is actually grounded in what was set up rather than
    // fabricated from nothing.
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

    const firstAction = [...worldLines, backgroundLine, ...identityLines, briefLine].filter(Boolean).join('\n')

    // Pass campaign + a fresh history directly — setGame/setHistory above
    // haven't flushed into this closure yet, so sendAction needs both handed
    // to it explicitly rather than reading stale `game`/`history` state.
    sendAction(firstAction, false, campaign, [])
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

    // §2 Phase D.2/§5.1d — Tactical Mode precomputes the exchange before the
    // prompt goes out, but only once combat is already active (its opening
    // beat is still Gemini's narrative call, §5.13) and the action isn't a
    // disengage attempt.
    const inCombat = current.combatMode === 'TACTICAL' && current.combat?.active && !isDisengaging(actionText)
    let combatResultLine: string | null = null
    let tacticalOverride: TacticalOverride | undefined
    let combatOutcome: { enemyHpAfter: number; enemyDefeated: boolean } | null = null

    if (inCombat) {
      const combat = current.combat // invariant: active=true always carries enemyHp/enemyDmgBase (set together in the branch below)
      const attack = computePlayerAttack(current.player)
      const enemyHpAfter = Math.max(0, combat.enemyHp! - attack.damage)
      const enemyDefeated = enemyHpAfter <= 0
      const playerDamageTaken = enemyDefeated ? 0 : combat.enemyDmgBase!

      combatResultLine = describeCombatResult({
        enemyName: combat.enemyName,
        damage: attack.damage,
        enemyHp: enemyHpAfter,
        enemyHpMax: combat.enemyHpMax,
        defeated: enemyDefeated,
        playerDamageTaken,
        exhausted: attack.exhausted,
      })
      tacticalOverride = { hpDelta: -playerDamageTaken, stDelta: -attack.stCost }
      combatOutcome = { enemyHpAfter, enemyDefeated }
    }

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
    const contextSlice = buildContextSlice(current, combatResultLine, craftReadyLine)
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
    try {
      const result = await getProvider(apiSettings.provider).runTurn({
        apiKey: apiSettings.apiKey,
        model: apiSettings.model,
        temperature: apiSettings.temperature,
        maxOutputTokens: isWorldSeedingTurn ? MAX_OUTPUT_TOKENS_CEILING : current.proseDepth.maxOutputTokens,
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
        setHistory([...newHistory, { role: 'model', parts: [{ text: result.raw }] }])
        return
      }

      const turn = result.turn!
      const { player: nextPlayer, defeated: playerDefeated } = applyTurn(current.player, turn, tacticalOverride)
      nextPlayer.time = turn.time ?? current.player.time // Shadow Referee doesn't own time

      // Keyword links run first so a {{Term|npc}}/{{Term|loc}} tag's real name
      // wins over the plainer fallback loc_id/npc_id-derived stub name.
      const linked = applyKeywordLinks(
        {
          locations: current.locations,
          npcs: current.npcs,
          factions: current.factions,
          lore: current.lore,
          quests: current.quests,
          bestiary: current.bestiary,
          skills: current.skills ?? {},
        },
        turn.nar,
      )
      const { dict: nextLocations } = ensureLocation(linked.locations, turn.loc_id, turn.loc_disp)
      const nextNpcs = applyNpcUpdates(linked.npcs, turn.npc_mem_up, turn.loc_id)
      const nextQuests = applyQuestUpdate(linked.quests, turn.quest_update)
      // §6.4D — a skill_learn record fills in (or upgrades) whatever the
      // {{Term|skill}} keyword pass already stubbed out.
      const nextSkills = applySkillLearn(linked.skills, turn.skill_learn)
      const nextFlags = turn.flag_add?.length ? Array.from(new Set([...current.flags, ...turn.flag_add])) : current.flags

      // §5.4 App-Side Rivalry — a rep change to one faction mirrors an
      // inverse change onto its `rivalId` counterpart, entirely client-side.
      const nextFactions = applyFactionRepDeltas(linked.factions, turn.fac_rep ?? [])

      // §5.3 — every corpse this turn's combat produced becomes harvestable
      // for a future `!arise`, until spent.
      const nextCorpses = turn.corpse_add?.length ? [...(current.corpses ?? []), ...turn.corpse_add] : (current.corpses ?? [])

      // §5.8 — the authoritative crafting resolution, against this turn's
      // actual resulting time/location (nextPlayer.time/.locId, already set
      // by applyTurn above) rather than the pre-call peek's start-of-turn
      // snapshot. Its output lands in inventory as the base applyInventoryChanges
      // below layers this turn's own inv_add/inv_rem on top of.
      const craftResolution = resolveCraftingJobs(current.crafting ?? [], current.inventory, nextPlayer.time)
      const invResult = applyInventoryChanges(craftResolution.inventory, current.items, turn.inv_add, turn.inv_rem)

      // §3.2 Turn State Consistency — forced to COMBAT whenever a Tactical
      // result was precomputed; otherwise Gemini's own call, same as always.
      let turnState: TurnState = turn.turn_state
      let nextCombat: CombatState = current.combat ?? { active: false }
      let nextBestiary = linked.bestiary

      if (inCombat && combatOutcome) {
        turnState = 'COMBAT'
        nextCombat = combatOutcome.enemyDefeated
          ? { active: false }
          : { ...current.combat, enemyHp: combatOutcome.enemyHpAfter }
      } else if (turnState === 'COMBAT' && !current.combat?.active) {
        // Combat is starting narratively this turn — stand up a stat block
        // (§5.13) for whichever adversary got tagged, if any.
        const beastLink = parseKeywordLinks(turn.nar).find((l) => l.category === 'beast')
        if (beastLink) {
          const enemyId = slugify(beastLink.term)
          const { dict: withAdversary, entry } = ensureAdversary(
            nextBestiary,
            enemyId,
            beastLink.term,
            'standard',
            current.player.level,
          )
          nextBestiary = withAdversary
          nextCombat = {
            active: true,
            enemyId,
            enemyName: beastLink.term,
            enemyHp: entry.hpMax,
            enemyHpMax: entry.hpMax,
            enemyDmgBase: entry.dmgBase,
          }
        }
      } else if (turnState !== 'COMBAT' && current.combat?.active) {
        // Gemini narratively ended the fight (fled, negotiated, etc.).
        nextCombat = { active: false }
      }

      if (playerDefeated) nextCombat = { active: false }

      // §6.6 Slash Command pause override — an explicit player-invoked OOC
      // beat, so it wins over whatever turn state got computed above.
      if (forcePauseState) turnState = 'PAUSE'

      // §5.1a Milestone Leveling — +1 per completed quest this turn, +1 at
      // every Chapter Milestone boundary (§8 item 5's Secret-quest question
      // is moot for now since quest_update doesn't track a tier at all yet).
      const turnNumber = (current.turnCount ?? 0) + 1 // ?? tolerates saves from before turnCount existed
      const questLevels = turn.quest_update?.status === 'completed' ? 1 : 0
      const chapterLevels = isChapterBoundary(turnNumber) ? 1 : 0
      const { player: leveledPlayer, leveled } = applyLevelUps(
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

      // §5.12 Codex Discovery — zero-token reveal check against this turn's
      // own deltas (flag_add/loc_id/npc_mem_up/quest_update), run last so it
      // sees the final merged flag list from above.
      const reveals = checkCodexReveals(
        { npcs: nextNpcs, locations: nextLocations, factions: nextFactions, lore: linked.lore, quests: nextQuests, bestiary: nextBestiary },
        turn,
        nextFlags,
      )

      // §5.3 — a `familiar`-branch minion drains its MP upkeep every turn,
      // after every other MP-affecting change this turn already applied, and
      // dissipates the instant its upkeep can no longer be paid.
      const upkeep = applyMinionUpkeep(current.minions ?? {}, evolvedPlayer.mp)
      const upkeepPlayer = upkeep.mp !== evolvedPlayer.mp ? { ...evolvedPlayer, mp: upkeep.mp } : evolvedPlayer

      // §5.1c Direct Stat Modification (Event/narrative source) — a genuine
      // permanent boost, never ordinary damage/healing (that's `deltas`).
      // Same "current grows by the same delta as max, no free top-off" rule
      // already used by applyLevelUps. Note: this covers only the turn-schema
      // `stat_grant` path — the Equipment source (item `stat_bonus`, §5.1c)
      // has no equip system to hang off yet and isn't implemented.
      let grantedPlayer = upkeepPlayer
      // Guard against a schema-valid but incomplete grant (no `amount` —
      // the field isn't marked required) doing `x + undefined = NaN`, which
      // nothing downstream catches: Math.min/max(NaN, ...) is always NaN, so
      // it silently poisons hp/hpMax forever once saved. A missing/invalid
      // amount is treated as no grant at all, not a corrupt one.
      const grantAmount = Number.isFinite(turn.stat_grant?.amount) ? turn.stat_grant!.amount : 0
      if (turn.stat_grant && grantAmount > 0) {
        const grant = turn.stat_grant
        if (grant.attr) {
          const nextAttrs = { ...grantedPlayer.attrs, [grant.attr]: grantedPlayer.attrs[grant.attr] + grantAmount }
          const pools = derivedPools(nextAttrs)
          grantedPlayer = {
            ...grantedPlayer,
            attrs: nextAttrs,
            hpMax: pools.hpMax,
            hp: Math.min(pools.hpMax, grantedPlayer.hp + (pools.hpMax - grantedPlayer.hpMax)),
            mpMax: pools.mpMax,
            mp: Math.min(pools.mpMax, grantedPlayer.mp + (pools.mpMax - grantedPlayer.mpMax)),
            stMax: pools.stMax,
            st: Math.min(pools.stMax, grantedPlayer.st + (pools.stMax - grantedPlayer.stMax)),
          }
        } else if (grant.pool) {
          const maxKey = `${grant.pool}Max` as 'hpMax' | 'mpMax' | 'stMax'
          grantedPlayer = { ...grantedPlayer, [maxKey]: grantedPlayer[maxKey] + grantAmount, [grant.pool]: grantedPlayer[grant.pool] + grantAmount }
        }
      }

      // Defensive final clamp — belt-and-suspenders on top of applyTurn's own
      // clamping (§3.2 requires hp/mp/st always stay within [0, max]): every
      // individual mutation above already clamps correctly in isolation, but
      // this guarantees the invariant holds regardless of which path ran,
      // rather than trusting each one to compose correctly forever.
      // Math.min/max(NaN, x) is always NaN, so a genuinely NaN max or current
      // value (from any future bug, not just the stat_grant one already
      // guarded above) falls back to the attribute-derived base pool — full,
      // not zero — rather than silently passing NaN through as if clamped.
      const basePools = derivedPools(grantedPlayer.attrs)
      const safeHpMax = Number.isFinite(grantedPlayer.hpMax) ? grantedPlayer.hpMax : basePools.hpMax
      const safeMpMax = Number.isFinite(grantedPlayer.mpMax) ? grantedPlayer.mpMax : basePools.mpMax
      const safeStMax = Number.isFinite(grantedPlayer.stMax) ? grantedPlayer.stMax : basePools.stMax
      const finalPlayer: Player = {
        ...grantedPlayer,
        hpMax: safeHpMax,
        mpMax: safeMpMax,
        stMax: safeStMax,
        hp: Number.isFinite(grantedPlayer.hp) ? Math.max(0, Math.min(safeHpMax, grantedPlayer.hp)) : safeHpMax,
        mp: Number.isFinite(grantedPlayer.mp) ? Math.max(0, Math.min(safeMpMax, grantedPlayer.mp)) : safeMpMax,
        st: Number.isFinite(grantedPlayer.st) ? Math.max(0, Math.min(safeStMax, grantedPlayer.st)) : safeStMax,
      }

      const nextCampaign: Campaign = {
        ...current,
        player: finalPlayer,
        minions: upkeep.minions,
        corpses: nextCorpses,
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
        log: [
          ...current.log,
          {
            action: actionText,
            nar: turn.nar,
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
            ...(reveals.revealed.length ? { discoveries: reveals.revealed } : {}),
            ...(classEvolution ? { classEvolution } : {}),
            ...(craftResolution.completed.length
              ? { craftReady: craftResolution.completed.map((c) => ({ recipeName: c.recipe.name, outputId: c.recipe.output.id, outputQty: c.recipe.output.qty })) }
              : {}),
            ...(upkeep.dissipated.length ? { minionsDissipated: upkeep.dissipated } : {}),
          },
        ],
      }

      setGame(nextCampaign)
      const historyWithResponse: HistoryTurn[] = [...newHistory, { role: 'model', parts: [{ text: result.raw }] }]
      setHistory(historyWithResponse)

      // §5.7 Player Defeat State — chains into its own resolution turn once
      // the fatal blow itself is committed, rather than leaving the player
      // stuck at 0 HP with nothing to do.
      if (playerDefeated) resolveDefeat(nextCampaign, historyWithResponse)

      // §2 Phase E Chapter Milestone — same boundary trigger as the
      // chapter-level-up above; the recap call reads historyWithResponse
      // (this turn included) before the sliding window gets flushed.
      if (chapterLevels > 0) {
        recapChapter(historyWithResponse, Math.floor(turnNumber / CHAPTER_TURN_INTERVAL))
      }
    } catch (err) {
      setError(`The thread of fate falters... (${errorMessage(err)})`)
    } finally {
      setBusy(false)
    }
  }

  // §5.7 — a fixed defeat context, no further damage math left to the model;
  // the client owns the recovery HP/currency outright, Gemini only narrates it.
  async function resolveDefeat(campaign: Campaign, baseHistory: HistoryTurn[]) {
    setBusy(true)
    const defeatAction =
      '[SYSTEM: The protagonist has just fallen (HP reached 0). Narrate a brief DESPAIR-tier resolution: they wake, injured but alive, at the nearest safe location. This is a soft-fail recovery beat, not a continuation of the fight — do not narrate death.]'

    const contextSlice = buildContextSlice(campaign)
    const userTurnText = `${contextSlice}\n\nPlayer Action: ${defeatAction}`
    const newHistory: HistoryTurn[] = [...baseHistory, { role: 'user', parts: [{ text: userTurnText }] }]

    const restoredHp = Math.round(campaign.player.hpMax * DEFEAT_HP_RESTORE_FRACTION)
    const penalizedCopper = Math.max(0, Math.round(campaign.player.copper * (1 - DEFEAT_CURRENCY_PENALTY_FRACTION)))

    try {
      const result = await getProvider(apiSettings.provider).runTurn({
        apiKey: apiSettings.apiKey,
        model: apiSettings.model,
        temperature: apiSettings.temperature,
        maxOutputTokens: campaign.proseDepth.maxOutputTokens,
        history: newHistory,
      })

      const nar = result.ok ? result.turn!.nar : (result.fallbackText ?? 'Consciousness returns slowly, aching but alive.')
      const nextPlayer = {
        ...campaign.player,
        hp: restoredHp,
        copper: penalizedCopper,
        ...(result.ok && result.turn!.loc_id ? { locId: result.turn!.loc_id, locDisp: result.turn!.loc_disp } : {}),
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
      setHistory([...newHistory, { role: 'model', parts: [{ text: result.raw }] }])
    } catch (err) {
      setError(`The thread of fate falters... (${errorMessage(err)})`)
    } finally {
      setBusy(false)
    }
  }

  // §2 Phase E Chapter Milestone — plain-text 2-sentence recap, then flush
  // the sliding history window: "past conversation turns are flushed... while
  // persistent summary cards are saved locally." A missed recap costs only
  // flavor (the log entry), so failures are swallowed rather than surfaced —
  // the window keeps growing and the next boundary just retries.
  async function recapChapter(historyForSummary: HistoryTurn[], chapterNumber: number) {
    try {
      const summary = await getProvider(apiSettings.provider).runSummary({
        apiKey: apiSettings.apiKey,
        model: apiSettings.model,
        temperature: apiSettings.temperature,
        maxOutputTokens: MAX_OUTPUT_TOKENS_CEILING,
        history: historyForSummary,
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
    dictKey: 'npcs' | 'factions' | 'locations' | 'lore' | 'quests' | 'bestiary' | 'skills',
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
      const result = unequipSlot(g.player, g.items ?? {}, slot)
      return result.error ? g : { ...g, player: result.player }
    })
  }

  function updateWorld(patch: Partial<WorldData>) {
    setGame((g) => g && { ...g, world: { ...g.world, ...patch } })
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
  // bangCommands.ts, they mutate real state (MP, inventory, corpses,
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
        corpses: outcome.patch?.corpses ?? g.corpses,
        inventory: outcome.patch?.inventory ?? g.inventory,
        player: outcome.patch?.playerMp !== undefined ? { ...g.player, mp: outcome.patch.playerMp } : g.player,
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
      const result = unequipSlot(g.player, items, slot)
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
    const world = worldId ? worlds[worldId] : findDefault(worlds)
    const protagonist = protagonistId ? protagonists[protagonistId] : findDefault(protagonists)
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
          if (!(await confirm('Delete this Protagonist template?'))) return
          setProtagonists((p) => {
            const next = { ...p }
            delete next[id]
            return next
          })
        }}
        onOpenSettings={() => openSettings()}
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
  } else if (screen === 'storymode') {
    content = (
      <StoryMode onBack={() => goBack('mainmenu')} onSelectOriginal={() => navigateTo('worldsetup')} />
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
      />
    )
  } else if (screen === 'talebrief' && pendingWorld && pendingProtagonist) {
    content = (
      <TaleBrief
        initialOpening={pendingProtagonist.opening}
        initialNarrationStyle={pendingWorld.narrationStyle}
        initialTemperature={apiSettings.temperature}
        editLongText={editLongText}
        onBack={() => goBack('newgame')}
        onBegin={({ opening, narrationStyle, temperature, combatMode }) => {
          setApiSettings((a) => ({ ...a, temperature }))
          beginCampaign({ ...pendingProtagonist, opening }, combatMode, { narrationStyle })
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
        lore={game.lore}
        quests={game.quests}
        bestiary={game.bestiary}
        flags={game.flags}
        inventory={game.inventory}
        items={game.items ?? {}}
        crafting={game.crafting ?? []}
        onUpdateNpc={(id: string, patch: Partial<NpcEntry> | null) => patchCodexDict('npcs', id, patch as Record<string, unknown> | null)}
        onUpdateFaction={(id: string, patch: Partial<FactionEntry> | null) => patchCodexDict('factions', id, patch as Record<string, unknown> | null)}
        onUpdateLocation={(id: string, patch: Partial<LocationEntry> | null) => patchCodexDict('locations', id, patch as Record<string, unknown> | null)}
        onUpdateLore={(id: string, patch: Partial<LoreEntry> | null) => patchCodexDict('lore', id, patch as Record<string, unknown> | null)}
        onUpdateQuest={(id: string, patch: Partial<QuestEntry> | null) => patchCodexDict('quests', id, patch as Record<string, unknown> | null)}
        onUpdateBestiary={(id: string, patch: Partial<BestiaryEntry> | null) => patchCodexDict('bestiary', id, patch as Record<string, unknown> | null)}
        skills={game.skills ?? {}}
        onUpdateSkill={(id: string, patch: Partial<SkillEntry> | null) => patchCodexDict('skills', id, patch as Record<string, unknown> | null)}
        onUpdateItem={updateItem}
        onEquipItem={equipFromCodex}
        onUnequipSlot={unequipFromCodex}
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

  // §6.0 Motion System — cross-fade + slight vertical slide between screens.
  return (
    <>
      <AnimatePresence mode="wait">
        <motion.div
          key={screen}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.2 }}
        >
          {content}
        </motion.div>
      </AnimatePresence>

      {/* Now Playing Playlist Banner on top of screen */}
      <NowPlayingBanner
        track={currentTrack}
        visible={bannerVisible}
        muted={musicMuted}
        onDismiss={dismissBanner}
      />

      {/* Overlay, not a screen — the screen underneath stays mounted and
          visible through the modal's glass. */}
      {settingsOpen && (
        <Settings
          apiSettings={apiSettings}
          uiPrefs={uiPrefs}
          game={game}
          musicMuted={musicMuted}
          onToggleMusicMute={toggleMusicMute}
          onBack={closeSettings}
          onSave={({ apiSettings: nextApi, uiPrefs: nextUi, proseDepthKey, combatMode }: SettingsSavePayload) => {
            setApiSettings(nextApi)
            setUiPrefs(nextUi)
            if (game) {
              setGame((g) => g && { ...g, proseDepth: PROSE_DEPTHS[proseDepthKey], combatMode })
            }
            closeSettings()
          }}
          onExportActive={() => game && saveJSON(`${game.title}.json`, game)}
          onBackupAll={() =>
            saveJSON('tale-dives-backup.json', {
              schemaVersion: CURRENT_SCHEMA_VERSION,
              worlds,
              protagonists,
              campaigns,
              apiSettings: { ...apiSettings, apiKey: undefined },
            })
          }
          onImportJson={async (file: File) => {
            try {
              const data = await readJSONFile(file)
              if (data.worlds || data.protagonists || data.campaigns) {
                setWorlds((w) => ({ ...w, ...(data.worlds ?? {}) }))
                setProtagonists((p) => ({ ...p, ...(data.protagonists ?? {}) }))
                setCampaigns((c) => ({ ...c, ...(data.campaigns ?? {}) }))
              } else if (data.player && data.log) {
                const id = data.id ?? store.newId('campaign')
                setCampaigns((c) => ({
                  ...c,
                  [id]: { schemaVersion: CURRENT_SCHEMA_VERSION, ...data, id, lastPlayed: Date.now() },
                }))
              }
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
      )}

      {slashManagerOpen && game && (
        <SlashCommandManager
          campaignCommands={game.slashCommands ?? {}}
          globalCommands={globalSlashCommands}
          onSave={upsertSlashCommand}
          onDelete={deleteSlashCommand}
          onClose={closeSlashManager}
        />
      )}

      {confirmDialog}
      {longTextDialog}
    </>
  )
}
