/**
 * Checkbox Component - Unified checkbox component for the SC Fleet Manager Design System
 *
 * This component provides a consistent checkbox interface using Material-UI's
 * Checkbox component with FormControlLabel for labeling.
 */

import {
  FormControl,
  FormControlLabel,
  FormHelperText,
  Checkbox as MuiCheckbox,
} from '@mui/material';
import { SxProps, Theme } from '@mui/material/styles';
import React, { useEffect, useRef } from 'react';

export interface CheckboxProps {
  /** Label for the checkbox */
  label?: string;
  /** Children can also be used as label (Spectrum compatibility) */
  children?: React.ReactNode;
  /** Whether the checkbox is checked */
  checked?: boolean;
  /** Default checked state (uncontrolled) */
  defaultChecked?: boolean;
  /** Change handler */
  onChange?: (checked: boolean) => void;
  /** Whether the checkbox is disabled */
  disabled?: boolean;
  /** Whether the checkbox is in an indeterminate state */
  indeterminate?: boolean;
  /** Helper text to display below the checkbox */
  helperText?: string;
  /** Error state */
  isInvalid?: boolean;
  /** Error message */
  errorMessage?: string;
  /** Name attribute */
  name?: string;
  /** Value attribute */
  value?: string;
  /** ID attribute */
  id?: string;
  /** Size of the checkbox */
  size?: 'sm' | 'md' | 'lg';
  /** ARIA label (used if no label prop) */
  'aria-label'?: string;
  /** Whether the checkbox is required */
  required?: boolean;
}

/**
 * Checkbox component with consistent styling across the application.
 *
 * @example
 * // Basic checkbox
 * <Checkbox
 *   label="Accept terms and conditions"
 *   checked={accepted}
 *   onChange={setAccepted}
 * />
 *
 * // With helper text
 * <Checkbox
 *   label="Subscribe to newsletter"
 *   helperText="You can unsubscribe at any time"
 * />
 *
 * // Indeterminate state
 * <Checkbox
 *   label="Select all"
 *   indeterminate={someSelected}
 *   checked={allSelected}
 * />
 */
export function Checkbox({
  label,
  children,
  checked,
  defaultChecked,
  onChange,
  disabled,
  indeterminate,
  helperText,
  isInvalid,
  errorMessage,
  name,
  value,
  id,
  size = 'md',
  required,
  ...props
}: CheckboxProps): React.ReactElement {
  const checkboxRef = useRef<HTMLInputElement>(null);

  // Use children as label if label prop not provided (Spectrum compat)
  const _effectiveLabel = label || (typeof children === 'string' ? children : undefined);
  const effectiveLabelNode = label ? label : children;

  // Map size to MUI size
  const muiSize = size === 'sm' ? 'small' : size === 'lg' ? 'medium' : 'small';

  // Set indeterminate state via ref since it's not a standard HTML attribute
  useEffect(() => {
    if (checkboxRef.current) {
      checkboxRef.current.indeterminate = indeterminate || false;
    }
  }, [indeterminate]);

  // Handle change event
  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (onChange) {
      onChange(event.target.checked);
    }
  };

  // Custom sx styles
  const sxStyles: SxProps<Theme> = {
    '& .MuiCheckbox-root': {
      padding: size === 'sm' ? '4px' : size === 'lg' ? '12px' : '9px',
    },
  };

  const checkboxElement = (
    <MuiCheckbox
      inputRef={checkboxRef}
      checked={checked}
      defaultChecked={defaultChecked}
      onChange={handleChange}
      disabled={disabled}
      indeterminate={indeterminate}
      name={name}
      value={value}
      id={id}
      size={muiSize}
      required={required}
      {...props}
    />
  );

  // If there's a label, wrap with FormControlLabel
  if (effectiveLabelNode) {
    const control = (
      <FormControlLabel
        control={checkboxElement}
        label={effectiveLabelNode}
        disabled={disabled}
        sx={sxStyles}
      />
    );

    // If there's helper text or error, wrap with FormControl
    if (helperText || errorMessage) {
      return (
        <FormControl error={isInvalid} disabled={disabled}>
          {control}
          {(errorMessage || helperText) && (
            <FormHelperText sx={{ ml: 4 }}>{errorMessage || helperText}</FormHelperText>
          )}
        </FormControl>
      );
    }

    return control;
  }

  // No label, return just the checkbox
  return checkboxElement;
}
