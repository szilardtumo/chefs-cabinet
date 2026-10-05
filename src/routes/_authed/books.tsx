import { createFileRoute, Outlet } from '@tanstack/react-router';

export const Route = createFileRoute('/_authed/books')({
  component: RouteComponent,
  context: () => ({ title: 'Books' }),
});

function RouteComponent() {
  return <Outlet />;
}
