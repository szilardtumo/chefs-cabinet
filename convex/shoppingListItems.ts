import { v } from 'convex/values';
import { NotFoundError } from './errors';
import { authenticatedMutation } from './helpers';

/**
 * Adds an ingredient to a shopping list for the currently authenticated user.
 *
 * @param args.shoppingListId - The ID of the shopping list to add the ingredient to.
 * @param args.ingredientId - The ID of the ingredient to add.
 * @param args.notes - The notes for the shopping list item.
 *
 * @returns A promise that resolves to the ID of the created shopping list item.
 */
export const add = authenticatedMutation({
  args: {
    shoppingListId: v.id('shoppingLists'),
    ingredientId: v.id('ingredients'),
    recipeId: v.optional(v.id('recipes')),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Verify user owns the list
    const list = await ctx.db.get(args.shoppingListId);
    if (!list || list.userId !== ctx.userId) {
      // Do not expose the existence of the list if it is not owned by the user
      throw new NotFoundError('shoppingLists', args.shoppingListId);
    }

    // Get current max order
    const existing = await ctx.db
      .query('shoppingListItems')
      .withIndex('by_list', (q) => q.eq('shoppingListId', args.shoppingListId))
      .collect();

    const maxOrder = existing.reduce((max, item) => Math.max(max, item.order), 0);

    const itemId = await ctx.db.insert('shoppingListItems', {
      ...args,
      checked: false,
      order: maxOrder + 1,
    });

    return itemId;
  },
});

/**
 * Adds all ingredients from a recipe to a shopping list for the currently authenticated user.
 *
 * @param args.shoppingListId - The ID of the shopping list to add the ingredients to.
 * @param args.recipeId - The ID of the recipe to add the ingredients from.
 *
 * @returns A promise that resolves to an array of the IDs of the created shopping list items.
 */
export const addFromRecipe = authenticatedMutation({
  args: {
    shoppingListId: v.id('shoppingLists'),
    recipeId: v.id('recipes'),
  },
  handler: async (ctx, args) => {
    // Verify user owns the list
    const list = await ctx.db.get(args.shoppingListId);
    if (!list || list.userId !== ctx.userId) {
      // Do not expose the existence of the list if it is not owned by the user
      throw new NotFoundError('shoppingLists', args.shoppingListId);
    }

    // Verify user owns the recipe
    const recipe = await ctx.db.get(args.recipeId);
    if (!recipe || recipe.userId !== ctx.userId) {
      // Do not expose the existence of the recipe if it is not owned by the user
      throw new NotFoundError('recipes', args.recipeId);
    }

    // Get recipe ingredients
    const recipeIngredients = await ctx.db
      .query('recipeIngredients')
      .withIndex('by_recipe', (q) => q.eq('recipeId', args.recipeId))
      .collect();

    // Get current max order
    const existing = await ctx.db
      .query('shoppingListItems')
      .withIndex('by_list', (q) => q.eq('shoppingListId', args.shoppingListId))
      .collect();

    let order = existing.reduce((max, item) => Math.max(max, item.order), 0);

    // Add each ingredient
    const addedItems = [];
    for (const ri of recipeIngredients) {
      order++;
      const notes = `${ri.quantity} ${ri.unit}${ri.notes ? ` - ${ri.notes}` : ''}`;

      const itemId = await ctx.db.insert('shoppingListItems', {
        shoppingListId: args.shoppingListId,
        recipeId: args.recipeId,
        ingredientId: ri.ingredientId,
        checked: false,
        notes,
        order,
      });

      addedItems.push(itemId);
    }

    return addedItems;
  },
});

/**
 * Toggles the checked status of a shopping list item for the currently authenticated user.
 *
 * @param args.id - The ID of the shopping list item to toggle the checked status of.
 *
 * @returns A promise that resolves to the ID of the updated shopping list item.
 */
export const toggleChecked = authenticatedMutation({
  args: {
    id: v.id('shoppingListItems'),
  },
  handler: async (ctx, args) => {
    const item = await ctx.db.get(args.id);
    if (!item) {
      throw new NotFoundError('shoppingListItems', args.id);
    }

    // Verify user owns the list
    const list = await ctx.db.get(item.shoppingListId);
    if (!list || list.userId !== ctx.userId) {
      // Do not expose the existence of the list if it is not owned by the user
      throw new NotFoundError('shoppingLists', item.shoppingListId);
    }

    await ctx.db.patch(args.id, {
      checked: !item.checked,
    });

    return args.id;
  },
});

/**
 * Updates a shopping list item for the currently authenticated user.
 *
 * @param args.id - The ID of the shopping list item to update.
 * @param args.notes - The notes for the shopping list item.
 * @param args.checked - The checked status of the shopping list item.
 *
 * @returns A promise that resolves to the ID of the updated shopping list item.
 */
