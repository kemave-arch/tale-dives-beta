// Tale Weaving's own model/key override — separate from the player's main
// API Settings (store.ts's ApiSettings) on purpose. Weaving fires a burst
// of calls in quick succession against the app's shared built-in key
// (store.ts's DEFAULT_GEMINI_API_KEY), which has its own tight free-tier
// quota per model (observed live: "limit: 20, model: gemini-3.5-flash").
// This lets a player plug in their OWN key — with its own separate quota —
// as a last-resort fallback specifically for weaving, without touching
// their ordinary-gameplay model choice in Settings.
export interface WeaverLlmOverride {
  model?: string
  apiKey?: string
}

const KEY = 'td_weaver_llm_override_v1'

export function loadWeaverLlmOverride(): WeaverLlmOverride {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

export function saveWeaverLlmOverride(v: WeaverLlmOverride): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(v))
  } catch {
    // Best-effort — a failed save just means the override doesn't persist
    // across a reload; the in-memory value for this session still works.
  }
}
