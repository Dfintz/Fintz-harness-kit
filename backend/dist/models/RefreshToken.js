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
exports.RefreshToken = void 0;
const typeorm_1 = require("typeorm");
const dataClassification_1 = require("../utils/dataClassification");
const encryptionTransformer_1 = require("../utils/encryptionTransformer");
let RefreshToken = class RefreshToken {
    id;
    userId;
    tokenHash;
    expiresAt;
    revoked;
    revokedAt;
    replacedByToken;
    ipAddress;
    userAgent;
    tokenEncrypted;
    encryptionIv;
    encryptionAuthTag;
    familyId;
    parentTokenId;
    lastUsedAt;
    location;
    createdAt;
    updatedAt;
};
exports.RefreshToken = RefreshToken;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], RefreshToken.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], RefreshToken.prototype, "userId", void 0);
__decorate([
    (0, dataClassification_1.Classified)(dataClassification_1.DataClassification.RESTRICTED, { reason: 'Hashed authentication token' }),
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], RefreshToken.prototype, "tokenHash", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp' }),
    __metadata("design:type", Date)
], RefreshToken.prototype, "expiresAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: false }),
    __metadata("design:type", Boolean)
], RefreshToken.prototype, "revoked", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp', nullable: true }),
    __metadata("design:type", Date)
], RefreshToken.prototype, "revokedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], RefreshToken.prototype, "replacedByToken", void 0);
__decorate([
    (0, dataClassification_1.Classified)(dataClassification_1.DataClassification.CONFIDENTIAL, { reason: 'Client IP address' }),
    (0, typeorm_1.Column)({ nullable: true, type: 'text', transformer: encryptionTransformer_1.conditionalEncryptionTransformer }),
    __metadata("design:type", String)
], RefreshToken.prototype, "ipAddress", void 0);
__decorate([
    (0, dataClassification_1.Classified)(dataClassification_1.DataClassification.CONFIDENTIAL, { reason: 'Client device info' }),
    (0, typeorm_1.Column)({ nullable: true, type: 'text', transformer: encryptionTransformer_1.conditionalEncryptionTransformer }),
    __metadata("design:type", String)
], RefreshToken.prototype, "userAgent", void 0);
__decorate([
    (0, dataClassification_1.Classified)(dataClassification_1.DataClassification.RESTRICTED, { reason: 'Encrypted authentication token' }),
    (0, typeorm_1.Column)({ nullable: true, length: 512 }),
    __metadata("design:type", String)
], RefreshToken.prototype, "tokenEncrypted", void 0);
__decorate([
    (0, dataClassification_1.Classified)(dataClassification_1.DataClassification.RESTRICTED, { reason: 'Encryption initialization vector' }),
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], RefreshToken.prototype, "encryptionIv", void 0);
__decorate([
    (0, dataClassification_1.Classified)(dataClassification_1.DataClassification.RESTRICTED, { reason: 'Encryption auth tag' }),
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], RefreshToken.prototype, "encryptionAuthTag", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    (0, typeorm_1.Index)(),
    __metadata("design:type", String)
], RefreshToken.prototype, "familyId", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], RefreshToken.prototype, "parentTokenId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp', nullable: true }),
    __metadata("design:type", Date)
], RefreshToken.prototype, "lastUsedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], RefreshToken.prototype, "location", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], RefreshToken.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], RefreshToken.prototype, "updatedAt", void 0);
exports.RefreshToken = RefreshToken = __decorate([
    (0, typeorm_1.Entity)('refresh_tokens')
], RefreshToken);
//# sourceMappingURL=RefreshToken.js.map