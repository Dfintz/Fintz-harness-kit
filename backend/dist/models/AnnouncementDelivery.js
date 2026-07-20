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
exports.AnnouncementDelivery = exports.MAX_DELIVERY_RETRY_COUNT = exports.DeliveryStatus = void 0;
const typeorm_1 = require("typeorm");
const Announcement_1 = require("./Announcement");
var DeliveryStatus;
(function (DeliveryStatus) {
    DeliveryStatus["PENDING"] = "pending";
    DeliveryStatus["SCHEDULED"] = "scheduled";
    DeliveryStatus["SENDING"] = "sending";
    DeliveryStatus["DELIVERED"] = "delivered";
    DeliveryStatus["FAILED"] = "failed";
    DeliveryStatus["CANCELLED"] = "cancelled";
})(DeliveryStatus || (exports.DeliveryStatus = DeliveryStatus = {}));
exports.MAX_DELIVERY_RETRY_COUNT = 3;
let AnnouncementDelivery = class AnnouncementDelivery {
    id;
    announcementId;
    announcement;
    guildId;
    channelId;
    status;
    messageId;
    retryCount;
    scheduledAt;
    deliveredAt;
    errorMessage;
    createdAt;
    updatedAt;
    get isPending() {
        return this.status === DeliveryStatus.PENDING ||
            this.status === DeliveryStatus.SCHEDULED;
    }
    get isDelivered() {
        return this.status === DeliveryStatus.DELIVERED;
    }
    get isFailed() {
        return this.status === DeliveryStatus.FAILED;
    }
    get canRetry() {
        return this.status === DeliveryStatus.FAILED && this.retryCount < exports.MAX_DELIVERY_RETRY_COUNT;
    }
};
exports.AnnouncementDelivery = AnnouncementDelivery;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], AnnouncementDelivery.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid' }),
    __metadata("design:type", String)
], AnnouncementDelivery.prototype, "announcementId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Announcement_1.Announcement, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'announcementId' }),
    __metadata("design:type", Announcement_1.Announcement)
], AnnouncementDelivery.prototype, "announcement", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 20 }),
    __metadata("design:type", String)
], AnnouncementDelivery.prototype, "guildId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 20, nullable: true }),
    __metadata("design:type", String)
], AnnouncementDelivery.prototype, "channelId", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'varchar',
        length: 20,
        default: DeliveryStatus.PENDING
    }),
    __metadata("design:type", String)
], AnnouncementDelivery.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 20, nullable: true }),
    __metadata("design:type", String)
], AnnouncementDelivery.prototype, "messageId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 0 }),
    __metadata("design:type", Number)
], AnnouncementDelivery.prototype, "retryCount", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp', nullable: true }),
    __metadata("design:type", Date)
], AnnouncementDelivery.prototype, "scheduledAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp', nullable: true }),
    __metadata("design:type", Date)
], AnnouncementDelivery.prototype, "deliveredAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], AnnouncementDelivery.prototype, "errorMessage", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], AnnouncementDelivery.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], AnnouncementDelivery.prototype, "updatedAt", void 0);
exports.AnnouncementDelivery = AnnouncementDelivery = __decorate([
    (0, typeorm_1.Entity)('announcement_deliveries'),
    (0, typeorm_1.Index)(['announcementId', 'guildId']),
    (0, typeorm_1.Index)(['status', 'scheduledAt'])
], AnnouncementDelivery);
//# sourceMappingURL=AnnouncementDelivery.js.map