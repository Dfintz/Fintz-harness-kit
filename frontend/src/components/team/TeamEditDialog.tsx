/**
 * TeamEditDialog — Wave 2.6 Teams/Squads System
 *
 * Dialog for editing an existing team's properties (name, description, type, etc.).
 */

import { sanitizeImageUrl } from '@/utils/sanitize';
import ClearIcon from '@mui/icons-material/Clear';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import GroupsIcon from '@mui/icons-material/Groups';
import {
  Alert,
  Avatar,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import type {
  TeamJoinPolicy,
  TeamTreeNode,
  TeamType,
  UpdateTeamRequest,
} from '@sc-fleet-manager/shared-types';
import React, { useEffect, useState } from 'react';

interface TeamEditDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: UpdateTeamRequest) => void;
  /** The team being edited */
  team: TeamTreeNode;
  /** Full tree (excluding the team itself) for parent selection */
  parentOptions: TeamTreeNode[];
  loading?: boolean;
}

const TEAM_TYPES: { value: TeamType; label: string }[] = [
  { value: 'squadron', label: 'Squadron' },
  { value: 'division', label: 'Division' },
  { value: 'crew', label: 'Crew' },
  { value: 'platoon', label: 'Platoon' },
  { value: 'custom', label: 'Custom' },
];

/** Flatten tree for parent select options, excluding a given team and its descendants */
function flattenTree(
  nodes: TeamTreeNode[],
  excludeId: string,
  depth = 0
): { id: string; name: string; depth: number }[] {
  const result: { id: string; name: string; depth: number }[] = [];
  for (const node of nodes) {
    if (node.id === excludeId) continue;
    result.push({ id: node.id, name: node.name, depth });
    if (node.children.length > 0) {
      result.push(...flattenTree(node.children, excludeId, depth + 1));
    }
  }
  return result;
}

