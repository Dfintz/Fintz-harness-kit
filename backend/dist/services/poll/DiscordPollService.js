"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DiscordPollService = void 0;
const BotClientManager_1 = require("../../bot/BotClientManager");
const pollEmbed_1 = require("../../bot/embeds/pollEmbed");
const data_source_1 = require("../../data-source");
const FederationMember_1 = require("../../models/FederationMember");
const Poll_1 = require("../../models/Poll");
const PollDiscordMirror_1 = require("../../models/PollDiscordMirror");
const apiErrors_1 = require("../../utils/apiErrors");
const logger_1 = require("../../utils/logger");
const GuildOrganizationService_1 = require("../discord/GuildOrganizationService");
class DiscordPollService {
    mirrorRepository = data_source_1.AppDataSource.getRepository(PollDiscordMirror_1.PollDiscordMirror);
    federationMemberRepository = data_source_1.AppDataSource.getRepository(FederationMember_1.FederationMember);
    guildOrgService;
    constructor() {
        this.guildOrgService = GuildOrganizationService_1.GuildOrganizationService.getInstance();
    }
    async mirrorPollToGuild(poll, organizationId, dto, scope = PollDiscordMirror_1.PollMirrorScope.ORGANIZATION, federationId) {
        if (poll.status !== Poll_1.PollStatus.ACTIVE) {
            throw new apiErrors_1.ConflictError('Only active polls can be mirrored to Discord');
        }
        const existing = await this.mirrorRepository.findOne({
            where: { pollId: poll.id, guildId: dto.guildId },
        });
        if (existing) {
            throw new apiErrors_1.ConflictError('Poll is already mirrored to this guild');
        }
        const mirror = this.mirrorRepository.create({
            pollId: poll.id,
            organizationId,
            scope,
            federationId,
            guildId: dto.guildId,
            channelId: dto.channelId,
            status: PollDiscordMirror_1.PollMirrorStatus.PENDING,
        });
        await this.mirrorRepository.save(mirror);
        await this.deliverMirror(mirror, poll);
        return mirror;
    }
    async mirrorPollToFederation(poll, organizationId, dto) {
        const members = await this.federationMemberRepository.find({
            where: { federationId: dto.federationId, status: 'active' },
        });
        if (members.length === 0) {
            throw new apiErrors_1.ConflictError('No active members found in this federation');
        }
        const mirrors = [];
        for (const member of members) {
            const guilds = await this.guildOrgService.getGuildsForOrganization(member.organizationId, true);
            for (const guild of guilds) {
                try {
                    const channelId = dto.channelId;
                    if (!channelId) {
                        logger_1.logger.warn(`No channel ID provided for federation broadcast to guild ${guild.guildId}, skipping`);
                        continue;
                    }
                    const mirror = await this.mirrorPollToGuild(poll, organizationId, {
                        guildId: guild.guildId,
                        channelId,
                    }, PollDiscordMirror_1.PollMirrorScope.FEDERATION, dto.federationId);
                    mirrors.push(mirror);
                }
                catch (err) {
                    logger_1.logger.warn(`Failed to mirror poll ${poll.id} to guild ${guild.guildId}: ${err instanceof Error ? err.message : 'Unknown error'}`);
                }
            }
        }
        logger_1.logger.info(`Federation broadcast: poll ${poll.id} mirrored to ${mirrors.length} guild(s) in federation ${dto.federationId}`);
        return mirrors;
    }
    async updateAllMirrors(poll, results) {
        const mirrors = await this.mirrorRepository.find({
            where: { pollId: poll.id, status: PollDiscordMirror_1.PollMirrorStatus.ACTIVE },
        });
        if (mirrors.length === 0) {
            return;
        }
        const client = this.getClient();
        if (!client) {
            return;
        }
        for (const mirror of mirrors) {
            try {
                await this.updateMirrorEmbed(client, mirror, poll, results);
            }
            catch (err) {
                logger_1.logger.warn(`Failed to update mirror ${mirror.id} for poll ${poll.id}: ${err instanceof Error ? err.message : 'Unknown error'}`);
            }
        }
    }
    async closeAllMirrors(poll, results) {
        const mirrors = await this.mirrorRepository.find({
            where: { pollId: poll.id, status: PollDiscordMirror_1.PollMirrorStatus.ACTIVE },
        });
        if (mirrors.length === 0) {
            return;
        }
        const client = this.getClient();
        if (!client) {
            return;
        }
        for (const mirror of mirrors) {
            try {
                await this.updateMirrorEmbed(client, mirror, poll, results);
                mirror.status = PollDiscordMirror_1.PollMirrorStatus.CLOSED;
                mirror.lastUpdatedAt = new Date();
                await this.mirrorRepository.save(mirror);
            }
            catch (err) {
                logger_1.logger.warn(`Failed to close mirror ${mirror.id} for poll ${poll.id}: ${err instanceof Error ? err.message : 'Unknown error'}`);
            }
        }
        logger_1.logger.info(`Closed ${mirrors.length} mirror(s) for poll ${poll.id}`);
    }
    async getMirrorsForPoll(pollId, organizationId) {
        return this.mirrorRepository.find({
            where: { pollId, organizationId },
            order: { createdAt: 'ASC' },
        });
    }
    async deleteMirror(mirrorId, organizationId) {
        const mirror = await this.mirrorRepository.findOne({
            where: { id: mirrorId, organizationId },
        });
        if (!mirror) {
            throw new apiErrors_1.NotFoundError('Mirror');
        }
        if (mirror.messageId && mirror.channelId) {
            try {
                const client = this.getClient();
                if (client) {
                    const channel = await client.channels.fetch(mirror.channelId).catch(() => null);
                    if (channel?.isTextBased()) {
                        const msg = await channel.messages
                            .fetch(mirror.messageId)
                            .catch(() => null);
                        if (msg) {
                            await msg.delete().catch(() => null);
                        }
                    }
                }
            }
            catch {
            }
        }
        await this.mirrorRepository.remove(mirror);
    }
    async deliverMirror(mirror, poll) {
        const client = this.getClient();
        if (!client) {
            mirror.status = PollDiscordMirror_1.PollMirrorStatus.FAILED;
            mirror.errorMessage = 'Discord client not available';
            await this.mirrorRepository.save(mirror);
            return;
        }
        try {
            const channel = await client.channels.fetch(mirror.channelId ?? '').catch(() => null);
            if (!channel?.isTextBased()) {
                throw new Error(`Channel ${mirror.channelId ?? 'unknown'} not found or not text-based`);
            }
            const textChannel = channel;
            const isClosed = poll.status === Poll_1.PollStatus.CLOSED || poll.status === Poll_1.PollStatus.CANCELLED;
            const embed = (0, pollEmbed_1.buildPollEmbed)(poll);
            const components = (0, pollEmbed_1.buildPollButtons)(poll.id, poll.options, isClosed);
            const sent = await textChannel.send({ embeds: [embed], components });
            mirror.messageId = sent.id;
            mirror.channelId = textChannel.id;
            mirror.status = PollDiscordMirror_1.PollMirrorStatus.ACTIVE;
            mirror.deliveredAt = new Date();
            mirror.lastUpdatedAt = new Date();
            mirror.errorMessage = undefined;
            await this.mirrorRepository.save(mirror);
            logger_1.logger.info(`Poll ${poll.id} mirrored to guild ${mirror.guildId} channel ${mirror.channelId} (msg: ${sent.id})`);
        }
        catch (err) {
            mirror.status = PollDiscordMirror_1.PollMirrorStatus.FAILED;
            mirror.retryCount += 1;
            mirror.errorMessage = err instanceof Error ? err.message : 'Unknown delivery error';
            await this.mirrorRepository.save(mirror);
            logger_1.logger.error(`Failed to deliver poll mirror ${mirror.id}: ${mirror.errorMessage}`);
        }
    }
    async updateMirrorEmbed(client, mirror, poll, results) {
        if (!mirror.messageId || !mirror.channelId) {
            return;
        }
        const channel = await client.channels.fetch(mirror.channelId).catch(() => null);
        if (!channel?.isTextBased()) {
            return;
        }
        const textChannel = channel;
        const msg = await textChannel.messages.fetch(mirror.messageId).catch(() => null);
        if (!msg) {
            return;
        }
        const isClosed = poll.status === Poll_1.PollStatus.CLOSED || poll.status === Poll_1.PollStatus.CANCELLED;
        const embed = (0, pollEmbed_1.buildPollEmbed)(poll, results ?? undefined);
        const components = (0, pollEmbed_1.buildPollButtons)(poll.id, poll.options, isClosed);
        await msg.edit({ embeds: [embed], components });
        mirror.lastUpdatedAt = new Date();
        await this.mirrorRepository.save(mirror);
    }
    getClient() {
        try {
            return BotClientManager_1.BotClientManager.getInstance().getClient();
        }
        catch {
            logger_1.logger.debug('DiscordPollService: Bot client not available');
            return null;
        }
    }
}
exports.DiscordPollService = DiscordPollService;
//# sourceMappingURL=DiscordPollService.js.map