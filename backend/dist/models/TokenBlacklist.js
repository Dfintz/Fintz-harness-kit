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
exports.TokenBlacklist = void 0;
const typeorm_1 = require("typeorm");
const dataClassification_1 = require("../utils/dataClassification");
const encryptionTransformer_1 = require("../utils/encryptionTransformer");
let TokenBlacklist = class TokenBlacklist {
    id;
    tokenJti;
    userId;
    expiresAt;
    revokedAt;
    reason;
    ipAddress;
    userAgent;
};
exports.TokenBlacklist = TokenBlacklist;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], TokenBlacklist.prototype, "id", void 0);
__decorate([
    (0, dataClassification_1.Classified)(dataClassification_1.DataClassification.RESTRICTED, { reason: 'JWT identifier for revocation' }),
    (0, typeorm_1.Column)({ unique: true }),
    __metadata("design:type", String)
], TokenBlacklist.prototype, "tokenJti", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], TokenBlacklist.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp' }),
    __metadata("design:type", Date)
], TokenBlacklist.prototype, "expiresAt", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], TokenBlacklist.prototype, "revokedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], TokenBlacklist.prototype, "reason", void 0);
__decorate([
    (0, dataClassification_1.Classified)(dataClassification_1.DataClassification.CONFIDENTIAL, { reason: 'Client IP address' }),
    (0, typeorm_1.Column)({ nullable: true, type: 'text', transformer: encryptionTransformer_1.conditionalEncryptionTransformer }),
    __metadata("design:type", String)
], TokenBlacklist.prototype, "ipAddress", void 0);
__decorate([
    (0, dataClassification_1.Classified)(dataClassification_1.DataClassification.CONFIDENTIAL, { reason: 'Client device info' }),
    (0, typeorm_1.Column)({ nullable: true, type: 'text', transformer: encryptionTransformer_1.conditionalEncryptionTransformer }),
    __metadata("design:type", String)
], TokenBlacklist.prototype, "userAgent", void 0);
exports.TokenBlacklist = TokenBlacklist = __decorate([
    (0, typeorm_1.Entity)('token_blacklist'),
    (0, typeorm_1.Index)(['tokenJti'], { unique: true }),
    (0, typeorm_1.Index)(['userId']),
    (0, typeorm_1.Index)(['expiresAt'])
], TokenBlacklist);
//# sourceMappingURL=TokenBlacklist.js.map