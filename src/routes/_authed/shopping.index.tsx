import { createFileRoute, Link } from "@tanstack/react-router";
import { AppLayout } from "@/components/app-layout";
import { useConvexQuery } from "@convex-dev/react-query";
import { api } from "@convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Plus, ShoppingCart, Check } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useForm } from "@tanstack/react-form";
import { z } from "zod";
import { Field, FieldLabel, FieldError } from "@/components/ui/field";

export const Route = createFileRoute("/_authed/shopping/")({
  component: ShoppingListsComponent,
});

const listSchema = z.object({
  name: z.string().min(1, "Name is required"),
});

function CreateListDialog({
  open,
  onOpenChange,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (name: string) => void;
}) {
  const form = useForm({
    defaultValues: {
      name: "",
    },
    validators: {
      onChange: listSchema,
    },
    onSubmit: async ({ value }) => {
      onCreate(value.name);
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
          <DialogTitle>Create Shopping List</DialogTitle>
          <DialogDescription>Give your shopping list a name</DialogDescription>
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
              <Field>
                <FieldLabel htmlFor={field.name}>List Name</FieldLabel>
                <Input
                  id={field.name}
                  name={field.name}
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  placeholder="e.g., Weekly Groceries"
                />
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
            <Button type="submit">Create List</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ShoppingListsComponent() {
  const allLists = useConvexQuery(api.shoppingLists.getAll, {});
  const createList = useMutation(api.shoppingLists.create);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  const activeLists =
    allLists?.filter((list) => list.status === "active") || [];
  const completedLists =
    allLists?.filter((list) => list.status === "completed") || [];

  const handleCreateList = async (name: string) => {
    try {
      await createList({ name });
      toast.success("List created", {
        description: "Your shopping list has been created successfully.",
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
            <h1 className="text-3xl font-bold tracking-tight">
              Shopping Lists
            </h1>
            <p className="text-muted-foreground">
              Manage your shopping lists and grocery items
            </p>
          </div>
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Create List
          </Button>
        </div>

        {/* Lists */}
        <Tabs defaultValue="active" className="w-full">
          <TabsList>
            <TabsTrigger value="active">
              Active ({activeLists.length})
            </TabsTrigger>
            <TabsTrigger value="completed">
              Completed ({completedLists.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="mt-6">
            {activeLists.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-16">
                  <ShoppingCart className="h-16 w-16 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">
                    No active shopping lists
                  </h3>
                  <p className="text-muted-foreground text-center mb-4">
                    Create your first shopping list to get started
                  </p>
                  <Button onClick={() => setCreateDialogOpen(true)}>
                    Create Shopping List
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {activeLists.map((list) => (
                  <Link
                    key={list._id}
                    to="/shopping/$listId"
                    params={{ listId: list._id }}
                  >
                    <Card className="hover:shadow-lg transition-shadow h-full">
                      <CardHeader>
                        <CardTitle className="flex items-center justify-between">
                          <span className="line-clamp-1">{list.name}</span>
                          <ShoppingCart className="h-5 w-5 text-muted-foreground" />
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">
                            Total Items
                          </span>
                          <Badge variant="secondary">{list.totalItems}</Badge>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Checked</span>
                          <Badge variant="secondary">
                            {list.checkedItems}/{list.totalItems}
                          </Badge>
                        </div>
                        {list.totalItems > 0 && (
                          <div className="w-full bg-muted rounded-full h-2">
                            <div
                              className="bg-primary h-2 rounded-full transition-all"
                              style={{
                                width: `${
                                  (list.checkedItems / list.totalItems) * 100
                                }%`,
                              }}
                            />
                          </div>
                        )}
                        <p className="text-xs text-muted-foreground">
                          Created{" "}
                          {new Date(list.createdAt).toLocaleDateString()}
                        </p>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="completed" className="mt-6">
            {completedLists.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-16">
                  <Check className="h-16 w-16 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">
                    No completed lists
                  </h3>
                  <p className="text-muted-foreground text-center">
                    Completed shopping lists will appear here
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {completedLists.map((list) => (
                  <Link
                    key={list._id}
                    to="/shopping/$listId"
                    params={{ listId: list._id }}
                  >
                    <Card className="hover:shadow-lg transition-shadow h-full opacity-75">
                      <CardHeader>
                        <CardTitle className="flex items-center justify-between">
                          <span className="line-clamp-1">{list.name}</span>
                          <Check className="h-5 w-5 text-green-600" />
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">
                            Total Items
                          </span>
                          <Badge variant="secondary">{list.totalItems}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Completed{" "}
                          {list.completedAt &&
                            new Date(list.completedAt).toLocaleDateString()}
                        </p>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <CreateListDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onCreate={handleCreateList}
      />
    </AppLayout>
  );
}
