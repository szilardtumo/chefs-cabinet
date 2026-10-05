/**
 * Edition lookup by ISBN on Open Library (https://openlibrary.org/dev/docs/api/books), for ISBNs Hardcover doesn't have.
 * It needs no key, but its records are thinner: no description or genres, and often no cover.
 */

type OpenLibraryEdition = {
  title: string;
  authors?: { name: string }[];
  publishers?: { name: string }[];
  number_of_pages?: number;
  publish_date?: string;
  cover?: { large: string };
  identifiers?: { goodreads?: string[] };
};

/** An edition by its ISBN-13, in our schema's terms, or `null`. */
export async function findEdition(isbn13: string) {
  const res = await fetch(`https://openlibrary.org/api/books?bibkeys=ISBN:${isbn13}&jscmd=data&format=json`, {
    // Open Library asks clients to identify themselves, and rate limits anonymous ones harder
    headers: { 'user-agent': "Chef's Cabinet" },
  });
  if (!res.ok) throw new Error(`Open Library request failed (${res.status})`);
  const edition: OpenLibraryEdition | undefined = (await res.json())[`ISBN:${isbn13}`];
  if (!edition) return null;

  const goodreadsId = edition.identifiers?.goodreads?.[0];
  return {
    title: edition.title,
    // Open Library also lists translators as authors, so only the first is reliable
    author: edition.authors?.[0]?.name ?? '',
    isbn: isbn13,
    publisher: edition.publishers?.[0]?.name,
    pageCount: edition.number_of_pages,
    // Dates come as "2017-10-17", "2017" or "October 17, 2017"
    publishedYear: Number(edition.publish_date?.match(/\d{4}/)?.[0]) || undefined,
    goodreadsUrl: `https://www.goodreads.com/book/${goodreadsId ? `show/${goodreadsId}` : `isbn/${isbn13}`}`,
    coverUrl: edition.cover?.large,
  };
}
