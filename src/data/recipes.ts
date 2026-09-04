import type { RecipeDef } from '../types.ts'

// §5.8 Recipe Dictionary — a local static dictionary, same pattern as the
// Preset Class Dictionary (data/classes.ts). A starter set covering a few
// station flavors; the crafting engine itself doesn't care how many recipes
// exist here, so more can be added freely without touching lib/crafting.ts.
export const RECIPES: RecipeDef[] = [
  {
    id: 'recipe_steel_sword',
    name: 'Steel Sword',
    output: { id: 'steel_sword', qty: 1 },
    ingredients: [{ id: 'iron_ore', qty: 3 }, { id: 'coal', qty: 1 }],
    stationRequired: 'Forge',
    craftHours: 4,
  },
  {
    id: 'recipe_iron_dagger',
    name: 'Iron Dagger',
    output: { id: 'iron_dagger', qty: 1 },
    ingredients: [{ id: 'iron_ore', qty: 1 }],
    stationRequired: 'Forge',
    craftHours: 1,
  },
  {
    id: 'recipe_healing_tonic',
    name: 'Healing Tonic',
    output: { id: 'healing_tonic', qty: 1 },
    ingredients: [{ id: 'herbs', qty: 2 }, { id: 'water_flask', qty: 1 }],
    stationRequired: 'Alchemy Bench',
    craftHours: 2,
  },
  {
    id: 'recipe_leather_armor',
    name: 'Leather Armor',
    output: { id: 'leather_armor', qty: 1 },
    ingredients: [{ id: 'hide', qty: 4 }, { id: 'leather_strips', qty: 2 }],
    stationRequired: 'Workbench',
    craftHours: 6,
  },
  {
    id: 'recipe_torch_bundle',
    name: 'Torch Bundle',
    output: { id: 'torch', qty: 3 },
    ingredients: [{ id: 'wood', qty: 3 }, { id: 'cloth', qty: 1 }],
    craftHours: 1,
  },
]

export function getRecipeById(id: string): RecipeDef | undefined {
  return RECIPES.find((r) => r.id === id)
}
