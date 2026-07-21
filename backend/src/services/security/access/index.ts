/**
 * Access Services
 * 
 * Security events, audit logging, trusted devices, and threat detection
 */

export { 
    SecurityEventService, 
    getSecurityEventService,
    SecurityEventSeverity,
    SecurityEventCategory,
    SecurityEventType
} from './SecurityEventService';
export type { SecurityEvent, AlertThreshold } from './SecurityEventService';

export { 
    ThreatDetectionService, 
    getThreatDetectionService,
    ThreatType
} from './ThreatDetectionService';
export type { 
    ThreatAssessment, 
    ThreatIndicator, 
    LoginAttempt, 
    GeoLocation,
    ThreatDetectionConfig 
} from './ThreatDetectionService';

export { TrustedDeviceService, getTrustedDeviceService } from './TrustedDeviceService';
export type { DeviceFingerprintData } from './TrustedDeviceService';

export { AccountAccessLogService } from './AccountAccessLogService';

