import { api } from '@convex/_generated/api';
import type { Todo } from '@convex/todos';
import { useConvexMutation } from '@convex-dev/react-query';
import { useForm } from '@tanstack/react-form';
import { useMutation } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { upperFirst } from 'es-toolkit';
import { useEffect } from 'react';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FieldDatePicker, FieldInput, FieldSelect, FieldTextarea } from '@/components/ui/form-fields';
import { toastError } from '@/lib/toast';
import { PRIORITY_POINTS } from './todo-points';

const todoSchema = z.object({
  title: z.string().trim().min(1, 'Title is required'),
  notes: z.string(),
  priority: z.enum(['none', 'low', 'medium', 'high']),
  plannedDate: z.date().optional(),
  dueDate: z.date().optional(),
});

type TodoFormData = z.infer<typeof todoSchema>;

function toFormData(todo: Todo | null): TodoFormData {
  return {
    title: todo?.title ?? '',
    notes: todo?.notes ?? '',
    priority: todo?.priority ?? 'none',
    plannedDate: todo?.plannedDate ? parseISO(todo.plannedDate) : undefined,
    dueDate: todo?.dueDate ? parseISO(todo.dueDate) : undefined,
  };
}

type TodoDialogProps = {
  todo: Todo | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function TodoDialog({ todo, open, onOpenChange }: TodoDialogProps) {
  const { mutateAsync: updateTodo } = useMutation({ mutationFn: useConvexMutation(api.todos.update) });

  const form = useForm({
    defaultValues: toFormData(todo),
    validators: { onSubmit: todoSchema },
    onSubmit: async ({ value }) => {
      if (!todo) return;
      try {
        await updateTodo({
          id: todo._id,
          title: value.title,
          notes: value.notes.trim() || undefined,
          priority: value.priority === 'none' ? undefined : value.priority,
          plannedDate: value.plannedDate && format(value.plannedDate, 'yyyy-MM-dd'),
          dueDate: value.dueDate && format(value.dueDate, 'yyyy-MM-dd'),
        });
        onOpenChange(false);
      } catch (error) {
        toastError(error);
      }
    },
  });

  useEffect(() => {
    if (open) form.reset(toFormData(todo));
  }, [open, todo, form]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit to-do</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            form.handleSubmit();
          }}
          className="space-y-4"
        >
          <form.Field name="title">{(field) => <FieldInput field={field} label="Title" />}</form.Field>
          <div className="grid grid-cols-2 gap-4">
            <form.Field name="plannedDate">
              {(field) => (
                <FieldDatePicker
                  field={field}
                  label="Planned"
                  description="When you'll do it"
                  placeholder="Not planned"
                  allowFuture
                  onClear={() => field.handleChange(undefined)}
                />
              )}
            </form.Field>
            <form.Field name="dueDate">
              {(field) => (
                <FieldDatePicker
                  field={field}
                  label="Due"
                  description="When it must be done"
                  placeholder="No due date"
                  allowFuture
                  onClear={() => field.handleChange(undefined)}
                />
              )}
            </form.Field>
          </div>
          <form.Field name="priority">
            {(field) => (
              <FieldSelect
                field={field}
                label="Priority"
                options={[
                  { value: 'none', label: 'None' },
                  ...Object.entries(PRIORITY_POINTS).map(([priority, points]) => ({
                    value: priority,
                    label: `${upperFirst(priority)} (+${points} pts)`,
                  })),
                ]}
              />
            )}
          </form.Field>
          <form.Field name="notes">{(field) => <FieldTextarea field={field} label="Notes" rows={3} />}</form.Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">Save</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
