import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import { convexQuery, useConvexMutation } from '@convex-dev/react-query';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import { useState } from 'react';
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

type AddToShoppingListDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recipeId: Id<'recipes'>;
  recipeTitle: string;
};

export function AddToShoppingListDialog({
  open,
  onOpenChange,
  recipeId,
  recipeTitle,
}: AddToShoppingListDialogProps) {
  const { data: list } = useSuspenseQuery(convexQuery(api.shoppingLists.get, {}));
  const { mutateAsync: createDefault } = useMutation({
    mutationFn: useConvexMutation(api.shoppingLists.createDefault),
  });
  const { mutateAsync: addFromRecipe } = useMutation({
    mutationFn: useConvexMutation(api.shoppingListItems.addFromRecipe),
  });
  const [isAdding, setIsAdding] = useState(false);

  const handleAdd = async () => {
    try {
      setIsAdding(true);

      // Get or create the user's single shopping list
      let listId: Id<'shoppingLists'>;
      if (list?._id) {
        listId = list._id;
      } else {
        listId = await createDefault({});
      }

      await addFromRecipe({
        shoppingListId: listId,
        recipeId,
      });

      toast.success('Added to shopping list', {
        description: 'All ingredients have been added to your shopping list.',
      });
      onOpenChange(false);
    } catch (error) {
      toast.error('Error', {
        description: error instanceof Error ? error.message : 'An unknown error occurred',
      });
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add to Shopping List</DialogTitle>
          <DialogDescription>Add all ingredients from "{recipeTitle}" to your shopping list</DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleAdd} disabled={isAdding}>
            {isAdding ? 'Adding...' : 'Add Ingredients'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

