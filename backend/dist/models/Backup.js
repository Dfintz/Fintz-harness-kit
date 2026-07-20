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
exports.Backup = exports.BackupType = exports.BackupStatus = void 0;
const typeorm_1 = require("typeorm");
const TenantEntity_1 = require("./base/TenantEntity");
var BackupStatus;
(function (BackupStatus) {
    BackupStatus["PENDING"] = "pending";
    BackupStatus["PROCESSING"] = "processing";
    BackupStatus["COMPLETED"] = "completed";
    BackupStatus["FAILED"] = "failed";
    BackupStatus["EXPIRED"] = "expired";
})(BackupStatus || (exports.BackupStatus = BackupStatus = {}));
var BackupType;
(function (BackupType) {
    BackupType["FULL"] = "full";
    BackupType["INCREMENTAL"] = "incremental";
})(BackupType || (exports.BackupType = BackupType = {}));
let Backup = class Backup extends TenantEntity_1.TenantEntity {
    id;
    name;
    description;
    backupType;
    status;
    createdBy;
    createdByName;
    sizeBytes;
    blobName;
    entityCount;
    entityBreakdown;
    errorMessage;
    completedAt;
    expiresAt;
    createdAt;
    updatedAt;
    version;
    get isCompleted() {
        return this.status === BackupStatus.COMPLETED;
    }
    get isExpired() {
        if (!this.expiresAt) {
            return false;
        }
        return new Date() > this.expiresAt;
    }
    get isPending() {
        return this.status === BackupStatus.PENDING || this.status === BackupStatus.PROCESSING;
    }
};
exports.Backup = Backup;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], Backup.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255 }),
    __metadata("design:type", String)
], Backup.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 1000, nullable: true }),
    __metadata("design:type", String)
], Backup.prototype, "description", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 50, default: BackupType.FULL }),
    __metadata("design:type", String)
], Backup.prototype, "backupType", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 50, default: BackupStatus.PENDING }),
    __metadata("design:type", String)
], Backup.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar' }),
    __metadata("design:type", String)
], Backup.prototype, "createdBy", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255 }),
    __metadata("design:type", String)
], Backup.prototype, "createdByName", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'bigint', nullable: true }),
    __metadata("design:type", Number)
], Backup.prototype, "sizeBytes", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', nullable: true }),
    __metadata("design:type", String)
], Backup.prototype, "blobName", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'integer', default: 0 }),
    __metadata("design:type", Number)
], Backup.prototype, "entityCount", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', nullable: true }),
    __metadata("design:type", Object)
], Backup.prototype, "entityBreakdown", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', nullable: true }),
    __metadata("design:type", String)
], Backup.prototype, "errorMessage", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp', nullable: true }),
    __metadata("design:type", Date)
], Backup.prototype, "completedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp', nullable: true }),
    __metadata("design:type", Date)
], Backup.prototype, "expiresAt", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], Backup.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], Backup.prototype, "updatedAt", void 0);
__decorate([
    (0, typeorm_1.VersionColumn)(),
    __metadata("design:type", Number)
], Backup.prototype, "version", void 0);
exports.Backup = Backup = __decorate([
    (0, typeorm_1.Entity)('backups'),
    (0, typeorm_1.Index)(['organizationId', 'status']),
    (0, typeorm_1.Index)(['organizationId', 'createdAt']),
    (0, typeorm_1.Index)(['status', 'expiresAt']),
    (0, typeorm_1.Index)(['createdBy'])
], Backup);
//# sourceMappingURL=Backup.js.map