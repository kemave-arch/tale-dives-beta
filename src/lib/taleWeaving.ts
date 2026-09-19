import type { ApiSettings, AreaEntry, NarrationMode, Pov, TaleDifficultyKey } from '../types.ts'
import { getProvider } from '../api/providers/index.ts'
import { buildTaleWeaverSystemInstructions } from '../api/taleWeaverContract.ts'
import { MAX_OUTPUT_TOKENS_CEILING } from '../api/turnContract.ts'
import { slugify } from './slug.ts'
import { parseTaleWeaverResponse, type TaleWeaverDraft, type TaleWeaverSkill } from './taleWeaverParser.ts'
import type { WeaverLlmOverride } from './weaverLlmOverride.ts'

// Same comma-separated-names shape as an item's "traits" or world seeding's
// own <location areas="...">  — each name mints its own slug id so Codex
// CRUD later has something stable to key an edit against.
export function parseTaleWeaverDraftAreas(areas: string | undefined): AreaEntry[] | undefined {
  if (!areas?.trim()) return undefined
  const names = areas.split(',').map((n) => n.trim()).filter(Boolean)
  return names.length ? names.map((name) => ({ id: slugify(name), name })) : undefined
}

// Inspired Mode's "Tale Weaving" flow — a phased, conversational alternative
// to Original Mode's hand-typed forms. Each phase is its own one-shot call
// (no chat history — see taleWeaverContract.ts's own header comment for why
// that's sufficient here), given everything already confirmed in earlier
// phases plus the player's own free-text guidance for the phase now active.
// Never throws past this call site's own try/catch in the screen — a failed
// or malformed generation is the player's cue to just try again, not a
// broken flow.

export interface TaleWeaverPhaseDef {
  id: 'world' | 'protagonist' | 'regions' | 'factions' | 'npcs' | 'lore' | 'arc'
  label: string
  prompt: string // shown to the player as this phase's own guidance question
}

export const TALE_WEAVER_PHASES: TaleWeaverPhaseDef[] = [
  { id: 'world', label: 'World Foundation', prompt: 'Describe the kind of world you want — genre, tone, the core conflict, how power or magic works, the era.' },
  { id: 'protagonist', label: 'Protagonist', prompt: 'Describe who you want to play — their background, personality, motivation, a physical trait, a secret, and how the story should open.' },
  { id: 'regions', label: 'Regions & Locations', prompt: 'Describe the places this Tale moves through — broad regions and the specific locations within them.' },
  { id: 'factions', label: 'Factions', prompt: 'Describe the powers and groups that shape this world.' },
  { id: 'npcs', label: 'Cast of Characters', prompt: 'Describe who the protagonist already knows, or will soon meet.' },
  { id: 'lore', label: 'Secrets', prompt: 'Describe the history, myths, or secrets woven into this world.' },
  { id: 'arc', label: 'Story Arc', prompt: 'Describe the shape of the story you want — key story beats, possible complications or events, and death/end-game stakes.' },
]

// Everything confirmed so far, across every phase — re-sent in full on
// every later phase's call so the model never contradicts or duplicates
// earlier work (same "no chat history, client resends what matters"
// design as worldSeedContract.ts's own one-shot call).
export interface TaleWeaverAccumulated {
  // Player-set Tale title, editable from the very first phase (header field).
  // Falls back to "${player.name}'s Tale" at creation time (App.tsx's
  // beginInspiredTale) when left blank, same as before this field existed.
  title?: string
  world?: TaleWeaverDraft['world']
  protagonist?: TaleWeaverDraft['protagonist']
  regions: TaleWeaverDraft['regions']
  locations: TaleWeaverDraft['locations']
  factions: TaleWeaverDraft['factions']
  npcs: TaleWeaverDraft['npcs']
  lore: TaleWeaverDraft['lore']
  // Starting abilities drafted alongside the Protagonist phase's own
  // <protagonist> tag — see App.tsx's beginInspiredTale for how classHint +
  // this list seed the new campaign's player.classId/className and
  // campaign.skills, closing the gap where a Tale Weaving-created
  // protagonist used to always start abilityless on a hardcoded class.
  skills: TaleWeaverSkill[]
  beats: TaleWeaverDraft['beats']
  narrativeEvents?: TaleWeaverDraft['narrativeEvents']
  deathRule?: TaleWeaverDraft['deathRule']
  deathInstructions?: TaleWeaverDraft['deathInstructions']
  endGameRules?: TaleWeaverDraft['endGameRules']
  // Narrative Settings — plain player-preference fields, never AI-parsed
  // (no XML grammar/parser change needed for these three; see
  // taleWeaverContract.ts's own header comment on what this flow does vs.
  // doesn't ask the model to draft). Set via inline controls in the Story
  // Arc phase screen (TaleWeaver.tsx).
  pov?: Pov
  narrationMode?: NarrationMode
  difficulty?: TaleDifficultyKey
}

