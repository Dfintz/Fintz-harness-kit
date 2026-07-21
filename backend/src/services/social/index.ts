/**
 * Social Domain Services
 * Consolidated services for social features, relationships, reputation, and LFG functionality
 * 
 * Phase 1 Consolidation - October 2025
 * Phase 2 Migration - November 2025
 * Phase 3 Service Removal - November 2025
 * Phase 1 Roadmap Cleanup - November 2025
 * Phase 4 LFG Domain Merge - December 2025
 * Phase 5 Deprecated Service Removal - December 2025
 * 
 * MIGRATION COMPLETE:
 * - LFGService has been removed. Use SocialGroupService.
 * - LFGGroupHistoryService has been removed. Use SocialGroupService.
 * - RelationshipHistoryService has been consolidated into RelationshipService.
 * - TrustScoreService has been consolidated into RelationshipService.
 * - LFGReputationService has been REMOVED. Use ReputationService.
 * - LFGSessionService has been MERGED from lfg domain. (December 2025)
 * - See /docs/migrations/LFG_SERVICE_MIGRATION_GUIDE.md for migration instructions.
 * 
 * ALL DEPRECATED SERVICES HAVE BEEN REMOVED.
 * LFG DOMAIN FULLY MERGED INTO SOCIAL DOMAIN.
 */


// ==================== ACTIVE SERVICES ====================
// Use these services for all code

/**
 * SocialGroupService - Unified LFG and group management
 * Replaces: LFGService, LFGGroupHistoryService, ActivityLFGService
 */
export { SocialGroupService } from './SocialGroupService';
export type {
    LFGPreferences,
    MatchCriteria,
    LFGMatch,
    CreateGroupHistoryParams,
    GroupHistoryStats
} from './SocialGroupService';

/**
 * ReputationService - Unified reputation and trust scoring
 * Includes all former LFGReputationService functionality.
 */
export { ReputationService } from './ReputationService';
export type { 
    UnifiedReputationScore, 
    ReputationTrend, 
    ReputationReport,
    CreateRatingParams,
    ReputationLeaderboard
} from './ReputationService';

/**
 * RelationshipService - Organization relationship management
 * Now includes: 
 * - Relationship CRUD operations
 * - History tracking (formerly RelationshipHistoryService)
 * - Trust score management (formerly TrustScoreService)
 * 
 * Note: TrustScoreService and RelationshipHistoryService have been consolidated into this service
 * as of v3.0.0. All their functionality is now available through RelationshipService methods.
 */
export { RelationshipService } from './RelationshipService';

/**
 * LFGSessionService - Redis-backed session storage for LFG functionality
 * Merged from lfg domain - December 2025
 * 
 * Features:
 * - Persistent session storage across server restarts
 * - Automatic session expiration with TTL
 * - Real-time session tracking
 * - Efficient querying by activity type and organization
 * - Supports horizontal scaling via Redis
 */
export { 
    LFGSessionService, 
    LFGSessionStatus, 
    lfgSessionService 
} from './LFGSessionService';
export type { 
    CreateLFGSessionDto, 
    JoinSessionResult, 
    LFGSession, 
    LFGSessionFilterOptions 
} from './LFGSessionService';

/**
 * MatchmakingService - Advanced matchmaking algorithms
 * Added: December 2025
 * 
 * Features:
 * - Skill-based matching
 * - Preference-based scoring
 * - Timezone and availability matching
 * - Reputation-based filtering
 * - Review bombing protection
 * - Match quality analytics
 */
export {
    MatchmakingService,
    matchmakingService
} from './MatchmakingService';
export type {
    MatchQuality,
    MatchmakingRecommendation,
    MatchmakingAnalytics
} from './MatchmakingService';


