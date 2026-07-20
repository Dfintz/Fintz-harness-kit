/**
 * Settings Page — Tabbed settings hub
 *
 * Consolidates Account, Privacy, Security, Notifications, and API Keys
 * into a single page with tab navigation. Individual /account-settings,
 * /security, etc. routes redirect here via ?tab= query param.
 */

import { FeatureErrorBoundary } from '@/components/FeatureErrorBoundary';
import { retryLazy } from '@/utils/retryLazy';
import {
  VpnKey as KeyIcon,
  Lock as LockIcon,
  Notifications as NotificationsIcon,
  Person as PersonIcon,
  Security as SecurityIcon,
} from '@mui/icons-material';
import { Box, Container, Tab, Tabs, Typography, useMediaQuery } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import React, { Suspense, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

// Lazy-load each settings sub-page for code splitting
const AccountSettings = retryLazy(() =>
  import('./AccountSettings').then(m => ({ default: m.AccountSettings }))
);
const PrivacySettings = retryLazy(() =>
  import('./PrivacySettings').then(m => ({ default: m.PrivacySettingsWithErrorBoundary }))
);
const SecuritySettings = retryLazy(() =>
  import('./SecuritySettings').then(m => ({ default: m.SecuritySettings }))
);
const NotificationSettings = retryLazy(() =>
  import('./NotificationSettings').then(m => ({ default: m.NotificationSettings }))
);
const ApiKeysSettings = retryLazy(() =>
  import('./ApiKeysSettings').then(m => ({ default: m.ApiKeysSettings }))
);

interface SettingsTab {
  id: string;
  label: string;
  icon: React.ReactElement;
  component: React.LazyExoticComponent<React.ComponentType>;
  disabled?: boolean;
}

const SETTINGS_TABS: SettingsTab[] = [
  { id: 'account', label: 'Account', icon: <PersonIcon />, component: AccountSettings },
  { id: 'privacy', label: 'Privacy & Data', icon: <LockIcon />, component: PrivacySettings },
  { id: 'security', label: 'Security', icon: <SecurityIcon />, component: SecuritySettings },
  { id: 'notifications', label: 'Notifications', icon: <NotificationsIcon />, component: NotificationSettings },
  { id: 'api-keys', label: 'API Keys', icon: <KeyIcon />, component: ApiKeysSettings },
];

export const SettingsPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const activeTabId = searchParams.get('tab') ?? 'account';
  const activeTabIndex = useMemo(
    () => Math.max(0, SETTINGS_TABS.findIndex(t => t.id === activeTabId)),
    [activeTabId]
  );

  const handleTabChange = (_event: React.SyntheticEvent, newIndex: number) => {
    const tab = SETTINGS_TABS[newIndex];
    if (tab && !tab.disabled) {
      setSearchParams({ tab: tab.id }, { replace: true });
    }
  };

  const ActiveComponent = SETTINGS_TABS[activeTabIndex]?.component;

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" component="h1" sx={{ fontWeight: 'bold', mb: 1 }}>
          Settings
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Manage your account preferences and security
        </Typography>
      </Box>

      <Tabs
        value={activeTabIndex}
        onChange={handleTabChange}
        variant={isMobile ? 'scrollable' : 'standard'}
        scrollButtons={isMobile ? 'auto' : false}
        sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}
      >
        {SETTINGS_TABS.map(tab => (
          <Tab
            key={tab.id}
            icon={tab.icon}
            iconPosition="start"
            label={tab.label}
            disabled={tab.disabled}
            sx={{ textTransform: 'none', minHeight: 48 }}
          />
        ))}
      </Tabs>

      {ActiveComponent && (
        <Suspense fallback={<Box sx={{ py: 4, textAlign: 'center' }}>Loading...</Box>}>
          <ActiveComponent />
        </Suspense>
      )}
    </Container>
  );
};

export const SettingsPageWithErrorBoundary: React.FC = () => (
  <FeatureErrorBoundary featureName="Settings">
    <SettingsPage />
  </FeatureErrorBoundary>
);
