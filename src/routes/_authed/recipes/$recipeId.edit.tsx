import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import { convexQuery } from '@convex-dev/react-query';
import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { RecipeForm } from './-components/recipe-form';

export const Route = createFileRoute('/_authed/recipes/$recipeId/edit')({
  component: EditRecipeComponent,
});

function EditRecipeComponent() {
  const { recipeId } = Route.useParams();
  const navigate = useNavigate();
  const { data: recipe } = useSuspenseQuery(convexQuery(api.recipes.getById, { id: recipeId as Id<'recipes'> }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Edit Recipe</h1>
          <p className="text-muted-foreground">Update your recipe details</p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => navigate({ to: '/recipes/$recipeId', params: { recipeId } })}
        >
          <ArrowLeft />
          Back
        </Button>
      </div>

      <RecipeForm
        mode="edit"
        recipeId={recipeId as Id<'recipes'>}
        initialValues={recipe}
        onSuccess={(id) => {
          navigate({ to: '/recipes/$recipeId', params: { recipeId: id } });
        }}
        onCancel={() => {
          navigate({ to: '/recipes/$recipeId', params: { recipeId } });
        }}
      />
    </div>
  );
}
