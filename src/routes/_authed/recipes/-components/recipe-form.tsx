import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import { convexQuery, useConvexAction } from '@convex-dev/react-query';
import { useForm } from '@tanstack/react-form';
import { useMutation, useQuery, useSuspenseQuery } from '@tanstack/react-query';
import type { FunctionReturnType } from 'convex/server';
import { ChevronDown, ChevronUp, Edit, GripVertical, Plus, Repeat2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { CategoryTag } from '@/components/category-tag';
import { IngredientCombobox } from '@/components/ingredient-combobox';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FieldImage, FieldInput, FieldTagsInput, FieldTextarea } from '@/components/ui/form-fields';
import { Item, ItemActions, ItemContent, ItemDescription, ItemTitle } from '@/components/ui/item';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Sortable, SortableContent, SortableItem, SortableItemHandle } from '@/components/ui/sortable';
import { Spinner } from '@/components/ui/spinner';
import { useStorageUpload } from '@/hooks/use-storage-upload';
import { generateId } from '@/lib/id';
import { isStorageId } from '@/lib/storage';
import { RecipeAiRevisePanel } from './recipe-ai-revise';
import {
  mapMatchedRecipeToFormValues,
  recipeFormSchema,
  serializeFormToRecipeInput,
  serializeFormToRecipeSnapshot,
  toFormIngredientGroups,
  toFormInstructionGroups,
} from './recipe-form-model';

// Helper function to convert image URL to File object
async function urlToFile(url: string, filename: string): Promise<File> {
  const response = await fetch(url);
  const blob = await response.blob();
  return new File([blob], filename, { type: blob.type });
}

type RecipeFormProps = {
  mode: 'create' | 'edit';
  recipeId?: Id<'recipes'>;
  initialValues?: Partial<FunctionReturnType<typeof api.recipes.getById>>;
  onSuccess?: (recipeId: Id<'recipes'>) => void;
  onCancel?: () => void;
};