export function emptyAccumulated(): TaleWeaverAccumulated {
  return {
    regions: [], locations: [], factions: [], npcs: [], lore: [], skills: [], beats: [], narrativeEvents: [],
    // Story Arc phase's own pre-selected defaults — Immersive per explicit
    // request, Extreme as the tagged "Recommended" tier for Tale Weaving
    // specifically (other creation paths stay on Balanced, see App.tsx).
    pov: 'third',
    narrationMode: 'immersive',
    difficulty: 'EXTREME',
  }
}

function buildPhasePrompt(phase: TaleWeaverPhaseDef, accumulated: TaleWeaverAccumulated, guidance: string): string {
  const lines: string[] = [`Active Phase: ${phase.label}`]

  if (accumulated.world) {
    const w = accumulated.world
    lines.push(
      `Confirmed World: ${[w.name, w.genreTone, w.conflict, w.powerSystem, w.eraTechLevel, w.keyFactions, w.background].filter(Boolean).join(' | ')}`,
    )
    if (w.sourceTitle?.trim()) {
      lines.push(
        `Source Material: "${w.sourceTitle.trim()}"${w.sourceAuthor?.trim() ? ` by ${w.sourceAuthor.trim()}` : ''}${w.sourceScope?.trim() ? ` — canon scope: ${w.sourceScope.trim()}` : ' — no canon scope given, treat only broad public facts as safe'}`,
      )
    }
  }
  if (accumulated.protagonist) {
    const p = accumulated.protagonist
    lines.push(
      `Confirmed Protagonist: ${[p.name, p.background, p.personality, p.motivation, p.physicalTrait, p.secret, p.opening, p.classHint && `Class: ${p.classHint}`].filter(Boolean).join(' | ')}`,
    )
  }
  if (accumulated.skills.length > 0) {
    lines.push(`Confirmed Starting Skills: ${accumulated.skills.map((s) => s.name).join(', ')}`)
  }
  if (accumulated.regions.length > 0) {
    lines.push(`Confirmed Regions: ${accumulated.regions.map((r) => r.name).join(', ')}`)
  }
  if (accumulated.locations.length > 0) {
    lines.push(`Confirmed Locations: ${accumulated.locations.map((l) => l.name).join(', ')}`)
  }
  if (accumulated.factions.length > 0) {
    lines.push(`Confirmed Factions: ${accumulated.factions.map((f) => f.name).join(', ')}`)
  }
  if (accumulated.npcs.length > 0) {
    lines.push(`Confirmed NPCs: ${accumulated.npcs.map((n) => n.name).join(', ')}`)
  }
  if (accumulated.lore.length > 0) {
    lines.push(`Confirmed Lore: ${accumulated.lore.map((l) => l.name).join(', ')}`)
  }
  if (accumulated.beats.length > 0) {
    lines.push(`Confirmed Story Beats (in order): ${accumulated.beats.map((b) => b.title).join(' -> ')}`)
  }

  lines.push(`Player's guidance for this phase: ${guidance.trim() || '(no specific guidance given — use your best judgment, grounded in everything confirmed above)'}`)
  return lines.join('\n')
}

