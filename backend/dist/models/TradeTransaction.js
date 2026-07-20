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
exports.TradeTransaction = exports.TradeTransactionStatus = void 0;
const typeorm_1 = require("typeorm");
const Organization_1 = require("./Organization");
const TradingRoute_1 = require("./TradingRoute");
var TradeTransactionStatus;
(function (TradeTransactionStatus) {
    TradeTransactionStatus["COMPLETED"] = "completed";
    TradeTransactionStatus["FAILED"] = "failed";
    TradeTransactionStatus["ABORTED"] = "aborted";
})(TradeTransactionStatus || (exports.TradeTransactionStatus = TradeTransactionStatus = {}));
let TradeTransaction = class TradeTransaction {
    id;
    routeId;
    route;
    userId;
    fleetId;
    organizationId;
    organization;
    successStatus;
    estimatedProfit;
    actualProfit;
    durationMinutes;
    executedAt;
    completedAt;
    getEstimateAccuracy() {
        if (this.estimatedProfit === 0) {
            return 0;
        }
        const ratio = Number(this.actualProfit) / Number(this.estimatedProfit);
        const accuracy = Math.max(0, 100 - Math.abs(1 - ratio) * 100);
        return Math.round(Math.max(0, Math.min(100, accuracy)));
    }
};
exports.TradeTransaction = TradeTransaction;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], TradeTransaction.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    (0, typeorm_1.Index)(),
    __metadata("design:type", String)
], TradeTransaction.prototype, "routeId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => TradingRoute_1.TradingRoute, { nullable: true, onDelete: 'SET NULL' }),
    (0, typeorm_1.JoinColumn)({ name: 'routeId' }),
    __metadata("design:type", TradingRoute_1.TradingRoute)
], TradeTransaction.prototype, "route", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    (0, typeorm_1.Index)(),
    __metadata("design:type", String)
], TradeTransaction.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], TradeTransaction.prototype, "fleetId", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    (0, typeorm_1.Index)(),
    __metadata("design:type", String)
], TradeTransaction.prototype, "organizationId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Organization_1.Organization, { nullable: true, onDelete: 'SET NULL' }),
    (0, typeorm_1.JoinColumn)({ name: 'organizationId' }),
    __metadata("design:type", Organization_1.Organization)
], TradeTransaction.prototype, "organization", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', default: TradeTransactionStatus.COMPLETED }),
    __metadata("design:type", String)
], TradeTransaction.prototype, "successStatus", void 0);
__decorate([
    (0, typeorm_1.Column)('decimal', { precision: 15, scale: 2, default: 0 }),
    __metadata("design:type", Number)
], TradeTransaction.prototype, "estimatedProfit", void 0);
__decorate([
    (0, typeorm_1.Column)('decimal', { precision: 15, scale: 2, default: 0 }),
    __metadata("design:type", Number)
], TradeTransaction.prototype, "actualProfit", void 0);
__decorate([
    (0, typeorm_1.Column)('int', { default: 0 }),
    __metadata("design:type", Number)
], TradeTransaction.prototype, "durationMinutes", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], TradeTransaction.prototype, "executedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", Date)
], TradeTransaction.prototype, "completedAt", void 0);
exports.TradeTransaction = TradeTransaction = __decorate([
    (0, typeorm_1.Entity)('trade_transactions'),
    (0, typeorm_1.Index)(['userId', 'organizationId']),
    (0, typeorm_1.Index)(['routeId', 'organizationId']),
    (0, typeorm_1.Index)(['organizationId', 'executedAt'])
], TradeTransaction);
//# sourceMappingURL=TradeTransaction.js.map