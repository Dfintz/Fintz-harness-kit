import { Response } from 'express';

import { AppDataSource } from '../data-source';
import { AuthRequest } from '../middleware/auth';
import { OrganizationMembership } from '../models/OrganizationMembership';
import {
  TicketCategory,
  TicketPriority,
  TicketRecipientType,
  TicketStatus,
} from '../models/Ticket';
import { User } from '../models/User';
import {
  CreateRoutingRuleDTO,
  TicketForRouting,
  TicketRoutingService,
  UpdateRoutingRuleDTO,
} from '../services/communication/tickets/TicketRoutingService';
import type {
  CreateTicketDTO,
  TicketFilters,
} from '../services/communication/tickets/TicketService';
import { TicketService } from '../services/communication/tickets/TicketService';
import {
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from '../utils/apiErrors';
import { logger } from '../utils/logger';
import { getRoleName } from '../utils/roleUtils';

import { BaseController } from './BaseController';

// ── Typed request bodies (post-Joi validation) ────────────────────────

interface CreateTicketBody {
  subject: string;
  description: string;
  category?: TicketCategory;
  priority?: TicketPriority;
  discordId?: string;
  creatorDiscordId?: string;
  email?: string;
  recipientType: TicketRecipientType;
  recipientId?: string;
  recipientName?: string;
  tags?: string[];
  relatedRecruitmentId?: string;
  relatedDiplomacyId?: string;
  relatedApplicationId?: string;
}

interface UpdateTicketBody {
  subject?: string;
  description?: string;
  category?: TicketCategory;
  priority?: TicketPriority;
  status?: TicketStatus;
  tags?: string[];
  dueDate?: string;
}

interface AddMessageBody {
  content: string;
  isInternal?: boolean;
  attachments?: string[];
}

interface AssignTicketBody {
  assigneeId: string;
  assigneeName: string;
}

interface ResolveTicketBody {
  resolution: string;
}

interface FeedbackBody {
  rating: number;
  feedback?: string;
}

interface CreateRoutingRuleBody {
  name: string;
  description: string;
  priority?: number;
  conditions: CreateRoutingRuleDTO['conditions'];
  conditionLogic?: 'AND' | 'OR';
  actions: CreateRoutingRuleDTO['actions'];
}

interface UpdateRoutingRuleBody {
  name?: string;
  description?: string;
  isActive?: boolean;
  priority?: number;
  conditions?: UpdateRoutingRuleDTO['conditions'];
  conditionLogic?: 'AND' | 'OR';
  actions?: UpdateRoutingRuleDTO['actions'];
}

interface TestRoutingRuleBody {
  rule: Omit<CreateRoutingRuleBody, 'name' | 'description'> & {
    name?: string;
    description?: string;
    isActive?: boolean;
  };
  ticket: TicketForRouting;
}

/**
 * Helper function to check if user is admin
 */
function isUserAdmin(user: AuthRequest['user']): boolean {
  return user?.role === 'admin' || user?.role === 'superadmin';
}

/**
 * Helper function to check if user is org admin
 */
function isUserOrgAdmin(user: AuthRequest['user']): boolean {
  return user?.role === 'admin' || user?.role === 'org_admin' || user?.role === 'superadmin';
}

/** Map org membership role → recipient types the role can see */
const ROLE_RECIPIENT_MAP: Record<string, TicketRecipientType[]> = {
  senior_officer: [
    TicketRecipientType.ORG_LEADERSHIP,
    TicketRecipientType.ORG_OFFICERS,
    TicketRecipientType.HR_DEPARTMENT,
    TicketRecipientType.RECRUITMENT,
    TicketRecipientType.DIPLOMACY,
    TicketRecipientType.PLATFORM_ADMIN,
  ],
  officer: [
    TicketRecipientType.ORG_LEADERSHIP,
    TicketRecipientType.ORG_OFFICERS,
    TicketRecipientType.HR_DEPARTMENT,
    TicketRecipientType.RECRUITMENT,
    TicketRecipientType.DIPLOMACY,
    TicketRecipientType.PLATFORM_ADMIN,
  ],
  team_leader: [TicketRecipientType.TEAM_LEADER],
};

/** Org-level roles that see all tickets (no visibility filter) */
const ORG_ADMIN_ROLES = new Set(['owner', 'admin', 'founder', 'org_admin', 'superadmin']);

/**
 * Normalize org role naming variants from DB/custom roles to canonical keys.
 * Examples: "Senior Officer" -> "senior_officer", "fleet-commander" -> "senior_officer".
 */
function normalizeOrgRoleForTicketVisibility(roleName: string): string {
  const normalized = roleName
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');

  const aliases: Record<string, string> = {
    fleet_commander: 'senior_officer',
    org_owner: 'owner',
    org_admin: 'admin',
  };

  return aliases[normalized] ?? normalized;
}

export function resolveVisibleRecipientTypesForOrgRole(
  roleName: string
): TicketRecipientType[] | undefined {
  const normalizedRole = normalizeOrgRoleForTicketVisibility(roleName);
  return ROLE_RECIPIENT_MAP[normalizedRole];
}

/** Fallback category inference for bot-created tickets by recipient routing */
const BOT_RECIPIENT_CATEGORY_MAP: Partial<Record<TicketRecipientType, TicketCategory>> = {
  [TicketRecipientType.HR_DEPARTMENT]: TicketCategory.HR,
  [TicketRecipientType.RECRUITMENT]: TicketCategory.RECRUITMENT,
  [TicketRecipientType.DIPLOMACY]: TicketCategory.DIPLOMACY,
};

const TECHNICAL_CATEGORY_RECIPIENT_MAP: Record<TicketCategory, TicketRecipientType> = {
  [TicketCategory.HR]: TicketRecipientType.HR_DEPARTMENT,
  [TicketCategory.RECRUITMENT]: TicketRecipientType.RECRUITMENT,
  [TicketCategory.DIPLOMACY]: TicketRecipientType.DIPLOMACY,
  [TicketCategory.SUPPORT]: TicketRecipientType.PLATFORM_ADMIN,
  [TicketCategory.GENERAL]: TicketRecipientType.ORG_LEADERSHIP,
};

function validateCategoryRecipientRouting(
  category: TicketCategory,
  recipientType: TicketRecipientType
): void {
  const expectedRecipient = TECHNICAL_CATEGORY_RECIPIENT_MAP[category];

  if (category === TicketCategory.GENERAL) {
    return;
  }

  if (recipientType !== expectedRecipient) {
    throw new ValidationError(
      `Category ${category} must be routed to recipient type ${expectedRecipient}`
    );
  }
}

export function canUserResolveTicket(
  ticket: { creatorId: string; assigneeId?: string },
  user: AuthRequest['user']
): boolean {
  const userId = user?.id;
  if (!userId) {
    return false;
  }

  return (
    ticket.creatorId === userId ||
    ticket.assigneeId === userId ||
    isUserAdmin(user) ||
    isUserOrgAdmin(user)
  );
}

/**
 * Apply visibility filters based on the user's org membership role.
 * Org owners/admins/founders see all tickets. Officers see role-based tickets.
 * Regular members see only tickets they created, are assigned, or are direct recipients of.
 */
async function applyVisibilityFilter(
  filters: TicketFilters,
  userId: string,
  organizationId: string,
  requestDiscordId?: string
): Promise<void> {
  const membership = await AppDataSource.getRepository(OrganizationMembership).findOne({
    where: { organizationId, userId, isActive: true },
  });
  const rawOrgRole = getRoleName(membership?.role);
  const orgRole = normalizeOrgRoleForTicketVisibility(rawOrgRole);

  if (ORG_ADMIN_ROLES.has(orgRole)) {
    logger.debug('applyVisibilityFilter: org admin detected, returning all tickets', {
      userId,
      organizationId,
      orgRole,
    });
    return; // Org admins see everything
  }

  filters.visibleToUserId = userId;
  const visibleTypes = resolveVisibleRecipientTypesForOrgRole(orgRole);
  if (visibleTypes) {
    filters.visibleToRecipientTypes = visibleTypes;
  }

  // Look up the user's Discord ID so tickets created via Discord bot
  // (which may have a different creatorId) are also visible.
  try {
    const user = await AppDataSource.getRepository(User).findOne({
      where: { id: userId },
      select: ['discordId'],
    });
    if (user?.discordId) {
      filters.visibleToDiscordId = user.discordId;
    }
  } catch {
    // Non-fatal — proceed without Discord ID fallback
  }

  // For bot requests: if no linked user was found, use the Discord ID from
  // the request header so tickets created by unlinked users are still visible.
  if (!filters.visibleToDiscordId && requestDiscordId) {
    filters.visibleToDiscordId = requestDiscordId;
  }

  logger.debug('applyVisibilityFilter: applied visibility filters', {
    userId,
    organizationId,
    rawOrgRole,
    orgRole,
    visibleToUserId: filters.visibleToUserId,
    visibleToDiscordId: filters.visibleToDiscordId,
    visibleToRecipientTypes: filters.visibleToRecipientTypes,
  });
}

/**
 * Ticket Controller
 *
 * Provides /api/tickets endpoints for managing support tickets.
 * Supports HR, Recruitment, Diplomacy, and general support tickets.
 */
export class TicketController extends BaseController {
  private readonly ticketService: TicketService;
  private readonly routingService: TicketRoutingService;

  constructor() {
    super();
    this.ticketService = TicketService.getInstance();
    this.routingService = TicketRoutingService.getInstance();
  }

  // ==================== CRUD OPERATIONS ====================

  /**
   * GET /api/tickets
   * List all tickets for the organization
   */
  listTickets = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = req.user?.currentOrganizationId;

      if (!organizationId) {
        throw new ValidationError('Organization context required');
      }

      logger.debug('listTickets: request start', {
        userId: req.user?.id,
        username: req.user?.username,
        organizationId,
        isBotRequest: typeof req.headers['x-bot-internal-token'] === 'string',
      });

      const { page, limit } = this.getTicketListPagination(req);
      const filters = this.buildTicketListFilters(req);

      await this.applyTicketListVisibility(req, organizationId, filters);

      const result = await this.ticketService.searchTickets(organizationId, filters, page, limit);

      logger.debug('listTickets: query results', {
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

  private getTicketListPagination(req: AuthRequest): { page: number; limit: number } {
    return {
      page: Number.parseInt(req.query.page as string) || 1,
      limit: Math.min(Number.parseInt(req.query.limit as string) || 20, 200),
    };
  }

  private buildTicketListFilters(req: AuthRequest): TicketFilters {
    const filters: TicketFilters = {};

    if (req.query.category) {
      filters.category = req.query.category as TicketCategory;
    }

    if (req.query.status) {
      const status = req.query.status as string;
      if (status === 'open') {
        filters.isOpen = true;
      } else if (status === 'closed') {
        filters.isOpen = false;
      } else {
        filters.status = status as TicketStatus;
      }
    }

    if (req.query.priority) {
      filters.priority = req.query.priority as TicketPriority;
    }

    if (req.query.assigneeId) {
      filters.assigneeId = req.query.assigneeId as string;
    }

    if (req.query.creatorId) {
      filters.creatorId = req.query.creatorId as string;
    }

    if (req.query.creatorDiscordId) {
      filters.creatorDiscordId = req.query.creatorDiscordId as string;
    }

    if (req.query.searchTerm) {
      filters.searchTerm = req.query.searchTerm as string;
    }

    return filters;
  }

  private async applyTicketListVisibility(
    req: AuthRequest,
    organizationId: string,
    filters: TicketFilters
  ): Promise<void> {
    // Platform admins see everything; everyone else gets org-role-based visibility.
    if (isUserAdmin(req.user) || !req.user?.id) {
      return;
    }

    // Validate Discord snowflake format (numeric string, 17-20 digits) before
    // passing to the DB query to prevent injection via the header value.
    const rawDiscordId = req.headers['x-discord-user-id'] as string | undefined;
    const requestDiscordId =
      rawDiscordId && /^\d{17,20}$/.test(rawDiscordId) ? rawDiscordId : undefined;

    await applyVisibilityFilter(filters, req.user.id, organizationId, requestDiscordId);
  }

  /**
   * POST /api/tickets
   * Create a new ticket
   */
  createTicket = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const userId = req.user?.id;
      const userName = req.user?.username;
      const organizationId = req.user?.currentOrganizationId;

      if (!userId || !userName) {
        throw new UnauthorizedError('Unauthorized');
      }

      if (!organizationId) {
        throw new ValidationError('Organization context required');
      }

      const body = req.body as CreateTicketBody;

      if (!body.recipientType) {
        throw new ValidationError('Recipient type is required');
      }

      const isBotRequest =
        typeof req.headers['x-bot-internal-token'] === 'string' &&
        req.headers['x-bot-internal-token'].length > 0;
      const inferredBotCategory = isBotRequest
        ? BOT_RECIPIENT_CATEGORY_MAP[body.recipientType]
        : undefined;
      const category =
        body.category === TicketCategory.GENERAL && inferredBotCategory
          ? inferredBotCategory
          : (body.category ?? inferredBotCategory ?? TicketCategory.GENERAL);

      validateCategoryRecipientRouting(category, body.recipientType);

      const dto: CreateTicketDTO = {
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

  /**
   * GET /api/tickets/:id
   * Get a specific ticket
   */
  getTicket = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const { id } = req.params;
      const userId = req.user?.id;

      const ticket = await this.ticketService.getTicketById(id);

      if (!ticket) {
        throw new NotFoundError('Ticket');
      }

      // Check access: only creator, assignee, or admin can view
      if (
        ticket.creatorId !== userId &&
        ticket.assigneeId !== userId &&
        !isUserAdmin(req.user) &&
        !isUserOrgAdmin(req.user)
      ) {
        throw new ForbiddenError('Not authorized to view this ticket');
      }

      res.json(ticket);
    });
  };

  /**
   * GET /api/tickets/by-number/:ticketNumber
   * Get a specific ticket by ticket number
   */
  getTicketByNumber = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const { ticketNumber } = req.params;
      const userId = req.user?.id;

      const ticket = await this.ticketService.getTicketByNumber(ticketNumber.toUpperCase());

      if (!ticket) {
        throw new NotFoundError('Ticket');
      }

      // Check access: only creator, assignee, or admin can view
      if (
        ticket.creatorId !== userId &&
        ticket.assigneeId !== userId &&
        !isUserAdmin(req.user) &&
        !isUserOrgAdmin(req.user)
      ) {
        throw new ForbiddenError('Not authorized to view this ticket');
      }

      res.json(ticket);
    });
  };

  /**
   * PUT /api/tickets/:id
   * Update a ticket
   */
  updateTicket = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const { id } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        throw new UnauthorizedError('Unauthorized');
      }

      const ticket = await this.ticketService.getTicketById(id);
      if (!ticket) {
        throw new NotFoundError('Ticket');
      }

      // Only admin, org admin, or assignee can update ticket
      if (ticket.assigneeId !== userId && !isUserAdmin(req.user) && !isUserOrgAdmin(req.user)) {
        throw new ForbiddenError('Not authorized to update this ticket');
      }

      const body = req.body as UpdateTicketBody;
      const updateFields: Record<string, unknown> = {};

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

  /**
   * DELETE /api/tickets/:id
   * Delete a ticket
   */
  deleteTicket = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const { id } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        throw new UnauthorizedError('Unauthorized');
      }

      // Only admin can delete tickets
      if (!isUserAdmin(req.user) && !isUserOrgAdmin(req.user)) {
        throw new ForbiddenError('Not authorized to delete tickets');
      }

      await this.ticketService.deleteTicket(id);
      res.status(204).send();
    });
  };

  // ==================== MESSAGE OPERATIONS ====================

  /**
   * POST /api/tickets/:id/messages
   * Add a message to a ticket
   */
  addMessage = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const { id } = req.params;
      const userId = req.user?.id;
      const userName = req.user?.username;

      if (!userId || !userName) {
        throw new UnauthorizedError('Unauthorized');
      }

      const ticket = await this.ticketService.getTicketById(id);
      if (!ticket) {
        throw new NotFoundError('Ticket');
      }

      // Check access: only creator, assignee, or admin can add messages
      if (
        ticket.creatorId !== userId &&
        ticket.assigneeId !== userId &&
        !isUserAdmin(req.user) &&
        !isUserOrgAdmin(req.user)
      ) {
        throw new ForbiddenError('Not authorized to add messages to this ticket');
      }

      const body = req.body as AddMessageBody;

      // Internal notes are only for staff
      const isInternal =
        body.isInternal &&
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

  // ==================== ASSIGNMENT OPERATIONS ====================

  /**
   * PUT /api/tickets/:id/assign
   * Assign a ticket to a user
   */
  assignTicket = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const { id } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        throw new UnauthorizedError('Unauthorized');
      }

      // Only admin or org admin can assign tickets
      if (!isUserAdmin(req.user) && !isUserOrgAdmin(req.user)) {
        throw new ForbiddenError('Not authorized to assign tickets');
      }

      const body = req.body as AssignTicketBody;

      if (!body.assigneeId || !body.assigneeName) {
        throw new ValidationError('Assignee ID and name are required');
      }

      const updated = await this.ticketService.assignTicket(
        id,
        body.assigneeId,
        body.assigneeName,
        userId
      );
      res.json(updated);
    });
  };

  // ==================== STATUS OPERATIONS ====================

  /**
   * PUT /api/tickets/:id/resolve
   * Resolve a ticket
   */
  resolveTicket = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const { id } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        throw new UnauthorizedError('Unauthorized');
      }

      const ticket = await this.ticketService.getTicketById(id);
      if (!ticket) {
        throw new NotFoundError('Ticket');
      }

      // Creator, assignee, admin, or org admin can resolve.
      if (!canUserResolveTicket(ticket, req.user)) {
        throw new ForbiddenError('Not authorized to resolve this ticket');
      }

      const body = req.body as ResolveTicketBody;
      if (!body.resolution) {
        throw new ValidationError('Resolution is required');
      }

      const updated = await this.ticketService.resolveTicket(id, {
        resolution: body.resolution,
        resolvedBy: userId,
      });

      res.json(updated);
    });
  };

  /**
   * PUT /api/tickets/:id/close
   * Close a ticket
   */
  closeTicket = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const { id } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        throw new UnauthorizedError('Unauthorized');
      }

      const ticket = await this.ticketService.getTicketById(id);
      if (!ticket) {
        throw new NotFoundError('Ticket');
      }

      // Only admin, org admin, assignee, or creator can close
      if (
        ticket.creatorId !== userId &&
        ticket.assigneeId !== userId &&
        !isUserAdmin(req.user) &&
        !isUserOrgAdmin(req.user)
      ) {
        throw new ForbiddenError('Not authorized to close this ticket');
      }

      const updated = await this.ticketService.closeTicket(id);
      res.json(updated);
    });
  };

  /**
   * PUT /api/tickets/:id/reopen
   * Reopen a closed ticket
   */
  reopenTicket = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const { id } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        throw new UnauthorizedError('Unauthorized');
      }

      const ticket = await this.ticketService.getTicketById(id);
      if (!ticket) {
        throw new NotFoundError('Ticket');
      }

      // Only admin, org admin, or creator can reopen
      if (ticket.creatorId !== userId && !isUserAdmin(req.user) && !isUserOrgAdmin(req.user)) {
        throw new ForbiddenError('Not authorized to reopen this ticket');
      }

      const updated = await this.ticketService.reopenTicket(id);
      res.json(updated);
    });
  };

  // ==================== FEEDBACK OPERATIONS ====================

  /**
   * POST /api/tickets/:id/feedback
   * Add satisfaction rating and feedback
   */
  addFeedback = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const { id } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        throw new UnauthorizedError('Unauthorized');
      }

      const ticket = await this.ticketService.getTicketById(id);
      if (!ticket) {
        throw new NotFoundError('Ticket');
      }

      // Only the ticket creator can add feedback
      if (ticket.creatorId !== userId) {
        throw new ForbiddenError('Only the ticket creator can add feedback');
      }

      const body = req.body as FeedbackBody;
      if (!body.rating || body.rating < 1 || body.rating > 5) {
        throw new ValidationError('Rating must be between 1 and 5');
      }

      const updated = await this.ticketService.addFeedback(id, body.rating, body.feedback);
      res.json(updated);
    });
  };

  // ==================== ROUTING RULES ====================

  /**
   * GET /api/tickets/routing/rules
   * List routing rules for the current organization
   */
  getRoutingRules = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = req.user?.currentOrganizationId;
      if (!organizationId) {
        throw new ValidationError('Organization context required');
      }

      if (!isUserAdmin(req.user) && !isUserOrgAdmin(req.user)) {
        throw new ForbiddenError('Not authorized to manage routing rules');
      }

      const rules = await this.routingService.getRulesForOrganizationAdminAsync(organizationId);
      res.json(rules);
    });
  };

  /**
   * POST /api/tickets/routing/rules
   * Create a routing rule for the current organization
   */
  createRoutingRule = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = req.user?.currentOrganizationId;
      const userId = req.user?.id;
      if (!organizationId) {
        throw new ValidationError('Organization context required');
      }
      if (!userId) {
        throw new UnauthorizedError('Unauthorized');
      }

      if (!isUserAdmin(req.user) && !isUserOrgAdmin(req.user)) {
        throw new ForbiddenError('Not authorized to manage routing rules');
      }

      const body = req.body as CreateRoutingRuleBody;
      const dto: CreateRoutingRuleDTO = {
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
        throw new ValidationError(validation.errors.join('; '));
      }

      const rule = await this.routingService.createRuleAsync(dto);
      res.status(201).json(rule);
    });
  };

  /**
   * PATCH /api/tickets/routing/rules/:ruleId
   * Update a routing rule
   */
  updateRoutingRule = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = req.user?.currentOrganizationId;
      if (!organizationId) {
        throw new ValidationError('Organization context required');
      }

      if (!isUserAdmin(req.user) && !isUserOrgAdmin(req.user)) {
        throw new ForbiddenError('Not authorized to manage routing rules');
      }

      const body = req.body as UpdateRoutingRuleBody;
      const updated = await this.routingService.updateRuleAsync(
        organizationId,
        req.params.ruleId,
        body
      );
      res.json(updated);
    });
  };

  /**
   * DELETE /api/tickets/routing/rules/:ruleId
   * Delete a routing rule
   */
  deleteRoutingRule = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = req.user?.currentOrganizationId;
      if (!organizationId) {
        throw new ValidationError('Organization context required');
      }

      if (!isUserAdmin(req.user) && !isUserOrgAdmin(req.user)) {
        throw new ForbiddenError('Not authorized to manage routing rules');
      }

      const deleted = await this.routingService.deleteRuleAsync(organizationId, req.params.ruleId);
      if (!deleted) {
        throw new NotFoundError('Routing rule');
      }

      res.status(204).send();
    });
  };

  /**
   * POST /api/tickets/routing/test
   * Test a routing rule configuration without persisting it
   */
  testRoutingRule = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = req.user?.currentOrganizationId;
      const userId = req.user?.id;
      if (!organizationId) {
        throw new ValidationError('Organization context required');
      }
      if (!userId) {
        throw new UnauthorizedError('Unauthorized');
      }

      if (!isUserAdmin(req.user) && !isUserOrgAdmin(req.user)) {
        throw new ForbiddenError('Not authorized to test routing rules');
      }

      const body = req.body as TestRoutingRuleBody;
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

  /**
   * GET /api/tickets/routing/stats
   * Get routing engine stats for the current organization
   */
  getRoutingStats = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = req.user?.currentOrganizationId;
      if (!organizationId) {
        throw new ValidationError('Organization context required');
      }

      if (!isUserAdmin(req.user) && !isUserOrgAdmin(req.user)) {
        throw new ForbiddenError('Not authorized to view routing stats');
      }

      const stats = await this.routingService.getStatsAsync(organizationId);
      res.json(stats);
    });
  };

  // ==================== STATISTICS ====================

  /**
   * GET /api/tickets/stats
   * Get ticket statistics for the organization
   */
  getStats = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = req.user?.currentOrganizationId;

      if (!organizationId) {
        throw new ValidationError('Organization context required');
      }

      // Only admin or org admin can view stats
      if (!isUserAdmin(req.user) && !isUserOrgAdmin(req.user)) {
        throw new ForbiddenError('Not authorized to view ticket statistics');
      }

      const stats = await this.ticketService.getTicketStats(organizationId);
      res.json(stats);
    });
  };
}
