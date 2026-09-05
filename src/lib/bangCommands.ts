import { slugify, titleCaseId } from './slug.ts'
import { effectiveStanding, repTierLabel } from './factions.ts'
import { checkAffordability } from './skills.ts'
import type {
  BangCommandEntry, BestiaryEntry, Campaign, EquipSlot, FactionEntry, ItemEntry, LocationEntry, LoreEntry, NpcEntry, Player, QuestEntry, SkillEntry,
} from '../types.ts'

const EQUIP_SLOTS: EquipSlot[] = ['weapon', 'armor', 'accessory']

// §6.6 Bang Commands — client-side, 0 API tokens. A bare command ("!npc") is
// pure player reference and touches nothing else. A targeted command
// ("!npc Elana") also returns `recallText`, a plain-text snapshot the caller
// folds into the *next* real turn's context — the "make the LLM remember"
// mechanism, distinct from the always-on capped Known Entities line (§3.1),
// since this is deliberate and player-invoked so it can afford to be complete.
export interface BangResult {
  entry: BangCommandEntry
  recallText: string | null
}

// Single source of truth for the command palette (autocomplete dropdown) —
// keep `name` in sync with the switch cases in resolveBangCommand below.
export const BANG_COMMANDS: { name: string; usage: string; description: string }[] = [
  { name: 'npc', usage: '!npc [name]', description: "NPC roster, or one companion's dossier" },
  { name: 'items', usage: '!items', description: 'Everything currently carried' },
  { name: 'equip', usage: '!equip [item]', description: 'Equip a weapon, armor, or accessory' },
  { name: 'unequip', usage: '!unequip [weapon|armor|accessory]', description: 'Unequip a slot' },
  { name: 'location', usage: '!location [name]', description: 'Visited locations, or one in detail' },
  { name: 'faction', usage: '!faction [name]', description: 'Known factions and standing' },
  { name: 'quests', usage: '!quests [name]', description: 'Tracked objectives, or one in detail' },
  { name: 'bestiary', usage: '!bestiary [name]', description: 'Adversaries encountered so far' },
  { name: 'skills', usage: '!skills [name]', description: 'Spells & abilities you have learned' },
  { name: 'recall', usage: '!recall', description: 'Full Codex snapshot — also reminds the AI' },
  { name: 'minions', usage: '!minions', description: 'Your current summoned army' },
  { name: 'corpses', usage: '!corpses', description: 'Harvestable slain-enemy essence (necromancer/Shadow Monarch)' },
  { name: 'arise', usage: '!arise', description: 'Dark Monarch — extract a shadow from a slain corpse' },
  { name: 'raise_skeleton', usage: '!raise_skeleton', description: 'Necromancer — reanimate skeletal infantry (1 Bone Dust)' },
  { name: 'summon', usage: '!summon', description: 'Contract Gate Summoner — call a planar familiar' },
]

const RECALL_ROW_CAP = 60

// User-typed text is never a safe regex source — this is plain normalized
// substring matching, not a regex, so there's nothing to escape or exploit.
export function findEntry<T extends { name: string }>(dict: Record<string, T> | undefined, query: string): [string, T] | null {
  const q = query.trim().toLowerCase()
  if (!dict || !q) return null

  const slug = slugify(query)
  if (dict[slug]) return [slug, dict[slug]]

  const entries = Object.entries(dict)
  const exact = entries.find(([, e]) => e.name.toLowerCase() === q)
  if (exact) return exact

  const starts = entries.find(([, e]) => e.name.toLowerCase().startsWith(q))
  if (starts) return starts

  return entries.find(([, e]) => e.name.toLowerCase().includes(q)) ?? null
}

function rowsToRecallText(title: string, rows: BangCommandEntry['rows']): string {
  if (rows.length === 0) return `${title}: none recorded yet.`
  return `${title}:\n` + rows.map((r) => `- ${r.name}: ${r.fields.join(', ')}`).join('\n')
}

function capped<T>(items: T[]): { shown: T[]; note?: string } {
  if (items.length <= RECALL_ROW_CAP) return { shown: items }
  return { shown: items.slice(-RECALL_ROW_CAP), note: `+${items.length - RECALL_ROW_CAP} more not shown` }
}

