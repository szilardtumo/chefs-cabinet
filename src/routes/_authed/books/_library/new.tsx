import { api } from '@convex/_generated/api';
import { useConvexMutation } from '@convex-dev/react-query';
import { useForm } from '@tanstack/react-form';
import { useMutation } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { FieldGroup } from '@/components/ui/field';
import { FieldInput, FieldSelect } from '@/components/ui/form-fields';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Spinner } from '@/components/ui/spinner';
import { toastError } from '@/lib/toast';
import { BOOK_STATUS_META, BOOK_STATUSES, type BookStatus } from '../-components/book-status';

const quickAddSchema = z.object({
  title: z.string().trim().min(1, 'Title is required'),
  author: z.string().trim().min(1, 'Author is required'),
  status: z.enum(BOOK_STATUSES),
});

export const Route = createFileRoute('/_authed/books/_library/new')({
  component: QuickAddRoute,
  context: () => ({ title: 'Add book' }),
});

function QuickAddRoute() {
  const navigate = Route.useNavigate();
  const [open, setOpen] = useState(true);
  const { mutateAsync: createBook } = useMutation({
    mutationFn: useConvexMutation(api.books.create),
  });

  const form = useForm({
    defaultValues: { title: '', author: '', status: 'not_started' as BookStatus },
    validators: { onChange: quickAddSchema },
    onSubmit: async ({ value }) => {
      try {
        const bookId = await createBook({
          title: value.title.trim(),
          author: value.author.trim(),
          status: value.status,
        });
        navigate({ to: '/books/$bookId', params: { bookId }, search: (prev) => prev, replace: true });
      } catch (error) {
        toastError(error);
      }
    },
  });

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent
        className="w-full gap-0 sm:max-w-md"
        // Fires after the exit animation; skipped when the route unmounts some other way (e.g. browser back)
        onCloseAutoFocus={() => !open && navigate({ to: '/books', search: (prev) => prev, replace: true })}
      >
        <form
          onSubmit={(event) => {
            event.preventDefault();
            form.handleSubmit();
          }}
          className="flex h-full flex-col"
        >
          <SheetHeader>
            <SheetTitle>Add book</SheetTitle>
            <SheetDescription>Cover, genres and the rest can be added from the book's panel next.</SheetDescription>
          </SheetHeader>
          <FieldGroup className="gap-4 px-4">
            <form.Field name="title">
              {(field) => <FieldInput field={field} label="Title" placeholder="e.g., Normal People" autoFocus />}
            </form.Field>
            <form.Field name="author">
              {(field) => <FieldInput field={field} label="Author" placeholder="e.g., Sally Rooney" />}
            </form.Field>
            <form.Field name="status">
              {(field) => (
                <FieldSelect
                  field={field}
                  label="Status"
                  options={BOOK_STATUSES.map((status) => ({ value: status, label: BOOK_STATUS_META[status].label }))}
                />
              )}
            </form.Field>
          </FieldGroup>
          <SheetFooter className="flex-row justify-end">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <form.Subscribe selector={(state) => state.isSubmitting}>
              {(isSubmitting) => (
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Spinner />}
                  Add book
                </Button>
              )}
            </form.Subscribe>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
