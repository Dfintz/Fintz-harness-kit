"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TicketTranscriptService = void 0;
const shared_types_1 = require("@sc-fleet-manager/shared-types");
const discord_js_1 = require("discord.js");
const logger_1 = require("../../utils/logger");
class TicketTranscriptService {
    static instance;
    client = null;
    static getInstance() {
        if (!TicketTranscriptService.instance) {
            TicketTranscriptService.instance = new TicketTranscriptService();
        }
        return TicketTranscriptService.instance;
    }
    initialize(client) {
        this.client = client;
    }
    generateTranscript(ticketNumber, subject, category, creatorName, createdAt, messages) {
        const closedAt = new Date();
        const publicMessages = messages.filter(m => !m.isInternal);
        const html = this.buildHtml(ticketNumber, subject, category, creatorName, createdAt, closedAt, publicMessages);
        const plainText = this.buildPlainText(ticketNumber, subject, creatorName, createdAt, closedAt, publicMessages);
        return {
            ticketNumber,
            subject,
            category,
            creatorName,
            createdAt,
            closedAt,
            messageCount: publicMessages.length,
            html,
            plainText,
        };
    }
    async postToChannel(transcriptChannelId, transcript) {
        if (!this.client) {
            logger_1.logger.warn('TicketTranscriptService: Client not initialized');
            return false;
        }
        try {
            const channel = await this.client.channels.fetch(transcriptChannelId);
            if (!channel || !('send' in channel)) {
                logger_1.logger.warn(`TicketTranscriptService: Channel ${transcriptChannelId} not found or not text`);
                return false;
            }
            const textChannel = channel;
            const embed = new discord_js_1.EmbedBuilder()
                .setColor(0x607d8b)
                .setTitle(`📄 Transcript — ${(0, shared_types_1.decodeHtmlEntities)(transcript.ticketNumber)}`)
                .setDescription(`**${(0, shared_types_1.decodeHtmlEntities)(transcript.subject)}**`)
                .addFields({ name: 'Category', value: (0, shared_types_1.decodeHtmlEntities)(transcript.category), inline: true }, { name: 'Created By', value: (0, shared_types_1.decodeHtmlEntities)(transcript.creatorName), inline: true }, { name: 'Messages', value: String(transcript.messageCount), inline: true }, {
                name: 'Duration',
                value: this.formatDuration(transcript.createdAt, transcript.closedAt),
                inline: true,
            })
                .setFooter({
                text: `Closed ${transcript.closedAt.toISOString().slice(0, 16).replace('T', ' ')} UTC`,
            })
                .setTimestamp(transcript.closedAt);
            const files = transcript.messageCount > 0
                ? [
                    {
                        attachment: Buffer.from(transcript.plainText, 'utf-8'),
                        name: `${transcript.ticketNumber}-transcript.txt`,
                    },
                ]
                : [];
            await textChannel.send({ embeds: [embed], files });
            return true;
        }
        catch (error) {
            logger_1.logger.error(`TicketTranscriptService: Failed to post transcript to ${transcriptChannelId}:`, error);
            return false;
        }
    }
    buildHtml(ticketNumber, subject, category, creatorName, createdAt, closedAt, messages) {
        const escHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        const messageRows = messages
            .map(m => {
            const ts = new Date(m.createdAt).toISOString().slice(0, 19).replace('T', ' ');
            return `<div class="msg"><span class="author">${escHtml(m.authorName)}</span> <span class="ts">${ts}</span><p>${escHtml(m.content)}</p></div>`;
        })
            .join('\n');
        return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Transcript ${escHtml(ticketNumber)}</title>
<style>
body{font-family:system-ui,sans-serif;max-width:800px;margin:2rem auto;padding:0 1rem;background:#36393f;color:#dcddde}
h1{color:#fff}
.meta{color:#72767d;margin-bottom:1.5rem}
.msg{border-left:3px solid #5865f2;padding:0.5rem 1rem;margin:0.5rem 0;background:#2f3136;border-radius:0 4px 4px 0}
.author{color:#fff;font-weight:600}
.ts{color:#72767d;font-size:0.85em;margin-left:0.5em}
p{margin:0.25rem 0 0}
</style>
</head>
<body>
<h1>🎫 ${escHtml(ticketNumber)} — ${escHtml(subject)}</h1>
<div class="meta">
Category: ${escHtml(category)} · Created by: ${escHtml(creatorName)}<br>
Opened: ${createdAt.toISOString().slice(0, 16).replace('T', ' ')} UTC · Closed: ${closedAt.toISOString().slice(0, 16).replace('T', ' ')} UTC<br>
Messages: ${messages.length}
</div>
${messageRows || '<p><em>No messages recorded.</em></p>'}
</body>
</html>`;
    }
    buildPlainText(ticketNumber, subject, creatorName, createdAt, closedAt, messages) {
        const lines = [
            `=== Ticket Transcript: ${ticketNumber} ===`,
            `Subject: ${subject}`,
            `Created by: ${creatorName}`,
            `Opened: ${createdAt.toISOString()}`,
            `Closed: ${closedAt.toISOString()}`,
            `Messages: ${messages.length}`,
            '',
            '--- Conversation ---',
            '',
        ];
        for (const m of messages) {
            const ts = new Date(m.createdAt).toISOString().slice(0, 19).replace('T', ' ');
            lines.push(`[${ts}] ${m.authorName}:`);
            lines.push(m.content);
            lines.push('');
        }
        lines.push('=== End of Transcript ===');
        return lines.join('\n');
    }
    formatDuration(start, end) {
        const diffMs = end.getTime() - start.getTime();
        const hours = Math.floor(diffMs / (1000 * 60 * 60));
        const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
        if (hours > 24) {
            const days = Math.floor(hours / 24);
            return `${days}d ${hours % 24}h`;
        }
        return `${hours}h ${minutes}m`;
    }
}
exports.TicketTranscriptService = TicketTranscriptService;
//# sourceMappingURL=TicketTranscriptService.js.map