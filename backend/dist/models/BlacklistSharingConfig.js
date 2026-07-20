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
exports.BlacklistSharingConfig = void 0;
const typeorm_1 = require("typeorm");
const TenantEntity_1 = require("./base/TenantEntity");
let BlacklistSharingConfig = class BlacklistSharingConfig extends TenantEntity_1.TenantEntity {
    id;
    shareWarnings;
    shareTimeouts;
    shareKicks;
    shareBans;
    receiveAlerts;
    minAlertSeverity;
    alertChannelId;
    autoShareWithAllies;
    autoShareMinSeverity;
    autoEnforceEnabled;
    autoEnforceTimeouts;
    autoEnforceKicks;
    createdAt;
    updatedAt;
    shouldShareIncidentType(incidentType) {
        switch (incidentType) {
            case 'warning':
                return this.shareWarnings;
            case 'timeout':
            case 'long_timeout':
                return this.shareTimeouts;
            case 'kick':
                return this.shareKicks;
            case 'ban':
                return this.shareBans;
            default:
                return false;
        }
    }
    shouldAlert(severity) {
        return this.receiveAlerts && severity >= this.minAlertSeverity;
    }
    shouldAutoShare(severity) {
        return this.autoShareWithAllies && severity >= this.autoShareMinSeverity;
    }
    shouldAutoEnforce(incidentType) {
        if (!this.autoEnforceEnabled) {
            return false;
        }
        switch (incidentType) {
            case 'timeout':
            case 'long_timeout':
                return this.autoEnforceTimeouts;
            case 'kick':
                return this.autoEnforceKicks;
            case 'ban':
            case 'warning':
            default:
                return false;
        }
    }
    getSharingSummary() {
        const sharedTypes = [];
        if (this.shareWarnings) {
            sharedTypes.push('warnings');
        }
        if (this.shareTimeouts) {
            sharedTypes.push('timeouts');
        }
        if (this.shareKicks) {
            sharedTypes.push('kicks');
        }
        if (this.shareBans) {
            sharedTypes.push('bans');
        }
        return {
            sharingEnabled: sharedTypes.length > 0,
            sharedTypes,
            alertsEnabled: this.receiveAlerts,
            alertChannel: this.alertChannelId || null,
        };
    }
};
exports.BlacklistSharingConfig = BlacklistSharingConfig;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], BlacklistSharingConfig.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'boolean', default: false }),
    __metadata("design:type", Boolean)
], BlacklistSharingConfig.prototype, "shareWarnings", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'boolean', default: true }),
    __metadata("design:type", Boolean)
], BlacklistSharingConfig.prototype, "shareTimeouts", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'boolean', default: true }),
    __metadata("design:type", Boolean)
], BlacklistSharingConfig.prototype, "shareKicks", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'boolean', default: true }),
    __metadata("design:type", Boolean)
], BlacklistSharingConfig.prototype, "shareBans", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'boolean', default: true }),
    __metadata("design:type", Boolean)
], BlacklistSharingConfig.prototype, "receiveAlerts", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 2 }),
    __metadata("design:type", Number)
], BlacklistSharingConfig.prototype, "minAlertSeverity", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 20, nullable: true }),
    __metadata("design:type", String)
], BlacklistSharingConfig.prototype, "alertChannelId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'boolean', default: false }),
    __metadata("design:type", Boolean)
], BlacklistSharingConfig.prototype, "autoShareWithAllies", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 3 }),
    __metadata("design:type", Number)
], BlacklistSharingConfig.prototype, "autoShareMinSeverity", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'boolean', default: false }),
    __metadata("design:type", Boolean)
], BlacklistSharingConfig.prototype, "autoEnforceEnabled", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'boolean', default: false }),
    __metadata("design:type", Boolean)
], BlacklistSharingConfig.prototype, "autoEnforceTimeouts", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'boolean', default: false }),
    __metadata("design:type", Boolean)
], BlacklistSharingConfig.prototype, "autoEnforceKicks", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], BlacklistSharingConfig.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], BlacklistSharingConfig.prototype, "updatedAt", void 0);
exports.BlacklistSharingConfig = BlacklistSharingConfig = __decorate([
    (0, typeorm_1.Entity)('blacklist_sharing_config')
], BlacklistSharingConfig);
//# sourceMappingURL=BlacklistSharingConfig.js.map