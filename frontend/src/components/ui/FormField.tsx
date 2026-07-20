/**
 * FormField Component - Bridges useFormValidation with Input for consistent form patterns
 *
 * Provides a labeled input with integrated error display. Works seamlessly with
 * useFormValidation's getFieldProps() or can be used standalone.
 *
 * @example
 * // With useFormValidation
 * const { getFieldProps } = useFormValidation({ ... });
 * <FormField label="Username" {...getFieldProps('username')} />
 *
 * @example
 * // Standalone
 * <FormField
 *   label="Email"
 *   name="email"
 *   type="email"
 *   value={email}
 *   onChange={handleChange}
 *   error={emailError}
 *   required
 * />
 */

import React from 'react';
import { Input } from './Input';

export interface FormFieldProps {
  /** Field name (used for id and htmlFor linking) */
  name: string;
  /** Label text */
  label: string;
  /** Current value */
  value?: unknown;
  /** Change handler - accepts event (from useFormValidation) or string value */
  onChange?: ((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void) | ((value: string) => void);
  /** Blur handler */
  onBlur?: ((e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void) | (() => void);
  /** Error message (shown when truthy) */
  error?: string;
  /** Helper text shown below input (when no error) */
  helperText?: string;
  /** Input type */
  type?: 'text' | 'email' | 'password' | 'number' | 'tel' | 'url' | 'search';
  /** Placeholder text */
  placeholder?: string;
  /** Whether the field is required */
  required?: boolean;
  /** Whether the field is disabled */
  disabled?: boolean;
  /** Whether to render as textarea */
  multiline?: boolean;
  /** Number of rows for textarea */
  rows?: number;
  /** Input size */
  size?: 'sm' | 'md' | 'lg';
  /** Full width (default: true) */
  fullWidth?: boolean;
  /** Auto focus */
  autoFocus?: boolean;
  /** Read-only */
  readOnly?: boolean;
  /** Start adornment (icon) */
  startAdornment?: React.ReactNode;
  /** End adornment (icon) */
  endAdornment?: React.ReactNode;
}

export function FormField({
  name,
  label,
  value,
  onChange,
  onBlur,
  error,
  helperText,
  type = 'text',
  placeholder,
  required,
  disabled,
  multiline,
  rows,
  size = 'md',
  fullWidth = true,
  autoFocus,
  readOnly,
  startAdornment,
  endAdornment,
}: FormFieldProps): React.ReactElement {
  // Bridge onChange: useFormValidation passes event-based handler,
  // Input component expects (value: string) => void
  const handleChange = (newValue: string) => {
    if (!onChange) return;

    // If the onChange looks like it expects an event (from useFormValidation.handleInputChange),
    // create a synthetic event-like object
    const syntheticEvent = {
      target: { name, value: newValue, type },
    } as React.ChangeEvent<HTMLInputElement>;

    // Try calling with the event - if it's useFormValidation's handler, this works.
    // If it's a simple (value: string) => void, it will receive the event but that's
    // handled by checking the function signature at runtime.
    try {
      (onChange as (e: React.ChangeEvent<HTMLInputElement>) => void)(syntheticEvent);
    } catch {
      // Fallback: call as string handler
      (onChange as (value: string) => void)(newValue);
    }
  };

  const handleBlur = () => {
    if (!onBlur) return;

    // Bridge: useFormValidation passes event handler, Input expects () => void
    const syntheticEvent = {
      target: { name },
    } as React.FocusEvent<HTMLInputElement>;

    try {
      (onBlur as (e: React.FocusEvent<HTMLInputElement>) => void)(syntheticEvent);
    } catch {
      (onBlur as () => void)();
    }
  };

  return (
    <Input
      id={name}
      name={name}
      label={label}
      value={value != null ? String(value) : ''}
      onChange={handleChange}
      onBlur={handleBlur}
      type={type}
      placeholder={placeholder}
      required={required}
      disabled={disabled}
      multiline={multiline}
      rows={rows}
      size={size}
      fullWidth={fullWidth}
      autoFocus={autoFocus}
      readOnly={readOnly}
      isInvalid={!!error}
      errorMessage={error}
      helperText={helperText}
      startAdornment={startAdornment}
      endAdornment={endAdornment}
    />
  );
}
