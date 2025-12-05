import { createFileRoute, Outlet } from '@tanstack/react-router';

export const Route = createFileRoute('/_authed/ingredients')({
  component: RouteComponent,
  context: () => ({ title: 'Ingredients' }),
});

function RouteComponent() {
  return <Outlet />;
}
