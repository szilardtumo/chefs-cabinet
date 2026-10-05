/**
 * The book catalog, backed by the Hardcover GraphQL API (https://docs.hardcover.app/api/getting-started/).
 * Hardcover's names and response shapes stay in this file; callers get book fields in our own schema's terms.
 *
 * The free plan allows 60 requests a minute and 5,000 a day, so every function makes a single request.
 * The token in `HARDCOVER_API_KEY` comes from Hardcover's account settings and expires every January 1.
 */
import { type Infer, v } from 'convex/values';
import { getYear, parseISO } from 'date-fns';
import { editionFields } from './books';

// The cover is still Hardcover's URL here; callers download it into storage when the book is saved
const catalogBook = v.object({ ...editionFields, coverUrl: v.optional(v.string()) });

export const catalogSearchResult = v.object({
  bookId: v.number(),
  title: v.string(),
  author: v.string(),
  releaseYear: v.optional(v.number()),
  coverUrl: v.optional(v.string()),
});

export const catalogEdition = v.object({
  editionId: v.number(),
  title: v.string(),
  format: v.optional(v.string()),
  publisher: v.optional(v.string()),
  publishedYear: v.optional(v.number()),
  language: v.optional(v.string()),
  isbn: v.optional(v.string()),
  coverUrl: v.optional(v.string()),
});

type CatalogBook = Infer<typeof catalogBook>;

