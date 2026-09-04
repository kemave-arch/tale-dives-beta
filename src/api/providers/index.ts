import { GEMINI_PROVIDER } from './gemini.ts'
import type { Provider } from './types.ts'

export type { Provider, ProviderCapabilities, ProviderModel, RunSummaryParams, RunTurnParams } from './types.ts'

// §3.4 — the production app is provider-agnostic: every call (turn
// narration, chapter summaries, and eventually Class Grounding/Inspired
// Mode) routes through whichever provider the player picked in API
// Settings. Gemini is the only real implementation today — adding a
// second provider is a matter of writing one adapter module matching
// the Provider interface (types.ts) and registering it here.
export const PROVIDERS: Record<string, Provider> = {
  gemini: GEMINI_PROVIDER,
}

export const DEFAULT_PROVIDER_ID = 'gemini'

// Falls back to the default provider for an unrecognized id (a save from
// before a provider was removed, or a typo) rather than throwing.
export function getProvider(id: string): Provider {
  return PROVIDERS[id] ?? PROVIDERS[DEFAULT_PROVIDER_ID]
}

export function allProviders(): Provider[] {
  return Object.values(PROVIDERS)
}
