import { Button } from '@/components/ui/Button';
import OrganisationsIcon from '@mui/icons-material/Group';
import BoxDetailIcon from '@mui/icons-material/OpenInNew';
import { alpha, Badge, Box, Stack, Typography, useTheme } from '@mui/material';
import React from 'react';
import { useNavigate } from 'react-router-dom';

interface AllianceCardProps {
  allianceCount: number;
  organizationId: string;
}

/**
 * Alliance Card Component
 * Displays alliance count and provides quick navigation to alliance management
 */
export const AllianceCard: React.FC<AllianceCardProps> = ({ allianceCount, organizationId }) => {
  const theme = useTheme();
  const navigate = useNavigate();

  const handleBoxAlliances = () => {
    // Navigate to alliances page (you may need to adjust the route)
    navigate(`/organization/${organizationId}/alliances`);
  };

  return (
    <Box
      sx={{
        border: '1px solid',
        borderColor: alpha(theme.palette.common.white, 0.1),
        borderRadius: 1,
        p: 3,
        backgroundColor: alpha(theme.palette.common.white, 0.02),
        minHeight: 200,
      }}
    >
      <Stack direction="column" gap={2} height="100%">
        {/* Header */}
        <Stack direction="row" alignItems="center" gap={1}>
          <OrganisationsIcon />
          <Typography variant="h6" sx={{ m: 0 }}>
            Alliances
          </Typography>
        </Stack>

        {/* Count Display */}
        <Stack direction="column" alignItems="center" justifyContent="center" sx={{ flex: 1 }}>
          <Typography>
            <span style={{ fontSize: '2.5rem', fontWeight: 'bold' }}>{allianceCount}</span>
          </Typography>
          <Typography>Active Alliances</Typography>
        </Stack>

        {/* Status Badge */}
        {allianceCount > 0 && (
          <Stack justifyContent="center">
            <Badge
              badgeContent={allianceCount === 1 ? '1 Alliance' : `${allianceCount} Alliances`}
              color="success"
            />
          </Stack>
        )}

        {/* Action Button */}
        <Button
          onClick={handleBoxAlliances}
          disabled={allianceCount === 0}
          fullWidth
          leftIcon={<BoxDetailIcon />}
        >
          View Details
        </Button>
      </Stack>
    </Box>
  );
};
