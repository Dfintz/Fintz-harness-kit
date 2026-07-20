/**
 * Well Component - Container for grouped content
 *
 * A simple container component used to visually group content
 * with optional styling for background and borders.
 */

import { Box, type BoxProps } from '@mui/material';
import React from 'react';

export interface WellProps extends BoxProps {
  children?: React.ReactNode;
  /** Legacy Spectrum escape hatch; maps to sx for compatibility. */
  UNSAFE_style?: React.CSSProperties;
}

/**
 * Well component - a styled container for content grouping
 * @example
 * <Well sx={{ p: 2, borderRadius: 1 }}>
 *   Content here
 * </Well>
 */
function WellComponent(
  { children, sx, UNSAFE_style, ...props }: WellProps,
  ref?: React.Ref<HTMLDivElement>
) {
  return (
    <Box
      ref={ref}
      sx={{
        borderRadius: 1,
        padding: 2,
        ...UNSAFE_style,
        ...sx,
      }}
      {...props}
    >
      {children}
    </Box>
  );
}

export const Well = React.forwardRef<HTMLDivElement, WellProps>(WellComponent);
Well.displayName = 'Well';
