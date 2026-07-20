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
exports.WebhookRetryQueue = exports.WebhookRetryStatus = void 0;
const typeorm_1 = require("typeorm");
var WebhookRetryStatus;
(function (WebhookRetryStatus) {
    WebhookRetryStatus["PENDING"] = "pending";
    WebhookRetryStatus["PROCESSING"] = "processing";
    WebhookRetryStatus["COMPLETED"] = "completed";
    WebhookRetryStatus["FAILED"] = "failed";
    WebhookRetryStatus["DEAD_LETTER"] = "dead_letter";
})(WebhookRetryStatus || (exports.WebhookRetryStatus = WebhookRetryStatus = {}));
let WebhookRetryQueue = class WebhookRetryQueue {
    id;
    webhookId;
    organizationId;
    event;
    payload;
    retryCount;
    maxRetries;
    status;
    nextRetryAt;
    lastError;
    lastStatusCode;
    lastResponseTime;
    createdAt;
    processedAt;
    completedAt;
};
exports.WebhookRetryQueue = WebhookRetryQueue;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], WebhookRetryQueue.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    (0, typeorm_1.Index)(),
    __metadata("design:type", String)
], WebhookRetryQueue.prototype, "webhookId", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], WebhookRetryQueue.prototype, "organizationId", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], WebhookRetryQueue.prototype, "event", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-json'),
    __metadata("design:type", Object)
], WebhookRetryQueue.prototype, "payload", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", Number)
], WebhookRetryQueue.prototype, "retryCount", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", Number)
], WebhookRetryQueue.prototype, "maxRetries", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'varchar',
        default: WebhookRetryStatus.PENDING
    }),
    __metadata("design:type", String)
], WebhookRetryQueue.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp', nullable: true }),
    (0, typeorm_1.Index)(),
    __metadata("design:type", Date)
], WebhookRetryQueue.prototype, "nextRetryAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], WebhookRetryQueue.prototype, "lastError", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", Number)
], WebhookRetryQueue.prototype, "lastStatusCode", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", Number)
], WebhookRetryQueue.prototype, "lastResponseTime", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], WebhookRetryQueue.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp', nullable: true }),
    __metadata("design:type", Date)
], WebhookRetryQueue.prototype, "processedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp', nullable: true }),
    __metadata("design:type", Date)
], WebhookRetryQueue.prototype, "completedAt", void 0);
exports.WebhookRetryQueue = WebhookRetryQueue = __decorate([
    (0, typeorm_1.Entity)('webhook_retry_queue'),
    (0, typeorm_1.Index)(['status', 'nextRetryAt']),
    (0, typeorm_1.Index)(['webhookId', 'status'])
], WebhookRetryQueue);
//# sourceMappingURL=WebhookRetryQueue.js.map