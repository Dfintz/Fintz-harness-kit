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
exports.ActivityReminder = exports.DeliveryStatus = exports.ReminderChannel = exports.ReminderType = void 0;
const typeorm_1 = require("typeorm");
var ReminderType;
(function (ReminderType) {
    ReminderType["ONE_DAY_BEFORE"] = "1_day_before";
    ReminderType["ONE_HOUR_BEFORE"] = "1_hour_before";
    ReminderType["THIRTY_MINUTES_BEFORE"] = "30_min_before";
    ReminderType["CUSTOM"] = "custom";
})(ReminderType || (exports.ReminderType = ReminderType = {}));
var ReminderChannel;
(function (ReminderChannel) {
    ReminderChannel["DISCORD"] = "discord";
    ReminderChannel["EMAIL"] = "email";
    ReminderChannel["BOTH"] = "both";
})(ReminderChannel || (exports.ReminderChannel = ReminderChannel = {}));
var DeliveryStatus;
(function (DeliveryStatus) {
    DeliveryStatus["PENDING"] = "pending";
    DeliveryStatus["SENT"] = "sent";
    DeliveryStatus["FAILED"] = "failed";
    DeliveryStatus["CANCELLED"] = "cancelled";
})(DeliveryStatus || (exports.DeliveryStatus = DeliveryStatus = {}));
let ActivityReminder = class ActivityReminder {
    id;
    activityId;
    reminderType;
    channel;
    scheduledTime;
    deliveryStatus;
    recipientUserIds;
    recipientEmails;
    discordChannelId;
    messageTemplate;
    messageVariables;
    sentAt;
    errorMessage;
    retryCount;
    lastRetryAt;
    isEnabled;
    createdBy;
    createdAt;
    updatedAt;
    isDue() {
        return this.scheduledTime <= new Date() &&
            this.deliveryStatus === DeliveryStatus.PENDING &&
            this.isEnabled;
    }
    canRetry() {
        return this.retryCount < 3 &&
            this.deliveryStatus === DeliveryStatus.FAILED;
    }
    getFormattedMessage() {
        let message = this.messageTemplate;
        if (this.messageVariables) {
            Object.entries(this.messageVariables).forEach(([key, value]) => {
                message = message.replace(`{{${key}}}`, String(value));
            });
        }
        return message;
    }
};
exports.ActivityReminder = ActivityReminder;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], ActivityReminder.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], ActivityReminder.prototype, "activityId", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'varchar',
        enum: ReminderType
    }),
    __metadata("design:type", String)
], ActivityReminder.prototype, "reminderType", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'varchar',
        enum: ReminderChannel,
        default: ReminderChannel.DISCORD
    }),
    __metadata("design:type", String)
], ActivityReminder.prototype, "channel", void 0);
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.Column)(),
    __metadata("design:type", Date)
], ActivityReminder.prototype, "scheduledTime", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'varchar',
        enum: DeliveryStatus,
        default: DeliveryStatus.PENDING
    }),
    __metadata("design:type", String)
], ActivityReminder.prototype, "deliveryStatus", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-array', { nullable: true }),
    __metadata("design:type", Array)
], ActivityReminder.prototype, "recipientUserIds", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-array', { nullable: true }),
    __metadata("design:type", Array)
], ActivityReminder.prototype, "recipientEmails", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], ActivityReminder.prototype, "discordChannelId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text' }),
    __metadata("design:type", String)
], ActivityReminder.prototype, "messageTemplate", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'simple-json', nullable: true }),
    __metadata("design:type", Object)
], ActivityReminder.prototype, "messageVariables", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", Date)
], ActivityReminder.prototype, "sentAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], ActivityReminder.prototype, "errorMessage", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 0 }),
    __metadata("design:type", Number)
], ActivityReminder.prototype, "retryCount", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", Date)
], ActivityReminder.prototype, "lastRetryAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: true }),
    __metadata("design:type", Boolean)
], ActivityReminder.prototype, "isEnabled", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], ActivityReminder.prototype, "createdBy", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], ActivityReminder.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], ActivityReminder.prototype, "updatedAt", void 0);
exports.ActivityReminder = ActivityReminder = __decorate([
    (0, typeorm_1.Entity)('activity_reminders'),
    (0, typeorm_1.Index)(['activityId', 'scheduledTime']),
    (0, typeorm_1.Index)(['deliveryStatus', 'scheduledTime'])
], ActivityReminder);
//# sourceMappingURL=ActivityReminder.js.map