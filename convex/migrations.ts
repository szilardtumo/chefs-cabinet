import { Migrations } from '@convex-dev/migrations';
import { components } from './_generated/api.js';
import type { DataModel } from './_generated/dataModel.js';
import { internalMutation } from './_generated/server';
import { recordRecipeHistory } from './recipeHistories';

export const migrations = new Migrations<DataModel>(components.migrations, {
  internalMutation,
});

export const run = migrations.runner();

/**
 * Converts legacy `instructions: string[]` to `[{ steps: string[] }]`.
 * Safe to run multiple times (no-ops when already migrated).
 */
export const migrateRecipeInstructionsToGroups = migrations.define({
  table: 'recipes',
  migrateOne: async (ctx, doc) => {
    const ins = doc.instructions;
    if (!ins.length) {
      return;
    }
    if (typeof ins[0] === 'string') {
      await ctx.db.patch(doc._id, {
        instructions: [{ steps: ins as unknown as string[] }],
      });
    }
  },
});

/**
 * Starts recipe history over in `recipeHistories`: each recipe gets one entry with its current contents, and the
 * `history` field on the recipe goes away, leaving the time of its last save as `updatedAt`. Recipes saved since the
 * deploy already have `updatedAt` and are skipped.
 */
export const migrateRecipeHistories = migrations.define({
  table: 'recipes',
  migrateOne: async (ctx, doc) => {
    if (doc.updatedAt !== undefined) return;
    // Saves between the history table and `updatedAt` going live dropped `history` but recorded their entries
    if (doc.history !== undefined) await recordRecipeHistory(ctx, doc._id, 'edited');
    await ctx.db.patch(doc._id, { history: undefined, updatedAt: doc.history?.at(-1)?.timestamp ?? doc._creationTime });
  },
});
