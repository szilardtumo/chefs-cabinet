import type { Id } from '@convex/_generated/dataModel';
import type { MatchedRecipeFormValues, RecipeSnapshot } from '@convex/recipesAi';
import { z } from 'zod';
import { generateId } from '@/lib/id';
import { zodConvexId } from '@/utils/validation';

function requireSectionTitles(groups: Array<{ title: string }>, ctx: z.RefinementCtx) {
  if (groups.length <= 1) {
    return;
  }

  for (const [index, group] of groups.entries()) {
    if (!group.title.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Section name is required when there are multiple sections',
        path: [index, 'title'],
      });
    }
  }
}

export const recipeFormSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string(),
  prepTime: z.number().min(1, 'Prep time must be a positive number').or(z.undefined()),
  cookingTime: z.number().min(1, 'Cooking time must be a positive number').or(z.undefined()),
  servings: z.number().int().min(1, 'Servings must be a positive integer').or(z.undefined()),
  imageFiles: z.array(z.instanceof(File)).max(1, 'Only one image is allowed'),
  imageUrl: z.url().or(z.undefined()),
  tags: z.array(z.string()),
  source: z.string().or(z.undefined()),
  /** Audit trail of AI revisions applied in this editing session; persisted with the recipe, never user-edited. */
  aiPrompt: z.string().or(z.undefined()),
  ingredientGroups: z
    .array(
      z.object({
        id: z.string(),
        title: z.string(),
        ingredients: z.array(
          z.object({
            id: z.string(),
            ingredientId: zodConvexId<'ingredients'>().optional(),
            newIngredientName: z.string().optional(),
            quantity: z.number().optional(),
            unit: z.string().optional(),
            notes: z.string().optional(),
          }),
        ),
      }),
    )
    .superRefine(requireSectionTitles),
  instructions: z
    .array(
      z.object({
        id: z.string(),
        title: z.string(),
        steps: z.array(
          z.object({
            id: z.string(),
            text: z.string(),
          }),
        ),
      }),
    )
    .superRefine(requireSectionTitles),
});

export type RecipeFormValues = z.infer<typeof recipeFormSchema>;

type IngredientLookup = Array<{ _id: Id<'ingredients'>; name: string }>;

type FormIngredientGroupInput = {
  title?: string;
  ingredients?: Array<{
    ingredientId?: Id<'ingredients'>;
    newIngredientName?: string;
    quantity?: number;
    unit?: string;
    notes?: string;
  }>;
};

type FormInstructionGroupInput = {
  title?: string;
  steps: string[];
};

export function toFormIngredientGroups(groups?: FormIngredientGroupInput[]): RecipeFormValues['ingredientGroups'] {
  if (!groups?.length) {
    return [{ id: generateId(), title: '', ingredients: [] }];
  }

  return groups.map((group) => ({
    id: generateId(),
    title: group.title ?? '',
    ingredients: (group.ingredients ?? []).map((ingredient) => ({
      id: generateId(),
      ingredientId: ingredient.ingredientId,
      newIngredientName: ingredient.newIngredientName,
      quantity: ingredient.quantity,
      unit: ingredient.unit,
      notes: ingredient.notes,
    })),
  }));
}

export function toFormInstructionGroups(groups?: FormInstructionGroupInput[]): RecipeFormValues['instructions'] {
  if (!groups?.length) {
    return [{ id: generateId(), title: '', steps: [] }];
  }

  return groups.map((group) => ({
    id: generateId(),
    title: group.title ?? '',
    steps: group.steps.map((text) => ({ id: generateId(), text })),
  }));
}

export function serializeFormToRecipeSnapshot(value: RecipeFormValues, ingredients: IngredientLookup): RecipeSnapshot {
  return {
    title: value.title,
    description: value.description,
    prepTime: value.prepTime,
    cookingTime: value.cookingTime,
    servings: value.servings,
    tags: value.tags,
    ingredientGroups: value.ingredientGroups.map((group) => ({
      title: group.title.trim() || undefined,
      ingredients: group.ingredients
        .filter((ingredient) => ingredient.ingredientId || ingredient.newIngredientName)
        .map((ingredient) => ({
          ingredientName:
            ingredient.newIngredientName ??
            ingredients.find((ing) => ing._id === ingredient.ingredientId)?.name ??
            'unknown',
          quantity: ingredient.quantity,
          unit: ingredient.unit,
          notes: ingredient.notes,
        })),
    })),
    instructions: value.instructions.map((group) => ({
      title: group.title.trim() || undefined,
      steps: group.steps.map((step) => step.text).filter((text) => text.trim().length > 0),
    })),
  };
}

export function mapMatchedRecipeToFormValues(
  recipe: MatchedRecipeFormValues,
  preserve: Pick<RecipeFormValues, 'imageFiles' | 'imageUrl' | 'source'>,
): Omit<RecipeFormValues, 'aiPrompt'> {
  return {
    title: recipe.title,
    description: recipe.description,
    prepTime: recipe.prepTime,
    cookingTime: recipe.cookingTime,
    servings: recipe.servings,
    tags: recipe.tags,
    source: preserve.source,
    imageFiles: preserve.imageFiles,
    imageUrl: preserve.imageUrl,
    ingredientGroups: toFormIngredientGroups(recipe.ingredientGroups),
    instructions: toFormInstructionGroups(recipe.instructions),
  };
}