export function RecipeForm({ mode, recipeId, initialValues, onSuccess, onCancel }: RecipeFormProps) {
  const { data: ingredients } = useSuspenseQuery(convexQuery(api.ingredients.getAll, {}));

  const { mutateAsync: createRecipe } = useMutation({
    mutationFn: useConvexAction(api.recipes.create),
  });
  const { mutateAsync: updateRecipe } = useMutation({
    mutationFn: useConvexAction(api.recipes.update),
  });

  const { uploadFile } = useStorageUpload();

  const { data: initialImageFiles = [] } = useQuery({
    queryKey: ['initialImageFile', initialValues?.image],
    queryFn: async () => {
      if (isStorageId(initialValues?.image) && initialValues?.imageUrl) {
        return [await urlToFile(initialValues.imageUrl, 'Existing Image')];
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
      source: initialValues?.source,
      imageFiles: initialImageFiles,
      imageUrl: isStorageId(initialValues?.image) ? undefined : initialValues?.image,
      aiPrompt: undefined as string | undefined,
      ingredientGroups: toFormIngredientGroups(initialValues?.ingredientGroups),
      instructions: toFormInstructionGroups(initialValues?.instructions),
    },
    validators: {
      onChange: recipeFormSchema,
    },
    onSubmit: async ({ value }) => {
      try {
        const imageFiles = form.getFieldValue('imageFiles');
        const imageUrl = form.getFieldValue('imageUrl');

        let image: Id<'_storage'> | string | null = null;

        if (imageUrl) {
          image = imageUrl;
        } else if (imageFiles.length > 0) {
          const currentFile = imageFiles[0];
          const isNewFile =
            !initialImageFiles[0] ||
            currentFile.name !== initialImageFiles[0].name ||
            currentFile.size !== initialImageFiles[0].size ||
            currentFile.lastModified !== initialImageFiles[0].lastModified;

          if (isNewFile) {
            image = await uploadFile(currentFile);
          } else if (isStorageId(initialValues?.image)) {
            image = initialValues?.image;
          }
        }

        const data = serializeFormToRecipeInput(value, image);

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

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        form.handleSubmit();
      }}
      className="space-y-6 max-w-4xl"
    >
      {mode === 'edit' && (
        <RecipeAiRevisePanel
          getCurrentRecipe={() => serializeFormToRecipeSnapshot(form.state.values, ingredients ?? [])}
          onRevisionApplied={(revisedRecipe, revisionLog) => {
            const { imageFiles, imageUrl, source } = form.state.values;
            form.reset({
              ...mapMatchedRecipeToFormValues(revisedRecipe, { imageFiles, imageUrl, source }),
              aiPrompt: revisionLog,
            });
          }}
        />
      )}

      {/* Basic Info */}
      <Card>
        <CardHeader>
          <CardTitle>Basic Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form.Field name="title">
            {(field) => <FieldInput field={field} label="Recipe Title" placeholder="e.g., Spaghetti Carbonara" />}
          </form.Field>

          <form.Field name="description">
            {(field) => (
              <FieldTextarea
                field={field}
                label="Description"
                placeholder="Add a short description for this recipe..."
                rows={3}
              />
            )}
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

          <form.Field
            name="imageFiles"
            listeners={{
              onChange: ({ value, fieldApi }) => value && fieldApi.form.setFieldValue('imageUrl', undefined),
            }}
          >
            {(imageFilesField) => (
              <form.Field name="imageUrl">
                {(imageUrlField) => (
                  <FieldImage
                    filesField={imageFilesField}
                    urlField={imageUrlField}
                    label="Recipe Image"
                    previewClassName="aspect-video max-h-60 rounded-lg"
                    onReset={() => {
                      form.resetField('imageFiles');
                      form.resetField('imageUrl');
                    }}
                    withUnsplash
                  />
                )}
              </form.Field>
            )}
          </form.Field>

          <form.Field name="tags">
            {(field) => <FieldTagsInput field={field} label="Tags" placeholder="Add a tag..." withAddButton />}
          </form.Field>

          <form.Field name="source">
            {(field) => (
              <FieldTextarea field={field} label="Source" rows={2} placeholder="e.g. https://example.com/recipe" />
            )}
          </form.Field>
        </CardContent>
      </Card>
      {/* Ingredients */}

      <CardTitle className="mb-4">Ingredients</CardTitle>

      <form.Field name="ingredientGroups" mode="array">
        {(groupsField) => {
          const groups = groupsField.state.value ?? [];

          return (
            <div className="space-y-6">
              {groups.map((group, gi) => {
                if (!group) return null;

                return (
                  <Card key={group.id} className="border-muted">
                    <CardHeader>
                      <CardTitle className="mr-8">
                        <form.Field name={`ingredientGroups[${gi}].title`}>
                          {(titleField) => (
                            <FieldInput field={titleField} aria-label="Section name" placeholder="Section name" />
                          )}
                        </form.Field>
                      </CardTitle>
                      <CardAction>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          disabled={gi === 0}
                          onClick={() => groupsField.moveValue(gi, gi - 1)}
                          aria-label="Move section up"
                        >
                          <ChevronUp />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          disabled={gi === groups.length - 1}
                          onClick={() => groupsField.moveValue(gi, gi + 1)}
                          aria-label="Move section down"
                        >
                          <ChevronDown />
                        </Button>
                        {groups.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => groupsField.removeValue(gi)}
                            aria-label="Remove section"
                          >
                            <Trash2 />
                          </Button>
                        )}
                      </CardAction>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <form.Field name={`ingredientGroups[${gi}].ingredients`} mode="array">
                        {(ingredientsArrayField) => {
                          const ingredientsList = ingredientsArrayField.state.value ?? [];

                          return (
                            <div className="space-y-4">
                              <Sortable
                                value={ingredientsList}
                                onMove={(e) => ingredientsArrayField.moveValue(e.activeIndex, e.overIndex)}
                                getItemValue={(item) => item.id}
                                orientation="vertical"
                              >
                                <SortableContent className="space-y-2">
                                  {ingredientsList.map((row, ii) => {
                                    if (!row) return null;

                                    return (
                                      <form.Field key={row.id} name={`ingredientGroups[${gi}].ingredients[${ii}]`}>
                                        {(itemField) => {
                                          const item = itemField.state.value ?? row;
                                          if (!item) return null;

                                          const isNew = item.newIngredientName;
                                          const ingredient = item.ingredientId
                                            ? ingredients?.find((ing) => ing._id === item.ingredientId)
                                            : item.newIngredientName
                                              ? {
                                                  emoji: undefined,
                                                  name: item.newIngredientName,
                                                  category: undefined,
                                                }
                                              : undefined;

                                          return (
                                            <SortableItem value={row.id}>
                                              <Item
                                                variant="outline"
                                                size="sm"
                                                className="items-start flex-nowrap overflow-x-auto pr-3"
                                              >
                                                <ItemContent>
                                                  <ItemTitle className="w-full flex-col items-start sm:flex-row sm:items-center">
                                                    {ingredient ? (
                                                      <div className="flex-12 flex items-center gap-2">
                                                        {isNew ? (
                                                          <Badge size="sm">New</Badge>
                                                        ) : (
                                                          <span>{ingredient.emoji}</span>
                                                        )}
                                                        {ingredient.name}
                                                        {ingredient.category && (
                                                          <CategoryTag category={ingredient.category} />
                                                        )}
                                                      </div>
                                                    ) : (
                                                      <IngredientCombobox
                                                        className="flex-12 w-full"
                                                        placeholder="Select ingredient..."
                                                        selectedItems={[]}
                                                        onSelect={async (ingredientId) => {
                                                          ingredientsArrayField.replaceValue(ii, {
                                                            ...item,
                                                            ingredientId,
                                                            unit: ingredients?.find((ing) => ing._id === ingredientId)
                                                              ?.defaultUnit,
                                                          });
                                                        }}
                                                        onCreate={async (ingredientName) => {
                                                          ingredientsArrayField.replaceValue(ii, {
                                                            ...item,
                                                            newIngredientName: ingredientName,
                                                          });
                                                        }}
                                                      />
                                                    )}
                                                    <div className="grid grid-cols-2 gap-2 min-w-44 w-full flex-1">
                                                      <form.Field
                                                        name={`ingredientGroups[${gi}].ingredients[${ii}].quantity`}
                                                      >
                                                        {(field) => (
                                                          <FieldInput field={field} type="number" placeholder="0" />
                                                        )}
                                                      </form.Field>
                                                      <form.Field
                                                        name={`ingredientGroups[${gi}].ingredients[${ii}].unit`}
                                                      >
                                                        {(field) => (
                                                          <FieldInput field={field} placeholder="g, tsp..." />
                                                        )}
                                                      </form.Field>
                                                    </div>
                                                  </ItemTitle>
                                                  <ItemDescription className="overflow-visible">
                                                    <form.Field
                                                      name={`ingredientGroups[${gi}].ingredients[${ii}].notes`}
                                                    >
                                                      {(field) => (
                                                        <Popover>
                                                          <PopoverTrigger className="p-1 flex items-center gap-2 hover:underline">
                                                            <span className="line-clamp-1 text-left">
                                                              {field.state.value || 'Click to add notes...'}
                                                            </span>
                                                            <Edit className="size-4 shrink-0" />
                                                          </PopoverTrigger>
                                                          <PopoverContent side="top" align="start">
                                                            <FieldInput
                                                              field={field}
                                                              label="Edit Notes"
                                                              placeholder="e.g., large, fresh..."
                                                              onKeyDown={(e) => {
                                                                if (e.key === 'Enter') {
                                                                  e.preventDefault();
                                                                  document.dispatchEvent(
                                                                    new KeyboardEvent('keydown', {
                                                                      key: 'Escape',
                                                                    }),
                                                                  );
                                                                }
                                                              }}
                                                            />
                                                          </PopoverContent>
                                                        </Popover>
                                                      )}
                                                    </form.Field>
                                                  </ItemDescription>
                                                </ItemContent>
                                                <ItemActions className="flex-col-reverse sm:flex-row gap-0">
                                                  <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    disabled={!ingredient}
                                                    onClick={() =>
                                                      ingredientsArrayField.replaceValue(ii, { id: item.id })
                                                    }
                                                  >
                                                    <Repeat2 />
                                                  </Button>
                                                  <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => ingredientsArrayField.removeValue(ii)}
                                                  >
                                                    <Trash2 />
                                                  </Button>
                                                  <SortableItemHandle asChild>
                                                    <Button type="button" variant="ghost" size="icon">
                                                      <GripVertical />
                                                    </Button>
                                                  </SortableItemHandle>
                                                </ItemActions>
                                              </Item>
                                            </SortableItem>
                                          );
                                        }}
                                      </form.Field>
                                    );
                                  })}
                                </SortableContent>
                              </Sortable>

                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => ingredientsArrayField.pushValue({ id: generateId() })}
                                className="w-full"
                              >
                                <Plus />
                                Add ingredient to this section
                              </Button>
                            </div>
                          );
                        }}
                      </form.Field>
                    </CardContent>
                  </Card>
                );
              })}

              <Button
                type="button"
                variant="outline"
                onClick={() => groupsField.pushValue({ id: generateId(), title: '', ingredients: [] })}
                className="w-full"
              >
                <Plus />
                Add section
              </Button>
            </div>
          );
        }}
      </form.Field>

      <CardTitle className="mb-4">Instructions</CardTitle>
      <form.Field name="instructions" mode="array">
        {(instructionsField) => {
          const instructions = instructionsField.state.value;

          return (
            <div className="space-y-6">
              {instructions.map((group, gi) => (
                <Card key={group.id} className="border-muted">
                  <CardHeader>
                    <CardTitle className="mr-8">
                      <form.Field name={`instructions[${gi}].title`}>
                        {(titleField) => (
                          <FieldInput field={titleField} aria-label="Section name" placeholder="Section name" />
                        )}
                      </form.Field>
                    </CardTitle>
                    <CardAction>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        disabled={gi === 0}
                        onClick={() => instructionsField.moveValue(gi, gi - 1)}
                        aria-label="Move section up"
                      >
                        <ChevronUp />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        disabled={gi === instructions.length - 1}
                        onClick={() => instructionsField.moveValue(gi, gi + 1)}
                        aria-label="Move section down"
                      >
                        <ChevronDown />
                      </Button>
                      {instructions.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => instructionsField.removeValue(gi)}
                          aria-label="Remove section"
                        >
                          <Trash2 />
                        </Button>
                      )}
                    </CardAction>
                  </CardHeader>
                  <CardContent>
                    <form.Field name={`instructions[${gi}].steps`} mode="array">
                      {(stepsField) => {
                        const steps = stepsField.state.value ?? [];

                        return (
                          <div className="space-y-4">
                            <Sortable
                              value={steps}
                              onMove={(e) => stepsField.moveValue(e.activeIndex, e.overIndex)}
                              getItemValue={(item) => item.id}
                              orientation="vertical"
                            >
                              <SortableContent className="space-y-2">
                                {steps.map((step, si) => (
                                  <SortableItem key={step.id} value={step.id}>
                                    <Item variant="outline" size="sm" className="items-start pr-3">
                                      <ItemContent>
                                        <form.Field name={`instructions[${gi}].steps[${si}].text`}>
                                          {(textField) => (
                                            <FieldTextarea
                                              field={textField}
                                              placeholder={`Step ${si + 1}...`}
                                              rows={3}
                                            />
                                          )}
                                        </form.Field>
                                      </ItemContent>
                                      <ItemActions className="flex-col gap-0">
                                        <SortableItemHandle asChild>
                                          <Button type="button" variant="ghost" size="icon">
                                            <GripVertical />
                                          </Button>
                                        </SortableItemHandle>
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="icon"
                                          onClick={() => stepsField.removeValue(si)}
                                        >
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
                              onClick={() => stepsField.pushValue({ id: generateId(), text: '' })}
                              className="w-full"
                            >
                              <Plus />
                              Add step to this section
                            </Button>
                          </div>
                        );
                      }}
                    </form.Field>
                  </CardContent>
                </Card>
              ))}

              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  instructionsField.pushValue({
                    id: generateId(),
                    title: '',
                    steps: [],
                  })
                }
                className="w-full"
              >
                <Plus />
                Add section
              </Button>
            </div>
          );
        }}
      </form.Field>

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
