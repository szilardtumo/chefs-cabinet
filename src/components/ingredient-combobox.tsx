import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import { convexQuery } from '@convex-dev/react-query';
import { useSuspenseQuery } from '@tanstack/react-query';
import Fuse from 'fuse.js';
import { Check, ChevronDown, Plus, SearchIcon } from 'lucide-react';
import { useEffectEvent, useMemo, useState, useTransition } from 'react';
import {
  Combobox,
  ComboboxAnchor,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxItemIndicator,
  ComboboxItemText,
  ComboboxTrigger,
} from '@/components/ui/combobox';
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from '@/components/ui/input-group';
import { getLiveUsageScore } from '@/lib/usage-score';
import { Badge } from './ui/badge';
import { Spinner } from './ui/spinner';

interface IngredientComboboxProps
  extends Omit<React.ComponentProps<typeof Combobox>, 'selectedItems' | 'onSelect' | 'onCreate'> {
  selectedItems: Id<'ingredients'>[];
  onSelect: (ingredientId: Id<'ingredients'>) => Promise<void>;
  onCreate: (ingredientName: string) => Promise<void>;
  placeholder?: string;
}

export function IngredientCombobox({
  selectedItems,
  onSelect,
  onCreate,
  placeholder = 'Search ingredients to add...',
  ...props
}: IngredientComboboxProps) {
  const [inputValue, setInputValue] = useState('');
  const [open, setOpen] = useState(false);

  const { data: allIngredients } = useSuspenseQuery(convexQuery(api.ingredients.getAll, {}));

  const [isPending, startTransition] = useTransition();

  const selectedItemsSet = new Set(selectedItems);

  // Initialize Fuse.js for fuzzy search
  const fuse = useMemo(
    () =>
      new Fuse(allIngredients, {
        keys: ['name'],
        threshold: 0.3, // Lower threshold = stricter matching (0.0 = exact match, 1.0 = match anything)
        includeScore: true,
        isCaseSensitive: false,
      }),
    [allIngredients],
  );

  // Fuzzy search results, with unselected items first
  const searchResults = useMemo(() => {
    if (inputValue.trim().length === 0) {
      // No search query: sort by usage score (highest first)
      return [...allIngredients]
        .map((ingredient) => ({
          item: ingredient,
          score: 0,
          usageScore: getLiveUsageScore(ingredient.usageScore, ingredient.lastUsageAt),
        }))
        .sort((a, b) => b.usageScore - a.usageScore);
    }

    return fuse.search(inputValue.trim());
  }, [fuse, inputValue, allIngredients]);

  // We can create a new ingredient if there is no exact match
  const canCreate = searchResults.every((result) => result.score! > Number.EPSILON);

  const displayedItems = useMemo(() => {
    const selected = searchResults.filter((result) => selectedItemsSet.has(result.item._id));
    const unselected = searchResults.filter((result) => !selectedItemsSet.has(result.item._id));

    return [...unselected, ...selected].map((result) => result.item);
  }, [searchResults, selectedItemsSet]);

  const handleSelectItem = (value: string) => {
    if (!value) return;

    startTransition(async () => {
      await onSelect(value as Id<'ingredients'>);
    });
  };

  // inputValue is not updated for some reason...
  const handleCreateItem = useEffectEvent(async () => {
    if (!inputValue.trim()) return;

    setOpen(false);

    startTransition(async () => {
      await onCreate(inputValue.trim());
    });
  });

  return (
    <Combobox
      open={open}
      onOpenChange={setOpen}
      inputValue={inputValue}
      onInputValueChange={setInputValue}
      value={selectedItems}
      manualFiltering
      loop
      multiple
      autoHighlight
      {...props}
    >
      <ComboboxAnchor onClick={() => setOpen(true)} asChild>
        <InputGroup className="px-0">
          <ComboboxInput asChild>
            <InputGroupInput placeholder={placeholder} />
          </ComboboxInput>
          <InputGroupAddon>{isPending ? <Spinner /> : <SearchIcon />}</InputGroupAddon>
          <InputGroupAddon align="inline-end">
            <ComboboxTrigger asChild>
              <InputGroupButton size="icon-xs">
                <ChevronDown />
              </InputGroupButton>
            </ComboboxTrigger>
          </InputGroupAddon>
        </InputGroup>
      </ComboboxAnchor>
      {open && (
        <ComboboxContent className="max-h-[300px] overflow-y-auto">
          <ComboboxEmpty>No ingredients found.</ComboboxEmpty>
          {displayedItems.map((ingredient) => (
            <ComboboxItem
              key={ingredient._id}
              value={ingredient._id}
              onSelect={handleSelectItem}
              disabled={selectedItemsSet.has(ingredient._id)}
              className="flex gap-2"
            >
              <ComboboxItemIndicator>
                <Check className="size-4" />
              </ComboboxItemIndicator>
              <ComboboxItemText className="flex gap-2">
                <span>
                  {ingredient.emoji} {ingredient.name}
                </span>
                <Badge variant="secondary" size="sm">
                  {ingredient.category?.emoji} {ingredient.category?.name}
                </Badge>
              </ComboboxItemText>
              <ComboboxItemIndicator className="italic ml-auto">Already added</ComboboxItemIndicator>
            </ComboboxItem>
          ))}
          {canCreate && (
            <ComboboxItem className="italic" value="create" onSelect={handleCreateItem}>
              <Plus className="size-4 mr-2" /> Create "{inputValue.trim()}"
            </ComboboxItem>
          )}
        </ComboboxContent>
      )}
    </Combobox>
  );
}
