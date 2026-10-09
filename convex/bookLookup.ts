import { type Infer, v } from 'convex/values';
import { pick } from 'es-toolkit';
import { isbnSchema } from '@/lib/isbn';
import { internal } from './_generated/api';
import type { Id } from './_generated/dataModel';
import type { ActionCtx } from './_generated/server';
import * as catalog from './hardcoverApi';
import { ValidationError } from './lib/errors';
import { authenticatedAction } from './lib/helpers';
import { enforceRateLimit } from './lib/rateLimiter';
import * as openLibrary from './openLibraryApi';
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
 * An edition Hardcover doesn't have, from Open Library. When Hardcover has the book itself, its data fills in
 * what Open Library lacks (description, genres, series, authors); the edition's own data comes from Open Library.
 */
async function findOnOpenLibrary(isbn13: string) {
  const edition = await openLibrary.findEdition(isbn13);
  if (!edition) return null;

  // Searching by last name skips initials Hardcover doesn't have ("Percival L. Everett"). Its search ranks loosely,
  // so a hit only counts when its title and author's last name match too.
  const lastName = edition.author.split(' ').at(-1)?.toLowerCase() ?? '';
  const title = edition.title.toLowerCase();
  const match = (await catalog.searchBooks(`${edition.title} ${lastName}`)).find(
    (hit) =>
      hit.author.toLowerCase().includes(lastName) &&
      (hit.title.toLowerCase().includes(title) || title.includes(hit.title.toLowerCase())),
  );
  const book = match && (await catalog.findBook(match.bookId));
  if (!book) return { ...edition, genres: [], readingFormat: 'book' as const };

  return {
    ...book,
    isbn: edition.isbn,
    publisher: edition.publisher,
    goodreadsUrl: edition.goodreadsUrl,
    pageCount: edition.pageCount ?? book.pageCount,
    coverUrl: edition.coverUrl ?? book.coverUrl,
  };
}

/** An edition by its ISBN, from Hardcover or else Open Library; throws when neither has it. */
async function findByIsbn(isbn: ReturnType<typeof parseIsbn>) {
  const found = (await catalog.findEdition(isbn)) ?? (await findOnOpenLibrary(isbn.isbn13));
  if (!found) throw new ValidationError(`No book with ISBN ${isbn.isbn13} on Hardcover or Open Library`);
  return found;
}

/**
 * Searches the book catalog by title and author.
 */
export const searchBooks = authenticatedAction({
  args: { query: v.string() },
  returns: v.array(catalog.catalogSearchResult),
  handler: async (ctx, args) => {
    await enforceRateLimit(ctx, 'catalogSearch');
    return await catalog.searchBooks(args.query.trim());
  },
});

/**
 * Lists a book's editions in the catalog, or the editions with an ISBN, most read first.
 * An ISBN Hardcover doesn't have lists Open Library's edition, if it has one.
 */
export const getEditions = authenticatedAction({
  args: { bookId: v.optional(v.number()), isbn: v.optional(v.string()) },
  returns: v.array(catalog.catalogEdition),
  handler: async (ctx, args): Promise<Infer<typeof catalog.catalogEdition>[]> => {
    await enforceRateLimit(ctx, 'catalogSearch');
    if (args.bookId !== undefined) return await catalog.listEditions({ bookId: args.bookId });

    const isbn = parseIsbn(args.isbn ?? '');
    const editions = await catalog.listEditions(isbn);
    if (editions.length) return editions;
    const found = await findOnOpenLibrary(isbn.isbn13);
    return found ? [pick(found, ['title', 'publisher', 'publishedYear', 'language', 'isbn', 'coverUrl'])] : [];
  },
});

/**
 * Adds an edition from the catalog to the library as "Want to read", with its cover.
 */
export const addBook = authenticatedAction({
  // Editions without a Hardcover id come from Open Library and are added by their ISBN
  args: { editionId: v.optional(v.number()), isbn: v.optional(v.string()) },
  returns: v.id('books'),
  // Actions that return what they run need an explicit return type, or TypeScript loops through the generated api
  handler: async (ctx, args): Promise<Id<'books'>> => {
    await enforceRateLimit(ctx, 'bookImport');
    const found =
      args.editionId !== undefined
        ? await catalog.findEdition({ editionId: args.editionId })
        : await findByIsbn(parseIsbn(args.isbn ?? ''));
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
    await enforceRateLimit(ctx, 'bookImport');
    const isbn = parseIsbn(args.isbn);
    const { coverUrl, ...edition } = await findByIsbn(isbn);
    await withStoredCover(ctx, coverUrl, (cover) =>
      ctx.runMutation(internal.books.applyEdition, { id: args.id, userId: ctx.userId, edition, cover }),
    );
    return edition.isbn ?? args.isbn;
  },
});
