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
exports.BackupSchedule = exports.BackupFrequency = void 0;
const typeorm_1 = require("typeorm");
const TenantEntity_1 = require("./base/TenantEntity");
var BackupFrequency;
(function (BackupFrequency) {
    BackupFrequency["DAILY"] = "daily";
    BackupFrequency["WEEKLY"] = "weekly";
    BackupFrequency["MONTHLY"] = "monthly";
})(BackupFrequency || (exports.BackupFrequency = BackupFrequency = {}));
let BackupSchedule = class BackupSchedule extends TenantEntity_1.TenantEntity {
    id;
    frequency;
    retentionDays;
    enabled;
    createdBy;
    lastRunAt;
    nextRunAt;
    createdAt;
    updatedAt;
};
exports.BackupSchedule = BackupSchedule;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], BackupSchedule.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 50 }),
    __metadata("design:type", String)
], BackupSchedule.prototype, "frequency", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'integer', default: 30 }),
    __metadata("design:type", Number)
], BackupSchedule.prototype, "retentionDays", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'boolean', default: true }),
    __metadata("design:type", Boolean)
], BackupSchedule.prototype, "enabled", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar' }),
    __metadata("design:type", String)
], BackupSchedule.prototype, "createdBy", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp', nullable: true }),
    __metadata("design:type", Date)
], BackupSchedule.prototype, "lastRunAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp', nullable: true }),
    __metadata("design:type", Date)
], BackupSchedule.prototype, "nextRunAt", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], BackupSchedule.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], BackupSchedule.prototype, "updatedAt", void 0);
exports.BackupSchedule = BackupSchedule = __decorate([
    (0, typeorm_1.Entity)('backup_schedules'),
    (0, typeorm_1.Index)('UQ_backup_schedules_organization_id', ['organizationId'], { unique: true })
], BackupSchedule);
//# sourceMappingURL=BackupSchedule.js.map