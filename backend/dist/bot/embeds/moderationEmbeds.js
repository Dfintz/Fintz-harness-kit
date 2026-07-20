"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTypeEmoji = getTypeEmoji;
exports.getSeverityEmoji = getSeverityEmoji;
exports.getSeverityColor = getSeverityColor;
exports.getStatusEmoji = getStatusEmoji;
exports.getSeverityLabel = getSeverityLabel;
exports.getResultColor = getResultColor;
exports.getMirrorStatusEmoji = getMirrorStatusEmoji;
exports.formatIncident = formatIncident;
exports.createSummaryEmbed = createSummaryEmbed;
exports.buildMirrorActionResultEmbed = buildMirrorActionResultEmbed;
exports.buildMirrorActionConfirmedEmbed = buildMirrorActionConfirmedEmbed;
exports.buildMirrorActionCancelledEmbed = buildMirrorActionCancelledEmbed;
exports.buildIncidentRevokedEmbed = buildIncidentRevokedEmbed;
exports.buildSharingSettingsUpdatedEmbed = buildSharingSettingsUpdatedEmbed;
exports.buildIncidentSharedEmbed = buildIncidentSharedEmbed;
exports.buildIncidentListEmbed = buildIncidentListEmbed;
exports.buildAlliedAlertsEmbed = buildAlliedAlertsEmbed;
exports.buildMirrorHistoryEmbed = buildMirrorHistoryEmbed;
exports.buildBulkMirrorSummaryEmbed = buildBulkMirrorSummaryEmbed;
exports.buildSharingSettingsDisplayEmbed = buildSharingSettingsDisplayEmbed;
exports.buildModerationAnalyticsEmbed = buildModerationAnalyticsEmbed;
exports.buildIncidentReportedEmbed = buildIncidentReportedEmbed;
exports.buildCrossAllianceCheckEmbed = buildCrossAllianceCheckEmbed;
const discord_js_1 = require("discord.js");
const MirrorAction_1 = require("../../models/MirrorAction");
const ModerationIncident_1 = require("../../models/ModerationIncident");
const embedBuilder_1 = require("../utils/embedBuilder");
function getTypeEmoji(type) {
    switch (type) {
        case ModerationIncident_1.IncidentType.WARNING:
            return '\u26a0\uFE0F';
        case ModerationIncident_1.IncidentType.TIMEOUT:
            return '\u23f0';
        case ModerationIncident_1.IncidentType.LONG_TIMEOUT:
            return '\u{1F550}';
        case ModerationIncident_1.IncidentType.KICK:
            return '\u{1F462}';
        case ModerationIncident_1.IncidentType.BAN:
            return '\u{1F528}';
        default:
            return '\u2753';
    }
}
function getSeverityEmoji(severity) {
    switch (severity) {
        case ModerationIncident_1.IncidentSeverity.WARNING:
            return '\u{1F7E2}';
        case ModerationIncident_1.IncidentSeverity.TIMEOUT:
            return '\u{1F7E1}';
        case ModerationIncident_1.IncidentSeverity.LONG_TIMEOUT:
            return '\u{1F7E0}';
        case ModerationIncident_1.IncidentSeverity.KICK:
            return '\u{1F534}';
        case ModerationIncident_1.IncidentSeverity.BAN:
            return '\u26d4';
        default:
            return '\u26aa';
    }
}
function getSeverityColor(severity) {
    switch (severity) {
        case ModerationIncident_1.IncidentSeverity.WARNING:
            return 0x00ff00;
        case ModerationIncident_1.IncidentSeverity.TIMEOUT:
            return 0xffff00;
        case ModerationIncident_1.IncidentSeverity.LONG_TIMEOUT:
            return 0xffa500;
        case ModerationIncident_1.IncidentSeverity.KICK:
            return 0xff0000;
        case ModerationIncident_1.IncidentSeverity.BAN:
            return 0x800000;
        default:
            return 0x808080;
    }
}
function getStatusEmoji(status) {
    switch (status) {
        case ModerationIncident_1.IncidentStatus.ACTIVE:
            return '\u{1F7E2}';
        case ModerationIncident_1.IncidentStatus.EXPIRED:
            return '\u23f0';
        case ModerationIncident_1.IncidentStatus.REVOKED:
            return '\u2705';
        default:
            return '\u2753';
    }
}
function getSeverityLabel(severity) {
    switch (severity) {
        case ModerationIncident_1.IncidentSeverity.WARNING:
            return 'Warning';
        case ModerationIncident_1.IncidentSeverity.TIMEOUT:
            return 'Timeout';
        case ModerationIncident_1.IncidentSeverity.LONG_TIMEOUT:
            return 'Long Timeout';
        case ModerationIncident_1.IncidentSeverity.KICK:
            return 'Kick';
        case ModerationIncident_1.IncidentSeverity.BAN:
            return 'Ban';
        default:
            return 'Unknown';
    }
}
function getResultColor(success, requiresConfirmation) {
    if (!success) {
        return embedBuilder_1.EmbedColors.ERROR;
    }
    return requiresConfirmation ? embedBuilder_1.EmbedColors.WARNING : embedBuilder_1.EmbedColors.SUCCESS;
}
function getMirrorStatusEmoji(status) {
    switch (status) {
        case MirrorAction_1.MirrorActionStatus.CONFIRMED:
            return '\u2705';
        case MirrorAction_1.MirrorActionStatus.PENDING:
            return '\u23f3';
        case MirrorAction_1.MirrorActionStatus.CANCELLED:
            return '\u274c';
        default:
            return '\u26a0\uFE0F';
    }
}
function formatIncident(incident) {
    const typeEmoji = getTypeEmoji(incident.incidentType);
    const statusEmoji = getStatusEmoji(incident.status);
    const date = new Date(incident.createdAt).toLocaleDateString();
    let reason = '';
    if (incident.reason) {
        const truncated = incident.reason.length > 50 ? `${incident.reason.substring(0, 50)}...` : incident.reason;
        reason = ` - ${truncated}`;
    }
    const shared = incident.isShared ? ' \u{1F310}' : '';
    return `${statusEmoji} ${typeEmoji} ${incident.incidentType.toUpperCase()} (${date})${reason}${shared}`;
}
function createSummaryEmbed(summary) {
    const embed = new discord_js_1.EmbedBuilder()
        .setTitle(`\u{1F4CB} Incident Report: ${summary.targetUsername ?? summary.targetDiscordId}`)
        .setColor(getSeverityColor(summary.highestSeverity))
        .setDescription(summary.totalIncidents === 0
        ? '\u2705 No incidents found for this user.'
        : `Found **${summary.totalIncidents}** incident(s) for <@${summary.targetDiscordId}>`)
        .setTimestamp();
    if (summary.totalIncidents > 0) {
        embed.addFields({
            name: '\u{1F4CA} Overview',
            value: [
                `\u{1F3AF} Total Incidents: **${summary.totalIncidents}**`,
                `\u{1F7E2} Active: **${summary.activeIncidents}**`,
                `\u{1F310} Shared: **${summary.sharedIncidents}**`,
                `\u26a0\uFE0F Highest Severity: ${getSeverityEmoji(summary.highestSeverity)} **${getSeverityLabel(summary.highestSeverity)}**`,
            ].join('\n'),
            inline: false,
        });
        const typeBreakdown = Object.entries(summary.incidentsByType)
            .filter(([_, count]) => count > 0)
            .map(([type, count]) => `${getTypeEmoji(type)} ${type}: ${count}`)
            .join('\n');
        if (typeBreakdown) {
            embed.addFields({ name: '\u{1F4D1} By Type', value: typeBreakdown, inline: true });
        }
        const severityBreakdown = Object.entries(summary.incidentsBySeverity)
            .filter(([_, count]) => count > 0)
            .map(([sev, count]) => `${getSeverityEmoji(Number(sev))} Level ${sev}: ${count}`)
            .join('\n');
        if (severityBreakdown) {
            embed.addFields({
                name: '\u{1F39A}\uFE0F By Severity',
                value: severityBreakdown,
                inline: true,
            });
        }
        const recentIncidents = summary.incidents.slice(0, 5).map(formatIncident).join('\n');
        if (recentIncidents) {
            embed.addFields({
                name: '\u{1F4DC} Recent Incidents',
                value: recentIncidents,
                inline: false,
            });
        }
        if (summary.firstIncident && summary.lastIncident) {
            embed.addFields({
                name: '\u{1F4C5} Timeline',
                value: `First: ${new Date(summary.firstIncident).toLocaleDateString()}\nLast: ${new Date(summary.lastIncident).toLocaleDateString()}`,
                inline: true,
            });
        }
    }
    embed.setFooter({ text: `Discord ID: ${summary.targetDiscordId}` });
    return embed;
}
function buildMirrorActionResultEmbed(result, incident, moderatorUsername) {
    const embed = new discord_js_1.EmbedBuilder()
        .setColor(getResultColor(result.success, result.requiresConfirmation))
        .setTitle(result.requiresConfirmation
        ? '\u26a0\uFE0F Mirror Action Pending Confirmation'
        : '\u{1FA9E} Mirror Action Created')
        .setDescription(result.message)
        .addFields({ name: 'Target User', value: `<@${incident.targetDiscordId}>`, inline: true }, {
        name: 'Action Type',
        value: `${getTypeEmoji(incident.incidentType)} ${incident.incidentType.toUpperCase()}`,
        inline: true,
    }, {
        name: 'Severity',
        value: `${getSeverityEmoji(incident.severity)} Level ${incident.severity}`,
        inline: true,
    }, { name: 'Source Server', value: incident.guildName ?? 'Allied Server', inline: true }, { name: 'Mirror ID', value: `\`${result.action.id.substring(0, 8)}...\``, inline: true });
    if (incident.reason) {
        embed.addFields({
            name: 'Reason',
            value: incident.reason.substring(0, 200),
            inline: false,
        });
    }
    if (result.requiresConfirmation) {
        embed.addFields({
            name: '\u26a0\uFE0F Confirmation Required',
            value: `Use \`/blacklist confirm-mirror mirror_id:${result.action.id.substring(0, 8)}\` to confirm this ban action.`,
            inline: false,
        });
    }
    embed.setFooter({ text: `Mirrored by ${moderatorUsername}` }).setTimestamp();
    return embed;
}
function buildMirrorActionStatusEmbed(action, options) {
    return new discord_js_1.EmbedBuilder()
        .setColor(options.color)
        .setTitle(options.title)
        .setDescription(options.description)
        .addFields({ name: 'Mirror ID', value: `\`${action.id.substring(0, 8)}...\``, inline: true }, { name: 'Target', value: `<@${action.targetDiscordId}>`, inline: true }, {
        name: 'Action Type',
        value: `${action.getSeverityEmoji()} ${action.actionType.toUpperCase()}`,
        inline: true,
    })
        .setFooter({ text: options.footer })
        .setTimestamp();
}
function buildMirrorActionConfirmedEmbed(action, moderatorUsername) {
    return buildMirrorActionStatusEmbed(action, {
        color: embedBuilder_1.EmbedColors.SUCCESS,
        title: '\u2705 Mirror Action Confirmed',
        description: 'The mirror action has been confirmed and is ready for execution.',
        footer: `Confirmed by ${moderatorUsername}`,
    });
}
function buildMirrorActionCancelledEmbed(action, moderatorUsername) {
    return buildMirrorActionStatusEmbed(action, {
        color: embedBuilder_1.EmbedColors.CLOSED,
        title: '\u274c Mirror Action Cancelled',
        description: 'The mirror action has been cancelled.',
        footer: `Cancelled by ${moderatorUsername}`,
    });
}
function buildIncidentRevokedEmbed(incident, reason, moderatorUsername) {
    const embed = new discord_js_1.EmbedBuilder()
        .setColor(embedBuilder_1.EmbedColors.SUCCESS)
        .setTitle('\u2705 Incident Revoked')
        .setDescription('The moderation incident has been revoked.')
        .addFields({ name: 'Incident ID', value: `\`${incident.id.substring(0, 8)}...\``, inline: true }, {
        name: 'Target',
        value: incident.targetUsername ?? incident.targetDiscordId,
        inline: true,
    }, {
        name: 'Original Type',
        value: `${getTypeEmoji(incident.incidentType)} ${incident.incidentType}`,
        inline: true,
    });
    if (reason) {
        embed.addFields({ name: 'Revoke Reason', value: reason, inline: false });
    }
    embed.setFooter({ text: `Revoked by ${moderatorUsername}` }).setTimestamp();
    return embed;
}
function buildSharingSettingsUpdatedEmbed(changesList, moderatorUsername) {
    return new discord_js_1.EmbedBuilder()
        .setColor(embedBuilder_1.EmbedColors.SUCCESS)
        .setTitle('\u2705 Settings Updated')
        .setDescription('Blacklist sharing configuration has been updated.')
        .addFields({
        name: '\u{1F4DD} Changes Applied',
        value: changesList.join('\n') || 'No changes',
        inline: false,
    })
        .setFooter({ text: `Updated by ${moderatorUsername}` })
        .setTimestamp();
}
function buildIncidentSharedEmbed(incident, moderatorUsername) {
    return new discord_js_1.EmbedBuilder()
        .setColor(embedBuilder_1.EmbedColors.SC_BLUE)
        .setTitle('\u{1F310} Incident Shared')
        .setDescription('This incident is now visible to other organizations.')
        .addFields({ name: 'Incident ID', value: `\`${incident.id.substring(0, 8)}...\``, inline: true }, {
        name: 'Target',
        value: incident.targetUsername ?? incident.targetDiscordId,
        inline: true,
    }, {
        name: 'Type',
        value: `${getTypeEmoji(incident.incidentType)} ${incident.incidentType}`,
        inline: true,
    })
        .setFooter({ text: `Shared by ${moderatorUsername}` })
        .setTimestamp();
}
function paginationFooterText(currentPage, totalPages, command, nextPage) {
    return `Page ${currentPage} of ${totalPages} | Use /blacklist ${command} page:${nextPage} for more`;
}
function buildIncidentListEmbed(result, page) {
    const embed = new discord_js_1.EmbedBuilder()
        .setColor(embedBuilder_1.EmbedColors.SC_BLUE)
        .setTitle('\u{1F4CB} Moderation Incidents')
        .setDescription(`Showing ${result.incidents.length} of ${result.total} incidents (Page ${result.page}/${result.totalPages})`)
        .setTimestamp();
    for (const incident of result.incidents.slice(0, 10)) {
        const statusEmoji = getStatusEmoji(incident.status);
        const typeEmoji = getTypeEmoji(incident.incidentType);
        const severityEmoji = getSeverityEmoji(incident.severity);
        const shared = incident.isShared ? ' \u{1F310}' : '';
        embed.addFields({
            name: `${statusEmoji} ${typeEmoji} ${incident.targetUsername ?? incident.targetDiscordId}${shared}`,
            value: `ID: \`${incident.id.substring(0, 8)}...\`\n${severityEmoji} Severity ${incident.severity} | ${incident.reason?.substring(0, 50) ?? 'No reason'}${(incident.reason?.length ?? 0) > 50 ? '...' : ''}\n\u{1F4C5} ${new Date(incident.createdAt).toLocaleDateString()}`,
            inline: false,
        });
    }
    if (result.totalPages > 1) {
        embed.setFooter({
            text: paginationFooterText(result.page, result.totalPages, 'list', page + 1),
        });
    }
    return embed;
}
function buildAlliedAlertsEmbed(feed, page) {
    const embed = new discord_js_1.EmbedBuilder()
        .setColor(embedBuilder_1.EmbedColors.ERROR)
        .setTitle('\u{1F6A8} Allied Organization Alerts')
        .setDescription(`Showing ${feed.incidents.length} of ${feed.total} alerts from allies (Page ${feed.page}/${feed.totalPages})`)
        .setTimestamp();
    for (const sharedIncident of feed.incidents) {
        const incident = sharedIncident.incident;
        const statusEmoji = getStatusEmoji(incident.status);
        const typeEmoji = getTypeEmoji(incident.incidentType);
        const severityEmoji = getSeverityEmoji(incident.severity);
        embed.addFields({
            name: `${statusEmoji} ${typeEmoji} ${incident.targetUsername ?? incident.targetDiscordId}`,
            value: [
                `\u{1F4CD} From: **${incident.guildName ?? 'Allied Organization'}**`,
                `${severityEmoji} Severity: **${incident.severity}** | Type: **${incident.incidentType}**`,
                `\u{1F4DD} ${incident.reason?.substring(0, 80) ?? 'No reason provided'}${(incident.reason?.length ?? 0) > 80 ? '...' : ''}`,
                `\u{1F4C5} ${new Date(incident.createdAt).toLocaleDateString()}`,
            ].join('\n'),
            inline: false,
        });
    }
    if (feed.totalPages > 1) {
        embed.setFooter({
            text: paginationFooterText(feed.page, feed.totalPages, 'alerts', page + 1),
        });
    }
    return embed;
}
function buildMirrorHistoryEmbed(history, targetUserId, page) {
    const embed = new discord_js_1.EmbedBuilder()
        .setColor(embedBuilder_1.EmbedColors.SC_BLUE)
        .setTitle('\u{1FA9E} Mirror Action History')
        .setDescription(targetUserId
        ? `Showing mirror actions for <@${targetUserId}> (Page ${history.page}/${history.totalPages})`
        : `Showing ${history.actions.length} of ${history.total} mirror actions (Page ${history.page}/${history.totalPages})`)
        .setTimestamp();
    for (const action of history.actions.slice(0, 10)) {
        const statusEmoji = getMirrorStatusEmoji(action.status);
        embed.addFields({
            name: `${statusEmoji} ${action.getSeverityEmoji()} ${action.actionType.toUpperCase()} - ${action.targetUsername ?? action.targetDiscordId}`,
            value: [
                `ID: \`${action.id.substring(0, 8)}...\` | Status: **${action.status}**`,
                `From: ${action.sourceGuildName ?? 'Allied Server'}`,
                `\u{1F4C5} ${new Date(action.createdAt).toLocaleDateString()}`,
            ].join('\n'),
            inline: false,
        });
    }
    if (history.totalPages > 1) {
        embed.setFooter({
            text: paginationFooterText(history.page, history.totalPages, 'mirror-history', page + 1),
        });
    }
    return embed;
}
function buildBulkMirrorSummaryEmbed(summary, targetAvatarUrl, moderatorUsername) {
    const embed = new discord_js_1.EmbedBuilder()
        .setColor(summary.failedCount === 0 ? embedBuilder_1.EmbedColors.SUCCESS : embedBuilder_1.EmbedColors.WARNING)
        .setTitle('\u{1F4E6} Bulk Mirror Complete')
        .setDescription(`Bulk mirror operation completed for <@${summary.targetDiscordId}>`)
        .setThumbnail(targetAvatarUrl)
        .addFields({
        name: '\u{1F4CA} Summary',
        value: [
            `\u{1F3AF} Total Allied Incidents: **${summary.totalIncidents}**`,
            `\u2705 Mirrored: **${summary.mirroredCount}**`,
            `\u23f3 Pending Confirmation: **${summary.pendingConfirmation}**`,
            `\u274c Failed: **${summary.failedCount}**`,
        ].join('\n'),
        inline: false,
    }, {
        name: 'Bulk Mirror ID',
        value: `\`${summary.bulkMirrorId.substring(0, 8)}...\``,
        inline: true,
    });
    if (summary.pendingConfirmation > 0) {
        embed.addFields({
            name: '\u26a0\uFE0F Actions Pending',
            value: `${summary.pendingConfirmation} ban action(s) require confirmation. Use \`/blacklist mirror-history\` to view and confirm pending actions.`,
            inline: false,
        });
    }
    const actionsPreview = summary.actions
        .slice(0, 3)
        .map(a => `${a.getSeverityEmoji()} ${a.actionType.toUpperCase()} from ${a.sourceGuildName ?? 'Allied Server'}`)
        .join('\n');
    if (actionsPreview) {
        embed.addFields({ name: '\u{1F4DC} Recent Actions', value: actionsPreview, inline: false });
    }
    embed.setFooter({ text: `Bulk mirror by ${moderatorUsername}` }).setTimestamp();
    return embed;
}
function buildSharingSettingsDisplayEmbed(config) {
    return new discord_js_1.EmbedBuilder()
        .setColor(embedBuilder_1.EmbedColors.SC_BLUE)
        .setTitle('\u2699\uFE0F Blacklist Sharing Settings')
        .setDescription('Current configuration for alliance-wide incident sharing')
        .addFields({
        name: '\u{1F4E4} Sharing Settings',
        value: [
            `\u26a0\uFE0F Warnings: ${config.shareWarnings ? '\u2705 Shared' : '\u274c Not shared'}`,
            `\u23f0 Timeouts: ${config.shareTimeouts ? '\u2705 Shared' : '\u274c Not shared'}`,
            `\u{1F462} Kicks: ${config.shareKicks ? '\u2705 Shared' : '\u274c Not shared'}`,
            `\u{1F528} Bans: ${config.shareBans ? '\u2705 Shared' : '\u274c Not shared'}`,
        ].join('\n'),
        inline: true,
    }, {
        name: '\u{1F4E5} Receiving Settings',
        value: (() => {
            const alertChannelDisplay = config.alertChannelId
                ? `<#${config.alertChannelId}>`
                : 'Not set';
            return [
                `\u{1F514} Receive Alerts: ${config.receiveAlerts ? '\u2705 Yes' : '\u274c No'}`,
                `\u{1F4CA} Min Alert Severity: **${config.minAlertSeverity}** (${getSeverityLabel(config.minAlertSeverity)})`,
                `\u{1F4E2} Alert Channel: ${alertChannelDisplay}`,
            ].join('\n');
        })(),
        inline: true,
    }, {
        name: '\u{1F916} Auto-Share',
        value: [
            `\u{1F504} Auto-Share: ${config.autoShareWithAllies ? '\u2705 Enabled' : '\u274c Disabled'}`,
            `\u{1F4CA} Auto-Share Min Severity: **${config.autoShareMinSeverity}** (${getSeverityLabel(config.autoShareMinSeverity)})`,
        ].join('\n'),
        inline: true,
    }, {
        name: '\u26a1 Auto-Enforce',
        value: [
            `\u{1F527} Auto-Enforce: ${config.autoEnforceEnabled ? '\u2705 Enabled' : '\u274c Disabled'}`,
            `\u23f0 Timeouts: ${config.autoEnforceTimeouts ? '\u2705 Auto' : '\u274c Manual'}`,
            `\u{1F462} Kicks: ${config.autoEnforceKicks ? '\u2705 Auto' : '\u274c Manual'}`,
            `\u{1F528} Bans: \u274c Always Manual`,
        ].join('\n'),
        inline: true,
    })
        .setFooter({ text: 'Use /blacklist settings with options to update' })
        .setTimestamp();
}
function buildModerationAnalyticsEmbed(analytics) {
    const embed = new discord_js_1.EmbedBuilder()
        .setColor(embedBuilder_1.EmbedColors.SC_BLUE)
        .setTitle('\u{1F4CA} Moderation Analytics Dashboard')
        .setDescription('Comprehensive moderation statistics and insights')
        .addFields({
        name: '\u{1F4CB} Total Incidents',
        value: analytics.totalIncidents.toString(),
        inline: true,
    }, { name: '\u{1F7E2} Active', value: analytics.activeIncidents.toString(), inline: true }, { name: '\u2705 Resolved', value: analytics.resolvedIncidents.toString(), inline: true }, { name: '\u{1F310} Shared', value: analytics.sharedIncidents.toString(), inline: true }, {
        name: '\u{1F916} Auto-Detected',
        value: analytics.autoDetectedIncidents.toString(),
        inline: true,
    }, { name: '\u{1F465} Unique Targets', value: analytics.uniqueTargets.toString(), inline: true }, { name: '\u{1F4C8} Avg Severity', value: analytics.averageSeverity.toFixed(2), inline: true }, {
        name: '\u{1F46E} Unique Moderators',
        value: analytics.uniqueModerators.toString(),
        inline: true,
    })
        .setTimestamp();
    const typeBreakdown = Object.entries(analytics.byType)
        .filter(([_, count]) => count > 0)
        .map(([type, count]) => `${getTypeEmoji(type)} ${type}: ${count}`)
        .join('\n');
    if (typeBreakdown) {
        embed.addFields({ name: '\u{1F4D1} By Type', value: typeBreakdown, inline: true });
    }
    const statusBreakdown = Object.entries(analytics.byStatus)
        .filter(([_, count]) => count > 0)
        .map(([status, count]) => `${getStatusEmoji(status)} ${status}: ${count}`)
        .join('\n');
    if (statusBreakdown) {
        embed.addFields({ name: '\u{1F4CA} By Status', value: statusBreakdown, inline: true });
    }
    embed.addFields({
        name: '\u23f1\uFE0F Recent Activity',
        value: [
            `\u{1F4C5} Last 24h: **${analytics.incidentsLast24Hours}** incidents`,
            `\u{1F4C5} Last 7 days: **${analytics.incidentsLast7Days}** incidents`,
            `\u{1F4C5} Last 30 days: **${analytics.incidentsLast30Days}** incidents`,
        ].join('\n'),
        inline: false,
    });
    if (analytics.repeatOffenderCount > 0) {
        const topOffenders = analytics.repeatOffenders
            .slice(0, 3)
            .map(ro => `\u26a0\uFE0F ${ro.targetUsername ?? ro.targetDiscordId} - ${ro.totalIncidents} incidents (Risk: ${ro.riskScore}%)`)
            .join('\n');
        embed.addFields({
            name: `\u{1F504} Repeat Offenders (${analytics.repeatOffenderCount})`,
            value: topOffenders || 'None detected',
            inline: false,
        });
    }
    if (analytics.mirrorStats.totalMirrors > 0) {
        embed.addFields({
            name: '\u{1FA9E} Mirror Actions',
            value: [
                `\u{1F4CA} Total: **${analytics.mirrorStats.totalMirrors}**`,
                `\u2705 Confirmed: **${analytics.mirrorStats.confirmedMirrors}**`,
                `\u23f3 Pending: **${analytics.mirrorStats.pendingMirrors}**`,
            ].join('\n'),
            inline: true,
        });
    }
    embed.setFooter({ text: `Generated at ${analytics.generatedAt.toLocaleString()}` });
    return embed;
}
function buildIncidentReportedEmbed(incident, reason, duration, share, moderatorUsername) {
    const embed = new discord_js_1.EmbedBuilder()
        .setColor(getSeverityColor(incident.severity))
        .setTitle(`${getTypeEmoji(incident.incidentType)} Incident Reported`)
        .setDescription(`Moderation incident recorded for <@${incident.targetDiscordId}>`)
        .addFields({ name: 'Incident ID', value: `\`${incident.id.substring(0, 8)}...\``, inline: true }, {
        name: 'Type',
        value: `${getTypeEmoji(incident.incidentType)} ${incident.incidentType}`,
        inline: true,
    }, {
        name: 'Severity',
        value: `${getSeverityEmoji(incident.severity)} Level ${incident.severity}`,
        inline: true,
    }, { name: 'Reason', value: reason, inline: false });
    if (duration) {
        embed.addFields({ name: 'Duration', value: `${duration} minutes`, inline: true });
    }
    if (share) {
        embed.addFields({
            name: 'Shared',
            value: '\u{1F310} Yes - visible to other organizations',
            inline: true,
        });
    }
    embed.setFooter({ text: `Reported by ${moderatorUsername}` }).setTimestamp();
    return embed;
}
function buildCrossAllianceCheckEmbed(result, targetUsername, targetUserId, targetAvatarUrl) {
    const embed = new discord_js_1.EmbedBuilder()
        .setTitle(`\u{1F50D} Cross-Alliance Check: ${targetUsername}`)
        .setColor(getSeverityColor(result.highestSeverity))
        .setThumbnail(targetAvatarUrl)
        .setDescription(result.totalIncidents === 0
        ? '\u2705 No incidents found for this user across your organization and allies.'
        : `Found **${result.totalIncidents}** incident(s) for <@${targetUserId}>`)
        .setTimestamp();
    if (result.totalIncidents > 0) {
        embed.addFields({
            name: '\u{1F4CA} Summary',
            value: [
                `\u{1F3AF} Total Incidents: **${result.totalIncidents}**`,
                `\u{1F3E0} Your Org: **${result.ownIncidents.length}**`,
                `\u{1F91D} From Allies: **${result.alliedIncidents.length}**`,
                `${result.hasActiveIncident ? '\u{1F534}' : '\u{1F7E2}'} Active: **${result.hasActiveIncident ? 'Yes' : 'No'}**`,
                `\u26a0\uFE0F Highest Severity: ${getSeverityEmoji(result.highestSeverity)} **${getSeverityLabel(result.highestSeverity)}**`,
            ].join('\n'),
            inline: false,
        });
        if (result.ownIncidents.length > 0) {
            const ownIncidentsList = result.ownIncidents.slice(0, 3).map(formatIncident).join('\n');
            embed.addFields({
                name: "\u{1F3E0} Your Organization's Incidents",
                value: ownIncidentsList,
                inline: false,
            });
        }
        if (result.alliedIncidents.length > 0) {
            const alliedIncidentsList = result.alliedIncidents
                .slice(0, 3)
                .map(si => {
                const incident = si.incident;
                return `${getStatusEmoji(incident.status)} ${getTypeEmoji(incident.incidentType)} from **${incident.guildName ?? 'Allied Org'}** (${new Date(incident.createdAt).toLocaleDateString()})`;
            })
                .join('\n');
            embed.addFields({
                name: '\u{1F91D} Incidents from Allied Organizations',
                value: alliedIncidentsList,
                inline: false,
            });
        }
    }
    embed.setFooter({ text: `Discord ID: ${targetUserId}` });
    return embed;
}
//# sourceMappingURL=moderationEmbeds.js.map