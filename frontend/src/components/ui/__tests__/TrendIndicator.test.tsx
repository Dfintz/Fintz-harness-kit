import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import {
  TrendIndicator,
  calculatePercentageChange,
  calculateTrendDirection,
} from '@/components/ui/TrendIndicator';

describe('TrendIndicator', () => {
  describe('rendering', () => {
    it('renders with required direction prop', () => {
      render(<TrendIndicator direction="up" />);
      expect(screen.getByRole('status')).toBeInTheDocument();
    });

    it('renders up arrow for up direction', () => {
      render(<TrendIndicator direction="up" />);
      expect(screen.getByText('↑')).toBeInTheDocument();
    });

    it('renders down arrow for down direction', () => {
      render(<TrendIndicator direction="down" />);
      expect(screen.getByText('↓')).toBeInTheDocument();
    });

    it('renders right arrow for neutral direction', () => {
      render(<TrendIndicator direction="neutral" />);
      expect(screen.getByText('→')).toBeInTheDocument();
    });

    it('renders value when provided', () => {
      render(<TrendIndicator direction="up" value="15%" />);
      expect(screen.getByText('+15%')).toBeInTheDocument();
    });

    it('renders label when provided', () => {
      render(<TrendIndicator direction="up" value="15%" label="vs last week" />);
      expect(screen.getByText('vs last week')).toBeInTheDocument();
    });
  });

  describe('value formatting', () => {
    it('adds + sign for up direction without sign', () => {
      render(<TrendIndicator direction="up" value="15%" />);
      expect(screen.getByText('+15%')).toBeInTheDocument();
    });

    it('adds - sign for down direction without sign', () => {
      render(<TrendIndicator direction="down" value="15%" />);
      expect(screen.getByText('-15%')).toBeInTheDocument();
    });

    it('preserves existing + sign', () => {
      render(<TrendIndicator direction="up" value="+15%" />);
      expect(screen.getByText('+15%')).toBeInTheDocument();
    });

    it('preserves existing - sign', () => {
      render(<TrendIndicator direction="down" value="-15%" />);
      expect(screen.getByText('-15%')).toBeInTheDocument();
    });

    it('does not add sign for neutral direction', () => {
      render(<TrendIndicator direction="neutral" value="0%" />);
      expect(screen.getByText('0%')).toBeInTheDocument();
    });

    it('handles numeric values', () => {
      render(<TrendIndicator direction="up" value={15} />);
      expect(screen.getByText('+15')).toBeInTheDocument();
    });
  });

  describe('size variants', () => {
    it('applies sm class for small size', () => {
      render(<TrendIndicator direction="up" size="sm" />);
      const element = screen.getByRole('status');
      expect(element.className).toContain('sm');
    });

    it('applies md class for medium size', () => {
      render(<TrendIndicator direction="up" size="md" />);
      const element = screen.getByRole('status');
      expect(element.className).toContain('md');
    });

    it('applies lg class for large size', () => {
      render(<TrendIndicator direction="up" size="lg" />);
      const element = screen.getByRole('status');
      expect(element.className).toContain('lg');
    });

    it('defaults to md size', () => {
      render(<TrendIndicator direction="up" />);
      const element = screen.getByRole('status');
      expect(element.className).toContain('md');
    });
  });

  describe('icon visibility', () => {
    it('shows icon by default', () => {
      render(<TrendIndicator direction="up" />);
      expect(screen.getByText('↑')).toBeInTheDocument();
    });

    it('hides icon when showIcon is false', () => {
      render(<TrendIndicator direction="up" showIcon={false} />);
      expect(screen.queryByText('↑')).not.toBeInTheDocument();
    });
  });

  describe('animation', () => {
    it('applies animation class when animated is true', () => {
      render(<TrendIndicator direction="up" animated />);
      const element = screen.getByRole('status');
      expect(element.className).toContain('animatedUp');
    });

    it('applies down animation class for down direction', () => {
      render(<TrendIndicator direction="down" animated />);
      const element = screen.getByRole('status');
      expect(element.className).toContain('animatedDown');
    });

    it('does not apply animation class for neutral direction', () => {
      render(<TrendIndicator direction="neutral" animated />);
      const element = screen.getByRole('status');
      expect(element.className).not.toContain('animatedUp');
      expect(element.className).not.toContain('animatedDown');
    });

    it('does not apply animation class when animated is false', () => {
      render(<TrendIndicator direction="up" animated={false} />);
      const element = screen.getByRole('status');
      expect(element.className).not.toContain('animatedUp');
    });
  });

  describe('custom styles', () => {
    it('applies custom color when provided', () => {
      render(<TrendIndicator direction="up" color="#00d9ff" />);
      expect(screen.getByRole('status')).toHaveStyle({ color: '#00d9ff' });
    });

    it('applies custom className', () => {
      render(<TrendIndicator direction="up" className="custom-class" />);
      expect(screen.getByRole('status')).toHaveClass('custom-class');
    });
  });

  describe('accessibility', () => {
    it('has role="status"', () => {
      render(<TrendIndicator direction="up" />);
      expect(screen.getByRole('status')).toBeInTheDocument();
    });

    it('has appropriate aria-label', () => {
      render(<TrendIndicator direction="up" value="15%" label="vs last week" />);
      expect(screen.getByRole('status')).toHaveAttribute(
        'aria-label',
        'Trend up: +15% vs last week'
      );
    });

    it('has aria-hidden on icon', () => {
      render(<TrendIndicator direction="up" />);
      const iconElement = screen.getByText('↑');
      expect(iconElement).toHaveAttribute('aria-hidden', 'true');
    });
  });
});

describe('calculateTrendDirection', () => {
  it('returns up when current is greater than previous', () => {
    expect(calculateTrendDirection(100, 50)).toBe('up');
  });

  it('returns down when current is less than previous', () => {
    expect(calculateTrendDirection(50, 100)).toBe('down');
  });

  it('returns neutral when values are equal', () => {
    expect(calculateTrendDirection(100, 100)).toBe('neutral');
  });

  it('returns neutral for small differences within threshold', () => {
    expect(calculateTrendDirection(100, 100.0001, 0.001)).toBe('neutral');
  });

  it('uses custom threshold', () => {
    expect(calculateTrendDirection(100, 99, 5)).toBe('neutral');
    expect(calculateTrendDirection(100, 90, 5)).toBe('up');
  });
});

describe('calculatePercentageChange', () => {
  it('calculates positive percentage change', () => {
    expect(calculatePercentageChange(120, 100)).toBe(20);
  });

  it('calculates negative percentage change', () => {
    expect(calculatePercentageChange(80, 100)).toBe(-20);
  });

  it('returns 0 when values are equal', () => {
    expect(calculatePercentageChange(100, 100)).toBe(0);
  });

  it('handles zero previous value (returns 100 if current > 0)', () => {
    expect(calculatePercentageChange(50, 0)).toBe(100);
  });

  it('handles zero previous value (returns 0 if current is 0)', () => {
    expect(calculatePercentageChange(0, 0)).toBe(0);
  });

  it('handles negative previous values', () => {
    // Going from -100 to -80 is a 20% increase (absolute value wise)
    // (-80 - (-100)) / |-100| = 20 / 100 = 20%
    expect(calculatePercentageChange(-80, -100)).toBe(20);
  });
});
