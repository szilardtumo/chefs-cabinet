import { api } from '@convex/_generated/api';
import type { Doc, Id } from '@convex/_generated/dataModel';
import { convexQuery, useConvexAction, useConvexMutation } from '@convex-dev/react-query';
import { useForm } from '@tanstack/react-form';
import { useMutation, useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { GripVertical, Plus, Sparkles, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FieldFileUpload, FieldInput, FieldTagsInput, FieldTextarea } from '@/components/ui/form-fields';
import { Input } from '@/components/ui/input';
import { Item, ItemActions, ItemContent, ItemMedia } from '@/components/ui/item';
import { Separator } from '@/components/ui/separator';
import { Sortable, SortableContent, SortableItem, SortableItemHandle } from '@/components/ui/sortable';
import { Spinner } from '@/components/ui/spinner';
import { useStorageUpload } from '@/hooks/use-storage-upload';
import { generateId } from '@/lib/id';

// Helper function to convert image URL to File object
async function urlToFile(url: string, filename: string): Promise<File> {
  const response = await fetch(url);
  const blob = await response.blob();
  return new File([blob], filename, { type: blob.type });
}

const recipeSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string(),
  prepTime: z.number().min(1, 'Prep time must be a positive number').or(z.undefined()),
  cookingTime: z.number().min(1, 'Cooking time must be a positive number').or(z.undefined()),
  servings: z.number().int().min(1, 'Servings must be a positive integer').or(z.undefined()),
  imageFiles: z.array(z.instanceof(File)).max(1, 'Only one image is allowed'),
  tags: z.array(z.string()),
  ingredients: z.array(
    z.object({
      ingredientId: z.string(),
      quantity: z.number(),
      unit: z.string(),
      notes: z.string(),
    }),
  ),
  instructions: z.array(
    z.object({
      id: z.string(),
      text: z.string(),
    }),
  ),
});

type RecipeFormProps = {
  mode: 'create' | 'edit';
  recipeId?: Id<'recipes'>;
  initialValues?: Partial<Doc<'recipes'>>;
  onSuccess?: (recipeId: Id<'recipes'>) => void;
  onCancel?: () => void;
};

