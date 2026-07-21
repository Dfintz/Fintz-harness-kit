import { FindOptionsWhere } from 'typeorm';

import { AppDataSource } from '../../data-source';
import { Poll, PollOption, PollStatus, PollType, PollVisibility } from '../../models/Poll';
import { PollVote } from '../../models/PollVote';
import { ConflictError, NotFoundError, ValidationError } from '../../utils/apiErrors';
import { AuditEventType, logAuditEvent } from '../../utils/auditLogger';
import { logger } from '../../utils/logger';
import { PaginatedResponse, PaginationOptions } from '../../utils/pagination';
import { emitToOrganization } from '../../websocket/websocketServer';
import { TenantService } from '../base/TenantService';

import { DiscordPollService } from './DiscordPollService';

// ==================== AUDIT ENUM ====================

export enum PollAuditAction {
  POLL_CREATED = 'poll_created',
  POLL_UPDATED = 'poll_updated',
  POLL_CLOSED = 'poll_closed',
  POLL_CANCELLED = 'poll_cancelled',
  POLL_DELETED = 'poll_deleted',
  VOTE_CAST = 'vote_cast',
}

// ==================== DTOs ====================

export interface CreatePollDTO {
  title: string;
  description?: string;
  pollType: PollType;
  visibility?: PollVisibility;
  options: PollOption[];
  isAnonymous?: boolean;
  maxSelections?: number;
  endsAt?: Date;
  allowedRoles?: string[];
  status?: PollStatus;
}

export interface UpdatePollDTO {
  title?: string;
  description?: string;
  visibility?: PollVisibility;
  options?: PollOption[];
  isAnonymous?: boolean;
  maxSelections?: number;
  endsAt?: Date;
  allowedRoles?: string[];
}

export interface CastVoteDTO {
  optionId: string;
  rank?: number;
}

export interface PollSearchFilters {
  status?: PollStatus;
  pollType?: PollType;
  createdBy?: string;
  searchTerm?: string;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}

export interface PollResults {
  pollId: string;
  totalVotes: number;
  optionCounts: Record<string, number>;
  options: Array<PollOption & { optionId: string; voteCount: number; percentage: number }>;
  hasVoted: boolean;
  userVotes?: string[];
}

// ==================== SERVICE ====================

/**
 * PollService
 *
 * Core service for organization polls and voting. Manages all poll lifecycle operations.
 *
 * MULTI-TENANCY: Tenant-aware via TenantService base class
 * CACHING: Enabled with 5-minute TTL
 * AUDIT LOGGING: Comprehensive audit trail for all operations
 */
export class PollService extends TenantService<Poll> {
  private readonly voteRepository = AppDataSource.getRepository(PollVote);
  private readonly discordPollService = new DiscordPollService();

  constructor() {
    super(AppDataSource.getRepository(Poll), {
      enableCache: true,
      cacheTTL: 300,
      cacheCheckPeriod: 60,
    });
  }

  // ==================== AUDIT HELPER ====================

  private logPollAudit(
    action: PollAuditAction,
    poll: Poll,
    performedById: string,
    performedByName: string,
    details?: Record<string, unknown>
  ): void {
    logAuditEvent({
      eventType: AuditEventType.SENSITIVE_DATA_ACCESS,
      userId: performedById,
      username: performedByName,
      resource: `poll/${poll.id}`,
      action,
      message: `Poll ${action}: ${poll.title} (${poll.pollType})`,
      metadata: {
        pollId: poll.id,
        pollType: poll.pollType,
        status: poll.status,
        ...details,
      },
    });
  }

  // ==================== AUTO-CLOSE HELPER ====================

  /**
   * Check if a poll has expired and auto-close it
   */
  private async autoCloseIfExpired(poll: Poll): Promise<Poll> {
    if (poll.status === PollStatus.ACTIVE && poll.endsAt && new Date() > poll.endsAt) {
      poll.status = PollStatus.CLOSED;
      poll.closedAt = new Date();
      await this.repository.save(poll);

      logger.info(`Poll auto-closed: ${poll.id} (expired at ${poll.endsAt.toISOString()})`);

      emitToOrganization(poll.organizationId, 'poll:closed', {
        pollId: poll.id,
        closedAt: poll.closedAt,
        reason: 'expired',
      });

      // Close Discord mirror embeds (fire-and-forget)
      this.getResults(poll.organizationId, poll.id, 'system')
        .then(results => this.discordPollService.closeAllMirrors(poll, results))
        .catch(err => {
          logger.warn(
            `Failed to close Discord mirrors for auto-closed poll ${poll.id}: ${(err as Error).message}`
          );
        });
    }
    return poll;
  }

  // ==================== CREATE ====================

