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
exports.LootPool = exports.LootDistributionMethod = exports.LootPoolStatus = void 0;
const typeorm_1 = require("typeorm");
const TenantEntity_1 = require("./base/TenantEntity");
var LootPoolStatus;
(function (LootPoolStatus) {
    LootPoolStatus["OPEN"] = "open";
    LootPoolStatus["LOCKED"] = "locked";
    LootPoolStatus["DISTRIBUTED"] = "distributed";
    LootPoolStatus["PARTIALLY_DISTRIBUTED"] = "partially_distributed";
    LootPoolStatus["CANCELLED"] = "cancelled";
})(LootPoolStatus || (exports.LootPoolStatus = LootPoolStatus = {}));
var LootDistributionMethod;
(function (LootDistributionMethod) {
    LootDistributionMethod["NEED_GREED"] = "need_greed";
    LootDistributionMethod["RANDOM_ROLL"] = "random_roll";
    LootDistributionMethod["AUEC_BID"] = "auec_bid";
    LootDistributionMethod["EVEN_SPLIT"] = "even_split";
    LootDistributionMethod["LEADER_ASSIGN"] = "leader_assign";
})(LootDistributionMethod || (exports.LootDistributionMethod = LootDistributionMethod = {}));
let LootPool = class LootPool extends TenantEntity_1.TenantEntity {
    id;
    name;
    description;
    activityId;
    missionId;
    lfgSessionId;
    status;
    distributionMethod;
    rules;
    totalValue;
    currency;
    leaderId;
    createdBy;
    distributedAt;
    metadata;
    createdAt;
    updatedAt;
};
exports.LootPool = LootPool;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], LootPool.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255 }),
    __metadata("design:type", String)
], LootPool.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], LootPool.prototype, "description", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid' }),
    __metadata("design:type", String)
], LootPool.prototype, "activityId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid', nullable: true }),
    __metadata("design:type", String)
], LootPool.prototype, "missionId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255, nullable: true }),
    __metadata("design:type", String)
], LootPool.prototype, "lfgSessionId", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'enum',
        enum: LootPoolStatus,
        default: LootPoolStatus.OPEN,
    }),
    __metadata("design:type", String)
], LootPool.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'enum',
        enum: LootDistributionMethod,
        default: LootDistributionMethod.NEED_GREED,
    }),
    __metadata("design:type", String)
], LootPool.prototype, "distributionMethod", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', nullable: true }),
    __metadata("design:type", Object)
], LootPool.prototype, "rules", void 0);
__decorate([
    (0, typeorm_1.Column)('decimal', { precision: 20, scale: 2, default: 0 }),
    __metadata("design:type", Number)
], LootPool.prototype, "totalValue", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 10, default: 'aUEC' }),
    __metadata("design:type", String)
], LootPool.prototype, "currency", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar' }),
    __metadata("design:type", String)
], LootPool.prototype, "leaderId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar' }),
    __metadata("design:type", String)
], LootPool.prototype, "createdBy", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp', nullable: true }),
    __metadata("design:type", Date)
], LootPool.prototype, "distributedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', nullable: true }),
    __metadata("design:type", Object)
], LootPool.prototype, "metadata", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], LootPool.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], LootPool.prototype, "updatedAt", void 0);
exports.LootPool = LootPool = __decorate([
    (0, typeorm_1.Entity)('loot_pools'),
    (0, typeorm_1.Index)(['organizationId', 'status']),
    (0, typeorm_1.Index)(['organizationId', 'activityId'])
], LootPool);
//# sourceMappingURL=LootPool.js.map