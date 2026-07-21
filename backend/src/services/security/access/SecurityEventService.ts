/**
 * Security Event Service
 * Centralized security event monitoring and logging for SIEM integration
 * 
 * This service provides:
 * - Centralized logging of security events
 * - Structured event format for SIEM systems
 * - Event severity classification
 * - Alerting thresholds
 */

import { EventEmitter } from 'events';

import { logger } from '../../../utils/logger';

/**
 * Security event severity levels
 */
export enum SecurityEventSeverity {
    INFO = 'info',
    LOW = 'low',
    MEDIUM = 'medium',
    HIGH = 'high',
    CRITICAL = 'critical'
}

/**
 * Security event categories
 */
export enum SecurityEventCategory {
    AUTHENTICATION = 'authentication',
    AUTHORIZATION = 'authorization',
    DATA_ACCESS = 'data_access',
    DATA_MODIFICATION = 'data_modification',
    ACCOUNT_MANAGEMENT = 'account_management',
    SECURITY_CONFIGURATION = 'security_configuration',
    NETWORK = 'network',
    SYSTEM = 'system',
    COMPLIANCE = 'compliance',
    ANOMALY = 'anomaly'
}

/**
 * Security event types
 */
export enum SecurityEventType {
    // Authentication events
    LOGIN_SUCCESS = 'auth.login.success',
    LOGIN_FAILURE = 'auth.login.failure',
    LOGIN_BLOCKED = 'auth.login.blocked',
    LOGOUT = 'auth.logout',
    PASSWORD_CHANGED = 'auth.password.changed',
    PASSWORD_RESET_REQUESTED = 'auth.password.reset_requested',
    PASSWORD_RESET_COMPLETED = 'auth.password.reset_completed',
    TWO_FACTOR_ENABLED = 'auth.2fa.enabled',
    TWO_FACTOR_DISABLED = 'auth.2fa.disabled',
    TWO_FACTOR_FAILURE = 'auth.2fa.failure',
    SESSION_CREATED = 'auth.session.created',
    SESSION_EXPIRED = 'auth.session.expired',
    SESSION_TERMINATED = 'auth.session.terminated',
    
    // Authorization events
    ACCESS_GRANTED = 'authz.access.granted',
    ACCESS_DENIED = 'authz.access.denied',
    PERMISSION_ESCALATION = 'authz.permission.escalation',
    ROLE_CHANGED = 'authz.role.changed',
    
    // Account management events
    ACCOUNT_CREATED = 'account.created',
    ACCOUNT_MODIFIED = 'account.modified',
    ACCOUNT_DELETED = 'account.deleted',
    ACCOUNT_LOCKED = 'account.locked',
    ACCOUNT_UNLOCKED = 'account.unlocked',
    
    // Data events
    SENSITIVE_DATA_ACCESSED = 'data.sensitive.accessed',
    DATA_EXPORTED = 'data.exported',
    DATA_DELETED = 'data.deleted',
    
    // Security configuration events
    SECURITY_SETTING_CHANGED = 'security.setting.changed',
    API_KEY_CREATED = 'security.apikey.created',
    API_KEY_REVOKED = 'security.apikey.revoked',
    
    // Device trust events
    DEVICE_REGISTERED = 'device.registered',
    DEVICE_REVOKED = 'device.revoked',
    UNKNOWN_DEVICE_DETECTED = 'device.unknown.detected',
    
    // Network events
    RATE_LIMIT_EXCEEDED = 'network.ratelimit.exceeded',
    SUSPICIOUS_REQUEST = 'network.suspicious.request',
    BLOCKED_IP = 'network.ip.blocked',
    
    // Compliance events
    GDPR_CONSENT_GRANTED = 'compliance.gdpr.consent.granted',
    GDPR_CONSENT_REVOKED = 'compliance.gdpr.consent.revoked',
    GDPR_DATA_EXPORT = 'compliance.gdpr.data.export',
    GDPR_DATA_DELETION = 'compliance.gdpr.data.deletion',
    
    // Anomaly events
    BRUTE_FORCE_DETECTED = 'anomaly.bruteforce.detected',
    UNUSUAL_ACTIVITY = 'anomaly.unusual.activity',
    SUSPICIOUS_PATTERN = 'anomaly.suspicious.pattern'
}

/**
 * Security event structure for SIEM integration
 */
export interface SecurityEvent {
    id: string;
    timestamp: Date;
    type: SecurityEventType;
    category: SecurityEventCategory;
    severity: SecurityEventSeverity;
    userId?: string;
    username?: string;
    ipAddress?: string;
    userAgent?: string;
    resource?: string;
    action?: string;
    outcome: 'success' | 'failure' | 'blocked';
    message: string;
    metadata?: Record<string, unknown>;
    correlationId?: string;
    sessionId?: string;
    organizationId?: string;
}