  async createPoll(
    organizationId: string,
    creatorId: string,
    creatorName: string,
    dto: CreatePollDTO
  ): Promise<Poll> {
    const poll = await this.create(organizationId, {
      createdBy: creatorId,
      createdByName: creatorName,
      title: dto.title,
      description: dto.description,
      pollType: dto.pollType,
      visibility: dto.visibility ?? PollVisibility.MEMBERS_ONLY,
      options: dto.options,
      isAnonymous: dto.isAnonymous ?? false,
      maxSelections: dto.maxSelections ?? 1,
      endsAt: dto.endsAt,
      allowedRoles: dto.allowedRoles,
      status: dto.status ?? PollStatus.ACTIVE,
    });

    this.logPollAudit(PollAuditAction.POLL_CREATED, poll, creatorId, creatorName, {
      optionCount: dto.options.length,
      pollType: dto.pollType,
    });

    emitToOrganization(organizationId, 'poll:created', {
      pollId: poll.id,
      title: poll.title,
    });

    logger.info(`Poll created: ${poll.id} (${dto.pollType}) by ${creatorName}`);
    return poll;
  }

  // ==================== READ ====================

  async getPollById(organizationId: string, pollId: string): Promise<Poll | null> {
    const poll = await this.findById(organizationId, pollId);
    if (!poll) {
      return null;
    }
    return this.autoCloseIfExpired(poll);
  }

  async listPolls(
    organizationId: string,
    filters: PollSearchFilters,
    pagination: PaginationOptions
  ): Promise<PaginatedResponse<Poll>> {
    const where: FindOptionsWhere<Poll> = {};

    if (filters.status) {
      where.status = filters.status;
    }
    if (filters.pollType) {
      where.pollType = filters.pollType;
    }
    if (filters.createdBy) {
      where.createdBy = filters.createdBy;
    }

    const result = await this.findAllPaginated(
      organizationId,
      {
        ...pagination,
        sortBy: filters.sortBy ?? 'createdAt',
        sortOrder: filters.sortOrder ?? 'DESC',
      },
      where
    );

    // Auto-close any expired polls in the results
    const processed = await Promise.all(result.data.map(poll => this.autoCloseIfExpired(poll)));
    result.data = processed;

    return result;
  }

  // ==================== UPDATE ====================

  async updatePoll(
    organizationId: string,
    pollId: string,
    userId: string,
    userName: string,
    dto: UpdatePollDTO
  ): Promise<Poll | null> {
    const poll = await this.findById(organizationId, pollId);
    if (!poll) {
      return null;
    }

    if (poll.status !== PollStatus.DRAFT && poll.status !== PollStatus.ACTIVE) {
      throw new ConflictError('Cannot update a closed or cancelled poll');
    }

    // If poll has votes, only allow title/description/endsAt changes
    const voteCount = await this.voteRepository.count({ where: { pollId } });
    if (voteCount > 0 && dto.options) {
      throw new ConflictError('Cannot change options after votes have been cast');
    }

    const updated = await this.update(organizationId, pollId, dto);
    if (updated) {
      this.logPollAudit(PollAuditAction.POLL_UPDATED, updated, userId, userName);

      emitToOrganization(organizationId, 'poll:updated', {
        pollId: updated.id,
        title: updated.title,
      });
    }

    return updated;
  }

  // ==================== DELETE ====================

  async deletePoll(
    organizationId: string,
    pollId: string,
    userId: string,
    userName: string
  ): Promise<void> {
    const poll = await this.findById(organizationId, pollId);
    if (!poll) {
      throw new NotFoundError('Poll');
    }

    // Delete all votes first
    await this.voteRepository.delete({ pollId });

    await this.delete(organizationId, pollId);

    this.logPollAudit(PollAuditAction.POLL_DELETED, poll, userId, userName);

    emitToOrganization(organizationId, 'poll:deleted', { pollId });

    logger.info(`Poll deleted: ${pollId} by ${userName}`);
  }

  // ==================== VOTING ====================

