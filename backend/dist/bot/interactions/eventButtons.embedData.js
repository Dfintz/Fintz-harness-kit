"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildEmbedDataFromActivity = buildEmbedDataFromActivity;
exports.resolveDiscordIdMap = resolveDiscordIdMap;
exports.collectUserIdsForEmbed = collectUserIdsForEmbed;
const typeorm_1 = require("typeorm");
const database_1 = require("../../config/database");
const User_1 = require("../../models/User");
const logger_1 = require("../../utils/logger");
const eventButtons_requirements_1 = require("./eventButtons.requirements");
function deduplicateShips(ships) {
    const seen = new Set();
    return ships.filter(s => {
        const key = s.id ?? `${s.ownerId}_${s.shipType}`;
        if (seen.has(key)) {
            return false;
        }
        seen.add(key);
        return true;
    });
}
function buildEmbedDataFromActivity(activity, participantsOverride, discordIdMap) {
    const uniqueShips = deduplicateShips([
        ...(activity.ships ?? []),
        ...(activity.shipAssignments ?? []),
    ]);
    const parsedRequirements = (0, eventButtons_requirements_1.parseRequiredShipTypes)(activity.requiredShipTypes);
    const shipRequestsByRole = parsedRequirements.length > 0 ? parsedRequirements : undefined;
    if (shipRequestsByRole && uniqueShips.length > 0) {
        (0, eventButtons_requirements_1.computeFilledCounts)(shipRequestsByRole, uniqueShips);
    }
    return {
        id: activity.id,
        title: activity.title,
        type: activity.activityType ?? 'event',
        status: activity.status ?? 'open',
        description: activity.description ?? undefined,
        location: activity.location ?? undefined,
        startDate: activity.scheduledStartDate ?? undefined,
        creatorId: activity.creatorId ?? undefined,
        creatorName: activity.creatorName ?? undefined,
        bannerImageUrl: activity.bannerImageUrl ?? undefined,
        voiceChannelId: activity.voiceChannelId ?? undefined,
        postedAt: activity.createdAt ?? activity.updatedAt ?? new Date(),
        updatedAt: activity.updatedAt ?? activity.createdAt ?? undefined,
        shipRequestsByRole,
        participants: (participantsOverride ?? activity.participants)?.map(p => ({
            userId: p.userId,
            userName: p.userName ?? undefined,
            discordUserId: discordIdMap?.get(p.userId) ?? undefined,
            status: p.status,
            role: p.role ?? undefined,
            shipType: p.shipType ?? undefined,
            shipName: p.shipName ?? undefined,
            crewPosition: p.crewPosition ?? undefined,
            crewShipId: p.crewShipId ?? undefined,
        })),
        ships: uniqueShips.length > 0
            ? uniqueShips.map((s) => ({
                id: s.id ?? '',
                shipType: s.shipType,
                shipName: s.shipName,
                ownerId: s.ownerId,
                ownerName: s.ownerName,
                captainId: s.captainId,
                captainName: s.captainName,
                role: s.role,
                crewCapacity: s.crewCapacity,
                crewAssigned: s.crewAssigned,
                crewMembers: (s.crewMembers ?? s.crew ?? []).map(c => ({
                    userId: c.userId,
                    userName: c.userName,
                    position: c.position,
                    discordUserId: discordIdMap?.get(c.userId) ?? undefined,
                })),
                status: s.status,
                loanerShip: ('loanerShip' in s ? s.loanerShip : undefined) ??
                    (('metadata' in s &&
                        s.metadata?.loanerShip) ||
                        undefined),
                cargo: ('cargo' in s ? s.cargo : undefined) ??
                    ('metadata' in s &&
                        typeof s.metadata?.cargoCapacity ===
                            'number'
                        ? s.metadata.cargoCapacity
                        : undefined),
                vehicleCargo: 'vehicleCargo' in s ? s.vehicleCargo : undefined,
                hangarSize: 'hangarSize' in s ? s.hangarSize : undefined,
                fleetId: 'fleetId' in s ? s.fleetId : undefined,
                fleetName: 'fleetName' in s ? s.fleetName : undefined,
                parentShipId: 'parentShipId' in s ? s.parentShipId : undefined,
                isTransported: 'isTransported' in s ? s.isTransported : undefined,
                transportType: 'transportType' in s
                    ? s
                        .transportType
                    : undefined,
                passengers: 'passengers' in s
                    ? s.passengers
                    : undefined,
            }))
            : undefined,
        roleRequirements: activity.roleRequirements,
        maxParticipants: activity.maxParticipants ?? undefined,
    };
}
async function resolveDiscordIdMap(userIds) {
    const map = new Map();
    const unique = [...new Set(userIds.filter(Boolean))];
    if (unique.length === 0) {
        return map;
    }
    try {
        const userRepo = database_1.AppDataSource.getRepository(User_1.User);
        const uuids = unique.filter(id => id.includes('-'));
        const snowflakes = unique.filter(id => !id.includes('-') && /^\d+$/.test(id));
        if (uuids.length > 0) {
            const byId = await userRepo.find({
                where: { id: (0, typeorm_1.In)(uuids) },
                select: ['id', 'discordId'],
            });
            for (const u of byId) {
                if (u.discordId) {
                    map.set(u.id, u.discordId);
                }
            }
        }
        if (snowflakes.length > 0) {
            const byDiscord = await userRepo.find({
                where: { discordId: (0, typeorm_1.In)(snowflakes) },
                select: ['id', 'discordId'],
            });
            for (const u of byDiscord) {
                if (u.discordId) {
                    map.set(u.discordId, u.discordId);
                    map.set(u.id, u.discordId);
                }
            }
        }
    }
    catch (err) {
        logger_1.logger.warn('Failed to resolve Discord IDs for embed mentions', {
            error: err instanceof Error ? err.message : String(err),
            userCount: unique.length,
        });
    }
    return map;
}
function collectUserIdsForEmbed(activity, participants) {
    const ids = participants.map(p => p.userId);
    const ships = [
        ...(activity.ships ?? []),
        ...(activity.shipAssignments ?? []),
    ];
    for (const s of ships) {
        for (const c of s.crewMembers ?? s.crew ?? []) {
            if (c.userId) {
                ids.push(c.userId);
            }
        }
    }
    return ids;
}
//# sourceMappingURL=eventButtons.embedData.js.map