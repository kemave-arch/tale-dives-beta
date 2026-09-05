import type {
  ClassEvolutionUpdate, FactionRepChange, InventoryAcquisition, InventoryChange, ItemType,
  NpcMemoryUpdate, QuestUpdate, SkillLearn, StatBonus, StatGrant, TurnDelta, TurnResponse, TurnState,
} from '../types.ts'

// PROTOTYPE — parses the XML grammar from xmlTurnContract.ts back into the
// exact same TurnResponse shape gemini.ts's JSON path already produces, so
// nothing downstream (applyTurn, App.tsx) needs to change to consume it —
// this is a drop-in alternative parser, not a new pipeline.
//
// Uses DOMParser (browser-native, no dependency) same as the reference
// manual's own approach — but unlike that manual, every field mapped here
// corresponds to a real TurnResponse field, checked against types.ts.

export class XmlTurnParseError extends Error {}

function num(v: string | null): number | undefined {
  if (v === null || v === '') return undefined
  const n = Number(v)
  return Number.isFinite(n) ? n : undefined
}

function reqNum(v: string | null, field: string): number {
  const n = num(v)
  if (n === undefined) throw new XmlTurnParseError(`Missing/invalid required numeric attribute: ${field}`)
  return n
}

function str(v: string | null): string | undefined {
  return v === null || v === '' ? undefined : v
}

function reqStr(v: string | null, field: string): string {
  const s = str(v)
  if (s === undefined) throw new XmlTurnParseError(`Missing required attribute: ${field}`)
  return s
}

export function parseXmlTurnResponse(raw: string): TurnResponse {
  const narMatch = raw.match(/<nar>([\s\S]*?)<\/nar>/)
  if (!narMatch) throw new XmlTurnParseError('No <nar> block found')
  const nar = narMatch[1].trim()

  const syncMatch = raw.match(/<sync>([\s\S]*?)<\/sync>/)
  if (!syncMatch) throw new XmlTurnParseError('No <sync> block found')

  const doc = new DOMParser().parseFromString(`<root>${syncMatch[1]}</root>`, 'text/xml')
  const parseError = doc.querySelector('parsererror')
  if (parseError) throw new XmlTurnParseError(`Malformed <sync> XML: ${parseError.textContent}`)

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

  const inv_add: InventoryAcquisition[] = Array.from(doc.querySelectorAll('inv_add')).map((el) => {
    const bonus = str(el.getAttribute('bonus'))
    return {
      id: reqStr(el.getAttribute('id'), 'inv_add.id'),
      name: reqStr(el.getAttribute('name'), 'inv_add.name'),
      type: reqStr(el.getAttribute('type'), 'inv_add.type') as ItemType,
      qty: reqNum(el.getAttribute('qty'), 'inv_add.qty'),
      description: str(el.getAttribute('desc')),
      statBonus: bonus ? parseStatBonus(bonus) : undefined,
    }
  })

  const inv_rem: InventoryChange[] = Array.from(doc.querySelectorAll('inv_rem')).map((el) => ({
    id: reqStr(el.getAttribute('id'), 'inv_rem.id'),
    qty: reqNum(el.getAttribute('qty'), 'inv_rem.qty'),
  }))

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

// "+2 AGI, +5 MP" -> { AGI: 2, mp: 5 }. Same freeform format the JSON path's
// stat_bonus already normalizes case for (STR/INT/AGI uppercase, hp/mp/st lowercase).
function parseStatBonus(text: string): StatBonus {
  const bonus: StatBonus = {}
  const attrKeys: (keyof StatBonus)[] = ['STR', 'INT', 'AGI', 'hp', 'mp', 'st']
  for (const part of text.split(',')) {
    const match = part.trim().match(/^([+-]?\d+)\s*(\w+)$/)
    if (!match) continue
    const [, amountStr, key] = match
    const found = attrKeys.find((k) => k.toLowerCase() === key.toLowerCase())
    if (found) bonus[found] = Number(amountStr)
  }
  return bonus
}
