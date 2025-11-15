import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import { convexQuery, useConvexMutation } from '@convex-dev/react-query';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { ArrowLeft, ChefHat, Clock, History, Pencil, ShoppingCart, Trash2, Users } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';

export const Route = createFileRoute('/_authed/recipes/$recipeId')({
  component: RecipeDetailComponent,
});

function AddToShoppingListDialog({
  open,
  onOpenChange,
  recipeId,
  recipeTitle,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recipeId: Id<'recipes'>;
  recipeTitle: string;
}) {
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

function RecipeDetailComponent() {
  const { recipeId } = Route.useParams();
  const { data: recipe } = useSuspenseQuery(
    convexQuery(api.recipes.getById, {
      id: recipeId as Id<'recipes'>,
    }),
  );
  const { mutateAsync: deleteRecipe } = useMutation({
    mutationFn: useConvexMutation(api.recipes.remove),
  });
  const navigate = useNavigate();
  const [shoppingListDialogOpen, setShoppingListDialogOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this recipe?')) {
      return;
    }

    try {
      await deleteRecipe({ id: recipeId as Id<'recipes'> });
      toast.success('Recipe deleted', {
        description: 'The recipe has been deleted successfully.',
      });
      navigate({ to: '/recipes' });
    } catch (error) {
      toast.error('Error', {
        description: error instanceof Error ? error.message : 'An unknown error occurred',
      });
    }
  };

  const totalTime = (recipe.prepTime || 0) + (recipe.cookingTime || 0);

  return (
    <>
      <div className="space-y-6">
        {/* Back button */}
        <Button variant="ghost" asChild>
          <Link to="/recipes">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Recipes
          </Link>
        </Button>

        {/* Hero section */}
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            {recipe.imageUrl && (
              <img src={recipe.imageUrl} alt={recipe.title} className="w-full h-96 object-cover rounded-lg" />
            )}

            <div>
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <h1 className="text-4xl font-bold tracking-tight mb-2">{recipe.title}</h1>
                  <p className="text-lg text-muted-foreground">{recipe.description}</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="icon" asChild>
                    <Link to="/recipes/$recipeId/edit" params={{ recipeId }}>
                      <Pencil className="h-4 w-4" />
                    </Link>
                  </Button>
                  <Button variant="outline" size="icon" onClick={handleDelete}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {recipe.tags && recipe.tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {recipe.tags.map((tag) => (
                    <Badge key={tag} variant="secondary">
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Info sidebar */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Recipe Info</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <Clock className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Total Time</p>
                    <p className="text-sm text-muted-foreground">{totalTime} minutes</p>
                  </div>
                </div>
                <Separator />
                {recipe.prepTime !== undefined && (
                  <>
                    <div className="flex items-center gap-3">
                      <ChefHat className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">Prep Time</p>
                        <p className="text-sm text-muted-foreground">{recipe.prepTime} minutes</p>
                      </div>
                    </div>
                    <Separator />
                  </>
                )}
                {recipe.cookingTime !== undefined && (
                  <>
                    <div className="flex items-center gap-3">
                      <Clock className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">Cook Time</p>
                        <p className="text-sm text-muted-foreground">{recipe.cookingTime} minutes</p>
                      </div>
                    </div>
                    <Separator />
                  </>
                )}
                {recipe.servings !== undefined && (
                  <div className="flex items-center gap-3">
                    <Users className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Servings</p>
                      <p className="text-sm text-muted-foreground">{recipe.servings} people</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Button className="w-full" onClick={() => setShoppingListDialogOpen(true)}>
              <ShoppingCart className="mr-2 h-4 w-4" />
              Add to Shopping List
            </Button>

            {recipe.history && recipe.history.length > 0 && (
              <Button variant="outline" className="w-full" onClick={() => setHistoryOpen(!historyOpen)}>
                <History className="mr-2 h-4 w-4" />
                View History ({recipe.history.length})
              </Button>
            )}
          </div>
        </div>

        {/* Ingredients */}
        <Card>
          <CardHeader>
            <CardTitle>Ingredients</CardTitle>
          </CardHeader>
          <CardContent>
            {!recipe.ingredients || recipe.ingredients.length === 0 ? (
              <p className="text-muted-foreground">No ingredients added yet</p>
            ) : (
              <ul className="space-y-2">
                {recipe.ingredients.map((ri) => (
                  <li key={ri._id} className="flex items-center gap-2">
                    {ri.ingredient?.emoji && <span className="text-lg">{ri.ingredient.emoji}</span>}
                    <span className="font-medium">
                      {ri.quantity} {ri.unit}
                    </span>
                    <span>{ri.ingredient?.name}</span>
                    {ri.notes && <span className="text-muted-foreground text-sm">({ri.notes})</span>}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Instructions */}
        <Card>
          <CardHeader>
            <CardTitle>Instructions</CardTitle>
          </CardHeader>
          <CardContent>
            {!recipe.instructions || recipe.instructions.trim().length === 0 ? (
              <p className="text-muted-foreground">No instructions added yet</p>
            ) : (
              <ol className="space-y-4">
                {recipe.instructions
                  .split('\n')
                  .filter((line) => line.trim().length > 0)
                  .map((instruction, index) => (
                    // biome-ignore lint/suspicious/noArrayIndexKey: index is the correct key
                    <li key={index} className="flex gap-4">
                      <div className="shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground font-semibold">
                        {index + 1}
                      </div>
                      <p className="flex-1 pt-1">{instruction.trim()}</p>
                    </li>
                  ))}
              </ol>
            )}
          </CardContent>
        </Card>

        {/* History */}
        {historyOpen && recipe.history && recipe.history.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Recipe History</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recipe.history.map((entry) => (
                  <div key={entry.timestamp} className="border-l-2 border-muted pl-4">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant={entry.aiPrompt ? 'default' : 'secondary'}>{entry.type.replace(/_/g, ' ')}</Badge>
                      {entry.aiPrompt && <Badge variant="outline">AI Generated</Badge>}
                    </div>
                    <p className="text-sm text-muted-foreground">{new Date(entry.timestamp).toLocaleString()}</p>
                    {entry.aiPrompt && (
                      <p className="text-sm mt-1">
                        <span className="font-medium">Prompt:</span> {entry.aiPrompt}
                      </p>
                    )}
                    {entry.changes && Object.keys(entry.changes).length > 0 && (
                      <p className="text-sm mt-1 text-muted-foreground">
                        Changed: {Object.keys(entry.changes).join(', ')}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <AddToShoppingListDialog
        open={shoppingListDialogOpen}
        onOpenChange={setShoppingListDialogOpen}
        recipeId={recipeId as Id<'recipes'>}
        recipeTitle={recipe.title}
      />
    </>
  );
}
