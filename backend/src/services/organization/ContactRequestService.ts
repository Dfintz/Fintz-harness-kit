import { Repository } from 'typeorm';

import { AppDataSource } from '../../data-source';
import {
  ContactRequest,
  ContactRequestStatus,
  ContactTargetType,
  MessageVisibility,
} from '../../models/ContactRequest';
import { ContactRequestReply } from '../../models/ContactRequestReply';
import { Federation } from '../../models/Federation';
import { Organization } from '../../models/Organization';
import { PublicOrgProfile } from '../../models/PublicOrgProfile';
import { ApiErrorCode } from '../../types/api';
import { ApiError, ForbiddenError, NotFoundError, ValidationError } from '../../utils/apiErrors';
import { resolveDecryptedDisplayText } from '../../utils/encryptionTransformer';
import { logger } from '../../utils/logger';
import { PaginatedResponse, PaginationOptions } from '../../utils/pagination';
import {
  sendOrganizationNotification,
  sendUserNotification,
} from '../../websocket/controllers/notificationWebSocketController';

import { OrganizationFederationService } from './OrganizationFederationService';

/**
 * Filter options for contact request queries
 */
export interface ContactRequestFilterOptions {
  status?: ContactRequestStatus;
  statuses?: ContactRequestStatus[];
  startDate?: Date;
  endDate?: Date;
  searchTerm?: string;
  /** Viewer's org role — used to enforce visibility restrictions */
  viewerRole?: string;
}

/**
 * Input for creating a contact request
 */
export interface CreateContactRequestInput {
  targetType: ContactTargetType;
  organizationId?: string;
  allianceId?: string;
  senderUserId?: string;
  senderName: string;
  senderEmail?: string;
  rsiHandle?: string;
  discordUsername?: string;
  subject: string;
  message: string;
  contactType?: string;
  visibility?: MessageVisibility;
  visibleToRoles?: string[];
  senderIp?: string;
  userAgent?: string;
}

/**
 * Input for updating a contact request
 */
export interface UpdateContactRequestInput {
  status?: ContactRequestStatus;
  internalNotes?: string;
}

/**
 * Contact request list item (public response)
 */
export interface ContactRequestListItem {
  id: string;
  targetType: ContactTargetType;
  organizationId?: string;
  organizationName?: string;
  allianceId?: string;
  allianceName?: string;
  senderUserId?: string;
  senderName: string;
  senderEmail?: string;
  rsiHandle?: string;
  discordUsername?: string;
  subject: string;
  message: string;
  contactType: string;
  status: ContactRequestStatus;
  internalNotes?: string;
  handledBy?: string;
  handledAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  replyCount?: number;
}

/**
 * Reply list item for contact request threads
 */
export interface ContactRequestReplyItem {
  id: string;
  contactRequestId: string;
  senderUserId: string;
  senderUsername?: string;
  message: string;
  isOrgReply: boolean;
  createdAt: Date;
}

/**
 * Input for creating a reply
 */
export interface CreateContactRequestReplyInput {
  contactRequestId: string;
  senderUserId: string;
  message: string;
  isOrgReply: boolean;
}

/**
 * Contact request statistics
 */
export interface ContactRequestStats {
  total: number;
  pending: number;
  read: number;
  replied: number;
  archived: number;
  spam: number;
  lastWeek: number;
}

/**
 * ContactRequestService - Service for managing contact requests
 *
 * Provides:
 * - Contact form submission handling for organizations and alliances
 * - Request inbox management
 * - Status tracking and updates
 * - Spam prevention
 */
export class ContactRequestService {
  private readonly contactRepository: Repository<ContactRequest>;
  private readonly replyRepository: Repository<ContactRequestReply>;
  private readonly profileRepository: Repository<PublicOrgProfile>;
  private readonly organizationRepository: Repository<Organization>;
  private readonly federationRepository: Repository<Federation>;
  private readonly federationService: OrganizationFederationService;

