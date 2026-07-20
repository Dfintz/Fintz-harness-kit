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
var RsiSyncSchedule_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.RsiSyncSchedule = void 0;
const typeorm_1 = require("typeorm");
const Organization_1 = require("./Organization");
let RsiSyncSchedule = class RsiSyncSchedule {
    static { RsiSyncSchedule_1 = this; }
    id;
    organizationId;
    organization;
    rsiOrgSid;
    guildId;
    isEnabled;
    intervalMinutes;
    lastSyncAt;
    nextSyncAt;
    consecutiveFailures;
    lastErrorMessage;
    notifyOnChanges;
    notifyOnErrors;
    notificationChannelId;
    removeRolesOnLeave;
    affiliateHandling;
    affiliateRoleId;
    maxConsecutiveFailures;
    createdAt;
    updatedAt;
    isDueForSync() {
        if (!this.isEnabled) {
            return false;
        }
        if (!this.nextSyncAt) {
            return true;
        }
        return new Date() >= this.nextSyncAt;
    }
    calculateNextSyncTime() {
        return new Date(Date.now() + this.intervalMinutes * 60 * 1000);
    }
    markSyncSuccess() {
        this.lastSyncAt = new Date();
        this.nextSyncAt = this.calculateNextSyncTime();
        this.consecutiveFailures = 0;
        this.lastErrorMessage = undefined;
    }
    markSyncFailed(errorMessage) {
        this.consecutiveFailures++;
        this.lastErrorMessage = errorMessage;
        this.nextSyncAt = this.calculateNextSyncTime();
        if (this.consecutiveFailures >= this.maxConsecutiveFailures) {
            this.isEnabled = false;
        }
    }
    isAutoDisabled() {
        return !this.isEnabled && this.consecutiveFailures >= this.maxConsecutiveFailures;
    }
    reEnable() {
        this.isEnabled = true;
        this.consecutiveFailures = 0;
        this.lastErrorMessage = undefined;
        this.nextSyncAt = new Date();
    }
    getStatus() {
        return {
            enabled: this.isEnabled,
            isDue: this.isDueForSync(),
            lastSync: this.lastSyncAt || null,
            nextSync: this.nextSyncAt || null,
            failures: this.consecutiveFailures,
            autoDisabled: this.isAutoDisabled(),
        };
    }
    static VALID_INTERVALS = [360, 720, 1440];
    static validateInterval(minutes) {
        return RsiSyncSchedule_1.VALID_INTERVALS.includes(minutes);
    }
    getIntervalDisplay() {
        if (this.intervalMinutes < 60) {
            return `${this.intervalMinutes} minutes`;
        }
        const hours = Math.floor(this.intervalMinutes / 60);
        const mins = this.intervalMinutes % 60;
        if (mins === 0) {
            return `${hours} hour${hours > 1 ? 's' : ''}`;
        }
        return `${hours}h ${mins}m`;
    }
};
exports.RsiSyncSchedule = RsiSyncSchedule;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], RsiSyncSchedule.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)('uuid'),
    __metadata("design:type", String)
], RsiSyncSchedule.prototype, "organizationId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Organization_1.Organization, { nullable: false, onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'organizationId' }),
    __metadata("design:type", Organization_1.Organization)
], RsiSyncSchedule.prototype, "organization", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 50 }),
    __metadata("design:type", String)
], RsiSyncSchedule.prototype, "rsiOrgSid", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 20, nullable: true }),
    __metadata("design:type", String)
], RsiSyncSchedule.prototype, "guildId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'boolean', default: false }),
    __metadata("design:type", Boolean)
], RsiSyncSchedule.prototype, "isEnabled", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 60 }),
    __metadata("design:type", Number)
], RsiSyncSchedule.prototype, "intervalMinutes", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp', nullable: true }),
    __metadata("design:type", Date)
], RsiSyncSchedule.prototype, "lastSyncAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp', nullable: true }),
    __metadata("design:type", Date)
], RsiSyncSchedule.prototype, "nextSyncAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 0 }),
    __metadata("design:type", Number)
], RsiSyncSchedule.prototype, "consecutiveFailures", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], RsiSyncSchedule.prototype, "lastErrorMessage", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'boolean', default: true }),
    __metadata("design:type", Boolean)
], RsiSyncSchedule.prototype, "notifyOnChanges", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'boolean', default: true }),
    __metadata("design:type", Boolean)
], RsiSyncSchedule.prototype, "notifyOnErrors", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 20, nullable: true }),
    __metadata("design:type", String)
], RsiSyncSchedule.prototype, "notificationChannelId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'boolean', default: true }),
    __metadata("design:type", Boolean)
], RsiSyncSchedule.prototype, "removeRolesOnLeave", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 20, default: 'include' }),
    __metadata("design:type", String)
], RsiSyncSchedule.prototype, "affiliateHandling", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 20, nullable: true }),
    __metadata("design:type", String)
], RsiSyncSchedule.prototype, "affiliateRoleId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 5 }),
    __metadata("design:type", Number)
], RsiSyncSchedule.prototype, "maxConsecutiveFailures", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], RsiSyncSchedule.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], RsiSyncSchedule.prototype, "updatedAt", void 0);
exports.RsiSyncSchedule = RsiSyncSchedule = RsiSyncSchedule_1 = __decorate([
    (0, typeorm_1.Entity)('rsi_sync_schedules'),
    (0, typeorm_1.Index)('IDX_rsi_sync_schedules_org_id', ['organizationId'], { unique: true }),
    (0, typeorm_1.Index)('IDX_rsi_sync_schedules_enabled', ['isEnabled']),
    (0, typeorm_1.Index)('IDX_rsi_sync_schedules_next_sync', ['nextSyncAt'])
], RsiSyncSchedule);
//# sourceMappingURL=RsiSyncSchedule.js.map