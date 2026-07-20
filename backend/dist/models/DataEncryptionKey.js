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
exports.DataEncryptionKey = void 0;
const typeorm_1 = require("typeorm");
const Organization_1 = require("./Organization");
let DataEncryptionKey = class DataEncryptionKey {
    id;
    organizationId;
    organization;
    dekId;
    dataType;
    resourceId;
    algorithm;
    wrappedKeys;
    version;
    isActive;
    createdBy;
    createdAt;
    updatedAt;
    deletedAt;
    hasUserAccess(userId) {
        return userId in this.wrappedKeys;
    }
    getWrappedKeyForUser(userId) {
        return this.wrappedKeys[userId] || null;
    }
    addWrappedKeyForUser(userId, wrappedDEK) {
        this.wrappedKeys = { ...this.wrappedKeys, [userId]: wrappedDEK };
    }
    removeWrappedKeyForUser(userId) {
        const { [userId]: _, ...remaining } = this.wrappedKeys;
        this.wrappedKeys = remaining;
    }
    getUsersWithAccess() {
        return Object.keys(this.wrappedKeys);
    }
};
exports.DataEncryptionKey = DataEncryptionKey;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], DataEncryptionKey.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], DataEncryptionKey.prototype, "organizationId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Organization_1.Organization, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'organizationId' }),
    __metadata("design:type", Organization_1.Organization)
], DataEncryptionKey.prototype, "organization", void 0);
__decorate([
    (0, typeorm_1.Column)({ length: 64, unique: true }),
    __metadata("design:type", String)
], DataEncryptionKey.prototype, "dekId", void 0);
__decorate([
    (0, typeorm_1.Column)({ length: 64 }),
    __metadata("design:type", String)
], DataEncryptionKey.prototype, "dataType", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255, nullable: true }),
    __metadata("design:type", String)
], DataEncryptionKey.prototype, "resourceId", void 0);
__decorate([
    (0, typeorm_1.Column)({ length: 32, default: 'AES-GCM-256' }),
    __metadata("design:type", String)
], DataEncryptionKey.prototype, "algorithm", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb' }),
    __metadata("design:type", Object)
], DataEncryptionKey.prototype, "wrappedKeys", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 1 }),
    __metadata("design:type", Number)
], DataEncryptionKey.prototype, "version", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: true }),
    __metadata("design:type", Boolean)
], DataEncryptionKey.prototype, "isActive", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], DataEncryptionKey.prototype, "createdBy", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], DataEncryptionKey.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], DataEncryptionKey.prototype, "updatedAt", void 0);
__decorate([
    (0, typeorm_1.DeleteDateColumn)({ nullable: true }),
    __metadata("design:type", Object)
], DataEncryptionKey.prototype, "deletedAt", void 0);
exports.DataEncryptionKey = DataEncryptionKey = __decorate([
    (0, typeorm_1.Entity)('data_encryption_keys'),
    (0, typeorm_1.Index)(['organizationId']),
    (0, typeorm_1.Index)(['dekId'], { unique: true }),
    (0, typeorm_1.Index)(['dataType', 'resourceId'])
], DataEncryptionKey);
//# sourceMappingURL=DataEncryptionKey.js.map