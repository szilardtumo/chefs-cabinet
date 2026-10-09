import { customAction, customCtx, customMutation, customQuery } from 'convex-helpers/server/customFunctions';
import type { Doc, Id, TableNames } from '../_generated/dataModel';
import { action, mutation, type QueryCtx, query } from '../_generated/server';
import { NotFoundError, UnauthenticatedError } from './errors';

/**
 * Custom query builder that automatically handles authentication.
 * Returns the authenticated user's ID and throws if not authenticated.
 */
export const authenticatedQuery = customQuery(
  query,
  customCtx(async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new UnauthenticatedError();
    }
    return { userId: identity.subject };
  }),
);

/**
 * Custom mutation builder that automatically handles authentication.
 * Returns the authenticated user's ID and throws if not authenticated.
 */
export const authenticatedMutation = customMutation(
  mutation,
  customCtx(async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new UnauthenticatedError();
    }
    return { userId: identity.subject };
  }),
);

export const authenticatedAction = customAction(
  action,
  customCtx(async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new UnauthenticatedError();
    }
    return { userId: identity.subject };
  }),
);

type OwnedTableName = { [T in TableNames]: Doc<T> extends { userId: string } ? T : never }[TableNames];

/**
 * Loads a document the user owns. Throws "not found" for documents of other users too, so their ids reveal nothing.
 */
export async function requireOwned<T extends OwnedTableName>(
  ctx: { db: QueryCtx['db']; userId: string },
  table: T,
  id: Id<T>,
): Promise<Doc<T>> {
  const doc = (await ctx.db.get(id)) as (Doc<T> & { userId: string }) | null;
  if (!doc || doc.userId !== ctx.userId) {
    throw new NotFoundError(table, id);
  }
  return doc;
}
