import { ConnectionStatusIndicator } from '@/components/ConnectionStatusIndicator';
import {
  DashboardCustomizePanel,
  type WidgetDefinition,
} from '@/components/dashboard/DashboardCustomizePanel';
import { DashboardWidget } from '@/components/dashboard/DashboardWidget';
import { LfgFeedWidget } from '@/components/dashboard/LfgFeedWidget';
import { SCStatsDashboardWidget } from '@/components/dashboard/SCStatsDashboardWidget';
import { SummaryCards } from '@/components/dashboard/SummaryCards';
import { ErrorMessage } from '@/components/ErrorMessage';
import { FeatureErrorBoundary } from '@/components/FeatureErrorBoundary';
import { LiveActivityFeed } from '@/components/LiveActivityFeed';
import { NotificationBell } from '@/components/NotificationBell';
import { OnboardingFlow } from '@/components/OnboardingFlow';
import { PageHeader } from '@/components/PageHeader';
import { QuickActionCard } from '@/components/ui/QuickActionCard';
import { SkeletonCard } from '@/components/ui/SkeletonCard';
import type { MemberActivityStats } from '@/hooks/queries';
import {
  useDashboardSummary,
  useMemberActivityStats,
  usePendingApplications,
  usePendingInvitations,
  usePendingRecruitmentApplicants,
  usePersonalDashboardData,
  useTeams,
} from '@/hooks/queries';
import { useActivityAnalytics } from '@/hooks/queries/useActivityQueries';
import { useMyFederations } from '@/hooks/queries/useFederationManagementQueries';
import { useDashboardPreferences } from '@/hooks/useDashboardPreferences';
import {
  useRealtimeActivities,
  useRealtimeFleets,
  useRealtimeNotifications,
  useRealtimeTrading,
  useWebSocketConnection,
} from '@/hooks/useRealtime';
import { useAuthStore, useHasRole } from '@/store/authStore';
import { useNotification } from '@/store/uiStore';
import type { ActivityAnalytics, DashboardSummaryResponse } from '@/types/apiV2';
import { sanitizeImageUrl } from '@/utils/sanitize';
import { getStatusChipSx } from '@/utils/statusStyles';
import {
  AdminPanelSettings,
  BarChart as BarChartIcon,
  ViewList as BoxList,
  CalendarToday as CalendarIcon,
  Campaign,
  Diversity3 as CommunityIcon,
  Edit as EditIcon,
  TrendingUp as GraphTrend,
  Groups as GroupsIcon,
  HowToReg,
  Business as Organisations,
  People as PeopleIcon,
  PhoneIphone as PhoneIphoneIcon,
  Refresh as RefreshIcon,
  Settings as SettingsIcon,
  ShoppingCart,
  Tune as TuneIcon,
  Group as UserGroup,
  Verified as VerifiedIcon,
} from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Grid,
  IconButton,
  Stack,
  Tooltip,
  Typography,
  useTheme,
} from '@mui/material';
import { OrgScaleTier, type OrgScalingProfile } from '@sc-fleet-manager/shared-types';
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './Dashboard.css';

// ---------------------------------------------------------------------------
// Widget registry — each section of the dashboard is a widget
// ---------------------------------------------------------------------------
const ALL_WIDGETS: WidgetDefinition[] = [
  {
    widgetId: 'stats',
    label: 'Summary Stats',
    description: 'At-a-glance stats cards with sparklines',
  },
  {
    widgetId: 'scstats',
    label: 'SCStats Metrics',
    description: 'Gameplay stats — org analytics or personal metrics',
  },
  {
    widgetId: 'quick-actions',
    label: 'Quick Actions',
    description: 'Shortcut buttons for common tasks',
  },
  {
    widgetId: 'community',
    label: 'Community',
    description: 'People, teams, recruitment, and diplomacy',
  },
  {
    widgetId: 'org-alerts',
    label: 'Organization Alerts',
    description: 'Role-based org alerts and info',
  },
  {
    widgetId: 'activity-analytics',
    label: 'Activity Analytics',
    description: 'Activity breakdown by status and type',
  },
  {
    widgetId: 'pending-approvals',
    label: 'Pending Approvals',
    description: 'Review pending applications and invitations',
  },
  { widgetId: 'management', label: 'Management', description: 'Admin & org management shortcuts' },
  {
    widgetId: 'teams',
    label: 'Teams & Squads',
    description: 'Team roster overview and quick links',
  },
  {
    widgetId: 'activity-feed',
    label: 'Live Activity Feed',
    description: 'Real-time fleet, activity, and trading events',
  },
  {
    widgetId: 'lfg-feed',
    label: 'LFG Activity',
    description: 'Recent Looking-For-Group posts and open groups',
  },
];

// ---------------------------------------------------------------------------
// Role-based alerts
// ---------------------------------------------------------------------------
interface OrgAlert {
  severity: 'info' | 'warning' | 'error' | 'success';
  message: string;
}

