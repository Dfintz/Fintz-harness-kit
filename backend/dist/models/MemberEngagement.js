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
exports.InviteTracking = exports.ChannelCounter = exports.StatRole = exports.MemberEngagement = void 0;
const typeorm_1 = require("typeorm");
let MemberEngagement = class MemberEngagement {
    id;
    guildId;
    userId;
    date;
    messageCount;
    voiceMinutes;
    reactionsGiven;
    threadsCreated;
    createdAt;
    updatedAt;
};
exports.MemberEngagement = MemberEngagement;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], MemberEngagement.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], MemberEngagement.prototype, "guildId", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], MemberEngagement.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'date' }),
    __metadata("design:type", String)
], MemberEngagement.prototype, "date", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 0 }),
    __metadata("design:type", Number)
], MemberEngagement.prototype, "messageCount", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 0 }),
    __metadata("design:type", Number)
], MemberEngagement.prototype, "voiceMinutes", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 0 }),
    __metadata("design:type", Number)
], MemberEngagement.prototype, "reactionsGiven", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 0 }),
    __metadata("design:type", Number)
], MemberEngagement.prototype, "threadsCreated", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], MemberEngagement.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], MemberEngagement.prototype, "updatedAt", void 0);
exports.MemberEngagement = MemberEngagement = __decorate([
    (0, typeorm_1.Entity)('member_engagements'),
    (0, typeorm_1.Index)(['guildId', 'userId', 'date'], { unique: true }),
    (0, typeorm_1.Index)(['guildId', 'date']),
    (0, typeorm_1.Index)(['userId'])
], MemberEngagement);
let StatRole = class StatRole {
    id;
    guildId;
    roleId;
    roleName;
    minMessages;
    minVoiceMinutes;
    windowDays;
    autoRemove;
    enabled;
    createdAt;
    updatedAt;
};
exports.StatRole = StatRole;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], StatRole.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], StatRole.prototype, "guildId", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], StatRole.prototype, "roleId", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], StatRole.prototype, "roleName", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 0 }),
    __metadata("design:type", Number)
], StatRole.prototype, "minMessages", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 0 }),
    __metadata("design:type", Number)
], StatRole.prototype, "minVoiceMinutes", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 30 }),
    __metadata("design:type", Number)
], StatRole.prototype, "windowDays", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: true }),
    __metadata("design:type", Boolean)
], StatRole.prototype, "autoRemove", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: true }),
    __metadata("design:type", Boolean)
], StatRole.prototype, "enabled", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], StatRole.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], StatRole.prototype, "updatedAt", void 0);
exports.StatRole = StatRole = __decorate([
    (0, typeorm_1.Entity)('stat_roles'),
    (0, typeorm_1.Index)(['guildId']),
    (0, typeorm_1.Index)(['guildId', 'roleId'], { unique: true })
], StatRole);
let ChannelCounter = class ChannelCounter {
    id;
    guildId;
    channelId;
    counterType;
    nameTemplate;
    enabled;
    createdAt;
    updatedAt;
};
exports.ChannelCounter = ChannelCounter;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], ChannelCounter.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], ChannelCounter.prototype, "guildId", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], ChannelCounter.prototype, "channelId", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], ChannelCounter.prototype, "counterType", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: '{value}' }),
    __metadata("design:type", String)
], ChannelCounter.prototype, "nameTemplate", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: true }),
    __metadata("design:type", Boolean)
], ChannelCounter.prototype, "enabled", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], ChannelCounter.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], ChannelCounter.prototype, "updatedAt", void 0);
exports.ChannelCounter = ChannelCounter = __decorate([
    (0, typeorm_1.Entity)('channel_counters'),
    (0, typeorm_1.Index)(['guildId']),
    (0, typeorm_1.Index)(['guildId', 'channelId'], { unique: true })
], ChannelCounter);
let InviteTracking = class InviteTracking {
    id;
    guildId;
    invitedUserId;
    inviterUserId;
    inviteCode;
    joinedAt;
    createdAt;
};
exports.InviteTracking = InviteTracking;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], InviteTracking.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], InviteTracking.prototype, "guildId", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], InviteTracking.prototype, "invitedUserId", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], InviteTracking.prototype, "inviterUserId", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], InviteTracking.prototype, "inviteCode", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", Date)
], InviteTracking.prototype, "joinedAt", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], InviteTracking.prototype, "createdAt", void 0);
exports.InviteTracking = InviteTracking = __decorate([
    (0, typeorm_1.Entity)('invite_tracking'),
    (0, typeorm_1.Index)(['guildId']),
    (0, typeorm_1.Index)(['guildId', 'invitedUserId'], { unique: true }),
    (0, typeorm_1.Index)(['inviterUserId'])
], InviteTracking);
//# sourceMappingURL=MemberEngagement.js.map