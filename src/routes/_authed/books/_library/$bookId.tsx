import { api } from '@convex/_generated/api';
import type { Doc, Id } from '@convex/_generated/dataModel';
import { convexQuery, useConvexMutation } from '@convex-dev/react-query';
import { type AnyFieldApi, useForm } from '@tanstack/react-form';
import { useMutation, useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import type { FunctionArgs, FunctionReturnType } from 'convex/server';
import { ExternalLink, ImageUp, Trash2 } from 'lucide-react';
import { Fragment, useState } from 'react';
import { toast } from 'sonner';
import { z } from 'zod';
import { ConfirmDeleteDialog } from '@/components/confirm-delete-dialog';
import { DatePicker } from '@/components/date-picker';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FieldGroup, FieldLabel } from '@/components/ui/field';
import { FieldImage, FieldInput, FieldTextarea } from '@/components/ui/form-fields';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Spinner } from '@/components/ui/spinner';
import { TagsInput } from '@/components/ui/tags-input';
import { useStorageUpload } from '@/hooks/use-storage-upload';
import { toastError, toastWithUndo } from '@/lib/toast';
import { cn } from '@/lib/utils';
import { BookCover } from '../-components/book-cover';
import { BookProgressPopover } from '../-components/book-progress';
import { BookRating } from '../-components/book-rating';
import { BookStatusPicker } from '../-components/book-status-picker';

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

const PROPERTY_LABEL_CLASS = 'pt-2 font-normal text-muted-foreground';
// Inputs read as plain text until hovered or focused
const INLINE_INPUT_CLASS =
  'border-transparent bg-transparent shadow-none hover:border-input focus-visible:border-input dark:bg-transparent';