// Folds one phase's freshly generated draft into the accumulated whole —
// shared by both Tale Weaving creation flows (the full 7-phase screen and
// Quick Play's 3-question screen) so a merge behavior fixed in one place
// (e.g. "Source Material fields are player-typed, never overwritten") never
// drifts between the two. World/Protagonist are whole-entity replacements;
// every other phase accumulates new entries alongside what's already there,
// deduping by id so a regenerated round doesn't create doubles.
export function mergeTaleWeaverDraft(
  prev: TaleWeaverAccumulated,
  phaseId: TaleWeaverPhaseDef['id'],
  draft: TaleWeaverDraft,
): TaleWeaverAccumulated {
  if (phaseId === 'world' && draft.world) {
    return {
      ...prev,
      world: {
        ...draft.world,
        sourceTitle: prev.world?.sourceTitle,
        sourceAuthor: prev.world?.sourceAuthor,
        sourceScope: prev.world?.sourceScope,
        sourceAccurate: prev.world?.sourceAccurate,
      },
    }
  }
  if (phaseId === 'protagonist' && draft.protagonist) {
    return { ...prev, protagonist: draft.protagonist, skills: draft.skills }
  }

  const next = { ...prev }
  if (draft.regions.length) {
    next.regions = [...prev.regions.filter((r) => !draft.regions.some((d) => d.id === r.id)), ...draft.regions]
  }
  if (draft.locations.length) {
    next.locations = [...prev.locations.filter((l) => !draft.locations.some((d) => d.id === l.id)), ...draft.locations]
  }
  if (draft.factions.length) {
    next.factions = [...prev.factions.filter((f) => !draft.factions.some((d) => d.id === f.id)), ...draft.factions]
  }
  if (draft.npcs.length) {
    next.npcs = [...prev.npcs.filter((n) => !draft.npcs.some((d) => d.id === n.id)), ...draft.npcs]
  }
  if (draft.lore.length) {
    next.lore = [...prev.lore.filter((l) => !draft.lore.some((d) => d.id === l.id)), ...draft.lore]
  }
  if (draft.beats.length) {
    next.beats = [...prev.beats.filter((b) => !draft.beats.some((d) => d.id === b.id)), ...draft.beats]
  }
  if (draft.narrativeEvents.length) {
    const prevEvents = prev.narrativeEvents ?? []
    next.narrativeEvents = [...prevEvents.filter((e) => !draft.narrativeEvents.some((d) => d.id === e.id)), ...draft.narrativeEvents]
  }
  if (draft.deathRule) next.deathRule = draft.deathRule
  if (draft.deathInstructions) next.deathInstructions = draft.deathInstructions
  if (draft.endGameRules) next.endGameRules = { ...prev.endGameRules, ...draft.endGameRules }
  return next
}

export interface RunTaleWeaverPhaseInput {
  apiSettings: ApiSettings
  phase: TaleWeaverPhaseDef
  accumulated: TaleWeaverAccumulated
  guidance: string
  // Tale Weaving's own manual model/key override (weaverLlmOverride.ts) —
  // the last-resort tier in FALLBACK_MODELS below, set via the "LLM" button
  // in the Tale Weaving screens. Absent for a player who's never opened it.
  weaverOverride?: WeaverLlmOverride
}

export interface RunTaleWeaverPhaseResult {
  ok: boolean
  draft?: TaleWeaverDraft
  error?: string
}

