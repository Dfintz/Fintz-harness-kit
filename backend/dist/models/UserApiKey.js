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
exports.UserApiKey = void 0;
const typeorm_1 = require("typeorm");
const dataClassification_1 = require("../utils/dataClassification");
const encryptionTransformer_1 = require("../utils/encryptionTransformer");
let UserApiKey = class UserApiKey {
    id;
    userId;
    name;
    prefix;
    tokenHash;
    scopes;
    expiresAt;
    revoked;
    revokedAt;
    lastUsedAt;
    lastUsedIp;
    createdByIp;
    createdAt;
    updatedAt;
    isValid() {
        if (this.revoked) {
            return false;
        }
        if (this.expiresAt && this.expiresAt < new Date()) {
            return false;
        }
        return true;
    }
    hasScope(scope) {
        return this.scopes.includes(scope) || this.scopes.includes('*');
    }
};
exports.UserApiKey = UserApiKey;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], UserApiKey.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], UserApiKey.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.Column)({ length: 100 }),
    __metadata("design:type", String)
], UserApiKey.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)({ length: 16 }),
    __metadata("design:type", String)
], UserApiKey.prototype, "prefix", void 0);
__decorate([
    (0, dataClassification_1.Classified)(dataClassification_1.DataClassification.RESTRICTED, { reason: 'Hashed API key' }),
    (0, typeorm_1.Column)({ length: 64 }),
    __metadata("design:type", String)
], UserApiKey.prototype, "tokenHash", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-json'),
    __metadata("design:type", Array)
], UserApiKey.prototype, "scopes", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp', nullable: true }),
    __metadata("design:type", Date)
], UserApiKey.prototype, "expiresAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: false }),
    __metadata("design:type", Boolean)
], UserApiKey.prototype, "revoked", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp', nullable: true }),
    __metadata("design:type", Date)
], UserApiKey.prototype, "revokedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp', nullable: true }),
    __metadata("design:type", Date)
], UserApiKey.prototype, "lastUsedAt", void 0);
__decorate([
    (0, dataClassification_1.Classified)(dataClassification_1.DataClassification.CONFIDENTIAL, { reason: 'Client IP address' }),
    (0, typeorm_1.Column)({ nullable: true, type: 'text', transformer: encryptionTransformer_1.conditionalEncryptionTransformer }),
    __metadata("design:type", String)
], UserApiKey.prototype, "lastUsedIp", void 0);
__decorate([
    (0, dataClassification_1.Classified)(dataClassification_1.DataClassification.CONFIDENTIAL, { reason: 'Client IP at creation' }),
    (0, typeorm_1.Column)({ nullable: true, type: 'text', transformer: encryptionTransformer_1.conditionalEncryptionTransformer }),
    __metadata("design:type", String)
], UserApiKey.prototype, "createdByIp", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], UserApiKey.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], UserApiKey.prototype, "updatedAt", void 0);
exports.UserApiKey = UserApiKey = __decorate([
    (0, typeorm_1.Entity)('user_api_keys'),
    (0, typeorm_1.Index)('IDX_user_api_keys_user', ['userId']),
    (0, typeorm_1.Index)('IDX_user_api_keys_hash', ['tokenHash'], { unique: true })
], UserApiKey);
//# sourceMappingURL=UserApiKey.js.map