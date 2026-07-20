/**
 * Announcements Page
 *
 * Dashboard for managing organization announcements — create, edit, publish,
 * pin, and track delivery. Mirrors the Discord bot `/announce` command set
 * in a web UI with full CRUD and status tracking.
 *
 * Sprint 26 — Bot vs Web Feature Parity
 */

import { FeatureErrorBoundary } from '@/components/FeatureErrorBoundary';
import { ConfirmDialog, useConfirmDialog } from '@/components/ui/ConfirmDialog';
import {
  useAnnouncements,
  useCreateAnnouncement,
  useDeleteAnnouncement,
  usePublishAnnouncement,
  useToggleAnnouncementPin,
  useUpdateAnnouncement,
  type Announcement,
  type AnnouncementFilters,
  type CreateAnnouncementInput,
} from '@/hooks/queries/useAnnouncementQueries';
import type { AnnouncementEmbedConfig, AnnouncementStatus } from '@/services/announcementService';
import { logger } from '@/utils/logger';
import { sanitizeImageUrl } from '@/utils/sanitize';
import AddIcon from '@mui/icons-material/Add';
import CampaignIcon from '@mui/icons-material/Campaign';
import CancelIcon from '@mui/icons-material/Cancel';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ColorLensIcon from '@mui/icons-material/ColorLens';
import DeleteIcon from '@mui/icons-material/Delete';
import DraftsIcon from '@mui/icons-material/Drafts';
import EditIcon from '@mui/icons-material/Edit';
import ErrorIcon from '@mui/icons-material/Error';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ImageIcon from '@mui/icons-material/Image';
import PersonIcon from '@mui/icons-material/Person';
import PushPinIcon from '@mui/icons-material/PushPin';
import ScheduleIcon from '@mui/icons-material/Schedule';
import SendIcon from '@mui/icons-material/Send';
import TagIcon from '@mui/icons-material/Tag';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  MenuItem,
  Pagination,
  Select,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
  type SelectChangeEvent,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import React, { useCallback, useState } from 'react';

import { useHasMinOrgRole } from '@/store/authStore';

// ============================================================================
// Status helpers
// ============================================================================

const STATUS_CONFIG: Record<
  AnnouncementStatus,
  {
    label: string;
    color: 'default' | 'info' | 'warning' | 'success' | 'error';
    icon: React.ReactElement;
  }
> = {
  draft: { label: 'Draft', color: 'default', icon: <DraftsIcon fontSize="small" /> },
  scheduled: { label: 'Scheduled', color: 'info', icon: <ScheduleIcon fontSize="small" /> },
  sending: { label: 'Sending', color: 'warning', icon: <SendIcon fontSize="small" /> },
  sent: { label: 'Sent', color: 'success', icon: <CheckCircleIcon fontSize="small" /> },
  failed: { label: 'Failed', color: 'error', icon: <ErrorIcon fontSize="small" /> },
  cancelled: { label: 'Cancelled', color: 'default', icon: <CancelIcon fontSize="small" /> },
};

// ============================================================================
// Create/Edit Dialog
// ============================================================================

// ============================================================================
// Helper: Format ISO datetime-local input value
// ============================================================================

