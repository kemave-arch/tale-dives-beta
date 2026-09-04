import type { Campaign, Dict, Minion, SummonBranch } from '../types.ts'

// §5.3 Three-Branch Summoning & Minion Engine — 0 API tokens, entirely
// client-resolved, same family as the read-only "!" bang commands but with
// a real state-mutating side effect. Gated per-class: a player only has
// access to the branch their active class (preset or Class Evolution
// result, §5.1b) actually grants.
//
// Balance numbers below (MP costs/upkeep, minion hpMax) are invented
// defaults — the blueprint specifies the mechanism (spend MP, spend Bone
// Dust, ongoing upkeep) but not exact figures, so these are picked to feel
// meaningful without dominating an early MP pool, the same way this
// codebase already invents e.g. DEFEAT_HP_RESTORE_FRACTION in App.tsx.
const RAISE_SKELETON_MP_COST = 10
const SUMMON_FAMILIAR_MP_COST = 15
const SUMMON_FAMILIAR_MP_UPKEEP = 2
const ARISE_MINION_HP = 30
const SKELETON_MINION_HP = 20
const FAMILIAR_MINION_HP = 15

export function classBranch(classId: string): SummonBranch | null {
  switch (classId) {
    case 'dark_monarch':
      return 'shadow'
    case 'necromancer':
      return 'skeleton'
    case 'summoner':
      return 'familiar'
    default:
      return null
  }
}

export type SummonCommand = 'arise' | 'raise_skeleton' | 'summon'

export interface SummonOutcome {
  ok: boolean
  note: string
  minion?: Minion
  patch?: { corpses?: string[]; inventory?: Dict<number>; playerMp?: number }
}

// Blueprint §5.3 describes Shadow Extraction as gated on "specific slain
// boss tags" — but there's no boss/elite threat-tier tagging mechanism
// anywhere in the Bestiary yet (every adversary auto-registers at
// 'standard' tier), so this simplifies to "any harvestable corpse," the
// most recently accumulated one. See the Project Revision Notes for the
// full scope-cut rationale.
export function attemptSummon(command: SummonCommand, campaign: Campaign, newMinionId: string): SummonOutcome {
  const expectedBranch: SummonBranch = command === 'arise' ? 'shadow' : command === 'raise_skeleton' ? 'skeleton' : 'familiar'
  if (classBranch(campaign.player.classId) !== expectedBranch) {
    return { ok: false, note: `Your class (${campaign.player.className}) doesn't grant this summoning branch.` }
  }

  if (command === 'arise') {
    const corpses = campaign.corpses ?? []
    if (corpses.length === 0) {
      return { ok: false, note: 'No slain essence available to extract — defeat an enemy first.' }
    }
    const corpseId = corpses[corpses.length - 1]
    const minion: Minion = {
      id: newMinionId,
      name: `Shadow of ${corpseId.replace(/_/g, ' ')}`,
      branch: 'shadow',
      hpMax: ARISE_MINION_HP,
      summonedAt: campaign.player.time,
    }
    return {
      ok: true,
      note: `${minion.name} rises from the extracted essence, bound to your will.`,
      minion,
      patch: { corpses: corpses.slice(0, -1) },
    }
  }

  if (command === 'raise_skeleton') {
    const boneDust = campaign.inventory['bone_dust'] ?? 0
    if (boneDust < 1) return { ok: false, note: 'No Bone Dust in your inventory.' }
    if (campaign.player.mp < RAISE_SKELETON_MP_COST) {
      return { ok: false, note: `Not enough MP — Reanimation costs ${RAISE_SKELETON_MP_COST} MP (${campaign.player.mp} available).` }
    }
    const nextInventory = { ...campaign.inventory }
    const remaining = boneDust - 1
    if (remaining > 0) nextInventory['bone_dust'] = remaining
    else delete nextInventory['bone_dust']
    const minion: Minion = { id: newMinionId, name: 'Skeletal Infantry', branch: 'skeleton', hpMax: SKELETON_MINION_HP, summonedAt: campaign.player.time }
    return {
      ok: true,
      note: `${minion.name} claws free of the earth, bones knitting into formation.`,
      minion,
      patch: { inventory: nextInventory, playerMp: campaign.player.mp - RAISE_SKELETON_MP_COST },
    }
  }

  // command === 'summon'
  if (campaign.player.mp < SUMMON_FAMILIAR_MP_COST) {
    return { ok: false, note: `Not enough MP — a Planar Gate costs ${SUMMON_FAMILIAR_MP_COST} MP (${campaign.player.mp} available).` }
  }
  const minion: Minion = {
    id: newMinionId,
    name: 'Planar Familiar',
    branch: 'familiar',
    hpMax: FAMILIAR_MINION_HP,
    mpUpkeep: SUMMON_FAMILIAR_MP_UPKEEP,
    summonedAt: campaign.player.time,
  }
  return {
    ok: true,
    note: `A gate tears open — ${minion.name} steps through, bound to your contract (${SUMMON_FAMILIAR_MP_UPKEEP} MP upkeep/turn).`,
    minion,
    patch: { playerMp: campaign.player.mp - SUMMON_FAMILIAR_MP_COST },
  }
}

// Runs every turn (App.tsx's sendAction) — a `familiar`-branch minion drains
// its upkeep from the player's MP each turn, and dissipates the instant that
// upkeep can no longer be paid, rather than letting MP go negative or
// accumulating silent debt. Non-familiar minions (no mpUpkeep) are untouched.
export function applyMinionUpkeep(minions: Dict<Minion>, currentMp: number): { minions: Dict<Minion>; mp: number; dissipated: string[] } {
  if (Object.keys(minions).length === 0) return { minions, mp: currentMp, dissipated: [] }

  let mp = currentMp
  const dissipated: string[] = []
  const next: Dict<Minion> = {}
  for (const [id, m] of Object.entries(minions)) {
    if (!m.mpUpkeep || mp >= m.mpUpkeep) {
      if (m.mpUpkeep) mp -= m.mpUpkeep
      next[id] = m
    } else {
      dissipated.push(m.name)
    }
  }
  return { minions: next, mp, dissipated }
}
