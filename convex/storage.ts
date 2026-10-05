import type { ActionCtx } from './_generated/server';
import { authenticatedMutation } from './lib/helpers';

/**
 * Generates a short-lived upload URL for Convex Storage.
 * Used by any authenticated feature that stores files (recipe images, book covers).
 */
export const generateUploadUrl = authenticatedMutation({
  args: {},
  handler: async (ctx) => {
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
