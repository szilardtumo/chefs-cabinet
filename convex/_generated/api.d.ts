/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as ai from "../ai.js";
import type * as categories from "../categories.js";
import type * as errors from "../errors.js";
import type * as helpers from "../helpers.js";
import type * as ingredients from "../ingredients.js";
import type * as recipeIngredients from "../recipeIngredients.js";
import type * as recipes from "../recipes.js";
import type * as seed from "../seed.js";
import type * as shoppingListItems from "../shoppingListItems.js";
import type * as shoppingLists from "../shoppingLists.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
declare const fullApi: ApiFromModules<{
  ai: typeof ai;
  categories: typeof categories;
  errors: typeof errors;
  helpers: typeof helpers;
  ingredients: typeof ingredients;
  recipeIngredients: typeof recipeIngredients;
  recipes: typeof recipes;
  seed: typeof seed;
  shoppingListItems: typeof shoppingListItems;
  shoppingLists: typeof shoppingLists;
}>;
declare const fullApiWithMounts: typeof fullApi;

export declare const api: FilterApi<
  typeof fullApiWithMounts,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApiWithMounts,
  FunctionReference<any, "internal">
>;

export declare const components: {};
