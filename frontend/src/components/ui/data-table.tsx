import { useEffect, useMemo, useState, type Key, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Button } from './button';
import { CheckSquare } from './check-square';
import { SearchBox } from './search-box';
import { StateCard, type StateCardProps } from './state-card';

export type Align = 'left' | 'center' | 'right';
export type SortDir = 'asc' | 'desc';
export interface DataTableSort {
  columnId: string;
  dir: SortDir;
}

export interface Column<Row> {
  id: string;
  header: ReactNode;
  cell: (row: Row) => ReactNode;
  align?: Align;
  headerAlign?: Align;
  width?: string;
  className?: string;
  headerClassName?: string;
  sortable?: boolean;
  sortValue?: (row: Row) => string | number;
}

export interface DataTableProps<Row> {
  columns: Column<Row>[];
  data: Row[];
  rowKey: (row: Row) => Key;

  loading?: boolean;
  error?: unknown;
  loadingState?: Partial<StateCardProps>;
  errorState?: Partial<StateCardProps>;
  emptyState?: Partial<StateCardProps>;

  sort?: DataTableSort | null;
  onSortChange?: (columnId: string) => void;

  selectable?: boolean;
  isSelected?: (row: Row) => boolean;
  onToggleRow?: (row: Row) => void;
  allSelected?: boolean;
  onToggleAll?: () => void;
  selectLabel?: (row: Row) => string;

  rowClassName?: (row: Row) => string | undefined;
  onRowClick?: (row: Row) => void;

  filterable?: boolean;
  filterPlaceholder?: string;
  filterText?: (row: Row) => string;
  // Controlled filter: when `onFilterChange` is supplied the search box is
  // driven by the parent and rows are assumed to be already filtered by the
  // server, so no client-side filtering is applied.
  filterValue?: string;
  onFilterChange?: (value: string) => void;
  toolbar?: ReactNode;

  paginated?: boolean;
  pageSize?: number;
  pageSizeOptions?: number[];
  page?: number;
  totalRows?: number;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (size: number) => void;

  stickyHeader?: boolean;
  minWidthClass?: string;
  maxHeightClass?: string;

  footer?: ReactNode;
  className?: string;
}

const ALIGN: Record<Align, string> = { left: 'text-left', center: 'text-center', right: 'text-right' };
const DEFAULT_PAGE_SIZES = [10, 20, 50, 100];

function compare(a: string | number, b: string | number): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
}

