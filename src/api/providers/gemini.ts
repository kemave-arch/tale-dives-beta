// Gemini provider adapter — Blueprint §7.1 (call shape) and §3.3 (self-healing pipeline).
import { SYSTEM_INSTRUCTIONS, TURN_SCHEMA } from '../turnContract.ts'
import type { HistoryTurn, RunTurnResult } from '../../types.ts'
import type { Provider } from './types.ts'

const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models'

export class GeminiApiError extends Error {
  status?: number
}

// Stage 1 (Regex Sanitizer): strip markdown fences / trailing commas before parsing.
function sanitize(raw: string): string {
  return raw
    .trim()
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/, '')
    .replace(/,\s*([}\]])/g, '$1')
    .trim()
}

const NAR_ESCAPES: Record<string, string> = { n: '\n', t: '\t', r: '\r', '"': '"', '\\': '\\', '/': '/' }

// Stage 3 (Fallback Reader) helper — §3.3: "extracts pure prose between quotes
// and renders it directly," not the raw JSON blob. Walks the "nar" field's
// string content by hand (rather than a single regex) so a response cut off
// mid-string by MAX_TOKENS still yields whatever prose made it out.
function extractNarrative(raw: string): string | null {
  const match = raw.match(/"nar"\s*:\s*"/)
  if (!match || match.index === undefined) return null

  let result = ''
  for (let i = match.index + match[0].length; i < raw.length; i++) {
    const ch = raw[i]
    if (ch === '"') break // unescaped closing quote — end of the field
    if (ch === '\\') {
      const next = raw[i + 1]
      if (next === 'u') {
        result += String.fromCharCode(parseInt(raw.slice(i + 2, i + 6), 16))
        i += 5
      } else {
        result += NAR_ESCAPES[next] ?? next
        i += 1
      }
      continue
    }
    result += ch
  }
  return result || null
}

interface RequestParams {
  apiKey: string
  model: string
  temperature: number
  maxOutputTokens: number
  history: HistoryTurn[]
}

interface RawResponse {
  text: string
  finishReason?: string
}

async function requestOnce({ apiKey, model, temperature, maxOutputTokens, history }: RequestParams): Promise<RawResponse> {
  // Key goes in a header, not the URL — keeps it out of browser history and network logs.
  const url = `${BASE_URL}/${encodeURIComponent(model)}:generateContent`

  const body = {
    system_instruction: { parts: [{ text: SYSTEM_INSTRUCTIONS }] },
    contents: history,
    generationConfig: {
      temperature,
      maxOutputTokens,
      responseMimeType: 'application/json',
      responseSchema: TURN_SCHEMA,
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
      const cleaned = sanitize(text)

      try {
        // Stage 2 (Schema Parser)
        return { ok: true, turn: JSON.parse(cleaned), finishReason, raw: text }
      } catch {
        // Stage 3 (Fallback Reader): surface the narrative prose rather than losing
        // the turn — extracted "nar" text if possible, only the raw blob as a last resort.
        return { ok: false, fallbackText: extractNarrative(text) ?? cleaned ?? text, finishReason, raw: text }
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
  history: HistoryTurn[]
}

// §2 Phase E Chapter Milestone — a plain-text (not JSON-schema) follow-up
// call over the same conversation history, asking for a rich recap.
// Deliberately its own request rather than folding a summary field into
// TURN_SCHEMA (§3.6: every field but `nar` stays a compact mechanism, and a
// chapter summary is prose that only exists once every ~15 turns — it isn't
// worth carrying on every single turn's schema).
// Widened from a terse 2-sentence/200-token cap to a full narrated recap
// (2026-09-04, alongside the IMMERSIVE prose-depth increase) so chapter
// breaks read like a real novel's "previously..." passage instead of a
// mechanical plot-point list.
export async function runSummary({ apiKey, model, temperature, history }: SummaryParams): Promise<string> {
  const url = `${BASE_URL}/${encodeURIComponent(model)}:generateContent`

  const body = {
    contents: [
      ...history,
      {
        role: 'user',
        parts: [
          {
            text: 'Write a rich, narrated recap of this chapter of the story so far — several full paragraphs, third person, past tense, in the same evocative prose style as the narration itself. Cover major plot developments, emotional turns, and standout moments, not just a bare list of events. Output ONLY the recap prose — no preamble, no headings, no markdown.',
          },
        ],
      },
    ],
    generationConfig: { temperature, maxOutputTokens: 3072 },
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

// Capability flags reflect what this adapter actually does today (only
// JSON-schema structured output is wired up) — not Gemini-the-platform's
// full ceiling. See types.ts's Provider doc comment.
export const GEMINI_PROVIDER: Provider = {
  id: 'gemini',
  label: 'Google Gemini',
  models: GEMINI_MODELS,
  capabilities: { supportsGrounding: false, supportsJsonSchema: true, supportsStreaming: false, supportsPromptCaching: false },
  runTurn,
  runSummary,
}
