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
exports.SecurityLevel = void 0;
const typeorm_1 = require("typeorm");
const Organization_1 = require("./Organization");
let SecurityLevel = class SecurityLevel {
    id;
    sourceOrgId;
    sourceOrganization;
    targetOrgId;
    targetOrganization;
    level;
    resourceType;
    accessLevel;
    restrictions;
    notes;
    isActive;
    expiresAt;
    approvedBy;
    updatedBy;
    createdAt;
    updatedAt;
    grantsAccess(requiredLevel, requiredAccessLevel = 'read') {
        if (!this.isActive) {
            return false;
        }
        if (this.expiresAt && this.expiresAt < new Date()) {
            return false;
        }
        if (this.level < requiredLevel) {
            return false;
        }
        const accessHierarchy = {
            none: 0,
            read: 1,
            write: 2,
            full: 3,
        };
        return accessHierarchy[this.accessLevel] >= accessHierarchy[requiredAccessLevel];
    }
};
exports.SecurityLevel = SecurityLevel;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], SecurityLevel.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], SecurityLevel.prototype, "sourceOrgId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Organization_1.Organization, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'sourceOrgId' }),
    __metadata("design:type", Organization_1.Organization)
], SecurityLevel.prototype, "sourceOrganization", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], SecurityLevel.prototype, "targetOrgId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Organization_1.Organization, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'targetOrgId' }),
    __metadata("design:type", Organization_1.Organization)
], SecurityLevel.prototype, "targetOrganization", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int' }),
    __metadata("design:type", Number)
], SecurityLevel.prototype, "level", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], SecurityLevel.prototype, "resourceType", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], SecurityLevel.prototype, "accessLevel", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', nullable: true }),
    __metadata("design:type", Object)
], SecurityLevel.prototype, "restrictions", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], SecurityLevel.prototype, "notes", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: true }),
    __metadata("design:type", Boolean)
], SecurityLevel.prototype, "isActive", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp', nullable: true }),
    __metadata("design:type", Date)
], SecurityLevel.prototype, "expiresAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], SecurityLevel.prototype, "approvedBy", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], SecurityLevel.prototype, "updatedBy", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], SecurityLevel.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], SecurityLevel.prototype, "updatedAt", void 0);
exports.SecurityLevel = SecurityLevel = __decorate([
    (0, typeorm_1.Entity)('security_levels'),
    (0, typeorm_1.Index)(['sourceOrgId', 'targetOrgId', 'resourceType'], { unique: true }),
    (0, typeorm_1.Index)(['sourceOrgId']),
    (0, typeorm_1.Index)(['targetOrgId'])
], SecurityLevel);
//# sourceMappingURL=SecurityLevel.js.map