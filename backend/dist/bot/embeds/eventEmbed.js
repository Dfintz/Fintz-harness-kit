"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RSVP_LEGEND = void 0;
exports.buildEventEmbed = buildEventEmbed;
exports.buildEventButtons = buildEventButtons;
exports.parseEventButtonId = parseEventButtonId;
exports.buildEventActionsRow = buildEventActionsRow;
exports.buildEventActionPanelComponents = buildEventActionPanelComponents;
exports.buildCancelButton = buildCancelButton;
exports.buildEventComponentRows = buildEventComponentRows;
const shared_types_1 = require("@sc-fleet-manager/shared-types");
const discord_js_1 = require("discord.js");
const urls_1 = require("../../config/urls");
const shipTaxonomy_1 = require("../constants/shipTaxonomy");
const embedBuilder_1 = require("../utils/embedBuilder");
const emojiMaps_1 = require("../utils/emojiMaps");
exports.RSVP_LEGEND = '✅ Join · ❓ Tentative · ❌ Decline · 📤 Withdraw';
function truncate(text, max) {
    return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}
function prettify(text) {
    return text
        .replaceAll('_', ' ')
        .toLowerCase()
        .replace(/\b\w/g, c => c.toUpperCase());
}
function mentionUser(p) {
    if (p.discordUserId) {
        return `<@${p.discordUserId}>`;
    }
    if (p.userName) {
        return `**${p.userName}**`;
    }
    return `User ${p.userId.slice(0, 8)}`;
}
const DISCORD_FIELD_NAME_LIMIT = 256;
const DISCORD_FIELD_VALUE_LIMIT = 1024;
function clampFieldText(text, max) {
    return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}
