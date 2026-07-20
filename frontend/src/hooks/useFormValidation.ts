import { useCallback, useState } from 'react';
import { z } from 'zod';

/**
 * Validation result from useFormValidation hook
 */
export interface ValidationResult<T> {
  isValid: boolean;
  data?: T;
  errors: Record<string, string>;
  fieldErrors: Record<keyof T, string | undefined>;
}

/**
 * Form field state
 */
export interface FieldState {
  value: unknown;
  error?: string;
  touched: boolean;
  dirty: boolean;
}

/**
 * Form state managed by useFormValidation
 */
export interface FormState<T> {
  values: T;
  errors: Record<string, string>;
  touched: Record<string, boolean>;
  dirty: Record<string, boolean>;
  isValid: boolean;
  isSubmitting: boolean;
  isDirty: boolean;
}

/**
 * Options for useFormValidation hook
 */
export interface UseFormValidationOptions<T> {
  /** Initial form values */
  initialValues: T;
  /** Zod schema for validation */
  schema: z.ZodSchema<T>;
  /** Validate on change (default: true) */
  validateOnChange?: boolean;
  /** Validate on blur (default: true) */
  validateOnBlur?: boolean;
  /** Callback when form is submitted successfully */
  onSubmit?: (data: T) => void | Promise<void>;
}

/**
 * Custom hook for form validation using Zod
 *
 * @example
 * const fleetSchema = z.object({
 *   name: z.string().min(3, 'Name must be at least 3 characters'),
 *   description: z.string().optional(),
 *   maxMembers: z.number().min(1).max(100)
 * });
 *
 * const { values, errors, handleChange, handleSubmit, isValid } = useFormValidation({
 *   initialValues: { name: '', description: '', maxMembers: 50 },
 *   schema: fleetSchema,
 *   onSubmit: async (data) => {
 *     await createFleet(data);
 *   }
 * });
 */
export function useFormValidation<T extends Record<string, unknown>>({
  initialValues,
  schema,
  validateOnChange = true,
  validateOnBlur = true,
  onSubmit,
}: UseFormValidationOptions<T>) {
  const [values, setValues] = useState<T>(initialValues);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [dirty, setDirty] = useState<Record<string, boolean>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  /**
   * Validate entire form
   */
  const validate = useCallback((): ValidationResult<T> => {
    try {
      const data = schema.parse(values);
      setErrors({});
      return {
        isValid: true,
        data,
        errors: {},
        fieldErrors: {} as Record<keyof T, string | undefined>,
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        const newErrors: Record<string, string> = {};
        const fieldErrors: Record<keyof T, string | undefined> = {} as Record<
          keyof T,
          string | undefined
        >;

        error.issues.forEach((err: z.ZodIssue) => {
          const path = err.path.join('.');
          newErrors[path] = err.message;
          if (err.path[0]) {
            fieldErrors[err.path[0] as keyof T] = err.message;
          }
        });

        setErrors(newErrors);
        return {
          isValid: false,
          errors: newErrors,
          fieldErrors,
        };
      }
      throw error;
    }
  }, [values, schema]);

  /**
   * Validate single field
   */
  const validateField = useCallback(
    (name: keyof T): string | undefined => {
      try {
        // Create a partial schema for the field if possible
        const fieldValue = { [name]: values[name] };
        schema.parse({ ...values, ...fieldValue });

        setErrors(prev => {
          const newErrors = { ...prev };
          delete newErrors[name as string];
          return newErrors;
        });
        return undefined;
      } catch (error) {
        if (error instanceof z.ZodError) {
          const fieldError = error.issues.find((e: z.ZodIssue) => e.path[0] === name);
          if (fieldError) {
            setErrors(prev => ({
              ...prev,
              [name]: fieldError.message,
            }));
            return fieldError.message;
          }
        }
        return undefined;
      }
    },
    [values, schema]
  );

  /**
   * Handle field change
   */
  const handleChange = useCallback(
    <K extends keyof T>(name: K, value: T[K]) => {
      setValues(prev => {
        const newValues = { ...prev, [name]: value };

        // Validate immediately with the new values if validateOnChange is enabled
        if (validateOnChange) {
          try {
            schema.parse(newValues);
            // Valid - clear error for this field
            setErrors(prevErrors => {
              const newErrors = { ...prevErrors };
              delete newErrors[name as string];
              return newErrors;
            });
          } catch (error) {
            if (error instanceof z.ZodError) {
              const fieldError = error.issues.find((e: z.ZodIssue) => e.path[0] === name);
              if (fieldError) {
                setErrors(prevErrors => ({
                  ...prevErrors,
                  [name]: fieldError.message,
                }));
              }
            }
          }
        }

        return newValues;
      });
      setDirty(prev => ({ ...prev, [name]: true }));
    },
    [validateOnChange, schema]
  );

  /**
   * Handle input change event
   */
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      const { name, value, type } = e.target;
      let parsedValue: unknown = value;

      // Handle different input types
      if (type === 'number') {
        parsedValue = value === '' ? '' : Number(value);
      } else if (type === 'checkbox') {
        parsedValue = (e.target as HTMLInputElement).checked;
      }

      handleChange(name as keyof T, parsedValue as T[keyof T]);
    },
    [handleChange]
  );

  /**
   * Handle field blur
   */
  const handleBlur = useCallback(
    (name: keyof T) => {
      setTouched(prev => ({ ...prev, [name]: true }));

      if (validateOnBlur) {
        validateField(name);
      }
    },
    [validateOnBlur, validateField]
  );

  /**
   * Handle input blur event
   */
  const handleInputBlur = useCallback(
    (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      handleBlur(e.target.name as keyof T);
    },
    [handleBlur]
  );

  /**
   * Handle form submission
   */
  const handleSubmit = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault();

      // Mark all fields as touched
      const allTouched: Record<string, boolean> = {};
      Object.keys(values).forEach(key => {
        allTouched[key] = true;
      });
      setTouched(allTouched);

      const result = validate();

      if (result.isValid && result.data && onSubmit) {
        setIsSubmitting(true);
        try {
          await onSubmit(result.data);
        } finally {
          setIsSubmitting(false);
        }
      }

      return result;
    },
    [values, validate, onSubmit]
  );

  /**
   * Reset form to initial values
   */
  const reset = useCallback(() => {
    setValues(initialValues);
    setErrors({});
    setTouched({});
    setDirty({});
    setIsSubmitting(false);
  }, [initialValues]);

  /**
   * Set field value programmatically
   */
  const setValue = useCallback(
    <K extends keyof T>(name: K, value: T[K]) => {
      handleChange(name, value);
    },
    [handleChange]
  );

  /**
   * Set multiple values at once
   */
  const setMultipleValues = useCallback((newValues: Partial<T>) => {
    setValues(prev => ({ ...prev, ...newValues }));
    Object.keys(newValues).forEach(key => {
      setDirty(prev => ({ ...prev, [key]: true }));
    });
  }, []);

  /**
   * Set field error programmatically
   */
  const setFieldError = useCallback((name: keyof T, error: string) => {
    setErrors(prev => ({ ...prev, [name]: error }));
  }, []);

  /**
   * Clear field error
   */
  const clearFieldError = useCallback((name: keyof T) => {
    setErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[name as string];
      return newErrors;
    });
  }, []);

  /**
   * Get field props for easy binding
   */
  const getFieldProps = useCallback(
    (name: keyof T) => ({
      name,
      value: values[name],
      onChange: handleInputChange,
      onBlur: handleInputBlur,
      error: touched[name as string] ? errors[name as string] : undefined,
    }),
    [values, errors, touched, handleInputChange, handleInputBlur]
  );

  // Computed values
  const isValid = Object.keys(errors).length === 0;
  const isDirty = Object.values(dirty).some(Boolean);

  return {
    // Form state
    values,
    errors,
    touched,
    dirty,
    isValid,
    isDirty,
    isSubmitting,

    // Field handlers
    handleChange,
    handleInputChange,
    handleBlur,
    handleInputBlur,

    // Form handlers
    handleSubmit,
    validate,
    validateField,
    reset,

    // Utility functions
    setValue,
    setMultipleValues,
    setFieldError,
    clearFieldError,
    getFieldProps,
  };
}

