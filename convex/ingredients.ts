import { generateObject } from 'ai';
import { v } from 'convex/values';
import { z } from 'zod';
import { api } from './_generated/api';
import type { Doc, Id } from './_generated/dataModel';
import type { ActionCtx } from './_generated/server';
import { createGoogleAI } from './lib/ai';
import { InvalidOperationError, NotFoundError } from './lib/errors';
import { authenticatedAction, authenticatedMutation, authenticatedQuery } from './lib/helpers';

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
 * Uses AI to determine the best category for an ingredient.
 *
 * This function must be called from an authenticated action.
 *
 * @param args.name - The name of the ingredient to categorize.
 * @param ctx - The action context.
 *
 * Returns the category ID if a suitable category exists, or null if a new category should be created.
 */
async function findBestCategory(args: { name: string }, ctx: ActionCtx): Promise<Id<'categories'>> {
  const categories = await ctx.runQuery(api.categories.getAll, {});

  try {
    const google = await createGoogleAI();

    const categoryList = categories.map((c) => `- ID: "${c._id}", Name: "${c.name}"`).join('\n');

    const prompt = `You are categorizing kitchen ingredients for a recipe app.

Task: Assign the ingredient "${args.name}" to the most appropriate category.

Available categories:
${categoryList}

Instructions:
1. Choose an existing category that best matches the ingredient. Most ingredients should fit into one of the existing categories.
2. If the ingredient doesn't fit well into any specific category, use a general/fallback category like "Other", "Miscellaneous", or "Uncategorized" if one exists.
3. Only create a new category if:
   - No existing category is appropriate (including fallback categories)
   - The new category would be broadly useful (not overly specific like "Red Vegetables")
   - No similar category name already exists

Response format:
- To use an existing category: respond with action "useExisting" and provide the category ID exactly as shown above.
- To create a new category: respond with action "createNew" and provide a short clear name, an appropriate emoji, and a hex color code (e.g., #ff5733).
`;

    const schema = z.discriminatedUnion('action', [
      z.object({
        action: z.literal('useExisting'),
        categoryId: z.string(),
      }),
      z.object({
        action: z.literal('createNew'),
        newCategory: z.object({
          name: z.string(),
          emoji: z.emoji(),
          color: z.string().regex(/^#([0-9a-fA-F]{6})$/),
        }),
      }),
    ]);

    const { object } = await generateObject({
      model: google('gemini-2.5-flash-lite'),
      schema,
      prompt,
    });

    if (object.action === 'createNew') {
      const newCategoryId = await ctx.runMutation(api.categories.create, object.newCategory);
      return newCategoryId;
    } else {
      return object.categoryId as Id<'categories'>;
    }
  } catch (error) {
    console.error('AI category assignment failed:', error);

    // Fallback to "Other" category
    const otherCategory = categories.find((cat) => cat.name.toLowerCase() === 'other');
    if (otherCategory) {
      return otherCategory._id;
    }

    const newCategoryId = await ctx.runMutation(api.categories.create, {
      name: 'Other',
      emoji: '📦',
      color: '#6b7280',
    });

    return newCategoryId;
  }
}

/**
 * Quickly creates a new ingredient for the currently authenticated user.
 * Uses AI to automatically assign the best category, creating a new one only if necessary.
 *
 * @param args - The arguments object containing the ingredient name.
 * @param args.name - The name of the ingredient to create.
 *
 * @returns A promise that resolves to the ID of the created ingredient.
 */
export const quickCreate = authenticatedAction({
  args: {
    name: v.string(),
  },
  handler: async (ctx, args): Promise<Id<'ingredients'>> => {
    // Use AI to find the best category
    const categoryId = await findBestCategory(args, ctx);

    return await ctx.runMutation(api.ingredients.create, {
      name: args.name,
      categoryId,
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

    // Delete all shopping list items that reference this ingredient
    const shoppingListItems = await ctx.db
      .query('shoppingListItems')
      .withIndex('by_ingredient', (q) => q.eq('ingredientId', args.id))
      .collect();

    for (const item of shoppingListItems) {
      await ctx.db.delete(item._id);
    }

    await ctx.db.delete(args.id);

    return args.id;
  },
});
