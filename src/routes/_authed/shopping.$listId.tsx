import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AppLayout } from "@/components/app-layout";
import { useConvexQuery } from "@convex-dev/react-query";
import { api } from "@convex/_generated/api";
import { Button } from "@/components/ui/button";
import {
  Plus,
  Trash2,
  ArrowLeft,
  Check,
  Store,
  ShoppingCart,
  X,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { useState, useEffect } from "react";
import { useMutation } from "convex/react";
import { toast } from "sonner";
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
import { Id } from "@convex/_generated/dataModel";
import { Separator } from "@/components/ui/separator";
import { useForm } from "@tanstack/react-form";
import { z } from "zod";
import {
  Field,
  FieldLabel,
  FieldError,
} from "@/components/ui/field";

export const Route = createFileRoute("/_authed/shopping/$listId")({
  component: ShoppingListDetailComponent,
});

const ingredientSchema = z.object({
  ingredientId: z.string().min(1, "Ingredient is required"),
});

function AddIngredientDialog({
  open,
  onOpenChange,
  listId,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  listId: Id<"shoppingLists">;
  onAdd: (ingredientId: Id<"ingredients">) => void;
}) {
  const ingredients = useConvexQuery(api.ingredients.getAll, {});

  const form = useForm({
    defaultValues: {
      ingredientId: "",
    },
    validators: {
      onChange: ingredientSchema,
    },
    onSubmit: async ({ value }) => {
      onAdd(value.ingredientId as Id<"ingredients">);
      form.reset();
      onOpenChange(false);
    },
  });

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      form.reset();
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Ingredient</DialogTitle>
          <DialogDescription>
            Select an ingredient to add to your shopping list
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
            name="ingredientId"
            children={(field) => (
              <Field>
                <FieldLabel>Ingredient</FieldLabel>
                <Select
                  value={field.state.value}
                  onValueChange={(value) => field.handleChange(value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose an ingredient" />
                  </SelectTrigger>
                  <SelectContent>
                    {ingredients?.map((ingredient) => (
                      <SelectItem key={ingredient._id} value={ingredient._id}>
                        {ingredient.emoji && (
                          <span className="mr-1">{ingredient.emoji}</span>
                        )}
                        {ingredient.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldError>{field.state.meta.errors.join(", ")}</FieldError>
              </Field>
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
            <Button type="submit">Add</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function StoreModeView({ list, onBack }: { list: any; onBack: () => void }) {
  const toggleChecked = useMutation(api.shoppingListItems.toggleChecked);
  
  // Group items by category
  const groupedItems = list.items?.reduce((acc: any, item: any) => {
    if (item.checked) return acc; // Only show unchecked in store mode
    
    const categoryName = item.category?.name || "Other";
    if (!acc[categoryName]) {
      acc[categoryName] = [];
    }
    acc[categoryName].push(item);
    return acc;
  }, {});

  const handleToggle = async (itemId: Id<"shoppingListItems">) => {
    await toggleChecked({ id: itemId });
  };

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <Button variant="outline" onClick={onBack}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Exit Store Mode
          </Button>
          <Badge variant="secondary" className="text-lg px-4 py-2">
            {list.items?.filter((i: any) => !i.checked).length} items left
          </Badge>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">{list.name}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {Object.entries(groupedItems || {}).map(([category, items]: [string, any]) => (
              <div key={category}>
                <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                  <ShoppingCart className="h-5 w-5" />
                  {category}
                </h3>
                <div className="space-y-3">
                  {items.map((item: any) => (
                    <div
                      key={item._id}
                      onClick={() => handleToggle(item._id)}
                      className="flex items-start gap-4 p-4 border rounded-lg cursor-pointer hover:bg-accent transition-colors"
                    >
                      <Checkbox
                        checked={item.checked}
                        onCheckedChange={() => handleToggle(item._id)}
                        className="mt-1 h-6 w-6"
                      />
                      <div className="flex-1">
                        <p className="text-lg font-medium">
                          {item.ingredient?.emoji && (
                            <span className="mr-2">{item.ingredient.emoji}</span>
                          )}
                          {item.ingredient?.name}
                        </p>
                        {item.notes && (
                          <p className="text-sm text-muted-foreground">
                            {item.notes}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {(!groupedItems || Object.keys(groupedItems).length === 0) && (
              <div className="text-center py-12">
                <Check className="h-16 w-16 text-green-600 mx-auto mb-4" />
                <p className="text-xl font-semibold mb-2">All done!</p>
                <p className="text-muted-foreground">
                  You've checked off all items on your list
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ShoppingListDetailComponent() {
  const { listId } = Route.useParams();
  const list = useConvexQuery(api.shoppingLists.getById, {
    id: listId as Id<"shoppingLists">,
  });
  const addItem = useMutation(api.shoppingListItems.add);
  const toggleChecked = useMutation(api.shoppingListItems.toggleChecked);
  const removeItem = useMutation(api.shoppingListItems.remove);
  const updateList = useMutation(api.shoppingLists.update);
  const deleteList = useMutation(api.shoppingLists.remove);
  const clearChecked = useMutation(api.shoppingListItems.clearChecked);
  const navigate = useNavigate();
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [storeMode, setStoreMode] = useState(false);
  const [showChecked, setShowChecked] = useState(true);

  if (!list) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-96">
          <p className="text-muted-foreground">Loading shopping list...</p>
        </div>
      </AppLayout>
    );
  }

  if (storeMode) {
    return <StoreModeView list={list} onBack={() => setStoreMode(false)} />;
  }

  const handleAddIngredient = async (ingredientId: Id<"ingredients">) => {
    try {
      await addItem({
        shoppingListId: listId as Id<"shoppingLists">,
        ingredientId,
      });
      toast.success("Ingredient added", {
        description: "The ingredient has been added to your list.",
      });
    } catch (error: any) {
      toast.error("Error", {
        description: error.message,
      });
    }
  };

  const handleToggle = async (itemId: Id<"shoppingListItems">) => {
    await toggleChecked({ id: itemId });
  };

  const handleRemove = async (itemId: Id<"shoppingListItems">) => {
    try {
      await removeItem({ id: itemId });
      toast.success("Item removed", {
        description: "The item has been removed from your list.",
      });
    } catch (error: any) {
      toast.error("Error", {
        description: error.message,
      });
    }
  };

  const handleMarkComplete = async () => {
    try {
      await updateList({
        id: listId as Id<"shoppingLists">,
        status: "completed",
      });
      toast.success("List completed", {
        description: "Your shopping list has been marked as completed.",
      });
      navigate({ to: "/shopping" });
    } catch (error: any) {
      toast.error("Error", {
        description: error.message,
      });
    }
  };

  const handleDeleteList = async () => {
    if (!confirm("Are you sure you want to delete this shopping list?")) {
      return;
    }

    try {
      await deleteList({ id: listId as Id<"shoppingLists"> });
      toast.success("List deleted", {
        description: "The shopping list has been deleted.",
      });
      navigate({ to: "/shopping" });
    } catch (error: any) {
      toast.error("Error", {
        description: error.message,
      });
    }
  };

  const handleClearChecked = async () => {
    if (!confirm("Remove all checked items from the list?")) {
      return;
    }

    try {
      const count = await clearChecked({
        shoppingListId: listId as Id<"shoppingLists">,
      });
      toast.success("Items cleared", {
        description: `Removed ${count} checked items from your list.`,
      });
    } catch (error: any) {
      toast.error("Error", {
        description: error.message,
      });
    }
  };

  // Group items by category
  const groupedItems = list.items?.reduce((acc: any, item: any) => {
    const categoryName = item.category?.name || "Other";
    if (!acc[categoryName]) {
      acc[categoryName] = {
        emoji: item.category?.emoji,
        items: [],
      };
    }
    acc[categoryName].items.push(item);
    return acc;
  }, {});

  const filteredGroups = showChecked
    ? groupedItems
    : Object.entries(groupedItems || {}).reduce((acc: any, [key, value]: [string, any]) => {
        const uncheckedItems = value.items.filter((item: any) => !item.checked);
        if (uncheckedItems.length > 0) {
          acc[key] = { ...value, items: uncheckedItems };
        }
        return acc;
      }, {});

  const totalItems = list.items?.length || 0;
  const checkedItems = list.items?.filter((i: any) => i.checked).length || 0;

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <Button variant="ghost" asChild className="mb-2">
              <Link to="/shopping">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Lists
              </Link>
            </Button>
            <h1 className="text-3xl font-bold tracking-tight">{list.name}</h1>
            <p className="text-muted-foreground">
              {checkedItems}/{totalItems} items checked
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStoreMode(true)}>
              <Store className="mr-2 h-4 w-4" />
              Store Mode
            </Button>
            <Button onClick={() => setAddDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Item
            </Button>
          </div>
        </div>

        {/* Progress */}
        {totalItems > 0 && (
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Progress</span>
                  <span className="font-medium">
                    {Math.round((checkedItems / totalItems) * 100)}%
                  </span>
                </div>
                <div className="w-full bg-muted rounded-full h-3">
                  <div
                    className="bg-primary h-3 rounded-full transition-all"
                    style={{
                      width: `${(checkedItems / totalItems) * 100}%`,
                    }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Actions */}
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowChecked(!showChecked)}
          >
            {showChecked ? "Hide" : "Show"} Checked Items
          </Button>
          {checkedItems > 0 && (
            <Button variant="outline" size="sm" onClick={handleClearChecked}>
              Clear Checked Items
            </Button>
          )}
          {list.status === "active" && totalItems > 0 && (
            <Button size="sm" onClick={handleMarkComplete}>
              <Check className="mr-2 h-4 w-4" />
              Mark as Complete
            </Button>
          )}
          <Button
            variant="destructive"
            size="sm"
            onClick={handleDeleteList}
            className="ml-auto"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete List
          </Button>
        </div>

        {/* Items */}
        {totalItems === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16">
              <ShoppingCart className="h-16 w-16 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">List is empty</h3>
              <p className="text-muted-foreground text-center mb-4">
                Add ingredients to your shopping list
              </p>
              <Button onClick={() => setAddDialogOpen(true)}>
                Add First Item
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {Object.entries(filteredGroups || {}).map(
              ([categoryName, group]: [string, any]) => (
                <Card key={categoryName}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      {group.emoji && <span>{group.emoji}</span>}
                      {categoryName}
                      <Badge variant="secondary" className="ml-auto">
                        {group.items.length}
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {group.items.map((item: any) => (
                        <div
                          key={item._id}
                          className="flex items-center gap-3 p-3 border rounded-lg hover:bg-accent transition-colors"
                        >
                          <Checkbox
                            checked={item.checked}
                            onCheckedChange={() => handleToggle(item._id)}
                          />
                          <div className="flex-1">
                            <p
                              className={`font-medium ${
                                item.checked ? "line-through text-muted-foreground" : ""
                              }`}
                            >
                              {item.ingredient?.emoji && (
                                <span className="mr-1">
                                  {item.ingredient.emoji}
                                </span>
                              )}
                              {item.ingredient?.name}
                            </p>
                            {item.notes && (
                              <p className="text-sm text-muted-foreground">
                                {item.notes}
                              </p>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemove(item._id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )
            )}
          </div>
        )}
      </div>

      <AddIngredientDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        listId={listId as Id<"shoppingLists">}
        onAdd={handleAddIngredient}
      />
    </AppLayout>
  );
}
