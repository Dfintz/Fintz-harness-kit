"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PollService = exports.PollAuditAction = void 0;
const data_source_1 = require("../../data-source");
const Poll_1 = require("../../models/Poll");
const PollVote_1 = require("../../models/PollVote");
const apiErrors_1 = require("../../utils/apiErrors");
const auditLogger_1 = require("../../utils/auditLogger");
const logger_1 = require("../../utils/logger");
const websocketServer_1 = require("../../websocket/websocketServer");
const TenantService_1 = require("../base/TenantService");
const DiscordPollService_1 = require("./DiscordPollService");
var PollAuditAction;
(function (PollAuditAction) {
    PollAuditAction["POLL_CREATED"] = "poll_created";
    PollAuditAction["POLL_UPDATED"] = "poll_updated";
    PollAuditAction["POLL_CLOSED"] = "poll_closed";
    PollAuditAction["POLL_CANCELLED"] = "poll_cancelled";
    PollAuditAction["POLL_DELETED"] = "poll_deleted";
    PollAuditAction["VOTE_CAST"] = "vote_cast";
})(PollAuditAction || (exports.PollAuditAction = PollAuditAction = {}));
class PollService extends TenantService_1.TenantService {
    voteRepository = data_source_1.AppDataSource.getRepository(PollVote_1.PollVote);
    discordPollService = new DiscordPollService_1.DiscordPollService();
    constructor() {
        super(data_source_1.AppDataSource.getRepository(Poll_1.Poll), {
            enableCache: true,
            cacheTTL: 300,
            cacheCheckPeriod: 60,
        });
    }
    logPollAudit(action, poll, performedById, performedByName, details) {
        (0, auditLogger_1.logAuditEvent)({
            eventType: auditLogger_1.AuditEventType.SENSITIVE_DATA_ACCESS,
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
    async autoCloseIfExpired(poll) {
        if (poll.status === Poll_1.PollStatus.ACTIVE && poll.endsAt && new Date() > poll.endsAt) {
            poll.status = Poll_1.PollStatus.CLOSED;
            poll.closedAt = new Date();
            await this.repository.save(poll);
            logger_1.logger.info(`Poll auto-closed: ${poll.id} (expired at ${poll.endsAt.toISOString()})`);
            (0, websocketServer_1.emitToOrganization)(poll.organizationId, 'poll:closed', {
                pollId: poll.id,
                closedAt: poll.closedAt,
                reason: 'expired',
            });
            this.getResults(poll.organizationId, poll.id, 'system')
                .then(results => this.discordPollService.closeAllMirrors(poll, results))
                .catch(err => {
                logger_1.logger.warn(`Failed to close Discord mirrors for auto-closed poll ${poll.id}: ${err.message}`);
            });
        }
        return poll;
    }
    async createPoll(organizationId, creatorId, creatorName, dto) {
        const poll = await this.create(organizationId, {
            createdBy: creatorId,
            createdByName: creatorName,
            title: dto.title,
            description: dto.description,
            pollType: dto.pollType,
            visibility: dto.visibility ?? Poll_1.PollVisibility.MEMBERS_ONLY,
            options: dto.options,
            isAnonymous: dto.isAnonymous ?? false,
            maxSelections: dto.maxSelections ?? 1,
            endsAt: dto.endsAt,
            allowedRoles: dto.allowedRoles,
            status: dto.status ?? Poll_1.PollStatus.ACTIVE,
        });
        this.logPollAudit(PollAuditAction.POLL_CREATED, poll, creatorId, creatorName, {
            optionCount: dto.options.length,
            pollType: dto.pollType,
        });
        (0, websocketServer_1.emitToOrganization)(organizationId, 'poll:created', {
            pollId: poll.id,
            title: poll.title,
        });
        logger_1.logger.info(`Poll created: ${poll.id} (${dto.pollType}) by ${creatorName}`);
        return poll;
    }
    async getPollById(organizationId, pollId) {
        const poll = await this.findById(organizationId, pollId);
        if (!poll) {
            return null;
        }
        return this.autoCloseIfExpired(poll);
    }
    async listPolls(organizationId, filters, pagination) {
        const where = {};
        if (filters.status) {
            where.status = filters.status;
        }
        if (filters.pollType) {
            where.pollType = filters.pollType;
        }
        if (filters.createdBy) {
            where.createdBy = filters.createdBy;
        }
        const result = await this.findAllPaginated(organizationId, {
            ...pagination,
            sortBy: filters.sortBy ?? 'createdAt',
            sortOrder: filters.sortOrder ?? 'DESC',
        }, where);
        const processed = await Promise.all(result.data.map(poll => this.autoCloseIfExpired(poll)));
        result.data = processed;
        return result;
    }
    async updatePoll(organizationId, pollId, userId, userName, dto) {
        const poll = await this.findById(organizationId, pollId);
        if (!poll) {
            return null;
        }
        if (poll.status !== Poll_1.PollStatus.DRAFT && poll.status !== Poll_1.PollStatus.ACTIVE) {
            throw new apiErrors_1.ConflictError('Cannot update a closed or cancelled poll');
        }
        const voteCount = await this.voteRepository.count({ where: { pollId } });
        if (voteCount > 0 && dto.options) {
            throw new apiErrors_1.ConflictError('Cannot change options after votes have been cast');
        }
        const updated = await this.update(organizationId, pollId, dto);
        if (updated) {
            this.logPollAudit(PollAuditAction.POLL_UPDATED, updated, userId, userName);
            (0, websocketServer_1.emitToOrganization)(organizationId, 'poll:updated', {
                pollId: updated.id,
                title: updated.title,
            });
        }
        return updated;
    }
    async deletePoll(organizationId, pollId, userId, userName) {
        const poll = await this.findById(organizationId, pollId);
        if (!poll) {
            throw new apiErrors_1.NotFoundError('Poll');
        }
        await this.voteRepository.delete({ pollId });
        await this.delete(organizationId, pollId);
        this.logPollAudit(PollAuditAction.POLL_DELETED, poll, userId, userName);
        (0, websocketServer_1.emitToOrganization)(organizationId, 'poll:deleted', { pollId });
        logger_1.logger.info(`Poll deleted: ${pollId} by ${userName}`);
    }
    async castVote(organizationId, pollId, userId, votes) {
        const poll = await this.findById(organizationId, pollId);
        if (!poll) {
            throw new apiErrors_1.NotFoundError('Poll');
        }
        await this.autoCloseIfExpired(poll);
        if (poll.status !== Poll_1.PollStatus.ACTIVE) {
            throw new apiErrors_1.ConflictError('Poll is not active');
        }
        const validOptionIds = new Set(poll.options.map(o => o.id));
        for (const vote of votes) {
            if (!validOptionIds.has(vote.optionId)) {
                throw new apiErrors_1.ValidationError(`Invalid option: ${vote.optionId}`);
            }
        }
        if (votes.length > poll.maxSelections) {
            throw new apiErrors_1.ValidationError(`Maximum ${poll.maxSelections} selection(s) allowed`);
        }
        if (poll.pollType === Poll_1.PollType.SINGLE_CHOICE && votes.length > 1) {
            throw new apiErrors_1.ValidationError('Single choice polls allow only 1 selection');
        }
        await this.voteRepository.delete({ pollId, userId });
        const voteEntities = votes.map(v => this.voteRepository.create({
            organizationId,
            pollId,
            userId,
            optionId: v.optionId,
            rank: v.rank,
        }));
        await this.voteRepository.save(voteEntities);
        (0, websocketServer_1.emitToOrganization)(organizationId, 'poll:vote_cast', {
            pollId,
            totalVotes: await this.voteRepository.count({ where: { pollId } }),
        });
        this.getResults(organizationId, pollId, 'system')
            .then(results => this.discordPollService.updateAllMirrors(poll, results))
            .catch(err => {
            logger_1.logger.warn(`Failed to update Discord mirrors for poll ${pollId}: ${err.message}`);
        });
        logger_1.logger.debug(`Vote cast on poll ${pollId} by user ${userId}`);
    }
    async toggleVote(organizationId, pollId, userId, optionId) {
        const poll = await this.findById(organizationId, pollId);
        if (!poll) {
            throw new apiErrors_1.NotFoundError('Poll');
        }
        await this.autoCloseIfExpired(poll);
        if (poll.status !== Poll_1.PollStatus.ACTIVE) {
            throw new apiErrors_1.ConflictError('Poll is not active');
        }
        const validOptionIds = new Set(poll.options.map(o => o.id));
        if (!validOptionIds.has(optionId)) {
            throw new apiErrors_1.ValidationError(`Invalid option: ${optionId}`);
        }
        const allowsMultiple = poll.pollType === Poll_1.PollType.MULTIPLE_CHOICE || poll.pollType === Poll_1.PollType.APPROVAL;
        const existingVotes = await this.voteRepository
            .createQueryBuilder('v')
            .select('v."optionId"', 'optionId')
            .where('v."pollId" = :pollId', { pollId })
            .andWhere('v."userId" = :userId', { userId })
            .getRawMany();
        const selection = new Set(existingVotes.map(v => v.optionId));
        let selected;
        if (allowsMultiple) {
            if (selection.has(optionId)) {
                selection.delete(optionId);
                selected = false;
            }
            else {
                if (selection.size >= poll.maxSelections) {
                    throw new apiErrors_1.ValidationError(`You can select at most ${poll.maxSelections} option(s).`);
                }
                selection.add(optionId);
                selected = true;
            }
        }
        else if (selection.size === 1 && selection.has(optionId)) {
            selection.clear();
            selected = false;
        }
        else {
            selection.clear();
            selection.add(optionId);
            selected = true;
        }
        const selectedOptionIds = Array.from(selection);
        await this.castVote(organizationId, pollId, userId, selectedOptionIds.map(id => ({ optionId: id })));
        return { selected, selectedOptionIds };
    }
    async getResults(organizationId, pollId, currentUserId) {
        const poll = await this.findById(organizationId, pollId);
        if (!poll) {
            return null;
        }
        await this.autoCloseIfExpired(poll);
        const voteCounts = await this.voteRepository
            .createQueryBuilder('v')
            .select('v."optionId"', 'optionId')
            .addSelect('COUNT(*)::int', 'count')
            .where('v."pollId" = :pollId', { pollId })
            .groupBy('v."optionId"')
            .getRawMany();
        const uniqueVoters = await this.voteRepository
            .createQueryBuilder('v')
            .select('COUNT(DISTINCT v."userId")::int', 'count')
            .where('v."pollId" = :pollId', { pollId })
            .getRawOne();
        const optionCounts = {};
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
            optionId: option.id,
            voteCount: optionCounts[option.id] || 0,
            percentage: totalVoters > 0 ? Math.round(((optionCounts[option.id] || 0) / totalVoters) * 100) : 0,
        }));
        const userVoteRows = await this.voteRepository
            .createQueryBuilder('v')
            .select('v."optionId"', 'optionId')
            .where('v."pollId" = :pollId', { pollId })
            .andWhere('v."userId" = :userId', { userId: currentUserId })
            .getRawMany();
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
    async closePoll(organizationId, pollId, userId, userName) {
        const poll = await this.findById(organizationId, pollId);
        if (!poll) {
            return null;
        }
        if (poll.status !== Poll_1.PollStatus.ACTIVE) {
            throw new apiErrors_1.ConflictError('Only active polls can be closed');
        }
        const updated = await this.update(organizationId, pollId, {
            status: Poll_1.PollStatus.CLOSED,
            closedBy: userId,
            closedAt: new Date(),
        });
        if (updated) {
            this.logPollAudit(PollAuditAction.POLL_CLOSED, updated, userId, userName);
            (0, websocketServer_1.emitToOrganization)(organizationId, 'poll:closed', {
                pollId: updated.id,
                closedBy: userName,
                closedAt: updated.closedAt,
            });
            this.getResults(organizationId, pollId, 'system')
                .then(results => this.discordPollService.closeAllMirrors(updated, results))
                .catch(err => {
                logger_1.logger.warn(`Failed to close Discord mirrors for poll ${pollId}: ${err.message}`);
            });
            logger_1.logger.info(`Poll closed: ${pollId} by ${userName}`);
        }
        return updated;
    }
    async closeExpiredPolls() {
        const now = new Date();
        const expiredPolls = await this.repository
            .createQueryBuilder('poll')
            .where('poll.status = :status', { status: Poll_1.PollStatus.ACTIVE })
            .andWhere('poll.endsAt IS NOT NULL')
            .andWhere('poll.endsAt < :now', { now })
            .getMany();
        let closedCount = 0;
        for (const poll of expiredPolls) {
            const closedAt = new Date();
            const transition = await this.repository
                .createQueryBuilder()
                .update(Poll_1.Poll)
                .set({ status: Poll_1.PollStatus.CLOSED, closedAt })
                .where('id = :pollId', { pollId: poll.id })
                .andWhere('status = :status', { status: Poll_1.PollStatus.ACTIVE })
                .execute();
            if ((transition.affected ?? 0) === 0) {
                logger_1.logger.info('Poll already closed by another worker, skipping duplicate close', {
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
                logger_1.logger.warn('Expired poll was closed but could not be reloaded for downstream notifications', {
                    pollId: poll.id,
                    organizationId: poll.organizationId,
                });
                continue;
            }
            (0, websocketServer_1.emitToOrganization)(closedPoll.organizationId, 'poll:closed', {
                pollId: closedPoll.id,
                closedAt: closedPoll.closedAt,
                reason: 'expired',
            });
            this.getResults(closedPoll.organizationId, closedPoll.id, 'system')
                .then(results => this.discordPollService.closeAllMirrors(closedPoll, results))
                .catch(err => {
                logger_1.logger.warn(`Failed to close Discord mirrors for expired poll ${closedPoll.id}: ${err.message}`);
            });
            closedCount++;
        }
        if (closedCount > 0) {
            logger_1.logger.info(`Auto-closed ${closedCount} expired poll(s)`);
        }
        return closedCount;
    }
}
exports.PollService = PollService;
//# sourceMappingURL=PollService.js.map