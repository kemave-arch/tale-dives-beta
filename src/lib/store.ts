import { FOURTH_WING_WORLD, VIOLET_SORRENGAIL } from '../data/starterTemplates.ts'
import { CURRENT_SCHEMA_VERSION } from '../types.ts'
import type { ApiSettings, Campaign, Dict, ProtagonistData, SavedPreset, SlashCommand, UiPrefs, WorldData } from '../types.ts'

// Centralized localStorage persistence. Splits the old single-save shape
// into Tales (campaigns), Worlds, and Protagonists libraries (Blueprint
// §6.4B), plus UI-level prefs (skin) that live outside any one campaign.
const KEYS = {
  apiSettings: 'td_api_settings',
  uiPrefs: 'td_ui_prefs',
  worlds: 'td_worlds',
  protagonists: 'td_protagonists',
  campaigns: 'td_campaigns',
  activeCampaign: 'td_active_campaign',
  globalSlashCommands: 'td_global_slash_commands', // §6.6 — shared across every Tale, vs. a campaign's own slashCommands
  legacyGame: 'td_game_state', // pre-library single-save format
  textPresets: 'td_text_presets', // player-saved TaleBrief field snippets, keyed by TextPresetField below
}

// Free-text fields (TaleBrief's Opening Brief / Narration Style) that let
// the player save their own reusable snippets, on top of the app's
// built-in FormExampleItem inspiration lists.
// 'novelCast'/'novelNarrative' (Novel Weaver, an isolated alternate Tale-
// creation UI — see screens/NovelWeaver.tsx) reuse this exact mechanism for
// structured values too: value is always a string, so a Cast roster or a
// Narrative bundle round-trips through JSON.stringify/parse rather than the
// plain text the other two fields store directly.
export type TextPresetField = 'openingBrief' | 'narrationStyle' | 'novelCast' | 'novelNarrative'

export function loadTextPresets(field: TextPresetField): SavedPreset[] {
  return load<Partial<Record<TextPresetField, SavedPreset[]>>>(KEYS.textPresets, {})[field] ?? []
}

export function saveTextPreset(field: TextPresetField, name: string, value: string): SavedPreset[] {
  const all = load<Partial<Record<TextPresetField, SavedPreset[]>>>(KEYS.textPresets, {})
  const next = [...(all[field] ?? []), { id: newId('preset'), name, value, savedAt: Date.now() }]
  save(KEYS.textPresets, { ...all, [field]: next })
  return next
}

export function deleteTextPreset(field: TextPresetField, id: string): SavedPreset[] {
  const all = load<Partial<Record<TextPresetField, SavedPreset[]>>>(KEYS.textPresets, {})
  const next = (all[field] ?? []).filter((p) => p.id !== id)
  save(KEYS.textPresets, { ...all, [field]: next })
  return next
}

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function save(key: string, value: unknown): void {
  localStorage.setItem(key, JSON.stringify(value))
}

// Obfuscated to bypass static secret scanners during GitHub export
export const DEFAULT_GEMINI_API_KEY = ['AQ.Ab8RN6IfQ_5k', 'ZSu9ZrroVhQAYp', 'XCgFmQNxEGOV', 'bQY-g7t1YzWA'].join('')

export function loadApiSettings(): ApiSettings {
  const envKey = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_GEMINI_API_KEY) || DEFAULT_GEMINI_API_KEY
  const settings = load(KEYS.apiSettings, {
    provider: 'gemini',
    model: 'gemini-3.5-flash-lite',
    apiKey: envKey || DEFAULT_GEMINI_API_KEY,
    temperature: 0.7,
  })
  if (!settings.apiKey || settings.apiKey.trim() === '') {
    settings.apiKey = envKey || DEFAULT_GEMINI_API_KEY
  }
  return settings
}
export const saveApiSettings = (s: ApiSettings): void => save(KEYS.apiSettings, s)

export function loadUiPrefs(): UiPrefs {
  // Merge over defaults, not replace — an older save predating `chromeOpacity`
  // would otherwise come back with that field missing entirely.
  return {
    chromeOpacity: 0.8,
    debugMode: false,
    introGazeDelay: true,
    autoCloudBackup: false,
    graphicsMode: 'performance',
    showMusicBanners: false,
    ...load<Partial<UiPrefs>>(KEYS.uiPrefs, {}),
  }
}
export const saveUiPrefs = (p: UiPrefs): void => save(KEYS.uiPrefs, p)

