import type { api } from '@convex/_generated/api';
import type { FunctionReturnType } from 'convex/server';
import { startOfDay, startOfToday, subDays } from 'date-fns';
import { groupBy, mapValues, sumBy } from 'es-toolkit';

type ReadingEvent = FunctionReturnType<typeof api.readingEvents.getAll>[number];

/** Net pages per local day, keyed by the day's start time. */
export function getPagesByDay(readingEvents: ReadingEvent[]) {
  // A day of only corrections counts as no reading rather than negative reading
  return mapValues(
    groupBy(readingEvents, (event) => startOfDay(event.at).getTime()),
    (dayEvents) =>
      Math.max(
        0,
        sumBy(dayEvents, (event) => event.pagesDelta),
      ),
  );
}

export function getCurrentStreak(pagesByDay: Record<number, number>) {
  const today = startOfToday();
  // A streak is still alive until today ends, so it counts back from yesterday when today has no reading yet
  let streak = 0;
  for (let day = pagesByDay[today.getTime()] ? today : subDays(today, 1); pagesByDay[day.getTime()]; ) {
    streak++;
    day = subDays(day, 1);
  }
  return streak;
}
