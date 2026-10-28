import { v } from 'convex/values';
import type { Doc } from './_generated/dataModel';
import { ValidationError } from './lib/errors';
import { authenticatedMutation, authenticatedQuery, requireOwned } from './lib/helpers';

export type TodoList = Doc<'todoLists'>;

function requireName(name: string) {
  const trimmed = name.trim();
  if (!trimmed) throw new ValidationError('Give the list a name');
  return trimmed;
}

/** The user's extra to-do lists, oldest first; the main list is not among them. */
export const getAll = authenticatedQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query('todoLists')
      .withIndex('by_user', (q) => q.eq('userId', ctx.userId))
      .collect();
  },
});

export const create = authenticatedMutation({
  args: { name: v.string() },
  handler: async (ctx, { name }) => {
    return await ctx.db.insert('todoLists', { userId: ctx.userId, name: requireName(name) });
  },
});

export const rename = authenticatedMutation({
  args: { id: v.id('todoLists'), name: v.string() },
  handler: async (ctx, { id, name }) => {
    await requireOwned(ctx, 'todoLists', id);
    await ctx.db.patch(id, { name: requireName(name) });
  },
});

/** Deletes a list with all its to-dos. */
export const remove = authenticatedMutation({
  args: { id: v.id('todoLists') },
  handler: async (ctx, { id }) => {
    await requireOwned(ctx, 'todoLists', id);
    const todos = await ctx.db
      .query('todos')
      .withIndex('by_user_list_and_completedAt', (q) => q.eq('userId', ctx.userId).eq('listId', id))
      .collect();
    await Promise.all(todos.map((todo) => ctx.db.delete(todo._id)));
    await ctx.db.delete(id);
  },
});
