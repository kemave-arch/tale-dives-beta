import { useEffect, useState } from 'react'

// Each slot ships as a pair: public/img/m_<stem>.webp (phone-composed) and
// public/img/pc_<stem>.webp (tablet/desktop-composed, also the guaranteed
// fallback if a slot's m_ file doesn't exist yet). Shared by Title and
// MainMenu so both cycle through the same backdrop. Slots are discovered at
// runtime (see useDiscoveredSlots below) — dropping a new numbered pair into
// public/img/ is enough on its own to add it to the rotation.
// Orientation, not device width. The two art variants differ by SHAPE — m_ is
// composed portrait (2:3), pc_ landscape (16:9) — so what matters is which way
// the viewport is turned, not how big it is. Keyed on width alone, a portrait
// tablet took the landscape art and stranded it as a narrow band across the
// middle (768x1024 fit only 42% of the height); on the portrait art the same
// screen fills 100%. A phone held sideways correctly gets the landscape art.
const PORTRAIT_QUERY = '(orientation: portrait)'
const BG_FADE_MS = 7000
const BG_HOLD_MS = 6000
const MAX_SLOT_PROBE = 20 // sanity cap, not an expected real count

function probeImageExists(src: string): Promise<boolean> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve(true)
    img.onerror = () => resolve(false)
    img.src = src
  })
}

// Module-level cache for mobile variant availability and preloaded state so
// newly mounted cross-fade layers don't re-probe or flash fallbacks.
const mobileAvailability = new Map<string, boolean>()

// Probes public/img/pc_title-bg<N>.webp starting at 1, stopping at the
// first gap (pc_ is the guaranteed file per useResponsiveBg below, so it's
// the right one to probe). Starts from ['title-bg1'] so something renders
// immediately rather than waiting on the probe round-trip; updates once
// discovery finishes if there turn out to be more.
// Also probes and preloads corresponding m_<stem>.webp files into the browser cache
// so mobile portrait transitions never flicker or stall.
export function useDiscoveredSlots(): string[] {
  const [slots, setSlots] = useState<string[]>(['title-bg1'])

  useEffect(() => {
    let cancelled = false
    async function discover() {
      const base = import.meta.env.BASE_URL
      const found: string[] = []
      for (let i = 1; i <= MAX_SLOT_PROBE; i++) {
        const stem = `title-bg${i}`
        const pcUrl = `${base}img/pc_${stem}.webp`
        const mUrl = `${base}img/m_${stem}.webp`
        if (!(await probeImageExists(pcUrl))) break
        found.push(stem)
        // Probe and preload the mobile portrait variant in background:
        probeImageExists(mUrl).then((hasMobile) => {
          mobileAvailability.set(stem, hasMobile)
        })
      }
      if (!cancelled && found.length > 0) setSlots(found)
    }
    discover()
    return () => {
      cancelled = true
    }
  }, [])

  return slots
}

function usePortrait(): boolean {
  const [portrait, setPortrait] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(PORTRAIT_QUERY).matches : false
  )
  useEffect(() => {
    const mq = window.matchMedia(PORTRAIT_QUERY)
    const sync = () => setPortrait(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])
  return portrait
}

function getPreferredBg(stem: string, isPortrait: boolean): string {
  const base = import.meta.env.BASE_URL
  const pcSrc = `${base}img/pc_${stem}.webp`
  const mobileSrc = `${base}img/m_${stem}.webp`

  if (!isPortrait) return pcSrc
  // If explicitly confirmed that this stem lacks an m_ portrait file, use pcSrc
  if (mobileAvailability.get(stem) === false) return pcSrc
  // In portrait, always default to the mobile version so mobile viewports never flash pc art
  return mobileSrc
}

// On a portrait viewport, use the m_ variant directly and silently fall back
// to pc_ only if it 404s; in landscape, always use pc_ directly.
// Initial state starts on mobileSrc for portrait viewports to prevent the PC
// landscape photo from momentarily rendering or flickering during cross-fades.
function useResponsiveBg(stem: string, portrait: boolean): string {
  const base = import.meta.env.BASE_URL
  const pcSrc = `${base}img/pc_${stem}.webp`
  const mobileSrc = `${base}img/m_${stem}.webp`
  const [src, setSrc] = useState(() => getPreferredBg(stem, portrait))

  useEffect(() => {
    let cancelled = false

    if (!portrait) {
      setSrc(pcSrc)
      return
    }

    const known = mobileAvailability.get(stem)
    if (known === true) {
      setSrc(mobileSrc)
      return
    }
    if (known === false) {
      setSrc(pcSrc)
      return
    }

    const probe = new Image()
    probe.onload = () => {
      mobileAvailability.set(stem, true)
      if (!cancelled) setSrc(mobileSrc)
    }
    probe.onerror = () => {
      mobileAvailability.set(stem, false)
      if (!cancelled) setSrc(pcSrc)
    }
    probe.src = mobileSrc

    return () => {
      cancelled = true
    }
  }, [stem, portrait, pcSrc, mobileSrc])

  return src
}

