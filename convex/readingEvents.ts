import { v } from 'convex/values';
import { doc } from 'convex-helpers/validators';
import { requireOwnedBook } from './books';
import { authenticatedQuery } from './lib/helpers';
import schema from './schema';

/**
 * Retrieves all logged reading of the currently authenticated user, oldest first.
 */
export const getAll = authenticatedQuery({
  args: {},
  returns: v.array(doc(schema, 'readingEvents')),
  handler: async (ctx) => {
    return await ctx.db
      .query('readingEvents')
      .withIndex('by_user_and_at', (q) => q.eq('userId', ctx.userId))
      .collect();
  },
});

/**
 * Retrieves the logged reading of one book, oldest first.
 */
export const getForBook = authenticatedQuery({
  args: { bookId: v.id('books') },
  returns: v.array(doc(schema, 'readingEvents')),
  handler: async (ctx, args) => {
    await requireOwnedBook(ctx, args.bookId);
    return await ctx.db
      .query('readingEvents')
      .withIndex('by_book_and_at', (q) => q.eq('bookId', args.bookId))
      .collect();
  },
});
