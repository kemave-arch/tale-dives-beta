import { addHoursToGameTime, isTimeReached } from './gameTime.ts'
import { getRecipeById } from '../data/recipes.ts'
import type { CraftingJob, Dict, GameTime, RecipeDef } from '../types.ts'

// §5.8 Crafting & Resource Management — fully client-resolved, 0 API tokens.
// Gemini's only involvement is optional flavor narration when the player is
// present for a completion (the narration-hook line in jitContext.ts); it
// never decides whether a craft succeeds, what it costs, or when it's ready.

export function canAffordRecipe(inventory: Dict<number>, recipe: RecipeDef): boolean {
  return recipe.ingredients.every((i) => (inventory[i.id] ?? 0) >= i.qty)
}

function deductIngredients(inventory: Dict<number>, ingredients: RecipeDef['ingredients']): Dict<number> {
  const next = { ...inventory }
  for (const ing of ingredients) {
    const remaining = (next[ing.id] ?? 0) - ing.qty
    if (remaining > 0) next[ing.id] = remaining
    else delete next[ing.id]
  }
  return next
}

// Queueing deducts ingredients immediately (not on completion) to prevent a
// queue-then-cancel exploit — same principle as the Shadow Referee's
// skill-affordability check (§3.2). Returns null if the recipe doesn't exist
// or the player can't currently afford it (the caller doesn't need to
// pre-check — canAffordRecipe is exported separately only for UI display).
export function queueCraftingJob(
  jobs: CraftingJob[],
  inventory: Dict<number>,
  recipeId: string,
  stationLocId: string,
  currentTime: GameTime,
  newJobId: string,
): { jobs: CraftingJob[]; inventory: Dict<number> } | null {
  const recipe = getRecipeById(recipeId)
  if (!recipe || !canAffordRecipe(inventory, recipe)) return null
  const job: CraftingJob = {
    jobId: newJobId,
    recipeId: recipe.id,
    stationLocId,
    startTime: currentTime,
    completeTime: addHoursToGameTime(currentTime, recipe.craftHours),
  }
  return { jobs: [...jobs, job], inventory: deductIngredients(inventory, recipe.ingredients) }
}

export interface CompletedCraft {
  job: CraftingJob
  recipe: RecipeDef
}

// Resolution algorithm (§5.8) — compares `currentTime` against each queued
// job's `completeTime`; once reached, the output lands in inventory and the
// job is dropped from the queue, regardless of the player's location right
// now (waiting doesn't require sitting at the station). Called twice per
// turn in App.tsx: once read-only beforehand (against the pre-turn time, to
// decide whether the narration hook belongs in this turn's prompt) and once
// authoritatively afterward (against the turn's actual resulting time, which
// is what actually gets persisted) — see the comment at each call site.
export function resolveCraftingJobs(
  jobs: CraftingJob[],
  inventory: Dict<number>,
  currentTime: GameTime,
): { jobs: CraftingJob[]; inventory: Dict<number>; completed: CompletedCraft[] } {
  const remaining: CraftingJob[] = []
  const completed: CompletedCraft[] = []
  let nextInventory = inventory

  for (const job of jobs) {
    const recipe = getRecipeById(job.recipeId)
    if (!recipe) continue // dropped from the dictionary since queued — silently drop rather than jam the queue forever
    if (isTimeReached(currentTime, job.completeTime)) {
      nextInventory = { ...nextInventory, [recipe.output.id]: (nextInventory[recipe.output.id] ?? 0) + recipe.output.qty }
      completed.push({ job, recipe })
    } else {
      remaining.push(job)
    }
  }

  return { jobs: remaining, inventory: nextInventory, completed }
}
