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
exports.PriceAlert = exports.PriceAlertCondition = void 0;
const typeorm_1 = require("typeorm");
var PriceAlertCondition;
(function (PriceAlertCondition) {
    PriceAlertCondition["ABOVE"] = "above";
    PriceAlertCondition["BELOW"] = "below";
    PriceAlertCondition["CHANGE_PERCENT"] = "change_percent";
})(PriceAlertCondition || (exports.PriceAlertCondition = PriceAlertCondition = {}));
let PriceAlert = class PriceAlert {
    id;
    userId;
    commodity;
    location;
    condition;
    threshold;
    enabled;
    lastTriggered;
    createdAt;
};
exports.PriceAlert = PriceAlert;
__decorate([
    (0, typeorm_1.PrimaryColumn)('varchar', { length: 64 }),
    __metadata("design:type", String)
], PriceAlert.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.Column)('varchar', { length: 255 }),
    __metadata("design:type", String)
], PriceAlert.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.Column)('varchar', { length: 255 }),
    __metadata("design:type", String)
], PriceAlert.prototype, "commodity", void 0);
__decorate([
    (0, typeorm_1.Column)('varchar', { length: 255, nullable: true }),
    __metadata("design:type", String)
], PriceAlert.prototype, "location", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'varchar',
        length: 32,
    }),
    __metadata("design:type", String)
], PriceAlert.prototype, "condition", void 0);
__decorate([
    (0, typeorm_1.Column)('float'),
    __metadata("design:type", Number)
], PriceAlert.prototype, "threshold", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'boolean', default: true }),
    __metadata("design:type", Boolean)
], PriceAlert.prototype, "enabled", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp', nullable: true }),
    __metadata("design:type", Date)
], PriceAlert.prototype, "lastTriggered", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], PriceAlert.prototype, "createdAt", void 0);
exports.PriceAlert = PriceAlert = __decorate([
    (0, typeorm_1.Entity)('price_alerts')
], PriceAlert);
//# sourceMappingURL=PriceAlert.js.map