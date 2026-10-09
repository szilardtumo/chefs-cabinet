import { v } from 'convex/values';
import { omit } from 'es-toolkit';
import type { Id } from './_generated/dataModel';
import type { MutationCtx } from './_generated/server';
import { authenticatedQuery, requireOwned } from './lib/helpers';

/**
 * Retrieves a recipe's history, oldest first. Each entry holds the recipe as it was after that save.
 */
export const getByRecipe = authenticatedQuery({
  args: { recipeId: v.id('recipes') },
  handler: async (ctx, args) => {
    await requireOwned(ctx, 'recipes', args.recipeId);
    return await ctx.db
      .query('recipeHistories')
      .withIndex('by_recipe', (q) => q.eq('recipeId', args.recipeId))
      .collect();
  },
});

export async function recordRecipeHistory(
  ctx: MutationCtx,
  recipeId: Id<'recipes'>,
  type: 'created' | 'edited',
  aiPrompt?: string,
) {
  const recipe = await ctx.db.get(recipeId);
  if (!recipe) return;
  const recipeIngredients = await ctx.db
    .query('recipeIngredients')
    .withIndex('by_recipe_and_order', (q) => q.eq('recipeId', recipeId))
    .collect();

  const content = {
    ...omit(recipe, ['_id', '_creationTime', 'userId', 'updatedAt', 'history']),
    ingredients: await Promise.all(
      recipeIngredients.map(async (row) => ({
        ...omit(row, ['_id', '_creationTime', 'recipeId', 'order']),
        name: (await ctx.db.get(row.ingredientId))?.name ?? 'Deleted ingredient',
      })),
    ),
  };

  await ctx.db.insert('recipeHistories', { recipeId, type, aiPrompt, ...content });
}
