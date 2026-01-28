import { generateObject, generateText } from 'ai';
import { v } from 'convex/values';
import { z } from 'zod';
import { api } from './_generated/api';
import type { IngredientWithCategory } from './ingredients';
import { createGoogleAI } from './lib/ai';
import { authenticatedAction } from './lib/helpers';

export const generateRecipeDescription = authenticatedAction({
  args: {
    title: v.string(),
    ingredients: v.array(v.string()),
    cookingTime: v.optional(v.number()),
    prepTime: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const google = await createGoogleAI(identity!);

    const ingredientsList = args.ingredients.join(', ');
    const prompt = `Generate an engaging and appetizing recipe description for a dish called "${args.title}". 
      
The recipe includes these ingredients: ${ingredientsList}
Cooking time: ${args.cookingTime} minutes
Prep time: ${args.prepTime} minutes

Write a brief, compelling description (2-3 sentences) that highlights the flavors, textures, and what makes this dish special. Keep it concise and inviting.

Return only the generated description.`;

    const { text } = await generateText({
      model: google('gemini-2.5-flash-lite'),
      prompt,
    });

    return text;
  },
});

export const enhanceRecipeDescription = authenticatedAction({
  args: {
    currentDescription: v.string(),
    title: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const google = await createGoogleAI(identity!);

    const prompt = `Enhance and improve this recipe description for "${args.title}":

Current description: ${args.currentDescription}

Make it more detailed, engaging, and appetizing. Add more sensory details about flavors, textures, and aromas. Keep it concise but compelling (3-4 sentences max).

Return only the enhanced description.`;

    const { text } = await generateText({
      model: google('gemini-2.5-flash-lite'),
      prompt,
    });

    return text;
  },
});

export const customizeRecipeDescription = authenticatedAction({
  args: {
    currentDescription: v.string(),
    customPrompt: v.string(),
    title: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const google = await createGoogleAI(identity!);

    const prompt = `Modify this recipe description for "${args.title}" based on the following request:

Current description: ${args.currentDescription}

User request: ${args.customPrompt}

Provide the modified description that addresses the user's request while maintaining the quality and appeal of the recipe.`;

    const { text } = await generateText({
      model: google('gemini-2.5-flash-lite'),
      prompt,
    });

    return text;
  },
});

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

    // Create schema matching the form's recipeSchema structure
    const parsedRecipeSchema = z.object({
      title: z.string().describe('Recipe title'),
      description: z.string().describe('Recipe description'),
      prepTime: z.number().optional().describe('Prep time in minutes'),
      cookingTime: z.number().optional().describe('Cooking time in minutes'),
      servings: z.number().int().optional().describe('Number of servings'),
      tags: z.array(z.string()).describe('Recipe tags/categories'),
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
        .describe('List of ingredients with converted units'),
      instructions: z.array(z.string()).describe('Step-by-step cooking instructions'),
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

INSTRUCTIONS:
  - Keep steps minimal and concise
  - Combine steps when they naturally belong together

SOURCE:
  ${sourceType === 'URL' ? `URL: ${sourceContent}` : `Raw recipe text: ${sourceContent}`}

Return: title, description, prepTime, cookingTime, servings, tags, ingredients, instructions.`;

    const { object } = await generateObject({
      model: google('gemini-2.5-flash'),
      schema: parsedRecipeSchema,
      prompt,
    });

    // Match ingredients to existing ones
    const matchedIngredients = object.ingredients.map((ingredient) => {
      const baseName = ingredient.ingredientName.toLowerCase().trim();
      const matchedIngredient = existingIngredients.find(
        (ingredient) => ingredient.name.toLowerCase().trim() === baseName,
      );

      if (matchedIngredient) {
        return {
          ...ingredient,
          ingredientId: matchedIngredient._id,
        };
      } else {
        return {
          ...ingredient,
          newIngredientName: ingredient.ingredientName,
        };
      }
    });

    return {
      ...object,
      ingredients: matchedIngredients,
    };
  },
});
