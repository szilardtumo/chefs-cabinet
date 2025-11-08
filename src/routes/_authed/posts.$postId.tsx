import { convexQuery } from "@convex-dev/react-query";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ErrorComponent, createFileRoute } from "@tanstack/react-router";
import type { ErrorComponentProps } from "@tanstack/react-router";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { NotFound } from "@/components/NotFound.js";

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
    <div className="space-y-2">
      <h4 className="text-xl font-bold underline">{post.title}</h4>
      <div className="text-sm">{post.body}</div>
    </div>
  );
}
