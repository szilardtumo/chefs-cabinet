import { api } from '@convex/_generated/api';
import type { Doc, Id } from '@convex/_generated/dataModel';
import { convexQuery, useConvexAction, useConvexMutation } from '@convex-dev/react-query';
import { useForm } from '@tanstack/react-form';
import { useMutation, useQuery } from '@tanstack/react-query';
import { createFileRoute, useCanGoBack, useRouter } from '@tanstack/react-router';
import type { FunctionArgs, FunctionReturnType } from 'convex/server';
import { getDate, getMonth, getYear, set } from 'date-fns';
import { ExternalLink, Trash2 } from 'lucide-react';
import { Fragment, useState } from 'react';
import { toast } from 'sonner';
import { z } from 'zod';
import { ConfirmDeleteDialog } from '@/components/confirm-delete-dialog';
import { DatePicker } from '@/components/date-picker';
import { Button } from '@/components/ui/button';
import { FieldGroup, FieldLabel } from '@/components/ui/field';
import { FieldInput, FieldTextarea } from '@/components/ui/form-fields';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Spinner } from '@/components/ui/spinner';
import { TagsInput } from '@/components/ui/tags-input';
import { isbnSchema } from '@/lib/isbn';
import { toastError, toastWithUndo } from '@/lib/toast';
import { BookCover } from '../-components/book-cover';
import { BookProgressPopover } from '../-components/book-progress';
import { BookProgressChart } from '../-components/book-progress-chart';
import { BookRating } from '../-components/book-rating';
import { BookStatusPicker } from '../-components/book-status-picker';
import { IsbnScanButton } from '../-components/isbn-scan-button';

export const Route = createFileRoute('/_authed/books/_library/$bookId')({
  component: BookSheetRoute,
});

type Book = FunctionReturnType<typeof api.books.getById>;
type BookChanges = Omit<FunctionArgs<typeof api.books.updateDetails>, 'id'>;

type ReadingFormat = NonNullable<Doc<'books'>['readingFormat']>;

const READING_FORMAT_LABELS: Record<ReadingFormat, string> = {
  book: 'Book',
  ebook: 'eBook',
  audiobook: 'Audiobook',
  pdf: 'PDF',
  article: 'Article',
};

