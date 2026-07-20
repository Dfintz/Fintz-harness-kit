/**
 * DataTable — Phase 2.1
 *
 * Unified, generic data table component wrapping MUI Table primitives.
 * Provides sorting, pagination, selection, loading/empty states, and
 * CSV export from a declarative column definition.
 *
 * Replaces ad-hoc raw MUI Table usage across 15+ files and the
 * unused ui/Table component.
 *
 * @example
 * ```tsx
 * const columns: DataTableColumn<Fleet>[] = [
 *   { key: 'name', header: 'Name', sortable: true },
 *   { key: 'shipCount', header: 'Ships', align: 'right', sortable: true },
 *   {
 *     key: 'status',
 *     header: 'Status',
 *     render: (row) => <Chip label={row.status} color="primary" size="small" />,
 *   },
 *   {
 *     key: 'actions',
 *     header: '',
 *     align: 'right',
 *     render: (row) => <IconButton onClick={() => onEdit(row)}><EditIcon /></IconButton>,
 *   },
 * ];
 *
 * <DataTable
 *   columns={columns}
 *   data={fleets}
 *   loading={isLoading}
 *   emptyMessage="No fleets found"
 *   sortable
 *   paginated
 *   selectable
 *   onSelectionChange={setSelectedIds}
 *   onExportCSV
 *   getRowKey={(row) => row.id}
 * />
 * ```
 */

import FileDownloadIcon from '@mui/icons-material/FileDownload';
import {
  Box,
  Checkbox,
  IconButton,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TableSortLabel,
  Toolbar,
  Tooltip,
  Typography,
} from '@mui/material';
import { visuallyHidden } from '@mui/utils';
import React, { useCallback, useMemo, useState } from 'react';
import { TableVirtuoso } from 'react-virtuoso';

// ============================================================================
// Types
// ============================================================================

export type SortDirection = 'asc' | 'desc';

export interface DataTableColumn<T> {
  /** Unique column identifier — used for sorting key and CSV export */
  key: string;
  /** Column header text */
  header: string;
  /** Custom cell renderer. Falls back to `row[key]` stringified. */
  render?: (row: T, rowIndex: number) => React.ReactNode;
  /** Column width (px or CSS value) */
  width?: number | string;
  /** Text alignment */
  align?: 'left' | 'center' | 'right';
  /** Whether this column is sortable */
  sortable?: boolean;
  /** Whether to include this column in CSV export (default: true) */
  exportable?: boolean;
  /** Custom value extractor for CSV export. Falls back to `row[key]`. */
  exportValue?: (row: T) => string | number;
}

export interface DataTableProps<T> {
  /** Column definitions */
  columns: DataTableColumn<T>[];
  /** Data rows */
  data: T[];
  /** Whether the data is loading */
  loading?: boolean;
  /** Message to display when data is empty */
  emptyMessage?: string;
  /** Enable client-side sorting */
  sortable?: boolean;
  /** Controlled sort — column key */
  sortBy?: string;
  /** Controlled sort direction */
  sortDirection?: SortDirection;
  /** Callback when sort changes (for server-side sorting) */
  onSortChange?: (key: string, direction: SortDirection) => void;
  /** Enable client-side pagination */
  paginated?: boolean;
  /** Initial page size (default: 10) */
  pageSize?: number;
  /** Page size options */
  pageSizeOptions?: number[];
  /** Total row count for server-side pagination */
  totalCount?: number;
  /** Current page for controlled pagination (0-indexed) */
  page?: number;
  /** Callback when page/pageSize changes (for server-side pagination) */
  onPageChange?: (page: number, pageSize: number) => void;
  /** Enable row selection (checkboxes) */
  selectable?: boolean;
  /** Currently selected row keys (controlled) */
  selectedKeys?: Set<string>;
  /** Callback when selection changes */
  onSelectionChange?: (selectedKeys: Set<string>) => void;
  /** Extract a unique key from the row */
  getRowKey: (row: T, index: number) => string;
  /** Enable CSV export button in toolbar */
  onExportCSV?: boolean;
  /** Custom CSV filename (default: 'export.csv') */
  csvFilename?: string;
  /** MUI Table size */
  size?: 'small' | 'medium';
  /** Whether rows should highlight on hover */
  hover?: boolean;
  /** Optional toolbar title */
  title?: string;
  /** Additional toolbar actions (rendered after built-in actions) */
  toolbarActions?: React.ReactNode;
  /** Optional custom row click handler */
  onRowClick?: (row: T) => void;
  /** aria-label for the table */
  ariaLabel?: string;
  /** Sticky header */
  stickyHeader?: boolean;
  /** Max height for scrollable container */
  maxHeight?: number | string;
  /** Number of skeleton rows to show while loading (default: 5) */
  skeletonRows?: number;
  /** Enable virtual scrolling for large datasets (default: auto when data > 100 rows) */
  virtualize?: boolean | 'auto';
  /** Row count threshold for auto-virtualization (default: 100) */
  virtualizeThreshold?: number;
}

