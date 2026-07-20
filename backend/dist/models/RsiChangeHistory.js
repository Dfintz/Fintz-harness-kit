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
exports.RsiChangeHistory = void 0;
const typeorm_1 = require("typeorm");
let RsiChangeHistory = class RsiChangeHistory {
    id;
    entityType;
    entityId;
    fieldName;
    oldValue;
    newValue;
    detectedAt;
};
exports.RsiChangeHistory = RsiChangeHistory;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], RsiChangeHistory.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 20 }),
    __metadata("design:type", String)
], RsiChangeHistory.prototype, "entityType", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255 }),
    __metadata("design:type", String)
], RsiChangeHistory.prototype, "entityId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 100 }),
    __metadata("design:type", String)
], RsiChangeHistory.prototype, "fieldName", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], RsiChangeHistory.prototype, "oldValue", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], RsiChangeHistory.prototype, "newValue", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], RsiChangeHistory.prototype, "detectedAt", void 0);
exports.RsiChangeHistory = RsiChangeHistory = __decorate([
    (0, typeorm_1.Entity)('rsi_change_history'),
    (0, typeorm_1.Index)(['entityType', 'entityId']),
    (0, typeorm_1.Index)(['entityType', 'entityId', 'fieldName']),
    (0, typeorm_1.Index)(['detectedAt'])
], RsiChangeHistory);
//# sourceMappingURL=RsiChangeHistory.js.map