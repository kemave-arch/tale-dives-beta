import type {
  ClassEvolutionUpdate, FactionRepChange, InventoryAcquisition, InventoryChange, ItemType,
  NpcMemoryUpdate, QuestUpdate, SkillLearn, StatGrant, TurnDelta, TurnResponse, TurnState,
} from '../types.ts'
import { XmlParseError, decodeXmlEntities, num, reqNum, str, reqStr, parseXmlBlock, parseStatBonus } from './xmlHelpers.ts'

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

export const XmlTurnParseError = XmlParseError
export { decodeXmlEntities }

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
  const loc_disp = reqStr(turnEl.getAttribute('locdisp'), 'turn.locdisp')
  const loc_desc = str(turnEl.getAttribute('desc'))
  const distRaw = str(turnEl.getAttribute('dist'))
  const dist = distRaw as TurnResponse['dist']
  const mood = str(turnEl.getAttribute('mood'))

  const deltasEl = doc.querySelector('deltas')
  const deltas: TurnDelta | undefined = deltasEl
    ? {
        hp: num(deltasEl.getAttribute('hp')),
        mp: num(deltasEl.getAttribute('mp')),
        st: num(deltasEl.getAttribute('st')),
        c: num(deltasEl.getAttribute('c')),
      }
    : undefined

  // <item> is unified for both add and remove — rem="1" (checked via
  // hasAttribute, not the value, so any truthy marker works) signals a
  // removal, in which case only id/qty are read; everything else assumes
  // an acquisition and requires name/type/qty.
  const inv_add: InventoryAcquisition[] = []
  const inv_rem: InventoryChange[] = []
  for (const el of Array.from(doc.querySelectorAll('item'))) {
    if (el.hasAttribute('rem')) {
      inv_rem.push({ id: reqStr(el.getAttribute('id'), 'item.id'), qty: reqNum(el.getAttribute('qty'), 'item.qty') })
      continue
    }
    const bonus = str(el.getAttribute('bonus'))
    inv_add.push({
      id: reqStr(el.getAttribute('id'), 'item.id'),
      name: reqStr(el.getAttribute('name'), 'item.name'),
      type: reqStr(el.getAttribute('type'), 'item.type') as ItemType,
      qty: reqNum(el.getAttribute('qty'), 'item.qty'),
      description: str(el.getAttribute('desc')),
      statBonus: bonus ? parseStatBonus(bonus) : undefined,
    })
  }

  const corpse_add = Array.from(doc.querySelectorAll('corpse')).map((el) => reqStr(el.getAttribute('id'), 'corpse.id'))

  const statGrantEl = doc.querySelector('stat_grant')
  const stat_grant: StatGrant | undefined = statGrantEl
    ? {
        attr: str(statGrantEl.getAttribute('attr')) as StatGrant['attr'],
        pool: str(statGrantEl.getAttribute('pool')) as StatGrant['pool'],
        amount: reqNum(statGrantEl.getAttribute('amount'), 'stat_grant.amount'),
      }
    : undefined

  const act = Array.from(doc.querySelectorAll('act')).map((el) => (el.textContent ?? '').trim())
  if (act.length === 0) throw new XmlTurnParseError('No <act> tags found — at least one is required')

  const flag_add = Array.from(doc.querySelectorAll('flag')).map((el) => reqStr(el.getAttribute('add'), 'flag.add'))

  const questEl = doc.querySelector('quest')
  const quest_update: QuestUpdate | undefined = questEl
    ? {
        quest_id: reqStr(questEl.getAttribute('id'), 'quest.id'),
        status: reqStr(questEl.getAttribute('status'), 'quest.status') as QuestUpdate['status'],
        type: str(questEl.getAttribute('type')) as QuestUpdate['type'],
        note: str(questEl.getAttribute('note')),
        description: str(questEl.getAttribute('desc')),
      }
    : undefined

  const npc_mem_up: NpcMemoryUpdate[] = Array.from(doc.querySelectorAll('npc')).map((el) => ({
    npc_id: reqStr(el.getAttribute('id'), 'npc.id'),
    aff_delta: num(el.getAttribute('aff')),
    trust_delta: num(el.getAttribute('trust')),
    deed: str(el.getAttribute('deed')),
    mem_summary: str(el.getAttribute('mem')),
    held_weapon: str(el.getAttribute('wld')),
    worn_armor: str(el.getAttribute('armor')),
  }))

  const classEvoEl = doc.querySelector('class_evo')
  const class_evolution: ClassEvolutionUpdate | undefined = classEvoEl
    ? { class_id: reqStr(classEvoEl.getAttribute('id'), 'class_evo.id'), reason: str(classEvoEl.getAttribute('reason')) }
    : undefined

  const fac_rep: FactionRepChange[] = Array.from(doc.querySelectorAll('fac')).map((el) => ({
    faction_id: reqStr(el.getAttribute('id'), 'fac.id'),
    delta: reqNum(el.getAttribute('delta'), 'fac.delta'),
  }))

  const skill_learn: SkillLearn[] = Array.from(doc.querySelectorAll('skill')).map((el) => ({
    id: reqStr(el.getAttribute('id'), 'skill.id'),
    name: reqStr(el.getAttribute('name'), 'skill.name'),
    description: reqStr(el.getAttribute('desc'), 'skill.desc'),
    class_id: str(el.getAttribute('class')),
    mp_cost: num(el.getAttribute('mp')),
    st_cost: num(el.getAttribute('st')),
  }))

  return {
    nar,
    turn_state,
    time,
    loc_disp,
    loc_id,
    loc_desc,
    dist,
    mood,
    deltas,
    inv_add: inv_add.length ? inv_add : undefined,
    inv_rem: inv_rem.length ? inv_rem : undefined,
    corpse_add: corpse_add.length ? corpse_add : undefined,
    stat_grant,
    act,
    flag_add: flag_add.length ? flag_add : undefined,
    quest_update,
    npc_mem_up: npc_mem_up.length ? npc_mem_up : undefined,
    class_evolution,
    fac_rep: fac_rep.length ? fac_rep : undefined,
    skill_learn: skill_learn.length ? skill_learn : undefined,
  }
}
