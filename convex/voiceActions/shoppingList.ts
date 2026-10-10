import { v } from 'convex/values';
import { z } from 'zod';
import { api } from '../_generated/api';
import type { Id } from '../_generated/dataModel';
import type { ActionCtx } from '../_generated/server';
import { idSchema } from './library';
import { defineVoiceAction } from './types';

/** Undo for both shopping actions: removes the items they added. */
export const shoppingItemsUndo = {
  validator: v.object({ type: v.literal('shoppingItems'), ids: v.array(v.id('shoppingListItems')) }),
  run: async (ctx: ActionCtx, { ids }: { ids: Id<'shoppingListItems'>[] }) => {
    await Promise.all(ids.map((id) => ctx.runMutation(api.shoppingListItems.remove, { id })));
  },
};

export const addToShoppingList = defineVoiceAction({
  needs: ['ingredients'],
  instructions: 'Add items to the shopping list.',
  schema: (library) =>
    z
      .array(
        z.object({
          ingredientId: idSchema(library.ingredients)
            .nullable()
            .describe('ID of the matching existing ingredient, or null when none matches'),
          newIngredientName: z
            .string()
            .optional()
            .describe('Only when ingredientId is null: the base name of the new ingredient'),
          notes: z.string().optional().describe('Quantity or qualifier the user said, e.g. "2 l", "ripe"'),
        }),
      )
      .describe('Items to add to the shopping list'),
  run: async (output, { ctx, library, report, attempt }) => {
    const items = output.filter((item) => item.ingredientId || item.newIngredientName);
    if (items.length === 0) return;

    await attempt('Could not add the items to the shopping list', async () => {
      const shoppingListId = await ctx.runMutation(api.shoppingLists.createDefault, {});
      const newNames = items.flatMap((item) => (item.ingredientId ? [] : [item.newIngredientName ?? '']));
      const newIds = newNames.length > 0 ? await ctx.runAction(api.ingredients.quickCreate, { names: newNames }) : [];
      const ids: Id<'shoppingListItems'>[] = [];
      try {
        for (const item of items) {
          const ingredientId = (item.ingredientId as Id<'ingredients'> | null) ?? newIds.shift();
          if (!ingredientId) continue;
          const id = await ctx.runMutation(api.shoppingListItems.add, {
            shoppingListId,
            ingredientId,
            notes: item.notes,
          });
          // `null` when it was already on the list
          if (id) ids.push(id);
        }
      } catch (error) {
        // The items added before the failure stay on the list, so they get their own line with Undo
        if (ids.length > 0) {
          report({
            message: `Added only ${ids.length} of ${items.length} items to the shopping list`,
            undo: { type: 'shoppingItems', ids },
          });
        }
        throw error;
      }

      const names = items.map((item) => {
        const name = library.ingredients.find((i) => i._id === item.ingredientId)?.name ?? item.newIngredientName;
        return item.notes ? `${name} (${item.notes})` : name;
      });
      return { message: `Added to the shopping list: ${names.join(', ')}`, undo: { type: 'shoppingItems', ids } };
    });
  },
});

export const addRecipeIngredients = defineVoiceAction({
  needs: ['recipes'],
  instructions: 'Add all ingredients of a recipe to the shopping list.',
  schema: (library) =>
    z.array(idSchema(library.recipes)).describe('Recipes whose ingredients should all go on the shopping list'),
  run: async (output, { ctx, library, attempt }) => {
    for (const recipe of library.recipes.filter((r) => output.includes(r._id))) {
      await attempt(`Could not add the ingredients of ${recipe.title}`, async () => {
        const shoppingListId = await ctx.runMutation(api.shoppingLists.createDefault, {});
        const ids = await ctx.runMutation(api.shoppingListItems.addFromRecipe, {
          shoppingListId,
          recipeId: recipe._id,
        });
        return {
          message: `Added ${ids.length} ingredients of ${recipe.title} to the shopping list`,
          undo: { type: 'shoppingItems', ids },
        };
      });
    }
  },
});
