/**
 * Account Settings Page
 * Manage account information, display name, and profile details
 */

import { selectUser, useAuthStore } from '@/store/authStore';
import { useNotification } from '@/store/uiStore';
import {
    ArrowBack as ArrowBackIcon,
    Business as BusinessIcon,
    Check as CheckIcon,
    Link as LinkIcon,
    LinkOff as LinkOffIcon,
    Person as PersonIcon,
} from '@mui/icons-material';
import {
    Alert,
    Box,
    Button,
    Chip,
    CircularProgress,
    Container,
    Divider,
    FormControl,
    IconButton,
    InputLabel,
    MenuItem,
    Paper,
    Select,
    Stack,
    TextField,
    Typography,
} from '@mui/material';
import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { useLinkedAccounts, useUnlinkAccount } from '@/hooks/queries/useUserQueries';
import { apiClient } from '@/services/apiClient';
import type { LinkedAccount } from '@/services/userProfileService';
import {
    DISCORD_BLUE,
    GOOGLE_BLUE,
    GOOGLE_GREEN,
    GOOGLE_RED,
    GOOGLE_YELLOW,
    TWITCH_PURPLE,
} from '@/utils/brandColors';
import { logger } from '@/utils/logger';
import { useQuery } from '@tanstack/react-query';

// Default to '' so OAuth redirects use a relative URL against the current origin
// (matches apiClient behaviour). Hardcoding 'http://localhost:3000' breaks deployed
// environments where VITE_API_URL is unset, sending users to localhost.
const BACKEND_URL = import.meta.env.VITE_API_URL || import.meta.env.VITE_BACKEND_URL || '';

/** Provider metadata for display */
const PROVIDER_META: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  discord: {
    label: 'Discord',
    color: DISCORD_BLUE,
    icon: (
      <svg width="20" height="20" viewBox="0 0 71 55" fill="none">
        <path
          d="M60.1 4.9C55.6 2.8 50.7 1.3 45.7.4c-.1 0-.2 0-.2.1-.6 1.1-1.3 2.6-1.8 3.7-5.5-.8-10.9-.8-16.3 0-.5-1.2-1.2-2.6-1.8-3.7 0-.1-.1-.1-.2-.1C20.3 1.3 15.4 2.8 10.9 4.9c0 0-.1 0-.1.1C1.6 18.7-.9 32.1.3 45.4v.2C6.5 50 12.3 52.7 18.1 54.5c.1 0 .2 0 .2-.1 1.4-1.9 2.6-3.8 3.6-5.9.1-.1 0-.3-.1-.3-2-.7-3.8-1.6-5.6-2.7-.1-.1-.1-.3 0-.4.4-.3.8-.6 1.1-.9.1-.1.1-.1.2-.1 11.6 5.3 24.2 5.3 35.7 0h.2c.4.3.7.6 1.1.9.1.1.1.3 0 .4-1.8 1-3.6 2-5.6 2.7-.1 0-.2.2-.1.3 1.1 2.1 2.3 4 3.6 5.9 0 .1.1.1.2.1 5.8-1.8 11.7-4.5 17.8-9h.1C72.2 30.1 68.2 16.8 60.2 5c0-.1 0-.1-.1-.1z"
          fill="currentColor"
        />
      </svg>
    ),
  },
  google: {
    label: 'Google',
    color: GOOGLE_BLUE,
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24">
        <path
          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
          fill={GOOGLE_BLUE}
        />
        <path
          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          fill={GOOGLE_GREEN}
        />
        <path
          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
          fill={GOOGLE_YELLOW}
        />
        <path
          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
          fill={GOOGLE_RED}
        />
      </svg>
    ),
  },
  twitch: {
    label: 'Twitch',
    color: TWITCH_PURPLE,
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24">
        <path
          d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z"
          fill="currentColor"
        />
      </svg>
    ),
  },
};

/** All supported providers in display order */
const ALL_PROVIDERS = ['discord', 'google', 'twitch'] as const;

/**
 * Connected Accounts section — shows linked OAuth providers with connect/disconnect controls
 */
