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
exports.TenantEntity = void 0;
const typeorm_1 = require("typeorm");
const Organization_1 = require("../Organization");
class TenantEntity {
    organizationId;
    organization;
    sharedWithOrgs;
    deletedAt;
    deletedBy;
    isSharedWith(targetOrgId) {
        if (!this.sharedWithOrgs) {
            return false;
        }
        return this.sharedWithOrgs.includes(targetOrgId);
    }
    canAccessFromOrg(requestingOrgId, accessLevel) {
        if (this.organizationId === requestingOrgId) {
            return true;
        }
        if (accessLevel === 'read' && this.isSharedWith(requestingOrgId)) {
            return true;
        }
        return false;
    }
    addSharedOrg(targetOrgId) {
        if (!this.sharedWithOrgs) {
            this.sharedWithOrgs = [];
        }
        if (!this.sharedWithOrgs.includes(targetOrgId)) {
            this.sharedWithOrgs.push(targetOrgId);
        }
    }
    removeSharedOrg(targetOrgId) {
        if (!this.sharedWithOrgs) {
            return;
        }
        this.sharedWithOrgs = this.sharedWithOrgs.filter(id => id !== targetOrgId);
    }
    isOwnedBy(organizationId) {
        return this.organizationId === organizationId;
    }
    getAccessibleOrgs() {
        const orgs = [this.organizationId];
        if (this.sharedWithOrgs && this.sharedWithOrgs.length > 0) {
            orgs.push(...this.sharedWithOrgs);
        }
        return orgs;
    }
    isSoftDeleted() {
        return this.deletedAt !== null && this.deletedAt !== undefined;
    }
    isNotDeleted() {
        return !this.isSoftDeleted();
    }
}
exports.TenantEntity = TenantEntity;
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], TenantEntity.prototype, "organizationId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Organization_1.Organization, { nullable: false, onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'organizationId' }),
    __metadata("design:type", Organization_1.Organization)
], TenantEntity.prototype, "organization", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-array', { nullable: true, default: '' }),
    __metadata("design:type", Array)
], TenantEntity.prototype, "sharedWithOrgs", void 0);
__decorate([
    (0, typeorm_1.DeleteDateColumn)({ nullable: true }),
    __metadata("design:type", Object)
], TenantEntity.prototype, "deletedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', nullable: true }),
    __metadata("design:type", String)
], TenantEntity.prototype, "deletedBy", void 0);
//# sourceMappingURL=TenantEntity.js.map