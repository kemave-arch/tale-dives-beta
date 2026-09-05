// Gemini provider adapter — Blueprint §7.1 (call shape) and §3.3 (self-healing pipeline).
import { buildXmlSystemInstructions } from '../xmlTurnContract.ts'
import { decodeXmlEntities, parseXmlTurnResponse } from '../../lib/xmlTurnParser.ts'
import type { GameTime, HistoryTurn, RunTurnResult } from '../../types.ts'
import type { Provider } from './types.ts'

const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models'

export class GeminiApiError extends Error {
  status?: number
}

// Stage 1 (Regex Sanitizer): strip markdown fences before parsing. Kept
// distinct from the pre-2026-09-05 JSON-specific `sanitize` (trailing-comma
// cleanup doesn't apply to XML) — that function no longer has a live caller
// now runTurn parses XML, but App.tsx's Edit Turn CRUD still needs its exact
// JSON-tolerant behavior for saves with a pre-migration (JSON) rawPayload,
// so it stays exported rather than being deleted out from under old saves.
export function sanitize(raw: string): string {
  return raw
    .trim()
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/, '')
    .replace(/,\s*([}\]])/g, '$1')
    .trim()
}

function sanitizeXml(raw: string): string {
  return raw
    .trim()
    .replace(/^```(?:xml)?/i, '')
    .replace(/```$/, '')
    .trim()
}

// Stage 3 (Fallback Reader) — §3.3: "extracts pure prose and renders it
// directly," not the raw XML blob, when <sync> is malformed or missing.
// Tries the closed <nar>...</nar> pair first; if a response got cut off
// mid-generation (MAX_TOKENS) before the closing tag ever arrived, falls
// back to everything after the opening tag instead of yielding nothing.
function extractXmlNarrative(raw: string): string | null {
  const closed = raw.match(/<nar>([\s\S]*?)<\/nar>/)
  if (closed) return decodeXmlEntities(closed[1].trim()) || null
  const openOnly = raw.match(/<nar>([\s\S]*)$/)
  if (openOnly) return decodeXmlEntities(openOnly[1].trim()) || null
  return null
}

interface RequestParams {
  apiKey: string
  model: string
  temperature: number
  maxOutputTokens: number
  history: HistoryTurn[]
}

// Gemini's non-Lite Flash and Pro models run extended "thinking" by default,
// billed against the same maxOutputTokens budget as the visible narration —
// the working theory behind the live MAX_TOKENS truncations users have been
// hitting on BALANCED/IMMERSIVE turns well under their nominal ceiling.
// Disabling it frees the whole budget for prose. Flash-Lite variants default
// thinking off already (no override needed); 2.0-generation models predate
// thinking entirely and don't accept `thinkingConfig` at all, so neither
// gets this override. If a future Pro model rejects `thinkingBudget: 0`
// (some require a nonzero minimum), that'll surface as a 400 on every turn —
// worth checking for if a "3.1-pro-preview" turn errors out after this change.
function thinkingBudgetOverride(model: string): { thinkingConfig: { thinkingBudget: number } } | Record<string, never> {
  const hasThinkingByDefault = !model.includes('flash-lite') && !model.startsWith('gemini-2.0')
  return hasThinkingByDefault ? { thinkingConfig: { thinkingBudget: 0 } } : {}
}

interface RawResponse {
  text: string
  finishReason?: string
}

async function requestOnce({ apiKey, model, temperature, maxOutputTokens, history }: RequestParams): Promise<RawResponse> {
  // Key goes in a header, not the URL — keeps it out of browser history and network logs.
  const url = `${BASE_URL}/${encodeURIComponent(model)}:generateContent`

  // 2026-09-05: migrated off responseMimeType/responseSchema's JSON-schema
  // structured output — a live token benchmark (PROJECT_REVISION_NOTES.md)
  // showed the equivalent compact XML <sync> block (xmlTurnContract.ts) at
  // ~25% fewer output tokens for the same turn. This trades the API's own
  // schema validation for our own XML parser's validation (xmlTurnParser.ts)
  // — the self-healing pipeline below (Stage 2/3) exists precisely because
  // that trade isn't free.
  const body = {
    system_instruction: { parts: [{ text: buildXmlSystemInstructions() }] },
    contents: history,
    generationConfig: {
      temperature,
      maxOutputTokens,
      ...thinkingBudgetOverride(model),
    },
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}))
    const message = errBody?.error?.message ?? `HTTP ${res.status}`
    const err = new GeminiApiError(message)
    err.status = res.status
    throw err
  }

  const data = await res.json()
  const finishReason = data?.candidates?.[0]?.finishReason
  const text = data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? '').join('') ?? ''

  return { text, finishReason }
}

