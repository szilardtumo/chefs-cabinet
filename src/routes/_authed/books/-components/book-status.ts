import type { api } from '@convex/_generated/api';
import type { FunctionReturnType } from 'convex/server';
import { Bookmark, BookOpen, CircleCheck, CircleX, type LucideIcon } from 'lucide-react';
import type { ComponentProps } from 'react';
import type { Badge } from '@/components/ui/badge';

// Kept out of the component files so editing them stays a Fast Refresh instead of a full page reload

export type BookStatus = FunctionReturnType<typeof api.books.getAll>[number]['status'];

export const BOOK_STATUSES = [
  'not_started',
  'in_progress',
  'done',
  'cancelled',
] as const satisfies readonly BookStatus[];

export const BOOK_STATUS_META: Record<
  BookStatus,
  { label: string; variant: ComponentProps<typeof Badge>['variant']; icon: LucideIcon }
> = {
  not_started: { label: 'Want to read', variant: 'outline', icon: Bookmark },
  in_progress: { label: 'Reading', variant: 'info-soft', icon: BookOpen },
  done: { label: 'Finished', variant: 'success-soft', icon: CircleCheck },
  cancelled: { label: 'Did not finish', variant: 'destructive-soft', icon: CircleX },
};
