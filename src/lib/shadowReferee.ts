import type { Player, TurnResponse } from '../types.ts'

// Client-side Shadow Referee — Blueprint §3.2. Gemini proposes, this validates.

// §5.1d/§8 item 7: soft-cap share of a max pool a single narrated turn can move.
// Placeholder tunable — revisit once real playtesting shows the right feel.
const NARRATIVE_MAGNITUDE_CAP = 0.5

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function boundedDelta(delta: number | undefined, max: number): number {
  if (!delta) return 0
  const cap = Math.round(max * NARRATIVE_MAGNITUDE_CAP)
  return clamp(delta, -cap, cap)
}

export interface TacticalOverride {
  hpDelta?: number
  stDelta?: number
}

export interface ApplyTurnResult {
  player: Player
  defeated: boolean
}

// `tacticalOverride` — §3.2 Combat Math Ownership: in Tactical Mode the
// client precomputes hp/st before the prompt ever goes out, so whatever
// Gemini emits in `deltas` for those fields is ignored outright rather than
// bounds-checked, exactly matching "overwritten if they disagree."
export function applyTurn(player: Player, turn: TurnResponse, tacticalOverride?: TacticalOverride): ApplyTurnResult {
  const deltas = turn.deltas ?? {}
  const next: Player = { ...player }

  const hpDelta = tacticalOverride?.hpDelta ?? boundedDelta(deltas.hp, player.hpMax)
  const stDelta = tacticalOverride?.stDelta ?? boundedDelta(deltas.st, player.stMax)

  next.hp = clamp(player.hp + hpDelta, 0, player.hpMax)
  next.mp = clamp(player.mp + boundedDelta(deltas.mp, player.mpMax), 0, player.mpMax)
  next.st = clamp(player.st + stDelta, 0, player.stMax)
  next.copper = Math.max(0, player.copper + (deltas.c ?? 0))

  if (turn.loc_id) next.locId = turn.loc_id
  if (turn.loc_disp) next.locDisp = turn.loc_disp

  return { player: next, defeated: next.hp <= 0 }
}
