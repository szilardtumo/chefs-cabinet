import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import { convexQuery, useConvexMutation } from '@convex-dev/react-query';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import { Check, ShoppingCart } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Button } from './ui/button';

export const IngredientCartButton = ({ ingredientId }: { ingredientId: Id<'ingredients'> }) => {
  const { data: shoppingList } = useSuspenseQuery(convexQuery(api.shoppingLists.get, {}));

  const { mutateAsync: addToShoppingList } = useMutation({
    mutationFn: useConvexMutation(api.shoppingListItems.add),
  });
  const { mutateAsync: removeFromShoppingList } = useMutation({
    mutationFn: useConvexMutation(api.shoppingListItems.removeByIngredient),
  });

  const ingredient = shoppingList?.items?.find((item) => item.ingredientId === ingredientId)?.ingredient;

  const isInShoppingList = !!ingredient;

  const handleToggleShoppingList = async () => {
    if (!shoppingList?._id) return;

    try {
      if (isInShoppingList) {
        await removeFromShoppingList({
          shoppingListId: shoppingList._id,
          ingredientId,
        });
        toast.success('Removed from shopping list', {
          description: `${ingredient.name} has been removed from your shopping list.`,
        });
      } else {
        await addToShoppingList({
          shoppingListId: shoppingList._id,
          ingredientId: ingredientId,
        });
        toast.success('Added to shopping list', {
          description: `Item has been added to your shopping list.`,
        });
      }
    } catch (error) {
      toast.error('Error', {
        description: error instanceof Error ? error.message : 'An unknown error occurred',
      });
    }
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      className="relative shrink-0"
      onClick={handleToggleShoppingList}
      title={isInShoppingList ? 'Remove from shopping list' : 'Add to shopping list'}
    >
      <ShoppingCart className={cn(isInShoppingList && 'fill-black text-black')} />
      {isInShoppingList && <Check className="absolute right-0.5 top-0.5 size-3 text-green-500" />}
    </Button>
  );
};
