import { generateText, Output } from 'ai';
import { v } from 'convex/values';
import { z } from 'zod';
import { api } from './_generated/api';
import type { Id } from './_generated/dataModel';
import type { IngredientWithCategory } from './ingredients';
import { createGoogleAI, GEMINI_MODELS } from './lib/ai';
import { authenticatedAction } from './lib/helpers';

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

    const identity = await ctx.auth.getUserIdentity();
    const google = await createGoogleAI(identity!);

    const existingIngredients: IngredientWithCategory[] = await ctx.runQuery(api.ingredients.getAll, {});

    const sourceContent = args.url || args.text || '';
    const sourceType = args.url ? 'URL' : 'raw text';
    const existingIngredientNames = existingIngredients
      .map((ingredient) => ingredient.name.trim())
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));

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
            ingredients: z
              .array(
                z.object({
                  ingredientName: z.string().describe('Base name of the ingredient (e.g., "egg" not "large eggs")'),
                  quantity: z.number().optional().describe('Quantity (numeric value only)'),
                  unit: z
                    .string()
                    .optional()
                    .describe('Unit in grams (g), milliliters (ml), or small units (tsp, tbsp, pinch, dash)'),
                  notes: z
                    .string()
                    .optional()
                    .describe(
                      'Only uncommon qualifiers that matter (e.g. "zest", "juice", "to taste", "smoked"). Omit defaults like all-purpose, kosher, fresh, dried, ground.',
                    ),
                }),
              )
              .describe('Ingredients in this section'),
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

    const prompt = `Parse a recipe from ${sourceType} into structured data.

EXISTING INGREDIENTS (use these base names when possible):
  ${existingIngredientNames.join(', ')}

INGREDIENT MATCHING:
  - Use a base name from the list above whenever there is a reasonable match
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
  - If the recipe has clear parts (e.g. cake + frosting, dough + filling), use multiple ingredientGroups and instructionGroups with descriptive titles
  - For a simple single-flow recipe, use a single group with no title for ingredients and a single group with no title for instructions

INSTRUCTIONS:
  - Keep steps minimal and concise within each group
  - Combine steps when they naturally belong together

SOURCE:
  ${sourceType === 'URL' ? `URL (parse this webpage for the recipe): ${sourceContent}` : `Raw recipe text: ${sourceContent}`}

Return: title, description, prepTime, cookingTime, servings, tags, ingredientGroups, instructionGroups.`;

    const { output } = await generateText({
      model: google(GEMINI_MODELS.pro),
      output: Output.object({ schema: parsedRecipeSchema }),
      tools: {
        google_search: google.tools.googleSearch({}),
        url_context: google.tools.urlContext({}),
      },
      prompt,
    });

    const ingredients = output.ingredientGroups.flatMap((group) =>
      group.ingredients.map((ingredient) => {
        const baseName = ingredient.ingredientName.toLowerCase().trim();
        const matchedIngredient = existingIngredients.find(
          (existing) => existing.name.toLowerCase().trim() === baseName,
        );

        return {
          quantity: ingredient.quantity,
          unit: ingredient.unit,
          notes: ingredient.notes,
          group: group.title,
          ...(matchedIngredient
            ? { ingredientId: matchedIngredient._id }
            : { newIngredientName: ingredient.ingredientName }),
        };
      }),
    );

    const aiImportedTag = 'AI imported';
    const tags = output.tags.includes(aiImportedTag) ? output.tags : [...output.tags, aiImportedTag];

    return await ctx.runAction(api.recipes.create, {
      title: output.title,
      description: output.description,
      prepTime: output.prepTime,
      cookingTime: output.cookingTime,
      servings: output.servings,
      tags,
      source: args.url,
      instructions: output.instructions,
      ingredients,
      aiPrompt: args.url ? `Import from URL: ${args.url}` : 'Import from pasted recipe text',
    });
  },
});
