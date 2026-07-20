/**
 * Input Component - Unified text input component for the SC Fleet Manager Design System
 *
 * This component provides a consistent input interface using Material-UI's
 * TextField component for accessible, modern inputs.
 */

import React from 'react';
import { TextField, InputAdornment } from '@mui/material';
import { SxProps, Theme } from '@mui/material/styles';

export interface InputProps {
  /** Size of the input */
  size?: 'sm' | 'md' | 'lg';
  /** Icon or element to display at the start of the input */
  startAdornment?: React.ReactNode;
  /** Icon or element to display at the end of the input */
  endAdornment?: React.ReactNode;
  /** Whether the input is in an error state */
  isInvalid?: boolean;
  /** Error message to display */
  errorMessage?: string;
  /** Label for the input */
  label?: string;
  /** Placeholder text */
  placeholder?: string;
  /** Current value */
  value?: string;
  /** Default value */
  defaultValue?: string;
  /** Change handler */
  onChange?: (value: string) => void;
  /** Input type */
  type?: 'text' | 'email' | 'password' | 'number' | 'tel' | 'url' | 'search';
  /** Whether the input is disabled */
  disabled?: boolean;
  /** Whether the input is required */
  required?: boolean;
  /** Whether to render as textarea */
  multiline?: boolean;
  /** Number of rows for textarea */
  rows?: number;
  /** Helper text */
  helperText?: string;
  /** Name attribute */
  name?: string;
  /** ID attribute */
  id?: string;
  /** Blur handler */
  onBlur?: () => void;
  /** Focus handler */
  onFocus?: () => void;
  /** Read-only state */
  readOnly?: boolean;
  /** Auto focus */
  autoFocus?: boolean;
  /** Full width */
  fullWidth?: boolean;
}

/**
 * Input component with consistent styling across the application.
 *
 * @example
 * // Basic input
 * <Input label="Email" type="email" />
 *
 * // With error
 * <Input
 *   label="Email"
 *   isInvalid
 *   errorMessage="Invalid email format"
 * />
 *
 * // Multiline
 * <Input
 *   label="Description"
 *   multiline
 *   rows={4}
 * />
 */
export function Input({
  size = 'md',
  startAdornment,
  endAdornment,
  isInvalid,
  errorMessage,
  label,
  placeholder,
  value,
  defaultValue,
  onChange,
  type = 'text',
  disabled,
  required,
  multiline,
  rows,
  helperText,
  name,
  id,
  onBlur,
  onFocus,
  readOnly,
  autoFocus,
  fullWidth = true,
}: InputProps): React.ReactElement {
  // Map size to MUI size
  const muiSize = size === 'sm' ? 'small' : size === 'lg' ? 'medium' : 'small';

  // Handle change event
  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (onChange) {
      onChange(event.target.value);
    }
  };

  // Custom sx styles for size variations
  const sxStyles: SxProps<Theme> = {
    '& .MuiInputBase-input': {
      fontSize: size === 'sm' ? '0.875rem' : size === 'lg' ? '1.125rem' : '1rem',
    },
  };

  return (
    <TextField
      label={label}
      placeholder={placeholder}
      value={value}
      defaultValue={defaultValue}
      onChange={handleChange}
      type={type}
      disabled={disabled}
      required={required}
      multiline={multiline}
      rows={rows}
      error={isInvalid}
      helperText={errorMessage || helperText}
      name={name}
      id={id}
      onBlur={onBlur}
      onFocus={onFocus}
      autoFocus={autoFocus}
      fullWidth={fullWidth}
      size={muiSize}
      sx={sxStyles}
      InputProps={{
        readOnly,
        startAdornment: startAdornment ? (
          <InputAdornment position="start">{startAdornment}</InputAdornment>
        ) : undefined,
        endAdornment: endAdornment ? (
          <InputAdornment position="end">{endAdornment}</InputAdornment>
        ) : undefined,
      }}
    />
  );
}
