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
exports.RsiRoleMapping = void 0;
const typeorm_1 = require("typeorm");
const TenantEntity_1 = require("./base/TenantEntity");
const Role_1 = require("./Role");
let RsiRoleMapping = class RsiRoleMapping extends TenantEntity_1.TenantEntity {
    id;
    rsiRank;
    discordRoleId;
    internalRoleId;
    internalRole;
    autoAssignTeamIds;
    rbacPermissions;
    isActive;
    priority;
    description;
    createdAt;
    updatedAt;
    hasDiscordRole() {
        return !!this.discordRoleId && this.discordRoleId.length > 0;
    }
    hasInternalRole() {
        return !!this.internalRoleId && this.internalRoleId.length > 0;
    }
    hasAutoAssignTeams() {
        return Array.isArray(this.autoAssignTeamIds) && this.autoAssignTeamIds.length > 0;
    }
    hasRbacPermissions() {
        if (!this.rbacPermissions) {
            return false;
        }
        return Object.keys(this.rbacPermissions).some(key => this.rbacPermissions?.[key] === true);
    }
    isAdmin() {
        return this.rbacPermissions?.admin === true;
    }
    getEnabledPermissions() {
        if (!this.rbacPermissions) {
            return [];
        }
        const enabled = [];
        for (const [key, value] of Object.entries(this.rbacPermissions)) {
            if (key === 'custom' && value && typeof value === 'object') {
                for (const [customKey, customValue] of Object.entries(value)) {
                    if (customValue === true) {
                        enabled.push(`custom.${customKey}`);
                    }
                }
            }
            else if (value === true) {
                enabled.push(key);
            }
        }
        return enabled;
    }
    hasPermission(permission) {
        if (!this.rbacPermissions) {
            return false;
        }
        if (permission.startsWith('custom.')) {
            const customKey = permission.substring(7);
            return this.rbacPermissions.custom?.[customKey] === true;
        }
        return this.rbacPermissions[permission] === true;
    }
    getSummary() {
        return {
            rsiRank: this.rsiRank,
            hasDiscordRole: this.hasDiscordRole(),
            discordRoleId: this.discordRoleId ?? null,
            hasInternalRole: this.hasInternalRole(),
            hasAutoAssignTeams: this.hasAutoAssignTeams(),
            permissionCount: this.getEnabledPermissions().length,
            isActive: this.isActive,
            priority: this.priority,
        };
    }
};
exports.RsiRoleMapping = RsiRoleMapping;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], RsiRoleMapping.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 50 }),
    __metadata("design:type", String)
], RsiRoleMapping.prototype, "rsiRank", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 20, nullable: true }),
    __metadata("design:type", String)
], RsiRoleMapping.prototype, "discordRoleId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid', nullable: true }),
    __metadata("design:type", String)
], RsiRoleMapping.prototype, "internalRoleId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Role_1.Role, { nullable: true, onDelete: 'SET NULL' }),
    (0, typeorm_1.JoinColumn)({ name: 'internalRoleId' }),
    __metadata("design:type", Role_1.Role)
], RsiRoleMapping.prototype, "internalRole", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', nullable: true }),
    __metadata("design:type", Array)
], RsiRoleMapping.prototype, "autoAssignTeamIds", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', nullable: true }),
    __metadata("design:type", Object)
], RsiRoleMapping.prototype, "rbacPermissions", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'boolean', default: true }),
    __metadata("design:type", Boolean)
], RsiRoleMapping.prototype, "isActive", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 0 }),
    __metadata("design:type", Number)
], RsiRoleMapping.prototype, "priority", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255, nullable: true }),
    __metadata("design:type", String)
], RsiRoleMapping.prototype, "description", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], RsiRoleMapping.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], RsiRoleMapping.prototype, "updatedAt", void 0);
exports.RsiRoleMapping = RsiRoleMapping = __decorate([
    (0, typeorm_1.Entity)('rsi_role_mappings'),
    (0, typeorm_1.Index)('IDX_rsi_role_mappings_org_id', ['organizationId']),
    (0, typeorm_1.Index)('IDX_rsi_role_mappings_rsi_rank', ['rsiRank']),
    (0, typeorm_1.Index)('IDX_rsi_role_mappings_discord_role', ['discordRoleId']),
    (0, typeorm_1.Index)('IDX_rsi_role_mappings_active', ['isActive'])
], RsiRoleMapping);
//# sourceMappingURL=RsiRoleMapping.js.map