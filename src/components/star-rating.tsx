import { Star } from 'lucide-react';
import { useState } from 'react';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { cn } from '@/lib/utils';

type StarRatingProps = {
  value?: number;
  /** Called with `undefined` when the current star is clicked again. */
  onValueChange: (value: number | undefined) => void;
  max?: number;
  className?: string;
};

export function StarRating({ value, onValueChange, max = 5, className }: StarRatingProps) {
  const [hovered, setHovered] = useState<number>();
  const shown = hovered ?? value ?? 0;

  return (
    <ToggleGroup
      type="single"
      value={value ? String(value) : ''}
      onValueChange={(nextValue) => onValueChange(nextValue ? Number(nextValue) : undefined)}
      onMouseLeave={() => setHovered(undefined)}
      className={cn('gap-0', className)}
    >
      {Array.from({ length: max }, (_, index) => index + 1).map((rating) => (
        <ToggleGroupItem
          key={rating}
          value={String(rating)}
          aria-label={`${rating} star${rating === 1 ? '' : 's'}`}
          onMouseEnter={() => setHovered(rating)}
          // The toggle forces `[&_svg]:size-4`, so the star size is set the same way
          className="h-auto min-w-0 p-0.5 hover:bg-transparent data-[state=on]:bg-transparent [&_svg]:size-3.5"
        >
          <Star className={cn('text-muted-foreground/40', rating <= shown && 'fill-amber-400 text-amber-400')} />
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
