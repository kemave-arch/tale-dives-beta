import type { Dict, EquipSlot, InventoryAcquisition, InventoryChange, ItemEntry, Player } from '../types.ts'

export interface InventoryResult {
  inventory: Dict<number>
  items: Dict<ItemEntry>
}

// §5.9/§3.2 Inventory Sanity Check — inv_add creates or increments; inv_rem
// for an item the player doesn't (fully) own is clamped rather than driven
// negative, and a fully-removed item's entry is dropped rather than left at
// 0. `items` is the item Codex (name/type/description/traits) — an
// acquisition's metadata is upserted alongside the quantity bump, atomically,
// so an item can never be "in inventory" with no name to show for it.
export function applyInventoryChanges(
  inventory: Dict<number> | undefined,
  items: Dict<ItemEntry> | undefined,
  add: InventoryAcquisition[] = [],
  remove: InventoryChange[] = [],
  turnRef?: string,
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
        traits: item.traits ?? existing?.traits,
        // Stamped once, the turn this item first entered the Codex — never
        // overwritten on a later re-acquisition of the same id.
        loggedAt: existing?.loggedAt ?? turnRef,
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

// §5.9 Equip/Unequip — deterministic and entirely client-resolved (a `!equip`
// bang command, not a schema field), same architectural family as `!arise`/
// `!summon`: no narrative ambiguity for the model to arbitrate. Traits are
// pure narrative flavor now (types.ts's ItemEntry.traits) — there's no
// mechanical tier-bump bookkeeping to apply/reverse on equip/unequip
// anymore, so this is just bookkeeping which slot holds which item id.
export function equipItem(player: Player, items: Dict<ItemEntry>, itemId: string, slot: EquipSlot): { player: Player; error?: string } {
  const item = items[itemId]
  if (!item) return { player, error: `No known item "${itemId}".` }
  if (item.type !== slot) return { player, error: `${item.name} is a ${item.type}, not ${slot === 'weapon' ? 'a' : 'an'} ${slot}.` }

  const next: Player = { ...player, equipped: { ...player.equipped, [slot]: itemId } }
  return { player: next }
}

export function unequipSlot(player: Player, slot: EquipSlot): { player: Player; error?: string } {
  const currentId = player.equipped?.[slot]
  if (!currentId) return { player, error: `Nothing equipped in ${slot}.` }

  const equipped = { ...player.equipped }
  delete equipped[slot]
  return { player: { ...player, equipped } }
}
