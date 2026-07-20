/**
 * MissionParticipantsPanel
 * Panel for managing mission participants: roster display, add/remove members.
 * Shown within the Participants tab of MissionDetailPage.
 *
 * Sprint 1 — Wave 3.1
 */

import AddIcon from '@mui/icons-material/Add';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import PersonIcon from '@mui/icons-material/Person';
import PersonRemoveIcon from '@mui/icons-material/PersonRemove';
import RemoveCircleIcon from '@mui/icons-material/RemoveCircle';
import ShieldIcon from '@mui/icons-material/Shield';
import StarIcon from '@mui/icons-material/Star';
import SupportAgentIcon from '@mui/icons-material/SupportAgent';
import Alert from '@mui/material/Alert';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import FormControl from '@mui/material/FormControl';
import IconButton from '@mui/material/IconButton';
import InputLabel from '@mui/material/InputLabel';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemAvatar from '@mui/material/ListItemAvatar';
import ListItemSecondaryAction from '@mui/material/ListItemSecondaryAction';
import ListItemText from '@mui/material/ListItemText';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { useTheme } from '@mui/material/styles';
import type { Mission, MissionParticipant } from '@sc-fleet-manager/shared-types';
import React, { useCallback, useState } from 'react';

import { ConfirmDialog, useConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useAddParticipant, useRemoveParticipant } from '@/hooks/queries/useMissionQueries';
import { useAuthStore } from '@/store/authStore';
import { logger } from '@/utils/logger';
import { getStatusChipSx } from '@/utils/statusStyles';

// ============================================================================
// Constants
// ============================================================================

const ROLE_CONFIG: Record<
  MissionParticipant['role'],
  { label: string; icon: React.ReactElement; color: string }
> = {
  leader: { label: 'Leader', icon: <StarIcon fontSize="small" />, color: 'warning.main' },
  member: { label: 'Member', icon: <PersonIcon fontSize="small" />, color: 'primary.main' },
  support: { label: 'Support', icon: <SupportAgentIcon fontSize="small" />, color: 'info.main' },
  reserve: { label: 'Reserve', icon: <ShieldIcon fontSize="small" />, color: 'text.secondary' },
};

const STATUS_CONFIG: Record<
  MissionParticipant['status'],
  { label: string; icon: React.ReactElement }
> = {
  confirmed: { label: 'Confirmed', icon: <CheckCircleIcon fontSize="small" /> },
  pending: { label: 'Pending', icon: <HelpOutlineIcon fontSize="small" /> },
  declined: { label: 'Declined', icon: <RemoveCircleIcon fontSize="small" /> },
};

// ============================================================================
// Component
// ============================================================================

interface MissionParticipantsPanelProps {
  mission: Mission;
}

