import { api } from '@convex/_generated/api';
import { convexQuery } from '@convex-dev/react-query';
import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, Link, Outlet } from '@tanstack/react-router';
import { groupBy } from 'es-toolkit';
import { ChartNoAxesColumn, Library, Plus, Search } from 'lucide-react';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BookCard } from './-components/book-card';
import { BOOK_STATUS_META, BOOK_STATUSES } from './-components/book-status';
import { BookStatusIcon } from './-components/book-status-picker';

// What you're reading now comes first in the library
const LIBRARY_STATUS_ORDER = ['in_progress', 'not_started', 'done', 'cancelled'] as const;

export const Route = createFileRoute('/_authed/books/_library')({
  component: BooksComponent,
  context: () => ({ title: 'Library' }),
  validateSearch: z.object({
    status: z.enum(BOOK_STATUSES).optional().catch(undefined),
    q: z.string().optional().catch(undefined),
  }),
});

function BooksComponent() {
  const { data: books } = useSuspenseQuery(convexQuery(api.books.getAll, {}));
  const { status, q = '' } = Route.useSearch();
  const navigate = Route.useNavigate();

  const query = q.trim().toLowerCase();
  const matchingBooks = books
    .filter(
      (book) =>
        !query ||
        book.title.toLowerCase().includes(query) ||
        book.author.toLowerCase().includes(query) ||
        book.genres.some((genre) => genre.toLowerCase().includes(query)),
    )
    .sort(
      (a, b) =>
        (b.completedAt ?? b.cancelledAt ?? b.startedAt ?? b._creationTime) -
        (a.completedAt ?? a.cancelledAt ?? a.startedAt ?? a._creationTime),
    );
  const booksByStatus = groupBy(matchingBooks, (book) => book.status);
  const visibleStatuses = (status ? [status] : LIBRARY_STATUS_ORDER).filter((s) => booksByStatus[s]?.length);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Books</h1>
          <p className="text-muted-foreground">Your reading library</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link to="/books/stats">
              <ChartNoAxesColumn />
              Stats
            </Link>
          </Button>
          <Button asChild>
            <Link to="/books/new" search={(prev) => prev}>
              <Plus />
              Add Book
            </Link>
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-4 pt-6 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by title, author, or genre..."
              value={q}
              onChange={(e) =>
                navigate({ search: (prev) => ({ ...prev, q: e.target.value || undefined }), replace: true })
              }
              className="pl-9"
            />
          </div>
          <Tabs
            value={status ?? 'all'}
            onValueChange={(value) =>
              navigate({
                search: (prev) => ({ ...prev, status: value === 'all' ? undefined : (value as typeof status) }),
                replace: true,
              })
            }
          >
            <TabsList className="w-full justify-start overflow-x-auto">
              <TabsTrigger value="all">
                All<span className="text-xs text-muted-foreground tabular-nums">{matchingBooks.length}</span>
              </TabsTrigger>
              {LIBRARY_STATUS_ORDER.map((s) => (
                <TabsTrigger key={s} value={s}>
                  <BookStatusIcon status={s} />
                  {BOOK_STATUS_META[s].label}
                  <span className="text-xs text-muted-foreground tabular-nums">{booksByStatus[s]?.length ?? 0}</span>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </CardContent>
      </Card>

      {visibleStatuses.length === 0 ? (
        <Empty className="border border-dashed">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Library />
            </EmptyMedia>
            {books.length === 0 ? (
              <>
                <EmptyTitle>No books yet</EmptyTitle>
                <EmptyDescription>Start building your reading library!</EmptyDescription>
              </>
            ) : (
              <>
                <EmptyTitle>No matching books</EmptyTitle>
                <EmptyDescription>Try a different search or status.</EmptyDescription>
              </>
            )}
          </EmptyHeader>
          {books.length === 0 && (
            <EmptyContent>
              <Button asChild>
                <Link to="/books/new" search={(prev) => prev}>
                  Add Your First Book
                </Link>
              </Button>
            </EmptyContent>
          )}
        </Empty>
      ) : (
        visibleStatuses.map((s) => (
          <section key={s} className="flex flex-col gap-3">
            {!status && (
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                <BookStatusIcon status={s} className="size-5 text-muted-foreground" />
                {BOOK_STATUS_META[s].label}
                <span className="font-normal text-muted-foreground">{booksByStatus[s].length}</span>
              </h2>
            )}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
              {booksByStatus[s].map((book) => (
                <BookCard key={book._id} book={book} />
              ))}
            </div>
          </section>
        ))
      )}
      <Outlet />
    </div>
  );
}
