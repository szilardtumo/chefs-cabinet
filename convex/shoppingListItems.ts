import { v } from 'convex/values';
import { authenticatedMutation, authenticatedQuery } from './helpers';

// Get all items for a shopping list
export const getByList = authenticatedQuery({
  args: { shoppingListId: v.id('shoppingLists') },
  handler: async (ctx, args) => {
    // Verify user owns the list
    const list = await ctx.db.get(args.shoppingListId);
    if (!list || list.userId !== ctx.userId) {
      throw new Error('Unauthorized');
    }

    const items = await ctx.db
      .query('shoppingListItems')
      .withIndex('by_list_and_order', (q) => q.eq('shoppingListId', args.shoppingListId))
      .order('asc')
      .collect();

    // Fetch ingredient and category details
    const itemsWithDetails = await Promise.all(
      items.map(async (item) => {
        const ingredient = await ctx.db.get(item.ingredientId);
        let category = null;
        if (ingredient) {
          category = await ctx.db.get(ingredient.categoryId);
        }
        return {
          ...item,
          ingredient,
          category,
        };
      }),
    );

    return itemsWithDetails;
  },
});

// Add an ingredient to a shopping list
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
      throw new Error('Unauthorized');
    }

    // Get current max order
    const existing = await ctx.db
      .query('shoppingListItems')
      .withIndex('by_list', (q) => q.eq('shoppingListId', args.shoppingListId))
      .collect();

    const maxOrder = existing.reduce((max, item) => Math.max(max, item.order), 0);

    const itemId = await ctx.db.insert('shoppingListItems', {
      shoppingListId: args.shoppingListId,
      ingredientId: args.ingredientId,
      recipeId: args.recipeId,
      checked: false,
      notes: args.notes,
      order: maxOrder + 1,
    });

    return itemId;
  },
});

// Add all ingredients from a recipe to a shopping list
export const addFromRecipe = authenticatedMutation({
  args: {
    shoppingListId: v.id('shoppingLists'),
    recipeId: v.id('recipes'),
  },
  handler: async (ctx, args) => {
    // Verify user owns the list
    const list = await ctx.db.get(args.shoppingListId);
    if (!list || list.userId !== ctx.userId) {
      throw new Error('Unauthorized');
    }

    // Verify user owns the recipe
    const recipe = await ctx.db.get(args.recipeId);
    if (!recipe || recipe.userId !== ctx.userId) {
      throw new Error('Unauthorized');
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
        ingredientId: ri.ingredientId,
        recipeId: args.recipeId,
        checked: false,
        notes,
        order,
      });

      addedItems.push(itemId);
    }

    return addedItems;
  },
});

// Toggle item checked status
export const toggleChecked = authenticatedMutation({
  args: {
    id: v.id('shoppingListItems'),
  },
  handler: async (ctx, args) => {
    const item = await ctx.db.get(args.id);
    if (!item) {
      throw new Error('Shopping list item not found');
    }

    // Verify user owns the list
    const list = await ctx.db.get(item.shoppingListId);
    if (!list || list.userId !== ctx.userId) {
      throw new Error('Unauthorized');
    }

    await ctx.db.patch(args.id, {
      checked: !item.checked,
    });

    return args.id;
  },
});

// Update a shopping list item
export const update = authenticatedMutation({
  args: {
    id: v.id('shoppingListItems'),
    notes: v.optional(v.string()),
    checked: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const item = await ctx.db.get(args.id);
    if (!item) {
      throw new Error('Shopping list item not found');
    }

    // Verify user owns the list
    const list = await ctx.db.get(item.shoppingListId);
    if (!list || list.userId !== ctx.userId) {
      throw new Error('Unauthorized');
    }

    const { id, ...updates } = args;
    await ctx.db.patch(id, updates);

    return id;
  },
});

// Remove an item from shopping list
export const remove = authenticatedMutation({
  args: { id: v.id('shoppingListItems') },
  handler: async (ctx, args) => {
    const item = await ctx.db.get(args.id);
    if (!item) {
      throw new Error('Shopping list item not found');
    }

    // Verify user owns the list
    const list = await ctx.db.get(item.shoppingListId);
    if (!list || list.userId !== ctx.userId) {
      throw new Error('Unauthorized');
    }

    await ctx.db.delete(args.id);
  },
});

// Clear all checked items from a list
export const clearChecked = authenticatedMutation({
  args: {
    shoppingListId: v.id('shoppingLists'),
  },
  handler: async (ctx, args) => {
    // Verify user owns the list
    const list = await ctx.db.get(args.shoppingListId);
    if (!list || list.userId !== ctx.userId) {
      throw new Error('Unauthorized');
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
