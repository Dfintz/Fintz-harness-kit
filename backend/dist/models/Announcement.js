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
exports.Announcement = exports.AnnouncementStatus = exports.AnnouncementTargetType = void 0;
const typeorm_1 = require("typeorm");
const TenantEntity_1 = require("./base/TenantEntity");
var AnnouncementTargetType;
(function (AnnouncementTargetType) {
    AnnouncementTargetType["SINGLE"] = "single";
    AnnouncementTargetType["MULTIPLE"] = "multiple";
    AnnouncementTargetType["ALL"] = "all";
    AnnouncementTargetType["ALLIANCE"] = "alliance";
})(AnnouncementTargetType || (exports.AnnouncementTargetType = AnnouncementTargetType = {}));
var AnnouncementStatus;
(function (AnnouncementStatus) {
    AnnouncementStatus["DRAFT"] = "draft";
    AnnouncementStatus["SCHEDULED"] = "scheduled";
    AnnouncementStatus["SENDING"] = "sending";
    AnnouncementStatus["SENT"] = "sent";
    AnnouncementStatus["FAILED"] = "failed";
    AnnouncementStatus["CANCELLED"] = "cancelled";
})(AnnouncementStatus || (exports.AnnouncementStatus = AnnouncementStatus = {}));
let Announcement = class Announcement extends TenantEntity_1.TenantEntity {
    id;
    title;
    content;
    embedConfig;
    targetType;
    targetIds;
    status;
    createdBy;
    createdByName;
    scheduledAt;
    sentAt;
    pinnedAt;
    pinnedBy;
    deliveryResults;
    federationId;
    targetAudience;
    createdAt;
    get isPending() {
        return this.status === AnnouncementStatus.DRAFT || this.status === AnnouncementStatus.SCHEDULED;
    }
    get isDelivered() {
        return this.status === AnnouncementStatus.SENT;
    }
    get totalTargets() {
        return this.targetIds?.length || 0;
    }
    get successfulDeliveries() {
        return this.deliveryResults?.filter(r => r.success).length || 0;
    }
    get failedDeliveries() {
        return this.deliveryResults?.filter(r => !r.success).length || 0;
    }
    get isPinned() {
        return this.pinnedAt !== null && this.pinnedAt !== undefined;
    }
};
exports.Announcement = Announcement;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], Announcement.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 256 }),
    __metadata("design:type", String)
], Announcement.prototype, "title", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text' }),
    __metadata("design:type", String)
], Announcement.prototype, "content", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-json', { nullable: true }),
    __metadata("design:type", Object)
], Announcement.prototype, "embedConfig", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'varchar',
        length: 20,
        default: AnnouncementTargetType.SINGLE,
    }),
    __metadata("design:type", String)
], Announcement.prototype, "targetType", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-json', { nullable: true }),
    __metadata("design:type", Array)
], Announcement.prototype, "targetIds", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'varchar',
        length: 20,
        default: AnnouncementStatus.DRAFT,
    }),
    __metadata("design:type", String)
], Announcement.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], Announcement.prototype, "createdBy", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], Announcement.prototype, "createdByName", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp', nullable: true }),
    __metadata("design:type", Date)
], Announcement.prototype, "scheduledAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp', nullable: true }),
    __metadata("design:type", Date)
], Announcement.prototype, "sentAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp', nullable: true }),
    __metadata("design:type", Date)
], Announcement.prototype, "pinnedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', nullable: true }),
    __metadata("design:type", String)
], Announcement.prototype, "pinnedBy", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-json', { nullable: true }),
    __metadata("design:type", Array)
], Announcement.prototype, "deliveryResults", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid', nullable: true }),
    __metadata("design:type", String)
], Announcement.prototype, "federationId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 30, nullable: true, default: 'all-members' }),
    __metadata("design:type", String)
], Announcement.prototype, "targetAudience", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], Announcement.prototype, "createdAt", void 0);
exports.Announcement = Announcement = __decorate([
    (0, typeorm_1.Entity)('announcements'),
    (0, typeorm_1.Index)(['organizationId', 'status']),
    (0, typeorm_1.Index)(['organizationId', 'createdAt']),
    (0, typeorm_1.Index)(['status', 'scheduledAt']),
    (0, typeorm_1.Index)(['createdBy'])
], Announcement);
//# sourceMappingURL=Announcement.js.map