function getRoleAlerts(role: string, summary: DashboardSummaryResponse | undefined): OrgAlert[] {
  const alerts: OrgAlert[] = [];
  if (!summary?.organization) return alerts;

  const { members } = summary.organization;
  const { fleets, activities } = summary;

  // Admin / Owner alerts
  if (role === 'admin' || role === 'owner' || role === 'founder') {
    if (members.total > 0 && (members.byRole?.member ?? 0) / members.total > 0.8) {
      alerts.push({
        severity: 'info',
        message: `Over 80% of your ${members.total} members have the basic "Member" role. Consider promoting active members to Officer or Fleet Commander.`,
      });
    }
    if (fleets?.total === 0) {
      alerts.push({
        severity: 'warning',
        message: 'Your organization has no fleets yet. Create one to start organizing your ships.',
      });
    }
  }

  // Fleet Commander alerts
  if (role === 'fleet_commander' || role === 'admin' || role === 'owner' || role === 'founder') {
    if (!activities || activities.upcoming === 0) {
      alerts.push({
        severity: 'info',
        message: 'No upcoming activities scheduled. Plan an operation to keep your crew engaged.',
      });
    }
  }

  // General member alerts
  if (activities && activities.upcoming > 0) {
    alerts.push({
      severity: 'success',
      message: `${activities.upcoming} upcoming ${activities.upcoming === 1 ? 'activity' : 'activities'} scheduled.`,
    });
  }

  return alerts;
}

// ---------------------------------------------------------------------------
// Extracted helpers — reduce Dashboard component cognitive complexity
// ---------------------------------------------------------------------------

function getQuickActions(hasOrganization: boolean) {
  return hasOrganization
    ? [
        {
          title: 'Tactical Calendar',
          icon: CalendarIcon,
          path: '/activities?tab=calendar',
          description: 'Plan tactical operations',
        },
        {
          title: 'Fleet Management',
          icon: BoxList,
          path: '/fleet',
          description: 'Manage your fleet and ships',
        },
        {
          title: 'Logistics',
          icon: ShoppingCart,
          path: '/logistics',
          description: 'Track inventory and supplies',
        },
        {
          title: 'Trading',
          icon: GraphTrend,
          path: '/trading',
          description: 'Trading routes and opportunities',
        },
      ]
    : [
        {
          title: 'Personal Hangar',
          icon: BoxList,
          path: '/hangar',
          description: 'Browse and manage your ships',
        },
        {
          title: 'Activities',
          icon: CalendarIcon,
          path: '/activities?tab=calendar',
          description: 'Browse public activities',
        },
        {
          title: 'Trading',
          icon: GraphTrend,
          path: '/trading',
          description: 'Trading routes and opportunities',
        },
        {
          title: 'Directories',
          icon: Organisations,
          path: '/directories',
          description: 'Organizations and alliances',
        },
        {
          title: 'Mobile App',
          icon: PhoneIphoneIcon,
          path: '/mobile',
          description: 'Download the companion app',
        },
      ];
}

function getCommunityActions(): QuickAction[] {
  return [
    {
      title: 'Members & Roles',
      icon: PeopleIcon,
      path: '/org-settings/members',
      description: 'Manage organization members',
    },
    {
      title: 'Teams & Squads',
      icon: GroupsIcon,
      path: '/teams',
      description: 'Manage teams and squads',
    },
    {
      title: 'Recruitment',
      icon: Campaign,
      path: '/recruitment',
      description: 'Recruit new members',
    },
    {
      title: 'Organizations',
      icon: Organisations,
      path: '/organizations',
      description: 'Handle org relationships',
    },
  ];
}

function isApprover(hasOrganization: boolean, orgRole: string): boolean {
  return (
    hasOrganization &&
    (orgRole === 'admin' || orgRole === 'owner' || orgRole === 'founder' || orgRole === 'officer')
  );
}

function shouldShowOnboarding(user: unknown): boolean {
  return !!user && !localStorage.getItem('onboarding_completed');
}

/** Pluralize: returns 's' suffix when count !== 1 */
function plural(count: number): string {
  return count === 1 ? '' : 's';
}

/** Stats widget body — extracted to reduce Dashboard cognitive complexity */
function StatsWidgetContent({
  hasOrganization,
  summary,
  personalShips,
  upcomingActivities,
  memberActivityStats,
  theme,
  userRole,
}: Readonly<{
  hasOrganization: boolean;
  summary: DashboardSummaryResponse | undefined;
  personalShips: unknown[];
  upcomingActivities: unknown[];
  memberActivityStats: MemberActivityStats | null | undefined;
  theme: import('@mui/material').Theme;
  userRole: string | undefined;
}>) {
  if (hasOrganization) {
    return (
      <SummaryCards
        memberCount={summary?.organization?.members?.total || 0}
        fleetCount={summary?.fleets?.total || 0}
        shipCount={summary?.fleets?.totalMemberShips || 0}
        sharedShipCount={summary?.fleets?.totalShips || 0}
        personalShipCount={summary?.fleets?.personalShipCount ?? personalShips.length}
        activityCount={summary?.activities?.total || 0}
        upcomingActivities={summary?.activities?.upcoming || 0}
        tradingActiveRoutes={summary?.trading?.activeRoutes || 0}
        tradingEstimatedProfit={summary?.trading?.totalEstimatedProfit || 0}
        inventoryTotalItems={summary?.inventory?.totalItems || 0}
        inventoryTotalValue={summary?.inventory?.totalValue || 0}
        // miningActiveOperations - standalone mining disabled
        missionCount={summary?.missions?.total || 0}
        allianceCount={summary?.alliances?.total || 0}
        allianceMutual={summary?.alliances?.mutual || 0}
        bountyActive={summary?.bounties?.activeBounties || 0}
        bountyTotal={summary?.bounties?.totalBounties || 0}
        reputationScore={summary?.reputation?.combinedScore || 0}
        reputationReliability={summary?.reputation?.reliability || ''}
      />
    );
  }

  return (
    <SummaryCards
      items={[
        {
          label: 'Personal Ships',
          value: personalShips.length,
          subtitle: 'In your hangar',
          color: theme.palette.primary.main,
          icon: BoxList,
        },
        {
          label: 'Upcoming Activities',
          value: upcomingActivities.length,
          subtitle: 'Public events',
          color: theme.palette.success.main,
          icon: CalendarIcon,
        },
        {
          label: 'Member Activity',
          value: memberActivityStats?.totalActivities || 0,
          subtitle:
            userRole === 'admin' || userRole === 'org_leader'
              ? 'Your engagement score'
              : 'Your activity last 7 days',
          color: theme.palette.warning.main,
          icon: UserGroup,
        },
      ]}
    />
  );
}

