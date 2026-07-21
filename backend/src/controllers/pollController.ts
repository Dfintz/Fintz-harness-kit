import { Response } from 'express';

import { AuthRequest } from '../middleware/auth';
import { PollStatus } from '../models/Poll';
import { DiscordPollService } from '../services/poll/DiscordPollService';
import {
  CastVoteDTO,
  CreatePollDTO,
  PollSearchFilters,
  PollService,
  UpdatePollDTO,
} from '../services/poll/PollService';
import { ForbiddenError, NotFoundError, ValidationError } from '../utils/apiErrors';

import { BaseController } from './BaseController';

/**
 * Helper function to check if user is org admin
 */
function isUserOrgAdmin(user: AuthRequest['user']): boolean {
  return user?.role === 'admin' || user?.role === 'org_admin' || user?.role === 'superadmin';
}

/**
 * Helper function to parse pagination parameters
 */
function parsePagination(
  query: AuthRequest['query'],
  defaults?: { page: number; limit: number }
): { page: number; limit: number } {
  const MAX_LIMIT = 100;
  const defaultPage = defaults?.page ?? 1;
  const defaultLimit = defaults?.limit ?? 20;

  const rawPage = Array.isArray(query.page) ? query.page[0] : query.page;
  const rawLimit = Array.isArray(query.limit) ? query.limit[0] : query.limit;

  const parsedPage = typeof rawPage === 'string' ? Number.parseInt(rawPage, 10) : Number.NaN;
  const parsedLimit = typeof rawLimit === 'string' ? Number.parseInt(rawLimit, 10) : Number.NaN;

  const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : defaultPage;
  let limit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : defaultLimit;
  if (limit > MAX_LIMIT) {
    limit = MAX_LIMIT;
  }

  return { page, limit };
}

/**
 * Poll Controller
 *
 * Provides /api/v2/voting/polls endpoints for managing polls and voting.
 */
export class PollController extends BaseController {
  private readonly pollService: PollService;
  private readonly discordPollService: DiscordPollService;

  constructor() {
    super();
    this.pollService = new PollService();
    this.discordPollService = new DiscordPollService();
  }

  // ==================== LIST POLLS ====================

  listPolls = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = req.user?.currentOrganizationId;
      if (!organizationId) {
        throw new ValidationError('Organization context required');
      }

      const { page, limit } = parsePagination(req.query);

      const filters: PollSearchFilters = {};
      if (req.query.status) {
        filters.status = req.query.status as PollSearchFilters['status'];
      }
      if (req.query.pollType) {
        filters.pollType = req.query.pollType as PollSearchFilters['pollType'];
      }
      if (req.query.createdBy) {
        filters.createdBy = req.query.createdBy as string;
      }
      if (req.query.searchTerm) {
        filters.searchTerm = req.query.searchTerm as string;
      }
      if (req.query.sortBy) {
        filters.sortBy = req.query.sortBy as string;
      }
      if (req.query.sortOrder) {
        filters.sortOrder = req.query.sortOrder as PollSearchFilters['sortOrder'];
      }

      const result = await this.pollService.listPolls(organizationId, filters, { page, limit });

