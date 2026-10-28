import type { Id } from '@convex/_generated/dataModel';
import type { TodoList } from '@convex/todoLists';
import { ChevronDown, Plus } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ListNameDialog } from './list-name-dialog';

type ListPickerProps = {
  lists: TodoList[];
  /** The selected list; undefined for the main list */
  list?: TodoList;
  onSelect: (listId: Id<'todoLists'> | undefined) => void;
};

/**
 * Tabs for the main list and the extra lists, and a button for a new list. Tabs that don't fit scroll sideways, and a
 * menu at the end of the tabs lists every list.
 */
export function ListPicker({ lists, list, onSelect }: ListPickerProps) {
  const [createOpen, setCreateOpen] = useState(false);

  // Radix values are strings, so the main list goes by 'main'
  const value = list?._id ?? 'main';
  const select = (value: string) => onSelect(value === 'main' ? undefined : (value as Id<'todoLists'>));

  return (
    <div className="flex items-center gap-1">
      <Tabs value={value} onValueChange={select} className="min-w-0">
        <TabsList className="max-w-full justify-start overflow-x-auto no-scrollbar [container-type:scroll-state]">
          <TabsTrigger value="main" className="flex-none">
            Main
          </TabsTrigger>
          {lists.map((item) => (
            <TabsTrigger key={item._id} value={item._id} className="flex-none">
              {item.name}
            </TabsTrigger>
          ))}
          {/*
            Shown only while the tabs scroll sideways, pinned to the right edge over them, so every list stays
            reachable. It covers the list's 3px padding, and its opaque background hides the tabs behind the button's
            see-through hover color. Browsers without scroll-state queries always show it.
          */}
          <span className="sticky -right-[3px] flex h-full bg-muted pr-[3px] [@container_not_scroll-state(scrollable:x)]:hidden">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label="All lists" className="h-full">
                  <ChevronDown />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuRadioGroup value={value} onValueChange={select}>
                  <DropdownMenuRadioItem value="main">Main</DropdownMenuRadioItem>
                  {lists.map((item) => (
                    <DropdownMenuRadioItem key={item._id} value={item._id}>
                      {item.name}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </span>
        </TabsList>
      </Tabs>
      <Button variant="outline" size="sm" className="ml-auto" onClick={() => setCreateOpen(true)}>
        <Plus /> New list
      </Button>
      <ListNameDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={onSelect} />
    </div>
  );
}
