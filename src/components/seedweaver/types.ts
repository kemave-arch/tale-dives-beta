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

export type NodeType = 'protagonist' | 'world' | 'npcs' | 'narrative'
