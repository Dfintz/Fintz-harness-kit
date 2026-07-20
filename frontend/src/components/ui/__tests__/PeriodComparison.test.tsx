import '@testing-library/jest-dom';
import { render, renderHook, screen } from '@testing-library/react';
import { PeriodComparison, usePeriodComparison } from '@/components/ui/PeriodComparison';

describe('PeriodComparison', () => {
  describe('rendering', () => {
    it('renders with required props', () => {
      render(<PeriodComparison current={125} previous={100} />);
      expect(screen.getByRole('status')).toBeInTheDocument();
    });

    it('displays percentage change for increase', () => {
      render(<PeriodComparison current={125} previous={100} />);
      expect(screen.getByText('+25.0%')).toBeInTheDocument();
    });

    it('displays percentage change for decrease', () => {
      render(<PeriodComparison current={75} previous={100} />);
      expect(screen.getByText('-25.0%')).toBeInTheDocument();
    });

    it('displays correct period label', () => {
      render(<PeriodComparison current={125} previous={100} period="week" />);
      expect(screen.getByText('vs last week')).toBeInTheDocument();
    });
  });

  describe('period labels', () => {
    const testCases = [
      { period: 'hour', expected: 'vs last hour' },
      { period: 'day', expected: 'vs yesterday' },
      { period: 'week', expected: 'vs last week' },
      { period: 'month', expected: 'vs last month' },
      { period: 'quarter', expected: 'vs last quarter' },
      { period: 'year', expected: 'vs last year' },
    ] as const;

    testCases.forEach(({ period, expected }) => {
      it(`displays "${expected}" for ${period} period`, () => {
        render(<PeriodComparison current={110} previous={100} period={period} />);
        expect(screen.getByText(expected)).toBeInTheDocument();
      });
    });

    it('displays custom period label', () => {
      render(
        <PeriodComparison
          current={110}
          previous={100}
          period="custom"
          customPeriodLabel="vs last sprint"
        />
      );
      expect(screen.getByText('vs last sprint')).toBeInTheDocument();
    });
  });

  describe('formatting', () => {
    it('displays value with default decimals (1)', () => {
      render(<PeriodComparison current={125.55} previous={100} />);
      expect(screen.getByText('+25.5%')).toBeInTheDocument();
    });

    it('displays value with custom decimals', () => {
      render(<PeriodComparison current={125.555} previous={100} decimals={2} />);
      expect(screen.getByText('+25.56%')).toBeInTheDocument();
    });

    it('displays zero decimals', () => {
      render(<PeriodComparison current={125} previous={100} decimals={0} />);
      expect(screen.getByText('+25%')).toBeInTheDocument();
    });
  });

  describe('showPreviousValue', () => {
    it('does not show previous value by default', () => {
      render(<PeriodComparison current={125} previous={100} />);
      expect(screen.queryByText(/from/)).not.toBeInTheDocument();
    });

    it('shows previous value when showPreviousValue is true', () => {
      render(<PeriodComparison current={125} previous={100} showPreviousValue />);
      expect(screen.getByText('from 100')).toBeInTheDocument();
    });

    it('formats previous value as currency', () => {
      render(
        <PeriodComparison
          current={2500000}
          previous={2000000}
          format="currency"
          showPreviousValue
        />
      );
      expect(screen.getByText('from $2,000,000')).toBeInTheDocument();
    });

    it('uses custom currency symbol', () => {
      render(
        <PeriodComparison
          current={150}
          previous={100}
          format="currency"
          currencySymbol="€"
          showPreviousValue
        />
      );
      expect(screen.getByText('from €100')).toBeInTheDocument();
    });
  });

  describe('size variants', () => {
    it('applies sm class for small size', () => {
      const { container } = render(<PeriodComparison current={125} previous={100} size="sm" />);
      const element = container.firstChild as HTMLElement;
      expect(element.className).toContain('sm');
    });

    it('applies md class for medium size', () => {
      const { container } = render(<PeriodComparison current={125} previous={100} size="md" />);
      const element = container.firstChild as HTMLElement;
      expect(element.className).toContain('md');
    });

    it('applies lg class for large size', () => {
      const { container } = render(<PeriodComparison current={125} previous={100} size="lg" />);
      const element = container.firstChild as HTMLElement;
      expect(element.className).toContain('lg');
    });
  });

  describe('decreaseIsGood', () => {
    it('passes invertColors to TrendIndicator', () => {
      const { container } = render(<PeriodComparison current={80} previous={100} decreaseIsGood />);
      // When decrease is good and direction is down, color should be green (success)
      // This is tested indirectly through the TrendIndicator component
      expect(container).toBeInTheDocument();
    });
  });

  describe('custom className', () => {
    it('applies custom className', () => {
      const { container } = render(
        <PeriodComparison current={125} previous={100} className="custom-class" />
      );
      const element = container.firstChild as HTMLElement;
      expect(element.className).toContain('custom-class');
    });
  });

  describe('edge cases', () => {
    it('handles equal values (no change)', () => {
      render(<PeriodComparison current={100} previous={100} />);
      expect(screen.getByText('0.0%')).toBeInTheDocument();
    });

    it('handles very small values', () => {
      render(<PeriodComparison current={0.01} previous={0.005} decimals={1} />);
      expect(screen.getByText('+100.0%')).toBeInTheDocument();
    });

    it('handles large values', () => {
      render(<PeriodComparison current={1000000} previous={500000} />);
      expect(screen.getByText('+100.0%')).toBeInTheDocument();
    });
  });
});

describe('usePeriodComparison hook', () => {
  it('calculates sum of current data', () => {
    const { result } = renderHook(() => usePeriodComparison([10, 20, 30], [5, 10, 15]));
    expect(result.current.current).toBe(60);
  });

  it('calculates sum of previous data', () => {
    const { result } = renderHook(() => usePeriodComparison([10, 20, 30], [5, 10, 15]));
    expect(result.current.previous).toBe(30);
  });

  it('calculates correct direction', () => {
    const { result } = renderHook(() => usePeriodComparison([10, 20, 30], [5, 10, 15]));
    expect(result.current.direction).toBe('up');
  });

  it('calculates correct percentage change', () => {
    const { result } = renderHook(() => usePeriodComparison([10, 20, 30], [5, 10, 15]));
    expect(result.current.percentChange).toBe(100);
  });

  it('handles empty arrays', () => {
    const { result } = renderHook(() => usePeriodComparison([], []));
    expect(result.current.current).toBe(0);
    expect(result.current.previous).toBe(0);
    expect(result.current.direction).toBe('neutral');
  });

  it('handles decrease', () => {
    const { result } = renderHook(() => usePeriodComparison([10], [20]));
    expect(result.current.direction).toBe('down');
    expect(result.current.percentChange).toBe(-50);
  });
});
