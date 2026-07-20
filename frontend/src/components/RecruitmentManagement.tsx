import {
  useCreateRecruitment,
  useRecruitments,
  useUpdateRecruitment,
} from '@/hooks/queries/useRecruitmentQueries';
import { useDebounce } from '@/hooks/useDebounce';
import { RECRUITMENT_TAGS, type RecruitmentFilters } from '@/services/recruitmentService';
import { useAuthStore } from '@/store/authStore';
import { sanitizeImageUrl } from '@/utils/sanitize';
import CampaignIcon from '@mui/icons-material/Campaign';
import ClearIcon from '@mui/icons-material/Clear';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import FilterListIcon from '@mui/icons-material/FilterList';
import GroupIcon from '@mui/icons-material/Group';
import SearchIcon from '@mui/icons-material/Search';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  Grid,
  IconButton,
  InputAdornment,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import MDEditor from '@uiw/react-md-editor';
import React, { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ErrorMessage } from './ErrorMessage';
import { LoadingSpinner } from './LoadingSpinner';
import { RecruitmentApplicantsPanel } from './recruitment/RecruitmentApplicantsPanel';
import { RecruitmentCard } from './recruitment/RecruitmentCard';

export const RecruitmentManagement: React.FC = () => {
  const { user } = useAuthStore();
  const theme = useTheme();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Tab state — driven by URL ?tab= param
  const tabParam = searchParams.get('tab');
  const activeTab = tabParam === 'applicants' ? 1 : 0;
  const setActiveTab = (index: number) => {
    if (index === 1) {
      setSearchParams({ tab: 'applicants' }, { replace: true });
    } else {
      searchParams.delete('tab');
      setSearchParams(searchParams, { replace: true });
    }
  };

  // Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [tagFilters, setTagFilters] = useState<string[]>([]);
  const [hasOpenSlots, setHasOpenSlots] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const debouncedSearch = useDebounce(searchTerm, 400);

  const filters = useMemo<RecruitmentFilters>(() => {
    const f: RecruitmentFilters = {};
    if (debouncedSearch.trim()) f.searchTerm = debouncedSearch.trim();
    if (statusFilter) f.status = statusFilter;
    if (tagFilters.length > 0) f.tags = tagFilters;
    if (hasOpenSlots) f.hasOpenSlots = true;
    return f;
  }, [debouncedSearch, statusFilter, tagFilters, hasOpenSlots]);

  const hasActiveFilters = !!(searchTerm || statusFilter || tagFilters.length || hasOpenSlots);
  const expandedFilterCount = tagFilters.length + (hasOpenSlots ? 1 : 0);

  const clearFilters = () => {
    setSearchTerm('');
    setStatusFilter('');
    setTagFilters([]);
    setHasOpenSlots(false);
  };

  const {
    data: recruitments = [],
    isLoading,
    error: queryError,
  } = useRecruitments(Object.keys(filters).length > 0 ? filters : undefined);
  const createRecruitment = useCreateRecruitment();
  const updateRecruitment = useUpdateRecruitment();

  const [mutationError, setMutationError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [previewBannerError, setPreviewBannerError] = useState(false);
  const [formData, setFormData] = useState({
    organizationId: user?.activeOrgId || '',
    title: '',
    description: '',
    rolesNeeded: '',
    maxPositions: '',
    requirements: '',
    expiresAt: '',
    bannerImageUrl: '',
    tags: [] as string[],
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMutationError('');

    if (!formData.description.trim()) {
      setMutationError('Description is required');
      return;
    }

    const recruitmentData = {
      organizationId: formData.organizationId,
      title: formData.title,
      description: formData.description,
      rolesNeeded: formData.rolesNeeded.split(',').map(r => r.trim()),
      maxPositions: formData.maxPositions ? Number.parseInt(formData.maxPositions) : undefined,
      requirements: formData.requirements || undefined,
      expiresAt: formData.expiresAt || undefined,
      bannerImageUrl: formData.bannerImageUrl || undefined,
      tags: formData.tags.length > 0 ? formData.tags : undefined,
    };

    try {
      if (editingId) {
        await updateRecruitment.mutateAsync({ id: editingId, data: recruitmentData });
      } else {
        await createRecruitment.mutateAsync(
          recruitmentData as Parameters<typeof createRecruitment.mutateAsync>[0]
        );
      }
      setShowForm(false);
      setEditingId(null);
      resetForm();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setMutationError(message || 'Failed to save recruitment');
    }
  };

  const handleTagToggle = (tagValue: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.includes(tagValue)
        ? prev.tags.filter(t => t !== tagValue)
        : [...prev.tags, tagValue],
    }));
  };

  const handleFilterTagToggle = (tagValue: string) => {
    setTagFilters(prev =>
      prev.includes(tagValue) ? prev.filter(t => t !== tagValue) : [...prev, tagValue]
    );
  };

  const handleCardClick = (id: string) => {
    navigate(`/recruitment/${id}`);
  };

  const resetForm = () => {
    setPreviewBannerError(false);
    setFormData({
      organizationId: user?.activeOrgId || '',
      title: '',
      description: '',
      rolesNeeded: '',
      maxPositions: '',
      requirements: '',
      expiresAt: '',
      bannerImageUrl: '',
      tags: [],
    });
  };

  if (isLoading) {
    return <LoadingSpinner message="Loading recruitments..." />;
  }

  const error = queryError ? 'Failed to fetch recruitments' : mutationError;
  const orgId = user?.activeOrgId;

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto', p: { xs: 2, sm: 3 } }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 'bold', color: 'text.primary' }}>
          Recruitment
        </Typography>
      </Stack>

      {!orgId && (
        <Alert severity="info" sx={{ mb: 3 }}>
          You must be a member of an organization to manage recruitment. Join or create an
          organization first.
        </Alert>
      )}

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs
          value={activeTab}
          onChange={(_e, newValue: number) => setActiveTab(newValue)}
          aria-label="Recruitment tabs"
          sx={{
            '& .MuiTab-root': { textTransform: 'none', minHeight: 48, fontWeight: 500 },
            '& .Mui-selected': { color: 'primary.main' },
            '& .MuiTabs-indicator': { backgroundColor: 'primary.main' },
          }}
        >
          <Tab
            icon={<CampaignIcon />}
            iconPosition="start"
            label="Recruitment Posts"
            id="recruitment-tab-0"
            aria-controls="recruitment-tabpanel-0"
          />
          <Tab
            icon={<GroupIcon />}
            iconPosition="start"
            label="Applicants"
            id="recruitment-tab-1"
            aria-controls="recruitment-tabpanel-1"
            disabled={!orgId}
          />
        </Tabs>
      </Box>

      {/* Recruitment Posts Tab */}
      <Box
        role="tabpanel"
        hidden={activeTab !== 0}
        id="recruitment-tabpanel-0"
        aria-labelledby="recruitment-tab-0"
      >
        {activeTab === 0 && (
          <>
            <Stack direction="row" justifyContent="flex-end" sx={{ mb: 2 }}>
              <Button
                variant="contained"
                disabled={!orgId}
                onClick={() => {
                  setEditingId(null);
                  resetForm();
                  setShowForm(true);
                }}
              >
                New Recruitment
              </Button>
            </Stack>

            {/* Filters */}
            <Box sx={{ mb: 2 }}>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                <TextField
                  size="small"
                  placeholder="Search recruitments..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  sx={{ flexGrow: 1, maxWidth: 400 }}
                  slotProps={{
                    input: {
                      startAdornment: (
                        <InputAdornment position="start">
                          <SearchIcon fontSize="small" />
                        </InputAdornment>
                      ),
                    },
                  }}
                />
                <FormControl size="small" sx={{ minWidth: 120 }}>
                  <InputLabel>Status</InputLabel>
                  <Select
                    value={statusFilter}
                    label="Status"
                    onChange={e => setStatusFilter(e.target.value)}
                  >
                    <MenuItem value="">All</MenuItem>
                    <MenuItem value="open">Open</MenuItem>
                    <MenuItem value="paused">Paused</MenuItem>
                    <MenuItem value="closed">Closed</MenuItem>
                  </Select>
                </FormControl>
                <Button
                  size="small"
                  variant={showFilters ? 'contained' : 'outlined'}
                  startIcon={<FilterListIcon />}
                  onClick={() => setShowFilters(prev => !prev)}
                  color={hasActiveFilters ? 'primary' : 'inherit'}
                >
                  Filters{expandedFilterCount > 0 ? ` (${expandedFilterCount})` : ''}
                </Button>
                {hasActiveFilters && (
                  <IconButton size="small" onClick={clearFilters} title="Clear filters">
                    <ClearIcon fontSize="small" />
                  </IconButton>
                )}
              </Stack>

              <Collapse in={showFilters}>
                <Box
                  sx={{
                    p: 2,
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 1,
                    bgcolor: 'background.paper',
                  }}
                >
                  <Stack spacing={1.5}>
                    <Box>
                      <Stack direction="row" alignItems="center" justifyContent="space-between">
                        <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                          Tags
                        </Typography>
                        <Chip
                          label={hasOpenSlots ? 'Has Open Slots' : 'Any Slots'}
                          size="small"
                          color={hasOpenSlots ? 'primary' : 'default'}
                          variant={hasOpenSlots ? 'filled' : 'outlined'}
                          onClick={() => setHasOpenSlots(prev => !prev)}
                          sx={{ cursor: 'pointer' }}
                        />
                      </Stack>
                      <Stack direction="row" spacing={0.5} flexWrap="wrap" sx={{ gap: 0.5 }}>
                        {RECRUITMENT_TAGS.map(tag => (
                          <Chip
                            key={tag.value}
                            label={tag.label}
                            size="small"
                            color={tagFilters.includes(tag.value) ? 'primary' : 'default'}
                            variant={tagFilters.includes(tag.value) ? 'filled' : 'outlined'}
                            onClick={() => handleFilterTagToggle(tag.value)}
                            sx={{ cursor: 'pointer' }}
                          />
                        ))}
                      </Stack>
                    </Box>
                  </Stack>
                </Box>
              </Collapse>
            </Box>

            {error && <ErrorMessage message={error} onDismiss={() => setMutationError('')} />}

            {recruitments.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <Typography color="text.secondary">
                  No recruitment postings yet. Create your first one above!
                </Typography>
              </Box>
            ) : (
              <Grid container spacing={2}>
                {recruitments.map(recruitment => (
                  <Grid key={recruitment.id} size={{ xs: 12, sm: 6, md: 4 }}>
                    <RecruitmentCard recruitment={recruitment} onClick={handleCardClick} />
                  </Grid>
                ))}
              </Grid>
            )}
          </>
        )}
      </Box>

      {/* Applicants Tab */}
      <Box
        role="tabpanel"
        hidden={activeTab !== 1}
        id="recruitment-tabpanel-1"
        aria-labelledby="recruitment-tab-1"
      >
        {activeTab === 1 && orgId && (
          <Box>
            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
              Review and manage applications submitted to your recruitment posts.
            </Typography>
            <RecruitmentApplicantsPanel organizationId={orgId} />
          </Box>
        )}
      </Box>

      {/* Create/Edit Dialog */}
      <Dialog open={showForm} onClose={() => setShowForm(false)} maxWidth="md" fullWidth>
        <DialogTitle>{editingId ? 'Edit' : 'Create'} Recruitment</DialogTitle>
        <DialogContent>
          <form
            id="recruitment-form"
            onSubmit={e => {
              e.preventDefault();
              void handleSubmit(e);
            }}
          >
            <Stack direction="column" spacing={2} sx={{ mt: 2 }}>
              <TextField
                label="Organization"
                value={user?.activeOrgName || formData.organizationId}
                disabled
                fullWidth
                helperText="Posting for your active organization"
              />
              <TextField
                label="Title"
                value={formData.title}
                onChange={e => setFormData({ ...formData, title: e.target.value })}
                required
                autoFocus
                fullWidth
              />

              {/* Description — Markdown Editor */}
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
                <Typography variant="caption" sx={{ color: 'text.secondary', mt: 0.5 }}>
                  Supports Markdown formatting (bold, italic, lists, links, etc.)
                </Typography>
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

              {/* Requirements — Markdown Editor */}
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
                <Typography variant="caption" sx={{ color: 'text.secondary', mt: 0.5 }}>
                  Supports Markdown formatting
                </Typography>
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
                          setMutationError('Banner image must be under 5 MB');
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
                          setMutationError(`Failed to upload banner image: ${msg}`);
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

              {/* Banner Preview */}
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
          <Button variant="outlined" onClick={() => setShowForm(false)}>
            Cancel
          </Button>
          <Button variant="contained" type="submit" form="recruitment-form">
            {editingId ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

import { FeatureErrorBoundary } from '@/components/FeatureErrorBoundary';

export const RecruitmentManagementWithErrorBoundary: React.FC = () => (
  <FeatureErrorBoundary featureName="Recruitment Management">
    <RecruitmentManagement />
  </FeatureErrorBoundary>
);
