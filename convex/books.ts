import { type Infer, type Validator, v } from 'convex/values';
import { doc, literals } from 'convex-helpers/validators';
import { omit } from 'es-toolkit';
import { z } from 'zod';
import type { Doc, Id } from './_generated/dataModel';
import { internalMutation, type MutationCtx, type QueryCtx } from './_generated/server';
import { NotFoundError, ValidationError } from './lib/errors';
import { authenticatedMutation, authenticatedQuery } from './lib/helpers';
import schema from './schema';

const bookStatus = literals('not_started', 'in_progress', 'done', 'cancelled');

/** The book fields that come from its catalog edition: everything but your own reading data and the stored cover. */
export const editionFields = omit(schema.tables.books.validator.fields, [
  'userId',
  'pagesRead',
  'startedAt',
  'completedAt',
  'cancelledAt',
  'rating',
  'notes',
  'cover',
]);

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
  // When the latest logged reading happened; new reading can't be logged before it
  lastReadAt: v.optional(v.number()),
});

function assertValidBook(book: z.input<typeof bookSchema>) {
  const result = bookSchema.safeParse(book);
  if (!result.success) {
    throw new ValidationError(result.error.issues[0].message);
  }
}

function getLastReadingEvent(ctx: QueryCtx, bookId: Id<'books'>) {
  return ctx.db
    .query('readingEvents')
    .withIndex('by_book_and_at', (q) => q.eq('bookId', bookId))
    .order('desc')
    .first();
}

async function withDetails(ctx: QueryCtx, book: Doc<'books'>) {
  const coverUrl = book.cover ? await ctx.storage.getUrl(book.cover) : null;
  const lastEvent = await getLastReadingEvent(ctx, book._id);

  return {
    ...book,
    coverUrl,
    status: deriveBookStatus(book),
    progressPercent: book.pageCount ? Math.min(100, Math.round((book.pagesRead / book.pageCount) * 100)) : undefined,
    lastReadAt: lastEvent?.at,
  };
}

/** Sets a book's current page and logs the change as reading. Returns the event id, or `null` when the page didn't change. */
async function recordProgress(
  ctx: MutationCtx,
  book: Doc<'books'>,
  pagesRead: number,
  source: Doc<'readingEvents'>['source'],
  at = Date.now(),
) {
  if (pagesRead === book.pagesRead) return null;

  // Keeps a book's events in date order, so each delta is measured from the page logged just before it.
  // The picker blocks earlier days; a pick on the latest event's day can still be before its time.
  const lastEvent = await getLastReadingEvent(ctx, book._id);
  await ctx.db.patch(book._id, { pagesRead });
  return await ctx.db.insert('readingEvents', {
    userId: book.userId,
    bookId: book._id,
    pagesRead,
    pagesDelta: pagesRead - book.pagesRead,
    at: Math.max(at, lastEvent?.at ?? at),
    source,
  });
}