type CoverDialogProps = {
  book: Book;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function CoverDialog({ book, open, onOpenChange }: CoverDialogProps) {
  const { uploadFile } = useStorageUpload();
  const { mutateAsync: updateDetails } = useMutation({
    mutationFn: useConvexMutation(api.books.updateDetails),
  });
  const form = useForm({
    // `coverUrl` only previews the current cover; `FieldImage`'s Remove button clears it
    defaultValues: { coverFiles: [] as File[], coverUrl: book.coverUrl ?? undefined },
    onSubmit: async ({ value }) => {
      try {
        if (value.coverFiles[0]) {
          await updateDetails({ id: book._id, cover: await uploadFile(value.coverFiles[0]) });
        } else if (!value.coverUrl && book.cover) {
          await updateDetails({ id: book._id, cover: null });
        }
        onOpenChange(false);
      } catch (error) {
        toastError(error);
      }
    },
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (nextOpen) form.reset();
        onOpenChange(nextOpen);
      }}
    >
      <DialogContent>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            form.handleSubmit();
          }}
          className="flex flex-col gap-4"
        >
          <DialogHeader>
            <DialogTitle>Change cover</DialogTitle>
            <DialogDescription>Upload an image for the cover.</DialogDescription>
          </DialogHeader>
          <form.Field name="coverFiles">
            {(coverFilesField) => (
              <form.Field name="coverUrl">
                {(coverUrlField) => (
                  <FieldImage
                    filesField={coverFilesField}
                    urlField={coverUrlField}
                    label="Cover"
                    previewClassName="aspect-[2/3] w-28 rounded-md"
                    onReset={() => form.reset()}
                  />
                )}
              </form.Field>
            )}
          </form.Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <form.Subscribe selector={(state) => state.isSubmitting}>
              {(isSubmitting) => (
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Spinner />}
                  Save cover
                </Button>
              )}
            </form.Subscribe>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function BookDetails({ book, onClose }: { book: Book; onClose: () => void }) {
  const [coverDialogOpen, setCoverDialogOpen] = useState(false);
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

  // Typed fields are saved one by one when they lose focus; emptied optional fields are cleared
  const saveTextOnBlur =
    (key: 'title' | 'author' | 'goodreadsUrl' | 'notes') =>
    ({ value, fieldApi }: { value: string; fieldApi: AnyFieldApi }) => {
      const text = value.trim();
      if (fieldApi.state.meta.isValid && text !== (book[key] ?? '')) save({ [key]: text || null });
    };

  const form = useForm({
    defaultValues: {
      title: book.title,
      author: book.author,
      pageCount: book.pageCount,
      goodreadsUrl: book.goodreadsUrl ?? '',
      notes: book.notes ?? '',
    },
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

  const minPageCount = book.status === 'done' ? 1 : Math.max(1, book.pagesRead);

  const dates = [
    { key: 'startedAt', label: 'Started', value: book.startedAt, shown: book.status !== 'not_started' },
    { key: 'completedAt', label: 'Finished', value: book.completedAt, shown: book.status === 'done' },
    { key: 'cancelledAt', label: 'Stopped', value: book.cancelledAt, shown: book.status === 'cancelled' },
  ] as const;
  const shownDates = dates.filter((date) => date.shown);

  return (
    <>
      <SheetHeader className="flex-row gap-4 border-b pr-12">
        <button
          type="button"
          className="group relative w-24 shrink-0 self-start"
          onClick={() => setCoverDialogOpen(true)}
          aria-label="Change cover"
        >
          <BookCover book={book} />
          <span className="absolute inset-0 flex items-center justify-center rounded-md bg-black/40 text-white opacity-0 transition-opacity group-hover:opacity-100">
            <ImageUp className="size-5" />
          </span>
        </button>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <SheetTitle className="sr-only">{book.title}</SheetTitle>
          <SheetDescription className="sr-only">Book details. Changes are saved automatically.</SheetDescription>
          <form.Field
            name="title"
            validators={{ onChange: z.string().trim().min(1, 'Title is required') }}
            listeners={{ onBlur: saveTextOnBlur('title') }}
          >
            {(field) => (
              <FieldInput
                field={field}
                aria-label="Title"
                className={cn('-ml-3 h-auto py-1 text-lg font-semibold md:text-lg', INLINE_INPUT_CLASS)}
              />
            )}
          </form.Field>
          <form.Field
            name="author"
            validators={{ onChange: z.string().trim().min(1, 'Author is required') }}
            listeners={{ onBlur: saveTextOnBlur('author') }}
          >
            {(field) => (
              <FieldInput
                field={field}
                aria-label="Author"
                className={cn('-ml-3 h-auto py-1 text-muted-foreground', INLINE_INPUT_CLASS)}
              />
            )}
          </form.Field>
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
          <FieldLabel htmlFor="genres" className={PROPERTY_LABEL_CLASS}>
            Genres
          </FieldLabel>
          <TagsInput
            id="genres"
            value={book.genres}
            onValueChange={(genres) => save({ genres }, { genres: book.genres })}
            placeholder="Add a genre..."
            inputClassName={INLINE_INPUT_CLASS}
          />

          <FieldLabel htmlFor="readingFormat" className={PROPERTY_LABEL_CLASS}>
            Format
          </FieldLabel>
          <Select
            value={book.readingFormat ?? ''}
            onValueChange={(format) =>
              save({ readingFormat: format as ReadingFormat }, { readingFormat: book.readingFormat ?? null })
            }
          >
            <SelectTrigger id="readingFormat" className={INLINE_INPUT_CLASS}>
              <SelectValue placeholder="Not set" />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(READING_FORMAT_LABELS).map(([format, label]) => (
                <SelectItem key={format} value={format}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <form.Field
            name="pageCount"
            validators={{
              onChange: z
                .number()
                .int('Page count must be a whole number')
                // Finished books follow the page count; otherwise it can't drop below the pages already read
                .min(minPageCount, `Must be at least ${minPageCount}`)
                .optional(),
            }}
            listeners={{
              onBlur: ({ value, fieldApi }) =>
                fieldApi.state.meta.isValid && value !== book.pageCount && save({ pageCount: value ?? null }),
            }}
          >
            {(field) => (
              <>
                <FieldLabel htmlFor={field.name} className={PROPERTY_LABEL_CLASS}>
                  Page count
                </FieldLabel>
                <FieldInput field={field} type="number" min={1} placeholder="Not set" className={INLINE_INPUT_CLASS} />
              </>
            )}
          </form.Field>

          {shownDates.map((date) => (
            <Fragment key={date.key}>
              <FieldLabel htmlFor={date.key} className={PROPERTY_LABEL_CLASS}>
                {date.label}
              </FieldLabel>
              <DatePicker
                id={date.key}
                value={date.value === undefined ? undefined : new Date(date.value)}
                onValueChange={(day) => {
                  // Move to the picked day but keep the recorded time of day
                  const next = new Date(date.value ?? Date.now());
                  next.setFullYear(day.getFullYear(), day.getMonth(), day.getDate());
                  save({ [date.key]: next.getTime() });
                }}
                placeholder="Not set"
                className={INLINE_INPUT_CLASS}
              />
            </Fragment>
          ))}

          <form.Field
            name="goodreadsUrl"
            validators={{ onChange: z.url({ protocol: /^https?$/, error: 'Enter a web address' }).or(z.literal('')) }}
            listeners={{ onBlur: saveTextOnBlur('goodreadsUrl') }}
          >
            {(field) => (
              <>
                <FieldLabel htmlFor={field.name} className={PROPERTY_LABEL_CLASS}>
                  Goodreads
                </FieldLabel>
                <div className="flex gap-1">
                  <FieldInput field={field} placeholder="Paste a link" className={INLINE_INPUT_CLASS} />
                  {book.goodreadsUrl && (
                    <Button variant="ghost" size="icon" aria-label="Open on Goodreads" asChild>
                      <a href={book.goodreadsUrl} target="_blank" rel="noopener noreferrer">
                        <ExternalLink />
                      </a>
                    </Button>
                  )}
                </div>
              </>
            )}
          </form.Field>
        </div>

        <form.Field name="notes" listeners={{ onBlur: saveTextOnBlur('notes') }}>
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

      <CoverDialog book={book} open={coverDialogOpen} onOpenChange={setCoverDialogOpen} />
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
        // Fires after the exit animation; skipped when the route unmounts some other way (e.g. browser back)
        onCloseAutoFocus={() => !open && navigate({ to: '/books', search: (prev) => prev, replace: true })}
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
