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
exports.LootItem = exports.LootItemSource = exports.LootItemStatus = exports.LootItemCategory = void 0;
const typeorm_1 = require("typeorm");
const TenantEntity_1 = require("./base/TenantEntity");
const LootPool_1 = require("./LootPool");
var LootItemCategory;
(function (LootItemCategory) {
    LootItemCategory["GEAR"] = "gear";
    LootItemCategory["COMPONENT"] = "component";
    LootItemCategory["COMMODITY"] = "commodity";
    LootItemCategory["WEAPON"] = "weapon";
    LootItemCategory["SHIP"] = "ship";
    LootItemCategory["OTHER"] = "other";
})(LootItemCategory || (exports.LootItemCategory = LootItemCategory = {}));
var LootItemStatus;
(function (LootItemStatus) {
    LootItemStatus["AVAILABLE"] = "available";
    LootItemStatus["AWARDED"] = "awarded";
})(LootItemStatus || (exports.LootItemStatus = LootItemStatus = {}));
var LootItemSource;
(function (LootItemSource) {
    LootItemSource["MANUAL"] = "manual";
    LootItemSource["OCR"] = "ocr";
})(LootItemSource || (exports.LootItemSource = LootItemSource = {}));
let LootItem = class LootItem extends TenantEntity_1.TenantEntity {
    id;
    lootPoolId;
    pool;
    name;
    category;
    quantity;
    unitValue;
    totalValue;
    status;
    source;
    awardedToUserId;
    imageUrl;
    metadata;
    createdAt;
    updatedAt;
};
exports.LootItem = LootItem;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], LootItem.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid' }),
    __metadata("design:type", String)
], LootItem.prototype, "lootPoolId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => LootPool_1.LootPool, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'lootPoolId' }),
    __metadata("design:type", LootPool_1.LootPool)
], LootItem.prototype, "pool", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255 }),
    __metadata("design:type", String)
], LootItem.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'enum',
        enum: LootItemCategory,
        default: LootItemCategory.OTHER,
    }),
    __metadata("design:type", String)
], LootItem.prototype, "category", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'integer', default: 1 }),
    __metadata("design:type", Number)
], LootItem.prototype, "quantity", void 0);
__decorate([
    (0, typeorm_1.Column)('decimal', { precision: 20, scale: 2, default: 0 }),
    __metadata("design:type", Number)
], LootItem.prototype, "unitValue", void 0);
__decorate([
    (0, typeorm_1.Column)('decimal', { precision: 20, scale: 2, default: 0 }),
    __metadata("design:type", Number)
], LootItem.prototype, "totalValue", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'enum',
        enum: LootItemStatus,
        default: LootItemStatus.AVAILABLE,
    }),
    __metadata("design:type", String)
], LootItem.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'enum',
        enum: LootItemSource,
        default: LootItemSource.MANUAL,
    }),
    __metadata("design:type", String)
], LootItem.prototype, "source", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', nullable: true }),
    __metadata("design:type", String)
], LootItem.prototype, "awardedToUserId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 1000, nullable: true }),
    __metadata("design:type", String)
], LootItem.prototype, "imageUrl", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', nullable: true }),
    __metadata("design:type", Object)
], LootItem.prototype, "metadata", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], LootItem.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], LootItem.prototype, "updatedAt", void 0);
exports.LootItem = LootItem = __decorate([
    (0, typeorm_1.Entity)('loot_items'),
    (0, typeorm_1.Index)(['organizationId', 'lootPoolId']),
    (0, typeorm_1.Index)(['lootPoolId', 'status'])
], LootItem);
//# sourceMappingURL=LootItem.js.map