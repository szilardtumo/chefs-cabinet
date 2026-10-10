import { Plus } from 'lucide-react';
import * as React from 'react';
import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxItem,
  ComboboxList,
  ComboboxValue,
  useComboboxAnchor,
} from '@/components/ui/combobox';

export interface TagsInputProps {
  id?: string;
  value: string[];
  onValueChange: (value: string[]) => void;
  placeholder?: string;
  className?: string;
}

export function TagsInput({ id, value = [], onValueChange, placeholder = 'Add a tag...', className }: TagsInputProps) {
  const anchor = useComboboxAnchor();
  const [inputValue, setInputValue] = React.useState('');
  const tag = inputValue.trim();
  // The only option is the typed tag, so Enter adds it
  const items = tag && !value.includes(tag) ? [tag] : [];

  return (
    <Combobox
      multiple
      autoHighlight
      items={items}
      value={value}
      onValueChange={onValueChange}
      inputValue={inputValue}
      onInputValueChange={setInputValue}
    >
      <ComboboxChips ref={anchor} className={className}>
        <ComboboxValue>
          {value.map((tag) => (
            <ComboboxChip key={tag}>{tag}</ComboboxChip>
          ))}
        </ComboboxValue>
        <ComboboxChipsInput id={id} placeholder={value.length > 0 ? undefined : placeholder} />
      </ComboboxChips>
      {items.length > 0 && (
        <ComboboxContent anchor={anchor}>
          <ComboboxList>
            {(item: string) => (
              <ComboboxItem key={item} value={item}>
                <Plus /> Add "{item}"
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      )}
    </Combobox>
  );
}
