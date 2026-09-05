import { useEffect, useRef, useState } from 'react'
import { TRACK_FILENAMES, TURN_STATES, getTrackMetadata, parseTurnState, type TrackMetadata } from '../data/soundtrackManifest.ts'
import type { TurnState } from '../types.ts'

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
//
// A `ts-<state>_` prefix (parsed by parseTurnState, e.g.
// `ts-combat_ironclash_ost00.opus`) pulls a track out of the ambient rotation
// and into a per-Turn-State pool instead — see DiscoveryResult/discoverTracks
// below. setTurnState (exposed from the hook) crossfades into that pool
// whenever the active turn enters that state, and crossfades back to wherever
// ambient rotation left off when it leaves.
const ORDER_SUFFIX = /_ost0*(\d+)/i

function parseOrder(filename: string): number | null {
  const base = filename.replace(/\.[^.]+$/, '')
  const match = base.match(ORDER_SUFFIX)
  return match ? Number(match[1]) : null
}

const PROBE_TIMEOUT_MS = 5000
const FADE_MS = 2500
const STATE_FADE_MS = 1400 // snappier than the ambient loop-boundary fade — a combat cue should land promptly
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

interface TrackCandidate {
  src: string
  order: number | null
  turnState: TurnState | null
  index: number // manifest position — the fallback sort key for an unsuffixed name
}

function sortCandidates(list: TrackCandidate[]): string[] {
  return [...list]
    .sort((a, b) => {
      if (a.order !== null && b.order !== null) return a.order - b.order
      if (a.order !== null) return -1
      if (b.order !== null) return 1
      return a.index - b.index
    })
    .map((c) => c.src)
}

interface DiscoveryResult {
  ambient: string[]
  statePools: Partial<Record<TurnState, string[]>>
}

async function discoverTracks(base: string): Promise<DiscoveryResult> {
  const candidates: TrackCandidate[] = TRACK_FILENAMES.map((filename, index) => ({
    src: `${base}tracks/${filename}`,
    order: parseOrder(filename),
    turnState: parseTurnState(filename),
    index,
  }))
  // Checked in parallel, unlike the old scheme's one-at-a-time probing — that
  // was inherent to detecting "the first gap" in a sequential guess, which no
  // longer applies now that every candidate is named explicitly.
  const checked = await Promise.all(candidates.map(async (c) => ({ ...c, exists: await probeTrackExists(c.src) })))
  const found = checked.filter((c) => c.exists)

  const ambient = sortCandidates(found.filter((c) => c.turnState === null))
  const statePools: Partial<Record<TurnState, string[]>> = {}
  for (const state of TURN_STATES) {
    const list = sortCandidates(found.filter((c) => c.turnState === state))
    if (list.length > 0) statePools[state] = list
  }
  return { ambient, statePools }
}

/**
 * Background soundtrack: plays the discovered ambient tracks in order, fading
 * each one in at its start and out before its end, then wrapping back to the
 * first. A track tagged with a `ts-<state>_` filename prefix instead joins a
 * per-Turn-State pool — setTurnState() crossfades into that pool whenever the
 * active turn enters that state, and crossfades back to ambient rotation
 * (resuming wherever it was) when it leaves.
 */
