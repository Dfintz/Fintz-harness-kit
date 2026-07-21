import type { FederationAmbassadorPermission } from '@sc-fleet-manager/shared-types';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';

import { AppDataSource } from '../../data-source';
import { Federation } from '../../models/Federation';
import { FederationMember } from '../../models/FederationMember';
import { Poll, PollOption, PollStatus, PollType, PollVisibility } from '../../models/Poll';
import { PollMirrorScope } from '../../models/PollDiscordMirror';
import { PollVote } from '../../models/PollVote';
import { NotFoundError, ValidationError } from '../../utils/apiErrors';
import { logger } from '../../utils/logger';
import { DiscordPollService } from '../poll/DiscordPollService';

import { FederationAmbassadorService } from './FederationAmbassadorService';
import { requireFederationPermission } from './federationPermissions';

// ─── Types ────────────────────────────────────────────────────

export type FederationVotingMode = 'equal' | 'weighted';

export interface FederationPollData {
  id: string;
  federationId: string;
  title: string;
  description: string | null;
  pollType: string;
  options: PollOption[];
  votingMode: FederationVotingMode;
  isAnonymous: boolean;
  maxSelections: number;
  status: string;
  createdBy: string;
  createdByName: string | null;
  endsAt: Date | null;
  closedAt: Date | null;
  totalVotes: number;
  createdAt: Date;
}

export interface FederationPollResults {
  pollId: string;
  totalVotes: number;
  optionCounts: Record<string, number>;
  hasVoted: boolean;
}

export interface FederationPollDiscordPostResult {
  mirrorId: string;
  guildId: string;
  channelId: string;
  status: string;
  messageId: string | null;
}

/**
 * FederationPollService
 *
 * Manages federation-scoped polls. Ambassadors with 'vote' permission
 * can cast votes. Weighted voting uses FederationMember.votingPower.
 *
 * Reuses the existing Poll + PollVote entities with federationId scoping.
 */
export class FederationPollService {
  private static instance: FederationPollService;
  private readonly pollRepository: Repository<Poll>;
  private readonly voteRepository: Repository<PollVote>;
  private readonly memberRepository: Repository<FederationMember>;
  private readonly federationRepository: Repository<Federation>;
  private readonly discordPollService: DiscordPollService;
  private readonly ambassadorService: FederationAmbassadorService;

  constructor() {
    this.pollRepository = AppDataSource.getRepository(Poll);
    this.voteRepository = AppDataSource.getRepository(PollVote);
    this.memberRepository = AppDataSource.getRepository(FederationMember);
    this.federationRepository = AppDataSource.getRepository(Federation);
    this.discordPollService = new DiscordPollService();
    this.ambassadorService = FederationAmbassadorService.getInstance();
  }

  public static getInstance(): FederationPollService {
    if (!FederationPollService.instance) {
      FederationPollService.instance = new FederationPollService();
    }
    return FederationPollService.instance;
  }

  // ─── Helpers ───────────────────────────────────────────────

  private toData(entity: Poll): FederationPollData {
    return {
      id: entity.id,
      federationId: entity.federationId ?? '',
      title: entity.title,
      description: entity.description ?? null,
      pollType: entity.pollType,
      options: entity.options,
      votingMode: (entity.votingMode as FederationVotingMode) ?? 'equal',
      isAnonymous: entity.isAnonymous,
      maxSelections: entity.maxSelections,
      status: entity.status,
      createdBy: entity.createdBy,
      createdByName: entity.createdByName ?? null,
      endsAt: entity.endsAt ?? null,
      closedAt: entity.closedAt ?? null,
      totalVotes: entity.votes?.length ?? 0,
      createdAt: entity.createdAt,
    };
  }

  private async requirePermission(
    federationId: string,
    userId: string,
    permission: FederationAmbassadorPermission
  ): Promise<void> {
    return requireFederationPermission(this.ambassadorService, federationId, userId, permission);
  }

  // ─── CRUD ─────────────────────────────────────────────────

