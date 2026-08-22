import type { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import type { MatchedRecipeFormValues, RecipeSnapshot } from '@convex/recipesAi';
import type { FunctionArgs } from 'convex/server';
import { capitalize, omit } from 'es-toolkit';
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

type FormIngredient = RecipeFormValues['ingredientGroups'][number]['ingredients'][number];

/**
 * The group shapes the form accepts from upstream, satisfied by both the recipe query and an AI revision.
 * Anchored to the form values rather than to either source, so a change in one source cannot break the other's path.
 */
type IngredientGroupInput = {
  title?: string;
  ingredients?: Array<Omit<FormIngredient, 'id'>>;
};

type InstructionGroupInput = {
  title?: string;
  steps: string[];
};

export function toFormIngredientGroups(groups?: IngredientGroupInput[]): RecipeFormValues['ingredientGroups'] {
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

export function toFormInstructionGroups(groups?: InstructionGroupInput[]): RecipeFormValues['instructions'] {
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
  const { ingredientGroups, instructions } = value;
  const recipeContent = omit(value, [
    'ingredientGroups',
    'instructions',
    'imageFiles',
    'imageUrl',
    'source',
    'aiPrompt',
  ]);

  return {
    ...recipeContent,
    ingredientGroups: ingredientGroups.map((group) => ({
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
    instructions: instructions.map((group) => ({
      title: group.title.trim() || undefined,
      steps: group.steps.map((step) => step.text).filter((text) => text.trim().length > 0),
    })),
  };
}

/** What `recipes.create` accepts; `recipes.update` takes the same fields plus the recipe id. */
export type RecipeWriteInput = FunctionArgs<typeof api.recipes.create>;

/**
 * Maps the form to the write action's input. The explicit return type is the seam between the two:
 * if the action's args change, this mapper fails to compile rather than the submit call site.
 */
export function serializeFormToRecipeInput(
  value: RecipeFormValues,
  image: RecipeWriteInput['image'],
): RecipeWriteInput {
  const { ingredientGroups, instructions } = value;
  const recipeContent = omit(value, ['ingredientGroups', 'instructions', 'imageFiles', 'imageUrl']);

  return {
    ...recipeContent,
    image,
    tags: value.tags.map(capitalize),
    ingredients: ingredientGroups.flatMap((group) => {
      const groupTitle = group.title.trim();
      return group.ingredients
        .filter((ingredient) => ingredient.ingredientId || ingredient.newIngredientName)
        .map((ingredient) => ({ ...omit(ingredient, ['id']), group: groupTitle || undefined }));
    }),
    instructions: instructions.map((group) => ({
      title: group.title.trim() || undefined,
      steps: group.steps.map((step) => step.text),
    })),
  };
}

export function mapMatchedRecipeToFormValues(
  recipe: MatchedRecipeFormValues,
  preserve: Pick<RecipeFormValues, 'imageFiles' | 'imageUrl' | 'source'>,
): Omit<RecipeFormValues, 'aiPrompt'> {
  const { ingredientGroups, instructions, ...recipeContent } = recipe;

  return {
    ...recipeContent,
    prepTime: recipe.prepTime,
    cookingTime: recipe.cookingTime,
    servings: recipe.servings,
    ...preserve,
    ingredientGroups: toFormIngredientGroups(ingredientGroups),
    instructions: toFormInstructionGroups(instructions),
  };
}
