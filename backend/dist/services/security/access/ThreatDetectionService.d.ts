export interface GeoLocation {
    ip: string;
    country?: string;
    region?: string;
    city?: string;
    latitude?: number;
    longitude?: number;
    timestamp: Date;
}
export interface LoginAttempt {
    userId: string;
    ip: string;
    userAgent: string;
    timestamp: Date;
    success: boolean;
    location?: GeoLocation;
}
export interface ThreatAssessment {
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    riskScore: number;
    threats: ThreatIndicator[];
    recommendations: string[];
    requiresMFA: boolean;
    requiresManualReview: boolean;
}
export interface ThreatIndicator {
    type: ThreatType;
    severity: 'low' | 'medium' | 'high' | 'critical';
    description: string;
    confidence: number;
    evidence: Record<string, unknown>;
}
export declare enum ThreatType {
    IMPOSSIBLE_TRAVEL = "impossible_travel",
    BRUTE_FORCE = "brute_force",
    CREDENTIAL_STUFFING = "credential_stuffing",
    UNUSUAL_TIME = "unusual_time",
    UNUSUAL_LOCATION = "unusual_location",
    SUSPICIOUS_USER_AGENT = "suspicious_user_agent",
    RAPID_REQUESTS = "rapid_requests",
    IP_REPUTATION = "ip_reputation",
    ACCOUNT_TAKEOVER = "account_takeover",
    BOT_ACTIVITY = "bot_activity"
}
export interface ThreatDetectionConfig {
    maxTravelSpeedKmH: number;
    minTimeBetweenLoginsMs: number;
    bruteForceThreshold: number;
    bruteForceWindowMs: number;
    unusualHoursStart: number;
    unusualHoursEnd: number;
    enabledDetections: ThreatType[];
}
export declare class ThreatDetectionService {
    private static instance;
    private config;
    private loginAttempts;
    private userRepository;
    private securityEventService;
    private suspiciousUserAgentPatterns;
    private blockedIPRanges;
    private constructor();
    static getInstance(config?: Partial<ThreatDetectionConfig>): ThreatDetectionService;
    assessLoginThreat(attempt: LoginAttempt): Promise<ThreatAssessment>;
    private detectBruteForce;
    private detectImpossibleTravel;
    private detectUnusualTime;
    private detectSuspiciousUserAgent;
    private detectRapidRequests;
    private recordLoginAttempt;
    private calculateDistance;
    private toRad;
    private getThreatScore;
    private getRiskLevel;
    private mapRiskToSeverity;
    private generateRecommendations;
    private cleanupOldAttempts;
    getUserLoginHistory(userId: string): LoginAttempt[];
    isIPBlocked(ip: string): boolean;
    blockIP(ip: string): void;
    getStatistics(): {
        usersTracked: number;
        totalAttempts: number;
        config: ThreatDetectionConfig;
        blockedIPs: number;
    };
}
export declare const getThreatDetectionService: (config?: Partial<ThreatDetectionConfig>) => ThreatDetectionService;
//# sourceMappingURL=ThreatDetectionService.d.ts.map