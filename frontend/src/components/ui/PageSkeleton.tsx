import { Box, Grid, Skeleton, Stack } from '@mui/material';
import React from 'react';

type PageSkeletonVariant = 'dashboard' | 'table' | 'cards' | 'detail' | 'form';

interface PageSkeletonProps {
  /** Layout variant to match the page structure */
  variant?: PageSkeletonVariant;
  /** Number of rows for table variant */
  rows?: number;
  /** Number of cards for cards variant */
  cards?: number;
}

/**
 * PageSkeleton — Layout-matching skeleton loading states.
 *
 * Reduces perceived latency by preserving page structure during loading.
 * Each variant matches the target page's layout to prevent CLS (Cumulative Layout Shift).
 *
 * @example
 * ```tsx
 * if (isLoading) return <PageSkeleton variant="dashboard" />;
 * if (isLoading) return <PageSkeleton variant="table" rows={10} />;
 * ```
 */
export const PageSkeleton: React.FC<Readonly<PageSkeletonProps>> = ({
  variant = 'dashboard',
  rows = 8,
  cards = 6,
}) => {
  switch (variant) {
    case 'dashboard':
      return <DashboardSkeleton />;
    case 'table':
      return <TablePageSkeleton rows={rows} />;
    case 'cards':
      return <CardsPageSkeleton cards={cards} />;
    case 'detail':
      return <DetailPageSkeleton />;
    case 'form':
      return <FormPageSkeleton />;
  }
};

/** Dashboard: stat cards + chart + list widgets */
const DashboardSkeleton: React.FC = () => (
  <Stack gap={3}>
    {/* Page title */}
    <Skeleton variant="text" width={200} height={40} />

    {/* Summary stat cards */}
    <Grid container spacing={2}>
      {Array.from({ length: 4 }).map((_, i) => (
        <Grid size={{ xs: 6, md: 3 }} key={i}>
          <Skeleton variant="rounded" height={100} />
        </Grid>
      ))}
    </Grid>

    {/* Chart + side panel row */}
    <Grid container spacing={2}>
      <Grid size={{ xs: 12, md: 8 }}>
        <Skeleton variant="rounded" height={280} />
      </Grid>
      <Grid size={{ xs: 12, md: 4 }}>
        <Skeleton variant="rounded" height={280} />
      </Grid>
    </Grid>

    {/* Action items list */}
    <Skeleton variant="rounded" height={200} />
  </Stack>
);

/** Table page: title + toolbar + rows */
const TablePageSkeleton: React.FC<{ rows: number }> = ({ rows }) => (
  <Stack gap={2}>
    {/* Page title */}
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <Skeleton variant="text" width={180} height={36} />
      <Skeleton variant="rounded" width={120} height={36} />
    </Box>

    {/* Filter/search bar */}
    <Box sx={{ display: 'flex', gap: 1 }}>
      <Skeleton variant="rounded" width={240} height={40} />
      <Skeleton variant="rounded" width={120} height={40} />
      <Skeleton variant="rounded" width={120} height={40} />
    </Box>

    {/* Table header */}
    <Skeleton variant="rounded" height={44} />

    {/* Table rows */}
    {Array.from({ length: rows }).map((_, i) => (
      <Skeleton key={i} variant="rounded" height={48} sx={{ opacity: 1 - i * 0.08 }} />
    ))}

    {/* Pagination */}
    <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
      <Skeleton variant="rounded" width={300} height={36} />
    </Box>
  </Stack>
);

/** Cards grid page */
const CardsPageSkeleton: React.FC<{ cards: number }> = ({ cards }) => (
  <Stack gap={2}>
    <Skeleton variant="text" width={200} height={36} />
    <Grid container spacing={2}>
      {Array.from({ length: cards }).map((_, i) => (
        <Grid size={{ xs: 12, sm: 6, md: 4 }} key={i}>
          <Skeleton variant="rounded" height={180} />
        </Grid>
      ))}
    </Grid>
  </Stack>
);

/** Detail page: header + content blocks */
const DetailPageSkeleton: React.FC = () => (
  <Stack gap={3}>
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
      <Skeleton variant="circular" width={48} height={48} />
      <Stack gap={0.5} flex={1}>
        <Skeleton variant="text" width={240} height={32} />
        <Skeleton variant="text" width={160} height={20} />
      </Stack>
    </Box>
    <Skeleton variant="rounded" height={200} />
    <Skeleton variant="rounded" height={300} />
  </Stack>
);

/** Form page: title + fields */
const FormPageSkeleton: React.FC = () => (
  <Stack gap={2} maxWidth={600}>
    <Skeleton variant="text" width={200} height={36} />
    {Array.from({ length: 5 }).map((_, i) => (
      <Stack key={i} gap={0.5}>
        <Skeleton variant="text" width={100} height={20} />
        <Skeleton variant="rounded" height={40} />
      </Stack>
    ))}
    <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
      <Skeleton variant="rounded" width={100} height={40} />
      <Skeleton variant="rounded" width={100} height={40} />
    </Box>
  </Stack>
);