export function RecipeForm({ mode, recipeId, initialValues, onSuccess, onCancel }: RecipeFormProps) {
  const { data: ingredients } = useSuspenseQuery(convexQuery(api.ingredients.getAll, {}));

  const { mutateAsync: createRecipe } = useMutation({
    mutationFn: useConvexMutation(api.recipes.create),
  });
  const { mutateAsync: updateRecipe } = useMutation({
    mutationFn: useConvexMutation(api.recipes.update),
  });

  const { uploadFile } = useStorageUpload();

  const generateDescriptionMutation = useMutation({
    mutationFn: useConvexAction(api.recipesAi.generateRecipeDescription),
  });
  const enhanceDescriptionMutation = useMutation({
    mutationFn: useConvexAction(api.recipesAi.enhanceRecipeDescription),
  });
  const customizeDescriptionMutation = useMutation({
    mutationFn: useConvexAction(api.recipesAi.customizeRecipeDescription),
  });

  const [customPrompt, setCustomPrompt] = useState('');

  const { data: initialImageFiles = [] } = useQuery({
    queryKey: ['initialImageFile', initialValues?.image],
    queryFn: async () => {
      if (initialValues?.image) {
        return [await urlToFile(initialValues.image, 'Existing Image')];
      }
      return [];
    },
  });

  // Initialize form with default or existing values
  const form = useForm({
    defaultValues: {
      title: initialValues?.title ?? '',
      description: initialValues?.description ?? '',
      prepTime: initialValues?.prepTime,
      cookingTime: initialValues?.cookingTime,
      servings: initialValues?.servings,
      tags: initialValues?.tags ?? [],
      imageFiles: initialImageFiles,
      ingredients: [] as z.infer<typeof recipeSchema>['ingredients'], // TODO: Add initial ingredients
      instructions:
        initialValues?.instructions?.map((text) => ({
          id: generateId(),
          text,
        })) ?? [],
    },
    validators: {
      onChange: recipeSchema,
    },
    onSubmit: async ({ value }) => {
      try {
        // Upload image if present
        const imageFiles = form.getFieldValue('imageFiles');
        let imageId: Id<'_storage'> | undefined = initialValues?.image;

        if (imageFiles.length > 0) {
          // Check if it's a new file by comparing file name and size
          // The converted file will have a different name than the original
          const currentFile = imageFiles[0];
          const isNewFile =
            !initialImageFiles[0] ||
            currentFile.name !== initialImageFiles[0].name ||
            currentFile.size !== initialImageFiles[0].size ||
            currentFile.lastModified !== initialImageFiles[0].lastModified;

          if (isNewFile) {
            // New image uploaded
            imageId = await uploadFile(currentFile);
          }
          // If it's the same file as initial, keep the existing imageId
        } else if (mode === 'edit' && initialValues?.image) {
          // User removed the image in edit mode
          imageId = undefined;
        }

        const data = {
          title: value.title,
          description: value.description,
          image: imageId,
          prepTime: value.prepTime,
          cookingTime: value.cookingTime,
          servings: value.servings,
          instructions: value.instructions.map((instruction) => instruction.text),
          tags: value.tags,
        };

        if (mode === 'create') {
          const newRecipeId = await createRecipe(data);

          toast.success('Recipe created', {
            description: 'Your recipe has been created successfully.',
          });

          onSuccess?.(newRecipeId);
        } else {
          if (!recipeId) {
            throw new Error('Recipe ID is required for edit mode');
          }

          await updateRecipe({ id: recipeId, ...data });

          toast.success('Recipe updated', {
            description: 'Your recipe has been updated successfully.',
          });

          onSuccess?.(recipeId);
        }
      } catch (error) {
        toast.error('Error', {
          description: error instanceof Error ? error.message : 'An unknown error occurred',
        });
      }
    },
  });

  const handleGenerateDescription = async () => {
    const title = form.getFieldValue('title');
    if (!title) {
      toast.error('Missing title', {
        description: 'Please enter a recipe title first',
      });
      return;
    }

    try {
      const ingredientNames = form
        .getFieldValue('ingredients')
        .filter((ri) => ri.ingredientId)
        .map((ri) => {
          const ing = ingredients?.find((i) => i._id === ri.ingredientId);
          return ing?.name || '';
        })
        .filter(Boolean);

      const result = await generateDescriptionMutation.mutateAsync({
        title,
        ingredients: ingredientNames,
        cookingTime: form.getFieldValue('cookingTime'),
        prepTime: form.getFieldValue('prepTime'),
      });

      form.setFieldValue('description', result || '');
      toast.success('Description generated', {
        description: 'AI has generated a recipe description for you.',
      });
    } catch (error) {
      toast.error('Error', {
        description: error instanceof Error ? error.message : 'An unknown error occurred',
      });
    }
  };

  const handleEnhanceDescription = async () => {
    const description = form.getFieldValue('description');
    if (!description) {
      toast.error('Missing description', {
        description: 'Please enter a description first',
      });
      return;
    }

    try {
      const result = await enhanceDescriptionMutation.mutateAsync({
        currentDescription: description,
        title: form.getFieldValue('title'),
      });

      form.setFieldValue('description', result || '');
      toast.success('Description enhanced', {
        description: 'AI has improved your recipe description.',
      });
    } catch (error) {
      toast.error('Error', {
        description: error instanceof Error ? error.message : 'An unknown error occurred',
      });
    }
  };

  const handleCustomizeDescription = async () => {
    const description = form.getFieldValue('description');
    if (!description || !customPrompt) {
      toast.error('Missing information', {
        description: 'Please enter both a description and custom prompt',
      });
      return;
    }

    try {
      const result = await customizeDescriptionMutation.mutateAsync({
        currentDescription: description,
        customPrompt,
        title: form.getFieldValue('title'),
      });

      form.setFieldValue('description', result || '');
      setCustomPrompt('');
      toast.success('Description customized', {
        description: 'AI has modified your recipe description.',
      });
    } catch (error) {
      toast.error('Error', {
        description: error instanceof Error ? error.message : 'An unknown error occurred',
      });
    }
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        form.handleSubmit();
      }}
      className="space-y-6 max-w-4xl"
    >
      {/* Basic Info */}
      <Card>
        <CardHeader>
          <CardTitle>Basic Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form.Field name="title">
            {(field) => <FieldInput field={field} label="Recipe Title" placeholder="e.g., Spaghetti Carbonara" />}
          </form.Field>

          <div className="grid grid-cols-3 gap-4">
            <form.Field name="prepTime">
              {(field) => <FieldInput field={field} label="Prep Time (min)" type="number" />}
            </form.Field>

            <form.Field name="cookingTime">
              {(field) => <FieldInput field={field} label="Cook Time (min)" type="number" />}
            </form.Field>

            <form.Field name="servings">
              {(field) => <FieldInput field={field} label="Servings" type="number" />}
            </form.Field>
          </div>

          <form.Field name="imageFiles">
            {(field) => (
              <FieldFileUpload
                field={field}
                label="Recipe Image"
                accept="image/*"
                maxFiles={1}
                maxSize={10 * 1024 * 1024}
              />
            )}
          </form.Field>

          <form.Field name="tags">
            {(field) => <FieldTagsInput field={field} label="Tags" placeholder="Add a tag..." withAddButton />}
          </form.Field>
        </CardContent>
      </Card>

      {/* AI Description */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            AI-Powered Description
            <Sparkles className="size-4" />
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form.Field name="description">
            {(field) => (
              <FieldTextarea field={field} label="Description" placeholder="Describe your recipe..." rows={4} />
            )}
          </form.Field>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleGenerateDescription}
              disabled={generateDescriptionMutation.isPending}
            >
              {generateDescriptionMutation.isPending ? <Spinner /> : <Sparkles />}
              Generate with AI
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleEnhanceDescription}
              disabled={enhanceDescriptionMutation.isPending}
            >
              {enhanceDescriptionMutation.isPending ? <Spinner /> : <Sparkles />}
              Enhance
            </Button>
          </div>

          <Separator />

          <div>
            <label
              htmlFor="customPrompt"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Custom AI Modification
            </label>
            <div className="flex gap-2 mt-2">
              <Input
                id="customPrompt"
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder="e.g., Make it kid-friendly, add more details..."
              />
              <Button
                type="button"
                onClick={handleCustomizeDescription}
                disabled={customizeDescriptionMutation.isPending || !customPrompt}
              >
                {customizeDescriptionMutation.isPending ? <Spinner /> : 'Apply'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>Instructions</CardTitle>
        </CardHeader>
        <CardContent>
          <form.Field name="instructions" mode="array">
            {(field) => {
              const instructions = field.state.value;

              return (
                <div className="space-y-4">
                  <Sortable
                    value={instructions}
                    onMove={(e) => field.moveValue(e.activeIndex, e.overIndex)}
                    getItemValue={(item) => item.id}
                    orientation="vertical"
                  >
                    <SortableContent className="space-y-2">
                      {instructions.map((instruction, index) => (
                        <SortableItem key={instruction.id} value={instruction.id}>
                          <Item variant="outline" size="sm" className="items-start">
                            <ItemMedia>
                              <SortableItemHandle asChild>
                                <Button variant="ghost" size="icon">
                                  <GripVertical />
                                </Button>
                              </SortableItemHandle>
                            </ItemMedia>
                            <ItemContent>
                              <form.Field name={`instructions[${index}].text`}>
                                {(field) => (
                                  <FieldTextarea field={field} placeholder={`Step ${index + 1}...`} rows={3} />
                                )}
                              </form.Field>
                            </ItemContent>
                            <ItemActions>
                              <Button variant="ghost" size="icon" onClick={() => field.removeValue(index)}>
                                <Trash2 />
                              </Button>
                            </ItemActions>
                          </Item>
                        </SortableItem>
                      ))}
                    </SortableContent>
                  </Sortable>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => field.pushValue({ id: generateId(), text: '' })}
                    className="w-full"
                  >
                    <Plus />
                    Add Instruction
                  </Button>
                </div>
              );
            }}
          </form.Field>
        </CardContent>
      </Card>

      {/* Submit */}
      <div className="flex gap-2 justify-end">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={form.state.isSubmitting}>
          {form.state.isSubmitting ? (
            <>
              <Spinner />
              {mode === 'create' ? 'Creating...' : 'Updating...'}
            </>
          ) : mode === 'create' ? (
            'Create Recipe'
          ) : (
            'Update Recipe'
          )}
        </Button>
      </div>
    </form>
  );
}