const ConnectedAccountsSection: React.FC = () => {
  const { data, isLoading, error } = useLinkedAccounts();
  const unlinkMutation = useUnlinkAccount();
  const [searchParams, setSearchParams] = useSearchParams();
  const notification = useNotification();

  // Handle OAuth redirect query params (?linked=discord or ?error=account_already_linked)
  useEffect(() => {
    const linked = searchParams.get('linked');
    const errorParam = searchParams.get('error');

    if (linked) {
      const label = PROVIDER_META[linked]?.label ?? linked;
      notification.success(`${label} account linked successfully.`);
      setSearchParams({}, { replace: true });
    } else if (errorParam === 'account_already_linked') {
      notification.error('That account is already linked to another user.');
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams, notification]);

  const linkedProviders = new Set(data?.accounts?.map((a: LinkedAccount) => a.provider) ?? []);

  const handleConnect = (provider: string) => {
    globalThis.location.href = `${BACKEND_URL}/api/v2/auth/${provider}`;
  };

  const handleDisconnect = (provider: string) => {
    unlinkMutation.mutate(provider);
  };

  return (
    <Paper
      sx={{
        p: 3,
        mt: 3,
        bgcolor: 'var(--nav-bg)',
        border: '1px solid var(--nav-border)',
      }}
    >
      <Typography variant="h6" sx={{ mb: 0.5, display: 'flex', alignItems: 'center', gap: 1 }}>
        <LinkIcon sx={{ color: 'var(--accent-cyan)' }} />
        Connected Accounts
      </Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
        Link your accounts for additional sign-in options.
      </Typography>
      <Divider sx={{ mb: 2 }} />

      {isLoading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
          <CircularProgress size={24} />
        </Box>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Failed to load connected accounts.
        </Alert>
      )}

      {unlinkMutation.isError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {unlinkMutation.error?.message || 'Failed to unlink account.'}
        </Alert>
      )}

      {unlinkMutation.isSuccess && (
        <Alert severity="success" sx={{ mb: 2 }}>
          Account unlinked successfully.
        </Alert>
      )}

      {!isLoading && (
        <Stack spacing={1.5}>
          {ALL_PROVIDERS.map(provider => {
            const meta = PROVIDER_META[provider];
            const isLinked = linkedProviders.has(provider);
            const isPrimary = provider === 'discord' && isLinked;

            return (
              <Box
                key={provider}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  p: 1.5,
                  borderRadius: 1,
                  border: '1px solid',
                  borderColor: isLinked ? `${meta.color}40` : 'divider',
                  bgcolor: isLinked ? `${meta.color}10` : 'transparent',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Box sx={{ color: meta.color, display: 'flex', alignItems: 'center' }}>
                    {meta.icon}
                  </Box>
                  <Box>
                    <Typography variant="body1" sx={{ fontWeight: 600 }}>
                      {meta.label}
                    </Typography>
                    {isLinked && (
                      <Chip
                        icon={<CheckIcon sx={{ fontSize: 14 }} />}
                        label={isPrimary ? 'Primary' : 'Connected'}
                        size="small"
                        color={isPrimary ? 'primary' : 'success'}
                        variant="outlined"
                        sx={{ mt: 0.5, height: 22, fontSize: 11 }}
                      />
                    )}
                  </Box>
                </Box>

                {isLinked ? (
                  <Button
                    size="small"
                    variant="outlined"
                    color="error"
                    startIcon={<LinkOffIcon />}
                    disabled={isPrimary || unlinkMutation.isPending}
                    onClick={() => handleDisconnect(provider)}
                    sx={{ textTransform: 'none' }}
                  >
                    {isPrimary ? 'Primary' : 'Disconnect'}
                  </Button>
                ) : (
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<LinkIcon />}
                    onClick={() => handleConnect(provider)}
                    sx={{
                      textTransform: 'none',
                      borderColor: meta.color,
                      color: meta.color,
                      '&:hover': { borderColor: meta.color, bgcolor: `${meta.color}10` },
                    }}
                  >
                    Connect
                  </Button>
                )}
              </Box>
            );
          })}
        </Stack>
      )}
    </Paper>
  );
};

