import { Box, Divider, Stack, Typography } from '@mui/material';
import React from 'react';
import { Button, Modal } from './ui';

interface UserProfileModalProps {
  open?: boolean;
  isOpen?: boolean;
  onClose: () => void;
  userId: string;
}

/**
 * UserProfileModal component
 * Note: User presence information has been removed. This component now shows a simplified view.
 */
export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  open,
  isOpen,
  onClose,
  userId,
}) => {
  const modalOpen = open ?? isOpen ?? false;

  if (!modalOpen) return null;

  return (
    <Modal isOpen={modalOpen} onClose={onClose} title="User Profile" showCloseButton={false}>
      <Box sx={{ p: 3 }}>
        <Stack spacing={3}>
          <Typography>User ID: {userId}</Typography>
          <Typography sx={{ color: 'text.secondary', fontSize: '0.875rem' }}>
            User profile details are not available without the presence feature.
          </Typography>
        </Stack>
        <Divider sx={{ my: 2 }} />
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
      </Box>
    </Modal>
  );
};
