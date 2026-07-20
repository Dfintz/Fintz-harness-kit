import { FeatureErrorBoundary } from '@/components/FeatureErrorBoundary';
import { FleetManager } from '@/components/FleetManager';
import { Box } from '@mui/material';
import React from 'react';

export const Fleet: React.FC = () => {
  return (
    <FeatureErrorBoundary featureName="Fleet Management" showHomeButton={true}>
      <Box>
        <FleetManager />
      </Box>
    </FeatureErrorBoundary>
  );
};

export const FleetWithErrorBoundary: React.FC = () => (
  <FeatureErrorBoundary featureName="Fleet">
    <Fleet />
  </FeatureErrorBoundary>
);
