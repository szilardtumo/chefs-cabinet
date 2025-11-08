import { convexQuery } from "@convex-dev/react-query";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ErrorComponent, createFileRoute } from "@tanstack/react-router";
import type { ErrorComponentProps } from "@tanstack/react-router";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { NotFound } from "@/components/NotFound.js";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const Route = createFileRoute("/_authed/posts/$postId")({
  loader: ({ params: { postId }, context: { queryClient } }) =>
    queryClient.ensureQueryData(
      convexQuery(api.posts.getById, { id: postId as Id<"posts"> })
    ),
  component: PostComponent,
  notFoundComponent: () => {
    return <NotFound>Post not found</NotFound>;
  },
});

function PostComponent() {
  const id = Route.useParams().postId as Id<"posts">;
  const { data: post } = useSuspenseQuery(
    convexQuery(api.posts.getById, { id })
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>{post.title}</CardTitle>
        <CardDescription>Post details</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm leading-relaxed">{post.body}</p>
      </CardContent>
    </Card>
  );
}
