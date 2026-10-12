import type { ColumnFiltersState, ColumnPinningState, PaginationState, SortingState, TableOptionsWithReactiveData, VisibilityState } from '@tanstack/vue-table'
import type { DataTableProps } from './types'
import { getCoreRowModel, getFacetedRowModel, getFacetedUniqueValues, getFilteredRowModel, getPaginationRowModel, getSortedRowModel, useVueTable } from '@tanstack/vue-table'
import { computed, ref } from 'vue'
import { DEFAULT_PAGE_SIZE } from '@/constants/pagination'
import { valueUpdater } from '@/lib/utils'

export function generateVueTable<T>(props: DataTableProps<T>) {
  const sorting = ref<SortingState>([])
  const columnFilters = ref<ColumnFiltersState>([])
  const columnVisibility = ref<VisibilityState>({})
  const columnPinning = ref<ColumnPinningState>({ left: [], right: [] })
  const rowSelection = ref({})
  const pagination = ref<PaginationState>({ pageIndex: 0, pageSize: DEFAULT_PAGE_SIZE })
  const currentPagination = computed<PaginationState>(() => props.serverPagination
    ? { pageIndex: props.serverPagination.page - 1, pageSize: props.serverPagination.pageSize }
    : pagination.value)
  const tableConfig: TableOptionsWithReactiveData<T> = {
    get data() { return props.data },
    get columns() { return props.columns },
    get manualPagination() { return !!props.serverPagination },
    get manualSorting() { return props.manualSorting ?? !!props.serverPagination },
    get manualFiltering() { return props.manualFiltering ?? !!props.serverPagination },
    get pageCount() { return props.serverPagination ? Math.max(1, Math.ceil(props.serverPagination.total / props.serverPagination.pageSize)) : undefined },
    state: {
      get sorting() { return sorting.value },
      get columnFilters() { return columnFilters.value },
      get columnVisibility() { return columnVisibility.value },
      get columnPinning() { return columnPinning.value },
      get rowSelection() { return rowSelection.value },
      get pagination() { return currentPagination.value },
    },
    enableRowSelection: true,
    getRowId: (row, index) => props.getRowId?.(row, index) ?? String((row as { id?: string | number }).id ?? index),
    onSortingChange: updater => valueUpdater(updater, sorting),
    onColumnFiltersChange: updater => valueUpdater(updater, columnFilters),
    onColumnVisibilityChange: updater => valueUpdater(updater, columnVisibility),
    onColumnPinningChange: updater => valueUpdater(updater, columnPinning),
    onRowSelectionChange: updater => valueUpdater(updater, rowSelection),
    onPaginationChange: (updater) => {
      const current = currentPagination.value
      const next = typeof updater === 'function' ? updater(current) : updater
      if (props.serverPagination) {
        if (next.pageSize !== current.pageSize)
          props.serverPagination.onPageSizeChange(next.pageSize)
        if (next.pageIndex !== current.pageIndex)
          props.serverPagination.onPageChange(next.pageIndex + 1)
      }
      else {
        valueUpdater(updater, pagination)
      }
    },
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
  }
  return useVueTable<T>(tableConfig)
}
