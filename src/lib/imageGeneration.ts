import { GoogleGenAI } from "@google/genai"

export type ImageAspectRatio = '1:1' | '16:9' | '9:16' | '4:3' | '3:2'

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
 * Generate image using Nanobanana 2 (gemini-3.1-flash-image / nanobanana-2).
 * All fallback models (Puter, Pollinations) have been removed per configuration.
 */
export async function generateImageBytes(input: GenerateImageInput): Promise<GenerateImageResult> {
  if (!input.apiKey) {
    throw new Error('Gemini API key is required for Nanobanana 2 image generation.')
  }

  const ai = new GoogleGenAI({ apiKey: input.apiKey })
  // Primary Nanobanana / Gemini Flash Image models using standard generateContent
  const nanobananaModels = [
    'gemini-3.1-flash-image',
    'nanobanana-2',
    'gemini-3.1-flash-lite-image',
    'gemini-2.5-flash-image',
  ]
  let lastError: any = null

  for (const model of nanobananaModels) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: {
          parts: [{ text: input.prompt }],
        },
        config: {
          ...(input.aspectRatio ? { imageConfig: { aspectRatio: input.aspectRatio } } : {}),
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
          modelUsed: input.isPremium ? `Nanobanana Premium (${model})` : `Nanobanana (${model})`,
        }
      }
    } catch (err: any) {
      lastError = err
      console.info(`Nanobanana generation attempt with model "${model}" failed:`, err instanceof Error ? err.message : err)
    }
  }

  // Focused error handling for Nanobanana 2
  const errMsg = lastError?.message || String(lastError || 'No image data returned from Nanobanana 2')
  const lower = errMsg.toLowerCase()

  if (lower.includes('429') || lower.includes('quota') || lower.includes('resource_exhausted')) {
    throw new Error('Nanobanana 2 quota or rate limit reached (HTTP 429). Please wait for the 62-second cooldown to expire before retrying.')
  } else if (lower.includes('403') || lower.includes('permission')) {
    throw new Error('Nanobanana 2 permission denied (HTTP 403). Ensure your Gemini API Key in Settings has image generation permissions enabled.')
  } else if (lower.includes('404') || lower.includes('not_found')) {
    throw new Error('Nanobanana 2 model endpoint not found (HTTP 404). Check model availability for your key.')
  } else {
    throw new Error(`Nanobanana 2 image generation failed: ${errMsg}`)
  }
}

export type WorldStyleData = {
  genreTone?: string
  eraTechLevel?: string
  powerSystem?: string
}

function styleDirective(world?: WorldStyleData): string {
  if (!world) return 'fantasy'
  const parts = [world.genreTone, world.eraTechLevel].filter(Boolean)
  return parts.length ? parts.join(', ') : 'fantasy'
}

export function buildLocationImagePrompt(
  name: string,
  description?: string,
  world?: WorldStyleData,
): string {
  const style = styleDirective(world)
  return `A single atmospheric fantasy illustration of a location called "${name}"${description ? `: ${description}` : ''}. ${style} illustration style, no text or watermarks.`
}

export function buildNpcPortraitPrompt(
  name: string,
  appearance?: string,
  role?: string,
  world?: WorldStyleData,
): string {
  const style = styleDirective(world)
  return `A single character portrait illustration of "${name}"${role ? `, ${role}` : ''}${appearance ? ` — ${appearance}` : ''}. Waist-up fantasy character art, ${style} style, softly blurred background, no text or watermarks.`
}

export function buildRegionMapPrompt(
  name: string,
  description: string | undefined,
  locationNames: string[],
  world?: WorldStyleData,
): string {
  const style = styleDirective(world)
  return `A top-down stylized fantasy map illustration of a region called "${name}"${description ? `: ${description}` : ''}${
    locationNames.length ? `. It contains these named locations: ${locationNames.join(', ')}.` : ''
  } ${style} map aesthetic, muted colors, no readable text labels, no legend.`
}
