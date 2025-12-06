import { customAction, customCtx, customMutation, customQuery } from 'convex-helpers/server/customFunctions';
import { action, mutation, query } from '../_generated/server';
import { UnauthenticatedError } from './errors';

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
