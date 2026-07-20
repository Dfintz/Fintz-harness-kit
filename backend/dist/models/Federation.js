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
exports.Federation = void 0;
const typeorm_1 = require("typeorm");
const FederationMember_1 = require("./FederationMember");
const FederationProposal_1 = require("./FederationProposal");
let Federation = class Federation {
    id;
    name;
    description;
    founderId;
    founderOrgId;
    governance;
    sharedResources;
    treaties;
    status;
    isPublic;
    tags;
    logoUrl;
    bannerUrl;
    discordUrl;
    websiteUrl;
    reviewDate;
    expiryDate;
    autoRenew;
    settings;
    members;
    proposals;
    createdAt;
    updatedAt;
};
exports.Federation = Federation;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], Federation.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 200 }),
    __metadata("design:type", String)
], Federation.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text' }),
    __metadata("design:type", String)
], Federation.prototype, "description", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar' }),
    __metadata("design:type", String)
], Federation.prototype, "founderId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar' }),
    __metadata("design:type", String)
], Federation.prototype, "founderOrgId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', default: '{}' }),
    __metadata("design:type", Object)
], Federation.prototype, "governance", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', default: '[]' }),
    __metadata("design:type", Array)
], Federation.prototype, "sharedResources", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', default: '[]' }),
    __metadata("design:type", Array)
], Federation.prototype, "treaties", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 20, default: 'forming' }),
    __metadata("design:type", Object)
], Federation.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'boolean', default: false }),
    __metadata("design:type", Boolean)
], Federation.prototype, "isPublic", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', default: '[]' }),
    __metadata("design:type", Array)
], Federation.prototype, "tags", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 500, nullable: true }),
    __metadata("design:type", Object)
], Federation.prototype, "logoUrl", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 500, nullable: true }),
    __metadata("design:type", Object)
], Federation.prototype, "bannerUrl", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 500, nullable: true }),
    __metadata("design:type", Object)
], Federation.prototype, "discordUrl", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 500, nullable: true }),
    __metadata("design:type", Object)
], Federation.prototype, "websiteUrl", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp', nullable: true }),
    __metadata("design:type", Object)
], Federation.prototype, "reviewDate", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp', nullable: true }),
    __metadata("design:type", Object)
], Federation.prototype, "expiryDate", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'boolean', default: false }),
    __metadata("design:type", Boolean)
], Federation.prototype, "autoRenew", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', default: '{}' }),
    __metadata("design:type", Object)
], Federation.prototype, "settings", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => FederationMember_1.FederationMember, member => member.federation),
    __metadata("design:type", Array)
], Federation.prototype, "members", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => FederationProposal_1.FederationProposal, proposal => proposal.federation),
    __metadata("design:type", Array)
], Federation.prototype, "proposals", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], Federation.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], Federation.prototype, "updatedAt", void 0);
exports.Federation = Federation = __decorate([
    (0, typeorm_1.Entity)('federations'),
    (0, typeorm_1.Index)('idx_federation_founder_org', ['founderOrgId']),
    (0, typeorm_1.Index)('idx_federation_status', ['status']),
    (0, typeorm_1.Index)('idx_federation_public_active', ['isPublic', 'status'])
], Federation);
//# sourceMappingURL=Federation.js.map