export function DataTable<Row>({
  columns,
  data,
  rowKey,
  loading,
  error,
  loadingState,
  errorState,
  emptyState,
  sort,
  onSortChange,
  selectable,
  isSelected,
  onToggleRow,
  allSelected,
  onToggleAll,
  selectLabel,
  rowClassName,
  onRowClick,
  filterable,
  filterPlaceholder = 'Filter…',
  filterText,
  filterValue,
  onFilterChange,
  toolbar,
  paginated,
  pageSize: initialPageSize = 10,
  pageSizeOptions = DEFAULT_PAGE_SIZES,
  page: controlledPage,
  totalRows,
  onPageChange,
  onPageSizeChange,
  stickyHeader,
  minWidthClass,
  maxHeightClass,
  footer,
  className,
}: DataTableProps<Row>) {
  const [filter, setFilter] = useState('');
  const [internalSort, setInternalSort] = useState<DataTableSort | null>(null);
  const [internalPage, setInternalPage] = useState(0);
  const [internalPageSize, setInternalPageSize] = useState(initialPageSize);

  const serverPaginated = !!(paginated && onPageChange);
  const pageSize = serverPaginated ? initialPageSize : internalPageSize;

  const controlledFilter = onFilterChange !== undefined;
  const filterVal = controlledFilter ? filterValue ?? '' : filter;
  const filterTrimmed = filterVal.trim();

  // The uncontrolled filter path resets to page 1 on each keystroke; mirror that
  // for a controlled filter so a client-paginated table (no onPageChange) doesn't
  // strand the operator on an out-of-range page after narrowing the results.
  useEffect(() => {
    if (controlledFilter && !onPageChange) setInternalPage(0);
  }, [filterVal, controlledFilter, onPageChange]);

  // Client-side header sorting reorders only the rows currently in `data`. Under
  // server-side pagination that's just the visible page, so a per-page sort would
  // masquerade as a global one — disable it (no arrow, no click) unless the parent
  // opts into server sorting via onSortChange.
  const sortingEnabled = !serverPaginated || !!onSortChange;

  const pageSizeChoices = useMemo(() => {
    const set = new Set(pageSizeOptions);
    set.add(initialPageSize);
    return [...set].sort((a, b) => a - b);
  }, [pageSizeOptions, initialPageSize]);

  const activeSort = onSortChange ? sort ?? null : internalSort;

  const filtered = useMemo(() => {
    if (controlledFilter) return data; // server already filtered
    const q = filter.trim().toLowerCase();
    if (!filterable || !q) return data;
    const text = filterText ?? (() => '');
    return data.filter((r) => text(r).toLowerCase().includes(q));
  }, [data, filter, filterable, filterText, controlledFilter]);

  const sorted = useMemo(() => {
    if (onSortChange || !internalSort) return filtered;
    const col = columns.find((c) => c.id === internalSort.columnId);
    if (!col?.sortValue) return filtered;
    const dir = internalSort.dir === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => compare(col.sortValue!(a), col.sortValue!(b)) * dir);
  }, [filtered, internalSort, onSortChange, columns]);

  const totalCount = serverPaginated ? totalRows ?? sorted.length : sorted.length;
  const pageCount = paginated ? Math.max(1, Math.ceil(totalCount / pageSize)) : 1;
  const requestedPage = serverPaginated ? controlledPage ?? 0 : internalPage;
  const activePage = Math.min(Math.max(requestedPage, 0), pageCount - 1);
  const rows =
    !paginated || serverPaginated
      ? sorted
      : sorted.slice(activePage * pageSize, activePage * pageSize + pageSize);

  const colCount = columns.length + (selectable ? 1 : 0);
  const scroll = !!(minWidthClass || maxHeightClass);

  const state: StateCardProps | null = loading
    ? { variant: 'loading', title: 'Loading…', ...loadingState }
    : error
    ? { variant: 'error', title: 'Something went wrong', ...errorState }
    : data.length === 0 && !filterTrimmed
    ? { variant: 'empty', title: 'Nothing here yet', ...emptyState }
    : null;

  if (state) return <StateCard {...state} />;

  const onHeaderSort = (col: Column<Row>) => {
    if (!col.sortable || !sortingEnabled) return;
    if (onSortChange) {
      onSortChange(col.id);
      return;
    }
    setInternalSort((prev) =>
      prev?.columnId === col.id
        ? { columnId: col.id, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
        : { columnId: col.id, dir: 'asc' },
    );
  };

  const goToPage = (next: number) => {
    const clamped = Math.min(Math.max(next, 0), pageCount - 1);
    if (serverPaginated) onPageChange?.(clamped);
    else setInternalPage(clamped);
  };

  const changePageSize = (next: number) => {
    if (serverPaginated) {
      onPageSizeChange?.(next);
      return;
    }
    const firstRow = activePage * pageSize;
    setInternalPageSize(next);
    setInternalPage(Math.floor(firstRow / next));
  };

  const arrow = (id: string) =>
    activeSort && activeSort.columnId === id ? (activeSort.dir === 'asc' ? ' ↑' : ' ↓') : '';
  const ariaSort = (id: string): 'ascending' | 'descending' | 'none' =>
    activeSort && activeSort.columnId === id ? (activeSort.dir === 'asc' ? 'ascending' : 'descending') : 'none';

  return (
    <div className={className}>
      {(filterable || toolbar) && (
        <div className="flex items-center gap-2.5 px-4 py-3 border-b border-line flex-wrap">
          {filterable && (
            <SearchBox
              value={filterVal}
              onChange={(e) => {
                if (controlledFilter) onFilterChange?.(e.target.value);
                else { setFilter(e.target.value); setInternalPage(0); }
              }}
              placeholder={filterPlaceholder}
              className="min-w-[220px] max-w-[300px]"
            />
          )}
          {toolbar}
        </div>
      )}

      <div className={scroll ? cn('overflow-auto', maxHeightClass) : 'overflow-visible'}>
        <table className={cn('w-full border-separate border-spacing-0 text-[13px]', minWidthClass)}>
          <thead>
            <tr className="text-left text-muted text-[11px] uppercase tracking-wide">
              {selectable && (
                <th className={cn('font-semibold px-3 py-2.5 pl-4 w-9 border-b border-line', stickyHeader && 'sticky top-0 z-[1] bg-surface-2')}>
                  <CheckSquare checked={!!allSelected} onClick={onToggleAll} aria-label="Select all" />
                </th>
              )}
              {columns.map((col, i) => {
                const first = !selectable && i === 0;
                const last = i === columns.length - 1;
                const sortable = !!col.sortable && sortingEnabled;
                return (
                  <th
                    key={col.id}
                    onClick={sortable ? () => onHeaderSort(col) : undefined}
                    aria-sort={sortable ? ariaSort(col.id) : undefined}
                    className={cn(
                      'font-semibold px-3 py-2.5 border-b border-line',
                      ALIGN[col.headerAlign ?? col.align ?? 'left'],
                      first && 'pl-4',
                      last && 'pr-4',
                      sortable && 'cursor-pointer select-none',
                      stickyHeader && 'sticky top-0 z-[1] bg-surface-2',
                      col.width,
                      col.headerClassName,
                    )}
                  >
                    {col.header}{sortable ? arrow(col.id) : ''}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={colCount} className="px-4 py-10 text-center text-muted text-[13px]">
                  No matches{filterTrimmed ? <> for “<span className="text-fg">{filterTrimmed}</span>”</> : null}.
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const selected = !!isSelected?.(row);
                return (
                  <tr
                    key={rowKey(row)}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    className={cn(
                      onRowClick && 'cursor-pointer hover:bg-surface-2',
                      selected && 'bg-accent-quiet',
                      rowClassName?.(row),
                    )}
                  >
                    {selectable && (
                      <td className="pl-4 pr-3 py-2.5 border-b border-line" onClick={(e) => e.stopPropagation()}>
                        <CheckSquare
                          checked={selected}
                          onClick={() => onToggleRow?.(row)}
                          aria-label={selectLabel?.(row) ?? 'Select row'}
                        />
                      </td>
                    )}
                    {columns.map((col, i) => {
                      const first = !selectable && i === 0;
                      const last = i === columns.length - 1;
                      return (
                        <td
                          key={col.id}
                          className={cn(
                            'px-3 py-2.5 border-b border-line',
                            ALIGN[col.align ?? 'left'],
                            first && 'pl-4',
                            last && 'pr-4',
                            col.width,
                            col.className,
                          )}
                        >
                          {col.cell(row)}
                        </td>
                      );
                    })}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {footer}

      {paginated && totalCount > 0 && (
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-line text-[12px] text-muted flex-wrap">
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5">
              Rows
              <select
                value={pageSize}
                onChange={(e) => changePageSize(Number(e.target.value))}
                aria-label="Rows per page"
                className="h-7 rounded-8 border border-line bg-surface-2 pl-2 pr-1.5 text-[12px] text-fg cursor-pointer outline-none focus-visible:border-accent"
              >
                {pageSizeChoices.map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </label>
            <span>
              Showing{' '}
              <span className="font-mono text-fg">
                {(activePage * pageSize + 1).toLocaleString()}–
                {Math.min(totalCount, activePage * pageSize + pageSize).toLocaleString()}
              </span>{' '}
              of <span className="font-mono text-fg">{totalCount.toLocaleString()}</span>
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <Button size="sm" onClick={() => goToPage(0)} disabled={activePage === 0}>
              First
            </Button>
            <Button size="sm" onClick={() => goToPage(activePage - 1)} disabled={activePage === 0}>
              Prev
            </Button>
            <span className="font-mono px-1 text-fg">{activePage + 1}/{pageCount}</span>
            <Button size="sm" onClick={() => goToPage(activePage + 1)} disabled={activePage >= pageCount - 1}>
              Next
            </Button>
            <Button size="sm" onClick={() => goToPage(pageCount - 1)} disabled={activePage >= pageCount - 1}>
              Last
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
