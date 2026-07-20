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
exports.LootClaim = exports.LootClaimStatus = exports.LootClaimType = void 0;
const typeorm_1 = require("typeorm");
const TenantEntity_1 = require("./base/TenantEntity");
const LootItem_1 = require("./LootItem");
const LootPool_1 = require("./LootPool");
var LootClaimType;
(function (LootClaimType) {
    LootClaimType["NEED"] = "need";
    LootClaimType["GREED"] = "greed";
    LootClaimType["ROLL"] = "roll";
    LootClaimType["BID"] = "bid";
})(LootClaimType || (exports.LootClaimType = LootClaimType = {}));
var LootClaimStatus;
(function (LootClaimStatus) {
    LootClaimStatus["PENDING"] = "pending";
    LootClaimStatus["WON"] = "won";
    LootClaimStatus["LOST"] = "lost";
    LootClaimStatus["WITHDRAWN"] = "withdrawn";
})(LootClaimStatus || (exports.LootClaimStatus = LootClaimStatus = {}));
let LootClaim = class LootClaim extends TenantEntity_1.TenantEntity {
    id;
    lootPoolId;
    pool;
    lootItemId;
    item;
    userId;
    userName;
    claimType;
    bidAmount;
    rollValue;
    status;
    createdAt;
    updatedAt;
};
exports.LootClaim = LootClaim;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], LootClaim.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid' }),
    __metadata("design:type", String)
], LootClaim.prototype, "lootPoolId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => LootPool_1.LootPool, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'lootPoolId' }),
    __metadata("design:type", LootPool_1.LootPool)
], LootClaim.prototype, "pool", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid' }),
    __metadata("design:type", String)
], LootClaim.prototype, "lootItemId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => LootItem_1.LootItem, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'lootItemId' }),
    __metadata("design:type", LootItem_1.LootItem)
], LootClaim.prototype, "item", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar' }),
    __metadata("design:type", String)
], LootClaim.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255 }),
    __metadata("design:type", String)
], LootClaim.prototype, "userName", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'enum',
        enum: LootClaimType,
        default: LootClaimType.ROLL,
    }),
    __metadata("design:type", String)
], LootClaim.prototype, "claimType", void 0);
__decorate([
    (0, typeorm_1.Column)('decimal', { precision: 20, scale: 2, nullable: true }),
    __metadata("design:type", Number)
], LootClaim.prototype, "bidAmount", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'integer', nullable: true }),
    __metadata("design:type", Number)
], LootClaim.prototype, "rollValue", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'enum',
        enum: LootClaimStatus,
        default: LootClaimStatus.PENDING,
    }),
    __metadata("design:type", String)
], LootClaim.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], LootClaim.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], LootClaim.prototype, "updatedAt", void 0);
exports.LootClaim = LootClaim = __decorate([
    (0, typeorm_1.Entity)('loot_claims'),
    (0, typeorm_1.Unique)('UQ_loot_claim_item_user', ['lootItemId', 'userId']),
    (0, typeorm_1.Index)(['organizationId', 'lootPoolId']),
    (0, typeorm_1.Index)(['lootItemId', 'status'])
], LootClaim);
//# sourceMappingURL=LootClaim.js.map