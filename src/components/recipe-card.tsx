import type { Id } from '@convex/_generated/dataModel';
import { createFileRoute, Link } from '@tanstack/react-router';
import { BookOpen, Clock, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type Recipe = {
  _id: Id<'recipes'>;
  title: string;
  description?: string;
  imageUrl?: string | null;
  prepTime?: number;
  cookingTime?: number;
  servings?: number;
  tags?: string[];
};

type RecipeCardProps = {
  recipe: Recipe;
};

export function RecipeCard({ recipe }: RecipeCardProps) {
  return (
    <Link to="/recipes/$recipeId" params={{ recipeId: recipe._id }}>
      <Card className="overflow-hidden hover:shadow-lg transition-shadow h-full">
        {recipe.imageUrl ? (
          <img src={recipe.imageUrl} alt={recipe.title} className="h-48 w-full object-cover" />
        ) : (
          <div className="h-48 w-full bg-muted flex items-center justify-center">
            <BookOpen className="h-12 w-12 text-muted-foreground" />
          </div>
        )}
        <CardHeader>
          <CardTitle className="line-clamp-2">{recipe.title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground line-clamp-2">{recipe.description}</p>

          <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
            {(recipe.prepTime !== undefined || recipe.cookingTime !== undefined) && (
              <div className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                <span>{(recipe.prepTime || 0) + (recipe.cookingTime || 0)} min</span>
              </div>
            )}
            {recipe.servings !== undefined && (
              <div className="flex items-center gap-1">
                <Users className="h-4 w-4" />
                <span>{recipe.servings} servings</span>
              </div>
            )}
          </div>

          {recipe.tags && recipe.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {recipe.tags.slice(0, 3).map((tag) => (
                <Badge key={tag} variant="secondary" className="text-xs">
                  {tag}
                </Badge>
              ))}
              {recipe.tags.length > 3 && (
                <Badge variant="secondary" className="text-xs">
                  +{recipe.tags.length - 3}
                </Badge>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}

