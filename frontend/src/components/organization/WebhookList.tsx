/**
 * WebhookList — displays organization webhooks with status, actions, and create dialog.
 * Uses webhookService for CRUD operations and getStatusChipSx for status chips.
 */
import { webhookService } from '@/services/webhookService';
import { useNotification } from '@/store/uiStore';
import { logger } from '@/utils/logger';
import { getStatusChipSx } from '@/utils/statusStyles';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  IconButton,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
  useTheme,
} from '@mui/material';
import type { WebhookV2 } from '@sc-fleet-manager/shared-types';
import React, { useCallback, useEffect, useState } from 'react';

import { ConfirmDialog, useConfirmDialog } from '@/components/ui/ConfirmDialog';
import { CreateWebhookDialog } from './CreateWebhookDialog';

interface WebhookListProps {
  organizationId: string;
  userId: string;
}

export const WebhookList: React.FC<Readonly<WebhookListProps>> = ({ organizationId, userId }) => {
  const theme = useTheme();
  const notification = useNotification();
  const [webhooks, setWebhooks] = useState<WebhookV2[]>([]);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const { openDialog, closeDialog, pendingData, dialogProps } = useConfirmDialog<string>();

  const fetchWebhooks = useCallback(async () => {
    try {
      setLoading(true);
      const data = await webhookService.list();
      setWebhooks(data);
    } catch (err) {
      notification.error('Failed to load webhooks');
      logger.error('Failed to load webhooks', err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWebhooks();
  }, [fetchWebhooks]);

  const handleTest = async (webhookId: string) => {
    try {
      setTesting(webhookId);
      const result = await webhookService.test(webhookId);
      if (result.success) {
        await fetchWebhooks();
      } else {
        notification.error(`Test failed: ${result.error ?? 'Unknown error'}`);
      }
    } catch (err) {
      notification.error('Failed to test webhook');
      logger.error('Webhook test failed', err instanceof Error ? err : new Error(String(err)));
    } finally {
      setTesting(null);
    }
  };

  const handleDelete = async () => {
    if (!pendingData) return;
    try {
      await webhookService.delete(pendingData);
      closeDialog();
      await fetchWebhooks();
    } catch (err) {
      notification.error('Failed to delete webhook');
      logger.error('Webhook delete failed', err instanceof Error ? err : new Error(String(err)));
    }
  };

  const handleCreated = () => {
    setCreateOpen(false);
    fetchWebhooks();
  };

  if (loading) {
    return (
      <Stack spacing={1}>
        <Skeleton variant="rectangular" height={40} />
        <Skeleton variant="rectangular" height={40} />
        <Skeleton variant="rectangular" height={40} />
      </Stack>
    );
  }

  return (
    <Box>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
          Webhooks ({webhooks.length})
        </Typography>
        <Button
          size="small"
          variant="outlined"
          startIcon={<AddIcon />}
          onClick={() => setCreateOpen(true)}
        >
          Add Webhook
        </Button>
      </Stack>

      {webhooks.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
          No webhooks configured. Add one to receive notifications when events occur.
        </Typography>
      ) : (
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Events</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Deliveries</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {webhooks.map(webhook => (
                <TableRow key={webhook.id} hover>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {webhook.name}
                    </Typography>
                    {webhook.description && (
                      <Typography variant="caption" color="text.secondary">
                        {webhook.description}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={webhook.type}
                      size="small"
                      variant="outlined"
                      sx={{ textTransform: 'capitalize' }}
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{webhook.events.length} events</Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={webhook.status}
                      size="small"
                      sx={getStatusChipSx(webhook.status, theme)}
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {webhook.successfulDeliveries}/{webhook.totalDeliveries}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                      <Tooltip title="Test webhook">
                        <IconButton
                          size="small"
                          onClick={() => handleTest(webhook.id)}
                          disabled={testing === webhook.id}
                        >
                          {testing === webhook.id ? (
                            <CircularProgress size={16} />
                          ) : (
                            <PlayArrowIcon fontSize="small" />
                          )}
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete webhook">
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => openDialog(webhook.id)}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <CreateWebhookDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={handleCreated}
        organizationId={organizationId}
        userId={userId}
      />

      <ConfirmDialog
        {...dialogProps}
        title="Delete Webhook"
        message="This will permanently remove the webhook and its delivery history. This action cannot be undone."
        onConfirm={handleDelete}
      />
    </Box>
  );
};
