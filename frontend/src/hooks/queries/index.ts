/**
 * TanStack Query Hooks
 *
 * Central export for all TanStack Query hooks and utilities.
 * Import from this file for a clean API.
 */

// Query Client
export { createQueryClient, queryClient } from './queryClient';

// Query Keys
export {
  activityKeys,
  activityTemplateKeys,
  allianceKeys,
  applicationKeys,
  bountyKeys,
  consentKeys,
  crewAssignmentKeys,
  dashboardKeys,
  encryptionKeys,
  fleetKeys,
  // intelKeys — imported directly in useIntelQueries to avoid circular chunks
  invitationKeys,
  memberAuditKeys,
  // miningKeys, // Standalone mining disabled
  notificationKeys,
  organizationKeys,
  permissionKeys,
  scStatsKeys,
  securityLevelKeys,
  sharedAccountKeys,
  shipComparisonKeys,
  shipKeys,
  socialLfgKeys,
  teamKeys,
  tradingKeys,
  userKeys,
} from './queryKeys';

// Fleet Hooks
export {
  useCreateFleet,
  useDeleteFleet,
  useFleet,
  useFleetComposition,
  useFleetHealth,
  useFleets,
  useFleetShips,
  useFleetStatistics,
  useFleetTree,
  useMoveFleet,
  usePrefetchFleet,
  usePrefetchFleetShips,
  useReorderFleets,
  useUpdateFleet,
} from './useFleetQueries';

// Activity Hooks
export {
  useActivities,
  useActivity,
  useActivityAnalytics,
  useActivityByToken,
  useAddNestedShip,
  useBringFleetAndInviteMembers,
  useBringFleetToActivity,
  useCancelActivity,
  useCreateActivity,
  useGenerateJoinLink,
  useInviteFleetMembers,
  useJoinActivity,
  useJoinByToken,
  useJoinShipPassenger,
  useLeaveActivity,
  useLeaveShipPassenger,
  useLoanShips,
  useMyActivities,
  usePrefetchActivity,
  useRecommendedActivities,
  useSetCrewSlots,
  useSetPassengerSlots,
  useUpcomingActivities,
  useUpdateActivity,
} from './useActivityQueries';

// Activity Template Hooks (Sprint 19-D)
export {
  useActivityTemplate,
  useActivityTemplateCategories,
  useActivityTemplates,
  useApplyActivityTemplate,
  useCloneActivityTemplate,
  useCreateActivityTemplate,
  useDeleteActivityTemplate,
  useUpdateActivityTemplate,
} from './useActivityTemplateQueries';

// Organization Hooks
export {
  useCreateOrganization,
  useLeaveOrganization,
  useMyOrganizations,
  useOrganization,
  useOrganizationMembers,
  useOrganizationStatistics,
  useRemoveMember,
  useUpdateMemberRole,
  useUpdateOrganization,
} from './useOrganizationQueries';

// Ship Hooks
export {
  useCreateShip,
  useDeleteShip,
  useSearchShips,
  useShip,
  useShips,
  useUpdateShip,
} from './useShipQueries';

// Ship Comparison Hooks
export {
  useCompareShips,
  useFleetCompositionAnalysis,
  useQuickCompare,
  useShipRoleAnalysis,
  useSimilarShips,
} from './useShipComparisonQueries';

// Organization Ship Hooks
export {
  useAddCrewMember,
  useAssignCaptain,
  useAssignCrew,
  useCreateOrgShip,
  useDeleteOrgShip,
  useFleetSummary,
  useOrgShip,
  useOrgShips,
  useUpdateOrgShip,
} from './useOrgShipQueries';

// Social / LFG Hooks (Sprint 17-D/17-E)
export {
  useCreateSocialGroup,
  useCreateSocialLfgSession,
  useJoinSocialGroup,
  useJoinSocialLfgSession,
  useSocialGroups,
  useSocialLfgSessions,
} from './useSocialLfgQueries';

// Member Audit & Intel Hooks (Wave 2.1)
export {
  useAuditFlag,
  useAuditFlags,
  useCreateManualFlag,
  useCreateWatchlistEntry,
  useDeleteWatchlistEntry,
  useMemberProfile,
  useResolveFlag,
  useUpdateWatchlistEntry,
  useUserFlagStats,
  useWatchlistEntries,
} from './useMemberAuditQueries';

// Team Hooks (Phase 1.3)
export {
  useAddTeamMember,
  useCreateTeam,
  useDeleteTeam,
  useMoveTeam,
  useRemoveTeamMember,
  useReorderTeams,
  useTeam,
  useTeamMembers,
  useTeams,
  useTeamTree,
  useUpdateTeam,
  useUpdateTeamMember,
} from './useTeamQueries';

// Trading Hooks (Phase 3)
export {
  useCreateTradingRoute,
  useDeleteTradingRoute,
  useMarketAnalysis,
  useTradingAnalytics,
  useTradingOpportunities,
  useTradingPrices,
  useTradingRoute,
  useTradingRoutes,
  useUpdateRouteStatus,
  useUpdateTradingRoute,
} from './useTradingQueries';

// Intel Vault Hooks (Phase 3)
// NOTE: Intel hooks are NOT re-exported here to prevent a circular chunk
// dependency between feature-fleet and feature-intel.  Import them directly
// from '@/hooks/queries/useIntelQueries' instead.

