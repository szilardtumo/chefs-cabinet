import { type Infer, v } from 'convex/values';
import { doc } from 'convex-helpers/validators';
import { groupBy, isEqual, omit, omitBy } from 'es-toolkit';
import { isStorageId } from '@/lib/storage';
import { api, internal } from './_generated/api';
import type { Id } from './_generated/dataModel';
import type { ActionCtx, MutationCtx } from './_generated/server';
import { internalMutation } from './_generated/server';
import { NotFoundError } from './lib/errors';
import { authenticatedAction, authenticatedMutation, authenticatedQuery, requireOwned } from './lib/helpers';
import schema from './schema';

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
        let imageUrl: string | null = null;
        if (recipe.image) {
          imageUrl = isStorageId(recipe.image) ? ((await ctx.storage.getUrl(recipe.image)) ?? null) : recipe.image;
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
 * The recipe detail payload: the stored recipe plus a resolved image URL and its ingredients grouped for display.
 * Declared rather than inferred so the read shape the UI depends on cannot drift with the handler body.
 */
const recipeWithDetails = v.object({
  ...doc(schema, 'recipes').fields,
  imageUrl: v.optional(v.string()),
  ingredientGroups: v.array(
    v.object({
      title: v.string(),
      ingredients: v.array(
        v.object({
          ...doc(schema, 'recipeIngredients').fields,
          ingredient: v.union(doc(schema, 'ingredients'), v.null()),
        }),
      ),
    }),
  ),
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
  returns: recipeWithDetails,
  handler: async (ctx, args) => {
    const recipe = await ctx.db.get(args.id);
    if (!recipe) {
      throw new NotFoundError('recipes', args.id);
    }

    if (recipe.userId !== ctx.userId) {
      // Do not expose the existence of the recipe if it is not owned by the user
      throw new NotFoundError('recipes', args.id);
    }

    let imageUrl: string | undefined;
    if (recipe.image) {
      imageUrl = isStorageId(recipe.image) ? ((await ctx.storage.getUrl(recipe.image)) ?? undefined) : recipe.image;
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
      ingredientGroups: Object.entries(groupBy(ingredientsWithDetails, (item) => item.group ?? '')).map(
        ([title, ingredients]) => ({ title, ingredients }),
      ),
    };
  },
});

/** A stored recipe ingredient without the fields the mutation derives itself. */
const recipeIngredientSchema = v.object(omit(schema.tables.recipeIngredients.validator.fields, ['recipeId', 'order']));

const recipeSchema = v.object({
  ...omit(schema.tables.recipes.validator.fields, ['userId', 'image', 'history']),
  // Callers use null to clear the existing image.
  image: v.optional(v.union(v.id('_storage'), v.string(), v.null())),
  ingredients: v.array(recipeIngredientSchema),
  aiPrompt: v.optional(v.string()),
});

type IngredientInput = Omit<Infer<typeof recipeIngredientSchema>, 'ingredientId'> & {
  ingredientId?: Id<'ingredients'>;
  newIngredientName?: string;
};

/**
 * Processes ingredients by creating new ones and resolving ingredient IDs.
 * This is shared logic between create and update actions.
 */
async function processIngredients(
  ctx: ActionCtx,
  ingredients: IngredientInput[],
): Promise<Infer<typeof recipeIngredientSchema>[]> {
  // Create new ingredients
  const names = ingredients
    ?.filter((ingredient) => ingredient.newIngredientName)
    .map((ingredient) => ingredient.newIngredientName!);

  const newIngredientIds = await ctx.runAction(api.ingredients.quickCreate, { names });

  // Map new ingredient names to their IDs
  const newIngredientNameToId = names.reduce((acc, name, index) => {
    acc.set(name, newIngredientIds[index]);
    return acc;
  }, new Map<string, Id<'ingredients'>>());

  const recipeIngredients = ingredients
    .map(({ ingredientId, newIngredientName, ...rest }) => {
      return {
        ingredientId: ingredientId ?? newIngredientNameToId.get(newIngredientName ?? '')!,
        ...rest,
      };
    })
    .filter((ingredient) => ingredient.ingredientId !== undefined);

  return recipeIngredients;
}

/**
 * Checks what a client sent for a recipe: the ingredients must be the user's, and a stored image must not be used by
 * another recipe or a book. Storage files have no owner, so this keeps a recipe from taking over, and later deleting,
 * someone else's file.
 */
async function validateRecipeInput(
  ctx: MutationCtx,
  userId: string,
  { ingredients, image }: { ingredients: { ingredientId: Id<'ingredients'> }[]; image?: string | null },
  recipeId?: Id<'recipes'>,
) {
  for (const { ingredientId } of ingredients) {
    await requireOwned({ db: ctx.db, userId }, 'ingredients', ingredientId);
  }
  if (!isStorageId(image)) return;
  const recipe = await ctx.db
    .query('recipes')
    .withIndex('by_image', (q) => q.eq('image', image))
    .first();
  const book = await ctx.db
    .query('books')
    .withIndex('by_cover', (q) => q.eq('cover', image))
    .first();
  if ((recipe && recipe._id !== recipeId) || book) {
    throw new NotFoundError('_storage', image);
  }
}

/**
 * Internal mutation to create a recipe (called from action).
 */
export const createRecipeMutation = internalMutation({
  args: {
    ...recipeSchema.fields,
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const { aiPrompt, ingredients, ...recipeData } = args;
    await validateRecipeInput(ctx, args.userId, args);

    // Create initial history entry
    const history = [
      {
        timestamp: Date.now(),
        type: 'created' as const,
        aiPrompt,
      },
    ];

    const recipeId = await ctx.db.insert('recipes', {
      history,
      ...recipeData,
      image: recipeData.image ?? undefined,
    });

    for (const [index, ingredient] of ingredients.entries()) {
      await ctx.db.insert('recipeIngredients', {
        ...ingredient,
        recipeId,
        order: index,
      });
    }

    return recipeId;
  },
});

/**
 * Creates a new recipe for the currently authenticated user.
 * Automatically creates any new ingredients using AI.
 *
 * @param args - The arguments object containing the recipe details.
 *
 * @returns A promise that resolves to the ID of the created recipe.
 */
export const create = authenticatedAction({
  args: {
    ...recipeSchema.fields,
    ingredients: v.array(
      v.object({
        ...recipeIngredientSchema.fields,
        ingredientId: v.optional(v.id('ingredients')),
        newIngredientName: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx, args): Promise<Id<'recipes'>> => {
    const { ingredients = [], ...recipeArgs } = args;

    const recipeIngredients = await processIngredients(ctx, ingredients);

    return await ctx.runMutation(internal.recipes.createRecipeMutation, {
      ...recipeArgs,
      ingredients: recipeIngredients,
      userId: ctx.userId,
    });
  },
});

/**
 * Internal mutation to update a recipe (called from action).
 */
export const updateRecipeMutation = internalMutation({
  args: {
    ...recipeSchema.fields,
    id: v.id('recipes'),
  },
  handler: async (ctx, args): Promise<Id<'recipes'>> => {
    const { id, aiPrompt, ingredients, ...updates } = args;

    const recipe = await ctx.db.get(id);
    if (!recipe) {
      throw new NotFoundError('recipes', id);
    }
    await validateRecipeInput(ctx, recipe.userId, args, id);

    // Extract the fields that actually changed
    // TODO: add ingredients to the changes
    const changes = omitBy(updates, (value, key) => isEqual(value, recipe[key]));

    // Add history entry
    const newHistoryEntry = {
      timestamp: Date.now(),
      type: 'edited' as const,
      changes,
      aiPrompt,
    };

    // Handle recipe ingredients
    const existingRecipeIngredients = await ctx.db
      .query('recipeIngredients')
      .withIndex('by_recipe', (q) => q.eq('recipeId', id))
      .collect();

    // Delete all existing recipe ingredients
    for (const ri of existingRecipeIngredients) {
      await ctx.db.delete(ri._id);
    }

    // Create new recipe ingredients in order
    for (const [index, ingredient] of ingredients.entries()) {
      await ctx.db.insert('recipeIngredients', {
        ...ingredient,
        recipeId: id,
        order: index,
      });
    }

    const oldImage = recipe.image;
    if (oldImage && isStorageId(oldImage) && oldImage !== updates.image) {
      await ctx.storage.delete(oldImage);
    }

    // Update recipe
    await ctx.db.replace(id, {
      ...updates,
      image: updates.image ?? undefined,
      userId: recipe.userId,
      history: [...recipe.history, newHistoryEntry],
    });

    return id;
  },
});

/**
 * Updates a recipe for the currently authenticated user.
 * Automatically creates any new ingredients using AI and updates recipe ingredients.
 *
 * @param args - The arguments object containing the recipe details.
 *
 * @returns A promise that resolves to the ID of the updated recipe.
 */
export const update = authenticatedAction({
  args: {
    id: v.id('recipes'),
    ...recipeSchema.fields,
    ingredients: v.array(
      v.object({
        ...recipeIngredientSchema.fields,
        ingredientId: v.optional(v.id('ingredients')),
        newIngredientName: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx, args): Promise<Id<'recipes'>> => {
    // Verify recipe exists and belongs to user
    const recipe = await ctx.runQuery(api.recipes.getById, { id: args.id });
    if (!recipe) {
      throw new NotFoundError('recipes', args.id);
    }

    const { id, ingredients, ...recipeUpdates } = args;

    const recipeIngredients = await processIngredients(ctx, ingredients);

    await ctx.runMutation(internal.recipes.updateRecipeMutation, {
      id,
      ...recipeUpdates,
      ingredients: recipeIngredients,
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

    // Clean up the recipe image if it is stored in Convex Storage
    if (recipe.image && isStorageId(recipe.image)) {
      await ctx.storage.delete(recipe.image);
    }
  },
});
