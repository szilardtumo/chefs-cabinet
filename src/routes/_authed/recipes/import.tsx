import { api } from '@convex/_generated/api';
import { useConvexAction } from '@convex-dev/react-query';
import { useForm } from '@tanstack/react-form';
import { useMutation } from '@tanstack/react-query';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { Sparkles } from 'lucide-react';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { FieldFileUpload, FieldTextarea } from '@/components/ui/form-fields';
import { useStorageUpload } from '@/hooks/use-storage-upload';
import { toastError } from '@/lib/toast';

const importSchema = z
  .object({
    prompt: z.string().trim().max(4000, 'Keep the request under 4000 characters'),
    photos: z.array(z.instanceof(File)).max(3, 'Add at most 3 photos'),
  })
  .refine(({ prompt, photos }) => prompt || photos.length > 0, {
    message: 'Describe the recipe or add a link or a photo',
    path: ['prompt'],
  });

export const Route = createFileRoute('/_authed/recipes/import')({
  component: ImportRecipeComponent,
  // Filled in when a page is shared to the installed app (`share_target` in site.webmanifest)
  validateSearch: z.object({
    title: z.string().optional().catch(undefined),
    text: z.string().optional().catch(undefined),
    url: z.string().optional().catch(undefined),
  }),
});

/** A request for a shared page, which the user can still edit before importing. */
function sharedPrompt({ title, text, url }: { title?: string; text?: string; url?: string }) {
  // Apps often put the shared link inside the text instead of the url field
  const link = url ?? text?.match(/https?:\/\/\S+/)?.[0];
  const sharedText = [title, link ? text?.replace(link, '') : text]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join('\n');

  if (link && sharedText) {
    return `Import the recipe from this link:\n${link}\n\nIf the page doesn't show the whole recipe, use this text that was shared with it:\n${sharedText}`;
  }
  if (link) return `Import the recipe from this link:\n${link}`;
  if (sharedText) return `Import the recipe from this text:\n${sharedText}`;
  return '';
}

function ImportRecipeComponent() {
  const navigate = useNavigate();
  const shared = Route.useSearch();
  const { uploadFile } = useStorageUpload();

  const { mutateAsync: importRecipe } = useMutation({
    mutationFn: useConvexAction(api.recipesAi.importRecipe),
  });

  const form = useForm({
    defaultValues: { prompt: sharedPrompt(shared), photos: [] as File[] },
    validators: { onSubmit: importSchema },
    onSubmit: async ({ value }) => {
      try {
        const images = await Promise.all(value.photos.map((photo) => uploadFile(photo)));
        importRecipe({ prompt: value.prompt.trim(), images }).catch(toastError);
        navigate({ to: '/recipes' });
      } catch (error) {
        toastError(error);
      }
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Import Recipe</h1>
        <p className="text-muted-foreground">Build a recipe from links, pasted text or photos</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            What should we import?
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
            className="space-y-6"
          >
            <form.Field name="prompt">
              {(field) => (
                <FieldTextarea
                  field={field}
                  label="Request"
                  rows={8}
                  placeholder={
                    'https://example.com/lasagna\n\nOr: Combine these two. Take the sauce from https://… and the pasta dough from https://…, and make it for 2 people.'
                  }
                  description="Paste links (YouTube works too), recipe text, or describe what you want. You can ask to combine or change recipes."
                />
              )}
            </form.Field>

            <form.Field name="photos">
              {(field) => (
                <FieldFileUpload
                  field={field}
                  label="Photos"
                  description="Cookbook pages, recipe cards or screenshots. Up to 3."
                  accept="image/*"
                  multiple
                  maxFiles={3}
                  maxSize={10 * 1024 * 1024}
                />
              )}
            </form.Field>
          </form>
        </CardContent>
        <CardFooter className="justify-end">
          <form.Subscribe selector={(state) => state.isSubmitting}>
            {(isSubmitting) => (
              <Button type="submit" form="import-recipe-form" disabled={isSubmitting}>
                <Sparkles />
                {isSubmitting ? 'Starting import…' : 'Import with AI'}
              </Button>
            )}
          </form.Subscribe>
        </CardFooter>
      </Card>
    </div>
  );
}
