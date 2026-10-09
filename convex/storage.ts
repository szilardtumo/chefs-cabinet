import type { Id } from './_generated/dataModel';
import type { ActionCtx, MutationCtx } from './_generated/server';
import { NotFoundError } from './lib/errors';
import { authenticatedMutation } from './lib/helpers';
import { enforceRateLimit } from './lib/rateLimiter';

/**
 * Generates a short-lived upload URL for Convex Storage.
 * Used by any authenticated feature that stores files (recipe images, book covers).
 */
export const generateUploadUrl = authenticatedMutation({
  args: {},
  handler: async (ctx) => {
    await enforceRateLimit(ctx, 'upload');
    return await ctx.storage.generateUploadUrl();
  },
});

/** Downloads an image from the web into Convex Storage, such as a book cover. */
export async function storeImage(ctx: ActionCtx, url: string) {
  const res = await fetch(url);
  if (!res.ok || !res.headers.get('content-type')?.startsWith('image/')) {
    throw new Error(`Couldn't download the image (${res.status})`);
  }
  return await ctx.storage.store(await res.blob());
}

/** Throws when a recipe other than `exceptRecipeId`, or a book, already uses the file. */
export async function requireUnclaimedStorage(
  ctx: Pick<MutationCtx, 'db'>,
  storageId: Id<'_storage'>,
  exceptRecipeId?: Id<'recipes'>,
) {
  const recipe = await ctx.db
    .query('recipes')
    .withIndex('by_image', (q) => q.eq('image', storageId))
    .first();
  const book = await ctx.db
    .query('books')
    .withIndex('by_cover', (q) => q.eq('cover', storageId))
    .first();
  if ((recipe && recipe._id !== exceptRecipeId) || book) {
    throw new NotFoundError('_storage', storageId);
  }
}
