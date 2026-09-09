import { useEffect, useState } from 'react'
import { getImageBlob } from './imageStore.ts'

// §7 Image Generation — loads a stored blob into a display-ready object
// URL. `key` is a Codex entity's own imageKey/portraitKey/mapImageKey;
// undefined (no image generated yet) just returns undefined, same as any
// other optional field's absence. The object URL is revoked on unmount or
// key change — nothing about this hook persists across a reload, which is
// correct: the durable copy lives in IndexedDB, this is just today's view
// of it.
export function useEntityImage(key: string | undefined, refreshToken?: number): string | undefined {
  const [url, setUrl] = useState<string | undefined>(undefined)

  useEffect(() => {
    let objectUrl: string | undefined
    let cancelled = false
    setUrl(undefined)
    if (!key) return

    getImageBlob(key).then((blob) => {
      if (cancelled || !blob) return
      objectUrl = URL.createObjectURL(blob)
      setUrl(objectUrl)
    })

    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
    // refreshToken deliberately in the dep list: bump it after a successful
    // generate/retry to force a re-read even though `key` itself is
    // unchanged (the same key, new bytes underneath it).
  }, [key, refreshToken])

  return url
}
