import { api } from '@convex/_generated/api';
import { convexQuery, useConvexMutation } from '@convex-dev/react-query';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { startOfToday } from 'date-fns';
import { sortBy } from 'es-toolkit';
import { BookOpen, Flame, Library, Sparkles } from 'lucide-react';
import { useEffect } from 'react';
import { RecipeCard } from '@/components/recipe-card';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { formatDate } from '@/lib/format';
import { BookCard } from './books/-components/book-card';
import { getCurrentStreak, getPagesByDay } from './books/-components/reading-days';
import { ShoppingList } from './shopping/-components/ShoppingList';

export const Route = createFileRoute('/_authed/dashboard')({
  // The date, today's pages and the streak follow the reader's local day, which the server can't know
  ssr: false,
  component: DashboardComponent,
});

function DashboardComponent() {
  const { mutateAsync: seedUserData } = useMutation({
    mutationFn: useConvexMutation(api.seed.seedUserData),
  });
  const { mutateAsync: checkSeeded } = useMutation({
    mutationFn: useConvexMutation(api.seed.checkSeeded),
  });

  // Auto-seed on first visit
  useEffect(() => {
    const initializeData = async () => {
      const result = await checkSeeded(undefined);
      if (!result.isSeeded) {
        await seedUserData(undefined);
      }
    };
    initializeData();
  }, [checkSeeded, seedUserData]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-3xl font-bold tracking-tight">
        {formatDate(new Date(), { weekday: 'long', year: undefined })}
      </h1>

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <ReadingNowCard />
        <ShoppingCard />
      </div>

      <RecentRecipesCard />
    </div>
  );
}

function ReadingNowCard() {
  const { data: books } = useSuspenseQuery(convexQuery(api.books.getAll, {}));
  const { data: readingEvents } = useSuspenseQuery(convexQuery(api.readingEvents.getAll, {}));

  const pagesByDay = getPagesByDay(readingEvents);
  const pagesToday = pagesByDay[startOfToday().getTime()] ?? 0;
  const streak = getCurrentStreak(pagesByDay);
  const readingBooks = sortBy(
    books.filter((book) => book.status === 'in_progress'),
    [(book) => -(book.lastReadAt ?? book.startedAt ?? 0)],
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Reading now</CardTitle>
        <CardDescription className="flex items-center gap-1.5">
          {pagesToday ? `${pagesToday} pages today` : 'No reading logged today'}
          {streak > 0 && (
            <>
              <span aria-hidden>·</span>
              <Flame className="size-3.5 text-brand" />
              {streak} day streak
            </>
          )}
        </CardDescription>
        <CardAction>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/books">Library</Link>
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        {readingBooks.length === 0 ? (
          <Empty className="border border-dashed">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Library />
              </EmptyMedia>
              <EmptyTitle>No book in progress</EmptyTitle>
              <EmptyDescription>Start one from your want-to-read shelf.</EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button variant="outline" size="sm" asChild>
                <Link to="/books" search={{ status: 'not_started' }}>
                  Want to read
                </Link>
              </Button>
            </EmptyContent>
          </Empty>
        ) : (
          <div className="flex flex-col gap-4">
            {readingBooks.map((book) => (
              <BookCard key={book._id} book={book} orientation="horizontal" />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ShoppingCard() {
  const { data: list } = useSuspenseQuery(convexQuery(api.shoppingLists.get, {}));
  const toBuy = list?.items.filter((item) => !item.checked && !item.skipped).length ?? 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Shopping list</CardTitle>
        <CardDescription>{toBuy ? `${toBuy} to buy` : 'Nothing to buy'}</CardDescription>
        <CardAction>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/shopping">Open</Link>
          </Button>
        </CardAction>
      </CardHeader>
      {list && (
        <CardContent>
          <ShoppingList list={list} />
        </CardContent>
      )}
    </Card>
  );
}

function RecentRecipesCard() {
  const { data: recipes } = useSuspenseQuery(convexQuery(api.recipes.getAll, {}));

  const recentRecipes = sortBy(recipes, [(recipe) => -recipe.updatedAt]).slice(0, 6);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recently updated recipes</CardTitle>
        <CardAction className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link to="/recipes/import">
              <Sparkles />
              Import recipe
            </Link>
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/recipes">All recipes</Link>
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        {recentRecipes.length === 0 ? (
          <Empty className="border border-dashed">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <BookOpen />
              </EmptyMedia>
              <EmptyTitle>No recipes yet</EmptyTitle>
              <EmptyDescription>Import one from a link or write your own.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {recentRecipes.map((recipe) => (
              <RecipeCard key={recipe._id} recipe={recipe} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
