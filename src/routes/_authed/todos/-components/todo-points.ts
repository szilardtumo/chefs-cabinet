import type { Todo } from '@convex/todos';
import { differenceInCalendarDays, differenceInWeeks, parseISO } from 'date-fns';
import { sumBy, upperFirst } from 'es-toolkit';

export const PRIORITY_POINTS = { low: 1, medium: 3, high: 5 } as const;

/** Days from `today` to a 'yyyy-MM-dd' day; negative when it has passed. */
export function daysUntil(day: string, today: Date) {
  return differenceInCalendarDays(parseISO(day), today);
}

/**
 * How urgent an open to-do is, from its priority, due date, planned date and age; the list puts the most points
 * first. `parts` explain the total.
 */
export function getTodoPoints(todo: Todo, today: Date) {
  const parts: { label: string; points: number }[] = [];

  if (todo.priority) {
    parts.push({
      label: `${upperFirst(todo.priority)} priority`,
      points: { low: 1, medium: 3, high: 5 }[todo.priority],
    });
  }

  if (todo.dueDate) {
    const days = daysUntil(todo.dueDate, today);
    if (days < 0) parts.push({ label: `${-days}d overdue`, points: 6 + Math.min(-days, 4) });
    else if (days === 0) parts.push({ label: 'Due today', points: 6 });
    else if (days === 1) parts.push({ label: 'Due tomorrow', points: 4 });
    else if (days <= 7) parts.push({ label: 'Due this week', points: 2 });
  }

  if (todo.plannedDate && daysUntil(todo.plannedDate, today) <= 0) {
    parts.push({ label: 'Planned for today', points: 2 });
  }

  // Lets to-dos without dates rise slowly, so they don't sit at the bottom forever
  const weeksOpen = Math.min(differenceInWeeks(today, todo._creationTime), 3);
  if (weeksOpen > 0) parts.push({ label: `Open ${weeksOpen}w`, points: weeksOpen });

  return { points: sumBy(parts, (part) => part.points), parts };
}
