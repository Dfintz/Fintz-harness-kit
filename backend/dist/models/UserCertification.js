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
exports.UserCertification = exports.CertificationStatus = void 0;
const typeorm_1 = require("typeorm");
const Certification_1 = require("./Certification");
var CertificationStatus;
(function (CertificationStatus) {
    CertificationStatus["ACTIVE"] = "active";
    CertificationStatus["REVOKED"] = "revoked";
    CertificationStatus["EXPIRED"] = "expired";
})(CertificationStatus || (exports.CertificationStatus = CertificationStatus = {}));
let UserCertification = class UserCertification {
    id;
    organizationId;
    userId;
    certificationId;
    certification;
    status;
    awardedBy;
    awardedAt;
    revokedBy;
    revokedAt;
    revokeReason;
    createdAt;
    updatedAt;
};
exports.UserCertification = UserCertification;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], UserCertification.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid' }),
    __metadata("design:type", String)
], UserCertification.prototype, "organizationId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar' }),
    __metadata("design:type", String)
], UserCertification.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid' }),
    __metadata("design:type", String)
], UserCertification.prototype, "certificationId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Certification_1.Certification, c => c.holders, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'certificationId' }),
    __metadata("design:type", Certification_1.Certification)
], UserCertification.prototype, "certification", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 20, default: CertificationStatus.ACTIVE }),
    __metadata("design:type", String)
], UserCertification.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar' }),
    __metadata("design:type", String)
], UserCertification.prototype, "awardedBy", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp' }),
    __metadata("design:type", Date)
], UserCertification.prototype, "awardedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', nullable: true }),
    __metadata("design:type", String)
], UserCertification.prototype, "revokedBy", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp', nullable: true }),
    __metadata("design:type", Date)
], UserCertification.prototype, "revokedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], UserCertification.prototype, "revokeReason", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], UserCertification.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], UserCertification.prototype, "updatedAt", void 0);
exports.UserCertification = UserCertification = __decorate([
    (0, typeorm_1.Entity)('user_certifications'),
    (0, typeorm_1.Index)(['organizationId', 'userId', 'certificationId'], { unique: true }),
    (0, typeorm_1.Index)(['organizationId', 'userId']),
    (0, typeorm_1.Index)(['certificationId'])
], UserCertification);
//# sourceMappingURL=UserCertification.js.map