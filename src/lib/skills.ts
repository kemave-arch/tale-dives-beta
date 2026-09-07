import { ensureEntry } from './autoRegister.ts'
import { slugify } from './slug.ts'
import { isHidden } from './discovery.ts'
import type { Dict, Player, SkillEntry, SkillLearn } from '../types.ts'

// §6.4D Codex category 6 — Skills (Spells & Abilities). Two ways an entry
// gets here, mirroring how NPCs/Locations already work:
//   - a {{Term|skill}} keyword link in prose auto-registers a bare stub
//     (lib/codex.ts), costing nothing extra; and
//   - `skill_learn` on the turn response carries the real record (effort,
//     owning class, description) for a skill the protagonist actually gains.
// The stub path is why every field past `name` is optional — a skill is
// routinely mentioned long before it has agreed particulars.

export function emptySkill(name: string): Omit<SkillEntry, 'autoLogged'> {
  return { name }
}

// A learned skill overwrites a stub's blank fields but never clobbers a value
// the player has since hand-authored via Codex CRUD with `undefined` — the
// model re-teaching a known skill shouldn't silently erase its edited details.
export function applySkillLearn(skills: Dict<SkillEntry> | undefined, learned: SkillLearn[] | undefined, turnRef?: string): Dict<SkillEntry> {
  if (!learned?.length) return skills ?? {}
  let dict = skills ?? {}

  for (const s of learned) {
    const id = slugify(s.id || s.name)
    if (!id) continue

    dict = ensureEntry(dict, id, () => emptySkill(s.name), turnRef).dict
    const prev = dict[id]
    dict = {
      ...dict,
      [id]: {
        ...prev,
        name: s.name || prev.name,
        description: s.description ?? prev.description,
        classId: s.class_id ?? prev.classId,
        effort: s.effort ?? prev.effort,
        tier: s.tier ?? prev.tier,
      },
    }
  }

  return dict
}

export interface SkillAffordability {
  skill: SkillEntry
  affordable: boolean
  missing: string // e.g. "strained by Exhausted" — empty when affordable
}

// Condition labels that read as a real physical/mental strain on the
// protagonist — a "taxing" skill is advisable to narrate as harder (or
// backfiring) while one of these is active. Deliberately a small, readable
// substring match rather than a closed enum: new condition names the model
// invents (COMMON_CONDITIONS' 'narrative' fallback, lib/conditions.ts) still
// register here as long as they read as strain-flavored.
const STRAIN_PATTERN = /exhausted|wounded|bleeding|drained|winded|nauseated|dazed|stunned/i

// §3.2 Skill Affordability — a pure client-side read of whether the player can
// currently pay for a skill. Deliberately NOT a gate: the rule is that the
// check always runs, but its job is to tell the narrator whether to describe
// a successful cast or a strained one, never to refuse the player's action
// outright. A skill with no declared `effort` is always affordable (see the
// SkillEntry comment on why that field is optional). Narrative-First
// Overhaul: judged against the player's active Condition Tags rather than a
// numeric MP/ST pool — only a "taxing" skill is ever flagged, and only while
// a strain-flavored condition is active.
export function checkAffordability(skill: SkillEntry, player: Player): SkillAffordability {
  if (skill.effort !== 'taxing') return { skill, affordable: true, missing: '' }
  const strained = (player.conditions ?? []).filter((c) => STRAIN_PATTERN.test(c.label))
  if (strained.length === 0) return { skill, affordable: true, missing: '' }
  return { skill, affordable: false, missing: `strained by ${strained.map((c) => c.label).join(', ')}` }
}

// Finds a known, already-discovered skill the player's typed action names, so
// the turn's context slice can carry an affordability note. Longest name first
// so "Greater Heal" wins over "Heal" when both exist. Hidden skills (§5.12)
// are skipped — the player isn't supposed to know they have them yet.
export function findInvokedSkill(action: string, skills: Dict<SkillEntry> | undefined): SkillEntry | null {
  if (!action || !skills) return null
  const lower = action.toLowerCase()
  const candidates = Object.values(skills)
    .filter((s) => s.name && !isHidden(s))
    .sort((a, b) => b.name.length - a.name.length)
  return candidates.find((s) => lower.includes(s.name.toLowerCase())) ?? null
}
