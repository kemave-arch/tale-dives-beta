import type { ApiSettings, AreaEntry } from '../types.ts'
import { getProvider } from '../api/providers/index.ts'
import { buildTaleWeaverSystemInstructions } from '../api/taleWeaverContract.ts'
import { MAX_OUTPUT_TOKENS_CEILING } from '../api/turnContract.ts'
import { slugify } from './slug.ts'
import { parseTaleWeaverResponse, type TaleWeaverDraft } from './taleWeaverParser.ts'

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
  { id: 'lore', label: 'Lore & Secrets', prompt: 'Describe the history, myths, or secrets woven into this world.' },
  { id: 'arc', label: 'Story Arc', prompt: 'Describe the shape of the story you want — key story beats, possible complications or events, and death/end-game stakes.' },
]

// Everything confirmed so far, across every phase — re-sent in full on
// every later phase's call so the model never contradicts or duplicates
// earlier work (same "no chat history, client resends what matters"
// design as worldSeedContract.ts's own one-shot call).
export interface TaleWeaverAccumulated {
  world?: TaleWeaverDraft['world']
  protagonist?: TaleWeaverDraft['protagonist']
  regions: TaleWeaverDraft['regions']
  locations: TaleWeaverDraft['locations']
  factions: TaleWeaverDraft['factions']
  npcs: TaleWeaverDraft['npcs']
  lore: TaleWeaverDraft['lore']
  beats: TaleWeaverDraft['beats']
  narrativeEvents?: TaleWeaverDraft['narrativeEvents']
  deathRule?: TaleWeaverDraft['deathRule']
  deathInstructions?: TaleWeaverDraft['deathInstructions']
  endGameRules?: TaleWeaverDraft['endGameRules']
}

export function emptyAccumulated(): TaleWeaverAccumulated {
  return { regions: [], locations: [], factions: [], npcs: [], lore: [], beats: [], narrativeEvents: [] }
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
      `Confirmed Protagonist: ${[p.name, p.background, p.personality, p.motivation, p.physicalTrait, p.secret, p.opening].filter(Boolean).join(' | ')}`,
    )
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

export interface RunTaleWeaverPhaseInput {
  apiSettings: ApiSettings
  phase: TaleWeaverPhaseDef
  accumulated: TaleWeaverAccumulated
  guidance: string
}

export interface RunTaleWeaverPhaseResult {
  ok: boolean
  draft?: TaleWeaverDraft
  error?: string
}

export async function runTaleWeaverPhase(input: RunTaleWeaverPhaseInput): Promise<RunTaleWeaverPhaseResult> {
  const prompt = buildPhasePrompt(input.phase, input.accumulated, input.guidance)
  try {
    const raw = await getProvider(input.apiSettings.provider).runSeed({
      apiKey: input.apiSettings.apiKey,
      model: input.apiSettings.model,
      temperature: input.apiSettings.temperature,
      maxOutputTokens: MAX_OUTPUT_TOKENS_CEILING,
      systemInstructions: buildTaleWeaverSystemInstructions(
        input.accumulated.world?.sourceTitle
          ? {
              title: input.accumulated.world.sourceTitle,
              author: input.accumulated.world.sourceAuthor,
              scope: input.accumulated.world.sourceScope,
            }
          : undefined,
      ),
      prompt,
    })
    return { ok: true, draft: parseTaleWeaverResponse(raw) }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}
