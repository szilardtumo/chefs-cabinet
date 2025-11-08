import { v } from "convex/values";
import { authenticatedQuery, authenticatedMutation } from "./helpers";

// Get all ingredients for a recipe
export const getByRecipe = authenticatedQuery({
  args: { recipeId: v.id("recipes") },
  handler: async (ctx, args) => {
    // Verify user owns the recipe
    const recipe = await ctx.db.get(args.recipeId);
    if (!recipe || recipe.userId !== ctx.userId) {
      throw new Error("Unauthorized");
    }

    const recipeIngredients = await ctx.db
      .query("recipeIngredients")
      .withIndex("by_recipe_and_order", (q) => q.eq("recipeId", args.recipeId))
      .order("asc")
      .collect();

    // Fetch ingredient details
    const ingredientsWithDetails = await Promise.all(
      recipeIngredients.map(async (ri) => {
        const ingredient = await ctx.db.get(ri.ingredientId);
        return {
          ...ri,
          ingredient,
        };
      })
    );

    return ingredientsWithDetails;
  },
});

// Add an ingredient to a recipe
export const add = authenticatedMutation({
  args: {
    recipeId: v.id("recipes"),
    ingredientId: v.id("ingredients"),
    quantity: v.number(),
    unit: v.string(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Verify user owns the recipe
    const recipe = await ctx.db.get(args.recipeId);
    if (!recipe || recipe.userId !== ctx.userId) {
      throw new Error("Unauthorized");
    }

    // Get current max order
    const existing = await ctx.db
      .query("recipeIngredients")
      .withIndex("by_recipe", (q) => q.eq("recipeId", args.recipeId))
      .collect();

    const maxOrder = existing.reduce((max, ri) => Math.max(max, ri.order), 0);

    const recipeIngredientId = await ctx.db.insert("recipeIngredients", {
      recipeId: args.recipeId,
      ingredientId: args.ingredientId,
      quantity: args.quantity,
      unit: args.unit,
      notes: args.notes,
      order: maxOrder + 1,
    });

    return recipeIngredientId;
  },
});

// Update a recipe ingredient
export const update = authenticatedMutation({
  args: {
    id: v.id("recipeIngredients"),
    quantity: v.optional(v.number()),
    unit: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const recipeIngredient = await ctx.db.get(args.id);
    if (!recipeIngredient) {
      throw new Error("Recipe ingredient not found");
    }

    // Verify user owns the recipe
    const recipe = await ctx.db.get(recipeIngredient.recipeId);
    if (!recipe || recipe.userId !== ctx.userId) {
      throw new Error("Unauthorized");
    }

    const { id, ...updates } = args;
    await ctx.db.patch(id, updates);

    return id;
  },
});

// Remove an ingredient from a recipe
export const remove = authenticatedMutation({
  args: { id: v.id("recipeIngredients") },
  handler: async (ctx, args) => {
    const recipeIngredient = await ctx.db.get(args.id);
    if (!recipeIngredient) {
      throw new Error("Recipe ingredient not found");
    }

    // Verify user owns the recipe
    const recipe = await ctx.db.get(recipeIngredient.recipeId);
    if (!recipe || recipe.userId !== ctx.userId) {
      throw new Error("Unauthorized");
    }

    await ctx.db.delete(args.id);
  },
});

// Reorder recipe ingredients
export const reorder = authenticatedMutation({
  args: {
    updates: v.array(
      v.object({
        id: v.id("recipeIngredients"),
        order: v.number(),
      })
    ),
  },
  handler: async (ctx, args) => {
    // Verify all recipe ingredients belong to user's recipe
    for (const update of args.updates) {
      const recipeIngredient = await ctx.db.get(update.id);
      if (!recipeIngredient) {
        throw new Error("Recipe ingredient not found");
      }

      const recipe = await ctx.db.get(recipeIngredient.recipeId);
      if (!recipe || recipe.userId !== ctx.userId) {
        throw new Error("Unauthorized");
      }
    }

    // Update all orders
    for (const update of args.updates) {
      await ctx.db.patch(update.id, { order: update.order });
    }
  },
});

