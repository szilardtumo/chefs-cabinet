import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/app-layout";
import { useSuspenseQuery, useMutation } from "@tanstack/react-query";
import { convexQuery, useConvexMutation } from "@convex-dev/react-query";
import { api } from "@convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Pencil, Trash2, GripVertical } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Id } from "@convex/_generated/dataModel";
import { useForm } from "@tanstack/react-form";
import { z } from "zod";
import {
  FieldInput,
  FieldColor,
  FieldEmoji,
} from "@/components/ui/form-fields";

export const Route = createFileRoute("/_authed/ingredients/categories")({
  component: CategoriesComponent,
});

const categorySchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  emoji: z.string().optional(),
  color: z.string().optional(),
});

function SortableCategoryRow({ category, onEdit, onDelete }: any) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: category._id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 rounded-lg border bg-card p-4"
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing"
      >
        <GripVertical className="h-5 w-5 text-muted-foreground" />
      </button>

      <div className="flex items-center gap-3 flex-1">
        {category.emoji && <span className="text-2xl">{category.emoji}</span>}
        {category.color && (
          <div
            className="h-6 w-6 rounded border"
            style={{ backgroundColor: category.color }}
          />
        )}
        <div className="flex-1">
          <h3 className="font-medium">{category.name}</h3>
          {category.description && (
            <p className="text-sm text-muted-foreground">
              {category.description}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => onEdit(category)}>
          <Pencil className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onDelete(category._id)}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function CategoryDialog({
  open,
  onOpenChange,
  category,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category?: any;
  onSave: (data: any) => void;
}) {
  const form = useForm({
    defaultValues: {
      name: category?.name || "",
      description: category?.description || "",
      emoji: category?.emoji || "",
      color: category?.color || "#000000",
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
      form.setFieldValue("name", category?.name || "");
      form.setFieldValue("description", category?.description || "");
      form.setFieldValue("emoji", category?.emoji || "");
      form.setFieldValue("color", category?.color || "#000000");
    }
  }, [category, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {category ? "Edit Category" : "Create Category"}
          </DialogTitle>
          <DialogDescription>
            {category
              ? "Update the category details"
              : "Add a new category for organizing ingredients"}
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
          <form.Field
            name="name"
            children={(field) => (
              <FieldInput
                field={field}
                label="Name"
                placeholder="e.g., Vegetables"
              />
            )}
          />

          <form.Field
            name="description"
            children={(field) => (
              <FieldInput
                field={field}
                label="Description (Optional)"
                placeholder="Brief description"
              />
            )}
          />

          <form.Field
            name="emoji"
            children={(field) => (
              <FieldEmoji field={field} label="Emoji (Optional)" />
            )}
          />

          <form.Field
            name="color"
            children={(field) => (
              <FieldColor field={field} label="Color (Optional)" />
            )}
          />

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit">{category ? "Update" : "Create"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CategoriesComponent() {
  const { data: categories } = useSuspenseQuery(
    convexQuery(api.categories.getAll, {})
  );
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
  const [editingCategory, setEditingCategory] = useState<any>(null);
  const [localCategories, setLocalCategories] = useState<any[]>([]);

  // Update local categories when data changes
  useEffect(() => {
    if (categories) {
      setLocalCategories(categories);
    }
  }, [categories]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = localCategories.findIndex((c) => c._id === active.id);
      const newIndex = localCategories.findIndex((c) => c._id === over.id);

      const newOrder = arrayMove(localCategories, oldIndex, newIndex);
      setLocalCategories(newOrder);

      // Update orders in database
      const updates = newOrder.map((category, index) => ({
        id: category._id,
        order: index + 1,
      }));

      try {
        await reorderCategories({ updates });
        toast.success("Categories reordered", {
          description: "The category order has been updated.",
        });
      } catch (error: any) {
        toast.error("Error", {
          description: error.message,
        });
      }
    }
  };

  const handleSave = async (data: any) => {
    try {
      if (editingCategory) {
        await updateCategory({ id: editingCategory._id, ...data });
        toast.success("Category updated", {
          description: "The category has been updated successfully.",
        });
      } else {
        await createCategory(data);
        toast.success("Category created", {
          description: "The category has been created successfully.",
        });
      }
      setEditingCategory(null);
    } catch (error: any) {
      toast.error("Error", {
        description: error.message,
      });
    }
  };

  const handleDelete = async (id: Id<"categories">) => {
    if (!confirm("Are you sure you want to delete this category?")) {
      return;
    }

    try {
      await deleteCategory({ id });
      toast.success("Category deleted", {
        description: "The category has been deleted successfully.",
      });
    } catch (error: any) {
      toast.error("Error", {
        description: error.message,
      });
    }
  };

  return (
    <AppLayout>
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Categories</h1>
            <p className="text-muted-foreground">
              Organize your ingredients with categories
            </p>
          </div>
          <Button
            onClick={() => {
              setEditingCategory(null);
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
              <p className="text-center text-muted-foreground py-8">
                No categories yet. Create your first category!
              </p>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={localCategories.map((c) => c._id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-2">
                    {localCategories.map((category) => (
                      <SortableCategoryRow
                        key={category._id}
                        category={category}
                        onEdit={(cat: any) => {
                          setEditingCategory(cat);
                          setDialogOpen(true);
                        }}
                        onDelete={handleDelete}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </CardContent>
        </Card>
      </div>

      <CategoryDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        category={editingCategory}
        onSave={handleSave}
      />
    </AppLayout>
  );
}
