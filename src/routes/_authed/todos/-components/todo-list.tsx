import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import type { Todo } from '@convex/todos';
import { useConvexMutation } from '@convex-dev/react-query';
import { useMutation } from '@tanstack/react-query';
import type { OptimisticLocalStore } from 'convex/browser';
import { addDays, format, parseISO, startOfToday } from 'date-fns';
import { partition, sortBy, upperFirst } from 'es-toolkit';
import { CalendarCheck, CalendarClock, CalendarX, Edit, Flag, Hourglass, ListTodo, Plus, Trash } from 'lucide-react';
import { AnimatePresence } from 'motion/react';
import { useState } from 'react';
import { CheckListItem } from '@/components/check-list-item';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from '@/components/ui/dropdown-menu';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from '@/components/ui/input-group';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { toastError, toastWithUndo } from '@/lib/toast';
import { cn } from '@/lib/utils';
import { TodoDialog } from './todo-dialog';
import { daysUntil, getTodoPoints, PRIORITY_POINTS } from './todo-points';

type EditableFields = Pick<Todo, 'title' | 'notes' | 'priority' | 'plannedDate' | 'dueDate'>;

function patchTodos(localStore: OptimisticLocalStore, change: (todos: Todo[]) => Todo[]) {
  for (const { args, value } of localStore.getAllQueries(api.todos.getAll)) {
    if (value) localStore.setQuery(api.todos.getAll, args, change(value));
  }
}

/** 'Today', 'Tue' or 'Mar 3' for a 'yyyy-MM-dd' day. */
function formatDay(day: string, today: Date) {
  const days = daysUntil(day, today);
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days === -1) return 'Yesterday';
  return format(parseISO(day), Math.abs(days) < 7 ? 'EEE' : 'MMM d');
}

