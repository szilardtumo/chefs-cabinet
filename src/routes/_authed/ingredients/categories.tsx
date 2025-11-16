import { api } from '@convex/_generated/api';
import { convexQuery, useConvexMutation } from '@convex-dev/react-query';
import { arrayMove } from '@dnd-kit/sortable';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { GripVertical, Pencil, Plus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
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
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Sortable, SortableContent, SortableItem, SortableItemHandle } from '@/components/ui/sortable';
import { type Category, CategoryDialog, type CategoryFormData } from './-components/category-dialog';

export const Route = createFileRoute('/_authed/ingredients/categories')({
  component: CategoriesComponent,
  context: () => ({ title: 'Categories' }),
});

function SortableCategoryRow({
  category,
  onEdit,
  onDelete,
}: {
  category: Category;
  onEdit: (category: Category) => void;
  onDelete: (category: Category) => void;
}) {
  return (
    <SortableItem value={category._id} className="flex items-center gap-3 rounded-lg border bg-card p-4">
      <SortableItemHandle>
        <GripVertical className="h-5 w-5 text-muted-foreground" />
      </SortableItemHandle>

      <div className="flex items-center gap-3 flex-1">
        {category.emoji && <span className="text-2xl">{category.emoji}</span>}
        {category.color && <div className="h-6 w-6 rounded border" style={{ backgroundColor: category.color }} />}
        <div className="flex-1">
          <h3 className="font-medium">{category.name}</h3>
          {category.description && <p className="text-sm text-muted-foreground">{category.description}</p>}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => onEdit(category)}>
          <Pencil />
        </Button>
        <Button variant="ghost" size="icon" onClick={() => onDelete(category)}>
          <Trash2 />
        </Button>
      </div>
    </SortableItem>
  );
}

function CategoriesComponent() {
  const { data: categories } = useSuspenseQuery(convexQuery(api.categories.getAll, {}));
  const { mutateAsync: createCategory } = useMutation({
    mutationFn: useConvexMutation(api.categories.create),
  });
  const { mutateAsync: updateCategory } = useMutation({
    mutationFn: useConvexMutation(api.categories.update),
  });
  const { mutateAsync: deleteCategory } = useMutation({
    mutationFn: useConvexMutation(api.categories.remove),
  });
  const { mutateAsync: reorderCategories } = useMutation({
    mutationFn: useConvexMutation(api.categories.reorder),
  });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<Category>();
  const [localCategories, setLocalCategories] = useState<Category[]>([]);

  // Update local categories when data changes
  useEffect(() => {
    if (categories) {
      setLocalCategories(categories);
    }
  }, [categories]);

  const handleMove = async (event: { activeIndex: number; overIndex: number }) => {
    const { activeIndex, overIndex } = event;
    const newOrder = arrayMove(localCategories, activeIndex, overIndex);
    setLocalCategories(newOrder);

    // Update orders in database
    const ids = newOrder.map((category) => category._id);

    try {
      await reorderCategories({ ids });
      toast.success('Categories reordered', {
        description: 'The category order has been updated.',
      });
    } catch (error) {
      toast.error('Error', {
        description: error instanceof Error ? error.message : 'An unknown error occurred',
      });
    }
  };

  const handleSave = async (data: CategoryFormData) => {
    try {
      if (selectedCategory) {
        await updateCategory({ id: selectedCategory._id, ...data });
        toast.success('Category updated', {
          description: 'The category has been updated successfully.',
        });
      } else {
        await createCategory(data);
        toast.success('Category created', {
          description: 'The category has been created successfully.',
        });
      }
      setSelectedCategory(undefined);
    } catch (error) {
      toast.error('Error', {
        description: error instanceof Error ? error.message : 'An unknown error occurred',
      });
    }
  };

  const handleDeleteClick = (category: Category) => {
    setSelectedCategory(category);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!selectedCategory) return;

    try {
      await deleteCategory({ id: selectedCategory._id });
      toast.success('Category deleted', {
        description: 'The category has been deleted successfully.',
      });
      setSelectedCategory(undefined);
      setDeleteDialogOpen(false);
    } catch (error) {
      toast.error('Error', {
        description: error instanceof Error ? error.message : 'An unknown error occurred',
      });
    }
  };

  return (
    <>
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Categories</h1>
            <p className="text-muted-foreground">Organize your ingredients with categories</p>
          </div>
          <Button
            onClick={() => {
              setSelectedCategory(undefined);
              setDialogOpen(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Category
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>All Categories</CardTitle>
          </CardHeader>
          <CardContent>
            {!localCategories || localCategories.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No categories yet. Create your first category!</p>
            ) : (
              <Sortable
                value={localCategories}
                onMove={handleMove}
                getItemValue={(category) => category._id}
                orientation="vertical"
              >
                <SortableContent className="space-y-2">
                  {localCategories.map((category) => (
                    <SortableCategoryRow
                      key={category._id}
                      category={category}
                      onEdit={(cat) => {
                        setSelectedCategory(cat);
                        setDialogOpen(true);
                      }}
                      onDelete={handleDeleteClick}
                    />
                  ))}
                </SortableContent>
              </Sortable>
            )}
          </CardContent>
        </Card>
      </div>

      <CategoryDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            setSelectedCategory(undefined);
          }
        }}
        category={selectedCategory}
        onSave={handleSave}
      />

      <AlertDialog
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          setDeleteDialogOpen(open);
          if (!open) {
            setSelectedCategory(undefined);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Category</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{selectedCategory?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
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
