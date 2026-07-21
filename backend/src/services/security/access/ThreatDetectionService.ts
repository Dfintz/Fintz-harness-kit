/**
 * Threat Detection Service
 * 
 * Provides advanced threat detection capabilities including:
 * - Geographic anomaly detection (impossible travel)
 * - Behavioral analysis
 * - Suspicious activity pattern detection
 * - Brute force detection
 * 
 * Implements recommendations from Security Review:
 * - Advanced Threat Detection
 * - Geographic anomalies
 * - Behavioral analysis
 * - Suspicious activity alerts
 */

import { Repository } from 'typeorm';

import { AppDataSource } from '../../../data-source';
import { User } from '../../../models/User';
import { matchesIPPattern } from '../../../utils/ipWhitelist';
import { logger } from '../../../utils/logger';

import {
    getSecurityEventService,
    SecurityEventType,
    SecurityEventSeverity
} from './SecurityEventService';

/**
 * Geographic location data
 */
export interface GeoLocation {
    ip: string;
    country?: string;
    region?: string;
    city?: string;
    latitude?: number;
    longitude?: number;
    timestamp: Date;
}

/**
 * Login attempt record
 */
export interface LoginAttempt {
    userId: string;
    ip: string;
    userAgent: string;
    timestamp: Date;
    success: boolean;
    location?: GeoLocation;
}

/**
 * Threat assessment result
 */
export interface ThreatAssessment {
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    riskScore: number; // 0-100
    threats: ThreatIndicator[];
    recommendations: string[];
    requiresMFA: boolean;
    requiresManualReview: boolean;
}

/**
 * Individual threat indicator
 */
export interface ThreatIndicator {
    type: ThreatType;
    severity: 'low' | 'medium' | 'high' | 'critical';
    description: string;
    confidence: number; // 0-100
    evidence: Record<string, unknown>;
}

/**
 * Types of threats detected
 */
export enum ThreatType {
    IMPOSSIBLE_TRAVEL = 'impossible_travel',
    BRUTE_FORCE = 'brute_force',
    CREDENTIAL_STUFFING = 'credential_stuffing',
    UNUSUAL_TIME = 'unusual_time',
    UNUSUAL_LOCATION = 'unusual_location',
    SUSPICIOUS_USER_AGENT = 'suspicious_user_agent',
    RAPID_REQUESTS = 'rapid_requests',
    IP_REPUTATION = 'ip_reputation',
    ACCOUNT_TAKEOVER = 'account_takeover',
    BOT_ACTIVITY = 'bot_activity'
}

/**
 * Configuration for threat detection
 */
export interface ThreatDetectionConfig {
    /** Maximum speed in km/h for travel between locations (default: 1000 km/h - faster than commercial flights) */
    maxTravelSpeedKmH: number;
    /** Minimum time between logins to trigger impossible travel (default: 30 minutes) */
    minTimeBetweenLoginsMs: number;
    /** Number of failed attempts to trigger brute force detection */
    bruteForceThreshold: number;
    /** Time window for brute force detection (ms) */
    bruteForceWindowMs: number;
    /** Unusual login hours (24h format) */
    unusualHoursStart: number;
    unusualHoursEnd: number;
    /** Enable/disable specific detections */
    enabledDetections: ThreatType[];
}

const defaultConfig: ThreatDetectionConfig = {
    maxTravelSpeedKmH: 1000,
    minTimeBetweenLoginsMs: 30 * 60 * 1000, // 30 minutes
    bruteForceThreshold: 5,
    bruteForceWindowMs: 15 * 60 * 1000, // 15 minutes
    unusualHoursStart: 1, // 1 AM
    unusualHoursEnd: 5, // 5 AM
    enabledDetections: Object.values(ThreatType)
};

/**
 * Threat Detection Service
 * Implements advanced threat detection for Zero Trust security
 */
