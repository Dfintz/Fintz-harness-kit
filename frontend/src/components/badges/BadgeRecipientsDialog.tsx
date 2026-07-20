/**
 * Badge Recipients Dialog
 *
 * Displays a list of users who have been awarded a specific badge/title.
 * Used from the BadgeManagementList to view who holds each badge.
 */

import { useBadgeRecipients, useRevokeBadge } from '@/hooks/queries/useBadgeQueries';
import type { Achievement } from '@/services/badgeService';
import { logger } from '@/utils/logger';
import { sanitizeImageUrl } from '@/utils/sanitize';
import PersonIcon from '@mui/icons-material/Person';
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutline';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import React, { useCallback } from 'react';
import { BadgeRarityChip } from './BadgeRarityChip';

interface BadgeRecipientsDialogProps {
  open: boolean;
  onClose: () => void;
  achievement: Achievement | null;
}

export const BadgeRecipientsDialog: React.FC<Readonly<BadgeRecipientsDialogProps>> = ({
  open,
  onClose,
  achievement,
}) => {
  const { data: recipients, isLoading } = useBadgeRecipients(
    open && achievement ? achievement.id : undefined
  );
  const revokeBadge = useRevokeBadge();

  const handleRevoke = useCallback(
    async (userId: string) => {
      if (!achievement) return;
      try {
        await revokeBadge.mutateAsync({ achievementId: achievement.id, userId });
      } catch (err) {
        logger.error('Failed to revoke badge', err instanceof Error ? err : new Error(String(err)));
      }
    },
    [achievement, revokeBadge]
  );

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Stack spacing={0.5}>
          <Typography variant="h6">{achievement?.name ?? 'Badge'} Recipients</Typography>
          {achievement && (
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="body2" color="text.secondary">
                {achievement.type === 'title' ? 'Title' : 'Badge'}
              </Typography>
              <BadgeRarityChip rarity={achievement.rarity} size="small" />
            </Stack>
          )}
        </Stack>
      </DialogTitle>
      <DialogContent>
        {isLoading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        )}
        {!isLoading && (!recipients || recipients.length === 0) && (
          <Typography color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>
            No one has been awarded this {achievement?.type === 'title' ? 'title' : 'badge'} yet.
          </Typography>
        )}
        {!isLoading && recipients && recipients.length > 0 && (
          <Stack spacing={1}>
            {recipients.map(recipient => (
              <Stack
                key={recipient.id}
                direction="row"
                spacing={2}
                alignItems="center"
                sx={{
                  p: 1.5,
                  borderRadius: 1,
                  bgcolor: 'action.hover',
                  border: '1px solid',
                  borderColor: 'divider',
                }}
              >
                <Avatar
                  src={sanitizeImageUrl(recipient.user?.avatar) || undefined}
                  sx={{ width: 36, height: 36 }}
                >
                  {recipient.user?.displayName?.charAt(0) ??
                    recipient.user?.username?.charAt(0) ?? <PersonIcon fontSize="small" />}
                </Avatar>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography fontWeight={500} noWrap>
                    {recipient.user?.displayName || recipient.user?.username || 'Unknown User'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Awarded {new Date(recipient.awardedAt).toLocaleDateString()}
                  </Typography>
                </Box>
                <Tooltip title="Revoke">
                  <IconButton
                    size="small"
                    color="error"
                    onClick={() => handleRevoke(recipient.userId)}
                    disabled={revokeBadge.isPending}
                  >
                    <RemoveCircleOutlineIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Stack>
            ))}
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};
