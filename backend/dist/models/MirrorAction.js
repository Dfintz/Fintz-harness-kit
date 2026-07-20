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
exports.MirrorAction = exports.MirrorActionStatus = exports.MirrorActionType = void 0;
const typeorm_1 = require("typeorm");
const TenantEntity_1 = require("./base/TenantEntity");
const ModerationIncident_1 = require("./ModerationIncident");
var MirrorActionType;
(function (MirrorActionType) {
    MirrorActionType["WARNING"] = "warning";
    MirrorActionType["TIMEOUT"] = "timeout";
    MirrorActionType["KICK"] = "kick";
    MirrorActionType["BAN"] = "ban";
})(MirrorActionType || (exports.MirrorActionType = MirrorActionType = {}));
var MirrorActionStatus;
(function (MirrorActionStatus) {
    MirrorActionStatus["PENDING"] = "pending";
    MirrorActionStatus["CONFIRMED"] = "confirmed";
    MirrorActionStatus["CANCELLED"] = "cancelled";
    MirrorActionStatus["FAILED"] = "failed";
})(MirrorActionStatus || (exports.MirrorActionStatus = MirrorActionStatus = {}));
let MirrorAction = class MirrorAction extends TenantEntity_1.TenantEntity {
    id;
    sourceIncidentId;
    sourceIncident;
    sourceOrganizationId;
    sourceGuildId;
    sourceGuildName;
    targetDiscordId;
    targetUsername;
    targetGuildId;
    targetGuildName;
    actionType;
    severity;
    status;
    reason;
    originalReason;
    durationMinutes;
    moderatorId;
    moderatorDiscordId;
    moderatorUsername;
    confirmationRequired;
    confirmedAt;
    executedAt;
    errorMessage;
    isBulkMirror;
    bulkMirrorId;
    metadata;
    createdAt;
    needsConfirmation() {
        return this.confirmationRequired && this.status === MirrorActionStatus.PENDING;
    }
    isPending() {
        return this.status === MirrorActionStatus.PENDING;
    }
    isExecuted() {
        return this.status === MirrorActionStatus.CONFIRMED && this.executedAt !== null;
    }
    isBan() {
        return this.actionType === MirrorActionType.BAN;
    }
    getSeverityEmoji() {
        switch (this.severity) {
            case ModerationIncident_1.IncidentSeverity.WARNING:
                return '⚠️';
            case ModerationIncident_1.IncidentSeverity.TIMEOUT:
                return '⏰';
            case ModerationIncident_1.IncidentSeverity.LONG_TIMEOUT:
                return '🕐';
            case ModerationIncident_1.IncidentSeverity.KICK:
                return '👢';
            case ModerationIncident_1.IncidentSeverity.BAN:
                return '🔨';
            default:
                return '❓';
        }
    }
    static actionTypeFromIncidentType(incidentType) {
        switch (incidentType) {
            case ModerationIncident_1.IncidentType.WARNING:
                return MirrorActionType.WARNING;
            case ModerationIncident_1.IncidentType.TIMEOUT:
            case ModerationIncident_1.IncidentType.LONG_TIMEOUT:
                return MirrorActionType.TIMEOUT;
            case ModerationIncident_1.IncidentType.KICK:
                return MirrorActionType.KICK;
            case ModerationIncident_1.IncidentType.BAN:
                return MirrorActionType.BAN;
            default:
                return MirrorActionType.WARNING;
        }
    }
};
exports.MirrorAction = MirrorAction;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], MirrorAction.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid' }),
    (0, typeorm_1.Index)(),
    __metadata("design:type", String)
], MirrorAction.prototype, "sourceIncidentId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => ModerationIncident_1.ModerationIncident, { nullable: true, onDelete: 'SET NULL' }),
    (0, typeorm_1.JoinColumn)({ name: 'sourceIncidentId' }),
    __metadata("design:type", ModerationIncident_1.ModerationIncident)
], MirrorAction.prototype, "sourceIncident", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid' }),
    __metadata("design:type", String)
], MirrorAction.prototype, "sourceOrganizationId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 20, nullable: true }),
    __metadata("design:type", String)
], MirrorAction.prototype, "sourceGuildId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 100, nullable: true }),
    __metadata("design:type", String)
], MirrorAction.prototype, "sourceGuildName", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 20 }),
    (0, typeorm_1.Index)(),
    __metadata("design:type", String)
], MirrorAction.prototype, "targetDiscordId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 100, nullable: true }),
    __metadata("design:type", String)
], MirrorAction.prototype, "targetUsername", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 20 }),
    __metadata("design:type", String)
], MirrorAction.prototype, "targetGuildId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 100, nullable: true }),
    __metadata("design:type", String)
], MirrorAction.prototype, "targetGuildName", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'enum',
        enum: MirrorActionType,
        default: MirrorActionType.BAN,
    }),
    __metadata("design:type", String)
], MirrorAction.prototype, "actionType", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'int',
        default: ModerationIncident_1.IncidentSeverity.BAN,
    }),
    __metadata("design:type", Number)
], MirrorAction.prototype, "severity", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'enum',
        enum: MirrorActionStatus,
        default: MirrorActionStatus.PENDING,
    }),
    (0, typeorm_1.Index)(),
    __metadata("design:type", String)
], MirrorAction.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], MirrorAction.prototype, "reason", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], MirrorAction.prototype, "originalReason", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', nullable: true }),
    __metadata("design:type", Number)
], MirrorAction.prototype, "durationMinutes", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid' }),
    (0, typeorm_1.Index)(),
    __metadata("design:type", String)
], MirrorAction.prototype, "moderatorId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 20, nullable: true }),
    __metadata("design:type", String)
], MirrorAction.prototype, "moderatorDiscordId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 100, nullable: true }),
    __metadata("design:type", String)
], MirrorAction.prototype, "moderatorUsername", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'boolean', default: false }),
    __metadata("design:type", Boolean)
], MirrorAction.prototype, "confirmationRequired", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp', nullable: true }),
    __metadata("design:type", Date)
], MirrorAction.prototype, "confirmedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp', nullable: true }),
    __metadata("design:type", Date)
], MirrorAction.prototype, "executedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], MirrorAction.prototype, "errorMessage", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'boolean', default: false }),
    __metadata("design:type", Boolean)
], MirrorAction.prototype, "isBulkMirror", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid', nullable: true }),
    __metadata("design:type", String)
], MirrorAction.prototype, "bulkMirrorId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', nullable: true }),
    __metadata("design:type", Object)
], MirrorAction.prototype, "metadata", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    (0, typeorm_1.Index)(),
    __metadata("design:type", Date)
], MirrorAction.prototype, "createdAt", void 0);
exports.MirrorAction = MirrorAction = __decorate([
    (0, typeorm_1.Entity)('mirror_actions')
], MirrorAction);
//# sourceMappingURL=MirrorAction.js.map