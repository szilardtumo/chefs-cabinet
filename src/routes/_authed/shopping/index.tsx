import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import { convexQuery, useConvexMutation } from '@convex-dev/react-query';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { sortBy } from 'es-toolkit';
import { ShoppingCart, Trash2 } from 'lucide-react';
import { useEffect } from 'react';
import { toast } from 'sonner';
import { IngredientCombobox } from '@/components/ingredient-combobox';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Item, ItemActions, ItemContent, ItemDescription, ItemMedia, ItemTitle } from '@/components/ui/item';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

export const Route = createFileRoute('/_authed/shopping/')({
  component: ShoppingListComponent,
  context: () => ({ title: 'Shopping List' }),
});

function ShoppingListComponent() {
  const { data: list } = useSuspenseQuery(convexQuery(api.shoppingLists.get, {}));
  const { mutateAsync: createDefault } = useMutation({
    mutationFn: useConvexMutation(api.shoppingLists.createDefault),
  });
  const { mutateAsync: addItem } = useMutation({
    mutationFn: useConvexMutation(api.shoppingListItems.add),
  });
  const { mutateAsync: toggleChecked } = useMutation({
    mutationFn: useConvexMutation(api.shoppingListItems.toggleChecked),
  });
  const { mutateAsync: removeItem } = useMutation({
    mutationFn: useConvexMutation(api.shoppingListItems.remove),
  });
  const { mutateAsync: clearChecked } = useMutation({
    mutationFn: useConvexMutation(api.shoppingListItems.removeChecked),
  });

  // Create default list if it doesn't exist
  useEffect(() => {
    if (list === null) {
      createDefault(undefined);
    }
  }, [list, createDefault]);

  if (list === null) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-muted-foreground">Creating shopping list...</p>
      </div>
    );
  }

  const handleAddIngredient = async (ingredientId: Id<'ingredients'>) => {
    try {
      await addItem({
        shoppingListId: list._id,
        ingredientId,
      });
      toast.success('Ingredient added', {
        description: 'The ingredient has been added to your list.',
      });
    } catch (error) {
      toast.error('Error', {
        description: error instanceof Error ? error.message : 'An unknown error occurred',
      });
    }
  };

  const handleToggle = async (itemId: Id<'shoppingListItems'>) => {
    await toggleChecked({ id: itemId });
  };

  const handleRemove = async (itemId: Id<'shoppingListItems'>) => {
    try {
      await removeItem({ id: itemId });
      toast.success('Item removed', {
        description: 'The item has been removed from your list.',
      });
    } catch (error) {
      toast.error('Error', {
        description: error instanceof Error ? error.message : 'An unknown error occurred',
      });
    }
  };

  const handleClearChecked = async () => {
    try {
      const count = await clearChecked({ shoppingListId: list._id });
      toast.success('Items cleared', {
        description: `Removed ${count} checked items from your list.`,
      });
    } catch (error) {
      toast.error('Error', {
        description: error instanceof Error ? error.message : 'An unknown error occurred',
      });
    }
  };

  const itemIds = list.items?.map((item) => item.ingredientId);

  // Sort items by category name
  const sortedItems = sortBy(list.items, [(item) => item.category?.name || 'Other']);

  const totalItems = list.items?.length || 0;
  const checkedItems = list.items?.filter((i) => i.checked).length || 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight">{list.name}</h1>
          <p className="text-muted-foreground">
            {checkedItems}/{totalItems} items checked
          </p>
        </div>
      </div>

      {/* Progress */}

      <Card>
        <CardContent className="pt-6">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Progress</span>
              <span className="font-medium">{Math.round((checkedItems / totalItems) * 100) || 0}%</span>
            </div>
            <Progress value={(checkedItems / totalItems) * 100 || 0} />
          </div>
        </CardContent>
      </Card>

      {/* Add Ingredient Search */}
      <IngredientCombobox selectedItems={itemIds} onSelect={handleAddIngredient} />

      {/* Actions */}
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="outline" size="sm" disabled={checkedItems === 0}>
            Clear Checked Items
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear Checked Items</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove all checked items from your shopping list? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleClearChecked}>Clear Items</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Items */}
      {totalItems === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <ShoppingCart className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">List is empty</h3>
            <p className="text-muted-foreground text-center mb-4">Add ingredients to your shopping list</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              {sortedItems.map((item) => {
                return (
                  <Item key={item._id} variant="outline" className="cursor-pointer hover:bg-accent" asChild>
                    <Label htmlFor={item._id}>
                      <ItemMedia>
                        <Checkbox id={item._id} checked={item.checked} onCheckedChange={() => handleToggle(item._id)} />
                      </ItemMedia>
                      <ItemContent>
                        <ItemTitle>
                          {item.ingredient?.emoji && <span className="mr-1">{item.ingredient.emoji}</span>}
                          <span className={cn(item.checked && 'line-through text-muted-foreground')}>
                            {item.ingredient?.name}
                          </span>
                          {item.category && (
                            <Badge variant="secondary" className="ml-2">
                              {item.category.emoji && <span className="mr-1">{item.category.emoji}</span>}
                              {item.category.name}
                            </Badge>
                          )}
                        </ItemTitle>
                        {item.notes && <ItemDescription>{item.notes}</ItemDescription>}
                      </ItemContent>
                      <ItemActions>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="hover:text-destructive"
                          onClick={() => handleRemove(item._id)}
                        >
                          <Trash2 />
                        </Button>
                      </ItemActions>
                    </Label>
                  </Item>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
