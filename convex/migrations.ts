import { Migrations } from '@convex-dev/migrations';
import { components } from './_generated/api.js';
import type { DataModel } from './_generated/dataModel.js';
import { internalMutation } from './_generated/server';

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
