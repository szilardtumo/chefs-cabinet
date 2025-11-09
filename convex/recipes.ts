import { v } from 'convex/values';
import { authenticatedMutation, authenticatedQuery } from './helpers';

// Get all recipes for the current user
export const getAll = authenticatedQuery({
  args: {},
  handler: async (ctx) => {
    const recipes = await ctx.db
      .query('recipes')
      .withIndex('by_user', (q) => q.eq('userId', ctx.userId))
      .order('desc')
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

// Get a single recipe with all details
export const getById = authenticatedQuery({
  args: { id: v.id('recipes') },
  handler: async (ctx, args) => {
    const recipe = await ctx.db.get(args.id);
    if (!recipe) {
      throw new Error('Recipe not found');
    }

    if (recipe.userId !== ctx.userId) {
      throw new Error('Unauthorized');
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

// Create a new recipe
export const create = authenticatedMutation({
  args: {
    title: v.string(),
    description: v.string(),
    image: v.optional(v.id('_storage')),
    cookingTime: v.number(),
    prepTime: v.number(),
    servings: v.number(),
    instructions: v.array(v.string()),
    tags: v.array(v.string()),
    aiGenerated: v.optional(v.boolean()),
    aiPrompt: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { aiGenerated, aiPrompt, ...recipeData } = args;

    // Create initial history entry
    const history = [
      {
        timestamp: Date.now(),
        type: 'created' as const,
        aiGenerated: aiGenerated || false,
        aiPrompt,
      },
    ];

    const recipeId = await ctx.db.insert('recipes', {
      userId: ctx.userId,
      ...recipeData,
      history,
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
    instructions: v.optional(v.array(v.string())),
    tags: v.optional(v.array(v.string())),
    changedFields: v.optional(v.array(v.string())),
    aiGenerated: v.optional(v.boolean()),
    aiPrompt: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const recipe = await ctx.db.get(args.id);
    if (!recipe) {
      throw new Error('Recipe not found');
    }

    if (recipe.userId !== ctx.userId) {
      throw new Error('Unauthorized');
    }

    const { id, changedFields, aiGenerated, aiPrompt, ...updates } = args;

    // Determine history type
    let historyType: 'description_modified' | 'instructions_modified' | 'general_edit' = 'general_edit';
    if (changedFields?.includes('description')) {
      historyType = 'description_modified';
    } else if (changedFields?.includes('instructions')) {
      historyType = 'instructions_modified';
    }

    // Add history entry
    const newHistoryEntry = {
      timestamp: Date.now(),
      type: historyType,
      changedFields,
      aiGenerated,
      aiPrompt,
    };

    const existingHistory = recipe.history || [];
    const updatedHistory = [...existingHistory, newHistoryEntry];

    await ctx.db.patch(id, {
      ...updates,
      history: updatedHistory,
    });

    return id;
  },
});

// Delete a recipe
export const remove = authenticatedMutation({
  args: { id: v.id('recipes') },
  handler: async (ctx, args) => {
    const recipe = await ctx.db.get(args.id);
    if (!recipe) {
      throw new Error('Recipe not found');
    }

    if (recipe.userId !== ctx.userId) {
      throw new Error('Unauthorized');
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
