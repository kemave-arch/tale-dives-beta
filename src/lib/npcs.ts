import { ensureEntry } from './autoRegister.ts'
import { slugify, titleCaseId } from './slug.ts'
import type { Dict, GameTime, NpcEntry, NpcMemoryUpdate } from '../types.ts'

// §5.5 Romance & Key Contact Memory Engine + §5.14 auto-registration.
// npc_mem_up only ever carries an id, never a display name — a title-cased
// version of it is the fallback display name when no {{Term|npc}} keyword
// link (§4.2/§5.14, lib/codex.js) has already registered a nicer one.

export function emptyNpc(name: string): Omit<NpcEntry, 'autoLogged'> {
  return { name, affection: 0, trust: 0, stage: 'Stranger', deeds: [], memSummary: '', lastSeenLocId: null }
}

const STAGES = [
  { max: 20, label: 'Stranger' },
  { max: 40, label: 'Acquaintance' },
  { max: 60, label: 'Friend' },
  { max: 80, label: 'Confidant' },
  { max: Infinity, label: 'Beloved' },
]

function stageFor(affection: number): string {
  return STAGES.find((s) => affection <= s.max)!.label
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v))
}

// Applies one turn's npc_mem_up entries. `locId` tags who was present where,
// standing in for real proximity tracking (§5.5) until presence is a schema
// field of its own rather than inferred from "who got a memory update."
export function applyNpcUpdates(
  npcs: Dict<NpcEntry> | undefined,
  updates: NpcMemoryUpdate[] = [],
  locId?: string,
  time?: GameTime,
): Dict<NpcEntry> {
  let dict: Dict<NpcEntry> = npcs ?? {}

  for (const u of updates) {
    if (!u.npc_id) continue
    const id = slugify(u.npc_id)
    if (!id) continue

    // Same slug as a {{Term|npc}} tag would produce, so if that ran first
    // this turn (lib/codex.js), its nicer name is preserved here — this
    // factory only fires when npc_mem_up is the very first mention.
    const { dict: withEntry } = ensureEntry(dict, id, () => emptyNpc(titleCaseId(u.npc_id)))
    dict = withEntry

    const prev = dict[id]
    const affection = clamp(prev.affection + (u.aff_delta ?? 0), 0, 100)
    const trust = clamp(prev.trust + (u.trust_delta ?? 0), 0, 100)

    dict = {
      ...dict,
      [id]: {
        ...prev,
        affection,
        trust,
        stage: stageFor(affection),
        deeds: u.deed ? [...prev.deeds, u.deed] : prev.deeds,
        memSummary: u.mem_summary || prev.memSummary,
        heldWeapon: u.held_weapon || prev.heldWeapon,
        wornArmor: u.worn_armor || prev.wornArmor,
        lastSeenLocId: locId ?? prev.lastSeenLocId,
        // Set-once, decoupled from ensureEntry's `created` flag: a {{Term|npc}}
        // tag frequently registers the dict entry first (same turn, before
        // npc_mem_up runs), so gating on "did npc_mem_up itself create this
        // entry" would almost always miss the real first encounter.
        firstSeenTime: prev.firstSeenTime ?? time,
        lastSeenTime: time ?? prev.lastSeenTime,
      },
    }
  }

  return dict
}

// §3.1 "Present NPCs" line — only for NPCs last seen at the active location,
// so an absent NPC costs 0 context tokens (§5.5 Proximity Slicing). Gender/age
// only append when the player has set them via Codex CRUD — otherwise 0 cost,
// and correct pronoun/age-appropriate behavior is left to the model's own
// judgment exactly as it was before these fields existed.
export function describePresentNpc(entry: NpcEntry): string {
  // Role is the same stable anchor a real title-carrying NPC record would be —
  // "Kaelen" and "Stone-Gait Sentry" reading as the same person is a narration
  // problem this can't force, but showing it back every turn at least gives
  // the model a consistent handle to check its own naming against.
  const identity = [
    entry.role && `Role: ${entry.role}`,
    entry.gender && `Gender: ${entry.gender}`,
    entry.age !== undefined && `Age: ${entry.age}`,
  ]
    .filter(Boolean)
    .join(' | ')
  const gear = [entry.heldWeapon && `Wielding: ${entry.heldWeapon}`, entry.wornArmor && `Wearing: ${entry.wornArmor}`]
    .filter(Boolean)
    .join(' | ')
  // First Seen anchors the same anti-drift check as describeKnownLocation's.
  const firstSeen = entry.firstSeenTime ? ` | First Seen: Day ${entry.firstSeenTime.d} ${entry.firstSeenTime.h}` : ''
  return `NPC: ${entry.name}${identity ? ` | ${identity}` : ''} | Stage: ${entry.stage} | Trust: ${entry.trust}${gear ? ` | ${gear}` : ''}${firstSeen} | Mem: "${entry.memSummary}"`
}

export function presentNpcs(npcs: Dict<NpcEntry> | undefined, locId: string): NpcEntry[] {
  return Object.values(npcs ?? {}).filter((n) => n.lastSeenLocId === locId)
}
