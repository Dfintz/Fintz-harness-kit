"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.securityAuditLogger = exports.SecurityAuditLogger = exports.SecurityAuditAction = void 0;
const AuditService_1 = require("../audit/AuditService");
const DomainAuditLogger_1 = require("../shared/DomainAuditLogger");
var SecurityAuditAction;
(function (SecurityAuditAction) {
    SecurityAuditAction["SECURITY_INCIDENT_REPORTED"] = "SECURITY_INCIDENT_REPORTED";
    SecurityAuditAction["SECURITY_VULNERABILITY_PATCHED"] = "SECURITY_VULNERABILITY_PATCHED";
    SecurityAuditAction["SUSPICIOUS_ACTIVITY_DETECTED"] = "SUSPICIOUS_ACTIVITY_DETECTED";
    SecurityAuditAction["BRUTE_FORCE_ATTEMPT"] = "BRUTE_FORCE_ATTEMPT";
    SecurityAuditAction["UNAUTHORIZED_ACCESS_ATTEMPT"] = "UNAUTHORIZED_ACCESS_ATTEMPT";
    SecurityAuditAction["API_KEY_ROTATED"] = "API_KEY_ROTATED";
    SecurityAuditAction["CERTIFICATE_RENEWED"] = "CERTIFICATE_RENEWED";
    SecurityAuditAction["SECURITY_AUDIT_RUN"] = "SECURITY_AUDIT_RUN";
})(SecurityAuditAction || (exports.SecurityAuditAction = SecurityAuditAction = {}));
class SecurityAuditLogger extends DomainAuditLogger_1.DomainAuditLogger {
    static instance;
    constructor() {
        super({
            category: AuditService_1.AuditCategory.SECURITY,
            domainLabel: 'Security',
        });
    }
    static getInstance() {
        if (!SecurityAuditLogger.instance) {
            SecurityAuditLogger.instance = new SecurityAuditLogger();
        }
        return SecurityAuditLogger.instance;
    }
    static resetInstance() {
        if (process.env.NODE_ENV === 'test') {
            SecurityAuditLogger.instance = undefined;
        }
    }
    buildMessage(entry) {
        return `Security ${entry.action}: [${entry.severity.toUpperCase()}] ${entry.description || entry.securityEventId}`;
    }
    buildResource(entry) {
        return `security/${entry.securityEventId}`;
    }
    logIncident(params) {
        this.log({
            action: SecurityAuditAction.SECURITY_INCIDENT_REPORTED,
            securityEventId: params.securityEventId,
            severity: params.severity,
            description: params.description,
            sourceIp: params.sourceIp,
            targetResource: params.targetResource,
            organizationId: params.organizationId,
            performedById: params.performedById,
            performedByName: params.performedByName,
            details: {
                severity: params.severity,
                sourceIp: params.sourceIp,
                targetResource: params.targetResource,
            },
        });
    }
}
exports.SecurityAuditLogger = SecurityAuditLogger;
exports.securityAuditLogger = SecurityAuditLogger.getInstance();
//# sourceMappingURL=SecurityAuditLogger.js.map