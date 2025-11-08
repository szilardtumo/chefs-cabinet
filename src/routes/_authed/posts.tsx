import { convexQuery } from "@convex-dev/react-query";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link, Outlet, createFileRoute } from "@tanstack/react-router";
import { api } from "convex/_generated/api";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/_authed/posts")({
  loader: ({ context: { queryClient } }) =>
    queryClient.ensureQueryData(convexQuery(api.posts.getAll, {})),
  component: PostsComponent,
  pendingComponent: () => (
    <div className="p-4 text-muted-foreground">Loading...</div>
  ),
});

function PostsComponent() {
  const { data: posts } = useSuspenseQuery(convexQuery(api.posts.getAll, {}));

  return (
    <div className="p-4 flex gap-4">
      <Card className="w-64 shrink-0">
        <CardContent className="pt-6">
          <h3 className="font-semibold text-lg mb-4">Posts</h3>
          <ul className="space-y-1">
            {[
              ...posts,
              { _id: "i-do-not-exist", title: "Non-existent Post" },
            ].map((post) => {
              return (
                <li key={post._id}>
                  <Link
                    to="/posts/$postId"
                    params={{
                      postId: post._id,
                    }}
                    className="block py-2 px-3 text-sm rounded-md hover:bg-accent hover:text-accent-foreground transition-colors"
                    activeProps={{
                      className:
                        "bg-primary text-primary-foreground font-medium",
                    }}
                  >
                    <div className="truncate">
                      {post.title.substring(0, 30)}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>
      <div className="flex-1">
        <Outlet />
      </div>
    </div>
  );
}
