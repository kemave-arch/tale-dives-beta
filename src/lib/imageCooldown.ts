import { useState, useEffect } from 'react'

const COOLDOWN_KEY = 'tale_dives_image_cooldown_end'
const DEFAULT_COOLDOWN_SECONDS = 62

let listeners: Array<() => void> = []

function notifyListeners() {
  listeners.forEach((l) => l())
}

export function getCooldownEndTime(): number {
  try {
    const val = localStorage.getItem(COOLDOWN_KEY)
    return val ? parseInt(val, 10) : 0
  } catch {
    return 0
  }
}

export function setCooldownEndTime(seconds: number = DEFAULT_COOLDOWN_SECONDS) {
  const endTime = Date.now() + seconds * 1000
  try {
    localStorage.setItem(COOLDOWN_KEY, endTime.toString())
  } catch {}
  notifyListeners()
}

export function useImageCooldown() {
  const [cooldownRemaining, setCooldownRemaining] = useState<number>(() => {
    const end = getCooldownEndTime()
    const diff = Math.ceil((end - Date.now()) / 1000)
    return diff > 0 ? diff : 0
  })

  useEffect(() => {
    const check = () => {
      const end = getCooldownEndTime()
      const diff = Math.ceil((end - Date.now()) / 1000)
      setCooldownRemaining(diff > 0 ? diff : 0)
    }

    check()
    listeners.push(check)
    const interval = setInterval(check, 500)

    return () => {
      listeners = listeners.filter((l) => l !== check)
      clearInterval(interval)
    }
  }, [])

  const start62sCooldown = () => {
    setCooldownEndTime(DEFAULT_COOLDOWN_SECONDS)
  }

  return {
    cooldownRemaining,
    isCooldownActive: cooldownRemaining > 0,
    start62sCooldown,
  }
}
