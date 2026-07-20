import PhoneIphoneIcon from '@mui/icons-material/PhoneIphone';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Container,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Typography,
} from '@mui/material';
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

export const MobileDownload: React.FC = () => {
  return (
    <Container maxWidth="sm" sx={{ py: 6 }}>
      <Box sx={{ textAlign: 'center', mb: 4 }}>
        <PhoneIphoneIcon sx={{ fontSize: 64, color: 'primary.main', mb: 2 }} />
        <Typography variant="h4" gutterBottom>
          Fringe Core Mobile
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Manage your fleet on the go. Available for Android.
        </Typography>
      </Box>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Features
          </Typography>
          <List dense>
            {FEATURES.map((feature, i) => (
              <ListItem key={i}>
                <ListItemIcon sx={{ minWidth: 32 }}>
                  <Typography color="primary">✓</Typography>
                </ListItemIcon>
                <ListItemText primary={feature} />
              </ListItem>
            ))}
          </List>
        </CardContent>
      </Card>

      <Box sx={{ textAlign: 'center', mb: 3 }}>
        <Button
          variant="contained"
          size="large"
          component="a"
          href={DOWNLOAD_URL}
          target="_blank"
          rel="noopener noreferrer"
          download
          startIcon={<PhoneIphoneIcon />}
          sx={{ px: 4, py: 1.5, fontSize: '1.1rem' }}
        >
          Download APK
        </Button>
        <Typography variant="caption" display="block" sx={{ mt: 1 }} color="text.secondary">
          Android 8.0+ required · ~25 MB
        </Typography>
      </Box>

      <Alert severity="info" sx={{ mb: 3 }}>
        <Typography variant="body2">
          <strong>First time?</strong> Android may ask you to &quot;Allow installs from unknown
          sources&quot; — this is normal for apps downloaded outside Google Play. Go to Settings →
          Security → enable &quot;Install unknown apps&quot; for your browser.
        </Typography>
      </Alert>

      <Card variant="outlined">
        <CardContent>
          <Typography variant="subtitle2" gutterBottom>
            Installation Steps
          </Typography>
          <Typography variant="body2" component="ol" sx={{ pl: 2, '& li': { mb: 0.5 } }}>
            <li>Tap &quot;Download APK&quot; above</li>
            <li>Open the downloaded file from your notification bar</li>
            <li>Tap &quot;Install&quot; when prompted</li>
            <li>Open the app and log in with your Fringe Core account</li>
          </Typography>
        </CardContent>
      </Card>
    </Container>
  );
};
