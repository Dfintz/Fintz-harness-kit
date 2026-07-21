/**
 * User Services Index
 *
 * Unified exports for all user-related services
 *
 * SharedAccountService and BulkAccountService moved here from account/ domain
 * as part of domain consolidation
 */

export { BulkAccountService } from './BulkAccountService'; // Moved from account/ domain
export { ConsentService } from './ConsentService';
export { FocusService } from './FocusService'; // Moved from infrastructure/ domain - handles user/org gameplay focuses
export { GenericCsvPreviewService } from './GenericCsvPreviewService';
export { GdprDataDeletionService, getGdprDataDeletionService } from './GdprDataDeletionService'; // GDPR cascade deletion
export { RsiVerificationService } from './RsiVerificationService'; // RSI account verification
export { SharedAccountService } from './SharedAccountService'; // Moved from account/ domain
export { UserActivityService } from './UserActivityService';
export { UserAuthenticationService } from './UserAuthenticationService';
export { UserPreferencesService } from './UserPreferencesService';
export { UserProfileService } from './UserProfileService';
export { UserSearchService } from './UserSearchService';
export { UserService } from './UserService';
export { UserSocialService } from './UserSocialService';

// Re-export types and interfaces
export type { AccountExportData } from './BulkAccountService';
export type { FocusType, FocusValue, OrgFocus, UserFocus } from './FocusService';
export type { GenericCsvPreview } from './GenericCsvPreviewService';
export type { GdprDeletionResult, LegalHoldStatus } from './GdprDataDeletionService';
export type {
  CompleteVerificationResult,
  InitiateVerificationResult,
  OrgOwnershipVerificationResult,
  VerificationStatusResult,
} from './RsiVerificationService';
export type { ActivityLogPayload, TimelineEvent } from './UserActivityService';
export type { OrganizationContext, UserPreferences } from './UserPreferencesService';
export type { UserSearchFilters, UserSearchResult, UserSortOptions } from './UserSearchService';
export type {
  SocialActivity,
  SocialActivityType,
  SocialConnection,
  SocialConnectionType,
} from './UserSocialService';

