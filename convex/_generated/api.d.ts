/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as bookLookup from "../bookLookup.js";
import type * as books from "../books.js";
import type * as categories from "../categories.js";
import type * as hardcoverApi from "../hardcoverApi.js";
import type * as ingredients from "../ingredients.js";
import type * as lib_ai from "../lib/ai.js";
import type * as lib_errors from "../lib/errors.js";
import type * as lib_helpers from "../lib/helpers.js";
import type * as lib_rateLimiter from "../lib/rateLimiter.js";
import type * as migrations from "../migrations.js";
import type * as openLibraryApi from "../openLibraryApi.js";
import type * as readingEvents from "../readingEvents.js";
import type * as recipeHistories from "../recipeHistories.js";
import type * as recipeImports from "../recipeImports.js";
import type * as recipeIngredients from "../recipeIngredients.js";
import type * as recipes from "../recipes.js";
import type * as recipesAi from "../recipesAi.js";
import type * as seed from "../seed.js";
import type * as shoppingListItems from "../shoppingListItems.js";
import type * as shoppingLists from "../shoppingLists.js";
import type * as storage from "../storage.js";
import type * as unsplash from "../unsplash.js";
import type * as voiceActions_books from "../voiceActions/books.js";
import type * as voiceActions_library from "../voiceActions/library.js";
import type * as voiceActions_recipes from "../voiceActions/recipes.js";
import type * as voiceActions_registry from "../voiceActions/registry.js";
import type * as voiceActions_shoppingList from "../voiceActions/shoppingList.js";
import type * as voiceActions_types from "../voiceActions/types.js";
import type * as voiceCommands from "../voiceCommands.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  bookLookup: typeof bookLookup;
  books: typeof books;
  categories: typeof categories;
  hardcoverApi: typeof hardcoverApi;
  ingredients: typeof ingredients;
  "lib/ai": typeof lib_ai;
  "lib/errors": typeof lib_errors;
  "lib/helpers": typeof lib_helpers;
  "lib/rateLimiter": typeof lib_rateLimiter;
  migrations: typeof migrations;
  openLibraryApi: typeof openLibraryApi;
  readingEvents: typeof readingEvents;
  recipeHistories: typeof recipeHistories;
  recipeImports: typeof recipeImports;
  recipeIngredients: typeof recipeIngredients;
  recipes: typeof recipes;
  recipesAi: typeof recipesAi;
  seed: typeof seed;
  shoppingListItems: typeof shoppingListItems;
  shoppingLists: typeof shoppingLists;
  storage: typeof storage;
  unsplash: typeof unsplash;
  "voiceActions/books": typeof voiceActions_books;
  "voiceActions/library": typeof voiceActions_library;
  "voiceActions/recipes": typeof voiceActions_recipes;
  "voiceActions/registry": typeof voiceActions_registry;
  "voiceActions/shoppingList": typeof voiceActions_shoppingList;
  "voiceActions/types": typeof voiceActions_types;
  voiceCommands: typeof voiceCommands;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  migrations: import("@convex-dev/migrations/_generated/component.js").ComponentApi<"migrations">;
  rateLimiter: import("@convex-dev/rate-limiter/_generated/component.js").ComponentApi<"rateLimiter">;
};
