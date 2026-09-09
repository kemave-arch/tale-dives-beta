import { COMPETENCY_TIERS } from './tiers.ts'
import type {
  BreakthroughUpdate, ClassEvolutionUpdate, ConditionUpdate, EffortTier, EnrichUpdate, FactionRepChange, InventoryAcquisition,
  InventoryChange, ItemType, NpcMemoryUpdate, ProjectUpdate, QuestUpdate, SkillLearn, TurnResponse, TurnState,
} from '../types.ts'
import { XmlParseError, decodeXmlEntities, num, reqNum, str, reqStr, reqTierWord, optTierWord, signToDelta, parseXmlBlock } from './xmlHelpers.ts'

// Parses the live XML grammar from xmlTurnContract.ts back into the exact
// same TurnResponse shape the old JSON path used to produce, so nothing
// downstream (applyTurn, App.tsx) needed to change to consume it — this was
// built as a drop-in alternative parser, then wired into gemini.ts's runTurn.
//
// Uses DOMParser (browser-native, no dependency) for the <sync> block, where
// attribute values are real XML and get entity-decoded automatically by the
// parser. <nar> is deliberately extracted with a raw regex instead (see
// parseXmlTurnResponse) rather than parsed as XML content, so a response cut
// off mid-generation (MAX_TOKENS) still yields whatever prose made it out
// even with an unclosed tag — the same "Fallback Reader" tolerance the old
// JSON path's extractNarrative gave. That means <nar>'s extracted text needs
// its own entity decode (decodeXmlEntities below) since it never passes
// through the real parser the way <sync>'s attributes do.
//
// The shared attribute-reader/entity-decode primitives used here now live in
// xmlHelpers.ts, alongside worldSeedParser.ts's use of the same primitives
// for the one-time world-seeding call's own <seed> grammar.
//
// Narrative-First Overhaul, Phase 2 — every fixed-vocabulary attribute
// (breakthrough tier, skill effort/tier, npc resolve, quest stat) is read
// through reqTierWord/optTierWord, which throws XmlParseError on anything
// off-vocabulary rather than silently accepting it — the actual anti-drift
// enforcement, not just a prompt-level instruction.

export const XmlTurnParseError = XmlParseError
export { decodeXmlEntities }

const EFFORT_TIERS = ['minor', 'focused', 'taxing'] as const
const PROJECT_STATS = ['advanced', 'completed', 'stalled'] as const
// A breakthrough always moves an attribute forward from wherever it already
// is — "Untrained" (rank 1, the floor) is never a valid *result*, so it's
// excluded from the tier word set breakthrough.tier is checked against,
// not just documented as a prompt-side rule.
const BREAKTHROUGH_TIERS = COMPETENCY_TIERS.filter((w) => w !== 'Untrained')

