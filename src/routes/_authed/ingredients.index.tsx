import { createFileRoute, Link } from "@tanstack/react-router";
import { AppLayout } from "@/components/app-layout";
import { useConvexQuery } from "@convex-dev/react-query";
import { api } from "@convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Plus, Pencil, Trash2, Search, Settings2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useState, useEffect } from "react";
import { useMutation } from "convex/react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Id } from "@convex/_generated/dataModel";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useForm } from "@tanstack/react-form";
import { z } from "zod";
import {
  FieldInput,
  FieldTextarea,
  FieldEmoji,
  FieldSelect,
} from "@/components/ui/form-fields";
import { FieldGroup } from "@/components/ui/field";

export const Route = createFileRoute("/_authed/ingredients/")({
  component: IngredientsComponent,
});

const ingredientSchema = z.object({
  name: z.string().min(1, "Name is required"),
  categoryId: z.string().min(1, "Category is required"),
  defaultUnit: z.string(),
  notes: z.string(),
  emoji: z.string(),
});

function IngredientDialog({
  open,
  onOpenChange,
  ingredient,
  categories,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ingredient?: any;
  categories: any[];
  onSave: (data: any) => void;
}) {
  const form = useForm({
    defaultValues: {
      name: ingredient?.name || "",
      categoryId: ingredient?.categoryId || "",
      defaultUnit: ingredient?.defaultUnit || "",
      notes: ingredient?.notes || "",
      emoji: ingredient?.emoji || "",
    },
    validators: {
      onChange: ingredientSchema,
    },
    onSubmit: async ({ value }) => {
      onSave({
        name: value.name,
        categoryId: value.categoryId as Id<"categories">,
        defaultUnit: value.defaultUnit || undefined,
        notes: value.notes || undefined,
        emoji: value.emoji || undefined,
      });
      onOpenChange(false);
    },
  });

  // Reset form when ingredient changes or dialog opens/closes
  useEffect(() => {
    if (open) {
      form.setFieldValue("name", ingredient?.name || "");
      form.setFieldValue("categoryId", ingredient?.categoryId || "");
      form.setFieldValue("defaultUnit", ingredient?.defaultUnit || "");
      form.setFieldValue("notes", ingredient?.notes || "");
      form.setFieldValue("emoji", ingredient?.emoji || "");
    }
  }, [ingredient, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {ingredient ? "Edit Ingredient" : "Add Ingredient"}
          </DialogTitle>
          <DialogDescription>
            {ingredient
              ? "Update the ingredient details"
              : "Add a new ingredient to your kitchen"}
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
            <form.Field
              name="emoji"
              children={(field) => <FieldEmoji field={field} label="Icon" />}
            />

            <form.Field
              name="name"
              children={(field) => (
                <FieldInput
                  field={field}
                  label="Name"
                  placeholder="e.g., Tomato"
                />
              )}
            />
          </div>

          <form.Field
            name="categoryId"
            children={(field) => (
              <FieldSelect
                field={field}
                label="Category"
                placeholder="Select a category"
                options={categories.map((cat) => ({
                  value: cat._id,
                  label: `${cat.emoji ? cat.emoji + " " : ""}${cat.name}`,
                }))}
              />
            )}
          />

          <form.Field
            name="defaultUnit"
            children={(field) => (
              <FieldInput
                field={field}
                label="Default Unit (Optional)"
                placeholder="e.g., g, ml, piece"
              />
            )}
          />

          <form.Field
            name="notes"
            children={(field) => (
              <FieldTextarea
                field={field}
                label="Notes (Optional)"
                placeholder="Any additional notes..."
                rows={3}
              />
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
            <Button type="submit">{ingredient ? "Update" : "Add"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function IngredientsComponent() {
  const ingredients = useConvexQuery(api.ingredients.getAll, {});
  const categories = useConvexQuery(api.categories.getAll, {});
  const createIngredient = useMutation(api.ingredients.create);
  const updateIngredient = useMutation(api.ingredients.update);
  const deleteIngredient = useMutation(api.ingredients.remove);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingIngredient, setEditingIngredient] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  // Filter ingredients
  const filteredIngredients = ingredients?.filter((ingredient) => {
    const matchesSearch = ingredient.name
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    const matchesCategory =
      selectedCategory === "all" || ingredient.categoryId === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleSave = async (data: any) => {
    try {
      if (editingIngredient) {
        await updateIngredient({ id: editingIngredient._id, ...data });
        toast.success("Ingredient updated", {
          description: "The ingredient has been updated successfully.",
        });
      } else {
        await createIngredient(data);
        toast.success("Ingredient added", {
          description: "The ingredient has been added successfully.",
        });
      }
      setEditingIngredient(null);
    } catch (error: any) {
      toast.error("Error", {
        description: error.message,
      });
    }
  };

  const handleDelete = async (id: Id<"ingredients">) => {
    if (!confirm("Are you sure you want to delete this ingredient?")) {
      return;
    }

    try {
      await deleteIngredient({ id });
      toast.success("Ingredient deleted", {
        description: "The ingredient has been deleted successfully.",
      });
    } catch (error: any) {
      toast.error("Error", {
        description: error.message,
      });
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Ingredients</h1>
            <p className="text-muted-foreground">
              Manage your kitchen ingredients
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link to="/ingredients/categories">
                <Settings2 className="mr-2 h-4 w-4" />
                Categories
              </Link>
            </Button>
            <Button
              onClick={() => {
                setEditingIngredient(null);
                setDialogOpen(true);
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Ingredient
            </Button>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search ingredients..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
              <Select
                value={selectedCategory}
                onValueChange={setSelectedCategory}
              >
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="All categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All categories</SelectItem>
                  {categories?.map((cat) => (
                    <SelectItem key={cat._id} value={cat._id}>
                      {cat.emoji && <span className="mr-2">{cat.emoji}</span>}
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Ingredients Table */}
        <Card>
          <CardHeader>
            <CardTitle>
              All Ingredients ({filteredIngredients?.length || 0})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!filteredIngredients || filteredIngredients.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">
                  {searchQuery || selectedCategory !== "all"
                    ? "No ingredients match your filters"
                    : "No ingredients yet. Add your first ingredient!"}
                </p>
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Default Unit</TableHead>
                      <TableHead>Notes</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredIngredients.map((ingredient) => (
                      <TableRow key={ingredient._id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            {ingredient.emoji && (
                              <span className="text-lg">
                                {ingredient.emoji}
                              </span>
                            )}
                            {ingredient.name}
                          </div>
                        </TableCell>
                        <TableCell>
                          {ingredient.category && (
                            <Badge variant="secondary">
                              {ingredient.category.emoji && (
                                <span className="mr-1">
                                  {ingredient.category.emoji}
                                </span>
                              )}
                              {ingredient.category.name}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>{ingredient.defaultUnit || "-"}</TableCell>
                        <TableCell className="max-w-xs truncate">
                          {ingredient.notes || "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setEditingIngredient(ingredient);
                                setDialogOpen(true);
                              }}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete(ingredient._id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {categories && (
        <IngredientDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          ingredient={editingIngredient}
          categories={categories}
          onSave={handleSave}
        />
      )}
    </AppLayout>
  );
}
