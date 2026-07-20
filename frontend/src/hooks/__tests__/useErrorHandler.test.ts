/**
 * useErrorHandler Hook Tests
 * Tests for the error handling hook
 */

import { useErrorHandler } from '@/hooks/useErrorHandler';
import { ApiClientError } from '@/services/apiClient';
import { act, renderHook } from '@testing-library/react';

describe('useErrorHandler', () => {
  it('should initialize with no error', () => {
    const { result } = renderHook(() => useErrorHandler());

    expect(result.current.error.hasError).toBe(false);
    expect(result.current.error.message).toBe('');
  });

  it('should handle ApiClientError correctly', () => {
    const { result } = renderHook(() => useErrorHandler());

    const apiError = new ApiClientError('API request failed', 'VALIDATION_ERROR', 400, undefined, {
      field: 'email',
    });

    act(() => {
      result.current.handleError(apiError);
    });

    expect(result.current.error.hasError).toBe(true);
    expect(result.current.error.message).toBe('API request failed');
    expect(result.current.error.code).toBe('VALIDATION_ERROR');
    expect(result.current.error.details).toEqual({ field: 'email' });
  });

  it('should handle ApiClientError with fallback message', () => {
    const { result } = renderHook(() => useErrorHandler());

    const apiError = new ApiClientError('', 'SERVER_ERROR', 500);

    act(() => {
      result.current.handleError(apiError, 'Server error occurred');
    });

    expect(result.current.error.hasError).toBe(true);
    expect(result.current.error.message).toBe('Server error occurred');
    expect(result.current.error.code).toBe('SERVER_ERROR');
  });

  it('should handle standard Error objects', () => {
    const { result } = renderHook(() => useErrorHandler());

    const error = new Error('Something went wrong');

    act(() => {
      result.current.handleError(error);
    });

    expect(result.current.error.hasError).toBe(true);
    expect(result.current.error.message).toBe('Something went wrong');
    expect(result.current.error.code).toBeUndefined();
    expect(result.current.error.details).toBeUndefined();
  });

  it('should use fallback message for Error without message', () => {
    const { result } = renderHook(() => useErrorHandler());

    const error = new Error('');

    act(() => {
      result.current.handleError(error, 'Fallback error');
    });

    expect(result.current.error.hasError).toBe(true);
    expect(result.current.error.message).toBe('Fallback error');
  });

  it('should handle unknown error types', () => {
    const { result } = renderHook(() => useErrorHandler());

    const unknownError = { something: 'unexpected' };

    act(() => {
      result.current.handleError(unknownError);
    });

    expect(result.current.error.hasError).toBe(true);
    expect(result.current.error.message).toBe('An unexpected error occurred');
  });

  it('should use fallback message for unknown error types', () => {
    const { result } = renderHook(() => useErrorHandler());

    act(() => {
      result.current.handleError(null, 'Custom fallback');
    });

    expect(result.current.error.hasError).toBe(true);
    expect(result.current.error.message).toBe('Custom fallback');
  });

  it('should clear error state', () => {
    const { result } = renderHook(() => useErrorHandler());

    // Set an error first
    act(() => {
      result.current.handleError(new Error('Test error'));
    });

    expect(result.current.error.hasError).toBe(true);

    // Clear the error
    act(() => {
      result.current.clearError();
    });

    expect(result.current.error.hasError).toBe(false);
    expect(result.current.error.message).toBe('');
    expect(result.current.error.code).toBeUndefined();
    expect(result.current.error.details).toBeUndefined();
  });

  it('should handle multiple errors sequentially', () => {
    const { result } = renderHook(() => useErrorHandler());

    act(() => {
      result.current.handleError(new Error('First error'));
    });

    expect(result.current.error.message).toBe('First error');

    act(() => {
      result.current.handleError(new Error('Second error'));
    });

    expect(result.current.error.message).toBe('Second error');
  });

  it('should maintain stable function references', () => {
    const { result, rerender } = renderHook(() => useErrorHandler());

    const initialHandleError = result.current.handleError;
    const initialClearError = result.current.clearError;

    rerender();

    expect(result.current.handleError).toBe(initialHandleError);
    expect(result.current.clearError).toBe(initialClearError);
  });

  it('should handle clearing non-existent error', () => {
    const { result } = renderHook(() => useErrorHandler());

    // Clear when no error exists
    act(() => {
      result.current.clearError();
    });

    expect(result.current.error.hasError).toBe(false);
    expect(result.current.error.message).toBe('');
  });
});
