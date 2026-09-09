import { ensureEntry } from './autoRegister.ts'
import { slugify, titleCaseId } from './slug.ts'
import type { CompetencyTier, Dict, GameTime, NpcEntry, NpcMemoryUpdate } from '../types.ts'

// §5.5 Romance & Key Contact Memory Engine + §5.14 auto-registration.
// npc_mem_up only ever carries an id, never a display name — a title-cased
// version of it is the fallback display name when no {{Term|npc}} keyword
// link (§4.2/§5.14, lib/codex.js) has already registered a nicer one.
//
// Narrative-First Overhaul — affection and trust are two INDEPENDENT
// CompetencyTier ladders (1-5 each), never collapsed onto one shared
// relationship axis: a mercenary can respect the protagonist's competence
// (high trust) while disliking them personally (low affection). `stage`
// stays driven by affection alone, exactly as before.

const MIN_TIER: CompetencyTier = 1
const MAX_TIER: CompetencyTier = 5

export function emptyNpc(name: string): Omit<NpcEntry, 'autoLogged'> {
  return { name, affection: MIN_TIER, trust: MIN_TIER, stage: 'Stranger', deeds: [], memSummary: '', lastSeenLocId: null }
}

// Affection's existing Stranger->Beloved framing (index+1 = CompetencyTier) —
// exported so the one-time world-seeding grammar (worldSeedContract.ts) can
// ask the model for a starting relationship using these exact words too,
// rather than a separate signed numeric offset.
export const AFFECTION_STAGES = ['Stranger', 'Acquaintance', 'Friend', 'Confidant', 'Beloved']

function stageFor(affection: CompetencyTier): string {
  const idx = Math.max(MIN_TIER, Math.min(MAX_TIER, Math.round(affection))) - 1
  return AFFECTION_STAGES[idx]
}

function clampTier(v: CompetencyTier): CompetencyTier {
  return Math.max(MIN_TIER, Math.min(MAX_TIER, Math.round(v)))
}

// Applies one turn's npc_mem_up entries. `locId` tags who was present where,
// standing in for real proximity tracking (§5.5) until presence is a schema
// field of its own rather than inferred from "who got a memory update."
export function applyNpcUpdates(
  npcs: Dict<NpcEntry> | undefined,
  updates: NpcMemoryUpdate[] = [],
  locId?: string,
  time?: GameTime,
  turnRef?: string,
): Dict<NpcEntry> {
  let dict: Dict<NpcEntry> = npcs ?? {}

  for (const u of updates) {
    if (!u.npc_id) continue
    const id = slugify(u.npc_id)
    if (!id) continue

    // Same slug as a {{Term|npc}} tag would produce, so if that ran first
    // this turn (lib/codex.js), its nicer name is preserved here — this
    // factory only fires when npc_mem_up is the very first mention.
    const { dict: withEntry } = ensureEntry(dict, id, () => emptyNpc(titleCaseId(u.npc_id)), turnRef)
    dict = withEntry

    const prev = dict[id]
    // aff_delta/trust_delta are bare +1/-1 single-step nudges against each
    // ladder independently — never a raw magnitude, and each axis moves (or
    // doesn't) on its own.
    const affection = u.aff_delta ? clampTier(prev.affection + u.aff_delta) : prev.affection
    const trust = u.trust_delta ? clampTier(prev.trust + u.trust_delta) : prev.trust

    dict = {
      ...dict,
      [id]: {
        ...prev,
        affection,
        trust,
        resolve: u.resolve ?? prev.resolve,
        stage: stageFor(affection),
        deeds: u.deed ? [...prev.deeds, u.deed] : prev.deeds,
        memSummary: u.mem_summary || prev.memSummary,
        heldWeapon: u.held_weapon || prev.heldWeapon,
        wornArmor: u.worn_armor || prev.wornArmor,
        personality: u.personality || prev.personality,
        factionId: u.faction_id ?? prev.factionId,
        secretTruth: u.secret_truth || prev.secretTruth,
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
export function describePresentNpc(id: string, entry: NpcEntry): string {
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
  // id is the exact npc_id an npc_mem_up update for this person must reuse —
  // shown explicitly because the model otherwise has no ground truth for it
  // (only the display name), and will invent its own abbreviation (e.g.
  // "l_sorrengail" for "General Lilith Sorrengail") that forks a duplicate
  // stub entry instead of updating the real one.
  // Personality is restated here for the same reason gear is — a stable
  // anchor for "distinct" reactions (the <plan> tag's own line) instead of
  // the model re-improvising who this NPC is from prose memory each turn.
  // Secret is ground truth ONLY the model sees, labeled to reinforce the
  // Hidden Truths rule (turnContract.ts §2c) right where it's used, not just
  // stated once far away in the system prompt.
  const personality = entry.personality ? ` | Personality: ${entry.personality}` : ''
  const secret = entry.secretTruth ? ` | Secret (never reveal directly): "${entry.secretTruth}"` : ''
  return `NPC: ${entry.name} (id: ${id})${identity ? ` | ${identity}` : ''} | Stage: ${entry.stage} | Trust: ${trustWord(entry.trust)}${gear ? ` | ${gear}` : ''}${personality}${firstSeen} | Mem: "${entry.memSummary}"${secret}`
}

// Trust's own parallel word ladder — kept separate from affection's Stranger
// ->Beloved framing since the two axes are meant to read as genuinely
// different qualities (how much they respect/rely on the protagonist, not
// how fond they are of them).
export const TRUST_WORDS = ['Distrustful', 'Wary', 'Reliable', 'Trusted', 'Devoted']

export function trustWord(trust: CompetencyTier): string {
  const idx = Math.max(MIN_TIER, Math.min(MAX_TIER, Math.round(trust))) - 1
  return TRUST_WORDS[idx]
}

export function presentNpcs(npcs: Dict<NpcEntry> | undefined, locId: string): [string, NpcEntry][] {
  return Object.entries(npcs ?? {}).filter(([, n]) => n.lastSeenLocId === locId)
}
