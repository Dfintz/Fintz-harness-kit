/**
 * Organization Services Index
 * Exports all organization domain services
 */

// Core organization service
export { OrganizationService } from './OrganizationService';

// Domain-specific services
export { AllianceService } from './AllianceService';
export { MemberActivityService } from './MemberActivityService';
export { OnlinePresenceService } from './OnlinePresenceService';
export { OrganizationActivityService } from './OrganizationActivityService';
export { OrganizationAnalyticsService } from './OrganizationAnalyticsService';
export { OrganizationArchiveService } from './OrganizationArchiveService';
export { OrganizationBulkService } from './OrganizationBulkService';
export { OrganizationHierarchyService } from './OrganizationHierarchyService';
export { OrganizationMemberService } from './OrganizationMemberService';
export { OrganizationPermissionService } from './OrganizationPermissionService';
export { OrganizationSettingsService } from './OrganizationSettingsService';
export { OrganizationTemplateService } from './OrganizationTemplateService';

// Public directory service
export { PublicOrgDirectoryService } from './PublicOrgDirectoryService';
export type {
  DirectoryFilterOptions,
  PublicOrgListItem,
  PublicProfileInput,
} from './PublicOrgDirectoryService';

// Federation service (org federation management)
export { OrganizationFederationService } from './OrganizationFederationService';
export type {
  FederationConfig,
  FederationGovernance,
  FederationMemberData,
  FederationProposalData,
  FederationRole,
  FederationStats,
  FederationTreaty,
  FederationVote,
  ProposalStatus,
  ProposalType,
  PublicFederationListItem,
  SharedResource,
  VoteChoice,
} from './OrganizationFederationService';

// Recruitment sub-module (moved from standalone recruitment domain)
export { RecruitmentService } from './recruitment';
export type {
  CandidatePipeline,
  CandidateProfile,
  OnboardingStep,
  OnboardingWorkflow,
  PipelineCandidate,
  PipelineHistory,
  PipelineStage,
  RecruitmentAnalytics,
  RecruitmentDashboard,
  RecruitmentFilterOptions,
  RecruitmentInsight,
  SkillMatchCriteria,
  SkillMatchResult,
  // Analytics dashboard and pipeline visualization
  SourcePerformance,
  StageTransition,
} from './recruitment';

// Re-export types
export type { ActivityAnalytics, ActivitySummary } from './OrganizationActivityService';
export type { MemberInvitation, MemberStats } from './OrganizationMemberService';
export type { PermissionCheckResult } from './OrganizationPermissionService';
export type { SettingsValidation } from './OrganizationSettingsService';

