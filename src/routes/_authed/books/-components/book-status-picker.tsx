import { api } from '@convex/_generated/api';
import { useConvexMutation } from '@convex-dev/react-query';
import { useMutation } from '@tanstack/react-query';
import type { FunctionReturnType } from 'convex/server';
import { Check } from 'lucide-react';
import { badgeVariants } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toastError, toastWithUndo } from '@/lib/toast';
import { cn } from '@/lib/utils';
import { BOOK_STATUS_META, BOOK_STATUSES, type BookStatus } from './book-status';

type Book = FunctionReturnType<typeof api.books.getAll>[number];

export function BookStatusIcon({ status, className }: { status: BookStatus; className?: string }) {
  const Icon = BOOK_STATUS_META[status].icon;
  return <Icon className={className} />;
}

/** Status badge that opens a menu to move the book to another status. */
export function BookStatusPicker({
  book,
}: {
  book: Pick<Book, '_id' | 'status' | 'startedAt' | 'completedAt' | 'cancelledAt' | 'pagesRead'>;
}) {
  const { mutateAsync: setStatus } = useMutation({
    mutationFn: useConvexMutation(api.books.setStatus),
  });
  const { mutateAsync: restoreStatus } = useMutation({
    mutationFn: useConvexMutation(api.books.restoreStatus),
  });

  const handleStatusChange = async (status: BookStatus) => {
    const { _id: id, startedAt, completedAt, cancelledAt, pagesRead } = book;
    try {
      await setStatus({ id, status });
      // A status change rewrites the reading dates, so Undo restores them exactly
      toastWithUndo(`Moved to ${BOOK_STATUS_META[status].label}`, () =>
        restoreStatus({ id, startedAt, completedAt, cancelledAt, pagesRead }),
      );
    } catch (error) {
      toastError(error);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          badgeVariants({ variant: BOOK_STATUS_META[book.status].variant }),
          'cursor-pointer gap-1 whitespace-nowrap',
        )}
        aria-label={`Status: ${BOOK_STATUS_META[book.status].label}. Change status`}
      >
        <BookStatusIcon status={book.status} className="size-3" />
        {BOOK_STATUS_META[book.status].label}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-44">
        {BOOK_STATUSES.map((status) => (
          <DropdownMenuItem key={status} onSelect={() => status !== book.status && handleStatusChange(status)}>
            <BookStatusIcon status={status} className="text-muted-foreground" />
            {BOOK_STATUS_META[status].label}
            {status === book.status && <Check className="ml-auto" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
