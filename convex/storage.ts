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