// Tale Weaving (both the full 7-phase flow and Quick Play) fires a burst of
// calls in quick succession that all share the same large system prompt —
// exactly what Gemini's implicit caching targets. gemini-3.5-flash-lite
// doesn't appear to get implicit caching in live testing (three identical
// ~12k-token calls, zero cache hits); the non-lite flash tiers do. So every
// Tale Weaving phase call defaults to gemini-3.6-flash rather than whatever
// the player's own configured model is (this matters most for a player
// who's downgraded to flash-lite for cost on ordinary gameplay turns).
//
// The app's own built-in key (store.ts's DEFAULT_GEMINI_API_KEY) carries a
// tight shared free-tier quota, PER MODEL (live-observed: "limit: 20,
// model: gemini-3.5-flash, please retry in ~20s") — every player weaving a
// Tale draws from the same pool. So a 429 on the first model tries a
// *different* model next (its own separate quota bucket), not just a
// delayed retry of the same one:
//   1. gemini-3.6-flash, using the player's own configured apiKey
//   2. gemini-3.5-flash, same apiKey, only if (1) failed
//   3. the player's manually-set Tale Weaving override (model + apiKey via
//      the "LLM" button) if set, falling back to their own Settings
//      model+apiKey otherwise — only if (1) and (2) both failed
// Skips a tier that would be an exact duplicate (same model AND same key)
// of one already tried, so a player who hasn't set an override — or whose
// Settings model already IS one of the two flash tiers — never fires the
// same failing request twice in a row.
const FALLBACK_MODELS = ['gemini-3.6-flash', 'gemini-3.5-flash']

interface AttemptTarget {
  model: string
  apiKey: string
}

function buildFallbackChain(apiSettings: ApiSettings, override?: WeaverLlmOverride): AttemptTarget[] {
  const chain: AttemptTarget[] = FALLBACK_MODELS.map((model) => ({ model, apiKey: apiSettings.apiKey }))
  chain.push({
    model: override?.model || apiSettings.model,
    apiKey: override?.apiKey || apiSettings.apiKey,
  })
  return chain.filter((target, i) => chain.findIndex((t) => t.model === target.model && t.apiKey === target.apiKey) === i)
}

// Gemini's own free-tier quota error is a wall of text (rate-limit doc
// links, the exact metric name, a "retry in Ns" countdown) that means
// nothing to a player and shouldn't be showing up styled as a normal error
// message. Detected by HTTP status (429, reliable) with a message-text
// fallback for a provider/error shape that doesn't surface status cleanly.
function isQuotaError(status: number | undefined, message: string | undefined): boolean {
  if (status === 429) return true
  return /quota|rate.?limit|resource_exhausted|too many requests/i.test(message ?? '')
}

function friendlyPhaseError(status: number | undefined, message: string | undefined): string {
  if (isQuotaError(status, message)) {
    return "The built-in model's free usage limit is exhausted right now. Tap the LLM button above to add your own Gemini API key (or pick a different model) and try again."
  }
  return message ?? 'Unknown error'
}

export async function runTaleWeaverPhase(input: RunTaleWeaverPhaseInput): Promise<RunTaleWeaverPhaseResult> {
  const prompt = buildPhasePrompt(input.phase, input.accumulated, input.guidance)
  const systemInstructions = buildTaleWeaverSystemInstructions(
    // Source Accurate defaults on — undefined (no toggle touched yet, or
    // an old save/preset predating it) reads as on, so this only ever
    // suppresses the contract when explicitly unchecked.
    input.accumulated.world?.sourceTitle && input.accumulated.world.sourceAccurate !== false
      ? {
          title: input.accumulated.world.sourceTitle,
          author: input.accumulated.world.sourceAuthor,
          scope: input.accumulated.world.sourceScope,
        }
      : undefined,
  )

  const chain = buildFallbackChain(input.apiSettings, input.weaverOverride)
  let lastStatus: number | undefined
  let lastMessage: string | undefined

  for (const target of chain) {
    try {
      const raw = await getProvider(input.apiSettings.provider).runSeed({
        apiKey: target.apiKey,
        model: target.model,
        temperature: input.apiSettings.temperature,
        maxOutputTokens: MAX_OUTPUT_TOKENS_CEILING,
        systemInstructions,
        prompt,
      })
      return { ok: true, draft: parseTaleWeaverResponse(raw) }
    } catch (err) {
      lastStatus = err instanceof Error && 'status' in err ? (err as Error & { status?: number }).status : undefined
      lastMessage = err instanceof Error ? err.message : String(err)
    }
  }

  return { ok: false, error: friendlyPhaseError(lastStatus, lastMessage) }
}
