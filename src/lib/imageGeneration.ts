import { GoogleGenAI } from "@google/genai"

export type ImageAspectRatio =
  | "1:1"
  | "1:4"
  | "4:1"
  | "1:8"
  | "8:1"
  | "2:3"
  | "3:2"
  | "3:4"
  | "4:3"
  | "4:5"
  | "5:4"
  | "9:16"
  | "16:9"
  | "21:9"

export interface GenerateImageInput {
  apiKey: string
  prompt: string
  aspectRatio?: ImageAspectRatio
  isPremium?: boolean
}

export interface GenerateImageResult {
  blob: Blob
  modelUsed: string
}

const IMAGE_MODEL = "gemini-3.1-flash-lite-image"

/**
 * AUTOMATIC IMAGE GENERATION POLICY LOCK:
 * Automatic image generation during Tale Weaver phases or story turns is strictly disabled.
 * Only manual calls initiated directly by user clicking the generate/retry buttons are permitted.
 */
export const AUTOMATIC_IMAGE_GENERATION_ENABLED = false

/**
  * Resolves the premium API key from environment variables (Gemini_Prem_Key / VITE_GEMINI_PREM_KEY)
  * or falls back to ApiSettings.premiumApiKey or ApiSettings.apiKey.
  */
export function getPremiumApiKey(apiSettings?: { apiKey?: string; premiumApiKey?: string }): string {
  const envPremKey =
    (typeof import.meta !== 'undefined' && import.meta.env && (import.meta.env.VITE_GEMINI_PREM_KEY || import.meta.env.GEMINI_PREM_KEY || import.meta.env.Gemini_Prem_Key)) ||
    (typeof process !== 'undefined' && process.env && (process.env.VITE_GEMINI_PREM_KEY || process.env.GEMINI_PREM_KEY || process.env.Gemini_Prem_Key)) ||
    ''
  return envPremKey || apiSettings?.premiumApiKey || ''
}

/**
 * Generate image using Gemini 3.1 Flash Lite Image.
 */
export async function generateImageBytes(input: GenerateImageInput): Promise<GenerateImageResult> {
  if (!input.apiKey?.trim()) {
    throw new Error('Gemini API key is required for image generation.')
  }

  if (!input.prompt?.trim()) {
    throw new Error('Image prompt is required.')
  }

  const ai = new GoogleGenAI({ apiKey: input.apiKey })
  let lastError: any = null

  try {
    const response = await ai.models.generateContent({
      model: IMAGE_MODEL,
      contents: input.prompt,
      config: {
        responseModalities: ["IMAGE"],
        imageConfig: {
          ...(input.aspectRatio ? { aspectRatio: input.aspectRatio } : {}),
        }
      },
    })

    const parts = response.candidates?.[0]?.content?.parts ?? []
    const imagePart = parts.find((p) => p.inlineData?.data)
    
    if (imagePart?.inlineData?.data) {
      const mimeType = imagePart.inlineData.mimeType || 'image/png'
      const base64Data = imagePart.inlineData.data
      const binary = atob(base64Data)
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i)
      }
      return {
        blob: new Blob([bytes], { type: mimeType }),
        modelUsed: input.isPremium ? `Gemini Flash Lite — Premium` : `Gemini Flash Lite`,
      }
    }
  } catch (err: any) {
    lastError = err
    console.info(`Image generation attempt with model "${IMAGE_MODEL}" failed:`, err instanceof Error ? err.message : err)
  }

  // Focused error handling
  const errMsg = lastError?.message || String(lastError || 'No image data returned from generation model')
  const lower = errMsg.toLowerCase()

  if (lower.includes('429') || lower.includes('quota') || lower.includes('resource_exhausted') || lower.includes('rate limit')) {
    throw new Error('Quota or rate limit reached (HTTP 429). Please wait for the cooldown to expire before retrying.')
  } else if (lower.includes('403') || lower.includes('permission') || lower.includes('forbidden')) {
    throw new Error('Permission denied (HTTP 403). Ensure your Gemini API Key in Settings has image generation permissions enabled.')
  } else if (lower.includes('404') || lower.includes('not_found') || lower.includes('not found')) {
    throw new Error('Model endpoint not found (HTTP 404). Check model availability for your key.')
  } else {
    throw new Error(`Image generation failed: ${errMsg}`)
  }
}

export type WorldStyleData = {
  genreTone?: string
  eraTechLevel?: string
  powerSystem?: string
  // Lore Accuracy System (see lib/canonDescription.ts) — when both are set,
  // buildLocationImagePrompt/buildNpcPortraitPrompt/buildRegionMapPrompt cite
  // this source material directly (real title/author, not a redacted
  // paraphrase) in the final prompt sent to the image model. Live testing
  // against gemini-3.1-flash-lite-image showed direct named references to
  // existing novels/characters are not refused, and produce far more
  // canon-accurate results than a name-stripped description does — the model
  // has its own trained visual association with the named work that a
  // redacted prompt throws away.
  sourceTitle?: string
  sourceAuthor?: string
  sourceScope?: string
}

