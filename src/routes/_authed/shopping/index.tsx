import { api } from '@convex/_generated/api';
import { convexQuery, useConvexMutation } from '@convex-dev/react-query';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { ShoppingList } from './_components/ShoppingList';

export const Route = createFileRoute('/_authed/shopping/')({
  component: ShoppingListComponent,
  context: () => ({ title: 'Shopping List' }),
});

function ShoppingListComponent() {
  const { data: list } = useSuspenseQuery(convexQuery(api.shoppingLists.get, {}));
  const { mutateAsync: createDefault } = useMutation({
    mutationFn: useConvexMutation(api.shoppingLists.createDefault),
  });
  // Create default list if it doesn't exist
  useEffect(() => {
    if (list === null) {
      createDefault(undefined);
    }
  }, [list, createDefault]);

  if (list === null) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-muted-foreground">Creating shopping list...</p>
      </div>
    );
  }

  const totalItems = list.items?.length || 0;
  const checkedItems = list.items?.filter((i) => i.checked).length || 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight">{list.name}</h1>
          <p className="text-muted-foreground">
            {checkedItems}/{totalItems} items checked
          </p>
        </div>
      </div>

      {/* Progress */}

      <Card>
        <CardContent className="pt-6">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Progress</span>
              <span className="font-medium">{Math.round((checkedItems / totalItems) * 100) || 0}%</span>
            </div>
            <Progress value={(checkedItems / totalItems) * 100 || 0} />
          </div>
        </CardContent>
      </Card>

      <ShoppingList list={list} />
    </div>
  );
}
