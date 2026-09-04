import type { BestiaryEntry, Dict, Player } from '../types.ts'

// §5.13 Adversary threat-tier baselines, scaled to player level. Placeholder
// tuning (§8 item 6) — revisit once real playtesting shows the right feel,
// same as the derived-pool constants in §5.1/§8 item 1.
const TIER_BASELINES = {
  minor: { hpBase: 12, hpPerLevel: 3, dmgBase: 3, dmgPerLevel: 0.5 },
  standard: { hpBase: 28, hpPerLevel: 5, dmgBase: 6, dmgPerLevel: 1.0 },
  elite: { hpBase: 55, hpPerLevel: 8, dmgBase: 12, dmgPerLevel: 1.5 },
  boss: { hpBase: 110, hpPerLevel: 15, dmgBase: 20, dmgPerLevel: 2.5 },
} as const

export type ThreatTier = keyof typeof TIER_BASELINES

export interface TierStats {
  hpMax: number
  dmgBase: number
}

export function statsForTier(tier: string, level: number): TierStats {
  const t = TIER_BASELINES[tier as ThreatTier] ?? TIER_BASELINES.standard
  return {
    hpMax: Math.round(t.hpBase + t.hpPerLevel * level),
    dmgBase: Math.round(t.dmgBase + t.dmgPerLevel * level),
  }
}

export interface EnsureAdversaryResult {
  dict: Dict<BestiaryEntry>
  entry: BestiaryEntry
  created: boolean
}

// §5.13 Adversary Auto-Registration — a {{Name|beast}} tag encountered while
// entering COMBAT needs a full stat block. lib/codex.ts's keyword-link pass
// already gave this id a name-only stub earlier in the same turn, so this
// explicitly upgrades that bare stub (or creates a fresh entry) rather than
// using the generic idempotent ensureEntry, which would treat the existing
// stub as "already registered" and skip adding hp/dmg entirely.
export function ensureAdversary(
  bestiary: Dict<BestiaryEntry> | undefined,
  id: string,
  name: string,
  tier: string,
  level: number,
): EnsureAdversaryResult {
  const dict = bestiary ?? {}
  const existing = dict[id]
  if (existing?.hpMax) return { dict, entry: existing, created: false } // already a full stat block

  const { hpMax, dmgBase } = statsForTier(tier, level)
  const entry: BestiaryEntry = { name: existing?.name ?? name, threatTier: tier, hpMax, dmgBase, autoLogged: true }
  return { dict: { ...dict, [id]: entry }, entry, created: !existing }
}

// Basic-attack damage — §5.1/§8 item 4 leaves weapon/skill base damage
// intentionally open (no master table) until equipment/skills are tracked;
// this is a flat baseline scaled by STR as a reasonable stand-in.
const BASE_ATTACK_DAMAGE = 8
const STR_DAMAGE_SCALE = 0.4
export const ATTACK_ST_COST = 5

export interface AttackResult {
  damage: number
  stCost: number
  exhausted: boolean
}

export function computePlayerAttack(player: Player): AttackResult {
  const strBonus = Math.round((player.attrs?.STR ?? 0) * STR_DAMAGE_SCALE)
  const fullDamage = BASE_ATTACK_DAMAGE + strBonus
  const exhausted = player.st < ATTACK_ST_COST
  return {
    damage: exhausted ? Math.round(fullDamage / 2) : fullDamage,
    stCost: exhausted ? player.st : ATTACK_ST_COST,
    exhausted,
  }
}

// A player action during active combat stays a tactical attack unless it's
// clearly trying to leave the fight — opt-out via keywords is more robust
// than requiring an explicit attack verb, since most in-combat phrasing
// ("I swing my claymore at its head") never says the word "attack".
const DISENGAGE_RE = /\b(flee|retreat|run away|surrender|parley|negotiate|talk to|de-?escalate|back away)\b/i

export function isDisengaging(actionText: string): boolean {
  return DISENGAGE_RE.test(actionText)
}

export interface CombatResultInput {
  enemyName?: string
  damage: number
  enemyHp: number
  enemyHpMax?: number
  defeated: boolean
  playerDamageTaken: number
  exhausted: boolean
}

// §3.1 Combat Result context-slice line, only present on a Tactical attack turn.
export function describeCombatResult({
  enemyName,
  damage,
  enemyHp,
  enemyHpMax,
  defeated,
  playerDamageTaken,
  exhausted,
}: CombatResultInput): string {
  const strike = exhausted
    ? `Player strikes ${enemyName} for ${damage} damage (exhausted, reduced effect)`
    : `Player strikes ${enemyName} for ${damage} damage`
  if (defeated) return `Combat Result: ${strike}. ${enemyName} is defeated (0/${enemyHpMax} HP).`
  return `Combat Result: ${strike}. Enemy HP: ${enemyHp}/${enemyHpMax} remaining. It strikes back for ${playerDamageTaken} damage.`
}
