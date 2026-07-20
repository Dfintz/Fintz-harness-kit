import { ThemeProvider } from '@mui/material/styles';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { theme } from '@/theme';
import { SearchFilterBar } from '@/components/SearchFilterBar';

describe('SearchFilterBar Component', () => {
  const renderWithThemeProvider = (component: React.ReactElement) => {
    return render(<ThemeProvider theme={theme}>{component}</ThemeProvider>);
  };

  const mockCategories = [
    { id: 'all', name: 'All Categories' },
    { id: 'fuel', name: 'Fuel' },
    { id: 'medical', name: 'Medical' },
  ];

  it('renders search field with label', () => {
    const mockSearch = jest.fn();

    renderWithThemeProvider(
      <SearchFilterBar searchTerm="" onSearchChange={mockSearch} searchLabel="Search items..." />
    );

    // MUI renders the label multiple times (label element and legend)
    expect(screen.getAllByText('Search items...').length).toBeGreaterThan(0);
  });

  it('calls onSearchChange when typing in search field', async () => {
    const user = userEvent.setup();
    const mockSearch = jest.fn();

    renderWithThemeProvider(<SearchFilterBar searchTerm="" onSearchChange={mockSearch} />);

    const searchInput = screen.getByRole('textbox');
    await user.type(searchInput, 'test');

    expect(mockSearch).toHaveBeenCalled();
  });

  it('renders category Select when categories provided', () => {
    const mockSearch = jest.fn();
    const mockCategoryChange = jest.fn();

    renderWithThemeProvider(
      <SearchFilterBar
        searchTerm=""
        onSearchChange={mockSearch}
        categories={mockCategories}
        selectedCategory="all"
        onCategoryChange={mockCategoryChange}
      />
    );

    expect(screen.getAllByText('Category').length).toBeGreaterThan(0);
  });

  it('does not render category Select when categories not provided', () => {
    const mockSearch = jest.fn();

    renderWithThemeProvider(<SearchFilterBar searchTerm="" onSearchChange={mockSearch} />);

    expect(screen.queryByText('Category')).not.toBeInTheDocument();
  });

  it('renders refresh button when onRefresh provided', () => {
    const mockSearch = jest.fn();
    const mockRefresh = jest.fn();

    renderWithThemeProvider(
      <SearchFilterBar searchTerm="" onSearchChange={mockSearch} onRefresh={mockRefresh} />
    );

    const refreshButton = screen.getByRole('button');
    expect(refreshButton).toBeInTheDocument();
  });

  it('calls onRefresh when refresh button clicked', async () => {
    const user = userEvent.setup();
    const mockSearch = jest.fn();
    const mockRefresh = jest.fn();

    renderWithThemeProvider(
      <SearchFilterBar searchTerm="" onSearchChange={mockSearch} onRefresh={mockRefresh} />
    );

    const refreshButton = screen.getByRole('button');
    await user.click(refreshButton);

    expect(mockRefresh).toHaveBeenCalledTimes(1);
  });

  it('disables refresh button when loading', () => {
    const mockSearch = jest.fn();
    const mockRefresh = jest.fn();

    renderWithThemeProvider(
      <SearchFilterBar
        searchTerm=""
        onSearchChange={mockSearch}
        onRefresh={mockRefresh}
        loading={true}
      />
    );

    const refreshButton = screen.getByRole('button');
    expect(refreshButton).toBeDisabled();
  });

  it('uses custom search label when provided', () => {
    const mockSearch = jest.fn();

    renderWithThemeProvider(
      <SearchFilterBar searchTerm="" onSearchChange={mockSearch} searchLabel="Find ships..." />
    );

    const labels = screen.getAllByText('Find ships...');
    expect(labels.length).toBeGreaterThan(0);
  });

  it('uses custom category label when provided', () => {
    const mockSearch = jest.fn();
    const mockCategoryChange = jest.fn();

    renderWithThemeProvider(
      <SearchFilterBar
        searchTerm=""
        onSearchChange={mockSearch}
        categories={mockCategories}
        selectedCategory="all"
        onCategoryChange={mockCategoryChange}
        categoryLabel="Role"
      />
    );

    expect(screen.getAllByText('Role').length).toBeGreaterThan(0);
  });

  it('displays current search term', () => {
    const mockSearch = jest.fn();

    renderWithThemeProvider(
      <SearchFilterBar searchTerm="test search" onSearchChange={mockSearch} />
    );

    const searchInput = screen.getByRole('textbox') as HTMLInputElement;
    expect(searchInput.value).toBe('test search');
  });
});
