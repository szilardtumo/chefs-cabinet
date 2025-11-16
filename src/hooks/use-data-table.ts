import {
  type ColumnDef,
  type ColumnFiltersState,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  type SortingState,
  type TableOptions,
  useReactTable,
  type VisibilityState,
} from '@tanstack/react-table';

interface UseDataTableOptions<TData>
  extends Omit<TableOptions<TData>, 'getCoreRowModel' | 'getFilteredRowModel' | 'getSortedRowModel'> {
  data: TData[];
  columns: ColumnDef<TData>[];
  pageCount?: number;
  getRowId?: (row: TData) => string;
  initialState?: {
    sorting?: SortingState;
    columnFilters?: ColumnFiltersState;
    columnVisibility?: VisibilityState;
    columnPinning?: { left?: string[]; right?: string[] };
  };
}

export function useDataTable<TData>({
  data,
  columns,
  pageCount = 1,
  getRowId,
  initialState,
  ...options
}: UseDataTableOptions<TData>) {
  const table = useReactTable({
    data,
    columns,
    pageCount,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getRowId,
    manualPagination: pageCount > 1,
    initialState,
    ...options,
  });

  return { table };
}
