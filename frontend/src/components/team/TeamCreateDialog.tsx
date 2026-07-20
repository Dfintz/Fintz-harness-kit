/**
 * TeamCreateDialog — Wave 2.6 Teams/Squads System
 *
 * Dialog for creating a new team within an organization.
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
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
} from '@mui/material';
import type { TeamJoinPolicy, TeamTreeNode, TeamType } from '@sc-fleet-manager/shared-types';
import React, { useState } from 'react';

interface TeamCreateDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: {
    name: string;
    description?: string;
    type: TeamType;
    parentTeamId?: string | null;
    maxMembers: number;
    joinPolicy: TeamJoinPolicy;
    emblem?: string | null;
  }) => void;
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

/** Flatten tree for parent select options */
function flattenTree(
  nodes: TeamTreeNode[],
  depth = 0
): { id: string; name: string; depth: number }[] {
  const result: { id: string; name: string; depth: number }[] = [];
  for (const node of nodes) {
    result.push({ id: node.id, name: node.name, depth });
    if (node.children.length > 0) {
      result.push(...flattenTree(node.children, depth + 1));
    }
  }
  return result;
}

export const TeamCreateDialog: React.FC<TeamCreateDialogProps> = ({
  open,
  onClose,
  onSubmit,
  parentOptions,
  loading,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<TeamType>('squadron');
  const [parentTeamId, setParentTeamId] = useState<string>('');
  const [maxMembers, setMaxMembers] = useState(20);
  const [joinPolicy, setJoinPolicy] = useState<TeamJoinPolicy>('closed');
  const [emblem, setEmblem] = useState<string>('');
  const [uploadingEmblem, setUploadingEmblem] = useState(false);
  const [uploadError, setUploadError] = useState('');

  const flatParents = flattenTree(parentOptions);

  const handleSubmit = () => {
    onSubmit({
      name: name.trim(),
      description: description.trim() || undefined,
      type,
      parentTeamId: parentTeamId || null,
      maxMembers,
      joinPolicy,
      emblem: emblem || null,
    });
    // Reset form
    setName('');
    setDescription('');
    setType('squadron');
    setParentTeamId('');
    setMaxMembers(20);
    setJoinPolicy('closed');
    setEmblem('');
    setUploadError('');
  };

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
      <DialogTitle>Create Team</DialogTitle>
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
          disabled={!name.trim() || loading}
          sx={{ bgcolor: 'primary.main', '&:hover': { bgcolor: 'primary.dark' } }}
        >
          {loading ? 'Creating...' : 'Create Team'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