function worldDirective(world?: WorldStyleData): string {
  if (!world) {
    return 'an original fictional setting'
  }

  return [
    world.genreTone && `tone: ${world.genreTone}`,
    world.eraTechLevel && `technology/era: ${world.eraTechLevel}`,
    world.powerSystem && `power system: ${world.powerSystem}`,
  ].filter(Boolean).join('; ')
}

// Appended to every image prompt when the world names real source material
// with a scope boundary set — see WorldStyleData's own comment above for why
// this is a direct citation rather than a redacted paraphrase.
function canonReferenceLine(world?: WorldStyleData): string {
  if (!world?.sourceTitle?.trim() || !world?.sourceScope?.trim()) return ''
  const attribution = world.sourceAuthor?.trim()
    ? `"${world.sourceTitle.trim()}" by ${world.sourceAuthor.trim()}`
    : `"${world.sourceTitle.trim()}"`
  return `

Canon Reference:
This is the real, existing subject from ${attribution} — not an original reinterpretation. Depict it
exactly as established in canon: actual design, physical appearance, and defining visual traits, as
depicted up to: ${world.sourceScope.trim()}. Prioritize canon accuracy over invention in every detail
canon actually establishes.`
}

export function buildLocationImagePrompt(
  name: string,
  description?: string,
  world?: WorldStyleData,
): string {
  const style = worldDirective(world)

  return `
Create a single high-quality environmental illustration of the location "${name}".

World:
${style || "an original fictional setting"}

Location:
${description?.trim() || "A distinctive and memorable location with a strong sense of place."}

Composition:
- Focus primarily on the environment and architecture.
- Establish clear foreground, middle ground, and background.
- Make the location visually distinctive and immediately recognizable.
- Use lighting, atmosphere, weather, terrain, and environmental storytelling appropriate to the world.
- Avoid generic stock scenery.

Art direction:
Cinematic fantasy realism — painterly, richly detailed illustration with grounded lighting and
materials. Not photorealistic, not a 3D game render, not a photo. Evocative concept-art quality,
strong composition, cohesive color and lighting, detailed environment.${canonReferenceLine(world)}

Do not place readable text, labels, or logos in the artwork. No UI, captions, borders, or decorative interface elements.
`.trim()
}

export function buildNpcPortraitPrompt(
  name: string,
  appearance?: string,
  role?: string,
  world?: WorldStyleData,
): string {
  const style = worldDirective(world)

  return `
Create a single character portrait illustration of "${name}".

World:
${style || "an original fictional setting"}

Role:
${role?.trim() || "a notable character in this world"}

Appearance:
${appearance?.trim() || "Create a distinctive original character with memorable visual identity."}

Character presentation:
- Waist-up portrait.
- Character is the clear focal point.
- Keep facial features, hairstyle, clothing, accessories, and silhouette clearly readable.
- Give the character a strong personality and presence.
- Use a simple atmospheric background that supports the character without distracting from them.
- Preserve coherent anatomy and believable proportions.
- Do not alter the character's stated anatomy or species. If the appearance describes a dragon,
  beast, monster, or other non-humanoid creature, render it as fully non-human — do not add human
  clothing, armor, or a humanoid posture unless the appearance text explicitly describes that.
- When the character is humanoid, clothing and equipment should fit the stated world, era, role,
  and power system.

Art direction:
Cinematic fantasy realism — painterly, richly detailed illustration with grounded lighting and
materials. Not photorealistic, not a 3D game render, not a photo. Expressive face, strong
silhouette.${canonReferenceLine(world)}

Do not place readable text, labels, or logos in the artwork. No nameplates, UI, borders, or decorative interface elements.
`.trim()
}

export function buildRegionMapPrompt(
  name: string,
  description: string | undefined,
  locationNames: string[],
  world?: WorldStyleData,
): string {
  const style = worldDirective(world)

  const locations = locationNames.length > 0
    ? locationNames.join(", ")
    : "No specific locations provided."

  return `
Create a top-down illustrated regional map for the region "${name}".

World:
${style || "an original fictional setting"}

Region:
${description?.trim() || "A distinctive region with varied terrain, settlements, and landmarks."}

Required locations:
${locations}

Map design:
- Top-down geographic composition.
- Clearly distinguish terrain, settlements, roads, rivers, mountains, forests, ruins, coastlines, and other appropriate features.
- Each required location should have a visually distinct landmark or geographic feature.
- Keep the geography coherent and believable.
- Make the map readable as an exploration map.
- Use an elegant illustrated map aesthetic appropriate to the world.${canonReferenceLine(world)}

Important:
Do not generate readable text labels.
Do not create a legend.
Do not create UI panels.
Do not add decorative borders.
Do not add a title.
`.trim()
}
