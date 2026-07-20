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
exports.FleetAuditLog = void 0;
const typeorm_1 = require("typeorm");
const Fleet_1 = require("./Fleet");
const Organization_1 = require("./Organization");
let FleetAuditLog = class FleetAuditLog {
    id;
    action;
    fleetId;
    fleet;
    fleetName;
    organizationId;
    organization;
    performedById;
    performedByName;
    details;
    createdAt;
};
exports.FleetAuditLog = FleetAuditLog;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], FleetAuditLog.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 64 }),
    __metadata("design:type", String)
], FleetAuditLog.prototype, "action", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], FleetAuditLog.prototype, "fleetId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Fleet_1.Fleet, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'fleetId' }),
    __metadata("design:type", Fleet_1.Fleet)
], FleetAuditLog.prototype, "fleet", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255 }),
    __metadata("design:type", String)
], FleetAuditLog.prototype, "fleetName", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], FleetAuditLog.prototype, "organizationId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Organization_1.Organization, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'organizationId' }),
    __metadata("design:type", Organization_1.Organization)
], FleetAuditLog.prototype, "organization", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', nullable: true }),
    __metadata("design:type", String)
], FleetAuditLog.prototype, "performedById", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', nullable: true }),
    __metadata("design:type", String)
], FleetAuditLog.prototype, "performedByName", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', default: '{}' }),
    __metadata("design:type", Object)
], FleetAuditLog.prototype, "details", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], FleetAuditLog.prototype, "createdAt", void 0);
exports.FleetAuditLog = FleetAuditLog = __decorate([
    (0, typeorm_1.Entity)('fleet_audit_logs'),
    (0, typeorm_1.Index)(['fleetId', 'organizationId']),
    (0, typeorm_1.Index)(['organizationId', 'createdAt']),
    (0, typeorm_1.Index)(['fleetId', 'createdAt'])
], FleetAuditLog);
//# sourceMappingURL=FleetAuditLog.js.map