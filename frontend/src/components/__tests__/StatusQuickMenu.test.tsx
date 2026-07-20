import { ThemeProvider } from '@mui/material/styles';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { theme } from '@/theme';
import { StatusQuickMenu } from '@/components/StatusQuickMenu';

describe('StatusQuickMenu Component', () => {
  const renderWithThemeProvider = (
    props: Partial<React.ComponentProps<typeof StatusQuickMenu>> = {}
  ) => {
    return render(
      <ThemeProvider theme={theme}>
        <StatusQuickMenu {...props} />
      </ThemeProvider>
    );
  };

  it('renders the action button', () => {
    renderWithThemeProvider();

    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('has accessibility label', () => {
    renderWithThemeProvider();

    expect(screen.getByLabelText('Status feature is not available')).toBeInTheDocument();
  });

  it('is disabled', () => {
    renderWithThemeProvider();

    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('renders with currentUserId prop', () => {
    renderWithThemeProvider({ currentUserId: 'user-123' });

    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('renders without currentUserId prop', () => {
    renderWithThemeProvider();

    expect(screen.getByRole('button')).toBeInTheDocument();
  });
});
