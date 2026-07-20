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
exports.ContactRequest = exports.MessageVisibility = exports.ContactTargetType = exports.ContactRequestStatus = void 0;
const typeorm_1 = require("typeorm");
const encryptionTransformer_1 = require("../utils/encryptionTransformer");
const Organization_1 = require("./Organization");
const User_1 = require("./User");
var ContactRequestStatus;
(function (ContactRequestStatus) {
    ContactRequestStatus["PENDING"] = "pending";
    ContactRequestStatus["READ"] = "read";
    ContactRequestStatus["REPLIED"] = "replied";
    ContactRequestStatus["ARCHIVED"] = "archived";
    ContactRequestStatus["SPAM"] = "spam";
})(ContactRequestStatus || (exports.ContactRequestStatus = ContactRequestStatus = {}));
var ContactTargetType;
(function (ContactTargetType) {
    ContactTargetType["ORGANIZATION"] = "organization";
    ContactTargetType["ALLIANCE"] = "alliance";
})(ContactTargetType || (exports.ContactTargetType = ContactTargetType = {}));
var MessageVisibility;
(function (MessageVisibility) {
    MessageVisibility["ALL"] = "all";
    MessageVisibility["LEADERSHIP"] = "leadership";
    MessageVisibility["HR"] = "hr";
    MessageVisibility["DIPLOMACY"] = "diplomacy";
    MessageVisibility["RECRUITMENT"] = "recruitment";
    MessageVisibility["CUSTOM"] = "custom";
})(MessageVisibility || (exports.MessageVisibility = MessageVisibility = {}));
let ContactRequest = class ContactRequest {
    id;
    targetType;
    organizationId;
    organization;
    allianceId;
    senderUserId;
    senderUser;
    senderName;
    senderEmail;
    rsiHandle;
    discordUsername;
    subject;
    message;
    contactType;
    status;
    internalNotes;
    handledBy;
    handledAt;
    senderIp;
    userAgent;
    visibility;
    visibleToRoles;
    createdAt;
    updatedAt;
    replies;
};
exports.ContactRequest = ContactRequest;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], ContactRequest.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'enum',
        enum: ContactTargetType,
        default: ContactTargetType.ORGANIZATION,
    }),
    __metadata("design:type", String)
], ContactRequest.prototype, "targetType", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    (0, typeorm_1.Index)(),
    __metadata("design:type", String)
], ContactRequest.prototype, "organizationId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Organization_1.Organization, { onDelete: 'CASCADE', nullable: true }),
    (0, typeorm_1.JoinColumn)({ name: 'organizationId' }),
    __metadata("design:type", Organization_1.Organization)
], ContactRequest.prototype, "organization", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    (0, typeorm_1.Index)(),
    __metadata("design:type", String)
], ContactRequest.prototype, "allianceId", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    (0, typeorm_1.Index)(),
    __metadata("design:type", String)
], ContactRequest.prototype, "senderUserId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => User_1.User, { onDelete: 'SET NULL', nullable: true }),
    (0, typeorm_1.JoinColumn)({ name: 'senderUserId' }),
    __metadata("design:type", User_1.User)
], ContactRequest.prototype, "senderUser", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 100 }),
    __metadata("design:type", String)
], ContactRequest.prototype, "senderName", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255, nullable: true }),
    (0, typeorm_1.Index)(),
    __metadata("design:type", String)
], ContactRequest.prototype, "senderEmail", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 100, nullable: true }),
    __metadata("design:type", String)
], ContactRequest.prototype, "rsiHandle", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 100, nullable: true }),
    __metadata("design:type", String)
], ContactRequest.prototype, "discordUsername", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', transformer: encryptionTransformer_1.encryptionTransformer }),
    __metadata("design:type", String)
], ContactRequest.prototype, "subject", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', transformer: encryptionTransformer_1.encryptionTransformer }),
    __metadata("design:type", String)
], ContactRequest.prototype, "message", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 50, default: 'general' }),
    __metadata("design:type", String)
], ContactRequest.prototype, "contactType", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'enum',
        enum: ContactRequestStatus,
        default: ContactRequestStatus.PENDING,
    }),
    __metadata("design:type", String)
], ContactRequest.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true, transformer: encryptionTransformer_1.encryptionTransformer }),
    __metadata("design:type", String)
], ContactRequest.prototype, "internalNotes", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', nullable: true }),
    __metadata("design:type", String)
], ContactRequest.prototype, "handledBy", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp', nullable: true }),
    __metadata("design:type", Date)
], ContactRequest.prototype, "handledAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 45, nullable: true }),
    __metadata("design:type", String)
], ContactRequest.prototype, "senderIp", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 500, nullable: true }),
    __metadata("design:type", String)
], ContactRequest.prototype, "userAgent", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'enum',
        enum: MessageVisibility,
        default: MessageVisibility.ALL,
    }),
    (0, typeorm_1.Index)(),
    __metadata("design:type", String)
], ContactRequest.prototype, "visibility", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', nullable: true }),
    __metadata("design:type", Array)
], ContactRequest.prototype, "visibleToRoles", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], ContactRequest.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], ContactRequest.prototype, "updatedAt", void 0);
__decorate([
    (0, typeorm_1.OneToMany)('ContactRequestReply', 'contactRequest'),
    __metadata("design:type", Array)
], ContactRequest.prototype, "replies", void 0);
exports.ContactRequest = ContactRequest = __decorate([
    (0, typeorm_1.Entity)('contact_requests'),
    (0, typeorm_1.Index)(['organizationId', 'status']),
    (0, typeorm_1.Index)(['organizationId', 'createdAt']),
    (0, typeorm_1.Index)(['allianceId', 'status']),
    (0, typeorm_1.Index)(['allianceId', 'createdAt']),
    (0, typeorm_1.Index)(['targetType']),
    (0, typeorm_1.Index)(['status'])
], ContactRequest);
//# sourceMappingURL=ContactRequest.js.map