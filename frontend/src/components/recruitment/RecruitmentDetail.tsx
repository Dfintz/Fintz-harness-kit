import { LoadingSpinner } from '@/components/LoadingSpinner';
import { RecruitmentApplyDialog } from '@/components/recruitment/RecruitmentApplyDialog';
import { ConfirmDialog, useConfirmDialog } from '@/components/ui/ConfirmDialog';
import {
  useDeleteRecruitment,
  useRecruitments,
  useUpdateRecruitment,
  useUpdateRecruitmentStatus,
} from '@/hooks/queries/useRecruitmentQueries';
import { RECRUITMENT_TAGS, getTagChipColor, getTagLabel } from '@/services/recruitmentService';
import { useAuthStore } from '@/store/authStore';
import { useNotification } from '@/store/uiStore';
import { sanitizeImageUrl } from '@/utils/sanitize';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import MDEditor from '@uiw/react-md-editor';
import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

function getStatusChipColor(status: string): 'success' | 'warning' | 'error' {
  if (status === 'open') return 'success';
  if (status === 'paused') return 'warning';
  return 'error';
}

export const RecruitmentDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const theme = useTheme();
  const { user } = useAuthStore();
  const notification = useNotification();
  const { data: recruitments = [], isLoading } = useRecruitments();
  const deleteRecruitment = useDeleteRecruitment();
  const updateRecruitment = useUpdateRecruitment();
  const updateStatus = useUpdateRecruitmentStatus();

  const [applyDialogOpen, setApplyDialogOpen] = useState(false);

  const [appliedIds, setAppliedIds] = useState<Set<string>>(new Set());
  const [showEditForm, setShowEditForm] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [bannerError, setBannerError] = useState(false);
  const [previewBannerError, setPreviewBannerError] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    rolesNeeded: '',
    maxPositions: '',
    requirements: '',
    expiresAt: '',
    bannerImageUrl: '',
    tags: [] as string[],
  });

  // Reset banner error when viewing a different recruitment
  useEffect(() => {
    setBannerError(false);
  }, [id]);

  const {
    openDialog: openDeleteConfirm,
    closeDialog: closeDeleteConfirm,
    pendingData: pendingDeleteId,
    dialogProps: deleteDialogProps,
  } = useConfirmDialog<string>();

  const recruitment = recruitments.find(r => r.id === id);

  if (isLoading) {
    return <LoadingSpinner message="Loading recruitment..." />;
  }

  if (!recruitment) {
    return (
      <Box sx={{ maxWidth: 900, mx: 'auto', p: { xs: 2, sm: 3 } }}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate('/recruitment')}
          sx={{ mb: 2 }}
        >
          Back to Recruitments
        </Button>
        <Alert severity="warning">Recruitment post not found.</Alert>
      </Box>
    );
  }

  const handleDeleteClick = () => {
    openDeleteConfirm(recruitment.id);
  };

  const handleDeleteConfirm = async () => {
    const deleteId = pendingDeleteId;
    closeDeleteConfirm();
    if (!deleteId) return;
    try {
      await deleteRecruitment.mutateAsync(deleteId);
      navigate('/recruitment');
    } catch {
      notification.error('Failed to delete recruitment');
    }
  };

  const handleStatusUpdate = async (status: 'open' | 'closed' | 'paused') => {
    try {
      await updateStatus.mutateAsync({ id: recruitment.id, status });
    } catch {
      notification.error('Failed to update status');
    }
  };

  const handleApply = () => {
    // If Discord recruitment is enabled with an invite URL, redirect to Discord
    if (recruitment.discordRecruitmentEnabled && recruitment.discordInviteUrl) {
      const url = recruitment.discordInviteUrl;
      if (url.startsWith('https://discord.gg/') || url.startsWith('https://discord.com/')) {
        window.open(url, '_blank', 'noopener,noreferrer');
        return;
      }
    }
    setApplyDialogOpen(true);
  };

  const handleApplySuccess = () => {
    setAppliedIds(prev => new Set(prev).add(recruitment.id));
  };

  const handleEdit = () => {
    setFormData({
      title: recruitment.title,
      description: recruitment.description,
      rolesNeeded: (recruitment.rolesNeeded ?? []).join(', '),
      maxPositions: recruitment.maxPositions?.toString() || '',
      requirements: recruitment.requirements || '',
      expiresAt: recruitment.expiresAt
        ? new Date(recruitment.expiresAt).toISOString().slice(0, 16)
        : '',
      bannerImageUrl: recruitment.bannerImageUrl || '',
      tags: recruitment.tags ?? [],
    });
    setShowEditForm(true);
  };

  const handleTagToggle = (tagValue: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.includes(tagValue)
        ? prev.tags.filter(t => t !== tagValue)
        : [...prev.tags, tagValue],
    }));
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.description.trim()) {
      notification.error('Description is required');
      return;
    }

    try {
      await updateRecruitment.mutateAsync({
        id: recruitment.id,
        data: {
          title: formData.title,
          description: formData.description,
          rolesNeeded: formData.rolesNeeded.split(',').map(r => r.trim()),
          maxPositions: formData.maxPositions ? Number.parseInt(formData.maxPositions) : undefined,
          requirements: formData.requirements || undefined,
          expiresAt: formData.expiresAt || undefined,
          bannerImageUrl: formData.bannerImageUrl || null,
          tags: formData.tags.length > 0 ? formData.tags : undefined,
        },
      });
      setShowEditForm(false);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      notification.error(message || 'Failed to save recruitment');
    }
  };

  const isOwner = user?.activeOrgId === recruitment.organizationId;
  const isMember = !!user?.activeOrgId && user.activeOrgId === recruitment.organizationId;
  const hasApplied = recruitment.hasApplied || appliedIds.has(recruitment.id);

  let applyButtonColor: 'info' | 'inherit' | 'success' = 'success';
  let applyButtonLabel = 'Apply';
  const isDiscordRedirect = recruitment.discordRecruitmentEnabled && !!recruitment.discordInviteUrl;
  if (isMember) {
    applyButtonColor = 'info';
    applyButtonLabel = 'Member';
  } else if (hasApplied) {
    applyButtonColor = 'inherit';
    applyButtonLabel = 'Applied';
  } else if (isDiscordRedirect) {
    applyButtonLabel = 'Apply via Discord';
  }

  return (
    <Box sx={{ maxWidth: 900, mx: 'auto', p: { xs: 2, sm: 3 } }}>
      <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/recruitment')} sx={{ mb: 2 }}>
        Back to Recruitments
      </Button>

      <Box
        sx={{
          bgcolor: 'background.paper',
          borderRadius: 2,
          border: '1px solid',
          borderColor: 'divider',
          overflow: 'hidden',
        }}
      >
        {/* Banner Image */}
        {recruitment.bannerImageUrl && !bannerError && (
          <Box sx={{ width: '100%', height: { xs: 140, sm: 200 }, overflow: 'hidden' }}>
            <Box
              component="img"
              src={sanitizeImageUrl(recruitment.bannerImageUrl)}
              alt={`${recruitment.title} banner`}
              sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
              onError={() => setBannerError(true)}
            />
          </Box>
        )}

        <Box sx={{ p: 3 }}>
          {/* Header */}
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="flex-start"
            sx={{ mb: 1.5 }}
          >
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Avatar
                src={sanitizeImageUrl(recruitment.organizationLogoUrl)}
                alt={recruitment.organizationName || 'Organization'}
                sx={{ width: 48, height: 48, bgcolor: 'primary.dark' }}
              >
                {(recruitment.organizationName || 'O')[0]}
              </Avatar>
              <Box>
                <Typography variant="h5" sx={{ color: 'primary.main', mb: 0.5 }}>
                  {recruitment.title}
                </Typography>
                <Stack direction="row" spacing={1} alignItems="center">
                  {recruitment.organizationName && (
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                      {recruitment.organizationName}
                    </Typography>
                  )}
                  <Chip
                    label={recruitment.status}
                    size="small"
                    color={getStatusChipColor(recruitment.status)}
                    sx={{ textTransform: 'capitalize' }}
                  />
                </Stack>
              </Box>
            </Stack>

            {/* Owner actions */}
            {isOwner && (
              <Stack direction="row" spacing={1}>
                <Button size="small" variant="outlined" onClick={handleEdit}>
                  Edit
                </Button>
                <Button size="small" variant="outlined" color="error" onClick={handleDeleteClick}>
                  Delete
                </Button>
              </Stack>
            )}
          </Stack>

          {/* Description */}
          <Box
            data-color-mode={theme.palette.mode}
            sx={{
              mb: 2,
              '& .wmde-markdown': {
                backgroundColor: 'transparent',
                color: theme.palette.text.secondary,
                fontSize: '0.875rem',
              },
            }}
          >
            <MDEditor.Markdown source={recruitment.description} />
          </Box>

          {/* Roles Needed */}
          {(recruitment.rolesNeeded ?? []).length > 0 && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                Roles Needed
              </Typography>
              <Stack direction="row" spacing={0.5} flexWrap="wrap" sx={{ gap: 0.5 }}>
                {(recruitment.rolesNeeded ?? []).map(role => (
                  <Chip key={role} label={role} size="small" color="primary" />
                ))}
              </Stack>
            </Box>
          )}

          {/* Tags */}
          {(recruitment.tags ?? []).length > 0 && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                Tags
              </Typography>
              <Stack direction="row" spacing={0.5} flexWrap="wrap" sx={{ gap: 0.5 }}>
                {(recruitment.tags ?? []).map(tag => (
                  <Chip
                    key={tag}
                    label={getTagLabel(tag)}
                    size="small"
                    variant="outlined"
                    color={getTagChipColor(tag)}
                  />
                ))}
              </Stack>
            </Box>
          )}

          {/* Requirements */}
          {recruitment.requirements && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2">Requirements</Typography>
              <Box
                data-color-mode={theme.palette.mode}
                sx={{
                  '& .wmde-markdown': {
                    backgroundColor: 'transparent',
                    color: theme.palette.text.secondary,
                    fontSize: '0.875rem',
                  },
                }}
              >
                <MDEditor.Markdown source={recruitment.requirements} />
              </Box>
            </Box>
          )}

          {/* Footer: applicants + actions */}
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
            sx={{ mt: 2, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}
          >
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              Applicants: {recruitment.currentApplicants ?? 0}
              {recruitment.maxPositions && ` / ${recruitment.maxPositions}`}
              {recruitment.expiresAt &&
                ` · Expires: ${new Date(recruitment.expiresAt).toLocaleDateString()}`}
            </Typography>

            <Stack direction="row" spacing={1}>
              {recruitment.status === 'open' && (
                <Button
                  size="small"
                  variant="contained"
                  color={applyButtonColor}
                  onClick={handleApply}
                  disabled={isMember || hasApplied}
                >
                  {applyButtonLabel}
                </Button>
              )}
              {isOwner && recruitment.status === 'open' && (
                <>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => handleStatusUpdate('paused')}
                  >
                    Pause
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => handleStatusUpdate('closed')}
                  >
                    Close
                  </Button>
                </>
              )}
              {isOwner && (recruitment.status === 'paused' || recruitment.status === 'closed') && (
                <Button
                  size="small"
                  variant="contained"
                  color="success"
                  onClick={() => handleStatusUpdate('open')}
                >
                  Reopen
                </Button>
              )}
            </Stack>
          </Stack>
        </Box>
      </Box>

      <ConfirmDialog
        {...deleteDialogProps}
        title="Delete Recruitment"
        message="Are you sure you want to delete this recruitment?"
        confirmLabel="Delete"
        confirmColor="error"
        onConfirm={handleDeleteConfirm}
      />

      {/* Edit Dialog */}
      <Dialog open={showEditForm} onClose={() => setShowEditForm(false)} maxWidth="md" fullWidth>
        <DialogTitle>Edit Recruitment</DialogTitle>
        <DialogContent>
          <form
            id="recruitment-edit-form"
            onSubmit={e => {
              e.preventDefault();
              void handleEditSubmit(e);
            }}
          >
            <Stack direction="column" spacing={2} sx={{ mt: 2 }}>
              <TextField
                label="Title"
                value={formData.title}
                onChange={e => setFormData({ ...formData, title: e.target.value })}
                required
                autoFocus
                fullWidth
              />
              <Box>
                <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                  Description *
                </Typography>
                <Box data-color-mode={theme.palette.mode}>
                  <MDEditor
                    value={formData.description}
                    onChange={val => setFormData({ ...formData, description: val || '' })}
                    height={250}
                    preview="edit"
                  />
                </Box>
              </Box>
              <TextField
                label="Roles Needed (comma-separated)"
                value={formData.rolesNeeded}
                onChange={e => setFormData({ ...formData, rolesNeeded: e.target.value })}
                placeholder="pilot, engineer, gunner, medic"
                required
                fullWidth
              />
              <TextField
                label="Max Positions"
                type="number"
                value={formData.maxPositions}
                onChange={e => setFormData({ ...formData, maxPositions: e.target.value })}
                fullWidth
              />
              <Box>
                <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                  Requirements
                </Typography>
                <Box data-color-mode={theme.palette.mode}>
                  <MDEditor
                    value={formData.requirements}
                    onChange={val => setFormData({ ...formData, requirements: val || '' })}
                    height={180}
                    preview="edit"
                  />
                </Box>
              </Box>
              <Box>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                  <Button
                    component="label"
                    variant="outlined"
                    size="small"
                    startIcon={
                      uploadingBanner ? <CircularProgress size={16} /> : <CloudUploadIcon />
                    }
                    disabled={uploadingBanner}
                  >
                    {uploadingBanner ? 'Uploading...' : 'Upload Banner'}
                    <input
                      type="file"
                      hidden
                      accept="image/png,image/jpeg,image/webp"
                      onChange={async e => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        if (file.size > 5 * 1024 * 1024) {
                          notification.error('Banner image must be under 5 MB');
                          e.target.value = '';
                          return;
                        }
                        try {
                          setUploadingBanner(true);
                          const { apiClient } = await import('@/services/apiClient');
                          const fd = new FormData();
                          fd.append('image', file);
                          const res = await apiClient.postRaw<{ url: string }>(
                            '/api/v2/images/upload?resize=large',
                            fd
                          );
                          if (res.url) {
                            setFormData(prev => ({ ...prev, bannerImageUrl: res.url }));
                          }
                        } catch (err: unknown) {
                          const msg = err instanceof Error ? err.message : 'Unknown error';
                          notification.error(`Failed to upload banner image: ${msg}`);
                        } finally {
                          setUploadingBanner(false);
                          e.target.value = '';
                        }
                      }}
                    />
                  </Button>
                  <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                    or paste a URL below
                  </Typography>
                </Stack>
                <TextField
                  label="Banner Image URL"
                  value={formData.bannerImageUrl}
                  onChange={e => {
                    setFormData({ ...formData, bannerImageUrl: e.target.value });
                    setPreviewBannerError(false);
                  }}
                  placeholder="https://example.com/banner.jpg"
                  fullWidth
                  helperText="Upload an image or paste a permanent URL (Discord links expire)"
                />
              </Box>
              {formData.bannerImageUrl && !previewBannerError && (
                <Box
                  component="img"
                  src={sanitizeImageUrl(formData.bannerImageUrl)}
                  alt="Banner preview"
                  sx={{
                    width: '100%',
                    height: 120,
                    objectFit: 'cover',
                    borderRadius: 1,
                    border: '1px solid',
                    borderColor: 'divider',
                    display: 'block',
                  }}
                  onError={() => setPreviewBannerError(true)}
                />
              )}
              {/* Tags */}
              <Box>
                <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                  Tags
                </Typography>
                <Stack direction="row" spacing={0.5} flexWrap="wrap" sx={{ gap: 0.5 }}>
                  {RECRUITMENT_TAGS.map(tag => (
                    <Chip
                      key={tag.value}
                      label={tag.label}
                      size="small"
                      color={formData.tags.includes(tag.value) ? 'primary' : 'default'}
                      variant={formData.tags.includes(tag.value) ? 'filled' : 'outlined'}
                      onClick={() => handleTagToggle(tag.value)}
                      sx={{ cursor: 'pointer' }}
                    />
                  ))}
                </Stack>
                <Typography variant="caption" sx={{ color: 'text.secondary', mt: 0.5 }}>
                  Select tags to help applicants find your posting
                </Typography>
              </Box>

              <TextField
                label="Expires At"
                type="datetime-local"
                value={formData.expiresAt}
                onChange={e => setFormData({ ...formData, expiresAt: e.target.value })}
                fullWidth
                slotProps={{ inputLabel: { shrink: true } }}
              />
            </Stack>
          </form>
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" onClick={() => setShowEditForm(false)}>
            Cancel
          </Button>
          <Button variant="contained" type="submit" form="recruitment-edit-form">
            Update
          </Button>
        </DialogActions>
      </Dialog>

      <RecruitmentApplyDialog
        open={applyDialogOpen}
        onClose={() => setApplyDialogOpen(false)}
        recruitment={recruitment}
        onSuccess={handleApplySuccess}
      />
    </Box>
  );
};