  constructor() {
    this.contactRepository = AppDataSource.getRepository(ContactRequest);
    this.replyRepository = AppDataSource.getRepository(ContactRequestReply);
    this.profileRepository = AppDataSource.getRepository(PublicOrgProfile);
    this.organizationRepository = AppDataSource.getRepository(Organization);
    this.federationRepository = AppDataSource.getRepository(Federation);
    this.federationService = OrganizationFederationService.getInstance();
  }

  /**
   * Submit a contact request to an organization or alliance
   * No authentication required (public form)
   *
   * @param input Contact request data
   * @returns Created contact request
   */
  async submitContactRequest(input: CreateContactRequestInput): Promise<ContactRequest> {
    // Validate target based on type
    if (input.targetType === ContactTargetType.ORGANIZATION) {
      if (!input.organizationId) {
        throw new ValidationError('Organization ID is required for organization contact requests');
      }

      // Verify organization has a public profile
      const profile = await this.profileRepository.findOne({
        where: { organizationId: input.organizationId, isPublic: true },
      });

      if (!profile) {
        throw new ApiError(
          ApiErrorCode.RESOURCE_NOT_FOUND,
          'Organization not found or not accepting public contact requests',
          404
        );
      }
    } else if (input.targetType === ContactTargetType.ALLIANCE) {
      if (!input.allianceId) {
        throw new ValidationError('Alliance ID is required for alliance contact requests');
      }

      // Verify alliance exists and is public
      const federation = await this.federationService.getPublicFederation(input.allianceId);
      if (!federation) {
        throw new ApiError(
          ApiErrorCode.RESOURCE_NOT_FOUND,
          'Alliance not found or not accepting public contact requests',
          404
        );
      }
    }

    // Create contact request
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
      visibility: input.visibility || MessageVisibility.ALL,
      visibleToRoles: input.visibleToRoles,
      status: ContactRequestStatus.PENDING,
      senderIp: input.senderIp || undefined,
      userAgent: input.userAgent || undefined,
    });

    const saved = await this.contactRepository.save(contactRequest);
    const targetId =
      input.targetType === ContactTargetType.ORGANIZATION ? input.organizationId : input.allianceId;
    logger.info(`Contact request ${saved.id} created for ${input.targetType} ${targetId}`);

    // Send real-time notification to the target organization
    if (input.organizationId) {
      try {
        sendOrganizationNotification(input.organizationId, {
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
      } catch (error_: unknown) {
        logger.warn('Failed to send WebSocket notification for contact request', {
          error: error_,
        });
      }
    }

    return saved;
  }

  /**
   * Get contact requests for an organization
   * Requires authentication (organization member/admin)
   *
   * @param organizationId Organization ID
   * @param filters Optional filter criteria
   * @param pagination Pagination options
   * @returns Paginated list of contact requests
   */
  async getOrganizationContactRequests(
    organizationId: string,
    filters?: ContactRequestFilterOptions,
    pagination?: PaginationOptions
  ): Promise<PaginatedResponse<ContactRequestListItem>> {
    return this.getContactRequests(
      { organizationId, targetType: ContactTargetType.ORGANIZATION },
      filters,
      pagination
    );
  }

  /**
   * Get contact requests for an alliance
   * Requires authentication (alliance member/admin)
   *
   * @param allianceId Alliance ID
   * @param filters Optional filter criteria
   * @param pagination Pagination options
   * @returns Paginated list of contact requests
   */
  async getAllianceContactRequests(
    allianceId: string,
    filters?: ContactRequestFilterOptions,
    pagination?: PaginationOptions
  ): Promise<PaginatedResponse<ContactRequestListItem>> {
    return this.getContactRequests(
      { allianceId, targetType: ContactTargetType.ALLIANCE },
      filters,
      pagination
    );
  }

  /**
   * Internal method to get contact requests with filters
   */
  private async getContactRequests(
    target: { organizationId?: string; allianceId?: string; targetType: ContactTargetType },
    filters?: ContactRequestFilterOptions,
    pagination?: PaginationOptions
  ): Promise<PaginatedResponse<ContactRequestListItem>> {
    const queryBuilder = this.contactRepository
      .createQueryBuilder('request')
      .where('request.targetType = :targetType', { targetType: target.targetType });

    // Filter by target ID
    if (target.organizationId) {
      queryBuilder.andWhere('request.organizationId = :organizationId', {
        organizationId: target.organizationId,
      });
    } else if (target.allianceId) {
      queryBuilder.andWhere('request.allianceId = :allianceId', {
        allianceId: target.allianceId,
      });
    }

    // Apply status filter (multi-select)
    if (filters?.statuses && filters.statuses.length > 0) {
      queryBuilder.andWhere('request.status IN (:...statuses)', {
        statuses: filters.statuses,
      });
    } else if (filters?.status) {
      queryBuilder.andWhere('request.status = :status', {
        status: filters.status,
      });
    }

    // Date range filters
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

    // Search filter
    // NOTE: subject, message, and internalNotes are AES-256-GCM encrypted at rest
    // and cannot be searched with SQL ILIKE.  Search is limited to plaintext columns
    // (senderName, senderEmail).  For content search, results must be filtered
    // client-side after decryption by the TypeORM transformer.
    if (filters?.searchTerm) {
      const searchPattern = `%${filters.searchTerm}%`;
      queryBuilder.andWhere(
        '(request.senderName ILIKE :search OR request.senderEmail ILIKE :search)',
        { search: searchPattern }
      );
    }

    // ── Visibility filter (role-based access) ──────────────────────
    if (filters?.viewerRole) {
      const role = filters.viewerRole.toLowerCase();
      const isLeader = ['owner', 'admin', 'officer'].includes(role);

      // Leaders see everything; others see only messages matching their role
      if (!isLeader) {
        // Validate role to prevent injection (must be alphanumeric with underscores/hyphens only)
        if (!/^[a-z0-9_-]+$/.test(role)) {
          logger.warn('Invalid role format for visibility filter', { role });
          throw new ValidationError('Invalid role format');
        }

        // Use TypeORM parameterization with JSON.stringify for proper escaping
        queryBuilder.andWhere(
          `(request.visibility = :visAll` +
            ` OR request.visibility = :visRole` +
            ` OR (request.visibility = :visCustom AND request."visibleToRoles" @> :roleArray))`,
          {
            visAll: MessageVisibility.ALL,
            visRole: role, // matches if role name equals a visibility value (hr, diplomacy, recruitment)
            visCustom: MessageVisibility.CUSTOM,
            roleArray: JSON.stringify([role]), // JSON.stringify properly escapes special characters
          }
        );
      }
    }

    // Apply pagination
    const page = pagination?.page || 1;
    const limit = pagination?.limit || 20;
    queryBuilder.skip((page - 1) * limit).take(limit);

    // Sorting
    const sortBy = pagination?.sortBy || 'createdAt';
    const sortOrder = pagination?.sortOrder || 'DESC';

    // Validate sortBy for security
    const allowedSortFields = ['createdAt', 'updatedAt', 'status', 'senderName', 'subject'];
    const safeSortBy = allowedSortFields.includes(sortBy) ? sortBy : 'createdAt';

    queryBuilder.orderBy(`request.${safeSortBy}`, sortOrder);

    // Execute query
    const [requests, total] = await queryBuilder.getManyAndCount();

    // Transform to list items
    const data: ContactRequestListItem[] = requests.map(request => ({
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

  /**
   * Get a specific contact request for an organization
   *
   * @param requestId Contact request ID
   * @param organizationId Organization ID (for authorization)
   * @returns Contact request or null
   */
  async getOrganizationContactRequest(
    requestId: string,
    organizationId: string
  ): Promise<ContactRequestListItem | null> {
    return this.getContactRequest(requestId, { organizationId });
  }

  /**
   * Get a specific contact request for an alliance
   *
   * @param requestId Contact request ID
   * @param allianceId Alliance ID (for authorization)
   * @returns Contact request or null
   */
  async getAllianceContactRequest(
    requestId: string,
    allianceId: string
  ): Promise<ContactRequestListItem | null> {
    return this.getContactRequest(requestId, { allianceId });
  }

  /**
   * Internal method to get a specific contact request
   */
  private async getContactRequest(
    requestId: string,
    target: { organizationId?: string; allianceId?: string }
  ): Promise<ContactRequestListItem | null> {
    const whereClause: Record<string, string> = { id: requestId };
    if (target.organizationId) {
      whereClause.organizationId = target.organizationId;
    } else if (target.allianceId) {
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

  /**
   * Update a contact request for an organization
   */
  async updateOrganizationContactRequest(
    requestId: string,
    organizationId: string,
    input: UpdateContactRequestInput,
    userId: string
  ): Promise<ContactRequest | null> {
    return this.updateContactRequest(requestId, { organizationId }, input, userId);
  }

  /**
   * Update a contact request for an alliance
   */
  async updateAllianceContactRequest(
    requestId: string,
    allianceId: string,
    input: UpdateContactRequestInput,
    userId: string
  ): Promise<ContactRequest | null> {
    return this.updateContactRequest(requestId, { allianceId }, input, userId);
  }

  /**
   * Internal method to update a contact request
   */
  private async updateContactRequest(
    requestId: string,
    target: { organizationId?: string; allianceId?: string },
    input: UpdateContactRequestInput,
    userId: string
  ): Promise<ContactRequest | null> {
    const whereClause: Record<string, string> = { id: requestId };
    if (target.organizationId) {
      whereClause.organizationId = target.organizationId;
    } else if (target.allianceId) {
      whereClause.allianceId = target.allianceId;
    }

    const request = await this.contactRepository.findOne({
      where: whereClause,
    });

    if (!request) {
      return null;
    }

    // Update fields
    if (input.status !== undefined) {
      request.status = input.status;
      request.handledBy = userId;
      request.handledAt = new Date();
    }
    if (input.internalNotes !== undefined) {
      request.internalNotes = input.internalNotes;
    }

    const updated = await this.contactRepository.save(request);
    logger.info(`Contact request ${requestId} updated by ${userId}`);

    return updated;
  }

  /**
   * Mark an organization contact request as read
   */
  async markOrganizationRequestAsRead(
    requestId: string,
    organizationId: string,
    userId: string
  ): Promise<ContactRequest | null> {
    return this.updateOrganizationContactRequest(
      requestId,
      organizationId,
      {
        status: ContactRequestStatus.READ,
      },
      userId
    );
  }

  /**
   * Mark an alliance contact request as read
   */
  async markAllianceRequestAsRead(
    requestId: string,
    allianceId: string,
    userId: string
  ): Promise<ContactRequest | null> {
    return this.updateAllianceContactRequest(
      requestId,
      allianceId,
      {
        status: ContactRequestStatus.READ,
      },
      userId
    );
  }

  /**
   * Mark an organization contact request as replied
   */
  async markOrganizationRequestAsReplied(
    requestId: string,
    organizationId: string,
    userId: string
  ): Promise<ContactRequest | null> {
    return this.updateOrganizationContactRequest(
      requestId,
      organizationId,
      {
        status: ContactRequestStatus.REPLIED,
      },
      userId
    );
  }

  /**
   * Mark an alliance contact request as replied
   */
  async markAllianceRequestAsReplied(
    requestId: string,
    allianceId: string,
    userId: string
  ): Promise<ContactRequest | null> {
    return this.updateAllianceContactRequest(
      requestId,
      allianceId,
      {
        status: ContactRequestStatus.REPLIED,
      },
      userId
    );
  }

  /**
   * Archive an organization contact request
   */
  async archiveOrganizationRequest(
    requestId: string,
    organizationId: string,
    userId: string
  ): Promise<ContactRequest | null> {
    return this.updateOrganizationContactRequest(
      requestId,
      organizationId,
      {
        status: ContactRequestStatus.ARCHIVED,
      },
      userId
    );
  }

  /**
   * Archive an alliance contact request
   */
  async archiveAllianceRequest(
    requestId: string,
    allianceId: string,
    userId: string
  ): Promise<ContactRequest | null> {
    return this.updateAllianceContactRequest(
      requestId,
      allianceId,
      {
        status: ContactRequestStatus.ARCHIVED,
      },
      userId
    );
  }

  /**
   * Mark an organization contact request as spam
   */
  async markOrganizationRequestAsSpam(
    requestId: string,
    organizationId: string,
    userId: string
  ): Promise<ContactRequest | null> {
    return this.updateOrganizationContactRequest(
      requestId,
      organizationId,
      {
        status: ContactRequestStatus.SPAM,
      },
      userId
    );
  }

  /**
   * Mark an alliance contact request as spam
   */
  async markAllianceRequestAsSpam(
    requestId: string,
    allianceId: string,
    userId: string
  ): Promise<ContactRequest | null> {
    return this.updateAllianceContactRequest(
      requestId,
      allianceId,
      {
        status: ContactRequestStatus.SPAM,
      },
      userId
    );
  }

  /**
   * Delete an organization contact request
   */
  async deleteOrganizationContactRequest(
    requestId: string,
    organizationId: string
  ): Promise<boolean> {
    const result = await this.contactRepository.delete({
      id: requestId,
      organizationId,
    });
    return (result.affected || 0) > 0;
  }

  /**
   * Delete an alliance contact request
   */
  async deleteAllianceContactRequest(requestId: string, allianceId: string): Promise<boolean> {
    const result = await this.contactRepository.delete({
      id: requestId,
      allianceId,
    });
    return (result.affected || 0) > 0;
  }

  /**
   * Get contact request statistics for an organization
   */
  async getOrganizationContactRequestStats(organizationId: string): Promise<ContactRequestStats> {
    return this.getContactRequestStats({ organizationId });
  }

  /**
   * Get contact request statistics for an alliance
   */
  async getAllianceContactRequestStats(allianceId: string): Promise<ContactRequestStats> {
    return this.getContactRequestStats({ allianceId });
  }

  /**
   * Internal method to get contact request statistics
   */
  private async getContactRequestStats(target: {
    organizationId?: string;
    allianceId?: string;
  }): Promise<ContactRequestStats> {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const baseWhere = target.organizationId
      ? { organizationId: target.organizationId }
      : { allianceId: target.allianceId };

    const [total, pending, read, replied, archived, spam, lastWeek] = await Promise.all([
      this.contactRepository.count({ where: baseWhere }),
      this.contactRepository.count({
        where: { ...baseWhere, status: ContactRequestStatus.PENDING },
      }),
      this.contactRepository.count({ where: { ...baseWhere, status: ContactRequestStatus.READ } }),
      this.contactRepository.count({
        where: { ...baseWhere, status: ContactRequestStatus.REPLIED },
      }),
      this.contactRepository.count({
        where: { ...baseWhere, status: ContactRequestStatus.ARCHIVED },
      }),
      this.contactRepository.count({ where: { ...baseWhere, status: ContactRequestStatus.SPAM } }),
      this.contactRepository
        .createQueryBuilder('request')
        .where(
          target.organizationId
            ? 'request.organizationId = :targetId'
            : 'request.allianceId = :targetId',
          { targetId: target.organizationId || target.allianceId }
        )
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

  /**
   * Get pending request count for an organization
   */
  async getOrganizationPendingCount(organizationId: string): Promise<number> {
    return this.contactRepository.count({
      where: { organizationId, status: ContactRequestStatus.PENDING },
    });
  }

  /**
   * Get pending request count for an alliance
   */
  async getAlliancePendingCount(allianceId: string): Promise<number> {
    return this.contactRepository.count({
      where: { allianceId, status: ContactRequestStatus.PENDING },
    });
  }

  /**
   * Get available contact type options
   */
  getContactTypeOptions(): string[] {
    return ['general', 'recruitment', 'partnership', 'question', 'feedback', 'other'];
  }

  /**
   * Get available status options
   */
  getStatusOptions(): ContactRequestStatus[] {
    return Object.values(ContactRequestStatus);
  }

  /**
   * Get available target type options
   */
  getTargetTypeOptions(): ContactTargetType[] {
    return Object.values(ContactTargetType);
  }

  // ==================== INBOX & REPLY METHODS ====================

  /**
   * Get contact requests sent by a specific user (their outbox/sent messages)
   */
  async getUserSentMessages(
    userId: string,
    pagination?: PaginationOptions
  ): Promise<PaginatedResponse<ContactRequestListItem>> {
    const page = pagination?.page || 1;
    const limit = pagination?.limit || 20;

    const queryBuilder = this.contactRepository
      .createQueryBuilder('request')
      .leftJoinAndSelect('request.organization', 'organization')
      .where('request.senderUserId = :userId', { userId })
      .andWhere('request.status != :archivedStatus', {
        archivedStatus: ContactRequestStatus.ARCHIVED,
      })
      .orderBy('request.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [requests, total] = await queryBuilder.getManyAndCount();

    // Batch-resolve alliance names for any alliance-targeted messages
    const allianceIds = [...new Set(requests.filter(r => r.allianceId).map(r => r.allianceId!))];
    const allianceNameMap = new Map<string, string>();
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

    const data: ContactRequestListItem[] = requests.map(request => ({
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
      subject: resolveDecryptedDisplayText(request.subject),
      message: resolveDecryptedDisplayText(request.message),
      contactType: request.contactType,
      status: request.status,
      internalNotes: undefined, // Don't expose internal notes to sender
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

  /**
   * Archive a message from the sender's inbox (hides it from the default list).
   * Scoped to the sender — only the user who sent the message may archive it.
   * Uses a targeted UPDATE so the encrypted subject/message columns are never
   * re-written (a full save would re-encrypt any leaked ciphertext).
   */
  async archiveUserMessage(requestId: string, userId: string): Promise<boolean> {
    const result = await this.contactRepository.update(
      { id: requestId, senderUserId: userId },
      { status: ContactRequestStatus.ARCHIVED }
    );
    const archived = (result.affected ?? 0) > 0;
    if (archived) {
      logger.info(`Contact request ${requestId} archived by sender ${userId}`);
    }
    return archived;
  }

  /**
   * Permanently delete a message from the sender's inbox.
   * Scoped to the sender; replies are removed via the FK cascade.
   */
  async deleteUserMessage(requestId: string, userId: string): Promise<boolean> {
    const result = await this.contactRepository.delete({
      id: requestId,
      senderUserId: userId,
    });
    const deleted = (result.affected ?? 0) > 0;
    if (deleted) {
      logger.info(`Contact request ${requestId} deleted by sender ${userId}`);
    }
    return deleted;
  }

  /**
   * Get a specific contact request for the sender (to view their own message + replies)
   * Includes the target organization/alliance name for display.
   */
  async getUserContactRequest(
    requestId: string,
    userId: string
  ): Promise<
    (ContactRequestListItem & { organizationName?: string; allianceName?: string }) | null
  > {
    const request = await this.contactRepository.findOne({
      where: { id: requestId, senderUserId: userId },
      relations: ['organization'],
    });

    if (!request) {
      return null;
    }

    // Look up alliance name separately (no direct relation on entity)
    let allianceName: string | undefined;
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
      subject: resolveDecryptedDisplayText(request.subject),
      message: resolveDecryptedDisplayText(request.message),
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

  /**
   * Add a reply to a contact request
   *
   * @param input Reply data
   * @returns Created reply
   */
  async addReply(input: CreateContactRequestReplyInput): Promise<ContactRequestReply> {
    const contactRequest = await this.contactRepository.findOne({
      where: { id: input.contactRequestId },
    });

    if (!contactRequest) {
      throw new NotFoundError('Contact request');
    }

    // Verify the sender has access (either the original sender or org admin)
    if (!input.isOrgReply && contactRequest.senderUserId !== input.senderUserId) {
      throw new ForbiddenError('You do not have access to reply to this contact request');
    }

    const reply = this.replyRepository.create({
      contactRequestId: input.contactRequestId,
      senderUserId: input.senderUserId,
      message: input.message,
      isOrgReply: input.isOrgReply,
    });

    const saved = await this.replyRepository.save(reply);

    // Auto-update contact request status to REPLIED if org replies
    if (input.isOrgReply && contactRequest.status !== ContactRequestStatus.REPLIED) {
      contactRequest.status = ContactRequestStatus.REPLIED;
      contactRequest.handledBy = input.senderUserId;
      contactRequest.handledAt = new Date();
      await this.contactRepository.save(contactRequest);
    }

    // Send notification to the other party
    try {
      if (input.isOrgReply && contactRequest.senderUserId) {
        // Org replied → notify original sender
        sendUserNotification(contactRequest.senderUserId, {
          type: 'info',
          title: 'New Reply to Your Message',
          message: `Your "${contactRequest.subject}" inquiry received a reply`,
          category: 'organization',
          data: { contactRequestId: contactRequest.id },
          actionUrl: `/inbox/${contactRequest.id}`,
        });
      } else if (!input.isOrgReply && contactRequest.organizationId) {
        // Sender replied → notify org
        sendOrganizationNotification(contactRequest.organizationId, {
          type: 'info',
          title: 'New Reply on Contact Request',
          message: `${contactRequest.senderName} replied to "${contactRequest.subject}"`,
          category: 'organization',
          data: { contactRequestId: contactRequest.id },
          actionUrl: `/settings/contact-requests/${contactRequest.id}`,
        });
      }
    } catch (error_: unknown) {
      logger.warn('Failed to send reply notification', { error: error_ });
    }

    logger.info(`Reply ${saved.id} added to contact request ${input.contactRequestId}`);

    // Reload the saved reply with sender relation for complete response
    const replyWithSender = await this.replyRepository.findOne({
      where: { id: saved.id },
      relations: ['senderUser'],
    });

    return replyWithSender ?? saved;
  }

  /**
   * Get replies for a contact request
   */
  async getReplies(contactRequestId: string): Promise<ContactRequestReplyItem[]> {
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
      message: resolveDecryptedDisplayText(reply.message),
      isOrgReply: reply.isOrgReply,
      createdAt: reply.createdAt,
    }));
  }

  /**
   * Get unread count for a user (messages sent TO their org that are pending)
   * Plus replies to messages they've sent
   */
  async getUserInboxUnreadCount(userId: string, organizationId?: string): Promise<number> {
    let count = 0;

    // Count pending contact requests for user's organization
    if (organizationId) {
      count += await this.contactRepository.count({
        where: {
          organizationId,
          status: ContactRequestStatus.PENDING,
        },
      });
    }

    // Count unread replies to user's sent messages
    // (replies that came after the user's last view - simplified to just open threads)
    const sentRequests = await this.contactRepository.find({
      where: { senderUserId: userId, status: ContactRequestStatus.REPLIED },
    });
    count += sentRequests.length;

    return count;
  }
}

