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
exports.DiscordUserPreference = void 0;
const typeorm_1 = require("typeorm");
let DiscordUserPreference = class DiscordUserPreference {
    userId;
    guildId;
    dmEnabled;
    lfgPingOptIn;
    eventReminderOptIn;
    ticketDmOptIn;
    recruitmentDmOptIn;
    moderationAlertOptIn;
    botResponseViaDm;
    timezone;
    createdAt;
    updatedAt;
};
exports.DiscordUserPreference = DiscordUserPreference;
__decorate([
    (0, typeorm_1.PrimaryColumn)(),
    __metadata("design:type", String)
], DiscordUserPreference.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.PrimaryColumn)(),
    __metadata("design:type", String)
], DiscordUserPreference.prototype, "guildId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'boolean', default: true }),
    __metadata("design:type", Boolean)
], DiscordUserPreference.prototype, "dmEnabled", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'boolean', default: true }),
    __metadata("design:type", Boolean)
], DiscordUserPreference.prototype, "lfgPingOptIn", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'boolean', default: true }),
    __metadata("design:type", Boolean)
], DiscordUserPreference.prototype, "eventReminderOptIn", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'boolean', default: true }),
    __metadata("design:type", Boolean)
], DiscordUserPreference.prototype, "ticketDmOptIn", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'boolean', default: true }),
    __metadata("design:type", Boolean)
], DiscordUserPreference.prototype, "recruitmentDmOptIn", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'boolean', default: true }),
    __metadata("design:type", Boolean)
], DiscordUserPreference.prototype, "moderationAlertOptIn", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'boolean', default: false }),
    __metadata("design:type", Boolean)
], DiscordUserPreference.prototype, "botResponseViaDm", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', nullable: true }),
    __metadata("design:type", String)
], DiscordUserPreference.prototype, "timezone", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], DiscordUserPreference.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], DiscordUserPreference.prototype, "updatedAt", void 0);
exports.DiscordUserPreference = DiscordUserPreference = __decorate([
    (0, typeorm_1.Entity)('discord_user_preferences'),
    (0, typeorm_1.Index)(['userId', 'guildId'], { unique: true })
], DiscordUserPreference);
//# sourceMappingURL=DiscordUserPreference.js.map