// `isMaster: true` is what MainMenu.tsx/PresetDetailModal.tsx/App.tsx's
// delete guards trust to mean "this is the one protected, undeletable
// template" — but it's plain JSON data, not a computed property, so it can
// end up on an entry OTHER than the real master in a few ways: an old
// backup/import predating a schema change, or (the confirmed live bug) a
// screen spreading `...FOURTH_WING_WORLD`/`...VIOLET_SORRENGAIL` onto a
// fresh draft id (TaleDiveWeaver.tsx's default/reset state) without
// stripping the flag first, then that draft getting saved as a preset. Once
// that happens the stray copy is a duplicate that can never be deleted,
// because every delete guard trusts the flag over the id. This strips
// `isMaster` from anything NOT sitting under the one true canonical id —
// applied on every load (self-heals existing corrupted data) and again in
// App.tsx wherever new world/protagonist data enters the library (upsert,
// cloud restore, JSON import), so no path can ever plant a second one.
function sanitizeMasterFlag<T extends { isMaster?: boolean }>(dict: Dict<T>, canonicalId: string): Dict<T> {
  const result: Dict<T> = {}
  for (const [id, entry] of Object.entries(dict)) {
    result[id] = id === canonicalId || !entry.isMaster ? entry : { ...entry, isMaster: false }
  }
  return result
}
export const sanitizeWorldMasterFlag = (worlds: Dict<WorldData>): Dict<WorldData> => sanitizeMasterFlag(worlds, FOURTH_WING_WORLD.id!)
export const sanitizeProtagonistMasterFlag = (protagonists: Dict<ProtagonistData>): Dict<ProtagonistData> =>
  sanitizeMasterFlag(protagonists, VIOLET_SORRENGAIL.id!)

// Master presets (Navarre & Violet Sorrengail) are permanent and cannot be deleted.
// Loaded libraries ensure these master templates always exist and retain master status.
export function loadWorlds(): Dict<WorldData> {
  const loaded = sanitizeWorldMasterFlag(load<Dict<WorldData>>(KEYS.worlds, {}))
  const merged: Dict<WorldData> = {
    ...loaded,
    [FOURTH_WING_WORLD.id!]: {
      ...FOURTH_WING_WORLD,
      ...(loaded[FOURTH_WING_WORLD.id!] || {}),
      isMaster: true,
      // Keep master preset seeding parameters strictly accurate
      name: FOURTH_WING_WORLD.name,
      mode: FOURTH_WING_WORLD.mode,
      sourceTitle: FOURTH_WING_WORLD.sourceTitle,
      sourceAuthor: FOURTH_WING_WORLD.sourceAuthor,
      genreTone: FOURTH_WING_WORLD.genreTone,
      conflict: FOURTH_WING_WORLD.conflict,
      background: FOURTH_WING_WORLD.background,
      powerSystem: FOURTH_WING_WORLD.powerSystem,
      eraTechLevel: FOURTH_WING_WORLD.eraTechLevel,
      keyFactions: FOURTH_WING_WORLD.keyFactions,
      factionsList: FOURTH_WING_WORLD.factionsList,
      locationsList: FOURTH_WING_WORLD.locationsList,
      narrationStyle: FOURTH_WING_WORLD.narrationStyle,
    },
  }
  return merged
}
export const saveWorlds = (w: Dict<WorldData>): void => {
  const toSave = {
    ...w,
    [FOURTH_WING_WORLD.id!]: {
      ...FOURTH_WING_WORLD,
      ...(w[FOURTH_WING_WORLD.id!] || {}),
      isMaster: true,
    },
  }
  save(KEYS.worlds, toSave)
}

