import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import { convexQuery } from '@convex-dev/react-query';
import { useSuspenseQuery } from '@tanstack/react-query';
import type { FunctionReturnType } from 'convex/server';
import { orderBy, partition } from 'es-toolkit';
import Fuse from 'fuse.js';
import { Plus, SearchIcon } from 'lucide-react';
import { useState, useTransition } from 'react';
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from '@/components/ui/combobox';
import { InputGroupAddon } from '@/components/ui/input-group';
import { getLiveUsageScore } from '@/lib/usage-score';
import { Badge } from './ui/badge';
import { Spinner } from './ui/spinner';

type Option = FunctionReturnType<typeof api.ingredients.getAll>[number] | { create: string };

interface IngredientComboboxProps {
  selectedItems: Id<'ingredients'>[];
  onSelect: (ingredientId: Id<'ingredients'>) => Promise<void>;
  onCreate: (ingredientName: string) => Promise<void>;
  placeholder?: string;
  className?: string;
}

export function IngredientCombobox({
  selectedItems,
  onSelect,
  onCreate,
  placeholder = 'Search ingredients to add...',
  className,
}: IngredientComboboxProps) {
  const [inputValue, setInputValue] = useState('');

  const { data: allIngredients } = useSuspenseQuery(convexQuery(api.ingredients.getAll, {}));

  const [isPending, startTransition] = useTransition();

  const selectedItemsSet = new Set(selectedItems);
  const query = inputValue.trim();

  // Lower threshold = stricter matching (0.0 = exact match, 1.0 = match anything)
  const fuse = new Fuse(allIngredients, { keys: ['name'], threshold: 0.3 });
  // Best matches first, or most used first without a query, and already added ones last
  const [added, notAdded] = partition(
    query
      ? fuse.search(query).map((result) => result.item)
      : orderBy(
          allIngredients,
          [(ingredient) => getLiveUsageScore(ingredient.usageScore, ingredient.lastUsageAt)],
          ['desc'],
        ),
    (ingredient) => selectedItemsSet.has(ingredient._id),
  );
  const ingredients = [...notAdded, ...added];
  const canCreate =
    query !== '' && !allIngredients.some((ingredient) => ingredient.name.toLowerCase() === query.toLowerCase());
  const options: Option[] = canCreate ? [...ingredients, { create: query }] : ingredients;

  const handleValueChange = (option: Option | null) => {
    if (!option) return;

    setInputValue('');

    startTransition(async () => {
      if ('create' in option) {
        await onCreate(option.create);
      } else {
        await onSelect(option._id);
      }
    });
  };

  return (
    <Combobox
      items={options}
      filter={null}
      value={null}
      onValueChange={handleValueChange}
      inputValue={inputValue}
      onInputValueChange={setInputValue}
      itemToStringLabel={(option: Option) => ('create' in option ? option.create : option.name)}
      autoHighlight
    >
      <ComboboxInput placeholder={placeholder} className={className}>
        <InputGroupAddon>{isPending ? <Spinner /> : <SearchIcon />}</InputGroupAddon>
      </ComboboxInput>
      <ComboboxContent>
        <ComboboxEmpty>No ingredients found.</ComboboxEmpty>
        <ComboboxList>
          {(option: Option) =>
            'create' in option ? (
              <ComboboxItem key="create" value={option} className="italic">
                <Plus /> Create "{option.create}"
              </ComboboxItem>
            ) : (
              <ComboboxItem key={option._id} value={option} disabled={selectedItemsSet.has(option._id)}>
                <span>
                  {option.emoji} {option.name}
                </span>
                <Badge variant="secondary" size="sm">
                  {option.category?.emoji} {option.category?.name}
                </Badge>
                {selectedItemsSet.has(option._id) && <span className="ml-auto italic">Already added</span>}
              </ComboboxItem>
            )
          }
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}
