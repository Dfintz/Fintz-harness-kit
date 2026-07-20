/**
 * Mobile App Preview
 *
 * Landing page section showcasing the mobile companion app with download CTA.
 */

import AndroidIcon from '@mui/icons-material/Android';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import PhoneIphoneIcon from '@mui/icons-material/PhoneIphone';
import {
  Box,
  Button,
  Chip,
  Container,
  Grid,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Stack,
  Typography,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import React from 'react';

const DOWNLOAD_URL =
  import.meta.env.VITE_MOBILE_APK_URL ||
  'https://fringecore.space/mobile/sc-fleet-manager-latest.apk';

const FEATURES = [
  'View fleet stats, ships, and composition',
  'Browse organization members and profiles',
  'Real-time chat with your fleet',
  'Push notifications and alerts',
  'Profile and settings management',
  'Pull-to-refresh on every screen',
];

export const MobileAppPreview: React.FC = () => {
  const theme = useTheme();

  return (
    <Box sx={{ py: { xs: 8, md: 12 } }}>
      <Container maxWidth="lg">
        <Grid container spacing={6} alignItems="center">
          {/* Left — description */}
          <Grid size={{ xs: 12, md: 5 }}>
            <Stack spacing={3}>
              <Stack direction="row" spacing={1.5} alignItems="center">
                <PhoneIphoneIcon sx={{ fontSize: 32, color: 'primary.main' }} />
                <Typography
                  variant="h4"
                  sx={{
                    fontWeight: 700,
                    color: 'text.primary',
                    fontSize: { xs: '1.5rem', md: '2rem' },
                  }}
                >
                  Mobile Companion
                </Typography>
              </Stack>
              <Typography variant="body1" sx={{ color: 'text.secondary', lineHeight: 1.7 }}>
                Take fleet management on the go. The Fringe Core companion app lets you stay
                connected with your organization, monitor your fleet, and chat in real time —
                straight from your phone.
              </Typography>

              <Stack direction="row" spacing={2} alignItems="center">
                <Button
                  variant="contained"
                  size="large"
                  component="a"
                  href={DOWNLOAD_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  download
                  startIcon={<AndroidIcon />}
                  sx={{
                    px: 4,
                    py: 1.5,
                    fontWeight: 700,
                    textTransform: 'none',
                    borderRadius: 2,
                  }}
                >
                  Download APK
                </Button>
                <Chip label="Android 8.0+" size="small" variant="outlined" />
              </Stack>
            </Stack>
          </Grid>

          {/* Right — feature list */}
          <Grid size={{ xs: 12, md: 7 }}>
            <Box
              sx={{
                borderRadius: 2,
                p: 3,
                background: alpha(theme.palette.background.default, 0.6),
                backdropFilter: 'blur(12px)',
                border: `1px solid ${alpha(theme.palette.primary.main, 0.15)}`,
              }}
            >
              <Typography
                variant="subtitle1"
                sx={{ fontWeight: 600, mb: 2, color: 'text.primary' }}
              >
                What you can do
              </Typography>
              <List dense disablePadding>
                {FEATURES.map(feature => (
                  <ListItem key={feature} disableGutters sx={{ py: 0.5 }}>
                    <ListItemIcon sx={{ minWidth: 32 }}>
                      <CheckCircleOutlineIcon fontSize="small" color="primary" />
                    </ListItemIcon>
                    <ListItemText
                      primary={feature}
                      slotProps={{ primary: { color: 'text.secondary' } }}
                    />
                  </ListItem>
                ))}
              </List>
            </Box>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
};
