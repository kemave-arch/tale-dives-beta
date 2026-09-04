import { FOURTH_WING_WORLD, VIOLET_SORRENGAIL } from '../data/starterTemplates.ts'
import { CURRENT_SCHEMA_VERSION } from '../types.ts'
import type { ApiSettings, Campaign, Dict, ProtagonistData, SlashCommand, UiPrefs, WorldData } from '../types.ts'

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

export function loadApiSettings(): ApiSettings {
  const envKey = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_GEMINI_API_KEY) || ''
  const settings = load(KEYS.apiSettings, { provider: 'gemini', model: 'gemini-3.1-flash-lite', apiKey: envKey, temperature: 0.7 })
  if (!settings.apiKey && envKey) {
    settings.apiKey = envKey
  }
  return settings
}
export const saveApiSettings = (s: ApiSettings): void => save(KEYS.apiSettings, s)

export function loadUiPrefs(): UiPrefs {
  // Merge over defaults, not replace — an older save predating `chromeOpacity`
  // would otherwise come back with that field missing entirely.
  return { chromeOpacity: 0.8, debugMode: false, introGazeDelay: true, ...load<Partial<UiPrefs>>(KEYS.uiPrefs, {}) }
}
export const saveUiPrefs = (p: UiPrefs): void => save(KEYS.uiPrefs, p)

// Seeded once, only on a genuinely first-ever load (the raw key has never
// been written) — so there's a real, rich example to try immediately instead
// of a blank Library, but deleting it afterward is respected like any other
// entry rather than being silently re-seeded on the next load.
export function loadWorlds(): Dict<WorldData> {
  if (localStorage.getItem(KEYS.worlds) === null) {
    const seeded: Dict<WorldData> = { [FOURTH_WING_WORLD.id!]: FOURTH_WING_WORLD }
    save(KEYS.worlds, seeded)
    return seeded
  }
  return load(KEYS.worlds, {})
}
export const saveWorlds = (w: Dict<WorldData>): void => save(KEYS.worlds, w)

export function loadProtagonists(): Dict<ProtagonistData> {
  if (localStorage.getItem(KEYS.protagonists) === null) {
    const seeded: Dict<ProtagonistData> = { [VIOLET_SORRENGAIL.id!]: VIOLET_SORRENGAIL }
    save(KEYS.protagonists, seeded)
    return seeded
  }
  return load(KEYS.protagonists, {})
}
export const saveProtagonists = (p: Dict<ProtagonistData>): void => save(KEYS.protagonists, p)

// Migrates the old single td_game_state save (pre-library) into the new
// multi-campaign shape the first time it's read, so existing playtesting
// progress isn't lost by this redesign.
export function loadCampaigns(): Dict<Campaign> {
  const campaigns = load<Dict<Campaign> | null>(KEYS.campaigns, null)
  if (campaigns) {
    // §8 — backfill campaigns saved before schemaVersion existed, so the
    // field is universally present going forward rather than only on ones
    // created after this was added.
    let touched = false
    for (const c of Object.values(campaigns)) {
      if (c.schemaVersion === undefined) {
        c.schemaVersion = CURRENT_SCHEMA_VERSION
        touched = true
      }
    }
    if (touched) save(KEYS.campaigns, campaigns)
    return campaigns
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
