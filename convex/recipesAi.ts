import { generateText, Output } from 'ai';
import { v } from 'convex/values';
import { zodToConvex } from 'convex-helpers/server/zod';
import { z } from 'zod/v3';
import { api } from './_generated/api';
import type { Id } from './_generated/dataModel';
import type { ActionCtx } from './_generated/server';
import type { IngredientWithCategory } from './ingredients';
import { createGoogleAI, GEMINI_MODELS } from './lib/ai';
import { authenticatedAction } from './lib/helpers';

const parsedIngredientSchema = z.object({
  ingredientName: z.string().describe('Base name of the ingredient (e.g., "egg" not "large eggs")'),
  quantity: z.number().optional().describe('Quantity (numeric value only)'),
  unit: z.string().optional().describe('Unit in grams (g), milliliters (ml), or small units (tsp, tbsp, pinch, dash)'),
  notes: z
    .string()
    .optional()
    .describe(
      'Only uncommon qualifiers that matter (e.g. "zest", "juice", "to taste", "smoked"). Omit defaults like all-purpose, kosher, fresh, dried, ground.',
    ),
});

const parsedRecipeSchema = z.object({
  title: z.string().describe('Recipe title'),
  description: z.string().describe('Recipe description'),
  prepTime: z.number().optional().describe('Prep time in minutes'),
  cookingTime: z.number().optional().describe('Cooking time in minutes'),
  servings: z.number().int().optional().describe('Number of servings'),
  tags: z.array(z.string()).describe('Recipe tags/categories'),
  ingredientGroups: z
    .array(
      z.object({
        title: z
          .string()
          .optional()
          .describe('Section name for ingredients, e.g. "Dough", "Frosting". Omit for a single flat list.'),
        ingredients: z.array(parsedIngredientSchema).describe('Ingredients in this section'),
      }),
    )
    .describe('Ingredients split by recipe part (use one group with no title for simple recipes)'),
  instructions: z
    .array(
      z.object({
        title: z.string().optional().describe('Section heading for these steps, e.g. "Dough". Omit if not needed.'),
        steps: z.array(z.string()).describe('Ordered steps for this section'),
      }),
    )
    .describe('Instructions split by recipe part (use one group for simple recipes)'),
});

const reviseRecipeSchema = parsedRecipeSchema.extend({
  changeSummary: z
    .string()
    .describe('Brief summary of what changed in this revision and why, relative to the current recipe and request'),
});

type ParsedRecipe = z.infer<typeof parsedRecipeSchema>;
type ParsedIngredient = z.infer<typeof parsedIngredientSchema>;

const recipeSnapshotValidator = zodToConvex(parsedRecipeSchema);

const revisionRoundValidator = v.object({
  prompt: v.string(),
  changeSummary: v.string(),
  recipe: recipeSnapshotValidator,
});

const INGREDIENT_GUIDANCE = `INGREDIENT MATCHING:
  - Use a base name from the EXISTING INGREDIENTS list whenever there is a reasonable match
  - Treat singular/plural as the same ("egg" ↔ "eggs")
  - Put only meaningful, non-obvious forms in notes (zest, juice, smoked, browned, to taste, etc.)
  - Example: "lemon zest" → ingredientName: "lemon", notes: "zest"
  - Only create a new ingredient if no reasonable match exists

OMIT OBVIOUS NOTES (do not put these in notes or in the ingredient name):
  - Default types: all-purpose flour → "flour"; kosher/table/sea salt → "salt"; granulated/white sugar → "sugar"
  - Default states: fresh, dried, ground, finely ground, freshly ground, powdered, minced, chopped, diced, sliced
  - Other noise: unsalted butter → "butter" (unless salted is unusual for the recipe); large eggs → notes may keep "large" only if size matters
  - If a specialty really matters, keep it (e.g. "00 flour", "flaky salt", "smoked paprika", "dark brown sugar")
  - Prefer empty notes over clutter — when in doubt, omit the qualifier

MEASUREMENTS:
  - Convert cups/fl oz to g (solids) or ml (liquids)
  - Use densities: flour 125g/cup, sugar 200g/cup, butter 227g/cup, oil 218g/cup, water/milk 240ml/cup
  - Convert oz/lb to g
  - Keep small units as-is: tsp, tbsp, pinch, dash
  - "2 large eggs" → quantity: 2, unit: "", notes: "large"
  - "salt to taste" → quantity: 0 or omit, unit: "", notes: "to taste"

GROUPING:
  - If the recipe has clear parts (e.g. cake + frosting, dough + filling), use multiple ingredientGroups and instruction groups with descriptive titles
  - For a simple single-flow recipe, use a single group with no title for ingredients and a single group with no title for instructions

INSTRUCTIONS:
  - Keep steps minimal and concise within each group
  - Combine steps when they naturally belong together`;

export type RecipeSnapshot = ParsedRecipe;

export type MatchedRecipeFormValues = Omit<RecipeSnapshot, 'ingredientGroups'> & {
  ingredientGroups: ReturnType<typeof matchIngredientGroups>;
};

async function loadRecipeAiContext(ctx: ActionCtx) {
  const identity = await ctx.auth.getUserIdentity();
  const google = await createGoogleAI(identity!);
  const existingIngredients: IngredientWithCategory[] = await ctx.runQuery(api.ingredients.getAll, {});
  const existingIngredientNames = existingIngredients
    .map((ingredient) => ingredient.name.trim())
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));

  return { google, existingIngredients, existingIngredientNames };
}

function existingIngredientsPrompt(names: string[]) {
  return `EXISTING INGREDIENTS (use these base names when possible):
  ${names.join(', ')}

${INGREDIENT_GUIDANCE}`;
}

