/**
 * Router Configuration
 *
 * Centralized router configuration using createBrowserRouter with
 * data loaders for prefetching data before navigation.
 *
 * @module router/routes
 */

import { QueryClient } from '@tanstack/react-query';
import { createBrowserRouter, Navigate, RouteObject } from 'react-router-dom';

import { LandingOrRedirect } from '@/components/LandingOrRedirect';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { DirectoriesPageWithErrorBoundary as DirectoriesPage } from '@/pages/DirectoriesPage';
import { retryLazy } from '@/utils/retryLazy';
import {
  createActivitiesListLoader,
  createActivityDetailLoader,
  createFleetListLoader,
  createOrganizationShipsLoader,
  createOrganizationsListLoader,
  createPersonalHangarLoader,
  createUserShipsLoader,
} from './loaders';
import { PublicLayout } from './PublicLayout';
import { RootLayout } from './RootLayout';
import { RouteErrorBoundary } from './RouteErrorBoundary';

// Lazy load page components for code splitting
const Dashboard = retryLazy(() =>
  import('@/pages/Dashboard').then(m => ({ default: m.DashboardWithErrorBoundary }))
);
const Login = retryLazy(() => import('@/pages/Login').then(m => ({ default: m.Login })));
const AdminLogin = retryLazy(() =>
  import('@/pages/AdminLogin').then(m => ({ default: m.AdminLogin }))
);
const Logout = retryLazy(() => import('@/pages/Logout').then(m => ({ default: m.Logout })));
const NotFound = retryLazy(() => import('@/pages/NotFound').then(m => ({ default: m.NotFound })));
const Logistics = retryLazy(() =>
  import('@/pages/Logistics').then(m => ({ default: m.LogisticsWithErrorBoundary }))
);
const Treasury = retryLazy(() =>
  import('@/pages/Treasury').then(m => ({ default: m.TreasuryWithErrorBoundary }))
);
const LootDistribution = retryLazy(() =>
  import('@/pages/LootDistribution').then(m => ({ default: m.LootDistributionWithErrorBoundary }))
);
// Standalone mining page disabled — mining remains as activity type
// const Mining = retryLazy(() =>
//   import('@/pages/Mining').then(m => ({ default: m.MiningWithErrorBoundary }))
// );
const Trading = retryLazy(() =>
  import('@/pages/Trading').then(m => ({ default: m.TradingWithErrorBoundary }))
);
const Fleet = retryLazy(() =>
  import('@/pages/Fleet').then(m => ({ default: m.FleetWithErrorBoundary }))
);
const ShipComparison = retryLazy(() =>
  import('@/pages/ShipComparison').then(m => ({ default: m.ShipComparisonWithErrorBoundary }))
);
const OrganizationRelations = retryLazy(() =>
  import('@/components/OrganizationRelations').then(m => ({
    default: m.OrganizationRelationsWithErrorBoundary,
  }))
);
const RecruitmentManagement = retryLazy(() =>
  import('@/components/RecruitmentManagement').then(m => ({
    default: m.RecruitmentManagementWithErrorBoundary,
  }))
);
const RecruitmentDetailPage = retryLazy(() =>
  import('@/components/recruitment/RecruitmentDetail').then(m => ({
    default: m.RecruitmentDetail,
  }))
);
const BriefingPage = retryLazy(() =>
  import('@/components/briefing/BriefingPage').then(m => ({
    default: m.BriefingPageWithErrorBoundary,
  }))
);
const InterdictionPlannerPage = retryLazy(() =>
  import('@/components/briefing/InterdictionPlannerPage').then(m => ({
    default: m.InterdictionPlannerPageWithErrorBoundary,
  }))
);
const SharedResourcesManager = retryLazy(() =>
  import('@/pages/SharedResources').then(m => ({
    default: m.SharedResourcesManagerWithErrorBoundary,
  }))
);
const ActivityManagement = retryLazy(() =>
  import('@/components/ActivityManagement').then(m => ({
    default: m.ActivityManagementWithErrorBoundary,
  }))
);
const ActivityDetail = retryLazy(() =>
  import('@/pages/ActivityDetail').then(m => ({ default: m.ActivityDetailWithErrorBoundary }))
);
const ActivityTemplates = retryLazy(() =>
  import('@/pages/ActivityTemplatesPage').then(m => ({
    default: m.ActivityTemplatesPageWithErrorBoundary,
  }))
);
const AdminDashboard = retryLazy(() =>
  import('@/pages/admin/AdminDashboard').then(m => ({ default: m.AdminDashboardWithErrorBoundary }))
);
const UserShips = retryLazy(() =>
  import('@/pages/UserShips').then(m => ({ default: m.UserShipsWithErrorBoundary }))
);
const OrganizationShips = retryLazy(() =>
  import('@/pages/OrganizationShips').then(m => ({ default: m.OrganizationShipsWithErrorBoundary }))
);
const ShipLoans = retryLazy(() =>
  import('@/pages/ShipLoans').then(m => ({ default: m.ShipLoans }))
);
const PersonalHangar = retryLazy(() =>
  import('@/pages/PersonalHangar').then(m => ({ default: m.PersonalHangarWithErrorBoundary }))
);
const SCStatsPage = retryLazy(() =>
  import('@/pages/SCStatsPage').then(m => ({ default: m.SCStatsPageWithErrorBoundary }))
);

