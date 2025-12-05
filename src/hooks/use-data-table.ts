'use client';
'use no memo';

import {
  type ColumnFiltersState,
  getCoreRowModel,
  getFacetedMinMaxValues,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type PaginationState,
  type RowSelectionState,
  type SortingState,
  type TableOptions,
  type TableState,
  type Updater,
  useReactTable,
  type VisibilityState,
} from '@tanstack/react-table';
import {
  parseAsArrayOf,
  parseAsInteger,
  parseAsString,
  type SingleParser,
  type UseQueryStateOptions,
  useQueryState,
  useQueryStates,
} from 'nuqs';
import * as React from 'react';
import { getSortingStateParser } from '@/lib/parsers';
import type { ExtendedColumnSort, QueryKeys } from '@/types/data-table';

const PAGE_KEY = 'page';
const PER_PAGE_KEY = 'perPage';
const SORT_KEY = 'sort';
const GLOBAL_FILTER_KEY = 'q';
const FILTERS_KEY = 'filters';
const JOIN_OPERATOR_KEY = 'joinOperator';
const ARRAY_SEPARATOR = ',';
const DEBOUNCE_MS = 300;
const THROTTLE_MS = 50;

interface UseDataTableProps<TData> extends Omit<TableOptions<TData>, 'state' | 'getCoreRowModel'> {
  initialState?: Omit<Partial<TableState>, 'sorting'> & {
    sorting?: ExtendedColumnSort<TData>[];
  };
  queryKeys?: Partial<QueryKeys>;
  history?: 'push' | 'replace';
  debounceMs?: number;
  throttleMs?: number;
  clearOnDefault?: boolean;
  enableAdvancedFilter?: boolean;
  scroll?: boolean;
  shallow?: boolean;
  startTransition?: React.TransitionStartFunction;
  enablePagination?: boolean;
  enableRowSelection?: boolean;
}

