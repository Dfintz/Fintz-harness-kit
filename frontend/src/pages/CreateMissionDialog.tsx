/**
 * CreateMissionDialog (Operations)
 * Modal dialog for creating a new operation with multi-stage objectives,
 * fleet/team assignment, and form validation.
 *
 * Sprint 1 — Wave 3.1
 */

import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import Autocomplete from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import FormControl from '@mui/material/FormControl';
import IconButton from '@mui/material/IconButton';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import type { SelectChangeEvent } from '@mui/material/Select';
import Select from '@mui/material/Select';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import type {
  CreateMissionRequest,
  MissionDifficulty,
  MissionPriority,
} from '@sc-fleet-manager/shared-types';
import React, { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useFleets } from '@/hooks/queries/useFleetQueries';
import { useCreateMission } from '@/hooks/queries/useMissionQueries';
import { useTeams } from '@/hooks/queries/useTeamQueries';
import { useAuthStore } from '@/store/authStore';
import { useNotification } from '@/store/uiStore';
import { logger } from '@/utils/logger';

interface CreateMissionDialogProps {
  open: boolean;
  onClose: () => void;
}

interface ObjectiveStage {
  id: string;
  title: string;
  description: string;
  order: number;
}

const INITIAL_FORM: CreateMissionRequest = {
  title: '',
  description: '',
  missionType: 'custom',
  difficulty: 'medium',
  priority: 'normal',
  location: '',
  tags: [],
  notes: '',
};