export function useBackgroundMusic() {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const fadeTimerRef = useRef<number | null>(null)
  const bannerTimerRef = useRef<number | null>(null)
  const tracksRef = useRef<string[]>([]) // ambient rotation only
  const indexRef = useRef<number>(0) // position within tracksRef
  const statePoolsRef = useRef<Partial<Record<TurnState, string[]>>>({})
  const stateIndexRef = useRef<Partial<Record<TurnState, number>>>({}) // rotation position within each pool
  const activeStateRef = useRef<TurnState | null>(null) // which pool (if any) is currently playing
  const pendingTurnStateRef = useRef<TurnState | null>(null) // latest setTurnState() call, applied once discovery finishes
  const discoveredRef = useRef(false)
  // Set by the mount effect below; called from the `muted` effect, which
  // can't reach into that closure directly.
  const resumeRef = useRef<() => void>(() => {})
  const playTrackRef = useRef<(filenameOrIndex: string | number) => void>(() => {})
  const nextTrackRef = useRef<() => void>(() => {})
  const setTurnStateRef = useRef<(state: TurnState | null) => void>(() => {})
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

    // Starts a given src from the top, fading it in. Shared by ambient
    // playback and turn-state pool playback — everything except which list
    // supplies `src` and whether the element should loop is identical.
    function startTrack(src: string, showBanner: boolean) {
      fadingOut = false
      audio.src = src
      audio.volume = 0

      const meta = getTrackMetadata(src)
      setCurrentTrack(meta)
      if (showBanner) triggerBanner()

      void audio.play().then(() => {
        if (!cancelled) setIsPlaying(true)
      }).catch(() => {})
      fadeTo(1)
    }

    // Starts the ambient track at indexRef.current.
    function playCurrent(showBanner = true) {
      if (cancelled || tracksRef.current.length === 0) return
      audio.loop = false
      startTrack(tracksRef.current[indexRef.current], showBanner)
    }

    // Starts (or resumes rotation within) a Turn State pool.
    function enterState(state: TurnState, showBanner = true) {
      const pool = statePoolsRef.current[state]
      if (cancelled || !pool || pool.length === 0) return
      const pos = (stateIndexRef.current[state] ?? 0) % pool.length
      audio.loop = pool.length === 1 // a single combat track just loops in place — no need to rotate through a pool of one
      startTrack(pool[pos], showBanner)
    }

    function playTrack(filenameOrIndex: string | number) {
      if (cancelled || tracksRef.current.length === 0) return
      activeStateRef.current = null // an explicit manual pick always wins over automatic turn-state music
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
      activeStateRef.current = null
      indexRef.current = (indexRef.current + 1) % tracksRef.current.length
      playCurrent(true)
    }
    nextTrackRef.current = nextTrack

    function prevTrack() {
      if (tracksRef.current.length === 0) return
      activeStateRef.current = null
      indexRef.current = (indexRef.current - 1 + tracksRef.current.length) % tracksRef.current.length
      playCurrent(true)
    }
    prevTrackRef.current = prevTrack

    // Crossfades into the pool for `state` (if one exists and isn't already
    // active), or back to ambient rotation — right where it left off — when
    // `state` is null or has no pool of its own. A no-op if we're already in
    // the requested mode, so calling this every turn with an unchanged state
    // costs nothing.
    function setTurnState(state: TurnState | null) {
      pendingTurnStateRef.current = state
      if (cancelled || !discoveredRef.current) return

      const pool = state ? statePoolsRef.current[state] : undefined
      const poolKey: TurnState | null = pool && pool.length > 0 ? state : null
      if (poolKey === activeStateRef.current) return
      activeStateRef.current = poolKey

      fadingOut = true
      fadeTo(0)
      window.setTimeout(() => {
        if (cancelled) return
        if (poolKey !== null) {
          enterState(poolKey, true)
        } else if (tracksRef.current.length > 0) {
          playCurrent(true)
        }
      }, STATE_FADE_MS)
    }
    setTurnStateRef.current = setTurnState

    function resume() {
      if (cancelled) return
      if (!audio.src) {
        if (activeStateRef.current !== null) {
          enterState(activeStateRef.current, false)
        } else if (tracksRef.current.length > 0) {
          playCurrent(false)
        }
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
      // audio.loop skips the natural pre-end fade entirely — a looping single-
      // track pool (see enterState) isn't "ending," it seamlessly restarts,
      // and fading it to silence on every loop would be its own bug.
      if (fadingOut || !Number.isFinite(audio.duration) || audio.loop) return
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
      const active = activeStateRef.current
      if (active !== null) {
        // Rotate within the active pool. A pool of exactly one track never
        // gets here — enterState set audio.loop = true for it instead.
        const pool = statePoolsRef.current[active]
        if (!pool || pool.length === 0) return
        const next = ((stateIndexRef.current[active] ?? 0) + 1) % pool.length
        stateIndexRef.current[active] = next
        startTrack(pool[next], false)
        return
      }
      if (tracksRef.current.length === 0) return
      indexRef.current = (indexRef.current + 1) % tracksRef.current.length
      playCurrent(true)
    }

    audio.addEventListener('timeupdate', handleTimeUpdate)
    audio.addEventListener('play', handlePlay)
    audio.addEventListener('pause', handlePause)
    audio.addEventListener('ended', handleEnded)

    void discoverTracks(import.meta.env.BASE_URL).then(({ ambient, statePools }) => {
      if (cancelled) return
      tracksRef.current = ambient
      statePoolsRef.current = statePools
      discoveredRef.current = true

      const pending = pendingTurnStateRef.current
      const pendingPool = pending ? statePools[pending] : undefined
      if (pending && pendingPool && pendingPool.length > 0) {
        activeStateRef.current = pending
        enterState(pending, false)
      } else if (ambient.length > 0) {
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

  // Deliberately does not touch `muted` — this is driven by game state (the
  // active turn's state), not a user gesture, so it shouldn't unmute a player
  // who hasn't opted into audio yet. It still switches the underlying
  // <audio> element (silently, while muted) so the right track is already
  // playing whenever they do unmute.
  function setTurnState(state: TurnState | null) {
    setTurnStateRef.current(state)
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
    setTurnState,
  }
}