  /**
   * Create a federation poll.
   */
  async createPoll(
    federationId: string,
    userId: string,
    data: {
      title: string;
      description?: string;
      pollType?: string;
      options: Array<{ label: string; description?: string }>;
      votingMode?: FederationVotingMode;
      isAnonymous?: boolean;
      maxSelections?: number;
      endsAt?: string;
      createdByName?: string;
    }
  ): Promise<FederationPollData> {
    await this.requirePermission(federationId, userId, 'vote');

    if (!data.options || data.options.length < 2) {
      throw new ValidationError('At least 2 options are required');
    }

    const options: PollOption[] = data.options.map((opt, idx) => ({
      id: uuidv4(),
      label: opt.label,
      description: opt.description,
      sortOrder: idx,
    }));

    const poll = this.pollRepository.create({
      organizationId: federationId,
      federationId,
      title: data.title,
      description: data.description,
      pollType: (data.pollType as PollType) ?? PollType.SINGLE_CHOICE,
      visibility: PollVisibility.MEMBERS_ONLY,
      options,
      votingMode: data.votingMode ?? 'equal',
      isAnonymous: data.isAnonymous ?? false,
      maxSelections: data.maxSelections ?? 1,
      status: PollStatus.ACTIVE,
      createdBy: userId,
      createdByName: data.createdByName,
      endsAt: data.endsAt ? new Date(data.endsAt) : undefined,
    });

    const saved = await this.pollRepository.save(poll);

    logger.info('Federation poll created', {
      federationId,
      pollId: saved.id,
      votingMode: data.votingMode ?? 'equal',
    });

    return this.toData(saved);
  }

  /**
   * List federation polls.
   */
  async listPolls(
    federationId: string,
    userId: string,
    status?: string
  ): Promise<FederationPollData[]> {
    await this.requirePermission(federationId, userId, 'view');

    const where: Record<string, unknown> = { federationId };
    if (status) {
      where.status = status;
    }

    const polls = await this.pollRepository.find({
      where,
      order: { createdAt: 'DESC' },
      take: 50,
    });

    // Get vote counts without loading all vote entities
    const results: FederationPollData[] = [];
    for (const poll of polls) {
      const count = await this.voteRepository.count({ where: { pollId: poll.id } });
      const data = this.toData(poll);
      data.totalVotes = count;
      results.push(data);
    }

    return results;
  }

  /**
   * Cast a vote on a federation poll.
   */
  async castVote(
    federationId: string,
    userId: string,
    pollId: string,
    optionId: string
  ): Promise<FederationPollResults> {
    await this.requirePermission(federationId, userId, 'vote');

    const poll = await this.pollRepository.findOne({
      where: { id: pollId, federationId },
      relations: ['votes'],
    });
    if (!poll) {
      throw new NotFoundError('Poll', pollId);
    }
    if (poll.status !== PollStatus.ACTIVE) {
      throw new ValidationError('This poll is no longer active');
    }
    if (poll.endsAt && poll.endsAt < new Date()) {
      throw new ValidationError('This poll has expired');
    }

    // Check option exists
    const option = poll.options.find(o => o.id === optionId);
    if (!option) {
      throw new ValidationError('Invalid option');
    }

    // Check if already voted
    const existingVote = await this.voteRepository.findOne({
      where: { pollId, userId },
    });
    if (existingVote) {
      throw new ValidationError('You have already voted on this poll');
    }

    // Create vote
    await this.voteRepository.save(
      this.voteRepository.create({
        organizationId: federationId,
        pollId,
        userId,
        optionId,
      })
    );

    logger.info('Federation poll vote cast', { federationId, pollId, userId });

    // Re-fetch to include the new vote, then compute results
    const updatedPoll = await this.pollRepository.findOne({
      where: { id: pollId, federationId },
      relations: ['votes'],
    });

    return this.computeResults(federationId, userId, updatedPoll as Poll);
  }

  /**
   * Get poll results (public API — validates permission + fetches poll).
   */
  async getResults(
    federationId: string,
    userId: string,
    pollId: string
  ): Promise<FederationPollResults> {
    await this.requirePermission(federationId, userId, 'view');

    const poll = await this.pollRepository.findOne({
      where: { id: pollId, federationId },
      relations: ['votes'],
    });
    if (!poll) {
      throw new NotFoundError('Poll', pollId);
    }

    return this.computeResults(federationId, userId, poll);
  }

  /**
   * Compute poll results from a pre-loaded poll entity (avoids redundant fetch).
   */
  private async computeResults(
    federationId: string,
    userId: string,
    poll: Poll
  ): Promise<FederationPollResults> {
    const votes = poll.votes ?? [];
    const optionCounts: Record<string, number> = {};
    for (const opt of poll.options) {
      optionCounts[opt.id] = 0;
    }

    if (poll.votingMode === 'weighted') {
      await this.computeWeightedVotes(federationId, votes, optionCounts);
    } else {
      for (const vote of votes) {
        optionCounts[vote.optionId] = (optionCounts[vote.optionId] ?? 0) + 1;
      }
    }

    return {
      pollId: poll.id,
      totalVotes: votes.length,
      optionCounts,
      hasVoted: votes.some(v => v.userId === userId),
    };
  }

