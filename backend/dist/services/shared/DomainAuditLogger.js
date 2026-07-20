"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DomainAuditLogger = void 0;
const logger_1 = require("../../utils/logger");
const AuditService_1 = require("../audit/AuditService");
class DomainAuditLogger {
    buffer;
    head = 0;
    count = 0;
    maxEntries;
    config;
    constructor(config) {
        this.config = config;
        this.maxEntries = config.maxEntries ?? 5000;
        this.buffer = new Array(this.maxEntries).fill(null);
    }
    log(entry) {
        const auditEntry = {
            ...entry,
            timestamp: new Date(),
        };
        this.pushEntry(auditEntry);
        try {
            AuditService_1.auditService.log({
                category: this.config.category,
                action: entry.action,
                message: this.buildMessage(auditEntry),
                userId: entry.performedById,
                username: entry.performedByName,
                organizationId: entry.organizationId,
                resource: this.buildResource(auditEntry),
                metadata: {
                    ...entry.details,
                },
            });
        }
        catch (err) {
            logger_1.logger.error(`${this.config.domainLabel} audit emission failed`, {
                action: entry.action,
                organizationId: entry.organizationId,
                error: err instanceof Error ? err.message : String(err),
            });
        }
        logger_1.logger.debug(`${this.config.domainLabel} audit logged`, {
            action: entry.action,
            performedBy: entry.performedByName,
        });
    }
    getAuditLog(options) {
        let filtered = this.getEntries();
        if (options?.organizationId) {
            filtered = filtered.filter(e => e.organizationId === options.organizationId);
        }
        if (options?.action) {
            filtered = filtered.filter(e => e.action === options.action);
        }
        if (options?.startDate) {
            const start = options.startDate;
            filtered = filtered.filter(e => e.timestamp >= start);
        }
        if (options?.endDate) {
            const end = options.endDate;
            filtered = filtered.filter(e => e.timestamp <= end);
        }
        if (options?.filter) {
            filtered = filtered.filter(options.filter);
        }
        if (options?.limit) {
            filtered = filtered.slice(0, options.limit);
        }
        return filtered;
    }
    pushEntry(entry) {
        this.buffer[this.head] = entry;
        this.head = (this.head + 1) % this.maxEntries;
        if (this.count < this.maxEntries) {
            this.count++;
        }
    }
    getEntries() {
        const entries = [];
        for (let i = 0; i < this.count; i++) {
            const idx = (this.head - 1 - i + this.maxEntries) % this.maxEntries;
            const entry = this.buffer[idx];
            if (entry) {
                entries.push(entry);
            }
        }
        return entries;
    }
    resetBuffer() {
        if (process.env.NODE_ENV === 'test') {
            this.buffer.fill(null);
            this.head = 0;
            this.count = 0;
        }
    }
}
exports.DomainAuditLogger = DomainAuditLogger;
//# sourceMappingURL=DomainAuditLogger.js.map