function withFieldBudget(field) {
    return {
        ...field,
        name: clampFieldText(field.name, DISCORD_FIELD_NAME_LIMIT),
        value: clampFieldText(field.value, DISCORD_FIELD_VALUE_LIMIT),
    };
}
function bucketParticipants(participants) {
    const list = participants ?? [];
    return {
        accepted: list.filter(p => p.status === 'accepted'),
        tentative: list.filter(p => p.status === 'standby'),
        declined: list.filter(p => p.status === 'declined'),
        waitlisted: list.filter(p => p.status === 'waitlisted'),
    };
}
function buildPositionField(maxSlots, buckets) {
    if (maxSlots > 0) {
        const progressBar = (0, embedBuilder_1.createProgressBar)(buckets.accepted.length, maxSlots, {
            width: 12,
            showPercentage: false,
        });
        return {
            name: '👥 Open Positions',
            value: `${progressBar}  **${buckets.accepted.length}** / **${maxSlots}** filled`,
            inline: false,
        };
    }
    const parts = [
        `✅ **${buckets.accepted.length}** accepted`,
        `❓ **${buckets.tentative.length}** tentative`,
        `❌ **${buckets.declined.length}** declined`,
        ...(buckets.waitlisted.length > 0 ? [`📝 **${buckets.waitlisted.length}** waitlisted`] : []),
    ];
    return {
        name: '👥 Participants',
        value: parts.join('  ·  '),
        inline: false,
    };
}
const STRICTNESS_BADGE = {
    required: ' 🔴',
    preferred: ' 🟡',
};
function formatShipRequestLine(req) {
    const emoji = (0, shipTaxonomy_1.getShipRoleEmoji)(req.role);
    const label = req.type
        ? `**${req.type}**`
        : req.role
            ? `**${req.role}** *(any type)*`
            : '**Any Ship**';
    const bar = (0, embedBuilder_1.createProgressBar)(req.filled, req.count, { width: 8, showPercentage: false });
    const badge = STRICTNESS_BADGE[req.strictness ?? ''] ?? ' 🟢';
    const loaner = req.loanerAccepted ? ' 🏷️' : '';
    return `${emoji} ${label}${badge}${loaner}  ${bar}  ${req.filled}/${req.count}`;
}
function buildCrewList(ship, indent = '') {
    if (ship.crewMembers.length === 0) {
        return `${indent}  └ *No crew assigned*`;
    }
    const crewColumns = 2;
    const crewRows = 5;
    const maxVisibleCrew = crewColumns * crewRows;
    const visibleCrewMembers = ship.crewMembers.slice(0, maxVisibleCrew);
    const leftColumn = visibleCrewMembers.slice(0, crewRows);
    const rightColumn = visibleCrewMembers.slice(crewRows, maxVisibleCrew);
    const crewRowsText = [];
    for (let row = 0; row < crewRows; row++) {
        const left = leftColumn[row];
        const right = rightColumn[row];
        if (!left && !right) {
            continue;
        }
        const leftText = left ? `${left.position}: ${mentionUser(left)}` : '';
        const rightText = right ? `${right.position}: ${mentionUser(right)}` : '';
        if (left && right) {
            crewRowsText.push(`${indent}  └ ${leftText}   │   ${rightText}`);
        }
        else {
            crewRowsText.push(`${indent}  └ ${leftText || rightText}`);
        }
    }
    const remainingCrew = Math.max(0, ship.crewMembers.length - visibleCrewMembers.length);
    if (remainingCrew <= 0) {
        return crewRowsText.join('\n');
    }
    const remainingCrewLabel = remainingCrew === 1 ? 'crew member' : 'crew members';
    return `${crewRowsText.join('\n')}\n${indent}  └ *…and ${remainingCrew} more ${remainingCrewLabel}*`;
}
function formatShipLine(ship, indent = '') {
    const crewBar = (0, embedBuilder_1.createProgressBar)(ship.crewAssigned, ship.crewCapacity, {
        width: 8,
        showPercentage: false,
    });
    const roleBadge = ship.role ? ` \`${prettify(ship.role)}\`` : '';
    const nameLabel = ship.shipName ? `**${ship.shipName}**` : `**${ship.shipType}**`;
    const typeLabel = ship.shipName ? ` (${ship.shipType})` : '';
    const badges = buildShipBadges(ship);
    const badgeLine = badges.length > 0 ? `\n${indent}  ${badges.join(' · ')}` : '';
    const crewList = buildCrewList(ship, indent);
    return `${indent}🚀 ${nameLabel}${typeLabel}${roleBadge}\n${indent}${crewBar}  ${ship.crewAssigned}/${ship.crewCapacity} crew${badgeLine}\n${crewList}`;
}
function buildShipTree(ships) {
    const childMap = new Map();
    const parentShips = [];
    const orphanChildren = [];
    for (const ship of ships) {
        if (ship.isTransported && ship.parentShipId) {
            const children = childMap.get(ship.parentShipId) ?? [];
            children.push(ship);
            childMap.set(ship.parentShipId, children);
        }
        else {
            parentShips.push(ship);
        }
    }
    for (const [parentId, children] of childMap) {
        if (!parentShips.some(p => p.id === parentId)) {
            orphanChildren.push(...children);
            childMap.delete(parentId);
        }
    }
    return { parentShips, childMap, orphanChildren };
}
function formatShipWithChildren(parent, children) {
    const parentLine = formatShipLine(parent);
    if (children.length === 0) {
        return parentLine;
    }
    const childLines = children.slice(0, 3).map(child => {
        const transportIcons = {
            hangar: '🛬',
            cargo: '📦',
            tractor_beam: '🧲',
            docking_collar: '🔗',
        };
        const transportIcon = transportIcons[child.transportType ?? ''] ?? '🔗';
        const label = child.shipName
            ? `**${child.shipName}** (${child.shipType})`
            : `**${child.shipType}**`;
        const crewInfo = child.crewCapacity > 1 ? ` — ${child.crewAssigned}/${child.crewCapacity} crew` : '';
        return `  ${transportIcon} ↳ ${label}${crewInfo}`;
    });
    const childOverflow = children.length > 3 ? `\n  *↳ +${children.length - 3} more*` : '';
    return `${parentLine}\n${childLines.join('\n')}${childOverflow}`;
}
function groupShipsByFleet(ships) {
    const grouped = new Map();
    const ungrouped = [];
    for (const ship of ships) {
        if (!ship.fleetName) {
            ungrouped.push(ship);
            continue;
        }
        const key = ship.fleetId ?? ship.fleetName;
        const existing = grouped.get(key);
        if (existing) {
            existing.ships.push(ship);
            continue;
        }
        grouped.set(key, { title: ship.fleetName, ships: [ship] });
    }
    const groups = [...grouped.values()];
    if (ungrouped.length > 0) {
        groups.push({ title: groups.length > 0 ? 'Independent Ships' : undefined, ships: ungrouped });
    }
    return groups;
}
function formatFleetShipGroup(group, childMap) {
    const shipLines = group.ships.map(ship => {
        const children = childMap.get(ship.id) ?? [];
        return formatShipWithChildren(ship, children);
    });
    if (!group.title) {
        return shipLines.join('\n\n');
    }
    return `**${group.title}**\n${shipLines.join('\n\n')}`;
}
function detectFleetCapabilities(ships) {
    const capabilities = [];
    const allTypes = ships.map(s => (s.role ?? '').toLowerCase());
    const allShipTypes = ships.map(s => s.shipType.toLowerCase());
    if (allTypes.some(t => t.includes('refuel')) ||
        allShipTypes.some(t => t.includes('starfarer') || t.includes('vulcan'))) {
        capabilities.push('⛽ Refuel');
    }
    if (allTypes.some(t => t.includes('repair')) ||
        allShipTypes.some(t => t.includes('vulcan') || t.includes('crucible'))) {
        capabilities.push('🔧 Repair');
    }
    if (allTypes.some(t => t.includes('rearm')) || allShipTypes.some(t => t.includes('vulcan'))) {
        capabilities.push('🔄 Rearm');
    }
    if (allTypes.some(t => t === 'medical' || t.includes('medical')) ||
        allShipTypes.some(t => t.includes('apollo') || t.includes('endeavor') || t.includes('cutlass red'))) {
        capabilities.push('🏥 Medical');
    }
    if (ships.some(s => s.hangarSize) ||
        allShipTypes.some(t => t.includes('carrier') || t.includes('idris') || t.includes('kraken'))) {
        capabilities.push('🛬 Carrier');
    }
    if (allTypes.some(t => t.includes('scanning')) ||
        allShipTypes.some(t => t.includes('terrapin') || t.includes('herald'))) {
        capabilities.push('📡 Scanning');
    }
    return capabilities;
}
function buildShipBadges(ship) {
    const badges = [];
    if (ship.isLoaner && ship.contributedBy) {
        badges.push(`🏷️ Loaner by ${ship.contributedBy}`);
    }
    else if (ship.loanerShip) {
        badges.push(`🏷️ Loaner: ${ship.loanerShip}`);
    }
    if (ship.isTransported && ship.transportType) {
        const transportIcon = {
            hangar: '🛬',
            cargo: '📦',
            tractor_beam: '🧲',
            docking_collar: '🔗',
        }[ship.transportType] || '🚀';
        const transportLabel = prettify(ship.transportType);
        badges.push(`${transportIcon} Transported: ${transportLabel}`);
    }
    if (ship.hangarSize) {
        badges.push(`🛬 Hangar: ${ship.hangarSize}`);
    }
    if (ship.vehicleCargo && ship.vehicleCargo > 0) {
        badges.push(`🚗 Vehicle: ${ship.vehicleCargo} SCU`);
    }
    else if (ship.cargo && ship.cargo > 0) {
        badges.push(`📦 Cargo: ${ship.cargo} SCU`);
    }
    if (ship.passengers && ship.passengers.length > 0) {
        const totalPassengers = ship.passengers.reduce((sum, p) => sum + p.filled, 0);
        const totalCapacity = ship.passengers.reduce((sum, p) => sum + p.capacity, 0);
        badges.push(`👥 Passengers: ${totalPassengers}/${totalCapacity}`);
    }
    return badges;
}
function overflow(total, shown) {
    return total > shown ? `\n*…and ${total - shown} more*` : '';
}
function formatAcceptedLines(accepted, crewUserIds) {
    return accepted
        .filter(p => !crewUserIds.has(p.userId))
        .slice(0, 15)
        .map(p => {
        const roleEmoji = p.role ? (0, emojiMaps_1.getRoleEmoji)(p.role) : '👤';
        const shipTag = p.shipName ? ` 🚀\`${truncate(p.shipName, 16)}\`` : '';
        return `${roleEmoji} ${mentionUser(p)}${shipTag}`;
    });
}
const VISIBILITY_LABELS = {
    organization: '🏢 Org Only',
    cross_org: '🤝 Cross-Org',
    alliance: '🔗 Alliance',
    private: '🔒 Private',
    listed: '📋 Listed',
};
function getVisibilityLabel(visibility) {
    if (!visibility || visibility === 'public') {
        return null;
    }
    return VISIBILITY_LABELS[visibility.toLowerCase()] ?? `🔒 ${prettify(visibility)}`;
}
function buildWebEventUrl(eventId, visibility) {
    const baseUrl = (0, urls_1.getFrontendUrl)().replace(/\/+$/, '');
    const normalizedVisibility = visibility?.toLowerCase();
    const eventPath = normalizedVisibility === 'public' || normalizedVisibility === 'listed'
        ? `/opportunities/activities/${encodeURIComponent(eventId)}`
        : `/activities/${encodeURIComponent(eventId)}`;
    return `${baseUrl}${eventPath}`;
}
function buildEventEmbed(event) {
    const buckets = bucketParticipants(event.participants);
    const startDate = event.startDate ? new Date(event.startDate) : undefined;
    const typeCfg = (0, shared_types_1.getActivityTypeConfig)(event.type);
    const statusCfg = (0, shared_types_1.getActivityStatusConfig)(event.status);
    const accentColor = (0, embedBuilder_1.getActivityAccentColor)(event.focusRole || event.type);
    const infoParts = [
        `🏷️ ${typeCfg.label}`,
        statusCfg.discordBadge,
        `📍 ${(0, shared_types_1.decodeHtmlEntities)(event.location) || 'TBD'}`,
    ];
    if (event.organizationName) {
        infoParts.push(`🏢 ${(0, shared_types_1.decodeHtmlEntities)(event.organizationName)}`);
    }
    const visibilityLabel = getVisibilityLabel(event.visibility);
    if (visibilityLabel) {
        infoParts.push(visibilityLabel);
    }
    const infoLine = infoParts.join('  **·**  ');
    const descText = event.description
        ? truncate((0, shared_types_1.decodeHtmlEntities)(event.description), 200)
        : '*No description provided*';
    const builder = embedBuilder_1.SCFleetEmbed.create()
        .setColor(accentColor)
        .setTitle(`${typeCfg.emoji}  ${(0, shared_types_1.decodeHtmlEntities)(event.title)}`)
        .setDescription(`${descText}\n\n─ ─ ─ ─ ─ ─ ─ ─ ─\n${infoLine}`);
    if (event.creatorName) {
        builder.setAuthor({ name: (0, shared_types_1.decodeHtmlEntities)(event.creatorName) });
    }
    if (event.bannerImageUrl) {
        builder.setImage(event.bannerImageUrl);
    }
    builder.addFields(withFieldBudget({
        name: '🕒 When',
        value: startDate
            ? `${(0, embedBuilder_1.formatDiscordTimestamp)(startDate, embedBuilder_1.TimestampFormat.LONG_DATETIME)}  (${(0, embedBuilder_1.formatDiscordTimestamp)(startDate, embedBuilder_1.TimestampFormat.RELATIVE)})`
            : 'Not scheduled',
        inline: false,
    }));
    if (event.voiceChannelId) {
        builder.addFields(withFieldBudget({
            name: '🔊 Voice Channel',
            value: `<#${event.voiceChannelId}>`,
            inline: false,
        }));
    }
    const statsFields = [];
    if (event.payDisplay) {
        statsFields.push({ name: '💰 Pay', value: event.payDisplay, inline: true });
    }
    if (event.experienceLevel) {
        statsFields.push({
            name: '📊 Experience',
            value: prettify(String(event.experienceLevel)),
            inline: true,
        });
    }
    const webEventUrl = buildWebEventUrl(event.id, event.visibility);
    if (statsFields.length > 0) {
        builder.addFields(...statsFields.map(withFieldBudget));
    }
    builder.addFields(withFieldBudget({ name: '\u200B', value: '\u200B', inline: false }));
    builder.addFields(withFieldBudget(buildPositionField(event.maxParticipants || 0, buckets)));
    if (event.roleRequirements && event.roleRequirements.length > 0) {
        const reqLines = event.roleRequirements.map(req => {
            const needed = req.min ?? req.count ?? 1;
            const filled = buckets.accepted.filter(p => p.role === req.role).length;
            const emoji = (0, emojiMaps_1.getRoleEmoji)(req.role);
            const bar = (0, embedBuilder_1.createProgressBar)(filled, needed, { width: 8, showPercentage: false });
            return `${emoji} **${prettify(req.role)}**  ${bar}  ${filled}/${needed}`;
        });
        builder.addFields(withFieldBudget({ name: '📋 Role Requirements', value: reqLines.join('\n'), inline: false }));
    }
    const hasShipContent = (event.shipRequestsByRole && event.shipRequestsByRole.length > 0) ||
        (event.shipRequirements && event.shipRequirements.length > 0) ||
        (event.ships && event.ships.length > 0);
    if (hasShipContent) {
        builder.addFields(withFieldBudget({ name: '\u200B', value: '\u200B', inline: false }));
    }
    if (event.shipRequestsByRole && event.shipRequestsByRole.length > 0) {
        const reqLines = event.shipRequestsByRole.map(formatShipRequestLine);
        builder.addFields(withFieldBudget({
            name: '🚀 Ship Requests',
            value: `${reqLines.join('\n')}\n-# 🔴 Required  🟡 Preferred  🟢 Flexible  🏷️ Loaner OK`,
            inline: false,
        }));
    }
    const hasStructuredShips = event.shipRequestsByRole && event.shipRequestsByRole.length > 0;
    if (event.shipRequirements && event.shipRequirements.length > 0 && !hasStructuredShips) {
        const ships = event.shipRequirements.slice(0, 6);
        builder.addFields(withFieldBudget({
            name: '🚀 Ships Required',
            value: ships.map(s => `\`${s}\``).join('  ') + overflow(event.shipRequirements.length, 6),
            inline: false,
        }));
    }
    if (event.ships && event.ships.length > 0) {
        const totalCrew = event.ships.reduce((sum, s) => sum + s.crewAssigned, 0);
        const totalCapacity = event.ships.reduce((sum, s) => sum + s.crewCapacity, 0);
        const { parentShips, childMap, orphanChildren } = buildShipTree(event.ships);
        const visibleParents = [...parentShips, ...orphanChildren];
        const groupedShips = groupShipsByFleet(visibleParents.slice(0, 6));
        const shipLines = groupedShips.map(group => formatFleetShipGroup(group, childMap));
        builder.addFields(withFieldBudget({
            name: `🛸 Ships (${event.ships.length}) — ${totalCrew}/${totalCapacity} crew`,
            value: shipLines.join('\n\n━━\n\n') + overflow(visibleParents.length, 6),
            inline: false,
        }));
    }
    if (event.ships && event.ships.length > 0) {
        const capabilities = detectFleetCapabilities(event.ships);
        if (event.hasRefuelShip && !capabilities.includes('⛽ Refuel')) {
            capabilities.unshift('⛽ Refuel');
        }
        if (event.hasRepairShip && !capabilities.includes('🔧 Repair')) {
            capabilities.push('🔧 Repair');
        }
        if (event.hasRearmShip && !capabilities.includes('🔄 Rearm')) {
            capabilities.push('🔄 Rearm');
        }
        if (event.hasMedicalShip && !capabilities.includes('🏥 Medical')) {
            capabilities.push('🏥 Medical');
        }
        if (capabilities.length > 0) {
            builder.addFields(withFieldBudget({
                name: '🏷️ Fleet Capabilities',
                value: capabilities.join('  **·**  '),
                inline: false,
            }));
        }
    }
    const hasRouteData = event.totalCargoCapacity !== undefined ||
        event.totalQuantumFuel !== undefined ||
        event.maxJumpRange !== undefined ||
        event.hasRefuelShip !== undefined;
    if (hasRouteData) {
        const routeLines = [];
        if (event.totalCargoCapacity !== undefined && event.totalCargoCapacity > 0) {
            routeLines.push(`📦 **Cargo Capacity:** ${event.totalCargoCapacity.toLocaleString()} SCU`);
        }
        if (event.totalQuantumFuel !== undefined && event.totalQuantumFuelRequired !== undefined) {
            const fuelBar = (0, embedBuilder_1.createProgressBar)(event.totalQuantumFuelRequired, event.totalQuantumFuel, {
                width: 10,
                showPercentage: false,
            });
            const sufficient = event.totalQuantumFuelRequired <= event.totalQuantumFuel;
            const icon = sufficient ? '✅' : '⚠️';
            routeLines.push(`⛽ **Quantum Fuel:** ${fuelBar}  ${event.totalQuantumFuelRequired.toLocaleString()} / ${event.totalQuantumFuel.toLocaleString()} SCU ${icon}`);
        }
        else if (event.totalQuantumFuel !== undefined) {
            routeLines.push(`⛽ **Quantum Fuel:** ${event.totalQuantumFuel.toLocaleString()} SCU`);
        }
        if (event.maxJumpRange !== undefined && event.maxJumpRange > 0) {
            routeLines.push(`🎯 **Max Jump Range:** ${(event.maxJumpRange / 1000).toLocaleString()} Mkm`);
        }
        if (event.hasRefuelShip) {
            routeLines.push(`⛽ **Refuel Ship Present** (unlimited range)`);
        }
        if (routeLines.length > 0) {
            builder.addFields(withFieldBudget({
                name: '🗺️ Fleet Logistics',
                value: routeLines.join('\n'),
                inline: false,
            }));
        }
    }
    if (event.tags && event.tags.length > 0) {
        builder.addFields(withFieldBudget({
            name: '🔖 Tags',
            value: event.tags.map(t => `\`${t}\``).join('  '),
            inline: false,
        }));
    }
    if (event.languages && event.languages.length > 0) {
        builder.addFields(withFieldBudget({
            name: '🌐 Languages',
            value: event.languages.map(l => `\`${l.toUpperCase()}\``).join('  '),
            inline: true,
        }));
    }
    if (buckets.accepted.length > 0 || buckets.tentative.length > 0) {
        builder.addFields(withFieldBudget({ name: '\u200B', value: '\u200B', inline: false }));
    }
    if (buckets.accepted.length > 0) {
        const crewUserIds = new Set();
        if (event.ships) {
            for (const ship of event.ships) {
                for (const c of ship.crewMembers) {
                    crewUserIds.add(c.userId);
                }
            }
        }
        const nonCrewAccepted = buckets.accepted.filter(p => !crewUserIds.has(p.userId));
        if (nonCrewAccepted.length > 0) {
            const lines = formatAcceptedLines(buckets.accepted, crewUserIds);
            builder.addFields(withFieldBudget({
                name: `✅ Participants (${nonCrewAccepted.length})`,
                value: lines.join('\n') + overflow(nonCrewAccepted.length, 15),
                inline: true,
            }));
        }
    }
    if (buckets.tentative.length > 0) {
        const lines = buckets.tentative.slice(0, 10).map(p => `❓ ${mentionUser(p)}`);
        builder.addFields(withFieldBudget({
            name: `❓ Tentative (${buckets.tentative.length})`,
            value: lines.join('\n') + overflow(buckets.tentative.length, 10),
            inline: true,
        }));
    }
    let ownerFooterPart;
    if (event.organizationName) {
        ownerFooterPart = event.organizationName;
    }
    else if (event.creatorName) {
        ownerFooterPart = `by ${(0, shared_types_1.decodeHtmlEntities)(event.creatorName)}`;
    }
    const footerParts = [
        `ID: ${event.id}`,
        ...(ownerFooterPart ? [ownerFooterPart] : []),
        'Last updated',
        exports.RSVP_LEGEND,
    ];
    const footerTimestamp = new Date(event.updatedAt ?? event.postedAt);
    builder.setFooter({ text: footerParts.join('  •  ') }).setTimestamp(footerTimestamp);
    return builder.build().setURL(webEventUrl);
}
function buildEventButtons(activityId) {
    return new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
        .setCustomId(`event_join_${activityId}`)
        .setStyle(discord_js_1.ButtonStyle.Success)
        .setEmoji('✅'), new discord_js_1.ButtonBuilder()
        .setCustomId(`event_tentative_${activityId}`)
        .setStyle(discord_js_1.ButtonStyle.Primary)
        .setEmoji('❓'), new discord_js_1.ButtonBuilder()
        .setCustomId(`event_decline_${activityId}`)
        .setStyle(discord_js_1.ButtonStyle.Secondary)
        .setEmoji('❌'), new discord_js_1.ButtonBuilder()
        .setCustomId(`event_leave_${activityId}`)
        .setStyle(discord_js_1.ButtonStyle.Secondary)
        .setEmoji('📤'));
}
function parseEventButtonId(customId) {
    const match = /^event_(join|tentative|decline|leave|actions|bringship|removeship|joincrew|leavecrew|requestship|joinpassenger|leavepassenger|manageslots|bringfleet|remindme|edit|clone|cancel|confirmcancel|canceldismiss)_(.+)$/.exec(customId);
    if (!match) {
        return null;
    }
    return {
        action: match[1],
        activityId: match[2],
    };
}
function buildEventActionsRow(activityId) {
    return new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
        .setCustomId(`event_actions_${activityId}`)
        .setLabel('Ship & Crew')
        .setStyle(discord_js_1.ButtonStyle.Primary)
        .setEmoji('🚀'), new discord_js_1.ButtonBuilder()
        .setCustomId(`event_remindme_${activityId}`)
        .setLabel('Remind Me')
        .setStyle(discord_js_1.ButtonStyle.Secondary)
        .setEmoji('🔔'));
}
function buildEventActionPanelComponents(activityId) {
    const contributeRow = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
        .setCustomId(`event_bringship_${activityId}`)
        .setLabel('Bring Ship')
        .setStyle(discord_js_1.ButtonStyle.Primary)
        .setEmoji('🚀'), new discord_js_1.ButtonBuilder()
        .setCustomId(`event_bringfleet_${activityId}`)
        .setLabel('Bring Fleet')
        .setStyle(discord_js_1.ButtonStyle.Primary)
        .setEmoji('🛰️'), new discord_js_1.ButtonBuilder()
        .setCustomId(`event_joincrew_${activityId}`)
        .setLabel('Join Crew')
        .setStyle(discord_js_1.ButtonStyle.Success)
        .setEmoji('⚙️'), new discord_js_1.ButtonBuilder()
        .setCustomId(`event_joinpassenger_${activityId}`)
        .setLabel('Join as Passenger')
        .setStyle(discord_js_1.ButtonStyle.Success)
        .setEmoji('💺'));
    const manageRow = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
        .setCustomId(`event_manageslots_${activityId}`)
        .setLabel('Manage Slots')
        .setStyle(discord_js_1.ButtonStyle.Secondary)
        .setEmoji('🪑'), new discord_js_1.ButtonBuilder()
        .setCustomId(`event_removeship_${activityId}`)
        .setLabel('Remove Ship')
        .setStyle(discord_js_1.ButtonStyle.Danger)
        .setEmoji('🗑️'), new discord_js_1.ButtonBuilder()
        .setCustomId(`event_leavecrew_${activityId}`)
        .setLabel('Leave Crew')
        .setStyle(discord_js_1.ButtonStyle.Secondary)
        .setEmoji('⬅️'), new discord_js_1.ButtonBuilder()
        .setCustomId(`event_leavepassenger_${activityId}`)
        .setLabel('Leave Seat')
        .setStyle(discord_js_1.ButtonStyle.Secondary)
        .setEmoji('🚪'), new discord_js_1.ButtonBuilder()
        .setCustomId(`event_requestship_${activityId}`)
        .setLabel('Request Ships')
        .setStyle(discord_js_1.ButtonStyle.Secondary)
        .setEmoji('📋'));
    return [contributeRow, manageRow];
}
function buildCancelButton(activityId) {
    return new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
        .setCustomId(`event_edit_${activityId}`)
        .setLabel('Edit Event')
        .setStyle(discord_js_1.ButtonStyle.Primary)
        .setEmoji('✏️'), new discord_js_1.ButtonBuilder()
        .setCustomId(`event_mirrorcreate_${activityId}`)
        .setLabel('Mirror')
        .setStyle(discord_js_1.ButtonStyle.Secondary)
        .setEmoji('🪞'), new discord_js_1.ButtonBuilder()
        .setCustomId(`event_mirrorresync_${activityId}`)
        .setLabel('Resync')
        .setStyle(discord_js_1.ButtonStyle.Secondary)
        .setEmoji('🔄'), new discord_js_1.ButtonBuilder()
        .setCustomId(`event_clone_${activityId}`)
        .setLabel('Clone')
        .setStyle(discord_js_1.ButtonStyle.Secondary)
        .setEmoji('📋'), new discord_js_1.ButtonBuilder()
        .setCustomId(`event_cancel_${activityId}`)
        .setLabel('Cancel Event')
        .setStyle(discord_js_1.ButtonStyle.Danger)
        .setEmoji('🛑'));
}
function buildEventComponentRows(activityId, options = {}) {
    const rows = [
        buildEventButtons(activityId),
        buildEventActionsRow(activityId),
    ];
    if (options.includeManage) {
        rows.push(buildCancelButton(activityId));
    }
    return rows;
}
//# sourceMappingURL=eventEmbed.js.map