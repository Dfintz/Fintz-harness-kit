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
exports.MiningOperation = exports.MiningOperationStatus = void 0;
const typeorm_1 = require("typeorm");
var MiningOperationStatus;
(function (MiningOperationStatus) {
    MiningOperationStatus["PLANNED"] = "planned";
    MiningOperationStatus["IN_PROGRESS"] = "in_progress";
    MiningOperationStatus["COMPLETED"] = "completed";
    MiningOperationStatus["CANCELLED"] = "cancelled";
})(MiningOperationStatus || (exports.MiningOperationStatus = MiningOperationStatus = {}));
let MiningOperation = class MiningOperation {
    id;
    name;
    description;
    location;
    coordinatorId;
    scheduledDate;
    completedDate;
    status;
    crew;
    resourcesFound;
    totalValue;
    notes;
    createdAt;
    updatedAt;
};
exports.MiningOperation = MiningOperation;
__decorate([
    (0, typeorm_1.PrimaryColumn)(),
    __metadata("design:type", String)
], MiningOperation.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], MiningOperation.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)('text'),
    __metadata("design:type", String)
], MiningOperation.prototype, "description", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], MiningOperation.prototype, "location", void 0);
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], MiningOperation.prototype, "coordinatorId", void 0);
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.Column)(),
    __metadata("design:type", Date)
], MiningOperation.prototype, "scheduledDate", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", Date)
], MiningOperation.prototype, "completedDate", void 0);
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.Column)({
        type: 'varchar',
        default: MiningOperationStatus.PLANNED
    }),
    __metadata("design:type", String)
], MiningOperation.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-json', { default: '[]' }),
    __metadata("design:type", Array)
], MiningOperation.prototype, "crew", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-json', { default: '[]' }),
    __metadata("design:type", Array)
], MiningOperation.prototype, "resourcesFound", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 0 }),
    __metadata("design:type", Number)
], MiningOperation.prototype, "totalValue", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], MiningOperation.prototype, "notes", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], MiningOperation.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], MiningOperation.prototype, "updatedAt", void 0);
exports.MiningOperation = MiningOperation = __decorate([
    (0, typeorm_1.Entity)('mining_operations')
], MiningOperation);
//# sourceMappingURL=MiningOperation.js.map