// User Profile Hooks (Phase 3)
export {
  useMyProfile,
  useUpdateMyProfile,
  useUserActivityStats,
  useUserActivityTimeline,
  useUserProfile,
  useUserShips,
} from './useUserQueries';

// SCStats Hooks (Phase 3)
export {
  useDeleteSCStats,
  useImportSCStats,
  useSCStatsData,
  useSCStatsOrgAnalytics,
} from './useSCStatsQueries';

// Notification Hooks (Phase 3)
export {
  useDeleteNotification,
  useMarkAllNotificationsAsRead,
  useMarkNotificationsAsRead,
  useNotificationDigest,
  useNotificationPreferences,
  useNotifications,
  useSendNotification,
  useUnreadNotificationCount,
  useUpdateNotificationPreferences,
} from './useNotificationQueries';

// Dashboard Hooks (Sprint 0 — unified endpoint)
export {
  useDashboardSummary,
  useMemberActivityStats,
  usePersonalDashboardData,
} from './useDashboardQueries';
export type { MemberActivityStats } from './useDashboardQueries';

// Bounty Hooks (Sprint 0.5)
export {
  useApproveBountyClaim,
  useBounties,
  useBounty,
  useBountyClaims,
  useCreateBounty,
  useCreateBountyClaim,
  useDeleteBounty,
  useRejectBountyClaim,
  useUpdateBounty,
} from './useBountyQueries';

// Encryption Hooks (Sprint 0.5)
export {
  useDeleteEncryptedData,
  useDisableEncryption,
  useEncryptedData,
  useEncryptionAuditLog,
  useEncryptionKey,
  useEncryptionStatus,
  useInitializeEncryption,
  usePendingReEncryption,
  useReEncryptionProgress,
  useRevokeKeyAccess,
  useRotateKey,
  useShareKey,
  useStoreEncryptedData,
} from './useEncryptionQueries';

// Permission Hooks (Sprint 0.5)
export {
  useAddPermissionToRole,
  useAssignRole,
  useCheckPermission,
  useCreateRole,
  useDeleteRole,
  useGrantPermission,
  useOrganizationRoles,
  usePermission,
  usePermissions,
  useRemovePermissionFromRole,
  useRevokePermission,
  useRolePermissions,
  useUpdateRole,
  useUpdateSecurityLevel,
  useUserPermissions,
  useUserRole,
} from './usePermissionQueries';

// Security Level Hooks (Sprint 0.5)
export {
  useOrgSecurityLevels,
  useRevokeSecurityLevel,
  useSecurityLevels,
  useSetSecurityLevel,
} from './useSecurityLevelQueries';

// Mining Hooks — standalone mining feature disabled
// export {
//   useAddCrewMember as useAddMiningCrewMember,
//   useCreateMiningOperation,
//   useMiningOperation,
//   useMiningOperations,
//   useRecordResources,
//   useUpdateMiningStatus,
// } from './useMiningQueries';

// Shared Account Hooks (Sprint 0.5)
export {
  useAddSharedAccountMember,
  useCreateSharedAccount,
  useDeleteSharedAccount,
  useRemoveSharedAccountMember,
  useSharedAccount,
  useSharedAccountAuditLog,
  useSharedAccountMembers,
  useSharedAccounts,
  useUpdateSharedAccount,
  useUpdateSharedAccountMemberRole,
} from './useSharedAccountQueries';

// Consent Hooks (Sprint 0.5)
export {
  useCheckConsent,
  useConsentVersion,
  useRecordConsent,
  useRequestAccountDeletion,
  useRequestDataExport,
  useUserConsents,
  useWithdrawAllConsents,
  useWithdrawConsent,
} from './useConsentQueries';

// Crew Assignment Hooks (Sprint 1)
export {
  useAddAssignmentCrewMember,
  useCreateCrewAssignment,
  useCrewAssignment,
  useCrewAssignments,
  useRemoveAssignmentCrewMember,
  useUpdateCrewAssignmentStatus,
} from './useCrewAssignmentQueries';

// Alliance Hooks (Sprint 0.5)
export {
  useAlliance,
  useAlliances,
  useApproveAlliance,
  useProposeAlliance,
  useReportAllianceIncident,
  useResolveAllianceIncident,
  useSuspendAlliance,
  useTerminateAlliance,
} from './useAllianceQueries';

// Approval Hooks (Pending Approvals widget)
export {
  usePendingApplications,
  usePendingInvitations,
  usePendingRecruitmentApplicants,
} from './useApprovalQueries';

// Ready Check Hooks
export {
  useCancelReadyCheck,
  useInitiateReadyCheck,
  useReadyCheck,
  useRespondToReadyCheck,
} from './useReadyCheckQueries';

// Operation Command Hooks (Chain of Command)
export {
  useAcknowledgeCommand,
  useCommandChain,
  useIssueCommand,
  useOperationCommand,
  useOperationCommands,
  usePreflightCheck,
  useSetCommandChain,
} from './useOperationCommandQueries';

// API Key Hooks (Wingman AI / External Integrations)
export { useApiKeys, useCreateApiKey, useRevokeApiKey, useUpdateApiKey } from './useApiKeyQueries';
