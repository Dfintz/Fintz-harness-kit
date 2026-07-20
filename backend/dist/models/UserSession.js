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
exports.UserSession = void 0;
const typeorm_1 = require("typeorm");
const dataClassification_1 = require("../utils/dataClassification");
const encryptionTransformer_1 = require("../utils/encryptionTransformer");
const User_1 = require("./User");
let UserSession = class UserSession {
    id;
    userId;
    user;
    sessionToken;
    discordAccessToken;
    discordRefreshToken;
    discordTokenExpiry;
    isActive;
    createdAt;
    lastActivity;
    expiresAt;
    ipAddress;
    userAgent;
};
exports.UserSession = UserSession;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], UserSession.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    (0, typeorm_1.Index)(),
    __metadata("design:type", Number)
], UserSession.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => User_1.User, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'userId' }),
    __metadata("design:type", User_1.User)
], UserSession.prototype, "user", void 0);
__decorate([
    (0, dataClassification_1.Classified)(dataClassification_1.DataClassification.RESTRICTED, { reason: 'Session identifier' }),
    (0, typeorm_1.Column)({ unique: true }),
    __metadata("design:type", String)
], UserSession.prototype, "sessionToken", void 0);
__decorate([
    (0, dataClassification_1.Classified)(dataClassification_1.DataClassification.RESTRICTED, { reason: 'OAuth access token' }),
    (0, typeorm_1.Column)({
        type: 'text',
        transformer: encryptionTransformer_1.conditionalEncryptionTransformer,
    }),
    __metadata("design:type", String)
], UserSession.prototype, "discordAccessToken", void 0);
__decorate([
    (0, dataClassification_1.Classified)(dataClassification_1.DataClassification.RESTRICTED, { reason: 'OAuth refresh token' }),
    (0, typeorm_1.Column)({
        type: 'text',
        transformer: encryptionTransformer_1.conditionalEncryptionTransformer,
    }),
    __metadata("design:type", String)
], UserSession.prototype, "discordRefreshToken", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", Date)
], UserSession.prototype, "discordTokenExpiry", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: true }),
    __metadata("design:type", Boolean)
], UserSession.prototype, "isActive", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], UserSession.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", Date)
], UserSession.prototype, "lastActivity", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", Date)
], UserSession.prototype, "expiresAt", void 0);
__decorate([
    (0, dataClassification_1.Classified)(dataClassification_1.DataClassification.CONFIDENTIAL, { reason: 'Client IP address' }),
    (0, typeorm_1.Column)({ nullable: true, type: 'text', transformer: encryptionTransformer_1.conditionalEncryptionTransformer }),
    __metadata("design:type", String)
], UserSession.prototype, "ipAddress", void 0);
__decorate([
    (0, dataClassification_1.Classified)(dataClassification_1.DataClassification.CONFIDENTIAL, { reason: 'Client device info' }),
    (0, typeorm_1.Column)({ nullable: true, type: 'text', transformer: encryptionTransformer_1.conditionalEncryptionTransformer }),
    __metadata("design:type", String)
], UserSession.prototype, "userAgent", void 0);
exports.UserSession = UserSession = __decorate([
    (0, typeorm_1.Entity)('user_sessions'),
    (0, typeorm_1.Index)(['userId', 'isActive']),
    (0, typeorm_1.Index)(['sessionToken']),
    (0, typeorm_1.Index)(['expiresAt'])
], UserSession);
//# sourceMappingURL=UserSession.js.map