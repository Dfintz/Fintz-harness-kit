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
exports.FleetLogistics = exports.LogisticsStatus = void 0;
const shared_types_1 = require("@sc-fleet-manager/shared-types");
Object.defineProperty(exports, "LogisticsStatus", { enumerable: true, get: function () { return shared_types_1.LogisticsStatus; } });
const typeorm_1 = require("typeorm");
let FleetLogistics = class FleetLogistics {
    id;
    fleetId;
    operationName;
    description;
    coordinatorId;
    status;
    ships;
    resources;
    route;
    totalFuelCapacity;
    totalCargoCapacity;
    totalFuelRequired;
    totalCargoUsed;
    maxJumpRange;
    estimatedDuration;
    notes;
    createdAt;
    updatedAt;
};
exports.FleetLogistics = FleetLogistics;
__decorate([
    (0, typeorm_1.PrimaryColumn)(),
    __metadata("design:type", String)
], FleetLogistics.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], FleetLogistics.prototype, "fleetId", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], FleetLogistics.prototype, "operationName", void 0);
__decorate([
    (0, typeorm_1.Column)('text', { nullable: true }),
    __metadata("design:type", String)
], FleetLogistics.prototype, "description", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], FleetLogistics.prototype, "coordinatorId", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'varchar',
        default: shared_types_1.LogisticsStatus.PLANNING,
    }),
    __metadata("design:type", String)
], FleetLogistics.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-json', { default: '[]' }),
    __metadata("design:type", Array)
], FleetLogistics.prototype, "ships", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-json', { default: '[]' }),
    __metadata("design:type", Array)
], FleetLogistics.prototype, "resources", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-json', { default: '[]' }),
    __metadata("design:type", Array)
], FleetLogistics.prototype, "route", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 0 }),
    __metadata("design:type", Number)
], FleetLogistics.prototype, "totalFuelCapacity", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 0 }),
    __metadata("design:type", Number)
], FleetLogistics.prototype, "totalCargoCapacity", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 0 }),
    __metadata("design:type", Number)
], FleetLogistics.prototype, "totalFuelRequired", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 0 }),
    __metadata("design:type", Number)
], FleetLogistics.prototype, "totalCargoUsed", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", Number)
], FleetLogistics.prototype, "maxJumpRange", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", Number)
], FleetLogistics.prototype, "estimatedDuration", void 0);
__decorate([
    (0, typeorm_1.Column)('text', { nullable: true }),
    __metadata("design:type", String)
], FleetLogistics.prototype, "notes", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], FleetLogistics.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], FleetLogistics.prototype, "updatedAt", void 0);
exports.FleetLogistics = FleetLogistics = __decorate([
    (0, typeorm_1.Entity)('fleet_logistics')
], FleetLogistics);
//# sourceMappingURL=FleetLogistics.js.map