export const AccountSettings: React.FC = () => {
  const navigate = useNavigate();
  const user = useAuthStore(selectUser);
  const tryAuthWithCookies = useAuthStore(state => state.tryAuthWithCookies);
  const [displayName, setDisplayName] = useState(user?.username || '');
  const [rsiHandle, setRsiHandle] = useState(user?.rsiHandle || '');
  const [isSaving, setIsSaving] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);
  const notification = useNotification();

  // Fetch user's organizations for the org switcher
  const { data: orgsResponse } = useQuery({
    queryKey: ['users', 'me', 'organizations'],
    queryFn: async () => {
      const res = await apiClient.get<Record<string, unknown>>('/api/v2/users/me/organizations');
      return res.data;
    },
  });

  const userOrgs = (() => {
    const raw = orgsResponse;
    if (Array.isArray(raw)) return raw as Array<Record<string, unknown>>;
    if (raw && typeof raw === 'object') {
      const inner = raw?.data;
      if (Array.isArray(inner)) return inner as Array<Record<string, unknown>>;
    }
    return [];
  })();

  const hasMultipleOrgs = userOrgs.length > 1;

  const handleSwitchOrg = async (orgId: string) => {
    if (orgId === user?.activeOrgId) return;
    setIsSwitching(true);
    try {
      await apiClient.put('/api/v2/users/me/active-organization', { organizationId: orgId });
      // Refresh the auth store to get updated orgRole/orgName
      await tryAuthWithCookies();
      notification.success('Organization switched successfully. Reloading...');
      // Reload after a short delay to refresh all org-scoped data
      setTimeout(() => globalThis.location.reload(), 1000);
    } catch (err) {
      logger.error('Failed to switch org', err instanceof Error ? err : new Error(String(err)));
      notification.error('Failed to switch organization.');
    } finally {
      setIsSwitching(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // FUTURE: Integrate with user profile update API
      notification.success('Account settings saved successfully.');
    } catch {
      notification.error('Failed to save settings. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Container maxWidth="sm" sx={{ py: 4 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <IconButton
          onClick={() => navigate('/settings')}
          sx={{ mr: 1 }}
          aria-label="Back to settings"
        >
          <ArrowBackIcon />
        </IconButton>
        <PersonIcon sx={{ color: 'var(--accent-cyan)', mr: 1 }} />
        <Typography variant="h5" component="h1" sx={{ fontWeight: 'bold' }}>
          Account Settings
        </Typography>
      </Box>

      <Paper
        sx={{
          p: 3,
          bgcolor: 'var(--nav-bg)',
          border: '1px solid var(--nav-border)',
        }}
      >
        <Typography variant="h6" sx={{ mb: 2 }}>
          Profile Information
        </Typography>
        <Divider sx={{ mb: 3 }} />

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            label="Display Name"
            value={displayName}
            onChange={e => setDisplayName(e.target.value)}
            fullWidth
            helperText="This name is visible to other users"
          />
          <TextField
            label="RSI Handle"
            value={rsiHandle}
            onChange={e => setRsiHandle(e.target.value)}
            fullWidth
            helperText="Your Star Citizen in-game handle"
          />
          <TextField
            label="Email"
            value={user?.email || ''}
            fullWidth
            disabled
            helperText="Email cannot be changed here"
          />
        </Box>

        <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={isSaving}
            sx={{ bgcolor: 'var(--accent-cyan)' }}
          >
            {isSaving ? 'Saving...' : 'Save Changes'}
          </Button>
        </Box>
      </Paper>

      {/* Connected Accounts */}
      <ConnectedAccountsSection />

      {/* Organization Switcher — visible for multi-org members */}
      {hasMultipleOrgs && (
        <Paper
          sx={{
            p: 3,
            mt: 3,
            bgcolor: 'var(--nav-bg)',
            border: '1px solid var(--nav-border)',
          }}
        >
          <Typography variant="h6" sx={{ mb: 0.5, display: 'flex', alignItems: 'center', gap: 1 }}>
            <BusinessIcon sx={{ color: 'var(--accent-cyan)' }} />
            Active Organization
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
            Switch between organizations you belong to. All org-scoped pages will reflect the
            selected organization.
          </Typography>
          <Divider sx={{ mb: 2 }} />

          <FormControl fullWidth>
            <InputLabel>Organization</InputLabel>
            <Select
              value={user?.activeOrgId ?? ''}
              label="Organization"
              onChange={e => handleSwitchOrg(e.target.value)}
              disabled={isSwitching}
            >
              {userOrgs.map(org => (
                <MenuItem key={String(org.id)} value={String(org.id)}>
                  {String(org.name ?? org.id)}
                  {String(org.role ?? '') === 'owner' || String(org.role ?? '') === 'founder'
                    ? ' (Owner)'
                    : ''}
                  {org.isActive ? ' ✓' : ''}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {isSwitching && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1.5 }}>
              <CircularProgress size={16} />
              <Typography variant="body2" color="text.secondary">
                Switching organization...
              </Typography>
            </Box>
          )}
        </Paper>
      )}
    </Container>
  );
};

import { FeatureErrorBoundary } from '@/components/FeatureErrorBoundary';

export const AccountSettingsWithErrorBoundary: React.FC = () => (
  <FeatureErrorBoundary featureName="Account Settings">
    <AccountSettings />
  </FeatureErrorBoundary>
);