export const MissionParticipantsPanel: React.FC<Readonly<MissionParticipantsPanelProps>> = ({
  mission,
}) => {
  const theme = useTheme();
  const user = useAuthStore(state => state.user);
  const addParticipant = useAddParticipant();
  const removeParticipant = useRemoveParticipant();
  const { openDialog, closeDialog, pendingData, dialogProps } = useConfirmDialog<string>();

  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newUserId, setNewUserId] = useState('');
  const [newRole, setNewRole] = useState<MissionParticipant['role']>('member');

  const participants = mission.participants ?? [];
  const isOwner = user?.id === mission.createdBy;
  const isEditable = ['draft', 'planned', 'briefed'].includes(mission.status);

  const handleAdd = useCallback(async () => {
    if (!newUserId.trim()) return;
    try {
      await addParticipant.mutateAsync({
        missionId: mission.id,
        data: { userId: newUserId.trim(), role: newRole },
      });
      setAddDialogOpen(false);
      setNewUserId('');
      setNewRole('member');
    } catch (err) {
      logger.error(
        'Failed to add participant',
        err instanceof Error ? err : new Error(String(err))
      );
    }
  }, [newUserId, newRole, mission.id, addParticipant]);

  const handleRemoveConfirm = useCallback(async () => {
    if (!pendingData) return;
    try {
      await removeParticipant.mutateAsync({
        missionId: mission.id,
        userId: pendingData,
      });
      closeDialog();
    } catch (err) {
      logger.error(
        'Failed to remove participant',
        err instanceof Error ? err : new Error(String(err))
      );
    }
  }, [pendingData, mission.id, removeParticipant, closeDialog]);

  const formatJoinDate = (date: string | Date): string => {
    return new Date(date).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  // Group by role
  const grouped = participants.reduce(
    (acc, p) => {
      const role = p.role ?? 'member';
      if (!acc[role]) acc[role] = [];
      acc[role].push(p);
      return acc;
    },
    {} as Record<string, MissionParticipant[]>
  );

  const roleOrder: MissionParticipant['role'][] = ['leader', 'member', 'support', 'reserve'];

  return (
    <Stack spacing={3}>
      {/* Summary */}
      <Card>
        <CardContent>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Stack direction="row" spacing={2} alignItems="center">
              <Typography variant="h6">Participants</Typography>
              <Chip
                label={`${participants.filter(p => p.status === 'confirmed').length} confirmed`}
                size="small"
                variant="outlined"
                sx={getStatusChipSx('confirmed', theme)}
              />
              <Chip label={`${participants.length} total`} size="small" variant="outlined" />
            </Stack>
            {isOwner && isEditable && (
              <Button
                variant="outlined"
                startIcon={<AddIcon />}
                size="small"
                onClick={() => setAddDialogOpen(true)}
              >
                Add Participant
              </Button>
            )}
          </Stack>
        </CardContent>
      </Card>

      {/* Participant Roster */}
      {participants.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <PersonIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
          <Typography variant="body1" color="text.secondary">
            No participants yet.
          </Typography>
          {isOwner && isEditable && (
            <Button
              variant="text"
              startIcon={<AddIcon />}
              sx={{ mt: 1 }}
              onClick={() => setAddDialogOpen(true)}
            >
              Add the first participant
            </Button>
          )}
        </Box>
      ) : (
        roleOrder.map(role => {
          const group = grouped[role];
          if (!group || group.length === 0) return null;
          const config = ROLE_CONFIG[role];

          return (
            <Card key={role}>
              <CardContent sx={{ pb: 0 }}>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                  <Box sx={{ color: config.color }}>{config.icon}</Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                    {config.label}s ({group.length})
                  </Typography>
                </Stack>
              </CardContent>
              <List disablePadding>
                {group.map((participant, index) => {
                  const statusConf = STATUS_CONFIG[participant.status];
                  return (
                    <React.Fragment key={participant.userId}>
                      {index > 0 && <Divider variant="inset" component="li" />}
                      <ListItem>
                        <ListItemAvatar>
                          <Avatar sx={{ bgcolor: config.color }}>
                            {participant.userId.charAt(0).toUpperCase()}
                          </Avatar>
                        </ListItemAvatar>
                        <ListItemText
                          primary={participant.userId}
                          secondary={`Joined ${formatJoinDate(participant.joinedAt)}`}
                        />
                        <Stack
                          direction="row"
                          spacing={1}
                          alignItems="center"
                          sx={{ mr: isOwner && isEditable ? 4 : 0 }}
                        >
                          <Chip
                            icon={statusConf.icon}
                            label={statusConf.label}
                            size="small"
                            variant="outlined"
                            sx={getStatusChipSx(participant.status, theme)}
                          />
                        </Stack>
                        {isOwner && isEditable && (
                          <ListItemSecondaryAction>
                            <Tooltip title="Remove participant">
                              <IconButton
                                edge="end"
                                size="small"
                                onClick={() => openDialog(participant.userId)}
                                disabled={removeParticipant.isPending}
                              >
                                <PersonRemoveIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </ListItemSecondaryAction>
                        )}
                      </ListItem>
                    </React.Fragment>
                  );
                })}
              </List>
            </Card>
          );
        })
      )}

      {/* Add Participant Dialog */}
      <Dialog open={addDialogOpen} onClose={() => setAddDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Add Participant</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="User ID"
              value={newUserId}
              onChange={e => setNewUserId(e.target.value)}
              fullWidth
              required
              placeholder="Enter user ID"
              size="small"
            />
            <FormControl fullWidth size="small">
              <InputLabel>Role</InputLabel>
              <Select
                value={newRole}
                label="Role"
                onChange={e => setNewRole(e.target.value as MissionParticipant['role'])}
              >
                <MenuItem value="leader">Leader</MenuItem>
                <MenuItem value="member">Member</MenuItem>
                <MenuItem value="support">Support</MenuItem>
                <MenuItem value="reserve">Reserve</MenuItem>
              </Select>
            </FormControl>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleAdd}
            disabled={!newUserId.trim() || addParticipant.isPending}
          >
            {addParticipant.isPending ? 'Adding...' : 'Add'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Mutation errors */}
      {addParticipant.isError && (
        <Alert severity="error">Failed to add participant. Please try again.</Alert>
      )}
      {removeParticipant.isError && (
        <Alert severity="error">Failed to remove participant. Please try again.</Alert>
      )}

      {/* Remove confirmation */}
      <ConfirmDialog
        {...dialogProps}
        title="Remove Participant"
        message="Are you sure you want to remove this participant from the mission?"
        onConfirm={handleRemoveConfirm}
      />
    </Stack>
  );
};
