import crypto from 'node:crypto';

import { In, LessThanOrEqual, Like, MoreThanOrEqual, Repository } from 'typeorm';

import { AppDataSource } from '../../../data-source';
import { DiscordGuildSettings } from '../../../models/DiscordGuildSettings';
import {
  Ticket,
  TicketCategory,
  TicketDiscordSettings,
  TicketMessage,
  TicketPriority,
  TicketRecipientType,
  TicketStatus,
} from '../../../models/Ticket';
import { NotFoundError, ValidationError } from '../../../utils/apiErrors';
import { logger } from '../../../utils/logger';

import { TicketRoutingService } from './TicketRoutingService';

/**
 * Create Ticket DTO
 */
export interface CreateTicketDTO {
  subject: string;
  description: string;
  category: TicketCategory;
  priority?: TicketPriority;
  creatorId: string;
  creatorName: string;
  creatorDiscordId?: string;
  creatorEmail?: string;
  recipientType: TicketRecipientType;
  recipientId?: string;
  recipientName?: string;
  tags?: string[];
  relatedRecruitmentId?: string;
  relatedDiplomacyId?: string;
  relatedApplicationId?: string;
  discordSettings?: TicketDiscordSettings;
}

/**
 * Update Ticket DTO
 */
export interface UpdateTicketDTO {
  subject?: string;
  description?: string;
  category?: TicketCategory;
  priority?: TicketPriority;
  status?: TicketStatus;
  assigneeId?: string;
  assigneeName?: string;
  tags?: string[];
  dueDate?: Date;
}

/**
 * Ticket Search Filters
 */
export interface TicketFilters {
  category?: TicketCategory;
  status?: TicketStatus | TicketStatus[];
  priority?: TicketPriority;
  assigneeId?: string;
  creatorId?: string;
  creatorDiscordId?: string;
  searchTerm?: string;
  tags?: string[];
  createdAfter?: Date;
  createdBefore?: Date;
  isOpen?: boolean;
  /** Show tickets visible to this user (creator, recipient, or assignee) */
  visibleToUserId?: string;
  /** Also show tickets routed to these role-based recipient types */
  visibleToRecipientTypes?: TicketRecipientType[];
  /** Also show tickets created by this Discord ID (fallback for unlinked accounts) */
  visibleToDiscordId?: string;
}

/**
 * Add Message DTO
 */
export interface AddMessageDTO {
  authorId: string;
  authorName: string;
  content: string;
  isInternal?: boolean;
  attachments?: string[];
}

/**
 * Resolve Ticket DTO
 */
export interface ResolveTicketDTO {
  resolution: string;
  resolvedBy: string;
}

/**
 * Ticket Service
 *
 * Handles all ticket management operations including:
 * - Creating and updating tickets
 * - Managing ticket messages/conversation
 * - Ticket assignment and escalation
 * - Discord integration
 * - Analytics and reporting
 */
export class TicketService {
  private static instance: TicketService | null = null;

  /**
   * Returns the shared singleton instance.
   * Lazy — safe to call before AppDataSource is ready because the
   * constructor only stores the repository reference.
   */
  public static getInstance(): TicketService {
    TicketService.instance ??= new TicketService();
    return TicketService.instance;
  }

  private readonly ticketRepository: Repository<Ticket>;

  private readonly discordSettingsRepository: Repository<DiscordGuildSettings>;

  private readonly supportWebhookUrl = process.env.SUPPORT_DISCORD_WEBHOOK_URL;

  private readonly supportInviteUrl =
    process.env.SUPPORT_DISCORD_INVITE_URL || 'https://discord.gg/kHbbNZqdUY';

  constructor() {
    this.ticketRepository = AppDataSource.getRepository(Ticket);
    this.discordSettingsRepository = AppDataSource.getRepository(DiscordGuildSettings);
  }

