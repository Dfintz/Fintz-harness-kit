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
exports.FailedDmDelivery = void 0;
const typeorm_1 = require("typeorm");
let FailedDmDelivery = class FailedDmDelivery {
    id;
    recipientDiscordId;
    eventType;
    guildId;
    content;
    embedJson;
    attemptCount;
    nextRetryAt;
    lastError;
    expiresAt;
    createdAt;
};
exports.FailedDmDelivery = FailedDmDelivery;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], FailedDmDelivery.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar' }),
    __metadata("design:type", String)
], FailedDmDelivery.prototype, "recipientDiscordId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 64 }),
    __metadata("design:type", String)
], FailedDmDelivery.prototype, "eventType", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', nullable: true }),
    __metadata("design:type", Object)
], FailedDmDelivery.prototype, "guildId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], FailedDmDelivery.prototype, "content", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb' }),
    __metadata("design:type", Object)
], FailedDmDelivery.prototype, "embedJson", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 1 }),
    __metadata("design:type", Number)
], FailedDmDelivery.prototype, "attemptCount", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp' }),
    __metadata("design:type", Date)
], FailedDmDelivery.prototype, "nextRetryAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], FailedDmDelivery.prototype, "lastError", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp' }),
    __metadata("design:type", Date)
], FailedDmDelivery.prototype, "expiresAt", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], FailedDmDelivery.prototype, "createdAt", void 0);
exports.FailedDmDelivery = FailedDmDelivery = __decorate([
    (0, typeorm_1.Entity)('failed_dm_deliveries'),
    (0, typeorm_1.Index)('IDX_failed_dm_deliveries_nextRetryAt', ['nextRetryAt']),
    (0, typeorm_1.Index)('IDX_failed_dm_deliveries_expiresAt', ['expiresAt']),
    (0, typeorm_1.Index)('IDX_failed_dm_deliveries_recipient', ['recipientDiscordId'])
], FailedDmDelivery);
//# sourceMappingURL=FailedDmDelivery.js.map