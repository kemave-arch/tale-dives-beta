import type { Player } from '../types.ts'

// §5.1a Milestone Leveling — ties leveling to story progress the schema
// already tracks (quest completion, chapter boundaries) rather than a
// hidden XP tally the model would have to compute or the client hide-and-
// reveal. §8 item 5 leaves whether Secret-tier quests should also grant a
// level as an open question; since quest_update doesn't currently carry a
// Main/Side/Secret tier at all, every completion counts for now — a
// deliberate simplification, revisit if quest tiers get tracked later.
export const CHAPTER_TURN_INTERVAL = 30

// Milestone rank ceiling — the top of the 5-word CompetencyTier scale
// (lib/tiers.ts's COMPETENCY_TIERS: Untrained..Master). Kept as a literal
// here rather than importing COMPETENCY_TIERS.length purely to avoid a
// cross-module dependency for one constant; the two are meant to move
// together if the scale itself ever changes.
const MAX_COMPETENCY_TIER = 5

export interface LevelUpResult {
  player: Player
  leveled: boolean
  // The attribute actually bumped this call, and its resulting tier — set
  // only when `leveled`, so App.tsx can log a narrative "breakthrough" beat
  // the same way class_evolution already gets one, without a silent counter.
  breakthrough?: { attr: 'STR' | 'INT' | 'AGI'; tier: number }
}

// Narrative-First Overhaul — no more derived HP/MP/ST pools to recompute on
// level-up; a Milestone now bumps whichever of STR/INT/AGI is already the
// character's highest (self-reinforcing growth — ties broken STR > INT >
// AGI), up one CompetencyTier rung per level, capped at Master. Class no
// longer carries a weight vector to derive a "primary attribute" from — a
// freeform, lore-accurate class has no such vector to give. Still a
// milestone hook, not silent bookkeeping — App.tsx logs it the same way
// class_evolution already narrates a beat.
export function applyLevelUps(player: Player, levels: number): LevelUpResult {
  if (levels <= 0) return { player, leveled: false }

  const attrKeys = ['STR', 'INT', 'AGI'] as const
  const attrs = { ...player.attrs }
  let primaryAttr: (typeof attrKeys)[number] = 'STR'
  for (let i = 0; i < levels; i++) {
    primaryAttr = attrKeys.reduce((a, b) => (attrs[a] >= attrs[b] ? a : b))
    attrs[primaryAttr] = Math.min(MAX_COMPETENCY_TIER, attrs[primaryAttr] + 1)
  }

  const nextPlayer: Player = { ...player, level: player.level + levels, attrs }
  return { player: nextPlayer, leveled: true, breakthrough: { attr: primaryAttr, tier: attrs[primaryAttr] } }
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