/** Activity analytics widget body — extracted to reduce Dashboard cognitive complexity */
function ActivityAnalyticsContent({
  activityAnalytics,
}: Readonly<{ activityAnalytics: ActivityAnalytics | undefined }>) {
  const theme = useTheme();
  if (!activityAnalytics) {
    return (
      <Alert severity="info" variant="outlined" sx={{ py: 0.5 }}>
        No activity data available yet.
      </Alert>
    );
  }

  return (
    <Stack spacing={2}>
      {Object.keys(activityAnalytics.byStatus).length > 0 && (
        <Box>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            By Status
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {Object.entries(activityAnalytics.byStatus).map(([status, count]) => (
              <Chip
                key={status}
                label={`${status}: ${count}`}
                size="small"
                sx={getStatusChipSx(status, theme)}
              />
            ))}
          </Stack>
        </Box>
      )}
      {Object.keys(activityAnalytics.byType).length > 0 && (
        <Box>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            By Type
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {Object.entries(activityAnalytics.byType).map(([type, count]) => (
              <Chip key={type} label={`${type}: ${count}`} size="small" variant="outlined" />
            ))}
          </Stack>
        </Box>
      )}
    </Stack>
  );
}

/** Pending approvals widget body — extracted to reduce Dashboard cognitive complexity */
function PendingApprovalsContent({
  pendingAppCount,
  pendingInvCount,
  pendingFederationInvCount,
  pendingRecruitmentCount,
  navigate,
}: Readonly<{
  pendingAppCount: number;
  pendingInvCount: number;
  pendingFederationInvCount: number;
  pendingRecruitmentCount: number;
  navigate: (path: string) => void;
}>) {
  return (
    <Stack spacing={1}>
      {pendingAppCount > 0 && (
        <Alert
          severity="warning"
          variant="outlined"
          sx={{ py: 0.5, cursor: 'pointer' }}
          onClick={() => navigate('/org-settings/members')}
        >
          {pendingAppCount} pending application{plural(pendingAppCount)} — click to review
        </Alert>
      )}
      {pendingRecruitmentCount > 0 && (
        <Alert
          severity="warning"
          variant="outlined"
          sx={{ py: 0.5, cursor: 'pointer' }}
          onClick={() => navigate('/recruitment?tab=applicants')}
        >
          {pendingRecruitmentCount} pending recruitment applicant{plural(pendingRecruitmentCount)} —
          click to review
        </Alert>
      )}
      {pendingInvCount > 0 && (
        <Alert
          severity="info"
          variant="outlined"
          sx={{ py: 0.5, cursor: 'pointer' }}
          onClick={() => navigate('/org-settings/members')}
        >
          {pendingInvCount} pending invitation{plural(pendingInvCount)} — click to review
        </Alert>
      )}
      {pendingFederationInvCount > 0 && (
        <Alert
          severity="info"
          variant="outlined"
          sx={{ py: 0.5, cursor: 'pointer' }}
          onClick={() => navigate('/alliances')}
        >
          {pendingFederationInvCount} pending alliance invitation
          {plural(pendingFederationInvCount)} — click to review
        </Alert>
      )}
    </Stack>
  );
}

/** Community widget grid — people, teams, recruitment, and diplomacy. */
function CommunityWidgetContent({
  actions,
  navigate,
}: Readonly<{
  actions: QuickAction[];
  navigate: (path: string) => void;
}>) {
  return (
    <Grid
      container
      spacing={2}
      sx={{
        gridTemplateColumns: {
          xs: '1fr',
          sm: 'repeat(auto-fill, minmax(240px, 1fr))',
        },
      }}
    >
      {actions.map(({ title, icon, path, description }) => (
        <Grid key={path}>
          <QuickActionCard
            title={title}
            description={description}
            icon={icon}
            onClick={() => navigate(path)}
          />
        </Grid>
      ))}
    </Grid>
  );
}

