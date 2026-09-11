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

export function buildLocationImagePrompt(
  name: string,
  description?: string,
  world?: WorldStyleData,
): string {
  const style = worldDirective(world)

  return `
Create a single high-quality environmental illustration for the RPG location "${name}".

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
Cinematic RPG concept art, polished game illustration,
strong composition, cohesive color and lighting,
detailed environment.

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
Create a single character portrait illustration for the RPG character "${name}".

World:
${style || "an original fictional setting"}

Role:
${role?.trim() || "important RPG character"}

Appearance:
${appearance?.trim() || "Create a distinctive original character with memorable visual identity."}

Character presentation:
- Waist-up portrait.
- Character is the clear focal point.
- Keep facial features, hairstyle, clothing, accessories, and silhouette clearly readable.
- Give the character a strong personality and presence.
- Use a simple atmospheric background that supports the character without distracting from them.
- Preserve coherent anatomy and believable proportions.
- Clothing and equipment should fit the stated world, era, role, and power system.

Art direction:
High-quality RPG character concept art,
cinematic lighting, polished illustration,
expressive face, strong silhouette.

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
Create a top-down illustrated regional map for the RPG region "${name}".

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
- Make the map readable as a game-world exploration map.
- Use an elegant illustrated RPG map aesthetic appropriate to the world.

Important:
Do not generate readable text labels.
Do not create a legend.
Do not create UI panels.
Do not add decorative borders.
Do not add a title.
`.trim()
}
