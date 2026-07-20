"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrganizationFederationService = void 0;
const typeorm_1 = require("typeorm");
const uuid_1 = require("uuid");
const data_source_1 = require("../../data-source");
const AllianceDiplomacy_1 = require("../../models/AllianceDiplomacy");
const Federation_1 = require("../../models/Federation");
const FederationAmbassador_1 = require("../../models/FederationAmbassador");
const FederationMember_1 = require("../../models/FederationMember");
const FederationProposal_1 = require("../../models/FederationProposal");
const Fleet_1 = require("../../models/Fleet");
const FleetShip_1 = require("../../models/FleetShip");
const Organization_1 = require("../../models/Organization");
const OrganizationMembership_1 = require("../../models/OrganizationMembership");
const OrganizationRelationship_1 = require("../../models/OrganizationRelationship");
const PublicOrgProfile_1 = require("../../models/PublicOrgProfile");
const Team_1 = require("../../models/Team");
const User_1 = require("../../models/User");
const apiErrors_1 = require("../../utils/apiErrors");
const logger_1 = require("../../utils/logger");
const slugify_1 = require("../../utils/slugify");
const notificationWebSocketController_1 = require("../../websocket/controllers/notificationWebSocketController");
const NotificationService_1 = require("../communication/notifications/NotificationService");
class OrganizationFederationService {
    static instance;
    organizationRepository;
    relationshipRepository;
    diplomacyRepository;
    profileRepository;
    federationRepository;
    memberRepository;
    proposalRepository;
    constructor() {
        this.organizationRepository = data_source_1.AppDataSource.getRepository(Organization_1.Organization);
        this.relationshipRepository = data_source_1.AppDataSource.getRepository(OrganizationRelationship_1.OrganizationRelationship);
        this.diplomacyRepository = data_source_1.AppDataSource.getRepository(AllianceDiplomacy_1.AllianceDiplomacy);
        this.profileRepository = data_source_1.AppDataSource.getRepository(PublicOrgProfile_1.PublicOrgProfile);
        this.federationRepository = data_source_1.AppDataSource.getRepository(Federation_1.Federation);
        this.memberRepository = data_source_1.AppDataSource.getRepository(FederationMember_1.FederationMember);
        this.proposalRepository = data_source_1.AppDataSource.getRepository(FederationProposal_1.FederationProposal);
    }
    static getInstance() {
        if (!OrganizationFederationService.instance) {
            OrganizationFederationService.instance = new OrganizationFederationService();
        }
        return OrganizationFederationService.instance;
    }
    toFederationConfig(entity) {
        return {
            id: entity.id,
            name: entity.name,
            description: entity.description,
            founderId: entity.founderId,
            founderOrgId: entity.founderOrgId,
            createdAt: entity.createdAt,
            updatedAt: entity.updatedAt,
            governance: entity.governance,
            members: (entity.members ?? []).map(m => this.toMemberData(m)),
            sharedResources: entity.sharedResources ?? [],
            treaties: entity.treaties ?? [],
            status: entity.status,
            isPublic: entity.isPublic,
            tags: entity.tags ?? [],
            logoUrl: entity.logoUrl,
            bannerUrl: entity.bannerUrl,
            discordUrl: entity.discordUrl,
            websiteUrl: entity.websiteUrl,
            reviewDate: entity.reviewDate ?? null,
            expiryDate: entity.expiryDate ?? null,
            autoRenew: entity.autoRenew ?? false,
            settings: entity.settings ?? {},
        };
    }
    toMemberData(entity) {
        return {
            id: entity.id,
            organizationId: entity.organizationId,
            organizationName: entity.organizationName,
            role: entity.role,
            joinedAt: entity.joinedAt,
            status: entity.status,
            associationType: entity.associationType ?? 'full_member',
            votingPower: entity.votingPower,
            contributions: entity.contributions,
        };
    }
    async notifyOrgLeaders(organizationId, notification) {
        const membershipRepo = data_source_1.AppDataSource.getRepository(OrganizationMembership_1.OrganizationMembership);
        const leaderMemberships = await membershipRepo.find({
            where: [
                { organizationId, role: { name: 'owner' }, isActive: true },
                { organizationId, role: { name: 'admin' }, isActive: true },
            ],
            relations: ['role'],
        });
        if (leaderMemberships.length === 0) {
            return;
        }
        const notificationService = new NotificationService_1.NotificationService(undefined, undefined);
        await Promise.all(leaderMemberships.map(membership => notificationService.create({
            userId: membership.userId,
            type: notification.type,
            title: notification.title,
            message: notification.message,
            data: notification.data,
            priority: 'high',
        })));
    }
    toProposalData(entity) {
        return {
            id: entity.id,
            federationId: entity.federationId,
            type: entity.type,
            title: entity.title,
            description: entity.description,
            proposedBy: entity.proposedBy,
            proposedByOrg: entity.proposedByOrg,
            createdAt: entity.createdAt,
            votingEndsAt: entity.votingEndsAt,
            votes: entity.votes ?? [],
            status: entity.status,
            requiredApproval: entity.requiredApproval,
            metadata: entity.metadata,
        };
    }
    async loadFederation(federationId) {
        return this.federationRepository.findOne({
            where: { id: federationId },
            relations: ['members'],
        });
    }
    async loadFederationMetadataOnly(federationId) {
        return this.federationRepository.findOne({
            where: { id: federationId },
        });
    }
    async findMember(federationId, organizationId) {
        return this.memberRepository.findOne({
            where: { federationId, organizationId },
        });
    }
    async createFederation(founderId, founderOrgId, founderOrgName, data) {
        let resolvedOrgName = founderOrgName;
        if (!resolvedOrgName) {
            const org = await this.organizationRepository.findOne({
                where: { id: founderOrgId },
                select: ['name'],
            });
            resolvedOrgName = org?.name ?? 'Unknown Organization';
        }
        const trimmedName = data.name.trim();
        const existingFederation = await this.federationRepository
            .createQueryBuilder('federation')
            .where('LOWER(federation.name) = LOWER(:name)', { name: trimmedName })
            .andWhere('federation.status != :dissolved', { dissolved: 'dissolved' })
            .getOne();
        if (existingFederation) {
            throw new apiErrors_1.ConflictError(`An alliance named "${trimmedName}" already exists`);
        }
        const defaultGovernance = {
            votingSystem: 'majority',
            requiredApprovalThreshold: 51,
            councilSize: 5,
            leaderTermDays: 90,
            amendmentThreshold: 67,
            successionMode: 'fixed',
            ...data.governance,
        };
        const queryRunner = data_source_1.AppDataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();
        let savedFederationId;
        try {
            const founderUser = await queryRunner.manager.findOne(User_1.User, {
                where: { id: founderId },
                select: ['id', 'username', 'displayName'],
            });
            const founderName = founderUser?.displayName ?? founderUser?.username ?? 'Founder';
            const now = new Date();
            const termEndDate = defaultGovernance.successionMode === 'fixed'
                ? null
                : new Date(now.getTime() + defaultGovernance.leaderTermDays * 24 * 60 * 60 * 1000).toISOString();
            defaultGovernance.chairman = {
                organizationId: founderOrgId,
                organizationName: resolvedOrgName,
                userId: founderId,
                userName: founderName,
                termStart: now.toISOString(),
                termEnd: termEndDate,
            };
            defaultGovernance.rotationOrder = [founderOrgId];
            const federation = queryRunner.manager.create(Federation_1.Federation, {
                name: trimmedName,
                description: data.description,
                founderId,
                founderOrgId,
                governance: defaultGovernance,
                sharedResources: [],
                treaties: [],
                status: 'forming',
                isPublic: data.isPublic ?? false,
                tags: data.tags ?? [],
            });
            const savedFederation = await queryRunner.manager.save(Federation_1.Federation, federation);
            savedFederationId = savedFederation.id;
            const founderMember = queryRunner.manager.create(FederationMember_1.FederationMember, {
                federationId: savedFederation.id,
                organizationId: founderOrgId,
                organizationName: resolvedOrgName,
                role: 'founder',
                status: 'active',
                votingPower: 1,
                contributions: 0,
            });
            await queryRunner.manager.save(FederationMember_1.FederationMember, founderMember);
            const founderAmbassador = queryRunner.manager.create(FederationAmbassador_1.FederationAmbassador, {
                federationId: savedFederation.id,
                organizationId: founderOrgId,
                organizationName: resolvedOrgName,
                userId: founderId,
                userName: founderName,
                role: 'council',
                permissions: ['view', 'vote', 'announce', 'intel', 'wiki', 'resources', 'hr', 'settings'],
                isActive: true,
                title: 'Founder',
            });
            await queryRunner.manager.save(FederationAmbassador_1.FederationAmbassador, founderAmbassador);
            await queryRunner.commitTransaction();
        }
        catch (error) {
            await queryRunner.rollbackTransaction();
            throw error;
        }
        finally {
            await queryRunner.release();
        }
        const loaded = await this.loadFederation(savedFederationId);
        if (!loaded) {
            throw new Error(`Federation ${savedFederationId} not found after creation`);
        }
        logger_1.logger.info(`Created federation: ${data.name}`, {
            federationId: savedFederationId,
            founderOrgId,
        });
        return this.toFederationConfig(loaded);
    }
    async getFederation(federationId) {
        const entity = await this.loadFederation(federationId);
        return entity ? this.toFederationConfig(entity) : null;
    }
    async resolveBySlug(slug) {
        const { isUUID } = await Promise.resolve().then(() => __importStar(require('../../utils/slugify')));
        let federation;
        if (isUUID(slug)) {
            federation = await this.federationRepository.findOne({
                where: { id: slug },
                select: ['id', 'name'],
            });
        }
        else {
            federation =
                (await this.federationRepository
                    .createQueryBuilder('federation')
                    .select(['federation.id', 'federation.name'])
                    .where('federation.status IN (:...statuses)', { statuses: ['active', 'forming'] })
                    .andWhere(String.raw `LOWER(TRIM(BOTH '-' FROM REGEXP_REPLACE(REGEXP_REPLACE(REGEXP_REPLACE(TRIM(federation.name), '[^a-zA-Z0-9\s-]', '', 'g'), '[\s-]+', '-', 'g'), '-+', '-', 'g'))) = LOWER(:slug)`, { slug })
                    .getOne()) ?? null;
        }
        return federation ? { id: federation.id, name: federation.name } : null;
    }
    async disbandFederation(federationId, actorOrgId) {
        const federation = await this.loadFederationMetadataOnly(federationId);
        if (!federation) {
            throw new apiErrors_1.NotFoundError('Federation');
        }
        const actor = await this.findMember(federationId, actorOrgId);
        if (actor?.role !== 'founder') {
            throw new apiErrors_1.ForbiddenError('Only the founder can disband the alliance');
        }
        if (federation.status === 'dissolved') {
            throw new apiErrors_1.ConflictError('Federation is already dissolved');
        }
        await this.memberRepository.delete({ federationId });
        federation.status = 'dissolved';
        await this.federationRepository.save(federation);
        logger_1.logger.info('Federation disbanded', { federationId, actorOrgId });
    }
    async getOrganizationFederations(organizationId) {
        const memberships = await this.memberRepository.find({
            where: { organizationId },
            select: ['federationId'],
        });
        if (memberships.length === 0) {
            return [];
        }
        const federationIds = memberships.map(m => m.federationId);
        const federations = await this.federationRepository
            .createQueryBuilder('federation')
            .leftJoinAndSelect('federation.members', 'member')
            .where('federation.id IN (:...ids)', { ids: federationIds })
            .getMany();
        return federations.map(f => this.toFederationConfig(f));
    }
    async searchFederations(filters) {
        const qb = this.federationRepository
            .createQueryBuilder('federation')
            .leftJoinAndSelect('federation.members', 'member')
            .where('federation.isPublic = :isPublic', { isPublic: true })
            .andWhere('federation.status != :dissolved', { dissolved: 'dissolved' });
        if (filters?.name) {
            qb.andWhere('(LOWER(federation.name) LIKE :search OR LOWER(federation.description) LIKE :search)', { search: `%${filters.name.toLowerCase()}%` });
        }
        if (filters?.tags && filters.tags.length > 0) {
            qb.andWhere('federation.tags ?| ARRAY[:...tags]', { tags: filters.tags });
        }
        let results = await qb.getMany();
        if (filters?.minMembers !== undefined) {
            const minMembers = filters.minMembers;
            results = results.filter(f => (f.members ?? []).length >= minMembers);
        }
        if (filters?.maxMembers !== undefined) {
            const maxMembers = filters.maxMembers;
            results = results.filter(f => (f.members ?? []).length <= maxMembers);
        }
        return results.map(f => this.toFederationConfig(f));
    }
    async updateFederation(federationId, actorOrgId, updates) {
        const federation = await this.loadFederation(federationId);
        if (!federation) {
            return null;
        }
        const actorMember = (federation.members ?? []).find(m => m.organizationId === actorOrgId);
        if (!actorMember || !['founder', 'leader', 'council'].includes(actorMember.role)) {
            throw new apiErrors_1.ForbiddenError('Insufficient permissions to update federation');
        }
        if (updates.name) {
            await this.validateUniqueName(updates.name.trim(), federationId);
            federation.name = updates.name.trim();
        }
        if (updates.description) {
            federation.description = updates.description;
        }
        if (updates.isPublic !== undefined) {
            federation.isPublic = updates.isPublic;
        }
        if (updates.tags) {
            federation.tags = updates.tags;
        }
        if (updates.governance !== undefined) {
            this.validateGovernanceUpdate(federation);
            federation.governance = updates.governance;
        }
        this.applyOptionalFields(federation, updates);
        await this.federationRepository.save(federation);
        logger_1.logger.info(`Updated federation: ${federation.name}`, { federationId, actorOrgId });
        return this.toFederationConfig(federation);
    }
    async validateUniqueName(name, excludeId) {
        const existing = await this.federationRepository
            .createQueryBuilder('federation')
            .where('LOWER(federation.name) = LOWER(:name)', { name })
            .andWhere('federation.id != :id', { id: excludeId })
            .andWhere('federation.status != :dissolved', { dissolved: 'dissolved' })
            .getOne();
        if (existing) {
            throw new apiErrors_1.ConflictError(`An alliance named "${name}" already exists`);
        }
    }
    validateGovernanceUpdate(federation) {
        const activeMembers = (federation.members ?? []).filter(m => m.status === 'active');
        if (activeMembers.length > 1) {
            throw new apiErrors_1.ValidationError('Governance changes require a proposal when the alliance has multiple members. Use the "Propose Amendment" flow instead.');
        }
    }
    applyOptionalFields(federation, updates) {
        if (updates.logoUrl !== undefined) {
            federation.logoUrl = updates.logoUrl;
        }
        if (updates.bannerUrl !== undefined) {
            federation.bannerUrl = updates.bannerUrl;
        }
        if (updates.discordUrl !== undefined) {
            federation.discordUrl = updates.discordUrl;
        }
        if (updates.websiteUrl !== undefined) {
            federation.websiteUrl = updates.websiteUrl;
        }
        if (updates.reviewDate !== undefined) {
            federation.reviewDate = updates.reviewDate ? new Date(updates.reviewDate) : null;
        }
        if (updates.expiryDate !== undefined) {
            federation.expiryDate = updates.expiryDate ? new Date(updates.expiryDate) : null;
        }
        if (updates.autoRenew !== undefined) {
            federation.autoRenew = updates.autoRenew;
        }
    }
    async activateFederation(federationId, actorOrgId) {
        const federation = await this.loadFederation(federationId);
        if (!federation) {
            return null;
        }
        const actorMember = (federation.members ?? []).find(m => m.organizationId === actorOrgId);
        if (actorMember?.role !== 'founder') {
            throw new apiErrors_1.ForbiddenError('Only founder can activate federation');
        }
        if ((federation.members ?? []).filter(m => m.status === 'active').length < 2) {
            throw new apiErrors_1.ValidationError('Federation requires at least 2 active members to activate');
        }
        federation.status = 'active';
        await this.federationRepository.save(federation);
        logger_1.logger.info(`Activated federation: ${federation.name}`, { federationId });
        return this.toFederationConfig(federation);
    }
    async inviteMember(federationId, inviterOrgId, targetOrgId, targetOrgName, role = 'member', associationType = 'full_member') {
        const federation = await this.loadFederationMetadataOnly(federationId);
        if (!federation) {
            throw new apiErrors_1.NotFoundError('Federation');
        }
        const inviter = await this.findMember(federationId, inviterOrgId);
        if (!inviter || !['founder', 'leader', 'council'].includes(inviter.role)) {
            throw new apiErrors_1.ForbiddenError('Insufficient permissions to invite members');
        }
        const existing = await this.findMember(federationId, targetOrgId);
        if (existing) {
            throw new apiErrors_1.ConflictError('Organization is already a member of this federation');
        }
        const newMember = this.memberRepository.create({
            federationId,
            organizationId: targetOrgId,
            organizationName: targetOrgName,
            role: role === 'founder' ? 'member' : role,
            status: 'pending',
            associationType,
            votingPower: role === 'observer' ? 0 : 1,
            contributions: 0,
        });
        const saved = await this.memberRepository.save(newMember);
        logger_1.logger.info(`Invited organization to federation`, {
            federationId,
            targetOrgId,
            inviterOrgId,
        });
        this.notifyOrgLeaders(targetOrgId, {
            type: 'federation_invitation',
            title: 'Alliance Invitation',
            message: `Your organization has been invited to join the alliance "${federation.name}".`,
            data: { federationId, federationName: federation.name, inviterOrgId },
        }).catch((err) => logger_1.logger.warn('Failed to send federation invitation notifications', { error: err }));
        (0, notificationWebSocketController_1.sendOrganizationNotification)(targetOrgId, {
            type: 'info',
            title: 'Alliance Invitation',
            message: `Your organization has been invited to join the alliance "${federation.name}".`,
            category: 'organization',
            data: { federationId, federationName: federation.name },
        });
        return this.toMemberData(saved);
    }
    async acceptInvitation(federationId, organizationId) {
        const federation = await this.loadFederation(federationId);
        if (!federation) {
            throw new apiErrors_1.NotFoundError('Federation');
        }
        const memberEntity = await this.memberRepository.findOne({
            where: { federationId, organizationId },
        });
        if (!memberEntity) {
            throw new apiErrors_1.NotFoundError('Pending invitation');
        }
        if (memberEntity.status !== 'pending') {
            throw new apiErrors_1.ConflictError('Invitation has already been processed');
        }
        memberEntity.status = 'active';
        memberEntity.joinedAt = new Date();
        await this.memberRepository.save(memberEntity);
        await this.createMemberRelationships(federation, organizationId);
        const rotationOrder = federation.governance?.rotationOrder ?? [];
        if (!rotationOrder.includes(organizationId)) {
            rotationOrder.push(organizationId);
            federation.governance = {
                ...federation.governance,
                rotationOrder,
            };
            await this.federationRepository.save(federation);
        }
        logger_1.logger.info(`Organization joined federation`, { federationId, organizationId });
        const leaderMembers = (federation.members ?? []).filter(m => ['founder', 'leader'].includes(m.role) && m.organizationId !== organizationId);
        for (const leader of leaderMembers) {
            this.notifyOrgLeaders(leader.organizationId, {
                type: 'federation_accepted',
                title: 'Alliance Invitation Accepted',
                message: `${memberEntity.organizationName} has joined the alliance "${federation.name}".`,
                data: { federationId, federationName: federation.name, joinedOrgId: organizationId },
            }).catch((err) => logger_1.logger.warn('Failed to send federation accepted notification', { error: err }));
            (0, notificationWebSocketController_1.sendOrganizationNotification)(leader.organizationId, {
                type: 'success',
                title: 'Alliance Invitation Accepted',
                message: `${memberEntity.organizationName} has joined the alliance "${federation.name}".`,
                category: 'organization',
                data: { federationId, federationName: federation.name },
            });
        }
        try {
            const { FederationRoleSyncService } = await Promise.resolve().then(() => __importStar(require('../federation/FederationRoleSyncService')));
            await FederationRoleSyncService.getInstance().onOrgJoined(federationId, organizationId, memberEntity.organizationName);
        }
        catch (err) {
            logger_1.logger.warn('Federation Discord role sync (org joined) failed — non-fatal', {
                error: err instanceof Error ? err.message : String(err),
            });
        }
        return this.toMemberData(memberEntity);
    }
    async removeMember(federationId, actorOrgId, targetOrgId, reason) {
        const federation = await this.loadFederationMetadataOnly(federationId);
        if (!federation) {
            throw new apiErrors_1.NotFoundError('Federation');
        }
        const actor = await this.findMember(federationId, actorOrgId);
        const target = actorOrgId === targetOrgId ? actor : await this.findMember(federationId, targetOrgId);
        if (!target) {
            throw new apiErrors_1.ForbiddenError('Target organization is not a member');
        }
        if (target.role === 'founder') {
            throw new apiErrors_1.ForbiddenError('Cannot remove the federation founder');
        }
        const isSelfRemoval = actorOrgId === targetOrgId;
        if (!isSelfRemoval) {
            if (!actor || !['founder', 'leader'].includes(actor.role)) {
                throw new apiErrors_1.ForbiddenError('Insufficient permissions to remove members');
            }
        }
        await this.memberRepository.delete({
            federationId,
            organizationId: targetOrgId,
        });
        const rotationOrder = federation.governance?.rotationOrder ?? [];
        const updatedRotation = rotationOrder.filter(id => id !== targetOrgId);
        if (updatedRotation.length !== rotationOrder.length) {
            federation.governance = {
                ...federation.governance,
                rotationOrder: updatedRotation,
            };
            await this.federationRepository.save(federation);
        }
        logger_1.logger.info(`Removed organization from federation`, {
            federationId,
            targetOrgId,
            reason,
        });
        try {
            const { FederationRoleSyncService } = await Promise.resolve().then(() => __importStar(require('../federation/FederationRoleSyncService')));
            await FederationRoleSyncService.getInstance().onOrgLeft(federationId, targetOrgId);
        }
        catch (err) {
            logger_1.logger.warn('Federation Discord role sync (org left) failed — non-fatal', {
                error: err instanceof Error ? err.message : String(err),
            });
        }
    }
    async updateMemberRole(federationId, actorOrgId, targetOrgId, newRole) {
        const federation = await this.loadFederationMetadataOnly(federationId);
        if (!federation) {
            throw new apiErrors_1.NotFoundError('Federation');
        }
        const actor = await this.findMember(federationId, actorOrgId);
        if (!actor || !['founder', 'leader'].includes(actor.role)) {
            throw new apiErrors_1.ForbiddenError('Insufficient permissions to update roles');
        }
        const targetEntity = await this.memberRepository.findOne({
            where: { federationId, organizationId: targetOrgId },
        });
        if (!targetEntity) {
            throw new apiErrors_1.ForbiddenError('Target organization is not a member');
        }
        if (targetEntity.role === 'founder' || newRole === 'founder') {
            throw new apiErrors_1.ForbiddenError('Cannot modify founder role');
        }
        targetEntity.role = newRole;
        targetEntity.votingPower = newRole === 'observer' ? 0 : 1;
        await this.memberRepository.save(targetEntity);
        logger_1.logger.info(`Updated member role in federation`, {
            federationId,
            targetOrgId,
            newRole,
        });
        return this.toMemberData(targetEntity);
    }
    async updateSuccessionMode(federationId, actorOrgId, mode, leaderTermDays) {
        const federation = await this.loadFederationMetadataOnly(federationId);
        if (!federation) {
            throw new apiErrors_1.NotFoundError('Federation');
        }
        const actor = await this.findMember(federationId, actorOrgId);
        if (!actor || !['founder', 'leader'].includes(actor.role)) {
            throw new apiErrors_1.ForbiddenError('Only founders and leaders can change the succession mode');
        }
        const governance = { ...federation.governance };
        governance.successionMode = mode;
        if (leaderTermDays !== undefined && leaderTermDays > 0) {
            governance.leaderTermDays = leaderTermDays;
        }
        if (governance.chairman) {
            if (mode === 'fixed') {
                governance.chairman = { ...governance.chairman, termEnd: null };
            }
            else {
                const termStart = new Date(governance.chairman.termStart);
                const termEnd = new Date(termStart.getTime() + governance.leaderTermDays * 24 * 60 * 60 * 1000);
                governance.chairman = {
                    ...governance.chairman,
                    termEnd: termEnd.toISOString(),
                };
            }
        }
        federation.governance = governance;
        await this.federationRepository.save(federation);
        logger_1.logger.info('Updated federation succession mode', {
            federationId,
            mode,
            leaderTermDays: governance.leaderTermDays,
        });
        return governance;
    }
    async succeedChairman(federationId, actorOrgId) {
        const federation = await this.loadFederation(federationId);
        if (!federation) {
            throw new apiErrors_1.NotFoundError('Federation');
        }
        const governance = federation.governance;
        const mode = governance.successionMode ?? 'fixed';
        if (mode === 'fixed') {
            throw new apiErrors_1.ValidationError('Succession is disabled for this federation (mode: fixed)');
        }
        const currentChairOrgId = governance.chairman?.organizationId;
        if (actorOrgId !== currentChairOrgId && actorOrgId !== federation.founderOrgId) {
            throw new apiErrors_1.ForbiddenError('Only the current chairman or founder can trigger succession');
        }
        const activeMembers = (federation.members ?? []).filter(m => m.status === 'active');
        if (activeMembers.length <= 1) {
            throw new apiErrors_1.ValidationError('Cannot rotate: only one active member');
        }
        if (mode === 'rotation') {
            return this.rotateChairman(federation);
        }
        return this.startChairmanElection(federation, actorOrgId);
    }
    async rotateChairman(federation) {
        const governance = { ...federation.governance };
        const rotationOrder = governance.rotationOrder ?? [];
        const activeOrgIds = new Set((federation.members ?? []).filter(m => m.status === 'active').map(m => m.organizationId));
        const eligibleOrder = rotationOrder.filter(id => activeOrgIds.has(id));
        if (eligibleOrder.length <= 1) {
            throw new apiErrors_1.ValidationError('Not enough eligible organizations for rotation');
        }
        const currentIdx = eligibleOrder.indexOf(governance.chairman?.organizationId ?? '');
        const nextIdx = (currentIdx + 1) % eligibleOrder.length;
        const nextOrgId = eligibleOrder[nextIdx];
        const nextMember = (federation.members ?? []).find(m => m.organizationId === nextOrgId);
        if (!nextMember) {
            throw new apiErrors_1.NotFoundError('Next organization in rotation');
        }
        const now = new Date();
        const termEnd = new Date(now.getTime() + governance.leaderTermDays * 24 * 60 * 60 * 1000);
        const ambassadorRepo = data_source_1.AppDataSource.getRepository(FederationAmbassador_1.FederationAmbassador);
        const ambassador = await ambassadorRepo.findOne({
            where: {
                federationId: federation.id,
                organizationId: nextOrgId,
                isActive: true,
            },
        });
        governance.chairman = {
            organizationId: nextOrgId,
            organizationName: nextMember.organizationName,
            userId: ambassador?.userId ?? '',
            userName: ambassador?.userName ?? nextMember.organizationName,
            termStart: now.toISOString(),
            termEnd: termEnd.toISOString(),
        };
        federation.governance = governance;
        await this.federationRepository.save(federation);
        logger_1.logger.info('Federation chairman rotated', {
            federationId: federation.id,
            newChairmanOrg: nextOrgId,
            termEnd: termEnd.toISOString(),
        });
        return governance;
    }
    async startChairmanElection(federation, actorOrgId) {
        const activeMembers = (federation.members ?? []).filter(m => m.status === 'active');
        const candidateNames = activeMembers.map(m => m.organizationName).join(', ');
        const actorMember = activeMembers.find(m => m.organizationId === actorOrgId);
        await this.createProposal(federation.id, actorOrgId, actorMember?.organizationName ?? 'Unknown', {
            type: 'amend_governance',
            title: 'Chairman Election',
            description: `Vote for the next federation chairman. Eligible candidates: ${candidateNames}. Vote "approve" to confirm the rotation to the next org in line, or "reject" to keep the current chairman.`,
            votingDurationDays: federation.governance.leaderTermDays > 7 ? 7 : 3,
        });
        logger_1.logger.info('Chairman election proposal created', {
            federationId: federation.id,
            candidates: activeMembers.length,
        });
        return federation.governance;
    }
    async createProposal(federationId, proposerOrgId, proposerName, data) {
        const federation = await this.loadFederationMetadataOnly(federationId);
        if (!federation) {
            throw new apiErrors_1.NotFoundError('Federation');
        }
        const proposer = await this.findMember(federationId, proposerOrgId);
        if (proposer?.status !== 'active') {
            throw new apiErrors_1.ForbiddenError('Only active members can create proposals');
        }
        if (proposer.role === 'observer') {
            throw new apiErrors_1.ForbiddenError('Observers cannot create proposals');
        }
        const votingDurationDays = data.votingDurationDays ?? 7;
        const votingEndsAt = new Date();
        votingEndsAt.setDate(votingEndsAt.getDate() + votingDurationDays);
        const governance = federation.governance;
        let requiredApproval = governance.requiredApprovalThreshold;
        if (data.type === 'amend_governance' || data.type === 'dissolve') {
            requiredApproval = Math.max(requiredApproval, governance.amendmentThreshold);
        }
        const proposalEntity = this.proposalRepository.create({
            federationId,
            type: data.type,
            title: data.title,
            description: data.description,
            proposedBy: proposerName,
            proposedByOrg: proposerOrgId,
            votingEndsAt,
            votes: [],
            status: 'open',
            requiredApproval,
            metadata: data.metadata,
        });
        const saved = await this.proposalRepository.save(proposalEntity);
        logger_1.logger.info(`Created federation proposal`, {
            federationId,
            proposalId: saved.id,
            type: data.type,
        });
        return this.toProposalData(saved);
    }
    async castVote(proposalId, organizationId, organizationName, voterId, vote, comment) {
        const proposalEntity = await this.proposalRepository.findOne({
            where: { id: proposalId },
        });
        if (!proposalEntity) {
            throw new apiErrors_1.NotFoundError('Proposal');
        }
        if (proposalEntity.status !== 'open') {
            throw new apiErrors_1.ConflictError('Voting is closed for this proposal');
        }
        if (new Date() > proposalEntity.votingEndsAt) {
            proposalEntity.status = 'expired';
            await this.proposalRepository.save(proposalEntity);
            throw new apiErrors_1.ConflictError('Voting period has ended');
        }
        const federation = await this.loadFederation(proposalEntity.federationId);
        if (!federation) {
            throw new apiErrors_1.NotFoundError('Federation');
        }
        const member = (federation.members ?? []).find(m => m.organizationId === organizationId);
        if (member?.status !== 'active' || member.votingPower === 0) {
            throw new apiErrors_1.ForbiddenError('Organization cannot vote on this proposal');
        }
        const votes = proposalEntity.votes ?? [];
        const existingVote = votes.find(v => v.organizationId === organizationId);
        if (existingVote) {
            throw new apiErrors_1.ConflictError('Organization has already voted');
        }
        const federationVote = {
            organizationId,
            organizationName,
            vote,
            votedBy: voterId,
            votedAt: new Date().toISOString(),
            weight: member.votingPower,
            comment,
        };
        votes.push(federationVote);
        proposalEntity.votes = votes;
        await this.checkAndResolveProposal(proposalEntity, federation);
        await this.proposalRepository.save(proposalEntity);
        logger_1.logger.info(`Cast vote on proposal`, {
            proposalId,
            organizationId,
            vote,
        });
        return this.toProposalData(proposalEntity);
    }
    async getProposal(proposalId) {
        const entity = await this.proposalRepository.findOne({
            where: { id: proposalId },
        });
        return entity ? this.toProposalData(entity) : null;
    }
    async getFederationProposals(federationId, status) {
        const where = { federationId };
        if (status) {
            where.status = status;
        }
        const entities = await this.proposalRepository.find({ where: where });
        return entities.map(e => this.toProposalData(e));
    }
    async addSharedResource(federationId, providerOrgId, resource) {
        const federation = await this.loadFederationMetadataOnly(federationId);
        if (!federation) {
            throw new apiErrors_1.NotFoundError('Federation');
        }
        const providerMember = await this.memberRepository.findOne({
            where: { federationId, organizationId: providerOrgId },
        });
        if (providerMember?.status !== 'active') {
            throw new apiErrors_1.ForbiddenError('Organization is not an active member');
        }
        const sharedResource = {
            id: (0, uuid_1.v4)(),
            ...resource,
            providedBy: providerOrgId,
        };
        const resources = federation.sharedResources ?? [];
        resources.push(sharedResource);
        federation.sharedResources = resources;
        await this.federationRepository.save(federation);
        providerMember.contributions++;
        await this.memberRepository.save(providerMember);
        logger_1.logger.info(`Added shared resource to federation`, {
            federationId,
            resourceId: sharedResource.id,
            type: resource.type,
        });
        return sharedResource;
    }
    async removeSharedResource(federationId, resourceId, actorOrgId) {
        const federation = await this.loadFederationMetadataOnly(federationId);
        if (!federation) {
            throw new apiErrors_1.NotFoundError('Federation');
        }
        const resources = federation.sharedResources ?? [];
        const resource = resources.find(r => r.id === resourceId);
        if (!resource) {
            throw new apiErrors_1.NotFoundError('Resource');
        }
        const actor = await this.findMember(federationId, actorOrgId);
        if (resource.providedBy !== actorOrgId &&
            (!actor || !['founder', 'leader'].includes(actor.role))) {
            throw new apiErrors_1.ForbiddenError('Insufficient permissions to remove resource');
        }
        federation.sharedResources = resources.filter(r => r.id !== resourceId);
        await this.federationRepository.save(federation);
        logger_1.logger.info(`Removed shared resource from federation`, { federationId, resourceId });
    }
    async createTreaty(federationId, creatorOrgId, treaty) {
        const federation = await this.loadFederationMetadataOnly(federationId);
        if (!federation) {
            throw new apiErrors_1.NotFoundError('Federation');
        }
        const creator = await this.findMember(federationId, creatorOrgId);
        if (!creator || !['founder', 'leader', 'council'].includes(creator.role)) {
            throw new apiErrors_1.ForbiddenError('Insufficient permissions to create treaties');
        }
        const activeMembers = (federation.members ?? []).filter(m => m.status === 'active');
        const signatures = activeMembers.map(m => ({
            organizationId: m.organizationId,
            organizationName: m.organizationName ?? m.organizationId,
            status: m.organizationId === creatorOrgId ? 'signed' : 'pending',
            ...(m.organizationId === creatorOrgId ? { respondedAt: new Date().toISOString() } : {}),
        }));
        const creatorMember = activeMembers.find(m => m.organizationId === creatorOrgId);
        const newTreaty = {
            id: (0, uuid_1.v4)(),
            name: treaty.name,
            type: treaty.type,
            terms: treaty.terms,
            signatories: [creatorOrgId],
            effectiveDate: treaty.effectiveDate ?? new Date().toISOString(),
            ...(treaty.expirationDate ? { expirationDate: treaty.expirationDate } : {}),
            status: 'proposed',
            proposedBy: creatorOrgId,
            proposedByName: creatorMember?.organizationName ?? creatorOrgId,
            signatures,
        };
        const treaties = federation.treaties ?? [];
        treaties.push(newTreaty);
        federation.treaties = treaties;
        await this.federationRepository.save(federation);
        logger_1.logger.info(`Created treaty proposal in federation`, {
            federationId,
            treatyId: newTreaty.id,
            type: treaty.type,
            proposedBy: creatorOrgId,
        });
        return newTreaty;
    }
    async respondToTreaty(federationId, treatyId, actorOrgId, action) {
        const federation = await this.loadFederationMetadataOnly(federationId);
        if (!federation) {
            throw new apiErrors_1.NotFoundError('Federation');
        }
        const treaties = federation.treaties ?? [];
        const treaty = treaties.find(t => t.id === treatyId);
        if (!treaty) {
            throw new apiErrors_1.NotFoundError('Treaty');
        }
        if (treaty.status !== 'proposed') {
            throw new apiErrors_1.ValidationError('Only proposed treaties can be signed or rejected');
        }
        const signatures = treaty.signatures ?? [];
        const orgSignature = signatures.find(s => s.organizationId === actorOrgId);
        if (!orgSignature) {
            throw new apiErrors_1.ForbiddenError('Your organization is not a party to this treaty');
        }
        if (orgSignature.status !== 'pending') {
            throw new apiErrors_1.ValidationError(`Your organization has already ${orgSignature.status} this treaty`);
        }
        orgSignature.status = action === 'sign' ? 'signed' : 'rejected';
        orgSignature.respondedAt = new Date().toISOString();
        if (action === 'sign') {
            treaty.signatories = signatures.filter(s => s.status === 'signed').map(s => s.organizationId);
        }
        const pending = signatures.filter(s => s.status === 'pending');
        if (pending.length === 0) {
            const signedCount = signatures.filter(s => s.status === 'signed').length;
            treaty.status = signedCount >= 2 ? 'active' : 'terminated';
        }
        treaty.signatures = signatures;
        federation.treaties = treaties;
        await this.federationRepository.save(federation);
        logger_1.logger.info(`Org responded to treaty in federation`, {
            federationId,
            treatyId,
            actorOrgId,
            action,
            newStatus: treaty.status,
        });
        return treaty;
    }
    async terminateTreaty(federationId, treatyId, actorOrgId) {
        const federation = await this.loadFederationMetadataOnly(federationId);
        if (!federation) {
            throw new apiErrors_1.NotFoundError('Federation');
        }
        const treaties = federation.treaties ?? [];
        const treaty = treaties.find(t => t.id === treatyId);
        if (!treaty) {
            throw new apiErrors_1.NotFoundError('Treaty');
        }
        const actor = await this.findMember(federationId, actorOrgId);
        if (!treaty.signatories.includes(actorOrgId) &&
            (!actor || !['founder', 'leader'].includes(actor.role))) {
            throw new apiErrors_1.ForbiddenError('Insufficient permissions to terminate treaty');
        }
        treaty.status = 'terminated';
        federation.treaties = treaties;
        await this.federationRepository.save(federation);
        logger_1.logger.info(`Terminated treaty in federation`, { federationId, treatyId });
    }
    async getFederationStats(federationId) {
        const federation = await this.loadFederation(federationId);
        if (!federation) {
            throw new apiErrors_1.NotFoundError('Federation');
        }
        const members = federation.members ?? [];
        const activeMembers = members.filter(m => m.status === 'active');
        const totalVotingPower = activeMembers.reduce((sum, m) => sum + m.votingPower, 0);
        const activeTreaties = (federation.treaties ?? []).filter(t => t.status === 'active').length;
        const openProposals = await this.proposalRepository.count({
            where: { federationId, status: 'open' },
        });
        let totalTrust = 0;
        let trustCount = 0;
        for (const member of activeMembers) {
            const relationships = await this.relationshipRepository.find({
                where: { organizationId: member.organizationId },
            });
            for (const rel of relationships) {
                if (activeMembers.some(m => m.organizationId === rel.targetOrganizationId)) {
                    totalTrust += rel.trustScore;
                    trustCount++;
                }
            }
        }
        const averageTrustScore = trustCount > 0 ? totalTrust / trustCount : 50;
        let combinedMemberCount = 0;
        for (const member of activeMembers) {
            const org = await this.organizationRepository.findOne({
                where: { id: member.organizationId },
            });
            if (org) {
                combinedMemberCount += org.totalMembers ?? 0;
            }
        }
        return {
            totalMembers: members.length,
            activeMembers: activeMembers.length,
            totalVotingPower,
            sharedResourcesCount: (federation.sharedResources ?? []).length,
            activeTreaties,
            openProposals,
            averageTrustScore,
            combinedMemberCount,
        };
    }
    async getMemberContributions(federationId) {
        const federation = await this.loadFederation(federationId);
        if (!federation) {
            throw new apiErrors_1.NotFoundError('Federation');
        }
        const members = federation.members ?? [];
        const proposals = await this.getFederationProposals(federationId);
        const closedProposals = proposals.filter(p => p.status !== 'open');
        const resources = federation.sharedResources ?? [];
        return members
            .filter(m => m.status === 'active')
            .map(member => {
            const sharedResourceCount = resources.filter(r => r.providedBy === member.organizationId).length;
            let votesCount = 0;
            for (const proposal of closedProposals) {
                if (proposal.votes.some(v => v.organizationId === member.organizationId)) {
                    votesCount++;
                }
            }
            const votingParticipation = closedProposals.length > 0 ? (votesCount / closedProposals.length) * 100 : 100;
            return {
                organizationId: member.organizationId,
                organizationName: member.organizationName,
                role: member.role,
                contributions: member.contributions,
                sharedResources: sharedResourceCount,
                votingParticipation,
            };
        })
            .sort((a, b) => b.contributions - a.contributions);
    }
    async createMemberRelationships(federation, newMemberOrgId) {
        const members = federation.members ?? [];
        for (const member of members) {
            if (member.organizationId !== newMemberOrgId && member.status === 'active') {
                try {
                    const existing = await this.relationshipRepository.findOne({
                        where: {
                            organizationId: newMemberOrgId,
                            targetOrganizationId: member.organizationId,
                        },
                    });
                    if (!existing) {
                        const relationship = this.relationshipRepository.create({
                            organizationId: newMemberOrgId,
                            targetOrganizationId: member.organizationId,
                            type: OrganizationRelationship_1.RelationshipType.AFFILIATED,
                            status: OrganizationRelationship_1.RelationshipStatus.ACTIVE,
                            trustScore: 60,
                            relationshipStrength: 50,
                            description: `Federation members in ${federation.name}`,
                            isMutual: true,
                        });
                        await this.relationshipRepository.save(relationship);
                    }
                }
                catch (error) {
                    logger_1.logger.debug('Failed to create relationship, may already exist', {
                        from: newMemberOrgId,
                        to: member.organizationId,
                        error: error instanceof Error ? error.message : 'Unknown error',
                    });
                }
            }
        }
    }
    async checkAndResolveProposal(proposal, federation) {
        const members = federation.members ?? [];
        const eligibleVoters = members.filter((m) => m.status === 'active' && m.votingPower > 0);
        const totalVotingPower = eligibleVoters.reduce((sum, m) => sum + m.votingPower, 0);
        const votes = proposal.votes ?? [];
        const votedPower = votes.reduce((sum, v) => sum + v.weight, 0);
        const approvePower = votes
            .filter(v => v.vote === 'approve')
            .reduce((sum, v) => sum + v.weight, 0);
        if (votedPower >= totalVotingPower) {
            const approvalPercentage = (approvePower / totalVotingPower) * 100;
            proposal.status = approvalPercentage >= proposal.requiredApproval ? 'passed' : 'rejected';
            if (proposal.status === 'passed') {
                await this.executeProposal(proposal, federation);
            }
        }
    }
    async executeProposal(proposal, federation) {
        switch (proposal.type) {
            case 'add_member':
                logger_1.logger.info(`Proposal passed: Add member`, { proposalId: proposal.id });
                break;
            case 'remove_member':
                if (proposal.metadata?.targetOrgId) {
                    await this.memberRepository.delete({
                        federationId: federation.id,
                        organizationId: proposal.metadata.targetOrgId,
                    });
                }
                break;
            case 'dissolve':
                federation.status = 'dissolved';
                await this.federationRepository.save(federation);
                break;
            case 'amend_governance':
                if (proposal.metadata?.governance) {
                    federation.governance = {
                        ...federation.governance,
                        ...proposal.metadata.governance,
                    };
                    await this.federationRepository.save(federation);
                }
                break;
            default:
                logger_1.logger.info(`Proposal passed: ${proposal.type}`, { proposalId: proposal.id });
        }
    }
    async getPublicFederations(filters, pagination) {
        const page = pagination?.page ?? 1;
        const limit = pagination?.limit ?? 20;
        let qb = this.federationRepository
            .createQueryBuilder('federation')
            .leftJoinAndSelect('federation.members', 'member')
            .where('federation.isPublic = :isPublic', { isPublic: true })
            .andWhere('federation.status IN (:...statuses)', { statuses: ['active', 'forming'] });
        if (filters?.name) {
            qb = qb.andWhere('(LOWER(federation.name) LIKE :search OR LOWER(federation.description) LIKE :search)', { search: `%${filters.name.toLowerCase()}%` });
        }
        if (filters?.tags && filters.tags.length > 0) {
            qb = qb.andWhere('federation.tags ?| ARRAY[:...tags]', { tags: filters.tags });
        }
        const allFederations = await qb.getMany();
        let results = allFederations;
        if (filters?.minMembers !== undefined) {
            const min = filters.minMembers;
            results = results.filter(f => (f.members ?? []).filter(m => m.status === 'active').length >= min);
        }
        if (filters?.maxMembers !== undefined) {
            const max = filters.maxMembers;
            results = results.filter(f => (f.members ?? []).filter(m => m.status === 'active').length <= max);
        }
        const sortBy = pagination?.sortBy ?? 'memberCount';
        const sortOrder = pagination?.sortOrder ?? 'DESC';
        const sortMultiplier = sortOrder === 'DESC' ? -1 : 1;
        results.sort((a, b) => {
            let comparison = 0;
            switch (sortBy) {
                case 'memberCount':
                    comparison =
                        (a.members ?? []).filter(m => m.status === 'active').length -
                            (b.members ?? []).filter(m => m.status === 'active').length;
                    break;
                case 'createdAt':
                    comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
                    break;
                case 'name':
                    comparison = a.name.localeCompare(b.name);
                    break;
            }
            return comparison * sortMultiplier;
        });
        const total = results.length;
        const totalPages = Math.ceil(total / limit);
        const startIndex = (page - 1) * limit;
        const paginatedResults = results.slice(startIndex, startIndex + limit);
        const allMemberOrgIds = new Set();
        for (const f of paginatedResults) {
            for (const m of (f.members ?? []).filter(m => m.status === 'active')) {
                allMemberOrgIds.add(m.organizationId);
            }
        }
        let publicOrgIds = new Set();
        if (allMemberOrgIds.size > 0) {
            try {
                const publicProfiles = await this.profileRepository
                    .createQueryBuilder('profile')
                    .select('profile.organizationId')
                    .where('profile.organizationId IN (:...ids)', { ids: Array.from(allMemberOrgIds) })
                    .andWhere('profile.isPublic = :isPublic', { isPublic: true })
                    .getMany();
                publicOrgIds = new Set(publicProfiles.map(p => p.organizationId));
            }
            catch {
                publicOrgIds = allMemberOrgIds;
            }
        }
        const data = paginatedResults.map(f => ({
            id: f.id,
            slug: (0, slugify_1.slugify)(f.name),
            name: f.name,
            description: f.description,
            memberCount: (f.members ?? []).filter(m => m.status === 'active').length,
            memberOrganizations: (f.members ?? [])
                .filter(m => m.status === 'active')
                .slice(0, 5)
                .map(m => {
                const memberIsPublic = publicOrgIds.has(m.organizationId);
                return {
                    organizationId: memberIsPublic ? m.organizationId : 'redacted',
                    organizationName: memberIsPublic ? m.organizationName : 'Private Organization',
                    role: m.role,
                    isPublic: memberIsPublic,
                };
            }),
            tags: f.tags || [],
            createdAt: f.createdAt.toISOString(),
            sharedResourceTypes: [...new Set((f.sharedResources ?? []).map(r => r.type))],
            treatyCount: (f.treaties ?? []).filter(t => t.status === 'active').length,
            logoUrl: f.logoUrl,
            bannerUrl: f.bannerUrl,
            discordUrl: f.discordUrl,
            websiteUrl: f.websiteUrl,
        }));
        return {
            data,
            pagination: {
                total,
                page,
                limit,
                totalPages,
                hasNext: page < totalPages,
                hasPrev: page > 1,
            },
        };
    }
    async getPublicFederation(identifier) {
        const { isUUID } = await Promise.resolve().then(() => __importStar(require('../../utils/slugify')));
        let federation;
        if (isUUID(identifier)) {
            federation = await this.federationRepository.findOne({
                where: [
                    { id: identifier, isPublic: true, status: 'active' },
                    { id: identifier, isPublic: true, status: 'forming' },
                ],
                relations: ['members'],
            });
        }
        else {
            federation =
                (await this.federationRepository
                    .createQueryBuilder('federation')
                    .leftJoinAndSelect('federation.members', 'members')
                    .where('federation.isPublic = :isPublic', { isPublic: true })
                    .andWhere('federation.status IN (:...statuses)', { statuses: ['active', 'forming'] })
                    .andWhere(String.raw `LOWER(TRIM(BOTH '-' FROM REGEXP_REPLACE(REGEXP_REPLACE(REGEXP_REPLACE(TRIM(federation.name), '[^a-zA-Z0-9\s-]', '', 'g'), '[\s-]+', '-', 'g'), '-+', '-', 'g'))) = LOWER(:slug)`, { slug: identifier })
                    .getOne()) ?? null;
        }
        if (!federation) {
            return null;
        }
        const activeMembers = (federation.members ?? []).filter(m => m.status === 'active');
        const memberOrgIds = activeMembers.map(m => m.organizationId);
        let publicOrgIds = new Set(memberOrgIds);
        if (memberOrgIds.length > 0) {
            try {
                const publicProfiles = await this.profileRepository
                    .createQueryBuilder('profile')
                    .select('profile.organizationId')
                    .where('profile.organizationId IN (:...ids)', { ids: memberOrgIds })
                    .andWhere('profile.isPublic = :isPublic', { isPublic: true })
                    .getMany();
                publicOrgIds = new Set(publicProfiles.map(p => p.organizationId));
            }
            catch {
            }
        }
        return {
            id: federation.id,
            slug: (0, slugify_1.slugify)(federation.name),
            name: federation.name,
            description: federation.description,
            memberCount: activeMembers.length,
            memberOrganizations: activeMembers.map(m => {
                const memberIsPublic = publicOrgIds.has(m.organizationId);
                return {
                    organizationId: memberIsPublic ? m.organizationId : 'redacted',
                    organizationName: memberIsPublic ? m.organizationName : 'Private Organization',
                    role: m.role,
                    isPublic: memberIsPublic,
                };
            }),
            tags: federation.tags || [],
            createdAt: federation.createdAt.toISOString(),
            sharedResourceTypes: [...new Set((federation.sharedResources ?? []).map(r => r.type))],
            treatyCount: (federation.treaties ?? []).filter(t => t.status === 'active').length,
            logoUrl: federation.logoUrl,
            bannerUrl: federation.bannerUrl,
            discordUrl: federation.discordUrl,
            websiteUrl: federation.websiteUrl,
        };
    }
    async getPublicFederationStats() {
        const publicFederations = await this.federationRepository.find({
            where: [
                { isPublic: true, status: 'active' },
                { isPublic: true, status: 'forming' },
            ],
        });
        const totalFederations = publicFederations.length;
        if (totalFederations === 0) {
            return {
                totalFederations: 0,
                totalMemberOrganizations: 0,
                averageMembersPerFederation: 0,
                byTag: {},
            };
        }
        const federationIds = publicFederations.map(f => f.id);
        const memberStats = await this.memberRepository
            .createQueryBuilder('fm')
            .select('COUNT(DISTINCT fm."organizationId")::int', 'uniqueOrgs')
            .addSelect('COUNT(*)::int', 'totalMembers')
            .where('fm."federationId" IN (:...federationIds)', { federationIds })
            .andWhere('fm.status = :status', { status: 'active' })
            .getRawOne();
        const tagCounts = {};
        for (const federation of publicFederations) {
            for (const tag of federation.tags || []) {
                tagCounts[tag] = (tagCounts[tag] || 0) + 1;
            }
        }
        const totalMembers = memberStats?.totalMembers ?? 0;
        return {
            totalFederations,
            totalMemberOrganizations: memberStats?.uniqueOrgs ?? 0,
            averageMembersPerFederation: totalFederations > 0 ? Math.round((totalMembers / totalFederations) * 10) / 10 : 0,
            byTag: tagCounts,
        };
    }
    async getPublicFederationsForOrg(organizationId) {
        const memberships = await this.memberRepository.find({
            where: { organizationId, status: 'active' },
            select: ['federationId', 'role'],
        });
        if (memberships.length === 0) {
            return [];
        }
        const federationIds = memberships.map(m => m.federationId);
        const federations = await this.federationRepository
            .createQueryBuilder('federation')
            .leftJoinAndSelect('federation.members', 'member')
            .where('federation.id IN (:...ids)', { ids: federationIds })
            .andWhere('federation.isPublic = :isPublic', { isPublic: true })
            .andWhere('federation.status IN (:...statuses)', {
            statuses: ['active', 'forming'],
        })
            .getMany();
        const roleMap = new Map(memberships.map(m => [m.federationId, m.role]));
        return federations.map(f => ({
            id: f.id,
            slug: (0, slugify_1.slugify)(f.name),
            name: f.name,
            description: f.description,
            memberCount: (f.members ?? []).filter(m => m.status === 'active').length,
            role: roleMap.get(f.id) ?? 'member',
            tags: f.tags ?? [],
            logoUrl: f.logoUrl,
        }));
    }
    async hasAllianceManageAccess(allianceId, userId) {
        const federation = await this.loadFederation(allianceId);
        if (!federation) {
            return false;
        }
        const membershipRepo = data_source_1.AppDataSource.getRepository(OrganizationMembership_1.OrganizationMembership);
        const memberships = await membershipRepo.find({
            where: { userId, isActive: true },
            select: ['organizationId'],
        });
        const userOrgIds = new Set(memberships.map(m => m.organizationId));
        for (const member of federation.members ?? []) {
            if (userOrgIds.has(member.organizationId)) {
                if (['founder', 'leader', 'council'].includes(member.role) && member.status === 'active') {
                    return true;
                }
            }
        }
        return false;
    }
    async getFederationSettings(federationId, actorOrgId) {
        const federation = await this.loadFederation(federationId);
        if (!federation) {
            throw new apiErrors_1.NotFoundError('Federation');
        }
        const actorMember = (federation.members ?? []).find(m => m.organizationId === actorOrgId && m.status === 'active');
        if (!actorMember) {
            throw new apiErrors_1.ForbiddenError('Not an active member of this federation');
        }
        return federation.settings ?? {};
    }
    async updateFederationSettings(federationId, actorOrgId, updates) {
        const federation = await this.loadFederation(federationId);
        if (!federation) {
            throw new apiErrors_1.NotFoundError('Federation');
        }
        const actorMember = (federation.members ?? []).find(m => m.organizationId === actorOrgId);
        if (!actorMember || !['founder', 'leader', 'council'].includes(actorMember.role)) {
            throw new apiErrors_1.ForbiddenError('Insufficient permissions to update federation settings');
        }
        const currentSettings = { ...federation.settings };
        if (updates.enableTitlesBadges !== undefined) {
            currentSettings.enableTitlesBadges = updates.enableTitlesBadges;
        }
        if (updates.enableFederationFleets !== undefined) {
            currentSettings.enableFederationFleets = updates.enableFederationFleets;
        }
        if (updates.enableFederationDynamicTeams !== undefined) {
            currentSettings.enableFederationDynamicTeams = updates.enableFederationDynamicTeams;
        }
        if (updates.allowSelfApplication !== undefined) {
            currentSettings.allowSelfApplication = updates.allowSelfApplication;
        }
        if (updates.requireApproval !== undefined) {
            currentSettings.requireApproval = updates.requireApproval;
        }
        if (updates.applicationQuestions !== undefined) {
            currentSettings.applicationQuestions = updates.applicationQuestions;
        }
        if (updates.enableCentralDiscord !== undefined) {
            currentSettings.enableCentralDiscord = updates.enableCentralDiscord;
        }
        if (updates.autoCreateOrgRoles !== undefined) {
            currentSettings.autoCreateOrgRoles = updates.autoCreateOrgRoles;
        }
        if (updates.removeRolesOnOrgLeave !== undefined) {
            currentSettings.removeRolesOnOrgLeave = updates.removeRolesOnOrgLeave;
        }
        if (updates.removeRolesOnUserLeave !== undefined) {
            currentSettings.removeRolesOnUserLeave = updates.removeRolesOnUserLeave;
        }
        if (updates.conflictResolutionMode !== undefined) {
            currentSettings.conflictResolutionMode = updates.conflictResolutionMode;
        }
        if (updates.syncNotificationChannelId !== undefined) {
            currentSettings.syncNotificationChannelId = updates.syncNotificationChannelId;
        }
        if (updates.kickNonMembers !== undefined) {
            currentSettings.kickNonMembers = updates.kickNonMembers;
        }
        federation.settings = currentSettings;
        await this.federationRepository.save(federation);
        logger_1.logger.info(`Updated federation settings: ${federation.name}`, {
            federationId,
            actorOrgId,
            settings: currentSettings,
        });
        return currentSettings;
    }
    async loadTreatySharedFleets(orgIds, fleetRepository) {
        const diplomacyRepo = data_source_1.AppDataSource.getRepository(AllianceDiplomacy_1.AllianceDiplomacy);
        const activeTreaties = await diplomacyRepo
            .createQueryBuilder('d')
            .where('d.status = :status', { status: AllianceDiplomacy_1.DiplomacyStatus.ACTIVE })
            .andWhere('(d.orgId1 IN (:...orgIds) OR d.orgId2 IN (:...orgIds))', { orgIds })
            .getMany();
        const partnerOrgIds = new Set();
        const treatyTypeByOrg = new Map();
        for (const treaty of activeTreaties) {
            const partnerOrgId = orgIds.includes(treaty.orgId1) ? treaty.orgId2 : treaty.orgId1;
            if (!orgIds.includes(partnerOrgId)) {
                partnerOrgIds.add(partnerOrgId);
                treatyTypeByOrg.set(partnerOrgId, treaty.allianceType);
            }
        }
        if (partnerOrgIds.size === 0) {
            return { fleets: [], treatyTypeByOrg, partnerOrgIds };
        }
        const partnerFleets = await fleetRepository
            .createQueryBuilder('fleet')
            .where('fleet.organizationId IN (:...partnerOrgIds)', { partnerOrgIds: [...partnerOrgIds] })
            .getMany();
        const sharedFleets = partnerFleets.filter(f => (f.allowedOrganizations ?? []).some(aoId => orgIds.includes(aoId)));
        return { fleets: sharedFleets, treatyTypeByOrg, partnerOrgIds };
    }
    async batchLoadFleetShipCounts(fleetIds) {
        if (fleetIds.length === 0) {
            return {};
        }
        const fleetShipRepo = data_source_1.AppDataSource.getRepository(FleetShip_1.FleetShip);
        const rows = await fleetShipRepo
            .createQueryBuilder('fs')
            .select('fs.fleetId', 'fleetId')
            .addSelect('COUNT(fs.id)', 'total')
            .addSelect("COUNT(CASE WHEN ship.status = 'flight_ready' THEN 1 END)", 'flightReady')
            .leftJoin('fs.ship', 'ship')
            .where('fs.fleetId IN (:...fleetIds)', { fleetIds })
            .groupBy('fs.fleetId')
            .getRawMany();
        const result = {};
        for (const row of rows) {
            result[row.fleetId] = {
                total: Number.parseInt(row.total, 10) || 0,
                flightReady: Number.parseInt(row.flightReady, 10) || 0,
            };
        }
        return result;
    }
    buildFleetItem(f, shipCounts, orgNameMap, isShared, sharedVia) {
        const shipData = shipCounts[f.id] ?? { total: 0, flightReady: 0 };
        const shipCount = shipData.total || (f.shipIds?.length ?? 0);
        const readinessPercent = shipCount > 0 ? Math.round((shipData.flightReady / shipCount) * 100) : 0;
        const memberCount = f.members?.length ?? 0;
        const crewFillPercent = shipCount > 0 ? Math.min(100, Math.round((memberCount / Math.max(shipCount, 1)) * 100)) : 0;
        const healthScore = Math.round(readinessPercent * 0.6 + crewFillPercent * 0.4);
        let readinessStatus;
        if (healthScore >= 75) {
            readinessStatus = 'green';
        }
        else if (healthScore >= 50) {
            readinessStatus = 'yellow';
        }
        else {
            readinessStatus = 'red';
        }
        return {
            id: f.id,
            name: f.name,
            description: f.description ?? null,
            status: f.status,
            type: f.type,
            memberCount,
            shipCount,
            organizationId: f.organizationId,
            organizationName: orgNameMap.get(f.organizationId) ?? 'Unknown',
            visibility: f.visibility ?? 'private',
            readiness: {
                healthScore,
                status: readinessStatus,
                readinessPercent,
                crewFillPercent,
            },
            isShared,
            sharedVia,
        };
    }
    async getFederationFleets(federationId, actorOrgId) {
        const federation = await this.loadFederation(federationId);
        if (!federation) {
            throw new apiErrors_1.NotFoundError('Federation');
        }
        const actorMember = (federation.members ?? []).find(m => m.organizationId === actorOrgId && m.status === 'active');
        if (!actorMember) {
            throw new apiErrors_1.ForbiddenError('Not an active member of this federation');
        }
        const settings = federation.settings ?? {};
        if (!settings.enableFederationFleets) {
            throw new apiErrors_1.ValidationError('Federation fleets feature is not enabled');
        }
        const activeMembers = (federation.members ?? []).filter(m => m.status === 'active');
        const orgNameMap = new Map(activeMembers.map(m => [m.organizationId, m.organizationName]));
        const orgIds = activeMembers.map(m => m.organizationId);
        const fleetRepository = data_source_1.AppDataSource.getRepository(Fleet_1.Fleet);
        const memberFleets = await fleetRepository
            .createQueryBuilder('fleet')
            .where('fleet.organizationId IN (:...orgIds)', { orgIds })
            .getMany();
        const memberFleetIds = new Set(memberFleets.map(f => f.id));
        const { fleets: sharedTreatyFleets, treatyTypeByOrg, partnerOrgIds, } = await this.loadTreatySharedFleets(orgIds, fleetRepository);
        const allFleets = [...memberFleets, ...sharedTreatyFleets];
        const fleetShipCounts = await this.batchLoadFleetShipCounts(allFleets.map(f => f.id));
        if (partnerOrgIds.size > 0) {
            const orgRepo = data_source_1.AppDataSource.getRepository(Organization_1.Organization);
            const partnerOrgs = await orgRepo.find({
                where: { id: (0, typeorm_1.In)([...partnerOrgIds]) },
                select: ['id', 'name'],
            });
            for (const org of partnerOrgs) {
                if (!orgNameMap.has(org.id)) {
                    orgNameMap.set(org.id, org.name);
                }
            }
        }
        const fleetItems = [
            ...memberFleets.map(f => this.buildFleetItem(f, fleetShipCounts, orgNameMap, false)),
            ...sharedTreatyFleets
                .filter(f => !memberFleetIds.has(f.id))
                .map(f => this.buildFleetItem(f, fleetShipCounts, orgNameMap, true, treatyTypeByOrg.get(f.organizationId))),
        ];
        const fleetsByOrganization = {};
        for (const item of fleetItems) {
            fleetsByOrganization[item.organizationName] =
                (fleetsByOrganization[item.organizationName] ?? 0) + 1;
        }
        return {
            federationId,
            totalFleets: fleetItems.length,
            fleetsByOrganization,
            fleets: fleetItems,
        };
    }
    async getFederationUnits(federationId, actorOrgId) {
        const federation = await this.loadFederation(federationId);
        if (!federation) {
            throw new apiErrors_1.NotFoundError('Federation');
        }
        const actorMember = (federation.members ?? []).find(m => m.organizationId === actorOrgId && m.status === 'active');
        if (!actorMember) {
            throw new apiErrors_1.ForbiddenError('Not an active member of this federation');
        }
        const settings = federation.settings ?? {};
        if (!settings.enableFederationDynamicTeams) {
            throw new apiErrors_1.ValidationError('Federation units feature is not enabled');
        }
        const activeMembers = (federation.members ?? []).filter(m => m.status === 'active');
        const orgNameMap = new Map(activeMembers.map(m => [m.organizationId, m.organizationName]));
        const orgIds = activeMembers.map(m => m.organizationId);
        const teamRepository = data_source_1.AppDataSource.getRepository(Team_1.Team);
        const teams = await teamRepository
            .createQueryBuilder('team')
            .leftJoinAndSelect('team.members', 'members')
            .where('team.organizationId IN (:...orgIds)', { orgIds })
            .getMany();
        const unitItems = teams.map(t => ({
            id: t.id,
            name: t.name,
            description: t.description ?? null,
            type: t.type,
            memberCount: t.members?.length ?? 0,
            maxMembers: t.maxMembers,
            isActive: t.isActive,
            organizationId: t.organizationId,
            organizationName: orgNameMap.get(t.organizationId) ?? 'Unknown',
        }));
        const unitsByOrganization = {};
        for (const item of unitItems) {
            unitsByOrganization[item.organizationName] =
                (unitsByOrganization[item.organizationName] ?? 0) + 1;
        }
        return {
            federationId,
            totalUnits: unitItems.length,
            unitsByOrganization,
            units: unitItems,
        };
    }
    async seedDemoFederations() {
        const count = await this.federationRepository.count();
        if (count > 0) {
            logger_1.logger.info('Federation data already exists, skipping seed');
            return;
        }
        const now = new Date();
        const seedFederation = async (fedData, members) => {
            const federation = this.federationRepository.create({
                name: fedData.name,
                description: fedData.description,
                founderId: fedData.founderId,
                founderOrgId: fedData.founderOrgId,
                createdAt: fedData.createdAt,
                governance: fedData.governance,
                sharedResources: fedData.sharedResources,
                treaties: fedData.treaties,
                status: fedData.status,
                isPublic: fedData.isPublic,
                tags: fedData.tags,
                discordUrl: fedData.discordUrl,
                websiteUrl: fedData.websiteUrl,
                bannerUrl: fedData.bannerUrl,
            });
            const savedFederation = await this.federationRepository.save(federation);
            for (const m of members) {
                const member = this.memberRepository.create({
                    federationId: savedFederation.id,
                    organizationId: m.organizationId,
                    organizationName: m.organizationName,
                    role: m.role,
                    joinedAt: m.joinedAt,
                    status: m.status,
                    votingPower: m.votingPower,
                    contributions: m.contributions,
                });
                await this.memberRepository.save(member);
            }
        };
        await seedFederation({
            name: 'Stanton Defense Coalition',
            description: 'A public alliance of combat and security organizations dedicated to protecting trade routes, ' +
                'defending mining operations, and maintaining order across the Stanton system. Open to all ' +
                'organizations committed to collective defense and mutual aid.',
            founderId: 'demo-user-commander-001',
            founderOrgId: 'demo-org-stardust-fleet',
            createdAt: new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000),
            governance: {
                votingSystem: 'majority',
                requiredApprovalThreshold: 51,
                councilSize: 3,
                leaderTermDays: 90,
                amendmentThreshold: 67,
            },
            sharedResources: [
                {
                    id: 'res-fleet-patrol',
                    name: 'Joint Patrol Fleet',
                    type: 'fleet',
                    providedBy: 'demo-org-stardust-fleet',
                    accessLevel: 'all',
                    description: 'Shared patrol ships available to all coalition members for route defense.',
                },
                {
                    id: 'res-intel-network',
                    name: 'Threat Intelligence Network',
                    type: 'intel',
                    providedBy: 'demo-org-ironwolf',
                    accessLevel: 'all',
                    description: 'Real-time pirate activity tracking and threat assessment data.',
                },
                {
                    id: 'res-discord-comms',
                    name: 'Coalition Comms Server',
                    type: 'discord',
                    providedBy: 'demo-org-stardust-fleet',
                    accessLevel: 'all',
                    description: 'Shared Discord server for inter-org coordination and alerts.',
                },
            ],
            treaties: [
                {
                    id: 'treaty-mutual-def',
                    name: 'Stanton Mutual Defense Pact',
                    type: 'mutual_defense',
                    signatories: ['demo-org-stardust-fleet', 'demo-org-ironwolf', 'demo-org-deep-core'],
                    terms: [
                        'All members will respond to distress calls within 15 minutes',
                        'Shared combat intel on hostile organizations',
                        'Joint monthly training exercises',
                    ],
                    effectiveDate: new Date(now.getTime() - 55 * 24 * 60 * 60 * 1000).toISOString(),
                    status: 'active',
                    proposedBy: 'demo-org-stardust-fleet',
                },
                {
                    id: 'treaty-resource-share',
                    name: 'Resource Sharing Agreement',
                    type: 'resource_sharing',
                    signatories: ['demo-org-stardust-fleet', 'demo-org-deep-core'],
                    terms: [
                        'Deep Core provides priority ore pricing to coalition members',
                        'Stardust provides escort services for mining operations',
                    ],
                    effectiveDate: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString(),
                    status: 'active',
                    proposedBy: 'demo-org-stardust-fleet',
                },
            ],
            status: 'active',
            isPublic: true,
            tags: ['defense', 'security', 'stanton', 'mutual-aid', 'multi-org'],
            discordUrl: 'https://discord.gg/stanton-defense',
            websiteUrl: 'https://stanton-defense.example.com',
            bannerUrl: 'https://picsum.photos/seed/sdc-alliance/800/200',
        }, [
            {
                organizationId: 'demo-org-stardust-fleet',
                organizationName: 'Stardust Expeditionary Fleet',
                role: 'founder',
                joinedAt: new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000),
                status: 'active',
                votingPower: 2,
                contributions: 15,
            },
            {
                organizationId: 'demo-org-ironwolf',
                organizationName: 'Ironwolf Mercenary Company',
                role: 'council',
                joinedAt: new Date(now.getTime() - 45 * 24 * 60 * 60 * 1000),
                status: 'active',
                votingPower: 1,
                contributions: 10,
            },
            {
                organizationId: 'demo-org-deep-core',
                organizationName: 'Deep Core Mining Consortium',
                role: 'member',
                joinedAt: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
                status: 'active',
                votingPower: 1,
                contributions: 5,
            },
        ]);
        await seedFederation({
            name: 'Quantum Trade Syndicate',
            description: 'An economic alliance focused on establishing and protecting profitable trade routes ' +
                'across Stanton and into Pyro. Members share route intelligence, coordinate convoy ' +
                'schedules, and negotiate bulk pricing with landing zones.',
            founderId: 'demo-user-trader-003',
            founderOrgId: 'demo-org-quantum-trade',
            createdAt: new Date(now.getTime() - 40 * 24 * 60 * 60 * 1000),
            governance: {
                votingSystem: 'weighted',
                requiredApprovalThreshold: 60,
                councilSize: 2,
                leaderTermDays: 180,
                amendmentThreshold: 75,
            },
            sharedResources: [
                {
                    id: 'res-trade-routes',
                    name: 'Verified Trade Route Database',
                    type: 'routes',
                    providedBy: 'demo-org-quantum-trade',
                    accessLevel: 'all',
                    description: 'Curated database of profitable trade routes with real-time pricing data.',
                },
                {
                    id: 'res-trade-infra',
                    name: 'Syndicate Hangars & Storage',
                    type: 'infrastructure',
                    providedBy: 'demo-org-quantum-trade',
                    accessLevel: 'council',
                    description: 'Shared hangar space and cargo storage at key landing zones.',
                },
            ],
            treaties: [
                {
                    id: 'treaty-trade-exclusivity',
                    name: 'Pyro Trade Route Exclusivity',
                    type: 'trade',
                    signatories: ['demo-org-quantum-trade', 'demo-org-deep-core'],
                    terms: [
                        'Exclusive first-right pricing on Pyro jump point cargo runs',
                        'Joint investment in hauler fleet expansion',
                        'Profit sharing on joint route operations (60/40 split)',
                    ],
                    effectiveDate: new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000).toISOString(),
                    status: 'active',
                    proposedBy: 'demo-org-quantum-trade',
                },
            ],
            status: 'active',
            isPublic: true,
            tags: ['trade', 'economics', 'pyro', 'hauling', 'logistics'],
            discordUrl: 'https://discord.gg/quantum-syndicate',
            websiteUrl: 'https://quantum-syndicate.example.com',
        }, [
            {
                organizationId: 'demo-org-quantum-trade',
                organizationName: 'Quantum Trade Network',
                role: 'founder',
                joinedAt: new Date(now.getTime() - 40 * 24 * 60 * 60 * 1000),
                status: 'active',
                votingPower: 3,
                contributions: 20,
            },
            {
                organizationId: 'demo-org-deep-core',
                organizationName: 'Deep Core Mining Consortium',
                role: 'leader',
                joinedAt: new Date(now.getTime() - 35 * 24 * 60 * 60 * 1000),
                status: 'active',
                votingPower: 2,
                contributions: 12,
            },
        ]);
        await seedFederation({
            name: 'Shadow Council',
            description: 'A secretive alliance operating in the grey areas of UEE law. Members share intel on ' +
                'high-value targets, coordinate smuggling operations, and maintain safe houses across Stanton.',
            founderId: 'demo-user-smuggler-009',
            founderOrgId: 'demo-org-ironwolf',
            createdAt: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000),
            governance: {
                votingSystem: 'unanimous',
                requiredApprovalThreshold: 100,
                councilSize: 2,
                leaderTermDays: 365,
                amendmentThreshold: 100,
            },
            sharedResources: [
                {
                    id: 'res-shadow-intel',
                    name: 'Dark Net Intel Feed',
                    type: 'intel',
                    providedBy: 'demo-org-ironwolf',
                    accessLevel: 'leaders',
                    description: 'Classified intelligence on high-value targets and law enforcement patterns.',
                },
                {
                    id: 'res-smuggling-routes',
                    name: 'Smuggling Route Database',
                    type: 'routes',
                    providedBy: 'demo-org-crimson-syndicate',
                    accessLevel: 'all',
                    description: 'Curated database of safe smuggling corridors, patrol gaps, and drop locations.',
                },
            ],
            treaties: [
                {
                    id: 'treaty-non-aggression',
                    name: 'Non-Aggression Pact',
                    type: 'non_aggression',
                    signatories: [
                        'demo-org-ironwolf',
                        'demo-org-quantum-trade',
                        'demo-org-crimson-syndicate',
                    ],
                    terms: [
                        'No hostile actions against member organizations',
                        'Shared safe house access at Grim HEX',
                        'Mutual intel on law enforcement operations',
                        'Crimson Syndicate provides logistics for covert cargo runs',
                    ],
                    effectiveDate: new Date(now.getTime() - 85 * 24 * 60 * 60 * 1000).toISOString(),
                    status: 'active',
                    proposedBy: 'demo-org-ironwolf',
                },
            ],
            status: 'active',
            isPublic: false,
            tags: ['covert', 'intel', 'smuggling'],
        }, [
            {
                organizationId: 'demo-org-ironwolf',
                organizationName: 'Ironwolf Mercenary Company',
                role: 'founder',
                joinedAt: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000),
                status: 'active',
                votingPower: 1,
                contributions: 25,
            },
            {
                organizationId: 'demo-org-quantum-trade',
                organizationName: 'Quantum Trade Network',
                role: 'member',
                joinedAt: new Date(now.getTime() - 70 * 24 * 60 * 60 * 1000),
                status: 'active',
                votingPower: 1,
                contributions: 8,
            },
            {
                organizationId: 'demo-org-crimson-syndicate',
                organizationName: 'Crimson Syndicate',
                role: 'member',
                joinedAt: new Date(now.getTime() - 45 * 24 * 60 * 60 * 1000),
                status: 'active',
                votingPower: 1,
                contributions: 12,
            },
        ]);
        logger_1.logger.info(`Seeded 3 demo federations (2 public, 1 private)`);
    }
}
exports.OrganizationFederationService = OrganizationFederationService;
//# sourceMappingURL=OrganizationFederationService.js.map