"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getThreatDetectionService = exports.ThreatDetectionService = exports.ThreatType = void 0;
const data_source_1 = require("../../../data-source");
const User_1 = require("../../../models/User");
const ipWhitelist_1 = require("../../../utils/ipWhitelist");
const logger_1 = require("../../../utils/logger");
const SecurityEventService_1 = require("./SecurityEventService");
var ThreatType;
(function (ThreatType) {
    ThreatType["IMPOSSIBLE_TRAVEL"] = "impossible_travel";
    ThreatType["BRUTE_FORCE"] = "brute_force";
    ThreatType["CREDENTIAL_STUFFING"] = "credential_stuffing";
    ThreatType["UNUSUAL_TIME"] = "unusual_time";
    ThreatType["UNUSUAL_LOCATION"] = "unusual_location";
    ThreatType["SUSPICIOUS_USER_AGENT"] = "suspicious_user_agent";
    ThreatType["RAPID_REQUESTS"] = "rapid_requests";
    ThreatType["IP_REPUTATION"] = "ip_reputation";
    ThreatType["ACCOUNT_TAKEOVER"] = "account_takeover";
    ThreatType["BOT_ACTIVITY"] = "bot_activity";
})(ThreatType || (exports.ThreatType = ThreatType = {}));
const defaultConfig = {
    maxTravelSpeedKmH: 1000,
    minTimeBetweenLoginsMs: 30 * 60 * 1000,
    bruteForceThreshold: 5,
    bruteForceWindowMs: 15 * 60 * 1000,
    unusualHoursStart: 1,
    unusualHoursEnd: 5,
    enabledDetections: Object.values(ThreatType)
};
class ThreatDetectionService {
    static instance;
    config;
    loginAttempts = new Map();
    userRepository;
    securityEventService = (0, SecurityEventService_1.getSecurityEventService)();
    suspiciousUserAgentPatterns = [
        /curl/i,
        /wget/i,
        /python-requests/i,
        /go-http-client/i,
        /java\//i,
        /bot/i,
        /crawler/i,
        /spider/i,
        /scan/i,
        /^$/,
    ];
    blockedIPRanges = [];
    constructor(config = {}) {
        this.config = { ...defaultConfig, ...config };
        this.userRepository = data_source_1.AppDataSource.getRepository(User_1.User);
        setInterval(() => this.cleanupOldAttempts(), 60 * 60 * 1000);
        logger_1.logger.info('ThreatDetectionService initialized with config:', {
            bruteForceThreshold: this.config.bruteForceThreshold,
            enabledDetections: this.config.enabledDetections.length
        });
    }
    static getInstance(config) {
        if (!ThreatDetectionService.instance) {
            ThreatDetectionService.instance = new ThreatDetectionService(config);
        }
        return ThreatDetectionService.instance;
    }
    async assessLoginThreat(attempt) {
        const threats = [];
        let riskScore = 0;
        this.recordLoginAttempt(attempt);
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
        riskScore = Math.min(100, riskScore);
        const riskLevel = this.getRiskLevel(riskScore);
        const recommendations = this.generateRecommendations(threats, riskLevel);
        if (threats.length > 0) {
            this.securityEventService.logAnomalyEvent(SecurityEventService_1.SecurityEventType.SUSPICIOUS_PATTERN, {
                userId: attempt.userId,
                ipAddress: attempt.ip,
                message: `${threats.length} threat indicators detected during login`,
                severity: this.mapRiskToSeverity(riskLevel),
                metadata: {
                    threats: threats.map(t => t.type),
                    riskScore,
                    riskLevel
                }
            });
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
    detectBruteForce(attempt) {
        const userAttempts = this.loginAttempts.get(attempt.userId) || [];
        const windowStart = Date.now() - this.config.bruteForceWindowMs;
        const recentFailures = userAttempts.filter(a => !a.success && a.timestamp.getTime() > windowStart);
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
    detectImpossibleTravel(attempt) {
        if (!attempt.location?.latitude || !attempt.location?.longitude) {
            logger_1.logger.debug('Impossible travel check skipped - no geo data available', {
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
            return null;
        }
        const timeDiffMs = attempt.timestamp.getTime() - previousSuccessful.timestamp.getTime();
        if (timeDiffMs <= 0) {
            return null;
        }
        const prevLat = previousSuccessful.location.latitude;
        const prevLon = previousSuccessful.location.longitude;
        if (prevLat === undefined || prevLon === undefined) {
            return null;
        }
        const distance = this.calculateDistance(prevLat, prevLon, attempt.location.latitude, attempt.location.longitude);
        const timeHours = timeDiffMs / (1000 * 60 * 60);
        const speedKmH = distance / timeHours;
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
    detectUnusualTime(attempt) {
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
    detectSuspiciousUserAgent(attempt) {
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
    detectRapidRequests(attempt) {
        const userAttempts = this.loginAttempts.get(attempt.userId) || [];
        const oneMinuteAgo = Date.now() - 60000;
        const recentAttempts = userAttempts.filter(a => a.timestamp.getTime() > oneMinuteAgo);
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
    recordLoginAttempt(attempt) {
        const userId = attempt.userId;
        const attempts = this.loginAttempts.get(userId) || [];
        attempts.push(attempt);
        if (attempts.length > 100) {
            attempts.shift();
        }
        this.loginAttempts.set(userId, attempts);
    }
    calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371;
        const dLat = this.toRad(lat2 - lat1);
        const dLon = this.toRad(lon2 - lon1);
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
                Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }
    toRad(deg) {
        return deg * (Math.PI / 180);
    }
    getThreatScore(threat) {
        const severityScores = {
            'low': 10,
            'medium': 25,
            'high': 40,
            'critical': 60
        };
        return severityScores[threat.severity] * (threat.confidence / 100);
    }
    getRiskLevel(score) {
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
    mapRiskToSeverity(riskLevel) {
        const mapping = {
            'low': SecurityEventService_1.SecurityEventSeverity.LOW,
            'medium': SecurityEventService_1.SecurityEventSeverity.MEDIUM,
            'high': SecurityEventService_1.SecurityEventSeverity.HIGH,
            'critical': SecurityEventService_1.SecurityEventSeverity.CRITICAL
        };
        return mapping[riskLevel];
    }
    generateRecommendations(threats, riskLevel) {
        const recommendations = [];
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
        return [...new Set(recommendations)];
    }
    cleanupOldAttempts() {
        const cutoffTime = Date.now() - 24 * 60 * 60 * 1000;
        for (const [userId, attempts] of this.loginAttempts.entries()) {
            const recentAttempts = attempts.filter(a => a.timestamp.getTime() > cutoffTime);
            if (recentAttempts.length === 0) {
                this.loginAttempts.delete(userId);
            }
            else {
                this.loginAttempts.set(userId, recentAttempts);
            }
        }
        logger_1.logger.debug('Cleaned up old login attempts', {
            usersTracked: this.loginAttempts.size
        });
    }
    getUserLoginHistory(userId) {
        return this.loginAttempts.get(userId) || [];
    }
    isIPBlocked(ip) {
        for (const range of this.blockedIPRanges) {
            if (ip === range || (0, ipWhitelist_1.matchesIPPattern)(ip, range)) {
                return true;
            }
        }
        return false;
    }
    blockIP(ip) {
        if (!this.blockedIPRanges.includes(ip)) {
            this.blockedIPRanges.push(ip);
            logger_1.logger.warn(`IP blocked: ${ip}`);
        }
    }
    getStatistics() {
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
exports.ThreatDetectionService = ThreatDetectionService;
const getThreatDetectionService = (config) => ThreatDetectionService.getInstance(config);
exports.getThreatDetectionService = getThreatDetectionService;
//# sourceMappingURL=ThreatDetectionService.js.map