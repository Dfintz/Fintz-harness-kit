/**
 * CreateWebhookDialog — form dialog for creating Discord or Custom webhooks.
 * Groups event types by domain for easier selection.
 */
import { webhookService } from '@/services/webhookService';
import { useNotification } from '@/store/uiStore';
import { logger } from '@/utils/logger';
import {
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  FormGroup,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import type {
  CreateWebhookRequest,
  WebhookEventType,
  WebhookType,
} from '@sc-fleet-manager/shared-types';
import React, { useState } from 'react';

interface CreateWebhookDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  organizationId: string;
  userId: string;
}

const EVENT_GROUPS: Record<string, WebhookEventType[]> = {
  Fleet: [
    'fleet.created',
    'fleet.updated',
    'fleet.deleted',
    'fleet.member.joined',
    'fleet.member.left',
  ],
  Members: ['member.joined', 'member.left', 'member.role.changed'],
  Activities: [
    'activity.created',
    'activity.started',
    'activity.completed',
    'activity.cancelled',
    'activity.participant.joined',
    'activity.participant.left',
  ],
  Alerts: ['alert.created', 'alert.resolved'],
  Ships: ['ship.added', 'ship.removed', 'ship.transferred'],
  Other: ['batch'],
};

export const CreateWebhookDialog: React.FC<Readonly<CreateWebhookDialogProps>> = ({
  open,
  onClose,
  onCreated,
  organizationId: _organizationId,
  userId,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<WebhookType>('discord');
  const [events, setEvents] = useState<WebhookEventType[]>([]);
  const [discordUrl, setDiscordUrl] = useState('');
  const [discordUsername, setDiscordUsername] = useState('');
  const [customUrl, setCustomUrl] = useState('');
  const [customMethod, setCustomMethod] = useState<'POST' | 'PUT' | 'PATCH'>('POST');
  const [secret, setSecret] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const notification = useNotification();

  const resetForm = () => {
    setName('');
    setDescription('');
    setType('discord');
    setEvents([]);
    setDiscordUrl('');
    setDiscordUsername('');
    setCustomUrl('');
    setCustomMethod('POST');
    setSecret('');
    setNotes('');
  };

  const handleClose = () => {
    if (submitting) return;
    resetForm();
    onClose();
  };

  const toggleEvent = (event: WebhookEventType) => {
    setEvents(prev => (prev.includes(event) ? prev.filter(e => e !== event) : [...prev, event]));
  };

  const toggleGroup = (groupEvents: WebhookEventType[]) => {
    const allSelected = groupEvents.every(e => events.includes(e));
    if (allSelected) {
      setEvents(prev => prev.filter(e => !groupEvents.includes(e)));
    } else {
      setEvents(prev => [...new Set([...prev, ...groupEvents])]);
    }
  };

  const canSubmit =
    name.trim().length > 0 &&
    events.length > 0 &&
    (type === 'discord' ? discordUrl.trim().length > 0 : customUrl.trim().length > 0);

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);

    const payload: CreateWebhookRequest = {
      name: name.trim(),
      description: description.trim() || undefined,
      type,
      events,
      createdBy: userId,
      secret: secret.trim() || undefined,
      notes: notes.trim() || undefined,
    };

    if (type === 'discord') {
      payload.discordConfig = {
        webhookUrl: discordUrl.trim(),
        username: discordUsername.trim() || undefined,
      };
    } else {
      payload.customConfig = {
        url: customUrl.trim(),
        method: customMethod,
      };
    }

    try {
      await webhookService.create(payload);
      resetForm();
      onCreated();
    } catch (err) {
      notification.error('Failed to create webhook');
      logger.error('Webhook create failed', err instanceof Error ? err : new Error(String(err)));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Create Webhook</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2.5} sx={{ pt: 1 }}>
          {/* Basic info */}
          <TextField
            label="Name"
            value={name}
            onChange={e => setName(e.target.value)}
            required
            fullWidth
            size="small"
            placeholder="e.g. Fleet Alerts"
          />
          <TextField
            label="Description"
            value={description}
            onChange={e => setDescription(e.target.value)}
            fullWidth
            size="small"
            multiline
            rows={2}
          />

          {/* Type selector */}
          <FormControl size="small" fullWidth>
            <InputLabel>Type</InputLabel>
            <Select
              value={type}
              label="Type"
              onChange={e => setType(e.target.value as WebhookType)}
            >
              <MenuItem value="discord">Discord</MenuItem>
              <MenuItem value="custom">Custom HTTP</MenuItem>
            </Select>
          </FormControl>

          {/* Discord config */}
          {type === 'discord' && (
            <Stack spacing={1.5}>
              <TextField
                label="Discord Webhook URL"
                value={discordUrl}
                onChange={e => setDiscordUrl(e.target.value)}
                required
                fullWidth
                size="small"
                placeholder="https://discord.com/api/webhooks/..."
              />
              <TextField
                label="Bot Username (optional)"
                value={discordUsername}
                onChange={e => setDiscordUsername(e.target.value)}
                fullWidth
                size="small"
                placeholder="Fleet Manager"
              />
            </Stack>
          )}

          {/* Custom config */}
          {type === 'custom' && (
            <Stack spacing={1.5}>
              <TextField
                label="Endpoint URL"
                value={customUrl}
                onChange={e => setCustomUrl(e.target.value)}
                required
                fullWidth
                size="small"
                placeholder="https://example.com/webhooks"
              />
              <FormControl size="small" fullWidth>
                <InputLabel>HTTP Method</InputLabel>
                <Select
                  value={customMethod}
                  label="HTTP Method"
                  onChange={e => setCustomMethod(e.target.value)}
                >
                  <MenuItem value="POST">POST</MenuItem>
                  <MenuItem value="PUT">PUT</MenuItem>
                  <MenuItem value="PATCH">PATCH</MenuItem>
                </Select>
              </FormControl>
              <TextField
                label="Signing Secret (optional)"
                value={secret}
                onChange={e => setSecret(e.target.value)}
                fullWidth
                size="small"
                placeholder="Used to verify webhook signatures"
              />
            </Stack>
          )}

          {/* Events */}
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Events *
            </Typography>
            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 1.5 }}>
              {events.length > 0 && (
                <Chip
                  label={`${events.length} selected`}
                  size="small"
                  onDelete={() => setEvents([])}
                />
              )}
            </Box>
            {Object.entries(EVENT_GROUPS).map(([group, groupEvents]) => {
              const allSelected = groupEvents.every(e => events.includes(e));
              const someSelected = groupEvents.some(e => events.includes(e));
              return (
                <Box key={group} sx={{ mb: 1 }}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={allSelected}
                        indeterminate={someSelected && !allSelected}
                        onChange={() => toggleGroup(groupEvents)}
                        size="small"
                      />
                    }
                    label={
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {group}
                      </Typography>
                    }
                  />
                  <FormGroup sx={{ pl: 3 }}>
                    {groupEvents.map(event => (
                      <FormControlLabel
                        key={event}
                        control={
                          <Checkbox
                            checked={events.includes(event)}
                            onChange={() => toggleEvent(event)}
                            size="small"
                          />
                        }
                        label={<Typography variant="caption">{event}</Typography>}
                      />
                    ))}
                  </FormGroup>
                </Box>
              );
            })}
          </Box>

          {/* Notes */}
          <TextField
            label="Notes (optional)"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            fullWidth
            size="small"
            multiline
            rows={2}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={submitting}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={!canSubmit || submitting}
          startIcon={submitting ? <CircularProgress size={16} /> : undefined}
        >
          Create
        </Button>
      </DialogActions>
    </Dialog>
  );
};
