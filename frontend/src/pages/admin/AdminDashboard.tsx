/**
 * Admin Dashboard Main Page
 * Secure admin portal with data obfuscation
 * Completely separate from user-facing application
 */

import { retryLazy } from '@/utils/retryLazy';
import {
    AdminPanelSettings,
    Delete,
    ErrorOutline,
    Description as FileTemplate,
    Flag,
    BarChart as GraphBarVertical,
    History,
    Lock,
    MonitorHeart,
    RocketLaunch,
    Security as Shield,
    Speed,
    Groups as UserGroup,
    WarningAmber as WarningAmberIcon,
} from '@mui/icons-material';
import {
    AppBar,
    Box,
    CircularProgress,
    Container,
    Stack,
    Tab,
    Tabs,
    Toolbar,
    Typography,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import React, { Suspense, useEffect, useState } from 'react';
// Import feature error boundary
import { FeatureErrorBoundary } from '@/components/FeatureErrorBoundary';
import { apiClient, isApiClientError } from '@/services/apiClient';

// Lazy load admin components for code splitting
const MetricsDashboard = retryLazy(() =>
  import('./components/MetricsDashboard').then(m => ({ default: m.MetricsDashboard }))
);
const PerformanceDashboard = retryLazy(() =>
  import('./components/PerformanceDashboard').then(m => ({ default: m.PerformanceDashboard }))
);
const SecurityLogs = retryLazy(() =>
  import('./components/SecurityLogs').then(m => ({ default: m.SecurityLogs }))
);
const FeatureFlagManager = retryLazy(() =>
  import('./components/FeatureFlagManager').then(m => ({ default: m.FeatureFlagManager }))
);
const UserManagement = retryLazy(() =>
  import('./components/UserManagement').then(m => ({ default: m.UserManagement }))
);
const ComplianceDashboard = retryLazy(() =>
  import('./components/ComplianceDashboard').then(m => ({ default: m.ComplianceDashboard }))
);
const LegalHoldManagement = retryLazy(() =>
  import('./components/LegalHoldManagement').then(m => ({ default: m.LegalHoldManagement }))
);
const ModerationAnalyticsDashboard = retryLazy(() =>
  import('./components/ModerationAnalyticsDashboard').then(m => ({
    default: m.ModerationAnalyticsDashboard,
  }))
);
const OrganizationDeletionApprovals = retryLazy(() =>
  import('./components/OrganizationDeletionApprovals').then(m => ({
    default: m.OrganizationDeletionApprovals,
  }))
);
const AuditLogViewer = retryLazy(() =>
  import('./components/AuditLogViewer').then(m => ({ default: m.AuditLogViewer }))
);
const _DiscordDashboard = retryLazy(() =>
  import('./components/DiscordDashboard').then(m => ({ default: m.DiscordDashboard }))
);
const AdminShipManager = retryLazy(() =>
  import('@/components/admin/AdminShipManager').then(m => ({ default: m.AdminShipManager }))
);
const OperationsMonitor = retryLazy(() =>
  import('./components/OperationsMonitor').then(m => ({ default: m.OperationsMonitor }))
);

interface DashboardData {
  metrics: {
    users: { total: number; newUsers24h: number };
    performance: { cacheHitRate: number; avgResponseTime: number };
  };
  security: {
    totalEvents: number;
    suspiciousActivity: { total: number };
  };
  featureFlags: { total: number; enabled: number };
  timestamp: Date;
}

export const AdminDashboard: React.FC = () => {
  const theme = useTheme();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [activeTab, setActiveTab] = useState<string>('metrics');

  useEffect(() => {
    fetchDashboardData();

    // Refresh every 30 seconds
    const interval = setInterval(fetchDashboardData, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchDashboardData = async () => {
    try {
      const data = await apiClient.getRaw<DashboardData>('/api/v2/admin/dashboard');
      setDashboardData(data);
      setError(null);
    } catch (err) {
      if (isApiClientError(err) && err.statusCode === 403) {
        setError('Admin access required');
      } else if (isApiClientError(err)) {
        setError(err.message || 'Failed to fetch dashboard data');
      } else {
        setError(err instanceof Error ? err.message : 'Unknown error');
      }
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Stack justifyContent="center" alignItems="center" height="100vh">
        <CircularProgress aria-label="Loading" size={60} />
      </Stack>
    );
  }

  if (error) {
    return (
      <Box padding="size-300">
        <Box sx={{ borderRadius: 1, p: 2, borderColor: 'error.main' }}>
          <Stack direction="row" gap={2} alignItems="center">
            <ErrorOutline sx={{ color: 'error.main' }} />
            <Box>
              <Typography sx={{ color: 'error.main' }}>{error}</Typography>
              {error.includes('Admin access') && (
                <Typography sx={{ color: 'text.secondary', mt: 1 }}>
                  This portal requires admin privileges. Contact your system administrator.
                </Typography>
              )}
            </Box>
          </Stack>
        </Box>
      </Box>
    );
  }

  return (
    <Box minHeight="100vh" sx={{ backgroundColor: 'background.default' }}>
      {/* Top Navigation Bar */}
      <AppBar
        position="sticky"
        elevation={0}
        sx={{
          background: alpha(theme.palette.background.default, 0.95),
          backdropFilter: 'blur(20px)',
          borderBottom: `1px solid ${alpha(theme.palette.primary.main, 0.15)}`,
        }}
      >
        <Container maxWidth="xl">
          <Toolbar disableGutters sx={{ minHeight: { xs: 56, md: 64 } }}>
            <AdminPanelSettings
              sx={{
                color: 'primary.main',
                fontSize: 28,
                mr: 1.5,
                filter: `drop-shadow(0 0 6px ${alpha(theme.palette.primary.main, 0.5)})`,
              }}
            />
            <Typography
              variant="h6"
              component="h1"
              sx={{
                fontWeight: 700,
                background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                letterSpacing: '-0.02em',
                fontSize: { xs: '1rem', md: '1.15rem' },
                mr: 2,
              }}
            >
              Admin Portal
            </Typography>
            <Typography
              sx={{
                color: alpha(theme.palette.common.white, 0.5),
                fontSize: '0.85rem',
                display: { xs: 'none', sm: 'block' },
              }}
            >
              System Administration &bull; Admin access is audit-logged
            </Typography>
          </Toolbar>
        </Container>
      </AppBar>

      {/* Warning Banner */}
      <Box padding="size-200">
        <Box sx={{ borderRadius: 1, p: 2, borderColor: 'warning.main' }}>
          <Stack direction="row" gap="size-200" alignItems="center">
            <Shield sx={{ color: 'warning.main' }} />
            <Typography>
              <strong>Admin Access Notice:</strong> Usernames and IDs are visible for operational
              use. Emails are partially masked, secrets are redacted, and user content is encrypted.
              All admin actions are audit-logged.
            </Typography>
          </Stack>
        </Box>
      </Box>

      {/* Summary Cards */}
      <Box padding="size-300">
        <Stack direction="row" gap="size-200" flexWrap="wrap">
          <Box flex={1} minWidth="size-3000">
            <Box sx={{ borderRadius: 1, p: 2 }}>
              <Stack direction="row" gap="size-200" alignItems="center">
                <UserGroup sx={{ color: 'primary.main' }} />
                <Box>
                  <Typography variant="h5" component="span" sx={{ display: 'block' }}>
                    {dashboardData?.metrics.users.total.toLocaleString()}
                  </Typography>
                  <Typography sx={{ color: 'text.secondary' }}>Total Users</Typography>
                  <Typography sx={{ color: 'success.main', fontSize: '0.75rem' }}>
                    +{dashboardData?.metrics.users.newUsers24h} today
                  </Typography>
                </Box>
              </Stack>
            </Box>
          </Box>

          <Box flex={1} minWidth="size-3000">
            <Box sx={{ borderRadius: 1, p: 2 }}>
              <Stack direction="row" gap="size-200" alignItems="center">
                <GraphBarVertical sx={{ color: 'success.main' }} />
                <Box>
                  <Typography variant="h5" component="span" sx={{ display: 'block' }}>
                    {((dashboardData?.metrics.performance.cacheHitRate ?? 0) * 100).toFixed(1)}%
                  </Typography>
                  <Typography sx={{ color: 'text.secondary' }}>Cache Hit Rate</Typography>
                  <Typography sx={{ color: 'text.secondary', fontSize: '0.75rem' }}>
                    {dashboardData?.metrics.performance.avgResponseTime}ms avg
                  </Typography>
                </Box>
              </Stack>
            </Box>
          </Box>

          <Box flex={1} minWidth="size-3000">
            <Box sx={{ borderRadius: 1, p: 2 }}>
              <Stack direction="row" gap="size-200" alignItems="center">
                <Shield sx={{ color: 'warning.main' }} />
                <Box>
                  <Typography variant="h5" component="span" sx={{ display: 'block' }}>
                    {dashboardData?.security.totalEvents.toLocaleString()}
                  </Typography>
                  <Typography sx={{ color: 'text.secondary' }}>Security Events (24h)</Typography>
                  <Typography sx={{ color: 'error.main', fontSize: '0.75rem' }}>
                    {dashboardData?.security.suspiciousActivity.total} suspicious
                  </Typography>
                </Box>
              </Stack>
            </Box>
          </Box>

          <Box flex={1} minWidth="size-3000">
            <Box sx={{ borderRadius: 1, p: 2 }}>
              <Stack direction="row" gap="size-200" alignItems="center">
                <Flag sx={{ color: 'primary.main' }} />
                <Box>
                  <Typography variant="h5" component="span" sx={{ display: 'block' }}>
                    {dashboardData?.featureFlags.total}
                  </Typography>
                  <Typography sx={{ color: 'text.secondary' }}>Feature Flags</Typography>
                  <Typography sx={{ color: 'success.main', fontSize: '0.75rem' }}>
                    {dashboardData?.featureFlags.enabled} enabled
                  </Typography>
                </Box>
              </Stack>
            </Box>
          </Box>
        </Stack>
      </Box>

      {/* Main Content Tabs */}
      <Box padding="size-300">
        <Box sx={{ borderRadius: 1, p: 2 }}>
          <Tabs
            value={activeTab}
            onChange={(_, value) => setActiveTab(value)}
            variant="scrollable"
            scrollButtons="auto"
            allowScrollButtonsMobile
          >
            <Tab
              value="metrics"
              icon={<GraphBarVertical />}
              iconPosition="start"
              label="Metrics & Analytics"
            />
            <Tab
              value="moderation"
              icon={<WarningAmberIcon />}
              iconPosition="start"
              label="Moderation Analytics"
            />
            <Tab value="performance" icon={<Speed />} iconPosition="start" label="Performance" />
            <Tab value="security" icon={<Shield />} iconPosition="start" label="Security Logs" />
            <Tab value="flags" icon={<Flag />} iconPosition="start" label="Feature Flags" />
            <Tab value="users" icon={<UserGroup />} iconPosition="start" label="User Management" />
            <Tab
              value="compliance"
              icon={<FileTemplate />}
              iconPosition="start"
              label="GDPR Compliance"
            />
            <Tab value="legal" icon={<Lock />} iconPosition="start" label="Legal Holds" />
            <Tab
              value="deletions"
              icon={<Delete />}
              iconPosition="start"
              label="Deletion Approvals"
            />
            <Tab value="ships" icon={<RocketLaunch />} iconPosition="start" label="Ship Roster" />
            <Tab
              value="operations"
              icon={<MonitorHeart />}
              iconPosition="start"
              label="Operations"
            />
            <Tab value="audit" icon={<History />} iconPosition="start" label="Audit Logs" />
          </Tabs>

          <Box paddingTop="size-300">
            {activeTab === 'metrics' && (
              <Suspense
                fallback={
                  <Stack justifyContent="center" alignItems="center" height="size-3000">
                    <CircularProgress aria-label="Loading metrics" size={40} />
                  </Stack>
                }
              >
                <FeatureErrorBoundary featureName="Metrics Dashboard">
                  <MetricsDashboard />
                </FeatureErrorBoundary>
              </Suspense>
            )}

            {activeTab === 'moderation' && (
              <Suspense
                fallback={
                  <Stack justifyContent="center" alignItems="center" height="size-3000">
                    <CircularProgress aria-label="Loading moderation analytics" size={40} />
                  </Stack>
                }
              >
                <FeatureErrorBoundary featureName="Moderation Analytics">
                  <ModerationAnalyticsDashboard />
                </FeatureErrorBoundary>
              </Suspense>
            )}

            {activeTab === 'performance' && (
              <Suspense
                fallback={
                  <Stack justifyContent="center" alignItems="center" height="size-3000">
                    <CircularProgress aria-label="Loading performance dashboard" size={40} />
                  </Stack>
                }
              >
                <FeatureErrorBoundary featureName="Performance Dashboard">
                  <PerformanceDashboard />
                </FeatureErrorBoundary>
              </Suspense>
            )}

            {activeTab === 'security' && (
              <Suspense
                fallback={
                  <Stack justifyContent="center" alignItems="center" height="size-3000">
                    <CircularProgress aria-label="Loading security logs" size={40} />
                  </Stack>
                }
              >
                <FeatureErrorBoundary featureName="Security Logs">
                  <SecurityLogs />
                </FeatureErrorBoundary>
              </Suspense>
            )}

            {activeTab === 'flags' && (
              <Suspense
                fallback={
                  <Stack justifyContent="center" alignItems="center" height="size-3000">
                    <CircularProgress aria-label="Loading feature flags" size={40} />
                  </Stack>
                }
              >
                <FeatureErrorBoundary featureName="Feature Flags">
                  <FeatureFlagManager />
                </FeatureErrorBoundary>
              </Suspense>
            )}

            {activeTab === 'users' && (
              <Suspense
                fallback={
                  <Stack justifyContent="center" alignItems="center" height="size-3000">
                    <CircularProgress aria-label="Loading user management" size={40} />
                  </Stack>
                }
              >
                <FeatureErrorBoundary featureName="User Management">
                  <UserManagement />
                </FeatureErrorBoundary>
              </Suspense>
            )}

            {activeTab === 'compliance' && (
              <Suspense
                fallback={
                  <Stack justifyContent="center" alignItems="center" height="size-3000">
                    <CircularProgress aria-label="Loading compliance dashboard" size={40} />
                  </Stack>
                }
              >
                <FeatureErrorBoundary featureName="GDPR Compliance">
                  <ComplianceDashboard />
                </FeatureErrorBoundary>
              </Suspense>
            )}

            {activeTab === 'legal' && (
              <Suspense
                fallback={
                  <Stack justifyContent="center" alignItems="center" height="size-3000">
                    <CircularProgress aria-label="Loading legal holds" size={40} />
                  </Stack>
                }
              >
                <FeatureErrorBoundary featureName="Legal Holds">
                  <LegalHoldManagement />
                </FeatureErrorBoundary>
              </Suspense>
            )}

            {activeTab === 'deletions' && (
              <Suspense
                fallback={
                  <Stack justifyContent="center" alignItems="center" height="size-3000">
                    <CircularProgress aria-label="Loading deletion approvals" size={40} />
                  </Stack>
                }
              >
                <FeatureErrorBoundary featureName="Deletion Approvals">
                  <OrganizationDeletionApprovals />
                </FeatureErrorBoundary>
              </Suspense>
            )}

            {activeTab === 'ships' && (
              <Suspense
                fallback={
                  <Stack justifyContent="center" alignItems="center" height="size-3000">
                    <CircularProgress aria-label="Loading ship roster" size={40} />
                  </Stack>
                }
              >
                <FeatureErrorBoundary featureName="Ship Roster">
                  <AdminShipManager />
                </FeatureErrorBoundary>
              </Suspense>
            )}

            {activeTab === 'operations' && (
              <Suspense
                fallback={
                  <Stack justifyContent="center" alignItems="center" height="size-3000">
                    <CircularProgress aria-label="Loading operations monitor" size={40} />
                  </Stack>
                }
              >
                <FeatureErrorBoundary featureName="Operations Monitor">
                  <OperationsMonitor />
                </FeatureErrorBoundary>
              </Suspense>
            )}

            {activeTab === 'audit' && (
              <Suspense
                fallback={
                  <Stack justifyContent="center" alignItems="center" height="size-3000">
                    <CircularProgress aria-label="Loading audit logs" size={40} />
                  </Stack>
                }
              >
                <FeatureErrorBoundary featureName="Audit Logs">
                  <AuditLogViewer />
                </FeatureErrorBoundary>
              </Suspense>
            )}
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export const AdminDashboardWithErrorBoundary: React.FC = () => (
  <FeatureErrorBoundary featureName="Admin Dashboard">
    <AdminDashboard />
  </FeatureErrorBoundary>
);
