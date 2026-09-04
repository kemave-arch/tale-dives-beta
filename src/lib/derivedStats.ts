import type { Attributes, ClassWeights } from '../types.ts'

// Attribute/pool math — Blueprint §5.1 (formulas) and §5.1a (weight-vector growth).
// Universal constants, identical for every class — never tuned per-class.
export const HP_BASE = 20
export const MP_BASE = 10
export const ST_BASE = 15
export const K1 = 2.5 // STR -> HP
export const K2 = 2.0 // INT -> MP
export const K3 = 1.0 // STR -> ST
export const K4 = 1.5 // AGI -> ST

export const STARTING_POOL = 32 // attribute points distributed at creation
export const LEVEL_BUDGET = 4 // attribute points granted per level-up

// Starting STR/INT/AGI from a class weight vector (§5.1a starting_pool rule).
export function startingAttributes(weights: ClassWeights): Attributes {
  return {
    STR: STARTING_POOL * weights.STR,
    INT: STARTING_POOL * weights.INT,
    AGI: STARTING_POOL * weights.AGI,
  }
}

export function attributesAfterLevelUp(attrs: Attributes, weights: ClassWeights, levels = 1): Attributes {
  return {
    STR: attrs.STR + LEVEL_BUDGET * weights.STR * levels,
    INT: attrs.INT + LEVEL_BUDGET * weights.INT * levels,
    AGI: attrs.AGI + LEVEL_BUDGET * weights.AGI * levels,
  }
}

export interface AttributeBonus {
  STR?: number
  INT?: number
  AGI?: number
}

export interface PoolBonus {
  hp?: number
  mp?: number
  st?: number
}

export interface DerivedPools {
  hpMax: number
  mpMax: number
  stMax: number
}

// §5.1c: flat bonus channels feed straight into STR_eff/INT_eff/AGI_eff.
export function derivedPools(attrs: Attributes, attrBonus: AttributeBonus = {}, poolBonus: PoolBonus = {}): DerivedPools {
  const strEff = attrs.STR + (attrBonus.STR ?? 0)
  const intEff = attrs.INT + (attrBonus.INT ?? 0)
  const agiEff = attrs.AGI + (attrBonus.AGI ?? 0)

  return {
    hpMax: Math.round(HP_BASE + strEff * K1 + (poolBonus.hp ?? 0)),
    mpMax: Math.round(MP_BASE + intEff * K2 + (poolBonus.mp ?? 0)),
    stMax: Math.round(ST_BASE + strEff * K3 + agiEff * K4 + (poolBonus.st ?? 0)),
  }
}