export const CreateMissionDialog: React.FC<Readonly<CreateMissionDialogProps>> = ({
  open,
  onClose,
}) => {
  const navigate = useNavigate();
  const createMission = useCreateMission();
  const user = useAuthStore(state => state.user);
  const orgId = user?.activeOrgId;
  const { data: fleetsData } = useFleets(orgId);
  const { data: teamsData } = useTeams(orgId);
  const fleets = useMemo(() => fleetsData?.items ?? [], [fleetsData]);
  const teams = teamsData ?? [];
  const notification = useNotification();
  const [form, setForm] = useState<CreateMissionRequest>({ ...INITIAL_FORM });
  const [objectives, setObjectives] = useState<ObjectiveStage[]>([]);
  const [assignedFleetId, setAssignedFleetId] = useState('');
  const [assignedTeamId, setAssignedTeamId] = useState('');

  const handleFleetChange = useCallback((_: unknown, fleet: (typeof fleets)[number] | null) => {
    const id = fleet?.id ?? '';
    setAssignedFleetId(id);
    if (fleet?.teamId) {
      setAssignedTeamId(fleet.teamId);
    }
  }, []);

  const handleTeamChange = useCallback(
    (_: unknown, team: (typeof teams)[number] | null) => {
      const id = team?.id ?? '';
      setAssignedTeamId(id);
      if (id) {
        const linkedFleet = fleets.find(f => f.teamId === id);
        if (linkedFleet) {
          setAssignedFleetId(linkedFleet.id);
        }
      }
    },
    [fleets]
  );

  const handleAddObjective = useCallback(() => {
    setObjectives(prev => [
      ...prev,
      { id: crypto.randomUUID(), title: '', description: '', order: prev.length + 1 },
    ]);
  }, []);

  const handleRemoveObjective = useCallback((index: number) => {
    setObjectives(prev =>
      prev.filter((_, i) => i !== index).map((obj, i) => ({ ...obj, order: i + 1 }))
    );
  }, []);

  const handleObjectiveChange = useCallback(
    (index: number, field: keyof ObjectiveStage, value: string) => {
      setObjectives(prev => prev.map((obj, i) => (i === index ? { ...obj, [field]: value } : obj)));
    },
    []
  );

  const handleTextChange = useCallback(
    (field: keyof CreateMissionRequest) =>
      (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setForm(prev => ({ ...prev, [field]: e.target.value }));
      },
    []
  );

  const handleSelectChange = useCallback(
    (field: keyof CreateMissionRequest) => (e: SelectChangeEvent<string>) => {
      setForm(prev => ({ ...prev, [field]: e.target.value }));
    },
    []
  );

  const handleTagsChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const tags = e.target.value
      .split(',')
      .map(t => t.trim())
      .filter(Boolean);
    setForm(prev => ({ ...prev, tags }));
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!form.title.trim()) return;
    try {
      const payload = {
        ...form,
        objectives:
          objectives.length > 0
            ? objectives
                .filter(o => o.title.trim())
                .map(o => ({ title: o.title, description: o.description, completed: false }))
            : undefined,
        fleetId: assignedFleetId || undefined,
        teamId: assignedTeamId || undefined,
      };
      const mission = await createMission.mutateAsync(payload as CreateMissionRequest);
      setForm({ ...INITIAL_FORM });
      setObjectives([]);
      setAssignedFleetId('');
      setAssignedTeamId('');
      onClose();
      navigate(`/missions/${mission.id}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create operation';
      notification.error(message);
      logger.error(
        'Failed to create operation',
        err instanceof Error ? err : new Error(String(err))
      );
    }
  }, [form, objectives, assignedFleetId, assignedTeamId, createMission, onClose, navigate]);

  const handleClose = useCallback(() => {
    setForm({ ...INITIAL_FORM });
    setObjectives([]);
    setAssignedFleetId('');
    setAssignedTeamId('');
    onClose();
  }, [onClose]);

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>Create New Operation</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            label="Operation Title"
            value={form.title}
            onChange={handleTextChange('title')}
            required
            fullWidth
            autoFocus
            placeholder="e.g., Operation Stardust"
          />

          <TextField
            label="Description"
            value={form.description ?? ''}
            onChange={handleTextChange('description')}
            fullWidth
            multiline
            rows={3}
            placeholder="Brief description of the operation..."
          />

          <Stack direction="row" spacing={2}>
            <FormControl fullWidth>
              <InputLabel>Mission Type</InputLabel>
              <Select
                value={form.missionType}
                label="Mission Type"
                onChange={handleSelectChange('missionType')}
              >
                <MenuItem value="combat">Combat</MenuItem>
                <MenuItem value="mining">Mining</MenuItem>
                <MenuItem value="trading">Trading</MenuItem>
                <MenuItem value="exploration">Exploration</MenuItem>
                <MenuItem value="logistics">Logistics</MenuItem>
                <MenuItem value="rescue">Rescue</MenuItem>
                <MenuItem value="reconnaissance">Recon</MenuItem>
                <MenuItem value="escort">Escort</MenuItem>
                <MenuItem value="salvage">Salvage</MenuItem>
                <MenuItem value="custom">Custom</MenuItem>
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel>Difficulty</InputLabel>
              <Select
                value={form.difficulty as MissionDifficulty}
                label="Difficulty"
                onChange={handleSelectChange('difficulty')}
              >
                <MenuItem value="trivial">Trivial</MenuItem>
                <MenuItem value="easy">Easy</MenuItem>
                <MenuItem value="medium">Medium</MenuItem>
                <MenuItem value="hard">Hard</MenuItem>
                <MenuItem value="extreme">Extreme</MenuItem>
              </Select>
            </FormControl>
          </Stack>

          <Stack direction="row" spacing={2}>
            <FormControl fullWidth>
              <InputLabel>Priority</InputLabel>
              <Select
                value={form.priority as MissionPriority}
                label="Priority"
                onChange={handleSelectChange('priority')}
              >
                <MenuItem value="low">Low</MenuItem>
                <MenuItem value="normal">Normal</MenuItem>
                <MenuItem value="high">High</MenuItem>
                <MenuItem value="critical">Critical</MenuItem>
              </Select>
            </FormControl>

            <TextField
              label="Location"
              value={form.location ?? ''}
              onChange={handleTextChange('location')}
              fullWidth
              placeholder="e.g., Stanton, Crusader"
            />
          </Stack>

          <Stack direction="row" spacing={2}>
            <TextField
              label="Start Date"
              type="datetime-local"
              value={form.startDate ?? ''}
              onChange={handleTextChange('startDate')}
              fullWidth
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <TextField
              label="End Date"
              type="datetime-local"
              value={form.endDate ?? ''}
              onChange={handleTextChange('endDate')}
              fullWidth
              slotProps={{ inputLabel: { shrink: true } }}
            />
          </Stack>

          <TextField
            label="Tags"
            value={(form.tags ?? []).join(', ')}
            onChange={handleTagsChange}
            fullWidth
            placeholder="Separate tags with commas"
            helperText="e.g., stealth, high-risk, practice"
          />

          <TextField
            label="Notes"
            value={form.notes ?? ''}
            onChange={handleTextChange('notes')}
            fullWidth
            multiline
            rows={2}
            placeholder="Additional notes for the operation..."
          />

          {/* Multi-Stage Objectives */}
          <Divider />
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              Objectives / Stages
            </Typography>
            <Button size="small" startIcon={<AddIcon />} onClick={handleAddObjective}>
              Add Stage
            </Button>
          </Stack>
          {objectives.length === 0 && (
            <Typography variant="body2" color="text.secondary">
              No objectives added yet. Add multi-stage goals to track progress during the operation.
            </Typography>
          )}
          {objectives.map((obj, idx) => (
            <Box
              key={obj.id}
              sx={{ pl: 1, borderLeft: '3px solid', borderColor: 'primary.main', ml: 1 }}
            >
              <Stack direction="row" spacing={1} alignItems="center">
                <Chip
                  label={`Stage ${obj.order}`}
                  size="small"
                  color="primary"
                  variant="outlined"
                />
                <TextField
                  label="Objective"
                  value={obj.title}
                  onChange={e => handleObjectiveChange(idx, 'title', e.target.value)}
                  fullWidth
                  size="small"
                  placeholder="e.g., Secure landing zone"
                />
                <IconButton size="small" onClick={() => handleRemoveObjective(idx)} color="error">
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Stack>
              <TextField
                label="Stage Description"
                value={obj.description}
                onChange={e => handleObjectiveChange(idx, 'description', e.target.value)}
                fullWidth
                size="small"
                sx={{ mt: 1 }}
                placeholder="Details for this stage..."
              />
            </Box>
          ))}

          {/* Fleet & Team Assignment */}
          <Divider />
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            Assign Fleet / Team
          </Typography>
          <Stack direction="row" spacing={2}>
            <Autocomplete
              options={fleets}
              getOptionLabel={f => f.name}
              value={fleets.find(f => f.id === assignedFleetId) ?? null}
              onChange={handleFleetChange}
              fullWidth
              renderInput={params => (
                <TextField
                  {...params}
                  label="Fleet"
                  placeholder="Select a fleet"
                  helperText="Select a fleet or leave empty"
                />
              )}
              isOptionEqualToValue={(opt, val) => opt.id === val.id}
            />
            <Autocomplete
              options={teams}
              getOptionLabel={t => t.name}
              value={teams.find(t => t.id === assignedTeamId) ?? null}
              onChange={handleTeamChange}
              fullWidth
              renderInput={params => (
                <TextField
                  {...params}
                  label="Team"
                  placeholder="Select a team"
                  helperText="Select a team or leave empty"
                />
              )}
              isOptionEqualToValue={(opt, val) => opt.id === val.id}
            />
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleClose}>Cancel</Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={!form.title.trim() || createMission.isPending}
        >
          {createMission.isPending ? 'Creating...' : 'Create Operation'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
