import { api } from '@convex/_generated/api';
import type { ShoppingListItemWithIngredient } from '@convex/shoppingListItems';
import { useConvexMutation } from '@convex-dev/react-query';
import { useMutation } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';

interface ShoppingItemNotesDialogProps {
  item: ShoppingListItemWithIngredient | null;
  onClose: () => void;
}

export function ShoppingItemNotesDialog({ item, onClose }: ShoppingItemNotesDialogProps) {
  const { mutateAsync: updateItem, isPending } = useMutation({
    mutationFn: useConvexMutation(api.shoppingListItems.update),
  });

  const [notesValue, setNotesValue] = useState('');

  useEffect(() => {
    setNotesValue(item?.notes ?? '');
  }, [item]);

  const handleSaveNotes = async () => {
    if (!item) {
      return;
    }

    try {
      await updateItem({ id: item._id, notes: notesValue.trim() });
      onClose();
      toast.success('Notes updated', {
        description: 'The notes have been saved to this ingredient.',
      });
    } catch (error) {
      toast.error('Error', {
        description: error instanceof Error ? error.message : 'An unknown error occurred',
      });
    }
  };

  return (
    <Dialog
      open={!!item}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add notes</DialogTitle>
          <DialogDescription>Attach notes for {item?.ingredient?.name ?? 'Ingredient'}.</DialogDescription>
        </DialogHeader>
        <Textarea
          value={notesValue}
          onChange={(event) => setNotesValue(event.target.value)}
          placeholder="Add recipe or shopping notes..."
          className="min-h-28"
        />
        <DialogFooter>
          <Button variant="ghost" className="hidden sm:block sm:mr-auto" onClick={() => setNotesValue('')}>
            Clear
          </Button>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSaveNotes} disabled={isPending}>
            {isPending ? 'Saving...' : 'Save notes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
