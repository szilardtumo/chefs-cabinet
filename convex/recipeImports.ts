import { v } from 'convex/values';
import { isStorageId } from '@/lib/storage';
import { internalMutation, internalQuery } from './_generated/server';
import { NotFoundError, ValidationError } from './lib/errors';
import { authenticatedMutation, authenticatedQuery, requireOwned } from './lib/helpers';
import { requireUnclaimedStorage } from './storage';

/**
 * Retrieves the imports of the currently authenticated user that weren't dismissed yet, newest first,
 * with their photos and, once done, the recipe.
 */
export const getAll = authenticatedQuery({
  args: {},
  handler: async (ctx) => {
    const imports = await ctx.db
      .query('recipeImports')
      .withIndex('by_user', (q) => q.eq('userId', ctx.userId))
      .order('desc')
      .collect();

    const withDetails = await Promise.all(
      imports.map(async (recipeImport) => {
        const recipe = recipeImport.recipeId ? await ctx.db.get(recipeImport.recipeId) : null;
        const photoUrls = await Promise.all(recipeImport.images.map((image) => ctx.storage.getUrl(image)));
        return {
          ...recipeImport,
          photoUrls: photoUrls.filter((url) => url !== null),
          recipe: recipe && {
            _id: recipe._id,
            title: recipe.title,
            imageUrl: isStorageId(recipe.image) ? await ctx.storage.getUrl(recipe.image) : (recipe.image ?? null),
          },
        };
      }),
    );

    return withDetails;
  },
});

/**
 * Removes an import from the recipes page, with its photos. The recipe of a done import stays.
 */
export const dismiss = authenticatedMutation({
  args: { id: v.id('recipeImports') },
  handler: async (ctx, args) => {
    const recipeImport = await requireOwned(ctx, 'recipeImports', args.id);
    for (const image of recipeImport.images) {
      await ctx.storage.delete(image);
    }
    await ctx.db.delete(args.id);
  },
});

export const get = internalQuery({
  args: { id: v.id('recipeImports') },
  handler: async (ctx, args) => {
    const recipeImport = await ctx.db.get(args.id);
    if (!recipeImport) throw new NotFoundError('recipeImports', args.id);
    return recipeImport;
  },
});

export const start = internalMutation({
  args: { userId: v.string(), prompt: v.string(), images: v.array(v.id('_storage')) },
  handler: async (ctx, args) => {
    const prompt = args.prompt.trim();
    if (!prompt && args.images.length === 0) {
      throw new ValidationError('Describe the recipe or add a link or a photo');
    }
    if (prompt.length > 4000) {
      throw new ValidationError('Keep the request under 4000 characters');
    }
    if (args.images.length > 3) {
      throw new ValidationError('Add at most 3 photos');
    }
    for (const image of args.images) {
      if (!(await ctx.db.system.get(image))) throw new NotFoundError('_storage', image);
      await requireUnclaimedStorage(ctx, image);
    }

    return await ctx.db.insert('recipeImports', {
      userId: args.userId,
      prompt,
      images: args.images,
      status: 'pending',
      startedAt: Date.now(),
    });
  },
});

export const restart = internalMutation({
  args: { userId: v.string(), id: v.id('recipeImports') },
  handler: async (ctx, args) => {
    const recipeImport = await requireOwned({ db: ctx.db, userId: args.userId }, 'recipeImports', args.id);
    if (recipeImport.status !== 'failed') throw new ValidationError('Only a failed import can be retried');
    await ctx.db.patch(args.id, { status: 'pending', error: undefined, startedAt: Date.now() });
  },
});

export const finish = internalMutation({
  args: { id: v.id('recipeImports'), recipeId: v.id('recipes') },
  handler: async (ctx, args) => {
    // The user may have dismissed the import while it ran
    if (!(await ctx.db.get(args.id))) return;
    await ctx.db.patch(args.id, { status: 'done', recipeId: args.recipeId });
  },
});

export const fail = internalMutation({
  args: { id: v.id('recipeImports'), error: v.string() },
  handler: async (ctx, args) => {
    // The user may have dismissed the import while it ran
    if (!(await ctx.db.get(args.id))) return;
    await ctx.db.patch(args.id, { status: 'failed', error: args.error });
  },
});
