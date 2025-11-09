import { v } from 'convex/values';
import { InvalidOperationError, NotFoundError, UnauthorizedError } from './errors';
import { authenticatedMutation, authenticatedQuery } from './helpers';

// Get all categories for the current user
export const getAll = authenticatedQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query('categories')
      .withIndex('by_user_and_order', (q) => q.eq('userId', ctx.userId))
      .order('asc')
      .collect();
  },
});

// Get a single category by ID
export const getById = authenticatedQuery({
  args: { id: v.id('categories') },
  handler: async (ctx, args) => {
    const category = await ctx.db.get(args.id);
    if (!category) {
      throw new NotFoundError('Category', args.id);
    }

    if (category.userId !== ctx.userId) {
      throw new UnauthorizedError();
    }

    return category;
  },
});

// Create a new category
export const create = authenticatedMutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    emoji: v.optional(v.string()),
    color: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Get the current max order for this user
    const categories = await ctx.db
      .query('categories')
      .withIndex('by_user', (q) => q.eq('userId', ctx.userId))
      .collect();

    const maxOrder = categories.reduce((max, cat) => Math.max(max, cat.order), 0);

    const categoryId = await ctx.db.insert('categories', {
      userId: ctx.userId,
      name: args.name,
      description: args.description,
      emoji: args.emoji,
      color: args.color,
      order: maxOrder + 1,
    });

    return categoryId;
  },
});

// Update a category
export const update = authenticatedMutation({
  args: {
    id: v.id('categories'),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    emoji: v.optional(v.string()),
    color: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const category = await ctx.db.get(args.id);
    if (!category) {
      throw new NotFoundError('Category', args.id);
    }

    if (category.userId !== ctx.userId) {
      throw new UnauthorizedError();
    }

    const { id, ...updates } = args;
    await ctx.db.patch(id, updates);

    return id;
  },
});

// Delete a category
export const remove = authenticatedMutation({
  args: { id: v.id('categories') },
  handler: async (ctx, args) => {
    const category = await ctx.db.get(args.id);
    if (!category) {
      throw new NotFoundError('Category', args.id);
    }

    if (category.userId !== ctx.userId) {
      throw new UnauthorizedError();
    }

    // Check if any ingredients use this category
    const ingredients = await ctx.db
      .query('ingredients')
      .withIndex('by_category', (q) => q.eq('categoryId', args.id))
      .first();

    if (ingredients) {
      throw new InvalidOperationError('Cannot delete category with ingredients');
    }

    await ctx.db.delete(args.id);
  },
});

// Reorder categories
export const reorder = authenticatedMutation({
  args: {
    updates: v.array(
      v.object({
        id: v.id('categories'),
        order: v.number(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    // Verify all categories belong to the user
    for (const update of args.updates) {
      const category = await ctx.db.get(update.id);
      if (!category || category.userId !== ctx.userId) {
        throw new UnauthorizedError();
      }
    }

    // Update all orders
    for (const update of args.updates) {
      await ctx.db.patch(update.id, { order: update.order });
    }
  },
});
