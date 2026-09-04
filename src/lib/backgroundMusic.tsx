import { useEffect, useRef, useState } from 'react'
import { TRACK_FILENAMES, getTrackMetadata, type TrackMetadata } from '../data/soundtrackManifest.ts'

// Soundtrack lives in public/tracks/, listed explicitly in
// data/soundtrackManifest.ts rather than auto-discovered by probing a
// sequential filename — browsers have no API to list a directory's contents,
// and once track names stopped being sequential (renamed for the user's own
// library management) there was no longer a pattern left to guess. Play
// order comes from a `_ostNN` suffix on the filename itself
// (`battle_theme_ost01.opus`, ...), parsed by ORDER_SUFFIX below; a name with
// no such suffix falls back to the manifest's own array order rather than
// being dropped. Existence is still verified the same way as before (see
// probeTrackExists) — a name in the manifest with no matching file just
// doesn't make it into the rotation.
const ORDER_SUFFIX = /_ost0*(\d+)/i

function parseOrder(filename: string): number | null {
  const base = filename.replace(/\.[^.]+$/, '')
  const match = base.match(ORDER_SUFFIX)
  return match ? Number(match[1]) : null
}

const PROBE_TIMEOUT_MS = 5000
const FADE_MS = 2500
const FADE_STEP_MS = 50
const BANNER_DURATION_MS = 5500

// An <audio> probe rather than a fetch: a genuinely missing file still gets a
// 200 serving index.html from the dev server's SPA fallback, so status codes
// lie — but HTML can't be decoded as audio, so `error` fires and `onerror`
// remains a truthful existence check. Same reasoning as the image probe.
//
// The timeout is the safety net for the one case neither event covers: a
// request that simply stalls. Discovery awaits these one after another, so
// without it a single hung probe would keep the soundtrack from ever starting.
function probeTrackExists(src: string): Promise<boolean> {
  return new Promise((resolve) => {
    const probe = new Audio()
    let timer = 0
    let settled = false

    function finish(found: boolean) {
      if (settled) return
      settled = true
      clearTimeout(timer)
      probe.onloadedmetadata = null
      probe.onerror = null
      // Release the (possibly still in-flight) request. removeAttribute +
      // load() rather than `src = ''`, which some browsers resolve against
      // the document and re-request the page itself.
      probe.removeAttribute('src')
      probe.load()
      resolve(found)
    }

    timer = window.setTimeout(() => finish(false), PROBE_TIMEOUT_MS)
    probe.preload = 'metadata'
    probe.onloadedmetadata = () => finish(true)
    probe.onerror = () => finish(false)
    probe.src = src
  })
}

async function discoverTracks(base: string): Promise<string[]> {
  const candidates = TRACK_FILENAMES.map((filename, index) => ({
    src: `${base}tracks/${filename}`,
    order: parseOrder(filename),
    index, // manifest position — the fallback sort key for an unsuffixed name
  }))
  // Checked in parallel, unlike the old scheme's one-at-a-time probing — that
  // was inherent to detecting "the first gap" in a sequential guess, which no
  // longer applies now that every candidate is named explicitly.
  const checked = await Promise.all(candidates.map(async (c) => ({ ...c, exists: await probeTrackExists(c.src) })))
  return checked
    .filter((c) => c.exists)
    .sort((a, b) => {
      if (a.order !== null && b.order !== null) return a.order - b.order
      if (a.order !== null) return -1
      if (b.order !== null) return 1
      return a.index - b.index
    })
    .map((c) => c.src)
}

/**
 * Background soundtrack: plays the discovered tracks in order, fading each one
 * in at its start and out before its end, then wrapping back to the first.
 */
