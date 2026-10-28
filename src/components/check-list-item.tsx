import { Info, MoreHorizontal } from 'lucide-react';
import { motion } from 'motion/react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Item, ItemContent, ItemDescription, ItemMedia, ItemTitle } from '@/components/ui/item';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

type CheckListItemProps = {
  id: string;
  checked: boolean;
  onCheckedChange: () => void;
  title: ReactNode;
  emoji?: string;
  notes?: string;
  /** Shown faded, e.g. a skipped shopping item */
  dimmed?: boolean;
  /** Below the title */
  description?: ReactNode;
  /** Right of the title, before the menu */
  trailing?: ReactNode;
  /** The menu's items */
  menu: ReactNode;
};

/** A row of a checklist, shared by the shopping list and the to-do list. Must be a direct child of `AnimatePresence`. */
export function CheckListItem({
  id,
  checked,
  onCheckedChange,
  title,
  emoji,
  notes,
  dimmed,
  description,
  trailing,
  menu,
}: CheckListItemProps) {
  return (
    <motion.div
      className="overflow-hidden"
      layout
      initial={{ opacity: 0, y: -30 }}
      animate={{ opacity: dimmed ? 0.5 : 1, y: 0 }}
      exit={{ opacity: 0, height: 0 }}
    >
      <Item variant="outline" className="cursor-pointer hover:bg-accent py-3 flex-nowrap" asChild>
        <Label htmlFor={id}>
          <ItemMedia>
            <Checkbox id={id} checked={checked} onCheckedChange={onCheckedChange} />
          </ItemMedia>
          <ItemContent className="overflow-x-auto no-scrollbar">
            <ItemTitle className="w-full gap-1.5">
              {emoji && <span>{emoji}</span>}
              <span className={cn(checked && 'line-through text-muted-foreground', 'line-clamp-2')}>{title}</span>
              {notes && (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-4 text-muted-foreground cursor-default hover:text-foreground"
                    >
                      <Info />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent side="top" className="w-fit py-3 text-sm text-muted-foreground">
                    {notes}
                  </PopoverContent>
                </Popover>
              )}
              <div className="ml-auto flex items-center gap-2">
                {trailing}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="shrink-0 size-5 text-muted-foreground hover:text-foreground">
                      <MoreHorizontal />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">{menu}</DropdownMenuContent>
                </DropdownMenu>
              </div>
            </ItemTitle>
            {description && (
              <ItemDescription className="flex flex-wrap items-center gap-2">{description}</ItemDescription>
            )}
          </ItemContent>
        </Label>
      </Item>
    </motion.div>
  );
}