/** The add field and the to-dos of a list (the main list without `listId`), shared by the to-dos page and the dashboard. */
export function TodoList({ todos, listId }: { todos: Todo[]; listId?: Id<'todoLists'> }) {
  const { mutateAsync: addTodo } = useMutation({ mutationFn: useConvexMutation(api.todos.add) });
  const { mutateAsync: updateTodo } = useMutation({
    mutationFn: useConvexMutation(api.todos.update).withOptimisticUpdate((localStore, { id, ...fields }) =>
      patchTodos(localStore, (todos) => todos.map((todo) => (todo._id === id ? { ...todo, ...fields } : todo))),
    ),
  });
  const { mutateAsync: toggleCompleted } = useMutation({
    mutationFn: useConvexMutation(api.todos.toggleCompleted).withOptimisticUpdate((localStore, { id }) =>
      patchTodos(localStore, (todos) =>
        todos.map((todo) =>
          todo._id === id ? { ...todo, completedAt: todo.completedAt ? undefined : Date.now() } : todo,
        ),
      ),
    ),
  });
  const { mutateAsync: removeTodo } = useMutation({
    mutationFn: useConvexMutation(api.todos.remove).withOptimisticUpdate((localStore, { id }) =>
      patchTodos(localStore, (todos) => todos.filter((todo) => todo._id !== id)),
    ),
  });

  const [title, setTitle] = useState('');
  const [editing, setEditing] = useState<Todo | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  const today = startOfToday();
  const todayKey = format(today, 'yyyy-MM-dd');
  const tomorrowKey = format(addDays(today, 1), 'yyyy-MM-dd');

  const handleAdd = async () => {
    const newTitle = title.trim();
    if (!newTitle) return;
    setTitle('');
    try {
      await addTodo({ listId, title: newTitle });
    } catch (error) {
      setTitle(newTitle);
      toastError(error);
    }
  };

  const save = (todo: Todo, changes: Partial<EditableFields>) => {
    const { title, notes, priority, plannedDate, dueDate } = todo;
    updateTodo({ id: todo._id, title, notes, priority, plannedDate, dueDate, ...changes }).catch(toastError);
  };

  const handleRemove = async (todo: Todo) => {
    try {
      await removeTodo({ id: todo._id });
      const { title, notes, priority, plannedDate, dueDate } = todo;
      toastWithUndo('To-do deleted', () => addTodo({ listId, title, notes, priority, plannedDate, dueDate }));
    } catch (error) {
      toastError(error);
    }
  };

  // Open to-dos by points, then the ones done today, in the order they were done
  const [done, open] = partition(todos, (todo) => !!todo.completedAt);
  const rows = [
    ...sortBy(
      open.map((todo) => ({ todo, ...getTodoPoints(todo, today) })),
      [(row) => -row.points, (row) => row.todo.dueDate ?? '9999', (row) => row.todo._creationTime],
    ),
    ...sortBy(done, [(todo) => todo.completedAt ?? 0]).map((todo) => ({ todo, points: undefined, parts: [] })),
  ];

  return (
    <div className="space-y-6">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleAdd();
        }}
      >
        <InputGroup>
          <InputGroupInput value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Add a to-do..." />
          <InputGroupAddon align="inline-end">
            <InputGroupButton type="submit" size="icon-xs" disabled={!title.trim()} aria-label="Add to-do">
              <Plus />
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
      </form>

      {rows.length === 0 ? (
        <Empty className="border border-dashed">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ListTodo />
            </EmptyMedia>
            <EmptyTitle>Nothing to do</EmptyTitle>
            <EmptyDescription>Type a to-do above and press Enter</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="space-y-2">
          <AnimatePresence>
            {rows.map(({ todo, points, parts }) => (
              <CheckListItem
                key={todo._id}
                id={todo._id}
                checked={!!todo.completedAt}
                onCheckedChange={() => toggleCompleted({ id: todo._id }).catch(toastError)}
                dimmed={!!todo.plannedDate && daysUntil(todo.plannedDate, today) > 1}
                title={todo.title}
                notes={todo.notes}
                description={
                  (todo.plannedDate || todo.dueDate) && (
                    <>
                      {todo.plannedDate && (
                        <span className="flex items-center gap-1">
                          <CalendarClock className="size-3.5" />
                          {formatDay(todo.plannedDate, today)}
                        </span>
                      )}
                      {todo.dueDate && <DueDate day={todo.dueDate} today={today} done={!!todo.completedAt} />}
                    </>
                  )
                }
                trailing={
                  points !== undefined && (
                    <Popover>
                      <PopoverTrigger asChild>
                        <Badge
                          asChild
                          variant={points >= 8 ? 'destructive-soft' : points >= 4 ? 'brand-soft' : 'secondary'}
                          // No taller than the title line, so checking a to-do, which hides the badge, keeps the row height
                          className="h-5 py-0 cursor-default tabular-nums"
                        >
                          <button type="button">{points} pts</button>
                        </Badge>
                      </PopoverTrigger>
                      <PopoverContent side="top" className="w-fit py-3 text-sm">
                        {parts.length === 0 ? (
                          <p className="text-muted-foreground">No priority or dates yet</p>
                        ) : (
                          parts.map((part) => (
                            <p key={part.label} className="flex justify-between gap-4">
                              <span className="text-muted-foreground">{part.label}</span>+{part.points}
                            </p>
                          ))
                        )}
                      </PopoverContent>
                    </Popover>
                  )
                }
                menu={
                  <>
                    {todo.plannedDate !== todayKey && (
                      <DropdownMenuItem onSelect={() => save(todo, { plannedDate: todayKey })}>
                        <CalendarCheck /> Plan for today
                      </DropdownMenuItem>
                    )}
                    {todo.plannedDate !== tomorrowKey && (
                      <DropdownMenuItem onSelect={() => save(todo, { plannedDate: tomorrowKey })}>
                        <CalendarClock /> Plan for tomorrow
                      </DropdownMenuItem>
                    )}
                    {todo.plannedDate && (
                      <DropdownMenuItem onSelect={() => save(todo, { plannedDate: undefined })}>
                        <CalendarX /> Clear plan
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger>
                        <Flag /> Priority
                      </DropdownMenuSubTrigger>
                      <DropdownMenuSubContent>
                        <DropdownMenuRadioGroup
                          value={todo.priority ?? 'none'}
                          onValueChange={(value) =>
                            save(todo, { priority: value === 'none' ? undefined : (value as Todo['priority']) })
                          }
                        >
                          <DropdownMenuRadioItem value="none">None</DropdownMenuRadioItem>
                          {Object.entries(PRIORITY_POINTS).map(([priority, points]) => (
                            <DropdownMenuRadioItem key={priority} value={priority}>
                              {upperFirst(priority)}
                              <DropdownMenuShortcut>+{points} pts</DropdownMenuShortcut>
                            </DropdownMenuRadioItem>
                          ))}
                        </DropdownMenuRadioGroup>
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onSelect={() => {
                        setEditing(todo);
                        setEditOpen(true);
                      }}
                    >
                      <Edit /> Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => handleRemove(todo)}>
                      <Trash /> Delete
                    </DropdownMenuItem>
                  </>
                }
              />
            ))}
          </AnimatePresence>
        </div>
      )}
      <TodoDialog todo={editing} open={editOpen} onOpenChange={setEditOpen} />
    </div>
  );
}

function DueDate({ day, today, done }: { day: string; today: Date; done: boolean }) {
  const days = daysUntil(day, today);
  const label =
    days < 0
      ? `${-days}d overdue`
      : days === 0
        ? 'Due today'
        : days === 1
          ? 'Due tomorrow'
          : `Due ${formatDay(day, today)}`;
  return (
    <span className={cn('flex items-center gap-1', days <= 0 && !done && 'text-destructive')}>
      <Hourglass className="size-3.5" />
      {label}
    </span>
  );
}
