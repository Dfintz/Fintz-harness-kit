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
exports.RsiMemberCache = void 0;
const typeorm_1 = require("typeorm");
let RsiMemberCache = class RsiMemberCache {
    id;
    organizationId;
    rsiOrgSid;
    rsiHandle;
    rsiRank;
    rsiRankOrder;
    isAffiliate;
    displayName;
    metadata;
    cachedAt;
};
exports.RsiMemberCache = RsiMemberCache;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], RsiMemberCache.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)('varchar'),
    __metadata("design:type", String)
], RsiMemberCache.prototype, "organizationId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 50 }),
    __metadata("design:type", String)
], RsiMemberCache.prototype, "rsiOrgSid", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 100 }),
    __metadata("design:type", String)
], RsiMemberCache.prototype, "rsiHandle", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 50 }),
    __metadata("design:type", String)
], RsiMemberCache.prototype, "rsiRank", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', nullable: true }),
    __metadata("design:type", Number)
], RsiMemberCache.prototype, "rsiRankOrder", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'boolean', default: false }),
    __metadata("design:type", Boolean)
], RsiMemberCache.prototype, "isAffiliate", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 100, nullable: true }),
    __metadata("design:type", String)
], RsiMemberCache.prototype, "displayName", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', nullable: true }),
    __metadata("design:type", Object)
], RsiMemberCache.prototype, "metadata", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], RsiMemberCache.prototype, "cachedAt", void 0);
exports.RsiMemberCache = RsiMemberCache = __decorate([
    (0, typeorm_1.Entity)('rsi_member_cache'),
    (0, typeorm_1.Unique)('UQ_rsi_member_cache_org_handle', ['organizationId', 'rsiHandle']),
    (0, typeorm_1.Index)('IDX_rsi_member_cache_org_sid', ['rsiOrgSid']),
    (0, typeorm_1.Index)('IDX_rsi_member_cache_cached_at', ['cachedAt']),
    (0, typeorm_1.Index)('IDX_rsi_member_cache_org_id', ['organizationId'])
], RsiMemberCache);
//# sourceMappingURL=RsiMemberCache.js.map