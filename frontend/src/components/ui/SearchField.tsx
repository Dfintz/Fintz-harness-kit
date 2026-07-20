/**
 * SearchField Component - Unified search input component for the SC Fleet Manager Design System
 *
 * This component provides a consistent search interface using Material-UI's
 * TextField component with integrated search icon and clear functionality.
 */

import React from 'react';
import { TextField, InputAdornment, IconButton } from '@mui/material';
import { Search as SearchIcon, Clear as ClearIcon } from '@mui/icons-material';
import { SxProps, Theme } from '@mui/material/styles';

export interface SearchFieldProps {
  /** Label for the search field */
  label?: string;
  /** Current search value */
  value?: string;
  /** Change handler */
  onChange?: (value: string) => void;
  /** Placeholder text */
  placeholder?: string;
  /** Whether the search field is disabled */
  disabled?: boolean;
  /** Width of the search field */
  width?: string | number;
  /** Whether to show the clear button */
  showClearButton?: boolean;
  /** Clear handler (called when clear button is clicked) */
  onClear?: () => void;
  /** Blur handler */
  onBlur?: () => void;
  /** Focus handler */
  onFocus?: () => void;
  /** ID attribute */
  id?: string;
  /** Name attribute */
  name?: string;
  /** ARIA label */
  'aria-label'?: string;
  /** Auto focus */
  autoFocus?: boolean;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Full width */
  fullWidth?: boolean;
}

/**
 * SearchField component with integrated search icon and clear functionality.
 *
 * @example
 * // Basic search field
 * <SearchField
 *   label="Search"
 *   value={searchTerm}
 *   onChange={setSearchTerm}
 * />
 *
 * // With clear button
 * <SearchField
 *   placeholder="Search items..."
 *   value={searchTerm}
 *   onChange={setSearchTerm}
 *   showClearButton
 *   onClear={() => setSearchTerm('')}
 * />
 */
export function SearchField({
  label,
  value = '',
  onChange,
  placeholder,
  disabled,
  width,
  showClearButton = true,
  onClear,
  onBlur,
  onFocus,
  id,
  name,
  autoFocus,
  size = 'md',
  fullWidth = false,
  ...props
}: SearchFieldProps): React.ReactElement {
  // Map size to MUI size
  const muiSize = size === 'sm' ? 'small' : size === 'lg' ? 'medium' : 'small';

  // Handle change event
  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (onChange) {
      onChange(event.target.value);
    }
  };

  // Handle clear
  const handleClear = () => {
    if (onClear) {
      onClear();
    } else if (onChange) {
      onChange('');
    }
  };

  // Custom sx styles
  const sxStyles: SxProps<Theme> = {
    width: width || (fullWidth ? '100%' : '300px'),
    '& .MuiInputBase-input': {
      fontSize: size === 'sm' ? '0.875rem' : size === 'lg' ? '1.125rem' : '1rem',
    },
  };

  return (
    <TextField
      label={label}
      placeholder={placeholder}
      value={value}
      onChange={handleChange}
      disabled={disabled}
      onBlur={onBlur}
      onFocus={onFocus}
      id={id}
      name={name}
      autoFocus={autoFocus}
      size={muiSize}
      fullWidth={fullWidth}
      sx={sxStyles}
      InputProps={{
        startAdornment: (
          <InputAdornment position="start">
            <SearchIcon fontSize="small" />
          </InputAdornment>
        ),
        endAdornment:
          showClearButton && value && value.length > 0 ? (
            <InputAdornment position="end">
              <IconButton aria-label="clear search" onClick={handleClear} edge="end" size="small">
                <ClearIcon fontSize="small" />
              </IconButton>
            </InputAdornment>
          ) : null,
      }}
      {...props}
    />
  );
}
