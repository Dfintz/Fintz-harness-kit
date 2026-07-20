import React from 'react';
import { Alert, Box, CircularProgress, Stack, Typography } from '@mui/material';

import { FleetHealthCard } from '@/components/fleet/FleetHealthCard';
import { useFleets } from '@/hooks/queries/useFleetQueries';
import { useAuthStore } from '@/store/authStore';

export const FleetHealthOverview: React.FC = () => {
  const user = useAuthStore(state => state.user);
  const orgId = user?.activeOrgId ?? user?.organizationId;

  const { data: fleetsResult, isLoading, error } = useFleets(orgId);
  const fleets = fleetsResult?.items ?? [];

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return <Alert severity="error">Failed to load fleets</Alert>;
  }

  if (fleets.length === 0) {
    return (
      <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
        No fleets found. Create a fleet to view health metrics.
      </Typography>
    );
  }

  return (
    <Stack spacing={2}>
      <Typography variant="h6">Fleet Health Overview</Typography>
      {fleets.map(fleet => (
        <FleetHealthCard key={fleet.id} fleetId={fleet.id} />
      ))}
    </Stack>
  );
};