/**
 * Common validation schemas
 */
export const commonSchemas = {
  /** Email validation */
  email: z.string().email('Invalid email address'),

  /** Password validation (min 8 chars, 1 uppercase, 1 lowercase, 1 number) */
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),

  /** Username validation (alphanumeric, 3-20 chars) */
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(20, 'Username must be at most 20 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores'),

  /** Required string */
  requiredString: z.string().min(1, 'This field is required'),

  /** Positive number */
  positiveNumber: z.number().positive('Must be a positive number'),

  /** URL validation */
  url: z.string().url('Invalid URL'),

  /** UUID validation */
  uuid: z.string().uuid('Invalid UUID format'),
};

/**
 * Fleet form schema
 */
export const fleetFormSchema = z.object({
  name: z
    .string()
    .min(3, 'Fleet name must be at least 3 characters')
    .max(50, 'Fleet name must be at most 50 characters'),
  description: z.string().max(500, 'Description must be at most 500 characters').optional(),
  type: z.enum([
    'combat',
    'mining',
    'trading',
    'exploration',
    'salvage',
    'escort',
    'reconnaissance',
    'medical',
    'mixed',
  ]),
  maxMembers: z.number().min(1, 'Must have at least 1 member').max(500, 'Maximum 500 members'),
  isPublic: z.boolean(),
  allowApplications: z.boolean(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid color format'),
});

export type FleetFormData = z.infer<typeof fleetFormSchema>;

/**
 * User profile form schema
 */
export const userProfileSchema = z.object({
  username: commonSchemas.username,
  email: commonSchemas.email,
  displayName: z.string().min(1, 'Display name is required').max(50),
  bio: z.string().max(500, 'Bio must be at most 500 characters').optional(),
  timezone: z.string().optional(),
  language: z.string().optional(),
});

export type UserProfileFormData = z.infer<typeof userProfileSchema>;

/**
 * Trading route form schema
 */
export const tradingRouteSchema = z.object({
  name: z.string().min(3, 'Route name must be at least 3 characters'),
  description: z.string().max(500).optional(),
  estimatedProfit: z.number().min(0).optional(),
  estimatedDuration: z.number().min(1, 'Duration must be at least 1 minute').optional(),
  minCargoCapacity: z.number().min(1).optional(),
  tags: z.array(z.string()).optional(),
});

export type TradingRouteFormData = z.infer<typeof tradingRouteSchema>;
