import { isTimeReached } from './gameTime.ts'
import { ensureEntry } from './autoRegister.ts'
import { titleCaseId } from './slug.ts'
import type { Dict, GameTime, ProjectEntry, ProjectUpdate } from '../types.ts'

// §7 Projects — a broader multi-stage endeavor tracker (city construction,
// equipment repair, any long-running narrative undertaking), generalizing
// the existing recipe-based Crafting system per the user's own construction/
// satellite-repair example. Deliberately a SEPARATE, simpler system living
// alongside `lib/crafting.ts`/`data/recipes.ts` (both untouched) rather than
// a rewrite of them — Crafting stays the narrow "spend materials, wait N
// hours, collect output" queue; Projects is the open-ended "track stages,
// prerequisites, and a possible ETA, narrated forward by the LLM" registry.

// Applies a turn's project_update entries (if any) into the Projects Codex —
// mirrors lib/quests.ts's applyQuestUpdate shape exactly (same `stat` key
// convention). project_update only ever carries an id, never a display name
// — same title-cased fallback pattern as an unknown quest_id/npc_id when no
// prior mention has already registered a nicer one (there's no {{Term|...}}
// keyword-link category for Projects, so a fresh project_id always mints a
// bare stub here).
export function applyProjectUpdate(
  projects: Dict<ProjectEntry> | undefined,
  updates: ProjectUpdate[] | undefined,
  turnRef?: string,
): Dict<ProjectEntry> {
  let dict = projects ?? {}
  if (!updates?.length) return dict

  for (const update of updates) {
    if (!update?.project_id) continue
    const { dict: withStub } = ensureEntry(dict, update.project_id, () => ({ name: titleCaseId(update.project_id), stages: [] }), turnRef)
    dict = withStub

    const existing = dict[update.project_id]
    let stages = existing.stages
    if (update.stat === 'advanced' && update.stageIndex !== undefined && stages[update.stageIndex]) {
      stages = stages.map((s, i) => (i === update.stageIndex ? { ...s, done: true } : s))
    }

    // ProjectUpdate.stat's "advanced" (mirroring Quest's own vocabulary) maps
    // onto ProjectEntry.status's "active" — the two enums describe the same
    // three states from two different angles (an update event vs. a resting
    // status), so this is the one place they need reconciling.
    const status: ProjectEntry['status'] = update.stat === 'advanced' ? 'active' : update.stat

    dict = {
      ...dict,
      [update.project_id]: {
        ...existing,
        status,
        note: update.note ?? existing.note,
        stages,
      },
    }
  }

  return dict
}

// The "not yet ready, so I can't do such-and-such" gating primitive the user
// explicitly asked for — a pure read, no state mutation (unlike crafting
// jobs, a Project never auto-completes/auto-pays-out on a timer; completion
// is always an explicit LLM-narrated `stat: 'completed'` update). Reuses
// isTimeReached exactly like lib/crafting.ts's resolveCraftingJobs does.
export function isProjectReady(project: ProjectEntry, currentTime: GameTime): boolean {
  if (!project.eta) return true
  return isTimeReached(currentTime, project.eta)
}
