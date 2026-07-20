/**
 * Grid Component - MUI Grid wrapper with Spectrum-style props
 */

import { Box, BoxProps } from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';
import React from 'react';

export interface GridProps extends Omit<BoxProps, 'columns'> {
  /** Spectrum-style columns array (e.g., ['1fr', '1fr']) or responsive object */
  columns?: string[] | Record<string, string[]>;
  /** Spectrum-style auto rows */
  autoRows?: string;
  /** Spectrum-style gap */
  gap?: string | number;
  /** UNSAFE_style compatibility */
  UNSAFE_style?: React.CSSProperties;
}

export const Grid: React.FC<GridProps & { children?: React.ReactNode }> = ({
  columns,
  autoRows,
  gap,
  UNSAFE_style,
  sx,
  children,
  ...props
}) => {
  // Convert Spectrum columns to CSS Grid
  let gridTemplateColumns: string | undefined;
  if (columns) {
    // Handle responsive object format: { base: ['1fr'], M: ['1fr', '1fr'] }
    let colArray: string[];
    if (Array.isArray(columns)) {
      colArray = columns;
    } else {
      // Use the largest breakpoint or fallback to 'base'
      colArray = columns.M || columns.L || columns.base || Object.values(columns)[0] || ['1fr'];
    }
    gridTemplateColumns = colArray.join(' ');
  }

  // Convert Spectrum gap size-* format to pixels
  let gapValue: string | number | undefined;
  if (typeof gap === 'string' && gap.startsWith('size-')) {
    const sizeNum = parseInt(gap.replace('size-', '')) / 100;
    gapValue = sizeNum;
  } else {
    gapValue = gap;
  }

  const mappedSx = {
    display: 'grid',
    ...(gridTemplateColumns && { gridTemplateColumns }),
    ...(autoRows && { gridAutoRows: autoRows }),
    ...(gapValue !== undefined && { gap: gapValue }),
    ...sx,
    ...UNSAFE_style,
  };

  return (
    <Box sx={mappedSx as SxProps<Theme>} {...props}>
      {children}
    </Box>
  );
};
