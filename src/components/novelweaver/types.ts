import type { CombatMode, ProtagonistData, WorldData } from '../../types.ts'

// Novel Weaver — an isolated alternate Tale-creation UI (see the main
// screen, screens/NovelWeaver.tsx). Deliberately its own module, not a
// reskin of components/seedweaver/* — same underlying idea (four nodes,
// gated Narrative), different execution: a vertical drill-down "chapter
// list" instead of a radial constellation, no large painted background
// assets (CSS/SVG glow only), concise field labels throughout.

export type ChapterId = 'protagonist' | 'world' | 'cast' | 'narrative'

// A single starting NPC the player writes by hand — same shape the
// existing beginCampaign(customNpcs) parameter already expects (built for
// World Seed Weaver), structurally compatible without importing that
// module's own type.
export interface CastMember {
  id: string
  name: string
  role?: string
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

export interface NarrativeSeed {
  title: string
  opening: string
  narrationStyle: string
  combatMode: CombatMode
}

export interface FinalizedState {
  protagonist: boolean
  world: boolean
  cast: boolean
  narrative: boolean
}

export interface NovelWeaverProps {
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
    combatMode: CombatMode,
    worldOverride: Partial<WorldData>,
    customTitle: string,
    cast: CastMember[],
  ) => void
}
