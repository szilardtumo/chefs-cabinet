import { api } from '@convex/_generated/api';
import { convexQuery } from '@convex-dev/react-query';
import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { differenceInDays } from 'date-fns';
import { countBy, groupBy, mean, range, sumBy } from 'es-toolkit';
import { ChartNoAxesColumn } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, LabelList, Pie, PieChart, XAxis } from 'recharts';
import { z } from 'zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { BookCover } from './-components/book-cover';

export const Route = createFileRoute('/_authed/books/stats')({
  // Books are grouped by the reader's local month and year, which the server can't know
  ssr: false,
  component: BookStatsComponent,
  context: () => ({ title: 'Stats' }),
  validateSearch: z.object({
    year: z
      .union([z.literal('all'), z.number().int()])
      .optional()
      .catch(undefined),
  }),
});

const MONTHS = Array.from({ length: 12 }, (_, month) =>
  new Date(2000, month).toLocaleString('en-US', { month: 'short' }),
);

const booksChartConfig = {
  count: { label: 'Books', color: 'var(--chart-1)' },
} satisfies ChartConfig;

function BookStatsComponent() {
  const { data: books } = useSuspenseQuery(convexQuery(api.books.getAll, {}));
  const search = Route.useSearch();
  const navigate = Route.useNavigate();

  const finishedBooks = books.flatMap((book) =>
    book.status === 'done' && book.completedAt !== undefined
      ? [{ ...book, completedAt: book.completedAt, completedDate: new Date(book.completedAt) }]
      : [],
  );
  const years = [...new Set(finishedBooks.map((book) => book.completedDate.getFullYear()))].sort((a, b) => b - a);

  if (years.length === 0) {
    return (
      <Empty className="border border-dashed">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <ChartNoAxesColumn />
          </EmptyMedia>
          <EmptyTitle>No stats yet</EmptyTitle>
          <EmptyDescription>Finish a book to see your reading stats.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  const period =
    search.year === 'all' || (search.year && years.includes(search.year)) ? search.year : Math.max(...years);
  const isAll = period === 'all';
  const unit = isAll ? 'year' : 'month';
  const periodBooks = finishedBooks
    .filter((book) => isAll || book.completedDate.getFullYear() === period)
    .sort((a, b) => a.completedAt - b.completedAt);
  const booksByBucket = groupBy(periodBooks, (book) =>
    isAll ? book.completedDate.getFullYear() : book.completedDate.getMonth(),
  );
  // All time includes years without a finished book, like a single year includes empty months
  const buckets = (
    isAll
      ? range(Math.min(...years), Math.max(...years) + 1).map((key) => ({ key, label: String(key) }))
      : MONTHS.map((label, key) => ({ key, label }))
  ).map((bucket) => {
    const bucketBooks = booksByBucket[bucket.key] ?? [];
    return { ...bucket, books: bucketBooks, count: bucketBooks.length };
  });
  // Books marked finished without a start date get both dates set at once, which says nothing about reading time
  const daysToFinish = periodBooks.flatMap((book) =>
    book.startedAt === undefined || book.startedAt === book.completedAt
      ? []
      : [Math.max(1, differenceInDays(book.completedAt, book.startedAt))],
  );
  const ratings = periodBooks.flatMap((book) => (book.rating === undefined ? [] : [book.rating]));
  // Books carry several genres each, so a catch-all slice would dwarf the top genres; show only those
  const genreData = Object.entries(
    countBy(
      periodBooks.flatMap((book) => book.genres),
      (genre) => genre,
    ),
  )
    .sort(([, a], [, b]) => b - a)
    .slice(0, 6)
    // Chart config keys become CSS variables, so slices use generated keys instead of genre names
    .map(([genre, count], index) => ({ key: `genre${index}`, genre, count, fill: `var(--chart-${index + 1})` }));
  const genresChartConfig = Object.fromEntries(
    genreData.map((slice) => [slice.key, { label: slice.genre, color: slice.fill }]),
  ) satisfies ChartConfig;

  const tiles = [
    { label: 'Books read', value: periodBooks.length },
    // Books marked finished without logging progress still count their full length
    {
      label: 'Pages read',
      value: sumBy(periodBooks, (book) => book.pagesRead || (book.pageCount ?? 0)).toLocaleString('en-US'),
    },
    { label: 'Avg. days to finish', value: daysToFinish.length ? Math.round(mean(daysToFinish)) : '–' },
    { label: 'Avg. rating', value: ratings.length ? `${mean(ratings).toFixed(1)} ★` : '–' },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Reading stats</h1>
          <p className="text-muted-foreground">{isAll ? 'Your whole reading history' : `Your ${period} in books`}</p>
        </div>
        <Tabs
          value={String(period)}
          onValueChange={(value) =>
            navigate({ search: { year: value === 'all' ? 'all' : Number(value) }, replace: true })
          }
        >
          <TabsList className="max-w-full overflow-x-auto">
            <TabsTrigger value="all">All</TabsTrigger>
            {years.map((year) => (
              <TabsTrigger key={year} value={String(year)} className="tabular-nums">
                {year}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {tiles.map((tile) => (
          <Card key={tile.label}>
            <CardHeader>
              <CardDescription>{tile.label}</CardDescription>
              <CardTitle className="text-3xl tabular-nums">{tile.value}</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Books per {unit}</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={booksChartConfig} className="aspect-auto h-56 w-full">
              <BarChart accessibilityLayer data={buckets} margin={{ top: 20 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
                <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
                <Bar dataKey="count" fill="var(--color-count)" radius={4}>
                  <LabelList
                    position="top"
                    offset={8}
                    className="fill-muted-foreground"
                    fontSize={12}
                    formatter={(value: number) => value || ''}
                  />
                </Bar>
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top genres</CardTitle>
          </CardHeader>
          <CardContent>
            {genreData.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">No genres on these books yet</p>
            ) : (
              <ChartContainer config={genresChartConfig} className="aspect-auto h-64 w-full">
                <PieChart>
                  <ChartTooltip content={<ChartTooltipContent nameKey="key" hideLabel />} />
                  <Pie
                    data={genreData}
                    dataKey="count"
                    nameKey="key"
                    innerRadius="40%"
                    outerRadius="65%"
                    stroke="var(--card)"
                    strokeWidth={2}
                    labelLine={{ stroke: 'var(--muted-foreground)' }}
                    label={({ payload, x, y, textAnchor }) => (
                      <text
                        x={x}
                        y={y}
                        textAnchor={textAnchor}
                        dominantBaseline="central"
                        className="fill-foreground text-xs"
                      >
                        {payload.genre}
                      </text>
                    )}
                  />
                </PieChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{isAll ? 'Everything finished' : `Finished in ${period}`}</CardTitle>
          <CardDescription>Every book you finished, by {unit}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {buckets.map((bucket) => (
            <div
              key={bucket.key}
              className={cn(
                'flex min-h-28 flex-col gap-2 rounded-lg border p-3',
                bucket.count === 0 && 'border-dashed',
              )}
            >
              <div className="flex items-baseline justify-between text-sm">
                <span className="font-medium">{bucket.label}</span>
                <span className="tabular-nums text-muted-foreground">{bucket.count}</span>
              </div>
              {bucket.count > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {bucket.books.map((book) => (
                    <Link key={book._id} to="/books/$bookId" params={{ bookId: book._id }} title={book.title}>
                      <BookCover book={book} className="w-10 transition-shadow hover:shadow-lg" />
                    </Link>
                  ))}
                </div>
              ) : (
                <span className="text-xs text-muted-foreground">Nothing finished</span>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
