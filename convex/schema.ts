import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Categories for organizing ingredients
  categories: defineTable({
    userId: v.string(),
    name: v.string(),
    description: v.optional(v.string()),
    emoji: v.optional(v.string()),
    color: v.optional(v.string()),
    order: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_and_order", ["userId", "order"]),

  // Ingredients
  ingredients: defineTable({
    userId: v.string(),
    name: v.string(),
    categoryId: v.id("categories"),
    defaultUnit: v.optional(v.string()),
    notes: v.optional(v.string()),
    emoji: v.optional(v.string()),
  })
    .index("by_user", ["userId"])
    .index("by_category", ["categoryId"])
    .index("by_user_and_name", ["userId", "name"]),

  // Recipes
  recipes: defineTable({
    userId: v.string(),
    title: v.string(),
    description: v.string(),
    image: v.optional(v.id("_storage")),
    cookingTime: v.number(),
    prepTime: v.number(),
    servings: v.number(),
    instructions: v.array(v.string()),
    tags: v.array(v.string()),
    history: v.optional(
      v.array(
        v.object({
          timestamp: v.number(),
          type: v.union(
            v.literal("created"),
            v.literal("description_modified"),
            v.literal("ingredients_modified"),
            v.literal("instructions_modified"),
            v.literal("general_edit")
          ),
          changedFields: v.optional(v.array(v.string())),
          aiGenerated: v.optional(v.boolean()),
          aiPrompt: v.optional(v.string()),
          note: v.optional(v.string()),
        })
      )
    ),
  }).index("by_user", ["userId"]),

  // Recipe Ingredients (join table)
  recipeIngredients: defineTable({
    recipeId: v.id("recipes"),
    ingredientId: v.id("ingredients"),
    quantity: v.number(),
    unit: v.string(),
    notes: v.optional(v.string()),
    order: v.number(),
  })
    .index("by_recipe", ["recipeId"])
    .index("by_ingredient", ["ingredientId"])
    .index("by_recipe_and_order", ["recipeId", "order"]),

  // Shopping Lists
  shoppingLists: defineTable({
    userId: v.string(),
    name: v.string(),
    status: v.union(
      v.literal("active"),
      v.literal("completed"),
      v.literal("archived")
    ),
    completedAt: v.optional(v.number()),
  })
    .index("by_user", ["userId"])
    .index("by_user_and_status", ["userId", "status"]),

  // Shopping List Items
  shoppingListItems: defineTable({
    shoppingListId: v.id("shoppingLists"),
    ingredientId: v.id("ingredients"),
    recipeId: v.optional(v.id("recipes")),
    checked: v.boolean(),
    notes: v.optional(v.string()),
    order: v.number(),
  })
    .index("by_list", ["shoppingListId"])
    .index("by_list_and_order", ["shoppingListId", "order"]),
});
