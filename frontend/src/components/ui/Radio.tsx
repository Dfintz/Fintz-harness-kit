/**
 * Radio Component - Unified radio button component for the SC Fleet Manager Design System
 *
 * This component provides a consistent radio interface using Material-UI's
 * Radio and RadioGroup components with FormControlLabel for labeling.
 */

import React from 'react';
import {
  Radio as MuiRadio,
  RadioGroup,
  FormControlLabel,
  FormControl,
  FormLabel,
  FormHelperText,
} from '@mui/material';
import { SxProps, Theme } from '@mui/material/styles';

export interface RadioOption {
  /** The value of the option */
  value: string;
  /** The display label of the option */
  label: string;
  /** Whether the option is disabled */
  disabled?: boolean;
}

export interface RadioProps {
  /** Options to display as radio buttons */
  options: RadioOption[];
  /** Label for the radio group */
  label?: string;
  /** Current selected value */
  value?: string;
  /** Default selected value (uncontrolled) */
  defaultValue?: string;
  /** Change handler */
  onChange?: (value: string) => void;
  /** Whether the radio group is disabled */
  disabled?: boolean;
  /** Helper text to display below the radio group */
  helperText?: string;
  /** Error state */
  isInvalid?: boolean;
  /** Error message */
  errorMessage?: string;
  /** Name attribute for the radio group */
  name?: string;
  /** ID attribute */
  id?: string;
  /** Whether to display options in a row (horizontal) or column (vertical) */
  row?: boolean;
  /** Size of the radio buttons */
  size?: 'sm' | 'md' | 'lg';
  /** Whether the radio group is required */
  required?: boolean;
}

/**
 * Radio component with consistent styling across the application.
 *
 * @example
 * // Basic radio group
 * <Radio
 *   label="Select option"
 *   options={[
 *     { value: 'option1', label: 'Option 1' },
 *     { value: 'option2', label: 'Option 2' },
 *   ]}
 *   value={selected}
 *   onChange={setSelected}
 * />
 *
 * // Horizontal layout
 * <Radio
 *   label="Choose one"
 *   options={options}
 *   row
 * />
 */
export function Radio({
  options,
  label,
  value,
  defaultValue,
  onChange,
  disabled,
  helperText,
  isInvalid,
  errorMessage,
  name,
  id,
  row = false,
  size = 'md',
  required,
}: RadioProps): React.ReactElement {
  // Map size to MUI size
  const muiSize = size === 'sm' ? 'small' : size === 'lg' ? 'medium' : 'small';

  // Handle change event
  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (onChange) {
      onChange(event.target.value);
    }
  };

  // Custom sx styles
  const sxStyles: SxProps<Theme> = {
    '& .MuiRadio-root': {
      padding: size === 'sm' ? '4px' : size === 'lg' ? '12px' : '9px',
    },
  };

  return (
    <FormControl error={isInvalid} disabled={disabled} required={required} component="fieldset">
      {label && <FormLabel component="legend">{label}</FormLabel>}
      <RadioGroup
        name={name}
        value={value}
        defaultValue={defaultValue}
        onChange={handleChange}
        row={row}
        id={id}
        sx={sxStyles}
      >
        {options.map(option => (
          <FormControlLabel
            key={option.value}
            value={option.value}
            control={<MuiRadio size={muiSize} />}
            label={option.label}
            disabled={disabled || option.disabled}
          />
        ))}
      </RadioGroup>
      {(errorMessage || helperText) && (
        <FormHelperText>{errorMessage || helperText}</FormHelperText>
      )}
    </FormControl>
  );
}
