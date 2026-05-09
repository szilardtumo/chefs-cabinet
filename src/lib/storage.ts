import type { Id } from '@convex/_generated/dataModel';

/**
 * Checks if a given string looks like a valid Convex storage ID.
 * It does not check if the ID is actually valid or exists.
 * For safer checks, use `ctx.db.system.normalizeId("_storage", id)` on the server.
 *
 * @param id - The value to check.
 * @returns True if the string looks like a valid Convex storage ID, false otherwise.
 */
export const isStorageId = (id: unknown): id is Id<'_storage'> => {
  return typeof id === 'string' && /^[0-9a-z]{31,37}$/.test(id);
};
