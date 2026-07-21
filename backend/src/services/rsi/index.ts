/**
 * RSI Services - Unified barrel export
 *
 * Consolidates all RSI-related services under a single domain import.
 * Services were previously scattered across services/external/ and services/user/.
 *
 * Usage:
 *   import { rsiApiService, RsiVerificationService } from '../services/rsi';
 *
 * Categories:
 * - API: RSIApiService (RSI Crawler backend with caching)
 * - Verification: RsiVerificationService, RsiVerificationAnalytics
 * - Linking: RsiUserLinkService (user-org RSI handle linking)
 * - Role Sync: RsiRoleSyncService, RsiRoleMappingService
 * - Scheduling: RsiSyncScheduleService, RsiSyncAuditService
 * - Notifications: RsiNotificationService
 */

// ─── API ────────────────────────────────────────────────────────────────────
export { RsiApiService, rsiApiService } from '../external/RSIApiService';
export type { RsiUserOrganization, RsiVerificationResult } from '../external/RSIApiService';

// ─── Verification ───────────────────────────────────────────────────────────
export { rsiVerificationAnalytics } from '../user/RsiVerificationAnalytics';
export { RsiVerificationService } from '../user/RsiVerificationService';

// ─── Linking ────────────────────────────────────────────────────────────────
export {
  RsiBotUserLookupService,
  rsiBotUserLookupService,
} from '../external/RsiBotUserLookupService';
export { RsiUserLinkService, rsiUserLinkService } from '../external/RsiUserLinkService';
export type { AffiliateHandling, OrgSyncConfig } from '../external/RsiUserLinkService';

// ─── Role Sync ──────────────────────────────────────────────────────────────
export { RsiRoleSyncService, rsiRoleSyncService } from '../external/RsiRoleSyncService';
export type { RsiOrgMember } from '../external/RsiRoleSyncService';

export { RsiRoleMappingService, rsiRoleMappingService } from '../external/RsiRoleMappingService';

// ─── Scheduling & Audit ─────────────────────────────────────────────────────
export { RsiSyncScheduleService, rsiSyncScheduleService } from '../external/RsiSyncScheduleService';
export type { SyncScheduleInput } from '../external/RsiSyncScheduleService';

export { RsiSyncAuditService, rsiSyncAuditService } from '../external/RsiSyncAuditService';

// ─── Review Queue ───────────────────────────────────────────────────────────
export {
  ReviewReason,
  ReviewResolution,
  RsiSyncReviewService,
  rsiSyncReviewService,
} from '../external/RsiSyncReviewService';
export type {
  ResolveReviewInput,
  ReviewQueueItem,
  ReviewStats,
} from '../external/RsiSyncReviewService';

// ─── Notifications ──────────────────────────────────────────────────────────
export { RsiNotificationService } from '../user/RsiNotificationService';

// ─── Member Intelligence (Wave 3.3) ────────────────────────────────────────
export { RsiMemberIntelService, rsiMemberIntelService } from '../external/RsiMemberIntelService';
export type {
  AuditRunResult,
  BatchEnrichmentResult,
  EnrichmentResult,
  MemberIntelCard,
  MemberIntelSummary,
  RoleMappingValidationResult,
} from '../external/RsiMemberIntelService';

