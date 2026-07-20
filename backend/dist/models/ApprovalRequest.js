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
exports.ApprovalRequest = exports.ApprovalRequestType = exports.ApprovalRequestStatus = void 0;
const typeorm_1 = require("typeorm");
const Organization_1 = require("./Organization");
const User_1 = require("./User");
var ApprovalRequestStatus;
(function (ApprovalRequestStatus) {
    ApprovalRequestStatus["PENDING"] = "pending";
    ApprovalRequestStatus["APPROVED"] = "approved";
    ApprovalRequestStatus["REJECTED"] = "rejected";
    ApprovalRequestStatus["DELEGATED"] = "delegated";
    ApprovalRequestStatus["WITHDRAWN"] = "withdrawn";
    ApprovalRequestStatus["EXPIRED"] = "expired";
})(ApprovalRequestStatus || (exports.ApprovalRequestStatus = ApprovalRequestStatus = {}));
var ApprovalRequestType;
(function (ApprovalRequestType) {
    ApprovalRequestType["MEMBERSHIP"] = "membership";
    ApprovalRequestType["RESOURCE_ACCESS"] = "resource_access";
    ApprovalRequestType["FLEET_MODIFICATION"] = "fleet_modification";
    ApprovalRequestType["ROLE_CHANGE"] = "role_change";
    ApprovalRequestType["CONTENT_PUBLISH"] = "content_publish";
    ApprovalRequestType["GENERAL"] = "general";
})(ApprovalRequestType || (exports.ApprovalRequestType = ApprovalRequestType = {}));
let ApprovalRequest = class ApprovalRequest {
    id;
    organizationId;
    organization;
    type;
    title;
    description;
    resourceId;
    resourceType;
    requestedBy;
    requester;
    status;
    reason;
    assignedTo;
    assignee;
    delegatedTo;
    delegatedBy;
    history;
    metadata;
    expiresAt;
    completedAt;
    completedBy;
    createdAt;
    updatedAt;
};
exports.ApprovalRequest = ApprovalRequest;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], ApprovalRequest.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    (0, typeorm_1.Index)(),
    __metadata("design:type", String)
], ApprovalRequest.prototype, "organizationId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Organization_1.Organization, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'organizationId' }),
    __metadata("design:type", Organization_1.Organization)
], ApprovalRequest.prototype, "organization", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar' }),
    __metadata("design:type", String)
], ApprovalRequest.prototype, "type", void 0);
__decorate([
    (0, typeorm_1.Column)({ length: 200, nullable: true }),
    __metadata("design:type", String)
], ApprovalRequest.prototype, "title", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], ApprovalRequest.prototype, "description", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', nullable: true }),
    __metadata("design:type", String)
], ApprovalRequest.prototype, "resourceId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', nullable: true }),
    __metadata("design:type", String)
], ApprovalRequest.prototype, "resourceType", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], ApprovalRequest.prototype, "requestedBy", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => User_1.User, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'requestedBy' }),
    __metadata("design:type", User_1.User)
], ApprovalRequest.prototype, "requester", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', default: ApprovalRequestStatus.PENDING }),
    (0, typeorm_1.Index)(),
    __metadata("design:type", String)
], ApprovalRequest.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], ApprovalRequest.prototype, "reason", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    (0, typeorm_1.Index)(),
    __metadata("design:type", String)
], ApprovalRequest.prototype, "assignedTo", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => User_1.User, { onDelete: 'SET NULL', nullable: true }),
    (0, typeorm_1.JoinColumn)({ name: 'assignedTo' }),
    __metadata("design:type", User_1.User)
], ApprovalRequest.prototype, "assignee", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], ApprovalRequest.prototype, "delegatedTo", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], ApprovalRequest.prototype, "delegatedBy", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'json', nullable: true }),
    __metadata("design:type", Array)
], ApprovalRequest.prototype, "history", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'json', nullable: true }),
    __metadata("design:type", Object)
], ApprovalRequest.prototype, "metadata", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp', nullable: true }),
    __metadata("design:type", Date)
], ApprovalRequest.prototype, "expiresAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp', nullable: true }),
    __metadata("design:type", Date)
], ApprovalRequest.prototype, "completedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], ApprovalRequest.prototype, "completedBy", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    (0, typeorm_1.Index)(),
    __metadata("design:type", Date)
], ApprovalRequest.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], ApprovalRequest.prototype, "updatedAt", void 0);
exports.ApprovalRequest = ApprovalRequest = __decorate([
    (0, typeorm_1.Entity)('approval_requests')
], ApprovalRequest);
//# sourceMappingURL=ApprovalRequest.js.map