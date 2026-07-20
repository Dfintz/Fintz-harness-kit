"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FederationPollService = void 0;
const uuid_1 = require("uuid");
const data_source_1 = require("../../data-source");
const Federation_1 = require("../../models/Federation");
const FederationMember_1 = require("../../models/FederationMember");
const Poll_1 = require("../../models/Poll");
const PollDiscordMirror_1 = require("../../models/PollDiscordMirror");
const PollVote_1 = require("../../models/PollVote");
const apiErrors_1 = require("../../utils/apiErrors");
const logger_1 = require("../../utils/logger");
const DiscordPollService_1 = require("../poll/DiscordPollService");
const FederationAmbassadorService_1 = require("./FederationAmbassadorService");
const federationPermissions_1 = require("./federationPermissions");
class FederationPollService {
    static instance;
    pollRepository;
    voteRepository;
    memberRepository;
    federationRepository;
    discordPollService;
    ambassadorService;
    constructor() {
        this.pollRepository = data_source_1.AppDataSource.getRepository(Poll_1.Poll);
        this.voteRepository = data_source_1.AppDataSource.getRepository(PollVote_1.PollVote);
        this.memberRepository = data_source_1.AppDataSource.getRepository(FederationMember_1.FederationMember);
        this.federationRepository = data_source_1.AppDataSource.getRepository(Federation_1.Federation);
        this.discordPollService = new DiscordPollService_1.DiscordPollService();
        this.ambassadorService = FederationAmbassadorService_1.FederationAmbassadorService.getInstance();
    }
    static getInstance() {
        if (!FederationPollService.instance) {
            FederationPollService.instance = new FederationPollService();
        }
        return FederationPollService.instance;
    }
    toData(entity) {
        return {
            id: entity.id,
            federationId: entity.federationId ?? '',
            title: entity.title,
            description: entity.description ?? null,
            pollType: entity.pollType,
            options: entity.options,
            votingMode: entity.votingMode ?? 'equal',
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
    async requirePermission(federationId, userId, permission) {
        return (0, federationPermissions_1.requireFederationPermission)(this.ambassadorService, federationId, userId, permission);
    }
    async createPoll(federationId, userId, data) {
        await this.requirePermission(federationId, userId, 'vote');
        if (!data.options || data.options.length < 2) {
            throw new apiErrors_1.ValidationError('At least 2 options are required');
        }
        const options = data.options.map((opt, idx) => ({
            id: (0, uuid_1.v4)(),
            label: opt.label,
            description: opt.description,
            sortOrder: idx,
        }));
        const poll = this.pollRepository.create({
            organizationId: federationId,
            federationId,
            title: data.title,
            description: data.description,
            pollType: data.pollType ?? Poll_1.PollType.SINGLE_CHOICE,
            visibility: Poll_1.PollVisibility.MEMBERS_ONLY,
            options,
            votingMode: data.votingMode ?? 'equal',
            isAnonymous: data.isAnonymous ?? false,
            maxSelections: data.maxSelections ?? 1,
            status: Poll_1.PollStatus.ACTIVE,
            createdBy: userId,
            createdByName: data.createdByName,
            endsAt: data.endsAt ? new Date(data.endsAt) : undefined,
        });
        const saved = await this.pollRepository.save(poll);
        logger_1.logger.info('Federation poll created', {
            federationId,
            pollId: saved.id,
            votingMode: data.votingMode ?? 'equal',
        });
        return this.toData(saved);
    }
    async listPolls(federationId, userId, status) {
        await this.requirePermission(federationId, userId, 'view');
        const where = { federationId };
        if (status) {
            where.status = status;
        }
        const polls = await this.pollRepository.find({
            where,
            order: { createdAt: 'DESC' },
            take: 50,
        });
        const results = [];
        for (const poll of polls) {
            const count = await this.voteRepository.count({ where: { pollId: poll.id } });
            const data = this.toData(poll);
            data.totalVotes = count;
            results.push(data);
        }
        return results;
    }
    async castVote(federationId, userId, pollId, optionId) {
        await this.requirePermission(federationId, userId, 'vote');
        const poll = await this.pollRepository.findOne({
            where: { id: pollId, federationId },
            relations: ['votes'],
        });
        if (!poll) {
            throw new apiErrors_1.NotFoundError('Poll', pollId);
        }
        if (poll.status !== Poll_1.PollStatus.ACTIVE) {
            throw new apiErrors_1.ValidationError('This poll is no longer active');
        }
        if (poll.endsAt && poll.endsAt < new Date()) {
            throw new apiErrors_1.ValidationError('This poll has expired');
        }
        const option = poll.options.find(o => o.id === optionId);
        if (!option) {
            throw new apiErrors_1.ValidationError('Invalid option');
        }
        const existingVote = await this.voteRepository.findOne({
            where: { pollId, userId },
        });
        if (existingVote) {
            throw new apiErrors_1.ValidationError('You have already voted on this poll');
        }
        await this.voteRepository.save(this.voteRepository.create({
            organizationId: federationId,
            pollId,
            userId,
            optionId,
        }));
        logger_1.logger.info('Federation poll vote cast', { federationId, pollId, userId });
        const updatedPoll = await this.pollRepository.findOne({
            where: { id: pollId, federationId },
            relations: ['votes'],
        });
        return this.computeResults(federationId, userId, updatedPoll);
    }
    async getResults(federationId, userId, pollId) {
        await this.requirePermission(federationId, userId, 'view');
        const poll = await this.pollRepository.findOne({
            where: { id: pollId, federationId },
            relations: ['votes'],
        });
        if (!poll) {
            throw new apiErrors_1.NotFoundError('Poll', pollId);
        }
        return this.computeResults(federationId, userId, poll);
    }
    async computeResults(federationId, userId, poll) {
        const votes = poll.votes ?? [];
        const optionCounts = {};
        for (const opt of poll.options) {
            optionCounts[opt.id] = 0;
        }
        if (poll.votingMode === 'weighted') {
            await this.computeWeightedVotes(federationId, votes, optionCounts);
        }
        else {
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
    async computeWeightedVotes(federationId, votes, optionCounts) {
        const ambassadorMap = new Map();
        const memberPowerMap = new Map();
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
    async closePoll(federationId, userId, pollId) {
        await this.requirePermission(federationId, userId, 'vote');
        const poll = await this.pollRepository.findOne({
            where: { id: pollId, federationId },
        });
        if (!poll) {
            throw new apiErrors_1.NotFoundError('Poll', pollId);
        }
        if (poll.status !== Poll_1.PollStatus.ACTIVE) {
            throw new apiErrors_1.ValidationError('Poll is not active');
        }
        poll.status = Poll_1.PollStatus.CLOSED;
        poll.closedBy = userId;
        poll.closedAt = new Date();
        const saved = await this.pollRepository.save(poll);
        logger_1.logger.info('Federation poll closed', { federationId, pollId });
        return this.toData(saved);
    }
    async deletePoll(federationId, userId, pollId) {
        await this.requirePermission(federationId, userId, 'vote');
        const poll = await this.pollRepository.findOne({
            where: { id: pollId, federationId },
        });
        if (!poll) {
            throw new apiErrors_1.NotFoundError('Poll', pollId);
        }
        await this.voteRepository.delete({ pollId });
        await this.pollRepository.remove(poll);
        logger_1.logger.info('Federation poll deleted', { federationId, pollId });
    }
    async postPollToDiscord(federationId, userId, pollId, channelId) {
        await this.requirePermission(federationId, userId, 'vote');
        const poll = await this.pollRepository.findOne({
            where: { id: pollId, federationId },
        });
        if (!poll) {
            throw new apiErrors_1.NotFoundError('Poll', pollId);
        }
        if (poll.status !== Poll_1.PollStatus.ACTIVE) {
            throw new apiErrors_1.ValidationError('Only active polls can be posted to Discord');
        }
        const federation = await this.federationRepository.findOne({ where: { id: federationId } });
        if (!federation) {
            throw new apiErrors_1.NotFoundError('Federation', federationId);
        }
        const guildId = federation.settings?.centralGuildId;
        if (!guildId) {
            throw new apiErrors_1.ValidationError('Federation central Discord guild is not configured');
        }
        const mirror = await this.discordPollService.mirrorPollToGuild(poll, federationId, { guildId, channelId }, PollDiscordMirror_1.PollMirrorScope.FEDERATION, federationId);
        logger_1.logger.info('Federation poll posted to Discord', {
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
exports.FederationPollService = FederationPollService;
//# sourceMappingURL=FederationPollService.js.map