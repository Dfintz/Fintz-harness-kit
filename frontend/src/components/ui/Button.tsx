/**
 * Button Component - Unified button component for the SC Fleet Manager Design System
 *
 * This component provides a consistent button interface using Material-UI
 * as the underlying implementation for a modern, accessible design system.
 */

import React from 'react';
import { Button as MuiButton, CircularProgress } from '@mui/material';
import { SxProps, Theme } from '@mui/material/styles';

export interface ButtonProps {
  /** Visual style variant of the button */
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline';
  /** Size of the button */
  size?: 'sm' | 'md' | 'lg';
  /** Whether the button is in a loading state */
  loading?: boolean;
  /** Icon to display before the button text */
  leftIcon?: React.ReactNode;
  /** Icon to display after the button text */
  rightIcon?: React.ReactNode;
  /** Button content */
  children?: React.ReactNode;
  /** Whether the button is disabled */
  disabled?: boolean;
  /** Click handler */
  onClick?: () => void;
  /** Press handler (compatibility with Spectrum) */
  onPress?: () => void;
  /** Button type */
  type?: 'button' | 'submit' | 'reset';
  /** Additional class name */
  className?: string;
  /** ARIA label */
  'aria-label'?: string;
  /** Full width button */
  fullWidth?: boolean;
}

// Map our variant names to MUI variants and colors
const getMuiVariant = (variant: string): 'contained' | 'outlined' | 'text' => {
  switch (variant) {
    case 'primary':
    case 'danger':
      return 'contained';
    case 'secondary':
      return 'contained';
    case 'outline':
      return 'outlined';
    case 'ghost':
      return 'text';
    default:
      return 'contained';
  }
};

const getMuiColor = (variant: string): 'primary' | 'secondary' | 'error' | 'inherit' => {
  switch (variant) {
    case 'primary':
      return 'primary';
    case 'secondary':
      return 'secondary';
    case 'danger':
      return 'error';
    default:
      return 'primary';
  }
};

const getMuiSize = (size: string): 'small' | 'medium' | 'large' => {
  switch (size) {
    case 'sm':
      return 'small';
    case 'lg':
      return 'large';
    default:
      return 'medium';
  }
};

/**
 * Button component with consistent styling across the application.
 *
 * @example
 * // Primary button
 * <Button variant="primary" onClick={handleClick}>Save</Button>
 *
 * // Loading state
 * <Button variant="primary" loading>Saving...</Button>
 *
 * // With icons
 * <Button variant="outline" leftIcon={<AddIcon />}>Add Item</Button>
 */
export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  leftIcon,
  rightIcon,
  children,
  disabled,
  onClick,
  onPress,
  type = 'button',
  fullWidth = false,
  className,
  ...props
}: ButtonProps): React.ReactElement {
  const muiVariant = getMuiVariant(variant);
  const muiColor = getMuiColor(variant);
  const muiSize = getMuiSize(size);

  // Handle both onClick and onPress for backward compatibility
  const handleClick = (_event: React.MouseEvent<HTMLButtonElement>) => {
    if (onClick) {
      onClick();
    } else if (onPress) {
      onPress();
    }
  };

  // Custom sx styles for size variations
  const sxStyles: SxProps<Theme> = {
    minHeight: size === 'sm' ? '28px' : size === 'lg' ? '44px' : '36px',
    fontSize: size === 'sm' ? '0.875rem' : size === 'lg' ? '1.125rem' : '1rem',
    textTransform: 'none', // Prevent uppercase transformation
  };

  return (
    <MuiButton
      variant={muiVariant}
      color={muiColor}
      size={muiSize}
      disabled={disabled || loading}
      onClick={handleClick}
      type={type}
      fullWidth={fullWidth}
      className={className}
      startIcon={!loading && leftIcon ? leftIcon : undefined}
      endIcon={!loading && rightIcon ? rightIcon : undefined}
      sx={sxStyles}
      {...props}
    >
      {loading ? (
        <>
          <CircularProgress size={16} color="inherit" sx={{ mr: 1 }} />
          {children}
        </>
      ) : (
        children
      )}
    </MuiButton>
  );
}
