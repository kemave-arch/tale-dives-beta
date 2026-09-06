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

// Chapter-relative trace id for a real narrated turn — "C{chapter}-{block}",
// e.g. turn 1 -> "C1-1", turn 15 -> "C1-15", turn 16 -> "C2-1". Same
// CHAPTER_TURN_INTERVAL boundary isChapterBoundary uses, so a turn's ref and
// whether it closes a chapter always agree. turnNumber is 1-indexed, same
// convention as isChapterBoundary.
export function turnRefFor(turnNumber: number): string {
  const chapter = Math.floor((turnNumber - 1) / CHAPTER_TURN_INTERVAL) + 1
  const block = ((turnNumber - 1) % CHAPTER_TURN_INTERVAL) + 1
  return `C${chapter}-${block}`
}
