import { v } from 'convex/values';
import { action } from './_generated/server';

// AI actions for recipe generation and enhancement
// These will gracefully fail if OPENAI_API_KEY is not set

export const generateRecipeDescription = action({
  args: {
    title: v.string(),
    ingredients: v.array(v.string()),
    cookingTime: v.number(),
  },
  handler: async (_ctx, args) => {
    // Check if OpenAI API key is available
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return {
        success: false,
        error: 'OpenAI API key not configured. Please add OPENAI_API_KEY to your environment variables.',
      };
    }

    try {
      const { generateText } = await import('ai');
      const { openai } = await import('@ai-sdk/openai');

      const ingredientsList = args.ingredients.join(', ');
      const prompt = `Generate an engaging and appetizing recipe description for a dish called "${args.title}". 
      
The recipe includes these ingredients: ${ingredientsList}
Cooking time: ${args.cookingTime} minutes

Write a brief, compelling description (2-3 sentences) that highlights the flavors, textures, and what makes this dish special. Keep it concise and inviting.`;

      const { text } = await generateText({
        model: openai('gpt-4-turbo'),
        prompt,
      });

      return {
        success: true,
        text,
      };
    } catch (error) {
      console.error('AI generation error:', error);
      return {
        success: false,
        error: `Failed to generate description: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  },
});

export const enhanceRecipeDescription = action({
  args: {
    currentDescription: v.string(),
    title: v.string(),
  },
  handler: async (_ctx, args) => {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return {
        success: false,
        error: 'OpenAI API key not configured. Please add OPENAI_API_KEY to your environment variables.',
      };
    }

    try {
      const { generateText } = await import('ai');
      const { openai } = await import('@ai-sdk/openai');

      const prompt = `Enhance and improve this recipe description for "${args.title}":

Current description: ${args.currentDescription}

Make it more detailed, engaging, and appetizing. Add more sensory details about flavors, textures, and aromas. Keep it concise but compelling (3-4 sentences max).`;

      const { text } = await generateText({
        model: openai('gpt-4-turbo'),
        prompt,
      });

      return {
        success: true,
        text,
      };
    } catch (error) {
      console.error('AI enhancement error:', error);
      return {
        success: false,
        error: `Failed to enhance description: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  },
});

export const customizeRecipeDescription = action({
  args: {
    currentDescription: v.string(),
    customPrompt: v.string(),
    title: v.string(),
  },
  handler: async (_ctx, args) => {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return {
        success: false,
        error: 'OpenAI API key not configured. Please add OPENAI_API_KEY to your environment variables.',
      };
    }

    try {
      const { generateText } = await import('ai');
      const { openai } = await import('@ai-sdk/openai');

      const prompt = `Modify this recipe description for "${args.title}" based on the following request:

Current description: ${args.currentDescription}

User request: ${args.customPrompt}

Provide the modified description that addresses the user's request while maintaining the quality and appeal of the recipe.`;

      const { text } = await generateText({
        model: openai('gpt-4-turbo'),
        prompt,
      });

      return {
        success: true,
        text,
      };
    } catch (error: any) {
      console.error('AI customization error:', error);
      return {
        success: false,
        error: `Failed to customize description: ${error.message}`,
      };
    }
  },
});