  /**
   * Generate a unique ticket number via a PostgreSQL sequence.
   *
   * `nextval('ticket_number_seq')` is atomic across every database
   * connection — including connections from separate container instances —
   * so two concurrent callers are guaranteed to receive different values.
   * This replaces the previous in-memory counter which raced between
   * containers and caused UQ_e99bd0f51b92896fdaf99ebb715 violations.
   */
  private async generateTicketNumber(): Promise<string> {
    const rows = await this.ticketRepository.query(
      "SELECT TO_CHAR(nextval('ticket_number_seq'), 'FM000000') AS num"
    );
    return `TKT-${rows[0].num}`;
  }

  /**
   * Create a new ticket.
   *
   * Always reloads the saved entity from the database so the response
   * includes every column regardless of TypeORM ES2022 class-field quirks.
   *
   * The ticket number is obtained from a PostgreSQL sequence which is
   * atomic across all container instances, so duplicate-key collisions on
   * ticketNumber are theoretically impossible.  A single retry is kept as
   * a belt-and-suspenders guard against extraordinary edge cases (e.g.
   * sequence wrap-around after 2^63 tickets).
   */
  async createTicket(organizationId: string, dto: CreateTicketDTO): Promise<Ticket> {
    const ticketNumber = await this.generateTicketNumber();
    try {
      return await this.createTicketForAttempt(organizationId, dto, ticketNumber);
    } catch (error: unknown) {
      if (this.isDuplicateTicketError(error)) {
        logger.warn(
          `Ticket number ${ticketNumber} sequence collision (unexpected), retrying once`,
          {
            ticketNumber,
          }
        );
        const retryNumber = await this.generateTicketNumber();
        return this.createTicketForAttempt(organizationId, dto, retryNumber);
      }
      throw error;
    }
  }

