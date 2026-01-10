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
async function generateIngredientDetails(
  args: { name: string },
  ctx: ActionCtx,
): Promise<{ name: string; emoji?: string; defaultUnit?: string; categoryId: Id<'categories'> }> {
  const categories = await ctx.runQuery(api.categories.getAll, {});

  try {
    const identity = await ctx.auth.getUserIdentity();
    const google = await createGoogleAI(identity);

    const categoryList = categories.map((c) => `- ID: "${c._id}", Name: "${c.name}"`).join('\n');
    const categoryIds = categories.map((c) => c._id as string);

    const prompt = `Generate details for a kitchen ingredient in a recipe app.

Ingredient name: "${args.name}"

Available categories:
${categoryList}

Instructions:
1. categoryId: Select an existing category ID from above. Only set to null if absolutely no category fits.
2. name: The name of the ingredient as provided in the input, with correct spelling and capitalization. Words should be capitalized.
3. emoji: Single emoji representing this ingredient (e.g. "🍎" for apple, "🥛" for milk)
4. defaultUnit: Common metric unit for this ingredient, or imperial unit if metric unit is not appropriate (e.g. "g", "ml", "pcs", "tbsp"). Leave empty if unclear.
5. If categoryId is null, provide newCategoryName, newCategoryEmoji, and newCategoryColor (hex like "#ff5500")`;

    const categoryIdSchema =
      categoryIds.length > 0 ? z.enum(categoryIds as [string, ...string[]]).nullable() : z.null();

    const schema = z.object({
      name: z.string().describe('Name of the ingredient'),
      emoji: z.string().describe('Single emoji for the ingredient'),
      defaultUnit: z.string().optional().describe('Default measurement unit (e.g. "g", "ml", "pcs")'),
      categoryId: categoryIdSchema.describe('ID of existing category from list above, or null to create new'),
      newCategoryName: z.string().optional().describe('Name for new category (only if categoryId is null)'),
      newCategoryEmoji: z.string().optional().describe('Emoji for new category (only if categoryId is null)'),
      newCategoryColor: z
        .string()
        .optional()
        .describe('Hex color for new category like "#ff5500" (only if categoryId is null)'),
    });

    const { object } = await generateObject({
      model: google('gemini-2.5-flash'),
      schema,
      prompt,
    });

    let categoryId: Id<'categories'>;

    if (object.categoryId === null && object.newCategoryName) {
      categoryId = await ctx.runMutation(api.categories.create, {
        name: object.newCategoryName,
        emoji: object.newCategoryEmoji ?? '📦',
        color: object.newCategoryColor ?? '#6b7280',
      });
    } else if (object.categoryId) {
      categoryId = object.categoryId as Id<'categories'>;
    } else {
      throw new Error('Incorrect category selection from AI response');
    }

    return {
      name: object.name,
      emoji: object.emoji,
      defaultUnit: object.defaultUnit,
      categoryId,
    };
  } catch (error) {
    console.error('AI category assignment failed:', error);

    // Fallback to "Other" category
    const otherCategory = categories.find((cat) => cat.name.toLowerCase() === 'other');
    if (otherCategory) {
      return {
        name: args.name,
        categoryId: otherCategory._id,
      };
    }

    const newCategoryId = await ctx.runMutation(api.categories.create, {
      name: 'Other',
      emoji: '📦',
      color: '#6b7280',
    });

    return {
      name: args.name,
      categoryId: newCategoryId,
    };
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
    const ingredientDetails = await generateIngredientDetails(args, ctx);

    return await ctx.runMutation(api.ingredients.create, ingredientDetails);
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