function BookDetails({ book, onClose }: { book: Book; onClose: () => void }) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const { mutateAsync: updateDetails } = useMutation({
    // Genre edits build on the current list, so show each one before the server confirms it
    mutationFn: useConvexMutation(api.books.updateDetails).withOptimisticUpdate((store, { id, genres }) => {
      const current = store.getQuery(api.books.getById, { id });
      if (current && genres) store.setQuery(api.books.getById, { id }, { ...current, genres });
    }),
  });
  const { mutateAsync: removeBook } = useMutation({
    mutationFn: useConvexMutation(api.books.remove),
  });
  const { mutate: setIsbn, isPending: isUpdatingFromIsbn } = useMutation({
    mutationFn: useConvexAction(api.bookLookup.setIsbn),
    onSuccess: (isbn: string) => {
      // Shows the stored ISBN-13, so blurring the field again doesn't look like another change
      form.setFieldValue('isbn', isbn);
      toast.success('Book details updated');
    },
    onError: (error) => {
      toastError(error);
      form.setFieldValue('isbn', book.isbn ?? '');
    },
  });

  const save = async (changes: BookChanges, undoChanges?: BookChanges) => {
    try {
      await updateDetails({ id: book._id, ...changes });
      if (undoChanges) {
        toastWithUndo('Saved', () => updateDetails({ id: book._id, ...undoChanges }));
      }
    } catch (error) {
      toastError(error);
    }
  };

  const form = useForm({
    defaultValues: { isbn: book.isbn ?? '', notes: book.notes ?? '' },
  });

  const handleDelete = async () => {
    onClose();
    try {
      await removeBook({ id: book._id });
      toast.success('Book deleted');
    } catch (error) {
      toastError(error);
    }
  };

  const dates = [
    { key: 'startedAt', label: 'Started', value: book.startedAt, shown: book.status !== 'not_started' },
    { key: 'completedAt', label: 'Finished', value: book.completedAt, shown: book.status === 'done' },
    { key: 'cancelledAt', label: 'Stopped', value: book.cancelledAt, shown: book.status === 'cancelled' },
  ] as const;
  const shownDates = dates.filter((date) => date.shown);

  // Set from the catalog edition the ISBN points to
  const editionDetails = [
    { label: 'Pages', value: book.pageCount },
    { label: 'Format', value: book.readingFormat && READING_FORMAT_LABELS[book.readingFormat] },
    {
      label: 'Series',
      value: [book.seriesName, book.seriesPosition && `#${book.seriesPosition}`].filter(Boolean).join(' '),
    },
    { label: 'Published', value: book.publishedYear },
    { label: 'Publisher', value: book.publisher },
    { label: 'Language', value: book.language },
  ].filter((detail) => detail.value);

  return (
    <>
      <SheetHeader className="flex-row gap-4 border-b pr-12">
        <BookCover book={book} className="w-24 shrink-0 self-start" />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <SheetTitle className="text-lg">{book.title}</SheetTitle>
          <p className="text-muted-foreground">{book.author}</p>
          <SheetDescription className="sr-only">Book details. Changes are saved automatically.</SheetDescription>
          <BookRating book={book} className="justify-start" />
          <div className="mt-1 flex flex-col gap-1">
            <div>
              <BookStatusPicker book={book} />
            </div>
            {book.status === 'in_progress' && <BookProgressPopover book={book} />}
          </div>
        </div>
      </SheetHeader>

      <FieldGroup className="gap-6 p-4">
        <div className="grid grid-cols-[6rem_minmax(0,1fr)] items-start gap-x-3 gap-y-1">
          <form.Field
            name="isbn"
            validators={{
              // Empty is allowed while typing; blurring an empty field shows the current ISBN again
              onChange: z
                .string()
                .transform((value) => value.trim() || undefined)
                .pipe(isbnSchema.optional()),
            }}
            listeners={{
              // A new ISBN replaces the title, cover, pages and the rest with that edition's
              onBlur: ({ value, fieldApi }) => {
                // An ISBN can be replaced but not removed, so an emptied field shows the current one again
                if (!value.trim()) fieldApi.setValue(book.isbn ?? '');
                else if (fieldApi.state.meta.isValid && value !== book.isbn) setIsbn({ id: book._id, isbn: value });
              },
            }}
          >
            {(field) => (
              <>
                <FieldLabel htmlFor={field.name} className="pt-2 font-normal text-muted-foreground">
                  ISBN
                </FieldLabel>
                <div className="flex items-center gap-1">
                  <FieldInput
                    field={field}
                    placeholder="Add the ISBN to fill in the details"
                    disabled={isUpdatingFromIsbn}
                    className="border-transparent bg-transparent shadow-none hover:border-input focus-visible:border-input dark:bg-transparent"
                  />
                  {isUpdatingFromIsbn ? (
                    <Spinner />
                  ) : (
                    <IsbnScanButton
                      variant="ghost"
                      onScan={(isbn) => {
                        field.handleChange(isbn);
                        if (isbn !== book.isbn) setIsbn({ id: book._id, isbn });
                      }}
                    />
                  )}
                </div>
              </>
            )}
          </form.Field>

          <FieldLabel htmlFor="genres" className="pt-2 font-normal text-muted-foreground">
            Genres
          </FieldLabel>
          <TagsInput
            id="genres"
            value={book.genres}
            onValueChange={(genres) => save({ genres }, { genres: book.genres })}
            placeholder="Add a genre..."
            inputClassName="border-transparent bg-transparent shadow-none hover:border-input focus-visible:border-input dark:bg-transparent"
          />

          {shownDates.map((date) => (
            <Fragment key={date.key}>
              <FieldLabel htmlFor={date.key} className="pt-2 font-normal text-muted-foreground">
                {date.label}
              </FieldLabel>
              <DatePicker
                id={date.key}
                value={date.value === undefined ? undefined : new Date(date.value)}
                onValueChange={(day) => {
                  // Move to the picked day but keep the recorded time of day
                  const next = set(date.value ?? Date.now(), {
                    year: getYear(day),
                    month: getMonth(day),
                    date: getDate(day),
                  });
                  save({ [date.key]: next.getTime() });
                }}
                placeholder="Not set"
                className="border-transparent bg-transparent shadow-none hover:border-input focus-visible:border-input dark:bg-transparent"
              />
            </Fragment>
          ))}

          {editionDetails.map((detail) => (
            <Fragment key={detail.label}>
              <span className="pt-2 text-sm font-normal text-muted-foreground">{detail.label}</span>
              <span className="pt-2 text-sm">{detail.value}</span>
            </Fragment>
          ))}

          {book.goodreadsUrl && (
            <>
              <span className="pt-2 text-sm font-normal text-muted-foreground">Goodreads</span>
              <a
                href={book.goodreadsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 pt-2 text-sm underline underline-offset-2"
              >
                Open <ExternalLink className="size-3.5" />
              </a>
            </>
          )}
        </div>

        <BookProgressChart book={book} />

        {book.description && (
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">Description</span>
            <p className="whitespace-pre-line text-sm text-muted-foreground">{book.description}</p>
          </div>
        )}

        <form.Field
          name="notes"
          listeners={{
            onBlur: ({ value }) => value.trim() !== (book.notes ?? '') && save({ notes: value.trim() || null }),
          }}
        >
          {(field) => (
            <FieldTextarea
              field={field}
              label="Notes"
              placeholder="Anything you want to remember about this book..."
              rows={5}
            />
          )}
        </form.Field>
      </FieldGroup>

      <SheetFooter className="border-t">
        <Button variant="ghost" className="text-destructive" onClick={() => setDeleteDialogOpen(true)}>
          <Trash2 />
          Delete book
        </Button>
      </SheetFooter>

      <ConfirmDeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleDelete}
        itemType="book"
        itemName={book.title}
      />
    </>
  );
}

