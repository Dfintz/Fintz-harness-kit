/**
 * Security Services Index
 * 
 * Unified exports for all security-related services
 * Phase 3.3 - Centralized Permission Management Complete
 * Phase 3.4 - Security Sub-domains Organization
 * 
 * Sub-domain Structure:
 * - core/: Base security, encryption, hashing (AccountSecurityService, TokenEncryptionService, NonceStorage)
 * - permissions/: RBAC, roles, permissions (PermissionService, PermissionManagerService, etc.)
 * - access/: Security events, audit, trusted devices (SecurityEventService, ThreatDetectionService, etc.)
 */

// Core Services - Base security, encryption, hashing
export { AccountSecurityService } from './core';
export { TokenEncryptionService, getTokenEncryptionService } from './core';
export { NonceStorage, getNonceStorage } from './core';

// Micro-Segmentation - Zero Trust organization isolation (NEW Dec 2025)
export { 
    MicroSegmentationService, 
    microSegmentation,
    ResourceType,
    CrossOrgAccessLevel
} from './core';
export type {
    Segment,
    SegmentResource,
    CrossOrgAccessConfig,
    AccessCondition,
    AccessCheckResult,
    IsolationViolation
} from './core';

// Permission Services - RBAC, roles, permissions
export { PermissionService } from './permissions';
export { PermissionManagerService } from './permissions';
export { PermissionTemplateService } from './permissions';
export { AccountPermissionService } from './permissions';
export { PermissionCacheService } from './permissions';

// Access Services - Security events, audit, trusted devices, threat detection
export { AccountAccessLogService } from './access';
export { TrustedDeviceService, getTrustedDeviceService } from './access';
export type { DeviceFingerprintData } from './access';
export { TrustedDevice } from '../../models/TrustedDevice';
export { 
    SecurityEventService, 
    getSecurityEventService,
    SecurityEventSeverity,
    SecurityEventCategory,
    SecurityEventType
} from './access';
export type { SecurityEvent, AlertThreshold } from './access';
export { 
    ThreatDetectionService, 
    getThreatDetectionService,
    ThreatType
} from './access';
export type { 
    ThreatAssessment, 
    ThreatIndicator, 
    LoginAttempt, 
    GeoLocation,
    ThreatDetectionConfig 
} from './access';

// Migration complete - deprecated services have been removed
