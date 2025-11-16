import type { Table } from '@tanstack/react-table';
import { Search, X } from 'lucide-react';
import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

interface DataTableToolbarProps<TData> {
  table: Table<TData>;
  searchKey?: string;
  searchPlaceholder?: string;
  filterComponent?: React.ReactNode;
}

export function DataTableToolbar<TData>({
  table,
  searchKey,
  searchPlaceholder = 'Search...',
  filterComponent,
}: DataTableToolbarProps<TData>) {
  const isFiltered = table.getState().columnFilters.length > 0;
  const [searchValue, setSearchValue] = React.useState('');

  React.useEffect(() => {
    if (searchKey) {
      const column = table.getColumn(searchKey);
      if (column) {
        const filterValue = column.getFilterValue() as string | undefined;
        setSearchValue(filterValue ?? '');
      }
    }
  }, [table, searchKey]);

  const handleSearchChange = (value: string) => {
    setSearchValue(value);
    if (searchKey) {
      const column = table.getColumn(searchKey);
      if (column) {
        column.setFilterValue(value || undefined);
      }
    }
  };

  if (!searchKey && !filterComponent) {
    return null;
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex gap-4">
          {searchKey && (
            <div className="flex-1 flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder={searchPlaceholder}
                  value={searchValue}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className="pl-9"
                />
              </div>
              {isFiltered && (
                <Button
                  variant="ghost"
                  onClick={() => {
                    table.resetColumnFilters();
                    setSearchValue('');
                  }}
                  className="h-10 px-3"
                >
                  Reset
                  <X className="ml-2 h-4 w-4" />
                </Button>
              )}
            </div>
          )}
          {filterComponent}
        </div>
      </CardContent>
    </Card>
  );
}