function toDatetimeLocalValue(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  // YYYY-MM-DDTHH:MM format for datetime-local input
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ============================================================================
// Embed Preview
// ============================================================================

interface EmbedPreviewProps {
  title: string;
  content: string;
  embedConfig: AnnouncementEmbedConfig;
}

const EmbedPreview: React.FC<Readonly<EmbedPreviewProps>> = ({ title, content, embedConfig }) => {
  const theme = useTheme();
  const accentColor = embedConfig.color || theme.palette.primary.main;

  return (
    <Box
      sx={{
        borderLeft: `4px solid ${accentColor}`,
        backgroundColor: theme.palette.mode === 'dark' ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.04)',
        borderRadius: 1,
        p: 2,
        maxWidth: 500,
      }}
    >
      {embedConfig.authorName && (
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
          {embedConfig.authorIconUrl && (
            <Box
              component="img"
              src={sanitizeImageUrl(embedConfig.authorIconUrl)}
              alt="Author"
              sx={{ width: 24, height: 24, borderRadius: '50%' }}
            />
          )}
          <Typography variant="caption" sx={{ fontWeight: 600 }}>
            {embedConfig.authorName}
          </Typography>
        </Stack>
      )}

      <Typography variant="subtitle1" sx={{ fontWeight: 700, color: accentColor, mb: 0.5 }}>
        {title || 'Untitled'}
      </Typography>
      <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', mb: 1 }}>
        {content || 'No content'}
      </Typography>

      {embedConfig.imageUrl && (
        <Box
          component="img"
          src={sanitizeImageUrl(embedConfig.imageUrl)}
          alt="Embed image"
          sx={{ maxWidth: '100%', borderRadius: 1, mb: 1 }}
        />
      )}

      <Stack direction="row" justifyContent="space-between" alignItems="flex-end">
        {embedConfig.footerText && (
          <Typography variant="caption" color="text.secondary">
            {embedConfig.footerText}
          </Typography>
        )}
        {embedConfig.thumbnailUrl && (
          <Box
            component="img"
            src={sanitizeImageUrl(embedConfig.thumbnailUrl)}
            alt="Thumbnail"
            sx={{ width: 64, height: 64, borderRadius: 1 }}
          />
        )}
      </Stack>
    </Box>
  );
};

// ============================================================================
// Create/Edit Dialog
// ============================================================================

interface AnnouncementFormDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: CreateAnnouncementInput) => void;
  initialData?: Announcement;
  isSubmitting: boolean;
}

