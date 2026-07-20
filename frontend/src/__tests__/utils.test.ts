/**
 * Utility Function Testing Examples
 * Demonstrates testing pure functions and utilities
 */

// Example utility functions for testing
export function formatCurrency(amount: number, currency: string = 'aUEC'): string {
  return `${amount.toLocaleString()} ${currency}`;
}

export function calculatePercentage(value: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((value / total) * 100);
}

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  
  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      func(...args);
    };
    
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

describe('Utility Functions', () => {
  describe('formatCurrency', () => {
    it('formats number with default currency', () => {
      expect(formatCurrency(1000)).toBe('1,000 aUEC');
    });

    it('formats number with custom currency', () => {
      expect(formatCurrency(1000, 'UEC')).toBe('1,000 UEC');
    });

    it('handles zero', () => {
      expect(formatCurrency(0)).toBe('0 aUEC');
    });

    it('handles large numbers', () => {
      expect(formatCurrency(1000000)).toBe('1,000,000 aUEC');
    });

    it('handles negative numbers', () => {
      expect(formatCurrency(-500)).toBe('-500 aUEC');
    });
  });

  describe('calculatePercentage', () => {
    it('calculates percentage correctly', () => {
      expect(calculatePercentage(25, 100)).toBe(25);
    });

    it('rounds to nearest integer', () => {
      expect(calculatePercentage(1, 3)).toBe(33);
    });

    it('handles zero total', () => {
      expect(calculatePercentage(10, 0)).toBe(0);
    });

    it('handles zero value', () => {
      expect(calculatePercentage(0, 100)).toBe(0);
    });

    it('handles 100% correctly', () => {
      expect(calculatePercentage(100, 100)).toBe(100);
    });

    it('handles over 100%', () => {
      expect(calculatePercentage(150, 100)).toBe(150);
    });
  });

  describe('truncateText', () => {
    it('returns original text if under limit', () => {
      expect(truncateText('Hello', 10)).toBe('Hello');
    });

    it('truncates text exceeding limit', () => {
      expect(truncateText('Hello World', 8)).toBe('Hello...');
    });

    it('handles exact length', () => {
      expect(truncateText('Hello', 5)).toBe('Hello');
    });

    it('handles empty string', () => {
      expect(truncateText('', 10)).toBe('');
    });

    it('adds ellipsis correctly', () => {
      const result = truncateText('This is a long text', 10);
      expect(result).toBe('This is...');
      expect(result.length).toBe(10);
    });
  });

  describe('validateEmail', () => {
    it('validates correct email', () => {
      expect(validateEmail('test@example.com')).toBe(true);
    });

    it('validates email with subdomain', () => {
      expect(validateEmail('test@mail.example.com')).toBe(true);
    });

    it('rejects email without @', () => {
      expect(validateEmail('testexample.com')).toBe(false);
    });

    it('rejects email without domain', () => {
      expect(validateEmail('test@')).toBe(false);
    });

    it('rejects email without username', () => {
      expect(validateEmail('@example.com')).toBe(false);
    });

    it('rejects email with spaces', () => {
      expect(validateEmail('test @example.com')).toBe(false);
    });

    it('rejects empty string', () => {
      expect(validateEmail('')).toBe(false);
    });
  });

  describe('debounce', () => {
    jest.useFakeTimers();

    it('debounces function calls', () => {
      const mockFn = jest.fn();
      const debouncedFn = debounce(mockFn, 100);

      debouncedFn();
      debouncedFn();
      debouncedFn();

      expect(mockFn).not.toHaveBeenCalled();

      jest.advanceTimersByTime(100);

      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('passes arguments correctly', () => {
      const mockFn = jest.fn();
      const debouncedFn = debounce(mockFn, 100);

      debouncedFn('arg1', 'arg2');

      jest.advanceTimersByTime(100);

      expect(mockFn).toHaveBeenCalledWith('arg1', 'arg2');
    });

    it('resets timer on subsequent calls', () => {
      const mockFn = jest.fn();
      const debouncedFn = debounce(mockFn, 100);

      debouncedFn();
      jest.advanceTimersByTime(50);
      debouncedFn();
      jest.advanceTimersByTime(50);

      expect(mockFn).not.toHaveBeenCalled();

      jest.advanceTimersByTime(50);

      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    afterEach(() => {
      jest.clearAllTimers();
    });
  });
});

describe('Date Utilities', () => {
  const formatDate = (date: Date): string => {
    return date.toISOString().split('T')[0];
  };

  const addDays = (date: Date, days: number): Date => {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  };

  it('formats date correctly', () => {
    const date = new Date('2025-11-12');
    expect(formatDate(date)).toBe('2025-11-12');
  });

  it('adds days correctly', () => {
    const date = new Date('2025-11-12');
    const result = addDays(date, 5);
    expect(formatDate(result)).toBe('2025-11-17');
  });

  it('subtracts days correctly', () => {
    const date = new Date('2025-11-12');
    const result = addDays(date, -5);
    expect(formatDate(result)).toBe('2025-11-07');
  });
});
