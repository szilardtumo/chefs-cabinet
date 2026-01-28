import { createFileRoute, useNavigate, useRouterState } from '@tanstack/react-router';
import type { ComponentProps } from 'react';
import { RecipeForm } from './-components/recipe-form';

export const Route = createFileRoute('/_authed/recipes/new')({
  component: RecipeFormComponent,
});

declare module '@tanstack/react-router' {
  interface HistoryState {
    importedRecipe?: ComponentProps<typeof RecipeForm>['initialValues'];
  }
}

function RecipeFormComponent() {
  const navigate = useNavigate();
  const parsedRecipe = useRouterState({ select: (state) => state.location.state.importedRecipe });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Create Recipe</h1>
        <p className="text-muted-foreground">Add a new recipe to your collection</p>
      </div>

      <RecipeForm
        mode="create"
        initialValues={parsedRecipe}
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