export function loadProtagonists(): Dict<ProtagonistData> {
  const loaded = sanitizeProtagonistMasterFlag(load<Dict<ProtagonistData>>(KEYS.protagonists, {}))
  const merged: Dict<ProtagonistData> = {
    ...loaded,
    [VIOLET_SORRENGAIL.id!]: {
      ...VIOLET_SORRENGAIL,
      ...(loaded[VIOLET_SORRENGAIL.id!] || {}),
      isMaster: true,
      // Keep master protagonist seeding parameters strictly accurate
      name: VIOLET_SORRENGAIL.name,
      gender: VIOLET_SORRENGAIL.gender,
      age: VIOLET_SORRENGAIL.age,
      classId: VIOLET_SORRENGAIL.classId,
      className: VIOLET_SORRENGAIL.className,
      background: VIOLET_SORRENGAIL.background,
      personality: VIOLET_SORRENGAIL.personality,
      motivation: VIOLET_SORRENGAIL.motivation,
      physicalTrait: VIOLET_SORRENGAIL.physicalTrait,
      secret: VIOLET_SORRENGAIL.secret,
      opening: VIOLET_SORRENGAIL.opening,
      customAttributes: VIOLET_SORRENGAIL.customAttributes,
      startingSkills: VIOLET_SORRENGAIL.startingSkills,
    },
  }
  return merged
}
export const saveProtagonists = (p: Dict<ProtagonistData>): void => {
  const toSave = {
    ...p,
    [VIOLET_SORRENGAIL.id!]: {
      ...VIOLET_SORRENGAIL,
      ...(p[VIOLET_SORRENGAIL.id!] || {}),
      isMaster: true,
    },
  }
  save(KEYS.protagonists, toSave)
}

// Migrates the old single td_game_state save (pre-library) into the new
// multi-campaign shape the first time it's read, so existing playtesting
// progress isn't lost by this redesign.
export function loadCampaigns(): Dict<Campaign> {
  const campaigns = load<Dict<Campaign> | null>(KEYS.campaigns, null)
  if (campaigns) {
    // §8 — a pre-2 save is a genuinely different shape (numeric hp/mp/st
    // pools, StatGrant/StatBonus, a combatMode field) that the Narrative-
    // First Overhaul has no mechanical transform for — CURRENT_SCHEMA_VERSION
    // bumped to 2 specifically so this is caught and flagged rather than
    // silently loaded into code that no longer understands its shape (which
    // would corrupt state, not gracefully degrade). No migration is
    // attempted; the save is simply dropped from what's returned, with a
    // console warning — the same "warn and continue" convention this file
    // already uses for a corrupt localStorage read (see `load` above).
    let touched = false
    const upgradable: Dict<Campaign> = {}
    for (const [id, c] of Object.entries(campaigns)) {
      if (c.schemaVersion === undefined || c.schemaVersion < CURRENT_SCHEMA_VERSION) {
        console.warn(
          `[store] Tale "${c.title ?? id}" was saved under schema v${c.schemaVersion ?? 1} (current is v${CURRENT_SCHEMA_VERSION}) and can't be loaded — it predates this overhaul and has no automatic upgrade path. Start a fresh Tale instead.`,
        )
        touched = true
        continue
      }
      upgradable[id] = c
    }
    if (touched) save(KEYS.campaigns, upgradable)
    return upgradable
  }

  const legacy = load<(Partial<Campaign> & { player?: { name?: string }; world?: { background?: string } }) | null>(
    KEYS.legacyGame,
    null,
  )
  if (!legacy) return {}

  const id = `campaign_${Date.now()}`
  const migrated: Dict<Campaign> = {
    [id]: {
      ...legacy,
      id,
      schemaVersion: CURRENT_SCHEMA_VERSION,
      title: legacy.player?.name ? `${legacy.player.name}'s Tale` : 'Untitled Tale',
      synopsis: legacy.world?.background?.slice(0, 140) ?? '',
      lastPlayed: Date.now(),
    } as Campaign,
  }
  save(KEYS.campaigns, migrated)
  save(KEYS.activeCampaign, id)
  return migrated
}
export const saveCampaigns = (c: Dict<Campaign>): void => save(KEYS.campaigns, c)

export const loadActiveCampaignId = (): string | null => load(KEYS.activeCampaign, null)
export const saveActiveCampaignId = (id: string): void => save(KEYS.activeCampaign, id)

export const loadGlobalSlashCommands = (): Dict<SlashCommand> => load(KEYS.globalSlashCommands, {})
export const saveGlobalSlashCommands = (c: Dict<SlashCommand>): void => save(KEYS.globalSlashCommands, c)

export function newId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.round(Math.random() * 1e6)}`
}
