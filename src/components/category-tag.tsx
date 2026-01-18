import type { Doc } from '@convex/_generated/dataModel';
import { Badge } from './ui/badge';

export const CategoryTag = ({ category }: { category: Pick<Doc<'categories'>, 'emoji' | 'name'> }) => {
  return (
    <Badge variant="secondary" size="sm" className="whitespace-nowrap">
      {category.emoji && <span className="mr-1">{category.emoji}</span>}
      {category.name}
    </Badge>
  );
};
