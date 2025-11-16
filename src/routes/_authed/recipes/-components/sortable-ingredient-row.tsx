import type { Id } from '@convex/_generated/dataModel';
import { GripVertical, Trash2 } from 'lucide-react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export type Ingredient = {
  id: string;
  ingredientId: string;
  quantity: number;
  unit: string;
  notes?: string;
  availableIngredients?: Array<{
    _id: Id<'ingredients'>;
    name: string;
    emoji?: string;
  }>;
};

type SortableIngredientRowProps = {
  ingredient: Ingredient;
  onUpdate: (updated: Ingredient) => void;
  onRemove: (id: string) => void;
};

export function SortableIngredientRow({ ingredient, onUpdate, onRemove }: SortableIngredientRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: ingredient.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-2 p-3 border rounded-lg bg-card">
      <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing">
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </button>

      <div className="flex-1 grid grid-cols-4 gap-2">
        <Select value={ingredient.ingredientId} onValueChange={(value) => onUpdate({ ...ingredient, ingredientId: value })}>
          <SelectTrigger>
            <SelectValue placeholder="Ingredient" />
          </SelectTrigger>
          <SelectContent>
            {ingredient.availableIngredients?.map((ing) => (
              <SelectItem key={ing._id} value={ing._id}>
                {ing.emoji && <span className="mr-1">{ing.emoji}</span>}
                {ing.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Input
          type="number"
          placeholder="Quantity"
          value={ingredient.quantity}
          onChange={(e) => onUpdate({ ...ingredient, quantity: parseFloat(e.target.value) || 0 })}
        />

        <Input
          placeholder="Unit"
          value={ingredient.unit}
          onChange={(e) => onUpdate({ ...ingredient, unit: e.target.value })}
        />

        <Input
          placeholder="Notes (optional)"
          value={ingredient.notes || ''}
          onChange={(e) => onUpdate({ ...ingredient, notes: e.target.value })}
        />
      </div>

      <Button variant="ghost" size="icon" onClick={() => onRemove(ingredient.id)}>
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}

