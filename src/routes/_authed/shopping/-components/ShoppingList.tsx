import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import type { ShoppingListItemWithIngredient } from '@convex/shoppingListItems';
import { useConvexAction, useConvexMutation } from '@convex-dev/react-query';
import { useMutation } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import type { FunctionReturnType } from 'convex/server';
import { sortBy } from 'es-toolkit';
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Edit,
  Info,
  MoreHorizontal,
  NotebookPen,
  ShoppingCart,
  Trash,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useState } from 'react';
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
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Item, ItemContent, ItemMedia, ItemTitle } from '@/components/ui/item';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { IngredientDialog } from '../../ingredients/-components/ingredient-dialog';
import { ShoppingItemNotesDialog } from './ShoppingItemNotesDialog';

type ShoppingListData = NonNullable<FunctionReturnType<typeof api.shoppingLists.get>>;

/** The list's add field, actions and items, shared by the shopping page and the dashboard. */
export function ShoppingList({ list }: { list: ShoppingListData }) {
  const { mutateAsync: addItem } = useMutation({
    mutationFn: useConvexMutation(api.shoppingListItems.add),
  });
  const { mutateAsync: quickCreateIngredient } = useMutation({
    mutationFn: useConvexAction(api.ingredients.quickCreate),
  });
  const { mutateAsync: toggleChecked } = useMutation({
    mutationFn: useConvexMutation(api.shoppingListItems.toggleChecked).withOptimisticUpdate((localStore, args) => {
      const currentList = localStore.getQuery(api.shoppingLists.get, {});
      const currentItem = currentList?.items?.find((item) => item._id === args.id);
      if (currentItem) {
        currentItem.checked = !currentItem.checked;
        currentItem.skipped = false;
      }
      localStore.setQuery(api.shoppingLists.get, {}, currentList);
    }),
  });
  const { mutateAsync: toggleSkipped } = useMutation({
    mutationFn: useConvexMutation(api.shoppingListItems.toggleSkipped).withOptimisticUpdate((localStore, args) => {
      const currentList = localStore.getQuery(api.shoppingLists.get, {});
      const currentItem = currentList?.items?.find((item) => item._id === args.id);
      if (currentItem) {
        currentItem.skipped = !currentItem.skipped;
      }
      localStore.setQuery(api.shoppingLists.get, {}, currentList);
    }),
  });
  const { mutateAsync: removeItem } = useMutation({
    mutationFn: useConvexMutation(api.shoppingListItems.remove),
  });
  const { mutateAsync: clearChecked } = useMutation({
    mutationFn: useConvexMutation(api.shoppingListItems.removeChecked),
  });

  const [currentItem, setCurrentItem] = useState<ShoppingListItemWithIngredient | null>(null);
  const [editIngredientDialogOpen, setEditIngredientDialogOpen] = useState(false);
  const [editNotesDialogOpen, setEditNotesDialogOpen] = useState(false);

  const handleAddIngredient = async (ingredientId: Id<'ingredients'>) => {
    try {
      const itemId = await addItem({
        shoppingListId: list._id,
        ingredientId,
      });
      if (itemId) {
        toast.success('Ingredient added', {
          description: 'The ingredient has been added to your list.',
        });
      } else toast.info('Already on your list');
    } catch (error) {
      toast.error('Error', {
        description: error instanceof Error ? error.message : 'An unknown error occurred',
      });
    }
  };

  const handleCreateIngredient = async (ingredientName: string) => {
    try {
      const [ingredientId] = await quickCreateIngredient({ names: [ingredientName] });
      await handleAddIngredient(ingredientId);
    } catch (error) {
      toast.error('Error', {
        description: error instanceof Error ? error.message : 'An unknown error occurred',
      });
    }
  };

  const handleToggle = async (itemId: Id<'shoppingListItems'>) => {
    await toggleChecked({ id: itemId });
  };

  const handleToggleSkipped = async (itemId: Id<'shoppingListItems'>) => {
    await toggleSkipped({ id: itemId });
  };

  const handleRemoveItem = async (itemId: Id<'shoppingListItems'>) => {
    try {
      await removeItem({ id: itemId });
      toast.success('Ingredient removed', {
        description: 'The ingredient has been removed from your list.',
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

  // Sort items: unchecked first, then skipped, then checked — each group sorted by category name
  const sortedItems = sortBy(list.items, [
    (item) => (item.checked ? 2 : item.skipped ? 1 : 0),
    (item) => item.category?.name || 'Other',
  ]);

  return (
    <div className="space-y-6">
      <IngredientCombobox
        selectedItems={list.items.map((item) => item.ingredientId)}
        onSelect={handleAddIngredient}
        onCreate={handleCreateIngredient}
      />
      {/* Actions */}
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="outline" size="sm" disabled={!list.items.some((item) => item.checked)}>
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
      {sortedItems.length === 0 ? (
        <Empty className="border border-dashed">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ShoppingCart />
            </EmptyMedia>
            <EmptyTitle>List is empty</EmptyTitle>
            <EmptyDescription>Add ingredients to your shopping list</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="space-y-2">
          <AnimatePresence>
            {sortedItems.map((item) => {
              return (
                <motion.div
                  key={item._id}
                  className="overflow-hidden"
                  layout
                  initial={{ opacity: 0, y: -30 }}
                  animate={{ opacity: item.skipped ? 0.5 : 1, y: 0 }}
                  exit={{ opacity: 0, height: 0 }}
                >
                  <Item variant="outline" className="cursor-pointer hover:bg-accent py-3 flex-nowrap" asChild>
                    <Label htmlFor={item._id}>
                      <ItemMedia>
                        <Checkbox id={item._id} checked={item.checked} onCheckedChange={() => handleToggle(item._id)} />
                      </ItemMedia>
                      <ItemContent className="overflow-x-auto no-scrollbar">
                        <ItemTitle className="w-full gap-1.5">
                          {item.ingredient?.emoji && <span>{item.ingredient.emoji}</span>}
                          <span className={cn(item.checked && 'line-through text-muted-foreground', 'line-clamp-2')}>
                            {item.ingredient?.name}
                          </span>
                          {(item.notes || item.ingredient?.notes) && (
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="size-4 text-muted-foreground cursor-default hover:text-foreground"
                                >
                                  <Info />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent side="top" className="w-fit py-3 text-sm text-muted-foreground">
                                {[item.notes, item.ingredient?.notes].filter(Boolean).join(', ')}
                              </PopoverContent>
                            </Popover>
                          )}
                          <div className="ml-auto flex items-center gap-2">
                            {item.category && (
                              <Badge variant="secondary" className="line-clamp-1">
                                {item.category.emoji && <span className="mr-1">{item.category.emoji}</span>}
                                {item.category.name}
                              </Badge>
                            )}
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  className="shrink-0 size-5 text-muted-foreground hover:text-foreground"
                                >
                                  <MoreHorizontal />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {!item.checked && (
                                  <DropdownMenuItem onSelect={() => handleToggleSkipped(item._id)}>
                                    {item.skipped ? <ArrowUp /> : <ArrowDown />}
                                    {item.skipped ? 'Unskip' : 'Skip'}
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuItem
                                  onSelect={() => {
                                    setCurrentItem(item);
                                    setEditIngredientDialogOpen(true);
                                  }}
                                >
                                  <Edit /> Edit ingredient
                                </DropdownMenuItem>
                                <DropdownMenuItem asChild>
                                  <Link to="/ingredients" search={{ q: item.ingredient?.name }}>
                                    <ArrowRight /> Go to ingredient
                                  </Link>
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onSelect={() => {
                                    setCurrentItem(item);
                                    setEditNotesDialogOpen(true);
                                  }}
                                >
                                  <NotebookPen /> {item.notes ? 'Edit' : 'Add'} notes
                                </DropdownMenuItem>
                                <DropdownMenuItem onSelect={() => handleRemoveItem(item._id)}>
                                  <Trash /> Remove
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </ItemTitle>
                      </ItemContent>
                    </Label>
                  </Item>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
      <ShoppingItemNotesDialog
        open={editNotesDialogOpen}
        item={currentItem}
        onClose={() => {
          setCurrentItem(null);
          setEditNotesDialogOpen(false);
        }}
      />
      <IngredientDialog
        open={editIngredientDialogOpen}
        ingredient={currentItem?.ingredient || undefined}
        onClose={() => {
          setCurrentItem(null);
          setEditIngredientDialogOpen(false);
        }}
      />
    </div>
  );
}