export function useBackgroundMusic() {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const fadeTimerRef = useRef<number | null>(null)
  const bannerTimerRef = useRef<number | null>(null)
  const tracksRef = useRef<string[]>([])
  const indexRef = useRef<number>(0)
  // Set by the mount effect below; called from the `muted` effect, which
  // can't reach into that closure directly.
  const resumeRef = useRef<() => void>(() => {})
  const playTrackRef = useRef<(filenameOrIndex: string | number) => void>(() => {})
  const nextTrackRef = useRef<() => void>(() => {})
  const prevTrackRef = useRef<() => void>(() => {})
  const [muted, setMuted] = useState(true)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [currentTrack, setCurrentTrack] = useState<TrackMetadata | null>(null)
  const [bannerVisible, setBannerVisible] = useState(false)

  const triggerBanner = () => {
    if (bannerTimerRef.current !== null) {
      clearTimeout(bannerTimerRef.current)
    }
    setBannerVisible(true)
    bannerTimerRef.current = window.setTimeout(() => {
      setBannerVisible(false)
      bannerTimerRef.current = null
    }, BANNER_DURATION_MS)
  }

  const dismissBanner = () => {
    if (bannerTimerRef.current !== null) {
      clearTimeout(bannerTimerRef.current)
      bannerTimerRef.current = null
    }
    setBannerVisible(false)
  }

  useEffect(() => {
    let cancelled = false
    const audio = document.createElement('audio')
    audio.id = 'td-soundtrack'
    audio.hidden = true
    audio.loop = false
    audio.muted = true
    audio.volume = 0
    document.body.appendChild(audio)
    audioRef.current = audio

    let fadingOut = false

    function fadeTo(target: number) {
      if (fadeTimerRef.current !== null) clearInterval(fadeTimerRef.current)
      const from = audio.volume
      const started = performance.now()
      fadeTimerRef.current = window.setInterval(() => {
        const t = Math.min(1, (performance.now() - started) / FADE_MS)
        audio.volume = Math.max(0, Math.min(1, from + (target - from) * t))
        if (t >= 1 && fadeTimerRef.current !== null) {
          clearInterval(fadeTimerRef.current)
          fadeTimerRef.current = null
        }
      }, FADE_STEP_MS)
    }

    // Starts a track from the top, fading it in.
    function playCurrent(showBanner = true) {
      if (cancelled || tracksRef.current.length === 0) return
      fadingOut = false
      const trackSrc = tracksRef.current[indexRef.current]
      audio.src = trackSrc
      audio.volume = 0

      const meta = getTrackMetadata(trackSrc)
      setCurrentTrack(meta)
      if (showBanner) triggerBanner()

      void audio.play().then(() => {
        if (!cancelled) setIsPlaying(true)
      }).catch(() => {})
      fadeTo(1)
    }

    function playTrack(filenameOrIndex: string | number) {
      if (cancelled || tracksRef.current.length === 0) return
      let targetIdx = 0
      if (typeof filenameOrIndex === 'number') {
        targetIdx = ((filenameOrIndex % tracksRef.current.length) + tracksRef.current.length) % tracksRef.current.length
      } else {
        const needle = filenameOrIndex.toLowerCase()
        const idx = tracksRef.current.findIndex((s) => s.toLowerCase().includes(needle))
        targetIdx = idx >= 0 ? idx : 0
      }
      indexRef.current = targetIdx
      playCurrent(true)
    }
    playTrackRef.current = playTrack

    function nextTrack() {
      if (tracksRef.current.length === 0) return
      indexRef.current = (indexRef.current + 1) % tracksRef.current.length
      playCurrent(true)
    }
    nextTrackRef.current = nextTrack

    function prevTrack() {
      if (tracksRef.current.length === 0) return
      indexRef.current = (indexRef.current - 1 + tracksRef.current.length) % tracksRef.current.length
      playCurrent(true)
    }
    prevTrackRef.current = prevTrack

    function resume() {
      if (cancelled || tracksRef.current.length === 0) return
      if (!audio.src) {
        playCurrent(false)
        return
      }
      void audio.play().then(() => {
        if (!cancelled) setIsPlaying(true)
      }).catch(() => {})
    }
    resumeRef.current = resume

    function retryOnGesture() {
      if (audio.paused) {
        resume()
        return
      }
      window.removeEventListener('pointerdown', retryOnGesture)
      window.removeEventListener('keydown', retryOnGesture)
    }
    window.addEventListener('pointerdown', retryOnGesture)
    window.addEventListener('keydown', retryOnGesture)

    function isMusicToggleTarget(target: EventTarget | null): boolean {
      return target instanceof Element && !!target.closest('[aria-label="Mute music"], [aria-label="Unmute music"]')
    }
    function unmuteOnFirstRealInteraction(e: Event) {
      if (isMusicToggleTarget(e.target)) return
      window.removeEventListener('pointerdown', unmuteOnFirstRealInteraction)
      window.removeEventListener('keydown', unmuteOnFirstRealInteraction)
      setMuted(false)
    }
    window.addEventListener('pointerdown', unmuteOnFirstRealInteraction)
    window.addEventListener('keydown', unmuteOnFirstRealInteraction)

    function handleTimeUpdate() {
      setCurrentTime(audio.currentTime)
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        setDuration(audio.duration)
      }
      if (fadingOut || !Number.isFinite(audio.duration)) return
      const fadeOutAt = Math.max(audio.duration / 2, audio.duration - FADE_MS / 1000)
      if (audio.currentTime >= fadeOutAt) {
        fadingOut = true
        fadeTo(0)
      }
    }

    function handlePlay() {
      setIsPlaying(true)
    }

    function handlePause() {
      setIsPlaying(false)
    }

    function handleEnded() {
      if (tracksRef.current.length === 0) return
      indexRef.current = (indexRef.current + 1) % tracksRef.current.length
      playCurrent(true)
    }

    audio.addEventListener('timeupdate', handleTimeUpdate)
    audio.addEventListener('play', handlePlay)
    audio.addEventListener('pause', handlePause)
    audio.addEventListener('ended', handleEnded)

    void discoverTracks(import.meta.env.BASE_URL).then((found) => {
      if (cancelled) return
      tracksRef.current = found
      if (found.length > 0) {
        playCurrent(false)
      }
    })

    return () => {
      cancelled = true
      window.removeEventListener('pointerdown', retryOnGesture)
      window.removeEventListener('keydown', retryOnGesture)
      window.removeEventListener('pointerdown', unmuteOnFirstRealInteraction)
      window.removeEventListener('keydown', unmuteOnFirstRealInteraction)
      audio.removeEventListener('timeupdate', handleTimeUpdate)
      audio.removeEventListener('play', handlePlay)
      audio.removeEventListener('pause', handlePause)
      audio.removeEventListener('ended', handleEnded)
      if (fadeTimerRef.current !== null) clearInterval(fadeTimerRef.current)
      if (bannerTimerRef.current !== null) clearTimeout(bannerTimerRef.current)
      audio.pause()
      audio.src = ''
      audio.remove()
      audioRef.current = null
      resumeRef.current = () => {}
    }
  }, [])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    audio.muted = muted
    if (!muted) {
      resumeRef.current()
      triggerBanner()
    }
  }, [muted])

  function toggleMute() {
    setMuted((prev) => !prev)
  }

  function togglePlayPause() {
    const audio = audioRef.current
    if (!audio) return
    if (audio.paused) {
      if (muted) setMuted(false)
      void audio.play()
    } else {
      audio.pause()
    }
  }

  function playTrack(filenameOrIndex: string | number) {
    if (muted) setMuted(false)
    playTrackRef.current(filenameOrIndex)
  }

  function nextTrack() {
    if (muted) setMuted(false)
    nextTrackRef.current()
  }

  function prevTrack() {
    if (muted) setMuted(false)
    prevTrackRef.current()
  }

  function resumeSoundtrack() {
    const audio = audioRef.current
    if (!audio) return
    if (audio.paused) {
      void audio.play()
    }
  }

  return {
    muted,
    toggleMute,
    setMuted,
    isPlaying,
    currentTime,
    duration,
    currentTrack,
    bannerVisible,
    triggerBanner,
    dismissBanner,
    playTrack,
    togglePlayPause,
    nextTrack,
    prevTrack,
    resumeSoundtrack,
  }
}

