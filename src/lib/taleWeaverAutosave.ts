import type { TaleWeaverAccumulated } from './taleWeaving.ts'

// A silent, ongoing draft — distinct from taleWeaverPresets.ts's own named,
// player-initiated "Save Preset" library. This one exists purely so an
// accidental exit (back button, app close, a stray tap to another screen)
// never costs the player their in-progress answers. Both Tale Weaving
// creation flows (the full 7-phase screen and Quick Play's 3-question
// screen) use this same module, keyed separately so resuming one never
// clobbers or gets confused with the other.
export type TaleWeaverAutosaveMode = 'full' | 'quickplay'

export interface TaleWeaverAutosaveState {
  accumulated: TaleWeaverAccumulated
  savedAt: string
  phaseIdx?: number // full 7-phase flow's current phase
  guidance?: string // full flow's not-yet-submitted guidance textarea
  step?: number // Quick Play's current screen (0-2 = questions, 3 = overview)
  q1?: string
  q2?: string
  q3?: string
  sourceAccurate?: boolean // Quick Play's "Source Accurate" toggle — see QuickPlay.tsx
}

const STORAGE_KEY: Record<TaleWeaverAutosaveMode, string> = {
  full: 'tale_weaver_autosave_full_v1',
  quickplay: 'tale_weaver_autosave_quickplay_v1',
}

export function loadTaleWeaverAutosave(mode: TaleWeaverAutosaveMode): TaleWeaverAutosaveState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY[mode])
    if (!raw) return null
    return JSON.parse(raw)
  } catch (err) {
    console.warn('Failed to load Tale Weaver autosave draft:', err)
    return null
  }
}

export function saveTaleWeaverAutosave(mode: TaleWeaverAutosaveMode, state: Omit<TaleWeaverAutosaveState, 'savedAt'>): void {
  try {
    localStorage.setItem(STORAGE_KEY[mode], JSON.stringify({ ...state, savedAt: new Date().toISOString() }))
  } catch (err) {
    console.warn('Failed to save Tale Weaver autosave draft:', err)
  }
}

export function clearTaleWeaverAutosave(mode: TaleWeaverAutosaveMode): void {
  try {
    localStorage.removeItem(STORAGE_KEY[mode])
  } catch (err) {
    console.warn('Failed to clear Tale Weaver autosave draft:', err)
  }
}
