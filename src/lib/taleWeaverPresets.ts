import type { TaleWeaverAccumulated } from './taleWeaving.ts'

export interface TaleWeaverPreset {
  id: string
  name: string
  createdAt: string
  accumulated: TaleWeaverAccumulated
}

const PRESETS_STORAGE_KEY = 'tale_weaver_presets_v1'

export function getTaleWeaverPresets(): TaleWeaverPreset[] {
  try {
    const raw = localStorage.getItem(PRESETS_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch (err) {
    console.warn('Failed to load Tale Weaver presets from localStorage:', err)
    return []
  }
}

export function saveTaleWeaverPreset(name: string, accumulated: TaleWeaverAccumulated): TaleWeaverPreset {
  const presets = getTaleWeaverPresets()
  const preset: TaleWeaverPreset = {
    id: `preset_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    name: name.trim() || 'Untitled Preset',
    createdAt: new Date().toISOString(),
    accumulated: JSON.parse(JSON.stringify(accumulated)),
  }
  const updated = [preset, ...presets]
  try {
    localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(updated))
  } catch (err) {
    console.warn('Failed to save Tale Weaver preset to localStorage:', err)
  }
  return preset
}

export function deleteTaleWeaverPreset(id: string): TaleWeaverPreset[] {
  const presets = getTaleWeaverPresets()
  const updated = presets.filter((p) => p.id !== id)
  try {
    localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(updated))
  } catch (err) {
    console.warn('Failed to delete Tale Weaver preset from localStorage:', err)
  }
  return updated
}
