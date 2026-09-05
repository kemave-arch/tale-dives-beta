import type {
  ClassEvolutionUpdate, FactionRepChange, InventoryAcquisition, InventoryChange, ItemType,
  NpcMemoryUpdate, QuestUpdate, SkillLearn, StatBonus, StatGrant, TurnDelta, TurnResponse, TurnState,
} from '../types.ts'

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

export class XmlTurnParseError extends Error {}

const XML_ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }

// Handles the 5 predefined XML entities plus numeric character references
// (&#39; / &#x27;) — the model is only instructed to escape literal &, but
// decoding the full set is defensive in case it over-escapes.
export function decodeXmlEntities(text: string): string {
  return text.replace(/&(#x?[0-9a-fA-F]+|\w+);/g, (full, code: string) => {
    if (code[0] === '#') {
      const codepoint = code[1] === 'x' || code[1] === 'X' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10)
      return Number.isFinite(codepoint) ? String.fromCodePoint(codepoint) : full
    }
    return XML_ENTITIES[code] ?? full
  })
}

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
  const nar = decodeXmlEntities(narMatch[1].trim())

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
