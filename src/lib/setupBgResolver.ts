import { useEffect, useState } from 'react'

// Cache resolved image URLs in memory so subsequent mounts and gender changes swap instantly
const resolvedCache = new Map<string, string>()
const imagePreloadSet = new Set<string>()

/** Preload an image URL into browser memory cache */
export function preloadImage(url: string): Promise<boolean> {
  if (imagePreloadSet.has(url)) return Promise.resolve(true)
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      imagePreloadSet.add(url)
      resolve(true)
    }
    img.onerror = () => {
      resolve(false)
    }
    img.src = url
  })
}

export function parseGenderKey(genderStr?: string): 'female' | 'male' | 'neutral' {
  const norm = (genderStr || '').trim().toLowerCase()
  if (
    norm === 'female' ||
    norm === 'f' ||
    norm.startsWith('fem') ||
    norm === 'woman' ||
    norm === 'she/her'
  ) {
    return 'female'
  }
  if (
    norm === 'male' ||
    norm === 'm' ||
    norm.startsWith('mal') ||
    norm === 'man' ||
    norm === 'he/him'
  ) {
    return 'male'
  }
  // Default to female version if no protagonist gender was set
  return 'female'
}

/**
  Generate candidate image URLs ordered by specificity:
  e.g., for female PC:
  1) pc_setupscreen-female.webp
  2) pc_setupscreen-f.webp
  3) pc_setupscreen-01.webp
  4) pc_setupscreen.webp
 */
export function getCandidateSetupUrls(
  device: 'pc' | 'm',
  genderKey: 'female' | 'male' | 'neutral'
): string[] {
  const base = import.meta.env.BASE_URL
  const folder = `${base}img/taleweaver/`

  let stems: string[] = []
  if (genderKey === 'female') {
    stems = ['female', 'f', '01', '']
  } else if (genderKey === 'male') {
    stems = ['male', 'm', '01', '']
  } else {
    stems = ['female', 'f', '01', '']
  }

  const candidates: string[] = []
  for (const stem of stems) {
    if (stem) {
      candidates.push(`${folder}${device}_setupscreen-${stem}.webp`)
    } else {
      candidates.push(`${folder}${device}_setupscreen.webp`)
    }
  }

  return candidates
}

/** Preloads all potential setupscreen & loading screen variants for optimal performance */
export function preloadAllSetupAssets(): void {
  if (typeof window === 'undefined') return
  const devices: ('pc' | 'm')[] = ['pc', 'm']
  const genders: ('female' | 'male' | 'neutral')[] = ['female', 'male', 'neutral']

  for (const dev of devices) {
    for (const g of genders) {
      const candidates = getCandidateSetupUrls(dev, g)
      for (const url of candidates) {
        preloadImage(url)
      }
    }
  }

  // Also preload loading screens
  const base = import.meta.env.BASE_URL
  preloadImage(`${base}img/loadingscreens/pc_dive-in-female.webp`)
  preloadImage(`${base}img/loadingscreens/pc_dive-in-male.webp`)
  preloadImage(`${base}img/loadingscreens/m_dive-in-female.webp`)
  preloadImage(`${base}img/loadingscreens/m_dive-in-male.webp`)
}

/** Custom hook to resolve and preload the best matching setup screen URL */
export function useSetupScreenBg(genderStr?: string) {
  const genderKey = parseGenderKey(genderStr)

  const defaultPc = `${import.meta.env.BASE_URL}img/taleweaver/pc_setupscreen-female.webp`
  const defaultMobile = `${import.meta.env.BASE_URL}img/taleweaver/m_setupscreen-female.webp`

  const cacheKeyPc = `pc_${genderKey}`
  const cacheKeyMobile = `m_${genderKey}`

  const [pcUrl, setPcUrl] = useState<string>(
    () => resolvedCache.get(cacheKeyPc) || defaultPc
  )
  const [mobileUrl, setMobileUrl] = useState<string>(
    () => resolvedCache.get(cacheKeyMobile) || defaultMobile
  )

  useEffect(() => {
    let cancelled = false

    async function resolveDevice(
      device: 'pc' | 'm',
      setter: (url: string) => void,
      cacheKey: string,
      fallbackDefault: string
    ) {
      const candidates = getCandidateSetupUrls(device, genderKey)

      // Fast path: if already cached, use immediately
      if (resolvedCache.has(cacheKey)) {
        setter(resolvedCache.get(cacheKey)!)
        return
      }

      for (const url of candidates) {
        const ok = await preloadImage(url)
        if (ok) {
          if (!cancelled) {
            resolvedCache.set(cacheKey, url)
            setter(url)
          }
          return
        }
      }

      if (!cancelled) {
        resolvedCache.set(cacheKey, fallbackDefault)
        setter(fallbackDefault)
      }
    }

    resolveDevice('pc', setPcUrl, cacheKeyPc, defaultPc)
    resolveDevice('m', setMobileUrl, cacheKeyMobile, defaultMobile)

    return () => {
      cancelled = true
    }
  }, [genderKey])

  return { pcUrl, mobileUrl }
}