/**
 * Alert threshold configuration
 */
export interface AlertThreshold {
    eventType: SecurityEventType;
    count: number;
    windowMs: number;
    severity: SecurityEventSeverity;
}

/**
 * Security Event Service
 * Provides centralized security event logging and monitoring
 */
export class SecurityEventService extends EventEmitter {
    private events: SecurityEvent[] = [];
    private eventCounts: Map<string, { count: number; windowStart: number }> = new Map();
    private maxEventsInMemory = 10000;
    
    // Default alert thresholds
    private alertThresholds: AlertThreshold[] = [
        { eventType: SecurityEventType.LOGIN_FAILURE, count: 5, windowMs: 300000, severity: SecurityEventSeverity.MEDIUM },
        { eventType: SecurityEventType.LOGIN_BLOCKED, count: 3, windowMs: 600000, severity: SecurityEventSeverity.HIGH },
        { eventType: SecurityEventType.BRUTE_FORCE_DETECTED, count: 1, windowMs: 60000, severity: SecurityEventSeverity.CRITICAL },
        { eventType: SecurityEventType.ACCESS_DENIED, count: 10, windowMs: 300000, severity: SecurityEventSeverity.MEDIUM },
        { eventType: SecurityEventType.RATE_LIMIT_EXCEEDED, count: 3, windowMs: 60000, severity: SecurityEventSeverity.LOW },
        { eventType: SecurityEventType.UNKNOWN_DEVICE_DETECTED, count: 3, windowMs: 3600000, severity: SecurityEventSeverity.MEDIUM },
    ];

    constructor() {
        super();
        logger.info('SecurityEventService initialized - SIEM integration ready');
    }

    /**
     * Log a security event
     * @param event Security event details
     */
    public logEvent(event: Omit<SecurityEvent, 'id' | 'timestamp'>): SecurityEvent {
        const fullEvent: SecurityEvent = {
            ...event,
            id: this.generateEventId(),
            timestamp: new Date()
        };

        // Store event
        this.events.push(fullEvent);
        
        // Maintain memory limit
        if (this.events.length > this.maxEventsInMemory) {
            this.events = this.events.slice(-this.maxEventsInMemory);
        }

        // Log to Winston
        this.logToWinston(fullEvent);

        // Check alert thresholds
        this.checkAlertThresholds(fullEvent);

        // Emit event for real-time subscribers
        this.emit('security-event', fullEvent);

        return fullEvent;
    }

    /**
     * Log authentication event
     */
    public logAuthEvent(
        type: SecurityEventType,
        outcome: SecurityEvent['outcome'],
        details: {
            userId?: string;
            username?: string;
            ipAddress?: string;
            userAgent?: string;
            message: string;
            metadata?: Record<string, unknown>;
        }
    ): SecurityEvent {
        return this.logEvent({
            type,
            category: SecurityEventCategory.AUTHENTICATION,
            severity: this.getSeverityForAuthEvent(type, outcome),
            outcome,
            ...details
        });
    }

    /**
     * Log authorization event
     */
    public logAuthzEvent(
        type: SecurityEventType,
        outcome: SecurityEvent['outcome'],
        details: {
            userId?: string;
            username?: string;
            resource?: string;
            action?: string;
            message: string;
            metadata?: Record<string, unknown>;
        }
    ): SecurityEvent {
        return this.logEvent({
            type,
            category: SecurityEventCategory.AUTHORIZATION,
            severity: type === SecurityEventType.ACCESS_DENIED ? SecurityEventSeverity.MEDIUM : SecurityEventSeverity.INFO,
            outcome,
            ...details
        });
    }

    /**
     * Log data access event
     */
    public logDataEvent(
        type: SecurityEventType,
        details: {
            userId?: string;
            resource: string;
            action: string;
            message: string;
            metadata?: Record<string, unknown>;
        }
    ): SecurityEvent {
        return this.logEvent({
            type,
            category: SecurityEventCategory.DATA_ACCESS,
            severity: type === SecurityEventType.SENSITIVE_DATA_ACCESSED ? SecurityEventSeverity.MEDIUM : SecurityEventSeverity.INFO,
            outcome: 'success',
            ...details
        });
    }

    /**
     * Log compliance event (GDPR, etc.)
     */
    public logComplianceEvent(
        type: SecurityEventType,
        details: {
            userId?: string;
            message: string;
            metadata?: Record<string, unknown>;
        }
    ): SecurityEvent {
        return this.logEvent({
            type,
            category: SecurityEventCategory.COMPLIANCE,
            severity: SecurityEventSeverity.INFO,
            outcome: 'success',
            ...details
        });
    }

