import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { RecipeForm } from './-components/recipe-form';

export const Route = createFileRoute('/_authed/recipes/new')({
  component: RecipeFormComponent,
});

function RecipeFormComponent() {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Create Recipe</h1>
        <p className="text-muted-foreground">Add a new recipe to your collection</p>
      </div>

      <RecipeForm
        mode="create"
        onSuccess={(recipeId) => {
          navigate({ to: '/recipes/$recipeId', params: { recipeId } });
        }}
        onCancel={() => {
          navigate({ to: '/recipes' });
        }}
      />
    </div>
  );
}