// Stage 0: one silent retry on request failure (§3.3).
export async function runTurn({ apiKey, model, temperature, maxOutputTokens, history }: RequestParams): Promise<RunTurnResult> {
  let lastError: unknown
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const { text, finishReason } = await requestOnce({ apiKey, model, temperature, maxOutputTokens, history })
      const cleaned = sanitizeXml(text)

      try {
        // Stage 2 (XML Parser)
        return { ok: true, turn: parseXmlTurnResponse(cleaned), finishReason, raw: text }
      } catch {
        // Stage 3 (Fallback Reader): surface the narrative prose rather than losing
        // the turn — extracted <nar> text if possible, only the raw blob as a last
        // resort. A malformed <sync> block (bad attribute, mismatched tag) still
        // throws here even when <nar> itself parsed fine, so this catches both
        // "no <nar> at all" and "nar fine, sync broken" the same way the old
        // JSON path's catch-all did.
        return { ok: false, fallbackText: extractXmlNarrative(text) ?? cleaned ?? text, finishReason, raw: text }
      }
    } catch (err) {
      lastError = err
    }
  }
  throw lastError
}

interface SummaryParams {
  apiKey: string
  model: string
  temperature: number
  maxOutputTokens: number
  history: HistoryTurn[]
  startTime?: GameTime
  endTime?: GameTime
}

function formatGameTime(t: GameTime): string {
  return `Day ${t.d} ${t.h}`
}

// §2 Phase E Chapter Milestone — a plain-text (not JSON-schema) follow-up
// call over the same conversation history, asking for a rich recap.
// Deliberately its own request rather than folding a summary field into
// TURN_SCHEMA (§3.6: every field but `nar` stays a compact mechanism, and a
// chapter summary is prose that only exists once every ~15 turns — it isn't
// worth carrying on every single turn's schema).
// Widened from a terse 2-sentence/200-token cap to a full narrated recap
// (2026-09-04, alongside the IMMERSIVE prose-depth increase), then handed
// the caller's own ceiling (2026-09-04, MAX_OUTPUT_TOKENS_CEILING from
// turnContract.ts — a recap happens rarely enough that the cost tradeoff
// IMMERSIVE was tuned for doesn't apply) so chapter breaks read like a real
// novel's "previously..." passage instead of a mechanical plot-point list,
// without getting cut off mid-paragraph.
export async function runSummary({ apiKey, model, temperature, maxOutputTokens, history, startTime, endTime }: SummaryParams): Promise<string> {
  const url = `${BASE_URL}/${encodeURIComponent(model)}:generateContent`

  // Grounds the recap against inflating a real few-hour span into
  // saga-length prose ("a grueling ascent," "days of hardship") — the exact
  // drift a live payload surfaced. Omitted (rather than a vague fallback)
  // when either bound couldn't be resolved, so the base instruction still
  // works for an older save with no time-stamped turns.
  const timeSpanNote =
    startTime && endTime
      ? ` This chapter's events span real story-time from ${formatGameTime(startTime)} to ${formatGameTime(endTime)} — that is the ONLY time that has passed. Keep the recap's implied pacing honest to that span; do not describe it as spanning more time than it actually did (no "days later," "weeks of hardship," etc.) unless the span above genuinely covers that much time.`
      : ''

  const body = {
    contents: [
      ...history,
      {
        role: 'user',
        parts: [
          {
            text: `Write a rich, narrated recap of this chapter of the story so far — several full paragraphs, third person, past tense, in the same evocative prose style as the narration itself. Cover major plot developments, emotional turns, and standout moments, not just a bare list of events.${timeSpanNote} Output ONLY the recap prose — no preamble, no headings, no markdown.`,
          },
        ],
      },
    ],
    generationConfig: { temperature, maxOutputTokens, ...thinkingBudgetOverride(model) },
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}))
    throw new GeminiApiError(errBody?.error?.message ?? `HTTP ${res.status}`)
  }

  const data = await res.json()
  const text = data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? '').join('') ?? ''
  return text.trim()
}

// §3.4 — the single source of truth for Gemini's model list; Settings.tsx
// reads this rather than keeping its own copy now that the provider
// registry (api/providers/index.ts) exists.
export const GEMINI_MODELS: import('./types.ts').ProviderModel[] = [
  { id: 'gemini-3.8-flash', label: 'Gemini 3.8 Flash' },
  { id: 'gemini-3.7-flash', label: 'Gemini 3.7 Flash' },
  { id: 'gemini-3.6-flash', label: 'Gemini 3.6 Flash' },
  { id: 'gemini-3.5-flash', label: 'Gemini 3.5 Flash' },
  { id: 'gemini-3.5-flash-lite', label: 'Gemini 3.5 Flash Lite' },
  { id: 'gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro Preview' },
  { id: 'gemini-3.1-flash-lite', label: 'Gemini 3.1 Flash Lite' },
  { id: 'gemini-3-flash-preview', label: 'Gemini 3 Flash Preview' },
]

// Capability flags reflect what this adapter actually does today — not
// Gemini-the-platform's full ceiling. supportsJsonSchema flipped to false
// 2026-09-05: runTurn moved off responseMimeType/responseSchema onto a
// free-text XML grammar (xmlTurnContract.ts) for a real, measured ~25%
// output-token reduction — see PROJECT_REVISION_NOTES.md.
export const GEMINI_PROVIDER: Provider = {
  id: 'gemini',
  label: 'Google Gemini',
  models: GEMINI_MODELS,
  capabilities: { supportsGrounding: false, supportsJsonSchema: false, supportsStreaming: false, supportsPromptCaching: false },
  runTurn,
  runSummary,
}
