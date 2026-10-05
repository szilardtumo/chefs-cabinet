import type { api } from '@convex/_generated/api';
import type { FunctionReturnType } from 'convex/server';
import { Library } from 'lucide-react';
import { cn } from '@/lib/utils';

type Book = FunctionReturnType<typeof api.books.getAll>[number];

export function BookCover({ book, className }: { book: Pick<Book, 'coverUrl' | 'title'>; className?: string }) {
  const frameClassName = cn('aspect-[2/3] w-full rounded-md border shadow-sm', className);

  if (!book.coverUrl) {
    return (
      <div className={cn('flex items-center justify-center bg-muted', frameClassName)}>
        <Library className="size-10 max-w-1/2 text-muted-foreground" />
      </div>
    );
  }

  return <img src={book.coverUrl} alt={book.title} className={cn('object-cover', frameClassName)} />;
}
