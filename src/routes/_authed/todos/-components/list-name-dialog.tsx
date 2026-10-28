import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import type { TodoList } from '@convex/todoLists';
import { useConvexMutation } from '@convex-dev/react-query';
import { useForm } from '@tanstack/react-form';
import { useMutation } from '@tanstack/react-query';
import { useEffect } from 'react';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FieldInput } from '@/components/ui/form-fields';
import { toastError } from '@/lib/toast';

type ListNameDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The list to rename; without it, the dialog creates a list */
  list?: TodoList;
  onCreated?: (id: Id<'todoLists'>) => void;
};

export function ListNameDialog({ open, onOpenChange, list, onCreated }: ListNameDialogProps) {
  const { mutateAsync: createList } = useMutation({ mutationFn: useConvexMutation(api.todoLists.create) });
  const { mutateAsync: renameList } = useMutation({ mutationFn: useConvexMutation(api.todoLists.rename) });

  const form = useForm({
    defaultValues: { name: list?.name ?? '' },
    validators: { onSubmit: z.object({ name: z.string().trim().min(1, 'Name is required') }) },
    onSubmit: async ({ value }) => {
      try {
        if (list) await renameList({ id: list._id, name: value.name });
        else onCreated?.(await createList({ name: value.name }));
        onOpenChange(false);
      } catch (error) {
        toastError(error);
      }
    },
  });

  useEffect(() => {
    if (open) form.reset({ name: list?.name ?? '' });
  }, [open, list, form]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{list ? 'Rename list' : 'New list'}</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            form.handleSubmit();
          }}
          className="space-y-4"
        >
          <form.Field name="name">
            {(field) => <FieldInput field={field} label="Name" placeholder="e.g. Movies to watch" autoFocus />}
          </form.Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">{list ? 'Save' : 'Create'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
