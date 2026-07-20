/**
 * IconButton Component - Unified icon button component for the SC Fleet Manager Design System
 *
 * This component provides a consistent icon button interface using Material-UI's
 * IconButton component. Designed to replace Spectrum ActionButton with backward compatibility.
 */

import { IconButton as MuiIconButton, Tooltip } from '@mui/material';
import { SxProps, Theme } from '@mui/material/styles';
import React from 'react';

export interface IconButtonProps {
  /** Icon to display */
  children: React.ReactNode;
  /** Click handler */
  onClick?: () => void;
  /** Press handler (backward compatibility with Spectrum) */
  onPress?: () => void;
  /** Whether button is disabled */
  disabled?: boolean;
  /** Whether button is disabled (backward compatibility with Spectrum) */
  isDisabled?: boolean;
  /** Size of the button */
  size?: 'sm' | 'md' | 'lg';
  /** Tooltip text to display on hover */
  tooltip?: string;
  /** ARIA label for accessibility */
  'aria-label'?: string;
  /** ARIA expanded state */
  'aria-expanded'?: boolean;
  /** ARIA controls */
  'aria-controls'?: string;
  /** Quiet/subtle styling (maps to default color) */
  isQuiet?: boolean;
  /** Color variant */
  color?: 'primary' | 'secondary' | 'default' | 'error' | 'info' | 'success' | 'warning';
  /** Edge placement (affects padding) */
  edge?: 'start' | 'end' | false;
  /** Additional class name */
  className?: string;
  /** Custom unsafe class name (backward compatibility) */
  UNSAFE_className?: string;
  /** Custom sx styles */
  sx?: SxProps<Theme>;
  /** ID attribute */
  id?: string;
}

/**
 * IconButton component with consistent styling across the application.
 * Replaces Spectrum ActionButton with full backward compatibility.
 *
 * @example
 * // Basic icon button
 * <IconButton onClick={handleClick} aria-label="Refresh">
 *   <RefreshIcon />
 * </IconButton>
 *
 * // With tooltip
 * <IconButton tooltip="Refresh data" onClick={handleClick}>
 *   <RefreshIcon />
 * </IconButton>
 *
 * // Quiet/subtle variant
 * <IconButton isQuiet onClick={handleClick}>
 *   <MenuIcon />
 * </IconButton>
 *
 * // Backward compatible with Spectrum ActionButton
 * <IconButton onClick={handlePress} disabled={loading}>
 *   <CloseIcon />
 * </IconButton>
 */
export function IconButton({
  children,
  onClick,
  onPress,
  disabled,
  isDisabled,
  size = 'md',
  tooltip,
  isQuiet,
  color,
  edge,
  className,
  UNSAFE_className,
  sx,
  ...props
}: IconButtonProps): React.ReactElement {
  // Map size to MUI size
  const muiSize = size === 'sm' ? 'small' : size === 'lg' ? 'large' : 'medium';

  // Handle disabled state (support both prop names)
  const isButtonDisabled = disabled || isDisabled;

  // Handle click event (support both onClick and onPress)
  const handleClick = (_event: React.MouseEvent<HTMLButtonElement>) => {
    if (onClick) {
      onClick();
    } else if (onPress) {
      onPress();
    }
  };

  // Determine color (quiet = default, otherwise use provided color or primary)
  const buttonColor = isQuiet ? 'default' : color || 'primary';

  // Combine class names
  const combinedClassName = [className, UNSAFE_className].filter(Boolean).join(' ');

  // Create the button element
  const button = (
    <MuiIconButton
      onClick={handleClick}
      disabled={isButtonDisabled}
      size={muiSize}
      color={buttonColor}
      edge={edge}
      className={combinedClassName || undefined}
      sx={sx}
      aria-label={props['aria-label'] || tooltip}
      {...props}
    >
      {children}
    </MuiIconButton>
  );

  // Wrap with tooltip if provided
  if (tooltip) {
    return (
      <Tooltip title={tooltip} arrow>
        {isButtonDisabled ? (
          <span style={{ display: 'inline-block', cursor: 'not-allowed' }}>{button}</span>
        ) : (
          button
        )}
      </Tooltip>
    );
  }

  return button;
}
