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
exports.IntelAuditLog = exports.IntelAuditAction = void 0;
const typeorm_1 = require("typeorm");
const IntelEntry_1 = require("./IntelEntry");
const Organization_1 = require("./Organization");
const User_1 = require("./User");
var IntelAuditAction;
(function (IntelAuditAction) {
    IntelAuditAction["ENTRY_CREATED"] = "entry_created";
    IntelAuditAction["ENTRY_VIEWED"] = "entry_viewed";
    IntelAuditAction["ENTRY_UPDATED"] = "entry_updated";
    IntelAuditAction["ENTRY_DELETED"] = "entry_deleted";
    IntelAuditAction["ENTRY_ARCHIVED"] = "entry_archived";
    IntelAuditAction["ENTRY_RESTORED"] = "entry_restored";
    IntelAuditAction["OFFICER_APPOINTED"] = "officer_appointed";
    IntelAuditAction["OFFICER_PROMOTED"] = "officer_promoted";
    IntelAuditAction["OFFICER_DEMOTED"] = "officer_demoted";
    IntelAuditAction["OFFICER_REMOVED"] = "officer_removed";
    IntelAuditAction["OFFICER_ACCESS_CHANGED"] = "officer_access_changed";
    IntelAuditAction["ACCESS_GRANTED"] = "access_granted";
    IntelAuditAction["ACCESS_DENIED"] = "access_denied";
    IntelAuditAction["UNAUTHORIZED_ATTEMPT"] = "unauthorized_attempt";
    IntelAuditAction["VAULT_ACCESSED"] = "vault_accessed";
    IntelAuditAction["EXPORT_PERFORMED"] = "export_performed";
    IntelAuditAction["BULK_OPERATION"] = "bulk_operation";
    IntelAuditAction["APPROVAL_REQUESTED"] = "approval_requested";
    IntelAuditAction["APPROVAL_GRANTED"] = "approval_granted";
    IntelAuditAction["APPROVAL_REJECTED"] = "approval_rejected";
    IntelAuditAction["APPROVAL_WITHDRAWN"] = "approval_withdrawn";
    IntelAuditAction["APPROVAL_EXPIRED"] = "approval_expired";
    IntelAuditAction["SHARE_CREATED"] = "share_created";
    IntelAuditAction["SHARE_ACCEPTED"] = "share_accepted";
    IntelAuditAction["SHARE_DECLINED"] = "share_declined";
    IntelAuditAction["SHARE_REVOKED"] = "share_revoked";
    IntelAuditAction["SHARE_EXPIRED"] = "share_expired";
    IntelAuditAction["SHARE_VIEWED"] = "share_viewed";
    IntelAuditAction["DECLASSIFICATION_SCHEDULED"] = "declassification_scheduled";
    IntelAuditAction["DECLASSIFICATION_EXECUTED"] = "declassification_executed";
    IntelAuditAction["DECLASSIFICATION_CANCELLED"] = "declassification_cancelled";
    IntelAuditAction["AGING_REVIEW_DUE"] = "aging_review_due";
    IntelAuditAction["AGING_REVIEW_COMPLETED"] = "aging_review_completed";
    IntelAuditAction["EXPIRATION_WARNING"] = "expiration_warning";
    IntelAuditAction["ENTRY_EXPIRED"] = "entry_expired";
})(IntelAuditAction || (exports.IntelAuditAction = IntelAuditAction = {}));
let IntelAuditLog = class IntelAuditLog {
    id;
    organizationId;
    organization;
    userId;
    user;
    intelEntryId;
    intelEntry;
    action;
    description;
    ipAddress;
    userAgent;
    severity;
    metadata;
    createdAt;
};
exports.IntelAuditLog = IntelAuditLog;
__decorate([
    (0, typeorm_1.PrimaryColumn)(),
    __metadata("design:type", String)
], IntelAuditLog.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    (0, typeorm_1.Index)(),
    __metadata("design:type", String)
], IntelAuditLog.prototype, "organizationId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Organization_1.Organization, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'organizationId' }),
    __metadata("design:type", Organization_1.Organization)
], IntelAuditLog.prototype, "organization", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    (0, typeorm_1.Index)(),
    __metadata("design:type", String)
], IntelAuditLog.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => User_1.User, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'userId' }),
    __metadata("design:type", User_1.User)
], IntelAuditLog.prototype, "user", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    (0, typeorm_1.Index)(),
    __metadata("design:type", String)
], IntelAuditLog.prototype, "intelEntryId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => IntelEntry_1.IntelEntry, { onDelete: 'SET NULL' }),
    (0, typeorm_1.JoinColumn)({ name: 'intelEntryId' }),
    __metadata("design:type", IntelEntry_1.IntelEntry)
], IntelAuditLog.prototype, "intelEntry", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'varchar',
        enum: IntelAuditAction,
    }),
    (0, typeorm_1.Index)(),
    __metadata("design:type", String)
], IntelAuditLog.prototype, "action", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], IntelAuditLog.prototype, "description", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], IntelAuditLog.prototype, "ipAddress", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], IntelAuditLog.prototype, "userAgent", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'varchar',
        default: 'info',
    }),
    (0, typeorm_1.Index)(),
    __metadata("design:type", String)
], IntelAuditLog.prototype, "severity", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'json', nullable: true }),
    __metadata("design:type", Object)
], IntelAuditLog.prototype, "metadata", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    (0, typeorm_1.Index)(),
    __metadata("design:type", Date)
], IntelAuditLog.prototype, "createdAt", void 0);
exports.IntelAuditLog = IntelAuditLog = __decorate([
    (0, typeorm_1.Entity)('intel_audit_logs')
], IntelAuditLog);
//# sourceMappingURL=IntelAuditLog.js.map