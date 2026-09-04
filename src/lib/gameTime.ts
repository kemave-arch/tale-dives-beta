import type { GameTime } from '../types.ts'

// §5.8 Crafting needs real arithmetic on the in-fiction clock (queue
// `complete_time = current_time + craft_hours`, then compare against it each
// turn) — everything below exists only to support that. `GameTime.h` is a
// freeform string the model produces (every live example seen so far is
// 12-hour "08:15 AM" style, not the blueprint's own "14:00" 24-hour example),
// so parsing is best-effort: anything that doesn't match falls back to noon
// rather than throwing, so a craft timer still advances in a sane order even
// on an odd/malformed time string.
const MINUTES_PER_DAY = 24 * 60
const FALLBACK_MINUTE_OF_DAY = 12 * 60

function parseTimeOfDay(h: string): number {
  const m = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(h.trim())
  if (!m) return FALLBACK_MINUTE_OF_DAY
  const hour12 = parseInt(m[1], 10) % 12
  const hour = /pm/i.test(m[3]) ? hour12 + 12 : hour12
  const minute = parseInt(m[2], 10)
  return hour * 60 + minute
}

function formatTimeOfDay(minuteOfDay: number): string {
  const hour24 = Math.floor(minuteOfDay / 60)
  const minute = minuteOfDay % 60
  const period = hour24 < 12 ? 'AM' : 'PM'
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12
  return `${String(hour12).padStart(2, '0')}:${String(minute).padStart(2, '0')} ${period}`
}

function totalMinutes(time: GameTime): number {
  return time.d * MINUTES_PER_DAY + parseTimeOfDay(time.h)
}

export function addHoursToGameTime(time: GameTime, hours: number): GameTime {
  const total = Math.max(0, totalMinutes(time) + Math.round(hours * 60))
  const d = Math.floor(total / MINUTES_PER_DAY)
  const minuteOfDay = total - d * MINUTES_PER_DAY
  return { d: Math.max(1, d), h: formatTimeOfDay(minuteOfDay) }
}

export function isTimeReached(current: GameTime, target: GameTime): boolean {
  return totalMinutes(current) >= totalMinutes(target)
}

// Whole hours remaining until `target`, floor-clamped to 0 — a friendly
// display number for the Codex queue's live countdown, not the completion
// check itself (isTimeReached above is exact).
export function hoursRemaining(current: GameTime, target: GameTime): number {
  return Math.max(0, Math.ceil((totalMinutes(target) - totalMinutes(current)) / 60))
}
