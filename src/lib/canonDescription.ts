import type { ApiSettings } from '../types.ts'
import { getProvider } from '../api/providers/index.ts'
import { parseXmlBlock, str, XmlParseError } from './xmlHelpers.ts'

// §7 Image Generation, Lore Accuracy — resolves a canon-accurate,
// image-prompt-ready description for an NPC portrait or location image, when
// the campaign's world names real source material (WorldData.sourceTitle +
// sourceScope — see types.ts's own comment on why sourceScope specifically
// is the gate). This is a text-only call through the existing one-shot
// runSeed provider method (same call shape as worldSeedContract.ts/
// taleWeaverContract.ts), never the image model itself.
//
// This resolution step is NOT about hiding the character/location's real
// name or the source title from the image model — quite the opposite: the
// real name and a direct citation of the source material (title/author/
// scope) are deliberately passed straight into the final image prompt
// (see imageGeneration.ts's canonReferenceLine), because live testing showed
// gemini-3.1-flash-lite-image doesn't refuse direct references to existing
// novels/characters, and a name-redacted description produced portraits that
// were noticeably far from actual canon — the image model has its own
// trained visual association with a named, real work that a paraphrased
// description throws away. What THIS step is for is (a) pulling out the
// specific canon visual facts (build, coloring, features, attire) so the
// image prompt has concrete detail to work from instead of just a name, and
// (b) continuity across regenerations — see below.
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

function sourceLine(source: CanonDescriptionSourceMaterial): string | undefined {
  if (!source.title?.trim()) return undefined
  const attribution = source.author?.trim() ? `"${source.title.trim()}" by ${source.author.trim()}` : `"${source.title.trim()}"`
  return `Source material: ${attribution}${source.scope?.trim() ? ` — canon scope boundary: ${source.scope.trim()}` : ' — no scope boundary given, treat only broad public facts as safe'}`
}

// ---- kind: 'character' — a fixed slot template, not free prose -----------
//
// A single freeform paragraph left real gaps in practice (a model would
// happily describe attire and mood while skipping eye color or hair
// entirely). Naming the slots explicitly is what actually gets consistent
// coverage — the same discipline this app already uses for narration state
// (fixed XML tags/attributes, never an LLM free-writing structure). The
// slots are assembled into the final prose paragraph client-side, in a
// fixed, predictable order — so formatting is always consistent even though
// the model only ever fills in short fragments.

export interface NpcVisualFields {
  gender?: string
  age?: string
  skinTone?: string
  hair?: string
  eyes?: string
  mouth?: string
  otherFeatures?: string // scars, tattoos, jaw/brow shape, anything else facial not covered above
  build?: string
  attire?: string
  status?: string // point-in-story visual state — "currently: ...", scoped to canon timeline or in-game session
}

function buildNpcVisualSystemInstructions(): string {
  return `
You fill in a fixed set of short visual-description slots for a Tale Dives character portrait, so
the result can be assembled into an image-generation prompt. Output ONLY one <visual><npc_visual
.../></visual> block, nothing else — no preamble, no markdown, no prose outside the tags.

Each attribute should be a short, concrete fragment (a few words), not a full sentence — think
"amber, slightly hooded" for eyes, not "Her eyes were a striking shade of amber." Fill in every
attribute; never leave one blank.

LORE ACCURACY IS THE TOP PRIORITY for every slot: when source material is named below, ground each
attribute in that source's actual canon, accurate up to the stated scope boundary. Only when no
genuine canon detail exists for a slot (or no source material is named at all) should you invent a
plausible original detail instead — inventing is the fallback, never the first move, and an
invented detail must never contradict something the source actually establishes.

"status" is the point in the story or in-game session this portrait should reflect — e.g. "early in
first-year training, before her injury" or "present day, after months in the field, more weathered."
Ground this in whatever timeline context you're given; if none, describe them as currently
established.

If an "Established description" is given below, that is this same character's own prior resolved
appearance — it was itself assembled from these same slots, so infer each slot's prior value from
it and carry that value across UNCHANGED unless the "What's changed" note specifically calls for a
different value in that exact slot. Do not redesign the character; a reader comparing the old and
new fields should see the same person, with only the requested change applied.

This character's real name is given below — use it to ground your search for the actual canon
appearance; nothing here needs to be redacted or paraphrased.
`.trim()
}

function buildNpcVisualPrompt(input: ResolveCanonDescriptionInput): string {
  const lines: string[] = [input.role ? `Character, role: ${input.role}` : 'Character']
  const src = sourceLine(input.source)
  if (src) lines.push(src)
  if (input.currentNotes?.trim()) lines.push(`Existing freeform notes (may be incomplete or non-visual): ${input.currentNotes.trim()}`)
  if (input.existingDescription?.trim()) lines.push(`Established description (preserve this, changing only what's below): ${input.existingDescription.trim()}`)
  lines.push(`What's changed (optional, only apply if given): ${input.developmentNote?.trim() || '(nothing specified — describe as currently established)'}`)
  lines.push(`Name: ${input.name}`)
  return lines.join('\n')
}

