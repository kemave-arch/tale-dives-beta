import { compareGameTime } from './gameTime.ts'
import type { BestiaryEntry, Campaign, Dict, Minion, SummonBranch } from '../types.ts'

// §5.3 Three-Branch Summoning & Minion Engine — 0 API tokens, entirely
// client-resolved, same family as the read-only "!" bang commands but with
// a real state-mutating side effect. Gated per-class: a player only has
// access to the branch their active class (preset or Class Evolution
// result, §5.1b) actually grants.
//
// Balance numbers below (minion hpMax) are invented defaults — the
// blueprint specifies the mechanism (spend Bone Dust, ongoing upkeep) but
// not exact figures, the same way this codebase already invents e.g.
// DEFEAT_HP_RESTORE_FRACTION in App.tsx. mpUpkeep is a narrow, deliberately
// unmodified holdover — out of scope for the Narrative-First Overhaul (see
// the Minion type's own comment in types.ts); it no longer drains an actual
// numeric player pool since Player.mp doesn't exist anymore, but the field
// stays as flavor context shown on the minion's own dossier.
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
  patch?: { bestiary?: Dict<BestiaryEntry>; inventory?: Dict<number> }
}

// Blueprint §5.3 describes Shadow Extraction as gated on "specific slain
// boss tags" — but there's no boss/elite threat-tier tagging mechanism
// anywhere in the Bestiary yet (every adversary auto-registers at
// 'standard' tier), so this simplifies to "any harvestable corpse" — the
// Bestiary species with the highest corpseCount, most-recently-slain species
// breaking a tie (Narrative-First Overhaul Phase 7: corpseCount/lastSlainTime
// now live directly on BestiaryEntry instead of a flat Campaign.corpses
// tag stack). See the Project Revision Notes for the full scope-cut rationale.
export function attemptSummon(command: SummonCommand, campaign: Campaign, newMinionId: string): SummonOutcome {
  const expectedBranch: SummonBranch = command === 'arise' ? 'shadow' : command === 'raise_skeleton' ? 'skeleton' : 'familiar'
  if (classBranch(campaign.player.classId) !== expectedBranch) {
    return { ok: false, note: `Your class (${campaign.player.className}) doesn't grant this summoning branch.` }
  }

  if (command === 'arise') {
    const candidates = Object.entries(campaign.bestiary ?? {}).filter(([, b]) => (b.corpseCount ?? 0) > 0)
    if (candidates.length === 0) {
      return { ok: false, note: 'No slain essence available to extract — defeat an enemy first.' }
    }
    // Highest corpseCount wins; most recent lastSlainTime breaks a tie.
    const [corpseId, corpse] = candidates.reduce((best, cur) => {
      const [, bestEntry] = best
      const [, curEntry] = cur
      if ((curEntry.corpseCount ?? 0) !== (bestEntry.corpseCount ?? 0)) {
        return (curEntry.corpseCount ?? 0) > (bestEntry.corpseCount ?? 0) ? cur : best
      }
      if (curEntry.lastSlainTime && bestEntry.lastSlainTime && compareGameTime(curEntry.lastSlainTime, bestEntry.lastSlainTime) > 0) return cur
      return best
    })
    const minion: Minion = {
      id: newMinionId,
      name: `Shadow of ${corpse.name}`,
      branch: 'shadow',
      hpMax: ARISE_MINION_HP,
      summonedAt: campaign.player.time,
    }
    const nextBestiary: Dict<BestiaryEntry> = {
      ...campaign.bestiary,
      [corpseId]: { ...corpse, corpseCount: Math.max(0, (corpse.corpseCount ?? 0) - 1) },
    }
    return {
      ok: true,
      note: `${minion.name} rises from the extracted essence, bound to your will.`,
      minion,
      patch: { bestiary: nextBestiary },
    }
  }

  if (command === 'raise_skeleton') {
    const boneDust = campaign.inventory['bone_dust'] ?? 0
    if (boneDust < 1) return { ok: false, note: 'No Bone Dust in your inventory.' }
    const nextInventory = { ...campaign.inventory }
    const remaining = boneDust - 1
    if (remaining > 0) nextInventory['bone_dust'] = remaining
    else delete nextInventory['bone_dust']
    const minion: Minion = { id: newMinionId, name: 'Skeletal Infantry', branch: 'skeleton', hpMax: SKELETON_MINION_HP, summonedAt: campaign.player.time }
    return {
      ok: true,
      note: `${minion.name} claws free of the earth, bones knitting into formation.`,
      minion,
      patch: { inventory: nextInventory },
    }
  }

  // command === 'summon' — no MP gate anymore (the Narrative-First Overhaul
  // dropped the numeric MP pool this used to check against; class gating
  // above is the only real gate left).
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
    note: `A gate tears open — ${minion.name} steps through, bound to your contract.`,
    minion,
  }
}

// Used to drain a `familiar`-branch minion's upkeep from the player's MP
// pool each turn, dissipating it the instant upkeep couldn't be paid.
// Out of scope for the Narrative-First Overhaul (see the Minion type's own
// comment in types.ts) — kept as a stable no-op pass-through purely because
// Player no longer has a numeric MP pool to drain from, not because the
// mechanic was redesigned. No minion currently dissipates for lack of MP.
export function applyMinionUpkeep(minions: Dict<Minion>): { minions: Dict<Minion>; dissipated: string[] } {
  return { minions, dissipated: [] }
}
