"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TicketService = void 0;
const node_crypto_1 = __importDefault(require("node:crypto"));
const typeorm_1 = require("typeorm");
const data_source_1 = require("../../../data-source");
const DiscordGuildSettings_1 = require("../../../models/DiscordGuildSettings");
const Ticket_1 = require("../../../models/Ticket");
const apiErrors_1 = require("../../../utils/apiErrors");
const logger_1 = require("../../../utils/logger");
const TicketRoutingService_1 = require("./TicketRoutingService");
class TicketService {
    static instance = null;
    static getInstance() {
        TicketService.instance ??= new TicketService();
        return TicketService.instance;
    }
    ticketRepository;
    discordSettingsRepository;
    supportWebhookUrl = process.env.SUPPORT_DISCORD_WEBHOOK_URL;
    supportInviteUrl = process.env.SUPPORT_DISCORD_INVITE_URL || 'https://discord.gg/kHbbNZqdUY';
    constructor() {
        this.ticketRepository = data_source_1.AppDataSource.getRepository(Ticket_1.Ticket);
        this.discordSettingsRepository = data_source_1.AppDataSource.getRepository(DiscordGuildSettings_1.DiscordGuildSettings);
    }
    async generateTicketNumber() {
        const rows = await this.ticketRepository.query("SELECT TO_CHAR(nextval('ticket_number_seq'), 'FM000000') AS num");
        return `TKT-${rows[0].num}`;
    }
    async createTicket(organizationId, dto) {
        const ticketNumber = await this.generateTicketNumber();
        try {
            return await this.createTicketForAttempt(organizationId, dto, ticketNumber);
        }
        catch (error) {
            if (this.isDuplicateTicketError(error)) {
                logger_1.logger.warn(`Ticket number ${ticketNumber} sequence collision (unexpected), retrying once`, {
                    ticketNumber,
                });
                const retryNumber = await this.generateTicketNumber();
                return this.createTicketForAttempt(organizationId, dto, retryNumber);
            }
            throw error;
        }
    }
    async createTicketForAttempt(organizationId, dto, ticketNumber) {
        const ticket = this.ticketRepository.create({
            ticketNumber,
            organizationId,
            subject: dto.subject,
            description: dto.description,
            category: dto.category,
            priority: dto.priority ?? Ticket_1.TicketPriority.MEDIUM,
            status: Ticket_1.TicketStatus.OPEN,
            creatorId: dto.creatorId,
            creatorName: dto.creatorName,
            creatorDiscordId: dto.creatorDiscordId,
            creatorEmail: dto.creatorEmail,
            recipientType: dto.recipientType,
            recipientId: dto.recipientId,
            recipientName: dto.recipientName,
            tags: dto.tags ?? [],
            relatedRecruitmentId: dto.relatedRecruitmentId,
            relatedDiplomacyId: dto.relatedDiplomacyId,
            relatedApplicationId: dto.relatedApplicationId,
            discordSettings: dto.discordSettings,
            messages: [],
            assignmentHistory: [],
        });
        await this.ticketRepository.save(ticket);
        const reloaded = await this.ticketRepository.findOne({ where: { ticketNumber } });
        if (!reloaded) {
            throw new Error(`Ticket ${ticketNumber} saved but not found on reload`);
        }
        await this.applyAutoRouting(organizationId, reloaded);
        await this.postTechnicalTicketToSupportDiscord(reloaded);
        logger_1.logger.info(`Ticket created: ${reloaded.ticketNumber} (${reloaded.id})`);
        return reloaded;
    }
    async postTechnicalTicketToSupportDiscord(ticket) {
        const technicalCategories = new Set([
            Ticket_1.TicketCategory.HR,
            Ticket_1.TicketCategory.RECRUITMENT,
            Ticket_1.TicketCategory.DIPLOMACY,
            Ticket_1.TicketCategory.SUPPORT,
        ]);
        if (!technicalCategories.has(ticket.category)) {
            return;
        }
        const supportConfig = await this.resolveSupportDiscordConfig(ticket.organizationId);
        if (!supportConfig.webhookUrl) {
            return;
        }
        const frontendBaseUrl = process.env.FRONTEND_URL || process.env.FRONTEND_PUBLIC_URL || '';
        const ticketUrl = frontendBaseUrl
            ? `${frontendBaseUrl.replace(/\/$/, '')}/inbox?tab=tickets`
            : '/inbox?tab=tickets';
        const content = [
            'New technical ticket received',
            `Ticket: ${ticket.ticketNumber}`,
            `Category: ${ticket.category}`,
            `Subject: ${ticket.subject}`,
            `Created by: ${ticket.creatorName}`,
            `Open queue: ${ticketUrl}`,
            `Support invite: ${supportConfig.inviteUrl}`,
        ].join('\n');
        try {
            const response = await fetch(supportConfig.webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: content.slice(0, 2000) }),
            });
            if (!response.ok) {
                const errorBody = await response.text();
                logger_1.logger.warn('Support Discord webhook post failed', {
                    status: response.status,
                    ticketNumber: ticket.ticketNumber,
                    body: errorBody,
                });
            }
        }
        catch (error) {
            logger_1.logger.warn('Support Discord webhook post threw an error', {
                ticketNumber: ticket.ticketNumber,
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }
    async resolveSupportDiscordConfig(organizationId) {
        try {
            const guildSettings = await this.discordSettingsRepository.find({
                where: { organizationId },
            });
            const primary = this.selectPrimarySupportGuildSettings(guildSettings);
            return {
                webhookUrl: primary?.ticketSettings?.supportWebhookUrl || this.supportWebhookUrl,
                inviteUrl: primary?.ticketSettings?.supportInviteUrl || this.supportInviteUrl,
            };
        }
        catch (error) {
            logger_1.logger.warn('Failed to load support Discord config from guild settings; falling back to env', {
                organizationId,
                error: error instanceof Error ? error.message : String(error),
            });
            return {
                webhookUrl: this.supportWebhookUrl,
                inviteUrl: this.supportInviteUrl,
            };
        }
    }
    selectPrimarySupportGuildSettings(guildSettings) {
        if (guildSettings.length === 0) {
            return undefined;
        }
        const explicitPrimaryGuildId = guildSettings
            .map(settings => settings.ticketSettings?.supportServerGuildId?.trim())
            .find((guildId) => Boolean(guildId));
        if (explicitPrimaryGuildId) {
            const explicitPrimary = guildSettings.find(settings => settings.guildId === explicitPrimaryGuildId);
            if (explicitPrimary) {
                return explicitPrimary;
            }
        }
        const scored = guildSettings
            .filter(settings => Boolean(settings.ticketSettings))
            .map(settings => {
            const ticketSettings = settings.ticketSettings;
            const score = (ticketSettings?.enabled ? 1 : 0) +
                (ticketSettings?.supportWebhookUrl ? 2 : 0) +
                (ticketSettings?.supportInviteUrl ? 1 : 0);
            return { settings, score };
        })
            .sort((a, b) => {
            if (b.score !== a.score) {
                return b.score - a.score;
            }
            return b.settings.updatedAt.getTime() - a.settings.updatedAt.getTime();
        });
        return scored[0]?.settings;
    }
    isDuplicateTicketError(error) {
        return (error instanceof Error &&
            (error.message.includes('duplicate key') ||
                error.message.includes('unique constraint') ||
                error.message.includes('UNIQUE')));
    }
    async applyAutoRouting(organizationId, ticket) {
        try {
            const routingResult = await TicketRoutingService_1.TicketRoutingService.getInstance().evaluateTicketAsync(organizationId, {
                category: ticket.category,
                priority: ticket.priority,
                subject: ticket.subject,
                description: ticket.description,
                tags: ticket.tags ?? [],
                creatorId: ticket.creatorId,
                creatorDiscordId: ticket.creatorDiscordId,
                creatorEmail: ticket.creatorEmail,
            });
            if (!routingResult.matched) {
                return;
            }
            const hasChanges = this.applyRoutingResultToTicket(ticket, routingResult);
            if (hasChanges) {
                await this.ticketRepository.save(ticket);
            }
        }
        catch (routingError) {
            logger_1.logger.warn('Ticket routing evaluation failed; ticket created without auto-routing', {
                ticketNumber: ticket.ticketNumber,
                error: routingError instanceof Error ? routingError.message : String(routingError),
            });
        }
    }
    applyRoutingResultToTicket(ticket, routingResult) {
        let hasChanges = false;
        if (routingResult.newPriority && routingResult.newPriority !== ticket.priority) {
            ticket.priority = routingResult.newPriority;
            hasChanges = true;
        }
        if (routingResult.additionalTags.length > 0) {
            ticket.tags = Array.from(new Set([...(ticket.tags ?? []), ...routingResult.additionalTags]));
            hasChanges = true;
        }
        if (routingResult.assigneeRole) {
            const normalizedRoleTag = `auto-role:${routingResult.assigneeRole
                .toLowerCase()
                .replace(/\s+/g, '-')}`;
            ticket.tags = Array.from(new Set([...(ticket.tags ?? []), normalizedRoleTag]));
            hasChanges = true;
        }
        if (routingResult.shouldEscalate) {
            ticket.tags = Array.from(new Set([...(ticket.tags ?? []), 'escalated:auto-routing']));
            hasChanges = true;
        }
        if (routingResult.assigneeId) {
            this.applyRoutingAssignment(ticket, routingResult.assigneeId);
            hasChanges = true;
        }
        if (routingResult.autoResponseMessage) {
            ticket.messages = [
                ...(ticket.messages ?? []),
                {
                    id: node_crypto_1.default.randomUUID(),
                    authorId: 'routing-engine',
                    authorName: 'Routing Engine',
                    content: routingResult.autoResponseMessage,
                    createdAt: new Date(),
                    isInternal: false,
                },
            ];
            hasChanges = true;
        }
        return hasChanges;
    }
    applyRoutingAssignment(ticket, assigneeId) {
        ticket.assigneeId = assigneeId;
        ticket.assigneeName = ticket.assigneeName ?? 'Auto Routed';
        ticket.assignmentHistory = [
            ...(ticket.assignmentHistory ?? []),
            {
                assigneeId,
                assigneeName: ticket.assigneeName,
                assignedAt: new Date(),
                assignedBy: 'routing-engine',
            },
        ];
        if (ticket.status === Ticket_1.TicketStatus.OPEN) {
            ticket.status = Ticket_1.TicketStatus.IN_PROGRESS;
        }
    }
    async getTicketById(id) {
        return this.ticketRepository.findOne({
            where: { id },
        });
    }
    async getTicketByNumber(ticketNumber) {
        return this.ticketRepository.findOne({
            where: { ticketNumber },
        });
    }
    async updateTicket(id, dto, updatedBy) {
        const ticket = await this.getTicketById(id);
        if (!ticket) {
            throw new apiErrors_1.NotFoundError('Ticket');
        }
        if (dto.assigneeId && dto.assigneeId !== ticket.assigneeId) {
            ticket.assignmentHistory = [
                ...(ticket.assignmentHistory ?? []),
                {
                    assigneeId: dto.assigneeId,
                    assigneeName: dto.assigneeName ?? 'Unknown',
                    assignedAt: new Date(),
                    assignedBy: updatedBy ?? 'system',
                },
            ];
        }
        if (dto.subject !== undefined) {
            ticket.subject = dto.subject;
        }
        if (dto.description !== undefined) {
            ticket.description = dto.description;
        }
        if (dto.category !== undefined) {
            ticket.category = dto.category;
        }
        if (dto.priority !== undefined) {
            ticket.priority = dto.priority;
        }
        if (dto.status !== undefined) {
            ticket.status = dto.status;
        }
        if (dto.assigneeId !== undefined) {
            ticket.assigneeId = dto.assigneeId;
        }
        if (dto.assigneeName !== undefined) {
            ticket.assigneeName = dto.assigneeName;
        }
        if (dto.tags !== undefined) {
            ticket.tags = dto.tags;
        }
        if (dto.dueDate !== undefined) {
            ticket.dueDate = dto.dueDate;
        }
        const updatedTicket = await this.ticketRepository.save(ticket);
        logger_1.logger.info(`Ticket updated: ${ticket.ticketNumber}`);
        return updatedTicket;
    }
    buildStatusFilter(filters) {
        if (filters.isOpen !== undefined) {
            return filters.isOpen
                ? (0, typeorm_1.In)([Ticket_1.TicketStatus.OPEN, Ticket_1.TicketStatus.IN_PROGRESS, Ticket_1.TicketStatus.AWAITING_RESPONSE])
                : (0, typeorm_1.In)([Ticket_1.TicketStatus.RESOLVED, Ticket_1.TicketStatus.CLOSED]);
        }
        if (filters.status) {
            return Array.isArray(filters.status) ? (0, typeorm_1.In)(filters.status) : filters.status;
        }
        return undefined;
    }
    async searchTickets(organizationId, filters, page = 1, limit = 20) {
        const baseWhere = this.buildBaseSearchWhere(organizationId, filters);
        logger_1.logger.debug('searchTickets: baseWhere constructed', {
            organizationId,
            baseWhere: JSON.stringify(baseWhere, null, 2),
            filters: JSON.stringify(filters, null, 2),
        });
        const where = this.buildSearchWhereWithVisibility(baseWhere, filters);
        logger_1.logger.debug('searchTickets: visibility where clause constructed', {
            organizationId,
            whereType: Array.isArray(where) ? 'OR[] array' : 'single object',
            where: JSON.stringify(where, null, 2),
        });
        const skip = (page - 1) * limit;
        const [tickets, total] = await this.ticketRepository.findAndCount({
            where,
            order: { createdAt: 'DESC' },
            skip,
            take: limit,
        });
        logger_1.logger.debug('searchTickets: query executed', {
            organizationId,
            ticketsFound: tickets.length,
            total,
            page,
            limit,
            skip,
        });
        return {
            tickets,
            total,
            page,
            totalPages: Math.ceil(total / limit),
        };
    }
    buildBaseSearchWhere(organizationId, filters) {
        const baseWhere = { organizationId };
        const statusFilter = this.buildStatusFilter(filters);
        if (statusFilter) {
            baseWhere.status = statusFilter;
        }
        if (filters.category) {
            baseWhere.category = filters.category;
        }
        if (filters.priority) {
            baseWhere.priority = filters.priority;
        }
        if (filters.assigneeId) {
            baseWhere.assigneeId = filters.assigneeId;
        }
        if (filters.searchTerm) {
            baseWhere.subject = (0, typeorm_1.Like)(`%${filters.searchTerm}%`);
        }
        if (filters.createdAfter) {
            baseWhere.createdAt = (0, typeorm_1.MoreThanOrEqual)(filters.createdAfter);
        }
        if (filters.createdBefore) {
            baseWhere.createdAt = (0, typeorm_1.LessThanOrEqual)(filters.createdBefore);
        }
        return baseWhere;
    }
    buildSearchWhereWithVisibility(baseWhere, filters) {
        if (!filters.visibleToUserId) {
            return this.buildSearchWhereWithoutVisibility(baseWhere, filters);
        }
        const visibilityBase = { ...baseWhere };
        const where = [
            { ...visibilityBase, creatorId: filters.visibleToUserId },
            { ...visibilityBase, recipientId: filters.visibleToUserId },
            { ...visibilityBase, assigneeId: filters.visibleToUserId },
        ];
        if (filters.visibleToDiscordId) {
            where.push({ ...visibilityBase, creatorDiscordId: filters.visibleToDiscordId });
        }
        if (filters.visibleToRecipientTypes?.length) {
            where.push({ ...visibilityBase, recipientType: (0, typeorm_1.In)(filters.visibleToRecipientTypes) });
        }
        if (filters.creatorDiscordId && filters.creatorDiscordId !== filters.visibleToDiscordId) {
            for (const branch of where) {
                branch.creatorDiscordId = filters.creatorDiscordId;
            }
        }
        return where;
    }
    buildSearchWhereWithoutVisibility(baseWhere, filters) {
        const where = { ...baseWhere };
        if (filters.creatorDiscordId) {
            where.creatorDiscordId = filters.creatorDiscordId;
        }
        if (filters.creatorId) {
            where.creatorId = filters.creatorId;
        }
        return where;
    }
    async addMessage(ticketId, dto) {
        const ticket = await this.getTicketById(ticketId);
        if (!ticket) {
            throw new apiErrors_1.NotFoundError('Ticket');
        }
        const message = {
            id: node_crypto_1.default.randomUUID(),
            authorId: dto.authorId,
            authorName: dto.authorName,
            content: dto.content,
            createdAt: new Date(),
            isInternal: dto.isInternal ?? false,
            attachments: dto.attachments,
        };
        ticket.messages = [...(ticket.messages ?? []), message];
        if (!ticket.firstResponseAt && ticket.creatorId !== dto.authorId) {
            ticket.firstResponseAt = new Date();
        }
        if (ticket.status === Ticket_1.TicketStatus.AWAITING_RESPONSE && ticket.creatorId === dto.authorId) {
            ticket.status = Ticket_1.TicketStatus.OPEN;
        }
        const updatedTicket = await this.ticketRepository.save(ticket);
        logger_1.logger.info(`Message added to ticket: ${ticket.ticketNumber}`);
        return updatedTicket;
    }
    async assignTicket(ticketId, assigneeId, assigneeName, assignedBy) {
        const ticket = await this.getTicketById(ticketId);
        if (!ticket) {
            throw new apiErrors_1.NotFoundError('Ticket');
        }
        ticket.assigneeId = assigneeId;
        ticket.assigneeName = assigneeName;
        ticket.assignmentHistory = [
            ...(ticket.assignmentHistory ?? []),
            {
                assigneeId,
                assigneeName,
                assignedAt: new Date(),
                assignedBy,
            },
        ];
        if (ticket.status === Ticket_1.TicketStatus.OPEN) {
            ticket.status = Ticket_1.TicketStatus.IN_PROGRESS;
        }
        const updatedTicket = await this.ticketRepository.save(ticket);
        logger_1.logger.info(`Ticket assigned: ${ticket.ticketNumber} -> ${assigneeName}`);
        return updatedTicket;
    }
    async resolveTicket(ticketId, dto) {
        const ticket = await this.getTicketById(ticketId);
        if (!ticket) {
            throw new apiErrors_1.NotFoundError('Ticket');
        }
        ticket.status = Ticket_1.TicketStatus.RESOLVED;
        ticket.resolution = dto.resolution;
        ticket.resolvedAt = new Date();
        ticket.resolvedBy = dto.resolvedBy;
        const updatedTicket = await this.ticketRepository.save(ticket);
        logger_1.logger.info(`Ticket resolved: ${ticket.ticketNumber}`);
        return updatedTicket;
    }
    async closeTicket(ticketId) {
        const ticket = await this.getTicketById(ticketId);
        if (!ticket) {
            throw new apiErrors_1.NotFoundError('Ticket');
        }
        ticket.status = Ticket_1.TicketStatus.CLOSED;
        ticket.closedAt = new Date();
        const updatedTicket = await this.ticketRepository.save(ticket);
        logger_1.logger.info(`Ticket closed: ${ticket.ticketNumber}`);
        return updatedTicket;
    }
    async reopenTicket(ticketId) {
        const ticket = await this.getTicketById(ticketId);
        if (!ticket) {
            throw new apiErrors_1.NotFoundError('Ticket');
        }
        ticket.status = Ticket_1.TicketStatus.OPEN;
        ticket.closedAt = undefined;
        ticket.resolvedAt = undefined;
        const updatedTicket = await this.ticketRepository.save(ticket);
        logger_1.logger.info(`Ticket reopened: ${ticket.ticketNumber}`);
        return updatedTicket;
    }
    async addFeedback(ticketId, rating, feedback) {
        const ticket = await this.getTicketById(ticketId);
        if (!ticket) {
            throw new apiErrors_1.NotFoundError('Ticket');
        }
        if (rating < 1 || rating > 5) {
            throw new apiErrors_1.ValidationError('Rating must be between 1 and 5');
        }
        ticket.satisfactionRating = rating;
        if (feedback) {
            ticket.feedback = feedback;
        }
        const updatedTicket = await this.ticketRepository.save(ticket);
        logger_1.logger.info(`Feedback added to ticket: ${ticket.ticketNumber}`);
        return updatedTicket;
    }
    async updateDiscordSettings(ticketId, settings) {
        const ticket = await this.getTicketById(ticketId);
        if (!ticket) {
            throw new apiErrors_1.NotFoundError('Ticket');
        }
        ticket.discordSettings = settings;
        if (settings.channelId) {
            ticket.discordChannelId = settings.channelId;
        }
        if (settings.threadId) {
            ticket.discordThreadId = settings.threadId;
        }
        const updatedTicket = await this.ticketRepository.save(ticket);
        logger_1.logger.info(`Discord settings updated for ticket: ${ticket.ticketNumber}`);
        return updatedTicket;
    }
    async getTicketByDiscordThread(threadId) {
        return this.ticketRepository.findOne({
            where: { discordThreadId: threadId },
        });
    }
    async getTicketStats(organizationId) {
        const tickets = await this.ticketRepository.find({
            where: { organizationId },
        });
        const stats = {
            total: tickets.length,
            open: 0,
            inProgress: 0,
            resolved: 0,
            closed: 0,
            byCategory: {
                [Ticket_1.TicketCategory.HR]: 0,
                [Ticket_1.TicketCategory.RECRUITMENT]: 0,
                [Ticket_1.TicketCategory.DIPLOMACY]: 0,
                [Ticket_1.TicketCategory.GENERAL]: 0,
                [Ticket_1.TicketCategory.SUPPORT]: 0,
            },
            byPriority: {
                [Ticket_1.TicketPriority.LOW]: 0,
                [Ticket_1.TicketPriority.MEDIUM]: 0,
                [Ticket_1.TicketPriority.HIGH]: 0,
                [Ticket_1.TicketPriority.URGENT]: 0,
            },
            averageResponseTimeMs: null,
            averageSatisfactionRating: null,
        };
        let totalResponseTime = 0;
        let responseCount = 0;
        let totalRating = 0;
        let ratingCount = 0;
        for (const ticket of tickets) {
            switch (ticket.status) {
                case Ticket_1.TicketStatus.OPEN:
                case Ticket_1.TicketStatus.AWAITING_RESPONSE:
                    stats.open++;
                    break;
                case Ticket_1.TicketStatus.IN_PROGRESS:
                case Ticket_1.TicketStatus.ON_HOLD:
                    stats.inProgress++;
                    break;
                case Ticket_1.TicketStatus.RESOLVED:
                    stats.resolved++;
                    break;
                case Ticket_1.TicketStatus.CLOSED:
                    stats.closed++;
                    break;
            }
            stats.byCategory[ticket.category]++;
            stats.byPriority[ticket.priority]++;
            if (ticket.firstResponseAt) {
                totalResponseTime += ticket.firstResponseAt.getTime() - ticket.createdAt.getTime();
                responseCount++;
            }
            if (ticket.satisfactionRating) {
                totalRating += ticket.satisfactionRating;
                ratingCount++;
            }
        }
        if (responseCount > 0) {
            stats.averageResponseTimeMs = totalResponseTime / responseCount;
        }
        if (ratingCount > 0) {
            stats.averageSatisfactionRating = totalRating / ratingCount;
        }
        return stats;
    }
    async deleteTicket(ticketId) {
        const ticket = await this.getTicketById(ticketId);
        if (!ticket) {
            throw new apiErrors_1.NotFoundError('Ticket');
        }
        await this.ticketRepository.remove(ticket);
        logger_1.logger.info(`Ticket deleted: ${ticket.ticketNumber}`);
    }
}
exports.TicketService = TicketService;
//# sourceMappingURL=TicketService.js.map