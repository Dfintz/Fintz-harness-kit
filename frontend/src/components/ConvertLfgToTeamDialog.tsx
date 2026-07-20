import { useConvertLfgToTeam } from '@/hooks/queries/useSocialLfgQueries';
import { logger } from '@/utils/logger';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
} from '@mui/material';
import React, { useState } from 'react';

interface ConvertLfgToTeamDialogProps {
  open: boolean;
  onClose: () => void;
  groupId: string;
  groupName: string;
  organizationId: string;
  memberCount: number;
}

const TEAM_TYPES = [
  { value: 'squadron', label: 'Squadron' },
  { value: 'division', label: 'Division' },
  { value: 'crew', label: 'Crew' },
  { value: 'platoon', label: 'Platoon' },
  { value: 'custom', label: 'Custom' },
];

export const ConvertLfgToTeamDialog: React.FC<Readonly<ConvertLfgToTeamDialogProps>> = ({
  open,
  onClose,
  groupId,
  groupName,
  organizationId,
  memberCount,
}) => {
  const [teamName, setTeamName] = useState(groupName);
  const [teamType, setTeamType] = useState('squadron');
  const convertMutation = useConvertLfgToTeam();

  const handleConvert = async () => {
    if (!teamName.trim()) return;

    try {
      await convertMutation.mutateAsync({
        groupId,
        teamName: teamName.trim(),
        teamType,
        organizationId,
      });
      onClose();
    } catch (err) {
      logger.error(
        'Failed to convert LFG group to team',
        err instanceof Error ? err : new Error(String(err))
      );
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Convert to Team</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
        <Typography variant="body2" color="text.secondary">
          Found good crew? Convert this LFG group into a persistent team. All {memberCount} eligible
          members will be carried over.
        </Typography>
        <TextField
          label="Team Name"
          value={teamName}
          onChange={e => setTeamName(e.target.value)}
          fullWidth
          required
          autoFocus
          sx={{ mt: 1 }}
        />
        <FormControl fullWidth>
          <InputLabel>Team Type</InputLabel>
          <Select value={teamType} onChange={e => setTeamType(e.target.value)} label="Team Type">
            {TEAM_TYPES.map(t => (
              <MenuItem key={t.value} value={t.value}>
                {t.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        {convertMutation.isError && (
          <Typography color="error" variant="body2">
            Conversion failed. Please try again.
          </Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          onClick={handleConvert}
          disabled={!teamName.trim() || convertMutation.isPending}
        >
          {convertMutation.isPending ? 'Converting...' : 'Convert to Team'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
