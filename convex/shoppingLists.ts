import { authenticatedMutation, authenticatedQuery } from './lib/helpers';

/**
 * Retrieves the single shopping list for the currently authenticated user.
 *
 * @returns A promise that resolves to the shopping list with all details.
 */
export const get = authenticatedQuery({
  args: {},
  handler: async (ctx) => {
    // Fetch the user's shopping list (should only be one)
    const list = await ctx.db
      .query('shoppingLists')
      .withIndex('by_user', (q) => q.eq('userId', ctx.userId))
      .first();

    // If no list exists, return null
    if (!list) {
      return null;
    }

    // Get items with ingredient details
    const items = await ctx.db
      .query('shoppingListItems')
      .withIndex('by_list_and_order', (q) => q.eq('shoppingListId', list._id))
      .order('asc')
      .collect();

    const itemsWithDetails = [];
    for (const item of items) {
      const ingredient = await ctx.db.get(item.ingredientId);
      let category = null;
      if (ingredient) {
        category = await ctx.db.get(ingredient.categoryId);
      }
      itemsWithDetails.push({
        ...item,
        ingredient,
        category,
      });
    }

    return {
      ...list,
      items: itemsWithDetails,
    };
  },
});

// Create the default shopping list for the user
export const createDefault = authenticatedMutation({
  args: {},
  handler: async (ctx) => {
    // Check if user already has a shopping list
    const existingList = await ctx.db
      .query('shoppingLists')
      .withIndex('by_user', (q) => q.eq('userId', ctx.userId))
      .first();

    if (existingList) {
      return existingList._id;
    }

    // Create a new default shopping list
    const listId = await ctx.db.insert('shoppingLists', {
      userId: ctx.userId,
      name: 'My Shopping List',
      status: 'active',
    });

    return listId;
  },
});
