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
exports.OrganizationDeletionRequest = exports.OrgDeletionRequestStatus = void 0;
const typeorm_1 = require("typeorm");
const dataClassification_1 = require("../utils/dataClassification");
const encryptionTransformer_1 = require("../utils/encryptionTransformer");
const Organization_1 = require("./Organization");
const User_1 = require("./User");
var OrgDeletionRequestStatus;
(function (OrgDeletionRequestStatus) {
    OrgDeletionRequestStatus["PENDING"] = "pending";
    OrgDeletionRequestStatus["EMAIL_VERIFICATION_PENDING"] = "email_verification_pending";
    OrgDeletionRequestStatus["APPROVED"] = "approved";
    OrgDeletionRequestStatus["REJECTED"] = "rejected";
    OrgDeletionRequestStatus["CANCELLED"] = "cancelled";
    OrgDeletionRequestStatus["COMPLETED"] = "completed";
    OrgDeletionRequestStatus["FAILED"] = "failed";
})(OrgDeletionRequestStatus || (exports.OrgDeletionRequestStatus = OrgDeletionRequestStatus = {}));
let OrganizationDeletionRequest = class OrganizationDeletionRequest {
    id;
    organizationId;
    organization;
    requestedBy;
    requester;
    status;
    requestedAt;
    approvedAt;
    approvedBy;
    approver;
    approvalNotes;
    rejectedAt;
    rejectedBy;
    rejector;
    rejectionReason;
    scheduledFor;
    completedAt;
    cancelledAt;
    cancelledBy;
    canceller;
    cancellationReason;
    requestReason;
    requestIpAddress;
    requestUserAgent;
    failureReason;
    deleteDescendants;
    dataExportGenerated;
    exportFilePath;
    exportDownloadToken;
    exportDownloadCount;
    exportLastDownloadedAt;
    deletionPreview;
    gracePeriodDays;
    emailVerificationToken;
    emailVerifiedAt;
    createdAt;
    updatedAt;
    isEmailVerified() {
        return !!this.emailVerifiedAt;
    }
    isGracePeriodExpired() {
        if (!this.scheduledFor) {
            return false;
        }
        return new Date() >= this.scheduledFor;
    }
    canBeCancelled() {
        return [
            OrgDeletionRequestStatus.PENDING,
            OrgDeletionRequestStatus.APPROVED
        ].includes(this.status) && !this.isGracePeriodExpired();
    }
    canBeApproved() {
        return this.status === OrgDeletionRequestStatus.PENDING && this.isEmailVerified();
    }
    canBeRejected() {
        return this.status === OrgDeletionRequestStatus.PENDING;
    }
};
exports.OrganizationDeletionRequest = OrganizationDeletionRequest;
__decorate([
    (0, typeorm_1.PrimaryColumn)('uuid'),
    __metadata("design:type", String)
], OrganizationDeletionRequest.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.Column)({ type: 'varchar', length: 255 }),
    __metadata("design:type", String)
], OrganizationDeletionRequest.prototype, "organizationId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Organization_1.Organization, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'organizationId' }),
    __metadata("design:type", Organization_1.Organization)
], OrganizationDeletionRequest.prototype, "organization", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255 }),
    __metadata("design:type", String)
], OrganizationDeletionRequest.prototype, "requestedBy", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => User_1.User, { onDelete: 'SET NULL', nullable: true }),
    (0, typeorm_1.JoinColumn)({ name: 'requestedBy' }),
    __metadata("design:type", User_1.User)
], OrganizationDeletionRequest.prototype, "requester", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'enum',
        enum: OrgDeletionRequestStatus,
        default: OrgDeletionRequestStatus.PENDING
    }),
    __metadata("design:type", String)
], OrganizationDeletionRequest.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp' }),
    __metadata("design:type", Date)
], OrganizationDeletionRequest.prototype, "requestedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp', nullable: true }),
    __metadata("design:type", Date)
], OrganizationDeletionRequest.prototype, "approvedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255, nullable: true }),
    __metadata("design:type", String)
], OrganizationDeletionRequest.prototype, "approvedBy", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => User_1.User, { onDelete: 'SET NULL', nullable: true }),
    (0, typeorm_1.JoinColumn)({ name: 'approvedBy' }),
    __metadata("design:type", User_1.User)
], OrganizationDeletionRequest.prototype, "approver", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], OrganizationDeletionRequest.prototype, "approvalNotes", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp', nullable: true }),
    __metadata("design:type", Date)
], OrganizationDeletionRequest.prototype, "rejectedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255, nullable: true }),
    __metadata("design:type", String)
], OrganizationDeletionRequest.prototype, "rejectedBy", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => User_1.User, { onDelete: 'SET NULL', nullable: true }),
    (0, typeorm_1.JoinColumn)({ name: 'rejectedBy' }),
    __metadata("design:type", User_1.User)
], OrganizationDeletionRequest.prototype, "rejector", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], OrganizationDeletionRequest.prototype, "rejectionReason", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp', nullable: true }),
    __metadata("design:type", Date)
], OrganizationDeletionRequest.prototype, "scheduledFor", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp', nullable: true }),
    __metadata("design:type", Date)
], OrganizationDeletionRequest.prototype, "completedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp', nullable: true }),
    __metadata("design:type", Date)
], OrganizationDeletionRequest.prototype, "cancelledAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255, nullable: true }),
    __metadata("design:type", String)
], OrganizationDeletionRequest.prototype, "cancelledBy", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => User_1.User, { onDelete: 'SET NULL', nullable: true }),
    (0, typeorm_1.JoinColumn)({ name: 'cancelledBy' }),
    __metadata("design:type", User_1.User)
], OrganizationDeletionRequest.prototype, "canceller", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], OrganizationDeletionRequest.prototype, "cancellationReason", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], OrganizationDeletionRequest.prototype, "requestReason", void 0);
__decorate([
    (0, dataClassification_1.Classified)(dataClassification_1.DataClassification.CONFIDENTIAL, { reason: 'Client IP address for GDPR audit' }),
    (0, typeorm_1.Column)({ type: 'text', nullable: true, transformer: encryptionTransformer_1.conditionalEncryptionTransformer }),
    __metadata("design:type", String)
], OrganizationDeletionRequest.prototype, "requestIpAddress", void 0);
__decorate([
    (0, dataClassification_1.Classified)(dataClassification_1.DataClassification.CONFIDENTIAL, { reason: 'Client device info for GDPR audit' }),
    (0, typeorm_1.Column)({ type: 'text', nullable: true, transformer: encryptionTransformer_1.conditionalEncryptionTransformer }),
    __metadata("design:type", String)
], OrganizationDeletionRequest.prototype, "requestUserAgent", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], OrganizationDeletionRequest.prototype, "failureReason", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'boolean', default: false }),
    __metadata("design:type", Boolean)
], OrganizationDeletionRequest.prototype, "deleteDescendants", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'boolean', default: false }),
    __metadata("design:type", Boolean)
], OrganizationDeletionRequest.prototype, "dataExportGenerated", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 500, nullable: true }),
    __metadata("design:type", Object)
], OrganizationDeletionRequest.prototype, "exportFilePath", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 1000, nullable: true }),
    __metadata("design:type", Object)
], OrganizationDeletionRequest.prototype, "exportDownloadToken", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'integer', default: 0 }),
    __metadata("design:type", Number)
], OrganizationDeletionRequest.prototype, "exportDownloadCount", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp', nullable: true }),
    __metadata("design:type", Date)
], OrganizationDeletionRequest.prototype, "exportLastDownloadedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', nullable: true }),
    __metadata("design:type", Object)
], OrganizationDeletionRequest.prototype, "deletionPreview", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'integer', default: 30 }),
    __metadata("design:type", Number)
], OrganizationDeletionRequest.prototype, "gracePeriodDays", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255, nullable: true }),
    __metadata("design:type", String)
], OrganizationDeletionRequest.prototype, "emailVerificationToken", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp', nullable: true }),
    __metadata("design:type", Date)
], OrganizationDeletionRequest.prototype, "emailVerifiedAt", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], OrganizationDeletionRequest.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], OrganizationDeletionRequest.prototype, "updatedAt", void 0);
exports.OrganizationDeletionRequest = OrganizationDeletionRequest = __decorate([
    (0, typeorm_1.Entity)('organization_deletion_requests'),
    (0, typeorm_1.Index)(['organizationId', 'status']),
    (0, typeorm_1.Index)(['status', 'scheduledFor'])
], OrganizationDeletionRequest);
//# sourceMappingURL=OrganizationDeletionRequest.js.map