  async castVote(
    organizationId: string,
    pollId: string,
    userId: string,
    votes: CastVoteDTO[]
  ): Promise<void> {
    const poll = await this.findById(organizationId, pollId);
    if (!poll) {
      throw new NotFoundError('Poll');
    }

    // Auto-close check
    await this.autoCloseIfExpired(poll);
    if (poll.status !== PollStatus.ACTIVE) {
      throw new ConflictError('Poll is not active');
    }

    // Validate options exist
    const validOptionIds = new Set(poll.options.map(o => o.id));
    for (const vote of votes) {
      if (!validOptionIds.has(vote.optionId)) {
        throw new ValidationError(`Invalid option: ${vote.optionId}`);
      }
    }

    // Enforce maxSelections
    if (votes.length > poll.maxSelections) {
      throw new ValidationError(`Maximum ${poll.maxSelections} selection(s) allowed`);
    }

    // For single_choice, only 1 vote allowed
    if (poll.pollType === PollType.SINGLE_CHOICE && votes.length > 1) {
      throw new ValidationError('Single choice polls allow only 1 selection');
    }

    // Remove existing votes for this user on this poll (replace strategy)
    await this.voteRepository.delete({ pollId, userId });

    // Cast new votes
    const voteEntities = votes.map(v =>
      this.voteRepository.create({
        organizationId,
        pollId,
        userId,
        optionId: v.optionId,
        rank: v.rank,
      })
    );

    await this.voteRepository.save(voteEntities);

    emitToOrganization(organizationId, 'poll:vote_cast', {
      pollId,
      totalVotes: await this.voteRepository.count({ where: { pollId } }),
    });

    // Update Discord mirror embeds with new vote counts (fire-and-forget)
    this.getResults(organizationId, pollId, 'system')
      .then(results => this.discordPollService.updateAllMirrors(poll, results))
      .catch(err => {
        logger.warn(
          `Failed to update Discord mirrors for poll ${pollId}: ${(err as Error).message}`
        );
      });

    logger.debug(`Vote cast on poll ${pollId} by user ${userId}`);
  }

  /**
   * Toggle a single option for a user's vote.
   *
   * Designed for Discord button interactions, where each click sends exactly one
   * option. For multiple-choice/approval polls this lets a user accumulate several
   * selections instead of each press overwriting the previous one. For single-choice
   * polls, selecting an option replaces any previous selection, and clicking the
   * already-selected option clears the vote.
   *
   * @returns whether the option ended up selected, plus the user's full current selection.
   */
  async toggleVote(
    organizationId: string,
    pollId: string,
    userId: string,
    optionId: string
  ): Promise<{ selected: boolean; selectedOptionIds: string[] }> {
    const poll = await this.findById(organizationId, pollId);
    if (!poll) {
      throw new NotFoundError('Poll');
    }

    await this.autoCloseIfExpired(poll);
    if (poll.status !== PollStatus.ACTIVE) {
      throw new ConflictError('Poll is not active');
    }

    const validOptionIds = new Set(poll.options.map(o => o.id));
    if (!validOptionIds.has(optionId)) {
      throw new ValidationError(`Invalid option: ${optionId}`);
    }

    const allowsMultiple =
      poll.pollType === PollType.MULTIPLE_CHOICE || poll.pollType === PollType.APPROVAL;

    const existingVotes = await this.voteRepository
      .createQueryBuilder('v')
      .select('v."optionId"', 'optionId')
      .where('v."pollId" = :pollId', { pollId })
      .andWhere('v."userId" = :userId', { userId })
      .getRawMany<{ optionId: string }>();
    const selection = new Set(existingVotes.map(v => v.optionId));

    let selected: boolean;
    if (allowsMultiple) {
      if (selection.has(optionId)) {
        selection.delete(optionId);
        selected = false;
      } else {
        if (selection.size >= poll.maxSelections) {
          throw new ValidationError(`You can select at most ${poll.maxSelections} option(s).`);
        }
        selection.add(optionId);
        selected = true;
      }
    } else if (selection.size === 1 && selection.has(optionId)) {
      // Single-choice: clicking the currently selected option clears the vote.
      selection.clear();
      selected = false;
    } else {
      selection.clear();
      selection.add(optionId);
      selected = true;
    }

    const selectedOptionIds = Array.from(selection);

    // Delegate persistence to castVote so Discord mirror updates, websocket events,
    // and validation all run through a single code path.
    await this.castVote(
      organizationId,
      pollId,
      userId,
      selectedOptionIds.map(id => ({ optionId: id }))
    );

    return { selected, selectedOptionIds };
  }

  // ==================== RESULTS ====================

