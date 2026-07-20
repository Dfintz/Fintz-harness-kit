import AndroidIcon from '@mui/icons-material/Android';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import CloudDownloadIcon from '@mui/icons-material/CloudDownload';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import PhoneIphoneIcon from '@mui/icons-material/PhoneIphone';
import SecurityIcon from '@mui/icons-material/Security';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Container,
  Grid,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import React from 'react';

import { FeatureErrorBoundary } from '@/components/FeatureErrorBoundary';

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

const INSTALL_STEPS = [
  'Tap "Download APK" below to start the download.',
  'Open the downloaded file from your notification bar or file manager.',
  'If prompted, allow installs from unknown sources in your device settings.',
  'Tap "Install" when prompted.',
  'Open the app and log in with your Fringe Core account.',
];

export const MobileApp: React.FC = () => {
  const theme = useTheme();

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      {/* Header */}
      <Box sx={{ textAlign: 'center', mb: 4 }}>
        <PhoneIphoneIcon sx={{ fontSize: 56, color: 'primary.main', mb: 1 }} />
        <Typography variant="h4" component="h1" sx={{ fontWeight: 'bold', mb: 1 }}>
          Fringe Core Mobile
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 480, mx: 'auto' }}>
          Take fleet management on the go. Download the companion app for Android and stay connected
          with your organization anywhere.
        </Typography>
      </Box>

      {/* Download Card */}
      <Paper
        elevation={0}
        sx={{
          p: 4,
          mb: 4,
          textAlign: 'center',
          borderRadius: 3,
          border: 1,
          borderColor: 'primary.main',
          background: `linear-gradient(135deg, ${theme.palette.background.paper} 0%, ${theme.palette.action.hover} 100%)`,
        }}
      >
        <Stack
          direction="row"
          spacing={1}
          justifyContent="center"
          alignItems="center"
          sx={{ mb: 2 }}
        >
          <AndroidIcon sx={{ color: 'success.main' }} />
          <Typography variant="h6">Android</Typography>
          <Chip label="Available" color="success" size="small" />
        </Stack>
        <Button
          variant="contained"
          size="large"
          component="a"
          href={DOWNLOAD_URL}
          target="_blank"
          rel="noopener noreferrer"
          download
          startIcon={<CloudDownloadIcon />}
          sx={{ px: 5, py: 1.5, fontSize: '1.1rem', borderRadius: 2, mb: 1.5 }}
        >
          Download APK
        </Button>
        <Typography variant="caption" display="block" color="text.secondary">
          Android 8.0+ required · ~25 MB
        </Typography>
      </Paper>

      <Grid container spacing={3} sx={{ mb: 4 }}>
        {/* Features */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Card variant="outlined" sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
                Features
              </Typography>
              <List dense disablePadding>
                {FEATURES.map((feature, i) => (
                  <ListItem key={i} disableGutters sx={{ py: 0.5 }}>
                    <ListItemIcon sx={{ minWidth: 32 }}>
                      <CheckCircleOutlineIcon fontSize="small" color="primary" />
                    </ListItemIcon>
                    <ListItemText primary={feature} />
                  </ListItem>
                ))}
              </List>
            </CardContent>
          </Card>
        </Grid>

        {/* Installation Steps */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Card variant="outlined" sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
                Installation
              </Typography>
              <List dense disablePadding>
                {INSTALL_STEPS.map((step, i) => (
                  <ListItem key={i} disableGutters sx={{ py: 0.5, alignItems: 'flex-start' }}>
                    <ListItemIcon sx={{ minWidth: 28, mt: 0.5 }}>
                      <Typography variant="body2" color="primary" sx={{ fontWeight: 'bold' }}>
                        {i + 1}.
                      </Typography>
                    </ListItemIcon>
                    <ListItemText primary={step} />
                  </ListItem>
                ))}
              </List>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Info Alerts */}
      <Stack spacing={2}>
        <Alert severity="info" icon={<SecurityIcon />}>
          <Typography variant="body2">
            <strong>Sideloading notice:</strong> Android may ask you to allow installs from unknown
            sources. This is normal for apps distributed outside Google Play. Go to{' '}
            <strong>Settings → Security → Install unknown apps</strong> and enable it for your
            browser.
          </Typography>
        </Alert>
        <Alert severity="info" icon={<InfoOutlinedIcon />}>
          <Typography variant="body2">
            Log in with the same account you use on the web. Your fleet data, organization
            membership, and settings sync automatically.
          </Typography>
        </Alert>
      </Stack>
    </Container>
  );
};

export const MobileAppWithErrorBoundary: React.FC = () => (
  <FeatureErrorBoundary featureName="Mobile App">
    <MobileApp />
  </FeatureErrorBoundary>
);