  /**
   * Calculate weighted vote counts by looking up ambassador org voting power.
   */
  private async computeWeightedVotes(
    federationId: string,
    votes: { userId: string; optionId: string }[],
    optionCounts: Record<string, number>
  ): Promise<void> {
    const ambassadorMap = new Map<string, { organizationId: string }>();
    const memberPowerMap = new Map<string, number>();

    for (const vote of votes) {
      if (!ambassadorMap.has(vote.userId)) {
        const amb = await this.ambassadorService.findByUser(federationId, vote.userId);
        if (amb) {
          ambassadorMap.set(vote.userId, { organizationId: amb.organizationId });
        }
      }
    }

    const uniqueOrgIds = [...new Set([...ambassadorMap.values()].map(a => a.organizationId))];
    for (const orgId of uniqueOrgIds) {
      const member = await this.memberRepository.findOne({
        where: { federationId, organizationId: orgId },
      });
      memberPowerMap.set(orgId, member?.votingPower ?? 1);
    }

    for (const vote of votes) {
      const amb = ambassadorMap.get(vote.userId);
      const weight = amb ? (memberPowerMap.get(amb.organizationId) ?? 1) : 1;
      optionCounts[vote.optionId] = (optionCounts[vote.optionId] ?? 0) + weight;
    }
  }

  /**
   * Close a federation poll.
   */
  async closePoll(
    federationId: string,
    userId: string,
    pollId: string
  ): Promise<FederationPollData> {
    await this.requirePermission(federationId, userId, 'vote');

    const poll = await this.pollRepository.findOne({
      where: { id: pollId, federationId },
    });
    if (!poll) {
      throw new NotFoundError('Poll', pollId);
    }
    if (poll.status !== PollStatus.ACTIVE) {
      throw new ValidationError('Poll is not active');
    }

    poll.status = PollStatus.CLOSED;
    poll.closedBy = userId;
    poll.closedAt = new Date();

    const saved = await this.pollRepository.save(poll);

    logger.info('Federation poll closed', { federationId, pollId });

    return this.toData(saved);
  }

  /**
   * Delete a federation poll.
   */
  async deletePoll(federationId: string, userId: string, pollId: string): Promise<void> {
    await this.requirePermission(federationId, userId, 'vote');

    const poll = await this.pollRepository.findOne({
      where: { id: pollId, federationId },
    });
    if (!poll) {
      throw new NotFoundError('Poll', pollId);
    }

    // Delete votes first
    await this.voteRepository.delete({ pollId });
    await this.pollRepository.remove(poll);

    logger.info('Federation poll deleted', { federationId, pollId });
  }

  /**
   * Post an active federation poll to the federation's central Discord guild.
   */
  async postPollToDiscord(
    federationId: string,
    userId: string,
    pollId: string,
    channelId: string
  ): Promise<FederationPollDiscordPostResult> {
    await this.requirePermission(federationId, userId, 'vote');

    const poll = await this.pollRepository.findOne({
      where: { id: pollId, federationId },
    });
    if (!poll) {
      throw new NotFoundError('Poll', pollId);
    }
    if (poll.status !== PollStatus.ACTIVE) {
      throw new ValidationError('Only active polls can be posted to Discord');
    }

    const federation = await this.federationRepository.findOne({ where: { id: federationId } });
    if (!federation) {
      throw new NotFoundError('Federation', federationId);
    }

    const guildId = federation.settings?.centralGuildId;
    if (!guildId) {
      throw new ValidationError('Federation central Discord guild is not configured');
    }

    const mirror = await this.discordPollService.mirrorPollToGuild(
      poll,
      federationId,
      { guildId, channelId },
      PollMirrorScope.FEDERATION,
      federationId
    );

    logger.info('Federation poll posted to Discord', {
      federationId,
      pollId,
      guildId,
      channelId,
      mirrorId: mirror.id,
    });

    return {
      mirrorId: mirror.id,
      guildId: mirror.guildId,
      channelId: mirror.channelId ?? channelId,
      status: mirror.status,
      messageId: mirror.messageId ?? null,
    };
  }
}