function BookSheetRoute() {
  const { bookId } = Route.useParams();
  const navigate = Route.useNavigate();
  const router = useRouter();
  const canGoBack = useCanGoBack();
  const [open, setOpen] = useState(true);
  const { data: book, isError } = useQuery(convexQuery(api.books.getById, { id: bookId as Id<'books'> }));

  const close = () => {
    // Escape closes the sheet without blurring the focused input, which would skip its save-on-blur
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    setOpen(false);
  };

  return (
    <Sheet open={open} onOpenChange={(nextOpen) => !nextOpen && close()}>
      <SheetContent
        className="w-full gap-0 overflow-y-auto sm:max-w-md"
        // Fires after the exit animation; skipped when the route unmounts some other way (e.g. browser back).
        // Going back returns to wherever the book was opened from, such as the stats page.
        onCloseAutoFocus={() =>
          !open &&
          (canGoBack ? router.history.back() : navigate({ to: '/books', search: (prev) => prev, replace: true }))
        }
      >
        {book ? (
          <BookDetails key={book._id} book={book} onClose={close} />
        ) : (
          <SheetHeader className="items-center py-12">
            <SheetTitle className="sr-only">Book</SheetTitle>
            <SheetDescription className="sr-only">Loading book details</SheetDescription>
            {isError ? <p className="text-sm text-muted-foreground">This book doesn't exist.</p> : <Spinner />}
          </SheetHeader>
        )}
      </SheetContent>
    </Sheet>
  );
}
