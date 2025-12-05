import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import type { IngredientWithCategory } from '@convex/ingredients';
import { convexQuery, useConvexMutation } from '@convex-dev/react-query';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { type ColumnDef, createColumnHelper } from '@tanstack/react-table';
import { Check, MoreVertical, Pencil, Plus, Settings2, ShoppingCart, Trash2 } from 'lucide-react';
import { Suspense, useCallback, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { DataTable } from '@/components/data-table/data-table';
import { DataTableColumnHeader } from '@/components/data-table/data-table-column-header';
import { DataTableToolbar } from '@/components/data-table/data-table-toolbar';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useDataTable } from '@/hooks/use-data-table';
import { cn } from '@/lib/utils';
import { IngredientDialog, type IngredientFormData } from './-components/ingredient-dialog';

export const Route = createFileRoute('/_authed/ingredients/')({
  component: IngredientsComponent,
});

const columnHelper = createColumnHelper<IngredientWithCategory>();

function IngredientsComponent() {
  const { data: ingredients } = useSuspenseQuery(convexQuery(api.ingredients.getAll, {}));
  const { data: shoppingList } = useSuspenseQuery(convexQuery(api.shoppingLists.get, {}));

  const { mutateAsync: createIngredient } = useMutation({
    mutationFn: useConvexMutation(api.ingredients.create),
  });
  const { mutateAsync: updateIngredient } = useMutation({
    mutationFn: useConvexMutation(api.ingredients.update),
  });
  const { mutateAsync: deleteIngredient } = useMutation({
    mutationFn: useConvexMutation(api.ingredients.remove),
  });
  const { mutateAsync: addToShoppingList } = useMutation({
    mutationFn: useConvexMutation(api.shoppingListItems.add),
  });
  const { mutateAsync: removeFromShoppingList } = useMutation({
    mutationFn: useConvexMutation(api.shoppingListItems.removeByIngredient),
  });

  const [selectedIngredient, setSelectedIngredient] = useState<IngredientWithCategory | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const handleSave = async (data: IngredientFormData) => {
    try {
      if (selectedIngredient) {
        await updateIngredient({ id: selectedIngredient._id, ...data });
        toast.success('Ingredient updated', {
          description: 'The ingredient has been updated successfully.',
        });
      } else {
        await createIngredient(data);
        toast.success('Ingredient added', {
          description: 'The ingredient has been added successfully.',
        });
      }
      setEditDialogOpen(false);
      setSelectedIngredient(null);
    } catch (error) {
      toast.error('Error', {
        description: error instanceof Error ? error.message : 'An unknown error occurred',
      });
    }
  };

  const handleDeleteConfirm = useCallback(async () => {
    if (!selectedIngredient) return;

    try {
      await deleteIngredient({ id: selectedIngredient._id });
      toast.success('Ingredient deleted', {
        description: 'The ingredient has been deleted successfully.',
      });
      setDeleteDialogOpen(false);
      setSelectedIngredient(null);
    } catch (error) {
      toast.error('Error', {
        description: error instanceof Error ? error.message : 'An unknown error occurred',
      });
    }
  }, [selectedIngredient, deleteIngredient]);

  const isIngredientInShoppingList = useCallback(
    (ingredientId: Id<'ingredients'>) => {
      if (!shoppingList?.items) return false;
      return shoppingList.items.some((item) => item.ingredientId === ingredientId);
    },
    [shoppingList],
  );

  const handleToggleShoppingList = useCallback(
    async (ingredient: IngredientWithCategory) => {
      if (!shoppingList?._id) return;

      try {
        const isInList = isIngredientInShoppingList(ingredient._id);

        if (isInList) {
          await removeFromShoppingList({
            shoppingListId: shoppingList._id,
            ingredientId: ingredient._id,
          });
          toast.success('Removed from shopping list', {
            description: `${ingredient.name} has been removed from your shopping list.`,
          });
        } else {
          await addToShoppingList({
            shoppingListId: shoppingList._id,
            ingredientId: ingredient._id,
          });
          toast.success('Added to shopping list', {
            description: `${ingredient.name} has been added to your shopping list.`,
          });
        }
      } catch (error) {
        toast.error('Error', {
          description: error instanceof Error ? error.message : 'An unknown error occurred',
        });
      }
    },
    [shoppingList, addToShoppingList, removeFromShoppingList, isIngredientInShoppingList],
  );

  // Column definitions
  const columns = useMemo(
    () =>
      [
        columnHelper.display({
          id: 'shoppingList',
          cell: (info) => {
            const ingredient = info.row.original;
            const isInShoppingList = isIngredientInShoppingList(ingredient._id);
            return (
              <Button
                variant="ghost"
                size="icon"
                className="relative shrink-0"
                onClick={() => handleToggleShoppingList(ingredient)}
                title={isInShoppingList ? 'Remove from shopping list' : 'Add to shopping list'}
              >
                <ShoppingCart className={cn(isInShoppingList && 'fill-black text-black')} />
                {isInShoppingList && <Check className="absolute right-0 top-0 size-3 text-green-500" />}
              </Button>
            );
          },
        }),
        columnHelper.accessor('name', {
          id: 'name',
          header: ({ column }) => <DataTableColumnHeader column={column} label="Name" />,
          cell: (info) => {
            const ingredient = info.row.original;
            return (
              <div className="flex items-center gap-2">
                {ingredient.emoji && <span className="text-lg">{ingredient.emoji}</span>}
                {info.getValue()}
              </div>
            );
          },
        }),
        columnHelper.accessor('category.name', {
          id: 'category',
          header: ({ column }) => <DataTableColumnHeader column={column} label="Category" />,
          cell: (info) => {
            const category = info.row.original.category;
            if (!category) return '-';
            return (
              <Badge variant="secondary" className="text-nowrap">
                {category.emoji && <span className="mr-1">{category.emoji}</span>}
                {info.getValue()}
              </Badge>
            );
          },
          enableColumnFilter: true,
          filterFn: 'arrIncludesSome',
          meta: {
            label: 'Category',
            variant: 'multiSelect',
          },
        }),
        columnHelper.accessor('notes', {
          id: 'notes',
          header: ({ column }) => <DataTableColumnHeader column={column} label="Notes" />,
          cell: (info) => {
            return <span className="max-w-xs truncate block">{info.getValue() || '-'}</span>;
          },
          enableSorting: false,
        }),
        columnHelper.display({
          id: 'actions',
          header: ({ column }) => <DataTableColumnHeader column={column} label="Actions" className="text-right" />,
          cell: (info) => {
            const ingredient = info.row.original;
            return (
              <div className="flex justify-end">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <MoreVertical />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={() => {
                        setSelectedIngredient(ingredient);
                        setEditDialogOpen(true);
                      }}
                    >
                      <Pencil />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => {
                        setSelectedIngredient(ingredient);
                        setDeleteDialogOpen(true);
                      }}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            );
          },
        }),
      ] as ColumnDef<IngredientWithCategory>[],
    [isIngredientInShoppingList, handleToggleShoppingList],
  );

  const { table } = useDataTable({
    data: ingredients || [],
    columns,
    getRowId: (row) => row._id,
    enableHiding: true,
  });

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Ingredients</h1>
            <p className="text-muted-foreground">Manage your kitchen ingredients</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link to="/ingredients/categories">
                <Settings2 />
                Categories
              </Link>
            </Button>
            <Button
              onClick={() => {
                setSelectedIngredient(null);
                setEditDialogOpen(true);
              }}
            >
              <Plus />
              Add Ingredient
            </Button>
          </div>
        </div>

        {/* Ingredients Table */}
        <Card>
          <CardHeader>
            <CardTitle>All Ingredients ({table.getFilteredRowModel().rows.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <DataTable table={table}>
              <DataTableToolbar table={table}></DataTableToolbar>
            </DataTable>
          </CardContent>
        </Card>
      </div>

      <Suspense>
        <IngredientDialog
          open={editDialogOpen}
          onOpenChange={(open) => {
            setEditDialogOpen(open);
            if (!open) {
              setSelectedIngredient(null);
            }
          }}
          ingredient={selectedIngredient || undefined}
          onSave={handleSave}
        />
      </Suspense>

      <AlertDialog
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          setDeleteDialogOpen(open);
          if (!open) {
            setSelectedIngredient(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Ingredient</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this ingredient? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
