import { v } from 'convex/values';
import type { Doc } from './_generated/dataModel';
import { InvalidOperationError, NotFoundError } from './errors';
import { authenticatedMutation, authenticatedQuery } from './helpers';

export type Ingredient = Doc<'ingredients'>;

export type IngredientWithCategory = Ingredient & {
  category: Doc<'categories'> | null;
};

/**
 * Retrieves all ingredients for the currently authenticated user.
 *
 * @returns A promise that resolves to an array of ingredients belonging to the user.
 */
export const getAll = authenticatedQuery({
  args: {},
  handler: async (ctx) => {
    const ingredients = await ctx.db
      .query('ingredients')
      .withIndex('by_user', (q) => q.eq('userId', ctx.userId))
      .collect();

    // Fetch category for each ingredient
    const ingredientsWithCategory = await Promise.all(
      ingredients.map(async (ingredient) => {
        const category = await ctx.db.get(ingredient.categoryId);
        return {
          ...ingredient,
          category,
        };
      }),
    );

    return ingredientsWithCategory;
  },
});

/**
 * Retrieves all ingredients by category for the currently authenticated user.
 *
 * @param args.categoryId - The ID of the category to retrieve ingredients for.
 *
 * @returns A promise that resolves to an array of ingredients
 *          belonging to the user and the category.
 */
export const getByCategory = authenticatedQuery({
  args: { categoryId: v.id('categories') },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('ingredients')
      .withIndex('by_category', (q) => q.eq('categoryId', args.categoryId))
      .collect();
  },
});

/**
 * Retrieves a single ingredient by ID for the currently authenticated user.
 *
 * @param args.id - The ID of the ingredient to retrieve.
 *
 * @returns A promise that resolves to the ingredient object.
 */
export const getById = authenticatedQuery({
  args: { id: v.id('ingredients') },
  handler: async (ctx, args) => {
    const ingredient = await ctx.db.get(args.id);
    if (!ingredient) {
      throw new NotFoundError('ingredients', args.id);
    }

    if (ingredient.userId !== ctx.userId) {
      // Do not expose the existence of the ingredient if it is not owned by the user
      throw new NotFoundError('ingredients', args.id);
    }

    const category = await ctx.db.get(ingredient.categoryId);

    return { ...ingredient, category };
  },
});

/**
 * Searches for ingredients by name for the currently authenticated user.
 *
 * @param args.query - The query to search for.
 *
 * @returns A promise that resolves to an array of ingredients matching the query.
 */
export const search = authenticatedQuery({
  args: { query: v.string() },
  handler: async (ctx, args) => {
    const allIngredients = await ctx.db
      .query('ingredients')
      .withSearchIndex('search_by_name', (q) => q.search('name', args.query).eq('userId', ctx.userId))
      .collect();

    return allIngredients;
  },
});

/**
 * Creates a new ingredient for the currently authenticated user.
 *
 * @param args - The arguments object containing the ingredient details.
 *
 * @returns A promise that resolves to the ID of the created ingredient.
 */
export const create = authenticatedMutation({
  args: {
    name: v.string(),
    categoryId: v.id('categories'),
    defaultUnit: v.optional(v.string()),
    notes: v.optional(v.string()),
    emoji: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Verify category belongs to user
    const category = await ctx.db.get(args.categoryId);
    if (!category || category.userId !== ctx.userId) {
      throw new NotFoundError('categories', args.categoryId);
    }

    return await ctx.db.insert('ingredients', {
      ...args,
      userId: ctx.userId,
    });
  },
});

/**
 * Updates an ingredient for the currently authenticated user.
 *
 * @param args - The arguments object containing the ingredient details.
 *
 * @returns A promise that resolves to the ID of the updated ingredient.
 */
export const update = authenticatedMutation({
  args: {
    id: v.id('ingredients'),
    name: v.optional(v.string()),
    categoryId: v.optional(v.id('categories')),
    defaultUnit: v.optional(v.string()),
    notes: v.optional(v.string()),
    emoji: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const ingredient = await ctx.db.get(args.id);
    if (!ingredient) {
      throw new NotFoundError('ingredients', args.id);
    }

    if (ingredient.userId !== ctx.userId) {
      // Do not expose the existence of the ingredient if it is not owned by the user
      throw new NotFoundError('ingredients', args.id);
    }

    // If changing category, verify new category belongs to user
    if (args.categoryId) {
      const category = await ctx.db.get(args.categoryId);
      if (!category || category.userId !== ctx.userId) {
        throw new NotFoundError('categories', args.categoryId);
      }
    }

    const { id, ...updates } = args;
    await ctx.db.patch(id, updates);

    return id;
  },
});

/**
 * Deletes an ingredient for the currently authenticated user.
 *
 * @param args.id - The ID of the ingredient to delete.
 *
 * @returns A promise that resolves to the ID of the deleted ingredient.
 */
export const remove = authenticatedMutation({
  args: { id: v.id('ingredients') },
  handler: async (ctx, args) => {
    const ingredient = await ctx.db.get(args.id);
    if (!ingredient) {
      throw new NotFoundError('ingredients', args.id);
    }

    if (ingredient.userId !== ctx.userId) {
      // Do not expose the existence of the ingredient if it is not owned by the user
      throw new NotFoundError('ingredients', args.id);
    }

    // Check if any recipes use this ingredient
    const recipeIngredient = await ctx.db
      .query('recipeIngredients')
      .withIndex('by_ingredient', (q) => q.eq('ingredientId', args.id))
      .first();

    if (recipeIngredient) {
      throw new InvalidOperationError('Cannot delete ingredient used in recipes');
    }

    await ctx.db.delete(args.id);

    return args.id;
  },
});
