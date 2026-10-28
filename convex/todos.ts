import { v } from 'convex/values';
import { literals } from 'convex-helpers/validators';
import type { Doc } from './_generated/dataModel';
import { ValidationError } from './lib/errors';
import { authenticatedMutation, authenticatedQuery, requireOwned } from './lib/helpers';

export type Todo = Doc<'todos'>;

const todoFields = {
  title: v.string(),
  notes: v.optional(v.string()),
  priority: v.optional(literals('low', 'medium', 'high')),
  plannedDate: v.optional(v.string()),
  dueDate: v.optional(v.string()),
};

/** Checks the fields, and returns them with the title trimmed. */
function validate<T extends { title: string; plannedDate?: string; dueDate?: string }>(fields: T) {
  const title = fields.title.trim();
  if (!title) throw new ValidationError('Give the to-do a title');
  for (const day of [fields.plannedDate, fields.dueDate]) {
    if (day && !/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new ValidationError(`${day} is not a yyyy-MM-dd date`);
  }
  return { ...fields, title };
}

/**
 * The open to-dos of a list (the main list without `listId`), and the ones completed since `completedSince` (the start
 * of the user's day), which the list shows checked at its end.
 */
export const getAll = authenticatedQuery({
  args: { listId: v.optional(v.id('todoLists')), completedSince: v.number() },
  handler: async (ctx, { listId, completedSince }) => {
    if (listId) await requireOwned(ctx, 'todoLists', listId);
    const [open, done] = await Promise.all([
      ctx.db
        .query('todos')
        .withIndex('by_user_list_and_completedAt', (q) =>
          q.eq('userId', ctx.userId).eq('listId', listId).eq('completedAt', undefined),
        )
        .collect(),
      ctx.db
        .query('todos')
        .withIndex('by_user_list_and_completedAt', (q) =>
          q.eq('userId', ctx.userId).eq('listId', listId).gte('completedAt', completedSince),
        )
        .collect(),
    ]);
    return [...open, ...done];
  },
});

export const add = authenticatedMutation({
  args: { listId: v.optional(v.id('todoLists')), ...todoFields },
  handler: async (ctx, args) => {
    if (args.listId) await requireOwned(ctx, 'todoLists', args.listId);
    return await ctx.db.insert('todos', { ...validate(args), userId: ctx.userId });
  },
});

/** Replaces all editable fields of a to-do; a field left out is cleared. */
export const update = authenticatedMutation({
  args: { id: v.id('todos'), ...todoFields },
  handler: async (ctx, { id, ...args }) => {
    await requireOwned(ctx, 'todos', id);
    const { title, notes, priority, plannedDate, dueDate } = validate(args);
    // Named one by one, so the ones left out are set to undefined, which removes them
    await ctx.db.patch(id, { title, notes, priority, plannedDate, dueDate });
  },
});

export const toggleCompleted = authenticatedMutation({
  args: { id: v.id('todos') },
  handler: async (ctx, { id }) => {
    const todo = await requireOwned(ctx, 'todos', id);
    await ctx.db.patch(id, { completedAt: todo.completedAt ? undefined : Date.now() });
  },
});

export const remove = authenticatedMutation({
  args: { id: v.id('todos') },
  handler: async (ctx, { id }) => {
    await requireOwned(ctx, 'todos', id);
    await ctx.db.delete(id);
  },
});
