/**
 * Notification Settings Page — D5: Per-user channel/category toggles
 *
 * Persisted via `PUT /api/v2/notifications/preferences/user`.
 * Features: Mute All master toggle, per-channel toggles, per-category toggles,
 * digest frequency selector. Loads on mount, saves on explicit button press.
 */

import {
  ArrowBack as ArrowBackIcon,
  Email as EmailIcon,
  VolumeOff as MuteIcon,
  Notifications as NotificationsIcon,
  NotificationsOff as NotificationsOffIcon,
} from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Container,
  Divider,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  type SelectChangeEvent,
  Stack,
  Switch,
  Typography,
} from '@mui/material';
import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import type {
  NotificationCategories,
  NotificationChannels,
  NotificationPreferences,
} from '@/services/notificationService';
import { notificationService } from '@/services/notificationService';
import { selectUser, useAuthStore } from '@/store';

// ── Labels / descriptions ─────────────────────────────────────────────────

const CHANNEL_META: Record<keyof NotificationChannels, { label: string; description: string }> = {
  inApp: { label: 'In-App', description: 'Notifications in the notification center (bell icon)' },
  email: { label: 'Email', description: 'Receive notifications via email' },
  discord: { label: 'Discord', description: 'Receive DMs or channel messages via Discord bot' },
};

const CATEGORY_META: Record<keyof NotificationCategories, { label: string; description: string }> =
  {
    fleet: {
      label: 'Fleet Updates',
      description: 'Fleet creation, deployment, and ship assignments',
    },
    activity: {
      label: 'Activity Invitations',
      description: 'Invitations, completions, and cancellations',
    },
    organization: {
      label: 'Organization',
      description: 'Announcements, member joins/leaves, role changes',
    },
    trade: { label: 'Trading', description: 'Trade operations and route status changes' },
    social: { label: 'Social', description: 'Contact requests and messages' },
    security: { label: 'Security', description: 'Login alerts, password changes, and 2FA events' },
    lfg: {
      label: 'LFG (Looking for Group)',
      description: 'New LFG posts, group status changes, and matchmaking suggestions',
    },
    system: {
      label: 'System (always on)',
      description: 'Maintenance, updates, and admin notices — cannot be disabled',
    },
  };

// ── Component ─────────────────────────────────────────────────────────────

