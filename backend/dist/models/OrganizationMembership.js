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
exports.OrganizationMembership = void 0;
const typeorm_1 = require("typeorm");
const Organization_1 = require("./Organization");
const Role_1 = require("./Role");
const User_1 = require("./User");
let OrganizationMembership = class OrganizationMembership {
    id;
    userId;
    user;
    organizationId;
    organization;
    roleId;
    role;
    securityLevel;
    title;
    isActive;
    joinedAt;
    leftAt;
    permissions;
    metadata;
    acquisitionSource;
    acquisitionRefId;
    createdAt;
    updatedAt;
};
exports.OrganizationMembership = OrganizationMembership;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], OrganizationMembership.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], OrganizationMembership.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => User_1.User, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'userId' }),
    __metadata("design:type", User_1.User)
], OrganizationMembership.prototype, "user", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], OrganizationMembership.prototype, "organizationId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Organization_1.Organization, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'organizationId' }),
    __metadata("design:type", Organization_1.Organization)
], OrganizationMembership.prototype, "organization", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid' }),
    __metadata("design:type", String)
], OrganizationMembership.prototype, "roleId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Role_1.Role, { eager: true }),
    (0, typeorm_1.JoinColumn)({ name: 'roleId' }),
    __metadata("design:type", Role_1.Role)
], OrganizationMembership.prototype, "role", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 1 }),
    __metadata("design:type", Number)
], OrganizationMembership.prototype, "securityLevel", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], OrganizationMembership.prototype, "title", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: true }),
    __metadata("design:type", Boolean)
], OrganizationMembership.prototype, "isActive", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp', nullable: true }),
    __metadata("design:type", Date)
], OrganizationMembership.prototype, "joinedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp', nullable: true }),
    __metadata("design:type", Date)
], OrganizationMembership.prototype, "leftAt", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-array', { nullable: true }),
    __metadata("design:type", Array)
], OrganizationMembership.prototype, "permissions", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', nullable: true }),
    __metadata("design:type", Object)
], OrganizationMembership.prototype, "metadata", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], OrganizationMembership.prototype, "acquisitionSource", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], OrganizationMembership.prototype, "acquisitionRefId", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], OrganizationMembership.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], OrganizationMembership.prototype, "updatedAt", void 0);
exports.OrganizationMembership = OrganizationMembership = __decorate([
    (0, typeorm_1.Entity)('organization_memberships'),
    (0, typeorm_1.Index)(['userId', 'organizationId'], { unique: true }),
    (0, typeorm_1.Index)(['organizationId']),
    (0, typeorm_1.Index)(['userId']),
    (0, typeorm_1.Index)(['organizationId', 'roleId'], {
        where: '"isActive" = true',
    }),
    (0, typeorm_1.Index)('IDX_org_membership_acquisition', ['organizationId', 'acquisitionSource'], {
        where: '"isActive" = true',
    })
], OrganizationMembership);
//# sourceMappingURL=OrganizationMembership.js.map