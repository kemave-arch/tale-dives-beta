import type { ProtagonistData, WorldData } from '../../types.ts'

export interface SeedNpcData {
  id: string
  name: string
  role: string
  gender?: string
  attitude: 'allied' | 'friendly' | 'neutral' | 'hostile' | 'rival'
  affection: number
  trust: number
  heldWeapon?: string
  wornArmor?: string
  personality?: string
  secret?: string
  factionId?: string
  description?: string
}

export interface SeedCastPack {
  id: string
  name: string
  description: string
  worldTheme?: string
  npcs: SeedNpcData[]
  isCustom?: boolean
  savedAt?: number
}

export interface SeedNarrativePreset {
  id: string
  titleTemplate: string
  name: string
  description: string
  openingHook: string
  narrationStyle: string
  isCustom?: boolean
  savedAt?: number
}

export type NodeType = 'protagonist' | 'world' | 'npcs' | 'narrative'

export interface TaleDiveWeaverProps {
  debugMode?: boolean
  worldTemplates?: WorldData[]
  protagonistTemplates?: ProtagonistData[]
  existingTitles?: string[]
  onBack: () => void
  onSaveProtagonistPreset?: (protagonist: ProtagonistData) => void
  onSaveWorldPreset?: (world: WorldData) => void
  onDeleteProtagonistPreset?: (id: string) => void
  onDeleteWorldPreset?: (id: string) => void
  onBeginTale: (
    protagonist: ProtagonistData,
    worldOverride: Partial<WorldData>,
    customTitle: string,
    customNpcs?: SeedNpcData[]
  ) => void
}
