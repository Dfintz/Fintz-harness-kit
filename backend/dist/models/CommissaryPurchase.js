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
exports.CommissaryPurchase = void 0;
const typeorm_1 = require("typeorm");
const TenantEntity_1 = require("./base/TenantEntity");
let CommissaryPurchase = class CommissaryPurchase extends TenantEntity_1.TenantEntity {
    id;
    itemId;
    buyerId;
    quantity;
    totalPrice;
    transactionId;
    item;
    transaction;
    createdAt;
};
exports.CommissaryPurchase = CommissaryPurchase;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], CommissaryPurchase.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid' }),
    __metadata("design:type", String)
], CommissaryPurchase.prototype, "itemId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar' }),
    __metadata("design:type", String)
], CommissaryPurchase.prototype, "buyerId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'integer', default: 1 }),
    __metadata("design:type", Number)
], CommissaryPurchase.prototype, "quantity", void 0);
__decorate([
    (0, typeorm_1.Column)('decimal', { precision: 20, scale: 2 }),
    __metadata("design:type", Number)
], CommissaryPurchase.prototype, "totalPrice", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid' }),
    __metadata("design:type", String)
], CommissaryPurchase.prototype, "transactionId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)('CommissaryItem', { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'itemId' }),
    __metadata("design:type", Function)
], CommissaryPurchase.prototype, "item", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)('CreditTransaction', { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'transactionId' }),
    __metadata("design:type", Function)
], CommissaryPurchase.prototype, "transaction", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], CommissaryPurchase.prototype, "createdAt", void 0);
exports.CommissaryPurchase = CommissaryPurchase = __decorate([
    (0, typeorm_1.Entity)('commissary_purchases'),
    (0, typeorm_1.Index)(['organizationId', 'buyerId']),
    (0, typeorm_1.Index)(['itemId'])
], CommissaryPurchase);
//# sourceMappingURL=CommissaryPurchase.js.map