"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FederationAmbassadorService = void 0;
const data_source_1 = require("../../data-source");
const FederationAmbassador_1 = require("../../models/FederationAmbassador");
const FederationMember_1 = require("../../models/FederationMember");
const apiErrors_1 = require("../../utils/apiErrors");
const logger_1 = require("../../utils/logger");
const ORG_ROLE_HIERARCHY = {
    founder: 5,
    leader: 4,
    council: 3,
    member: 2,
    observer: 1,
};
const AMBASSADOR_ROLE_MIN_ORG_LEVEL = {
    council: 3,
    representative: 2,
    observer: 1,
};
const PERMISSION_MIN_ORG_LEVEL = {
    vote: 2,
    announce: 2,
    intel: 3,
    wiki: 2,
    resources: 2,
    hr: 3,
    settings: 4,
    view: 1,
};
class FederationAmbassadorService {
    static instance;
    ambassadorRepository;
    memberRepository;
    constructor() {
        this.ambassadorRepository = data_source_1.AppDataSource.getRepository(FederationAmbassador_1.FederationAmbassador);
        this.memberRepository = data_source_1.AppDataSource.getRepository(FederationMember_1.FederationMember);
    }
    static getInstance() {
        if (!FederationAmbassadorService.instance) {
            FederationAmbassadorService.instance = new FederationAmbassadorService();
        }
        return FederationAmbassadorService.instance;
    }
    toData(entity) {
        return {
            id: entity.id,
            federationId: entity.federationId,
            organizationId: entity.organizationId,
            organizationName: entity.organizationName,
            userId: entity.userId,
            userName: entity.userName,
            role: entity.role,
            permissions: entity.permissions,
            isActive: entity.isActive,
            isExternal: entity.isExternal,
            title: entity.title,
            appointedAt: entity.appointedAt,
        };
    }
    validatePermissionCascade(orgRole, ambassadorRole, permissions) {
        const orgLevel = ORG_ROLE_HIERARCHY[orgRole] ?? 0;
        const requiredLevel = AMBASSADOR_ROLE_MIN_ORG_LEVEL[ambassadorRole];
        if (orgLevel < requiredLevel) {
            return `Organization role '${orgRole}' cannot appoint a '${ambassadorRole}' ambassador`;
        }
        for (const perm of permissions) {
            const permLevel = PERMISSION_MIN_ORG_LEVEL[perm] ?? 1;
            if (orgLevel < permLevel) {
                return `Organization role '${orgRole}' cannot grant '${perm}' permission`;
            }
        }
        return null;
    }
    async listAmbassadors(federationId) {
        const entities = await this.ambassadorRepository.find({
            where: { federationId },
            order: { appointedAt: 'ASC' },
        });
        return entities.map(e => this.toData(e));
    }
    async getAmbassador(federationId, ambassadorId) {
        const entity = await this.ambassadorRepository.findOne({
            where: { id: ambassadorId, federationId },
        });
        return entity ? this.toData(entity) : null;
    }
    async findByUser(federationId, userId) {
        const entity = await this.ambassadorRepository.findOne({
            where: { federationId, userId },
        });
        return entity ? this.toData(entity) : null;
    }
    async appointAmbassador(federationId, actorOrgId, data) {
        const isExternal = data.isExternal ?? false;
        const actorMember = await this.memberRepository.findOne({
            where: { federationId, organizationId: actorOrgId, status: 'active' },
        });
        if (!actorMember) {
            throw new apiErrors_1.ForbiddenError('Your organization is not an active member of this federation');
        }
        const actorLevel = ORG_ROLE_HIERARCHY[actorMember.role] ?? 0;
        if (actorLevel < 4) {
            throw new apiErrors_1.ForbiddenError('Only founder or leader organizations can appoint ambassadors');
        }
        let role;
        let permissions;
        if (isExternal) {
            role = 'observer';
            permissions = ['view'];
        }
        else {
            const targetMember = await this.memberRepository.findOne({
                where: { federationId, organizationId: data.organizationId, status: 'active' },
            });
            if (!targetMember) {
                throw new apiErrors_1.ValidationError('Target organization is not an active member of this federation');
            }
            role = data.role ?? 'representative';
            permissions = data.permissions ?? ['view'];
            const cascadeError = this.validatePermissionCascade(targetMember.role, role, permissions);
            if (cascadeError) {
                throw new apiErrors_1.ValidationError(cascadeError);
            }
        }
        const existing = await this.ambassadorRepository.findOne({
            where: { federationId, userId: data.userId },
        });
        if (existing) {
            throw new apiErrors_1.ConflictError('This user is already an ambassador in this federation');
        }
        const ambassador = this.ambassadorRepository.create({
            federationId,
            organizationId: data.organizationId,
            organizationName: data.organizationName,
            userId: data.userId,
            userName: data.userName,
            role,
            permissions,
            isActive: true,
            isExternal,
            title: data.title ?? null,
        });
        const saved = await this.ambassadorRepository.save(ambassador);
        logger_1.logger.info('Federation ambassador appointed', {
            federationId,
            ambassadorId: saved.id,
            userId: data.userId,
            organizationId: data.organizationId,
            role,
        });
        return this.toData(saved);
    }
    async validateUpdateConstraints(federationId, ambassador, newRole, newPermissions) {
        if (ambassador.isExternal) {
            if (newRole !== 'observer') {
                throw new apiErrors_1.ValidationError('External envoys can only have the observer role');
            }
            if (newPermissions.some(p => p !== 'view')) {
                throw new apiErrors_1.ValidationError('External envoys can only have view permission');
            }
            return;
        }
        const targetMember = await this.memberRepository.findOne({
            where: {
                federationId,
                organizationId: ambassador.organizationId,
                status: 'active',
            },
        });
        if (targetMember) {
            const cascadeError = this.validatePermissionCascade(targetMember.role, newRole, newPermissions);
            if (cascadeError) {
                throw new apiErrors_1.ValidationError(cascadeError);
            }
        }
    }
    async updateAmbassador(federationId, ambassadorId, actorOrgId, updates) {
        const actorMember = await this.memberRepository.findOne({
            where: { federationId, organizationId: actorOrgId, status: 'active' },
        });
        if (!actorMember || (ORG_ROLE_HIERARCHY[actorMember.role] ?? 0) < 4) {
            throw new apiErrors_1.ForbiddenError('Only founder or leader organizations can update ambassadors');
        }
        const ambassador = await this.ambassadorRepository.findOne({
            where: { id: ambassadorId, federationId },
        });
        if (!ambassador) {
            return null;
        }
        const newRole = updates.role ?? ambassador.role;
        const newPermissions = updates.permissions ?? ambassador.permissions;
        await this.validateUpdateConstraints(federationId, ambassador, newRole, newPermissions);
        if (updates.role !== undefined) {
            ambassador.role = updates.role;
        }
        if (updates.permissions !== undefined) {
            ambassador.permissions = updates.permissions;
        }
        if (updates.title !== undefined) {
            ambassador.title = updates.title;
        }
        if (updates.isActive !== undefined) {
            ambassador.isActive = updates.isActive;
        }
        const saved = await this.ambassadorRepository.save(ambassador);
        logger_1.logger.info('Federation ambassador updated', {
            federationId,
            ambassadorId,
            updates: Object.keys(updates),
        });
        return this.toData(saved);
    }
    async removeAmbassador(federationId, ambassadorId, actorOrgId) {
        const actorMember = await this.memberRepository.findOne({
            where: { federationId, organizationId: actorOrgId, status: 'active' },
        });
        if (!actorMember || (ORG_ROLE_HIERARCHY[actorMember.role] ?? 0) < 4) {
            throw new apiErrors_1.ForbiddenError('Only founder or leader organizations can remove ambassadors');
        }
        const ambassador = await this.ambassadorRepository.findOne({
            where: { id: ambassadorId, federationId },
        });
        if (!ambassador) {
            throw new apiErrors_1.NotFoundError('Ambassador', ambassadorId);
        }
        await this.ambassadorRepository.remove(ambassador);
        logger_1.logger.info('Federation ambassador removed', {
            federationId,
            ambassadorId,
            userId: ambassador.userId,
        });
    }
    async getMyAmbassadorProfile(federationId, userId) {
        return this.findByUser(federationId, userId);
    }
    async hasPermission(federationId, userId, permission) {
        const ambassador = await this.ambassadorRepository.findOne({
            where: { federationId, userId, isActive: true },
        });
        if (!ambassador) {
            return false;
        }
        if (permission === 'view') {
            return true;
        }
        return ambassador.permissions.includes(permission);
    }
    async getOrgAmbassadors(federationId, organizationId) {
        const entities = await this.ambassadorRepository.find({
            where: { federationId, organizationId },
            order: { appointedAt: 'ASC' },
        });
        return entities.map(e => this.toData(e));
    }
}
exports.FederationAmbassadorService = FederationAmbassadorService;
//# sourceMappingURL=FederationAmbassadorService.js.map