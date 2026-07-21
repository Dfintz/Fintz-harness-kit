/**
 * Admin Security Log Service
 * Aggregates security events and audit logs for admin viewing
 * All user data is obfuscated to protect privacy
 */

import { logger } from '../../utils/logger';

import { DataObfuscationService } from './DataObfuscationService';

/**
 * Security event types
 */
export enum SecurityEventType {
    // Authentication events
    LOGIN_SUCCESS = 'login_success',
    LOGIN_FAILURE = 'login_failure',
    LOGOUT = 'logout',
    PASSWORD_CHANGE = 'password_change',
    PASSWORD_RESET = 'password_reset',
    
    // Authorization events
    PERMISSION_GRANTED = 'permission_granted',
    PERMISSION_DENIED = 'permission_denied',
    ROLE_CHANGED = 'role_changed',
    
    // Data access events
    DATA_ACCESSED = 'data_accessed',
    DATA_MODIFIED = 'data_modified',
    DATA_DELETED = 'data_deleted',
    DATA_EXPORTED = 'data_exported',
    
    // Security violations
    BRUTE_FORCE_ATTEMPT = 'brute_force_attempt',
    SUSPICIOUS_ACTIVITY = 'suspicious_activity',
    API_RATE_LIMIT_EXCEEDED = 'api_rate_limit_exceeded',
    INVALID_TOKEN = 'invalid_token',
    
    // Admin actions
    ADMIN_ACTION = 'admin_action',
    FEATURE_FLAG_CHANGED = 'feature_flag_changed',
    CONFIGURATION_CHANGED = 'configuration_changed'
}

/**
 * Security event severity
 */
export enum SecuritySeverity {
    INFO = 'info',
    WARNING = 'warning',
    CRITICAL = 'critical'
}

/**
 * Obfuscated security event
 */
export interface SecurityEvent {
    id: string;
    timestamp: Date;
    type: SecurityEventType;
    severity: SecuritySeverity;
    
    // Obfuscated identifiers
    userHash: string; // Hashed user ID (no actual user info)
    organizationHash?: string; // Hashed org ID
    
    // Event details (no sensitive data)
    action: string;
    resource?: string;
    outcome: 'success' | 'failure';
    
    // Metadata (sanitized)
    ipAddress?: string; // Last octet masked
    userAgent?: string; // Browser/OS only, no version details
    location?: string; // Country/region only
    
    // Context (obfuscated)
    details: Record<string, unknown>;
}

/**
 * Security log summary
 */
export interface SecurityLogSummary {
    period: string;
    totalEvents: number;
    
    byType: Record<SecurityEventType, number>;
    bySeverity: Record<SecuritySeverity, number>;
    
    topEvents: Array<{
        type: SecurityEventType;
        count: number;
    }>;
    
    suspiciousActivity: {
        bruteForceAttempts: number;
        rateLimitExceeded: number;
        invalidTokens: number;
        total: number;
    };
    
    authenticationStats: {
        successfulLogins: number;
        failedLogins: number;
        passwordResets: number;
    };
    
    authorizationStats: {
        permissionDenials: number;
        roleChanges: number;
    };
}

/**
 * In-memory security event store (replace with database in production)
 */
class SecurityEventStore {
    private events: SecurityEvent[] = [];
    private readonly maxEvents = 10000; // Keep last 10k events
    
    add(event: SecurityEvent): void {
        this.events.push(event);
        
        // Keep only recent events
        if (this.events.length > this.maxEvents) {
            this.events = this.events.slice(-this.maxEvents);
        }
    }
    
    getAll(limit?: number): SecurityEvent[] {
        if (limit) {
            return this.events.slice(-limit);
        }
        return [...this.events];
    }
    
    getByType(type: SecurityEventType, limit?: number): SecurityEvent[] {
        const filtered = this.events.filter(e => e.type === type);
        return limit ? filtered.slice(-limit) : filtered;
    }
    
    getBySeverity(severity: SecuritySeverity, limit?: number): SecurityEvent[] {
        const filtered = this.events.filter(e => e.severity === severity);
        return limit ? filtered.slice(-limit) : filtered;
    }
    
    getInTimeRange(start: Date, end: Date): SecurityEvent[] {
        return this.events.filter(e => e.timestamp >= start && e.timestamp <= end);
    }
}