export async function requireOwnedBook(ctx: QueryCtx & { userId: string }, id: Id<'books'>) {
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
 * Adds a book from a catalog edition, not started yet; called by `bookLookup.addBook` after it stored the cover.
 */
export const create = internalMutation({
  args: {
    ...editionFields,
    userId: v.string(),
    cover: v.optional(v.id('_storage')),
  },
  handler: async (ctx, args) => {
    const book = { ...args, pagesRead: 0 };
    assertValidBook(book);

    return await ctx.db.insert('books', book);
  },
});

/**
 * Updates the fields you keep yourself; `null` clears an optional field.
 * Everything that comes with the edition is set from the catalog through `applyEdition`.
 */
export const updateDetails = authenticatedMutation({
  args: {
    id: v.id('books'),
    genres: v.optional(v.array(v.string())),
    rating: clearable(v.number()),
    notes: clearable(v.string()),
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
    assertValidBook({ ...book, ...patch });

    await ctx.db.patch(id, patch);
  },
});

/**
 * Sets the page you reached and logs it as reading; returns the event id for Undo.
 * `readOn` logs the pages on an earlier day instead of now.
 */
export const updateProgress = authenticatedMutation({
  args: {
    id: v.id('books'),
    pagesRead: v.number(),
    readOn: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const book = await requireOwnedBook(ctx, args.id);
    if (args.readOn !== undefined && args.readOn > Date.now()) {
      throw new ValidationError('You cannot log reading in the future');
    }
    assertValidBook({ ...book, pagesRead: args.pagesRead });

    return await recordProgress(ctx, book, args.pagesRead, 'progress', args.readOn);
  },
});

/**
 * Removes a logged progress change and puts the book back on the page it was on before (used by Undo).
 */
export const undoProgress = authenticatedMutation({
  args: { eventId: v.id('readingEvents') },
  handler: async (ctx, args) => {
    const event = await ctx.db.get(args.eventId);
    if (!event || event.userId !== ctx.userId) {
      throw new NotFoundError('readingEvents', args.eventId);
    }
    const book = await requireOwnedBook(ctx, event.bookId);
    const pagesRead = event.pagesRead - event.pagesDelta;
    assertValidBook({ ...book, pagesRead });

    await ctx.db.patch(book._id, { pagesRead });
    await ctx.db.delete(event._id);
  },
});

/**
 * Moves a book to another reading status, stamping new lifecycle dates with the current time.
 * Finishing a book also marks all its pages as read and logs them; the event id is returned for Undo.
 */
export const setStatus = authenticatedMutation({
  args: {
    id: v.id('books'),
    status: bookStatus,
  },
  handler: async (ctx, args) => {
    const book = await requireOwnedBook(ctx, args.id);
    if (deriveBookStatus(book) === args.status) return null;

    const patch = {
      // Clear all lifecycle dates first; `patch` removes fields set to `undefined`
      startedAt: undefined,
      completedAt: undefined,
      cancelledAt: undefined,
      ...timestampsForStatus(args.status, { startedAt: book.startedAt }),
    };
    const pagesRead = args.status === 'done' ? (book.pageCount ?? book.pagesRead) : book.pagesRead;
    assertValidBook({ ...book, ...patch, pagesRead });

    await ctx.db.patch(args.id, patch);
    return await recordProgress(ctx, book, pagesRead, 'finish');
  },
});

/**
 * Puts back the lifecycle dates and progress a book had before a status change (used by Undo),
 * removing the reading the status change logged.
 */
export const restoreStatus = authenticatedMutation({
  args: {
    id: v.id('books'),
    startedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    cancelledAt: v.optional(v.number()),
    pagesRead: v.number(),
    eventId: v.optional(v.union(v.id('readingEvents'), v.null())),
  },
  handler: async (ctx, args) => {
    const { id, eventId, ...previous } = args;
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
    const event = eventId && (await ctx.db.get(eventId));
    if (event && event.bookId === id) {
      await ctx.db.delete(event._id);
    }
  },
});

/**
 * Deletes a book for the currently authenticated user, with its reading history.
 */
export const remove = authenticatedMutation({
  args: { id: v.id('books') },
  handler: async (ctx, args) => {
    const book = await requireOwnedBook(ctx, args.id);
    await ctx.db.delete(args.id);

    const events = await ctx.db
      .query('readingEvents')
      .withIndex('by_book_and_at', (q) => q.eq('bookId', args.id))
      .collect();
    await Promise.all(events.map((event) => ctx.db.delete(event._id)));

    if (book.cover) {
      await ctx.storage.delete(book.cover);
    }
  },
});

/**
 * Replaces a book's details with a catalog edition's, keeping your own genres, progress, dates and notes.
 */
export const applyEdition = internalMutation({
  args: {
    id: v.id('books'),
    // Only the user's own books can be updated
    userId: v.string(),
    edition: v.object(editionFields),
    // `null` when the edition has no cover; left out when its cover couldn't be downloaded, which keeps the current one
    cover: v.optional(v.union(v.id('_storage'), v.null())),
  },
  handler: async (ctx, { id, userId, edition, cover }) => {
    const book = await ctx.db.get(id);
    if (!book || book.userId !== userId) {
      throw new NotFoundError('books', id);
    }

    const { genres, ...details } = edition;
    // Clears what the previous edition had and this one doesn't. Convex drops `undefined` args,
    // so the field list comes from the validator; `patch` removes fields set to `undefined`.
    const cleared = Object.fromEntries(Object.keys(omit(editionFields, ['genres'])).map((key) => [key, undefined]));
    const pageCount = details.pageCount;
    const patch = {
      ...cleared,
      ...details,
      // Genres are yours to edit, so the edition's only fill an empty list
      genres: book.genres.length ? book.genres : genres,
      cover: cover === undefined ? book.cover : (cover ?? undefined),
      // A finished book has read all its pages; otherwise progress can't go past the new page count
      pagesRead:
        deriveBookStatus(book) === 'done'
          ? (pageCount ?? book.pagesRead)
          : Math.min(book.pagesRead, pageCount ?? book.pagesRead),
    };
    assertValidBook({ ...book, ...patch });

    if (cover !== undefined && book.cover) {
      await ctx.storage.delete(book.cover);
    }
    await ctx.db.patch(id, patch);
  },
});
