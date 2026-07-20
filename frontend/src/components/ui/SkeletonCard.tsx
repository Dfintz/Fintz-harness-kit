/**
 * SkeletonCard — MUI-based card skeleton for loading states
 *
 * Replaces raw CircularProgress spinners with content-shaped
 * skeleton placeholders that reduce layout shift.
 *
 * @example
 * // Grid of skeleton cards while data loads
 * <SkeletonCard count={6} variant="directory" />
 *
 * @example
 * // Single card skeleton
 * <SkeletonCard variant="stat" />
 */

import { Box, Card, CardContent, Grid, Skeleton, Stack } from '@mui/material';
import React from 'react';

export type SkeletonCardVariant = 'default' | 'stat' | 'directory' | 'job' | 'profile';

export interface SkeletonCardProps {
  /** Number of skeleton cards to render */
  count?: number;
  /** Card shape variant */
  variant?: SkeletonCardVariant;
  /** Test ID for testing */
  testId?: string;
}

/** A single stat-style skeleton (compact, icon-left) */
const StatSkeleton: React.FC = () => (
  <Card
    sx={{
      minWidth: 160,
      flex: '1 1 160px',
      bgcolor: 'background.paper',
      border: '1px solid',
      borderColor: 'divider',
    }}
  >
    <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
      <Stack direction="row" alignItems="center" spacing={1.5}>
        <Skeleton variant="circular" width={36} height={36} />
        <Box flex={1}>
          <Skeleton variant="text" width="60%" height={16} />
          <Skeleton variant="text" width="40%" height={28} />
        </Box>
      </Stack>
    </CardContent>
  </Card>
);

/** A directory/org card skeleton */
const DirectorySkeleton: React.FC = () => (
  <Card
    sx={{
      bgcolor: 'background.paper',
      border: '1px solid',
      borderColor: 'divider',
      height: '100%',
    }}
  >
    <Skeleton variant="rectangular" height={120} />
    <CardContent>
      <Skeleton variant="text" width="70%" height={24} />
      <Skeleton variant="text" width="90%" height={16} sx={{ mt: 0.5 }} />
      <Skeleton variant="text" width="50%" height={16} sx={{ mt: 0.5 }} />
      <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}>
        <Skeleton variant="rounded" width={60} height={24} />
        <Skeleton variant="rounded" width={80} height={24} />
      </Stack>
    </CardContent>
  </Card>
);

/** A job listing skeleton */
const JobSkeleton: React.FC = () => (
  <Card
    sx={{
      bgcolor: 'background.paper',
      border: '1px solid',
      borderColor: 'divider',
    }}
  >
    <CardContent>
      <Stack direction="row" alignItems="center" spacing={1.5} mb={1}>
        <Skeleton variant="circular" width={40} height={40} />
        <Box flex={1}>
          <Skeleton variant="text" width="50%" height={22} />
          <Skeleton variant="text" width="30%" height={14} />
        </Box>
        <Skeleton variant="rounded" width={70} height={28} />
      </Stack>
      <Skeleton variant="text" width="100%" height={16} />
      <Skeleton variant="text" width="85%" height={16} />
      <Stack direction="row" spacing={1} mt={1.5}>
        <Skeleton variant="rounded" width={50} height={20} />
        <Skeleton variant="rounded" width={70} height={20} />
        <Skeleton variant="rounded" width={60} height={20} />
      </Stack>
    </CardContent>
  </Card>
);

/** A profile card skeleton */
const ProfileSkeleton: React.FC = () => (
  <Card
    sx={{
      bgcolor: 'background.paper',
      border: '1px solid',
      borderColor: 'divider',
    }}
  >
    <CardContent>
      <Stack direction="row" spacing={2} alignItems="flex-start">
        <Skeleton variant="circular" width={64} height={64} />
        <Box flex={1}>
          <Skeleton variant="text" width="45%" height={26} />
          <Skeleton variant="text" width="65%" height={16} sx={{ mt: 0.5 }} />
          <Skeleton variant="text" width="80%" height={16} sx={{ mt: 1 }} />
          <Skeleton variant="text" width="60%" height={16} sx={{ mt: 0.5 }} />
        </Box>
      </Stack>
    </CardContent>
  </Card>
);

/** Default card skeleton */
const DefaultSkeleton: React.FC = () => (
  <Card
    sx={{
      bgcolor: 'background.paper',
      border: '1px solid',
      borderColor: 'divider',
    }}
  >
    <CardContent>
      <Skeleton variant="text" width="60%" height={24} />
      <Skeleton variant="text" width="100%" height={16} sx={{ mt: 1 }} />
      <Skeleton variant="text" width="90%" height={16} sx={{ mt: 0.5 }} />
      <Skeleton variant="text" width="40%" height={16} sx={{ mt: 0.5 }} />
    </CardContent>
  </Card>
);

const VARIANT_MAP: Record<SkeletonCardVariant, React.FC> = {
  default: DefaultSkeleton,
  stat: StatSkeleton,
  directory: DirectorySkeleton,
  job: JobSkeleton,
  profile: ProfileSkeleton,
};

/**
 * Renders one or more MUI skeleton cards for loading states.
 *
 * Use `variant` to match the shape of the content being loaded.
 * For stat cards, renders in a horizontal `Stack`.
 * For others, renders in a responsive `Grid`.
 */
const SkeletonCard: React.FC<SkeletonCardProps> = ({
  count = 1,
  variant = 'default',
  testId = 'skeleton-card',
}) => {
  const Component = VARIANT_MAP[variant];

  // Stat cards render in a row
  if (variant === 'stat') {
    return (
      <Stack direction="row" gap={2} flexWrap="wrap" data-testid={testId}>
        {Array.from({ length: count }, (_, i) => (
          <Component key={i} />
        ))}
      </Stack>
    );
  }

  // All other variants render in a responsive grid
  return (
    <Grid container spacing={2} data-testid={testId}>
      {Array.from({ length: count }, (_, i) => (
        <Grid key={i} size={{ xs: 12, sm: 6, md: variant === 'job' ? 6 : 4 }}>
          <Component />
        </Grid>
      ))}
    </Grid>
  );
};

export { SkeletonCard };
