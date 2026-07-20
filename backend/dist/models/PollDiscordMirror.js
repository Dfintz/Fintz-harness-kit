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
exports.PollDiscordMirror = exports.MAX_MIRROR_RETRY_COUNT = exports.PollMirrorScope = exports.PollMirrorStatus = void 0;
const typeorm_1 = require("typeorm");
const Poll_1 = require("./Poll");
var PollMirrorStatus;
(function (PollMirrorStatus) {
    PollMirrorStatus["PENDING"] = "pending";
    PollMirrorStatus["ACTIVE"] = "active";
    PollMirrorStatus["CLOSED"] = "closed";
    PollMirrorStatus["FAILED"] = "failed";
    PollMirrorStatus["CANCELLED"] = "cancelled";
})(PollMirrorStatus || (exports.PollMirrorStatus = PollMirrorStatus = {}));
var PollMirrorScope;
(function (PollMirrorScope) {
    PollMirrorScope["ORGANIZATION"] = "organization";
    PollMirrorScope["FEDERATION"] = "federation";
})(PollMirrorScope || (exports.PollMirrorScope = PollMirrorScope = {}));
exports.MAX_MIRROR_RETRY_COUNT = 3;
let PollDiscordMirror = class PollDiscordMirror {
    id;
    pollId;
    poll;
    scope;
    federationId;
    organizationId;
    guildId;
    channelId;
    messageId;
    status;
    retryCount;
    errorMessage;
    deliveredAt;
    lastUpdatedAt;
    createdAt;
    updatedAt;
    get isPending() {
        return this.status === PollMirrorStatus.PENDING;
    }
    get isActive() {
        return this.status === PollMirrorStatus.ACTIVE;
    }
    get isClosed() {
        return this.status === PollMirrorStatus.CLOSED;
    }
    get isFailed() {
        return this.status === PollMirrorStatus.FAILED;
    }
    get canRetry() {
        return this.status === PollMirrorStatus.FAILED && this.retryCount < exports.MAX_MIRROR_RETRY_COUNT;
    }
};
exports.PollDiscordMirror = PollDiscordMirror;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], PollDiscordMirror.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid' }),
    __metadata("design:type", String)
], PollDiscordMirror.prototype, "pollId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Poll_1.Poll, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'pollId' }),
    __metadata("design:type", Poll_1.Poll)
], PollDiscordMirror.prototype, "poll", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 20, default: PollMirrorScope.ORGANIZATION }),
    __metadata("design:type", String)
], PollDiscordMirror.prototype, "scope", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid', nullable: true }),
    __metadata("design:type", String)
], PollDiscordMirror.prototype, "federationId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar' }),
    __metadata("design:type", String)
], PollDiscordMirror.prototype, "organizationId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 20 }),
    __metadata("design:type", String)
], PollDiscordMirror.prototype, "guildId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 20, nullable: true }),
    __metadata("design:type", String)
], PollDiscordMirror.prototype, "channelId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 20, nullable: true }),
    __metadata("design:type", String)
], PollDiscordMirror.prototype, "messageId", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'varchar',
        length: 20,
        default: PollMirrorStatus.PENDING,
    }),
    __metadata("design:type", String)
], PollDiscordMirror.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 0 }),
    __metadata("design:type", Number)
], PollDiscordMirror.prototype, "retryCount", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], PollDiscordMirror.prototype, "errorMessage", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp', nullable: true }),
    __metadata("design:type", Date)
], PollDiscordMirror.prototype, "deliveredAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp', nullable: true }),
    __metadata("design:type", Date)
], PollDiscordMirror.prototype, "lastUpdatedAt", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], PollDiscordMirror.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], PollDiscordMirror.prototype, "updatedAt", void 0);
exports.PollDiscordMirror = PollDiscordMirror = __decorate([
    (0, typeorm_1.Entity)('poll_discord_mirrors'),
    (0, typeorm_1.Index)(['pollId']),
    (0, typeorm_1.Index)(['guildId']),
    (0, typeorm_1.Index)(['status']),
    (0, typeorm_1.Index)(['organizationId']),
    (0, typeorm_1.Index)(['pollId', 'guildId'], { unique: true })
], PollDiscordMirror);
//# sourceMappingURL=PollDiscordMirror.js.map