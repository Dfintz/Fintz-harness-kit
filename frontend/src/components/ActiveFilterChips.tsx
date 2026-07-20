import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import CloseIcon from '@mui/icons-material/Close';
import React from 'react';

import {
  ActivityLevel,
  getActivityLevelLabel,
  getFocusLabel,
  OrgPrimaryFocus,
} from '@/services/publicDirectoryService';
import { Stack, Typography } from '@mui/material';

/**
 * Individual filter chip data
 */
interface FilterChip {
  key: string;
  label: string;
  type: 'focus' | 'activity' | 'size' | 'boolean';
  value: string | number | boolean;
}

/**
 * Props for the ActiveFilterChips component
 */
interface ActiveFilterChipsProps {
  selectedFocuses?: OrgPrimaryFocus[];
  selectedActivityLevels?: ActivityLevel[];
  minMemberCount?: number;
  maxMemberCount?: number;
  isRecruiting?: boolean;
  isVerified?: boolean;
  searchTerm?: string;
  onRemoveFocus: (focus: OrgPrimaryFocus) => void;
  onRemoveActivityLevel: (level: ActivityLevel) => void;
  onRemoveMinMembers: () => void;
  onRemoveMaxMembers: () => void;
  onRemoveRecruiting: () => void;
  onRemoveVerified: () => void;
  onRemoveSearch: () => void;
  onClearAll: () => void;
}

/**
 * ActiveFilterChips - Displays active filter selections as removable chips
 *
 * Phase 2: Shows active filters for quick visibility and removal
 */
export const ActiveFilterChips: React.FC<ActiveFilterChipsProps> = ({
  selectedFocuses = [],
  selectedActivityLevels = [],
  minMemberCount,
  maxMemberCount,
  isRecruiting,
  isVerified,
  searchTerm,
  onRemoveFocus,
  onRemoveActivityLevel,
  onRemoveMinMembers,
  onRemoveMaxMembers,
  onRemoveRecruiting,
  onRemoveVerified,
  onRemoveSearch,
  onClearAll,
}) => {
  // Build list of active filters
  const chips: FilterChip[] = [];

  // Search term
  if (searchTerm) {
    chips.push({
      key: 'search',
      label: `Search: "${searchTerm}"`,
      type: 'boolean',
      value: searchTerm,
    });
  }

  // Focus areas
  selectedFocuses.forEach(focus => {
    chips.push({
      key: `focus-${focus}`,
      label: `Focus: ${getFocusLabel(focus)}`,
      type: 'focus',
      value: focus,
    });
  });

  // Activity levels
  selectedActivityLevels.forEach(level => {
    chips.push({
      key: `activity-${level}`,
      label: `Activity: ${getActivityLevelLabel(level)}`,
      type: 'activity',
      value: level,
    });
  });

  // Size range
  if (minMemberCount !== undefined) {
    chips.push({
      key: 'minMembers',
      label: `Min: ${minMemberCount} members`,
      type: 'size',
      value: minMemberCount,
    });
  }
  if (maxMemberCount !== undefined) {
    chips.push({
      key: 'maxMembers',
      label: `Max: ${maxMemberCount} members`,
      type: 'size',
      value: maxMemberCount,
    });
  }

  // Boolean filters
  if (isRecruiting !== undefined) {
    chips.push({
      key: 'recruiting',
      label: 'Recruiting Only',
      type: 'boolean',
      value: true,
    });
  }
  if (isVerified !== undefined) {
    chips.push({
      key: 'verified',
      label: 'Verified Only',
      type: 'boolean',
      value: true,
    });
  }

  // No active filters
  if (chips.length === 0) {
    return null;
  }

  // Handle chip removal
  const handleRemove = (chip: FilterChip) => {
    switch (chip.key) {
      case 'search':
        onRemoveSearch();
        break;
      case 'minMembers':
        onRemoveMinMembers();
        break;
      case 'maxMembers':
        onRemoveMaxMembers();
        break;
      case 'recruiting':
        onRemoveRecruiting();
        break;
      case 'verified':
        onRemoveVerified();
        break;
      default:
        if (chip.key.startsWith('focus-')) {
          onRemoveFocus(chip.value as OrgPrimaryFocus);
        } else if (chip.key.startsWith('activity-')) {
          onRemoveActivityLevel(chip.value as ActivityLevel);
        }
    }
  };

  return (
    <Stack
      direction="row"
      spacing={1}
      useFlexGap
      sx={{ flexWrap: 'wrap' }}
      alignItems="center"
      mt={2}
    >
      <Typography
        sx={{
          fontSize: '0.85rem',
          color: 'var(--spectrum-global-color-gray-600)',
          marginRight: '4px',
        }}
      >
        Active filters:
      </Typography>
      {chips.map(chip => (
        <Stack
          key={chip.key}
          direction="row"
          alignItems="center"
          spacing={0.5}
          sx={{
            backgroundColor: 'var(--spectrum-global-color-blue-100)',
            border: '1px solid var(--spectrum-global-color-blue-300)',
            borderRadius: '16px',
            padding: '2px 8px 2px 12px',
            fontSize: '0.85rem',
          }}
        >
          <Typography>{chip.label}</Typography>
          <IconButton
            isQuiet
            onClick={() => handleRemove(chip)}
            sx={{ padding: 0, minWidth: '20px' }}
            aria-label="Remove filter"
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </Stack>
      ))}
      {chips.length > 1 && (
        <Button variant="ghost" onClick={onClearAll} className="clear-all-button">
          Clear all
        </Button>
      )}
    </Stack>
  );
};
