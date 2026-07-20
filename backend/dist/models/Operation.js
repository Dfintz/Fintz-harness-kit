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
exports.Operation = exports.OperationStatus = exports.OperationType = void 0;
const typeorm_1 = require("typeorm");
const TenantEntity_1 = require("./base/TenantEntity");
var OperationType;
(function (OperationType) {
    OperationType["MISSION"] = "mission";
    OperationType["EVENT"] = "event";
    OperationType["MINING"] = "mining";
    OperationType["TRADING"] = "trading";
    OperationType["LOGISTICS"] = "logistics";
    OperationType["INTEL"] = "intel";
})(OperationType || (exports.OperationType = OperationType = {}));
var OperationStatus;
(function (OperationStatus) {
    OperationStatus["PLANNED"] = "planned";
    OperationStatus["IN_PROGRESS"] = "in-progress";
    OperationStatus["COMPLETED"] = "completed";
    OperationStatus["CANCELLED"] = "cancelled";
})(OperationStatus || (exports.OperationStatus = OperationStatus = {}));
let Operation = class Operation extends TenantEntity_1.TenantEntity {
    id;
    type;
    name;
    description;
    status;
    startDate;
    endDate;
    participants;
    createdBy;
    createdAt;
    updatedAt;
    isActive() {
        return this.status === OperationStatus.IN_PROGRESS;
    }
};
exports.Operation = Operation;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], Operation.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'enum', enum: OperationType }),
    __metadata("design:type", String)
], Operation.prototype, "type", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], Operation.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], Operation.prototype, "description", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'enum', enum: OperationStatus, default: OperationStatus.PLANNED }),
    __metadata("design:type", String)
], Operation.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp', nullable: true }),
    __metadata("design:type", Date)
], Operation.prototype, "startDate", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp', nullable: true }),
    __metadata("design:type", Date)
], Operation.prototype, "endDate", void 0);
__decorate([
    (0, typeorm_1.Column)('text', { array: true, default: '{}' }),
    __metadata("design:type", Array)
], Operation.prototype, "participants", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], Operation.prototype, "createdBy", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], Operation.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], Operation.prototype, "updatedAt", void 0);
exports.Operation = Operation = __decorate([
    (0, typeorm_1.Entity)('operations'),
    (0, typeorm_1.Index)(['organizationId', 'type']),
    (0, typeorm_1.Index)(['organizationId', 'status'])
], Operation);
//# sourceMappingURL=Operation.js.map