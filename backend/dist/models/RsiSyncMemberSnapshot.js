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
exports.RsiSyncMemberSnapshot = void 0;
const typeorm_1 = require("typeorm");
const Organization_1 = require("./Organization");
const RsiSyncAuditLog_1 = require("./RsiSyncAuditLog");
let RsiSyncMemberSnapshot = class RsiSyncMemberSnapshot {
    id;
    syncLogId;
    syncLog;
    organizationId;
    organization;
    rsiHandle;
    displayName;
    rank;
    stars;
    isMain;
    isAffiliate;
    isHidden;
    isRedacted;
    avatar;
    enlisted;
    createdAt;
};
exports.RsiSyncMemberSnapshot = RsiSyncMemberSnapshot;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], RsiSyncMemberSnapshot.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)('uuid'),
    __metadata("design:type", String)
], RsiSyncMemberSnapshot.prototype, "syncLogId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => RsiSyncAuditLog_1.RsiSyncAuditLog, { nullable: false, onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'syncLogId' }),
    __metadata("design:type", RsiSyncAuditLog_1.RsiSyncAuditLog)
], RsiSyncMemberSnapshot.prototype, "syncLog", void 0);
__decorate([
    (0, typeorm_1.Column)('uuid'),
    __metadata("design:type", String)
], RsiSyncMemberSnapshot.prototype, "organizationId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Organization_1.Organization, { nullable: false, onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'organizationId' }),
    __metadata("design:type", Organization_1.Organization)
], RsiSyncMemberSnapshot.prototype, "organization", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 100 }),
    __metadata("design:type", String)
], RsiSyncMemberSnapshot.prototype, "rsiHandle", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 100, nullable: true }),
    __metadata("design:type", String)
], RsiSyncMemberSnapshot.prototype, "displayName", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 50, nullable: true }),
    __metadata("design:type", String)
], RsiSyncMemberSnapshot.prototype, "rank", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 0 }),
    __metadata("design:type", Number)
], RsiSyncMemberSnapshot.prototype, "stars", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: false }),
    __metadata("design:type", Boolean)
], RsiSyncMemberSnapshot.prototype, "isMain", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: false }),
    __metadata("design:type", Boolean)
], RsiSyncMemberSnapshot.prototype, "isAffiliate", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: false }),
    __metadata("design:type", Boolean)
], RsiSyncMemberSnapshot.prototype, "isHidden", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: false }),
    __metadata("design:type", Boolean)
], RsiSyncMemberSnapshot.prototype, "isRedacted", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], RsiSyncMemberSnapshot.prototype, "avatar", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 50, nullable: true }),
    __metadata("design:type", String)
], RsiSyncMemberSnapshot.prototype, "enlisted", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], RsiSyncMemberSnapshot.prototype, "createdAt", void 0);
exports.RsiSyncMemberSnapshot = RsiSyncMemberSnapshot = __decorate([
    (0, typeorm_1.Entity)('rsi_sync_member_snapshots'),
    (0, typeorm_1.Index)('IDX_rsi_sync_snapshots_sync_log', ['syncLogId']),
    (0, typeorm_1.Index)('IDX_rsi_sync_snapshots_org_id', ['organizationId']),
    (0, typeorm_1.Index)('IDX_rsi_sync_snapshots_org_handle', ['organizationId', 'rsiHandle']),
    (0, typeorm_1.Index)('IDX_rsi_sync_snapshots_sync_handle', ['syncLogId', 'rsiHandle'])
], RsiSyncMemberSnapshot);
//# sourceMappingURL=RsiSyncMemberSnapshot.js.map