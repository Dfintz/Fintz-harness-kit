/**
 * Badge Management List
 *
 * Main management component for org badges/titles.
 * Supports CRUD operations, awarding, and filtering.
 */

import { ConfirmDialog, useConfirmDialog } from '@/components/ui/ConfirmDialog';
import {
  useAwardBadge,
  useBadges,
  useCreateBadge,
  useDeleteBadge,
  useUpdateBadge,
} from '@/hooks/queries/useBadgeQueries';
import { isApiClientError } from '@/services/apiClient';
import type {
  Achievement,
  AchievementFilters,
  AchievementRarity,
  AchievementType,
  CreateAchievementInput,
  UpdateAchievementInput,
} from '@/services/badgeService';
import { logger } from '@/utils/logger';
import AddIcon from '@mui/icons-material/Add';
import CardGiftcardIcon from '@mui/icons-material/CardGiftcard';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import PeopleIcon from '@mui/icons-material/People';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import FormControl from '@mui/material/FormControl';
import Grid from '@mui/material/Grid';
import IconButton from '@mui/material/IconButton';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import React, { useCallback, useState } from 'react';
import { AwardBadgeDialog } from './AwardBadgeDialog';
import { BadgeCard } from './BadgeCard';
import { BadgeFormDialog } from './BadgeFormDialog';
import { BadgeRecipientsDialog } from './BadgeRecipientsDialog';

