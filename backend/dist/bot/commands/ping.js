"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ping = void 0;
const discord_js_1 = require("discord.js");
const logger_1 = require("../../utils/logger");
const commandErrorHandler_1 = require("../utils/commandErrorHandler");
exports.ping = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName('ping')
        .setDescription('Check bot latency and response time'),
    cooldown: 5,
    category: 'utility',
    examples: ['/ping'],
    guildOnly: false,
    async execute(interaction) {
        try {
            const sent = await interaction.reply({ content: '🏓 Pinging...', fetchReply: true });
            const latency = sent.createdTimestamp - interaction.createdTimestamp;
            const wsLatency = interaction.client.ws.ping;
            let status;
            if (wsLatency < 200) {
                status = 'Excellent';
            }
            else if (wsLatency < 500) {
                status = 'Good';
            }
            else {
                status = 'Slow';
            }
            await interaction.editReply(`🏓 **Pong!**\n` +
                `📡 **Bot Latency:** ${latency}ms\n` +
                `💓 **WebSocket Latency:** ${wsLatency}ms\n` +
                `✅ **Status:** ${status}`);
        }
        catch (error) {
            logger_1.logger.error('Error in PingCommand.execute', error instanceof Error ? error : new Error(String(error)));
            await (0, commandErrorHandler_1.handleCommandError)(interaction, error, 'PingCommand.execute');
        }
    },
};
//# sourceMappingURL=ping.js.map