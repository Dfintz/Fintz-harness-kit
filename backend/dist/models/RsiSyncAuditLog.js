"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RsiSyncAuditLog = exports.SyncType = void 0;
const typeorm_1 = require("typeorm");
const Organization_1 = require("./Organization");
var SyncType;
(function (SyncType) {
    SyncType["MANUAL"] = "manual";
    SyncType["SCHEDULED"] = "scheduled";
    SyncType["WEBHOOK"] = "webhook";
})(SyncType || (exports.SyncType = SyncType = {}));
let RsiSyncAuditLog = class RsiSyncAuditLog {
    id;
    organizationId;
    organization;
    syncType;
    changesDetected;
    changesApplied;
    errors;
    details;
    syncedAt;
    hasErrors() {
        return this.errors > 0;
    }
    hasChanges() {
        return this.changesDetected > 0;
    }
    wasFullySuccessful() {
        return this.changesDetected === this.changesApplied && this.errors === 0;
    }
    getSuccessRate() {
        if (this.changesDetected === 0) {
            return 100;
        }
        return Math.round((this.changesApplied / this.changesDetected) * 100);
    }
    getSummary() {
        if (this.changesDetected === 0) {
            return 'No changes detected';
        }
        const parts = [`${this.changesApplied}/${this.changesDetected} changes applied`];
        if (this.errors > 0) {
            parts.push(`${this.errors} errors`);
        }
        return parts.join(', ');
    }
    getRoleChangeCount() {
        if (!this.details) {
            return 0;
        }
        return (this.details.rolesAdded?.length || 0) + (this.details.rolesRemoved?.length || 0);
    }
    getRankChangeCount() {
        return this.details?.rankChanges?.length || 0;
    }
    getRemovedMemberCount() {
        return this.details?.removedMembers?.length || 0;
    }
    getConflictCount() {
        return this.details?.conflicts?.length || 0;
    }
    getDurationSeconds() {
        if (!this.details?.durationMs) {
            return null;
        }
        return Math.round(this.details.durationMs / 100) / 10;
    }
};
exports.RsiSyncAuditLog = RsiSyncAuditLog;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], RsiSyncAuditLog.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)('uuid'),
    __metadata("design:type", String)
], RsiSyncAuditLog.prototype, "organizationId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Organization_1.Organization, { nullable: false, onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'organizationId' }),
    __metadata("design:type", Organization_1.Organization)
], RsiSyncAuditLog.prototype, "organization", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'varchar',
        length: 20,
    }),
    __metadata("design:type", String)
], RsiSyncAuditLog.prototype, "syncType", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 0 }),
    __metadata("design:type", Number)
], RsiSyncAuditLog.prototype, "changesDetected", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 0 }),
    __metadata("design:type", Number)
], RsiSyncAuditLog.prototype, "changesApplied", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 0 }),
    __metadata("design:type", Number)
], RsiSyncAuditLog.prototype, "errors", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', nullable: true }),
    __metadata("design:type", Object)
], RsiSyncAuditLog.prototype, "details", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], RsiSyncAuditLog.prototype, "syncedAt", void 0);
exports.RsiSyncAuditLog = RsiSyncAuditLog = __decorate([
    (0, typeorm_1.Entity)('rsi_sync_audit_log'),
    (0, typeorm_1.Index)('IDX_rsi_sync_audit_log_org_id', ['organizationId']),
    (0, typeorm_1.Index)('IDX_rsi_sync_audit_log_sync_type', ['syncType']),
    (0, typeorm_1.Index)('IDX_rsi_sync_audit_log_synced_at', ['syncedAt']),
    (0, typeorm_1.Index)('IDX_rsi_sync_audit_log_org_synced_at', ['organizationId', 'syncedAt'])
], RsiSyncAuditLog);
//# sourceMappingURL=RsiSyncAuditLog.js.map