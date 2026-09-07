import type { Player, TurnResponse } from '../types.ts'

// Client-side Shadow Referee — Blueprint §3.2. Gemini proposes, this
// validates. Narrative-First Overhaul: TACTICAL mode and the numeric hp/mp/
// st pools it used to reconcile are both gone — combat is fully narrative-
// adjudicated now, and vitals are Condition Tags (lib/conditions.ts),
// applied directly in App.tsx alongside every other Codex-shaped update
// rather than through this module. All that's left here is the one
// remaining numeric channel (currency) — kept as its own small module
// rather than folded into App.tsx directly so the "client, not the model,
// owns the actually-applied numbers" boundary this module has always
// represented stays a single, named place. loc_id/loc_disp resolution moved
// to App.tsx's own turn loop, since the optional-loc_disp fallback (falling
// back to the Locations registry's own name) needs the campaign's
// `locations` dict, which this module deliberately has no access to.
export function applyTurn(player: Player, turn: TurnResponse): Player {
  return { ...player, copper: Math.max(0, player.copper + (turn.copper_delta ?? 0)) }
}
