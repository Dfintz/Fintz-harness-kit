/**
 * Stats Bar
 *
 * Displays live platform counters fetched from the public API.
 * Uses animated count-up effect on initial load.
 */

import { apiClient } from '@/services/apiClient';
import { KOFI_RED } from '@/utils/brandColors';
import { logger } from '@/utils/logger';
import FavoriteIcon from '@mui/icons-material/Favorite';
import ForumIcon from '@mui/icons-material/Forum';
import GroupsIcon from '@mui/icons-material/Groups';
import HandshakeIcon from '@mui/icons-material/Handshake';
import PersonIcon from '@mui/icons-material/Person';
import WorkIcon from '@mui/icons-material/Work';
import { Box, Button, Container, Stack, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import React, { useEffect, useState } from 'react';

interface PublicStats {
  publicOrganizations: number;
  publicAlliances: number;
  publicFederations: number;
  users: number;
  publicJobListings: number;
  shipsTracked: number;
  fleetsTracked: number;
}

interface StatItemProps {
  icon: React.ReactNode;
  value: number;
  label: string;
}

function useCountUp(target: number, duration = 1500): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (target === 0) return;
    const startTime = performance.now();
    let animationId: number;

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(eased * target));

      if (progress < 1) {
        animationId = requestAnimationFrame(animate);
      }
    };

    animationId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationId);
  }, [target, duration]);

  return count;
}

const StatItem: React.FC<StatItemProps> = ({ icon, value, label }) => {
  const displayed = useCountUp(value);

  return (
    <Stack alignItems="center" spacing={0.5} sx={{ minWidth: { xs: '40%', sm: 120 } }}>
      <Box sx={{ color: 'primary.main', mb: 0.5 }}>{icon}</Box>
      <Typography
        variant="h4"
        sx={{
          fontWeight: 700,
          color: 'text.primary',
          fontSize: { xs: '1.5rem', md: '2rem' },
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {displayed.toLocaleString()}
      </Typography>
      <Typography
        variant="body2"
        sx={{
          color: 'text.secondary',
          textTransform: 'uppercase',
          letterSpacing: 1,
          fontSize: '0.7rem',
        }}
      >
        {label}
      </Typography>
    </Stack>
  );
};

export const StatsBar: React.FC = () => {
  const theme = useTheme();
  const [stats, setStats] = useState<PublicStats | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await apiClient.get<PublicStats>('/api/v2/public/stats');
        setStats(response.data);
      } catch (error) {
        logger.error('Failed to fetch public stats', error);
        // Fallback to zeros — stats bar still renders
      }
    };
    fetchStats();
  }, []);

  const data = stats ?? {
    publicOrganizations: 0,
    publicAlliances: 0,
    publicFederations: 0,
    users: 0,
    publicJobListings: 0,
    shipsTracked: 0,
    fleetsTracked: 0,
  };

  return (
    <Box
      sx={{
        py: { xs: 4, md: 6 },
        background: alpha(theme.palette.primary.main, 0.03),
        borderTop: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
        borderBottom: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
      }}
    >
      <Container maxWidth="md">
        <Stack
          direction="row"
          spacing={0}
          justifyContent="space-around"
          alignItems="center"
          sx={{ flexWrap: 'wrap', gap: { xs: 2, sm: 0 } }}
        >
          <StatItem icon={<GroupsIcon />} value={data.publicOrganizations} label="Orgs" />
          <StatItem icon={<HandshakeIcon />} value={data.publicAlliances} label="Alliances" />
          <StatItem icon={<PersonIcon />} value={data.users} label="Users" />
          <StatItem icon={<WorkIcon />} value={data.publicJobListings} label="Job Listings" />
        </Stack>

        {/* Support & Feedback */}
        <Stack
          direction="row"
          spacing={2}
          justifyContent="center"
          alignItems="center"
          sx={{ mt: 3, pt: 2, borderTop: `1px solid ${alpha(theme.palette.primary.main, 0.08)}` }}
        >
          <Button
            variant="outlined"
            size="small"
            startIcon={<FavoriteIcon sx={{ fontSize: 16 }} />}
            href="https://ko-fi.com/fringekofi"
            target="_blank"
            rel="noopener noreferrer"
            sx={{
              color: KOFI_RED,
              borderColor: `${KOFI_RED}44`,
              textTransform: 'none',
              fontWeight: 600,
              fontSize: '0.78rem',
              borderRadius: 2,
              px: 2,
              '&:hover': {
                borderColor: KOFI_RED,
                bgcolor: `${KOFI_RED}11`,
              },
            }}
          >
            Support on Ko-fi
          </Button>
          <Button
            variant="outlined"
            size="small"
            startIcon={<ForumIcon sx={{ fontSize: 16 }} />}
            href="https://discord.gg/EWavhFWq6p"
            target="_blank"
            rel="noopener noreferrer"
            sx={{
              color: 'text.secondary',
              borderColor: 'divider',
              textTransform: 'none',
              fontWeight: 600,
              fontSize: '0.78rem',
              borderRadius: 2,
              px: 2,
              '&:hover': {
                borderColor: 'info.light',
                color: 'info.light',
                bgcolor: alpha(theme.palette.info.light, 0.07),
              },
            }}
          >
            Feedback & Discussions
          </Button>
        </Stack>
      </Container>
    </Box>
  );
};
