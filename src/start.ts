import { clerkMiddleware } from '@clerk/tanstack-react-start/server';
import { createCsrfMiddleware, createStart } from '@tanstack/react-start';

export const startInstance = createStart(() => {
  return {
    // Defining requestMiddleware turns off Start's default CSRF check for server functions, so add it back
    requestMiddleware: [createCsrfMiddleware({ filter: (ctx) => ctx.handlerType === 'serverFn' }), clerkMiddleware()],
  };
});
