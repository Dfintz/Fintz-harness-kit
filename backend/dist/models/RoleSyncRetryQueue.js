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
exports.RoleSyncRetryQueue = exports.RoleSyncOperationType = exports.RoleSyncRetryStatus = void 0;
const typeorm_1 = require("typeorm");
var RoleSyncRetryStatus;
(function (RoleSyncRetryStatus) {
    RoleSyncRetryStatus["PENDING"] = "pending";
    RoleSyncRetryStatus["PROCESSING"] = "processing";
    RoleSyncRetryStatus["COMPLETED"] = "completed";
    RoleSyncRetryStatus["FAILED"] = "failed";
    RoleSyncRetryStatus["DEAD_LETTER"] = "dead_letter";
})(RoleSyncRetryStatus || (exports.RoleSyncRetryStatus = RoleSyncRetryStatus = {}));
var RoleSyncOperationType;
(function (RoleSyncOperationType) {
    RoleSyncOperationType["ASSIGN"] = "assign";
    RoleSyncOperationType["REMOVE"] = "remove";
})(RoleSyncOperationType || (exports.RoleSyncOperationType = RoleSyncOperationType = {}));
let RoleSyncRetryQueue = class RoleSyncRetryQueue {
    id;
    guildId;
    userId;
    roleId;
    operation;
    payload;
    retryCount;
    maxRetries;
    status;
    nextRetryAt;
    lastError;
    lastErrorCode;
    createdAt;
    processedAt;
    completedAt;
    deadLetteredAt;
    adminNotified;
    adminNotifiedAt;
};
exports.RoleSyncRetryQueue = RoleSyncRetryQueue;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], RoleSyncRetryQueue.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    (0, typeorm_1.Index)(),
    __metadata("design:type", String)
], RoleSyncRetryQueue.prototype, "guildId", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    (0, typeorm_1.Index)(),
    __metadata("design:type", String)
], RoleSyncRetryQueue.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], RoleSyncRetryQueue.prototype, "roleId", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'varchar',
        length: 10,
    }),
    __metadata("design:type", String)
], RoleSyncRetryQueue.prototype, "operation", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-json'),
    __metadata("design:type", Object)
], RoleSyncRetryQueue.prototype, "payload", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 0 }),
    __metadata("design:type", Number)
], RoleSyncRetryQueue.prototype, "retryCount", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 3 }),
    __metadata("design:type", Number)
], RoleSyncRetryQueue.prototype, "maxRetries", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'varchar',
        length: 20,
        default: RoleSyncRetryStatus.PENDING,
    }),
    __metadata("design:type", String)
], RoleSyncRetryQueue.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp', nullable: true }),
    (0, typeorm_1.Index)(),
    __metadata("design:type", Date)
], RoleSyncRetryQueue.prototype, "nextRetryAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], RoleSyncRetryQueue.prototype, "lastError", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], RoleSyncRetryQueue.prototype, "lastErrorCode", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], RoleSyncRetryQueue.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp', nullable: true }),
    __metadata("design:type", Date)
], RoleSyncRetryQueue.prototype, "processedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp', nullable: true }),
    __metadata("design:type", Date)
], RoleSyncRetryQueue.prototype, "completedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp', nullable: true }),
    __metadata("design:type", Date)
], RoleSyncRetryQueue.prototype, "deadLetteredAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'boolean', default: false }),
    __metadata("design:type", Boolean)
], RoleSyncRetryQueue.prototype, "adminNotified", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp', nullable: true }),
    __metadata("design:type", Date)
], RoleSyncRetryQueue.prototype, "adminNotifiedAt", void 0);
exports.RoleSyncRetryQueue = RoleSyncRetryQueue = __decorate([
    (0, typeorm_1.Entity)('role_sync_retry_queue'),
    (0, typeorm_1.Index)(['status', 'nextRetryAt']),
    (0, typeorm_1.Index)(['guildId', 'status']),
    (0, typeorm_1.Index)(['userId', 'status'])
], RoleSyncRetryQueue);
//# sourceMappingURL=RoleSyncRetryQueue.js.map