const eventStore = new SecurityEventStore();

export class AdminSecurityLogService {
    /**
     * Log a security event (called from application code)
     */
    static logEvent(
        type: SecurityEventType,
        userId: string,
        action: string,
        outcome: 'success' | 'failure',
        options: {
            organizationId?: string;
            resource?: string;
            ipAddress?: string;
            userAgent?: string;
            details?: Record<string, unknown>;
        } = {}
    ): void {
        const severity = this.determineSeverity(type, outcome);
        
        const event: SecurityEvent = {
            id: this.generateEventId(),
            timestamp: new Date(),
            type,
            severity,
            userHash: DataObfuscationService.hash(userId),
            organizationHash: options.organizationId 
                ? DataObfuscationService.hash(options.organizationId)
                : undefined,
            action,
            resource: options.resource,
            outcome,
            ipAddress: options.ipAddress ? this.maskIpAddress(options.ipAddress) : undefined,
            userAgent: options.userAgent ? this.sanitizeUserAgent(options.userAgent) : undefined,
            details: options.details ? this.sanitizeDetails(options.details) : {}
        };
        
        eventStore.add(event);
        
        // Log to application logger for persistence
        logger.info('Security event', {
            type,
            severity,
            action,
            outcome
        });
    }
    
    /**
     * Get recent security events (admin only)
     */
    static getRecentEvents(limit: number = 100): SecurityEvent[] {
        return eventStore.getAll(limit);
    }
    
    /**
     * Get events by type (admin only)
     */
    static getEventsByType(type: SecurityEventType, limit?: number): SecurityEvent[] {
        return eventStore.getByType(type, limit);
    }
    
    /**
     * Get events by severity (admin only)
     */
    static getEventsBySeverity(severity: SecuritySeverity, limit?: number): SecurityEvent[] {
        return eventStore.getBySeverity(severity, limit);
    }
    
