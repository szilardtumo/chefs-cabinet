/// <reference types="vite/client" />

import { ClerkProvider, useAuth } from '@clerk/tanstack-react-start';
import { auth } from '@clerk/tanstack-react-start/server';
import type { ConvexQueryClient } from '@convex-dev/react-query';
import type { QueryClient } from '@tanstack/react-query';
import { createRootRouteWithContext, HeadContent, Outlet, Scripts, useRouteContext } from '@tanstack/react-router';
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools';
import { createServerFn } from '@tanstack/react-start';
import { ConvexProviderWithClerk } from 'convex/react-clerk';
import { NuqsAdapter } from 'nuqs/adapters/tanstack-router';
import type * as React from 'react';
import { DefaultCatchBoundary } from '@/components/default-catch-boundary.js';
import { NotFound } from '@/components/not-found.js';
import { ThemeProvider } from '@/components/theme-provider';
import { Toaster } from '@/components/ui/sonner';
import appCss from '@/styles/app.css?url';

const fetchClerkAuth = createServerFn({ method: 'GET' }).handler(async () => {
  try {
    const authObj = await auth();
    const token = await authObj.getToken({ template: 'convex' });

    return { userId: authObj.userId, token };
  } catch {
    return { userId: null, token: null };
  }
});

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient;
  convexQueryClient: ConvexQueryClient;
  title?: string;
}>()({
  beforeLoad: async ({ context }) => {
    const { userId, token } = await fetchClerkAuth();

    // During SSR only (the only time serverHttpClient exists),
    // set the Clerk auth token to make HTTP queries with.
    if (token) {
      context.convexQueryClient.serverHttpClient?.setAuth(token);
    }

    return { userId, token, title: "Chef's Cabinet" };
  },
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      { title: "Chef's Cabinet" },
      { name: 'description', content: 'Recipes, ingredients, cookbooks and shopping lists in one place.' },
      { name: 'theme-color', content: '#ffffff' },
      { name: 'apple-mobile-web-app-title', content: "Chef's Cabinet" },
      { name: 'mobile-web-app-capable', content: 'yes' },
    ],
    links: [
      { rel: 'stylesheet', href: appCss },
      { rel: 'icon', href: '/favicon.ico', sizes: '48x48' },
      { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
      { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
      { rel: 'manifest', href: '/site.webmanifest' },
    ],
  }),
  errorComponent: (props) => {
    return (
      <RootDocument>
        <DefaultCatchBoundary {...props} />
      </RootDocument>
    );
  },
  notFoundComponent: () => <NotFound />,
  component: RootComponent,
});

function RootComponent() {
  const context = useRouteContext({ from: Route.id });

  return (
    <ClerkProvider>
      <ConvexProviderWithClerk client={context.convexQueryClient.convexClient} useAuth={useAuth}>
        <NuqsAdapter>
          <RootDocument>
            <Outlet />
          </RootDocument>
        </NuqsAdapter>
      </ConvexProviderWithClerk>
    </ClerkProvider>
  );
}

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    // ThemeProvider's script sets the theme class on <html> before React hydrates
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        <ThemeProvider>
          {children}
          <Toaster />
        </ThemeProvider>
        <TanStackRouterDevtools position="bottom-right" />
        <Scripts />
      </body>
    </html>
  );
}