    /**
     * Log anomaly event
     */
    public logAnomalyEvent(
        type: SecurityEventType,
        details: {
            userId?: string;
            ipAddress?: string;
            message: string;
            severity?: SecurityEventSeverity;
            metadata?: Record<string, unknown>;
        }
    ): SecurityEvent {
        return this.logEvent({
            type,
            category: SecurityEventCategory.ANOMALY,
            severity: details.severity || SecurityEventSeverity.HIGH,
            outcome: 'blocked',
            ...details
        });
    }

    /**
     * Get recent events
     * @param limit Maximum number of events to return
     * @param filter Optional filter criteria
     */
    public getRecentEvents(
        limit: number = 100,
        filter?: {
            category?: SecurityEventCategory;
            severity?: SecurityEventSeverity;
            userId?: string;
            startDate?: Date;
            endDate?: Date;
        }
    ): SecurityEvent[] {
        let filtered = [...this.events];

        if (filter) {
            if (filter.category) {
                filtered = filtered.filter(e => e.category === filter.category);
            }
            if (filter.severity) {
                filtered = filtered.filter(e => e.severity === filter.severity);
            }
            if (filter.userId) {
                filtered = filtered.filter(e => e.userId === filter.userId);
            }
            if (filter.startDate) {
                // @ts-expect-error - Strict mode compatibility
                filtered = filtered.filter(e => e.timestamp >= filter.startDate);
            }
            if (filter.endDate) {
                // @ts-expect-error - Strict mode compatibility
                filtered = filtered.filter(e => e.timestamp <= filter.endDate);
            }
        }

        return filtered.slice(-limit).reverse();
    }

