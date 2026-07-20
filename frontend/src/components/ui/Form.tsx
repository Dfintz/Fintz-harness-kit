/**
 * Form Component - Standardized form wrapper with consistent spacing and submission handling
 *
 * Provides a consistent form layout with:
 * - Automatic preventDefault on submit
 * - Consistent spacing between fields
 * - Loading state management
 * - Accessible form structure
 *
 * @example
 * <Form onSubmit={handleSubmit} loading={isSubmitting}>
 *   <FormField label="Username" {...getFieldProps('username')} />
 *   <FormField label="Email" type="email" {...getFieldProps('email')} />
 *   <Form.Actions>
 *     <button type="submit">Save</button>
 *   </Form.Actions>
 * </Form>
 */

import React from 'react';

export interface FormProps {
  /** Submit handler */
  onSubmit?: (e: React.FormEvent<HTMLFormElement>) => void | Promise<void>;
  /** Whether the form is currently submitting */
  loading?: boolean;
  /** Accessible label for the form */
  'aria-label'?: string;
  /** Form content */
  children: React.ReactNode;
  /** Additional CSS class */
  className?: string;
  /** Disable all form fields when loading */
  disableWhileLoading?: boolean;
}

export function Form({
  onSubmit,
  loading = false,
  'aria-label': ariaLabel,
  children,
  className = '',
  disableWhileLoading = true,
}: FormProps): React.ReactElement {
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (loading) return;
    onSubmit?.(e);
  };

  return (
    <form
      onSubmit={handleSubmit}
      aria-label={ariaLabel}
      aria-busy={loading}
      className={className}
      style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
    >
      <fieldset
        disabled={disableWhileLoading && loading}
        style={{ border: 'none', padding: 0, margin: 0 }}
      >
        {children}
      </fieldset>
    </form>
  );
}

/**
 * Form.Actions - Container for form action buttons with consistent layout
 */
function FormActions({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
      {children}
    </div>
  );
}

Form.Actions = FormActions;
