import type { ErrorComponentProps } from '@tanstack/react-router';
import { Link, rootRouteId, useMatch, useRouter } from '@tanstack/react-router';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';

export function DefaultCatchBoundary({ error }: ErrorComponentProps) {
  const router = useRouter();
  const isRoot = useMatch({
    strict: false,
    select: (state) => state.id === rootRouteId,
  });

  console.error(error);

  return (
    <div className="min-w-0 flex-1 p-4 flex flex-col items-center justify-center">
      <Empty className="max-w-2xl">
        <EmptyHeader>
          <EmptyMedia variant="icon" className="bg-destructive/10 text-destructive">
            <AlertTriangle />
          </EmptyMedia>
          <EmptyTitle>Something went wrong</EmptyTitle>
          <EmptyDescription>
            An error occurred while processing your request. You can try again or go back to the previous page.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          {import.meta.env.DEV && (
            <div className="w-full space-y-2">
              <p className="text-xs text-muted-foreground">Error details (visible in development mode only):</p>
              <pre className="max-w-full max-h-96 overflow-auto p-4 rounded-md bg-muted border text-xs">
                <code>{error.message}</code>
              </pre>
            </div>
          )}

          <div className="flex gap-2 items-center flex-wrap">
            <Button
              onClick={() => {
                router.invalidate();
              }}
            >
              Try Again
            </Button>
            <Button asChild variant="outline">
              {isRoot ? (
                <Link to="/">Go to Home</Link>
              ) : (
                <Link
                  to="/"
                  onClick={(e) => {
                    e.preventDefault();
                    window.history.back();
                  }}
                >
                  Go Back
                </Link>
              )}
            </Button>
          </div>
        </EmptyContent>
      </Empty>
    </div>
  );
}
