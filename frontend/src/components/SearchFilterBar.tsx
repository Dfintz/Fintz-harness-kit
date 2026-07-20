import { Refresh as RefreshIcon } from '@mui/icons-material';
import { Stack } from '@mui/material';
import React from 'react';
import { Button } from './ui/Button';
import { SearchField } from './ui/SearchField';
import { Select } from './ui/Select';

interface SearchFilterBarProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  searchLabel?: string;
  /**
   * Width of the search field. Use CSS width values (e.g., '360px', '100%').
   * Note: Changed from Spectrum size tokens to standard CSS values.
   */
  searchWidth?: string;
  categories?: Array<{ id: string; name: string }>;
  selectedCategory?: string;
  onCategoryChange?: (key: string) => void;
  categoryLabel?: string;
  onRefresh?: () => void;
  loading?: boolean;
}

export const SearchFilterBar: React.FC<SearchFilterBarProps> = ({
  searchTerm,
  onSearchChange,
  searchLabel = 'Search...',
  searchWidth = '360px',
  categories,
  selectedCategory,
  onCategoryChange,
  categoryLabel = 'Category',
  onRefresh,
  loading = false,
}) => {
  return (
    <Stack direction="row" spacing={2} alignItems="flex-end">
      <SearchField
        label={searchLabel}
        value={searchTerm}
        onChange={onSearchChange}
        width={searchWidth}
      />

      {categories && onCategoryChange && (
        <Select
          label={categoryLabel}
          value={selectedCategory}
          onChange={value => onCategoryChange?.(String(value))}
          options={categories.map(cat => ({ value: cat.id, label: cat.name }))}
          fullWidth={false}
          size="md"
        />
      )}

      {onRefresh && (
        <Button
          variant="secondary"
          onClick={onRefresh}
          disabled={loading}
          leftIcon={<RefreshIcon />}
        >
          Refresh
        </Button>
      )}
    </Stack>
  );
};
