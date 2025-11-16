import { api } from '@convex/_generated/api';
import type { Ingredient } from '@convex/ingredients';
import { convexQuery } from '@convex-dev/react-query';
import { useForm } from '@tanstack/react-form';
import { useSuspenseQuery } from '@tanstack/react-query';
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
import { FieldEmojiPicker, FieldInput, FieldSelect, FieldTextarea } from '@/components/ui/form-fields';
import { zodConvexId } from '@/utils/validation';

const ingredientSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  categoryId: zodConvexId<'categories'>(),
  defaultUnit: z.string().optional(),
  notes: z.string().optional(),
  emoji: z.string().optional(),
});

export type IngredientFormData = z.infer<typeof ingredientSchema>;

type IngredientDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ingredient?: Ingredient;
  onSave: (data: IngredientFormData) => Promise<void>;
};

export function IngredientDialog({ open, onOpenChange, ingredient, onSave }: IngredientDialogProps) {
  const { data: categories } = useSuspenseQuery(convexQuery(api.categories.getAll, {}));

  const form = useForm({
    defaultValues: {
      name: ingredient?.name || '',
      categoryId: ingredient?.categoryId,
      defaultUnit: ingredient?.defaultUnit,
      notes: ingredient?.notes || '',
      emoji: ingredient?.emoji,
    } as IngredientFormData,
    validators: {
      onSubmit: ingredientSchema,
    },
    onSubmit: async ({ value }) => {
      await onSave(value);
      onOpenChange(false);
    },
  });

  // Reset form when ingredient changes or dialog opens/closes
  useEffect(() => {
    if (open) {
      form.setFieldValue('name', ingredient?.name || '');
      if (ingredient?.categoryId) {
        form.setFieldValue('categoryId', ingredient?.categoryId);
      }
      form.setFieldValue('defaultUnit', ingredient?.defaultUnit);
      form.setFieldValue('notes', ingredient?.notes || '');
      form.setFieldValue('emoji', ingredient?.emoji);
    }
  }, [ingredient, open, form.setFieldValue]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{ingredient ? 'Edit Ingredient' : 'Add Ingredient'}</DialogTitle>
          <DialogDescription>
            {ingredient ? 'Update the ingredient details' : 'Add a new ingredient to your kitchen'}
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
              {(field) => <FieldInput field={field} label="Name" placeholder="e.g., Tomato" />}
            </form.Field>
          </div>

          <form.Field name="categoryId">
            {(field) => (
              <FieldSelect
                field={field}
                label="Category"
                placeholder="Select a category"
                options={categories.map((cat) => ({
                  value: cat._id,
                  label: `${cat.emoji ? `${cat.emoji} ` : ''}${cat.name}`,
                }))}
              />
            )}
          </form.Field>

          <form.Field name="defaultUnit">
            {(field) => <FieldInput field={field} label="Default Unit (Optional)" placeholder="e.g., g, ml, piece" />}
          </form.Field>

          <form.Field name="notes">
            {(field) => (
              <FieldTextarea field={field} label="Notes (Optional)" placeholder="Any additional notes..." rows={3} />
            )}
          </form.Field>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">{ingredient ? 'Update' : 'Add'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
