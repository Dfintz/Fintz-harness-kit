"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContactRequestService = void 0;
const data_source_1 = require("../../data-source");
const ContactRequest_1 = require("../../models/ContactRequest");
const ContactRequestReply_1 = require("../../models/ContactRequestReply");
const Federation_1 = require("../../models/Federation");
const Organization_1 = require("../../models/Organization");
const PublicOrgProfile_1 = require("../../models/PublicOrgProfile");
const api_1 = require("../../types/api");
const apiErrors_1 = require("../../utils/apiErrors");
const encryptionTransformer_1 = require("../../utils/encryptionTransformer");
const logger_1 = require("../../utils/logger");
const notificationWebSocketController_1 = require("../../websocket/controllers/notificationWebSocketController");
const OrganizationFederationService_1 = require("./OrganizationFederationService");
class ContactRequestService {
    contactRepository;
    replyRepository;
    profileRepository;
    organizationRepository;
    federationRepository;
    federationService;
    constructor() {
        this.contactRepository = data_source_1.AppDataSource.getRepository(ContactRequest_1.ContactRequest);
        this.replyRepository = data_source_1.AppDataSource.getRepository(ContactRequestReply_1.ContactRequestReply);
        this.profileRepository = data_source_1.AppDataSource.getRepository(PublicOrgProfile_1.PublicOrgProfile);
        this.organizationRepository = data_source_1.AppDataSource.getRepository(Organization_1.Organization);
        this.federationRepository = data_source_1.AppDataSource.getRepository(Federation_1.Federation);
        this.federationService = OrganizationFederationService_1.OrganizationFederationService.getInstance();
    }
    async submitContactRequest(input) {
        if (input.targetType === ContactRequest_1.ContactTargetType.ORGANIZATION) {
            if (!input.organizationId) {
                throw new apiErrors_1.ValidationError('Organization ID is required for organization contact requests');
            }
            const profile = await this.profileRepository.findOne({
                where: { organizationId: input.organizationId, isPublic: true },
            });
            if (!profile) {
                throw new apiErrors_1.ApiError(api_1.ApiErrorCode.RESOURCE_NOT_FOUND, 'Organization not found or not accepting public contact requests', 404);
            }
        }
        else if (input.targetType === ContactRequest_1.ContactTargetType.ALLIANCE) {
            if (!input.allianceId) {
                throw new apiErrors_1.ValidationError('Alliance ID is required for alliance contact requests');
            }
            const federation = await this.federationService.getPublicFederation(input.allianceId);
            if (!federation) {
                throw new apiErrors_1.ApiError(api_1.ApiErrorCode.RESOURCE_NOT_FOUND, 'Alliance not found or not accepting public contact requests', 404);
            }
        }
        const contactRequest = this.contactRepository.create({
            targetType: input.targetType,
            organizationId: input.organizationId || undefined,
            allianceId: input.allianceId || undefined,
            senderUserId: input.senderUserId || undefined,
            senderName: input.senderName,
            senderEmail: input.senderEmail || undefined,
            rsiHandle: input.rsiHandle || undefined,
            discordUsername: input.discordUsername || undefined,
            subject: input.subject,
            message: input.message,
            contactType: input.contactType || 'general',
            visibility: input.visibility || ContactRequest_1.MessageVisibility.ALL,
            visibleToRoles: input.visibleToRoles,
            status: ContactRequest_1.ContactRequestStatus.PENDING,
            senderIp: input.senderIp || undefined,
            userAgent: input.userAgent || undefined,
        });
        const saved = await this.contactRepository.save(contactRequest);
        const targetId = input.targetType === ContactRequest_1.ContactTargetType.ORGANIZATION ? input.organizationId : input.allianceId;
        logger_1.logger.info(`Contact request ${saved.id} created for ${input.targetType} ${targetId}`);
        if (input.organizationId) {
            try {
                (0, notificationWebSocketController_1.sendOrganizationNotification)(input.organizationId, {
                    type: 'info',
                    title: 'New Contact Request',
                    message: `${input.senderName} sent a ${input.contactType || 'general'} inquiry: "${input.subject}"`,
                    category: 'organization',
                    data: {
                        contactRequestId: saved.id,
                        contactType: input.contactType,
                        senderName: input.senderName,
                    },
                    actionUrl: `/settings/contact-requests/${saved.id}`,
                });
            }
            catch (error_) {
                logger_1.logger.warn('Failed to send WebSocket notification for contact request', {
                    error: error_,
                });
            }
        }
        return saved;
    }
    async getOrganizationContactRequests(organizationId, filters, pagination) {
        return this.getContactRequests({ organizationId, targetType: ContactRequest_1.ContactTargetType.ORGANIZATION }, filters, pagination);
    }
    async getAllianceContactRequests(allianceId, filters, pagination) {
        return this.getContactRequests({ allianceId, targetType: ContactRequest_1.ContactTargetType.ALLIANCE }, filters, pagination);
    }
    async getContactRequests(target, filters, pagination) {
        const queryBuilder = this.contactRepository
            .createQueryBuilder('request')
            .where('request.targetType = :targetType', { targetType: target.targetType });
        if (target.organizationId) {
            queryBuilder.andWhere('request.organizationId = :organizationId', {
                organizationId: target.organizationId,
            });
        }
        else if (target.allianceId) {
            queryBuilder.andWhere('request.allianceId = :allianceId', {
                allianceId: target.allianceId,
            });
        }
        if (filters?.statuses && filters.statuses.length > 0) {
            queryBuilder.andWhere('request.status IN (:...statuses)', {
                statuses: filters.statuses,
            });
        }
        else if (filters?.status) {
            queryBuilder.andWhere('request.status = :status', {
                status: filters.status,
            });
        }
        if (filters?.startDate) {
            queryBuilder.andWhere('request.createdAt >= :startDate', {
                startDate: filters.startDate,
            });
        }
        if (filters?.endDate) {
            queryBuilder.andWhere('request.createdAt <= :endDate', {
                endDate: filters.endDate,
            });
        }
        if (filters?.searchTerm) {
            const searchPattern = `%${filters.searchTerm}%`;
            queryBuilder.andWhere('(request.senderName ILIKE :search OR request.senderEmail ILIKE :search)', { search: searchPattern });
        }
        if (filters?.viewerRole) {
            const role = filters.viewerRole.toLowerCase();
            const isLeader = ['owner', 'admin', 'officer'].includes(role);
            if (!isLeader) {
                if (!/^[a-z0-9_-]+$/.test(role)) {
                    logger_1.logger.warn('Invalid role format for visibility filter', { role });
                    throw new apiErrors_1.ValidationError('Invalid role format');
                }
                queryBuilder.andWhere(`(request.visibility = :visAll` +
                    ` OR request.visibility = :visRole` +
                    ` OR (request.visibility = :visCustom AND request."visibleToRoles" @> :roleArray))`, {
                    visAll: ContactRequest_1.MessageVisibility.ALL,
                    visRole: role,
                    visCustom: ContactRequest_1.MessageVisibility.CUSTOM,
                    roleArray: JSON.stringify([role]),
                });
            }
        }
        const page = pagination?.page || 1;
        const limit = pagination?.limit || 20;
        queryBuilder.skip((page - 1) * limit).take(limit);
        const sortBy = pagination?.sortBy || 'createdAt';
        const sortOrder = pagination?.sortOrder || 'DESC';
        const allowedSortFields = ['createdAt', 'updatedAt', 'status', 'senderName', 'subject'];
        const safeSortBy = allowedSortFields.includes(sortBy) ? sortBy : 'createdAt';
        queryBuilder.orderBy(`request.${safeSortBy}`, sortOrder);
        const [requests, total] = await queryBuilder.getManyAndCount();
        const data = requests.map(request => ({
            id: request.id,
            targetType: request.targetType,
            organizationId: request.organizationId,
            allianceId: request.allianceId,
            senderUserId: request.senderUserId,
            senderName: request.senderName,
            senderEmail: request.senderEmail,
            rsiHandle: request.rsiHandle,
            discordUsername: request.discordUsername,
            subject: request.subject,
            message: request.message,
            contactType: request.contactType,
            status: request.status,
            internalNotes: request.internalNotes,
            handledBy: request.handledBy,
            handledAt: request.handledAt,
            createdAt: request.createdAt,
            updatedAt: request.updatedAt,
        }));
        return {
            data,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
                hasNext: page < Math.ceil(total / limit),
                hasPrev: page > 1,
            },
        };
    }
    async getOrganizationContactRequest(requestId, organizationId) {
        return this.getContactRequest(requestId, { organizationId });
    }
    async getAllianceContactRequest(requestId, allianceId) {
        return this.getContactRequest(requestId, { allianceId });
    }
    async getContactRequest(requestId, target) {
        const whereClause = { id: requestId };
        if (target.organizationId) {
            whereClause.organizationId = target.organizationId;
        }
        else if (target.allianceId) {
            whereClause.allianceId = target.allianceId;
        }
        const request = await this.contactRepository.findOne({
            where: whereClause,
        });
        if (!request) {
            return null;
        }
        return {
            id: request.id,
            targetType: request.targetType,
            organizationId: request.organizationId,
            allianceId: request.allianceId,
            senderUserId: request.senderUserId,
            senderName: request.senderName,
            senderEmail: request.senderEmail,
            rsiHandle: request.rsiHandle,
            discordUsername: request.discordUsername,
            subject: request.subject,
            message: request.message,
            contactType: request.contactType,
            status: request.status,
            internalNotes: request.internalNotes,
            handledBy: request.handledBy,
            handledAt: request.handledAt,
            createdAt: request.createdAt,
            updatedAt: request.updatedAt,
        };
    }
    async updateOrganizationContactRequest(requestId, organizationId, input, userId) {
        return this.updateContactRequest(requestId, { organizationId }, input, userId);
    }
    async updateAllianceContactRequest(requestId, allianceId, input, userId) {
        return this.updateContactRequest(requestId, { allianceId }, input, userId);
    }
    async updateContactRequest(requestId, target, input, userId) {
        const whereClause = { id: requestId };
        if (target.organizationId) {
            whereClause.organizationId = target.organizationId;
        }
        else if (target.allianceId) {
            whereClause.allianceId = target.allianceId;
        }
        const request = await this.contactRepository.findOne({
            where: whereClause,
        });
        if (!request) {
            return null;
        }
        if (input.status !== undefined) {
            request.status = input.status;
            request.handledBy = userId;
            request.handledAt = new Date();
        }
        if (input.internalNotes !== undefined) {
            request.internalNotes = input.internalNotes;
        }
        const updated = await this.contactRepository.save(request);
        logger_1.logger.info(`Contact request ${requestId} updated by ${userId}`);
        return updated;
    }
    async markOrganizationRequestAsRead(requestId, organizationId, userId) {
        return this.updateOrganizationContactRequest(requestId, organizationId, {
            status: ContactRequest_1.ContactRequestStatus.READ,
        }, userId);
    }
    async markAllianceRequestAsRead(requestId, allianceId, userId) {
        return this.updateAllianceContactRequest(requestId, allianceId, {
            status: ContactRequest_1.ContactRequestStatus.READ,
        }, userId);
    }
    async markOrganizationRequestAsReplied(requestId, organizationId, userId) {
        return this.updateOrganizationContactRequest(requestId, organizationId, {
            status: ContactRequest_1.ContactRequestStatus.REPLIED,
        }, userId);
    }
    async markAllianceRequestAsReplied(requestId, allianceId, userId) {
        return this.updateAllianceContactRequest(requestId, allianceId, {
            status: ContactRequest_1.ContactRequestStatus.REPLIED,
        }, userId);
    }
    async archiveOrganizationRequest(requestId, organizationId, userId) {
        return this.updateOrganizationContactRequest(requestId, organizationId, {
            status: ContactRequest_1.ContactRequestStatus.ARCHIVED,
        }, userId);
    }
    async archiveAllianceRequest(requestId, allianceId, userId) {
        return this.updateAllianceContactRequest(requestId, allianceId, {
            status: ContactRequest_1.ContactRequestStatus.ARCHIVED,
        }, userId);
    }
    async markOrganizationRequestAsSpam(requestId, organizationId, userId) {
        return this.updateOrganizationContactRequest(requestId, organizationId, {
            status: ContactRequest_1.ContactRequestStatus.SPAM,
        }, userId);
    }
    async markAllianceRequestAsSpam(requestId, allianceId, userId) {
        return this.updateAllianceContactRequest(requestId, allianceId, {
            status: ContactRequest_1.ContactRequestStatus.SPAM,
        }, userId);
    }
    async deleteOrganizationContactRequest(requestId, organizationId) {
        const result = await this.contactRepository.delete({
            id: requestId,
            organizationId,
        });
        return (result.affected || 0) > 0;
    }
    async deleteAllianceContactRequest(requestId, allianceId) {
        const result = await this.contactRepository.delete({
            id: requestId,
            allianceId,
        });
        return (result.affected || 0) > 0;
    }
    async getOrganizationContactRequestStats(organizationId) {
        return this.getContactRequestStats({ organizationId });
    }
    async getAllianceContactRequestStats(allianceId) {
        return this.getContactRequestStats({ allianceId });
    }
    async getContactRequestStats(target) {
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
        const baseWhere = target.organizationId
            ? { organizationId: target.organizationId }
            : { allianceId: target.allianceId };
        const [total, pending, read, replied, archived, spam, lastWeek] = await Promise.all([
            this.contactRepository.count({ where: baseWhere }),
            this.contactRepository.count({
                where: { ...baseWhere, status: ContactRequest_1.ContactRequestStatus.PENDING },
            }),
            this.contactRepository.count({ where: { ...baseWhere, status: ContactRequest_1.ContactRequestStatus.READ } }),
            this.contactRepository.count({
                where: { ...baseWhere, status: ContactRequest_1.ContactRequestStatus.REPLIED },
            }),
            this.contactRepository.count({
                where: { ...baseWhere, status: ContactRequest_1.ContactRequestStatus.ARCHIVED },
            }),
            this.contactRepository.count({ where: { ...baseWhere, status: ContactRequest_1.ContactRequestStatus.SPAM } }),
            this.contactRepository
                .createQueryBuilder('request')
                .where(target.organizationId
                ? 'request.organizationId = :targetId'
                : 'request.allianceId = :targetId', { targetId: target.organizationId || target.allianceId })
                .andWhere('request.createdAt >= :oneWeekAgo', { oneWeekAgo })
                .getCount(),
        ]);
        return {
            total,
            pending,
            read,
            replied,
            archived,
            spam,
            lastWeek,
        };
    }
    async getOrganizationPendingCount(organizationId) {
        return this.contactRepository.count({
            where: { organizationId, status: ContactRequest_1.ContactRequestStatus.PENDING },
        });
    }
    async getAlliancePendingCount(allianceId) {
        return this.contactRepository.count({
            where: { allianceId, status: ContactRequest_1.ContactRequestStatus.PENDING },
        });
    }
    getContactTypeOptions() {
        return ['general', 'recruitment', 'partnership', 'question', 'feedback', 'other'];
    }
    getStatusOptions() {
        return Object.values(ContactRequest_1.ContactRequestStatus);
    }
    getTargetTypeOptions() {
        return Object.values(ContactRequest_1.ContactTargetType);
    }
    async getUserSentMessages(userId, pagination) {
        const page = pagination?.page || 1;
        const limit = pagination?.limit || 20;
        const queryBuilder = this.contactRepository
            .createQueryBuilder('request')
            .leftJoinAndSelect('request.organization', 'organization')
            .where('request.senderUserId = :userId', { userId })
            .andWhere('request.status != :archivedStatus', {
            archivedStatus: ContactRequest_1.ContactRequestStatus.ARCHIVED,
        })
            .orderBy('request.createdAt', 'DESC')
            .skip((page - 1) * limit)
            .take(limit);
        const [requests, total] = await queryBuilder.getManyAndCount();
        const allianceIds = [...new Set(requests.filter(r => r.allianceId).map(r => r.allianceId))];
        const allianceNameMap = new Map();
        if (allianceIds.length > 0) {
            const alliances = await this.federationRepository
                .createQueryBuilder('federation')
                .select(['federation.id', 'federation.name'])
                .where('federation.id IN (:...ids)', { ids: allianceIds })
                .getMany();
            for (const a of alliances) {
                allianceNameMap.set(a.id, a.name);
            }
        }
        const data = requests.map(request => ({
            id: request.id,
            targetType: request.targetType,
            organizationId: request.organizationId,
            organizationName: request.organization?.name,
            allianceId: request.allianceId,
            allianceName: request.allianceId ? allianceNameMap.get(request.allianceId) : undefined,
            senderUserId: request.senderUserId,
            senderName: request.senderName,
            senderEmail: request.senderEmail,
            rsiHandle: request.rsiHandle,
            discordUsername: request.discordUsername,
            subject: (0, encryptionTransformer_1.resolveDecryptedDisplayText)(request.subject),
            message: (0, encryptionTransformer_1.resolveDecryptedDisplayText)(request.message),
            contactType: request.contactType,
            status: request.status,
            internalNotes: undefined,
            handledBy: request.handledBy,
            handledAt: request.handledAt,
            createdAt: request.createdAt,
            updatedAt: request.updatedAt,
        }));
        return {
            data,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
                hasNext: page < Math.ceil(total / limit),
                hasPrev: page > 1,
            },
        };
    }
    async archiveUserMessage(requestId, userId) {
        const result = await this.contactRepository.update({ id: requestId, senderUserId: userId }, { status: ContactRequest_1.ContactRequestStatus.ARCHIVED });
        const archived = (result.affected ?? 0) > 0;
        if (archived) {
            logger_1.logger.info(`Contact request ${requestId} archived by sender ${userId}`);
        }
        return archived;
    }
    async deleteUserMessage(requestId, userId) {
        const result = await this.contactRepository.delete({
            id: requestId,
            senderUserId: userId,
        });
        const deleted = (result.affected ?? 0) > 0;
        if (deleted) {
            logger_1.logger.info(`Contact request ${requestId} deleted by sender ${userId}`);
        }
        return deleted;
    }
    async getUserContactRequest(requestId, userId) {
        const request = await this.contactRepository.findOne({
            where: { id: requestId, senderUserId: userId },
            relations: ['organization'],
        });
        if (!request) {
            return null;
        }
        let allianceName;
        if (request.allianceId) {
            const alliance = await this.federationRepository.findOne({
                where: { id: request.allianceId },
                select: ['id', 'name'],
            });
            allianceName = alliance?.name;
        }
        return {
            id: request.id,
            targetType: request.targetType,
            organizationId: request.organizationId,
            allianceId: request.allianceId,
            senderUserId: request.senderUserId,
            senderName: request.senderName,
            senderEmail: request.senderEmail,
            rsiHandle: request.rsiHandle,
            discordUsername: request.discordUsername,
            subject: (0, encryptionTransformer_1.resolveDecryptedDisplayText)(request.subject),
            message: (0, encryptionTransformer_1.resolveDecryptedDisplayText)(request.message),
            contactType: request.contactType,
            status: request.status,
            internalNotes: undefined,
            handledBy: request.handledBy,
            handledAt: request.handledAt,
            createdAt: request.createdAt,
            updatedAt: request.updatedAt,
            organizationName: request.organization?.name,
            allianceName,
        };
    }
    async addReply(input) {
        const contactRequest = await this.contactRepository.findOne({
            where: { id: input.contactRequestId },
        });
        if (!contactRequest) {
            throw new apiErrors_1.NotFoundError('Contact request');
        }
        if (!input.isOrgReply && contactRequest.senderUserId !== input.senderUserId) {
            throw new apiErrors_1.ForbiddenError('You do not have access to reply to this contact request');
        }
        const reply = this.replyRepository.create({
            contactRequestId: input.contactRequestId,
            senderUserId: input.senderUserId,
            message: input.message,
            isOrgReply: input.isOrgReply,
        });
        const saved = await this.replyRepository.save(reply);
        if (input.isOrgReply && contactRequest.status !== ContactRequest_1.ContactRequestStatus.REPLIED) {
            contactRequest.status = ContactRequest_1.ContactRequestStatus.REPLIED;
            contactRequest.handledBy = input.senderUserId;
            contactRequest.handledAt = new Date();
            await this.contactRepository.save(contactRequest);
        }
        try {
            if (input.isOrgReply && contactRequest.senderUserId) {
                (0, notificationWebSocketController_1.sendUserNotification)(contactRequest.senderUserId, {
                    type: 'info',
                    title: 'New Reply to Your Message',
                    message: `Your "${contactRequest.subject}" inquiry received a reply`,
                    category: 'organization',
                    data: { contactRequestId: contactRequest.id },
                    actionUrl: `/inbox/${contactRequest.id}`,
                });
            }
            else if (!input.isOrgReply && contactRequest.organizationId) {
                (0, notificationWebSocketController_1.sendOrganizationNotification)(contactRequest.organizationId, {
                    type: 'info',
                    title: 'New Reply on Contact Request',
                    message: `${contactRequest.senderName} replied to "${contactRequest.subject}"`,
                    category: 'organization',
                    data: { contactRequestId: contactRequest.id },
                    actionUrl: `/settings/contact-requests/${contactRequest.id}`,
                });
            }
        }
        catch (error_) {
            logger_1.logger.warn('Failed to send reply notification', { error: error_ });
        }
        logger_1.logger.info(`Reply ${saved.id} added to contact request ${input.contactRequestId}`);
        const replyWithSender = await this.replyRepository.findOne({
            where: { id: saved.id },
            relations: ['senderUser'],
        });
        return replyWithSender ?? saved;
    }
    async getReplies(contactRequestId) {
        const replies = await this.replyRepository.find({
            where: { contactRequestId },
            relations: ['senderUser'],
            order: { createdAt: 'ASC' },
        });
        return replies.map(reply => ({
            id: reply.id,
            contactRequestId: reply.contactRequestId,
            senderUserId: reply.senderUserId,
            senderUsername: reply.senderUser?.username,
            senderAvatar: reply.senderUser?.avatar ?? undefined,
            message: (0, encryptionTransformer_1.resolveDecryptedDisplayText)(reply.message),
            isOrgReply: reply.isOrgReply,
            createdAt: reply.createdAt,
        }));
    }
    async getUserInboxUnreadCount(userId, organizationId) {
        let count = 0;
        if (organizationId) {
            count += await this.contactRepository.count({
                where: {
                    organizationId,
                    status: ContactRequest_1.ContactRequestStatus.PENDING,
                },
            });
        }
        const sentRequests = await this.contactRepository.find({
            where: { senderUserId: userId, status: ContactRequest_1.ContactRequestStatus.REPLIED },
        });
        count += sentRequests.length;
        return count;
    }
}
exports.ContactRequestService = ContactRequestService;
//# sourceMappingURL=ContactRequestService.js.map