/** Extracted: Management widget grid (saves ~3 CC from isAdmin / hasOrganization nesting). */
function ManagementWidgetContent({
  isAdmin,
  hasOrganization,
  navigate,
}: Readonly<{
  isAdmin: boolean;
  hasOrganization: boolean;
  navigate: (path: string) => void;
}>) {
  return (
    <Grid
      container
      spacing={2}
      sx={{
        gridTemplateColumns: {
          xs: '1fr',
          sm: 'repeat(auto-fill, minmax(240px, 1fr))',
        },
      }}
    >
      {isAdmin && (
        <Grid>
          <QuickActionCard
            title="Admin Dashboard"
            description="System administration, security, and feature flags"
            icon={AdminPanelSettings as React.ComponentType}
            onClick={() => navigate('/admin')}
          />
        </Grid>
      )}
      {hasOrganization && (
        <Grid>
          <QuickActionCard
            title="Org Settings"
            description="Organization settings, recruitment, and invitations"
            icon={SettingsIcon as React.ComponentType}
            onClick={() => navigate('/org-settings')}
          />
        </Grid>
      )}
      {hasOrganization && (
        <Grid>
          <QuickActionCard
            title="Discord Dashboard"
            description="Manage Discord bot, voice channels, and integrations"
            icon={SettingsIcon as React.ComponentType}
            onClick={() => navigate('/discord')}
          />
        </Grid>
      )}
    </Grid>
  );
}

/** Extracted: Teams widget body (saves ~3 CC from teams.length ternary + > 6 check). */
function TeamsWidgetContent({
  teams,
  navigate,
}: Readonly<{
  teams: Array<{
    id: string;
    name: string;
    type: string;
    maxMembers: number;
    emblem?: string | null;
  }>;
  navigate: (path: string) => void;
}>) {
  if (teams.length === 0) {
    return (
      <Alert severity="info" variant="outlined" sx={{ py: 0.5 }}>
        No teams created yet. Create a team to organize your members into squads, divisions, or
        flights.
      </Alert>
    );
  }

  return (
    <Grid
      container
      spacing={2}
      sx={{
        gridTemplateColumns: {
          xs: '1fr',
          sm: 'repeat(auto-fill, minmax(240px, 1fr))',
        },
      }}
    >
      {teams.slice(0, 6).map(team => (
        <Grid key={team.id}>
          <QuickActionCard
            title={team.name}
            description={`${team.type} • ${team.maxMembers} max members`}
            icon={GroupsIcon as React.ComponentType}
            imageUrl={sanitizeImageUrl(team.emblem) || undefined}
            onClick={() => navigate(`/teams?selected=${team.id}`)}
          />
        </Grid>
      ))}
      {teams.length > 6 && (
        <Grid>
          <QuickActionCard
            title={`+${teams.length - 6} more`}
            description="View all teams"
            icon={GroupsIcon as React.ComponentType}
            onClick={() => navigate('/teams')}
          />
        </Grid>
      )}
    </Grid>
  );
}

interface QuickAction {
  title: string;
  icon: React.ComponentType;
  path: string;
  description: string;
}

/** Dialog for choosing which quick action buttons appear on the dashboard. */
function QuickActionCustomizeDialog({
  open,
  onClose,
  allActions,
  selectedPaths,
  onSave,
}: Readonly<{
  open: boolean;
  onClose: () => void;
  allActions: QuickAction[];
  selectedPaths: string[];
  onSave: (paths: string[]) => void;
}>) {
  const [localPaths, setLocalPaths] = React.useState<string[]>([]);

  React.useEffect(() => {
    if (open) {
      // If no custom selection, start with all selected
      setLocalPaths(selectedPaths.length > 0 ? selectedPaths : allActions.map(a => a.path));
    }
  }, [open, selectedPaths, allActions]);

  const handleToggle = (path: string) => {
    setLocalPaths(prev => (prev.includes(path) ? prev.filter(p => p !== path) : [...prev, path]));
  };

  const handleSave = () => {
    // If all are selected, save empty array (= show all defaults)
    const allPaths = allActions.map(a => a.path);
    const isAllSelected =
      localPaths.length === allPaths.length && allPaths.every(p => localPaths.includes(p));
    onSave(isAllSelected ? [] : localPaths);
    onClose();
  };

  const handleReset = () => {
    onSave([]);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Customize Quick Actions</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Choose which quick action buttons to show on your dashboard.
        </Typography>
        <Stack gap={0.5}>
          {allActions.map(action => (
            <FormControlLabel
              key={action.path}
              control={
                <Checkbox
                  checked={localPaths.includes(action.path)}
                  onChange={() => handleToggle(action.path)}
                />
              }
              label={action.title}
            />
          ))}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleReset} color="secondary">
          Reset
        </Button>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleSave} variant="contained" disabled={localPaths.length === 0}>
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/** Extracted outside Dashboard so its `if` doesn't contribute to Dashboard CC. */
function navigateToNotificationAction(
  notification: { actionUrl?: string },
  navigate: (path: string) => void
) {
  if (notification.actionUrl) {
    navigate(notification.actionUrl);
  }
}

/** Extracted outside Dashboard so its `if` doesn't contribute to Dashboard CC. */
function notifyHighProfitOpportunity(
  event: { data?: { profitPerUnit?: number; commodity?: string } },
  showSuccess: (message: string, title?: string, duration?: number) => void
) {
  const profit = Number(event.data?.profitPerUnit) || 0;
  if (profit > 50) {
    showSuccess(`${event.data?.commodity}: ${profit} aUEC/unit`, 'High-Profit Opportunity!', 8000);
  }
}

