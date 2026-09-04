import type { HistoryTurn, RunTurnResult } from '../../types.ts'

// §3.4 — capability flags reflect what *this client's* adapter for a given
// provider actually does today, not that provider's raw platform ceiling.
// Nothing consumes these yet (no feature here needs grounding/streaming/
// prompt caching), but they exist so a future feature (e.g. Inspired
// Mode's grounded world-seeding call) can degrade gracefully per-provider
// instead of assuming every provider behaves like Gemini.
export interface ProviderCapabilities {
  supportsGrounding: boolean
  supportsJsonSchema: boolean
  supportsStreaming: boolean
  supportsPromptCaching: boolean
}

export interface ProviderModel {
  id: string
  label: string
}

export interface RunTurnParams {
  apiKey: string
  model: string
  temperature: number
  maxOutputTokens: number
  history: HistoryTurn[]
}

export interface RunSummaryParams {
  apiKey: string
  model: string
  temperature: number
  maxOutputTokens: number
  history: HistoryTurn[]
}

// One config, every call type (§3.4) — Turn narration, Chapter Milestone
// summaries, and (eventually) Class Grounding/Inspired Mode world seeding
// all read from whichever Provider the player picked in API Settings.
export interface Provider {
  id: string
  label: string
  models: ProviderModel[]
  capabilities: ProviderCapabilities
  runTurn: (params: RunTurnParams) => Promise<RunTurnResult>
  runSummary: (params: RunSummaryParams) => Promise<string>
}
