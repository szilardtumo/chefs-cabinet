import { api } from '@convex/_generated/api';
import { convexQuery } from '@convex-dev/react-query';
import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { startOfToday } from 'date-fns';
import { z } from 'zod';
import { zodConvexId } from '@/utils/validation';
import { ListActions } from './-components/list-actions';
import { ListPicker } from './-components/list-picker';
import { TodoList } from './-components/todo-list';

export const Route = createFileRoute('/_authed/todos/')({
  // "Today" and "done today" follow the user's local day, which the server can't know
  ssr: false,
  component: TodosComponent,
  context: () => ({ title: 'To-dos' }),
  // The selected extra list; the main list has none
  validateSearch: z.object({ list: zodConvexId<'todoLists'>().optional().catch(undefined) }),
});

function TodosComponent() {
  const { list: listId } = Route.useSearch();
  const navigate = Route.useNavigate();
  const { data: lists } = useSuspenseQuery(convexQuery(api.todoLists.getAll, {}));
  // An unknown id, e.g. of a deleted list, falls back to the main list
  const list = lists.find((item) => item._id === listId);
  const { data: todos } = useSuspenseQuery(
    convexQuery(api.todos.getAll, { listId: list?._id, completedSince: startOfToday().getTime() }),
  );
  const open = todos.filter((todo) => !todo.completedAt).length;

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-3xl font-bold tracking-tight">{list?.name ?? 'To-dos'}</h1>
          {list && <ListActions list={list} onDeleted={() => navigate({ search: {} })} />}
        </div>
        <p className="text-muted-foreground">
          {open} to do · {todos.length - open} done today
        </p>
      </div>
      <ListPicker lists={lists} list={list} onSelect={(id) => navigate({ search: { list: id } })} />
      <TodoList key={list?._id ?? 'main'} todos={todos} listId={list?._id} />
    </div>
  );
}
