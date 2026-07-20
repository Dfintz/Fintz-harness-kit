/**
 * Tests for ActiveFilterChips component
 *
 * Ensures the component handles undefined array props gracefully
 */

import { ThemeProvider } from '@mui/material/styles';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { theme } from '@/theme';
import { ActiveFilterChips } from '@/components/ActiveFilterChips';

// Mock functions
const mockOnRemoveFocus = jest.fn();
const mockOnRemoveActivityLevel = jest.fn();
const mockOnRemoveMinMembers = jest.fn();
const mockOnRemoveMaxMembers = jest.fn();
const mockOnRemoveRecruiting = jest.fn();
const mockOnRemoveVerified = jest.fn();
const mockOnRemoveSearch = jest.fn();
const mockOnClearAll = jest.fn();

const defaultProps = {
  onRemoveFocus: mockOnRemoveFocus,
  onRemoveActivityLevel: mockOnRemoveActivityLevel,
  onRemoveMinMembers: mockOnRemoveMinMembers,
  onRemoveMaxMembers: mockOnRemoveMaxMembers,
  onRemoveRecruiting: mockOnRemoveRecruiting,
  onRemoveVerified: mockOnRemoveVerified,
  onRemoveSearch: mockOnRemoveSearch,
  onClearAll: mockOnClearAll,
};

const renderWithThemeProvider = (component: React.ReactElement) => {
  return render(<ThemeProvider theme={theme}>{component}</ThemeProvider>);
};

describe('ActiveFilterChips', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render without crashing when all props are undefined', () => {
    const { container } = renderWithThemeProvider(<ActiveFilterChips {...defaultProps} />);
    // Component should not show any filter chips when no filters are active
    expect(container.querySelector('[role="list"]')).not.toBeInTheDocument();
    expect(screen.queryByText(/Active filters:/i)).not.toBeInTheDocument();
  });

  it('should render without crashing when array props are explicitly undefined', () => {
    const { container } = renderWithThemeProvider(
      <ActiveFilterChips
        {...defaultProps}
        selectedFocuses={undefined}
        selectedActivityLevels={undefined}
      />
    );
    expect(screen.queryByText(/Active filters:/i)).not.toBeInTheDocument();
  });

  it('should render without crashing with empty arrays', () => {
    const { container } = renderWithThemeProvider(
      <ActiveFilterChips {...defaultProps} selectedFocuses={[]} selectedActivityLevels={[]} />
    );
    expect(screen.queryByText(/Active filters:/i)).not.toBeInTheDocument();
  });

  it('should render filter chips when focus is selected', () => {
    renderWithThemeProvider(
      <ActiveFilterChips
        {...defaultProps}
        selectedFocuses={['combat']}
        selectedActivityLevels={[]}
      />
    );
    expect(screen.getByText(/Active filters:/i)).toBeInTheDocument();
    expect(screen.getByText(/Focus: Combat/i)).toBeInTheDocument();
  });

  it('should render filter chips when activity level is selected', () => {
    renderWithThemeProvider(
      <ActiveFilterChips {...defaultProps} selectedFocuses={[]} selectedActivityLevels={['high']} />
    );
    expect(screen.getByText(/Active filters:/i)).toBeInTheDocument();
    expect(screen.getByText(/Activity: High/i)).toBeInTheDocument();
  });

  it('should render search term chip', () => {
    renderWithThemeProvider(
      <ActiveFilterChips
        {...defaultProps}
        selectedFocuses={[]}
        selectedActivityLevels={[]}
        searchTerm="test search"
      />
    );
    expect(screen.getByText(/Search: "test search"/i)).toBeInTheDocument();
  });

  it('should handle multiple filters', () => {
    renderWithThemeProvider(
      <ActiveFilterChips
        {...defaultProps}
        selectedFocuses={['combat', 'mining']}
        selectedActivityLevels={['high', 'moderate']}
        searchTerm="test"
      />
    );
    expect(screen.getByText(/Search: "test"/i)).toBeInTheDocument();
    expect(screen.getByText(/Focus: Combat/i)).toBeInTheDocument();
    expect(screen.getByText(/Focus: Mining/i)).toBeInTheDocument();
    expect(screen.getByText(/Activity: High/i)).toBeInTheDocument();
    expect(screen.getByText(/Activity: Moderate/i)).toBeInTheDocument();
  });

  it('should show clear all button when multiple filters are active', () => {
    renderWithThemeProvider(
      <ActiveFilterChips
        {...defaultProps}
        selectedFocuses={['combat']}
        selectedActivityLevels={['high']}
      />
    );
    expect(screen.getByText(/Clear all/i)).toBeInTheDocument();
  });
});