export const update = authenticatedMutation({
  args: {
    id: v.id('shoppingListItems'),
    notes: v.optional(v.string()),
    checked: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const item = await ctx.db.get(args.id);
    if (!item) {
      throw new NotFoundError('shoppingListItems', args.id);
    }

    // Verify user owns the list
    const list = await ctx.db.get(item.shoppingListId);
    if (!list || list.userId !== ctx.userId) {
      // Do not expose the existence of the list if it is not owned by the user
      throw new NotFoundError('shoppingLists', item.shoppingListId);
    }

    const { id, ...updates } = args;
    await ctx.db.patch(id, updates);

    return id;
  },
});

/**
 * Removes a shopping list item for the currently authenticated user.
 *
 * @param args.id - The ID of the shopping list item to remove.
 *
 * @returns A promise that resolves to the ID of the removed shopping list item.
 */
export const remove = authenticatedMutation({
  args: { id: v.id('shoppingListItems') },
  handler: async (ctx, args) => {
    const item = await ctx.db.get(args.id);
    if (!item) {
      throw new NotFoundError('shoppingListItems', args.id);
    }

    // Verify user owns the list
    const list = await ctx.db.get(item.shoppingListId);
    if (!list || list.userId !== ctx.userId) {
      // Do not expose the existence of the list if it is not owned by the user
      throw new NotFoundError('shoppingLists', item.shoppingListId);
    }

    await ctx.db.delete(args.id);

    return args.id;
  },
});

/**
 * Removes all checked items from a shopping list for the currently authenticated user.
 *
 * @param args.shoppingListId - The ID of the shopping list to clear the checked items from.
 *
 * @returns A promise that resolves to the number of checked items cleared.
 */
export const removeChecked = authenticatedMutation({
  args: {
    shoppingListId: v.id('shoppingLists'),
  },
  handler: async (ctx, args) => {
    // Verify user owns the list
    const list = await ctx.db.get(args.shoppingListId);
    if (!list || list.userId !== ctx.userId) {
      // Do not expose the existence of the list if it is not owned by the user
      throw new NotFoundError('shoppingLists', args.shoppingListId);
    }

    const items = await ctx.db
      .query('shoppingListItems')
      .withIndex('by_list', (q) => q.eq('shoppingListId', args.shoppingListId))
      .collect();

    const checkedItems = items.filter((item) => item.checked);

    for (const item of checkedItems) {
      await ctx.db.delete(item._id);
    }

    return checkedItems.length;
  },
});

/**
 * Removes all items from a shopping list for the currently authenticated user.
 *
 * @param args.shoppingListId - The ID of the shopping list to remove the items from.
 *
 * @returns A promise that resolves to the number of items removed.
 */
export const removeAll = authenticatedMutation({
  args: { shoppingListId: v.id('shoppingLists') },
  handler: async (ctx, args) => {
    // Verify user owns the list
    const list = await ctx.db.get(args.shoppingListId);
    if (!list || list.userId !== ctx.userId) {
      // Do not expose the existence of the list if it is not owned by the user
      throw new NotFoundError('shoppingLists', args.shoppingListId);
    }

    const items = await ctx.db
      .query('shoppingListItems')
      .withIndex('by_list', (q) => q.eq('shoppingListId', args.shoppingListId))
      .collect();

    for (const item of items) {
      await ctx.db.delete(item._id);
    }

    return items.length;
  },
});

/**
 * Removes a shopping list item by ingredient ID for the currently authenticated user.
 *
 * @param args.shoppingListId - The ID of the shopping list.
 * @param args.ingredientId - The ID of the ingredient to remove.
 *
 * @returns A promise that resolves to the ID of the removed shopping list item, or null if not found.
 */
export const removeByIngredient = authenticatedMutation({
  args: {
    shoppingListId: v.id('shoppingLists'),
    ingredientId: v.id('ingredients'),
  },
  handler: async (ctx, args) => {
    // Verify user owns the list
    const list = await ctx.db.get(args.shoppingListId);
    if (!list || list.userId !== ctx.userId) {
      // Do not expose the existence of the list if it is not owned by the user
      throw new NotFoundError('shoppingLists', args.shoppingListId);
    }

    // Find the item with this ingredient
    const items = await ctx.db
      .query('shoppingListItems')
      .withIndex('by_list', (q) => q.eq('shoppingListId', args.shoppingListId))
      .collect();

    const item = items.find((item) => item.ingredientId === args.ingredientId);

    if (!item) {
      return null;
    }

    await ctx.db.delete(item._id);

    return item._id;
  },
});
