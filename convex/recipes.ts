import { v } from 'convex/values';
import { isEqual, omitBy } from 'es-toolkit';
import { NotFoundError } from './lib/errors';
import { authenticatedMutation, authenticatedQuery } from './lib/helpers';

/**
 * Retrieves all recipes for the currently authenticated user.
 *
 * @returns A promise that resolves to an array of recipes belonging to the user.
 */
export const getAll = authenticatedQuery({
  args: {},
  handler: async (ctx) => {
    const recipes = await ctx.db
      .query('recipes')
      .withIndex('by_user', (q) => q.eq('userId', ctx.userId))
      .collect();

    // Get image URLs if they exist
    const recipesWithImages = await Promise.all(
      recipes.map(async (recipe) => {
        let imageUrl = null;
        if (recipe.image) {
          imageUrl = await ctx.storage.getUrl(recipe.image);
        }
        return {
          ...recipe,
          imageUrl,
        };
      }),
    );

    return recipesWithImages;
  },
});

/**
 * Retrieves a single recipe with all details for the currently authenticated user.
 *
 * @param args.id - The ID of the recipe to retrieve.
 *
 * @returns A promise that resolves to the recipe with all details.
 */
export const getById = authenticatedQuery({
  args: { id: v.id('recipes') },
  handler: async (ctx, args) => {
    const recipe = await ctx.db.get(args.id);
    if (!recipe) {
      throw new NotFoundError('recipes', args.id);
    }

    if (recipe.userId !== ctx.userId) {
      // Do not expose the existence of the recipe if it is not owned by the user
      throw new NotFoundError('recipes', args.id);
    }

    // Get image URL
    let imageUrl = null;
    if (recipe.image) {
      imageUrl = await ctx.storage.getUrl(recipe.image);
    }

    // Get recipe ingredients
    const recipeIngredients = await ctx.db
      .query('recipeIngredients')
      .withIndex('by_recipe_and_order', (q) => q.eq('recipeId', args.id))
      .order('asc')
      .collect();

    // Fetch ingredient details for each
    const ingredientsWithDetails = await Promise.all(
      recipeIngredients.map(async (ri) => {
        const ingredient = await ctx.db.get(ri.ingredientId);
        return {
          ...ri,
          ingredient,
        };
      }),
    );

    return {
      ...recipe,
      imageUrl,
      ingredients: ingredientsWithDetails,
    };
  },
});

/**
 * Creates a new recipe for the currently authenticated user.
 *
 * @param args - The arguments object containing the recipe details.
 *
 * @returns A promise that resolves to the ID of the created recipe.
 */
export const create = authenticatedMutation({
  args: {
    title: v.string(),
    description: v.string(),
    image: v.optional(v.id('_storage')),
    cookingTime: v.optional(v.number()),
    prepTime: v.optional(v.number()),
    servings: v.optional(v.number()),
    instructions: v.string(),
    tags: v.array(v.string()),
    aiPrompt: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { aiPrompt, ...recipeData } = args;

    // Create initial history entry
    const history = [
      {
        timestamp: Date.now(),
        type: 'created' as const,
        aiGenerated: !!aiPrompt,
        aiPrompt,
      },
    ];

    const recipeId = await ctx.db.insert('recipes', {
      userId: ctx.userId,
      history,
      ...recipeData,
    });

    return recipeId;
  },
});

// Update a recipe
export const update = authenticatedMutation({
  args: {
    id: v.id('recipes'),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    image: v.optional(v.id('_storage')),
    cookingTime: v.optional(v.number()),
    prepTime: v.optional(v.number()),
    servings: v.optional(v.number()),
    instructions: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    aiPrompt: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const recipe = await ctx.db.get(args.id);
    if (!recipe) {
      throw new NotFoundError('recipes', args.id);
    }

    if (recipe.userId !== ctx.userId) {
      // Do not expose the existence of the recipe if it is not owned by the user
      throw new NotFoundError('recipes', args.id);
    }

    const { id, aiPrompt, ...updates } = args;

    // extract the fields that actually changed
    const changes = omitBy(updates, (value, key) => isEqual(value, recipe[key]));

    // Add history entry
    const newHistoryEntry = {
      timestamp: Date.now(),
      type: 'edited' as const,
      changes,
      aiPrompt,
    };

    await ctx.db.patch(id, {
      ...changes,
      history: [...recipe.history, newHistoryEntry],
    });

    return id;
  },
});

/**
 * Deletes a recipe for the currently authenticated user.
 *
 * @param args.id - The ID of the recipe to delete.
 */
export const remove = authenticatedMutation({
  args: { id: v.id('recipes') },
  handler: async (ctx, args) => {
    const recipe = await ctx.db.get(args.id);
    if (!recipe) {
      throw new NotFoundError('recipes', args.id);
    }

    if (recipe.userId !== ctx.userId) {
      // Do not expose the existence of the recipe if it is not owned by the user
      throw new NotFoundError('recipes', args.id);
    }

    // Delete associated recipe ingredients
    const recipeIngredients = await ctx.db
      .query('recipeIngredients')
      .withIndex('by_recipe', (q) => q.eq('recipeId', args.id))
      .collect();

    for (const ri of recipeIngredients) {
      await ctx.db.delete(ri._id);
    }

    // Delete the recipe
    await ctx.db.delete(args.id);

    // Clean up image if it exists
    if (recipe.image) {
      await ctx.storage.delete(recipe.image);
    }
  },
});

// Generate upload URL for recipe image
export const generateUploadUrl = authenticatedMutation({
  args: {},
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});
