"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IntelOfficerService = void 0;
const uuid_1 = require("uuid");
const data_source_1 = require("../../data-source");
const IntelAuditLog_1 = require("../../models/IntelAuditLog");
const IntelOfficer_1 = require("../../models/IntelOfficer");
const OrganizationMembership_1 = require("../../models/OrganizationMembership");
const apiErrors_1 = require("../../utils/apiErrors");
const logger_1 = require("../../utils/logger");
const roleUtils_1 = require("../../utils/roleUtils");
class IntelOfficerService {
    intelOfficerRepo;
    auditLogRepo;
    userOrgRepo;
    constructor() {
        this.intelOfficerRepo = data_source_1.AppDataSource.getRepository(IntelOfficer_1.IntelOfficer);
        this.auditLogRepo = data_source_1.AppDataSource.getRepository(IntelAuditLog_1.IntelAuditLog);
        this.userOrgRepo = data_source_1.AppDataSource.getRepository(OrganizationMembership_1.OrganizationMembership);
    }
    async canManageOfficers(userId, organizationId) {
        try {
            const userOrg = await this.userOrgRepo.findOne({
                where: { userId, organizationId, isActive: true },
            });
            return (0, roleUtils_1.getRoleName)(userOrg?.role) === 'owner' || (0, roleUtils_1.getRoleName)(userOrg?.role) === 'founder';
        }
        catch (error) {
            logger_1.logger.error('Error checking officer management permission:', error);
            return false;
        }
    }
    async appointOfficer(input, appointedBy, ipAddress, userAgent) {
        try {
            const canManage = await this.canManageOfficers(appointedBy, input.organizationId);
            if (!canManage) {
                throw new apiErrors_1.ForbiddenError('Only organization owner can appoint Intel officers');
            }
            const targetUserOrg = await this.userOrgRepo.findOne({
                where: {
                    userId: input.userId,
                    organizationId: input.organizationId,
                    isActive: true,
                },
                relations: ['user'],
            });
            if (!targetUserOrg) {
                throw new apiErrors_1.ValidationError('Target user is not a member of this organization');
            }
            const existing = await this.intelOfficerRepo.findOne({
                where: {
                    userId: input.userId,
                    organizationId: input.organizationId,
                },
            });
            if (existing) {
                if (existing.isActive) {
                    throw new apiErrors_1.ConflictError('User is already an active Intel officer');
                }
                existing.isActive = true;
                existing.rank = input.rank;
                existing.accessLevel = input.accessLevel;
                existing.specializations = input.specializations?.join(',');
                existing.notes = input.notes;
                existing.appointedBy = appointedBy;
                existing.revokedBy = undefined;
                existing.revokedAt = undefined;
                const updated = await this.intelOfficerRepo.save(existing);
                await this.logAudit({
                    organizationId: input.organizationId,
                    userId: appointedBy,
                    action: IntelAuditLog_1.IntelAuditAction.OFFICER_APPOINTED,
                    description: `Reappointed ${targetUserOrg.user?.username ?? targetUserOrg.userId} as Intel officer`,
                    ipAddress,
                    userAgent,
                    severity: 'info',
                    metadata: {
                        officerId: existing.id,
                        targetUserId: input.userId,
                        rank: input.rank,
                        accessLevel: input.accessLevel,
                    },
                });
                return updated;
            }
            await this.validateRankLimitations(input.organizationId, input.rank);
            const officer = this.intelOfficerRepo.create({
                id: (0, uuid_1.v4)(),
                organizationId: input.organizationId,
                userId: input.userId,
                rank: input.rank,
                accessLevel: input.accessLevel,
                specializations: input.specializations?.join(','),
                notes: input.notes,
                appointedBy,
                isActive: true,
            });
            const saved = await this.intelOfficerRepo.save(officer);
            await this.logAudit({
                organizationId: input.organizationId,
                userId: appointedBy,
                action: IntelAuditLog_1.IntelAuditAction.OFFICER_APPOINTED,
                description: `Appointed ${targetUserOrg.user?.username ?? input.userId} as Intel officer`,
                ipAddress,
                userAgent,
                severity: 'info',
                metadata: {
                    officerId: saved.id,
                    targetUserId: input.userId,
                    rank: input.rank,
                    accessLevel: input.accessLevel,
                },
            });
            logger_1.logger.info('Intel officer appointed', {
                officerId: saved.id,
                organizationId: input.organizationId,
                userId: input.userId,
                rank: input.rank,
            });
            return saved;
        }
        catch (error) {
            logger_1.logger.error('Error appointing Intel officer:', error);
            throw error;
        }
    }
    async validateRankLimitations(organizationId, rank) {
        if (rank === IntelOfficer_1.IntelOfficerRank.CHIEF) {
            const existingChief = await this.intelOfficerRepo.findOne({
                where: {
                    organizationId,
                    rank: IntelOfficer_1.IntelOfficerRank.CHIEF,
                    isActive: true,
                },
            });
            if (existingChief) {
                throw new apiErrors_1.ConflictError('Organization can only have one Chief Intel officer');
            }
        }
    }
    async updateOfficer(officerId, userId, organizationId, input, ipAddress, userAgent) {
        try {
            const officer = await this.intelOfficerRepo.findOne({
                where: { id: officerId, organizationId },
                relations: ['user'],
            });
            if (!officer) {
                throw new apiErrors_1.NotFoundError('Intel officer');
            }
            const canManage = await this.canManageOfficers(userId, organizationId);
            if (!canManage) {
                throw new apiErrors_1.ForbiddenError('Only organization owner can update Intel officers');
            }
            if (input.rank && input.rank !== officer.rank) {
                await this.validateRankLimitations(organizationId, input.rank);
            }
            const oldValues = {};
            const newValues = {};
            let action = IntelAuditLog_1.IntelAuditAction.OFFICER_ACCESS_CHANGED;
            for (const [key, value] of Object.entries(input)) {
                if (value !== undefined && officer[key] !== value) {
                    oldValues[key] = officer[key];
                    newValues[key] = value;
                    if (key === 'rank') {
                        const oldRankValue = getRankValue(officer.rank);
                        const newRankValue = getRankValue(value);
                        action =
                            newRankValue > oldRankValue
                                ? IntelAuditLog_1.IntelAuditAction.OFFICER_PROMOTED
                                : IntelAuditLog_1.IntelAuditAction.OFFICER_DEMOTED;
                    }
                }
            }
            if (input.specializations) {
                officer.specializations = input.specializations.join(',');
            }
            Object.assign(officer, {
                rank: input.rank,
                accessLevel: input.accessLevel,
                notes: input.notes,
                isActive: input.isActive,
            });
            const updated = await this.intelOfficerRepo.save(officer);
            await this.logAudit({
                organizationId,
                userId,
                action,
                description: `Updated Intel officer ${officer.user?.username ?? officer.userId}`,
                ipAddress,
                userAgent,
                severity: 'info',
                metadata: {
                    officerId,
                    changes: Object.keys(newValues),
                    oldValues,
                    newValues,
                },
            });
            logger_1.logger.info('Intel officer updated', {
                officerId,
                organizationId,
                changes: Object.keys(newValues),
            });
            return updated;
        }
        catch (error) {
            logger_1.logger.error('Error updating Intel officer:', error);
            throw error;
        }
    }
    async removeOfficer(officerId, userId, organizationId, reason, ipAddress, userAgent) {
        try {
            const officer = await this.intelOfficerRepo.findOne({
                where: { id: officerId, organizationId },
                relations: ['user'],
            });
            if (!officer) {
                throw new apiErrors_1.NotFoundError('Intel officer');
            }
            const canManage = await this.canManageOfficers(userId, organizationId);
            if (!canManage) {
                throw new apiErrors_1.ForbiddenError('Only organization owner can remove Intel officers');
            }
            officer.isActive = false;
            officer.revokedBy = userId;
            officer.revokedAt = new Date();
            if (reason) {
                const prefix = officer.notes ? `${officer.notes}\n` : '';
                officer.notes = `${prefix}Revoked: ${reason}`;
            }
            await this.intelOfficerRepo.save(officer);
            await this.logAudit({
                organizationId,
                userId,
                action: IntelAuditLog_1.IntelAuditAction.OFFICER_REMOVED,
                description: `Removed Intel officer ${officer.user?.username ?? officer.userId}`,
                ipAddress,
                userAgent,
                severity: 'warning',
                metadata: {
                    officerId,
                    targetUserId: officer.userId,
                    reason,
                },
            });
            logger_1.logger.info('Intel officer removed', {
                officerId,
                organizationId,
                targetUserId: officer.userId,
            });
        }
        catch (error) {
            logger_1.logger.error('Error removing Intel officer:', error);
            throw error;
        }
    }
    async getOfficers(organizationId, userId, options = {}) {
        try {
            const userOrg = await this.userOrgRepo.findOne({
                where: { userId, organizationId },
            });
            const isOwner = (0, roleUtils_1.getRoleName)(userOrg?.role) === 'owner' || (0, roleUtils_1.getRoleName)(userOrg?.role) === 'founder';
            const isOfficer = await this.intelOfficerRepo.findOne({
                where: { userId, organizationId, isActive: true },
            });
            if (!isOwner && !isOfficer) {
                throw new apiErrors_1.ForbiddenError('User does not have access to view Intel officers');
            }
            const queryBuilder = this.intelOfficerRepo
                .createQueryBuilder('officer')
                .leftJoin('officer.user', 'user')
                .addSelect(['user.id', 'user.username'])
                .where('officer.organizationId = :organizationId', { organizationId });
            if (!options.includeInactive) {
                queryBuilder.andWhere('officer.isActive = :isActive', { isActive: true });
            }
            if (options.rank) {
                queryBuilder.andWhere('officer.rank = :rank', { rank: options.rank });
            }
            queryBuilder.orderBy('officer.appointedAt', 'ASC');
            return await queryBuilder.getMany();
        }
        catch (error) {
            logger_1.logger.error('Error getting Intel officers:', error);
            throw error;
        }
    }
    async getOfficer(officerId, userId, organizationId) {
        try {
            const officer = await this.intelOfficerRepo.findOne({
                where: { id: officerId, organizationId },
            });
            if (!officer) {
                throw new apiErrors_1.NotFoundError('Intel officer');
            }
            const userOrg = await this.userOrgRepo.findOne({
                where: { userId, organizationId },
            });
            const isOwner = (0, roleUtils_1.getRoleName)(userOrg?.role) === 'owner' || (0, roleUtils_1.getRoleName)(userOrg?.role) === 'founder';
            const isOfficer = await this.intelOfficerRepo.findOne({
                where: { userId, organizationId, isActive: true },
            });
            if (!isOwner && !isOfficer) {
                throw new apiErrors_1.ForbiddenError('User does not have access to view Intel officers');
            }
            return officer;
        }
        catch (error) {
            logger_1.logger.error('Error getting Intel officer:', error);
            throw error;
        }
    }
    async logAudit(data) {
        try {
            const auditLog = this.auditLogRepo.create({
                id: (0, uuid_1.v4)(),
                ...data,
                severity: data.severity || 'info',
            });
            await this.auditLogRepo.save(auditLog);
        }
        catch (error) {
            logger_1.logger.error('Error logging Intel audit:', error);
        }
    }
}
exports.IntelOfficerService = IntelOfficerService;
function getRankValue(rank) {
    const rankValues = {
        [IntelOfficer_1.IntelOfficerRank.JUNIOR]: 1,
        [IntelOfficer_1.IntelOfficerRank.OFFICER]: 2,
        [IntelOfficer_1.IntelOfficerRank.SENIOR]: 3,
        [IntelOfficer_1.IntelOfficerRank.LEAD]: 4,
        [IntelOfficer_1.IntelOfficerRank.CHIEF]: 5,
    };
    return rankValues[rank] || 0;
}
//# sourceMappingURL=IntelOfficerService.js.map