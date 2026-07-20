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
exports.OrganizationEncryptionKey = void 0;
const typeorm_1 = require("typeorm");
const Organization_1 = require("./Organization");
let OrganizationEncryptionKey = class OrganizationEncryptionKey {
    id;
    organizationId;
    organization;
    keyId;
    algorithm;
    version;
    keyWrappers;
    recoveryHint;
    requiresRecoveryPhrase;
    createdBy;
    createdAt;
    rotatedAt;
    isActive;
    lastUsedAt;
    usageCount;
    hasUserAccess(userId) {
        return userId in this.keyWrappers;
    }
    getKeyWrapperForUser(userId) {
        return this.keyWrappers[userId] || null;
    }
    addKeyWrapperForUser(userId, wrappedKey) {
        this.keyWrappers = {
            ...this.keyWrappers,
            [userId]: wrappedKey,
        };
    }
    removeKeyWrapperForUser(userId) {
        const { [userId]: _, ...remaining } = this.keyWrappers;
        this.keyWrappers = remaining;
    }
    getUsersWithAccess() {
        return Object.keys(this.keyWrappers);
    }
};
exports.OrganizationEncryptionKey = OrganizationEncryptionKey;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], OrganizationEncryptionKey.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], OrganizationEncryptionKey.prototype, "organizationId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Organization_1.Organization, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'organizationId' }),
    __metadata("design:type", Organization_1.Organization)
], OrganizationEncryptionKey.prototype, "organization", void 0);
__decorate([
    (0, typeorm_1.Column)({ length: 64, unique: true }),
    __metadata("design:type", String)
], OrganizationEncryptionKey.prototype, "keyId", void 0);
__decorate([
    (0, typeorm_1.Column)({ length: 32, default: 'AES-256-GCM' }),
    __metadata("design:type", String)
], OrganizationEncryptionKey.prototype, "algorithm", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 1 }),
    __metadata("design:type", Number)
], OrganizationEncryptionKey.prototype, "version", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb' }),
    __metadata("design:type", Object)
], OrganizationEncryptionKey.prototype, "keyWrappers", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], OrganizationEncryptionKey.prototype, "recoveryHint", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: true }),
    __metadata("design:type", Boolean)
], OrganizationEncryptionKey.prototype, "requiresRecoveryPhrase", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], OrganizationEncryptionKey.prototype, "createdBy", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], OrganizationEncryptionKey.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp', nullable: true }),
    __metadata("design:type", Date)
], OrganizationEncryptionKey.prototype, "rotatedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: true }),
    __metadata("design:type", Boolean)
], OrganizationEncryptionKey.prototype, "isActive", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp', nullable: true }),
    __metadata("design:type", Date)
], OrganizationEncryptionKey.prototype, "lastUsedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 0 }),
    __metadata("design:type", Number)
], OrganizationEncryptionKey.prototype, "usageCount", void 0);
exports.OrganizationEncryptionKey = OrganizationEncryptionKey = __decorate([
    (0, typeorm_1.Entity)('organization_encryption_keys'),
    (0, typeorm_1.Index)(['organizationId']),
    (0, typeorm_1.Index)(['keyId'], { unique: true })
], OrganizationEncryptionKey);
//# sourceMappingURL=OrganizationEncryptionKey.js.map