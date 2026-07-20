/**
 * Divider Component - MUI Divider wrapper for consistency
 */

import { Divider as MuiDivider, DividerProps as MuiDividerProps } from '@mui/material';
import React from 'react';

export interface DividerProps extends Omit<MuiDividerProps, 'size'> {
  /** Size of the divider (Spectrum compatibility) */
  size?: 'S' | 'M' | 'L';
  /** UNSAFE style (Spectrum compatibility) */
  UNSAFE_style?: React.CSSProperties;
}

export const Divider: React.FC<DividerProps> = ({ size: _size, UNSAFE_style, sx, ...props }) => {
  return <MuiDivider sx={sx} style={UNSAFE_style} {...props} />;
};
