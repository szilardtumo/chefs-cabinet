import { SignInButton } from '@clerk/tanstack-react-start';
import { createFileRoute, redirect } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';

export const Route = createFileRoute('/')({
  beforeLoad: ({ context }) => {
    if (context.userId) {
      throw redirect({ to: '/dashboard' });
    }
  },
  component: Home,
});

function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="text-center space-y-6 w-full max-w-md">
        <div className="space-y-4">
          <h1 className="text-4xl font-bold">Welcome to Chef's Cabinet</h1>
          <p className="text-muted-foreground text-lg">Your kitchen management companion powered by AI</p>
          <p className="text-sm text-muted-foreground">Please sign in to continue</p>
        </div>
        <div className="flex justify-center">
          <SignInButton forceRedirectUrl="/dashboard">
            <Button size="lg">Sign In</Button>
          </SignInButton>
        </div>
      </div>
    </div>
  );
}
