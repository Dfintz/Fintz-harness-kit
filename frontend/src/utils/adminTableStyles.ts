/**
 * Admin Table Styling Utilities
 *
 * Provides reusable MUI sx prop styles for consistent table styling
 * across admin components. Eliminates inline styles and improves
 * maintainability.
 */

import { alpha, SxProps, Theme } from '@mui/material/styles';

/**
 * Base table styles - apply to the <table> element
 */
export const adminTableStyles: SxProps<Theme> = (theme: Theme) => ({
  width: '100%',
  borderCollapse: 'collapse',
  '& thead': {
    backgroundColor: alpha(theme.palette.primary.main, 0.05),
  },
  '& tbody tr:hover': {
    backgroundColor: alpha(theme.palette.primary.main, 0.03),
  },
});

/**
 * Table header cell styles
 * @param align - Text alignment: 'left' or 'right' (default: 'left')
 */
export const adminTableHeaderCellStyles = (align: 'left' | 'right' = 'left'): SxProps<Theme> => ({
  padding: '12px',
  textAlign: align,
  borderBottom: '1px solid',
  borderBottomColor: 'divider',
  color: 'text.secondary',
  fontWeight: 'bold',
  fontSize: '0.875rem',
});

/**
 * Table data cell styles
 * @param align - Text alignment: 'left', 'right', or 'center' (default: 'left')
 */
export const adminTableDataCellStyles = (
  align: 'left' | 'right' | 'center' = 'left'
): SxProps<Theme> => ({
  padding: '12px',
  textAlign: align,
  borderBottom: '1px solid',
  borderBottomColor: 'action.hover',
  fontSize: '0.875rem',
});

/**
 * Table container styles - use on a Box wrapper for scrollable tables
 */
export const adminTableContainerStyles: SxProps<Theme> = {
  overflowX: 'auto',
  borderRadius: 1,
  backgroundColor: 'background.paper',
};

/**
 * Compact table header cell styles (smaller padding for dense tables)
 */
export const adminTableHeaderCellCompactStyles = (
  align: 'left' | 'right' = 'left'
): SxProps<Theme> => ({
  padding: '8px',
  textAlign: align,
  borderBottom: '1px solid',
  borderBottomColor: 'divider',
  color: 'text.secondary',
  fontWeight: 'bold',
  fontSize: '0.75rem',
});

/**
 * Compact table data cell styles (smaller padding for dense tables)
 */
export const adminTableDataCellCompactStyles = (
  align: 'left' | 'right' | 'center' = 'left'
): SxProps<Theme> => ({
  padding: '8px',
  textAlign: align,
  borderBottom: '1px solid',
  borderBottomColor: 'action.hover',
  fontSize: '0.75rem',
});

/**
 * Highlight cell styles - for important data
 */
export const adminTableHighlightCellStyles =
  (align: 'left' | 'right' = 'left'): SxProps<Theme> =>
  (theme: Theme) => ({
    ...(adminTableDataCellStyles(align) as Record<string, unknown>),
    backgroundColor: alpha(theme.palette.primary.main, 0.08),
    fontWeight: 'bold',
  });

/**
 * Status cell styles - for status-colored cells
 */
export const adminTableStatusCellStyles = (
  status: 'success' | 'warning' | 'error' | 'info'
): SxProps<Theme> => {
  const colorMap = {
    success: 'success.main',
    warning: 'warning.main',
    error: 'error.main',
    info: 'info.main',
  };

  return {
    ...adminTableDataCellStyles('center'),
    color: colorMap[status],
    fontWeight: 'bold',
  };
};

/**
 * Well-style info box (replaces UNSAFE_style)
 */
export const adminWellStyles =
  (borderColor?: string): SxProps<Theme> =>
  (theme: Theme) => ({
    padding: 2,
    border: '1px solid',
    borderColor: borderColor ?? theme.palette.primary.main,
    borderRadius: 1,
    backgroundColor: alpha(theme.palette.primary.main, 0.05),
    marginBottom: 3,
  });

/**
 * Icon styling for admin components
 */
export const adminIconStyles =
  (color?: string): SxProps<Theme> =>
  (theme: Theme) => ({
    color: color ?? theme.palette.primary.main,
    fontSize: '1.5rem',
  });

/**
 * Helper function to merge custom styles with base table styles
 */
export const mergeTableStyles = (
  baseStyles: SxProps<Theme>,
  customStyles?: SxProps<Theme>
): SxProps<Theme> => (customStyles ? ([baseStyles, customStyles] as SxProps<Theme>) : baseStyles);
