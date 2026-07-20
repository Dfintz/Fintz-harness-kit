import { GetApp as InstallIcon } from '@mui/icons-material';
import { Alert, Button, Snackbar } from '@mui/material';
import React, { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export const PWAInstallPrompt: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem('pwa-install-dismissed') === 'true';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      if (!dismissed) {
        setShowPrompt(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, [dismissed]);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
    setShowPrompt(false);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    setDismissed(true);
    try {
      localStorage.setItem('pwa-install-dismissed', 'true');
    } catch {
      // Ignore storage errors
    }
  };

  return (
    <Snackbar open={showPrompt} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
      <Alert
        severity="info"
        icon={<InstallIcon />}
        action={
          <>
            <Button color="inherit" size="small" onClick={handleDismiss}>
              Later
            </Button>
            <Button color="inherit" size="small" variant="outlined" onClick={handleInstall}>
              Install
            </Button>
          </>
        }
        sx={{ width: '100%' }}
      >
        Install Fringe Core for a better experience
      </Alert>
    </Snackbar>
  );
};