// ============================================================================
// Helpers
// ============================================================================

function defaultCompare<T>(a: T, b: T, key: string): number {
  const aVal = (a as Record<string, unknown>)[key];
  const bVal = (b as Record<string, unknown>)[key];

  if (aVal == null && bVal == null) return 0;
  if (aVal == null) return -1;
  if (bVal == null) return 1;

  if (typeof aVal === 'number' && typeof bVal === 'number') {
    return aVal - bVal;
  }

  return String(aVal).localeCompare(String(bVal));
}

function downloadCSV(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

// ============================================================================
// Component
// ============================================================================

export function DataTable<T>(props: DataTableProps<T>): React.ReactElement {
  const {
    columns,
    data,
    loading = false,
    emptyMessage = 'No data',
    sortable = false,
    sortBy: controlledSortBy,
    sortDirection: controlledSortDir,
    onSortChange,
    paginated = false,
    pageSize: initialPageSize = 10,
    pageSizeOptions = [5, 10, 25, 50],
    totalCount,
    page: controlledPage,
    onPageChange,
    selectable = false,
    selectedKeys: controlledSelected,
    onSelectionChange,
    getRowKey,
    onExportCSV = false,
    csvFilename = 'export.csv',
    size = 'small',
    hover = true,
    title,
    toolbarActions,
    onRowClick,
    ariaLabel = 'data table',
    stickyHeader = false,
    maxHeight,
    skeletonRows = 5,
    virtualize = 'auto',
    virtualizeThreshold = 100,
  } = props;

  // ---- Virtualization decision ----
  const shouldVirtualize =
    virtualize === true || (virtualize === 'auto' && data.length > virtualizeThreshold);

  // ---- Internal sort state (uncontrolled mode) ----
  const [internalSortBy, setInternalSortBy] = useState<string>('');
  const [internalSortDir, setInternalSortDir] = useState<SortDirection>('asc');
  const activeSortBy = controlledSortBy ?? internalSortBy;
  const activeSortDir = controlledSortDir ?? internalSortDir;

  // ---- Internal pagination state (uncontrolled mode) ----
  const [internalPage, setInternalPage] = useState(0);
  const [internalPageSize, setInternalPageSize] = useState(initialPageSize);
  const activePage = controlledPage ?? internalPage;
  // When the parent controls pageSize via prop, prefer the prop over internal state
  const activePageSize = onPageChange ? initialPageSize : internalPageSize;

  // ---- Internal selection state (uncontrolled mode) ----
  const [internalSelected, setInternalSelected] = useState<Set<string>>(new Set());
  const activeSelected = controlledSelected ?? internalSelected;
  const setSelected = useCallback(
    (next: Set<string>) => {
      if (onSelectionChange) {
        onSelectionChange(next);
      } else {
        setInternalSelected(next);
      }
    },
    [onSelectionChange]
  );

  // ---- Sorted data ----
  const sortedData = useMemo(() => {
    if (!sortable || !activeSortBy || onSortChange) {
      // Server-side sorting or no sort — return as-is
      return data;
    }
    const sorted = [...data].sort((a, b) => defaultCompare(a, b, activeSortBy));
    return activeSortDir === 'desc' ? sorted.reverse() : sorted;
  }, [data, sortable, activeSortBy, activeSortDir, onSortChange]);

  // ---- Paginated data ----
  const paginatedData = useMemo(() => {
    if (!paginated || onPageChange) {
      // Server-side pagination — return as-is
      return sortedData;
    }
    const start = activePage * activePageSize;
    return sortedData.slice(start, start + activePageSize);
  }, [sortedData, paginated, activePage, activePageSize, onPageChange]);

  const displayData = paginatedData;
  const rowCount = totalCount ?? data.length;

  // ---- Handlers ----
  const handleSort = useCallback(
    (key: string) => {
      const isAsc = activeSortBy === key && activeSortDir === 'asc';
      const newDir: SortDirection = isAsc ? 'desc' : 'asc';
      if (onSortChange) {
        onSortChange(key, newDir);
      } else {
        setInternalSortBy(key);
        setInternalSortDir(newDir);
      }
    },
    [activeSortBy, activeSortDir, onSortChange]
  );

  const handlePageChange = useCallback(
    (_event: unknown, newPage: number) => {
      if (onPageChange) {
        onPageChange(newPage, activePageSize);
      } else {
        setInternalPage(newPage);
      }
    },
    [onPageChange, activePageSize]
  );

  const handlePageSizeChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const newSize = parseInt(event.target.value, 10);
      setInternalPageSize(newSize);
      if (onPageChange) {
        onPageChange(0, newSize);
      } else {
        setInternalPage(0);
      }
    },
    [onPageChange]
  );

  const handleSelectAll = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      if (event.target.checked) {
        const allKeys = new Set(displayData.map((row, i) => getRowKey(row, i)));
        setSelected(allKeys);
      } else {
        setSelected(new Set());
      }
    },
    [displayData, getRowKey, setSelected]
  );

  const handleSelectRow = useCallback(
    (key: string) => {
      const next = new Set(activeSelected);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      setSelected(next);
    },
    [activeSelected, setSelected]
  );

  const handleExportCSV = useCallback(() => {
    const exportColumns = columns.filter(col => col.exportable !== false);
    const headers = exportColumns.map(col => col.header).join(',');
    const rows = data.map(row =>
      exportColumns
        .map(col => {
          if (col.exportValue) return col.exportValue(row);
          const val = (row as Record<string, unknown>)[col.key];
          if (val == null) return '';
          const str = String(val);
          // Escape CSV values containing commas, quotes, or newlines
          if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            return `"${str.replace(/"/g, '""')}"`;
          }
          return str;
        })
        .join(',')
    );
    downloadCSV([headers, ...rows].join('\n'), csvFilename);
  }, [columns, data, csvFilename]);

  // ---- Render helpers ----
  const colSpan = columns.length + (selectable ? 1 : 0);

  const showToolbar = title || onExportCSV || toolbarActions;

  return (
    <Box>
      {showToolbar && (
        <Toolbar
          variant="dense"
          sx={{
            pl: { sm: 2 },
            pr: { xs: 1, sm: 1 },
            ...(activeSelected.size > 0 && {
              bgcolor: theme => theme.palette.action.selected,
            }),
          }}
        >
          {activeSelected.size > 0 ? (
            <Typography sx={{ flex: '1 1 100%' }} color="inherit" variant="subtitle1">
              {activeSelected.size} selected
            </Typography>
          ) : title ? (
            <Typography sx={{ flex: '1 1 100%' }} variant="h6" component="div">
              {title}
            </Typography>
          ) : (
            <Box sx={{ flex: '1 1 100%' }} />
          )}
          <Stack direction="row" spacing={0.5}>
            {onExportCSV && (
              <Tooltip title="Export CSV">
                <IconButton size="small" onClick={handleExportCSV} aria-label="export csv">
                  <FileDownloadIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
            {toolbarActions}
          </Stack>
        </Toolbar>
      )}

      {shouldVirtualize && !loading && displayData.length > 0 ? (
        /* Virtualized rendering for large datasets */
        <TableVirtuoso
          style={{ height: typeof maxHeight === 'number' ? maxHeight : 600 }}
          data={displayData}
          components={{
            Table: tableProps => (
              <Table {...tableProps} size={size} stickyHeader aria-label={ariaLabel} />
            ),
            TableHead: React.forwardRef((headProps, ref) => <TableHead {...headProps} ref={ref} />),
            TableRow: rowProps => {
              const rowIndex = rowProps['data-index'] as number;
              const row = displayData[rowIndex];
              if (!row) return <TableRow {...rowProps} />;
              const rowKey = getRowKey(row, rowIndex);
              const isSelected = activeSelected.has(rowKey);
              return (
                <TableRow
                  {...rowProps}
                  hover={hover}
                  selected={isSelected}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  sx={onRowClick ? { cursor: 'pointer' } : undefined}
                />
              );
            },
            TableBody: React.forwardRef((bodyProps, ref) => <TableBody {...bodyProps} ref={ref} />),
          }}
          fixedHeaderContent={() => (
            <TableRow>
              {selectable && (
                <TableCell padding="checkbox">
                  <Checkbox
                    indeterminate={
                      activeSelected.size > 0 && activeSelected.size < displayData.length
                    }
                    checked={displayData.length > 0 && activeSelected.size === displayData.length}
                    onChange={handleSelectAll}
                    size="small"
                  />
                </TableCell>
              )}
              {columns.map(col => (
                <TableCell
                  key={col.key}
                  align={col.align}
                  sx={col.width ? { width: col.width } : undefined}
                >
                  {col.header}
                </TableCell>
              ))}
            </TableRow>
          )}
          itemContent={(rowIndex, row) => (
            <>
              {selectable && (
                <TableCell padding="checkbox">
                  <Checkbox
                    checked={activeSelected.has(getRowKey(row, rowIndex))}
                    onChange={() => handleSelectRow(getRowKey(row, rowIndex))}
                    size="small"
                    onClick={e => e.stopPropagation()}
                  />
                </TableCell>
              )}
              {columns.map(col => (
                <TableCell key={col.key} align={col.align}>
                  {col.render
                    ? col.render(row, rowIndex)
                    : String((row as Record<string, unknown>)[col.key] ?? '')}
                </TableCell>
              ))}
            </>
          )}
        />
      ) : (
        <TableContainer sx={{ maxHeight }}>
          <Table size={size} stickyHeader={stickyHeader} aria-label={ariaLabel}>
            {/* ---- Head ---- */}
            <TableHead>
              <TableRow>
                {selectable && (
                  <TableCell padding="checkbox">
                    <Checkbox
                      indeterminate={
                        activeSelected.size > 0 && activeSelected.size < displayData.length
                      }
                      checked={displayData.length > 0 && activeSelected.size === displayData.length}
                      onChange={handleSelectAll}
                      inputProps={{ 'aria-label': 'select all' }}
                      size="small"
                    />
                  </TableCell>
                )}
                {columns.map(col => (
                  <TableCell
                    key={col.key}
                    align={col.align}
                    sx={{ width: col.width, fontWeight: 600 }}
                    sortDirection={
                      sortable && col.sortable && activeSortBy === col.key ? activeSortDir : false
                    }
                  >
                    {sortable && col.sortable ? (
                      <TableSortLabel
                        active={activeSortBy === col.key}
                        direction={activeSortBy === col.key ? activeSortDir : 'asc'}
                        onClick={() => handleSort(col.key)}
                      >
                        {col.header}
                        {activeSortBy === col.key ? (
                          <Box component="span" sx={visuallyHidden}>
                            {activeSortDir === 'desc' ? 'sorted descending' : 'sorted ascending'}
                          </Box>
                        ) : null}
                      </TableSortLabel>
                    ) : (
                      col.header
                    )}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>

            {/* ---- Body ---- */}
            <TableBody>
              {loading ? (
                // Skeleton rows
                Array.from({ length: skeletonRows }).map((_, idx) => (
                  <TableRow key={`skeleton-${idx}`}>
                    {selectable && (
                      <TableCell padding="checkbox">
                        <Skeleton variant="rectangular" width={20} height={20} />
                      </TableCell>
                    )}
                    {columns.map(col => (
                      <TableCell key={col.key} align={col.align}>
                        <Skeleton variant="text" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : displayData.length === 0 ? (
                // Empty state
                <TableRow>
                  <TableCell colSpan={colSpan} align="center" sx={{ py: 4 }}>
                    <Typography variant="body2" color="text.secondary">
                      {emptyMessage}
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                // Data rows
                displayData.map((row, rowIndex) => {
                  const rowKey = getRowKey(row, rowIndex);
                  const isSelected = activeSelected.has(rowKey);

                  return (
                    <TableRow
                      key={rowKey}
                      hover={hover}
                      selected={isSelected}
                      onClick={onRowClick ? () => onRowClick(row) : undefined}
                      sx={onRowClick ? { cursor: 'pointer' } : undefined}
                      role={selectable ? 'checkbox' : undefined}
                      aria-checked={selectable ? isSelected : undefined}
                    >
                      {selectable && (
                        <TableCell padding="checkbox">
                          <Checkbox
                            checked={isSelected}
                            onChange={() => handleSelectRow(rowKey)}
                            size="small"
                            onClick={e => e.stopPropagation()}
                            inputProps={{ 'aria-labelledby': `row-${rowKey}` }}
                          />
                        </TableCell>
                      )}
                      {columns.map(col => (
                        <TableCell key={col.key} align={col.align}>
                          {col.render
                            ? col.render(row, rowIndex)
                            : String((row as Record<string, unknown>)[col.key] ?? '')}
                        </TableCell>
                      ))}
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* ---- Pagination ---- */}
      {paginated && !loading && (
        <TablePagination
          component="div"
          count={rowCount}
          page={activePage}
          onPageChange={handlePageChange}
          rowsPerPage={activePageSize}
          onRowsPerPageChange={handlePageSizeChange}
          rowsPerPageOptions={pageSizeOptions}
        />
      )}
    </Box>
  );
}
