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
    { name: 'Onion', defaultUnit: 'g' },
    { name: 'Garlic', defaultUnit: 'g' },
    { name: 'Tomato', defaultUnit: 'g' },
    { name: 'Carrot', defaultUnit: 'g' },
    { name: 'Bell Pepper', defaultUnit: 'g' },
    { name: 'Potato', defaultUnit: 'g' },
    { name: 'Broccoli', defaultUnit: 'g' },
    { name: 'Spinach', defaultUnit: 'g' },
  ],
  'Herbs & Spices': [
    { name: 'Salt', defaultUnit: 'g' },
    { name: 'Black Pepper', defaultUnit: 'g' },
    { name: 'Basil', defaultUnit: 'g' },
    { name: 'Oregano', defaultUnit: 'g' },
    { name: 'Thyme', defaultUnit: 'g' },
    { name: 'Rosemary', defaultUnit: 'g' },
    { name: 'Paprika', defaultUnit: 'g' },
    { name: 'Cumin', defaultUnit: 'g' },
  ],
  'Oils & Condiments': [
    { name: 'Olive Oil', defaultUnit: 'ml' },
    { name: 'Vegetable Oil', defaultUnit: 'ml' },
    { name: 'Soy Sauce', defaultUnit: 'ml' },
    { name: 'Vinegar', defaultUnit: 'ml' },
  ],
  'Grains & Pasta': [
    { name: 'Pasta', defaultUnit: 'g' },
    { name: 'Rice', defaultUnit: 'g' },
    { name: 'Flour', defaultUnit: 'g' },
    { name: 'Bread', defaultUnit: 'g' },
  ],
  'Dairy & Eggs': [
    { name: 'Butter', defaultUnit: 'g' },
    { name: 'Milk', defaultUnit: 'ml' },
    { name: 'Cheese', defaultUnit: 'g' },
    { name: 'Eggs', defaultUnit: 'piece' },
    { name: 'Cream', defaultUnit: 'ml' },
    { name: 'Yogurt', defaultUnit: 'ml' },
  ],
  'Meat & Poultry': [
    { name: 'Chicken Breast', defaultUnit: 'g' },
    { name: 'Ground Beef', defaultUnit: 'g' },
    { name: 'Pork', defaultUnit: 'g' },
    { name: 'Bacon', defaultUnit: 'g' },
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
