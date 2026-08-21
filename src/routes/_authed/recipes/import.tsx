import { api } from '@convex/_generated/api';
import { useConvexAction } from '@convex-dev/react-query';
import { useForm } from '@tanstack/react-form';
import { useMutation } from '@tanstack/react-query';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { FieldInput, FieldTextarea } from '@/components/ui/form-fields';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const importSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('url'),
    url: z.url({ normalize: true }).trim(),
  }),
  z.object({
    type: z.literal('text'),
    text: z.string().trim().min(1, 'Text is required'),
  }),
]);

export const Route = createFileRoute('/_authed/recipes/import')({
  component: ImportRecipeComponent,
});

function ImportRecipeComponent() {
  const navigate = useNavigate();

  const importRecipeMutation = useMutation({
    mutationFn: useConvexAction(api.recipesAi.importRecipeFromSource),
  });

  const form = useForm({
    defaultValues: {
      type: 'url',
      url: '',
      text: '',
    } as z.infer<typeof importSchema>,
    validators: {
      onBlur: importSchema,
    },
    onSubmit: ({ value }) => {
      const source = value.type === 'url' ? value.url : value.text;

      const importPromise = importRecipeMutation.mutateAsync({
        [value.type]: source,
      });

      toast.promise(importPromise, {
        loading: 'Importing recipe…',
        description: 'You can keep browsing or close this window. The recipe will be available once parsing finishes.',
        success: (recipeId) => ({
          message: 'Recipe imported',
          description: 'Your recipe has been created.',
          action: {
            label: 'View recipe',
            onClick: () => {
              navigate({ to: '/recipes/$recipeId', params: { recipeId } });
            },
          },
        }),
        error: (error) => ({
          message: 'Import failed',
          description: error instanceof Error ? error.message : 'Failed to import recipe. Please try again.',
        }),
      });

      navigate({ to: '/recipes' });
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Import Recipe</h1>
        <p className="text-muted-foreground">Import a recipe from a URL or paste raw text</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Recipe Source
            <Sparkles className="size-4" />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form
            id="import-recipe-form"
            onSubmit={(e) => {
              e.preventDefault();
              e.stopPropagation();
              form.handleSubmit();
            }}
            className="space-y-4"
          >
            <form.Field name="type">
              {(field) => (
                <Tabs
                  value={field.state.value}
                  onValueChange={(value) => field.handleChange(value as 'url' | 'text')}
                  className="space-y-4"
                >
                  <TabsList className="w-full grid grid-cols-2">
                    <TabsTrigger value="url">URL</TabsTrigger>
                    <TabsTrigger value="text">Text</TabsTrigger>
                  </TabsList>

                  <TabsContent value="url">
                    <form.Field name="url">
                      {(field) => (
                        <FieldInput
                          field={field}
                          label="Recipe URL"
                          type="url"
                          formNoValidate
                          placeholder="https://example.com/recipe or https://youtube.com/watch?v=..."
                          description="Paste any recipe URL or YouTube video link. The AI will extract the recipe information."
                        />
                      )}
                    </form.Field>
                  </TabsContent>

                  <TabsContent value="text">
                    <form.Field name="text">
                      {(field) => (
                        <FieldTextarea
                          field={field}
                          label="Recipe Text"
                          placeholder="Paste your recipe text here..."
                          rows={10}
                          className="font-mono text-sm"
                          description="Paste raw recipe text. The AI will parse and structure it for you."
                        />
                      )}
                    </form.Field>
                  </TabsContent>
                </Tabs>
              )}
            </form.Field>
          </form>
        </CardContent>
        <CardFooter className="justify-end">
          <Button type="submit" form="import-recipe-form" disabled={!form.state.canSubmit}>
            <Sparkles />
            Import with AI
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
