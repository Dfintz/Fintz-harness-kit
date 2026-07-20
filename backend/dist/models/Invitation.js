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
exports.Invitation = exports.InvitationStatus = void 0;
const typeorm_1 = require("typeorm");
const Organization_1 = require("./Organization");
const User_1 = require("./User");
var InvitationStatus;
(function (InvitationStatus) {
    InvitationStatus["PENDING"] = "pending";
    InvitationStatus["APPROVED"] = "approved";
    InvitationStatus["ACCEPTED"] = "accepted";
    InvitationStatus["REJECTED"] = "rejected";
    InvitationStatus["DECLINED"] = "declined";
    InvitationStatus["EXPIRED"] = "expired";
})(InvitationStatus || (exports.InvitationStatus = InvitationStatus = {}));
let Invitation = class Invitation {
    id;
    organizationId;
    organization;
    inviteeUserId;
    invitee;
    inviterId;
    inviter;
    inviterRole;
    status;
    message;
    token;
    expiresAt;
    createdAt;
    updatedAt;
};
exports.Invitation = Invitation;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], Invitation.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    (0, typeorm_1.Index)(),
    __metadata("design:type", String)
], Invitation.prototype, "organizationId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Organization_1.Organization, { onDelete: 'CASCADE', createForeignKeyConstraints: false }),
    (0, typeorm_1.JoinColumn)({ name: 'organizationId' }),
    __metadata("design:type", Organization_1.Organization)
], Invitation.prototype, "organization", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    (0, typeorm_1.Index)(),
    __metadata("design:type", String)
], Invitation.prototype, "inviteeUserId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => User_1.User, { onDelete: 'CASCADE', createForeignKeyConstraints: false }),
    (0, typeorm_1.JoinColumn)({ name: 'inviteeUserId' }),
    __metadata("design:type", User_1.User)
], Invitation.prototype, "invitee", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    (0, typeorm_1.Index)(),
    __metadata("design:type", Object)
], Invitation.prototype, "inviterId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => User_1.User, {
        onDelete: 'SET NULL',
        nullable: true,
        createForeignKeyConstraints: false,
    }),
    (0, typeorm_1.JoinColumn)({ name: 'inviterId' }),
    __metadata("design:type", User_1.User)
], Invitation.prototype, "inviter", void 0);
__decorate([
    (0, typeorm_1.Column)({ length: 20 }),
    __metadata("design:type", String)
], Invitation.prototype, "inviterRole", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'enum',
        enum: InvitationStatus,
        default: InvitationStatus.PENDING,
    }),
    (0, typeorm_1.Index)(),
    __metadata("design:type", String)
], Invitation.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], Invitation.prototype, "message", void 0);
__decorate([
    (0, typeorm_1.Column)({ unique: true }),
    __metadata("design:type", String)
], Invitation.prototype, "token", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp' }),
    __metadata("design:type", Date)
], Invitation.prototype, "expiresAt", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], Invitation.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], Invitation.prototype, "updatedAt", void 0);
exports.Invitation = Invitation = __decorate([
    (0, typeorm_1.Entity)('invitations'),
    (0, typeorm_1.Index)(['organizationId', 'status'])
], Invitation);
//# sourceMappingURL=Invitation.js.map