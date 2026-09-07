import type { NodeType } from './types.ts'

export interface NodeCalibration {
  left: number // Percentage relative to background artwork width (e.g. 49.0)
  top: number // Percentage relative to background artwork height (e.g. 29.0)
  diameter: number // Percentage relative to background artwork width (e.g. 28.0)
}

export type WeaverCalibrationPreset = Record<NodeType, NodeCalibration>

export const DEFAULT_MOBILE_CALIBRATION: WeaverCalibrationPreset = {
  protagonist: { left: 51.3, top: 31.8, diameter: 20.3 },
  world: { left: 22.9, top: 46.5, diameter: 23.5 },
  npcs: { left: 78.3, top: 46.5, diameter: 23.4 },
  narrative: { left: 50.4, top: 60.3, diameter: 20.1 },
}

export const DEFAULT_DESKTOP_CALIBRATION: WeaverCalibrationPreset = {
  protagonist: { left: 50.7, top: 23.4, diameter: 10.2 },
  world: { left: 33.4, top: 45.3, diameter: 13.1 },
  npcs: { left: 66.7, top: 45.5, diameter: 13.1 },
  narrative: { left: 50.7, top: 69.0, diameter: 13.1 },
}

const STORAGE_KEY_PREFIX = 'taledives_weaver_calib_v2_'

export function getSavedCalibration(isDesktop: boolean): WeaverCalibrationPreset {
  const key = `${STORAGE_KEY_PREFIX}${isDesktop ? 'desktop' : 'mobile'}`
  const defaults = isDesktop ? DEFAULT_DESKTOP_CALIBRATION : DEFAULT_MOBILE_CALIBRATION
  try {
    const raw = localStorage.getItem(key)
    if (raw) {
      const parsed = JSON.parse(raw)
      return {
        protagonist: { ...defaults.protagonist, ...parsed.protagonist },
        world: { ...defaults.world, ...parsed.world },
        npcs: { ...defaults.npcs, ...parsed.npcs },
        narrative: { ...defaults.narrative, ...parsed.narrative },
      }
    }
  } catch {
    // fallback
  }
  return defaults
}

export function saveSavedCalibration(isDesktop: boolean, data: WeaverCalibrationPreset): void {
  const key = `${STORAGE_KEY_PREFIX}${isDesktop ? 'desktop' : 'mobile'}`
  try {
    localStorage.setItem(key, JSON.stringify(data))
  } catch {
    // ignore
  }
}

export function clearSavedCalibration(isDesktop: boolean): void {
  const key = `${STORAGE_KEY_PREFIX}${isDesktop ? 'desktop' : 'mobile'}`
  try {
    localStorage.removeItem(key)
  } catch {
    // ignore
  }
}