  private async createTicketForAttempt(
    organizationId: string,
    dto: CreateTicketDTO,
    ticketNumber: string
  ): Promise<Ticket> {
    const ticket = this.ticketRepository.create({
      ticketNumber,
      organizationId,
      subject: dto.subject,
      description: dto.description,
      category: dto.category,
      priority: dto.priority ?? TicketPriority.MEDIUM,
      status: TicketStatus.OPEN,
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

    // Always reload from DB to guarantee a complete entity.
    // TypeORM 0.3 + ES2022 class fields can return a partial entity
    // from save() where non-generated columns are undefined.
    // NOSONAR: TypeORM criteria-object query with trusted scalar value; no dynamic keys/operators.
    const reloaded = await this.ticketRepository.findOne({ where: { ticketNumber } });
    if (!reloaded) {
      throw new Error(`Ticket ${ticketNumber} saved but not found on reload`);
    }

    await this.applyAutoRouting(organizationId, reloaded);
    await this.postTechnicalTicketToSupportDiscord(reloaded);
    logger.info(`Ticket created: ${reloaded.ticketNumber} (${reloaded.id})`);
    return reloaded;
  }

  private async postTechnicalTicketToSupportDiscord(ticket: Ticket): Promise<void> {
    const technicalCategories = new Set<TicketCategory>([
      TicketCategory.HR,
      TicketCategory.RECRUITMENT,
      TicketCategory.DIPLOMACY,
      TicketCategory.SUPPORT,
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
        logger.warn('Support Discord webhook post failed', {
          status: response.status,
          ticketNumber: ticket.ticketNumber,
          body: errorBody,
        });
      }
    } catch (error: unknown) {
      logger.warn('Support Discord webhook post threw an error', {
        ticketNumber: ticket.ticketNumber,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async resolveSupportDiscordConfig(organizationId: string): Promise<{
    webhookUrl?: string;
    inviteUrl: string;
  }> {
    try {
      // NOSONAR: TypeORM criteria-object query scoped by organizationId; no dynamic query construction.
      const guildSettings = await this.discordSettingsRepository.find({
        where: { organizationId },
      });
      const primary = this.selectPrimarySupportGuildSettings(guildSettings);

      return {
        webhookUrl: primary?.ticketSettings?.supportWebhookUrl || this.supportWebhookUrl,
        inviteUrl: primary?.ticketSettings?.supportInviteUrl || this.supportInviteUrl,
      };
    } catch (error: unknown) {
      logger.warn(
        'Failed to load support Discord config from guild settings; falling back to env',
        {
          organizationId,
          error: error instanceof Error ? error.message : String(error),
        }
      );

      return {
        webhookUrl: this.supportWebhookUrl,
        inviteUrl: this.supportInviteUrl,
      };
    }
  }

  private selectPrimarySupportGuildSettings(
    guildSettings: DiscordGuildSettings[]
  ): DiscordGuildSettings | undefined {
    if (guildSettings.length === 0) {
      return undefined;
    }

    const explicitPrimaryGuildId = guildSettings
      .map(settings => settings.ticketSettings?.supportServerGuildId?.trim())
      .find((guildId): guildId is string => Boolean(guildId));

    if (explicitPrimaryGuildId) {
      const explicitPrimary = guildSettings.find(
        settings => settings.guildId === explicitPrimaryGuildId
      );
      if (explicitPrimary) {
        return explicitPrimary;
      }
    }

    const scored = guildSettings
      .filter(settings => Boolean(settings.ticketSettings))
      .map(settings => {
        const ticketSettings = settings.ticketSettings;
        const score =
          (ticketSettings?.enabled ? 1 : 0) +
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

  private isDuplicateTicketError(error: unknown): boolean {
    return (
      error instanceof Error &&
      (error.message.includes('duplicate key') ||
        error.message.includes('unique constraint') ||
        error.message.includes('UNIQUE'))
    );
  }

  private async applyAutoRouting(organizationId: string, ticket: Ticket): Promise<void> {
    try {
      const routingResult = await TicketRoutingService.getInstance().evaluateTicketAsync(
        organizationId,
        {
          category: ticket.category,
          priority: ticket.priority,
          subject: ticket.subject,
          description: ticket.description,
          tags: ticket.tags ?? [],
          creatorId: ticket.creatorId,
          creatorDiscordId: ticket.creatorDiscordId,
          creatorEmail: ticket.creatorEmail,
        }
      );

      if (!routingResult.matched) {
        return;
      }

      const hasChanges = this.applyRoutingResultToTicket(ticket, routingResult);
      if (hasChanges) {
        await this.ticketRepository.save(ticket);
      }
    } catch (routingError: unknown) {
      logger.warn('Ticket routing evaluation failed; ticket created without auto-routing', {
        ticketNumber: ticket.ticketNumber,
        error: routingError instanceof Error ? routingError.message : String(routingError),
      });
    }
  }

  private applyRoutingResultToTicket(
    ticket: Ticket,
    routingResult: Awaited<ReturnType<TicketRoutingService['evaluateTicketAsync']>>
  ): boolean {
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
          id: crypto.randomUUID(),
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

  private applyRoutingAssignment(ticket: Ticket, assigneeId: string): void {
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

    if (ticket.status === TicketStatus.OPEN) {
      ticket.status = TicketStatus.IN_PROGRESS;
    }
  }

  /**
   * Get ticket by ID
   */
  async getTicketById(id: string): Promise<Ticket | null> {
    // NOSONAR: TypeORM criteria-object query with static field name and scalar ID value.
    return this.ticketRepository.findOne({
      where: { id },
    });
  }

  /**
   * Get ticket by ticket number
   */
  async getTicketByNumber(ticketNumber: string): Promise<Ticket | null> {
    // NOSONAR: TypeORM criteria-object query with static field name and scalar ticket number.
    return this.ticketRepository.findOne({
      where: { ticketNumber },
    });
  }

  /**
   * Update a ticket
   */
  async updateTicket(id: string, dto: UpdateTicketDTO, updatedBy?: string): Promise<Ticket> {
    const ticket = await this.getTicketById(id);
    if (!ticket) {
      throw new NotFoundError('Ticket');
    }

    // Handle assignment change
    if (dto.assigneeId && dto.assigneeId !== ticket.assigneeId) {
      // Spread-and-replace to ensure TypeORM detects the JSONB change.
      // See /memories/repo/typeorm-jsonb-pitfall.md
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

    // Update fields
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
    logger.info(`Ticket updated: ${ticket.ticketNumber}`);

    return updatedTicket;
  }

  /**
   * Build the status filter for ticket search
   */
  private buildStatusFilter(
    filters: TicketFilters
  ): ReturnType<typeof In> | TicketStatus | undefined {
    if (filters.isOpen !== undefined) {
      return filters.isOpen
        ? In([TicketStatus.OPEN, TicketStatus.IN_PROGRESS, TicketStatus.AWAITING_RESPONSE])
        : In([TicketStatus.RESOLVED, TicketStatus.CLOSED]);
    }
    if (filters.status) {
      return Array.isArray(filters.status) ? In(filters.status) : filters.status;
    }
    return undefined;
  }

  /**
   * Search tickets with filters
   */
  async searchTickets(
    organizationId: string,
    filters: TicketFilters,
    page: number = 1,
    limit: number = 20
  ): Promise<{ tickets: Ticket[]; total: number; page: number; totalPages: number }> {
    const baseWhere = this.buildBaseSearchWhere(organizationId, filters);
    logger.debug('searchTickets: baseWhere constructed', {
      organizationId,
      baseWhere: JSON.stringify(baseWhere, null, 2),
      filters: JSON.stringify(filters, null, 2),
    });

    const where = this.buildSearchWhereWithVisibility(baseWhere, filters);
    logger.debug('searchTickets: visibility where clause constructed', {
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

    logger.debug('searchTickets: query executed', {
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

  private buildBaseSearchWhere(
    organizationId: string,
    filters: TicketFilters
  ): Record<string, unknown> {
    const baseWhere: Record<string, unknown> = { organizationId };

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
      baseWhere.subject = Like(`%${filters.searchTerm}%`);
    }
    if (filters.createdAfter) {
      baseWhere.createdAt = MoreThanOrEqual(filters.createdAfter);
    }
    if (filters.createdBefore) {
      baseWhere.createdAt = LessThanOrEqual(filters.createdBefore);
    }

    return baseWhere;
  }

  private buildSearchWhereWithVisibility(
    baseWhere: Record<string, unknown>,
    filters: TicketFilters
  ): Record<string, unknown> | Record<string, unknown>[] {
    if (!filters.visibleToUserId) {
      return this.buildSearchWhereWithoutVisibility(baseWhere, filters);
    }

    // When both creatorDiscordId filter and visibility filter are active,
    // keep creatorDiscordId OUT of baseWhere — otherwise it gets AND'd
    // with every OR branch, over-constraining branches that already scope
    // by creatorId/recipientId/assigneeId. Instead, each branch receives
    // only the conditions it truly needs.
    const visibilityBase = { ...baseWhere };
    const where: Record<string, unknown>[] = [
      { ...visibilityBase, creatorId: filters.visibleToUserId },
      { ...visibilityBase, recipientId: filters.visibleToUserId },
      { ...visibilityBase, assigneeId: filters.visibleToUserId },
    ];

    // Also include tickets created by the same Discord user (unlinked-account fallback)
    if (filters.visibleToDiscordId) {
      where.push({ ...visibilityBase, creatorDiscordId: filters.visibleToDiscordId });
    }

    // Also include tickets routed to role-based recipient types the user qualifies for
    if (filters.visibleToRecipientTypes?.length) {
      where.push({ ...visibilityBase, recipientType: In(filters.visibleToRecipientTypes) });
    }

    // If a creatorDiscordId filter was explicitly requested, apply it as
    // an additional AND on every branch so we only return tickets created
    // by that specific Discord user — but only when it differs from the
    // visibility Discord ID (otherwise branch 4 already covers it).
    if (filters.creatorDiscordId && filters.creatorDiscordId !== filters.visibleToDiscordId) {
      for (const branch of where) {
        branch.creatorDiscordId = filters.creatorDiscordId;
      }
    }

    return where;
  }

  private buildSearchWhereWithoutVisibility(
    baseWhere: Record<string, unknown>,
    filters: TicketFilters
  ): Record<string, unknown> {
    const where = { ...baseWhere };

    // No visibility filter — apply creatorDiscordId directly
    if (filters.creatorDiscordId) {
      where.creatorDiscordId = filters.creatorDiscordId;
    }

    if (filters.creatorId) {
      where.creatorId = filters.creatorId;
    }

    return where;
  }

  /**
   * Add a message to a ticket
   */
  async addMessage(ticketId: string, dto: AddMessageDTO): Promise<Ticket> {
    const ticket = await this.getTicketById(ticketId);
    if (!ticket) {
      throw new NotFoundError('Ticket');
    }

    const message: TicketMessage = {
      id: crypto.randomUUID(),
      authorId: dto.authorId,
      authorName: dto.authorName,
      content: dto.content,
      createdAt: new Date(),
      isInternal: dto.isInternal ?? false,
      attachments: dto.attachments,
    };

    // Spread-and-replace to ensure TypeORM detects the JSONB change.
    // See /memories/repo/typeorm-jsonb-pitfall.md
    ticket.messages = [...(ticket.messages ?? []), message];

    // Track first response time
    if (!ticket.firstResponseAt && ticket.creatorId !== dto.authorId) {
      ticket.firstResponseAt = new Date();
    }

    // Update status if ticket was awaiting response and creator responded
    if (ticket.status === TicketStatus.AWAITING_RESPONSE && ticket.creatorId === dto.authorId) {
      ticket.status = TicketStatus.OPEN;
    }

    const updatedTicket = await this.ticketRepository.save(ticket);
    logger.info(`Message added to ticket: ${ticket.ticketNumber}`);

    return updatedTicket;
  }

  /**
   * Assign a ticket to a user
   */
  async assignTicket(
    ticketId: string,
    assigneeId: string,
    assigneeName: string,
    assignedBy: string
  ): Promise<Ticket> {
    const ticket = await this.getTicketById(ticketId);
    if (!ticket) {
      throw new NotFoundError('Ticket');
    }

    ticket.assigneeId = assigneeId;
    ticket.assigneeName = assigneeName;
    // Spread-and-replace to ensure TypeORM detects the JSONB change.
    // See /memories/repo/typeorm-jsonb-pitfall.md
    ticket.assignmentHistory = [
      ...(ticket.assignmentHistory ?? []),
      {
        assigneeId,
        assigneeName,
        assignedAt: new Date(),
        assignedBy,
      },
    ];

    if (ticket.status === TicketStatus.OPEN) {
      ticket.status = TicketStatus.IN_PROGRESS;
    }

    const updatedTicket = await this.ticketRepository.save(ticket);
    logger.info(`Ticket assigned: ${ticket.ticketNumber} -> ${assigneeName}`);

    return updatedTicket;
  }

  /**
   * Resolve a ticket
   */
  async resolveTicket(ticketId: string, dto: ResolveTicketDTO): Promise<Ticket> {
    const ticket = await this.getTicketById(ticketId);
    if (!ticket) {
      throw new NotFoundError('Ticket');
    }

    ticket.status = TicketStatus.RESOLVED;
    ticket.resolution = dto.resolution;
    ticket.resolvedAt = new Date();
    ticket.resolvedBy = dto.resolvedBy;

    const updatedTicket = await this.ticketRepository.save(ticket);
    logger.info(`Ticket resolved: ${ticket.ticketNumber}`);

    return updatedTicket;
  }

  /**
   * Close a ticket
   */
  async closeTicket(ticketId: string): Promise<Ticket> {
    const ticket = await this.getTicketById(ticketId);
    if (!ticket) {
      throw new NotFoundError('Ticket');
    }

    ticket.status = TicketStatus.CLOSED;
    ticket.closedAt = new Date();

    const updatedTicket = await this.ticketRepository.save(ticket);
    logger.info(`Ticket closed: ${ticket.ticketNumber}`);

    return updatedTicket;
  }

  /**
   * Reopen a ticket
   */
  async reopenTicket(ticketId: string): Promise<Ticket> {
    const ticket = await this.getTicketById(ticketId);
    if (!ticket) {
      throw new NotFoundError('Ticket');
    }

    ticket.status = TicketStatus.OPEN;
    ticket.closedAt = undefined;
    ticket.resolvedAt = undefined;

    const updatedTicket = await this.ticketRepository.save(ticket);
    logger.info(`Ticket reopened: ${ticket.ticketNumber}`);

    return updatedTicket;
  }

  /**
   * Add satisfaction rating to a ticket
   */
  async addFeedback(ticketId: string, rating: number, feedback?: string): Promise<Ticket> {
    const ticket = await this.getTicketById(ticketId);
    if (!ticket) {
      throw new NotFoundError('Ticket');
    }

    if (rating < 1 || rating > 5) {
      throw new ValidationError('Rating must be between 1 and 5');
    }

    ticket.satisfactionRating = rating;
    if (feedback) {
      ticket.feedback = feedback;
    }

    const updatedTicket = await this.ticketRepository.save(ticket);
    logger.info(`Feedback added to ticket: ${ticket.ticketNumber}`);

    return updatedTicket;
  }

  /**
   * Update Discord settings for a ticket
   */
  async updateDiscordSettings(ticketId: string, settings: TicketDiscordSettings): Promise<Ticket> {
    const ticket = await this.getTicketById(ticketId);
    if (!ticket) {
      throw new NotFoundError('Ticket');
    }

    ticket.discordSettings = settings;
    if (settings.channelId) {
      ticket.discordChannelId = settings.channelId;
    }
    if (settings.threadId) {
      ticket.discordThreadId = settings.threadId;
    }

    const updatedTicket = await this.ticketRepository.save(ticket);
    logger.info(`Discord settings updated for ticket: ${ticket.ticketNumber}`);

    return updatedTicket;
  }

  /**
   * Get tickets by Discord channel or thread
   */
  async getTicketByDiscordThread(threadId: string): Promise<Ticket | null> {
    // NOSONAR: TypeORM criteria-object query with static field and validated thread identifier input.
    return this.ticketRepository.findOne({
      where: { discordThreadId: threadId },
    });
  }

  /**
   * Get ticket statistics for an organization
   */
  async getTicketStats(organizationId: string): Promise<{
    total: number;
    open: number;
    inProgress: number;
    resolved: number;
    closed: number;
    byCategory: Record<TicketCategory, number>;
    byPriority: Record<TicketPriority, number>;
    averageResponseTimeMs: number | null;
    averageSatisfactionRating: number | null;
  }> {
    // NOSONAR: TypeORM criteria-object query scoped by tenant organizationId; no dynamic keys/operators.
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
        [TicketCategory.HR]: 0,
        [TicketCategory.RECRUITMENT]: 0,
        [TicketCategory.DIPLOMACY]: 0,
        [TicketCategory.GENERAL]: 0,
        [TicketCategory.SUPPORT]: 0,
      },
      byPriority: {
        [TicketPriority.LOW]: 0,
        [TicketPriority.MEDIUM]: 0,
        [TicketPriority.HIGH]: 0,
        [TicketPriority.URGENT]: 0,
      },
      averageResponseTimeMs: null as number | null,
      averageSatisfactionRating: null as number | null,
    };

    let totalResponseTime = 0;
    let responseCount = 0;
    let totalRating = 0;
    let ratingCount = 0;

    for (const ticket of tickets) {
      // Status counts
      switch (ticket.status) {
        case TicketStatus.OPEN:
        case TicketStatus.AWAITING_RESPONSE:
          stats.open++;
          break;
        case TicketStatus.IN_PROGRESS:
        case TicketStatus.ON_HOLD:
          stats.inProgress++;
          break;
        case TicketStatus.RESOLVED:
          stats.resolved++;
          break;
        case TicketStatus.CLOSED:
          stats.closed++;
          break;
      }

      // Category counts
      stats.byCategory[ticket.category]++;

      // Priority counts
      stats.byPriority[ticket.priority]++;

      // Response time
      if (ticket.firstResponseAt) {
        totalResponseTime += ticket.firstResponseAt.getTime() - ticket.createdAt.getTime();
        responseCount++;
      }

      // Satisfaction rating
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

  /**
   * Delete a ticket
   */
  async deleteTicket(ticketId: string): Promise<void> {
    const ticket = await this.getTicketById(ticketId);
    if (!ticket) {
      throw new NotFoundError('Ticket');
    }

    await this.ticketRepository.remove(ticket);
    logger.info(`Ticket deleted: ${ticket.ticketNumber}`);
  }
}
