import { Person as PersonIcon } from '@mui/icons-material';
import React from 'react';
import { IconButton } from './ui';

interface StatusQuickMenuProps {
  currentUserId?: string;
}

/**
 * StatusQuickMenu component
 * Note: Custom status functionality has been removed as it depended on the User Presence feature
 */
export const StatusQuickMenu: React.FC<StatusQuickMenuProps> = ({
  currentUserId: _currentUserId,
}) => {
  return (
    <IconButton isQuiet isDisabled aria-label="Status feature is not available">
      <PersonIcon fontSize="small" />
    </IconButton>
  );
};
