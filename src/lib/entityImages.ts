import { generateImageBytes, type ImageAspectRatio } from './imageGeneration.ts'
import { resizeToWebP, IMAGE_QUALITY_FULL, MAX_DIM_STANDARD } from './imagePipeline.ts'
import { putImageBlob } from './imageStore.ts'

// §7 Image Generation — the single call site every Codex "Generate"/
// "Retry" button goes through: generate -> resize to WebP -> store under
// the entity's own key. A retry is just calling this again with the same
// key (putImageBlob overwrites); there's no separate "regenerate" code
// path to keep in sync with this one.

export interface GenerateEntityImageInput {
  apiKey: string
  prompt: string
  key: string
  aspectRatio?: ImageAspectRatio
  maxDim?: number
  quality?: number
}

export async function generateAndStoreEntityImage(input: GenerateEntityImageInput): Promise<void> {
  const raw = await generateImageBytes({ apiKey: input.apiKey, prompt: input.prompt, aspectRatio: input.aspectRatio })
  const resized = await resizeToWebP(raw, input.maxDim ?? MAX_DIM_STANDARD, input.quality ?? IMAGE_QUALITY_FULL)
  await putImageBlob(input.key, resized)
}