export function parseXmlTurnResponse(raw: string): TurnResponse {
  const narMatch = raw.match(/<nar>([\s\S]*?)<\/nar>/)
  if (!narMatch) throw new XmlTurnParseError('No <nar> block found')
  const nar = decodeXmlEntities(narMatch[1].trim())

  const doc = parseXmlBlock(raw, 'sync')

  const turnEl = doc.querySelector('turn')
  if (!turnEl) throw new XmlTurnParseError('No <turn> tag found inside <sync>')

  const turn_state = reqStr(turnEl.getAttribute('state'), 'turn.state') as TurnState
  const time = { d: reqNum(turnEl.getAttribute('d'), 'turn.d'), h: reqStr(turnEl.getAttribute('h'), 'turn.h') }
  const loc_id = reqStr(turnEl.getAttribute('loc'), 'turn.loc')
  // loc_disp is now optional — omitted on an ordinary same-location turn;
  // App.tsx falls back to locations[loc_id].name when it's absent.
  const loc_disp = str(turnEl.getAttribute('locdisp'))
  const loc_desc = str(turnEl.getAttribute('desc'))
  const mood = str(turnEl.getAttribute('mood'))
  const copper_delta = num(turnEl.getAttribute('c'))

  // <cond> — Condition Tag adds/removes, player by default or the current
  // combat opponent via id="enemy" (the only other valid value for "id").
  const cond_updates: ConditionUpdate[] = []
  for (const el of Array.from(doc.querySelectorAll('cond'))) {
    const target = el.getAttribute('id') === 'enemy' ? 'enemy' : 'player'
    const addLabel = str(el.getAttribute('add'))
    const remLabel = str(el.getAttribute('rem'))
    if (addLabel) {
      cond_updates.push({
        target,
        action: 'add',
        label: addLabel,
        kind: str(el.getAttribute('kind')) as ConditionUpdate['kind'],
        durationHours: num(el.getAttribute('dur_h')),
      })
    } else if (remLabel) {
      cond_updates.push({ target, action: 'remove', label: remLabel })
    } else {
      throw new XmlTurnParseError('<cond> requires either an "add" or "rem" attribute')
    }
  }

  // <item> is unified for both add and remove — whichever of add/rem is
  // present carries the item's own id (no separate id= attribute anymore).
  const inv_add: InventoryAcquisition[] = []
  const inv_rem: InventoryChange[] = []
  for (const el of Array.from(doc.querySelectorAll('item'))) {
    const addId = str(el.getAttribute('add'))
    const remId = str(el.getAttribute('rem'))
    if (remId) {
      inv_rem.push({ id: remId, qty: reqNum(el.getAttribute('qty'), 'item.qty') })
    } else if (addId) {
      const traitsRaw = str(el.getAttribute('traits'))
      inv_add.push({
        id: addId,
        name: reqStr(el.getAttribute('name'), 'item.name'),
        type: reqStr(el.getAttribute('type'), 'item.type') as ItemType,
        qty: reqNum(el.getAttribute('qty'), 'item.qty'),
        description: str(el.getAttribute('desc')),
        traits: traitsRaw ? traitsRaw.split(',').map((t) => t.trim()).filter(Boolean) : undefined,
      })
    } else {
      throw new XmlTurnParseError('<item> requires either an "add" or "rem" attribute')
    }
  }

  const corpse_add = Array.from(doc.querySelectorAll('corpse')).map((el) => reqStr(el.getAttribute('id'), 'corpse.id'))

  const breakthroughEl = doc.querySelector('breakthrough')
  const breakthrough: BreakthroughUpdate | undefined = breakthroughEl
    ? {
        attr: reqStr(breakthroughEl.getAttribute('attr'), 'breakthrough.attr') as BreakthroughUpdate['attr'],
        tier: wordToTierRank(reqTierWord(breakthroughEl.getAttribute('tier'), 'breakthrough.tier', BREAKTHROUGH_TIERS)),
      }
    : undefined

  const act = Array.from(doc.querySelectorAll('act')).map((el) => (el.textContent ?? '').trim())
  if (act.length === 0) throw new XmlTurnParseError('No <act> tags found — at least one is required')

  const flag_add = Array.from(doc.querySelectorAll('flag')).map((el) => reqStr(el.getAttribute('add'), 'flag.add'))

  const QUEST_STATS = ['advanced', 'completed', 'failed'] as const
  const questEl = doc.querySelector('quest')
  const quest_update: QuestUpdate | undefined = questEl
    ? {
        quest_id: reqStr(questEl.getAttribute('id'), 'quest.id'),
        status: reqTierWord(questEl.getAttribute('stat'), 'quest.stat', QUEST_STATS),
        type: str(questEl.getAttribute('type')) as QuestUpdate['type'],
        note: str(questEl.getAttribute('note')),
        description: str(questEl.getAttribute('desc')),
      }
    : undefined

  // <project> — mirrors <quest> exactly (same "stat" full-word convention),
  // but plural/repeatable since more than one project could plausibly
  // update in the same turn. "stage" is the 0-based index of a stage just
  // completed, meaningful only when stat="advanced".
  const project_update: ProjectUpdate[] = Array.from(doc.querySelectorAll('project')).map((el) => ({
    project_id: reqStr(el.getAttribute('id'), 'project.id'),
    stat: reqTierWord(el.getAttribute('stat'), 'project.stat', PROJECT_STATS),
    note: str(el.getAttribute('note')),
    stageIndex: num(el.getAttribute('stage')),
  }))

  const npc_mem_up: NpcMemoryUpdate[] = Array.from(doc.querySelectorAll('npc')).map((el) => {
    const resolveWord = optTierWord(el.getAttribute('resolve'), 'npc.resolve', COMPETENCY_TIERS)
    return {
      npc_id: reqStr(el.getAttribute('id'), 'npc.id'),
      aff_delta: signToDelta(el.getAttribute('aff'), 'npc.aff'),
      trust_delta: signToDelta(el.getAttribute('trust'), 'npc.trust'),
      resolve: resolveWord ? wordToTierRank(resolveWord) : undefined,
      deed: str(el.getAttribute('deed')),
      mem_summary: str(el.getAttribute('mem')),
      held_weapon: str(el.getAttribute('wld')),
      worn_armor: str(el.getAttribute('armor')),
      personality: str(el.getAttribute('personality')),
      faction_id: str(el.getAttribute('faction')),
      secret_truth: str(el.getAttribute('secret')),
    }
  })

  const classEvoEl = doc.querySelector('class_evo')
  const class_evolution: ClassEvolutionUpdate | undefined = classEvoEl
    ? { class_id: reqStr(classEvoEl.getAttribute('id'), 'class_evo.id'), reason: str(classEvoEl.getAttribute('reason')) }
    : undefined

  const fac_rep: FactionRepChange[] = Array.from(doc.querySelectorAll('fac')).map((el) => ({
    faction_id: reqStr(el.getAttribute('id'), 'fac.id'),
    delta: reqNum(el.getAttribute('delta'), 'fac.delta'),
  }))

  const skill_learn: SkillLearn[] = Array.from(doc.querySelectorAll('skill')).map((el) => {
    const effortRaw = str(el.getAttribute('effort'))
    const tierRaw = str(el.getAttribute('tier'))
    return {
      id: reqStr(el.getAttribute('id'), 'skill.id'),
      name: reqStr(el.getAttribute('name'), 'skill.name'),
      description: reqStr(el.getAttribute('desc'), 'skill.desc'),
      class_id: str(el.getAttribute('class')),
      effort: effortRaw ? (reqTierWord(el.getAttribute('effort'), 'skill.effort', EFFORT_TIERS) as EffortTier) : undefined,
      tier: tierRaw ? wordToTierRank(reqTierWord(el.getAttribute('tier'), 'skill.tier', COMPETENCY_TIERS)) : undefined,
    }
  })

  // <enrich lore="ID" desc="..."> / <enrich beast="ID" desc="..."> — the
  // entity type IS the attribute key, so exactly one of lore/beast must be
  // present per tag (a stricter, regex-level check for free vs. a separate
  // type= + id= pair).
  const enrich: EnrichUpdate[] = Array.from(doc.querySelectorAll('enrich')).map((el) => {
    const loreId = str(el.getAttribute('lore'))
    const beastId = str(el.getAttribute('beast'))
    if (loreId) return { kind: 'lore', id: loreId, desc: reqStr(el.getAttribute('desc'), 'enrich.desc') }
    if (beastId) return { kind: 'beast', id: beastId, desc: reqStr(el.getAttribute('desc'), 'enrich.desc') }
    throw new XmlTurnParseError('<enrich> requires either a "lore" or "beast" attribute')
  })

  return {
    nar,
    turn_state,
    time,
    loc_id,
    loc_disp,
    loc_desc,
    mood,
    copper_delta,
    cond_updates: cond_updates.length ? cond_updates : undefined,
    inv_add: inv_add.length ? inv_add : undefined,
    inv_rem: inv_rem.length ? inv_rem : undefined,
    corpse_add: corpse_add.length ? corpse_add : undefined,
    breakthrough,
    act,
    flag_add: flag_add.length ? flag_add : undefined,
    quest_update,
    project_update: project_update.length ? project_update : undefined,
    npc_mem_up: npc_mem_up.length ? npc_mem_up : undefined,
    class_evolution,
    fac_rep: fac_rep.length ? fac_rep : undefined,
    skill_learn: skill_learn.length ? skill_learn : undefined,
    enrich: enrich.length ? enrich : undefined,
  }
}

// Canonical word -> 1-based rank, scoped to COMPETENCY_TIERS — thin wrapper
// so the call sites above read as "the word, converted" rather than
// re-importing wordToTier directly for a single fixed scale.
function wordToTierRank(word: string): number {
  return COMPETENCY_TIERS.findIndex((w) => w.toLowerCase() === word.toLowerCase()) + 1
}
