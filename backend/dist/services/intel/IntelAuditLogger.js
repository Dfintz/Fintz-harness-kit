"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.intelAuditLogger = exports.IntelAuditLogger = exports.IntelAuditAction = void 0;
const AuditService_1 = require("../audit/AuditService");
const DomainAuditLogger_1 = require("../shared/DomainAuditLogger");
var IntelAuditAction;
(function (IntelAuditAction) {
    IntelAuditAction["INTEL_REPORT_FILED"] = "INTEL_REPORT_FILED";
    IntelAuditAction["INTEL_REPORT_UPDATED"] = "INTEL_REPORT_UPDATED";
    IntelAuditAction["INTEL_REPORT_SHARED"] = "INTEL_REPORT_SHARED";
    IntelAuditAction["INTEL_REPORT_ARCHIVED"] = "INTEL_REPORT_ARCHIVED";
    IntelAuditAction["INTEL_SOURCE_VERIFIED"] = "INTEL_SOURCE_VERIFIED";
    IntelAuditAction["INTEL_SOURCE_COMPROMISED"] = "INTEL_SOURCE_COMPROMISED";
    IntelAuditAction["INTEL_BRIEFING_CREATED"] = "INTEL_BRIEFING_CREATED";
    IntelAuditAction["INTEL_ANALYSIS_COMPLETED"] = "INTEL_ANALYSIS_COMPLETED";
})(IntelAuditAction || (exports.IntelAuditAction = IntelAuditAction = {}));
class IntelAuditLogger extends DomainAuditLogger_1.DomainAuditLogger {
    static instance;
    constructor() {
        super({
            category: AuditService_1.AuditCategory.INTEL,
            domainLabel: 'Intel',
        });
    }
    static getInstance() {
        if (!IntelAuditLogger.instance) {
            IntelAuditLogger.instance = new IntelAuditLogger();
        }
        return IntelAuditLogger.instance;
    }
    static resetInstance() {
        if (process.env.NODE_ENV === 'test') {
            IntelAuditLogger.instance = undefined;
        }
    }
    buildMessage(entry) {
        return `Intel ${entry.action}: ${entry.reportTitle}`;
    }
    buildResource(entry) {
        return `intel/${entry.intelId}`;
    }
    logReportFiled(params) {
        this.log({
            action: IntelAuditAction.INTEL_REPORT_FILED,
            intelId: params.intelId,
            reportTitle: params.reportTitle,
            classificationLevel: params.classificationLevel,
            targetId: params.targetId,
            organizationId: params.organizationId,
            performedById: params.performedById,
            performedByName: params.performedByName,
            details: {
                classificationLevel: params.classificationLevel,
                targetId: params.targetId,
            },
        });
    }
    logReportShared(params) {
        this.log({
            action: IntelAuditAction.INTEL_REPORT_SHARED,
            intelId: params.intelId,
            reportTitle: params.reportTitle,
            classificationLevel: params.classificationLevel,
            organizationId: params.organizationId,
            performedById: params.performedById,
            performedByName: params.performedByName,
            details: {
                sharedWith: params.sharedWith,
                classificationLevel: params.classificationLevel,
            },
        });
    }
}
exports.IntelAuditLogger = IntelAuditLogger;
exports.intelAuditLogger = IntelAuditLogger.getInstance();
//# sourceMappingURL=IntelAuditLogger.js.map