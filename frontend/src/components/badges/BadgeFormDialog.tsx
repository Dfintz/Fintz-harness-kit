/**
 * Badge Form Dialog
 *
 * Dialog for creating or editing a badge/title.
 * Uses controlled form state with MUI components.
 */

import type {
  Achievement,
  AchievementRarity,
  AchievementType,
  CreateAchievementInput,
  UpdateAchievementInput,
} from '@/services/badgeService';
import { logger } from '@/utils/logger';
import { sanitizeImageUrl } from '@/utils/sanitize';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import DeleteIcon from '@mui/icons-material/Delete';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import FormControl from '@mui/material/FormControl';
import IconButton from '@mui/material/IconButton';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import React, { useCallback, useEffect, useState } from 'react';

interface BadgeFormDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: CreateAchievementInput | UpdateAchievementInput) => void;
  achievement?: Achievement | null;
  isPending?: boolean;
}

const RARITY_OPTIONS: AchievementRarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary'];

const TYPE_OPTIONS: AchievementType[] = ['badge', 'title'];

export const BadgeFormDialog: React.FC<Readonly<BadgeFormDialogProps>> = ({
  open,
  onClose,
  onSubmit,
  achievement,
  isPending,
}) => {
  const [name, setName] = useState('');
  const [type, setType] = useState<AchievementType>('badge');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [rarity, setRarity] = useState<AchievementRarity>('common');
  const [icon, setIcon] = useState('');
  const [uploadingIcon, setUploadingIcon] = useState(false);
  const [uploadError, setUploadError] = useState('');

  const isEdit = !!achievement;

  useEffect(() => {
    if (achievement) {
      setName(achievement.name);
      setType(achievement.type);
      setDescription(achievement.description ?? '');
      setCategory(achievement.category ?? '');
      setRarity(achievement.rarity);
      setIcon(achievement.icon ?? '');
      setUploadError('');
    } else {
      setName('');
      setType('badge');
      setDescription('');
      setCategory('');
      setRarity('common');
      setIcon('');
      setUploadError('');
    }
  }, [achievement, open]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const data: CreateAchievementInput = {
        name: name.trim(),
        type,
        description: description.trim() || undefined,
        category: category.trim() || undefined,
        rarity,
        icon: icon.trim() || (isEdit ? null : undefined),
      };
      onSubmit(data);
    },
    [name, type, description, category, rarity, icon, isEdit, onSubmit]
  );

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <form onSubmit={handleSubmit}>
        <DialogTitle>
          {isEdit ? 'Edit' : 'Create'} {type === 'title' ? 'Title' : 'Badge'}
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <TextField
            autoFocus
            required
            label="Name"
            value={name}
            onChange={e => setName(e.target.value)}
            inputProps={{ maxLength: 200 }}
            fullWidth
            margin="dense"
          />

          <FormControl fullWidth margin="dense">
            <InputLabel>Type</InputLabel>
            <Select
              value={type}
              label="Type"
              onChange={e => setType(e.target.value as AchievementType)}
            >
              {TYPE_OPTIONS.map(t => (
                <MenuItem key={t} value={t}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <TextField
            label="Description"
            value={description}
            onChange={e => setDescription(e.target.value)}
            multiline
            rows={3}
            fullWidth
            margin="dense"
          />

          <TextField
            label="Category"
            value={category}
            onChange={e => setCategory(e.target.value)}
            inputProps={{ maxLength: 50 }}
            fullWidth
            margin="dense"
            placeholder="e.g. leadership, combat, exploration"
          />

          <FormControl fullWidth margin="dense">
            <InputLabel>Rarity</InputLabel>
            <Select
              value={rarity}
              label="Rarity"
              onChange={e => setRarity(e.target.value as AchievementRarity)}
            >
              {RARITY_OPTIONS.map(r => (
                <MenuItem key={r} value={r}>
                  {r.charAt(0).toUpperCase() + r.slice(1)}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Icon
            </Typography>
            <Stack direction="row" spacing={2} alignItems="center">
              {icon ? (
                <Box sx={{ position: 'relative' }}>
                  <Avatar
                    src={sanitizeImageUrl(icon)}
                    alt="Badge icon"
                    variant="rounded"
                    sx={{ width: 56, height: 56 }}
                  />
                  <IconButton
                    size="small"
                    onClick={() => setIcon('')}
                    sx={{
                      position: 'absolute',
                      top: -8,
                      right: -8,
                      bgcolor: 'background.paper',
                      '&:hover': { bgcolor: 'error.dark' },
                    }}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Box>
              ) : (
                <Avatar variant="rounded" sx={{ width: 56, height: 56, bgcolor: 'action.hover' }}>
                  ?
                </Avatar>
              )}
              <Stack spacing={0.5}>
                <Button
                  component="label"
                  variant="outlined"
                  size="small"
                  startIcon={uploadingIcon ? <CircularProgress size={16} /> : <CloudUploadIcon />}
                  disabled={uploadingIcon || isPending}
                >
                  {uploadingIcon ? 'Uploading...' : 'Upload Icon'}
                  <input
                    type="file"
                    hidden
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    onChange={async e => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      if (file.size > 5 * 1024 * 1024) {
                        setUploadError('Icon image must be under 5 MB');
                        e.target.value = '';
                        return;
                      }
                      try {
                        setUploadingIcon(true);
                        setUploadError('');
                        const { apiClient } = await import('@/services/apiClient');
                        const fd = new FormData();
                        fd.append('image', file);
                        const res = await apiClient.postRaw<{ url: string }>(
                          '/api/v2/images/upload?resize=medium',
                          fd
                        );
                        if (res.url) {
                          setIcon(res.url);
                        }
                      } catch (err: unknown) {
                        const msg = err instanceof Error ? err.message : 'Unknown error';
                        setUploadError(`Failed to upload icon: ${msg}`);
                        logger.error(
                          'Badge icon upload failed',
                          err instanceof Error ? err : new Error(String(err))
                        );
                      } finally {
                        setUploadingIcon(false);
                        e.target.value = '';
                      }
                    }}
                  />
                </Button>
                <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                  or paste a URL below
                </Typography>
              </Stack>
            </Stack>
            {uploadError && (
              <Typography variant="caption" color="error" sx={{ mt: 0.5, display: 'block' }}>
                {uploadError}
              </Typography>
            )}
            <TextField
              label="Icon URL"
              value={icon}
              onChange={e => setIcon(e.target.value)}
              fullWidth
              margin="dense"
              size="small"
              placeholder="https://example.com/badge.png"
              type="url"
              sx={{ mt: 1 }}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button type="submit" variant="contained" disabled={!name.trim() || isPending}>
            {isEdit ? 'Save' : 'Create'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};
