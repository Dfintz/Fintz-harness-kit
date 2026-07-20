"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BriefingDiscordWebhookService = void 0;
exports.buildBriefingDiscordEmbed = buildBriefingDiscordEmbed;
const axios_1 = __importDefault(require("axios"));
const Briefing_1 = require("../../models/Briefing");
const apiErrors_1 = require("../../utils/apiErrors");
const auditLogger_1 = require("../../utils/auditLogger");
const logger_1 = require("../../utils/logger");
const SC_BLUE = 0x00d4ff;
const WEBHOOK_USERNAME = 'Fringe Core Briefings';
const WEBHOOK_TIMEOUT_MS = 10_000;
const DISCORD_WEBHOOK_HOSTS = new Set(['discord.com', 'ptb.discord.com', 'canary.discord.com']);
const EXTERNAL_SHARE_BLOCKED_CLASSIFICATIONS = new Set([
    Briefing_1.BriefingClassification.SECRET,
    Briefing_1.BriefingClassification.TOP_SECRET,
]);
const MAX_TITLE = 250;
const MAX_DESCRIPTION = 2000;
const truncate = (value, max) => value.length <= max ? value : `${value.slice(0, max - 1)}…`;
function firstTextSnippet(briefing) {
    for (const element of briefing.elements) {
        if (element.type === 'text' && element.data && typeof element.data === 'object') {
            const text = element.data.text;
            if (typeof text === 'string' && text.trim().length > 0) {
                return truncate(text.trim(), MAX_DESCRIPTION);
            }
        }
    }
    return undefined;
}
function buildBriefingDiscordEmbed(briefing) {
    const elementCount = briefing.elements.length;
    return {
        title: truncate(`Briefing: ${briefing.title}`, MAX_TITLE),
        description: firstTextSnippet(briefing) ?? `*${elementCount} element${elementCount === 1 ? '' : 's'}*`,
        color: SC_BLUE,
        fields: [
            { name: 'Classification', value: briefing.classification, inline: true },
            { name: 'Status', value: briefing.status, inline: true },
            { name: 'Elements', value: String(elementCount), inline: true },
        ],
        footer: { text: `Briefing ID: ${briefing.id}` },
        timestamp: briefing.createdAt instanceof Date ? briefing.createdAt.toISOString() : undefined,
    };
}
function parseDiscordWebhookUrl(webhookUrl) {
    let url;
    try {
        url = new URL(webhookUrl);
    }
    catch {
        throw new apiErrors_1.BadRequestError('webhookUrl must be a valid URL');
    }
    if (url.protocol !== 'https:' ||
        !DISCORD_WEBHOOK_HOSTS.has(url.hostname.toLowerCase()) ||
        !url.pathname.startsWith('/api/webhooks/')) {
        throw new apiErrors_1.BadRequestError('webhookUrl must be an https Discord webhook URL');
    }
    return url;
}
class BriefingDiscordWebhookService {
    async postBriefingToWebhook(briefing, webhookUrl, ctx) {
        if (EXTERNAL_SHARE_BLOCKED_CLASSIFICATIONS.has(briefing.classification)) {
            throw new apiErrors_1.ForbiddenError('This briefing classification cannot be shared to an external Discord webhook', { resource: 'briefing', action: 'share-external', resourceId: briefing.id });
        }
        const url = parseDiscordWebhookUrl(webhookUrl);
        const payload = {
            username: WEBHOOK_USERNAME,
            embeds: [buildBriefingDiscordEmbed(briefing)],
        };
        try {
            await axios_1.default.post(url.href, payload, {
                timeout: WEBHOOK_TIMEOUT_MS,
                maxRedirects: 0,
            });
        }
        catch (err) {
            const status = axios_1.default.isAxiosError(err) ? err.response?.status : undefined;
            logger_1.logger.error('Failed to deliver briefing to Discord webhook', {
                briefingId: briefing.id,
                webhookHost: url.hostname,
                status,
            });
            throw new apiErrors_1.ServiceUnavailableError('Failed to deliver briefing to Discord');
        }
        (0, auditLogger_1.logAuditEvent)({
            eventType: auditLogger_1.AuditEventType.SENSITIVE_DATA_ACCESS,
            userId: ctx.userId,
            resource: `briefing/${briefing.id}`,
            action: 'POST_TO_DISCORD_WEBHOOK',
            message: `Briefing "${briefing.title}" posted to a Discord webhook`,
            metadata: {
                organizationId: ctx.organizationId,
                briefingId: briefing.id,
                classification: briefing.classification,
                webhookHost: url.hostname,
            },
        });
    }
}
exports.BriefingDiscordWebhookService = BriefingDiscordWebhookService;
//# sourceMappingURL=BriefingDiscordWebhookService.js.map