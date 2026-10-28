import { v } from 'convex/values';
import { z } from 'zod';
import { api } from '../_generated/api';
import type { Id } from '../_generated/dataModel';
import type { ActionCtx } from '../_generated/server';
import { defineVoiceAction } from './types';

/** Undo for added to-dos: deletes them. */
export const todosUndo = {
  validator: v.object({ type: v.literal('todos'), ids: v.array(v.id('todos')) }),
  run: async (ctx: ActionCtx, { ids }: { ids: Id<'todos'>[] }) => {
    await Promise.all(ids.map((id) => ctx.runMutation(api.todos.remove, { id })));
  },
};

export const addTodos = defineVoiceAction({
  needs: ['todoLists'],
  instructions: 'Add to-dos (tasks, reminders, things to watch or read later) to the main to-do list or a named one.',
  schema: z
    .array(
      z.object({
        listId: z
          .string()
          .nullable()
          .describe('ID from TO-DO LISTS when the user names a list, e.g. "add Dune to my movies"; otherwise null'),
        title: z.string().describe('Short title in the words of the user, e.g. "Call the plumber"'),
        priority: z.enum(['low', 'medium', 'high']).optional().describe('Only when the user says how important it is'),
        plannedDate: z.string().optional().describe('yyyy-MM-dd, only when the user says when they will do it'),
        dueDate: z.string().optional().describe('yyyy-MM-dd, only when the user says when it must be done by'),
      }),
    )
    .describe('To-dos to add'),
  run: async (output, { ctx, library, report, attempt }) => {
    if (output.length === 0) return;
    await attempt('Could not add the to-dos', async () => {
      const ids: Id<'todos'>[] = [];
      try {
        for (const { listId, ...todo } of output) {
          // An id the model made up counts as no list, so the to-do goes to the main list
          const list = library.todoLists.find((l) => l._id === listId);
          ids.push(await ctx.runMutation(api.todos.add, { ...todo, listId: list?._id }));
        }
      } catch (error) {
        // The to-dos added before the failure stay on the list, so they get their own line with Undo
        if (ids.length > 0) {
          report({ message: `Added only ${ids.length} of ${output.length} to-dos`, undo: { type: 'todos', ids } });
        }
        throw error;
      }
      const names = output.map(({ title, listId }) => {
        const list = library.todoLists.find((l) => l._id === listId);
        return list ? `${title} (${list.name})` : title;
      });
      return { message: `Added to-dos: ${names.join(', ')}`, undo: { type: 'todos', ids } };
    });
  },
});
