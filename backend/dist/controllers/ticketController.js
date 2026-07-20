"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TicketController = void 0;
exports.resolveVisibleRecipientTypesForOrgRole = resolveVisibleRecipientTypesForOrgRole;
exports.canUserResolveTicket = canUserResolveTicket;
const data_source_1 = require("../data-source");
const OrganizationMembership_1 = require("../models/OrganizationMembership");
const Ticket_1 = require("../models/Ticket");
const User_1 = require("../models/User");
const TicketRoutingService_1 = require("../services/communication/tickets/TicketRoutingService");
const TicketService_1 = require("../services/communication/tickets/TicketService");
const apiErrors_1 = require("../utils/apiErrors");
const logger_1 = require("../utils/logger");
const roleUtils_1 = require("../utils/roleUtils");
const BaseController_1 = require("./BaseController");
function isUserAdmin(user) {
    return user?.role === 'admin' || user?.role === 'superadmin';
}
function isUserOrgAdmin(user) {
    return user?.role === 'admin' || user?.role === 'org_admin' || user?.role === 'superadmin';
}
const ROLE_RECIPIENT_MAP = {
    senior_officer: [
        Ticket_1.TicketRecipientType.ORG_LEADERSHIP,
        Ticket_1.TicketRecipientType.ORG_OFFICERS,
        Ticket_1.TicketRecipientType.HR_DEPARTMENT,
        Ticket_1.TicketRecipientType.RECRUITMENT,
        Ticket_1.TicketRecipientType.DIPLOMACY,
        Ticket_1.TicketRecipientType.PLATFORM_ADMIN,
    ],
    officer: [
        Ticket_1.TicketRecipientType.ORG_LEADERSHIP,
        Ticket_1.TicketRecipientType.ORG_OFFICERS,
        Ticket_1.TicketRecipientType.HR_DEPARTMENT,
        Ticket_1.TicketRecipientType.RECRUITMENT,
        Ticket_1.TicketRecipientType.DIPLOMACY,
        Ticket_1.TicketRecipientType.PLATFORM_ADMIN,
    ],
    team_leader: [Ticket_1.TicketRecipientType.TEAM_LEADER],
};
const ORG_ADMIN_ROLES = new Set(['owner', 'admin', 'founder', 'org_admin', 'superadmin']);
function normalizeOrgRoleForTicketVisibility(roleName) {
    const normalized = roleName
        .trim()
        .toLowerCase()
        .replace(/[\s-]+/g, '_');
    const aliases = {
        fleet_commander: 'senior_officer',
        org_owner: 'owner',
        org_admin: 'admin',
    };
    return aliases[normalized] ?? normalized;
}
function resolveVisibleRecipientTypesForOrgRole(roleName) {
    const normalizedRole = normalizeOrgRoleForTicketVisibility(roleName);
    return ROLE_RECIPIENT_MAP[normalizedRole];
}
const BOT_RECIPIENT_CATEGORY_MAP = {
    [Ticket_1.TicketRecipientType.HR_DEPARTMENT]: Ticket_1.TicketCategory.HR,
    [Ticket_1.TicketRecipientType.RECRUITMENT]: Ticket_1.TicketCategory.RECRUITMENT,
    [Ticket_1.TicketRecipientType.DIPLOMACY]: Ticket_1.TicketCategory.DIPLOMACY,
};
const TECHNICAL_CATEGORY_RECIPIENT_MAP = {
    [Ticket_1.TicketCategory.HR]: Ticket_1.TicketRecipientType.HR_DEPARTMENT,
    [Ticket_1.TicketCategory.RECRUITMENT]: Ticket_1.TicketRecipientType.RECRUITMENT,
    [Ticket_1.TicketCategory.DIPLOMACY]: Ticket_1.TicketRecipientType.DIPLOMACY,
    [Ticket_1.TicketCategory.SUPPORT]: Ticket_1.TicketRecipientType.PLATFORM_ADMIN,
    [Ticket_1.TicketCategory.GENERAL]: Ticket_1.TicketRecipientType.ORG_LEADERSHIP,
};
function validateCategoryRecipientRouting(category, recipientType) {
    const expectedRecipient = TECHNICAL_CATEGORY_RECIPIENT_MAP[category];
    if (category === Ticket_1.TicketCategory.GENERAL) {
        return;
    }
    if (recipientType !== expectedRecipient) {
        throw new apiErrors_1.ValidationError(`Category ${category} must be routed to recipient type ${expectedRecipient}`);
    }
}
function canUserResolveTicket(ticket, user) {
    const userId = user?.id;
    if (!userId) {
        return false;
    }
    return (ticket.creatorId === userId ||
        ticket.assigneeId === userId ||
        isUserAdmin(user) ||
        isUserOrgAdmin(user));
}
async function applyVisibilityFilter(filters, userId, organizationId, requestDiscordId) {
    const membership = await data_source_1.AppDataSource.getRepository(OrganizationMembership_1.OrganizationMembership).findOne({
        where: { organizationId, userId, isActive: true },
    });
    const rawOrgRole = (0, roleUtils_1.getRoleName)(membership?.role);
    const orgRole = normalizeOrgRoleForTicketVisibility(rawOrgRole);
    if (ORG_ADMIN_ROLES.has(orgRole)) {
        logger_1.logger.debug('applyVisibilityFilter: org admin detected, returning all tickets', {
            userId,
            organizationId,
            orgRole,
        });
        return;
    }
    filters.visibleToUserId = userId;
    const visibleTypes = resolveVisibleRecipientTypesForOrgRole(orgRole);
    if (visibleTypes) {
        filters.visibleToRecipientTypes = visibleTypes;
    }
    try {
        const user = await data_source_1.AppDataSource.getRepository(User_1.User).findOne({
            where: { id: userId },
            select: ['discordId'],
        });
        if (user?.discordId) {
            filters.visibleToDiscordId = user.discordId;
        }
    }
    catch {
    }
    if (!filters.visibleToDiscordId && requestDiscordId) {
        filters.visibleToDiscordId = requestDiscordId;
    }
    logger_1.logger.debug('applyVisibilityFilter: applied visibility filters', {
        userId,
        organizationId,
        rawOrgRole,
        orgRole,
        visibleToUserId: filters.visibleToUserId,
        visibleToDiscordId: filters.visibleToDiscordId,
        visibleToRecipientTypes: filters.visibleToRecipientTypes,
    });
}
class TicketController extends BaseController_1.BaseController {
    ticketService;
    routingService;
    constructor() {
        super();
        this.ticketService = TicketService_1.TicketService.getInstance();
        this.routingService = TicketRoutingService_1.TicketRoutingService.getInstance();
    }
    listTickets = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = req.user?.currentOrganizationId;
            if (!organizationId) {
                throw new apiErrors_1.ValidationError('Organization context required');
            }
            logger_1.logger.debug('listTickets: request start', {
                userId: req.user?.id,
                username: req.user?.username,
                organizationId,
                isBotRequest: typeof req.headers['x-bot-internal-token'] === 'string',
            });
            const { page, limit } = this.getTicketListPagination(req);
            const filters = this.buildTicketListFilters(req);
            await this.applyTicketListVisibility(req, organizationId, filters);
            const result = await this.ticketService.searchTickets(organizationId, filters, page, limit);
            logger_1.logger.debug('listTickets: query results', {
                userId: req.user?.id,
                organizationId,
                ticketsFound: result.tickets.length,
                total: result.total,
                page,
                limit,
            });
            res.json({
                data: result.tickets,
                total: result.total,
                page: result.page,
                limit,
                totalPages: result.totalPages,
            });
        });
    };
    getTicketListPagination(req) {
        return {
            page: Number.parseInt(req.query.page) || 1,
            limit: Math.min(Number.parseInt(req.query.limit) || 20, 200),
        };
    }
    buildTicketListFilters(req) {
        const filters = {};
        if (req.query.category) {
            filters.category = req.query.category;
        }
        if (req.query.status) {
            const status = req.query.status;
            if (status === 'open') {
                filters.isOpen = true;
            }
            else if (status === 'closed') {
                filters.isOpen = false;
            }
            else {
                filters.status = status;
            }
        }
        if (req.query.priority) {
            filters.priority = req.query.priority;
        }
        if (req.query.assigneeId) {
            filters.assigneeId = req.query.assigneeId;
        }
        if (req.query.creatorId) {
            filters.creatorId = req.query.creatorId;
        }
        if (req.query.creatorDiscordId) {
            filters.creatorDiscordId = req.query.creatorDiscordId;
        }
        if (req.query.searchTerm) {
            filters.searchTerm = req.query.searchTerm;
        }
        return filters;
    }
    async applyTicketListVisibility(req, organizationId, filters) {
        if (isUserAdmin(req.user) || !req.user?.id) {
            return;
        }
        const rawDiscordId = req.headers['x-discord-user-id'];
        const requestDiscordId = rawDiscordId && /^\d{17,20}$/.test(rawDiscordId) ? rawDiscordId : undefined;
        await applyVisibilityFilter(filters, req.user.id, organizationId, requestDiscordId);
    }
    createTicket = async (req, res) => {
        await this.execute(req, res, async () => {
            const userId = req.user?.id;
            const userName = req.user?.username;
            const organizationId = req.user?.currentOrganizationId;
            if (!userId || !userName) {
                throw new apiErrors_1.UnauthorizedError('Unauthorized');
            }
            if (!organizationId) {
                throw new apiErrors_1.ValidationError('Organization context required');
            }
            const body = req.body;
            if (!body.recipientType) {
                throw new apiErrors_1.ValidationError('Recipient type is required');
            }
            const isBotRequest = typeof req.headers['x-bot-internal-token'] === 'string' &&
                req.headers['x-bot-internal-token'].length > 0;
            const inferredBotCategory = isBotRequest
                ? BOT_RECIPIENT_CATEGORY_MAP[body.recipientType]
                : undefined;
            const category = body.category === Ticket_1.TicketCategory.GENERAL && inferredBotCategory
                ? inferredBotCategory
                : (body.category ?? inferredBotCategory ?? Ticket_1.TicketCategory.GENERAL);
            validateCategoryRecipientRouting(category, body.recipientType);
            const dto = {
                subject: body.subject,
                description: body.description,
                category,
                priority: body.priority,
                creatorId: userId,
                creatorName: userName,
                creatorDiscordId: body.discordId ?? body.creatorDiscordId,
                creatorEmail: body.email,
                recipientType: body.recipientType,
                recipientId: body.recipientId,
                recipientName: body.recipientName,
                tags: body.tags ?? [],
                relatedRecruitmentId: body.relatedRecruitmentId,
                relatedDiplomacyId: body.relatedDiplomacyId,
                relatedApplicationId: body.relatedApplicationId,
            };
            const ticket = await this.ticketService.createTicket(organizationId, dto);
            res.status(201).json(ticket);
        });
    };
    getTicket = async (req, res) => {
        await this.execute(req, res, async () => {
            const { id } = req.params;
            const userId = req.user?.id;
            const ticket = await this.ticketService.getTicketById(id);
            if (!ticket) {
                throw new apiErrors_1.NotFoundError('Ticket');
            }
            if (ticket.creatorId !== userId &&
                ticket.assigneeId !== userId &&
                !isUserAdmin(req.user) &&
                !isUserOrgAdmin(req.user)) {
                throw new apiErrors_1.ForbiddenError('Not authorized to view this ticket');
            }
            res.json(ticket);
        });
    };
    getTicketByNumber = async (req, res) => {
        await this.execute(req, res, async () => {
            const { ticketNumber } = req.params;
            const userId = req.user?.id;
            const ticket = await this.ticketService.getTicketByNumber(ticketNumber.toUpperCase());
            if (!ticket) {
                throw new apiErrors_1.NotFoundError('Ticket');
            }
            if (ticket.creatorId !== userId &&
                ticket.assigneeId !== userId &&
                !isUserAdmin(req.user) &&
                !isUserOrgAdmin(req.user)) {
                throw new apiErrors_1.ForbiddenError('Not authorized to view this ticket');
            }
            res.json(ticket);
        });
    };
    updateTicket = async (req, res) => {
        await this.execute(req, res, async () => {
            const { id } = req.params;
            const userId = req.user?.id;
            if (!userId) {
                throw new apiErrors_1.UnauthorizedError('Unauthorized');
            }
            const ticket = await this.ticketService.getTicketById(id);
            if (!ticket) {
                throw new apiErrors_1.NotFoundError('Ticket');
            }
            if (ticket.assigneeId !== userId && !isUserAdmin(req.user) && !isUserOrgAdmin(req.user)) {
                throw new apiErrors_1.ForbiddenError('Not authorized to update this ticket');
            }
            const body = req.body;
            const updateFields = {};
            if (body.subject !== undefined) {
                updateFields.subject = body.subject;
            }
            if (body.description !== undefined) {
                updateFields.description = body.description;
            }
            if (body.category !== undefined) {
                updateFields.category = body.category;
            }
            if (body.priority !== undefined) {
                updateFields.priority = body.priority;
            }
            if (body.status !== undefined) {
                updateFields.status = body.status;
            }
            if (body.tags !== undefined) {
                updateFields.tags = body.tags;
            }
            if (body.dueDate !== undefined) {
                updateFields.dueDate = new Date(body.dueDate);
            }
            const updated = await this.ticketService.updateTicket(id, updateFields, userId);
            res.json(updated);
        });
    };
    deleteTicket = async (req, res) => {
        await this.execute(req, res, async () => {
            const { id } = req.params;
            const userId = req.user?.id;
            if (!userId) {
                throw new apiErrors_1.UnauthorizedError('Unauthorized');
            }
            if (!isUserAdmin(req.user) && !isUserOrgAdmin(req.user)) {
                throw new apiErrors_1.ForbiddenError('Not authorized to delete tickets');
            }
            await this.ticketService.deleteTicket(id);
            res.status(204).send();
        });
    };
    addMessage = async (req, res) => {
        await this.execute(req, res, async () => {
            const { id } = req.params;
            const userId = req.user?.id;
            const userName = req.user?.username;
            if (!userId || !userName) {
                throw new apiErrors_1.UnauthorizedError('Unauthorized');
            }
            const ticket = await this.ticketService.getTicketById(id);
            if (!ticket) {
                throw new apiErrors_1.NotFoundError('Ticket');
            }
            if (ticket.creatorId !== userId &&
                ticket.assigneeId !== userId &&
                !isUserAdmin(req.user) &&
                !isUserOrgAdmin(req.user)) {
                throw new apiErrors_1.ForbiddenError('Not authorized to add messages to this ticket');
            }
            const body = req.body;
            const isInternal = body.isInternal &&
                (isUserAdmin(req.user) || isUserOrgAdmin(req.user) || ticket.assigneeId === userId);
            const updated = await this.ticketService.addMessage(id, {
                authorId: userId,
                authorName: userName,
                content: body.content,
                isInternal: isInternal ?? false,
                attachments: body.attachments,
            });
            res.json(updated);
        });
    };
    assignTicket = async (req, res) => {
        await this.execute(req, res, async () => {
            const { id } = req.params;
            const userId = req.user?.id;
            if (!userId) {
                throw new apiErrors_1.UnauthorizedError('Unauthorized');
            }
            if (!isUserAdmin(req.user) && !isUserOrgAdmin(req.user)) {
                throw new apiErrors_1.ForbiddenError('Not authorized to assign tickets');
            }
            const body = req.body;
            if (!body.assigneeId || !body.assigneeName) {
                throw new apiErrors_1.ValidationError('Assignee ID and name are required');
            }
            const updated = await this.ticketService.assignTicket(id, body.assigneeId, body.assigneeName, userId);
            res.json(updated);
        });
    };
    resolveTicket = async (req, res) => {
        await this.execute(req, res, async () => {
            const { id } = req.params;
            const userId = req.user?.id;
            if (!userId) {
                throw new apiErrors_1.UnauthorizedError('Unauthorized');
            }
            const ticket = await this.ticketService.getTicketById(id);
            if (!ticket) {
                throw new apiErrors_1.NotFoundError('Ticket');
            }
            if (!canUserResolveTicket(ticket, req.user)) {
                throw new apiErrors_1.ForbiddenError('Not authorized to resolve this ticket');
            }
            const body = req.body;
            if (!body.resolution) {
                throw new apiErrors_1.ValidationError('Resolution is required');
            }
            const updated = await this.ticketService.resolveTicket(id, {
                resolution: body.resolution,
                resolvedBy: userId,
            });
            res.json(updated);
        });
    };
    closeTicket = async (req, res) => {
        await this.execute(req, res, async () => {
            const { id } = req.params;
            const userId = req.user?.id;
            if (!userId) {
                throw new apiErrors_1.UnauthorizedError('Unauthorized');
            }
            const ticket = await this.ticketService.getTicketById(id);
            if (!ticket) {
                throw new apiErrors_1.NotFoundError('Ticket');
            }
            if (ticket.creatorId !== userId &&
                ticket.assigneeId !== userId &&
                !isUserAdmin(req.user) &&
                !isUserOrgAdmin(req.user)) {
                throw new apiErrors_1.ForbiddenError('Not authorized to close this ticket');
            }
            const updated = await this.ticketService.closeTicket(id);
            res.json(updated);
        });
    };
    reopenTicket = async (req, res) => {
        await this.execute(req, res, async () => {
            const { id } = req.params;
            const userId = req.user?.id;
            if (!userId) {
                throw new apiErrors_1.UnauthorizedError('Unauthorized');
            }
            const ticket = await this.ticketService.getTicketById(id);
            if (!ticket) {
                throw new apiErrors_1.NotFoundError('Ticket');
            }
            if (ticket.creatorId !== userId && !isUserAdmin(req.user) && !isUserOrgAdmin(req.user)) {
                throw new apiErrors_1.ForbiddenError('Not authorized to reopen this ticket');
            }
            const updated = await this.ticketService.reopenTicket(id);
            res.json(updated);
        });
    };
    addFeedback = async (req, res) => {
        await this.execute(req, res, async () => {
            const { id } = req.params;
            const userId = req.user?.id;
            if (!userId) {
                throw new apiErrors_1.UnauthorizedError('Unauthorized');
            }
            const ticket = await this.ticketService.getTicketById(id);
            if (!ticket) {
                throw new apiErrors_1.NotFoundError('Ticket');
            }
            if (ticket.creatorId !== userId) {
                throw new apiErrors_1.ForbiddenError('Only the ticket creator can add feedback');
            }
            const body = req.body;
            if (!body.rating || body.rating < 1 || body.rating > 5) {
                throw new apiErrors_1.ValidationError('Rating must be between 1 and 5');
            }
            const updated = await this.ticketService.addFeedback(id, body.rating, body.feedback);
            res.json(updated);
        });
    };
    getRoutingRules = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = req.user?.currentOrganizationId;
            if (!organizationId) {
                throw new apiErrors_1.ValidationError('Organization context required');
            }
            if (!isUserAdmin(req.user) && !isUserOrgAdmin(req.user)) {
                throw new apiErrors_1.ForbiddenError('Not authorized to manage routing rules');
            }
            const rules = await this.routingService.getRulesForOrganizationAdminAsync(organizationId);
            res.json(rules);
        });
    };
    createRoutingRule = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = req.user?.currentOrganizationId;
            const userId = req.user?.id;
            if (!organizationId) {
                throw new apiErrors_1.ValidationError('Organization context required');
            }
            if (!userId) {
                throw new apiErrors_1.UnauthorizedError('Unauthorized');
            }
            if (!isUserAdmin(req.user) && !isUserOrgAdmin(req.user)) {
                throw new apiErrors_1.ForbiddenError('Not authorized to manage routing rules');
            }
            const body = req.body;
            const dto = {
                name: body.name,
                description: body.description,
                organizationId,
                priority: body.priority,
                conditions: body.conditions,
                conditionLogic: body.conditionLogic,
                actions: body.actions,
                createdBy: userId,
            };
            const validation = this.routingService.validateRule(dto);
            if (!validation.valid) {
                throw new apiErrors_1.ValidationError(validation.errors.join('; '));
            }
            const rule = await this.routingService.createRuleAsync(dto);
            res.status(201).json(rule);
        });
    };
    updateRoutingRule = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = req.user?.currentOrganizationId;
            if (!organizationId) {
                throw new apiErrors_1.ValidationError('Organization context required');
            }
            if (!isUserAdmin(req.user) && !isUserOrgAdmin(req.user)) {
                throw new apiErrors_1.ForbiddenError('Not authorized to manage routing rules');
            }
            const body = req.body;
            const updated = await this.routingService.updateRuleAsync(organizationId, req.params.ruleId, body);
            res.json(updated);
        });
    };
    deleteRoutingRule = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = req.user?.currentOrganizationId;
            if (!organizationId) {
                throw new apiErrors_1.ValidationError('Organization context required');
            }
            if (!isUserAdmin(req.user) && !isUserOrgAdmin(req.user)) {
                throw new apiErrors_1.ForbiddenError('Not authorized to manage routing rules');
            }
            const deleted = await this.routingService.deleteRuleAsync(organizationId, req.params.ruleId);
            if (!deleted) {
                throw new apiErrors_1.NotFoundError('Routing rule');
            }
            res.status(204).send();
        });
    };
    testRoutingRule = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = req.user?.currentOrganizationId;
            const userId = req.user?.id;
            if (!organizationId) {
                throw new apiErrors_1.ValidationError('Organization context required');
            }
            if (!userId) {
                throw new apiErrors_1.UnauthorizedError('Unauthorized');
            }
            if (!isUserAdmin(req.user) && !isUserOrgAdmin(req.user)) {
                throw new apiErrors_1.ForbiddenError('Not authorized to test routing rules');
            }
            const body = req.body;
            const rule = {
                name: body.rule.name ?? 'Test Rule',
                description: body.rule.description ?? 'Test rule evaluation',
                organizationId,
                isActive: body.rule.isActive ?? true,
                priority: body.rule.priority ?? 100,
                conditionLogic: body.rule.conditionLogic ?? 'AND',
                conditions: body.rule.conditions,
                actions: body.rule.actions,
                createdBy: userId,
            };
            const result = this.routingService.testRule(rule, body.ticket);
            res.json(result);
        });
    };
    getRoutingStats = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = req.user?.currentOrganizationId;
            if (!organizationId) {
                throw new apiErrors_1.ValidationError('Organization context required');
            }
            if (!isUserAdmin(req.user) && !isUserOrgAdmin(req.user)) {
                throw new apiErrors_1.ForbiddenError('Not authorized to view routing stats');
            }
            const stats = await this.routingService.getStatsAsync(organizationId);
            res.json(stats);
        });
    };
    getStats = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = req.user?.currentOrganizationId;
            if (!organizationId) {
                throw new apiErrors_1.ValidationError('Organization context required');
            }
            if (!isUserAdmin(req.user) && !isUserOrgAdmin(req.user)) {
                throw new apiErrors_1.ForbiddenError('Not authorized to view ticket statistics');
            }
            const stats = await this.ticketService.getTicketStats(organizationId);
            res.json(stats);
        });
    };
}
exports.TicketController = TicketController;
//# sourceMappingURL=ticketController.js.map