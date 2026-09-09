import type { Dict, EventUpdate, NarrativeEvent, TurnResponse } from '../types.ts'

// §9 Narrative Events — condition-triggered story complications/scenes,
// checked entirely client-side at zero LLM cost. Mirrors lib/discovery.ts's
// own matchesReveal/revealDict pattern exactly (same RevealTrigger
// vocabulary, same "check this turn's deltas" approach) since a Narrative
// Event's own dormant->active transition is conceptually identical to a
// Discovery's hidden->known reveal — just applied to a story beat instead
// of a Codex entry.
function matchesTrigger(event: NarrativeEvent, turn: TurnResponse, nextFlags: string[]): boolean {
  if (!event.trigger) return false
  switch (event.trigger) {
    case 'flag':
      return !!event.condition && nextFlags.includes(event.condition)
    case 'location_visit':
      return !!event.condition && turn.loc_id === event.condition
    case 'npc_met':
      return !!event.condition && (turn.npc_mem_up?.some((u) => u.npc_id === event.condition) ?? false)
    case 'quest_complete':
      return !!event.condition && turn.quest_update?.quest_id === event.condition && turn.quest_update.status === 'completed'
    case 'story':
      return turn.event_trips?.includes(event.id) ?? false
    case 'manual':
      return false // only the player, via CRUD, ever activates a manual-trigger event
  }
}

export interface NarrativeEventCheckResult {
  events: Dict<NarrativeEvent> | undefined
  activated: NarrativeEvent[]
}

// Runs once per turn, alongside discovery.ts's checkCodexReveals, against
// this turn's already-merged flag list (so a `flag`-trigger event fires the
// same turn the flag itself lands, not one turn late).
export function checkNarrativeEventTriggers(
  events: Dict<NarrativeEvent> | undefined,
  turn: TurnResponse,
  nextFlags: string[],
): NarrativeEventCheckResult {
  if (!events) return { events, activated: [] }
  const activated: NarrativeEvent[] = []
  for (const event of Object.values(events)) {
    if (event.status !== 'dormant') continue
    if (matchesTrigger(event, turn, nextFlags)) activated.push(event)
  }
  if (!activated.length) return { events, activated }

  const next: Dict<NarrativeEvent> = { ...events }
  for (const e of activated) next[e.id] = { ...next[e.id], status: 'active' }
  return { events: next, activated }
}

// §9 — mirrors lib/beats.ts's applyBeatUpdate exactly: a Narrative Event is
// never LLM-originated (activation is the client's own trigger check above,
// never the model's call), so an unrecognized event_id — or one that isn't
// currently 'active' — is a no-op rather than a fabricated event.
export function applyEventUpdate(events: Dict<NarrativeEvent> | undefined, update: EventUpdate | undefined): Dict<NarrativeEvent> | undefined {
  if (!events || !update?.event_id) return events
  const existing = events[update.event_id]
  if (!existing || existing.status !== 'active') return events
  return { ...events, [update.event_id]: { ...existing, status: 'completed' } }
}
