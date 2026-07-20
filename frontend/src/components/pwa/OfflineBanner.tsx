import { useOnlineStatus } from '@/hooks/useOfflineSupport';
import { WifiOff as OfflineIcon } from '@mui/icons-material';
import { Alert, Snackbar } from '@mui/material';
import React from 'react';

export const OfflineBanner: React.FC = () => {
  const { isOnline, wasOffline } = useOnlineStatus();

  const showOffline = !isOnline;
  const showReconnected = isOnline && wasOffline;

  return (
    <>
      <Snackbar
        open={showOffline}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert severity="warning" icon={<OfflineIcon />} sx={{ width: '100%' }}>
          You are offline. Some features may be unavailable.
        </Alert>
      </Snackbar>
      <Snackbar
        open={showReconnected}
        autoHideDuration={4000}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert severity="success" sx={{ width: '100%' }}>
          Connection restored
        </Alert>
      </Snackbar>
    </>
  );
};
