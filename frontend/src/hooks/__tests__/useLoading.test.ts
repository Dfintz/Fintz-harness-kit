/**
 * useLoading Hook Tests
 * Tests for the loading state management hook
 */

import { renderHook, act } from '@testing-library/react';
import { useLoading } from '@/hooks/useLoading';

describe('useLoading', () => {
    it('should initialize with false by default', () => {
        const { result } = renderHook(() => useLoading());
        expect(result.current.loading).toBe(false);
    });

    it('should initialize with provided initial state', () => {
        const { result } = renderHook(() => useLoading(true));
        expect(result.current.loading).toBe(true);
    });

    it('should allow manual loading state control', () => {
        const { result } = renderHook(() => useLoading());
        
        expect(result.current.loading).toBe(false);
        
        act(() => {
            result.current.setLoading(true);
        });
        
        expect(result.current.loading).toBe(true);
        
        act(() => {
            result.current.setLoading(false);
        });
        
        expect(result.current.loading).toBe(false);
    });

    it('should set loading to true during async operation', async () => {
        const { result } = renderHook(() => useLoading());
        
        let resolvePromise: (value: string) => void;
        const asyncFn = jest.fn(() => new Promise<string>((resolve) => {
            resolvePromise = resolve;
        }));
        
        act(() => {
            result.current.withLoading(asyncFn);
        });
        
        // Loading should be true while async operation is in progress
        expect(result.current.loading).toBe(true);
        
        // Complete the async operation
        await act(async () => {
            resolvePromise('result');
            await Promise.resolve();
        });
        
        expect(result.current.loading).toBe(false);
    });

    it('should set loading to false after successful async operation', async () => {
        const { result } = renderHook(() => useLoading());
        
        const asyncFn = jest.fn().mockResolvedValue('result');
        
        await act(async () => {
            await result.current.withLoading(asyncFn);
        });
        
        expect(result.current.loading).toBe(false);
        expect(asyncFn).toHaveBeenCalledTimes(1);
    });

    it('should return the result from async operation', async () => {
        const { result } = renderHook(() => useLoading());
        
        const expectedResult = { data: 'test' };
        const asyncFn = jest.fn().mockResolvedValue(expectedResult);
        
        let actualResult;
        await act(async () => {
            actualResult = await result.current.withLoading(asyncFn);
        });
        
        expect(actualResult).toEqual(expectedResult);
    });

    it('should set loading to false after failed async operation', async () => {
        const { result } = renderHook(() => useLoading());
        
        const error = new Error('Test error');
        const asyncFn = jest.fn().mockRejectedValue(error);
        
        await act(async () => {
            try {
                await result.current.withLoading(asyncFn);
            } catch (err) {
                // Expected to throw
            }
        });
        
        expect(result.current.loading).toBe(false);
    });

    it('should propagate errors from async operation', async () => {
        const { result } = renderHook(() => useLoading());
        
        const error = new Error('Test error');
        const asyncFn = jest.fn().mockRejectedValue(error);
        
        await act(async () => {
            await expect(result.current.withLoading(asyncFn)).rejects.toThrow('Test error');
        });
    });

    it('should handle multiple sequential async operations', async () => {
        const { result } = renderHook(() => useLoading());
        
        const asyncFn1 = jest.fn().mockResolvedValue('result1');
        const asyncFn2 = jest.fn().mockResolvedValue('result2');
        
        let result1, result2;
        
        await act(async () => {
            result1 = await result.current.withLoading(asyncFn1);
        });
        
        expect(result.current.loading).toBe(false);
        expect(result1).toBe('result1');
        
        await act(async () => {
            result2 = await result.current.withLoading(asyncFn2);
        });
        
        expect(result.current.loading).toBe(false);
        expect(result2).toBe('result2');
    });

    it('should maintain stable function references', () => {
        const { result, rerender } = renderHook(() => useLoading());
        
        const initialWithLoading = result.current.withLoading;
        
        rerender();
        
        expect(result.current.withLoading).toBe(initialWithLoading);
    });
});
