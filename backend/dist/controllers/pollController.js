"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PollController = void 0;
const Poll_1 = require("../models/Poll");
const DiscordPollService_1 = require("../services/poll/DiscordPollService");
const PollService_1 = require("../services/poll/PollService");
const apiErrors_1 = require("../utils/apiErrors");
const BaseController_1 = require("./BaseController");
function isUserOrgAdmin(user) {
    return user?.role === 'admin' || user?.role === 'org_admin' || user?.role === 'superadmin';
}
function parsePagination(query, defaults) {
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
class PollController extends BaseController_1.BaseController {
    pollService;
    discordPollService;
    constructor() {
        super();
        this.pollService = new PollService_1.PollService();
        this.discordPollService = new DiscordPollService_1.DiscordPollService();
    }
    listPolls = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = req.user?.currentOrganizationId;
            if (!organizationId) {
                throw new apiErrors_1.ValidationError('Organization context required');
            }
            const { page, limit } = parsePagination(req.query);
            const filters = {};
            if (req.query.status) {
                filters.status = req.query.status;
            }
            if (req.query.pollType) {
                filters.pollType = req.query.pollType;
            }
            if (req.query.createdBy) {
                filters.createdBy = req.query.createdBy;
            }
            if (req.query.searchTerm) {
                filters.searchTerm = req.query.searchTerm;
            }
            if (req.query.sortBy) {
                filters.sortBy = req.query.sortBy;
            }
            if (req.query.sortOrder) {
                filters.sortOrder = req.query.sortOrder;
            }
            const result = await this.pollService.listPolls(organizationId, filters, { page, limit });
            res.json({
                data: result.data,
                pagination: result.pagination,
            });
        });
    };
    createPoll = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = req.user?.currentOrganizationId;
            const userId = req.user?.id;
            const username = req.user?.username ?? 'Unknown';
            if (!organizationId || !userId) {
                throw new apiErrors_1.ValidationError('Organization context and user ID required');
            }
            const dto = req.body;
            const poll = await this.pollService.createPoll(organizationId, userId, username, dto);
            res.status(201).json(poll);
        });
    };
    getPoll = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = req.user?.currentOrganizationId;
            const pollId = req.params.pollId;
            if (!organizationId) {
                throw new apiErrors_1.ValidationError('Organization context required');
            }
            const poll = await this.pollService.getPollById(organizationId, pollId);
            if (!poll) {
                throw new apiErrors_1.NotFoundError('Poll');
            }
            res.json(poll);
        });
    };
    updatePoll = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = req.user?.currentOrganizationId;
            const userId = req.user?.id;
            const username = req.user?.username ?? 'Unknown';
            const pollId = req.params.pollId;
            if (!organizationId || !userId) {
                throw new apiErrors_1.ValidationError('Organization context and user ID required');
            }
            const poll = await this.pollService.getPollById(organizationId, pollId);
            if (!poll) {
                throw new apiErrors_1.NotFoundError('Poll');
            }
            if (poll.createdBy !== userId && !isUserOrgAdmin(req.user)) {
                throw new apiErrors_1.ForbiddenError('You do not have permission to update this poll');
            }
            const dto = req.body;
            const updated = await this.pollService.updatePoll(organizationId, pollId, userId, username, dto);
            res.json(updated);
        });
    };
    deletePoll = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = req.user?.currentOrganizationId;
            const userId = req.user?.id;
            const username = req.user?.username ?? 'Unknown';
            const pollId = req.params.pollId;
            if (!organizationId || !userId) {
                throw new apiErrors_1.ValidationError('Organization context and user ID required');
            }
            const poll = await this.pollService.getPollById(organizationId, pollId);
            if (!poll) {
                throw new apiErrors_1.NotFoundError('Poll');
            }
            if (poll.createdBy !== userId && !isUserOrgAdmin(req.user)) {
                throw new apiErrors_1.ForbiddenError('You do not have permission to delete this poll');
            }
            await this.pollService.deletePoll(organizationId, pollId, userId, username);
            res.status(204).send();
        });
    };
    castVote = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = req.user?.currentOrganizationId;
            const userId = req.user?.id;
            const pollId = req.params.pollId;
            if (!organizationId || !userId) {
                throw new apiErrors_1.ValidationError('Organization context and user ID required');
            }
            const votes = req.body.votes;
            await this.pollService.castVote(organizationId, pollId, userId, votes);
            res.json({ message: 'Vote recorded successfully' });
        });
    };
    getResults = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = req.user?.currentOrganizationId;
            const userId = req.user?.id;
            const pollId = req.params.pollId;
            if (!organizationId || !userId) {
                throw new apiErrors_1.ValidationError('Organization context and user ID required');
            }
            const results = await this.pollService.getResults(organizationId, pollId, userId);
            if (!results) {
                throw new apiErrors_1.NotFoundError('Poll');
            }
            res.json(results);
        });
    };
    closePoll = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = req.user?.currentOrganizationId;
            const userId = req.user?.id;
            const username = req.user?.username ?? 'Unknown';
            const pollId = req.params.pollId;
            if (!organizationId || !userId) {
                throw new apiErrors_1.ValidationError('Organization context and user ID required');
            }
            const poll = await this.pollService.getPollById(organizationId, pollId);
            if (!poll) {
                throw new apiErrors_1.NotFoundError('Poll');
            }
            if (poll.createdBy !== userId && !isUserOrgAdmin(req.user)) {
                throw new apiErrors_1.ForbiddenError('You do not have permission to close this poll');
            }
            const closed = await this.pollService.closePoll(organizationId, pollId, userId, username);
            res.json(closed);
        });
    };
    mirrorToGuild = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = req.user?.currentOrganizationId;
            const pollId = req.params.pollId;
            if (!organizationId) {
                throw new apiErrors_1.ValidationError('Organization context required');
            }
            if (!isUserOrgAdmin(req.user)) {
                throw new apiErrors_1.ForbiddenError('Only admins can mirror polls to Discord');
            }
            const poll = await this.pollService.getPollById(organizationId, pollId);
            if (!poll) {
                throw new apiErrors_1.NotFoundError('Poll');
            }
            if (poll.status !== Poll_1.PollStatus.ACTIVE) {
                throw new apiErrors_1.ValidationError('Only active polls can be mirrored to Discord');
            }
            const { guildId, channelId } = req.body;
            const mirror = await this.discordPollService.mirrorPollToGuild(poll, organizationId, {
                guildId,
                channelId,
            });
            res.status(201).json(mirror);
        });
    };
    mirrorToFederation = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = req.user?.currentOrganizationId;
            const pollId = req.params.pollId;
            if (!organizationId) {
                throw new apiErrors_1.ValidationError('Organization context required');
            }
            if (!isUserOrgAdmin(req.user)) {
                throw new apiErrors_1.ForbiddenError('Only admins can mirror polls to a federation');
            }
            const poll = await this.pollService.getPollById(organizationId, pollId);
            if (!poll) {
                throw new apiErrors_1.NotFoundError('Poll');
            }
            if (poll.status !== Poll_1.PollStatus.ACTIVE) {
                throw new apiErrors_1.ValidationError('Only active polls can be mirrored to a federation');
            }
            const { federationId, channelId } = req.body;
            const mirrors = await this.discordPollService.mirrorPollToFederation(poll, organizationId, {
                federationId,
                channelId,
            });
            res.status(201).json({ mirrors });
        });
    };
    listMirrors = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = req.user?.currentOrganizationId;
            const pollId = req.params.pollId;
            if (!organizationId) {
                throw new apiErrors_1.ValidationError('Organization context required');
            }
            const mirrors = await this.discordPollService.getMirrorsForPoll(pollId, organizationId);
            res.json({ data: mirrors });
        });
    };
    deleteMirror = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = req.user?.currentOrganizationId;
            const mirrorId = req.params.mirrorId;
            if (!organizationId) {
                throw new apiErrors_1.ValidationError('Organization context required');
            }
            if (!isUserOrgAdmin(req.user)) {
                throw new apiErrors_1.ForbiddenError('Only admins can delete poll mirrors');
            }
            await this.discordPollService.deleteMirror(mirrorId, organizationId);
            res.status(204).send();
        });
    };
}
exports.PollController = PollController;
//# sourceMappingURL=pollController.js.map