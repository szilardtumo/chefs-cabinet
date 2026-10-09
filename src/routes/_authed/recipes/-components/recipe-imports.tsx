import { api } from '@convex/_generated/api';
import { convexQuery, useConvexAction, useConvexMutation } from '@convex-dev/react-query';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { formatDuration, intervalToDuration } from 'date-fns';
import { CircleAlert, CircleCheck, RotateCw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Item, ItemActions, ItemContent, ItemDescription, ItemMedia, ItemTitle } from '@/components/ui/item';
import { Spinner } from '@/components/ui/spinner';
import { useNow } from '@/hooks/use-now';
import { toastError } from '@/lib/toast';

/** Imports that are running, failed, or done but not opened or dismissed yet. */
export function RecipeImports() {
  const { data: imports } = useSuspenseQuery(convexQuery(api.recipeImports.getAll, {}));
  const { mutateAsync: retryImport } = useMutation({ mutationFn: useConvexAction(api.recipesAi.retryImport) });
  const { mutateAsync: dismiss } = useMutation({ mutationFn: useConvexMutation(api.recipeImports.dismiss) });

  // Ticks while an import runs, for its elapsed time
  const now = useNow({ enabled: imports.some((recipeImport) => recipeImport.status === 'pending') });

  if (imports.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      {imports.map((recipeImport) => {
        const { recipe } = recipeImport;
        const failed = recipeImport.status === 'failed';
        const onDismiss = () => dismiss({ id: recipeImport._id }).catch(toastError);

        return (
          <Item key={recipeImport._id} variant="outline" size="sm" className="items-start">
            {recipe?.imageUrl ? (
              <ItemMedia variant="image">
                <img src={recipe.imageUrl} alt="" />
              </ItemMedia>
            ) : (
              <ItemMedia>
                {recipe ? (
                  <CircleCheck className="size-4 text-success" />
                ) : failed ? (
                  <CircleAlert className="size-4 text-destructive" />
                ) : (
                  <Spinner />
                )}
              </ItemMedia>
            )}
            <ItemContent className="min-w-0">
              <ItemTitle>
                {recipe ? recipe.title : failed ? 'Import failed' : 'Importing…'}
                {!recipe && !failed && (
                  <span className="font-normal tabular-nums text-muted-foreground">
                    {formatDuration(intervalToDuration({ start: recipeImport.startedAt, end: now }))}
                  </span>
                )}
              </ItemTitle>
              {recipeImport.prompt && (
                <ItemDescription className="line-clamp-3 whitespace-pre-line text-wrap wrap-anywhere">
                  {recipeImport.prompt}
                </ItemDescription>
              )}
              {failed && (
                <p className="text-sm text-destructive">
                  {recipeImport.error ?? 'The import stopped before it finished.'}
                </p>
              )}
              {recipeImport.photoUrls.length > 0 && (
                <div className="flex gap-1.5 pt-1">
                  {recipeImport.photoUrls.map((url) => (
                    <img key={url} src={url} alt="" className="size-10 rounded-sm border object-cover" />
                  ))}
                </div>
              )}
            </ItemContent>
            <ItemActions className="basis-full justify-end sm:basis-auto">
              {recipe ? (
                <Button size="sm" asChild>
                  {/* Opening the recipe is what the card was waiting for, so it goes away */}
                  <Link to="/recipes/$recipeId" params={{ recipeId: recipe._id }} onClick={onDismiss}>
                    Open
                  </Link>
                </Button>
              ) : (
                failed && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => retryImport({ id: recipeImport._id }).catch(toastError)}
                  >
                    <RotateCw />
                    Retry
                  </Button>
                )
              )}
              <Button variant="ghost" size="icon" className="size-8" aria-label="Dismiss" onClick={onDismiss}>
                <X />
              </Button>
            </ItemActions>
          </Item>
        );
      })}
    </div>
  );
}
