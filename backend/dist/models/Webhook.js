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
exports.Webhook = exports.WebhookEventType = exports.WebhookStatus = exports.WebhookType = void 0;
const typeorm_1 = require("typeorm");
const TenantEntity_1 = require("./base/TenantEntity");
var WebhookType;
(function (WebhookType) {
    WebhookType["DISCORD"] = "discord";
    WebhookType["CUSTOM"] = "custom";
})(WebhookType || (exports.WebhookType = WebhookType = {}));
var WebhookStatus;
(function (WebhookStatus) {
    WebhookStatus["ACTIVE"] = "active";
    WebhookStatus["INACTIVE"] = "inactive";
    WebhookStatus["ERROR"] = "error";
    WebhookStatus["PENDING"] = "pending";
})(WebhookStatus || (exports.WebhookStatus = WebhookStatus = {}));
var WebhookEventType;
(function (WebhookEventType) {
    WebhookEventType["FLEET_CREATED"] = "fleet.created";
    WebhookEventType["FLEET_UPDATED"] = "fleet.updated";
    WebhookEventType["FLEET_DELETED"] = "fleet.deleted";
    WebhookEventType["FLEET_MEMBER_JOINED"] = "fleet.member.joined";
    WebhookEventType["FLEET_MEMBER_LEFT"] = "fleet.member.left";
    WebhookEventType["MEMBER_JOINED"] = "member.joined";
    WebhookEventType["MEMBER_LEFT"] = "member.left";
    WebhookEventType["MEMBER_ROLE_CHANGED"] = "member.role.changed";
    WebhookEventType["ACTIVITY_CREATED"] = "activity.created";
    WebhookEventType["ACTIVITY_STARTED"] = "activity.started";
    WebhookEventType["ACTIVITY_COMPLETED"] = "activity.completed";
    WebhookEventType["ACTIVITY_CANCELLED"] = "activity.cancelled";
    WebhookEventType["ACTIVITY_PARTICIPANT_JOINED"] = "activity.participant.joined";
    WebhookEventType["ACTIVITY_PARTICIPANT_LEFT"] = "activity.participant.left";
    WebhookEventType["ALERT_CREATED"] = "alert.created";
    WebhookEventType["ALERT_RESOLVED"] = "alert.resolved";
    WebhookEventType["SHIP_ADDED"] = "ship.added";
    WebhookEventType["SHIP_REMOVED"] = "ship.removed";
    WebhookEventType["SHIP_TRANSFERRED"] = "ship.transferred";
    WebhookEventType["BATCH"] = "batch";
})(WebhookEventType || (exports.WebhookEventType = WebhookEventType = {}));
let Webhook = class Webhook extends TenantEntity_1.TenantEntity {
    id;
    name;
    description;
    type;
    status;
    enabled;
    events;
    discordConfig;
    customConfig;
    secret;
    maxRetries;
    retryDelayMs;
    timeoutMs;
    totalDeliveries;
    successfulDeliveries;
    failedDeliveries;
    lastDeliveryAt;
    lastSuccessAt;
    lastFailureAt;
    lastError;
    deliveryHistory;
    circuitBreakerThreshold;
    consecutiveFailures;
    circuitBreakerOpen;
    circuitOpenedAt;
    adminNotifiedOfFailure;
    adminNotifiedAt;
    createdBy;
    notes;
    createdAt;
    updatedAt;
    get successRate() {
        if (this.totalDeliveries === 0) {
            return 0;
        }
        return Math.round((this.successfulDeliveries / this.totalDeliveries) * 100);
    }
    get isHealthy() {
        if (this.circuitBreakerOpen) {
            return false;
        }
        const recentDeliveries = this.deliveryHistory.slice(0, 10);
        if (recentDeliveries.length === 0) {
            return true;
        }
        const failures = recentDeliveries.filter(d => d.status === 'failed').length;
        return failures / recentDeliveries.length < 0.5;
    }
    get canDeliver() {
        return !this.circuitBreakerOpen && this.enabled && this.status !== WebhookStatus.ERROR;
    }
};
exports.Webhook = Webhook;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], Webhook.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], Webhook.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)('text', { nullable: true }),
    __metadata("design:type", String)
], Webhook.prototype, "description", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'varchar',
    }),
    __metadata("design:type", String)
], Webhook.prototype, "type", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'varchar',
        default: WebhookStatus.PENDING,
    }),
    __metadata("design:type", String)
], Webhook.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: true }),
    __metadata("design:type", Boolean)
], Webhook.prototype, "enabled", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-array'),
    __metadata("design:type", Array)
], Webhook.prototype, "events", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-json', { nullable: true }),
    __metadata("design:type", Object)
], Webhook.prototype, "discordConfig", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-json', { nullable: true }),
    __metadata("design:type", Object)
], Webhook.prototype, "customConfig", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], Webhook.prototype, "secret", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 3 }),
    __metadata("design:type", Number)
], Webhook.prototype, "maxRetries", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 1000 }),
    __metadata("design:type", Number)
], Webhook.prototype, "retryDelayMs", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 30000 }),
    __metadata("design:type", Number)
], Webhook.prototype, "timeoutMs", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 0 }),
    __metadata("design:type", Number)
], Webhook.prototype, "totalDeliveries", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 0 }),
    __metadata("design:type", Number)
], Webhook.prototype, "successfulDeliveries", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 0 }),
    __metadata("design:type", Number)
], Webhook.prototype, "failedDeliveries", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp', nullable: true }),
    __metadata("design:type", Date)
], Webhook.prototype, "lastDeliveryAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp', nullable: true }),
    __metadata("design:type", Date)
], Webhook.prototype, "lastSuccessAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp', nullable: true }),
    __metadata("design:type", Date)
], Webhook.prototype, "lastFailureAt", void 0);
__decorate([
    (0, typeorm_1.Column)('text', { nullable: true }),
    __metadata("design:type", String)
], Webhook.prototype, "lastError", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-json', { default: '[]' }),
    __metadata("design:type", Array)
], Webhook.prototype, "deliveryHistory", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 5 }),
    __metadata("design:type", Number)
], Webhook.prototype, "circuitBreakerThreshold", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 0 }),
    __metadata("design:type", Number)
], Webhook.prototype, "consecutiveFailures", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: false }),
    __metadata("design:type", Boolean)
], Webhook.prototype, "circuitBreakerOpen", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp', nullable: true }),
    __metadata("design:type", Date)
], Webhook.prototype, "circuitOpenedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: false }),
    __metadata("design:type", Boolean)
], Webhook.prototype, "adminNotifiedOfFailure", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp', nullable: true }),
    __metadata("design:type", Date)
], Webhook.prototype, "adminNotifiedAt", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], Webhook.prototype, "createdBy", void 0);
__decorate([
    (0, typeorm_1.Column)('text', { nullable: true }),
    __metadata("design:type", String)
], Webhook.prototype, "notes", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], Webhook.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], Webhook.prototype, "updatedAt", void 0);
exports.Webhook = Webhook = __decorate([
    (0, typeorm_1.Entity)('webhooks'),
    (0, typeorm_1.Index)(['organizationId', 'status']),
    (0, typeorm_1.Index)(['organizationId', 'type'])
], Webhook);
//# sourceMappingURL=Webhook.js.map