/** Extracted: Org identity badge with verified status and re-verify action */
function OrgIdentityBadge({
  organization,
  orgRole,
  navigate,
}: Readonly<{
  organization: { name: string; rsiVerified: boolean; scale: OrgScalingProfile };
  orgRole: string;
  navigate: (path: string) => void;
}>) {
  const verifyLabel = organization.rsiVerified ? 'Re-verify' : 'Verify RSI';
  const verifyColor = organization.rsiVerified ? ('warning' as const) : ('info' as const);
  const verifyTooltip = organization.rsiVerified
    ? "Re-verify your organization's RSI identity"
    : "Verify your organization's RSI identity";
  const scaleLabel = `${organization.scale.tier} scale`;
  const scaleTooltip = `Auto-scaled for ${organization.scale.memberCount} members. Dashboard cache TTL: ${organization.scale.dashboardCacheTtlSeconds}s. Recommended page size: ${organization.scale.recommendedPageSize}.`;
  const scaleColor = getScaleTierColor(organization.scale.tier);

  return (
    <Stack direction="row" alignItems="center" gap={1}>
      <Typography variant="body2" sx={{ color: 'var(--text-secondary)' }}>
        {organization.name}
      </Typography>
      {organization.rsiVerified && (
        <Tooltip title="RSI Verified Organization">
          <VerifiedIcon sx={{ fontSize: 18, color: 'success.main' }} />
        </Tooltip>
      )}
      <Chip
        size="small"
        label={orgRole.replace('_', ' ')}
        variant="outlined"
        sx={{ textTransform: 'capitalize', borderColor: 'var(--accent-primary)' }}
      />
      <Tooltip title={scaleTooltip}>
        <Chip
          size="small"
          label={scaleLabel}
          color={scaleColor}
          sx={{ textTransform: 'capitalize' }}
        />
      </Tooltip>
      <Tooltip title={verifyTooltip}>
        <Chip
          size="small"
          label={verifyLabel}
          variant="outlined"
          color={verifyColor}
          onClick={() => navigate('/org-settings?tab=integrations')}
          sx={{ cursor: 'pointer' }}
        />
      </Tooltip>
    </Stack>
  );
}

