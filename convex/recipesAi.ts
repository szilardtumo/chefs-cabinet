import { generateText, Output } from 'ai';
import { v } from 'convex/values';
import { z } from 'zod';
import { api } from './_generated/api';
import type { IngredientWithCategory } from './ingredients';
import { createGoogleAI } from './lib/ai';
import { authenticatedAction } from './lib/helpers';

/**
 * Parses a recipe from a URL or raw text using AI.
 * Extracts recipe data, converts units, and matches ingredients to existing ones.
 */
export const parseRecipeFromSource = authenticatedAction({
  args: {
    url: v.optional(v.string()),
    text: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (!args.url && !args.text) {
      throw new Error('Either url or text must be provided');
    }

    const identity = await ctx.auth.getUserIdentity();
    const google = await createGoogleAI(identity!);

    // Get user's existing ingredients for matching
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
                  notes: z.string().optional().describe('Qualifiers like "large", "fresh", "to taste" go here'),
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
  - Put forms/qualifiers in notes (fresh, large, zest, juice, chopped, etc.)
  - Example: "lemon zest" → ingredientName: "lemon", notes: "zest"
  - Only create a new ingredient if no reasonable match exists

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
      model: google('gemini-3-pro-preview'),
      output: Output.object({ schema: parsedRecipeSchema }),
      tools: {
        google_search: google.tools.googleSearch({}),
        url_context: google.tools.urlContext({}),
      },
      prompt,
    });

    const matchIngredient = (
      ingredient: z.infer<typeof parsedRecipeSchema>['ingredientGroups'][number]['ingredients'][number],
    ) => {
      const baseName = ingredient.ingredientName.toLowerCase().trim();
      const matchedIngredient = existingIngredients.find((existing) => existing.name.toLowerCase().trim() === baseName);

      if (matchedIngredient) {
        return {
          ...ingredient,
          ingredientId: matchedIngredient._id,
        };
      }

      return {
        ...ingredient,
        newIngredientName: ingredient.ingredientName,
      };
    };

    return {
      ...output,
      source: args.url,
      ingredientGroups: output.ingredientGroups.map((group) => ({
        title: group.title,
        ingredients: group.ingredients.map(matchIngredient),
      })),
    };
  },
});