  async getResults(
    organizationId: string,
    pollId: string,
    currentUserId: string
  ): Promise<PollResults | null> {
    const poll = await this.findById(organizationId, pollId);
    if (!poll) {
      return null;
    }

    // Auto-close check
    await this.autoCloseIfExpired(poll);

    // SQL aggregation: count votes per option + unique voters in one query
    const voteCounts = await this.voteRepository
      .createQueryBuilder('v')
      .select('v."optionId"', 'optionId')
      .addSelect('COUNT(*)::int', 'count')
      .where('v."pollId" = :pollId', { pollId })
      .groupBy('v."optionId"')
      .getRawMany<{ optionId: string; count: number }>();

    const uniqueVoters = await this.voteRepository
      .createQueryBuilder('v')
      .select('COUNT(DISTINCT v."userId")::int', 'count')
      .where('v."pollId" = :pollId', { pollId })
      .getRawOne<{ count: number }>();

    // Build option counts map
    const optionCounts: Record<string, number> = {};
    for (const option of poll.options) {
      optionCounts[option.id] = 0;
    }
    for (const row of voteCounts) {
      if (optionCounts[row.optionId] !== undefined) {
        optionCounts[row.optionId] = row.count;
      }
    }

    const totalVoters = uniqueVoters?.count ?? 0;
    const totalVotes = voteCounts.reduce((sum, row) => sum + row.count, 0);

    const optionsWithCounts = poll.options.map(option => ({
      ...option,
      // Expose `optionId` alongside `id` so web clients (which key results and the
      // "your vote" highlight off `optionId`) line up with the persisted option ids.
      optionId: option.id,
      voteCount: optionCounts[option.id] || 0,
      percentage:
        totalVoters > 0 ? Math.round(((optionCounts[option.id] || 0) / totalVoters) * 100) : 0,
    }));

    // Check if current user has voted (small targeted query)
    const userVoteRows = await this.voteRepository
      .createQueryBuilder('v')
      .select('v."optionId"', 'optionId')
      .where('v."pollId" = :pollId', { pollId })
      .andWhere('v."userId" = :userId', { userId: currentUserId })
      .getRawMany<{ optionId: string }>();
    const userVotes = userVoteRows.map(v => v.optionId);

    return {
      pollId,
      totalVotes,
      optionCounts,
      options: optionsWithCounts,
      hasVoted: userVotes.length > 0,
      userVotes,
    };
  }

  // ==================== CLOSE / CANCEL ====================

  async closePoll(
    organizationId: string,
    pollId: string,
    userId: string,
    userName: string
  ): Promise<Poll | null> {
    const poll = await this.findById(organizationId, pollId);
    if (!poll) {
      return null;
    }

    if (poll.status !== PollStatus.ACTIVE) {
      throw new ConflictError('Only active polls can be closed');
    }

    const updated = await this.update(organizationId, pollId, {
      status: PollStatus.CLOSED,
      closedBy: userId,
      closedAt: new Date(),
    });

    if (updated) {
      this.logPollAudit(PollAuditAction.POLL_CLOSED, updated, userId, userName);

      emitToOrganization(organizationId, 'poll:closed', {
        pollId: updated.id,
        closedBy: userName,
        closedAt: updated.closedAt,
      });

      // Close Discord mirror embeds (fire-and-forget)
      this.getResults(organizationId, pollId, 'system')
        .then(results => this.discordPollService.closeAllMirrors(updated, results))
        .catch(err => {
          logger.warn(
            `Failed to close Discord mirrors for poll ${pollId}: ${(err as Error).message}`
          );
        });

      logger.info(`Poll closed: ${pollId} by ${userName}`);
    }

    return updated;
  }

  // ==================== BATCH AUTO-CLOSE (for scheduler) ====================

  async closeExpiredPolls(): Promise<number> {
    const now = new Date();

    const expiredPolls = await this.repository
      .createQueryBuilder('poll')
      .where('poll.status = :status', { status: PollStatus.ACTIVE })
      .andWhere('poll.endsAt IS NOT NULL')
      .andWhere('poll.endsAt < :now', { now })
      .getMany();

    let closedCount = 0;
    for (const poll of expiredPolls) {
      const closedAt = new Date();
      const transition = await this.repository
        .createQueryBuilder()
        .update(Poll)
        .set({ status: PollStatus.CLOSED, closedAt })
        .where('id = :pollId', { pollId: poll.id })
        .andWhere('status = :status', { status: PollStatus.ACTIVE })
        .execute();

      if ((transition.affected ?? 0) === 0) {
        logger.info('Poll already closed by another worker, skipping duplicate close', {
          pollId: poll.id,
        });
        continue;
      }

      const closedPoll = await this.repository.findOne({
        where: {
          id: poll.id,
          organizationId: poll.organizationId,
        },
      });

      if (!closedPoll) {
        logger.warn(
          'Expired poll was closed but could not be reloaded for downstream notifications',
          {
            pollId: poll.id,
            organizationId: poll.organizationId,
          }
        );
        continue;
      }

      emitToOrganization(closedPoll.organizationId, 'poll:closed', {
        pollId: closedPoll.id,
        closedAt: closedPoll.closedAt,
        reason: 'expired',
      });

      // Close Discord mirror embeds (fire-and-forget)
      this.getResults(closedPoll.organizationId, closedPoll.id, 'system')
        .then(results => this.discordPollService.closeAllMirrors(closedPoll, results))
        .catch(err => {
          logger.warn(
            `Failed to close Discord mirrors for expired poll ${closedPoll.id}: ${(err as Error).message}`
          );
        });

      closedCount++;
    }

    if (closedCount > 0) {
      logger.info(`Auto-closed ${closedCount} expired poll(s)`);
    }

    return closedCount;
  }
}

