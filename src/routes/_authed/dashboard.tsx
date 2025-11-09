import { createFileRoute, Link } from "@tanstack/react-router";
import { AppLayout } from "@/components/app-layout";
import { useConvexQuery } from "@convex-dev/react-query";
import { api } from "@convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, BookOpen, Carrot, ShoppingCart } from "lucide-react";
import { useMutation } from "convex/react";
import { useEffect } from "react";

export const Route = createFileRoute("/_authed/dashboard")({
  component: DashboardComponent,
});

function DashboardComponent() {
  const recipes = useConvexQuery(api.recipes.getAll, {});
  const ingredients = useConvexQuery(api.ingredients.getAll, {});
  const shoppingLists = useConvexQuery(api.shoppingLists.getActive, {});

  const seedUserData = useMutation(api.seed.seedUserData);
  const checkSeeded = useMutation(api.seed.checkSeeded);

  // Auto-seed on first visit
  useEffect(() => {
    const initializeData = async () => {
      const result = await checkSeeded();
      if (!result.isSeeded) {
        await seedUserData();
      }
    };
    initializeData();
  }, []);

  const stats = [
    {
      title: "Total Recipes",
      value: recipes?.length || 0,
      icon: BookOpen,
      color: "text-blue-600",
    },
    {
      title: "Total Ingredients",
      value: ingredients?.length || 0,
      icon: Carrot,
      color: "text-green-600",
    },
  ];

  const recentRecipes = recipes?.slice(0, 6) || [];

  return (
    <AppLayout>
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Welcome to your kitchen management hub
          </p>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-3">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <Card key={stat.title}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    {stat.title}
                  </CardTitle>
                  <Icon className={`h-4 w-4 ${stat.color}`} />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stat.value}</div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Recent Recipes */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-semibold">Recent Recipes</h2>
            <Button asChild>
              <Link to="/recipes/new">
                <Plus className="mr-2 h-4 w-4" />
                Add Recipe
              </Link>
            </Button>
          </div>

          {recentRecipes.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <BookOpen className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground text-center">
                  No recipes yet. Start by creating your first recipe!
                </p>
                <Button asChild className="mt-4">
                  <Link to="/recipes/new">Create Recipe</Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {recentRecipes.map((recipe) => (
                <Card key={recipe._id} className="overflow-hidden">
                  <Link
                    to="/recipes/$recipeId"
                    params={{ recipeId: recipe._id }}
                  >
                    {recipe.imageUrl && (
                      <img
                        src={recipe.imageUrl}
                        alt={recipe.title}
                        className="h-48 w-full object-cover"
                      />
                    )}
                    {!recipe.imageUrl && (
                      <div className="h-48 w-full bg-muted flex items-center justify-center">
                        <BookOpen className="h-12 w-12 text-muted-foreground" />
                      </div>
                    )}
                    <CardHeader>
                      <CardTitle className="line-clamp-1">
                        {recipe.title}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {recipe.description}
                      </p>
                      <div className="mt-2 flex gap-4 text-sm text-muted-foreground">
                        <span>
                          ⏱️ {recipe.cookingTime + recipe.prepTime} min
                        </span>
                        <span>🍽️ {recipe.servings} servings</span>
                      </div>
                    </CardContent>
                  </Link>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
