/**
 * Public Fleet Stats Page — Sprint 21-B
 *
 * Publicly accessible page at `/public/stats` displaying platform-wide
 * statistics. No authentication required. Consumes GET /api/v2/public/stats.
 */

import { FeatureErrorBoundary } from '@/components/FeatureErrorBoundary';
import { SEOHead } from '@/components/SEOHead';
import { usePublicStats } from '@/hooks/queries/usePublicStatsQueries';
import GroupsIcon from '@mui/icons-material/Groups';
import HandshakeIcon from '@mui/icons-material/Handshake';
import PersonIcon from '@mui/icons-material/Person';
import WorkIcon from '@mui/icons-material/Work';
import {
  Alert,
  Box,
  Card,
  CardContent,
  CircularProgress,
  Container,
  Stack,
  Typography,
  useTheme,
} from '@mui/material';
import React from 'react';

interface StatDisplayProps {
  icon: React.ReactNode;
  value: number;
  label: string;
  color: string;
}

const StatDisplay: React.FC<Readonly<StatDisplayProps>> = ({ icon, value, label, color }) => (
  <Card
    sx={{
      flex: { xs: '1 1 100%', sm: '1 1 calc(50% - 16px)', md: '1 1 calc(33.3% - 16px)' },
      minWidth: 200,
    }}
  >
    <CardContent sx={{ textAlign: 'center', py: 3 }}>
      <Box sx={{ color, mb: 1 }}>{icon}</Box>
      <Typography variant="h3" fontWeight="bold">
        {value.toLocaleString()}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
    </CardContent>
  </Card>
);

const PublicStatsPage: React.FC = () => {
  const theme = useTheme();
  const { data: stats, isLoading, error } = usePublicStats();

  if (isLoading) {
    return (
      <Container maxWidth="md" sx={{ py: 8, textAlign: 'center' }}>
        <CircularProgress />
      </Container>
    );
  }

  if (error || !stats) {
    return (
      <Container maxWidth="md" sx={{ py: 8 }}>
        <Alert severity="error">Failed to load platform statistics. Please try again later.</Alert>
      </Container>
    );
  }

  const statItems: StatDisplayProps[] = [
    {
      icon: <GroupsIcon sx={{ fontSize: 48 }} />,
      value: stats.publicOrganizations,
      label: 'Organizations',
      color: theme.palette.primary.main,
    },
    {
      icon: <HandshakeIcon sx={{ fontSize: 48 }} />,
      value: stats.publicAlliances,
      label: 'Active Alliances',
      color: theme.palette.secondary.main,
    },
    {
      icon: <PersonIcon sx={{ fontSize: 48 }} />,
      value: stats.users,
      label: 'Citizens',
      color: theme.palette.success.main,
    },
    {
      icon: <WorkIcon sx={{ fontSize: 48 }} />,
      value: stats.publicJobListings,
      label: 'Job Listings',
      color: theme.palette.error.main,
    },
  ];

  return (
    <Container maxWidth="lg" sx={{ py: 6 }}>
      <SEOHead
        title="Platform Statistics"
        description="Live platform-wide statistics for the Fringe Core community. See total users, organizations, ships, and active alliances."
        canonical="https://fringecore.space/public/stats"
        keywords={['statistics', 'community stats', 'Star Citizen community', 'fleet stats']}
      />
      <Typography variant="h4" fontWeight="bold" gutterBottom textAlign="center">
        Platform Statistics
      </Typography>
      <Typography variant="body1" color="text.secondary" textAlign="center" sx={{ mb: 4 }}>
        Live platform-wide statistics for the Fringe Core community.
      </Typography>

      <Stack direction="row" flexWrap="wrap" gap={2} justifyContent="center">
        {statItems.map(item => (
          <StatDisplay key={item.label} {...item} />
        ))}
      </Stack>
    </Container>
  );
};

const PublicStatsPageWithErrorBoundary: React.FC = () => (
  <FeatureErrorBoundary featureName="Public Stats">
    <PublicStatsPage />
  </FeatureErrorBoundary>
);

export { PublicStatsPage, PublicStatsPageWithErrorBoundary };
