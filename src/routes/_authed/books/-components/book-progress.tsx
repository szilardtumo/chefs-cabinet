import { api } from '@convex/_generated/api';
import { useConvexMutation } from '@convex-dev/react-query';
import { useForm } from '@tanstack/react-form';
import { useMutation } from '@tanstack/react-query';
import type { FunctionReturnType } from 'convex/server';
import { useState } from 'react';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { FieldInput, FieldSlider } from '@/components/ui/form-fields';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Progress } from '@/components/ui/progress';
import { toastError, toastWithUndo } from '@/lib/toast';

type Book = FunctionReturnType<typeof api.books.getAll>[number];

export function BookProgressPopover({ book }: { book: Book }) {
  const [open, setOpen] = useState(false);
  const { mutateAsync: updateDetails } = useMutation({
    mutationFn: useConvexMutation(api.books.updateDetails),
  });
  const pagesReadSchema = z
    .number({ error: 'Enter a page number' })
    .int('Enter a whole page number')
    .min(0, 'Enter a page number')
    .max(book.pageCount ?? Number.POSITIVE_INFINITY, `The book has ${book.pageCount} pages`);

  const form = useForm({
    defaultValues: { pagesRead: book.pagesRead },
    validators: { onChange: z.object({ pagesRead: pagesReadSchema }) },
    onSubmit: async ({ value: { pagesRead } }) => {
      setOpen(false);
      if (pagesRead === book.pagesRead) return;
      try {
        await updateDetails({ id: book._id, pagesRead });
        toastWithUndo(`Progress saved: page ${pagesRead}`, () =>
          updateDetails({ id: book._id, pagesRead: book.pagesRead }),
        );
      } catch (error) {
        toastError(error);
      }
    },
  });

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (nextOpen) form.reset({ pagesRead: book.pagesRead });
      }}
    >
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="-mx-2 h-auto justify-start gap-2 px-2 py-1.5"
          aria-label={`Update progress of ${book.title}`}
        >
          {book.progressPercent !== undefined ? (
            <>
              <Progress value={book.progressPercent} className="h-1.5 flex-1" />
              <span className="text-xs tabular-nums text-muted-foreground">{book.progressPercent}%</span>
            </>
          ) : (
            <span className="text-xs text-muted-foreground">Page {book.pagesRead}</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64" align="start">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            form.handleSubmit();
          }}
          className="flex flex-col gap-3"
        >
          <form.Field name="pagesRead">
            {(field) => (
              <>
                <FieldInput
                  field={field}
                  label="Current page"
                  description={book.pageCount !== undefined ? `of ${book.pageCount} pages` : undefined}
                  type="number"
                  min={0}
                  max={book.pageCount}
                  onFocus={(event) => event.target.select()}
                  autoFocus
                />
                {book.pageCount !== undefined && (
                  <FieldSlider field={field} max={book.pageCount} step={1} aria-label="Pages read" hideError />
                )}
              </>
            )}
          </form.Field>
          <form.Subscribe selector={(state) => state.isSubmitting}>
            {(isSubmitting) => (
              <Button type="submit" size="sm" disabled={isSubmitting}>
                Save
              </Button>
            )}
          </form.Subscribe>
        </form>
      </PopoverContent>
    </Popover>
  );
}
