import DirectionsBoatIcon from '@mui/icons-material/DirectionsBoat';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { Alert, Box, Button, Card, CardContent, Typography, useTheme } from '@mui/material';
import React from 'react';

// ============================================================================
// Constants
// ============================================================================

const SHIP_MAPS_URL = 'https://maps.adi.sc/';

// ============================================================================
// Types
// ============================================================================

export interface ShipMapPanelProps {
  readonly height?: number | string;
}

// ============================================================================
// ShipMapPanel — Embeds maps.adi.sc for ship deck plans and boarding ops
// ============================================================================

export const ShipMapPanel: React.FC<ShipMapPanelProps> = ({ height = 500 }) => {
  const theme = useTheme();

  return (
    <Card variant="outlined" sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <CardContent sx={{ pb: 1 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <DirectionsBoatIcon color="info" fontSize="small" />
            <Typography variant="subtitle2" fontWeight={600}>
              Ship Deck Maps
            </Typography>
          </Box>
          <Button
            size="small"
            endIcon={<OpenInNewIcon />}
            href={SHIP_MAPS_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            Open Full
          </Button>
        </Box>
        <Alert severity="info" sx={{ py: 0, fontSize: '0.75rem' }}>
          Interactive 3D ship deck plans for boarding operations. Select a ship inside the viewer.
        </Alert>
      </CardContent>

      <Box sx={{ flex: 1, minHeight: height }}>
        <Box
          component="iframe"
          src={SHIP_MAPS_URL}
          title="Ship Deck Maps — maps.adi.sc"
          sx={{
            width: '100%',
            height: '100%',
            minHeight: height,
            border: 'none',
            borderTop: `1px solid ${theme.palette.divider}`,
          }}
          sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
          loading="lazy"
          referrerPolicy="no-referrer"
        />
      </Box>
    </Card>
  );
};