function npcRow(id: string, n: NpcEntry): BangCommandEntry['rows'][number] {
  return { name: n.name, id, category: 'npc', fields: [n.stage, `Trust ${n.trust}`, `Affection ${n.affection}`] }
}
function locationRow(id: string, l: LocationEntry, factions: Record<string, FactionEntry>): BangCommandEntry['rows'][number] {
  return { name: l.name, id, category: 'loc', fields: [l.region, `Danger: ${l.dangerLevel}`, effectiveStanding(l, factions)] }
}
function factionRow(id: string, f: FactionEntry, factions: Record<string, FactionEntry>): BangCommandEntry['rows'][number] {
  const rivalName = f.rivalId ? factions[f.rivalId]?.name : undefined
  return {
    name: f.name,
    id,
    category: 'faction',
    fields: [`Reputation ${f.repTier > 0 ? '+' : ''}${f.repTier} (${repTierLabel(f.repTier)})`, ...(rivalName ? [`Rival: ${rivalName}`] : [])],
  }
}
function questRow(id: string, q: QuestEntry): BangCommandEntry['rows'][number] {
  return { name: q.name, id, category: 'quest', fields: [q.status ?? 'active', ...(q.note ? [q.note] : [])] }
}
function bestiaryRow(id: string, b: BestiaryEntry): BangCommandEntry['rows'][number] {
  const fields = [b.threatTier]
  if (b.hpMax !== undefined) fields.push(`HP ${b.hpMax}`)
  if (b.dmgBase !== undefined) fields.push(`DMG ${b.dmgBase}`)
  return { name: b.name, id, category: 'beast', fields }
}
// §6.4D — the 0-token skill roster. Shows the §3.2 affordability read inline
// so the player can see at a glance what they can actually pay for right now.
function skillRow(id: string, s: SkillEntry, player: Player): BangCommandEntry['rows'][number] {
  const fields: string[] = []
  if (s.mpCost) fields.push(`${s.mpCost} MP`)
  if (s.stCost) fields.push(`${s.stCost} ST`)
  const { affordable, missing } = checkAffordability(s, player)
  if (!affordable) fields.push(`short ${missing}`)
  if (s.description) fields.push(s.description)
  return { name: s.name, id, category: 'skill', fields }
}
function loreRow(id: string, l: LoreEntry): BangCommandEntry['rows'][number] {
  return { name: l.name, id, category: 'lore', fields: [l.category] }
}
function statBonusText(bonus: ItemEntry['statBonus']): string | null {
  if (!bonus) return null
  const parts = Object.entries(bonus)
    .filter(([, v]) => v)
    .map(([k, v]) => `${v! > 0 ? '+' : ''}${v} ${k}`)
  return parts.length ? parts.join(' ') : null
}
function itemRow(id: string, qty: number, item: ItemEntry | undefined, equippedSlot: EquipSlot | undefined): BangCommandEntry['rows'][number] {
  const fields = [`×${qty}`, item?.type ?? 'unknown']
  const bonus = statBonusText(item?.statBonus)
  if (bonus) fields.push(bonus)
  if (equippedSlot) fields.push(`equipped (${equippedSlot})`)
  return { name: item?.name ?? id.replace(/_/g, ' '), id, fields }
}

// Bare table (no target) — pure player reference, never fed back to the model.
function tableResult(command: string, rows: BangCommandEntry['rows'], emptyNote: string): BangResult {
  return { entry: { command, rows, note: rows.length === 0 ? emptyNote : undefined }, recallText: null }
}

// Single-entry dossier — also returns recallText so the caller can remind
// the model of this specific entity on the next turn.
function dossierResult(command: string, target: string, row: BangCommandEntry['rows'][number] | null, note: string | undefined, recallTitle: string): BangResult {
  if (!row) {
    return { entry: { command, target, rows: [], note: `No ${command} matching "${target}" found.` }, recallText: null }
  }
  const entry: BangCommandEntry = { command, target, rows: [row], note }
  const recallText = `${recallTitle} — ${row.name}: ${row.fields.join(', ')}${note ? `. ${note}` : ''}`
  return { entry, recallText }
}

