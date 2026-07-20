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
exports.TunnelMessage = void 0;
const typeorm_1 = require("typeorm");
const Tunnel_1 = require("./Tunnel");
let TunnelMessage = class TunnelMessage {
    id;
    tunnelId;
    tunnel;
    authorId;
    authorName;
    authorAvatar;
    sourceGuildId;
    sourceChannelId;
    discordMessageId;
    content;
    attachments;
    embeds;
    stickerIds;
    replyToMessageId;
    isBot;
    wasBlocked;
    blockReason;
    isEdited;
    editedAt;
    createdAt;
};
exports.TunnelMessage = TunnelMessage;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], TunnelMessage.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    (0, typeorm_1.Index)('IDX_tunnel_message_tunnel'),
    __metadata("design:type", String)
], TunnelMessage.prototype, "tunnelId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Tunnel_1.Tunnel, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'tunnelId' }),
    __metadata("design:type", Tunnel_1.Tunnel)
], TunnelMessage.prototype, "tunnel", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], TunnelMessage.prototype, "authorId", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], TunnelMessage.prototype, "authorName", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], TunnelMessage.prototype, "authorAvatar", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], TunnelMessage.prototype, "sourceGuildId", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], TunnelMessage.prototype, "sourceChannelId", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    (0, typeorm_1.Index)('IDX_tunnel_message_discord_id'),
    __metadata("design:type", String)
], TunnelMessage.prototype, "discordMessageId", void 0);
__decorate([
    (0, typeorm_1.Column)('text', { nullable: true }),
    __metadata("design:type", String)
], TunnelMessage.prototype, "content", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-json', { nullable: true }),
    __metadata("design:type", Array)
], TunnelMessage.prototype, "attachments", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-json', { nullable: true }),
    __metadata("design:type", Array)
], TunnelMessage.prototype, "embeds", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-json', { nullable: true }),
    __metadata("design:type", Array)
], TunnelMessage.prototype, "stickerIds", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], TunnelMessage.prototype, "replyToMessageId", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: false }),
    __metadata("design:type", Boolean)
], TunnelMessage.prototype, "isBot", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: false }),
    __metadata("design:type", Boolean)
], TunnelMessage.prototype, "wasBlocked", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], TunnelMessage.prototype, "blockReason", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: false }),
    __metadata("design:type", Boolean)
], TunnelMessage.prototype, "isEdited", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp', nullable: true }),
    __metadata("design:type", Date)
], TunnelMessage.prototype, "editedAt", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], TunnelMessage.prototype, "createdAt", void 0);
exports.TunnelMessage = TunnelMessage = __decorate([
    (0, typeorm_1.Entity)('tunnel_messages'),
    (0, typeorm_1.Index)('IDX_tunnel_message_tunnel_timestamp', ['tunnelId', 'createdAt'])
], TunnelMessage);
//# sourceMappingURL=TunnelMessage.js.map