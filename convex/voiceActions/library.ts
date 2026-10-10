import { z } from 'zod';
import type { QueryCtx } from '../_generated/server';

/** The lists of the user's data an action can ask the model to pick from. */
export type LibraryPart = keyof Library;

export type Library = Awaited<ReturnType<typeof loadLibrary>>;

/** Loads the requested lists of the user's data; the others stay empty. */
export async function loadLibrary(ctx: QueryCtx, userId: string, parts: string[]) {
  const load = <T>(part: string, query: () => Promise<T[]>) => (parts.includes(part) ? query() : Promise.resolve([]));
  const [recipes, books, ingredients] = await Promise.all([
    load('recipes', () =>
      ctx.db
        .query('recipes')
        .withIndex('by_user', (q) => q.eq('userId', userId))
        .collect(),
    ),
    load('books', () =>
      ctx.db
        .query('books')
        .withIndex('by_user', (q) => q.eq('userId', userId))
        .collect(),
    ),
    load('ingredients', () =>
      ctx.db
        .query('ingredients')
        .withIndex('by_user', (q) => q.eq('userId', userId))
        .collect(),
    ),
  ]);

  return {
    recipes: recipes.map(({ _id, title }) => ({ _id, title })),
    // Only the books being read: started, and neither finished nor stopped
    books: books
      .filter(
        (book) => book.startedAt !== undefined && book.completedAt === undefined && book.cancelledAt === undefined,
      )
      .map(({ _id, title, author, pagesRead, pageCount }) => ({ _id, title, author, pagesRead, pageCount })),
    ingredients: ingredients.map(({ _id, name }) => ({ _id, name })),
  };
}

/** The loaded lists as prompt sections, one line per entry with the id the model answers with. */
export function libraryPrompt({ recipes, books, ingredients }: Library) {
  return [
    recipes.length > 0 && `RECIPES (id: title):\n${recipes.map((r) => `${r._id}: ${r.title}`).join('\n')}`,
    books.length > 0 &&
      `BOOKS BEING READ (id: title by author, current page / page count):\n${books
        .map((b) => `${b._id}: ${b.title} by ${b.author}, page ${b.pagesRead} / ${b.pageCount ?? '?'}`)
        .join('\n')}`,
    ingredients.length > 0 && `INGREDIENTS (id: name):\n${ingredients.map((i) => `${i._id}: ${i.name}`).join('\n')}`,
  ]
    .filter(Boolean)
    .join('\n\n');
}

/** A schema for one id from `entries`, so the model can only answer with ids from the library. */
export function idSchema(entries: { _id: string }[]) {
  const ids = entries.map((entry) => entry._id);
  // An empty enum isn't a valid schema; `null` is the only answer then
  return ids.length > 0 ? z.enum(ids as [string, ...string[]]) : z.null();
}
