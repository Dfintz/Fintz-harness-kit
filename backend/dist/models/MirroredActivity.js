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
exports.MirroredActivity = exports.MirroredActivityStatus = void 0;
const typeorm_1 = require("typeorm");
const TenantEntity_1 = require("./base/TenantEntity");
var MirroredActivityStatus;
(function (MirroredActivityStatus) {
    MirroredActivityStatus["ACTIVE"] = "active";
    MirroredActivityStatus["PAUSED"] = "paused";
    MirroredActivityStatus["CANCELLED"] = "cancelled";
    MirroredActivityStatus["EXPIRED"] = "expired";
})(MirroredActivityStatus || (exports.MirroredActivityStatus = MirroredActivityStatus = {}));
let MirroredActivity = class MirroredActivity extends TenantEntity_1.TenantEntity {
    id;
    sourceActivityId;
    sourceGuildId;
    sourceOrganizationId;
    mirrorActivityId;
    mirrorGuildId;
    mirrorChannelId;
    mirrorMessageId;
    mirrorKey;
    status;
    syncEnabled;
    lastSyncAt;
    metadata;
    createdAt;
    updatedAt;
    isActive() {
        return this.status === MirroredActivityStatus.ACTIVE && this.syncEnabled;
    }
    canSync() {
        return (this.status === MirroredActivityStatus.ACTIVE &&
            this.syncEnabled &&
            !!this.mirrorMessageId);
    }
};
exports.MirroredActivity = MirroredActivity;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], MirroredActivity.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], MirroredActivity.prototype, "sourceActivityId", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], MirroredActivity.prototype, "sourceGuildId", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], MirroredActivity.prototype, "sourceOrganizationId", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], MirroredActivity.prototype, "mirrorActivityId", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], MirroredActivity.prototype, "mirrorGuildId", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], MirroredActivity.prototype, "mirrorChannelId", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], MirroredActivity.prototype, "mirrorMessageId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', nullable: true }),
    __metadata("design:type", String)
], MirroredActivity.prototype, "mirrorKey", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'enum',
        enum: MirroredActivityStatus,
        default: MirroredActivityStatus.ACTIVE,
    }),
    __metadata("design:type", String)
], MirroredActivity.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'boolean', default: true }),
    __metadata("design:type", Boolean)
], MirroredActivity.prototype, "syncEnabled", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp', nullable: true }),
    __metadata("design:type", Date)
], MirroredActivity.prototype, "lastSyncAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', nullable: true }),
    __metadata("design:type", Object)
], MirroredActivity.prototype, "metadata", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], MirroredActivity.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], MirroredActivity.prototype, "updatedAt", void 0);
exports.MirroredActivity = MirroredActivity = __decorate([
    (0, typeorm_1.Entity)('mirrored_activities'),
    (0, typeorm_1.Index)('idx_mirrored_source', ['sourceActivityId']),
    (0, typeorm_1.Index)('idx_mirrored_mirror', ['mirrorActivityId']),
    (0, typeorm_1.Index)('idx_mirrored_guild', ['mirrorGuildId']),
    (0, typeorm_1.Index)('idx_mirrored_status', ['status'])
], MirroredActivity);
//# sourceMappingURL=MirroredActivity.js.map