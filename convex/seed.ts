import type { Id } from './_generated/dataModel';

import { authenticatedMutation } from './lib/helpers';

// Default categories with emojis and colors
const defaultCategories = [
  { name: 'Vegetables', emoji: '🥬', color: '#22c55e', order: 1 },
  { name: 'Fruits', emoji: '🍎', color: '#ef4444', order: 2 },
  { name: 'Meat & Poultry', emoji: '🍖', color: '#dc2626', order: 3 },
  { name: 'Seafood', emoji: '🐟', color: '#3b82f6', order: 4 },
  { name: 'Dairy & Eggs', emoji: '🥛', color: '#f8fafc', order: 5 },
  { name: 'Grains & Pasta', emoji: '🌾', color: '#d97706', order: 6 },
  { name: 'Herbs & Spices', emoji: '🌿', color: '#84cc16', order: 7 },
  { name: 'Oils & Condiments', emoji: '🫙', color: '#fbbf24', order: 8 },
  { name: 'Baking', emoji: '🧁', color: '#ec4899', order: 9 },
  { name: 'Other', emoji: '📦', color: '#6b7280', order: 10 },
];

// Default ingredients by category
const defaultIngredients = {
  Vegetables: [
    { name: 'Onion', defaultUnit: 'g', emoji: '🧅' },
    { name: 'Garlic', defaultUnit: 'g', emoji: '🧄' },
    { name: 'Tomato', defaultUnit: 'g', emoji: '🍅' },
    { name: 'Carrot', defaultUnit: 'g', emoji: '🥕' },
    { name: 'Bell Pepper', defaultUnit: 'g', emoji: '🫑' },
    { name: 'Potato', defaultUnit: 'g', emoji: '🥔' },
    { name: 'Broccoli', defaultUnit: 'g', emoji: '🥦' },
    { name: 'Spinach', defaultUnit: 'g', emoji: '🥬' },
  ],
  'Herbs & Spices': [
    { name: 'Salt', defaultUnit: 'g', emoji: '🧂' },
    { name: 'Black Pepper', defaultUnit: 'g', emoji: '🫚' },
    { name: 'Basil', defaultUnit: 'g', emoji: '🌿' },
    { name: 'Oregano', defaultUnit: 'g', emoji: '🌿' },
    { name: 'Thyme', defaultUnit: 'g', emoji: '🌿' },
    { name: 'Rosemary', defaultUnit: 'g', emoji: '🌿' },
    { name: 'Paprika', defaultUnit: 'g', emoji: '🌶️' },
    { name: 'Cumin', defaultUnit: 'g', emoji: '🌾' },
  ],
  'Oils & Condiments': [
    { name: 'Olive Oil', defaultUnit: 'ml', emoji: '🫒' },
    { name: 'Vegetable Oil', defaultUnit: 'ml', emoji: '🫙' },
    { name: 'Soy Sauce', defaultUnit: 'ml', emoji: '🫙' },
    { name: 'Vinegar', defaultUnit: 'ml', emoji: '🫙' },
  ],
  'Grains & Pasta': [
    { name: 'Pasta', defaultUnit: 'g', emoji: '🍝' },
    { name: 'Rice', defaultUnit: 'g', emoji: '🍚' },
    { name: 'Flour', defaultUnit: 'g', emoji: '🌾' },
    { name: 'Bread', defaultUnit: 'g', emoji: '🍞' },
  ],
  'Dairy & Eggs': [
    { name: 'Butter', defaultUnit: 'g', emoji: '🧈' },
    { name: 'Milk', defaultUnit: 'ml', emoji: '🥛' },
    { name: 'Cheese', defaultUnit: 'g', emoji: '🧀' },
    { name: 'Eggs', defaultUnit: 'piece', emoji: '🥚' },
    { name: 'Heavy Cream', defaultUnit: 'ml', emoji: '🥛' },
    { name: 'Yogurt', defaultUnit: 'ml', emoji: '🥛' },
  ],
  'Meat & Poultry': [
    { name: 'Chicken Breast', defaultUnit: 'g', emoji: '🐓' },
    { name: 'Ground Beef', defaultUnit: 'g', emoji: '🥩' },
    { name: 'Pork', defaultUnit: 'g', emoji: '🐷' },
    { name: 'Bacon', defaultUnit: 'g', emoji: '🥓' },
  ],
};

export const seedUserData = authenticatedMutation({
  args: {},
  handler: async (ctx) => {
    // Check if user already has categories
    const existingCategories = await ctx.db
      .query('categories')
      .withIndex('by_user', (q) => q.eq('userId', ctx.userId))
      .first();

    if (existingCategories) {
      return { message: 'User already has data', alreadySeeded: true };
    }

    // Create categories
    const categoryMap = new Map<string, Id<'categories'>>();
    for (const category of defaultCategories) {
      const categoryId = await ctx.db.insert('categories', {
        userId: ctx.userId,
        name: category.name,
        emoji: category.emoji,
        color: category.color,
        order: category.order,
      });
      categoryMap.set(category.name, categoryId);
    }

    // Create ingredients
    let ingredientCount = 0;
    for (const [categoryName, ingredients] of Object.entries(defaultIngredients)) {
      const categoryId = categoryMap.get(categoryName);
      if (!categoryId) continue;

      for (const ingredient of ingredients) {
        await ctx.db.insert('ingredients', {
          userId: ctx.userId,
          categoryId,
          name: ingredient.name,
          defaultUnit: ingredient.defaultUnit,
          emoji: ingredient.emoji,
          usageScore: 0,
          lastUsageAt: Date.now(),
        });
        ingredientCount++;
      }
    }

    return {
      message: 'Seed data created successfully',
      categoriesCreated: defaultCategories.length,
      ingredientsCreated: ingredientCount,
    };
  },
});

// Check if user has been seeded
export const checkSeeded = authenticatedMutation({
  args: {},
  handler: async (ctx) => {
    const existingCategories = await ctx.db
      .query('categories')
      .withIndex('by_user', (q) => q.eq('userId', ctx.userId))
      .first();

    return { isSeeded: !!existingCategories };
  },
});
