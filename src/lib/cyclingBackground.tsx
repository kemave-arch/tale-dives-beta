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

// Probes public/img/pc_title-bg<N>.webp starting at 1, stopping at the
// first gap (pc_ is the guaranteed file per useResponsiveBg below, so it's
// the right one to probe). Starts from ['title-bg1'] so something renders
// immediately rather than waiting on the probe round-trip; updates once
// discovery finishes if there turn out to be more.
export function useDiscoveredSlots(): string[] {
  const [slots, setSlots] = useState<string[]>(['title-bg1'])

  useEffect(() => {
    let cancelled = false
    async function discover() {
      const base = import.meta.env.BASE_URL
      const found: string[] = []
      for (let i = 1; i <= MAX_SLOT_PROBE; i++) {
        const stem = `title-bg${i}`
        if (!(await probeImageExists(`${base}img/pc_${stem}.webp`))) break
        found.push(stem)
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
  const [portrait, setPortrait] = useState(() => window.matchMedia(PORTRAIT_QUERY).matches)
  useEffect(() => {
    const mq = window.matchMedia(PORTRAIT_QUERY)
    const sync = () => setPortrait(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])
  return portrait
}

// pc_ is the guaranteed default — a slot's m_ file is optional and can lag
// behind. On a portrait viewport, try the m_ variant first and silently
// fall back to pc_ if it 404s; in landscape, always use pc_ directly.
// Paths are built off Vite's own BASE_URL rather than a hardcoded leading
// slash — GitHub Pages serves this app from /tale-dives/, not the domain
// root, so a literal `/img/...` request 404s there even though it works
// fine against the dev server's root-mounted localhost:5173.
function useResponsiveBg(stem: string): string {
  const base = import.meta.env.BASE_URL
  const pcSrc = `${base}img/pc_${stem}.webp`
  const mobileSrc = `${base}img/m_${stem}.webp`
  const [src, setSrc] = useState(pcSrc)

  useEffect(() => {
    const mq = window.matchMedia(PORTRAIT_QUERY)
    let cancelled = false

    function resolve() {
      if (!mq.matches) {
        /* landscape */
        setSrc(pcSrc)
        return
      }
      const probe = new Image()
      probe.onload = () => {
        if (!cancelled) setSrc(mobileSrc)
      }
      probe.onerror = () => {
        if (!cancelled) setSrc(pcSrc)
      }
      probe.src = mobileSrc
    }

    resolve()
    mq.addEventListener('change', resolve)
    return () => {
      cancelled = true
      mq.removeEventListener('change', resolve)
    }
  }, [pcSrc, mobileSrc])

  return src
}

// Decorative (aria-hidden) rather than described per-slot — with more than
// one slot cycling through, a single alt text would go stale the moment a
// second image takes over.
// Two stacked copies of the same image, because neither sizing mode is right
// on its own:
//   - `cover` (what this used to be) scales the illustration up until it fills
//     the viewport and crops the rest, so the visible slice changed with every
//     window aspect ratio — reading as "zoomed in" on one screen and "panned
//     somewhere else" on the next, with the artwork's own wordmark drifting
//     off-centre.
//   - `contain` alone keeps the whole photo at its true aspect ratio (right),
//     but the art is 16:9 while phones and portrait tablets are far taller, so
//     it strands 31%-58% of the screen as dead black.
// So: `contain` on top for the real, uncropped photo, over a blurred and
// dimmed `cover` copy that fills the letterbox with the image's own colour
// instead of a void. On a 16:9 desktop the top layer covers the screen exactly
// and the blurred one never shows at all.
function BackgroundLayer({ stem, active }: { stem: string; active: boolean }) {
  const src = useResponsiveBg(stem)
  const portrait = usePortrait()
  const image = `url(${src})`

  // Different rules by orientation, because the two want different things:
  //
  // Landscape (PC/tablet) — `cover`, so the art scales responsively and fills
  // the screen. `cover` is already the SMALLEST scale that fills, so it is by
  // definition the least zoomed a filling background can be; what made the old
  // version feel over-zoomed was a portrait screen being handed 16:9 art, which
  // the orientation-matched pc_/m_ pick above now prevents. On a 16:9 display
  // it crops nothing at all.
  //
  // Portrait (mobile) — `auto 100%` locks the image's HEIGHT to the viewport,
  // so its top and bottom always touch the screen edges and it stays centred,
  // with the sides running off rather than the composition being trimmed.
  // `cover` cannot promise that: on a portrait tablet it scales to fill the
  // width instead and slices the top and bottom off. Where the art is
  // proportionally narrower than the screen this leaves side margins, which
  // the blurred layer below fills.
  const size = portrait ? 'auto 100%' : 'cover'

  return (
    <div
      className="absolute inset-0"
      style={{ opacity: active ? 1 : 0, transition: `opacity ${BG_FADE_MS}ms ease-in-out` }}
      aria-hidden="true"
    >
      {/* Fills whatever the sharp layer leaves over, with the image's own
          colour rather than a void. Scaled past the edges so the blur's own
          soft border never shows. Invisible whenever the layer above covers
          the screen outright. */}
      <div
        className="absolute inset-0 bg-center bg-cover bg-no-repeat"
        style={{ backgroundImage: image, filter: 'blur(36px) brightness(0.4) saturate(0.85)', transform: 'scale(1.15)' }}
      />
      <div
        className="absolute inset-0 bg-center bg-no-repeat"
        style={{ backgroundImage: image, backgroundSize: size }}
      />
    </div>
  )
}

// Crossfades through `stems`, but only ever mounts the active slot plus —
// for the ~7s BG_FADE_MS window while a crossfade is actually in flight —
// the one it's fading out from, not every discovered slot at once. Each
// BackgroundLayer carries its own full-viewport `filter: blur(36px)` copy
// (see below), which is real, sustained GPU/compositor cost on a phone;
// with N slots always mounted that cost scaled with N even though at most
// two are ever visible mid-dissolve and only one is ever visible at rest.
// A no-op with a single slot — the interval never starts, so there's just
// one static, correctly-picked background, one layer, nothing to crossfade.
// `fixed` pins the art to the viewport regardless of the page's own scroll
// (for a scrollable screen like MainMenu); Title, which never scrolls, uses
// the cheaper `absolute`.
export function CyclingBackground({ fixed = false }: { fixed?: boolean }) {
  const stems = useDiscoveredSlots()
  const [active, setActive] = useState(0)
  // Indices currently mounted — just `[active]` at rest; briefly gains the
  // previous index for exactly one BG_FADE_MS window whenever `active`
  // changes, then drops back to one.
  const [mounted, setMounted] = useState<number[]>([0])

  useEffect(() => {
    if (stems.length < 2) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const id = setInterval(() => setActive((i) => (i + 1) % stems.length), BG_HOLD_MS + BG_FADE_MS)
    return () => clearInterval(id)
  }, [stems.length])

  useEffect(() => {
    setMounted((prev) => (prev.includes(active) ? prev : [...prev, active]))
    const timer = window.setTimeout(() => setMounted([active]), BG_FADE_MS)
    return () => clearTimeout(timer)
  }, [active])

  const layers = mounted.map((i) => <BackgroundLayer key={stems[i]} stem={stems[i]} active={i === active} />)

  // `display: contents` (used for the non-fixed case, so Title's own
  // `position: relative` root stays the containing block for these
  // `absolute` layers) has a real, confirmed side effect here: it appears
  // to interfere with framer-motion's AnimatePresence exit-tracking on the
  // ancestor motion.div — every screen transition away from Title silently
  // stopped completing (React state updated, DOM never followed) the moment
  // this wrapper existed at all, even wrapping a Fragment's worth of
  // children made no difference until it was a real Fragment. A plain
  // Fragment carries no DOM node and sidesteps the problem entirely.
  if (!fixed) return <>{layers}</>

  // bg-canvas so `contain`'s letterbox bars are the app's own dark ground
  // rather than whatever happens to sit behind this layer.
  return <div className="fixed inset-0 z-0 bg-canvas">{layers}</div>
}
