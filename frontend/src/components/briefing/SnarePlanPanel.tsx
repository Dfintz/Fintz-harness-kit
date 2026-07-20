import { Box, Card } from '@mui/material';
import React from 'react';

import { InterdictionCalculator } from './InterdictionCalculator';

// ============================================================================
// SnarePlanPanel — Native quantum interdiction route planner
// ============================================================================

export interface SnarePlanPanelProps {
  readonly height?: number | string;
}

export const SnarePlanPanel: React.FC<SnarePlanPanelProps> = ({ height = 500 }) => {
  return (
    <Card variant="outlined" sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ flex: 1, minHeight: height }}>
        <InterdictionCalculator mapHeight={height} />
      </Box>
    </Card>
  );
};
