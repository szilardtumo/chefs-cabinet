import { type Infer, type Validator, v } from 'convex/values';
import { doc, literals } from 'convex-helpers/validators';
import { z } from 'zod';
import type { Doc, Id } from './_generated/dataModel';
import type { QueryCtx } from './_generated/server';
import { NotFoundError, ValidationError } from './lib/errors';
import { authenticatedMutation, authenticatedQuery } from './lib/helpers';
import schema from './schema';

const bookStatus = literals('not_started', 'in_progress', 'done', 'cancelled');

type BookStatus = Infer<typeof bookStatus>;

/** Rules every stored book must satisfy, including the ones that span several fields. */
const bookSchema = z
  .object({
    title: z.string().trim().min(1, 'Title is required'),
    author: z.string().trim().min(1, 'Author is required'),
    pagesRead: z.number().int('Pages read must be a whole number').min(0, 'Pages read cannot be negative'),
    pageCount: z.number().int('Page count must be a whole number').min(1, 'Page count must be at least 1').optional(),
    rating: z.number().int('Rating must be a whole number').min(1).max(5, 'Rating must be from 1 to 5').optional(),
    goodreadsUrl: z.url({ protocol: /^https?$/, error: 'Enter a web address' }).optional(),
    startedAt: z.number().optional(),
    completedAt: z.number().optional(),
    cancelledAt: z.number().optional(),
  })
  .superRefine((book, ctx) => {
    const issue = (message: string) => ctx.addIssue({ code: 'custom', message });

    if (book.pageCount !== undefined && book.pagesRead > book.pageCount) {
      issue('Pages read cannot exceed page count');
    }
    if (book.completedAt !== undefined && book.cancelledAt !== undefined) {
      issue('A book cannot be both finished and stopped');
    }
    if (book.completedAt !== undefined && book.startedAt === undefined) {
      issue('A finished book needs a start date');
    }
    if (book.startedAt !== undefined && book.completedAt !== undefined && book.completedAt < book.startedAt) {
      issue('Finished date cannot be before the start date');
    }
    if (book.startedAt !== undefined && book.cancelledAt !== undefined && book.cancelledAt < book.startedAt) {
      issue('Stopped date cannot be before the start date');
    }
  });

type BookLifecycle = Pick<Doc<'books'>, 'startedAt' | 'completedAt' | 'cancelledAt'>;

// The status isn't stored; it follows from which lifecycle dates are set
function deriveBookStatus(book: BookLifecycle): BookStatus {
  if (book.cancelledAt !== undefined) return 'cancelled';
  if (book.completedAt !== undefined) return 'done';
  if (book.startedAt !== undefined) return 'in_progress';
  return 'not_started';
}

/** Lifecycle dates for a book moved to `status`, keeping the given dates and stamping missing ones with now. */
function timestampsForStatus(status: BookStatus, dates: BookLifecycle, now = Date.now()): BookLifecycle {
  switch (status) {
    case 'not_started':
      return {};
    case 'in_progress':
      return { startedAt: dates.startedAt ?? now };
    case 'done':
      return {
        startedAt: dates.startedAt ?? dates.completedAt ?? now,
        completedAt: dates.completedAt ?? now,
      };
    case 'cancelled':
      return {
        startedAt: dates.startedAt,
        cancelledAt: dates.cancelledAt ?? now,
      };
  }
}

/** Optional field that can also be cleared by sending `null`. */
const clearable = <T extends Validator<unknown, 'required', string>>(validator: T) =>
  v.optional(v.union(validator, v.null()));

const bookWithDetails = v.object({
  ...doc(schema, 'books').fields,
  coverUrl: v.union(v.string(), v.null()),
  status: bookStatus,
  progressPercent: v.optional(v.number()),
});

function assertValidBook(book: z.input<typeof bookSchema>) {
  const result = bookSchema.safeParse(book);
  if (!result.success) {
    throw new ValidationError(result.error.issues[0].message);
  }
}

async function withDetails(ctx: QueryCtx, book: Doc<'books'>) {
  const coverUrl = book.cover ? await ctx.storage.getUrl(book.cover) : null;

  return {
    ...book,
    coverUrl,
    status: deriveBookStatus(book),
    progressPercent: book.pageCount ? Math.min(100, Math.round((book.pagesRead / book.pageCount) * 100)) : undefined,
  };
}

async function requireOwnedBook(ctx: QueryCtx & { userId: string }, id: Id<'books'>) {
  const book = await ctx.db.get(id);
  if (!book || book.userId !== ctx.userId) {
    throw new NotFoundError('books', id);
  }
  return book;
}

/**
 * Retrieves all books for the currently authenticated user.
 */
