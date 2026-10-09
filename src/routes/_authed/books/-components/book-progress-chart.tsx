import { api } from '@convex/_generated/api';
import { convexQuery } from '@convex-dev/react-query';
import { useQuery } from '@tanstack/react-query';
import type { FunctionReturnType } from 'convex/server';
import { addHours, format, startOfDay } from 'date-fns';
import { groupBy, sumBy } from 'es-toolkit';
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';

type Book = FunctionReturnType<typeof api.books.getById>;

const chartConfig = {
  pagesRead: { label: 'Page', color: 'var(--brand)' },
} satisfies ChartConfig;

/** The page reached on each day you read the book; hidden until some reading is logged. */
export function BookProgressChart({ book }: { book: Book }) {
  const { data: events } = useQuery(convexQuery(api.readingEvents.getForBook, { bookId: book._id }));
  if (!events?.length) return null;

  // Reading days sit at midday, so reading on the start day still comes after the line's start at midnight
  const midday = (time: number) => addHours(startOfDay(time), 12).getTime();
  const readingDays: { day: number; pagesRead: number; pagesThatDay?: number }[] = Object.values(
    groupBy(events, (event) => startOfDay(event.at).getTime()),
  )
    .map((dayEvents) => ({
      day: midday(dayEvents[0].at),
      pagesRead: dayEvents[dayEvents.length - 1].pagesRead,
      pagesThatDay: Math.max(
        0,
        sumBy(dayEvents, (event) => event.pagesDelta),
      ),
    }))
    .sort((a, b) => a.day - b.day);
  const start = startOfDay(Math.min(book.startedAt ?? events[0].at, events[0].at)).getTime();
  const end = midday(book.completedAt ?? book.cancelledAt ?? Date.now());
  const last = readingDays[readingDays.length - 1];
  const points = [
    // The line starts on the start day at the page before the first logged reading, 0 unless you read before logging
    { day: start, pagesRead: events[0].pagesRead - events[0].pagesDelta },
    ...readingDays,
    // Carries the last page to the end of the axis, so days without reading since then show as a flat line
    ...(end > last.day ? [{ day: end, pagesRead: last.pagesRead }] : []),
  ];

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium">Reading progress</span>
      <ChartContainer config={chartConfig} className="aspect-auto h-40 w-full">
        <AreaChart accessibilityLayer data={points} margin={{ top: 8, right: 24 }}>
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey="day"
            type="number"
            scale="time"
            domain={[start, Math.max(end, last.day)]}
            ticks={[start, Math.max(end, last.day)]}
            tickFormatter={(day: number) => format(day, 'MMM d')}
            tickLine={false}
            axisLine={false}
            tickMargin={8}
          />
          <YAxis
            domain={[0, book.pageCount ?? 'dataMax']}
            // Even ticks don't end at the page count, so a book with a page count shows just the start and the end
            ticks={book.pageCount === undefined ? undefined : [0, book.pageCount]}
            tickLine={false}
            axisLine={false}
            width={32}
            allowDecimals={false}
          />
          <ChartTooltip
            // The points at the start and end of the axis only carry the line, they aren't days of reading
            content={({ active, payload }) =>
              payload?.[0]?.payload.pagesThatDay === undefined ? null : (
                <ChartTooltipContent
                  active={active}
                  payload={payload}
                  labelFormatter={(_, payload) => format(payload[0].payload.day, 'MMM d, yyyy')}
                  formatter={(value, _name, item) => (
                    <div className="flex w-full justify-between gap-4">
                      <span className="text-muted-foreground">Page {value}</span>
                      <span className="tabular-nums">+{item.payload.pagesThatDay} pages</span>
                    </div>
                  )}
                />
              )
            }
          />
          <Area
            dataKey="pagesRead"
            type="monotone"
            stroke="var(--color-pagesRead)"
            strokeWidth={2}
            fill="var(--color-pagesRead)"
            fillOpacity={0.2}
          />
        </AreaChart>
      </ChartContainer>
    </div>
  );
}
