import { v } from 'convex/values';
import { NotFoundError } from './lib/errors';
import { authenticatedMutation } from './lib/helpers';

/**
 * Adds an ingredient to a recipe for the currently authenticated user.
 *
 * @param args - The arguments object containing the recipe ingredient details.
 * @param args.recipeId - The ID of the recipe to add the ingredient to.
 * @param args.ingredientId - The ID of the ingredient to add.
 *
 * @returns A promise that resolves to the ID of the created recipe ingredient.
 */
export const add = authenticatedMutation({
  args: {
    recipeId: v.id('recipes'),
    ingredientId: v.id('ingredients'),
    quantity: v.number(),
    unit: v.string(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Verify user owns the recipe
    const recipe = await ctx.db.get(args.recipeId);
    if (!recipe || recipe.userId !== ctx.userId) {
      // Do not expose the existence of the recipe if it is not owned by the user
      throw new NotFoundError('recipes', args.recipeId);
    }

    // Get current max order
    const existing = await ctx.db
      .query('recipeIngredients')
      .withIndex('by_recipe', (q) => q.eq('recipeId', args.recipeId))
      .collect();

    const maxOrder = existing.reduce((max, ri) => Math.max(max, ri.order), 0);

    const recipeIngredientId = await ctx.db.insert('recipeIngredients', {
      ...args,
      order: maxOrder + 1,
    });

    return recipeIngredientId;
  },
});

/**
 * Updates a recipe ingredient for the currently authenticated user.
 *
 * @param args - The arguments object containing the recipe ingredient details.
 * @param args.id - The ID of the recipe ingredient to update.
 *
 * @returns A promise that resolves to the ID of the updated recipe ingredient.
 */
export const update = authenticatedMutation({
  args: {
    id: v.id('recipeIngredients'),
    quantity: v.optional(v.number()),
    unit: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const recipeIngredient = await ctx.db.get(args.id);
    if (!recipeIngredient) {
      throw new NotFoundError('recipeIngredients', args.id);
    }

    // Verify user owns the recipe
    const recipe = await ctx.db.get(recipeIngredient.recipeId);
    if (!recipe || recipe.userId !== ctx.userId) {
      // Do not expose the existence of the recipe ingredient if it is not owned by the user
      throw new NotFoundError('recipe', recipe?._id);
    }

    const { id, ...updates } = args;
    await ctx.db.patch(id, updates);

    return id;
  },
});

/**
 * Removes an ingredient from a recipe for the currently authenticated user.
 *
 * @param args.id - The ID of the recipe ingredient to remove.
 *
 * @returns A promise that resolves to the ID of the removed recipe ingredient.
 */
export const remove = authenticatedMutation({
  args: { id: v.id('recipeIngredients') },
  handler: async (ctx, args) => {
    const recipeIngredient = await ctx.db.get(args.id);
    if (!recipeIngredient) {
      throw new NotFoundError('recipeIngredients', args.id);
    }

    // Verify user owns the recipe
    const recipe = await ctx.db.get(recipeIngredient.recipeId);
    if (!recipe || recipe.userId !== ctx.userId) {
      // Do not expose the existence of the recipe ingredient if it is not owned by the user
      throw new NotFoundError('recipe', recipe?._id);
    }

    await ctx.db.delete(args.id);

    return args.id;
  },
});

/**
 * Reorders recipe ingredients for the currently authenticated user.
 *
 * @param args.recipeId - The ID of the recipe to reorder ingredients for.
 * @param args.recipeIngredientIds - An array of recipe ingredient IDs and their new order.
 */
export const reorder = authenticatedMutation({
  args: {
    recipeId: v.id('recipes'),
    recipeIngredientIds: v.array(v.id('recipeIngredients')),
  },
  handler: async (ctx, args) => {
    // Verify user owns the recipe
    const recipe = await ctx.db.get(args.recipeId);
    if (!recipe || recipe.userId !== ctx.userId) {
      // Do not expose the existence of the recipe if it is not owned by the user
      throw new NotFoundError('recipe', args.recipeId);
    }

    // Verify all recipe ingredients belong to the recipe
    for (const recipeIngredientId of args.recipeIngredientIds) {
      const recipeIngredient = await ctx.db.get(recipeIngredientId);
      if (!recipeIngredient || recipeIngredient.recipeId !== args.recipeId) {
        throw new NotFoundError('recipeIngredients', recipeIngredientId);
      }
    }

    // Update all orders
    for (const [index, recipeIngredientId] of args.recipeIngredientIds.entries()) {
      await ctx.db.patch(recipeIngredientId, { order: index + 1 });
    }

    return args.recipeId;
  },
});
