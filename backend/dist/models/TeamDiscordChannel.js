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
exports.TeamDiscordChannel = void 0;
const typeorm_1 = require("typeorm");
let TeamDiscordChannel = class TeamDiscordChannel {
    id;
    organizationId;
    teamId;
    guildId;
    categoryId;
    textChannelId;
    voiceChannelId;
    teamRoleId;
    createdAt;
    updatedAt;
    createdBy;
    lastSyncedAt;
    syncStatus;
    lastSyncError;
};
exports.TeamDiscordChannel = TeamDiscordChannel;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], TeamDiscordChannel.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], TeamDiscordChannel.prototype, "organizationId", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], TeamDiscordChannel.prototype, "teamId", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], TeamDiscordChannel.prototype, "guildId", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], TeamDiscordChannel.prototype, "categoryId", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], TeamDiscordChannel.prototype, "textChannelId", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], TeamDiscordChannel.prototype, "voiceChannelId", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], TeamDiscordChannel.prototype, "teamRoleId", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], TeamDiscordChannel.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], TeamDiscordChannel.prototype, "updatedAt", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], TeamDiscordChannel.prototype, "createdBy", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp', nullable: true }),
    __metadata("design:type", Date)
], TeamDiscordChannel.prototype, "lastSyncedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 20, default: 'synced' }),
    __metadata("design:type", String)
], TeamDiscordChannel.prototype, "syncStatus", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], TeamDiscordChannel.prototype, "lastSyncError", void 0);
exports.TeamDiscordChannel = TeamDiscordChannel = __decorate([
    (0, typeorm_1.Entity)('team_discord_channels'),
    (0, typeorm_1.Index)(['organizationId', 'teamId', 'guildId'], { unique: true }),
    (0, typeorm_1.Index)(['organizationId', 'guildId']),
    (0, typeorm_1.Index)(['guildId'])
], TeamDiscordChannel);
//# sourceMappingURL=TeamDiscordChannel.js.map