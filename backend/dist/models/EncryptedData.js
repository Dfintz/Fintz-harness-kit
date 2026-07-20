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
exports.EncryptedData = void 0;
const typeorm_1 = require("typeorm");
const Organization_1 = require("./Organization");
let EncryptedData = class EncryptedData {
    id;
    organizationId;
    organization;
    keyId;
    encryptionMode;
    dekId;
    migrationStatus;
    dataType;
    resourceId;
    encryptedData;
    encryptionMetadata;
    createdBy;
    minSecurityLevel;
    allowedRoles;
    createdAt;
    updatedAt;
    accessedCount;
    lastAccessedAt;
    isDeleted;
    deletedAt;
    deletedBy;
    meetsSecurityLevel(userSecurityLevel) {
        return userSecurityLevel >= this.minSecurityLevel;
    }
    isRoleAllowed(userRole) {
        if (!this.allowedRoles || this.allowedRoles.length === 0) {
            return true;
        }
        return this.allowedRoles.includes(userRole);
    }
    incrementAccessCount() {
        this.accessedCount += 1;
        this.lastAccessedAt = new Date();
    }
    softDelete(deletedBy) {
        this.isDeleted = true;
        this.deletedAt = new Date();
        this.deletedBy = deletedBy;
    }
    restore() {
        this.isDeleted = false;
        this.deletedAt = undefined;
        this.deletedBy = undefined;
    }
};
exports.EncryptedData = EncryptedData;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], EncryptedData.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], EncryptedData.prototype, "organizationId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Organization_1.Organization, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'organizationId' }),
    __metadata("design:type", Organization_1.Organization)
], EncryptedData.prototype, "organization", void 0);
__decorate([
    (0, typeorm_1.Column)({ length: 64 }),
    __metadata("design:type", String)
], EncryptedData.prototype, "keyId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 10, default: 'flat' }),
    __metadata("design:type", String)
], EncryptedData.prototype, "encryptionMode", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 64, nullable: true }),
    __metadata("design:type", String)
], EncryptedData.prototype, "dekId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 10, default: 'none' }),
    __metadata("design:type", String)
], EncryptedData.prototype, "migrationStatus", void 0);
__decorate([
    (0, typeorm_1.Column)({ length: 50 }),
    __metadata("design:type", String)
], EncryptedData.prototype, "dataType", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid', nullable: true }),
    __metadata("design:type", String)
], EncryptedData.prototype, "resourceId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text' }),
    __metadata("design:type", String)
], EncryptedData.prototype, "encryptedData", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb' }),
    __metadata("design:type", Object)
], EncryptedData.prototype, "encryptionMetadata", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], EncryptedData.prototype, "createdBy", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 1 }),
    __metadata("design:type", Number)
], EncryptedData.prototype, "minSecurityLevel", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', array: true, nullable: true }),
    __metadata("design:type", Array)
], EncryptedData.prototype, "allowedRoles", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], EncryptedData.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], EncryptedData.prototype, "updatedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 0 }),
    __metadata("design:type", Number)
], EncryptedData.prototype, "accessedCount", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp', nullable: true }),
    __metadata("design:type", Date)
], EncryptedData.prototype, "lastAccessedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: false }),
    __metadata("design:type", Boolean)
], EncryptedData.prototype, "isDeleted", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp', nullable: true }),
    __metadata("design:type", Date)
], EncryptedData.prototype, "deletedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], EncryptedData.prototype, "deletedBy", void 0);
exports.EncryptedData = EncryptedData = __decorate([
    (0, typeorm_1.Entity)('encrypted_data'),
    (0, typeorm_1.Index)(['organizationId']),
    (0, typeorm_1.Index)(['organizationId', 'dataType']),
    (0, typeorm_1.Index)(['resourceId']),
    (0, typeorm_1.Index)(['keyId']),
    (0, typeorm_1.Index)(['encryptionMode']),
    (0, typeorm_1.Index)(['dekId'])
], EncryptedData);
//# sourceMappingURL=EncryptedData.js.map