const AnnouncementFormDialog: React.FC<AnnouncementFormDialogProps> = ({
  open,
  onClose,
  onSubmit,
  initialData,
  isSubmitting,
}) => {
  const [title, setTitle] = useState(initialData?.title ?? '');
  const [content, setContent] = useState(initialData?.content ?? '');

  // Schedule
  const [enableSchedule, setEnableSchedule] = useState(!!initialData?.scheduledAt);
  const [scheduledAt, setScheduledAt] = useState(toDatetimeLocalValue(initialData?.scheduledAt));

  // Embed config
  const [embedColor, setEmbedColor] = useState(initialData?.embedConfig?.color ?? '');
  const [thumbnailUrl, setThumbnailUrl] = useState(initialData?.embedConfig?.thumbnailUrl ?? '');
  const [imageUrl, setImageUrl] = useState(initialData?.embedConfig?.imageUrl ?? '');
  const [footerText, setFooterText] = useState(initialData?.embedConfig?.footerText ?? '');
  const [footerIconUrl, setFooterIconUrl] = useState(initialData?.embedConfig?.footerIconUrl ?? '');
  const [authorName, setAuthorName] = useState(initialData?.embedConfig?.authorName ?? '');
  const [authorIconUrl, setAuthorIconUrl] = useState(initialData?.embedConfig?.authorIconUrl ?? '');
  const [authorUrl, setAuthorUrl] = useState(initialData?.embedConfig?.authorUrl ?? '');

  const hasEmbedConfig =
    !!embedColor ||
    !!thumbnailUrl ||
    !!imageUrl ||
    !!footerText ||
    !!footerIconUrl ||
    !!authorName ||
    !!authorIconUrl ||
    !!authorUrl;

  const buildEmbedConfig = (): AnnouncementEmbedConfig | undefined => {
    if (!hasEmbedConfig) return undefined;
    const cfg: AnnouncementEmbedConfig = {};
    if (embedColor) cfg.color = embedColor;
    if (thumbnailUrl) cfg.thumbnailUrl = thumbnailUrl;
    if (imageUrl) cfg.imageUrl = imageUrl;
    if (footerText) cfg.footerText = footerText;
    if (footerIconUrl) cfg.footerIconUrl = footerIconUrl;
    if (authorName) cfg.authorName = authorName;
    if (authorIconUrl) cfg.authorIconUrl = authorIconUrl;
    if (authorUrl) cfg.authorUrl = authorUrl;
    return cfg;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;
    const data: CreateAnnouncementInput = {
      title: title.trim(),
      content: content.trim(),
    };
    if (enableSchedule && scheduledAt) {
      data.scheduledAt = new Date(scheduledAt).toISOString();
    }
    const embed = buildEmbedConfig();
    if (embed) data.embedConfig = embed;
    onSubmit(data);
  };

  // Reset when dialog opens with new data
  React.useEffect(() => {
    if (open) {
      setTitle(initialData?.title ?? '');
      setContent(initialData?.content ?? '');
      setEnableSchedule(!!initialData?.scheduledAt);
      setScheduledAt(toDatetimeLocalValue(initialData?.scheduledAt));
      setEmbedColor(initialData?.embedConfig?.color ?? '');
      setThumbnailUrl(initialData?.embedConfig?.thumbnailUrl ?? '');
      setImageUrl(initialData?.embedConfig?.imageUrl ?? '');
      setFooterText(initialData?.embedConfig?.footerText ?? '');
      setFooterIconUrl(initialData?.embedConfig?.footerIconUrl ?? '');
      setAuthorName(initialData?.embedConfig?.authorName ?? '');
      setAuthorIconUrl(initialData?.embedConfig?.authorIconUrl ?? '');
      setAuthorUrl(initialData?.embedConfig?.authorUrl ?? '');
    }
  }, [open, initialData]);

  // Minimum date for scheduler: 5 minutes from now
  const minScheduleDate = toDatetimeLocalValue(new Date(Date.now() + 5 * 60 * 1000).toISOString());

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <form onSubmit={handleSubmit}>
        <DialogTitle>{initialData ? 'Edit Announcement' : 'Create Announcement'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2.5} sx={{ mt: 1 }}>
            {/* ── Basic fields ── */}
            <TextField
              label="Title"
              value={title}
              onChange={e => setTitle(e.target.value)}
              required
              fullWidth
              slotProps={{ htmlInput: { maxLength: 256 } }}
              autoFocus
            />
            <TextField
              label="Content"
              value={content}
              onChange={e => setContent(e.target.value)}
              required
              fullWidth
              multiline
              minRows={4}
              maxRows={12}
              slotProps={{ htmlInput: { maxLength: 4096 } }}
              helperText={`${content.length}/4096`}
            />

            {/* ── Schedule ── */}
            <Divider />
            <Stack direction="row" alignItems="center" spacing={1}>
              <ScheduleIcon color="action" />
              <Typography variant="subtitle2">Schedule</Typography>
            </Stack>

            <FormControlLabel
              labelPlacement="start"
              sx={{ m: 0, justifyContent: 'space-between' }}
              control={
                <Switch
                  checked={enableSchedule}
                  onChange={e => setEnableSchedule(e.target.checked)}
                />
              }
              label="Schedule for later"
            />

            {enableSchedule && (
              <TextField
                label="Send at"
                type="datetime-local"
                value={scheduledAt}
                onChange={e => setScheduledAt(e.target.value)}
                fullWidth
                slotProps={{
                  htmlInput: { min: minScheduleDate },
                  inputLabel: { shrink: true },
                }}
                helperText="The announcement will be sent automatically at the scheduled time"
              />
            )}

            {/* ── Discord Embed Configuration ── */}
            <Divider />
            <Accordion
              disableGutters
              elevation={0}
              sx={{
                '&:before': { display: 'none' },
                border: 1,
                borderColor: 'divider',
                borderRadius: 1,
              }}
            >
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <ColorLensIcon color="action" />
                  <Typography variant="subtitle2">Discord Embed Settings</Typography>
                  {hasEmbedConfig && (
                    <Chip label="Configured" size="small" color="info" variant="outlined" />
                  )}
                </Stack>
              </AccordionSummary>
              <AccordionDetails>
                <Stack spacing={2}>
                  {/* Color */}
                  <Stack direction="row" alignItems="center" spacing={2}>
                    <TextField
                      label="Embed Color"
                      placeholder="#0099FF"
                      value={embedColor}
                      onChange={e => setEmbedColor(e.target.value)}
                      size="small"
                      sx={{ flex: 1 }}
                      slotProps={{ htmlInput: { maxLength: 7 } }}
                      helperText="Hex color for the embed accent (e.g. #0099FF)"
                    />
                    {embedColor && /^#[0-9A-Fa-f]{6}$/.test(embedColor) && (
                      <Box
                        sx={{
                          width: 32,
                          height: 32,
                          borderRadius: 1,
                          backgroundColor: embedColor,
                          border: 1,
                          borderColor: 'divider',
                          flexShrink: 0,
                        }}
                      />
                    )}
                  </Stack>

                  {/* Author section */}
                  <Divider textAlign="left">
                    <Stack direction="row" alignItems="center" spacing={0.5}>
                      <PersonIcon fontSize="small" color="action" />
                      <Typography variant="caption">Author</Typography>
                    </Stack>
                  </Divider>

                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                    <TextField
                      label="Author Name"
                      placeholder="Organization name"
                      value={authorName}
                      onChange={e => setAuthorName(e.target.value)}
                      size="small"
                      fullWidth
                      slotProps={{ htmlInput: { maxLength: 256 } }}
                    />
                    <TextField
                      label="Author Icon URL"
                      placeholder="https://example.com/avatar.png"
                      value={authorIconUrl}
                      onChange={e => setAuthorIconUrl(e.target.value)}
                      size="small"
                      fullWidth
                    />
                  </Stack>

                  <TextField
                    label="Author Link URL"
                    placeholder="https://example.com"
                    value={authorUrl}
                    onChange={e => setAuthorUrl(e.target.value)}
                    size="small"
                    fullWidth
                    helperText="Clicking the author name in Discord will open this URL"
                  />

                  {/* Images section */}
                  <Divider textAlign="left">
                    <Stack direction="row" alignItems="center" spacing={0.5}>
                      <ImageIcon fontSize="small" color="action" />
                      <Typography variant="caption">Images</Typography>
                    </Stack>
                  </Divider>

                  <TextField
                    label="Thumbnail URL"
                    placeholder="https://example.com/thumb.png"
                    value={thumbnailUrl}
                    onChange={e => setThumbnailUrl(e.target.value)}
                    size="small"
                    fullWidth
                    helperText="Small image shown in the top-right corner of the embed"
                  />

                  <TextField
                    label="Image URL"
                    placeholder="https://example.com/banner.png"
                    value={imageUrl}
                    onChange={e => setImageUrl(e.target.value)}
                    size="small"
                    fullWidth
                    helperText="Large image shown at the bottom of the embed"
                  />

                  {/* Footer section */}
                  <Divider textAlign="left">
                    <Typography variant="caption">Footer</Typography>
                  </Divider>

                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                    <TextField
                      label="Footer Text"
                      placeholder="Powered by Fleet Manager"
                      value={footerText}
                      onChange={e => setFooterText(e.target.value)}
                      size="small"
                      fullWidth
                      slotProps={{ htmlInput: { maxLength: 2048 } }}
                    />
                    <TextField
                      label="Footer Icon URL"
                      placeholder="https://example.com/icon.png"
                      value={footerIconUrl}
                      onChange={e => setFooterIconUrl(e.target.value)}
                      size="small"
                      fullWidth
                    />
                  </Stack>

                  {/* Preview */}
                  {hasEmbedConfig && (
                    <>
                      <Divider textAlign="left">
                        <Typography variant="caption">Preview</Typography>
                      </Divider>
                      <EmbedPreview
                        title={title}
                        content={content}
                        embedConfig={buildEmbedConfig() ?? {}}
                      />
                    </>
                  )}
                </Stack>
              </AccordionDetails>
            </Accordion>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={isSubmitting || !title.trim() || !content.trim()}
            startIcon={isSubmitting ? <CircularProgress size={16} /> : undefined}
          >
            {initialData ? 'Save' : 'Create'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

// ============================================================================
// Publish Dialog — with channel ID and optional schedule
// ============================================================================

interface PublishDialogProps {
  open: boolean;
  onClose: () => void;
  onPublish: (channelId: string) => void;
  isPublishing: boolean;
  announcementTitle?: string;
}

const PublishDialog: React.FC<PublishDialogProps> = ({
  open,
  onClose,
  onPublish,
  isPublishing,
  announcementTitle,
}) => {
  const [channelId, setChannelId] = useState('');

  React.useEffect(() => {
    if (open) setChannelId('');
  }, [open]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Publish Announcement</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Send &quot;{announcementTitle}&quot; to a Discord channel.
        </Typography>
        <Stack spacing={2}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <TagIcon color="action" />
            <TextField
              label="Discord Channel ID"
              value={channelId}
              onChange={e => setChannelId(e.target.value)}
              fullWidth
              required
              placeholder="e.g. 1234567890123456789"
              helperText="Right-click a channel in Discord → Copy Channel ID (enable Developer Mode in Discord settings)"
            />
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={isPublishing}>
          Cancel
        </Button>
        <Button
          variant="contained"
          color="primary"
          onClick={() => onPublish(channelId.trim())}
          disabled={isPublishing || !channelId.trim()}
          startIcon={isPublishing ? <CircularProgress size={16} /> : <SendIcon />}
        >
          Publish
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// ============================================================================
// Announcement Card
// ============================================================================

interface AnnouncementCardProps {
  announcement: Announcement;
  canManage: boolean;
  onEdit: (a: Announcement) => void;
  onDelete: (id: string) => void;
  onPublish: (a: Announcement) => void;
  onTogglePin: (id: string) => void;
}

const AnnouncementCard: React.FC<AnnouncementCardProps> = ({
  announcement,
  canManage,
  onEdit,
  onDelete,
  onPublish,
  onTogglePin,
}) => {
  const theme = useTheme();
  const statusCfg = STATUS_CONFIG[announcement.status] || STATUS_CONFIG.draft;
  const canEdit = announcement.status === 'draft' || announcement.status === 'scheduled';
  const canPublish = announcement.status === 'draft';
  const embed = announcement.embedConfig;
  const accentColor = embed?.color || undefined;

  return (
    <Card
      variant="outlined"
      sx={{
        mb: 2,
        ...(accentColor ? { borderLeft: `4px solid ${accentColor}` } : {}),
      }}
    >
      <CardContent>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
          <Typography variant="h6" sx={{ flex: 1, fontWeight: 600 }}>
            {announcement.title}
          </Typography>
          <Chip
            icon={statusCfg.icon}
            label={statusCfg.label}
            color={statusCfg.color}
            size="small"
          />
          {announcement.isPinned && (
            <Chip
              icon={<PushPinIcon fontSize="small" />}
              label="Pinned"
              size="small"
              variant="outlined"
              color="warning"
            />
          )}
        </Stack>

        <Typography
          variant="body2"
          color="text.secondary"
          sx={{
            whiteSpace: 'pre-wrap',
            maxHeight: 120,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            mb: 1,
          }}
        >
          {announcement.content}
        </Typography>

        {/* Embed config indicators */}
        {embed && (
          <Stack direction="row" spacing={1} sx={{ mb: 1, flexWrap: 'wrap', gap: 0.5 }}>
            {embed.authorName && (
              <Chip
                icon={<PersonIcon fontSize="small" />}
                label={embed.authorName}
                size="small"
                variant="outlined"
              />
            )}
            {embed.color && (
              <Chip
                icon={
                  <Box
                    sx={{
                      width: 12,
                      height: 12,
                      borderRadius: '50%',
                      backgroundColor: embed.color,
                    }}
                  />
                }
                label={embed.color}
                size="small"
                variant="outlined"
              />
            )}
            {embed.imageUrl && (
              <Chip
                icon={<ImageIcon fontSize="small" />}
                label="Image"
                size="small"
                variant="outlined"
              />
            )}
            {embed.thumbnailUrl && (
              <Chip
                icon={<ImageIcon fontSize="small" />}
                label="Thumbnail"
                size="small"
                variant="outlined"
              />
            )}
            {embed.footerText && (
              <Chip label={`Footer: ${embed.footerText}`} size="small" variant="outlined" />
            )}
          </Stack>
        )}

        <Stack direction="row" spacing={2} sx={{ mt: 1, flexWrap: 'wrap', gap: 0.5 }}>
          <Typography variant="caption" color="text.secondary">
            By {announcement.createdByName || 'Unknown'} &middot;{' '}
            {new Date(announcement.createdAt).toLocaleDateString()}
          </Typography>
          {announcement.scheduledAt && (
            <Chip
              icon={<ScheduleIcon fontSize="small" />}
              label={`Scheduled: ${new Date(announcement.scheduledAt).toLocaleString()}`}
              size="small"
              color="info"
              variant="outlined"
            />
          )}
          {announcement.sentAt && (
            <Typography variant="caption" color="text.secondary">
              Sent: {new Date(announcement.sentAt).toLocaleString()}
            </Typography>
          )}
          {typeof announcement.successfulDeliveries === 'number' && (
            <Typography variant="caption" sx={{ color: theme.palette.success.main }}>
              {announcement.successfulDeliveries} delivered
            </Typography>
          )}
          {typeof announcement.failedDeliveries === 'number' &&
            announcement.failedDeliveries > 0 && (
              <Typography variant="caption" sx={{ color: theme.palette.error.main }}>
                {announcement.failedDeliveries} failed
              </Typography>
            )}
        </Stack>
      </CardContent>

      {canManage && (
        <CardActions sx={{ px: 2, pb: 1.5 }}>
          {canEdit && (
            <Tooltip title="Edit">
              <IconButton size="small" onClick={() => onEdit(announcement)}>
                <EditIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          {canPublish && (
            <Tooltip title="Publish to Discord">
              <IconButton size="small" color="primary" onClick={() => onPublish(announcement)}>
                <SendIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          <Tooltip title={announcement.isPinned ? 'Unpin' : 'Pin'}>
            <IconButton size="small" onClick={() => onTogglePin(announcement.id)}>
              <PushPinIcon fontSize="small" color={announcement.isPinned ? 'warning' : 'inherit'} />
            </IconButton>
          </Tooltip>
          <Box sx={{ flex: 1 }} />
          <Tooltip title="Delete">
            <IconButton size="small" color="error" onClick={() => onDelete(announcement.id)}>
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </CardActions>
      )}
    </Card>
  );
};

// ============================================================================
// Main Page
// ============================================================================

const AnnouncementsPage: React.FC = () => {
  // Filters
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<AnnouncementStatus | ''>('');
  const filters: AnnouncementFilters = {
    page,
    limit: 10,
    ...(statusFilter ? { status: statusFilter } : {}),
  };

  // Data
  const { data, isLoading, error } = useAnnouncements(filters);

  // Mutations
  const createMutation = useCreateAnnouncement();
  const updateMutation = useUpdateAnnouncement();
  const deleteMutation = useDeleteAnnouncement();
  const publishMutation = usePublishAnnouncement();
  const togglePinMutation = useToggleAnnouncementPin();

  const canManageAnnouncements = useHasMinOrgRole('officer');

  // Dialogs
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Announcement | undefined>();
  const [publishTarget, setPublishTarget] = useState<Announcement | undefined>();
  const { openDialog, closeDialog, pendingData, dialogProps } = useConfirmDialog<string>();

  const handleCreate = useCallback(() => {
    setEditTarget(undefined);
    setFormOpen(true);
  }, []);

  const handleEdit = useCallback((a: Announcement) => {
    setEditTarget(a);
    setFormOpen(true);
  }, []);

  const handleFormSubmit = useCallback(
    async (data: CreateAnnouncementInput) => {
      try {
        if (editTarget) {
          await updateMutation.mutateAsync({ id: editTarget.id, data });
        } else {
          await createMutation.mutateAsync(data);
        }
        setFormOpen(false);
      } catch (err) {
        logger.error(
          'Failed to save announcement',
          err instanceof Error ? err : new Error(String(err))
        );
      }
    },
    [editTarget, createMutation, updateMutation]
  );

  const handleConfirmDelete = useCallback(async () => {
    if (!pendingData) return;
    try {
      await deleteMutation.mutateAsync(pendingData);
      closeDialog();
    } catch (err) {
      logger.error(
        'Failed to delete announcement',
        err instanceof Error ? err : new Error(String(err))
      );
    }
  }, [pendingData, deleteMutation, closeDialog]);

  const handlePublish = useCallback(
    async (channelId: string) => {
      if (!publishTarget) return;
      try {
        await publishMutation.mutateAsync({
          id: publishTarget.id,
          data: { channelId },
        });
        setPublishTarget(undefined);
      } catch (err) {
        logger.error(
          'Failed to publish announcement',
          err instanceof Error ? err : new Error(String(err))
        );
      }
    },
    [publishTarget, publishMutation]
  );

  const handleTogglePin = useCallback(
    async (id: string) => {
      try {
        await togglePinMutation.mutateAsync(id);
      } catch (err) {
        logger.error('Failed to toggle pin', err instanceof Error ? err : new Error(String(err)));
      }
    },
    [togglePinMutation]
  );

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto', mt: 4, px: 2 }}>
      {/* Header */}
      <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 1 }}>
        <CampaignIcon color="primary" sx={{ fontSize: 32 }} />
        <Typography variant="h4" sx={{ fontWeight: 'bold', flex: 1 }}>
          Announcements
        </Typography>
        {canManageAnnouncements && (
          <Button variant="contained" startIcon={<AddIcon />} onClick={handleCreate}>
            New Announcement
          </Button>
        )}
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Create, schedule, and publish announcements to Discord channels.
      </Typography>

      {/* Filters */}
      <Stack direction="row" spacing={2} sx={{ mb: 3 }}>
        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel>Status</InputLabel>
          <Select
            value={statusFilter}
            label="Status"
            onChange={(e: SelectChangeEvent) => {
              setStatusFilter(e.target.value as AnnouncementStatus | '');
              setPage(1);
            }}
          >
            <MenuItem value="">All</MenuItem>
            <MenuItem value="draft">Draft</MenuItem>
            <MenuItem value="scheduled">Scheduled</MenuItem>
            <MenuItem value="sent">Sent</MenuItem>
            <MenuItem value="failed">Failed</MenuItem>
            <MenuItem value="cancelled">Cancelled</MenuItem>
          </Select>
        </FormControl>
      </Stack>

      {/* Content */}
      {isLoading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Failed to load announcements. Please try again.
        </Alert>
      )}

      {data && (data.announcements?.length ?? 0) === 0 && (
        <Alert severity="info">
          No announcements found. Create your first announcement to get started.
        </Alert>
      )}

      {data?.announcements?.map(announcement => (
        <AnnouncementCard
          key={announcement.id}
          announcement={announcement}
          canManage={canManageAnnouncements}
          onEdit={handleEdit}
          onDelete={id => openDialog(id)}
          onPublish={a => setPublishTarget(a)}
          onTogglePin={handleTogglePin}
        />
      ))}

      {/* Pagination */}
      {data && data.totalPages > 1 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
          <Pagination
            count={data.totalPages}
            page={page}
            onChange={(_e, value) => setPage(value)}
            color="primary"
          />
        </Box>
      )}

      {/* Dialogs */}
      <AnnouncementFormDialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSubmit={handleFormSubmit}
        initialData={editTarget}
        isSubmitting={createMutation.isPending || updateMutation.isPending}
      />

      <PublishDialog
        open={!!publishTarget}
        onClose={() => setPublishTarget(undefined)}
        onPublish={handlePublish}
        isPublishing={publishMutation.isPending}
        announcementTitle={publishTarget?.title}
      />

      <ConfirmDialog
        {...dialogProps}
        title="Delete Announcement"
        message="This will permanently delete this announcement. This action cannot be undone."
        onConfirm={handleConfirmDelete}
      />
    </Box>
  );
};

export const AnnouncementsPageWithErrorBoundary: React.FC = () => (
  <FeatureErrorBoundary featureName="Announcements">
    <AnnouncementsPage />
  </FeatureErrorBoundary>
);

export { AnnouncementsPage };