const UnifiedPublicDirectoriesPage = retryLazy(() =>
  import('@/pages/UnifiedPublicDirectoriesPage').then(m => ({
    default: m.UnifiedPublicDirectoriesPageWithErrorBoundary,
  }))
);
const FederationDetailsPage = retryLazy(() =>
  import('@/pages/FederationDetailsPage').then(m => ({
    default: m.FederationDetailsPageWithErrorBoundary,
  }))
);
const IntelVault = retryLazy(() =>
  import('@/pages/IntelVault').then(m => ({ default: m.IntelVaultWithErrorBoundary }))
);
const IntelOfficerManagement = retryLazy(() =>
  import('@/pages/IntelOfficerManagement').then(m => ({
    default: m.IntelOfficerManagementWithErrorBoundary,
  }))
);
const IntelAudit = retryLazy(() =>
  import('@/pages/IntelAudit').then(m => ({
    default: m.IntelAuditWithErrorBoundary,
  }))
);
const DiscordSettings = retryLazy(() =>
  import('@/pages/DiscordSettings').then(m => ({ default: m.DiscordSettingsPageWithErrorBoundary }))
);
const VoiceServerPage = retryLazy(() =>
  import('@/pages/VoiceServerPage').then(m => ({ default: m.VoiceServerPage }))
);
const PrivacySettings = retryLazy(() =>
  import('@/pages/PrivacySettings').then(m => ({ default: m.PrivacySettingsWithErrorBoundary }))
);
const SettingsPage = retryLazy(() =>
  import('@/pages/Settings').then(m => ({ default: m.SettingsPageWithErrorBoundary }))
);
const _AccountSettings = retryLazy(() =>
  import('@/pages/AccountSettings').then(m => ({ default: m.AccountSettingsWithErrorBoundary }))
);
const _SecuritySettings = retryLazy(() =>
  import('@/pages/SecuritySettings').then(m => ({ default: m.SecuritySettingsWithErrorBoundary }))
);
const _NotificationSettings = retryLazy(() =>
  import('@/pages/NotificationSettings').then(m => ({
    default: m.NotificationSettingsWithErrorBoundary,
  }))
);
const _ApiKeysSettings = retryLazy(() =>
  import('@/pages/ApiKeysSettings').then(m => ({ default: m.ApiKeysSettingsWithErrorBoundary }))
);
const NotificationsPage = retryLazy(() =>
  import('@/pages/NotificationsPage').then(m => ({ default: m.NotificationsPageWithErrorBoundary }))
);
const InboxPage = retryLazy(() =>
  import('@/pages/InboxPage').then(m => ({ default: m.InboxPageWithErrorBoundary }))
);
const HunterProfile = retryLazy(() =>
  import('@/pages/HunterProfile').then(m => ({ default: m.HunterProfilePageWithErrorBoundary }))
);
const BountiesPage = retryLazy(() =>
  import('@/pages/BountiesPage').then(m => ({ default: m.BountiesPageWithErrorBoundary }))
);
const LfgPage = retryLazy(() =>
  import('@/pages/LfgPage').then(m => ({ default: m.LfgPageWithErrorBoundary }))
);
const AnnouncementsPage = retryLazy(() =>
  import('@/pages/AnnouncementsPage').then(m => ({
    default: m.AnnouncementsPageWithErrorBoundary,
  }))
);
const PollsPage = retryLazy(() =>
  import('@/pages/PollsPage').then(m => ({ default: m.PollsPageWithErrorBoundary }))
);
const AttendancePage = retryLazy(() =>
  import('@/pages/AttendancePage').then(m => ({ default: m.AttendancePageWithErrorBoundary }))
);
const ModerationPage = retryLazy(() =>
  import('@/pages/ModerationPage').then(m => ({ default: m.ModerationPageWithErrorBoundary }))
);
const MissionsPage = retryLazy(() =>
  import('@/pages/MissionsPage').then(m => ({ default: m.MissionsPageWithErrorBoundary }))
);
const MissionDetailPage = retryLazy(() =>
  import('@/pages/MissionDetailPage').then(m => ({
    default: m.MissionDetailPageWithErrorBoundary,
  }))
);
const WikiPage = retryLazy(() =>
  import('@/pages/WikiPage').then(m => ({ default: m.WikiPageWithErrorBoundary }))
);
const UserProfilePage = retryLazy(() =>
  import('@/pages/UserProfilePage').then(m => ({ default: m.UserProfilePageWithErrorBoundary }))
);
const OrganizationProfilePage = retryLazy(() =>
  import('@/pages/OrganizationProfilePage').then(m => ({
    default: m.OrganizationProfilePageWithErrorBoundary,
  }))
);
const OrganizationDeletionStatus = retryLazy(() =>
  import('@/pages/OrganizationDeletionStatus').then(m => ({
    default: m.OrganizationDeletionStatusWithErrorBoundary,
  }))
);
const VerifyDeletionEmail = retryLazy(() =>
  import('@/pages/VerifyDeletionEmail').then(m => ({ default: m.VerifyDeletionEmail }))
);
const Landing = retryLazy(() => import('@/pages/Landing').then(m => ({ default: m.Landing })));
const OpportunitiesPage = retryLazy(() =>
  import('@/pages/OpportunitiesPage').then(m => ({
    default: m.OpportunitiesPageWithErrorBoundary,
  }))
);
const JobDetailPage = retryLazy(() =>
  import('@/pages/JobDetailPage').then(m => ({
    default: m.JobDetailPage,
  }))
);
const PublicStatsPage = retryLazy(() =>
  import('@/pages/PublicStatsPage').then(m => ({
    default: m.PublicStatsPageWithErrorBoundary,
  }))
);
const PublicActivityDetailPage = retryLazy(() =>
  import('@/pages/PublicActivityDetailPage').then(m => ({
    default: m.PublicActivityDetailPage,
  }))
);
const OrgSettings = retryLazy(() =>
  import('@/pages/OrgSettings').then(m => ({ default: m.OrgSettings }))
);
const _OrgMembers = retryLazy(() =>
  import('@/pages/OrgMembers').then(m => ({ default: m.OrgMembersWithErrorBoundary }))
);
const OrgMemberManagement = retryLazy(() =>
  import('@/pages/OrgMemberManagement').then(m => ({
    default: m.OrgMemberManagementWithErrorBoundary,
  }))
);
const OrgHierarchy = retryLazy(() =>
  import('@/pages/OrgHierarchy').then(m => ({ default: m.OrgHierarchyWithErrorBoundary }))
);
const TeamsPage = retryLazy(() =>
  import('@/pages/TeamsPage').then(m => ({ default: m.TeamsPageWithErrorBoundary }))
);
const BadgesPage = retryLazy(() =>
  import('@/pages/BadgesPage').then(m => ({ default: m.BadgesPage }))
);
const HelpCenter = retryLazy(() =>
  import('@/pages/HelpCenter').then(m => ({ default: m.HelpCenterWithErrorBoundary }))
);
const BotCommandsPage = retryLazy(() =>
  import('@/pages/BotCommandsPage').then(m => ({ default: m.BotCommandsPage }))
);
const ChangelogPage = retryLazy(() =>
  import('@/pages/Changelog').then(m => ({ default: m.ChangelogPage }))
);
const RsiVerifyLanding = retryLazy(() =>
  import('@/pages/RsiVerifyLanding').then(m => ({ default: m.RsiVerifyLanding }))
);
const MobileDownload = retryLazy(() =>
  import('@/pages/MobileDownload').then(m => ({ default: m.MobileDownload }))
);
// MobileApp removed — mobile download is now public-only at /mobile
const CrossSystemAnalyticsDashboard = retryLazy(() =>
  import('@/pages/CrossSystemAnalyticsDashboard').then(m => ({
    default: m.CrossSystemAnalyticsDashboard,
  }))
);
const BotStatsDashboard = retryLazy(() =>
  import('@/pages/BotStatsDashboard').then(m => ({
    default: m.BotStatsDashboard,
  }))
);
const FederationManagePage = retryLazy(() =>
  import('@/pages/FederationManagePage').then(m => ({
    default: m.FederationManagePageWithErrorBoundary,
  }))
);
const FederationLandingPage = retryLazy(() =>
  import('@/pages/FederationLandingPage').then(m => ({
    default: m.FederationLandingPageWithErrorBoundary,
  }))
);
const JoinActivity = retryLazy(() =>
  import('@/pages/JoinActivityPage').then(m => ({
    default: m.JoinActivityPageWithErrorBoundary,
  }))
);