    /**
     * Get security log summary (admin only)
     */
    static getLogSummary(period: '24h' | '7d' | '30d' = '24h'): SecurityLogSummary {
        const now = new Date();
        const periodMs = period === '24h' ? 24 * 60 * 60 * 1000 :
                        period === '7d' ? 7 * 24 * 60 * 60 * 1000 :
                        30 * 24 * 60 * 60 * 1000;
        const start = new Date(now.getTime() - periodMs);
        
        const events = eventStore.getInTimeRange(start, now);
        
        // Count by type
        const byType: Record<string, number> = {};
        Object.values(SecurityEventType).forEach(type => {
            byType[type] = events.filter(e => e.type === type).length;
        });
        
        // Count by severity
        const bySeverity: Record<string, number> = {
            [SecuritySeverity.INFO]: events.filter(e => e.severity === SecuritySeverity.INFO).length,
            [SecuritySeverity.WARNING]: events.filter(e => e.severity === SecuritySeverity.WARNING).length,
            [SecuritySeverity.CRITICAL]: events.filter(e => e.severity === SecuritySeverity.CRITICAL).length
        };
        
        // Top events
        const topEvents = Object.entries(byType)
            .map(([type, count]) => ({ type: type as SecurityEventType, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);
        
        // Suspicious activity
        const suspiciousActivity = {
            bruteForceAttempts: byType[SecurityEventType.BRUTE_FORCE_ATTEMPT] || 0,
            rateLimitExceeded: byType[SecurityEventType.API_RATE_LIMIT_EXCEEDED] || 0,
            invalidTokens: byType[SecurityEventType.INVALID_TOKEN] || 0,
            total: (byType[SecurityEventType.BRUTE_FORCE_ATTEMPT] || 0) +
                   (byType[SecurityEventType.API_RATE_LIMIT_EXCEEDED] || 0) +
                   (byType[SecurityEventType.INVALID_TOKEN] || 0) +
                   (byType[SecurityEventType.SUSPICIOUS_ACTIVITY] || 0)
        };
        
        // Authentication stats
        const authenticationStats = {
            successfulLogins: byType[SecurityEventType.LOGIN_SUCCESS] || 0,
            failedLogins: byType[SecurityEventType.LOGIN_FAILURE] || 0,
            passwordResets: byType[SecurityEventType.PASSWORD_RESET] || 0
        };
        
        // Authorization stats
        const authorizationStats = {
            permissionDenials: byType[SecurityEventType.PERMISSION_DENIED] || 0,
            roleChanges: byType[SecurityEventType.ROLE_CHANGED] || 0
        };
        
        return {
            period,
            totalEvents: events.length,
            byType,
            bySeverity,
            topEvents,
            suspiciousActivity,
            authenticationStats,
            authorizationStats
        };
    }
    
    /**
     * Search security events (admin only)
     */
    static searchEvents(criteria: {
        type?: SecurityEventType;
        severity?: SecuritySeverity;
        userHash?: string;
        organizationHash?: string;
        startDate?: Date;
        endDate?: Date;
    }): SecurityEvent[] {
        let events = eventStore.getAll();
        
        if (criteria.type) {
            events = events.filter(e => e.type === criteria.type);
        }
        
        if (criteria.severity) {
            events = events.filter(e => e.severity === criteria.severity);
        }
        
        if (criteria.userHash) {
            events = events.filter(e => e.userHash === criteria.userHash);
        }
        
        if (criteria.organizationHash) {
            events = events.filter(e => e.organizationHash === criteria.organizationHash);
        }
        
        if (criteria.startDate) {
            // @ts-expect-error - Strict mode compatibility
            events = events.filter(e => e.timestamp >= criteria.startDate);
        }
        
        if (criteria.endDate) {
            // @ts-expect-error - Strict mode compatibility
            events = events.filter(e => e.timestamp <= criteria.endDate);
        }
        
        return events;
    }
    
    /**
     * Determine severity based on event type and outcome
     */
    private static determineSeverity(
        type: SecurityEventType,
        outcome: 'success' | 'failure'
    ): SecuritySeverity {
        // Critical events
        if ([
            SecurityEventType.BRUTE_FORCE_ATTEMPT,
            SecurityEventType.SUSPICIOUS_ACTIVITY,
            SecurityEventType.DATA_DELETED
        ].includes(type)) {
            return SecuritySeverity.CRITICAL;
        }
        
        // Warning events
        if ([
            SecurityEventType.LOGIN_FAILURE,
            SecurityEventType.PERMISSION_DENIED,
            SecurityEventType.API_RATE_LIMIT_EXCEEDED,
            SecurityEventType.INVALID_TOKEN
        ].includes(type) || outcome === 'failure') {
            return SecuritySeverity.WARNING;
        }
        
        // Info events
        return SecuritySeverity.INFO;
    }
    
    /**
     * Mask IP address (last octet only)
     */
    private static maskIpAddress(ip: string): string {
        const parts = ip.split('.');
        if (parts.length === 4) {
            return `${parts[0]}.${parts[1]}.${parts[2]}.xxx`;
        }
        return 'xxx.xxx.xxx.xxx';
    }
    
    /**
     * Sanitize user agent (browser/OS only)
     */
    private static sanitizeUserAgent(userAgent: string): string {
        // Extract browser and OS, remove version details
        if (userAgent.includes('Chrome')) {return 'Chrome/Desktop';}
        if (userAgent.includes('Firefox')) {return 'Firefox/Desktop';}
        if (userAgent.includes('Safari')) {return 'Safari/Desktop';}
        if (userAgent.includes('Edge')) {return 'Edge/Desktop';}
        if (userAgent.includes('Mobile')) {return 'Mobile Browser';}
        return 'Unknown Browser';
    }
    
    /**
     * Sanitize event details (remove sensitive data)
     */
    private static sanitizeDetails(details: Record<string, unknown>): Record<string, unknown> {
        const sanitized: Record<string, unknown> = {};
        
        for (const [key, value] of Object.entries(details)) {
            // Skip sensitive fields
            if (['password', 'token', 'secret', 'apiKey'].some(s => key.toLowerCase().includes(s))) {
                sanitized[key] = '[REDACTED]';
            } else if (typeof value === 'object' && value !== null) {
                sanitized[key] = '[OBJECT]';
            } else {
                sanitized[key] = value;
            }
        }
        
        return sanitized;
    }
    
    /**
     * Generate unique event ID
     */
    private static generateEventId(): string {
        return `evt_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }
}

