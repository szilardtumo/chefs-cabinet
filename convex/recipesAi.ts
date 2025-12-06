import { generateText } from 'ai';
import { v } from 'convex/values';
import { action } from './_generated/server';
import { createGoogleAI } from './lib/ai';

export const generateRecipeDescription = action({
  args: {
    title: v.string(),
    ingredients: v.array(v.string()),
    cookingTime: v.number(),
  },
  handler: async (_ctx, args) => {
    const google = await createGoogleAI();

    const ingredientsList = args.ingredients.join(', ');
    const prompt = `Generate an engaging and appetizing recipe description for a dish called "${args.title}". 
      
The recipe includes these ingredients: ${ingredientsList}
Cooking time: ${args.cookingTime} minutes

Write a brief, compelling description (2-3 sentences) that highlights the flavors, textures, and what makes this dish special. Keep it concise and inviting.`;

    const { text } = await generateText({
      model: google('gemini-2.5-flash-lite'),
      prompt,
    });

    return text;
  },
});

export const enhanceRecipeDescription = action({
  args: {
    currentDescription: v.string(),
    title: v.string(),
  },
  handler: async (_ctx, args) => {
    const google = await createGoogleAI();

    const prompt = `Enhance and improve this recipe description for "${args.title}":

Current description: ${args.currentDescription}

Make it more detailed, engaging, and appetizing. Add more sensory details about flavors, textures, and aromas. Keep it concise but compelling (3-4 sentences max).`;

    const { text } = await generateText({
      model: google('gemini-2.5-flash-lite'),
      prompt,
    });

    return text;
  },
});

export const customizeRecipeDescription = action({
  args: {
    currentDescription: v.string(),
    customPrompt: v.string(),
    title: v.string(),
  },
  handler: async (_ctx, args) => {
    const google = await createGoogleAI();

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