function matchIngredient(ingredient: ParsedIngredient, existingIngredients: IngredientWithCategory[]) {
  const baseName = ingredient.ingredientName.toLowerCase().trim();
  const matchedIngredient = existingIngredients.find((existing) => existing.name.toLowerCase().trim() === baseName);

  return {
    quantity: ingredient.quantity,
    unit: ingredient.unit,
    notes: ingredient.notes,
    ...(matchedIngredient ? { ingredientId: matchedIngredient._id } : { newIngredientName: ingredient.ingredientName }),
  };
}

function matchIngredientGroups(
  groups: ParsedRecipe['ingredientGroups'],
  existingIngredients: IngredientWithCategory[],
) {
  return groups.map((group) => ({
    title: group.title,
    ingredients: group.ingredients.map((ingredient) => matchIngredient(ingredient, existingIngredients)),
  }));
}

function toMatchedFormValues(
  recipe: ParsedRecipe,
  existingIngredients: IngredientWithCategory[],
): MatchedRecipeFormValues {
  const { ingredientGroups, ...rest } = recipe;
  return {
    ...rest,
    ingredientGroups: matchIngredientGroups(ingredientGroups, existingIngredients),
  };
}

function formatPriorRevisions(revisions: Array<{ prompt: string; changeSummary: string; recipe: RecipeSnapshot }>) {
  if (revisions.length === 0) {
    return 'None — this is the first revision in this session.';
  }

  return revisions
    .map(
      (revision, index) => `### Round ${index + 1}
User prompt: ${revision.prompt}
Change summary: ${revision.changeSummary}
Resulting recipe:
${JSON.stringify(revision.recipe, null, 2)}`,
    )
    .join('\n\n');
}

/**
 * Imports a recipe from a URL or raw text using AI.
 * Parses the source, creates any new ingredients, and saves the recipe.
 */
export const importRecipeFromSource = authenticatedAction({
  args: {
    url: v.optional(v.string()),
    text: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<Id<'recipes'>> => {
    if (!args.url && !args.text) {
      throw new Error('Either url or text must be provided');
    }

    const { google, existingIngredients, existingIngredientNames } = await loadRecipeAiContext(ctx);

    const sourceContent = args.url || args.text || '';
    const sourceType = args.url ? 'URL' : 'raw text';

    const { output } = await generateText({
      model: google(GEMINI_MODELS.pro),
      output: Output.object({ schema: parsedRecipeSchema }),
      tools: {
        google_search: google.tools.googleSearch({}),
        url_context: google.tools.urlContext({}),
      },
      prompt: `Parse a recipe from ${sourceType} into structured data.

${existingIngredientsPrompt(existingIngredientNames)}

SOURCE:
  ${sourceType === 'URL' ? `URL (parse this webpage for the recipe): ${sourceContent}` : `Raw recipe text: ${sourceContent}`}

Return: title, description, prepTime, cookingTime, servings, tags, ingredientGroups, instructions.`,
    });

    const matched = toMatchedFormValues(output, existingIngredients);
    const ingredients = matched.ingredientGroups.flatMap((group) =>
      group.ingredients.map((ingredient) => ({
        ...ingredient,
        group: group.title,
      })),
    );

    const aiImportedTag = 'AI imported';
    const tags = matched.tags.includes(aiImportedTag) ? matched.tags : [...matched.tags, aiImportedTag];

    return await ctx.runAction(api.recipes.create, {
      title: matched.title,
      description: matched.description,
      prepTime: matched.prepTime,
      cookingTime: matched.cookingTime,
      servings: matched.servings,
      tags,
      source: args.url,
      instructions: matched.instructions,
      ingredients,
      aiPrompt: args.url ? `Import from URL: ${args.url}` : 'Import from pasted recipe text',
    });
  },
});

/**
 * Revises an existing recipe from a user prompt using AI.
 * Returns a form-compatible recipe plus a change summary — does not persist.
 */
export const reviseRecipeWithPrompt = authenticatedAction({
  args: {
    prompt: v.string(),
    currentRecipe: recipeSnapshotValidator,
    priorRevisions: v.array(revisionRoundValidator),
  },
  handler: async (
    ctx,
    args,
  ): Promise<MatchedRecipeFormValues & { changeSummary: string; contextRecipe: RecipeSnapshot }> => {
    const { google, existingIngredients, existingIngredientNames } = await loadRecipeAiContext(ctx);

    const { output } = await generateText({
      model: google(GEMINI_MODELS.pro),
      output: Output.object({ schema: reviseRecipeSchema }),
      prompt: `Revise an existing recipe based on the user's request.

${existingIngredientsPrompt(existingIngredientNames)}

RULES FOR REVISION:
  - Apply the user's request to the CURRENT RECIPE
  - Return a COMPLETE updated recipe (not a sparse patch) — include every field and every ingredient/instruction
  - Preserve fields and content the user did not ask to change
  - Do not invent unrelated improvements
  - changeSummary: briefly state what changed and why, relative to the current recipe and this request
  - Use PRIOR REVISIONS for context (e.g. undo prior AI edits, refine further) but treat CURRENT RECIPE as the source of truth for the present state

PRIOR REVISIONS IN THIS SESSION:
${formatPriorRevisions(args.priorRevisions)}

CURRENT RECIPE:
${JSON.stringify(args.currentRecipe, null, 2)}

USER REQUEST:
${args.prompt}

Return: title, description, prepTime, cookingTime, servings, tags, ingredientGroups, instructions, changeSummary.`,
    });

    const { changeSummary, ...parsedRecipe } = output;

    return {
      ...toMatchedFormValues(parsedRecipe, existingIngredients),
      changeSummary,
      contextRecipe: parsedRecipe,
    };
  },
});