export function useDataTable<TData>(props: UseDataTableProps<TData>) {
  const {
    columns,
    initialState,
    queryKeys,
    history = 'replace',
    debounceMs = DEBOUNCE_MS,
    throttleMs = THROTTLE_MS,
    clearOnDefault = true,
    enableAdvancedFilter = false,
    scroll = false,
    shallow = true,
    startTransition,
    enablePagination = false,
    enableRowSelection = false,
    enableHiding = false,
    ...tableProps
  } = props;
  const pageKey = queryKeys?.page ?? PAGE_KEY;
  const perPageKey = queryKeys?.perPage ?? PER_PAGE_KEY;
  const sortKey = queryKeys?.sort ?? SORT_KEY;
  const globalFilterKey = queryKeys?.globalFilter ?? GLOBAL_FILTER_KEY;
  const filtersKey = queryKeys?.filters ?? FILTERS_KEY;
  const joinOperatorKey = queryKeys?.joinOperator ?? JOIN_OPERATOR_KEY;

  const queryStateOptions = React.useMemo<Omit<UseQueryStateOptions<string>, 'parse'>>(
    () => ({
      history,
      scroll,
      shallow,
      throttleMs,
      debounceMs,
      clearOnDefault,
      startTransition,
    }),
    [history, scroll, shallow, throttleMs, debounceMs, clearOnDefault, startTransition],
  );

  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>(initialState?.rowSelection ?? {});
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>(initialState?.columnVisibility ?? {});

  const [page, setPage] = useQueryState(pageKey, parseAsInteger.withOptions(queryStateOptions).withDefault(1));
  const [perPage, setPerPage] = useQueryState(
    perPageKey,
    parseAsInteger.withOptions(queryStateOptions).withDefault(initialState?.pagination?.pageSize ?? 10),
  );

  const pagination: PaginationState = React.useMemo(() => {
    return {
      pageIndex: page - 1, // zero-based index -> one-based index
      pageSize: perPage,
    };
  }, [page, perPage]);

  const onPaginationChange = React.useCallback(
    (updaterOrValue: Updater<PaginationState>) => {
      if (typeof updaterOrValue === 'function') {
        const newPagination = updaterOrValue(pagination);
        void setPage(newPagination.pageIndex + 1);
        void setPerPage(newPagination.pageSize);
      } else {
        void setPage(updaterOrValue.pageIndex + 1);
        void setPerPage(updaterOrValue.pageSize);
      }
    },
    [pagination, setPage, setPerPage],
  );

  const columnIds = React.useMemo(() => {
    return new Set(columns.map((column) => column.id).filter(Boolean) as string[]);
  }, [columns]);

  const [sorting, setSorting] = useQueryState(
    sortKey,
    getSortingStateParser<TData>(columnIds)
      .withOptions(queryStateOptions)
      .withDefault(initialState?.sorting ?? []),
  );

  const onSortingChange = React.useCallback(
    (updaterOrValue: Updater<SortingState>) => {
      if (typeof updaterOrValue === 'function') {
        const newSorting = updaterOrValue(sorting);
        setSorting(newSorting as ExtendedColumnSort<TData>[]);
      } else {
        setSorting(updaterOrValue as ExtendedColumnSort<TData>[]);
      }
    },
    [sorting, setSorting],
  );

  const [globalFilter, setGlobalFilter] = useQueryState(
    globalFilterKey,
    parseAsString.withOptions(queryStateOptions).withDefault(''),
  );

  const filterableColumns = React.useMemo(() => {
    if (enableAdvancedFilter) return [];

    return columns.filter((column) => column.enableColumnFilter);
  }, [columns, enableAdvancedFilter]);

  const filterParsers = React.useMemo(() => {
    if (enableAdvancedFilter) return {};

    return filterableColumns.reduce<Record<string, SingleParser<string> | SingleParser<string[]>>>((acc, column) => {
      if (column.meta?.variant === 'multiSelect') {
        acc[column.id ?? ''] = parseAsArrayOf(parseAsString, ARRAY_SEPARATOR).withOptions(queryStateOptions);
      } else {
        acc[column.id ?? ''] = parseAsString.withOptions(queryStateOptions);
      }
      return acc;
    }, {});
  }, [filterableColumns, queryStateOptions, enableAdvancedFilter]);

  const [filterValues, setFilterValues] = useQueryStates(filterParsers, queryStateOptions);

  const nuqsToTanstackFilters = React.useCallback((nuqs: typeof filterValues) => {
    return Object.entries(nuqs).reduce<ColumnFiltersState>((filters, [key, value]) => {
      if (value !== null) {
        filters.push({
          id: key,
          value: value,
        });
      }
      return filters;
    }, []);
  }, []);

  const tanstackToNuqsFilters = React.useCallback(
    (tanstack: ColumnFiltersState) => {
      const result = tanstack.reduce<typeof filterValues>((acc, filter) => {
        if (filter.value !== null) {
          acc[filter.id] = filter.value as string | string[];
        }
        return acc;
      }, {});

      filterableColumns
        .filter((column) => !result[column.id ?? ''])
        .forEach((column) => {
          result[column.id ?? ''] = null;
        });

      return result;
    },
    [filterableColumns],
  );

  const columnFilters = React.useMemo(() => nuqsToTanstackFilters(filterValues), [filterValues, nuqsToTanstackFilters]);

  const onColumnFiltersChange = React.useCallback(
    (updaterOrValue: Updater<ColumnFiltersState>) => {
      if (enableAdvancedFilter) return;

      setFilterValues((prev) => {
        const prevFilters = nuqsToTanstackFilters(prev);
        const nextFilters = typeof updaterOrValue === 'function' ? updaterOrValue(prevFilters) : updaterOrValue;

        return tanstackToNuqsFilters(nextFilters);
      });
    },
    [enableAdvancedFilter, nuqsToTanstackFilters, tanstackToNuqsFilters, setFilterValues],
  );

  const table = useReactTable({
    ...tableProps,
    columns,
    initialState: {
      globalFilter: '',
      ...initialState,
    },
    state: {
      pagination,
      sorting,
      columnVisibility,
      rowSelection,
      globalFilter,
      columnFilters,
    },
    defaultColumn: {
      enableColumnFilter: false,
      minSize: 0,
      size: 0,
      ...tableProps.defaultColumn,
    },
    onRowSelectionChange: setRowSelection,
    onPaginationChange,
    onSortingChange,
    onGlobalFilterChange: setGlobalFilter,
    onColumnFiltersChange,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: enablePagination ? getPaginationRowModel() : undefined,
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    getFacetedMinMaxValues: getFacetedMinMaxValues(),
    enableRowSelection,
    enableHiding,
    meta: {
      ...tableProps.meta,
      queryKeys: {
        page: pageKey,
        perPage: perPageKey,
        sort: sortKey,
        globalFilter: globalFilterKey,
        filters: filtersKey,
        joinOperator: joinOperatorKey,
      },
    },
  });

  return { table, shallow, debounceMs, throttleMs };
}
