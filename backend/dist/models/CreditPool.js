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
exports.CreditPool = void 0;
const typeorm_1 = require("typeorm");
const TenantEntity_1 = require("./base/TenantEntity");
let CreditPool = class CreditPool extends TenantEntity_1.TenantEntity {
    id;
    balance;
    currency;
    lastTransactionAt;
    createdAt;
    updatedAt;
    version;
};
exports.CreditPool = CreditPool;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], CreditPool.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)('decimal', { precision: 20, scale: 2, default: 0 }),
    __metadata("design:type", Number)
], CreditPool.prototype, "balance", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 20, default: 'aUEC' }),
    __metadata("design:type", String)
], CreditPool.prototype, "currency", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp', nullable: true }),
    __metadata("design:type", Date)
], CreditPool.prototype, "lastTransactionAt", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], CreditPool.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], CreditPool.prototype, "updatedAt", void 0);
__decorate([
    (0, typeorm_1.VersionColumn)(),
    __metadata("design:type", Number)
], CreditPool.prototype, "version", void 0);
exports.CreditPool = CreditPool = __decorate([
    (0, typeorm_1.Entity)('credit_pools'),
    (0, typeorm_1.Index)('UQ_credit_pools_organizationId', ['organizationId'], { unique: true })
], CreditPool);
//# sourceMappingURL=CreditPool.js.map