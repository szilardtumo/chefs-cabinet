import { v } from 'convex/values';
import { isbnSchema } from '@/lib/isbn';
import { internal } from './_generated/api';
import type { Id } from './_generated/dataModel';
import type { ActionCtx } from './_generated/server';
import * as catalog from './hardcoverApi';
import { ValidationError } from './lib/errors';
import { authenticatedAction } from './lib/helpers';
import { storeImage } from './storage';

function parseIsbn(input: string) {
  const parsed = isbnSchema.safeParse(input);
  if (!parsed.success) throw new ValidationError(parsed.error.issues[0].message);
  return parsed.data;
}

/**
 * Stores the cover, then runs `write` with it; deletes the cover again if the write fails.
 * `write` gets `null` when the edition has no cover, and `undefined` when it couldn't be downloaded,
 * which doesn't block the write.
 */
async function withStoredCover<T>(
  ctx: ActionCtx,
  coverUrl: string | undefined,
  write: (cover: Id<'_storage'> | null | undefined) => Promise<T>,
) {
  const cover = coverUrl ? await storeImage(ctx, coverUrl).catch(() => undefined) : null;
  try {
    return await write(cover);
  } catch (error) {
    if (cover) await ctx.storage.delete(cover);
    throw error;
  }
}

/**
 * Searches the book catalog by title and author.
 */
export const searchBooks = authenticatedAction({
  args: { query: v.string() },
  returns: v.array(catalog.catalogSearchResult),
  handler: async (_ctx, args) => await catalog.searchBooks(args.query.trim()),
});

/**
 * Lists a book's editions in the catalog, or the editions with an ISBN, most read first.
 */
export const getEditions = authenticatedAction({
  args: { bookId: v.optional(v.number()), isbn: v.optional(v.string()) },
  returns: v.array(catalog.catalogEdition),
  handler: async (_ctx, args) =>
    await catalog.listEditions(args.bookId !== undefined ? { bookId: args.bookId } : parseIsbn(args.isbn ?? '')),
});

/**
 * Adds an edition from the catalog to the library as "Want to read", with its cover.
 */
export const addBook = authenticatedAction({
  args: { editionId: v.number() },
  returns: v.id('books'),
  // Actions that return what they run need an explicit return type, or TypeScript loops through the generated api
  handler: async (ctx, args): Promise<Id<'books'>> => {
    const found = await catalog.findEdition(args);
    if (!found) throw new Error('This edition no longer exists');
    const { coverUrl, ...edition } = found;
    return await withStoredCover(ctx, coverUrl, (cover) =>
      ctx.runMutation(internal.books.create, {
        ...edition,
        cover: cover ?? undefined,
        userId: ctx.userId,
      }),
    );
  },
});

/**
 * Sets a book's ISBN and refreshes everything that comes with the edition from the catalog.
 * Returns the ISBN-13 that was stored.
 */
export const setIsbn = authenticatedAction({
  args: { id: v.id('books'), isbn: v.string() },
  returns: v.string(),
  handler: async (ctx, args) => {
    const isbn = parseIsbn(args.isbn);
    const found = await catalog.findEdition(isbn);
    if (!found) throw new Error(`No book found for ISBN ${isbn.isbn13}`);
    const { coverUrl, ...edition } = found;
    await withStoredCover(ctx, coverUrl, (cover) =>
      ctx.runMutation(internal.books.applyEdition, { id: args.id, userId: ctx.userId, edition, cover }),
    );
    return edition.isbn ?? args.isbn;
  },
});
