"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DmNotificationService = exports.DEFAULT_DM_NOTIFICATION_SETTINGS = exports.DmEventType = void 0;
const shared_types_1 = require("@sc-fleet-manager/shared-types");
const discord_js_1 = require("discord.js");
const typeorm_1 = require("typeorm");
const database_1 = require("../../config/database");
const FailedDmDelivery_1 = require("../../models/FailedDmDelivery");
const logger_1 = require("../../utils/logger");
const DiscordUserPreferenceService_1 = require("./DiscordUserPreferenceService");
var DmEventType;
(function (DmEventType) {
    DmEventType["TICKET_CREATED"] = "ticket_created";
    DmEventType["TICKET_ASSIGNED"] = "ticket_assigned";
    DmEventType["TICKET_REPLIED"] = "ticket_replied";
    DmEventType["TICKET_CLOSED"] = "ticket_closed";
    DmEventType["TICKET_ESCALATED"] = "ticket_escalated";
    DmEventType["RECRUITMENT_RECEIVED"] = "recruitment_received";
    DmEventType["RECRUITMENT_ACCEPTED"] = "recruitment_accepted";
    DmEventType["RECRUITMENT_DENIED"] = "recruitment_denied";
    DmEventType["EVENT_REMINDER"] = "event_reminder";
    DmEventType["EVENT_CANCELLED"] = "event_cancelled";
    DmEventType["LFG_PLAYER_JOINED"] = "lfg_player_joined";
})(DmEventType || (exports.DmEventType = DmEventType = {}));
exports.DEFAULT_DM_NOTIFICATION_SETTINGS = {
    enabled: true,
    ticketCreatedNotify: true,
    ticketAssignedNotify: true,
    ticketRepliedNotify: false,
    ticketClosedNotify: true,
    ticketEscalatedNotify: true,
    ticketTranscriptInDm: false,
    recruitmentReceivedNotify: true,
    recruitmentAcceptedNotify: true,
    recruitmentDeniedNotify: true,
    eventReminderNotify: true,
    lfgJoinNotify: true,
};
const MAX_ATTEMPTS = 4;
const RETRY_DELAYS_MS = [
    5 * 60 * 1000,
    30 * 60 * 1000,
    2 * 60 * 60 * 1000,
];
const QUEUE_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_ERROR_LENGTH = 500;
const RETRY_BATCH_SIZE = 50;
class DmNotificationService {
    static instance;
    client = null;
    shouldFailClosedOnPreferenceError() {
        return process.env.DM_NOTIFICATION_PREFS_FAIL_CLOSED === 'true';
    }
    async filterRecipientsByPreference(payload, recipients) {
        if (!payload.guildId || recipients.length === 0) {
            return recipients;
        }
        try {
            const prefService = DiscordUserPreferenceService_1.DiscordUserPreferenceService.getInstance();
            const enabled = await prefService.filterDmEnabled(recipients, payload.guildId);
            const filtered = recipients.length - enabled.size;
            if (filtered > 0) {
                logger_1.logger.debug(`DmNotificationService: Filtered ${filtered} opted-out user(s) for ${payload.eventType}`);
            }
            return recipients.filter(id => enabled.has(id));
        }
        catch {
            if (this.shouldFailClosedOnPreferenceError()) {
                logger_1.logger.warn('DmNotificationService: Failed to check user preferences, dropping recipients (fail-closed)');
                return [];
            }
            logger_1.logger.warn('DmNotificationService: Failed to check user preferences, sending to all');
            return recipients;
        }
    }
    async sendNotificationToRecipient(payload, recipientId, client, result) {
        try {
            const user = await client.users.fetch(recipientId);
            await user.send({
                content: payload.content,
                embeds: [payload.embed],
            });
            result.sent++;
        }
        catch (error) {
            result.failed++;
            const msg = error instanceof Error ? error.message : String(error);
            result.errors.push(`Failed to DM ${recipientId}: ${msg}`);
            logger_1.logger.debug(`DmNotificationService: Could not DM user ${recipientId}:`, error);
            await this.persistFailedDelivery(recipientId, payload, msg);
        }
    }
    static getInstance() {
        if (!DmNotificationService.instance) {
            DmNotificationService.instance = new DmNotificationService();
        }
        return DmNotificationService.instance;
    }
    initialize(client) {
        this.client = client;
    }
    isEventEnabled(eventType, settings) {
        if (!settings?.enabled) {
            return false;
        }
        const eventMap = {
            [DmEventType.TICKET_CREATED]: 'ticketCreatedNotify',
            [DmEventType.TICKET_ASSIGNED]: 'ticketAssignedNotify',
            [DmEventType.TICKET_REPLIED]: 'ticketRepliedNotify',
            [DmEventType.TICKET_CLOSED]: 'ticketClosedNotify',
            [DmEventType.TICKET_ESCALATED]: 'ticketEscalatedNotify',
            [DmEventType.RECRUITMENT_RECEIVED]: 'recruitmentReceivedNotify',
            [DmEventType.RECRUITMENT_ACCEPTED]: 'recruitmentAcceptedNotify',
            [DmEventType.RECRUITMENT_DENIED]: 'recruitmentDeniedNotify',
            [DmEventType.EVENT_REMINDER]: 'eventReminderNotify',
            [DmEventType.EVENT_CANCELLED]: 'eventReminderNotify',
            [DmEventType.LFG_PLAYER_JOINED]: 'lfgJoinNotify',
        };
        const key = eventMap[eventType];
        return settings[key] === true;
    }
    async sendNotifications(payload) {
        const result = { sent: 0, failed: 0, errors: [] };
        if (!this.client) {
            result.errors.push('DmNotificationService: Client not initialized');
            logger_1.logger.warn('DmNotificationService: Attempted to send DMs before initialization');
            return result;
        }
        const recipients = await this.filterRecipientsByPreference(payload, payload.recipientDiscordIds);
        for (const recipientId of recipients) {
            await this.sendNotificationToRecipient(payload, recipientId, this.client, result);
        }
        if (result.sent > 0) {
            logger_1.logger.info(`DmNotificationService: ${payload.eventType} — sent ${result.sent}, failed ${result.failed}`);
        }
        return result;
    }
    getFailedRepo() {
        try {
            const repo = database_1.AppDataSource.getRepository(FailedDmDelivery_1.FailedDmDelivery);
            return repo ?? null;
        }
        catch {
            return null;
        }
    }
    async persistFailedDelivery(recipientId, payload, errorMessage) {
        const repo = this.getFailedRepo();
        if (!repo) {
            return;
        }
        try {
            const now = Date.now();
            await repo.save(repo.create({
                recipientDiscordId: recipientId,
                eventType: payload.eventType,
                guildId: payload.guildId ?? null,
                content: payload.content ?? null,
                embedJson: payload.embed.toJSON(),
                attemptCount: 1,
                nextRetryAt: new Date(now + RETRY_DELAYS_MS[0]),
                lastError: errorMessage.slice(0, MAX_ERROR_LENGTH),
                expiresAt: new Date(now + QUEUE_TTL_MS),
            }));
        }
        catch (err) {
            logger_1.logger.warn(`DmNotificationService: Failed to enqueue retry for user ${recipientId}: ${err instanceof Error ? err.message : String(err)}`);
        }
    }
    async retryFailedDms() {
        const result = { expired: 0, succeeded: 0, rescheduled: 0, dropped: 0 };
        const repo = this.getFailedRepo();
        if (!repo) {
            return result;
        }
        if (!this.client) {
            logger_1.logger.debug('DmNotificationService: Skipping retry pass — Discord client not initialized');
            return result;
        }
        const now = new Date();
        let dueRows;
        try {
            dueRows = await repo.find({
                where: { nextRetryAt: (0, typeorm_1.LessThanOrEqual)(now) },
                order: { nextRetryAt: 'ASC' },
                take: RETRY_BATCH_SIZE,
            });
        }
        catch (err) {
            logger_1.logger.error('DmNotificationService: Failed to query retry queue', err);
            return result;
        }
        for (const row of dueRows) {
            try {
                await this.processRetryRow(row, now, repo, this.client, result);
            }
            catch (err) {
                logger_1.logger.error(`DmNotificationService: Unexpected error processing retry row ${row.id}`, err);
            }
        }
        if (result.succeeded + result.dropped + result.expired > 0) {
            logger_1.logger.info(`DmNotificationService: Retry pass complete — succeeded=${result.succeeded}, rescheduled=${result.rescheduled}, dropped=${result.dropped}, expired=${result.expired}`);
        }
        return result;
    }
    async processRetryRow(row, now, repo, client, result) {
        if (row.expiresAt.getTime() <= now.getTime()) {
            await repo.delete(row.id);
            result.expired++;
            logger_1.logger.info(`DmNotificationService: Dropping expired DM retry for ${row.recipientDiscordId} (event=${row.eventType}, attempts=${row.attemptCount})`);
            return;
        }
        try {
            const user = await client.users.fetch(row.recipientDiscordId);
            const sendPayload = {
                embeds: [row.embedJson],
            };
            if (row.content) {
                sendPayload.content = row.content;
            }
            await user.send(sendPayload);
            await repo.delete(row.id);
            result.succeeded++;
            logger_1.logger.info(`DmNotificationService: Retry succeeded for ${row.recipientDiscordId} (event=${row.eventType}, attempts=${row.attemptCount})`);
        }
        catch (sendErr) {
            const msg = sendErr instanceof Error ? sendErr.message : String(sendErr);
            const nextAttempt = row.attemptCount + 1;
            if (nextAttempt >= MAX_ATTEMPTS) {
                await repo.delete(row.id);
                result.dropped++;
                logger_1.logger.warn(`DmNotificationService: Dropping DM retry for ${row.recipientDiscordId} after ${nextAttempt} attempts (event=${row.eventType}): ${msg}`);
                return;
            }
            const lastDelay = RETRY_DELAYS_MS.at(-1) ?? 5 * 60 * 1000;
            const delayMs = RETRY_DELAYS_MS[nextAttempt - 1] ?? lastDelay;
            row.attemptCount = nextAttempt;
            row.nextRetryAt = new Date(now.getTime() + delayMs);
            row.lastError = msg.slice(0, MAX_ERROR_LENGTH);
            await repo.save(row);
            result.rescheduled++;
        }
    }
    buildTicketCreatedEmbed(ticketNumber, subject, category) {
        return new discord_js_1.EmbedBuilder()
            .setColor(0x00ff88)
            .setTitle('🎫 Ticket Created')
            .setDescription(`Your ticket **${(0, shared_types_1.decodeHtmlEntities)(ticketNumber)}** has been created and is being reviewed.`)
            .addFields({ name: 'Subject', value: (0, shared_types_1.decodeHtmlEntities)(subject), inline: false }, { name: 'Category', value: (0, shared_types_1.decodeHtmlEntities)(category), inline: true }, { name: 'Status', value: '`Open`', inline: true })
            .setFooter({ text: 'You will be notified when there are updates.' })
            .setTimestamp();
    }
    buildTicketAssignedEmbed(ticketNumber, assigneeName) {
        return new discord_js_1.EmbedBuilder()
            .setColor(0x3498db)
            .setTitle('🎫 Ticket Assigned')
            .setDescription(`Your ticket **${(0, shared_types_1.decodeHtmlEntities)(ticketNumber)}** has been assigned to **${(0, shared_types_1.decodeHtmlEntities)(assigneeName)}**.`)
            .setTimestamp();
    }
    buildTicketRepliedEmbed(ticketNumber, replierName, preview) {
        const decodedPreview = (0, shared_types_1.decodeHtmlEntities)(preview);
        const truncated = decodedPreview.length > 200 ? `${decodedPreview.slice(0, 200)}…` : decodedPreview;
        return new discord_js_1.EmbedBuilder()
            .setColor(0xffaa00)
            .setTitle('💬 New Reply on Your Ticket')
            .setDescription(`**${(0, shared_types_1.decodeHtmlEntities)(replierName)}** replied to ticket **${(0, shared_types_1.decodeHtmlEntities)(ticketNumber)}**:`)
            .addFields({ name: 'Message', value: truncated })
            .setTimestamp();
    }
    buildTicketClosedEmbed(ticketNumber, resolution, transcriptUrl) {
        const embed = new discord_js_1.EmbedBuilder()
            .setColor(0xff4444)
            .setTitle('🎫 Ticket Closed')
            .setDescription(`Your ticket **${(0, shared_types_1.decodeHtmlEntities)(ticketNumber)}** has been closed.`)
            .setTimestamp();
        if (resolution) {
            embed.addFields({ name: 'Resolution', value: (0, shared_types_1.decodeHtmlEntities)(resolution) });
        }
        if (transcriptUrl) {
            embed.addFields({ name: 'Transcript', value: `[View transcript](${transcriptUrl})` });
        }
        return embed;
    }
    buildTicketEscalatedEmbed(ticketNumber, reason) {
        const embed = new discord_js_1.EmbedBuilder()
            .setColor(0xff6600)
            .setTitle('⚠️ Ticket Escalated')
            .setDescription(`Ticket **${(0, shared_types_1.decodeHtmlEntities)(ticketNumber)}** has been escalated for review.`)
            .setTimestamp();
        if (reason) {
            embed.addFields({ name: 'Reason', value: (0, shared_types_1.decodeHtmlEntities)(reason) });
        }
        return embed;
    }
    buildRecruitmentReceivedEmbed(applicantName, position) {
        const embed = new discord_js_1.EmbedBuilder()
            .setColor(0x00d9ff)
            .setTitle('📋 Application Received')
            .setDescription(`Thank you **${(0, shared_types_1.decodeHtmlEntities)(applicantName)}**, your application has been received and is under review.`)
            .setTimestamp();
        if (position) {
            embed.addFields({ name: 'Position', value: (0, shared_types_1.decodeHtmlEntities)(position), inline: true });
        }
        embed.addFields({ name: 'Status', value: '`Under Review`', inline: true });
        return embed;
    }
    buildRecruitmentAcceptedEmbed(organizationName, position) {
        const embed = new discord_js_1.EmbedBuilder()
            .setColor(0x00ff88)
            .setTitle('✅ Application Accepted')
            .setDescription(`Congratulations! Your application to **${(0, shared_types_1.decodeHtmlEntities)(organizationName)}** has been accepted!`)
            .setTimestamp();
        if (position) {
            embed.addFields({ name: 'Position', value: (0, shared_types_1.decodeHtmlEntities)(position), inline: true });
        }
        return embed;
    }
    buildRecruitmentDeniedEmbed(organizationName, reason) {
        const embed = new discord_js_1.EmbedBuilder()
            .setColor(0xff4444)
            .setTitle('❌ Application Not Accepted')
            .setDescription(`Your application to **${(0, shared_types_1.decodeHtmlEntities)(organizationName)}** was not accepted at this time.`)
            .setTimestamp();
        if (reason) {
            embed.addFields({ name: 'Feedback', value: (0, shared_types_1.decodeHtmlEntities)(reason) });
        }
        return embed;
    }
    buildLfgJoinedEmbed(activity, playerName, currentPlayers, maxPlayers) {
        return new discord_js_1.EmbedBuilder()
            .setColor(0x00ff88)
            .setTitle('🎮 Player Joined Your LFG')
            .setDescription(`**${(0, shared_types_1.decodeHtmlEntities)(playerName)}** joined your **${(0, shared_types_1.decodeHtmlEntities)(activity)}** group!`)
            .addFields({
            name: 'Party',
            value: `${currentPlayers}/${maxPlayers} players`,
            inline: true,
        })
            .setTimestamp();
    }
}
exports.DmNotificationService = DmNotificationService;
//# sourceMappingURL=DmNotificationService.js.map