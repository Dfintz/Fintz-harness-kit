/**
 * Select Component - Unified select/dropdown component for the SC Fleet Manager Design System
 *
 * This component provides a consistent select interface using Material-UI's
 * Select component for accessible, modern dropdowns.
 */

import {
  FormControl,
  FormHelperText,
  InputLabel,
  MenuItem,
  Select as MuiSelect,
} from '@mui/material';
import { SxProps, Theme } from '@mui/material/styles';
import React from 'react';

export interface SelectOption {
  /** The value of the option */
  value: string | number;
  /** The display label of the option */
  label: string;
  /** Whether the option is disabled */
  disabled?: boolean;
}

export interface SelectProps {
  /** Options to display in the select */
  options?: SelectOption[];
  /** Children (Spectrum Item compatibility) */
  children?: React.ReactNode;
  /** Size of the select */
  size?: 'sm' | 'md' | 'lg';
  /** Whether the select is in an error state */
  isInvalid?: boolean;
  /** Error message to display */
  errorMessage?: string;
  /** Helper text to display */
  helperText?: string;
  /** Placeholder text when no value is selected */
  placeholder?: string;
  /** Label for the select */
  label?: string;
  /** Current selected value */
  value?: string | number;
  /** Default selected value */
  defaultValue?: string | number;
  /** Change handler */
  onChange?: (value: string | number) => void;
  /** Selection change handler (compatibility) */
  onSelectionChange?: (key: React.Key) => void;
  /** Whether the select is disabled */
  disabled?: boolean;
  /** Whether the select is required */
  required?: boolean;
  /** Whether to take full width */
  fullWidth?: boolean;
  /** Name attribute */
  name?: string;
  /** ID attribute */
  id?: string;
}

/**
 * Select component with consistent styling across the application.
 *
 * @example
 * // Basic select
 * <Select
 *   label="Status"
 *   options={[
 *     { value: 'active', label: 'Active' },
 *     { value: 'inactive', label: 'Inactive' },
 *   ]}
 * />
 *
 * // With placeholder
 * <Select
 *   label="Role"
 *   placeholder="Select a role"
 *   options={roles}
 * />
 */
export function Select({
  options,
  children,
  size = 'md',
  isInvalid,
  errorMessage,
  helperText,
  placeholder,
  label,
  value,
  defaultValue,
  onChange,
  onSelectionChange,
  disabled,
  required,
  fullWidth = true,
  name,
  id,
}: SelectProps & { children?: React.ReactNode }): React.ReactElement {
  // Convert children (Item elements) to options if options not provided
  let finalOptions = options || [];

  if (!finalOptions.length && children) {
    finalOptions = React.Children.toArray(children)
      .filter((child): child is React.ReactElement => React.isValidElement(child))
      .map((child, index) => ({
        value: child.key || String(index),
        label: child.props.children || child.props.textValue || '',
        disabled: child.props.disabled,
      }));
  }

  // Map size to MUI size
  const muiSize = size === 'sm' ? 'small' : size === 'lg' ? 'medium' : 'small';

  // Handle change event
  const handleChange = (
    event: React.ChangeEvent<{ value: unknown }> | { target: { value: string } }
  ) => {
    const selectedValue = event.target.value as string;

    // Find the original option to preserve type
    const originalOption = options?.find(opt => String(opt.value) === String(selectedValue));
    const valueToEmit = originalOption ? originalOption.value : selectedValue;

    if (onChange) {
      onChange(valueToEmit);
    }
    if (onSelectionChange) {
      onSelectionChange(selectedValue);
    }
  };

  // Generate a unique ID for the label
  const labelId = id ? `${id}-label` : `select-label-${Math.random().toString(36).substr(2, 9)}`;

  // Custom sx styles
  const sxStyles: SxProps<Theme> = {
    '& .MuiInputBase-input': {
      fontSize: size === 'sm' ? '0.875rem' : size === 'lg' ? '1.125rem' : '1rem',
    },
  };

  return (
    <FormControl
      fullWidth={fullWidth}
      error={isInvalid}
      disabled={disabled}
      required={required}
      size={muiSize}
      sx={sxStyles}
    >
      {label && <InputLabel id={labelId}>{label}</InputLabel>}
      <MuiSelect
        labelId={labelId}
        id={id}
        name={name}
        value={
          value === undefined
            ? defaultValue === undefined
              ? ''
              : String(defaultValue)
            : String(value)
        }
        onChange={handleChange}
        label={label}
        displayEmpty={!!placeholder}
      >
        {placeholder && (
          <MenuItem value="" disabled>
            <em>{placeholder}</em>
          </MenuItem>
        )}
        {finalOptions.map(option => (
          <MenuItem
            key={String(option.value)}
            value={String(option.value)}
            disabled={option.disabled}
          >
            {option.label}
          </MenuItem>
        ))}
      </MuiSelect>
      {(errorMessage || helperText) && (
        <FormHelperText>{errorMessage || helperText}</FormHelperText>
      )}
    </FormControl>
  );
}