/**
 * Create route configuration with data loaders and protected routes
 * @param queryClient - TanStack Query client for caching
 */
export function createRoutes(queryClient: QueryClient): RouteObject[] {
  return [
    // Public routes - no authentication required, minimal layout
    {
      element: <PublicLayout />,
      errorElement: <RouteErrorBoundary />,
      children: [
        { path: '/', element: <LandingOrRedirect /> },
        { path: '/welcome', element: <Landing /> },
        { path: '/login', element: <Login /> },
        { path: '/admin/login', element: <AdminLogin /> },
        { path: '/logout', element: <Logout /> },
        { path: '/verify-deletion', element: <VerifyDeletionEmail /> },
        { path: '/verify/rsi/:code', element: <RsiVerifyLanding /> },
        { path: '/directory', element: <UnifiedPublicDirectoriesPage /> },
        { path: '/directory/federations/:federationSlug', element: <FederationDetailsPage /> },
        {
          path: '/directory/organizations/:organizationSlug',
          element: <OrganizationProfilePage />,
        },
        { path: '/directory/:organizationSlug', element: <OrganizationProfilePage /> },
        { path: '/directory/jobs/:jobSlug', element: <JobDetailPage /> },
        { path: '/join/activity/:token', element: <JoinActivity /> },
        { path: '/j/:token', element: <JoinActivity /> },
        { path: '/opportunities', element: <OpportunitiesPage /> },
        { path: '/opportunities/activities/:id', element: <PublicActivityDetailPage /> },
        { path: '/public/stats', element: <PublicStatsPage /> },
        { path: '/changelog', element: <ChangelogPage /> },
        { path: '/mobile', element: <MobileDownload /> },
      ],
    },
    // Protected routes - require authentication, full layout with navigation
    {
      element: <RootLayout />,
      errorElement: <RouteErrorBoundary />,
      children: [
        {
          path: '/dashboard',
          element: (
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          ),
        },

        // Calendar & Planning
        {
          path: '/calendar',
          element: <Navigate to="/activities?tab=calendar" replace />,
        },

        // Logistics & Trading
        {
          path: '/logistics',
          element: (
            <ProtectedRoute requireOrganization>
              <Logistics />
            </ProtectedRoute>
          ),
        },
        {
          path: '/treasury',
          element: (
            <ProtectedRoute>
              <Treasury />
            </ProtectedRoute>
          ),
        },
        {
          path: '/loot',
          element: (
            <ProtectedRoute>
              <LootDistribution />
            </ProtectedRoute>
          ),
        },
        {
          path: '/trading',
          element: (
            <ProtectedRoute>
              <Trading />
            </ProtectedRoute>
          ),
        },
        // Standalone mining page disabled — mining remains as activity type
        // {
        //   path: '/mining',
        //   element: (
        //     <ProtectedRoute>
        //       <Mining />
        //     </ProtectedRoute>
        //   ),
        // },

        // Fleet Management (requires org membership)
        {
          path: '/fleet',
          element: (
            <ProtectedRoute requireOrganization>
              <Fleet />
            </ProtectedRoute>
          ),
          loader: createFleetListLoader(queryClient),
        },
        // Organization Ships (accessible from Fleet Hub sidebar)
        {
          path: '/fleet/ships',
          element: (
            <ProtectedRoute requireOrganization>
              <OrganizationShips />
            </ProtectedRoute>
          ),
        },
        // Ship Loans (accessible from Fleet Hub sidebar)
        {
          path: '/fleet/loans',
          element: (
            <ProtectedRoute requireOrganization>
              <ShipLoans />
            </ProtectedRoute>
          ),
        },
        // Ship Comparison Tool
        {
          path: '/fleet/compare',
          element: (
            <ProtectedRoute requireOrganization>
              <ShipComparison />
            </ProtectedRoute>
          ),
        },

        // Legacy /users alias → org member management (the prior UserManagement page
        // was a broken stub that called a non-existent /api/users endpoint).
        { path: '/users', element: <Navigate to="/org-settings/members" replace /> },
        {
          path: '/users/:userId/ships',
          element: (
            <ProtectedRoute>
              <UserShips />
            </ProtectedRoute>
          ),
          loader: createUserShipsLoader(queryClient),
        },

        // Personal Hangar - user's own ship collection (no org required)
        {
          path: '/hangar',
          element: (
            <ProtectedRoute>
              <PersonalHangar />
            </ProtectedRoute>
          ),
          loader: createPersonalHangarLoader(queryClient),
        },

        // SCStats - gameplay statistics dashboard
        {
          path: '/scstats',
          element: (
            <ProtectedRoute>
              <SCStatsPage />
            </ProtectedRoute>
          ),
        },

        // Directories (authenticated view)
        {
          path: '/directories',
          element: (
            <ProtectedRoute>
              <DirectoriesPage />
            </ProtectedRoute>
          ),
        },

        // Federation Management hub entry point
        {
          path: '/federation',
          element: (
            <ProtectedRoute>
              <FederationLandingPage />
            </ProtectedRoute>
          ),
        },

        // Organizations
        {
          path: '/organizations',
          element: (
            <ProtectedRoute>
              <OrganizationRelations />
            </ProtectedRoute>
          ),
          loader: createOrganizationsListLoader(queryClient),
        },
        {
          path: '/organizations/:orgId/ships',
          element: (
            <ProtectedRoute>
              <OrganizationShips />
            </ProtectedRoute>
          ),
          loader: createOrganizationShipsLoader(queryClient),
        },

        // Recruitment
        {
          path: '/recruitment',
          element: (
            <ProtectedRoute>
              <RecruitmentManagement />
            </ProtectedRoute>
          ),
        },
        {
          path: '/recruitment/:id',
          element: (
            <ProtectedRoute>
              <RecruitmentDetailPage />
            </ProtectedRoute>
          ),
        },

        // Briefings
        {
          path: '/briefings',
          element: (
            <ProtectedRoute requireOrganization>
              <BriefingPage />
            </ProtectedRoute>
          ),
        },
        {
          path: '/briefings/interdiction',
          element: (
            <ProtectedRoute requireOrganization>
              <InterdictionPlannerPage />
            </ProtectedRoute>
          ),
        },
        // Shared Resources
        {
          path: '/shared-resources',
          element: (
            <ProtectedRoute requireOrganization>
              <SharedResourcesManager />
            </ProtectedRoute>
          ),
        },

        // Activities
        {
          path: '/activities',
          element: (
            <ProtectedRoute>
              <ActivityManagement />
            </ProtectedRoute>
          ),
          loader: createActivitiesListLoader(queryClient),
        },
        {
          path: '/activities/:id',
          element: (
            <ProtectedRoute>
              <ActivityDetail />
            </ProtectedRoute>
          ),
          loader: createActivityDetailLoader(queryClient),
        },

        // Activity Templates
        {
          path: '/activity-templates',
          element: (
            <ProtectedRoute requireOrganization>
              <ActivityTemplates />
            </ProtectedRoute>
          ),
        },

        // Admin - requires admin role
        {
          path: '/admin',
          element: (
            <ProtectedRoute requiredRoles={['admin']}>
              <AdminDashboard />
            </ProtectedRoute>
          ),
        },

        // Intel
        {
          path: '/intel',
          element: (
            <ProtectedRoute requireOrganization>
              <IntelVault />
            </ProtectedRoute>
          ),
        },
        {
          path: '/intel/officers',
          element: (
            <ProtectedRoute>
              <IntelOfficerManagement />
            </ProtectedRoute>
          ),
        },
        {
          path: '/intel/audit',
          element: (
            <ProtectedRoute>
              <IntelAudit />
            </ProtectedRoute>
          ),
        },

        // Discord Integration
        {
          path: '/discord',
          element: (
            <ProtectedRoute>
              <DiscordSettings />
            </ProtectedRoute>
          ),
        },

        // Voice Server
        {
          path: '/voice',
          element: (
            <ProtectedRoute requireOrganization>
              <VoiceServerPage />
            </ProtectedRoute>
          ),
        },

        // Privacy Settings
        {
          path: '/privacy',
          element: (
            <ProtectedRoute>
              <PrivacySettings />
            </ProtectedRoute>
          ),
        },
        // Privacy Settings redirect (legacy alias)
        {
          path: '/privacy-settings',
          element: <Navigate to="/privacy" replace />,
        },

        // Settings Hub
        {
          path: '/settings',
          element: (
            <ProtectedRoute>
              <SettingsPage />
            </ProtectedRoute>
          ),
        },

        // Organization Settings
        {
          path: '/org-settings',
          element: (
            <ProtectedRoute>
              <OrgSettings />
            </ProtectedRoute>
          ),
        },

        // Organization Member Management (with Permissions & Roles tabs)
        {
          path: '/org-settings/members',
          element: (
            <ProtectedRoute>
              <OrgMemberManagement />
            </ProtectedRoute>
          ),
        },

        // Organization Hierarchy
        {
          path: '/org-settings/hierarchy',
          element: (
            <ProtectedRoute>
              <OrgHierarchy />
            </ProtectedRoute>
          ),
        },

        // Organization Members redirect (legacy alias)
        {
          path: '/org-members',
          element: <Navigate to="/org-settings/members" replace />,
        },

        // Teams Management (Wave 2.6)
        {
          path: '/teams',
          element: (
            <ProtectedRoute>
              <TeamsPage />
            </ProtectedRoute>
          ),
        },

        // Titles & Badges
        {
          path: '/badges',
          element: (
            <ProtectedRoute>
              <BadgesPage />
            </ProtectedRoute>
          ),
        },

        // Settings redirects — individual settings routes redirect to tabbed Settings page
        {
          path: '/account-settings',
          element: <Navigate to="/settings?tab=account" replace />,
        },
        {
          path: '/security',
          element: <Navigate to="/settings?tab=security" replace />,
        },
        {
          path: '/notification-settings',
          element: <Navigate to="/settings?tab=notifications" replace />,
        },
        {
          path: '/api-keys',
          element: <Navigate to="/settings?tab=api-keys" replace />,
        },

        // Bounty Board - Browse bounties and manage claims
        {
          path: '/bounties',
          element: (
            <ProtectedRoute requireOrganization>
              <BountiesPage />
            </ProtectedRoute>
          ),
        },

        // LFG - Looking For Group
        {
          path: '/lfg',
          element: (
            <ProtectedRoute requireOrganization>
              <LfgPage />
            </ProtectedRoute>
          ),
        },

        // Announcements - Create, schedule, and publish announcements
        {
          path: '/announcements',
          element: (
            <ProtectedRoute requireOrganization>
              <AnnouncementsPage />
            </ProtectedRoute>
          ),
        },

        // Polls - Create polls, vote, and view results
        {
          path: '/polls',
          element: (
            <ProtectedRoute requireOrganization>
              <PollsPage />
            </ProtectedRoute>
          ),
        },

        // Attendance - Leaderboard, history, and activity reports
        {
          path: '/attendance',
          element: (
            <ProtectedRoute requireOrganization>
              <AttendancePage />
            </ProtectedRoute>
          ),
        },

        // Moderation - Incidents, analytics, repeat offenders, user lookup
        {
          path: '/moderation',
          element: (
            <ProtectedRoute requireOrganization>
              <ModerationPage />
            </ProtectedRoute>
          ),
        },

        // Missions - Plan, brief, and execute missions
        {
          path: '/missions',
          element: (
            <ProtectedRoute requireOrganization>
              <MissionsPage />
            </ProtectedRoute>
          ),
        },
        {
          path: '/missions/:missionId',
          element: (
            <ProtectedRoute requireOrganization>
              <MissionDetailPage />
            </ProtectedRoute>
          ),
        },

        // Wiki - Organization knowledge base
        {
          path: '/wiki',
          element: (
            <ProtectedRoute requireOrganization>
              <WikiPage />
            </ProtectedRoute>
          ),
        },
        {
          path: '/wiki/:pageId',
          element: (
            <ProtectedRoute requireOrganization>
              <WikiPage />
            </ProtectedRoute>
          ),
        },

        // Notifications
        {
          path: '/notifications',
          element: (
            <ProtectedRoute>
              <NotificationsPage />
            </ProtectedRoute>
          ),
        },

        // Inbox - Messages & Contact Requests
        {
          path: '/inbox',
          element: (
            <ProtectedRoute>
              <InboxPage />
            </ProtectedRoute>
          ),
        },
        {
          path: '/inbox/:requestId',
          element: (
            <ProtectedRoute>
              <InboxPage />
            </ProtectedRoute>
          ),
        },

        {
          path: '/bounty/profile',
          element: (
            <ProtectedRoute requireOrganization>
              <HunterProfile />
            </ProtectedRoute>
          ),
        },
        {
          path: '/bounty/profile/:userId',
          element: (
            <ProtectedRoute requireOrganization>
              <HunterProfile />
            </ProtectedRoute>
          ),
        },

        // User Profile - View user details, ships, and activity
        {
          path: '/profile',
          element: (
            <ProtectedRoute>
              <UserProfilePage />
            </ProtectedRoute>
          ),
        },
        {
          path: '/profile/:slug',
          element: (
            <ProtectedRoute>
              <UserProfilePage />
            </ProtectedRoute>
          ),
        },

        // Organization Deletion Status
        {
          path: '/organizations/:organizationId/deletion-status',
          element: (
            <ProtectedRoute>
              <OrganizationDeletionStatus />
            </ProtectedRoute>
          ),
        },

        // Federation Management
        {
          path: '/directories/federations/:federationSlug/manage',
          element: (
            <ProtectedRoute>
              <FederationManagePage />
            </ProtectedRoute>
          ),
        },

        // Help Center
        {
          path: '/help',
          element: (
            <ProtectedRoute>
              <HelpCenter />
            </ProtectedRoute>
          ),
        },

        // Bot Command Documentation
        {
          path: '/bot-commands',
          element: (
            <ProtectedRoute>
              <BotCommandsPage />
            </ProtectedRoute>
          ),
        },

        // Mobile App Download — now public-only at /mobile

        // Platform Changelog (public — also in public routes, kept here for backward compat)
        {
          path: '/changelog',
          element: <ChangelogPage />,
        },

        // Cross-System Analytics Dashboard (Sprint 23-F)
        {
          path: '/analytics/cross-system',
          element: (
            <ProtectedRoute>
              <CrossSystemAnalyticsDashboard />
            </ProtectedRoute>
          ),
        },

        // Bot Statistics Dashboard (Sprint 26 — Gap Analysis)
        {
          path: '/analytics/bot-stats',
          element: (
            <ProtectedRoute>
              <BotStatsDashboard />
            </ProtectedRoute>
          ),
        },

        // 404 - Not Found (catch-all)
        { path: '*', element: <NotFound /> },
      ],
    },
  ];
}

/**
 * Create the browser router with data loaders
 * @param queryClient - TanStack Query client for caching
 */
export function createAppRouter(queryClient: QueryClient) {
  return createBrowserRouter(createRoutes(queryClient));
}