    /**
     * Get event statistics
     */
    public getEventStatistics(windowMs: number = 3600000): {
        total: number;
        bySeverity: Record<SecurityEventSeverity, number>;
        byCategory: Record<SecurityEventCategory, number>;
        topEventTypes: Array<{ type: SecurityEventType; count: number }>;
    } {
        const windowStart = Date.now() - windowMs;
        const recentEvents = this.events.filter(e => e.timestamp.getTime() >= windowStart);

        const bySeverity: Record<SecurityEventSeverity, number> = {
            [SecurityEventSeverity.INFO]: 0,
            [SecurityEventSeverity.LOW]: 0,
            [SecurityEventSeverity.MEDIUM]: 0,
            [SecurityEventSeverity.HIGH]: 0,
            [SecurityEventSeverity.CRITICAL]: 0
        };

        const byCategory: Record<SecurityEventCategory, number> = {
            [SecurityEventCategory.AUTHENTICATION]: 0,
            [SecurityEventCategory.AUTHORIZATION]: 0,
            [SecurityEventCategory.DATA_ACCESS]: 0,
            [SecurityEventCategory.DATA_MODIFICATION]: 0,
            [SecurityEventCategory.ACCOUNT_MANAGEMENT]: 0,
            [SecurityEventCategory.SECURITY_CONFIGURATION]: 0,
            [SecurityEventCategory.NETWORK]: 0,
            [SecurityEventCategory.SYSTEM]: 0,
            [SecurityEventCategory.COMPLIANCE]: 0,
            [SecurityEventCategory.ANOMALY]: 0
        };

        const byType = new Map<SecurityEventType, number>();

        for (const event of recentEvents) {
            bySeverity[event.severity]++;
            byCategory[event.category]++;
            byType.set(event.type, (byType.get(event.type) || 0) + 1);
        }

        const topEventTypes = Array.from(byType.entries())
            .map(([type, count]) => ({ type, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);

        return {
            total: recentEvents.length,
            bySeverity,
            byCategory,
            topEventTypes
        };
    }

    /**
     * Export events in SIEM-compatible format
     * @param format Export format (json, cef, leef)
     * @param events Events to export
     */
    public exportEvents(
        format: 'json' | 'cef' | 'leef' = 'json',
        events?: SecurityEvent[]
    ): string {
        const eventsToExport = events || this.events;

        switch (format) {
            case 'cef':
                return eventsToExport.map(e => this.toCEF(e)).join('\n');
            case 'leef':
                return eventsToExport.map(e => this.toLEEF(e)).join('\n');
            default:
                return JSON.stringify(eventsToExport, null, 2);
        }
    }

    /**
     * Convert event to CEF (Common Event Format) for SIEM
     */
    private toCEF(event: SecurityEvent): string {
        const severityMap: Record<SecurityEventSeverity, number> = {
            [SecurityEventSeverity.INFO]: 1,
            [SecurityEventSeverity.LOW]: 3,
            [SecurityEventSeverity.MEDIUM]: 5,
            [SecurityEventSeverity.HIGH]: 7,
            [SecurityEventSeverity.CRITICAL]: 10
        };

        const cefSeverity = severityMap[event.severity];
        const extension = [
            `src=${event.ipAddress || ''}`,
            `suser=${event.username || ''}`,
            `msg=${event.message}`,
            `outcome=${event.outcome}`,
            `cs1=${event.userId || ''}`,
            `cs1Label=userId`
        ].join(' ');

        return `CEF:0|SCFleetManager|SecurityMonitor|1.0|${event.type}|${event.message}|${cefSeverity}|${extension}`;
    }

    /**
     * Convert event to LEEF (Log Event Extended Format) for QRadar
     */
    private toLEEF(event: SecurityEvent): string {
        const attrs = [
            `devTime=${event.timestamp.toISOString()}`,
            `src=${event.ipAddress || ''}`,
            `usrName=${event.username || ''}`,
            `msg=${event.message}`,
            `severity=${event.severity}`,
            `cat=${event.category}`
        ].join('\t');

        return `LEEF:2.0|SCFleetManager|SecurityMonitor|1.0|${event.type}|${attrs}`;
    }

    /**
     * Generate unique event ID
     */
    private generateEventId(): string {
        return `evt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    }

    /**
     * Log event to Winston logger
     */
    private logToWinston(event: SecurityEvent): void {
        const logLevel = this.getLogLevel(event.severity);
        logger[logLevel](`[SECURITY] ${event.type}: ${event.message}`, {
            eventId: event.id,
            category: event.category,
            severity: event.severity,
            userId: event.userId,
            ipAddress: event.ipAddress,
            outcome: event.outcome,
            metadata: event.metadata
        });
    }

    /**
     * Get Winston log level for event severity
     */
    private getLogLevel(severity: SecurityEventSeverity): 'info' | 'warn' | 'error' {
        switch (severity) {
            case SecurityEventSeverity.CRITICAL:
            case SecurityEventSeverity.HIGH:
                return 'error';
            case SecurityEventSeverity.MEDIUM:
                return 'warn';
            default:
                return 'info';
        }
    }

    /**
     * Get severity for authentication events
     */
    private getSeverityForAuthEvent(
        type: SecurityEventType,
        outcome: SecurityEvent['outcome']
    ): SecurityEventSeverity {
        if (outcome === 'blocked') {return SecurityEventSeverity.HIGH;}
        
        switch (type) {
            case SecurityEventType.LOGIN_FAILURE:
                return SecurityEventSeverity.LOW;
            case SecurityEventType.LOGIN_BLOCKED:
                return SecurityEventSeverity.HIGH;
            case SecurityEventType.TWO_FACTOR_FAILURE:
                return SecurityEventSeverity.MEDIUM;
            case SecurityEventType.BRUTE_FORCE_DETECTED:
                return SecurityEventSeverity.CRITICAL;
            default:
                return SecurityEventSeverity.INFO;
        }
    }

    /**
     * Check alert thresholds and emit alerts
     */
    private checkAlertThresholds(event: SecurityEvent): void {
        for (const threshold of this.alertThresholds) {
            if (event.type !== threshold.eventType) {continue;}

            const key = `${threshold.eventType}:${event.userId || event.ipAddress || 'global'}`;
            const now = Date.now();
            const entry = this.eventCounts.get(key);

            if (!entry || now - entry.windowStart > threshold.windowMs) {
                this.eventCounts.set(key, { count: 1, windowStart: now });
            } else {
                entry.count++;
                if (entry.count >= threshold.count) {
                    this.emit('security-alert', {
                        threshold,
                        event,
                        count: entry.count,
                        message: `Alert threshold exceeded: ${threshold.count} ${threshold.eventType} events in ${threshold.windowMs / 1000}s`
                    });
                    logger.warn(`[SECURITY ALERT] Threshold exceeded for ${threshold.eventType}`, {
                        threshold,
                        count: entry.count,
                        userId: event.userId,
                        ipAddress: event.ipAddress
                    });
                }
            }
        }
    }

    /**
     * Set custom alert thresholds
     */
    public setAlertThresholds(thresholds: AlertThreshold[]): void {
        this.alertThresholds = thresholds;
    }

    /**
     * Add an alert threshold
     */
    public addAlertThreshold(threshold: AlertThreshold): void {
        this.alertThresholds.push(threshold);
    }
}

// Singleton instance
let instance: SecurityEventService | null = null;

export const getSecurityEventService = (): SecurityEventService => {
    if (!instance) {
        instance = new SecurityEventService();
    }
    return instance;
};