export const BadgeManagementList: React.FC = () => {
  // ── Filters ──
  const [typeFilter, setTypeFilter] = useState<AchievementType | ''>('');
  const [rarityFilter, setRarityFilter] = useState<AchievementRarity | ''>('');
  const [categoryFilter, setCategoryFilter] = useState('');

  const activeFilters: AchievementFilters = {
    ...(typeFilter ? { type: typeFilter } : {}),
    ...(rarityFilter ? { rarity: rarityFilter } : {}),
    ...(categoryFilter ? { category: categoryFilter } : {}),
  };

  // ── Queries & Mutations ──
  const { data: badgeData, isLoading, error } = useBadges(activeFilters);
  const createBadge = useCreateBadge();
  const updateBadge = useUpdateBadge();
  const deleteBadge = useDeleteBadge();
  const awardBadge = useAwardBadge();

  // ── Dialog state ──
  const [formOpen, setFormOpen] = useState(false);
  const [editingBadge, setEditingBadge] = useState<Achievement | null>(null);
  const [awardDialogBadge, setAwardDialogBadge] = useState<Achievement | null>(null);
  const [recipientsBadge, setRecipientsBadge] = useState<Achievement | null>(null);
  const { openDialog, closeDialog, pendingData, dialogProps } = useConfirmDialog<string>();

  // ── Handlers ──
  const handleCreate = useCallback(() => {
    setEditingBadge(null);
    setFormOpen(true);
  }, []);

  const handleEdit = useCallback((achievement: Achievement) => {
    setEditingBadge(achievement);
    setFormOpen(true);
  }, []);

  const handleFormSubmit = useCallback(
    async (data: CreateAchievementInput | UpdateAchievementInput) => {
      try {
        if (editingBadge) {
          await updateBadge.mutateAsync({ id: editingBadge.id, data });
        } else {
          await createBadge.mutateAsync(data as CreateAchievementInput);
        }
        setFormOpen(false);
        setEditingBadge(null);
      } catch (err) {
        logger.error('Failed to save badge', err instanceof Error ? err : new Error(String(err)));
      }
    },
    [editingBadge, createBadge, updateBadge]
  );

  const handleConfirmDelete = useCallback(async () => {
    if (!pendingData) return;
    try {
      await deleteBadge.mutateAsync(pendingData);
      closeDialog();
    } catch (err) {
      logger.error('Failed to delete badge', err instanceof Error ? err : new Error(String(err)));
    }
  }, [pendingData, deleteBadge, closeDialog]);

  const handleAward = useCallback(
    async (userId: string) => {
      if (!awardDialogBadge) return;
      try {
        await awardBadge.mutateAsync({
          achievementId: awardDialogBadge.id,
          userId,
        });
        setAwardDialogBadge(null);
      } catch (err) {
        logger.error('Failed to award badge', err instanceof Error ? err : new Error(String(err)));
      }
    },
    [awardDialogBadge, awardBadge]
  );

  // ── Render ──
  if (isLoading) return <CircularProgress />;
  if (error) {
    if (isApiClientError(error) && error.code === 'FEATURE_DISABLED') {
      return (
        <Alert severity="info">
          Titles &amp; Badges are not enabled for this organization. An administrator can enable
          this feature in the organization settings.
        </Alert>
      );
    }
    return <Alert severity="error">Failed to load badges</Alert>;
  }

  const badges = badgeData?.data ?? [];

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">Custom Titles & Badges</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={handleCreate}>
          Create
        </Button>
      </Box>

      {/* Filters */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel>Type</InputLabel>
          <Select<AchievementType | ''>
            value={typeFilter}
            label="Type"
            onChange={e => setTypeFilter(e.target.value)}
          >
            <MenuItem value="">All</MenuItem>
            <MenuItem value="badge">Badge</MenuItem>
            <MenuItem value="title">Title</MenuItem>
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel>Rarity</InputLabel>
          <Select<AchievementRarity | ''>
            value={rarityFilter}
            label="Rarity"
            onChange={e => setRarityFilter(e.target.value)}
          >
            <MenuItem value="">All</MenuItem>
            <MenuItem value="common">Common</MenuItem>
            <MenuItem value="uncommon">Uncommon</MenuItem>
            <MenuItem value="rare">Rare</MenuItem>
            <MenuItem value="epic">Epic</MenuItem>
            <MenuItem value="legendary">Legendary</MenuItem>
          </Select>
        </FormControl>

        <TextField
          size="small"
          label="Category"
          value={categoryFilter}
          onChange={e => setCategoryFilter(e.target.value)}
          placeholder="Filter by category"
        />
      </Box>

      {/* Badge Grid */}
      {badges.length === 0 ? (
        <Alert severity="info">
          No titles or badges found. Create your first one to get started.
        </Alert>
      ) : (
        <Grid container spacing={2}>
          {badges.map(badge => (
            <Grid size={{ xs: 12, sm: 6, md: 4 }} key={badge.id}>
              <Box sx={{ position: 'relative' }}>
                <BadgeCard achievement={badge} onClick={handleEdit} />
                <Box
                  sx={{
                    position: 'absolute',
                    top: 8,
                    right: 8,
                    display: 'flex',
                    gap: 0.5,
                  }}
                >
                  <Tooltip title="View recipients">
                    <IconButton
                      size="small"
                      onClick={e => {
                        e.stopPropagation();
                        setRecipientsBadge(badge);
                      }}
                    >
                      <PeopleIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Award to member">
                    <IconButton
                      size="small"
                      onClick={e => {
                        e.stopPropagation();
                        setAwardDialogBadge(badge);
                      }}
                    >
                      <CardGiftcardIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Edit">
                    <IconButton
                      size="small"
                      onClick={e => {
                        e.stopPropagation();
                        handleEdit(badge);
                      }}
                    >
                      <EditIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Delete">
                    <IconButton
                      size="small"
                      onClick={e => {
                        e.stopPropagation();
                        openDialog(badge.id);
                      }}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Box>
              </Box>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Pagination Info */}
      {badgeData?.pagination && badgeData.pagination.total > 0 && (
        <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
          Showing {badgeData.data.length} of {badgeData.pagination.total} items
        </Typography>
      )}

      {/* Dialogs */}
      <BadgeFormDialog
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditingBadge(null);
        }}
        onSubmit={handleFormSubmit}
        achievement={editingBadge}
        isPending={createBadge.isPending || updateBadge.isPending}
      />

      <AwardBadgeDialog
        open={!!awardDialogBadge}
        onClose={() => setAwardDialogBadge(null)}
        onAward={handleAward}
        achievement={awardDialogBadge}
        isPending={awardBadge.isPending}
      />

      <BadgeRecipientsDialog
        open={!!recipientsBadge}
        onClose={() => setRecipientsBadge(null)}
        achievement={recipientsBadge}
      />

      <ConfirmDialog
        {...dialogProps}
        title="Delete Badge"
        message="This will permanently delete this badge/title and remove it from all members. This action cannot be undone."
        onConfirm={handleConfirmDelete}
      />
    </Box>
  );
};
