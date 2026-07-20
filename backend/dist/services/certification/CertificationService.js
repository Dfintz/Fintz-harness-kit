"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CertificationService = void 0;
const database_1 = require("../../config/database");
const Certification_1 = require("../../models/Certification");
const UserCertification_1 = require("../../models/UserCertification");
const apiErrors_1 = require("../../utils/apiErrors");
const auditLogger_1 = require("../../utils/auditLogger");
class CertificationService {
    certRepository = database_1.AppDataSource.getRepository(Certification_1.Certification);
    userCertRepository = database_1.AppDataSource.getRepository(UserCertification_1.UserCertification);
    async listCertifications(organizationId, filters) {
        const qb = this.certRepository
            .createQueryBuilder('cert')
            .where('cert.organizationId = :organizationId', { organizationId })
            .orderBy('cert.name', 'ASC');
        if (filters?.search) {
            qb.andWhere('cert.name ILIKE :search', { search: `%${filters.search}%` });
        }
        qb.take(filters?.limit ?? 50);
        return qb.getMany();
    }
    async getCertification(organizationId, certId) {
        return this.certRepository.findOne({
            where: { id: certId, organizationId },
        });
    }
    async createCertification(organizationId, userId, data) {
        const existing = await this.certRepository.findOne({
            where: { organizationId, name: data.name },
        });
        if (existing) {
            throw new apiErrors_1.ConflictError('A certification with this name already exists');
        }
        const cert = this.certRepository.create({
            ...data,
            organizationId,
            createdBy: userId,
        });
        return this.certRepository.save(cert);
    }
    async updateCertification(organizationId, certId, data) {
        const cert = await this.certRepository.findOne({
            where: { id: certId, organizationId },
        });
        if (!cert) {
            throw new apiErrors_1.NotFoundError('Certification');
        }
        if (data.name && data.name !== cert.name) {
            const duplicate = await this.certRepository.findOne({
                where: { organizationId, name: data.name },
            });
            if (duplicate) {
                throw new apiErrors_1.ConflictError('A certification with this name already exists');
            }
        }
        Object.assign(cert, data);
        return this.certRepository.save(cert);
    }
    async deleteCertification(organizationId, certId) {
        const cert = await this.certRepository.findOne({
            where: { id: certId, organizationId },
        });
        if (!cert) {
            throw new apiErrors_1.NotFoundError('Certification');
        }
        await this.userCertRepository.delete({ certificationId: certId });
        await this.certRepository.remove(cert);
    }
    async awardCertification(organizationId, awarderId, certId, userId) {
        const cert = await this.certRepository.findOne({
            where: { id: certId, organizationId },
        });
        if (!cert) {
            throw new apiErrors_1.NotFoundError('Certification');
        }
        const existing = await this.userCertRepository.findOne({
            where: { organizationId, userId, certificationId: certId },
        });
        if (existing?.status === UserCertification_1.CertificationStatus.ACTIVE) {
            throw new apiErrors_1.ConflictError('User already holds this certification');
        }
        if (existing) {
            existing.status = UserCertification_1.CertificationStatus.ACTIVE;
            existing.awardedBy = awarderId;
            existing.awardedAt = new Date();
            existing.revokedBy = undefined;
            existing.revokedAt = undefined;
            existing.revokeReason = undefined;
            return this.userCertRepository.save(existing);
        }
        const userCert = this.userCertRepository.create({
            organizationId,
            userId,
            certificationId: certId,
            awardedBy: awarderId,
            awardedAt: new Date(),
        });
        const saved = await this.userCertRepository.save(userCert);
        (0, auditLogger_1.logAuditEvent)({
            eventType: auditLogger_1.AuditEventType.ACTIVITY_ACTION,
            userId: awarderId,
            resource: 'certification',
            action: 'award',
            message: `Certification '${cert.name}' awarded to user ${userId} by ${awarderId} in org ${organizationId}`,
            metadata: {
                organizationId,
                certId,
                certName: cert.name,
                awardedTo: userId,
                awardedBy: awarderId,
            },
        });
        return saved;
    }
    async revokeCertification(organizationId, revokerId, certId, userId, reason) {
        const userCert = await this.userCertRepository.findOne({
            where: {
                organizationId,
                userId,
                certificationId: certId,
                status: UserCertification_1.CertificationStatus.ACTIVE,
            },
        });
        if (!userCert) {
            throw new apiErrors_1.NotFoundError('Active certification for this user');
        }
        userCert.status = UserCertification_1.CertificationStatus.REVOKED;
        userCert.revokedBy = revokerId;
        userCert.revokedAt = new Date();
        userCert.revokeReason = reason;
        const saved = await this.userCertRepository.save(userCert);
        (0, auditLogger_1.logAuditEvent)({
            eventType: auditLogger_1.AuditEventType.ACTIVITY_ACTION,
            userId: revokerId,
            resource: 'certification',
            action: 'revoke',
            message: `Certification revoked for user ${userId} by ${revokerId} in org ${organizationId}: ${reason}`,
            metadata: { organizationId, certId, revokedFrom: userId, revokedBy: revokerId, reason },
        });
        return saved;
    }
    async getUserCertifications(organizationId, userId) {
        return this.userCertRepository.find({
            where: { organizationId, userId },
            relations: ['certification'],
            order: { awardedAt: 'DESC' },
        });
    }
    async getCertificationHolders(organizationId, certId) {
        return this.userCertRepository.find({
            where: {
                organizationId,
                certificationId: certId,
                status: UserCertification_1.CertificationStatus.ACTIVE,
            },
            order: { awardedAt: 'DESC' },
        });
    }
}
exports.CertificationService = CertificationService;
//# sourceMappingURL=CertificationService.js.map