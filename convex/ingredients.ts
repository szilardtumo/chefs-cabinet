import { v } from "convex/values";
import { authenticatedQuery, authenticatedMutation } from "./helpers";

// Get all ingredients for the current user
export const getAll = authenticatedQuery({
  args: {},
  handler: async (ctx) => {
    const ingredients = await ctx.db
      .query("ingredients")
      .withIndex("by_user", (q) => q.eq("userId", ctx.userId))
      .collect();

    // Fetch category for each ingredient
    const ingredientsWithCategory = await Promise.all(
      ingredients.map(async (ingredient) => {
        const category = await ctx.db.get(ingredient.categoryId);
        return {
          ...ingredient,
          category,
        };
      })
    );

    return ingredientsWithCategory;
  },
});

// Get ingredients by category
export const getByCategory = authenticatedQuery({
  args: { categoryId: v.id("categories") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("ingredients")
      .withIndex("by_category", (q) => q.eq("categoryId", args.categoryId))
      .collect();
  },
});

// Get a single ingredient by ID
export const getById = authenticatedQuery({
  args: { id: v.id("ingredients") },
  handler: async (ctx, args) => {
    const ingredient = await ctx.db.get(args.id);
    if (!ingredient) {
      throw new Error("Ingredient not found");
    }

    if (ingredient.userId !== ctx.userId) {
      throw new Error("Unauthorized");
    }

    const category = await ctx.db.get(ingredient.categoryId);

    return {
      ...ingredient,
      category,
    };
  },
});

// Search ingredients by name
export const search = authenticatedQuery({
  args: { query: v.string() },
  handler: async (ctx, args) => {
    const allIngredients = await ctx.db
      .query("ingredients")
      .withIndex("by_user", (q) => q.eq("userId", ctx.userId))
      .collect();

    // Simple search by name (case-insensitive)
    const query = args.query.toLowerCase();
    const filtered = allIngredients.filter((ingredient) =>
      ingredient.name.toLowerCase().includes(query)
    );

    // Fetch categories
    const ingredientsWithCategory = await Promise.all(
      filtered.map(async (ingredient) => {
        const category = await ctx.db.get(ingredient.categoryId);
        return {
          ...ingredient,
          category,
        };
      })
    );

    return ingredientsWithCategory;
  },
});

// Create a new ingredient
export const create = authenticatedMutation({
  args: {
    name: v.string(),
    categoryId: v.id("categories"),
    defaultUnit: v.optional(v.string()),
    notes: v.optional(v.string()),
    emoji: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Verify category belongs to user
    const category = await ctx.db.get(args.categoryId);
    if (!category || category.userId !== ctx.userId) {
      throw new Error("Invalid category");
    }

    const ingredientId = await ctx.db.insert("ingredients", {
      userId: ctx.userId,
      name: args.name,
      categoryId: args.categoryId,
      defaultUnit: args.defaultUnit,
      notes: args.notes,
      emoji: args.emoji,
    });

    return ingredientId;
  },
});

// Update an ingredient
export const update = authenticatedMutation({
  args: {
    id: v.id("ingredients"),
    name: v.optional(v.string()),
    categoryId: v.optional(v.id("categories")),
    defaultUnit: v.optional(v.string()),
    notes: v.optional(v.string()),
    emoji: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const ingredient = await ctx.db.get(args.id);
    if (!ingredient) {
      throw new Error("Ingredient not found");
    }

    if (ingredient.userId !== ctx.userId) {
      throw new Error("Unauthorized");
    }

    // If changing category, verify new category belongs to user
    if (args.categoryId) {
      const category = await ctx.db.get(args.categoryId);
      if (!category || category.userId !== ctx.userId) {
        throw new Error("Invalid category");
      }
    }

    const { id, ...updates } = args;
    await ctx.db.patch(id, updates);

    return id;
  },
});

// Delete an ingredient
export const remove = authenticatedMutation({
  args: { id: v.id("ingredients") },
  handler: async (ctx, args) => {
    const ingredient = await ctx.db.get(args.id);
    if (!ingredient) {
      throw new Error("Ingredient not found");
    }

    if (ingredient.userId !== ctx.userId) {
      throw new Error("Unauthorized");
    }

    // Check if any recipes use this ingredient
    const recipeIngredient = await ctx.db
      .query("recipeIngredients")
      .withIndex("by_ingredient", (q) => q.eq("ingredientId", args.id))
      .first();

    if (recipeIngredient) {
      throw new Error("Cannot delete ingredient used in recipes");
    }

    await ctx.db.delete(args.id);
  },
});
