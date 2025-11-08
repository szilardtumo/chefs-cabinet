import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
export const Route = createFileRoute("/_authed/posts/")({
  component: PostsIndexComponent,
});

function PostsIndexComponent() {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-muted-foreground text-center py-8">
          Select a post from the list to view its details.
        </p>
      </CardContent>
    </Card>
  );
}
