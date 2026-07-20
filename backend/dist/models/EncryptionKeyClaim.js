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
exports.EncryptionKeyClaim = void 0;
const typeorm_1 = require("typeorm");
const Organization_1 = require("./Organization");
const User_1 = require("./User");
let EncryptionKeyClaim = class EncryptionKeyClaim {
    id;
    organizationId;
    organization;
    keyId;
    encryptedClaim;
    claimMetadata;
    createdBy;
    creator;
    claimedBy;
    claimant;
    label;
    status;
    expiresAt;
    claimedAt;
    createdAt;
    updatedAt;
    get isExpired() {
        return this.status === 'pending' && new Date() > this.expiresAt;
    }
    get isClaimable() {
        return this.status === 'pending' && new Date() <= this.expiresAt;
    }
    markClaimed(userId) {
        this.status = 'claimed';
        this.claimedBy = userId;
        this.claimedAt = new Date();
    }
    markExpired() {
        this.status = 'expired';
    }
    markRevoked() {
        this.status = 'revoked';
    }
};
exports.EncryptionKeyClaim = EncryptionKeyClaim;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], EncryptionKeyClaim.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], EncryptionKeyClaim.prototype, "organizationId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Organization_1.Organization, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'organizationId' }),
    __metadata("design:type", Organization_1.Organization)
], EncryptionKeyClaim.prototype, "organization", void 0);
__decorate([
    (0, typeorm_1.Column)({ length: 64 }),
    __metadata("design:type", String)
], EncryptionKeyClaim.prototype, "keyId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text' }),
    __metadata("design:type", String)
], EncryptionKeyClaim.prototype, "encryptedClaim", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb' }),
    __metadata("design:type", Object)
], EncryptionKeyClaim.prototype, "claimMetadata", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], EncryptionKeyClaim.prototype, "createdBy", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => User_1.User, { onDelete: 'SET NULL', nullable: true }),
    (0, typeorm_1.JoinColumn)({ name: 'createdBy' }),
    __metadata("design:type", User_1.User)
], EncryptionKeyClaim.prototype, "creator", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], EncryptionKeyClaim.prototype, "claimedBy", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => User_1.User, { onDelete: 'SET NULL', nullable: true }),
    (0, typeorm_1.JoinColumn)({ name: 'claimedBy' }),
    __metadata("design:type", User_1.User)
], EncryptionKeyClaim.prototype, "claimant", void 0);
__decorate([
    (0, typeorm_1.Column)({ length: 100, nullable: true }),
    __metadata("design:type", String)
], EncryptionKeyClaim.prototype, "label", void 0);
__decorate([
    (0, typeorm_1.Column)({ length: 20, default: 'pending' }),
    __metadata("design:type", String)
], EncryptionKeyClaim.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp' }),
    __metadata("design:type", Date)
], EncryptionKeyClaim.prototype, "expiresAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp', nullable: true }),
    __metadata("design:type", Date)
], EncryptionKeyClaim.prototype, "claimedAt", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], EncryptionKeyClaim.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], EncryptionKeyClaim.prototype, "updatedAt", void 0);
exports.EncryptionKeyClaim = EncryptionKeyClaim = __decorate([
    (0, typeorm_1.Entity)('encryption_key_claims'),
    (0, typeorm_1.Index)(['organizationId']),
    (0, typeorm_1.Index)(['status', 'expiresAt'])
], EncryptionKeyClaim);
//# sourceMappingURL=EncryptionKeyClaim.js.map