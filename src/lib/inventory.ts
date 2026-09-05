import type { Dict, EquipSlot, InventoryAcquisition, InventoryChange, ItemEntry, Player, StatBonus } from '../types.ts'
import { derivedPools } from './derivedStats.ts'

export interface InventoryResult {
  inventory: Dict<number>
  items: Dict<ItemEntry>
}

// §5.9/§3.2 Inventory Sanity Check — inv_add creates or increments; inv_rem
// for an item the player doesn't (fully) own is clamped rather than driven
// negative, and a fully-removed item's entry is dropped rather than left at
// 0. `items` is the item Codex (name/type/description/statBonus) — an
// acquisition's metadata is upserted alongside the quantity bump, atomically,
// so an item can never be "in inventory" with no name to show for it.
export function applyInventoryChanges(
  inventory: Dict<number> | undefined,
  items: Dict<ItemEntry> | undefined,
  add: InventoryAcquisition[] = [],
  remove: InventoryChange[] = [],
): InventoryResult {
  const nextInventory: Dict<number> = { ...(inventory ?? {}) }
  const nextItems: Dict<ItemEntry> = { ...(items ?? {}) }

  for (const item of add) {
    if (!item.id) continue
    nextInventory[item.id] = (nextInventory[item.id] ?? 0) + Math.max(1, item.qty ?? 1)
    if (item.name && item.type) {
      const existing = nextItems[item.id]
      nextItems[item.id] = {
        ...existing,
        name: item.name,
        type: item.type,
        description: item.description ?? existing?.description,
        statBonus: item.statBonus ?? existing?.statBonus,
      }
    }
  }

  for (const item of remove) {
    if (!item.id || !nextInventory[item.id]) continue
    const qty = Math.max(0, nextInventory[item.id] - Math.max(1, item.qty ?? 1))
    if (qty === 0) delete nextInventory[item.id]
    else nextInventory[item.id] = qty
  }

  return { inventory: nextInventory, items: nextItems }
}

function applyStatBonus(player: Player, bonus: StatBonus, sign: 1 | -1): Player {
  const attrDelta = { STR: (bonus.STR ?? 0) * sign, INT: (bonus.INT ?? 0) * sign, AGI: (bonus.AGI ?? 0) * sign }
  const hasAttrDelta = attrDelta.STR || attrDelta.INT || attrDelta.AGI

  let next = player
  if (hasAttrDelta) {
    const nextAttrs = { STR: player.attrs.STR + attrDelta.STR, INT: player.attrs.INT + attrDelta.INT, AGI: player.attrs.AGI + attrDelta.AGI }
    const pools = derivedPools(nextAttrs)
    next = {
      ...player,
      attrs: nextAttrs,
      hpMax: pools.hpMax,
      hp: Math.min(pools.hpMax, player.hp + (pools.hpMax - player.hpMax)),
      mpMax: pools.mpMax,
      mp: Math.min(pools.mpMax, player.mp + (pools.mpMax - player.mpMax)),
      stMax: pools.stMax,
      st: Math.min(pools.stMax, player.st + (pools.stMax - player.stMax)),
    }
  }

  const hpDelta = (bonus.hp ?? 0) * sign
  const mpDelta = (bonus.mp ?? 0) * sign
  const stDelta = (bonus.st ?? 0) * sign
  if (hpDelta || mpDelta || stDelta) {
    next = {
      ...next,
      hpMax: next.hpMax + hpDelta,
      hp: Math.max(0, Math.min(next.hpMax + hpDelta, next.hp + hpDelta)),
      mpMax: next.mpMax + mpDelta,
      mp: Math.max(0, Math.min(next.mpMax + mpDelta, next.mp + mpDelta)),
      stMax: next.stMax + stDelta,
      st: Math.max(0, Math.min(next.stMax + stDelta, next.st + stDelta)),
    }
  }

  return next
}

// §5.9 Equip/Unequip — deterministic and entirely client-resolved (a `!equip`
// bang command, not a schema field), same architectural family as `!arise`/
// `!summon`: no narrative ambiguity for the model to arbitrate, so there's no
// reason to spend a turn on it. Swapping a slot's existing item out reverses
// its bonus before applying the new one's.
export function equipItem(player: Player, items: Dict<ItemEntry>, itemId: string, slot: EquipSlot): { player: Player; error?: string } {
  const item = items[itemId]
  if (!item) return { player, error: `No known item "${itemId}".` }
  if (item.type !== slot) return { player, error: `${item.name} is a ${item.type}, not ${slot === 'weapon' ? 'a' : 'an'} ${slot}.` }

  let next = player
  const currentId = player.equipped?.[slot]
  if (currentId && currentId !== itemId) {
    const current = items[currentId]
    if (current?.statBonus) next = applyStatBonus(next, current.statBonus, -1)
  }
  if (item.statBonus) next = applyStatBonus(next, item.statBonus, 1)
  next = { ...next, equipped: { ...next.equipped, [slot]: itemId } }
  return { player: next }
}

export function unequipSlot(player: Player, items: Dict<ItemEntry>, slot: EquipSlot): { player: Player; error?: string } {
  const currentId = player.equipped?.[slot]
  if (!currentId) return { player, error: `Nothing equipped in ${slot}.` }

  let next = player
  const current = items[currentId]
  if (current?.statBonus) next = applyStatBonus(next, current.statBonus, -1)
  const equipped = { ...next.equipped }
  delete equipped[slot]
  next = { ...next, equipped }
  return { player: next }
}
