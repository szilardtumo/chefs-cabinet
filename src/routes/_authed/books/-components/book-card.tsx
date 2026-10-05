import type { api } from '@convex/_generated/api';
import { Link } from '@tanstack/react-router';
import type { FunctionReturnType } from 'convex/server';
import { Card } from '@/components/ui/card';
import { BookCover } from './book-cover';
import { BookProgressPopover } from './book-progress';
import { BookRating } from './book-rating';
import { BookStatusPicker } from './book-status-picker';

type Book = FunctionReturnType<typeof api.books.getAll>[number];

export function BookCard({ book }: { book: Book }) {
  return (
    <Card size="sm" className="h-full pt-0 transition-shadow hover:shadow-lg">
      {/* Duplicate of the title link, so it's skipped by keyboard and screen readers */}
      <Link to="/books/$bookId" params={{ bookId: book._id }} search={(prev) => prev} tabIndex={-1} aria-hidden>
        <BookCover book={book} className="rounded-none border-0 shadow-none" />
      </Link>
      <div className="flex flex-col gap-1 px-(--card-spacing)">
        <Link
          to="/books/$bookId"
          params={{ bookId: book._id }}
          search={(prev) => prev}
          className="flex flex-col gap-0.5"
        >
          <h3 className="line-clamp-2 text-sm font-medium leading-snug hover:underline">{book.title}</h3>
          <p className="line-clamp-1 text-xs text-muted-foreground">{book.author}</p>
        </Link>
        <BookRating book={book} className="-ml-0.5 justify-start" />
      </div>
      <div className="mt-auto flex flex-col gap-1 px-(--card-spacing)">
        <div>
          <BookStatusPicker book={book} />
        </div>
        {book.status === 'in_progress' && <BookProgressPopover book={book} />}
      </div>
    </Card>
  );
}
