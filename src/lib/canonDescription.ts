import type { ApiSettings } from '../types.ts'
import { getProvider } from '../api/providers/index.ts'

// §7 Image Generation, Lore Accuracy — resolves a copyrighted-name-free,
// image-prompt-ready description for an NPC portrait or location image, when
// the campaign's world names real source material (WorldData.sourceTitle +
// sourceScope — see types.ts's own comment on why sourceScope specifically
// is the gate). This is a text-only call through the existing one-shot
// runSeed provider method (same call shape as worldSeedContract.ts/
// taleWeaverContract.ts), never the image model itself: the character or
// location's proper name and the source work's title are deliberately never
// passed to image generation — only the physical/environmental description
// this produces is, since a bare name is both a more likely automated-filter
// trigger and adds nothing an image model can reliably render from a book
// character anyway (unlike a screen adaptation, there's no consistent visual
// training data tied to the name).
//
// Continuity matters as much as accuracy here: a second call for the same
// entity (a later portrait after in-story development) passes the entity's
// own previously-resolved description back in as `existingDescription` and
// is instructed to preserve it almost verbatim, changing only what
// `developmentNote` actually asks for — otherwise every regeneration would
// be free to reinterpret the character/place from scratch and visual
// continuity would break turn to turn. This does NOT reference prior
// generated image bytes (the pipeline is text-to-image only, no image input)
// — continuity is carried entirely as accumulated description text.

export interface CanonDescriptionSourceMaterial {
  title?: string
  author?: string
  scope?: string
}

export interface ResolveCanonDescriptionInput {
  apiSettings: ApiSettings
  kind: 'character' | 'location'
  name: string
  role?: string // character's role, e.g. "Rival Cadet" — ignored for kind: 'location'
  currentNotes?: string // whatever freeform appearance/description text already exists on the entity
  existingDescription?: string // this entity's own previously-resolved canon description, if any
  developmentNote?: string // optional player-supplied "what's changed" note for a later regeneration
  source: CanonDescriptionSourceMaterial
}

function buildSystemInstructions(kind: 'character' | 'location'): string {
  const subject = kind === 'character' ? 'a character' : 'a location'
  const visualAspect = kind === 'character' ? 'physical appearance — build, face, hair, attire, bearing, expression' : 'environment — architecture, terrain, lighting, atmosphere, notable features'

  return `
You produce a single ${visualAspect} description of ${subject} for a Tale Dives campaign, written
so it can be fed directly into an image generator. Output ONLY the description paragraph itself —
no preamble, no headers, no markdown, no quotation marks around it.

Never include this ${subject === 'a character' ? "character's" : "location's"} proper name, and
never name or quote the title of the source material, anywhere in your output — the description
must stand on its own as pure visual detail. This is deliberate: the name and title are known to
you only as context for accuracy, never as something to pass on to whatever reads your output next.

If an "Established description" is given below, that is this same entity's own prior resolved
description — preserve it almost entirely (same build, features, attire, palette, defining visual
traits) and change ONLY what the "What's changed" note specifically asks for. Do not redesign the
subject from scratch; a reader comparing the old and new description should recognize continuity,
not a different subject wearing the same name.

If no established description is given and source material is named below, ground the description
in that source's actual canon, accurate up to the stated scope boundary — correct build, features,
attire, and bearing as the work itself establishes them. If you are not genuinely confident of a
specific canon visual detail, invent a plausible original one rather than guessing wrong, and never
let an invented detail contradict something the source actually establishes. If this ${subject}
does not actually correspond to anything in the named source (an original addition to the
campaign), simply write a clean, vivid description from the given notes instead — do not force a
false canon connection.
`.trim()
}

function buildPrompt(input: ResolveCanonDescriptionInput): string {
  const lines: string[] = []
  const label = input.kind === 'character' ? input.role ? `Character, role: ${input.role}` : 'Character' : 'Location'
  lines.push(label)

  if (input.source.title?.trim()) {
    const attribution = input.source.author?.trim() ? `"${input.source.title.trim()}" by ${input.source.author.trim()}` : `"${input.source.title.trim()}"`
    lines.push(`Source material: ${attribution}${input.source.scope?.trim() ? ` — canon scope boundary: ${input.source.scope.trim()}` : ' — no scope boundary given, treat only broad public facts as safe'}`)
  }
  if (input.currentNotes?.trim()) {
    lines.push(`Existing freeform notes (may be incomplete or non-visual): ${input.currentNotes.trim()}`)
  }
  if (input.existingDescription?.trim()) {
    lines.push(`Established description (preserve this, changing only what's below): ${input.existingDescription.trim()}`)
  }
  lines.push(`What's changed (optional, only apply if given): ${input.developmentNote?.trim() || '(nothing specified — describe as currently established)'}`)

  // The subject's real name/title are given last, clearly labeled as
  // context-only — the system instructions above already forbid echoing
  // either back into the output.
  lines.push(`(Context only, do not repeat in your output) Name: ${input.name}`)

  return lines.join('\n')
}

export async function resolveCanonDescription(input: ResolveCanonDescriptionInput): Promise<string> {
  const raw = await getProvider(input.apiSettings.provider).runSeed({
    apiKey: input.apiSettings.apiKey,
    model: input.apiSettings.model,
    temperature: input.apiSettings.temperature,
    maxOutputTokens: 512,
    systemInstructions: buildSystemInstructions(input.kind),
    prompt: buildPrompt(input),
  })
  return raw.trim().replace(/^["'\s]+|["'\s]+$/g, '')
}
