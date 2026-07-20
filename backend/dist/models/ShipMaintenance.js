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
exports.ShipMaintenance = exports.MaintenanceType = exports.MaintenanceStatus = void 0;
const typeorm_1 = require("typeorm");
var MaintenanceStatus;
(function (MaintenanceStatus) {
    MaintenanceStatus["SCHEDULED"] = "scheduled";
    MaintenanceStatus["IN_PROGRESS"] = "in_progress";
    MaintenanceStatus["COMPLETED"] = "completed";
    MaintenanceStatus["CANCELLED"] = "cancelled";
    MaintenanceStatus["OVERDUE"] = "overdue";
})(MaintenanceStatus || (exports.MaintenanceStatus = MaintenanceStatus = {}));
var MaintenanceType;
(function (MaintenanceType) {
    MaintenanceType["ROUTINE"] = "routine";
    MaintenanceType["REPAIR"] = "repair";
    MaintenanceType["UPGRADE"] = "upgrade";
    MaintenanceType["INSPECTION"] = "inspection";
})(MaintenanceType || (exports.MaintenanceType = MaintenanceType = {}));
let ShipMaintenance = class ShipMaintenance {
    id;
    shipId;
    ownerId;
    maintenanceType;
    scheduledDate;
    completedDate;
    status;
    description;
    cost;
    performedBy;
    notes;
    createdAt;
    updatedAt;
};
exports.ShipMaintenance = ShipMaintenance;
__decorate([
    (0, typeorm_1.PrimaryColumn)(),
    __metadata("design:type", String)
], ShipMaintenance.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], ShipMaintenance.prototype, "shipId", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], ShipMaintenance.prototype, "ownerId", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'varchar'
    }),
    __metadata("design:type", String)
], ShipMaintenance.prototype, "maintenanceType", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", Date)
], ShipMaintenance.prototype, "scheduledDate", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", Date)
], ShipMaintenance.prototype, "completedDate", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'varchar',
        default: MaintenanceStatus.SCHEDULED
    }),
    __metadata("design:type", String)
], ShipMaintenance.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)('text', { nullable: true }),
    __metadata("design:type", String)
], ShipMaintenance.prototype, "description", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", Number)
], ShipMaintenance.prototype, "cost", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], ShipMaintenance.prototype, "performedBy", void 0);
__decorate([
    (0, typeorm_1.Column)('text', { nullable: true }),
    __metadata("design:type", String)
], ShipMaintenance.prototype, "notes", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], ShipMaintenance.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], ShipMaintenance.prototype, "updatedAt", void 0);
exports.ShipMaintenance = ShipMaintenance = __decorate([
    (0, typeorm_1.Entity)('ship_maintenance')
], ShipMaintenance);
//# sourceMappingURL=ShipMaintenance.js.map