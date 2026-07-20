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
exports.GuildOrganization = void 0;
const typeorm_1 = require("typeorm");
const Organization_1 = require("./Organization");
let GuildOrganization = class GuildOrganization {
    guildId;
    organizationId;
    organization;
    guildName;
    isPrimary;
    isActive;
    createdBy;
    metadata;
    deactivatedAt;
    deactivatedBy;
    createdAt;
    updatedAt;
    isUsable() {
        return this.isActive;
    }
    deactivate(userId) {
        this.isActive = false;
        this.deactivatedAt = new Date();
        this.deactivatedBy = userId;
    }
    reactivate() {
        this.isActive = true;
        this.deactivatedAt = undefined;
        this.deactivatedBy = undefined;
    }
};
exports.GuildOrganization = GuildOrganization;
__decorate([
    (0, typeorm_1.PrimaryColumn)({ type: 'varchar', length: 20 }),
    __metadata("design:type", String)
], GuildOrganization.prototype, "guildId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255 }),
    __metadata("design:type", String)
], GuildOrganization.prototype, "organizationId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Organization_1.Organization, { nullable: true, onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'organizationId' }),
    __metadata("design:type", Organization_1.Organization)
], GuildOrganization.prototype, "organization", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 100, nullable: true }),
    __metadata("design:type", String)
], GuildOrganization.prototype, "guildName", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'boolean', default: true }),
    __metadata("design:type", Boolean)
], GuildOrganization.prototype, "isPrimary", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'boolean', default: true }),
    __metadata("design:type", Boolean)
], GuildOrganization.prototype, "isActive", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255, nullable: true }),
    __metadata("design:type", String)
], GuildOrganization.prototype, "createdBy", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', nullable: true }),
    __metadata("design:type", Object)
], GuildOrganization.prototype, "metadata", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp', nullable: true }),
    __metadata("design:type", Date)
], GuildOrganization.prototype, "deactivatedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255, nullable: true }),
    __metadata("design:type", String)
], GuildOrganization.prototype, "deactivatedBy", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], GuildOrganization.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], GuildOrganization.prototype, "updatedAt", void 0);
exports.GuildOrganization = GuildOrganization = __decorate([
    (0, typeorm_1.Entity)('guild_organizations'),
    (0, typeorm_1.Index)(['guildId'], { unique: true }),
    (0, typeorm_1.Index)(['organizationId']),
    (0, typeorm_1.Index)(['isPrimary'])
], GuildOrganization);
//# sourceMappingURL=GuildOrganization.js.map