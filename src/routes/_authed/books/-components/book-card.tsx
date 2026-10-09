import type { api } from '@convex/_generated/api';
import { Link } from '@tanstack/react-router';
import type { FunctionReturnType } from 'convex/server';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { BookCover } from './book-cover';
import { BookProgressPopover } from './book-progress';
import { BookRating } from './book-rating';
import { BookStatusPicker } from './book-status-picker';

type Book = FunctionReturnType<typeof api.books.getAll>[number];

export function BookCard({ book, orientation = 'vertical' }: { book: Book; orientation?: 'vertical' | 'horizontal' }) {
  const horizontal = orientation === 'horizontal';

  return (
    <Card size="sm" className={cn('h-full transition-shadow hover:shadow-lg', horizontal ? 'flex-row py-0' : 'pt-0')}>
      {/* Duplicate of the title link, so it's skipped by keyboard and screen readers */}
      <Link
        to="/books/$bookId"
        params={{ bookId: book._id }}
        search={(prev) => prev}
        tabIndex={-1}
        aria-hidden
        className={cn(horizontal && 'w-20 shrink-0')}
      >
        <BookCover book={book} className={cn('rounded-none border-0 shadow-none', horizontal && 'h-full')} />
      </Link>
      {/* Stacks the details beside the cover; in the vertical card its children are the card's own rows */}
      <div
        className={cn(
          horizontal
            ? 'flex min-w-0 flex-1 flex-col gap-(--card-spacing) py-(--card-spacing) pr-(--card-spacing)'
            : 'contents',
        )}
      >
        <div className={cn('flex flex-col gap-1', !horizontal && 'px-(--card-spacing)')}>
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
        <div className={cn('mt-auto flex flex-col gap-1', !horizontal && 'px-(--card-spacing)')}>
          <div>
            <BookStatusPicker book={book} />
          </div>
          {book.status === 'in_progress' && <BookProgressPopover book={book} />}
        </div>
      </div>
    </Card>
  );
}
