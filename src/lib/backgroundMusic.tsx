import { useEffect, useRef, useState } from 'react'

// Soundtrack lives in public/tracks/ as tale_dives_ost-0.opus,
// tale_dives_ost-1.opus, ... — auto-discovered the same way the background
// art is (see cyclingBackground.tsx), though 0-indexed rather than 1-indexed
// like the art (matches how the files actually got named on conversion from
// mp3 to opus — smaller files, same quality). Dropping tale_dives_ost-7.opus
// into that folder is enough on its own to add it to the rotation; no code
// change needed.
const TRACK_PREFIX = 'tracks/tale_dives_ost-'
const TRACK_EXT = '.opus'
const MAX_TRACK_PROBE = 20 // sanity cap, not an expected real count
const PROBE_TIMEOUT_MS = 5000
const FADE_MS = 2500
const FADE_STEP_MS = 50

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
  const found: string[] = []
  for (let i = 0; i <= MAX_TRACK_PROBE; i++) {
    const src = `${base}${TRACK_PREFIX}${i}${TRACK_EXT}`
    if (!(await probeTrackExists(src))) break
    found.push(src)
  }
  return found
}

/**
 * Background soundtrack: plays the discovered tracks in order, fading each one
 * in at its start and out before its end, then wrapping back to the first.
 *
 * It *attempts* muted autoplay on load, but never assumes it succeeded. That
 * assumption was the original "no sound ever plays" bug: muted autoplay is
 * widely permitted but not universally — Safari, mobile browsers, and any
 * Chrome started with `--autoplay-policy=document-user-activation-required`
 * refuse it for a bare <audio> element. A refused play() rejects silently, so
 * the element would sit at `paused: true` (fully loaded, readyState 4) while
 * the toggle only ever flipped `.muted` — leaving nothing to unmute, no matter
 * how many times it was clicked.
 *
 * So playback is (re)started from two places that carry a real user gesture:
 * the mute toggle itself, and a first-interaction fallback for anyone who
 * never touches it. `.muted` is kept separate from the `.volume` ramps, so a
 * deliberate user toggle is immediate while track changes stay gradual.
 */
export function useBackgroundMusic() {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const fadeTimerRef = useRef<number | null>(null)
  // Set by the mount effect below; called from the `muted` effect, which
  // can't reach into that closure directly.
  const resumeRef = useRef<() => void>(() => {})
  const [muted, setMuted] = useState(true)

  useEffect(() => {
    let cancelled = false
    // Attached to the DOM rather than a bare `new Audio()` purely so the
    // player is inspectable in devtools; it's hidden and control-less, so
    // it behaves identically otherwise.
    const audio = document.createElement('audio')
    audio.id = 'td-soundtrack'
    audio.hidden = true
    audio.loop = false
    audio.muted = true
    audio.volume = 0
    document.body.appendChild(audio)
    audioRef.current = audio

    let tracks: string[] = []
    let index = 0
    let fadingOut = false

    // Interval rather than requestAnimationFrame on purpose: rAF does not
    // fire at all while the document is hidden, so a backgrounded tab would
    // freeze a fade partway and leave the volume stranded (verified — the
    // preview pane runs hidden and pinned the volume at 0). Timers are only
    // throttled, not stopped, and since each tick recomputes progress from
    // elapsed wall-clock time rather than counting steps, a throttled fade
    // still lands exactly on target, just in fewer/coarser jumps.
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
    function playCurrent() {
      if (cancelled || tracks.length === 0) return
      fadingOut = false
      audio.src = tracks[index]
      audio.volume = 0
      // Rejected play() is not an error worth surfacing — it just means
      // autoplay was refused, which `resume()` below is there to recover from.
      void audio.play().catch(() => {})
      fadeTo(1)
    }

    // Gets playback going again *without* rewinding: the recovery path for a
    // refused autoplay. If discovery hasn't finished yet there's nothing to
    // play, and that's fine — playCurrent() runs when it does, by which point
    // the page has the user activation it was missing.
    function resume() {
      if (cancelled || tracks.length === 0) return
      if (!audio.src) {
        playCurrent()
        return
      }
      void audio.play().catch(() => {})
    }
    resumeRef.current = resume

    // Fallback for a listener who never touches the mute toggle: retry on the
    // first genuine interaction anywhere. The element is still muted at that
    // point, so this is silent — it only means unmuting later is instant.
    // Self-removing once playback is confirmed running.
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

    function handleTimeUpdate() {
      if (fadingOut || !Number.isFinite(audio.duration)) return
      // Guard the fade window against a track shorter than the fade itself,
      // which would otherwise start fading out the instant it began.
      const fadeOutAt = Math.max(audio.duration / 2, audio.duration - FADE_MS / 1000)
      if (audio.currentTime >= fadeOutAt) {
        fadingOut = true
        fadeTo(0)
      }
    }

    function handleEnded() {
      if (tracks.length === 0) return
      index = (index + 1) % tracks.length
      playCurrent()
    }

    audio.addEventListener('timeupdate', handleTimeUpdate)
    audio.addEventListener('ended', handleEnded)

    void discoverTracks(import.meta.env.BASE_URL).then((found) => {
      if (cancelled) return
      tracks = found
      playCurrent()
    })

    return () => {
      cancelled = true
      window.removeEventListener('pointerdown', retryOnGesture)
      window.removeEventListener('keydown', retryOnGesture)
      audio.removeEventListener('timeupdate', handleTimeUpdate)
      audio.removeEventListener('ended', handleEnded)
      if (fadeTimerRef.current !== null) clearInterval(fadeTimerRef.current)
      audio.pause()
      audio.src = ''
      audio.remove()
      audioRef.current = null
      resumeRef.current = () => {}
    }
  }, [])

  // Sync declaratively rather than inside the setMuted updater — updater
  // functions must stay pure, and React is free to call them more than once,
  // which would toggle `.muted` twice and leave the element out of step with
  // the icon.
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    audio.muted = muted
    // Unmuting is itself the user gesture browsers demand, so this is the one
    // moment a previously-refused play() is certain to be allowed. Without
    // this the toggle is inert whenever autoplay was blocked.
    if (!muted) resumeRef.current()
  }, [muted])

  function toggleMute() {
    setMuted((prev) => !prev)
  }

  return { muted, toggleMute, setMuted }
}
