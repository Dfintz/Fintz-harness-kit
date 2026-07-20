import { useAppUpdate } from '@/hooks/useAppUpdate';
import { Refresh as RefreshIcon } from '@mui/icons-material';
import { Alert, Button, Snackbar } from '@mui/material';
import React from 'react';

/**
 * Prompts the user to refresh when a new version of the app has been deployed.
 * Rendered globally in App.tsx alongside OfflineBanner and PWAInstallPrompt.
 */
export const AppUpdateBanner: React.FC = () => {
  const { needRefresh, updateApp, dismiss } = useAppUpdate();

  return (
    <Snackbar
      open={needRefresh}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
    >
      <Alert
        severity="info"
        icon={<RefreshIcon />}
        action={
          <>
            <Button color="inherit" size="small" onClick={dismiss}>
              Later
            </Button>
            <Button
              color="inherit"
              size="small"
              variant="outlined"
              onClick={updateApp}
            >
              Refresh
            </Button>
          </>
        }
        sx={{ width: '100%' }}
      >
        A new version is available. Refresh to get the latest features.
      </Alert>
    </Snackbar>
  );
};
