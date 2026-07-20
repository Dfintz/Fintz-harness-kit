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
exports.EncryptionAuditLog = exports.EncryptionEventType = void 0;
const typeorm_1 = require("typeorm");
const Organization_1 = require("./Organization");
var EncryptionEventType;
(function (EncryptionEventType) {
    EncryptionEventType["KEY_GENERATED"] = "key_generated";
    EncryptionEventType["KEY_ROTATED"] = "key_rotated";
    EncryptionEventType["KEY_SHARED"] = "key_shared";
    EncryptionEventType["KEY_REVOKED"] = "key_revoked";
    EncryptionEventType["DATA_ENCRYPTED"] = "data_encrypted";
    EncryptionEventType["DATA_DECRYPTED"] = "data_decrypted";
    EncryptionEventType["DATA_DELETED"] = "data_deleted";
    EncryptionEventType["ENCRYPTION_ENABLED"] = "encryption_enabled";
    EncryptionEventType["ENCRYPTION_DISABLED"] = "encryption_disabled";
    EncryptionEventType["ACCESS_DENIED"] = "access_denied";
    EncryptionEventType["RECOVERY_PHRASE_USED"] = "recovery_phrase_used";
    EncryptionEventType["DATA_REENCRYPTED"] = "data_reencrypted";
})(EncryptionEventType || (exports.EncryptionEventType = EncryptionEventType = {}));
let EncryptionAuditLog = class EncryptionAuditLog {
    id;
    organizationId;
    organization;
    eventType;
    userId;
    message;
    details;
    ipAddress;
    userAgent;
    createdAt;
    static createEntry(organizationId, eventType, userId, message, details, ipAddress, userAgent) {
        return {
            organizationId,
            eventType,
            userId,
            message,
            details,
            ipAddress,
            userAgent,
        };
    }
};
exports.EncryptionAuditLog = EncryptionAuditLog;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], EncryptionAuditLog.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], EncryptionAuditLog.prototype, "organizationId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Organization_1.Organization, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'organizationId' }),
    __metadata("design:type", Organization_1.Organization)
], EncryptionAuditLog.prototype, "organization", void 0);
__decorate([
    (0, typeorm_1.Column)({ length: 50 }),
    __metadata("design:type", String)
], EncryptionAuditLog.prototype, "eventType", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], EncryptionAuditLog.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text' }),
    __metadata("design:type", String)
], EncryptionAuditLog.prototype, "message", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', nullable: true }),
    __metadata("design:type", Object)
], EncryptionAuditLog.prototype, "details", void 0);
__decorate([
    (0, typeorm_1.Column)({ length: 45, nullable: true }),
    __metadata("design:type", String)
], EncryptionAuditLog.prototype, "ipAddress", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], EncryptionAuditLog.prototype, "userAgent", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], EncryptionAuditLog.prototype, "createdAt", void 0);
exports.EncryptionAuditLog = EncryptionAuditLog = __decorate([
    (0, typeorm_1.Entity)('encryption_audit_log'),
    (0, typeorm_1.Index)(['organizationId']),
    (0, typeorm_1.Index)(['eventType']),
    (0, typeorm_1.Index)(['userId']),
    (0, typeorm_1.Index)(['createdAt'])
], EncryptionAuditLog);
//# sourceMappingURL=EncryptionAuditLog.js.map