import type { Id } from '@convex/_generated/dataModel';
import { useForm } from '@tanstack/react-form';
import { useEffect } from 'react';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FieldColorPicker, FieldEmojiPicker, FieldInput } from '@/components/ui/form-fields';

const categorySchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  emoji: z.string().optional(),
  color: z.string().optional(),
});

export type Category = {
  _id: Id<'categories'>;
  name: string;
  description?: string;
  emoji?: string;
  color?: string;
  order: number;
};

export type CategoryFormData = {
  name: string;
  description?: string;
  emoji?: string;
  color?: string;
};

type CategoryDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category?: Category;
  onSave: (data: CategoryFormData) => void;
};

export function CategoryDialog({ open, onOpenChange, category, onSave }: CategoryDialogProps) {
  const form = useForm({
    defaultValues: {
      name: category?.name || '',
      description: category?.description || '',
      emoji: category?.emoji || '',
      color: category?.color || '#000000',
    } as z.infer<typeof categorySchema>,
    validators: {
      onChange: categorySchema,
    },
    onSubmit: async ({ value }) => {
      onSave({
        name: value.name,
        description: value.description || undefined,
        emoji: value.emoji || undefined,
        color: value.color || undefined,
      });
      onOpenChange(false);
    },
  });

  // Reset form when category changes or dialog opens/closes
  useEffect(() => {
    if (open) {
      form.setFieldValue('name', category?.name || '');
      form.setFieldValue('description', category?.description || '');
      form.setFieldValue('emoji', category?.emoji || '');
      form.setFieldValue('color', category?.color || '#000000');
    }
  }, [category, open, form.setFieldValue]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{category ? 'Edit Category' : 'Create Category'}</DialogTitle>
          <DialogDescription>
            {category ? 'Update the category details' : 'Add a new category for organizing ingredients'}
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            form.handleSubmit();
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-[auto_1fr] gap-4">
            <form.Field name="emoji">{(field) => <FieldEmojiPicker field={field} label="Icon" />}</form.Field>

            <form.Field name="name">
              {(field) => <FieldInput field={field} label="Name" placeholder="e.g., Vegetables" />}
            </form.Field>
          </div>

          <form.Field name="description">
            {(field) => <FieldInput field={field} label="Description (Optional)" placeholder="Brief description" />}
          </form.Field>

          <form.Field name="color">{(field) => <FieldColorPicker field={field} label="Color (Optional)" />}</form.Field>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">{category ? 'Update' : 'Create'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

