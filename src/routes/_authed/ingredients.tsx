import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authed/ingredients")({
  //   component: RouteComponent,
  context: () => ({ title: "Ingredients" }),
});
