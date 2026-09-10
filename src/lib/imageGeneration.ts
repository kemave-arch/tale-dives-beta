// §7 Image Generation — the actual Gemini image-generation call. Unlike
// every other API call in this app (turnContract.ts/worldSeedContract.ts/
// taleWeaverContract.ts, all plain-text generation through the existing
// provider abstraction), this hits a genuinely different model class and
// response shape (an image byte payload, not narration text), so it's a
// standalone call here rather than a new method on the text-provider
// interface — there's exactly one implementation of it today, and forcing
// a multi-provider abstraction for that would be premature.
//
// CAVEAT (per this project's own standing rule against presenting
// unverified claims as fact): the exact request/response shape below is
// assembled from third-party/community documentation of the Gemini image
// API, not a first-party spec read directly by this session. It fails
// loudly (a clear thrown Error) rather than silently on any unexpected
// response shape — the calling UI (Codex's Generate/Retry button) is
// built to treat that as an ordinary retryable failure, never a crash.

import { GoogleGenAI } from "@google/genai"
export type ImageAspectRatio = '1:1' | '16:9' | '9:16' | '4:3' | '3:2'

export interface GenerateImageInput {
  apiKey: string
  prompt: string
  aspectRatio?: ImageAspectRatio
}

async function loadPuterScript(): Promise<any> {
  if (typeof window === 'undefined') {
    throw new Error('Puter.js is only available in a browser environment')
  }
  if ((window as any).puter) {
    return (window as any).puter
  }

  return new Promise((resolve, reject) => {
    const existing = document.querySelector('script[src*="js.puter.com"]')
    if (existing) {
      existing.addEventListener('load', () => resolve((window as any).puter))
      existing.addEventListener('error', (e) => reject(e))
      return
    }

    const script = document.createElement('script')
    script.src = 'https://js.puter.com/v2/'
    script.async = true
    script.onload = () => resolve((window as any).puter)
    script.onerror = () => reject(new Error('Failed to load Puter.js script from js.puter.com'))
    document.head.appendChild(script)
  })
}

export async function generateImagePuter(prompt: string): Promise<Blob> {
  const puter = await loadPuterScript()
  if (!puter || !puter.ai || typeof puter.ai.txt2img !== 'function') {
    throw new Error('Puter.js AI txt2img function is not available')
  }

  const imgElement = await puter.ai.txt2img(prompt)
  if (!imgElement) {
    throw new Error('Puter.js returned an empty image response')
  }

  const src = typeof imgElement === 'string' ? imgElement : imgElement.src
  if (!src) {
    throw new Error('Puter.js image has no image source URL')
  }

  if (src.startsWith('data:')) {
    const parts = src.split(',')
    const header = parts[0]
    const base64 = parts[1]
    const mimeMatch = header.match(/:(.*?);/)
    const mime = mimeMatch ? mimeMatch[1] : 'image/png'
    const binary = atob(base64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i)
    }
    return new Blob([bytes], { type: mime })
  }

  const res = await fetch(src)
  if (!res.ok) {
    throw new Error(`Failed to fetch Puter generated image: ${res.statusText}`)
  }
  return await res.blob()
}

export interface GenerateImageResult {
  blob: Blob
  modelUsed: string
}

export async function generateImageBytes(input: GenerateImageInput): Promise<GenerateImageResult> {
  // If API key is provided, try Google GenAI image models first
  if (input.apiKey) {
    const ai = new GoogleGenAI({ apiKey: input.apiKey })

    // 1. Try generateContent with gemini-3.1-flash-lite-image first if requested
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-lite-image',
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
          modelUsed: 'gemini-3.1-flash-lite-image',
        }
      }
    } catch (err) {
      console.warn('generateContent gemini-3.1-flash-lite-image failed, trying Imagen models:', err)
    }

    // 2. Try official Imagen 3 models via generateImages()
    const modelsToTry = ['imagen-3.0-generate-002', 'imagen-3.0-fast-generate-001']

    for (const model of modelsToTry) {
      try {
        const response = await ai.models.generateImages({
          model,
          prompt: input.prompt,
          config: {
            numberOfImages: 1,
            outputMimeType: 'image/png',
            ...(input.aspectRatio ? { aspectRatio: input.aspectRatio } : {}),
          },
        })

        const base64Data = response.generatedImages?.[0]?.image?.imageBytes
        if (base64Data) {
          const binary = atob(base64Data)
          const bytes = new Uint8Array(binary.length)
          for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i)
          }
          return {
            blob: new Blob([bytes], { type: 'image/png' }),
            modelUsed: model,
          }
        }
      } catch (err) {
        console.warn(`Google generateImages failed with model ${model}, trying Puter.js fallback:`, err)
      }
    }
  }

  // Fallback to Puter.js (free zero-config image generation)
  try {
    const blob = await generateImagePuter(input.prompt)
    return {
      blob,
      modelUsed: 'Puter.js (Free Fallback)',
    }
  } catch (puterErr) {
    console.warn('Puter.js fallback image generation failed:', puterErr)
    throw new Error(`Image generation failed across Google models and Puter.js fallback. (${puterErr instanceof Error ? puterErr.message : String(puterErr)})`)
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

// Kept short and generic on purpose — "an illustration of X," not a long
// styled brief — since every generated image here is a lightweight visual
// aid (a background, a thumbnail, a map), never the centerpiece art a
// dedicated prompt-engineering pass would deserve.
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
