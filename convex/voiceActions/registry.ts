import { logReading } from './books';
import { openRecipe } from './recipes';
import { addRecipeIngredients, addToShoppingList } from './shoppingList';

/**
 * Everything a voice command can do, by the name of its field in the model's output.
 * A new action is a `defineVoiceAction` in this folder plus a line here; one that can be undone also adds
 * its undo to `undoValidator` and the `undo` action in `voiceCommands.ts`.
 */
export const voiceActions = {
  shoppingItems: addToShoppingList,
  recipeIngredients: addRecipeIngredients,
  openRecipe,
  readingLogs: logReading,
};