      res.json({
        data: result.data,
        pagination: result.pagination,
      });
    });
  };

  // ==================== CREATE POLL ====================

  createPoll = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = req.user?.currentOrganizationId;
      const userId = req.user?.id;
      const username = req.user?.username ?? 'Unknown';

      if (!organizationId || !userId) {
        throw new ValidationError('Organization context and user ID required');
      }

      const dto = req.body as CreatePollDTO;
      const poll = await this.pollService.createPoll(organizationId, userId, username, dto);

      res.status(201).json(poll);
    });
  };

  // ==================== GET POLL ====================

  getPoll = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = req.user?.currentOrganizationId;
      const pollId = req.params.pollId;

      if (!organizationId) {
        throw new ValidationError('Organization context required');
      }

      const poll = await this.pollService.getPollById(organizationId, pollId);
      if (!poll) {
        throw new NotFoundError('Poll');
      }

      res.json(poll);
    });
  };

  // ==================== UPDATE POLL ====================

  updatePoll = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = req.user?.currentOrganizationId;
      const userId = req.user?.id;
      const username = req.user?.username ?? 'Unknown';
      const pollId = req.params.pollId;

      if (!organizationId || !userId) {
        throw new ValidationError('Organization context and user ID required');
      }

      const poll = await this.pollService.getPollById(organizationId, pollId);
      if (!poll) {
        throw new NotFoundError('Poll');
      }

      // Only creator or admins can update
      if (poll.createdBy !== userId && !isUserOrgAdmin(req.user)) {
        throw new ForbiddenError('You do not have permission to update this poll');
      }

      const dto = req.body as UpdatePollDTO;
      const updated = await this.pollService.updatePoll(
        organizationId,
        pollId,
        userId,
        username,
        dto
      );

      res.json(updated);
    });
  };

  // ==================== DELETE POLL ====================

  deletePoll = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = req.user?.currentOrganizationId;
      const userId = req.user?.id;
      const username = req.user?.username ?? 'Unknown';
      const pollId = req.params.pollId;

      if (!organizationId || !userId) {
        throw new ValidationError('Organization context and user ID required');
      }

      const poll = await this.pollService.getPollById(organizationId, pollId);
      if (!poll) {
        throw new NotFoundError('Poll');
      }

      // Only creator or admins can delete
      if (poll.createdBy !== userId && !isUserOrgAdmin(req.user)) {
        throw new ForbiddenError('You do not have permission to delete this poll');
      }

      await this.pollService.deletePoll(organizationId, pollId, userId, username);

      res.status(204).send();
    });
  };

  // ==================== CAST VOTE ====================

  castVote = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = req.user?.currentOrganizationId;
      const userId = req.user?.id;
      const pollId = req.params.pollId;

      if (!organizationId || !userId) {
        throw new ValidationError('Organization context and user ID required');
      }

      const votes = (req.body as { votes: CastVoteDTO[] }).votes;

      await this.pollService.castVote(organizationId, pollId, userId, votes);

      res.json({ message: 'Vote recorded successfully' });
    });
  };

  // ==================== GET RESULTS ====================

  getResults = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = req.user?.currentOrganizationId;
      const userId = req.user?.id;
      const pollId = req.params.pollId;

      if (!organizationId || !userId) {
        throw new ValidationError('Organization context and user ID required');
      }

      const results = await this.pollService.getResults(organizationId, pollId, userId);
      if (!results) {
        throw new NotFoundError('Poll');
      }

      res.json(results);
    });
  };

  // ==================== CLOSE POLL ====================

  closePoll = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = req.user?.currentOrganizationId;
      const userId = req.user?.id;
      const username = req.user?.username ?? 'Unknown';
      const pollId = req.params.pollId;

      if (!organizationId || !userId) {
        throw new ValidationError('Organization context and user ID required');
      }

      const poll = await this.pollService.getPollById(organizationId, pollId);
      if (!poll) {
        throw new NotFoundError('Poll');
      }

      // Only creator or admins can close
      if (poll.createdBy !== userId && !isUserOrgAdmin(req.user)) {
        throw new ForbiddenError('You do not have permission to close this poll');
      }

      const closed = await this.pollService.closePoll(organizationId, pollId, userId, username);

      res.json(closed);
    });
  };

  // ==================== MIRROR TO GUILD ====================

  mirrorToGuild = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = req.user?.currentOrganizationId;
      const pollId = req.params.pollId;

      if (!organizationId) {
        throw new ValidationError('Organization context required');
      }

      if (!isUserOrgAdmin(req.user)) {
        throw new ForbiddenError('Only admins can mirror polls to Discord');
      }

      const poll = await this.pollService.getPollById(organizationId, pollId);
      if (!poll) {
        throw new NotFoundError('Poll');
      }

      if (poll.status !== PollStatus.ACTIVE) {
        throw new ValidationError('Only active polls can be mirrored to Discord');
      }

      const { guildId, channelId } = req.body as { guildId: string; channelId: string };
      const mirror = await this.discordPollService.mirrorPollToGuild(poll, organizationId, {
        guildId,
        channelId,
      });

      res.status(201).json(mirror);
    });
  };

  // ==================== MIRROR TO FEDERATION ====================

  mirrorToFederation = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = req.user?.currentOrganizationId;
      const pollId = req.params.pollId;

      if (!organizationId) {
        throw new ValidationError('Organization context required');
      }

      if (!isUserOrgAdmin(req.user)) {
        throw new ForbiddenError('Only admins can mirror polls to a federation');
      }

      const poll = await this.pollService.getPollById(organizationId, pollId);
      if (!poll) {
        throw new NotFoundError('Poll');
      }

      if (poll.status !== PollStatus.ACTIVE) {
        throw new ValidationError('Only active polls can be mirrored to a federation');
      }

      const { federationId, channelId } = req.body as {
        federationId: string;
        channelId?: string;
      };
      const mirrors = await this.discordPollService.mirrorPollToFederation(poll, organizationId, {
        federationId,
        channelId,
      });

      res.status(201).json({ mirrors });
    });
  };

  // ==================== LIST MIRRORS ====================

  listMirrors = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = req.user?.currentOrganizationId;
      const pollId = req.params.pollId;

      if (!organizationId) {
        throw new ValidationError('Organization context required');
      }

      const mirrors = await this.discordPollService.getMirrorsForPoll(pollId, organizationId);

      res.json({ data: mirrors });
    });
  };

  // ==================== DELETE MIRROR ====================

  deleteMirror = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = req.user?.currentOrganizationId;
      const mirrorId = req.params.mirrorId;

      if (!organizationId) {
        throw new ValidationError('Organization context required');
      }

      if (!isUserOrgAdmin(req.user)) {
        throw new ForbiddenError('Only admins can delete poll mirrors');
      }

      await this.discordPollService.deleteMirror(mirrorId, organizationId);

      res.status(204).send();
    });
  };
}
