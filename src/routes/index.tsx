import { createFileRoute } from "@tanstack/react-router";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  return (
    <div className="p-4 max-w-4xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle className="text-3xl">Welcome to Chef's Cabinet</CardTitle>
          <CardDescription>
            Your culinary companion powered by Clerk authentication
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            This application demonstrates authentication with Clerk, data
            management with Convex, and a modern UI built with ShadCN
            components.
          </p>
          <div className="pt-4">
            <Button asChild>
              <Link to="/posts">View Posts</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