function getScaleTierColor(tier: OrgScaleTier): 'default' | 'success' | 'warning' | 'error' {
  switch (tier) {
    case OrgScaleTier.ULTRA:
      return 'error';
    case OrgScaleTier.MEGA:
      return 'warning';
    case OrgScaleTier.LARGE:
      return 'success';
    case OrgScaleTier.STANDARD:
    default:
      return 'default';
  }
}

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const theme = useTheme();
  const user = useAuthStore(state => state.user);
  const token = useAuthStore(state => state.token);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showCustomize, setShowCustomize] = useState(false);

  // ---------------------------------------------------------------------------
  // Unified dashboard summary (Sprint 0 — D2)
  // ---------------------------------------------------------------------------
  const {
    data: summary,
    isLoading: summaryLoading,
    error: summaryError,
    refetch: refetchSummary,
  } = useDashboardSummary();

  // Derived values from unified summary
  const hasOrganization = !!user?.activeOrgId;
  const orgRole = summary?.organization?.role ?? 'member';

  // Personal data for solo users (React Query)
  const { data: personalData, refetch: refetchPersonalData } =
    usePersonalDashboardData(!hasOrganization);
  const personalShips = personalData?.ships ?? [];
  const upcomingActivities = personalData?.activities ?? [];

  // Member activity stats (React Query)
  const { data: memberActivityStats } = useMemberActivityStats(user?.id);

  const loading = summaryLoading;

  // Dashboard preferences (customizable widgets)
  const {
    hideWidget,
    showWidget,
    hiddenWidgetIds,
    resetPreferences,
    reorderWidget,
    getOrderedWidgets,
    setQuickActionPaths,
    quickActionPaths,
  } = useDashboardPreferences();

  // Get current organization from user
  const currentOrganizationId = user?.activeOrgId || 'default-org-id';
  const isAdmin = useHasRole('admin');
  // Use token from auth store - even 'cookie-auth' placeholder is fine since backend supports cookies
  const authToken = token || '';

  // Teams data (React Query)
  const { data: teams = [] } = useTeams(hasOrganization ? currentOrganizationId : undefined, {
    staleTime: 60_000,
  });

  // Pending approvals (React Query)
  const canApprove = isApprover(hasOrganization, orgRole);
  const { data: pendingApplications } = usePendingApplications(
    canApprove ? currentOrganizationId : undefined
  );
  const { data: pendingInvitations } = usePendingInvitations(
    canApprove ? currentOrganizationId : undefined
  );
  const { data: pendingRecruitmentCount = 0 } = usePendingRecruitmentApplicants(
    canApprove ? currentOrganizationId : undefined
  );
  const pendingAppCount =
    pendingApplications?.meta?.total ?? pendingApplications?.data?.length ?? 0;
  const pendingInvCount = pendingInvitations?.meta?.total ?? pendingInvitations?.data?.length ?? 0;

  // Federation pending invitations (for org leaders)
  const { data: myFederations = [] } = useMyFederations();
  const pendingFederationInvCount = useMemo(
    () =>
      myFederations.filter(f => {
        const myMember = f.members?.find(
          (m: { organizationId: string; status: string }) =>
            m.organizationId === currentOrganizationId
        );
        return myMember?.status === 'pending';
      }).length,
    [myFederations, currentOrganizationId]
  );

  const totalPending =
    pendingAppCount + pendingInvCount + pendingFederationInvCount + pendingRecruitmentCount;

  // Activity analytics (React Query)
  const { data: activityAnalytics } = useActivityAnalytics(
    hasOrganization ? currentOrganizationId : undefined,
    { staleTime: 5 * 60_000 }
  );

  // Role-based alerts
  const orgAlerts = useMemo(
    () => (hasOrganization ? getRoleAlerts(orgRole, summary) : []),
    [hasOrganization, orgRole, summary]
  );

  // Check if this is a new user on mount
  useEffect(() => {
    setShowOnboarding(shouldShowOnboarding(user));
  }, [user]);

  const handleCloseOnboarding = () => {
    setShowOnboarding(false);
    localStorage.setItem('onboarding_completed', 'true');
  };

  // Toast notifications
  const notification = useNotification();

  // WebSocket connection
  const {
    status: _wsStatus,
    isConnected,
    isReconnecting,
    error: wsError,
  } = useWebSocketConnection(authToken);

  // Real-time fleet events
  const { events: fleetEvents } = useRealtimeFleets({
    organizationId: currentOrganizationId,
    onFleetCreated: event => {
      notification.success(`New fleet "${event.data?.name}" has been created`, 'Fleet Created');
      refetchSummary();
    },
    onFleetUpdated: event => {
      notification.info(`Fleet "${event.data?.name}" has been updated`, 'Fleet Updated');
      refetchSummary();
    },
    onFleetDeleted: () => {
      notification.warning('A fleet has been removed', 'Fleet Deleted');
      refetchSummary();
    },
  });

  // Real-time activity events
  const { events: activityEvents } = useRealtimeActivities({
    organizationId: currentOrganizationId,
    onActivityCreated: event => {
      notification.success(
        `New activity "${event.data?.title}" has been scheduled`,
        'Activity Created'
      );
      refetchSummary();
    },
    onActivityUpdated: event => {
      notification.info(`Activity "${event.data?.title}" has been updated`, 'Activity Updated');
      refetchSummary();
    },
    onActivityDeleted: () => {
      notification.warning('An activity has been cancelled', 'Activity Cancelled');
      refetchSummary();
    },
    onReminder: event => {
      notification.warning(`Upcoming: "${event.data?.title}"`, 'Activity Reminder', 10000);
    },
  });

  // Real-time trading events
  const { events: tradingEvents } = useRealtimeTrading({
    organizationId: currentOrganizationId,
    onOpportunityDiscovered: event => notifyHighProfitOpportunity(event, notification.success),
    onPriceChanged: event => {
      notification.info(
        `${event.data?.commodity} price changed at ${event.data?.location}`,
        'Price Alert',
        4000
      );
    },
  });

  // Real-time notifications
  const { notifications, unreadCount, markAsRead, markAllAsRead, clearNotification, clearAll } =
    useRealtimeNotifications({
      maxNotifications: 50,
    });

  const handleRefresh = () => {
    refetchSummary();
    if (!hasOrganization) refetchPersonalData();
  };

  const allQuickActions = getQuickActions(hasOrganization);
  const quickActions =
    quickActionPaths.length > 0
      ? (quickActionPaths
          .map(p => allQuickActions.find(a => a.path === p))
          .filter(Boolean) as typeof allQuickActions)
      : allQuickActions;
  const communityActions = hasOrganization ? getCommunityActions() : [];
  const [showQuickActionEdit, setShowQuickActionEdit] = useState(false);
  const orderedWidgets = getOrderedWidgets(ALL_WIDGETS);

  if (loading && !summary) {
    return (
      <Box sx={{ width: '100%', p: 4 }}>
        <Stack direction="column" gap={3}>
          {/* Header skeleton */}
          <SkeletonCard count={1} variant="default" />
          {/* Stat cards skeleton */}
          <SkeletonCard count={4} variant="stat" />
          {/* Quick actions skeleton */}
          <SkeletonCard count={3} variant="default" />
        </Stack>
      </Box>
    );
  }

  const errorMessage =
    summaryError instanceof Error ? summaryError.message : 'Failed to load dashboard';

  if (summaryError && !summary) {
    return (
      <Box width="100%" padding="size-400">
        <ErrorMessage
          message={errorMessage}
          onRetry={() => {
            refetchSummary();
          }}
        />
      </Box>
    );
  }

  const analyticsSubtitle = activityAnalytics
    ? `${activityAnalytics.total} total · ${activityAnalytics.upcoming} upcoming`
    : undefined;

  // Consolidate 3 hasOrganization ternaries → 1 for SCStats widget
  const [scstatsSubtitle, scstatsOrgId, scstatsUserId] = hasOrganization
    ? ['Organization gameplay analytics' as const, currentOrganizationId, undefined]
    : ['Your gameplay stats' as const, undefined, user?.id];

  // Consolidate hasOrganization ternaries for header + stats
  const [pageDescription, statsSubtitle] = hasOrganization
    ? ['Welcome to Fringe Core — Your organization command center', 'Organization summary']
    : ['Welcome to Fringe Core — Your personal command center', 'Personal summary'];

  const liveIndicator = isConnected ? (
    <Stack direction="row" alignItems="center" gap={1}>
      <div className="dashboard-live-indicator" />
      <Typography className="dashboard-live-text">Live Updates</Typography>
    </Stack>
  ) : undefined;

  // ---------------------------------------------------------------------------
  // Widget grid sizing — maps each widget to its responsive column span.
  // Full-width = 12, half-width pairs share a row at md+ breakpoint.
  // ---------------------------------------------------------------------------
  const WIDGET_GRID_SIZE: Record<string, { xs: number; md: number }> = {
    stats: { xs: 12, md: 12 },
    scstats: { xs: 12, md: 12 },
    'org-alerts': { xs: 12, md: 6 },
    'activity-analytics': { xs: 12, md: 6 },
    'pending-approvals': { xs: 12, md: 6 },
    'quick-actions': { xs: 12, md: 12 },
    community: { xs: 12, md: 12 },
    management: { xs: 12, md: 6 },
    teams: { xs: 12, md: 12 },
    'activity-feed': { xs: 12, md: 7 },
    'lfg-feed': { xs: 12, md: 5 },
  };

  // ---------------------------------------------------------------------------
  // Widget renderer — renders each widget by ID so the user-configured order
  // from getOrderedWidgets is respected. Each case handles its own extra
  // visibility conditions (role gates, data availability).
  // ---------------------------------------------------------------------------
  const renderWidget = (widgetId: string): React.ReactNode => {
    switch (widgetId) {
      case 'stats':
        return (
          <DashboardWidget
            widgetId="stats"
            title="Overview"
            subtitle={statsSubtitle}
            collapsible
            hideable
            onHide={hideWidget}
          >
            <StatsWidgetContent
              hasOrganization={hasOrganization}
              summary={summary}
              personalShips={personalShips}
              upcomingActivities={upcomingActivities}
              memberActivityStats={memberActivityStats}
              theme={theme}
              userRole={user?.role}
            />
          </DashboardWidget>
        );

      case 'scstats':
        return (
          <DashboardWidget
            widgetId="scstats"
            title="SCStats Metrics"
            subtitle={scstatsSubtitle}
            collapsible
            hideable
            onHide={hideWidget}
          >
            <FeatureErrorBoundary
              featureName="SCStats Metrics"
              fallbackMessage="Unable to load SCStats data. Other dashboard features are still available."
            >
              <SCStatsDashboardWidget organizationId={scstatsOrgId} userId={scstatsUserId} />
            </FeatureErrorBoundary>
          </DashboardWidget>
        );

      case 'org-alerts':
        if (orgAlerts.length === 0) return null;
        return (
          <DashboardWidget
            widgetId="org-alerts"
            title="Organization Insights"
            subtitle={`${orgAlerts.length} alert${plural(orgAlerts.length)} for your role`}
            collapsible
            hideable
            onHide={hideWidget}
            compact
          >
            <Stack gap={1}>
              {orgAlerts.map(alert => (
                <Alert
                  key={alert.message}
                  severity={alert.severity}
                  variant="outlined"
                  sx={{ py: 0.5 }}
                >
                  {alert.message}
                </Alert>
              ))}
            </Stack>
          </DashboardWidget>
        );

      case 'pending-approvals':
        if (totalPending === 0) return null;
        return (
          <DashboardWidget
            widgetId="pending-approvals"
            title="Pending Approvals"
            icon={<HowToReg />}
            subtitle={`${totalPending} item${plural(totalPending)} awaiting review`}
            collapsible
            hideable
            onHide={hideWidget}
            compact
          >
            <PendingApprovalsContent
              pendingAppCount={pendingAppCount}
              pendingInvCount={pendingInvCount}
              pendingFederationInvCount={pendingFederationInvCount}
              pendingRecruitmentCount={pendingRecruitmentCount}
              navigate={navigate}
            />
          </DashboardWidget>
        );

      case 'quick-actions':
        return (
          <DashboardWidget
            widgetId="quick-actions"
            title="Quick Actions"
            collapsible
            hideable
            onHide={hideWidget}
            headerActions={
              <Tooltip title="Customize quick actions">
                <IconButton size="small" onClick={() => setShowQuickActionEdit(true)}>
                  <EditIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            }
          >
            <Grid
              container
              spacing={2}
              sx={{
                gridTemplateColumns: {
                  xs: '1fr',
                  sm: 'repeat(auto-fill, minmax(240px, 1fr))',
                },
              }}
            >
              {quickActions.map(({ title, icon, path, description }) => (
                <Grid key={path}>
                  <QuickActionCard
                    title={title}
                    description={description}
                    icon={icon as React.ComponentType}
                    onClick={() => navigate(path)}
                  />
                </Grid>
              ))}
            </Grid>
          </DashboardWidget>
        );

      case 'community':
        if (!hasOrganization) return null;
        return (
          <DashboardWidget
            widgetId="community"
            title="Community"
            icon={<CommunityIcon />}
            collapsible
            hideable
            onHide={hideWidget}
          >
            <CommunityWidgetContent actions={communityActions} navigate={navigate} />
          </DashboardWidget>
        );

      case 'management':
        if (!isAdmin && !hasOrganization) return null;
        return (
          <DashboardWidget
            widgetId="management"
            title="Management"
            collapsible
            hideable
            onHide={hideWidget}
          >
            <ManagementWidgetContent
              isAdmin={isAdmin}
              hasOrganization={hasOrganization}
              navigate={navigate}
            />
          </DashboardWidget>
        );

      case 'activity-analytics':
        if (!hasOrganization) return null;
        return (
          <DashboardWidget
            widgetId="activity-analytics"
            title="Activity Analytics"
            icon={<BarChartIcon />}
            subtitle={analyticsSubtitle}
            collapsible
            hideable
            onHide={hideWidget}
          >
            <ActivityAnalyticsContent activityAnalytics={activityAnalytics} />
          </DashboardWidget>
        );

      case 'teams':
        if (!hasOrganization) return null;
        return (
          <DashboardWidget
            widgetId="teams"
            title="Teams & Squads"
            subtitle={`${teams.length} team${plural(teams.length)}`}
            collapsible
            hideable
            onHide={hideWidget}
          >
            <TeamsWidgetContent teams={teams} navigate={navigate} />
          </DashboardWidget>
        );

      case 'activity-feed':
        return (
          <DashboardWidget
            widgetId="activity-feed"
            title="Live Activity Feed"
            collapsible
            hideable
            onHide={hideWidget}
            headerActions={liveIndicator}
          >
            <FeatureErrorBoundary
              featureName="Live Activity Feed"
              fallbackMessage="Unable to load live activity feed. Other dashboard features are still available."
            >
              <LiveActivityFeed
                fleetEvents={fleetEvents}
                activityEvents={activityEvents}
                tradingEvents={tradingEvents}
                autoScroll={true}
                maxHeight="400px"
              />
            </FeatureErrorBoundary>
          </DashboardWidget>
        );

      case 'lfg-feed':
        return (
          <DashboardWidget
            widgetId="lfg-feed"
            title="LFG Activity"
            collapsible
            hideable
            onHide={hideWidget}
          >
            <FeatureErrorBoundary featureName="LFG Feed" fallbackMessage="Unable to load LFG feed.">
              <LfgFeedWidget />
            </FeatureErrorBoundary>
          </DashboardWidget>
        );

      default:
        return null;
    }
  };

  return (
    <Box sx={{ width: '100%', p: 4 }}>
      <Grid container spacing={3} sx={{ width: '100%' }}>
        {/* Header */}
        <Grid size={12}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <PageHeader
              title="Dashboard"
              helpTooltip="Your central command hub. View fleet status, recent activities, quick actions, and organization updates at a glance."
              description={pageDescription}
            />
            <Stack direction="row" gap={2} alignItems="center">
              {/* Org name + role badge + verified */}
              {hasOrganization && summary?.organization && (
                <OrgIdentityBadge
                  organization={summary.organization}
                  orgRole={orgRole}
                  navigate={navigate}
                />
              )}
              <ConnectionStatusIndicator
                isConnected={isConnected}
                isReconnecting={isReconnecting}
                error={wsError || undefined}
              />
              <NotificationBell
                notifications={notifications}
                unreadCount={unreadCount}
                onMarkAsRead={markAsRead}
                onMarkAllAsRead={markAllAsRead}
                onClear={clearNotification}
                onClearAll={clearAll}
                onNotificationClick={notification =>
                  navigateToNotificationAction(notification, navigate)
                }
              />
              <Tooltip title="Customize dashboard">
                <IconButton size="small" onClick={() => setShowCustomize(true)}>
                  <TuneIcon />
                </IconButton>
              </Tooltip>
              <IconButton
                onClick={handleRefresh}
                disabled={loading}
                title="Refresh dashboard"
                size="small"
              >
                <RefreshIcon />
              </IconButton>
            </Stack>
          </Stack>
        </Grid>

        {/* Widgets — rendered in user-configured order */}
        {orderedWidgets.map(w => {
          const node = renderWidget(w.widgetId);
          if (!node) return null;
          const size = WIDGET_GRID_SIZE[w.widgetId] ?? { xs: 12, md: 12 };
          return (
            <Grid key={w.widgetId} size={{ xs: size.xs, md: size.md }}>
              {node}
            </Grid>
          );
        })}
      </Grid>

      {/* Customization Drawer */}
      <DashboardCustomizePanel
        open={showCustomize}
        onClose={() => setShowCustomize(false)}
        widgets={getOrderedWidgets(ALL_WIDGETS)}
        hiddenWidgetIds={hiddenWidgetIds}
        onToggle={(widgetId, visible) => (visible ? showWidget(widgetId) : hideWidget(widgetId))}
        onReorder={(widgetId, newIndex) =>
          reorderWidget(
            widgetId,
            newIndex,
            orderedWidgets.map(w => w.widgetId)
          )
        }
        onReset={resetPreferences}
      />

      {/* Onboarding Flow Modal */}
      {showOnboarding && <OnboardingFlow isOpen={showOnboarding} onClose={handleCloseOnboarding} />}

      {/* Quick Action Customize Dialog */}
      <QuickActionCustomizeDialog
        open={showQuickActionEdit}
        onClose={() => setShowQuickActionEdit(false)}
        allActions={allQuickActions}
        selectedPaths={quickActionPaths}
        onSave={setQuickActionPaths}
      />
    </Box>
  );
};

export const DashboardWithErrorBoundary: React.FC = () => (
  <FeatureErrorBoundary featureName="Dashboard">
    <Dashboard />
  </FeatureErrorBoundary>
);
