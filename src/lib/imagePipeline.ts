// §7 Image Generation — client-side resize + WebP re-encode. No server,
// no image-processing library: the Canvas API already does exactly this
// (draw at a target size, export at a target quality) for free in every
// browser this app targets. Reuses the project's own already-proven WebP
// quality convention from its hand-authored art (60% for full-size images;
// dropped further for small thumbnails, where compression artifacts are
// far less visible at that scale).

export const IMAGE_QUALITY_FULL = 0.6
export const IMAGE_QUALITY_THUMB = 0.45

// Portraits/location art: a single "large enough for its own detail view,
// small enough to stay cheap" size. Region maps get more room since they
// need to legibly show multiple location pins across a wider frame.
export const MAX_DIM_STANDARD = 768
export const MAX_DIM_MAP = 1024

export async function resizeToWebP(source: Blob, maxDim: number, quality: number): Promise<Blob> {
  const bitmap = await createImageBitmap(source)
  try {
    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height))
    const width = Math.max(1, Math.round(bitmap.width * scale))
    const height = Math.max(1, Math.round(bitmap.height * scale))

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas 2D context unavailable')
    ctx.drawImage(bitmap, 0, 0, width, height)

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('Canvas toBlob returned null'))),
        'image/webp',
        quality,
      )
    })
  } finally {
    bitmap.close()
  }
}
