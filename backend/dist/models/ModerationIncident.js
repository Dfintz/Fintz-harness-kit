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
exports.ModerationIncident = exports.IncidentStatus = exports.IncidentSeverity = exports.IncidentType = exports.LONG_TIMEOUT_THRESHOLD_MINUTES = void 0;
const typeorm_1 = require("typeorm");
const TenantEntity_1 = require("./base/TenantEntity");
exports.LONG_TIMEOUT_THRESHOLD_MINUTES = 60;
var IncidentType;
(function (IncidentType) {
    IncidentType["WARNING"] = "warning";
    IncidentType["TIMEOUT"] = "timeout";
    IncidentType["LONG_TIMEOUT"] = "long_timeout";
    IncidentType["KICK"] = "kick";
    IncidentType["BAN"] = "ban";
})(IncidentType || (exports.IncidentType = IncidentType = {}));
var IncidentSeverity;
(function (IncidentSeverity) {
    IncidentSeverity[IncidentSeverity["WARNING"] = 1] = "WARNING";
    IncidentSeverity[IncidentSeverity["TIMEOUT"] = 2] = "TIMEOUT";
    IncidentSeverity[IncidentSeverity["LONG_TIMEOUT"] = 3] = "LONG_TIMEOUT";
    IncidentSeverity[IncidentSeverity["KICK"] = 4] = "KICK";
    IncidentSeverity[IncidentSeverity["BAN"] = 5] = "BAN";
})(IncidentSeverity || (exports.IncidentSeverity = IncidentSeverity = {}));
var IncidentStatus;
(function (IncidentStatus) {
    IncidentStatus["ACTIVE"] = "active";
    IncidentStatus["EXPIRED"] = "expired";
    IncidentStatus["REVOKED"] = "revoked";
})(IncidentStatus || (exports.IncidentStatus = IncidentStatus = {}));
let ModerationIncident = class ModerationIncident extends TenantEntity_1.TenantEntity {
    id;
    guildId;
    guildName;
    targetDiscordId;
    targetUsername;
    moderatorId;
    moderatorDiscordId;
    moderatorUsername;
    incidentType;
    severity;
    status;
    reason;
    durationMinutes;
    isShared;
    isAutoDetected;
    discordAuditLogId;
    metadata;
    expiresAt;
    revokedBy;
    revokedAt;
    revokeReason;
    createdAt;
    updatedAt;
    isActive() {
        if (this.status !== IncidentStatus.ACTIVE) {
            return false;
        }
        if (this.expiresAt && new Date() > this.expiresAt) {
            return false;
        }
        return true;
    }
    isExpired() {
        return this.expiresAt !== null && this.expiresAt !== undefined && new Date() > this.expiresAt;
    }
    getSeverityLabel() {
        switch (this.severity) {
            case IncidentSeverity.WARNING:
                return 'Warning';
            case IncidentSeverity.TIMEOUT:
                return 'Timeout';
            case IncidentSeverity.LONG_TIMEOUT:
                return 'Long Timeout';
            case IncidentSeverity.KICK:
                return 'Kick';
            case IncidentSeverity.BAN:
                return 'Ban';
            default:
                return 'Unknown';
        }
    }
    getSeverityEmoji() {
        switch (this.severity) {
            case IncidentSeverity.WARNING:
                return '⚠️';
            case IncidentSeverity.TIMEOUT:
                return '⏰';
            case IncidentSeverity.LONG_TIMEOUT:
                return '🕐';
            case IncidentSeverity.KICK:
                return '👢';
            case IncidentSeverity.BAN:
                return '🔨';
            default:
                return '❓';
        }
    }
    static calculateSeverity(type, durationMinutes) {
        switch (type) {
            case IncidentType.WARNING:
                return IncidentSeverity.WARNING;
            case IncidentType.TIMEOUT:
                if (durationMinutes && durationMinutes > exports.LONG_TIMEOUT_THRESHOLD_MINUTES) {
                    return IncidentSeverity.LONG_TIMEOUT;
                }
                return IncidentSeverity.TIMEOUT;
            case IncidentType.LONG_TIMEOUT:
                return IncidentSeverity.LONG_TIMEOUT;
            case IncidentType.KICK:
                return IncidentSeverity.KICK;
            case IncidentType.BAN:
                return IncidentSeverity.BAN;
            default:
                return IncidentSeverity.WARNING;
        }
    }
};
exports.ModerationIncident = ModerationIncident;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], ModerationIncident.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 20 }),
    __metadata("design:type", String)
], ModerationIncident.prototype, "guildId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 100, nullable: true }),
    __metadata("design:type", String)
], ModerationIncident.prototype, "guildName", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 20 }),
    __metadata("design:type", String)
], ModerationIncident.prototype, "targetDiscordId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 100, nullable: true }),
    __metadata("design:type", String)
], ModerationIncident.prototype, "targetUsername", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar' }),
    __metadata("design:type", String)
], ModerationIncident.prototype, "moderatorId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 20, nullable: true }),
    __metadata("design:type", String)
], ModerationIncident.prototype, "moderatorDiscordId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 100, nullable: true }),
    __metadata("design:type", String)
], ModerationIncident.prototype, "moderatorUsername", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'enum',
        enum: IncidentType,
        default: IncidentType.WARNING,
    }),
    __metadata("design:type", String)
], ModerationIncident.prototype, "incidentType", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'int',
        default: IncidentSeverity.WARNING,
    }),
    __metadata("design:type", Number)
], ModerationIncident.prototype, "severity", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'enum',
        enum: IncidentStatus,
        default: IncidentStatus.ACTIVE,
    }),
    __metadata("design:type", String)
], ModerationIncident.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], ModerationIncident.prototype, "reason", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', nullable: true }),
    __metadata("design:type", Number)
], ModerationIncident.prototype, "durationMinutes", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'boolean', default: false }),
    __metadata("design:type", Boolean)
], ModerationIncident.prototype, "isShared", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'boolean', default: false }),
    __metadata("design:type", Boolean)
], ModerationIncident.prototype, "isAutoDetected", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 20, nullable: true }),
    __metadata("design:type", String)
], ModerationIncident.prototype, "discordAuditLogId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', nullable: true }),
    __metadata("design:type", Object)
], ModerationIncident.prototype, "metadata", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp', nullable: true }),
    __metadata("design:type", Date)
], ModerationIncident.prototype, "expiresAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', nullable: true }),
    __metadata("design:type", String)
], ModerationIncident.prototype, "revokedBy", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp', nullable: true }),
    __metadata("design:type", Date)
], ModerationIncident.prototype, "revokedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], ModerationIncident.prototype, "revokeReason", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], ModerationIncident.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], ModerationIncident.prototype, "updatedAt", void 0);
exports.ModerationIncident = ModerationIncident = __decorate([
    (0, typeorm_1.Entity)('moderation_incidents'),
    (0, typeorm_1.Index)(['targetDiscordId']),
    (0, typeorm_1.Index)(['guildId']),
    (0, typeorm_1.Index)(['incidentType']),
    (0, typeorm_1.Index)(['severity']),
    (0, typeorm_1.Index)(['isShared']),
    (0, typeorm_1.Index)(['status']),
    (0, typeorm_1.Index)(['createdAt']),
    (0, typeorm_1.Index)(['organizationId', 'targetDiscordId'])
], ModerationIncident);
//# sourceMappingURL=ModerationIncident.js.map