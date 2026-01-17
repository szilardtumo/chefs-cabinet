import { generateText } from 'ai';
import { v } from 'convex/values';
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

Write a brief, compelling description (2-3 sentences) that highlights the flavors, textures, and what makes this dish special. Keep it concise and inviting.`;

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

Make it more detailed, engaging, and appetizing. Add more sensory details about flavors, textures, and aromas. Keep it concise but compelling (3-4 sentences max).`;

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
