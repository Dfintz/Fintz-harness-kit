/**
 * useDebounce Hook Tests
 * Tests for debounce, throttle, and search input hooks
 */

import { renderHook, act } from '@testing-library/react';
import {
    useDebounce,
    useDebouncedCallback,
    useLeadingDebounce,
    useThrottle,
    useSearchInput
} from '@/hooks/useDebounce';

// Advance timers helper
const advanceTimersByTime = (ms: number) => {
    act(() => {
        jest.advanceTimersByTime(ms);
    });
};

describe('useDebounce', () => {
    beforeEach(() => {
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('should return initial value immediately', () => {
        const { result } = renderHook(() => useDebounce('initial', 300));
        expect(result.current).toBe('initial');
    });

    it('should debounce value changes', async () => {
        const { result, rerender } = renderHook(
            ({ value }) => useDebounce(value, 300),
            { initialProps: { value: 'first' } }
        );

        expect(result.current).toBe('first');

        rerender({ value: 'second' });
        expect(result.current).toBe('first');

        advanceTimersByTime(299);
        expect(result.current).toBe('first');

        advanceTimersByTime(1);
        expect(result.current).toBe('second');
    });

    it('should reset timer on rapid changes', () => {
        const { result, rerender } = renderHook(
            ({ value }) => useDebounce(value, 300),
            { initialProps: { value: 'a' } }
        );

        rerender({ value: 'b' });
        advanceTimersByTime(100);

        rerender({ value: 'c' });
        advanceTimersByTime(100);

        rerender({ value: 'd' });
        advanceTimersByTime(100);

        // Should still be 'a' because timer keeps resetting
        expect(result.current).toBe('a');

        advanceTimersByTime(200);
        expect(result.current).toBe('d');
    });

    it('should handle different delay values', () => {
        const { result, rerender } = renderHook(
            ({ value, delay }) => useDebounce(value, delay),
            { initialProps: { value: 'initial', delay: 500 } }
        );

        rerender({ value: 'updated', delay: 500 });
        advanceTimersByTime(300);
        expect(result.current).toBe('initial');

        advanceTimersByTime(200);
        expect(result.current).toBe('updated');
    });

    it('should work with object values', () => {
        const obj1 = { name: 'Alice' };
        const obj2 = { name: 'Bob' };

        const { result, rerender } = renderHook(
            ({ value }) => useDebounce(value, 300),
            { initialProps: { value: obj1 } }
        );

        expect(result.current).toBe(obj1);

        rerender({ value: obj2 });
        advanceTimersByTime(300);
        expect(result.current).toBe(obj2);
    });
});

describe('useDebouncedCallback', () => {
    beforeEach(() => {
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('should debounce callback execution', () => {
        const callback = jest.fn();
        const { result } = renderHook(() => useDebouncedCallback(callback, 300));

        result.current('arg1');
        expect(callback).not.toHaveBeenCalled();

        advanceTimersByTime(300);
        expect(callback).toHaveBeenCalledWith('arg1');
        expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should only execute last call after rapid invocations', () => {
        const callback = jest.fn();
        const { result } = renderHook(() => useDebouncedCallback(callback, 300));

        result.current('first');
        result.current('second');
        result.current('third');

        advanceTimersByTime(300);

        expect(callback).toHaveBeenCalledTimes(1);
        expect(callback).toHaveBeenCalledWith('third');
    });

    it('should pass multiple arguments', () => {
        const callback = jest.fn();
        const { result } = renderHook(() => useDebouncedCallback(callback, 300));

        result.current('arg1', 'arg2', 123);
        advanceTimersByTime(300);

        expect(callback).toHaveBeenCalledWith('arg1', 'arg2', 123);
    });

    it('should cleanup on unmount', () => {
        const callback = jest.fn();
        const { result, unmount } = renderHook(() => useDebouncedCallback(callback, 300));

        result.current('test');
        unmount();
        advanceTimersByTime(300);

        expect(callback).not.toHaveBeenCalled();
    });
});

describe('useLeadingDebounce', () => {
    beforeEach(() => {
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('should execute immediately on first call', () => {
        const callback = jest.fn();
        const { result } = renderHook(() => useLeadingDebounce(callback, 300));

        result.current('first');
        expect(callback).toHaveBeenCalledWith('first');
        expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should not execute again until delay passes', () => {
        const callback = jest.fn();
        const { result } = renderHook(() => useLeadingDebounce(callback, 300));

        result.current('first');
        result.current('second');
        result.current('third');

        expect(callback).toHaveBeenCalledTimes(1);
        expect(callback).toHaveBeenCalledWith('first');
    });

    it('should allow new calls after delay', () => {
        const callback = jest.fn();
        const { result } = renderHook(() => useLeadingDebounce(callback, 300));

        result.current('first');
        expect(callback).toHaveBeenCalledTimes(1);

        advanceTimersByTime(300);
        result.current('second');
        expect(callback).toHaveBeenCalledTimes(2);
        expect(callback).toHaveBeenLastCalledWith('second');
    });
});

describe('useThrottle', () => {
    beforeEach(() => {
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('should execute first call immediately', () => {
        const callback = jest.fn();
        const { result } = renderHook(() => useThrottle(callback, 300));

        result.current('first');
        expect(callback).toHaveBeenCalledWith('first');
    });

    it('should throttle subsequent calls', () => {
        const callback = jest.fn();
        const { result } = renderHook(() => useThrottle(callback, 300));

        result.current('first');
        result.current('second');
        result.current('third');

        expect(callback).toHaveBeenCalledTimes(1);

        advanceTimersByTime(300);
        expect(callback).toHaveBeenCalledTimes(2);
        expect(callback).toHaveBeenLastCalledWith('third');
    });

    it('should allow immediate call after limit passes', () => {
        const callback = jest.fn();
        const { result } = renderHook(() => useThrottle(callback, 300));

        result.current('first');
        advanceTimersByTime(300);

        result.current('second');
        expect(callback).toHaveBeenCalledTimes(2);
        expect(callback).toHaveBeenLastCalledWith('second');
    });
});

describe('useSearchInput', () => {
    beforeEach(() => {
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('should initialize with default values', () => {
        const { result } = renderHook(() => useSearchInput());

        expect(result.current.value).toBe('');
        expect(result.current.debouncedValue).toBe('');
    });

    it('should initialize with provided value', () => {
        const { result } = renderHook(() => useSearchInput('initial'));

        expect(result.current.value).toBe('initial');
        expect(result.current.debouncedValue).toBe('initial');
    });

    it('should update value immediately on change', () => {
        const { result } = renderHook(() => useSearchInput());

        act(() => {
            result.current.onChange({
                target: { value: 'test' }
            } as React.ChangeEvent<HTMLInputElement>);
        });

        expect(result.current.value).toBe('test');
        expect(result.current.debouncedValue).toBe('');
    });

    it('should update debouncedValue after delay', () => {
        const { result } = renderHook(() => useSearchInput('', 300));

        act(() => {
            result.current.onChange({
                target: { value: 'search' }
            } as React.ChangeEvent<HTMLInputElement>);
        });

        expect(result.current.debouncedValue).toBe('');

        advanceTimersByTime(300);
        expect(result.current.debouncedValue).toBe('search');
    });

    it('should clear value', () => {
        const { result } = renderHook(() => useSearchInput('initial'));

        act(() => {
            result.current.clear();
        });

        expect(result.current.value).toBe('');
    });

    it('should allow direct value setting', () => {
        const { result } = renderHook(() => useSearchInput());

        act(() => {
            result.current.setValue('directly set');
        });

        expect(result.current.value).toBe('directly set');
    });
});
