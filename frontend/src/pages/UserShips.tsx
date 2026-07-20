import { FeatureErrorBoundary } from '@/components/FeatureErrorBoundary';
import { useUserShips } from '@/hooks/queries/useUserQueries';
import type { UserShip } from '@/services/userProfileService';
import { Box, CircularProgress, Typography } from '@mui/material';
import React from 'react';
import { useParams } from 'react-router-dom';

const UserShips: React.FC = () => {
  const { userId } = useParams();
  const { data: shipsData, isLoading: loading, error: queryError } = useUserShips(userId);
  const ships = Array.isArray(shipsData) ? shipsData : [];
  const error = queryError
    ? queryError instanceof Error
      ? queryError.message
      : 'Failed to load ships'
    : null;

  if (!userId) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography>Please provide a user ID in the URL.</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h2">User Ships for {userId}</Typography>
      {loading && <CircularProgress aria-label="Loading ships..." size={40} />}
      {error && <Typography sx={{ color: 'error.main' }}>{error}</Typography>}
      {!loading && !error && (
        <ul>
          {ships.length === 0 && <li>No ships found</li>}
          {ships.map((s: UserShip) => (
            <li key={s.id}>{s.shipName}</li>
          ))}
        </ul>
      )}
    </Box>
  );
};

export const UserShipsWithErrorBoundary: React.FC = () => (
  <FeatureErrorBoundary
    featureName="User Ships"
    fallbackMessage="Unable to load user ships. Please try again later."
    showHomeButton={true}
  >
    <UserShips />
  </FeatureErrorBoundary>
);
