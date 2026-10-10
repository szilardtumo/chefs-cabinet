import { DAY, HOUR } from '@convex-dev/rate-limiter';
import { v } from 'convex/values';
import { z } from 'zod';
import { api } from '../_generated/api';
import type { Id } from '../_generated/dataModel';
import type { ActionCtx } from '../_generated/server';
import { defineVoiceAction } from './types';

/** Undo for logged reading: puts the book back on its previous page. */
export const readingUndo = {
  validator: v.object({ type: v.literal('reading'), eventId: v.id('readingEvents') }),
  run: async (ctx: ActionCtx, { eventId }: { eventId: Id<'readingEvents'> }) => {
    await ctx.runMutation(api.books.undoProgress, { eventId });
  },
};

export const logReading = defineVoiceAction({
  needs: ['books'],
  instructions:
    'Log reading progress of a book being read. If only one book is being read, reading without a title is about that book.',
  schema: z
    .array(
      z.object({
        bookId: z.string().describe('ID from BOOKS BEING READ'),
        pagesReadNow: z.number().int().optional().describe('Pages read in this session ("I read 20 pages")'),
        currentPage: z.number().int().optional().describe('The page the user is at now ("I am at page 120")'),
        daysAgo: z.number().int().min(0).describe('0 for today, 1 for yesterday, and so on'),
      }),
    )
    .describe('Reading progress to log'),
  run: async (output, { ctx, library, localMidnight, attempt }) => {
    for (const log of output) {
      const book = library.books.find((b) => b._id === log.bookId);
      if (!book) continue;
      await attempt(`Could not log reading for ${book.title}`, async () => {
        const pagesRead = log.currentPage ?? book.pagesRead + (log.pagesReadNow ?? 0);
        const eventId = await ctx.runMutation(api.books.updateProgress, {
          id: book._id,
          pagesRead,
          // Reading logged for an earlier day has no time of day, so it is placed at noon, like in the progress form
          readOn: log.daysAgo > 0 ? localMidnight - log.daysAgo * DAY + 12 * HOUR : undefined,
        });
        const day = log.daysAgo === 0 ? '' : log.daysAgo === 1 ? ' yesterday' : ` ${log.daysAgo} days ago`;
        const delta = pagesRead - book.pagesRead;
        return {
          message: `${book.title}: page ${pagesRead} (${delta >= 0 ? '+' : ''}${delta} pages${day})`,
          undo: eventId ? { type: 'reading', eventId } : undefined,
        };
      });
    }
  },
});