export class ThreatDetectionService {
    private static instance: ThreatDetectionService;
    private config: ThreatDetectionConfig;
    private loginAttempts: Map<string, LoginAttempt[]> = new Map();
    private userRepository: Repository<User>;
    private securityEventService = getSecurityEventService();

    // Known suspicious user agent patterns
    private suspiciousUserAgentPatterns = [
        /curl/i,
        /wget/i,
        /python-requests/i,
        /go-http-client/i,
        /java\//i,
        /bot/i,
        /crawler/i,
        /spider/i,
        /scan/i,
        /^$/,  // Empty user agent
    ];

    /**
     * Known bad IP ranges for blocking
     * 
     * NOTE: In production environments, this should be populated by:
     * 1. Integration with threat intelligence feeds (e.g., AbuseIPDB, MaxMind)
     * 2. Automated import from security incident response
     * 3. Manual additions from security team
     * 
     * IPs can be added dynamically via blockIP() method
     * Supports both individual IPs and CIDR notation (e.g., "192.168.1.0/24")
     */
    private blockedIPRanges: string[] = [];

    private constructor(config: Partial<ThreatDetectionConfig> = {}) {
        this.config = { ...defaultConfig, ...config };
        this.userRepository = AppDataSource.getRepository(User);
        
        // Cleanup old login attempts periodically
        setInterval(() => this.cleanupOldAttempts(), 60 * 60 * 1000); // Every hour
        
        logger.info('ThreatDetectionService initialized with config:', {
            bruteForceThreshold: this.config.bruteForceThreshold,
            enabledDetections: this.config.enabledDetections.length
        });
    }

    public static getInstance(config?: Partial<ThreatDetectionConfig>): ThreatDetectionService {
        if (!ThreatDetectionService.instance) {
            ThreatDetectionService.instance = new ThreatDetectionService(config);
        }
        return ThreatDetectionService.instance;
    }

    /**
     * Assess threat level for a login attempt
     * @param attempt Login attempt details
     * @returns Threat assessment with risk level and recommendations
     */
    public async assessLoginThreat(attempt: LoginAttempt): Promise<ThreatAssessment> {
        const threats: ThreatIndicator[] = [];
        let riskScore = 0;

        // Store the attempt
        this.recordLoginAttempt(attempt);

        // Run enabled detections
        if (this.config.enabledDetections.includes(ThreatType.BRUTE_FORCE)) {
            const bruteForce = this.detectBruteForce(attempt);
            if (bruteForce) {
                threats.push(bruteForce);
                riskScore += this.getThreatScore(bruteForce);
            }
        }

        if (this.config.enabledDetections.includes(ThreatType.IMPOSSIBLE_TRAVEL)) {
            const impossibleTravel = this.detectImpossibleTravel(attempt);
            if (impossibleTravel) {
                threats.push(impossibleTravel);
                riskScore += this.getThreatScore(impossibleTravel);
            }
        }

        if (this.config.enabledDetections.includes(ThreatType.UNUSUAL_TIME)) {
            const unusualTime = this.detectUnusualTime(attempt);
            if (unusualTime) {
                threats.push(unusualTime);
                riskScore += this.getThreatScore(unusualTime);
            }
        }

        if (this.config.enabledDetections.includes(ThreatType.SUSPICIOUS_USER_AGENT)) {
            const suspiciousUA = this.detectSuspiciousUserAgent(attempt);
            if (suspiciousUA) {
                threats.push(suspiciousUA);
                riskScore += this.getThreatScore(suspiciousUA);
            }
        }

        if (this.config.enabledDetections.includes(ThreatType.RAPID_REQUESTS)) {
            const rapidRequests = this.detectRapidRequests(attempt);
            if (rapidRequests) {
                threats.push(rapidRequests);
                riskScore += this.getThreatScore(rapidRequests);
            }
        }

        // Cap risk score at 100
        riskScore = Math.min(100, riskScore);

        // Determine risk level
        const riskLevel = this.getRiskLevel(riskScore);

        // Generate recommendations
        const recommendations = this.generateRecommendations(threats, riskLevel);

        // Log security event if threats detected
        if (threats.length > 0) {
            this.securityEventService.logAnomalyEvent(
                SecurityEventType.SUSPICIOUS_PATTERN,
                {
                    userId: attempt.userId,
                    ipAddress: attempt.ip,
                    message: `${threats.length} threat indicators detected during login`,
                    severity: this.mapRiskToSeverity(riskLevel),
                    metadata: {
                        threats: threats.map(t => t.type),
                        riskScore,
                        riskLevel
                    }
                }
            );
        }

        return {
            riskLevel,
            riskScore,
            threats,
            recommendations,
            requiresMFA: riskScore >= 50,
            requiresManualReview: riskScore >= 80
        };
    }

