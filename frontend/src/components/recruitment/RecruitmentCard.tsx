import { type Recruitment, getTagChipColor, getTagLabel } from '@/services/recruitmentService';
import { sanitizeImageUrl } from '@/utils/sanitize';
import GroupIcon from '@mui/icons-material/Group';
import ScheduleIcon from '@mui/icons-material/Schedule';
import {
  Avatar,
  Box,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  Stack,
  Typography,
} from '@mui/material';
import React from 'react';

function getStatusChipColor(status: string): 'success' | 'warning' | 'error' {
  if (status === 'open') return 'success';
  if (status === 'paused') return 'warning';
  return 'error';
}

function truncateText(text: string, maxLength: number): string {
  // Cap input to avoid super-linear regex backtracking on very long strings
  const bounded = text.length > maxLength * 3 ? text.slice(0, maxLength * 3) : text;
  // Strip markdown syntax for preview
  const plain = bounded
    .replaceAll(/#{1,6}\s/g, '')
    .replaceAll(/\*\*|__/g, '')
    .replaceAll(/[*_]/g, '')
    .replaceAll(/\[[^\]]{0,500}\]\([^)]{0,2000}\)/g, '')
    .replaceAll(/!\[[^\]]{0,500}\]\([^)]{0,2000}\)/g, '')
    .replaceAll(/```[^`]*```/g, '')
    .replaceAll(/`([^`]+)`/g, '$1')
    .replaceAll(/>\s/g, '')
    .replaceAll(/[-*+]\s/g, '')
    .replaceAll(/\n+/g, ' ')
    .trim();

  if (plain.length <= maxLength) return plain;
  return plain.slice(0, maxLength).trimEnd() + '...';
}

interface RecruitmentCardProps {
  readonly recruitment: Recruitment;
  readonly onClick: (id: string) => void;
}

export const RecruitmentCard: React.FC<RecruitmentCardProps> = ({ recruitment, onClick }) => {
  const [bannerError, setBannerError] = React.useState(false);
  const isExpired = recruitment.expiresAt && new Date(recruitment.expiresAt) < new Date();
  const daysLeft = recruitment.expiresAt
    ? Math.max(
        0,
        Math.ceil((new Date(recruitment.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      )
    : null;

  return (
    <Card
      variant="outlined"
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        transition: 'border-color 0.2s, box-shadow 0.2s',
        '&:hover': {
          borderColor: 'primary.main',
          boxShadow: 2,
        },
      }}
    >
      <CardActionArea
        onClick={() => onClick(recruitment.id)}
        sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', alignItems: 'stretch' }}
      >
        {/* Banner */}
        {recruitment.bannerImageUrl && !bannerError && (
          <Box
            sx={{
              width: '100%',
              height: 120,
              overflow: 'hidden',
              flexShrink: 0,
            }}
          >
            <Box
              component="img"
              src={sanitizeImageUrl(recruitment.bannerImageUrl)}
              alt=""
              sx={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
              }}
              onError={() => setBannerError(true)}
            />
          </Box>
        )}

        <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
          {/* Header: org avatar + title + status */}
          <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 1 }}>
            <Avatar
              src={sanitizeImageUrl(recruitment.organizationLogoUrl)}
              alt={recruitment.organizationName || 'Organization'}
              sx={{ width: 36, height: 36, bgcolor: 'primary.dark', flexShrink: 0 }}
            >
              {(recruitment.organizationName || 'O')[0]}
            </Avatar>
            <Box sx={{ minWidth: 0, flexGrow: 1 }}>
              <Typography
                variant="subtitle1"
                sx={{
                  fontWeight: 600,
                  color: 'primary.main',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {recruitment.title}
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                {recruitment.organizationName}
              </Typography>
            </Box>
            <Chip
              label={recruitment.status}
              size="small"
              color={getStatusChipColor(recruitment.status)}
              sx={{ textTransform: 'capitalize', flexShrink: 0 }}
            />
          </Stack>

          {/* Description preview */}
          <Typography
            variant="body2"
            sx={{
              color: 'text.secondary',
              mb: 1.5,
              flexGrow: 1,
              display: '-webkit-box',
              WebkitLineClamp: 3,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {truncateText(recruitment.description, 200)}
          </Typography>

          {/* Roles preview */}
          {(recruitment.rolesNeeded ?? []).length > 0 && (
            <Stack direction="row" spacing={0.5} sx={{ mb: 1.5, flexWrap: 'wrap', gap: 0.5 }}>
              {(recruitment.rolesNeeded ?? []).slice(0, 3).map(role => (
                <Chip key={role} label={role} size="small" color="primary" variant="outlined" />
              ))}
              {(recruitment.rolesNeeded ?? []).length > 3 && (
                <Chip
                  label={`+${(recruitment.rolesNeeded ?? []).length - 3}`}
                  size="small"
                  variant="outlined"
                />
              )}
            </Stack>
          )}

          {/* Tags preview */}
          {(recruitment.tags ?? []).length > 0 && (
            <Stack direction="row" spacing={0.5} sx={{ mb: 1.5, flexWrap: 'wrap', gap: 0.5 }}>
              {(recruitment.tags ?? []).slice(0, 4).map(tag => (
                  <Chip
                    key={tag}
                    label={getTagLabel(tag)}
                    size="small"
                    variant="outlined"
                    color={getTagChipColor(tag)}
                    sx={{ fontSize: '0.7rem', height: 22 }}
                  />
                ))}
              {(recruitment.tags ?? []).length > 4 && (
                <Chip
                  label={`+${(recruitment.tags ?? []).length - 4}`}
                  size="small"
                  variant="outlined"
                  sx={{ fontSize: '0.7rem', height: 22 }}
                />
              )}
            </Stack>
          )}

          {/* Footer: applicants + expiry */}
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
            sx={{ mt: 'auto', pt: 1, borderTop: '1px solid', borderColor: 'divider' }}
          >
            <Stack direction="row" spacing={0.5} alignItems="center">
              <GroupIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                {recruitment.currentApplicants ?? 0}
                {recruitment.maxPositions ? ` / ${recruitment.maxPositions}` : ''}
              </Typography>
            </Stack>

            {recruitment.expiresAt && (
              <Stack direction="row" spacing={0.5} alignItems="center">
                <ScheduleIcon
                  sx={{ fontSize: 16, color: isExpired ? 'error.main' : 'text.secondary' }}
                />
                <Typography
                  variant="caption"
                  sx={{ color: isExpired ? 'error.main' : 'text.secondary' }}
                >
                  {isExpired ? 'Expired' : ''}
                  {!isExpired && daysLeft !== null ? `${daysLeft}d left` : ''}
                </Typography>
              </Stack>
            )}
          </Stack>
        </CardContent>
      </CardActionArea>
    </Card>
  );
};
