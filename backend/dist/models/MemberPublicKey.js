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
exports.MemberPublicKey = void 0;
const typeorm_1 = require("typeorm");
const Organization_1 = require("./Organization");
let MemberPublicKey = class MemberPublicKey {
    id;
    organizationId;
    organization;
    userId;
    publicKey;
    keyFingerprint;
    keySize;
    algorithm;
    isActive;
    createdAt;
    updatedAt;
    lastUsedAt;
};
exports.MemberPublicKey = MemberPublicKey;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], MemberPublicKey.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], MemberPublicKey.prototype, "organizationId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Organization_1.Organization, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'organizationId' }),
    __metadata("design:type", Organization_1.Organization)
], MemberPublicKey.prototype, "organization", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], MemberPublicKey.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text' }),
    __metadata("design:type", String)
], MemberPublicKey.prototype, "publicKey", void 0);
__decorate([
    (0, typeorm_1.Column)({ length: 64 }),
    __metadata("design:type", String)
], MemberPublicKey.prototype, "keyFingerprint", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 4096 }),
    __metadata("design:type", Number)
], MemberPublicKey.prototype, "keySize", void 0);
__decorate([
    (0, typeorm_1.Column)({ length: 32, default: 'RSA-OAEP-SHA256' }),
    __metadata("design:type", String)
], MemberPublicKey.prototype, "algorithm", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: true }),
    __metadata("design:type", Boolean)
], MemberPublicKey.prototype, "isActive", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], MemberPublicKey.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], MemberPublicKey.prototype, "updatedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp', nullable: true }),
    __metadata("design:type", Date)
], MemberPublicKey.prototype, "lastUsedAt", void 0);
exports.MemberPublicKey = MemberPublicKey = __decorate([
    (0, typeorm_1.Entity)('member_public_keys'),
    (0, typeorm_1.Index)(['organizationId', 'userId'], { unique: true }),
    (0, typeorm_1.Index)(['keyFingerprint'], { unique: true })
], MemberPublicKey);
//# sourceMappingURL=MemberPublicKey.js.map