export const NotificationSettings: React.FC = () => {
  const navigate = useNavigate();
  const user = useAuthStore(selectUser);
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saveMessage, setSaveMessage] = useState('');
  const [dirty, setDirty] = useState(false);

  // ── Load preferences — wait for auth state before fetching ────────────
  useEffect(() => {
    if (!user?.id) return; // don't attempt until authenticated
    let cancelled = false;
    (async () => {
      try {
        const data = await notificationService.getPreferences();
        if (!cancelled) {
          setPrefs(data);
          setError('');
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setError('Failed to load notification preferences.');
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  // ── Mutators ───────────────────────────────────────────────────────────

  const toggleMuteAll = useCallback(() => {
    setPrefs(p => (p ? { ...p, muteAll: !p.muteAll } : p));
    setDirty(true);
  }, []);

  const toggleChannel = useCallback((ch: keyof NotificationChannels) => {
    setPrefs(p => (p ? { ...p, channels: { ...p.channels, [ch]: !p.channels[ch] } } : p));
    setDirty(true);
  }, []);

  const toggleCategory = useCallback((cat: keyof NotificationCategories) => {
    if (cat === 'system') return; // system can never be disabled
    setPrefs(p => (p ? { ...p, categories: { ...p.categories, [cat]: !p.categories[cat] } } : p));
    setDirty(true);
  }, []);

  const changeDigest = useCallback((e: SelectChangeEvent) => {
    const val = e.target.value as 'daily' | 'weekly' | 'none';
    setPrefs(p => (p ? { ...p, digestFrequency: val } : p));
    setDirty(true);
  }, []);

  // ── Save ───────────────────────────────────────────────────────────────

  const handleSave = useCallback(async () => {
    if (!prefs) return;
    setSaving(true);
    setSaveMessage('');
    try {
      const updated = await notificationService.updatePreferences({
        muteAll: prefs.muteAll,
        channels: prefs.channels,
        categories: prefs.categories,
        digestFrequency: prefs.digestFrequency,
      });
      setPrefs(updated);
      setDirty(false);
      setSaveMessage('Preferences saved successfully.');
    } catch {
      setSaveMessage('Failed to save preferences. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [prefs]);

  // ── Render ──────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <Container maxWidth="sm" sx={{ py: 4, textAlign: 'center' }}>
        <CircularProgress size={40} />
      </Container>
    );
  }

  if (error || !prefs) {
    return (
      <Container maxWidth="sm" sx={{ py: 4 }}>
        <Alert severity="error">{error || 'Could not load preferences.'}</Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="sm" sx={{ py: 4 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <IconButton
          onClick={() => navigate('/settings')}
          sx={{ mr: 1 }}
          aria-label="Back to settings"
        >
          <ArrowBackIcon />
        </IconButton>
        <NotificationsIcon sx={{ color: 'var(--accent-cyan)', mr: 1 }} />
        <Typography variant="h5" component="h1" sx={{ fontWeight: 'bold' }}>
          Notifications
        </Typography>
      </Box>

      {/* Mute All */}
      <Paper
        sx={{
          p: 3,
          mb: 2,
          bgcolor: prefs.muteAll ? 'rgba(255,82,82,0.08)' : 'var(--nav-bg)',
          border: '1px solid',
          borderColor: prefs.muteAll ? 'error.main' : 'var(--nav-border)',
        }}
      >
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Stack direction="row" alignItems="center" spacing={1}>
            <MuteIcon color={prefs.muteAll ? 'error' : 'disabled'} />
            <Box>
              <Typography variant="subtitle1" fontWeight={600}>
                Mute All Notifications
              </Typography>
              <Typography variant="body2" sx={{ color: 'var(--text-secondary)' }}>
                Silences everything except system-critical alerts
              </Typography>
            </Box>
          </Stack>
          <Switch
            checked={prefs.muteAll}
            onChange={toggleMuteAll}
            color="error"
            slotProps={{ input: { 'aria-label': 'Mute all notifications' } }}
          />
        </Stack>
      </Paper>

      {/* Channels */}
      <Paper
        sx={{
          p: 3,
          mb: 2,
          bgcolor: 'var(--nav-bg)',
          border: '1px solid var(--nav-border)',
          opacity: prefs.muteAll ? 0.5 : 1,
          pointerEvents: prefs.muteAll ? 'none' : 'auto',
        }}
      >
        <Typography variant="h6" sx={{ mb: 1 }}>
          Delivery Channels
        </Typography>
        <Divider sx={{ mb: 2 }} />

        {(Object.keys(CHANNEL_META) as Array<keyof NotificationChannels>).map(ch => (
          <Stack
            key={ch}
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            sx={{ py: 1 }}
          >
            <Box>
              <Typography variant="body1">{CHANNEL_META[ch].label}</Typography>
              <Typography variant="body2" sx={{ color: 'var(--text-secondary)' }}>
                {CHANNEL_META[ch].description}
              </Typography>
            </Box>
            <Switch
              checked={prefs.channels[ch]}
              onChange={() => toggleChannel(ch)}
              color="primary"
              slotProps={{
                input: { 'aria-label': `Toggle ${CHANNEL_META[ch].label} notifications` },
              }}
            />
          </Stack>
        ))}
      </Paper>

      {/* Categories */}
      <Paper
        sx={{
          p: 3,
          mb: 2,
          bgcolor: 'var(--nav-bg)',
          border: '1px solid var(--nav-border)',
          opacity: prefs.muteAll ? 0.5 : 1,
          pointerEvents: prefs.muteAll ? 'none' : 'auto',
        }}
      >
        <Typography variant="h6" sx={{ mb: 1 }}>
          Notification Categories
        </Typography>
        <Divider sx={{ mb: 2 }} />

        {(Object.keys(CATEGORY_META) as Array<keyof NotificationCategories>).map(cat => (
          <Stack
            key={cat}
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            sx={{ py: 1 }}
          >
            <Box>
              <Typography variant="body1">{CATEGORY_META[cat].label}</Typography>
              <Typography variant="body2" sx={{ color: 'var(--text-secondary)' }}>
                {CATEGORY_META[cat].description}
              </Typography>
            </Box>
            <Switch
              checked={cat === 'system' ? true : (prefs.categories[cat] ?? true)}
              onChange={() => toggleCategory(cat)}
              disabled={cat === 'system'}
              color="primary"
              slotProps={{ input: { 'aria-label': `Toggle ${CATEGORY_META[cat].label}` } }}
            />
          </Stack>
        ))}
      </Paper>

      {/* Digest frequency */}
      <Paper
        sx={{
          p: 3,
          mb: 2,
          bgcolor: 'var(--nav-bg)',
          border: '1px solid var(--nav-border)',
          opacity: prefs.muteAll ? 0.5 : 1,
          pointerEvents: prefs.muteAll ? 'none' : 'auto',
        }}
      >
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
          <EmailIcon fontSize="small" />
          <Typography variant="h6">Digest Frequency</Typography>
        </Stack>
        <Divider sx={{ mb: 2 }} />

        <FormControl fullWidth size="small">
          <InputLabel id="digest-freq-label">Frequency</InputLabel>
          <Select
            labelId="digest-freq-label"
            value={prefs.digestFrequency}
            label="Frequency"
            onChange={changeDigest}
          >
            <MenuItem value="daily">Daily</MenuItem>
            <MenuItem value="weekly">Weekly</MenuItem>
            <MenuItem value="none">Off</MenuItem>
          </Select>
        </FormControl>
      </Paper>

      {/* Save feedback */}
      {saveMessage && (
        <Alert
          severity={saveMessage.includes('Failed') ? 'error' : 'success'}
          sx={{ mb: 2 }}
          onClose={() => setSaveMessage('')}
        >
          {saveMessage}
        </Alert>
      )}

      {/* Save button */}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={saving || !dirty}
          startIcon={
            saving ? (
              <CircularProgress size={16} color="inherit" />
            ) : (
              <NotificationsOffIcon sx={{ display: 'none' }} />
            )
          }
          sx={{ bgcolor: 'var(--accent-cyan)' }}
        >
          {saving ? 'Saving...' : 'Save Preferences'}
        </Button>
      </Box>
    </Container>
  );
};

import { FeatureErrorBoundary } from '@/components/FeatureErrorBoundary';

export const NotificationSettingsWithErrorBoundary: React.FC = () => (
  <FeatureErrorBoundary featureName="Notification Settings">
    <NotificationSettings />
  </FeatureErrorBoundary>
);
