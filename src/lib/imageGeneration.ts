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

export async function generateImageBytes(input: GenerateImageInput): Promise<Blob> {
  const ai = new GoogleGenAI({ apiKey: input.apiKey })

  const response = await ai.models.generateContent({
    model: 'gemini-3.1-flash-image',
    contents: {
      parts: [{ text: input.prompt }],
    },
    config: {
      ...(input.aspectRatio ? { imageConfig: { aspectRatio: input.aspectRatio } } : {}),
    },
  })

  const parts = response.candidates?.[0]?.content?.parts ?? []
  const imagePart = parts.find((p) => p.inlineData?.data)
  if (!imagePart?.inlineData?.data) {
    throw new Error('No image came back from the model — it may not support image generation, or the prompt was refused.')
  }

  const mimeType = imagePart.inlineData.mimeType || 'image/png'
  const base64Data = imagePart.inlineData.data

  const binary = atob(base64Data)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return new Blob([bytes], { type: mimeType })
}

// Kept short and generic on purpose — "an illustration of X," not a long
// styled brief — since every generated image here is a lightweight visual
// aid (a background, a thumbnail, a map), never the centerpiece art a
// dedicated prompt-engineering pass would deserve.
export function buildLocationImagePrompt(name: string, description?: string): string {
  return `A single atmospheric fantasy illustration of a location called "${name}"${description ? `: ${description}` : ''}. Painterly digital art, no text or watermarks.`
}

export function buildNpcPortraitPrompt(name: string, appearance?: string, role?: string): string {
  return `A single character portrait illustration of "${name}"${role ? `, ${role}` : ''}${appearance ? ` — ${appearance}` : ''}. Waist-up fantasy character art, painterly style, softly blurred background, no text or watermarks.`
}

export function buildRegionMapPrompt(name: string, description: string | undefined, locationNames: string[]): string {
  return `A top-down stylized fantasy map illustration of a region called "${name}"${description ? `: ${description}` : ''}${
    locationNames.length ? `. It contains these named locations: ${locationNames.join(', ')}.` : ''
  } Hand-drawn parchment map aesthetic, muted colors, no readable text labels, no legend.`
}
