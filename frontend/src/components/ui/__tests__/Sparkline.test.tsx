import { generateSparklineData, Sparkline, SparklineDataPoint } from '@/components/ui/Sparkline';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import React from 'react';

// Mock recharts to avoid rendering issues in tests
jest.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  ),
  LineChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="line-chart">{children}</div>
  ),
  AreaChart: ({ children }: { children: React.ReactNode }) => (
    <svg data-testid="area-chart">{children}</svg>
  ),
  Line: () => <div data-testid="line" />,
  Area: () => <g data-testid="area" />,
  ReferenceLine: () => <g data-testid="reference-line" />,
}));

// Mock ResizeObserver so hasValidDimensions becomes true
class MockResizeObserver {
  callback: ResizeObserverCallback;
  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
  }
  observe(target: Element) {
    // Immediately trigger with valid dimensions
    this.callback(
      [{ contentRect: { width: 200, height: 32 } } as any] as ResizeObserverEntry[],
      this as any
    );
  }
  unobserve() {}
  disconnect() {}
}
(global as any).ResizeObserver = MockResizeObserver;

// Mock getBoundingClientRect to return valid dimensions
const originalGetBoundingClientRect = Element.prototype.getBoundingClientRect;
beforeAll(() => {
  Element.prototype.getBoundingClientRect = jest.fn(() => ({
    width: 200,
    height: 32,
    top: 0,
    left: 0,
    bottom: 32,
    right: 200,
    x: 0,
    y: 0,
    toJSON: () => {},
  }));
});

// Suppress console warnings for SVG elements in tests
const originalError = console.error;
beforeAll(() => {
  console.error = (...args: unknown[]) => {
    const message = args[0] as string;
    if (
      typeof message === 'string' &&
      (message.includes('linearGradient') ||
        message.includes('defs') ||
        message.includes('is unrecognized') ||
        message.includes('stopColor'))
    ) {
      return;
    }
    originalError.call(console, ...args);
  };
});

afterAll(() => {
  console.error = originalError;
});

describe('Sparkline', () => {
  const sampleData: SparklineDataPoint[] = [
    { x: 0, y: 10 },
    { x: 1, y: 15 },
    { x: 2, y: 12 },
    { x: 3, y: 18 },
  ];

  const upTrendData: SparklineDataPoint[] = [
    { x: 0, y: 10 },
    { x: 1, y: 20 },
  ];

  const downTrendData: SparklineDataPoint[] = [
    { x: 0, y: 20 },
    { x: 1, y: 10 },
  ];

  describe('rendering', () => {
    it('renders with basic data', () => {
      render(<Sparkline data={sampleData} />);
      expect(screen.getByRole('img')).toBeInTheDocument();
    });

    it('renders a line chart by default', () => {
      render(<Sparkline data={sampleData} />);
      expect(screen.getByTestId('line-chart')).toBeInTheDocument();
    });

    it('renders an area chart when showArea is true', () => {
      render(<Sparkline data={sampleData} showArea />);
      expect(screen.getByTestId('area-chart')).toBeInTheDocument();
    });

    it('does not render when data is empty', () => {
      const { container } = render(<Sparkline data={[]} />);
      expect(container.firstChild).toBeNull();
    });

    it('renders with custom className', () => {
      render(<Sparkline data={sampleData} className="custom-class" />);
      const container = screen.getByRole('img');
      expect(container).toHaveClass('custom-class');
    });
  });

  describe('accessibility', () => {
    it('has role="img" for accessibility', () => {
      render(<Sparkline data={sampleData} />);
      expect(screen.getByRole('img')).toBeInTheDocument();
    });

    it('has default aria-label with trend direction', () => {
      render(<Sparkline data={upTrendData} />);
      expect(screen.getByRole('img')).toHaveAttribute(
        'aria-label',
        'Sparkline chart showing up trend'
      );
    });

    it('uses custom ariaLabel when provided', () => {
      render(<Sparkline data={sampleData} ariaLabel="Custom label" />);
      expect(screen.getByRole('img')).toHaveAttribute('aria-label', 'Custom label');
    });

    it('identifies down trend correctly', () => {
      render(<Sparkline data={downTrendData} />);
      expect(screen.getByRole('img')).toHaveAttribute(
        'aria-label',
        'Sparkline chart showing down trend'
      );
    });
  });

  describe('sizing', () => {
    it('applies height prop correctly', () => {
      render(<Sparkline data={sampleData} height={50} />);
      const container = screen.getByRole('img');
      expect(container).toHaveStyle({ height: '50px' });
    });

    it('applies width prop as number', () => {
      render(<Sparkline data={sampleData} width={200} />);
      const container = screen.getByRole('img');
      expect(container).toHaveStyle({ width: '200px' });
    });

    it('applies width prop as string', () => {
      render(<Sparkline data={sampleData} width="100%" />);
      const container = screen.getByRole('img');
      expect(container).toHaveStyle({ width: '100%' });
    });

    it('uses default height of 32px', () => {
      render(<Sparkline data={sampleData} />);
      const container = screen.getByRole('img');
      expect(container).toHaveStyle({ height: '32px' });
    });
  });

  describe('showReference', () => {
    it('renders reference line when showReference is true', () => {
      render(<Sparkline data={sampleData} showReference />);
      expect(screen.getByTestId('reference-line')).toBeInTheDocument();
    });

    it('does not render reference line by default', () => {
      render(<Sparkline data={sampleData} />);
      expect(screen.queryByTestId('reference-line')).not.toBeInTheDocument();
    });
  });
});

describe('generateSparklineData', () => {
  it('generates the specified number of points', () => {
    const data = generateSparklineData(10, 100, 20);
    expect(data).toHaveLength(10);
  });

  it('generates default 7 points when not specified', () => {
    const data = generateSparklineData();
    expect(data).toHaveLength(7);
  });

  it('generates data points with x and y properties', () => {
    const data = generateSparklineData(5, 50, 10);
    data.forEach((point, index) => {
      expect(point).toHaveProperty('x', index);
      expect(point).toHaveProperty('y');
      expect(typeof point.y).toBe('number');
    });
  });

  it('generates non-negative values', () => {
    const data = generateSparklineData(100, 10, 50);
    data.forEach(point => {
      expect(point.y).toBeGreaterThanOrEqual(0);
    });
  });

  it('generates values around the base value', () => {
    const baseValue = 100;
    const volatility = 10;
    const data = generateSparklineData(10, baseValue, volatility);

    const average = data.reduce((sum, point) => sum + point.y, 0) / data.length;
    // Average should be reasonably close to base value
    expect(average).toBeGreaterThan(baseValue - volatility * 2);
    expect(average).toBeLessThan(baseValue + volatility * 2);
  });
});
