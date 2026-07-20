import { ApiClientError } from '@/services/apiClient';
import { useCallback, useState } from 'react';

export interface ErrorState {
  hasError: boolean;
  message: string;
  code?: string;
  details?: Record<string, unknown>;
}

export function useErrorHandler() {
  const [error, setError] = useState<ErrorState>({
    hasError: false,
    message: '',
  });

  const handleError = useCallback((err: unknown, fallbackMessage?: string) => {
    if (err instanceof ApiClientError) {
      setError({
        hasError: true,
        message: err.message || fallbackMessage || 'An error occurred',
        code: err.code,
        details: err.details,
      });
    } else if (err instanceof Error) {
      setError({
        hasError: true,
        message: err.message || fallbackMessage || 'An error occurred',
      });
    } else {
      setError({
        hasError: true,
        message: fallbackMessage || 'An unexpected error occurred',
      });
    }
  }, []);

  const clearError = useCallback(() => {
    setError({
      hasError: false,
      message: '',
    });
  }, []);

  return { error, handleError, clearError };
}
