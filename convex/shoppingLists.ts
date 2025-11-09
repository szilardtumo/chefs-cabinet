import { v } from "convex/values";
import { authenticatedQuery, authenticatedMutation } from "./helpers";

// Get all shopping lists for the current user
export const getAll = authenticatedQuery({
  args: {},
  handler: async (ctx) => {
    const lists = await ctx.db
      .query("shoppingLists")
      .withIndex("by_user", (q) => q.eq("userId", ctx.userId))
      .order("desc")
      .collect();

    // Get item counts for each list
    const listsWithCounts = await Promise.all(
      lists.map(async (list) => {
        const items = await ctx.db
          .query("shoppingListItems")
          .withIndex("by_list", (q) => q.eq("shoppingListId", list._id))
          .collect();

        const checkedCount = items.filter((item) => item.checked).length;

        return {
          ...list,
          totalItems: items.length,
          checkedItems: checkedCount,
        };
      })
    );

    return listsWithCounts;
  },
});

// Get active shopping lists
export const getActive = authenticatedQuery({
  args: {},
  handler: async (ctx) => {
    const lists = await ctx.db
      .query("shoppingLists")
      .withIndex("by_user_and_status", (q) =>
        q.eq("userId", ctx.userId).eq("status", "active")
      )
      .order("desc")
      .collect();

    // Get item counts
    const listsWithCounts = await Promise.all(
      lists.map(async (list) => {
        const items = await ctx.db
          .query("shoppingListItems")
          .withIndex("by_list", (q) => q.eq("shoppingListId", list._id))
          .collect();

        const checkedCount = items.filter((item) => item.checked).length;

        return {
          ...list,
          totalItems: items.length,
          checkedItems: checkedCount,
        };
      })
    );

    return listsWithCounts;
  },
});

// Get a single shopping list with items
export const getById = authenticatedQuery({
  args: { id: v.id("shoppingLists") },
  handler: async (ctx, args) => {
    const list = await ctx.db.get(args.id);
    if (!list) {
      throw new Error("Shopping list not found");
    }

    if (list.userId !== ctx.userId) {
      throw new Error("Unauthorized");
    }

    // Get items with ingredient details
    const items = await ctx.db
      .query("shoppingListItems")
      .withIndex("by_list_and_order", (q) => q.eq("shoppingListId", args.id))
      .order("asc")
      .collect();

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
      })
    );

    return {
      ...list,
      items: itemsWithDetails,
    };
  },
});

// Create a new shopping list
export const create = authenticatedMutation({
  args: {
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const listId = await ctx.db.insert("shoppingLists", {
      userId: ctx.userId,
      name: args.name,
      status: "active",
    });

    return listId;
  },
});

// Update a shopping list
export const update = authenticatedMutation({
  args: {
    id: v.id("shoppingLists"),
    name: v.optional(v.string()),
    status: v.optional(
      v.union(
        v.literal("active"),
        v.literal("completed"),
        v.literal("archived")
      )
    ),
  },
  handler: async (ctx, args) => {
    const list = await ctx.db.get(args.id);
    if (!list) {
      throw new Error("Shopping list not found");
    }

    if (list.userId !== ctx.userId) {
      throw new Error("Unauthorized");
    }

    const { id, ...updates } = args;

    // If marking as completed, set completedAt
    const patchData: any = { ...updates };
    if (updates.status === "completed" && list.status !== "completed") {
      patchData.completedAt = Date.now();
    }

    await ctx.db.patch(id, patchData);

    return id;
  },
});

// Get the single shopping list for the user
export const get = authenticatedQuery({
  args: {},
  handler: async (ctx) => {
    // Fetch the user's shopping list (should only be one)
    const list = await ctx.db
      .query("shoppingLists")
      .withIndex("by_user", (q) => q.eq("userId", ctx.userId))
      .first();

    // If no list exists, return null
    if (!list) {
      return null;
    }

    // Get items with ingredient details
    const items = await ctx.db
      .query("shoppingListItems")
      .withIndex("by_list_and_order", (q) => q.eq("shoppingListId", list._id))
      .order("asc")
      .collect();

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
      })
    );

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
      .query("shoppingLists")
      .withIndex("by_user", (q) => q.eq("userId", ctx.userId))
      .first();

    if (existingList) {
      return existingList._id;
    }

    // Create a new default shopping list
    const listId = await ctx.db.insert("shoppingLists", {
      userId: ctx.userId,
      name: "My Shopping List",
      status: "active",
    });

    return listId;
  },
});

// Delete a shopping list
export const remove = authenticatedMutation({
  args: { id: v.id("shoppingLists") },
  handler: async (ctx, args) => {
    const list = await ctx.db.get(args.id);
    if (!list) {
      throw new Error("Shopping list not found");
    }

    if (list.userId !== ctx.userId) {
      throw new Error("Unauthorized");
    }

    // Delete all items
    const items = await ctx.db
      .query("shoppingListItems")
      .withIndex("by_list", (q) => q.eq("shoppingListId", args.id))
      .collect();

    for (const item of items) {
      await ctx.db.delete(item._id);
    }

    // Delete the list
    await ctx.db.delete(args.id);
  },
});
