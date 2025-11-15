import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import { convexQuery, useConvexMutation } from '@convex-dev/react-query';
import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useForm } from '@tanstack/react-form';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useAction } from 'convex/react';
import { GripVertical, Loader2, Plus, Sparkles, Trash2, Upload, X } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { z } from 'zod';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';

export const Route = createFileRoute('/_authed/recipes/new')({
  component: RecipeFormComponent,
});

const recipeSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().min(1, 'Description is required'),
  prepTime: z.number().min(1, 'Prep time must be at least 1 minute'),
  cookingTime: z.number().min(1, 'Cooking time must be at least 1 minute'),
  servings: z.number().min(1, 'Servings must be at least 1'),
});

type Ingredient = {
  id: string;
  ingredientId: string;
  quantity: number;
  unit: string;
  notes?: string;
  availableIngredients?: Array<{
    _id: Id<'ingredients'>;
    name: string;
    emoji?: string;
  }>;
};

type Instruction = {
  id: string;
  text: string;
};

function SortableIngredientRow({
  ingredient,
  onUpdate,
  onRemove,
}: {
  ingredient: Ingredient;
  onUpdate: (updated: Ingredient) => void;
  onRemove: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: ingredient.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-2 p-3 border rounded-lg bg-card">
      <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing">
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </button>

      <div className="flex-1 grid grid-cols-4 gap-2">
        <Select
          value={ingredient.ingredientId}
          onValueChange={(value) => onUpdate({ ...ingredient, ingredientId: value })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Ingredient" />
          </SelectTrigger>
          <SelectContent>
            {ingredient.availableIngredients?.map((ing) => (
              <SelectItem key={ing._id} value={ing._id}>
                {ing.emoji && <span className="mr-1">{ing.emoji}</span>}
                {ing.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Input
          type="number"
          placeholder="Quantity"
          value={ingredient.quantity}
          onChange={(e) => onUpdate({ ...ingredient, quantity: parseFloat(e.target.value) })}
        />

        <Input
          placeholder="Unit"
          value={ingredient.unit}
          onChange={(e) => onUpdate({ ...ingredient, unit: e.target.value })}
        />

        <Input
          placeholder="Notes (optional)"
          value={ingredient.notes || ''}
          onChange={(e) => onUpdate({ ...ingredient, notes: e.target.value })}
        />
      </div>

      <Button variant="ghost" size="icon" onClick={() => onRemove(ingredient.id)}>
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}

function SortableInstructionRow({
  instruction,
  index,
  onUpdate,
  onRemove,
}: {
  instruction: Instruction;
  index: number;
  onUpdate: (updated: Instruction) => void;
  onRemove: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: instruction.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} className="flex items-start gap-2 p-3 border rounded-lg bg-card">
      <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing mt-2">
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </button>

      <div className="shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground font-semibold mt-1">
        {index + 1}
      </div>

      <Textarea
        value={instruction.text}
        onChange={(e) => onUpdate({ ...instruction, text: e.target.value })}
        placeholder="Enter instruction..."
        rows={2}
        className="flex-1"
      />

      <Button variant="ghost" size="icon" onClick={() => onRemove(instruction.id)} className="mt-1">
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}

function RecipeFormComponent() {
  const navigate = useNavigate();
  const { data: ingredients } = useSuspenseQuery(convexQuery(api.ingredients.getAll, {}));
  const { mutateAsync: createRecipe } = useMutation({
    mutationFn: useConvexMutation(api.recipes.create),
  });
  const { mutateAsync: addRecipeIngredient } = useMutation({
    mutationFn: useConvexMutation(api.recipeIngredients.add),
  });
  const { mutateAsync: generateUploadUrl } = useMutation({
    mutationFn: useConvexMutation(api.recipes.generateUploadUrl),
  });
  const generateDescription = useAction(api.ai.generateRecipeDescription);
  const enhanceDescription = useAction(api.ai.enhanceRecipeDescription);
  const customizeDescription = useAction(api.ai.customizeRecipeDescription);

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [recipeIngredients, setRecipeIngredients] = useState<Ingredient[]>([]);
  const [instructions, setInstructions] = useState<Instruction[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [customPrompt, setCustomPrompt] = useState('');
  const [saving, setSaving] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const form = useForm({
    defaultValues: {
      title: '',
      description: '',
      prepTime: 15,
      cookingTime: 30,
      servings: 4,
    },
    validators: {
      onChange: recipeSchema,
    },
    onSubmit: async ({ value }) => {
      setSaving(true);

      try {
        // Upload image if present
        let imageId: Id<'_storage'> | undefined;
        if (imageFile) {
          const uploadUrl = await generateUploadUrl({});
          const result = await fetch(uploadUrl, {
            method: 'POST',
            body: imageFile,
          });
          const { storageId } = await result.json();
          imageId = storageId;
        }

        // Create recipe
        const recipeId = await createRecipe({
          title: value.title,
          description: value.description,
          image: imageId,
          prepTime: value.prepTime,
          cookingTime: value.cookingTime,
          servings: value.servings,
          instructions: instructions
            .map((i) => i.text)
            .filter(Boolean)
            .join('\n'),
          tags,
        });

        // Add ingredients
        for (let i = 0; i < recipeIngredients.length; i++) {
          const ri = recipeIngredients[i];
          if (ri.ingredientId && ri.quantity && ri.unit) {
            await addRecipeIngredient({
              recipeId,
              ingredientId: ri.ingredientId as Id<'ingredients'>,
              quantity: ri.quantity,
              unit: ri.unit,
              notes: ri.notes || undefined,
            });
          }
        }

        toast.success('Recipe created', {
          description: 'Your recipe has been created successfully.',
        });

        navigate({ to: '/recipes/$recipeId', params: { recipeId } });
      } catch (error) {
        toast.error('Error', {
          description: error instanceof Error ? error.message : 'An unknown error occurred',
        });
      } finally {
        setSaving(false);
      }
    },
  });

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAddTag = () => {
    if (tagInput && !tags.includes(tagInput)) {
      setTags([...tags, tagInput]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tag: string) => {
    setTags(tags.filter((t) => t !== tag));
  };

  const handleAddIngredient = () => {
    setRecipeIngredients([
      ...recipeIngredients,
      {
        id: crypto.randomUUID(),
        ingredientId: '',
        quantity: 0,
        unit: '',
        notes: '',
        availableIngredients: ingredients,
      },
    ]);
  };

  const handleUpdateIngredient = (updated: Ingredient) => {
    setRecipeIngredients(recipeIngredients.map((ing) => (ing.id === updated.id ? updated : ing)));
  };

  const handleRemoveIngredient = (id: string) => {
    setRecipeIngredients(recipeIngredients.filter((ing) => ing.id !== id));
  };

  const handleIngredientDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = recipeIngredients.findIndex((i) => i.id === active.id);
      const newIndex = recipeIngredients.findIndex((i) => i.id === over.id);
      setRecipeIngredients(arrayMove(recipeIngredients, oldIndex, newIndex));
    }
  };

  const handleAddInstruction = () => {
    setInstructions([...instructions, { id: crypto.randomUUID(), text: '' }]);
  };

  const handleUpdateInstruction = (updated: Instruction) => {
    setInstructions(instructions.map((inst) => (inst.id === updated.id ? updated : inst)));
  };

  const handleRemoveInstruction = (id: string) => {
    setInstructions(instructions.filter((inst) => inst.id !== id));
  };

  const handleInstructionDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = instructions.findIndex((i) => i.id === active.id);
      const newIndex = instructions.findIndex((i) => i.id === over.id);
      setInstructions(arrayMove(instructions, oldIndex, newIndex));
    }
  };

  const handleGenerateDescription = async () => {
    const title = form.getFieldValue('title');
    if (!title) {
      toast.error('Missing title', {
        description: 'Please enter a recipe title first',
      });
      return;
    }

    setAiLoading(true);
    try {
      const ingredientNames = recipeIngredients
        .filter((ri) => ri.ingredientId)
        .map((ri) => {
          const ing = ingredients?.find((i) => i._id === ri.ingredientId);
          return ing?.name || '';
        })
        .filter(Boolean);

      const result = await generateDescription({
        title,
        ingredients: ingredientNames,
        cookingTime: form.getFieldValue('cookingTime') + form.getFieldValue('prepTime'),
      });

      if (result.success) {
        form.setFieldValue('description', result.text || '');
        toast.success('Description generated', {
          description: 'AI has generated a recipe description for you.',
        });
      } else {
        toast.error('AI unavailable', {
          description: result.error,
        });
      }
    } catch (error) {
      toast.error('Error', {
        description: error instanceof Error ? error.message : 'An unknown error occurred',
      });
    } finally {
      setAiLoading(false);
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

    setAiLoading(true);
    try {
      const result = await enhanceDescription({
        currentDescription: description,
        title: form.getFieldValue('title'),
      });

      if (result.success) {
        form.setFieldValue('description', result.text || '');
        toast.success('Description enhanced', {
          description: 'AI has improved your recipe description.',
        });
      } else {
        toast.error('AI unavailable', {
          description: result.error,
        });
      }
    } catch (error) {
      toast.error('Error', {
        description: error instanceof Error ? error.message : 'An unknown error occurred',
      });
    } finally {
      setAiLoading(false);
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

    setAiLoading(true);
    try {
      const result = await customizeDescription({
        currentDescription: description,
        customPrompt,
        title: form.getFieldValue('title'),
      });

      if (result.success) {
        form.setFieldValue('description', result.text || '');
        setCustomPrompt('');
        toast.success('Description customized', {
          description: 'AI has modified your recipe description.',
        });
      } else {
        toast.error('AI unavailable', {
          description: result.error,
        });
      }
    } catch (error) {
      toast.error('Error', {
        description: error instanceof Error ? error.message : 'An unknown error occurred',
      });
    } finally {
      setAiLoading(false);
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
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Create Recipe</h1>
        <p className="text-muted-foreground">Add a new recipe to your collection</p>
      </div>

      {/* Basic Info */}
      <Card>
        <CardHeader>
          <CardTitle>Basic Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form.Field name="title">
            {(field) => (
              <Field>
                <FieldLabel htmlFor={field.name}>Recipe Title</FieldLabel>
                <Input
                  id={field.name}
                  name={field.name}
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  placeholder="e.g., Spaghetti Carbonara"
                />
                <FieldError>{field.state.meta.errors.join(', ')}</FieldError>
              </Field>
            )}
          </form.Field>

          <div className="grid grid-cols-3 gap-4">
            <form.Field name="prepTime">
              {(field) => (
                <Field>
                  <FieldLabel htmlFor={field.name}>Prep Time (min)</FieldLabel>
                  <Input
                    id={field.name}
                    name={field.name}
                    type="number"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(parseInt(e.target.value, 10) || 0)}
                    onBlur={field.handleBlur}
                  />
                  <FieldError>{field.state.meta.errors.join(', ')}</FieldError>
                </Field>
              )}
            </form.Field>

            <form.Field name="cookingTime">
              {(field) => (
                <Field>
                  <FieldLabel htmlFor={field.name}>Cook Time (min)</FieldLabel>
                  <Input
                    id={field.name}
                    name={field.name}
                    type="number"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(parseInt(e.target.value, 10) || 0)}
                    onBlur={field.handleBlur}
                  />
                  <FieldError>{field.state.meta.errors.join(', ')}</FieldError>
                </Field>
              )}
            </form.Field>

            <form.Field name="servings">
              {(field) => (
                <Field>
                  <FieldLabel htmlFor={field.name}>Servings</FieldLabel>
                  <Input
                    id={field.name}
                    name={field.name}
                    type="number"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(parseInt(e.target.value, 10) || 0)}
                    onBlur={field.handleBlur}
                  />
                  <FieldError>{field.state.meta.errors.join(', ')}</FieldError>
                </Field>
              )}
            </form.Field>
          </div>

          <div>
            <FieldLabel>Recipe Image</FieldLabel>
            <div className="mt-2">
              {imagePreview ? (
                <div className="relative">
                  <img src={imagePreview} alt="Preview" className="w-full h-64 object-cover rounded-lg" />
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="absolute top-2 right-2"
                    onClick={() => {
                      setImageFile(null);
                      setImagePreview(null);
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="border-2 border-dashed rounded-lg p-8 text-center">
                  <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <label htmlFor="image" className="cursor-pointer">
                    <span className="text-primary hover:underline">Click to upload</span> or drag and drop
                  </label>
                  <input id="image" type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
                </div>
              )}
            </div>
          </div>

          <div>
            <FieldLabel>Tags</FieldLabel>
            <div className="flex gap-2 mt-2">
              <Input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddTag();
                  }
                }}
                placeholder="Add a tag..."
              />
              <Button type="button" onClick={handleAddTag}>
                Add
              </Button>
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {tags.map((tag) => (
                  <Badge key={tag} variant="secondary">
                    {tag}
                    <button type="button" onClick={() => handleRemoveTag(tag)} className="ml-2">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* AI Description */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            AI-Powered Description
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form.Field name="description">
            {(field) => (
              <Field>
                <FieldLabel htmlFor={field.name}>Description</FieldLabel>
                <Textarea
                  id={field.name}
                  name={field.name}
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  placeholder="Describe your recipe..."
                  rows={4}
                />
                <FieldError>{field.state.meta.errors.join(', ')}</FieldError>
              </Field>
            )}
          </form.Field>

          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={handleGenerateDescription} disabled={aiLoading}>
              {aiLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
              Generate with AI
            </Button>
            <Button type="button" variant="outline" onClick={handleEnhanceDescription} disabled={aiLoading}>
              {aiLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
              Enhance
            </Button>
          </div>

          <Separator />

          <div>
            <FieldLabel htmlFor="customPrompt">Custom AI Modification</FieldLabel>
            <div className="flex gap-2 mt-2">
              <Input
                id="customPrompt"
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder="e.g., Make it kid-friendly, add more details..."
              />
              <Button type="button" onClick={handleCustomizeDescription} disabled={aiLoading || !customPrompt}>
                {aiLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Apply'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Ingredients */}
      <Card>
        <CardHeader>
          <CardTitle>Ingredients</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleIngredientDragEnd}>
            <SortableContext items={recipeIngredients.map((i) => i.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-2">
                {recipeIngredients.map((ingredient) => (
                  <SortableIngredientRow
                    key={ingredient.id}
                    ingredient={ingredient}
                    onUpdate={handleUpdateIngredient}
                    onRemove={handleRemoveIngredient}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>

          <Button type="button" variant="outline" onClick={handleAddIngredient}>
            <Plus className="mr-2 h-4 w-4" />
            Add Ingredient
          </Button>
        </CardContent>
      </Card>

      {/* Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>Instructions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleInstructionDragEnd}>
            <SortableContext items={instructions.map((i) => i.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-2">
                {instructions.map((instruction, index) => (
                  <SortableInstructionRow
                    key={instruction.id}
                    instruction={instruction}
                    index={index}
                    onUpdate={handleUpdateInstruction}
                    onRemove={handleRemoveInstruction}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>

          <Button type="button" variant="outline" onClick={handleAddInstruction}>
            <Plus className="mr-2 h-4 w-4" />
            Add Step
          </Button>
        </CardContent>
      </Card>

      {/* Submit */}
      <div className="flex gap-4">
        <Button type="button" variant="outline" onClick={() => navigate({ to: '/recipes' })}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Creating...
            </>
          ) : (
            'Create Recipe'
          )}
        </Button>
      </div>
    </form>
  );
}