// This app never round-trips assembled prose back into structured
// attributes — continuity across regenerations relies on the model itself
// inferring consistent slot values from `existingDescription` (see the
// system instructions above), not on the client parsing its own previous
// output back apart.
function parseNpcVisualFields(raw: string): NpcVisualFields {
  let doc
  try {
    doc = parseXmlBlock(raw, 'visual')
  } catch (err) {
    throw new XmlParseError(`Could not parse NPC visual fields: ${err instanceof Error ? err.message : String(err)}`)
  }
  const el = doc.querySelector('npc_visual')
  if (!el) throw new XmlParseError('No <npc_visual> tag found in response')
  return {
    gender: str(el.getAttribute('gender')),
    age: str(el.getAttribute('age')),
    skinTone: str(el.getAttribute('skin_tone')),
    hair: str(el.getAttribute('hair')),
    eyes: str(el.getAttribute('eyes')),
    mouth: str(el.getAttribute('mouth')),
    otherFeatures: str(el.getAttribute('other_features')),
    build: str(el.getAttribute('build')),
    attire: str(el.getAttribute('attire')),
    status: str(el.getAttribute('status')),
  }
}

function formatNpcVisualDescription(fields: NpcVisualFields): string {
  const facial = [
    fields.eyes && `eyes: ${fields.eyes}`,
    fields.mouth && `mouth: ${fields.mouth}`,
    fields.otherFeatures,
  ].filter(Boolean).join('; ')

  return [
    [fields.gender, fields.age].filter(Boolean).join(', '),
    fields.skinTone && `${fields.skinTone} skin`,
    fields.hair && `${fields.hair} hair`,
    facial && `Face — ${facial}.`,
    fields.build,
    fields.attire && `Wearing ${fields.attire}.`,
    fields.status && `Currently: ${fields.status}.`,
  ].filter(Boolean).join(' ').trim()
}

// ---- kind: 'location' — unchanged freeform paragraph ----------------------

function buildLocationSystemInstructions(): string {
  return `
You produce a single environment description — architecture, terrain, lighting, atmosphere, notable
features — of a location for a Tale Dives campaign, written so it can be fed directly into an image
generator. Output ONLY the description paragraph itself — no preamble, no headers, no markdown, no
quotation marks around it.

If an "Established description" is given below, that is this same location's own prior resolved
description — preserve it almost entirely (same architecture, palette, defining visual traits) and
change ONLY what the "What's changed" note specifically asks for. Do not redesign the place from
scratch; a reader comparing the old and new description should recognize continuity, not a
different place sharing the same name.

If no established description is given and source material is named below, ground the description
in that source's actual canon, accurate up to the stated scope boundary. If you are not genuinely
confident of a specific canon visual detail, invent a plausible original one rather than guessing
wrong, and never let an invented detail contradict something the source actually establishes. If
this location does not actually correspond to anything in the named source (an original addition
to the campaign), simply write a clean, vivid description from the given notes instead — do not
force a false canon connection.

You may name this location and reference the source material directly if it helps ground a
specific canon detail — this description is not stripped of names before use.
`.trim()
}

function buildLocationPrompt(input: ResolveCanonDescriptionInput): string {
  const lines: string[] = ['Location']
  const src = sourceLine(input.source)
  if (src) lines.push(src)
  if (input.currentNotes?.trim()) lines.push(`Existing freeform notes (may be incomplete or non-visual): ${input.currentNotes.trim()}`)
  if (input.existingDescription?.trim()) lines.push(`Established description (preserve this, changing only what's below): ${input.existingDescription.trim()}`)
  lines.push(`What's changed (optional, only apply if given): ${input.developmentNote?.trim() || '(nothing specified — describe as currently established)'}`)
  lines.push(`Name: ${input.name}`)
  return lines.join('\n')
}

export async function resolveCanonDescription(input: ResolveCanonDescriptionInput): Promise<string> {
  const provider = getProvider(input.apiSettings.provider)

  if (input.kind === 'character') {
    const raw = await provider.runSeed({
      apiKey: input.apiSettings.apiKey,
      model: input.apiSettings.model,
      temperature: input.apiSettings.temperature,
      maxOutputTokens: 512,
      systemInstructions: buildNpcVisualSystemInstructions(),
      prompt: buildNpcVisualPrompt(input),
    })
    const fields = parseNpcVisualFields(raw)
    return formatNpcVisualDescription(fields)
  }

  const raw = await provider.runSeed({
    apiKey: input.apiSettings.apiKey,
    model: input.apiSettings.model,
    temperature: input.apiSettings.temperature,
    maxOutputTokens: 512,
    systemInstructions: buildLocationSystemInstructions(),
    prompt: buildLocationPrompt(input),
  })
  return raw.trim().replace(/^["'\s]+|["'\s]+$/g, '')
}
