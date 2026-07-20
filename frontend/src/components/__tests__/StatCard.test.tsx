import { StatCard } from '@/components/StatCard';
import { theme } from '@/theme';
import { ThemeProvider } from '@mui/material/styles';
import { render, screen } from '@testing-library/react';
import React from 'react';

import { Groups as UserGroup } from '@mui/icons-material';
// Mock recharts to avoid dependency issues in tests
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

describe('StatCard Component', () => {
  const renderWithThemeProvider = (component: React.ReactElement) => {
    return render(<ThemeProvider theme={theme}>{component}</ThemeProvider>);
  };

  it('renders with required props', () => {
    renderWithThemeProvider(<StatCard label="Test Label" value="42" />);

    expect(screen.getByText('Test Label')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
  });

  it('renders with subtitle', () => {
    renderWithThemeProvider(<StatCard label="Members" value="10" subtitle="Active members" />);

    expect(screen.getByText('Members')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('Active members')).toBeInTheDocument();
  });

  it('renders with icon', () => {
    const { container } = renderWithThemeProvider(
      <StatCard label="Users" value="5" icon={UserGroup as any} />
    );

    const iconWrapper = container.querySelector('.stat-card__icon-wrapper');
    expect(iconWrapper).toBeInTheDocument();
  });

  it('applies custom color', () => {
    const { container } = renderWithThemeProvider(
      <StatCard label="Revenue" value="$1000" color="#00ff88" />
    );

    const valueElement = screen.getByText('$1000');
    expect(valueElement).toHaveStyle({ color: '#00ff88' });
  });

  it('uses default accent color when not specified', () => {
    renderWithThemeProvider(<StatCard label="Default" value="100" />);

    const valueElement = screen.getByText('100');
    // CSS variables are applied, so we check the variable is set
    expect(valueElement).toHaveStyle({ color: 'var(--accent-blue)' });
  });

  it('displays label text', () => {
    renderWithThemeProvider(<StatCard label="test label" value="123" />);

    expect(screen.getByText('test label')).toBeInTheDocument();
    expect(screen.getByText('123')).toBeInTheDocument();
  });

  it('renders numeric and string values correctly', () => {
    const { rerender } = renderWithThemeProvider(<StatCard label="Number" value={999} />);

    expect(screen.getByText('999')).toBeInTheDocument();

    rerender(
      <ThemeProvider theme={theme}>
        <StatCard label="String" value="125K aUEC" />
      </ThemeProvider>
    );

    expect(screen.getByText('125K aUEC')).toBeInTheDocument();
  });
});
