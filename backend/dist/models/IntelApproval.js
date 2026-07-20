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
exports.IntelApproval = exports.IntelApprovalStatus = void 0;
const typeorm_1 = require("typeorm");
const IntelEntry_1 = require("./IntelEntry");
const Organization_1 = require("./Organization");
const User_1 = require("./User");
var IntelApprovalStatus;
(function (IntelApprovalStatus) {
    IntelApprovalStatus["PENDING"] = "pending";
    IntelApprovalStatus["APPROVED"] = "approved";
    IntelApprovalStatus["REJECTED"] = "rejected";
    IntelApprovalStatus["WITHDRAWN"] = "withdrawn";
    IntelApprovalStatus["EXPIRED"] = "expired";
})(IntelApprovalStatus || (exports.IntelApprovalStatus = IntelApprovalStatus = {}));
let IntelApproval = class IntelApproval {
    id;
    organizationId;
    organization;
    intelEntryId;
    intelEntry;
    requestedBy;
    requester;
    status;
    reason;
    requiredApprovals;
    approvers;
    approvalDetails;
    expiresAt;
    completedAt;
    completedBy;
    completer;
    createdAt;
};
exports.IntelApproval = IntelApproval;
__decorate([
    (0, typeorm_1.PrimaryColumn)(),
    __metadata("design:type", String)
], IntelApproval.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    (0, typeorm_1.Index)(),
    __metadata("design:type", String)
], IntelApproval.prototype, "organizationId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Organization_1.Organization, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'organizationId' }),
    __metadata("design:type", Organization_1.Organization)
], IntelApproval.prototype, "organization", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    (0, typeorm_1.Index)(),
    __metadata("design:type", String)
], IntelApproval.prototype, "intelEntryId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => IntelEntry_1.IntelEntry, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'intelEntryId' }),
    __metadata("design:type", IntelEntry_1.IntelEntry)
], IntelApproval.prototype, "intelEntry", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], IntelApproval.prototype, "requestedBy", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => User_1.User, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'requestedBy' }),
    __metadata("design:type", User_1.User)
], IntelApproval.prototype, "requester", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'varchar',
        enum: IntelApprovalStatus,
        default: IntelApprovalStatus.PENDING,
    }),
    (0, typeorm_1.Index)(),
    __metadata("design:type", String)
], IntelApproval.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], IntelApproval.prototype, "reason", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 2 }),
    __metadata("design:type", Number)
], IntelApproval.prototype, "requiredApprovals", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'simple-array', nullable: true }),
    __metadata("design:type", Array)
], IntelApproval.prototype, "approvers", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'json', nullable: true }),
    __metadata("design:type", Array)
], IntelApproval.prototype, "approvalDetails", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp', nullable: true }),
    __metadata("design:type", Date)
], IntelApproval.prototype, "expiresAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp', nullable: true }),
    __metadata("design:type", Date)
], IntelApproval.prototype, "completedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], IntelApproval.prototype, "completedBy", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => User_1.User, { onDelete: 'SET NULL' }),
    (0, typeorm_1.JoinColumn)({ name: 'completedBy' }),
    __metadata("design:type", User_1.User)
], IntelApproval.prototype, "completer", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    (0, typeorm_1.Index)(),
    __metadata("design:type", Date)
], IntelApproval.prototype, "createdAt", void 0);
exports.IntelApproval = IntelApproval = __decorate([
    (0, typeorm_1.Entity)('intel_approvals')
], IntelApproval);
//# sourceMappingURL=IntelApproval.js.map