export function resolveBangCommand(raw: string, campaign: Campaign): BangResult | null {
  const match = /^!(\w+)\s*(.*)$/s.exec(raw.trim())
  if (!match) return null
  const [, word, rest] = match
  const target = rest.trim()
  const command = word.toLowerCase()

  switch (command) {
    case 'npc': {
      if (target) {
        const found = findEntry(campaign.npcs, target)
        const row = found ? npcRow(found[0], found[1]) : null
        const note = found?.[1].memSummary
          ? `Memory: "${found[1].memSummary}"${found[1].deeds.length ? ` | Deeds: ${found[1].deeds.join(', ')}` : ''}`
          : undefined
        return dossierResult('NPC', target, row, note, 'Known NPC')
      }
      const rows = Object.entries(campaign.npcs ?? {}).map(([id, n]) => npcRow(id, n))
      return tableResult('NPC', rows, 'No NPCs met yet.')
    }
    case 'items': {
      const equippedBy = new Map<string, EquipSlot>()
      for (const slot of EQUIP_SLOTS) {
        const id = campaign.player.equipped?.[slot]
        if (id) equippedBy.set(id, slot)
      }
      const rows = Object.entries(campaign.inventory ?? {}).map(([id, qty]) =>
        itemRow(id, qty, campaign.items?.[id], equippedBy.get(id)),
      )
      return tableResult('Items', rows, 'Nothing carried yet.')
    }
    case 'location':
    case 'locations': {
      if (target) {
        const found = findEntry(campaign.locations, target)
        const row = found ? locationRow(found[0], found[1], campaign.factions ?? {}) : null
        const note = found?.[1].description
        return dossierResult('Location', target, row, note, 'Known Location')
      }
      const rows = Object.entries(campaign.locations ?? {}).map(([id, l]) => locationRow(id, l, campaign.factions ?? {}))
      return tableResult('Location', rows, 'No locations visited yet.')
    }
    case 'faction':
    case 'factions': {
      if (target) {
        const found = findEntry(campaign.factions, target)
        const row = found ? factionRow(found[0], found[1], campaign.factions ?? {}) : null
        return dossierResult('Faction', target, row, undefined, 'Known Faction')
      }
      const rows = Object.entries(campaign.factions ?? {}).map(([id, f]) => factionRow(id, f, campaign.factions ?? {}))
      return tableResult('Faction', rows, 'No factions encountered yet.')
    }
    case 'quest':
    case 'quests': {
      if (target) {
        const found = findEntry(campaign.quests, target)
        const row = found ? questRow(found[0], found[1]) : null
        return dossierResult('Quests', target, row, undefined, 'Known Quest')
      }
      const rows = Object.entries(campaign.quests ?? {}).map(([id, q]) => questRow(id, q))
      return tableResult('Quests', rows, 'No quests tracked yet.')
    }
    case 'bestiary': {
      if (target) {
        const found = findEntry(campaign.bestiary, target)
        const row = found ? bestiaryRow(found[0], found[1]) : null
        return dossierResult('Bestiary', target, row, undefined, 'Known Adversary')
      }
      const rows = Object.entries(campaign.bestiary ?? {}).map(([id, b]) => bestiaryRow(id, b))
      return tableResult('Bestiary', rows, 'No adversaries encountered yet.')
    }
    case 'skill':
    case 'skills': {
      const player = campaign.player
      if (target) {
        const found = findEntry(campaign.skills, target)
        const row = found ? skillRow(found[0], found[1], player) : null
        return dossierResult('Skills', target, row, undefined, 'Known Skill')
      }
      const rows = Object.entries(campaign.skills ?? {}).map(([id, s]) => skillRow(id, s, player))
      return tableResult('Skills', rows, 'No skills learned yet.')
    }
    case 'minions': {
      const rows = Object.entries(campaign.minions ?? {}).map(([id, m]) => ({
        name: m.name,
        id,
        fields: [m.branch, `${m.hpMax} HP`, ...(m.mpUpkeep ? [`${m.mpUpkeep} MP/turn upkeep`] : [])],
      }))
      return tableResult('Minions', rows, 'No minions summoned yet.')
    }
    // §5.3 — corpse_add tags accumulated on the Campaign, harvestable by
    // `!arise` (Dark Monarch). Grouped by tag with a count since the same
    // adversary type is commonly slain more than once; cross-references the
    // Bestiary for a real name/threat tier where the tag matches one, since
    // corpse_add itself carries only a bare identifier tag, nothing richer.
    case 'corpses': {
      const corpses = campaign.corpses ?? []
      const counts = new Map<string, number>()
      for (const tag of corpses) counts.set(tag, (counts.get(tag) ?? 0) + 1)
      const rows = Array.from(counts.entries()).map(([tag, qty]) => {
        const beast = campaign.bestiary?.[slugify(tag)]
        return {
          name: beast?.name ?? titleCaseId(tag),
          id: tag,
          fields: [`×${qty}`, ...(beast?.threatTier ? [beast.threatTier] : [])],
        }
      })
      return tableResult('Corpses', rows, 'No harvestable corpses yet — defeat an enemy first.')
    }
    case 'recall': {
      const npcRows = capped(Object.entries(campaign.npcs ?? {}).map(([id, n]) => npcRow(id, n)))
      const locRows = capped(Object.entries(campaign.locations ?? {}).map(([id, l]) => locationRow(id, l, campaign.factions ?? {})))
      const facRows = capped(Object.entries(campaign.factions ?? {}).map(([id, f]) => factionRow(id, f, campaign.factions ?? {})))
      const questRows = capped(Object.entries(campaign.quests ?? {}).map(([id, q]) => questRow(id, q)))
      const bestRows = capped(Object.entries(campaign.bestiary ?? {}).map(([id, b]) => bestiaryRow(id, b)))
      const loreRows = capped(Object.entries(campaign.lore ?? {}).map(([id, l]) => loreRow(id, l)))

      const allRows = [...npcRows.shown, ...locRows.shown, ...facRows.shown, ...questRows.shown, ...bestRows.shown, ...loreRows.shown]
      const truncationNotes = [npcRows, locRows, facRows, questRows, bestRows, loreRows]
        .map((c) => c.note)
        .filter(Boolean)

      const recallText = [
        rowsToRecallText('NPCs', npcRows.shown),
        rowsToRecallText('Locations', locRows.shown),
        rowsToRecallText('Factions', facRows.shown),
        rowsToRecallText('Quests', questRows.shown),
        rowsToRecallText('Bestiary', bestRows.shown),
        rowsToRecallText('Lore', loreRows.shown),
      ].join('\n\n')

      return {
        entry: {
          command: 'Recall',
          rows: allRows,
          note: truncationNotes.length > 0 ? truncationNotes.join('; ') : 'Full Codex snapshot recalled for the model.',
        },
        recallText: `[Full Codex Recall]\n${recallText}`,
      }
    }
    default:
      return null
  }
}