    /**
     * Detect brute force attack patterns
     */
    private detectBruteForce(attempt: LoginAttempt): ThreatIndicator | null {
        const userAttempts = this.loginAttempts.get(attempt.userId) || [];
        const windowStart = Date.now() - this.config.bruteForceWindowMs;
        
        const recentFailures = userAttempts.filter(
            a => !a.success && a.timestamp.getTime() > windowStart
        );

        if (recentFailures.length >= this.config.bruteForceThreshold) {
            return {
                type: ThreatType.BRUTE_FORCE,
                severity: 'high',
                description: `${recentFailures.length} failed login attempts in ${this.config.bruteForceWindowMs / 60000} minutes`,
                confidence: 90,
                evidence: {
                    failedAttempts: recentFailures.length,
                    windowMs: this.config.bruteForceWindowMs,
                    threshold: this.config.bruteForceThreshold
                }
            };
        }

        return null;
    }

    /**
     * Detect impossible travel (login from geographically distant locations in short time)
     */
    private detectImpossibleTravel(attempt: LoginAttempt): ThreatIndicator | null {
        if (!attempt.location?.latitude || !attempt.location?.longitude) {
            // Log when geo data is missing for security monitoring
            logger.debug('Impossible travel check skipped - no geo data available', {
                userId: attempt.userId,
                ip: attempt.ip
            });
            return null;
        }

        const userAttempts = this.loginAttempts.get(attempt.userId) || [];
        const previousSuccessful = userAttempts
            .filter(a => a.success && a.location?.latitude && a.location?.longitude)
            .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0];

        if (!previousSuccessful?.location) {
            return null; // No previous location to compare
        }

        const timeDiffMs = attempt.timestamp.getTime() - previousSuccessful.timestamp.getTime();
        
        // Skip if time difference is too small (could be clock sync issues) or negative
        if (timeDiffMs <= 0) {
            return null;
        }

        // Calculate distance between locations
        const prevLat = previousSuccessful.location.latitude;
        const prevLon = previousSuccessful.location.longitude;
        
        if (prevLat === undefined || prevLon === undefined) {
            return null;
        }
        
        const distance = this.calculateDistance(
            prevLat,
            prevLon,
            attempt.location.latitude,
            attempt.location.longitude
        );

        const timeHours = timeDiffMs / (1000 * 60 * 60);
        const speedKmH = distance / timeHours;

        // Detect impossible travel: high speed required and time is too short for such distance
        // Only flag if time difference is less than what would be reasonable for the distance
        if (speedKmH > this.config.maxTravelSpeedKmH && timeDiffMs < (distance / this.config.maxTravelSpeedKmH) * 60 * 60 * 1000) {
            return {
                type: ThreatType.IMPOSSIBLE_TRAVEL,
                severity: 'critical',
                description: `Login from ${attempt.location.city || attempt.location.country || 'unknown'} after being in ${previousSuccessful.location.city || previousSuccessful.location.country || 'unknown'} requires impossible travel speed`,
                confidence: 95,
                evidence: {
                    previousLocation: {
                        city: previousSuccessful.location.city,
                        country: previousSuccessful.location.country,
                        timestamp: previousSuccessful.timestamp
                    },
                    currentLocation: {
                        city: attempt.location.city,
                        country: attempt.location.country,
                        timestamp: attempt.timestamp
                    },
                    distanceKm: Math.round(distance),
                    requiredSpeedKmH: Math.round(speedKmH),
                    maxAllowedSpeedKmH: this.config.maxTravelSpeedKmH
                }
            };
        }

