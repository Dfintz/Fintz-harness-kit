import { getTagChipColor, getTagLabel, type Recruitment } from '@/services/recruitmentService';
import { sanitizeImageUrl } from '@/utils/sanitize';
import CloseIcon from '@mui/icons-material/Close';
import {
  Avatar,
  Box,
  Chip,
  Dialog,
  DialogContent,
  IconButton,
  Stack,
  Typography,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import MDEditor from '@uiw/react-md-editor';
import React, { useState } from 'react';

function getStatusChipColor(status: string): 'success' | 'warning' | 'error' {
  if (status === 'open') return 'success';
  if (status === 'paused') return 'warning';
  return 'error';
}

interface RecruitmentPostPreviewDialogProps {
  open: boolean;
  onClose: () => void;
  recruitment: Recruitment;
}

export const RecruitmentPostPreviewDialog: React.FC<
  Readonly<RecruitmentPostPreviewDialogProps>
> = ({ open, onClose, recruitment }) => {
  const theme = useTheme();
  const [bannerError, setBannerError] = useState(false);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      scroll="paper"
      slotProps={{
        paper: {
          sx: {
            bgcolor: theme.palette.background.paper,
            backgroundImage: 'none',
            borderRadius: 2,
            overflow: 'hidden',
          },
        },
      }}
    >
      {/* Close button */}
      <IconButton
        onClick={onClose}
        sx={{
          position: 'absolute',
          top: 8,
          right: 8,
          zIndex: 2,
          bgcolor: alpha(theme.palette.background.default, 0.7),
          '&:hover': { bgcolor: alpha(theme.palette.background.default, 0.9) },
        }}
        aria-label="Close"
      >
        <CloseIcon />
      </IconButton>

      {/* Banner Image */}
      {recruitment.bannerImageUrl && !bannerError && (
        <Box sx={{ width: '100%', height: { xs: 120, sm: 180 }, overflow: 'hidden' }}>
          <Box
            component="img"
            src={sanitizeImageUrl(recruitment.bannerImageUrl)}
            alt={`${recruitment.title} banner`}
            sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
            onError={() => setBannerError(true)}
          />
        </Box>
      )}

      <DialogContent sx={{ p: { xs: 2, sm: 3 } }}>
        {/* Header: Avatar + Title + Status */}
        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2 }}>
          <Avatar
            src={sanitizeImageUrl(recruitment.organizationLogoUrl)}
            alt={recruitment.organizationName || 'Organization'}
            sx={{ width: 48, height: 48, bgcolor: 'primary.dark' }}
          >
            {(recruitment.organizationName || 'O')[0]}
          </Avatar>
          <Box sx={{ minWidth: 0 }}>
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

        {/* Description (full markdown) */}
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
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
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
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
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

        {/* Requirements (full markdown) */}
        {recruitment.requirements && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
              Requirements
            </Typography>
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

        {/* Footer info */}
        <Box sx={{ pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Applicants: {recruitment.currentApplicants ?? 0}
            {recruitment.maxPositions != null && ` / ${recruitment.maxPositions}`}
            {recruitment.expiresAt &&
              ` · Expires: ${new Date(recruitment.expiresAt).toLocaleDateString()}`}
          </Typography>
        </Box>
      </DialogContent>
    </Dialog>
  );
};
