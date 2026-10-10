import { z } from 'zod';
import { defineVoiceAction } from './types';

export const openRecipe = defineVoiceAction({
  needs: ['recipes'],
  instructions: 'Open a recipe.',
  schema: z.string().nullable().describe('ID from RECIPES of the recipe to open, or null'),
  run: async (output, { library, report, navigate }) => {
    const recipe = library.recipes.find((r) => r._id === output);
    if (!recipe) return;
    report({ message: `Opened ${recipe.title}` });
    navigate(`/recipes/${recipe._id}`);
  },
});