export const getAll = authenticatedQuery({
  args: {},
  returns: v.array(bookWithDetails),
  handler: async (ctx) => {
    const books = await ctx.db
      .query('books')
      .withIndex('by_user', (q) => q.eq('userId', ctx.userId))
      .collect();

    return await Promise.all(books.map((book) => withDetails(ctx, book)));
  },
});

/**
 * Retrieves a single book for the currently authenticated user.
 */
export const getById = authenticatedQuery({
  args: { id: v.id('books') },
  returns: bookWithDetails,
  handler: async (ctx, args) => {
    const book = await requireOwnedBook(ctx, args.id);
    return await withDetails(ctx, book);
  },
});

/**
 * Quickly adds a book; everything else is filled in from the book panel later.
 */
export const create = authenticatedMutation({
  args: {
    title: v.string(),
    author: v.string(),
    status: bookStatus,
  },
  handler: async (ctx, args) => {
    const { status, ...bookData } = args;
    const book = { ...bookData, genres: [], pagesRead: 0, ...timestampsForStatus(status, {}) };
    assertValidBook(book);

    return await ctx.db.insert('books', { ...book, userId: ctx.userId });
  },
});

/**
 * Updates the given book fields; `null` clears an optional field.
 */
export const updateDetails = authenticatedMutation({
  args: {
    id: v.id('books'),
    title: v.optional(v.string()),
    author: v.optional(v.string()),
    genres: v.optional(v.array(v.string())),
    pagesRead: v.optional(v.number()),
    rating: clearable(v.number()),
    readingFormat: v.optional(v.union(...schema.tables.books.validator.fields.readingFormat.members, v.null())),
    pageCount: clearable(v.number()),
    goodreadsUrl: clearable(v.string()),
    notes: clearable(v.string()),
    cover: clearable(v.id('_storage')),
    // Lifecycle dates can be moved but not cleared here; clearing one would change the status
    startedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    cancelledAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { id, ...changes } = args;
    const book = await requireOwnedBook(ctx, id);
    // `undefined` makes `patch` remove the field
    const patch = Object.fromEntries(
      Object.entries(changes).map(([key, value]) => [key, value ?? undefined]),
    ) as Partial<Doc<'books'>>;
    // A finished book has read all its pages, so a corrected page count carries over
    if (patch.pageCount !== undefined && deriveBookStatus(book) === 'done') {
      patch.pagesRead = patch.pageCount;
    }
    assertValidBook({ ...book, ...patch });

    if ('cover' in changes && book.cover && book.cover !== patch.cover) {
      await ctx.storage.delete(book.cover);
    }

    await ctx.db.patch(id, patch);
  },
});

/**
 * Moves a book to another reading status, stamping new lifecycle dates with the current time.
 * Finishing a book also marks all its pages as read.
 */
export const setStatus = authenticatedMutation({
  args: {
    id: v.id('books'),
    status: bookStatus,
  },
  handler: async (ctx, args) => {
    const book = await requireOwnedBook(ctx, args.id);
    if (deriveBookStatus(book) === args.status) return;

    const patch = {
      // Clear all lifecycle dates first; `patch` removes fields set to `undefined`
      startedAt: undefined,
      completedAt: undefined,
      cancelledAt: undefined,
      ...timestampsForStatus(args.status, { startedAt: book.startedAt }),
      ...(args.status === 'done' && book.pageCount !== undefined && { pagesRead: book.pageCount }),
    };
    assertValidBook({ ...book, ...patch });

    await ctx.db.patch(args.id, patch);
  },
});

/**
 * Puts back the lifecycle dates and progress a book had before a status change (used by Undo).
 */
export const restoreStatus = authenticatedMutation({
  args: {
    id: v.id('books'),
    startedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    cancelledAt: v.optional(v.number()),
    pagesRead: v.number(),
  },
  handler: async (ctx, args) => {
    const { id, ...previous } = args;
    const book = await requireOwnedBook(ctx, id);
    // Omitted dates arrive as missing keys, so set all three explicitly; `undefined` removes the field
    const patch = {
      startedAt: previous.startedAt,
      completedAt: previous.completedAt,
      cancelledAt: previous.cancelledAt,
      pagesRead: previous.pagesRead,
    };
    assertValidBook({ ...book, ...patch });

    await ctx.db.patch(id, patch);
  },
});

/**
 * Deletes a book for the currently authenticated user.
 */
export const remove = authenticatedMutation({
  args: { id: v.id('books') },
  handler: async (ctx, args) => {
    const book = await requireOwnedBook(ctx, args.id);
    await ctx.db.delete(args.id);

    if (book.cover) {
      await ctx.storage.delete(book.cover);
    }
  },
});