async function query<T>(graphql: string, variables: Record<string, unknown>): Promise<T> {
  if (!process.env.HARDCOVER_API_KEY) {
    throw new Error('Book lookup is not configured. Set HARDCOVER_API_KEY in your Convex environment.');
  }

  const res = await fetch('https://api.hardcover.app/v1/graphql', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${process.env.HARDCOVER_API_KEY}` },
    body: JSON.stringify({ query: graphql, variables }),
  });
  // Rate limits and gateway errors don't come back as JSON
  if (!res.ok) throw new Error(`Hardcover request failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
  const body = await res.json();
  if (!body.data) throw new Error(`Hardcover request failed: ${JSON.stringify(body.errors ?? body).slice(0, 200)}`);
  return body.data;
}

// `parseISO` reads a date-only string as local time, so the year can't shift across time zones
const yearOf = (date: string | null) => (date ? getYear(parseISO(date)) : undefined);

type Edition = {
  title: string | null;
  edition_format: string | null;
  pages: number | null;
  release_date: string | null;
  isbn_13: string | null;
  image: { url: string } | null;
  publisher: { name: string } | null;
  language: { language: string } | null;
  book_mappings: { external_id: string; platform: { name: string } }[];
  book: {
    title: string;
    description: string | null;
    release_year: number | null;
    pages: number | null;
    image: { url: string } | null;
    cached_tags: { Genre?: { tag: string }[] } | null;
    book_series: { position: number | null; series: { name: string } }[];
    contributions: { author: { name: string }; contribution: string | null }[];
  };
};

/** The edition's own data where it has it (title, cover, pages), the book's for the rest. */
function toCatalogBook(edition: Edition): CatalogBook {
  const { book } = edition;
  const title = edition.title || book.title;
  const series = book.book_series[0];
  const goodreadsId = edition.book_mappings.find(({ platform }) => platform.name === 'goodreads')?.external_id;

  // Editions also list translators and illustrators; only authors count, unless there are none (e.g. anthologies)
  const authors = book.contributions.filter(({ contribution }) => !contribution || contribution === 'Author');

  return {
    title,
    author: (authors.length ? authors : book.contributions).map(({ author }) => author.name).join(', '),
    genres: book.cached_tags?.Genre?.slice(0, 3).map(({ tag }) => tag) ?? [],
    // Hardcover uses 0 for an unknown page count
    pageCount: edition.pages || book.pages || undefined,
    isbn: edition.isbn_13 ?? undefined,
    description: book.description ?? undefined,
    publisher: edition.publisher?.name,
    // When the book first came out, not this edition
    publishedYear: book.release_year ?? yearOf(edition.release_date),
    seriesName: series?.series.name,
    seriesPosition: series?.position?.toString(),
    language: edition.language?.language,
    readingFormat: /audio/i.test(edition.edition_format ?? '')
      ? 'audiobook'
      : /ebook|kindle/i.test(edition.edition_format ?? '')
        ? 'ebook'
        : 'book',
    // Hardcover knows most editions' Goodreads id; otherwise Goodreads' ISBN URL redirects to the edition, if it has it
    goodreadsUrl: goodreadsId
      ? `https://www.goodreads.com/book/show/${goodreadsId}`
      : edition.isbn_13
        ? `https://www.goodreads.com/book/isbn/${edition.isbn_13}`
        : undefined,
    coverUrl: edition.image?.url ?? book.image?.url,
  };
}

const bookFields = `
  title description release_year pages image { url } cached_tags
  book_series(limit: 1) { position series { name } }
  contributions { author { name } contribution }
`;

type IsbnLookup = { isbn13: string; isbn10?: string };

// Some editions only have their ISBN-10 on Hardcover, so it's matched too when known
const isbnWhere = ({ isbn13, isbn10 }: IsbnLookup) =>
  isbn10 ? { _or: [{ isbn_13: { _eq: isbn13 } }, { isbn_10: { _eq: isbn10 } }] } : { isbn_13: { _eq: isbn13 } };

/** An edition by its id or ISBN, with everything stored for a book, or `null`. */
export async function findEdition(lookup: { editionId: number } | IsbnLookup) {
  const where = 'editionId' in lookup ? { id: { _eq: lookup.editionId } } : isbnWhere(lookup);
  const { editions } = await query<{ editions: Edition[] }>(
    `query ($where: editions_bool_exp!) {
      editions(where: $where, limit: 1) {
        title edition_format pages release_date isbn_13 image { url } publisher { name } language { language }
        book_mappings { external_id platform { name } }
        book { ${bookFields} }
      }
    }`,
    { where },
  );
  return editions[0] ? toCatalogBook(editions[0]) : null;
}

/** A book with no edition's data (ISBN, publisher, edition cover), or `null`. */
export async function findBook(bookId: number) {
  const { books_by_pk: book } = await query<{ books_by_pk: Edition['book'] | null }>(
    `query ($bookId: Int!) { books_by_pk(id: $bookId) { ${bookFields} } }`,
    { bookId },
  );
  if (!book) return null;
  return toCatalogBook({
    title: null,
    edition_format: null,
    pages: null,
    release_date: null,
    isbn_13: null,
    image: null,
    publisher: null,
    language: null,
    book_mappings: [],
    book,
  });
}

/** Books matching a title and author search. */
export async function searchBooks(text: string) {
  const { search } = await query<{
    search: {
      results: {
        hits: {
          document: {
            id: string;
            title: string;
            author_names?: string[];
            release_year?: number;
            image?: { url?: string } | null;
          };
        }[];
      };
    };
  }>(
    // Sorting by readers puts the book itself above study guides that repeat its title and author
    `query ($query: String!) {
      search(query: $query, query_type: "Book", per_page: 10, sort: "users_count:desc") { results }
    }`,
    { query: text },
  );

  return search.results.hits.map(({ document }) => ({
    bookId: Number(document.id),
    title: document.title,
    author: document.author_names?.join(', ') ?? '',
    releaseYear: document.release_year,
    coverUrl: document.image?.url,
  }));
}

/** A book's editions, or the editions with an ISBN, most read first, summarized for picking one. */
export async function listEditions(lookup: { bookId: number } | IsbnLookup) {
  const { editions } = await query<{
    editions: (Pick<
      Edition,
      'title' | 'edition_format' | 'release_date' | 'isbn_13' | 'image' | 'publisher' | 'language'
    > & {
      id: number;
      book: { title: string };
    })[];
  }>(
    `query ($where: editions_bool_exp!) {
      editions(where: $where, order_by: {users_count: desc}, limit: 200) {
        id title edition_format release_date isbn_13 image { url } publisher { name } language { language }
        book { title }
      }
    }`,
    { where: 'bookId' in lookup ? { book_id: { _eq: lookup.bookId } } : isbnWhere(lookup) },
  );

  return editions.map((edition) => ({
    editionId: edition.id,
    title: edition.title || edition.book.title,
    format: edition.edition_format ?? undefined,
    publisher: edition.publisher?.name,
    publishedYear: yearOf(edition.release_date),
    language: edition.language?.language,
    isbn: edition.isbn_13 ?? undefined,
    coverUrl: edition.image?.url,
  }));
}