        return null;
    }

    /**
     * Detect login at unusual hours
     */
    private detectUnusualTime(attempt: LoginAttempt): ThreatIndicator | null {
        const hour = attempt.timestamp.getHours();
        
        if (hour >= this.config.unusualHoursStart && hour < this.config.unusualHoursEnd) {
            return {
                type: ThreatType.UNUSUAL_TIME,
                severity: 'low',
                description: `Login at unusual hour (${hour}:00)`,
                confidence: 60,
                evidence: {
                    loginHour: hour,
                    unusualRange: `${this.config.unusualHoursStart}:00 - ${this.config.unusualHoursEnd}:00`
                }
            };
        }

        return null;
    }

    /**
     * Detect suspicious user agent strings
     */
    private detectSuspiciousUserAgent(attempt: LoginAttempt): ThreatIndicator | null {
        for (const pattern of this.suspiciousUserAgentPatterns) {
            if (pattern.test(attempt.userAgent)) {
                return {
                    type: ThreatType.SUSPICIOUS_USER_AGENT,
                    severity: 'medium',
                    description: `Suspicious user agent detected: ${attempt.userAgent.substring(0, 50)}`,
                    confidence: 75,
                    evidence: {
                        userAgent: attempt.userAgent,
                        matchedPattern: pattern.toString()
                    }
                };
            }
        }

        return null;
    }

    /**
     * Detect rapid consecutive requests
     */
    private detectRapidRequests(attempt: LoginAttempt): ThreatIndicator | null {
        const userAttempts = this.loginAttempts.get(attempt.userId) || [];
        const oneMinuteAgo = Date.now() - 60000;
        
        const recentAttempts = userAttempts.filter(
            a => a.timestamp.getTime() > oneMinuteAgo
        );

        if (recentAttempts.length >= 10) {
            return {
                type: ThreatType.RAPID_REQUESTS,
                severity: 'medium',
                description: `${recentAttempts.length} login attempts in the last minute`,
                confidence: 85,
                evidence: {
                    attemptsInLastMinute: recentAttempts.length,
                    threshold: 10
                }
            };
        }

        return null;
    }

    /**
     * Record a login attempt for future analysis
     */
    private recordLoginAttempt(attempt: LoginAttempt): void {
        const userId = attempt.userId;
        const attempts = this.loginAttempts.get(userId) || [];
        attempts.push(attempt);

        // Keep only last 100 attempts per user
        if (attempts.length > 100) {
            attempts.shift();
        }

        this.loginAttempts.set(userId, attempts);
    }

    /**
     * Calculate distance between two points using Haversine formula
     */
    private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
        const R = 6371; // Earth's radius in km
        const dLat = this.toRad(lat2 - lat1);
        const dLon = this.toRad(lon2 - lon1);
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    private toRad(deg: number): number {
        return deg * (Math.PI / 180);
    }

    /**
     * Get threat score based on severity
     */
    private getThreatScore(threat: ThreatIndicator): number {
        const severityScores = {
            'low': 10,
            'medium': 25,
            'high': 40,
            'critical': 60
        };
        return severityScores[threat.severity] * (threat.confidence / 100);
    }

    /**
     * Determine risk level from score
     */
    private getRiskLevel(score: number): ThreatAssessment['riskLevel'] {
        if (score >= 80) {
            return 'critical';
        }
        if (score >= 50) {
            return 'high';
        }
        if (score >= 25) {
            return 'medium';
        }
        return 'low';
    }

    /**
     * Map risk level to security event severity
     */
    private mapRiskToSeverity(riskLevel: ThreatAssessment['riskLevel']): SecurityEventSeverity {
        const mapping = {
            'low': SecurityEventSeverity.LOW,
            'medium': SecurityEventSeverity.MEDIUM,
            'high': SecurityEventSeverity.HIGH,
            'critical': SecurityEventSeverity.CRITICAL
        };
        return mapping[riskLevel];
    }

    /**
     * Generate security recommendations based on threats
     */
    private generateRecommendations(threats: ThreatIndicator[], riskLevel: ThreatAssessment['riskLevel']): string[] {
        const recommendations: string[] = [];

        if (riskLevel === 'critical' || riskLevel === 'high') {
            recommendations.push('Require multi-factor authentication');
            recommendations.push('Consider temporarily blocking the account pending review');
        }

        for (const threat of threats) {
            switch (threat.type) {
                case ThreatType.BRUTE_FORCE:
                    recommendations.push('Implement account lockout');
                    recommendations.push('Consider CAPTCHA challenge');
                    break;
                case ThreatType.IMPOSSIBLE_TRAVEL:
                    recommendations.push('Verify user identity through secondary channel');
                    recommendations.push('Require device re-registration');
                    break;
                case ThreatType.SUSPICIOUS_USER_AGENT:
                    recommendations.push('Block automated tool access');
                    recommendations.push('Require browser-based authentication');
                    break;
                case ThreatType.UNUSUAL_TIME:
                    recommendations.push('Send login notification to user');
                    break;
                case ThreatType.RAPID_REQUESTS:
                    recommendations.push('Apply rate limiting');
                    break;
            }
        }

        return [...new Set(recommendations)]; // Remove duplicates
    }

    /**
     * Cleanup old login attempts to free memory
     */
    private cleanupOldAttempts(): void {
        const cutoffTime = Date.now() - 24 * 60 * 60 * 1000; // 24 hours ago
        
        for (const [userId, attempts] of this.loginAttempts.entries()) {
            const recentAttempts = attempts.filter(
                a => a.timestamp.getTime() > cutoffTime
            );
            
            if (recentAttempts.length === 0) {
                this.loginAttempts.delete(userId);
            } else {
                this.loginAttempts.set(userId, recentAttempts);
            }
        }

        logger.debug('Cleaned up old login attempts', {
            usersTracked: this.loginAttempts.size
        });
    }

    /**
     * Get user's recent login history
     */
    public getUserLoginHistory(userId: string): LoginAttempt[] {
        return this.loginAttempts.get(userId) || [];
    }

    /**
     * Check if IP is in blocked list
     * Supports exact IP matching and CIDR notation
     * NOTE: For production, integrate with threat intelligence feeds
     */
    public isIPBlocked(ip: string): boolean {
        // Check against blocked IPs/ranges using proper CIDR matching
        for (const range of this.blockedIPRanges) {
            // Exact match or CIDR match
            if (ip === range || matchesIPPattern(ip, range)) {
                return true;
            }
        }
        return false;
    }

    /**
     * Add IP or CIDR range to blocked list
     */
    public blockIP(ip: string): void {
        if (!this.blockedIPRanges.includes(ip)) {
            this.blockedIPRanges.push(ip);
            logger.warn(`IP blocked: ${ip}`);
        }
    }

    /**
     * Get threat detection statistics
     */
    public getStatistics(): {
        usersTracked: number;
        totalAttempts: number;
        config: ThreatDetectionConfig;
        blockedIPs: number;
    } {
        let totalAttempts = 0;
        for (const attempts of this.loginAttempts.values()) {
            totalAttempts += attempts.length;
        }

        return {
            usersTracked: this.loginAttempts.size,
            totalAttempts,
            config: this.config,
            blockedIPs: this.blockedIPRanges.length
        };
    }
}

// Export singleton getter
export const getThreatDetectionService = (config?: Partial<ThreatDetectionConfig>): ThreatDetectionService => 
    ThreatDetectionService.getInstance(config);

