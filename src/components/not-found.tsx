import { Link } from '@tanstack/react-router';
import { FileQuestion } from 'lucide-react';
import type React from 'react';
import { Button } from '@/components/ui/button';
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';

export function NotFound({ children, ...props }: React.ComponentProps<typeof Empty>) {
  return (
    <Empty {...props}>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <FileQuestion />
        </EmptyMedia>
        <EmptyTitle>Not Found</EmptyTitle>
        <EmptyDescription>{children || 'The page you are looking for does not exist.'}</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <div className="flex gap-2">
          <Button onClick={() => window.history.back()} variant="outline">
            Go Back
          </Button>
          <Button asChild>
            <Link to="/">Go Home</Link>
          </Button>
        </div>
      </EmptyContent>
    </Empty>
  );
}
