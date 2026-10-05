import { api } from '@convex/_generated/api';
import { useConvexMutation } from '@convex-dev/react-query';
import { useMutation } from '@tanstack/react-query';
import type { FunctionReturnType } from 'convex/server';
import { StarRating } from '@/components/star-rating';
import { toastError, toastWithUndo } from '@/lib/toast';

type Book = FunctionReturnType<typeof api.books.getAll>[number];

/** Editable star rating; unrated books only show it once finished or abandoned. */
export function BookRating({ book, className }: { book: Pick<Book, '_id' | 'status' | 'rating'>; className?: string }) {
  const { mutateAsync: updateDetails } = useMutation({
    mutationFn: useConvexMutation(api.books.updateDetails),
  });

  // Prompt for a rating only once the book is finished or abandoned
  if (book.rating === undefined && book.status !== 'done' && book.status !== 'cancelled') {
    return null;
  }

  const handleRatingChange = async (rating: number | undefined) => {
    try {
      await updateDetails({ id: book._id, rating: rating ?? null });
      toastWithUndo(rating ? `Rated ${rating} star${rating === 1 ? '' : 's'}` : 'Rating cleared', () =>
        updateDetails({ id: book._id, rating: book.rating ?? null }),
      );
    } catch (error) {
      toastError(error);
    }
  };

  return <StarRating value={book.rating} onValueChange={handleRatingChange} className={className} />;
}