// Decorative (aria-hidden) rather than described per-slot — with more than
// one slot cycling through, a single alt text would go stale the moment a
// second image takes over.
// Two stacked copies of the same image:
//   - `contain` / `auto 100%` on top for the sharp, uncropped photo
//   - blurred and dimmed `cover` copy beneath that fills the letterbox with
//     the image's own colour rather than a void.
function BackgroundLayer({
  stem,
  active,
  fadeInOnMount = false,
}: {
  stem: string
  active: boolean
  fadeInOnMount?: boolean
}) {
  const portrait = usePortrait()
  const src = useResponsiveBg(stem, portrait)
  const image = `url(${src})`

  // Landscape: `cover` so the art scales responsively and fills the screen.
  // Portrait: `auto 100%` locks image height to viewport so top and bottom
  // touch screen edges and remain centered.
  const size = portrait ? 'auto 100%' : 'cover'

  // When fadeInOnMount is true, start at opacity 0 on mount and animate to 1
  // on next frame so CSS transition executes smoothly instead of popping in.
  const [opacity, setOpacity] = useState(() => (fadeInOnMount ? 0 : active ? 1 : 0))

  useEffect(() => {
    if (fadeInOnMount) {
      const raf = requestAnimationFrame(() => {
        setOpacity(active ? 1 : 0)
      })
      return () => cancelAnimationFrame(raf)
    }
    setOpacity(active ? 1 : 0)
  }, [active, fadeInOnMount])

  return (
    <div
      className="absolute inset-0 pointer-events-none"
      style={{ opacity, transition: `opacity ${BG_FADE_MS}ms ease-in-out` }}
      aria-hidden="true"
    >
      {/* Fills whatever the sharp layer leaves over, with the image's own
          colour rather than a void. Scaled past the edges so the blur's own
          soft border never shows. Invisible whenever the layer above covers
          the screen outright. */}
      <div
        className="absolute inset-0 bg-center bg-cover bg-no-repeat"
        style={{ backgroundImage: image, filter: 'blur(36px) brightness(0.4) saturate(0.85)', transform: 'scale(1.15)' }}
        aria-hidden="true"
      />
      <div
        className="absolute inset-0 bg-center bg-no-repeat"
        style={{ backgroundImage: image, backgroundSize: size }}
        aria-hidden="true"
      />
    </div>
  )
}

// Crossfades through `stems`, keeping only the active slot plus the outgoing
// slot mounted during the crossfade window (~7s BG_FADE_MS) to preserve mobile GPU.
export function CyclingBackground({ fixed = false }: { fixed?: boolean }) {
  const stems = useDiscoveredSlots()
  const [active, setActive] = useState(0)
  const [prev, setPrev] = useState<number | null>(null)

  useEffect(() => {
    if (stems.length < 2) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const id = setInterval(() => {
      setActive((curr) => {
        setPrev(curr)
        return (curr + 1) % stems.length
      })
    }, BG_HOLD_MS + BG_FADE_MS)

    return () => clearInterval(id)
  }, [stems.length])

  // Clear outgoing slot once cross-fade completes so only 1 blurred layer remains at rest
  useEffect(() => {
    if (prev === null) return
    const timer = window.setTimeout(() => {
      setPrev(null)
    }, BG_FADE_MS)
    return () => clearTimeout(timer)
  }, [prev])

  const mountedIndices = prev !== null && prev !== active ? [prev, active] : [active]

  const layers = mountedIndices.map((i) => (
    <BackgroundLayer
      key={stems[i]}
      stem={stems[i]}
      active={i === active}
      fadeInOnMount={i === active && prev !== null}
    />
  ))

  if (!fixed) return <>{layers}</>

  // bg-canvas so letterbox bars match dark ground
  return <div className="fixed inset-0 z-0 bg-canvas pointer-events-none">{layers}</div>
}
