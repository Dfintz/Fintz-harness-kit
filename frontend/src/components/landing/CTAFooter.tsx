/**
 * CTA Footer
 *
 * Final call-to-action section at the bottom of the landing page.
 */

import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import { Box, Button, Container, Link, Stack, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import React from 'react';
import { useNavigate } from 'react-router-dom';

export const CTAFooter: React.FC = () => {
  const theme = useTheme();
  const navigate = useNavigate();

  return (
    <Box
      sx={{
        py: { xs: 8, md: 12 },
        textAlign: 'center',
        position: 'relative',
      }}
    >
      {/* Glow effect */}
      <Box
        sx={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 400,
          height: 400,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${alpha(theme.palette.primary.main, 0.06)} 0%, transparent 70%)`,
          pointerEvents: 'none',
        }}
      />

      <Container maxWidth="sm" sx={{ position: 'relative', zIndex: 1 }}>
        <Typography
          variant="h3"
          sx={{
            fontWeight: 700,
            mb: 2,
            color: 'text.primary',
            fontSize: { xs: '1.75rem', md: '2.5rem' },
          }}
        >
          Ready to Lead Your Fleet?
        </Typography>
        <Typography variant="body1" sx={{ color: 'text.secondary', mb: 4 }}>
          Join organizations already using Fringe Core to manage their Star Citizen operations.
        </Typography>

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="center">
          <Button
            variant="contained"
            size="large"
            startIcon={<RocketLaunchIcon />}
            onClick={() => navigate('/login')}
            sx={{
              px: 5,
              py: 1.5,
              fontSize: '1.1rem',
              fontWeight: 700,
              borderRadius: 2,
              textTransform: 'none',
            }}
          >
            Get Started Free
          </Button>
        </Stack>
      </Container>

      {/* Minimal footer */}
      <Box sx={{ mt: 8, pt: 4, borderTop: `1px solid ${alpha(theme.palette.primary.main, 0.1)}` }}>
        <Stack
          direction="row"
          spacing={2}
          justifyContent="center"
          alignItems="center"
          sx={{ mb: 1 }}
        >
          <Link
            component="button"
            variant="caption"
            onClick={() => navigate('/changelog')}
            sx={{
              color: 'text.secondary',
              textDecoration: 'none',
              '&:hover': { color: 'primary.main' },
            }}
          >
            What&apos;s New
          </Link>
          <Typography variant="caption" sx={{ color: 'text.disabled' }}>
            ·
          </Typography>
          <Link
            component="button"
            variant="caption"
            onClick={() => navigate('/directory')}
            sx={{
              color: 'text.secondary',
              textDecoration: 'none',
              '&:hover': { color: 'primary.main' },
            }}
          >
            Directory
          </Link>
          <Typography variant="caption" sx={{ color: 'text.disabled' }}>
            ·
          </Typography>
          <Link
            component="button"
            variant="caption"
            onClick={() => navigate('/public/stats')}
            sx={{
              color: 'text.secondary',
              textDecoration: 'none',
              '&:hover': { color: 'primary.main' },
            }}
          >
            Stats
          </Link>
        </Stack>
        <Typography variant="caption" sx={{ color: 'text.disabled' }}>
          © {new Date().getFullYear()} Fringe Core · Not affiliated with Cloud Imperium Games
        </Typography>
      </Box>
    </Box>
  );
};
