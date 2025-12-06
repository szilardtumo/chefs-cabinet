import { v } from 'convex/values';
import { InvalidOperationError, NotFoundError, UnauthorizedError } from './lib/errors';
import { authenticatedMutation, authenticatedQuery } from './lib/helpers';

/**
 * Retrieves all categories for the currently authenticated user.
 *
 * @returns A promise that resolves to an array of categories belonging to the user.
 */
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

/**
 * Retrieves a single category by ID for the currently authenticated user.
 *
 * @param args - The arguments object containing the category ID.
 * @param args.id - The ID of the category to retrieve.
 *
 * @returns A promise that resolves to the category object.
 */
export const getById = authenticatedQuery({
  args: { id: v.id('categories') },
  handler: async (ctx, args) => {
    const category = await ctx.db.get(args.id);
    if (!category) {
      throw new NotFoundError('categories', args.id);
    }

    if (category.userId !== ctx.userId) {
      // Do not expose the existence of the category if it is not owned by the user
      throw new NotFoundError('categories', args.id);
    }

    return category;
  },
});

/**
 * Creates a new category for the currently authenticated user.
 *
 * @param args - The arguments object containing the category details.
 *
 * @returns A promise that resolves to the ID of the created category.
 */
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
      ...args,
      userId: ctx.userId,
      order: maxOrder + 1,
    });

    return categoryId;
  },
});

/**
 * Updates a category for the currently authenticated user.
 *
 * @param args - The arguments object containing the category details.
 * @param args.id - The ID of the category to update.
 *
 * @returns A promise that resolves to the ID of the updated category.
 */
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
      throw new NotFoundError('categories', args.id);
    }

    if (category.userId !== ctx.userId) {
      // Do not expose the existence of the category if it is not owned by the user
      throw new NotFoundError('categories', args.id);
    }

    const { id, ...updates } = args;
    await ctx.db.patch(id, updates);

    return id;
  },
});

/**
 * Deletes a category for the currently authenticated user.
 *
 * @param args.id - The ID of the category to delete.
 *
 * @returns A promise that resolves to the ID of the deleted category.
 */
export const remove = authenticatedMutation({
  args: { id: v.id('categories') },
  handler: async (ctx, args) => {
    const category = await ctx.db.get(args.id);
    if (!category) {
      throw new NotFoundError('categories', args.id);
    }

    if (category.userId !== ctx.userId) {
      // Do not expose the existence of the category if it is not owned by the user
      throw new NotFoundError('categories', args.id);
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

    return args.id;
  },
});

/**
 * Reorders categories for the currently authenticated user.
 *
 * @param args - The arguments object containing the category updates.
 * @param args.ids - An array of category IDs in the desired order.
 *
 */
export const reorder = authenticatedMutation({
  args: {
    ids: v.array(v.id('categories')),
  },
  handler: async (ctx, args) => {
    // Verify all categories belong to the user
    for (const id of args.ids) {
      const category = await ctx.db.get(id);
      if (!category || category.userId !== ctx.userId) {
        throw new UnauthorizedError();
      }
    }

    // Update all orders
    for (const [index, id] of args.ids.entries()) {
      await ctx.db.patch(id, { order: index + 1 });
    }
  },
});
