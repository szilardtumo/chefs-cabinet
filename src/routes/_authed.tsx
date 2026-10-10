import { SignIn, UserButton } from '@clerk/tanstack-react-start';
import { ClientOnly, createFileRoute, Outlet } from '@tanstack/react-router';
import { AppBreadcrumb } from '@/components/app-breadcrumb';
import { AppSidebar } from '@/components/app-sidebar';
import { Separator } from '@/components/ui/separator';
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { Skeleton } from '@/components/ui/skeleton';
import { VoiceButton } from '@/components/voice-command/voice-button';
import { VoiceCommandProvider } from '@/components/voice-command/voice-command-provider';
import { VoiceHistory } from '@/components/voice-command/voice-history';

export const Route = createFileRoute('/_authed')({
  beforeLoad: ({ context }) => {
    if (!context.userId) {
      throw new Error('Not authenticated');
    }
  },
  errorComponent: ({ error }) => {
    if (error instanceof Error && error.message === 'Not authenticated') {
      return (
        <div className="flex items-center justify-center p-12">
          <SignIn routing="hash" forceRedirectUrl={typeof window !== 'undefined' ? window.location.href : undefined} />
        </div>
      );
    }

    throw error;
  },
  component: AuthedLayout,
});

function AuthedLayout() {
  return (
    <VoiceCommandProvider>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
            <AppBreadcrumb className="flex-1" />
            <VoiceButton />
            <VoiceHistory />
            {/* Clerk renders the button only in the browser, which breaks hydration when server-rendered */}
            <ClientOnly fallback={<Skeleton className="size-7 rounded-full" />}>
              <UserButton />
            </ClientOnly>
          </header>
          <main className="p-4 sm:p-8">
            <Outlet />
          </main>
        </SidebarInset>
      </SidebarProvider>
    </VoiceCommandProvider>
  );
}
