import { attributesAfterLevelUp, derivedPools } from './derivedStats.ts'
import type { ClassWeights, Player } from '../types.ts'

// §5.1a Milestone Leveling — ties leveling to story progress the schema
// already tracks (quest completion, chapter boundaries) rather than a
// hidden XP tally the model would have to compute or the client hide-and-
// reveal. §8 item 5 leaves whether Secret-tier quests should also grant a
// level as an open question; since quest_update doesn't currently carry a
// Main/Side/Secret tier at all, every completion counts for now — a
// deliberate simplification, revisit if quest tiers get tracked later.
export const CHAPTER_TURN_INTERVAL = 15

export interface LevelUpResult {
  player: Player
  leveled: boolean
}

// Recompute rule (§5.1c, reused here): current pools grow by the same
// delta as max — no free top-off, never exceeds the new max.
export function applyLevelUps(player: Player, weights: ClassWeights, levels: number): LevelUpResult {
  if (levels <= 0) return { player, leveled: false }

  const attrs = attributesAfterLevelUp(player.attrs, weights, levels)
  const { hpMax, mpMax, stMax } = derivedPools(attrs)

  const nextPlayer: Player = {
    ...player,
    level: player.level + levels,
    attrs,
    hp: Math.min(hpMax, player.hp + (hpMax - player.hpMax)),
    hpMax,
    mp: Math.min(mpMax, player.mp + (mpMax - player.mpMax)),
    mpMax,
    st: Math.min(stMax, player.st + (stMax - player.stMax)),
    stMax,
  }

  return { player: nextPlayer, leveled: true }
}

// +1 level at every Chapter Milestone boundary, independent of quest
// completions — turnNumber is 1-indexed (the turn about to be recorded).
export function isChapterBoundary(turnNumber: number): boolean {
  return turnNumber > 0 && turnNumber % CHAPTER_TURN_INTERVAL === 0
}
