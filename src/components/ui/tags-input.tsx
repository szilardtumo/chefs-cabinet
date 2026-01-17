'use client';

import { X } from 'lucide-react';
import * as React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export interface TagsInputProps {
  value: string[];
  onValueChange: (value: string[]) => void;
  placeholder?: string;
  withAddButton?: boolean;
  addButtonText?: string;
  className?: string;
  disabled?: boolean;
  maxTags?: number;
  onTagAdd?: (tag: string) => boolean | string | null; // Return true to allow, false/string to reject with message
  onTagRemove?: (tag: string) => void;
}

export function TagsInput({
  value = [],
  onValueChange,
  placeholder = 'Add a tag...',
  withAddButton = false,
  addButtonText = 'Add',
  className,
  disabled = false,
  maxTags,
  onTagAdd,
  onTagRemove,
}: TagsInputProps) {
  const [inputValue, setInputValue] = React.useState('');

  const handleAddTag = React.useCallback(() => {
    const tag = inputValue.trim();
    if (!tag) return;

    // Check if tag already exists
    if (value.includes(tag)) {
      setInputValue('');
      return;
    }

    // Check max tags
    if (maxTags && value.length >= maxTags) {
      setInputValue('');
      return;
    }

    // Validate tag
    if (onTagAdd) {
      const result = onTagAdd(tag);
      if (result === false || typeof result === 'string') {
        setInputValue('');
        return;
      }
    }

    onValueChange([...value, tag]);
    setInputValue('');
  }, [inputValue, value, onValueChange, maxTags, onTagAdd]);

  const handleRemoveTag = React.useCallback(
    (tagToRemove: string) => {
      onTagRemove?.(tagToRemove);
      onValueChange(value.filter((tag) => tag !== tagToRemove));
    },
    [value, onValueChange, onTagRemove],
  );

  const handleKeyPress = React.useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleAddTag();
      }
    },
    [handleAddTag],
  );

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex gap-2">
        <Input
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyPress}
          placeholder={placeholder}
          disabled={disabled || (maxTags ? value.length >= maxTags : false)}
          className="flex-1"
        />
        {withAddButton && (
          <Button type="button" onClick={handleAddTag} disabled={disabled || !inputValue.trim()}>
            {addButtonText}
          </Button>
        )}
      </div>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {value.map((tag) => (
            <Badge key={tag} variant="secondary" size="sm">
              {tag}
              <button
                type="button"
                onClick={() => handleRemoveTag(tag)}
                disabled={disabled}
                className="ml-1 p-0.5 rounded-sm hover:bg-secondary-foreground/10 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
              >
                <X className="size-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
