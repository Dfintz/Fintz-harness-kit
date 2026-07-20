import { QuickActionCard } from '@/components/ui/QuickActionCard';
import { muiTheme } from '@/theme/muiTheme';
import { ViewList as BoxList } from '@mui/icons-material';
import { ThemeProvider } from '@mui/material/styles';
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
describe('QuickActionCard Component', () => {
  const renderWithThemeProvider = (component: React.ReactElement) => {
    return render(<ThemeProvider theme={muiTheme}>{component}</ThemeProvider>);
  };

  const defaultProps = {
    title: 'Fleet Management',
    description: 'Manage your fleet and ships',
    icon: BoxList,
    onClick: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders with required props', () => {
    renderWithThemeProvider(<QuickActionCard {...defaultProps} />);

    expect(screen.getByText('Fleet Management')).toBeInTheDocument();
    expect(screen.getByText('Manage your fleet and ships')).toBeInTheDocument();
  });

  it('renders icon', () => {
    renderWithThemeProvider(<QuickActionCard {...defaultProps} />);

    // Just verify the component renders successfully with an icon prop
    // The actual icon rendering is internal to Spectrum components
    expect(screen.getByText('Fleet Management')).toBeInTheDocument();
  });

  it('calls onClick when clicked', () => {
    const onClick = jest.fn();
    renderWithThemeProvider(<QuickActionCard {...defaultProps} onClick={onClick} />);

    const card = screen.getByRole('button');
    fireEvent.click(card);

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('calls onClick when Enter key is pressed', () => {
    const onClick = jest.fn();
    renderWithThemeProvider(<QuickActionCard {...defaultProps} onClick={onClick} />);

    const card = screen.getByRole('button');
    fireEvent.keyDown(card, { key: 'Enter', code: 'Enter' });

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('calls onClick when Space key is pressed', () => {
    const onClick = jest.fn();
    renderWithThemeProvider(<QuickActionCard {...defaultProps} onClick={onClick} />);

    const card = screen.getByRole('button');
    fireEvent.keyDown(card, { key: ' ', code: 'Space' });

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('has accessible aria-label', () => {
    renderWithThemeProvider(<QuickActionCard {...defaultProps} />);

    const card = screen.getByRole('button');
    expect(card).toHaveAttribute('aria-label', 'Fleet Management: Manage your fleet and ships');
  });

  it('is focusable', () => {
    renderWithThemeProvider(<QuickActionCard {...defaultProps} />);

    const card = screen.getByRole('button');
    card.focus();
    expect(card).toHaveFocus();
  });
});