export const TeamEditDialog: React.FC<TeamEditDialogProps> = ({
  open,
  onClose,
  onSubmit,
  team,
  parentOptions,
  loading,
}) => {
  const [name, setName] = useState(team.name);
  const [description, setDescription] = useState(team.description || '');
  const [type, setType] = useState<TeamType>(team.type);
  const [parentTeamId, setParentTeamId] = useState<string>(team.parentTeamId || '');
  const [maxMembers, setMaxMembers] = useState(team.maxMembers);
  const [isActive, setIsActive] = useState(team.isActive);
  const [joinPolicy, setJoinPolicy] = useState<TeamJoinPolicy>(team.joinPolicy ?? 'closed');
  const [emblem, setEmblem] = useState<string>(team.emblem || '');
  const [uploadingEmblem, setUploadingEmblem] = useState(false);
  const [uploadError, setUploadError] = useState('');

  // Sync state when the team prop changes (e.g. selecting a different team)
  useEffect(() => {
    setName(team.name);
    setDescription(team.description || '');
    setType(team.type);
    setParentTeamId(team.parentTeamId || '');
    setMaxMembers(team.maxMembers);
    setIsActive(team.isActive);
    setJoinPolicy(team.joinPolicy ?? 'closed');
    setEmblem(team.emblem || '');
    setUploadError('');
  }, [team]);

  const flatParents = flattenTree(parentOptions, team.id);

  const handleSubmit = () => {
    const updates: UpdateTeamRequest = {};

    if (name.trim() !== team.name) updates.name = name.trim();
    if ((description.trim() || undefined) !== (team.description || undefined)) {
      updates.description = description.trim() || undefined;
    }
    if (type !== team.type) updates.type = type;
    if ((parentTeamId || null) !== (team.parentTeamId || null)) {
      updates.parentTeamId = parentTeamId || null;
    }
    if (maxMembers !== team.maxMembers) updates.maxMembers = maxMembers;
    if (isActive !== team.isActive) updates.isActive = isActive;
    if (joinPolicy !== (team.joinPolicy ?? 'closed')) updates.joinPolicy = joinPolicy;
    if ((emblem || null) !== (team.emblem || null)) {
      updates.emblem = emblem || null;
    }

    // Only submit if there are actual changes
    if (Object.keys(updates).length > 0) {
      onSubmit(updates);
    } else {
      onClose();
    }
  };

  const hasChanges =
    name.trim() !== team.name ||
    (description.trim() || '') !== (team.description || '') ||
    type !== team.type ||
    (parentTeamId || null) !== (team.parentTeamId || null) ||
    maxMembers !== team.maxMembers ||
    isActive !== team.isActive ||
    joinPolicy !== (team.joinPolicy ?? 'closed') ||
    (emblem || '') !== (team.emblem || '');

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          bgcolor: 'var(--card-bg)',
          border: '1px solid var(--card-border)',
        },
      }}
    >
      <DialogTitle>Edit Team</DialogTitle>
      <DialogContent
        sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '8px !important' }}
      >
        <TextField
          label="Team Name"
          value={name}
          onChange={e => setName(e.target.value)}
          required
          fullWidth
          inputProps={{ maxLength: 100 }}
        />

        <TextField
          label="Description"
          value={description}
          onChange={e => setDescription(e.target.value)}
          multiline
          rows={2}
          fullWidth
          inputProps={{ maxLength: 1000 }}
        />

        {/* Emblem upload */}
        <Box>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Emblem
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Avatar
              src={sanitizeImageUrl(emblem) || undefined}
              variant="rounded"
              sx={{ width: 56, height: 56, bgcolor: 'action.hover' }}
            >
              <GroupsIcon />
            </Avatar>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                <Button
                  component="label"
                  variant="outlined"
                  size="small"
                  startIcon={uploadingEmblem ? <CircularProgress size={16} /> : <CloudUploadIcon />}
                  disabled={uploadingEmblem || loading}
                >
                  {uploadingEmblem ? 'Uploading...' : 'Upload'}
                  <input
                    type="file"
                    hidden
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    onChange={async e => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      if (file.size > 5 * 1024 * 1024) {
                        setUploadError('Image must be under 5 MB');
                        e.target.value = '';
                        return;
                      }
                      try {
                        setUploadingEmblem(true);
                        setUploadError('');
                        const { apiClient } = await import('@/services/apiClient');
                        const fd = new FormData();
                        fd.append('image', file);
                        const res = await apiClient.postRaw<{ url: string }>(
                          '/api/v2/images/upload?resize=medium',
                          fd
                        );
                        if (res.url) {
                          setEmblem(res.url);
                        }
                      } catch (err: unknown) {
                        const msg = err instanceof Error ? err.message : 'Unknown error';
                        setUploadError(`Upload failed: ${msg}`);
                      } finally {
                        setUploadingEmblem(false);
                        e.target.value = '';
                      }
                    }}
                  />
                </Button>
                {emblem && (
                  <IconButton size="small" onClick={() => setEmblem('')} title="Remove emblem">
                    <ClearIcon fontSize="small" />
                  </IconButton>
                )}
              </Box>
              {uploadError && (
                <Alert severity="error" sx={{ py: 0, px: 1 }}>
                  {uploadError}
                </Alert>
              )}
            </Box>
          </Box>
        </Box>

        <FormControl fullWidth>
          <InputLabel>Type</InputLabel>
          <Select value={type} label="Type" onChange={e => setType(e.target.value as TeamType)}>
            {TEAM_TYPES.map(t => (
              <MenuItem key={t.value} value={t.value}>
                {t.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl fullWidth>
          <InputLabel>Parent Team</InputLabel>
          <Select
            value={parentTeamId}
            label="Parent Team"
            onChange={e => setParentTeamId(e.target.value)}
          >
            <MenuItem value="">
              <em>None (root level)</em>
            </MenuItem>
            {flatParents.map(p => (
              <MenuItem key={p.id} value={p.id}>
                {'—'.repeat(p.depth)} {p.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <TextField
          label="Max Members"
          type="number"
          value={maxMembers}
          onChange={e => setMaxMembers(Math.max(1, parseInt(e.target.value) || 1))}
          fullWidth
          inputProps={{ min: 1, max: 1000 }}
        />

        <FormControlLabel
          control={
            <Switch
              checked={isActive}
              onChange={e => setIsActive(e.target.checked)}
              sx={{
                '& .MuiSwitch-switchBase.Mui-checked': { color: 'primary.main' },
                '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                  backgroundColor: 'primary.main',
                },
              }}
            />
          }
          label="Active"
        />

        <FormControl fullWidth>
          <InputLabel>Join Policy</InputLabel>
          <Select
            value={joinPolicy}
            label="Join Policy"
            onChange={e => setJoinPolicy(e.target.value as TeamJoinPolicy)}
          >
            <MenuItem value="open">Open — anyone can join</MenuItem>
            <MenuItem value="closed">Closed — requires approval</MenuItem>
          </Select>
        </FormControl>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} color="inherit">
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={!name.trim() || !hasChanges || loading}
          sx={{ bgcolor: 'primary.main', '&:hover': { bgcolor: 'primary.dark' } }}
        >
          {loading ? 'Saving...' : 'Save Changes'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
