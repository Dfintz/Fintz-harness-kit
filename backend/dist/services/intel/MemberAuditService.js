"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MemberAuditService = void 0;
const shared_types_1 = require("@sc-fleet-manager/shared-types");
const typeorm_1 = require("typeorm");
const data_source_1 = require("../../data-source");
const MemberAuditEvent_1 = require("../../models/MemberAuditEvent");
const OrgWatchlistEntry_1 = require("../../models/OrgWatchlistEntry");
const apiErrors_1 = require("../../utils/apiErrors");
const logger_1 = require("../../utils/logger");
const websocketServer_1 = require("../../websocket/websocketServer");
const DomainEventBus_1 = require("../shared/DomainEventBus");
class MemberAuditService {
    flagRepo;
    watchlistRepo;
    subscribed = false;
    constructor() {
        this.flagRepo = data_source_1.AppDataSource.getRepository(MemberAuditEvent_1.MemberAuditEvent);
        this.watchlistRepo = data_source_1.AppDataSource.getRepository(OrgWatchlistEntry_1.OrgWatchlistEntry);
    }
    subscribeToEvents() {
        if (this.subscribed) {
            return;
        }
        this.subscribed = true;
        DomainEventBus_1.domainEvents.on('member:discord_left', p => this.onDiscordLeft(p));
        DomainEventBus_1.domainEvents.on('member:discord_role_changed', p => this.onDiscordRoleChanged(p));
        DomainEventBus_1.domainEvents.on('member:discord_timeout', p => this.onDiscordTimeout(p));
        DomainEventBus_1.domainEvents.on('member:rsi_org_left', p => this.onRsiOrgLeft(p));
        DomainEventBus_1.domainEvents.on('member:rsi_org_joined', p => this.onRsiOrgJoined(p));
        DomainEventBus_1.domainEvents.on('member:rsi_rank_changed', p => this.onRsiRankChanged(p));
        DomainEventBus_1.domainEvents.on('member:moderation_action', p => this.onModerationAction(p));
        DomainEventBus_1.domainEvents.on('member:primary_org_switched', p => this.onPrimaryOrgSwitched(p));
        DomainEventBus_1.domainEvents.on('member:platform_left', p => this.onPlatformLeft(p));
        DomainEventBus_1.domainEvents.on('member:rsi_sync_failed', p => this.onRsiSyncFailed(p));
        DomainEventBus_1.domainEvents.on('member:rsi_handle_changed', p => this.onRsiHandleChanged(p));
        DomainEventBus_1.domainEvents.on('member:rsi_org_dissolved', p => this.onRsiOrgDissolved(p));
        DomainEventBus_1.domainEvents.on('member:discord_unlinked', p => this.onDiscordUnlinked(p));
        DomainEventBus_1.domainEvents.on('team:member_removed', p => this.onTeamMemberRemoved(p));
        DomainEventBus_1.domainEvents.on('team:deleted', p => this.onTeamDeleted(p));
        DomainEventBus_1.domainEvents.on('activity:cancelled', p => this.onActivityCancelled(p));
        logger_1.logger.info('MemberAuditService: subscribed to 16 domain events');
    }
    async onDiscordLeft(p) {
        let severity;
        if (p.reason === 'ban') {
            severity = shared_types_1.FlagSeverity.CRITICAL;
        }
        else if (p.reason === 'kick') {
            severity = shared_types_1.FlagSeverity.HIGH;
        }
        else {
            severity = shared_types_1.DEFAULT_FLAG_SEVERITY[shared_types_1.MemberFlagType.DISCORD_LEFT];
        }
        await this.createFlag({
            userId: p.userId,
            organizationId: p.organizationId,
            flagType: shared_types_1.MemberFlagType.DISCORD_LEFT,
            severity,
            description: `Member left Discord server "${p.guildName}" (${p.reason ?? 'unknown reason'})`,
            metadata: {
                discordId: p.discordId,
                discordUsername: p.discordUsername,
                guildId: p.guildId,
                guildName: p.guildName,
                reason: p.reason,
            },
        });
    }
    async onDiscordRoleChanged(p) {
        await this.createFlag({
            userId: p.userId,
            organizationId: p.organizationId,
            flagType: shared_types_1.MemberFlagType.DISCORD_ROLE_CHANGED,
            description: this.buildRoleChangeDescription(p),
            metadata: {
                discordId: p.discordId,
                guildId: p.guildId,
                addedRoles: [...p.addedRoles],
                removedRoles: [...p.removedRoles],
            },
        });
    }
    async onDiscordTimeout(p) {
        await this.createFlag({
            userId: p.userId,
            organizationId: p.organizationId,
            flagType: shared_types_1.MemberFlagType.MODERATION_ACTION_RECEIVED,
            severity: shared_types_1.FlagSeverity.HIGH,
            description: this.buildTimeoutDescription(p),
            metadata: {
                discordId: p.discordId,
                guildId: p.guildId,
                guildName: p.guildName,
                durationMinutes: p.durationMinutes,
                moderatorDiscordId: p.moderatorDiscordId,
                reason: p.reason,
                source: 'discord_timeout',
            },
        });
    }
    async onRsiOrgLeft(p) {
        await this.createFlag({
            userId: p.userId,
            organizationId: p.organizationId,
            flagType: shared_types_1.MemberFlagType.RSI_ORG_LEFT,
            description: `Left RSI organization "${p.rsiOrgName}" [${p.rsiOrgSid}]`,
            metadata: {
                rsiHandle: p.rsiHandle,
                rsiOrgSid: p.rsiOrgSid,
                rsiOrgName: p.rsiOrgName,
            },
        });
    }
    async onRsiOrgJoined(p) {
        if (p.isHostile) {
            await this.createFlag({
                userId: p.userId,
                organizationId: p.organizationId,
                flagType: shared_types_1.MemberFlagType.JOINED_HOSTILE_ORG,
                severity: shared_types_1.FlagSeverity.CRITICAL,
                description: `Joined hostile RSI organization "${p.rsiOrgName}" [${p.rsiOrgSid}]`,
                metadata: {
                    rsiHandle: p.rsiHandle,
                    rsiOrgSid: p.rsiOrgSid,
                    rsiOrgName: p.rsiOrgName,
                },
            });
        }
        else if (p.isRedacted) {
            await this.createFlag({
                userId: p.userId,
                organizationId: p.organizationId,
                flagType: shared_types_1.MemberFlagType.JOINED_REDACTED_ORG,
                severity: shared_types_1.FlagSeverity.HIGH,
                description: `Joined redacted RSI organization "${p.rsiOrgName}" [${p.rsiOrgSid}]`,
                metadata: {
                    rsiHandle: p.rsiHandle,
                    rsiOrgSid: p.rsiOrgSid,
                    rsiOrgName: p.rsiOrgName,
                },
            });
        }
    }
    async onRsiRankChanged(p) {
        await this.createFlag({
            userId: p.userId,
            organizationId: p.organizationId,
            flagType: shared_types_1.MemberFlagType.RSI_RANK_CHANGED,
            description: `RSI rank changed from "${p.oldRank}" to "${p.newRank}" in [${p.rsiOrgSid}]`,
            metadata: {
                rsiHandle: p.rsiHandle,
                rsiOrgSid: p.rsiOrgSid,
                oldRank: p.oldRank,
                newRank: p.newRank,
            },
        });
    }
    async onModerationAction(p) {
        const flagType = p.isShared
            ? shared_types_1.MemberFlagType.MODERATION_ACTION_SHARED
            : shared_types_1.MemberFlagType.MODERATION_ACTION_RECEIVED;
        const severity = this.moderationSeverityToFlag(p.severity);
        await this.createFlag({
            userId: p.userId,
            organizationId: p.organizationId,
            flagType,
            severity,
            description: this.buildModerationDescription(p),
            metadata: {
                incidentId: p.incidentId,
                incidentType: p.incidentType,
                moderationSeverity: p.severity,
                moderatorId: p.moderatorId,
                isShared: p.isShared,
            },
            relatedEntityId: p.incidentId,
            relatedEntityType: 'moderation_incident',
        });
    }
    async onPrimaryOrgSwitched(p) {
        if (p.previousOrgId) {
            await this.createFlag({
                userId: p.userId,
                organizationId: p.previousOrgId,
                flagType: shared_types_1.MemberFlagType.PRIMARY_ORG_SWITCHED,
                description: `Member switched primary organization away from this org`,
                metadata: {
                    previousOrgId: p.previousOrgId,
                    newOrgId: p.newOrgId,
                },
            });
        }
    }
    async onPlatformLeft(p) {
        await this.createFlag({
            userId: p.userId,
            organizationId: p.organizationId,
            flagType: shared_types_1.MemberFlagType.PLATFORM_LEFT,
            description: `Member "${p.username}" left the platform`,
            metadata: {
                username: p.username,
            },
        });
    }
    async onRsiSyncFailed(p) {
        if (p.consecutiveFailures < 3) {
            return;
        }
        const isAccountGone = p.failureReason === 'account_not_found';
        const severity = isAccountGone ? shared_types_1.FlagSeverity.CRITICAL : shared_types_1.FlagSeverity.HIGH;
        const desc = isAccountGone
            ? `RSI account "${p.rsiHandle}" appears to be deleted (${p.consecutiveFailures} consecutive sync failures)`
            : `RSI sync failing for "${p.rsiHandle}" — ${p.failureReason} (${p.consecutiveFailures} consecutive failures)`;
        await this.createFlag({
            userId: p.userId,
            organizationId: p.organizationId,
            flagType: shared_types_1.MemberFlagType.RSI_SYNC_FAILED,
            severity,
            description: desc,
            metadata: {
                rsiHandle: p.rsiHandle,
                failureReason: p.failureReason,
                consecutiveFailures: p.consecutiveFailures,
            },
        });
    }
    async onRsiHandleChanged(p) {
        await this.createFlag({
            userId: p.userId,
            organizationId: p.organizationId,
            flagType: shared_types_1.MemberFlagType.RSI_HANDLE_CHANGED,
            description: `RSI handle changed from "${p.oldHandle}" to "${p.newHandle}"`,
            metadata: {
                oldHandle: p.oldHandle,
                newHandle: p.newHandle,
                rsiOrgSid: p.rsiOrgSid,
            },
        });
    }
    async onRsiOrgDissolved(p) {
        for (const userId of p.affectedUserIds) {
            await this.createFlag({
                userId,
                organizationId: p.organizationId,
                flagType: shared_types_1.MemberFlagType.RSI_ORG_DISSOLVED,
                description: `RSI organization "${p.rsiOrgName}" [${p.rsiOrgSid}] no longer exists`,
                metadata: {
                    rsiOrgSid: p.rsiOrgSid,
                    rsiOrgName: p.rsiOrgName,
                    totalAffected: p.affectedUserIds.length,
                },
            });
        }
    }
    async onDiscordUnlinked(p) {
        await this.createFlag({
            userId: p.userId,
            organizationId: p.organizationId,
            flagType: shared_types_1.MemberFlagType.DISCORD_UNLINKED,
            description: `Member unlinked Discord account (${p.discordUsername ?? p.discordId})`,
            metadata: {
                discordId: p.discordId,
                discordUsername: p.discordUsername,
            },
        });
    }
    async onTeamMemberRemoved(p) {
        const severity = p.reason === 'platform_left' ? shared_types_1.FlagSeverity.MEDIUM : shared_types_1.FlagSeverity.INFO;
        await this.createFlag({
            userId: p.userId,
            organizationId: p.organizationId,
            flagType: shared_types_1.MemberFlagType.TEAM_MEMBER_REMOVED,
            severity,
            description: p.reason
                ? `Member removed from team "${p.teamName}" (${p.reason})`
                : `Member removed from team "${p.teamName}"`,
            metadata: {
                teamId: p.teamId,
                teamName: p.teamName,
                reason: p.reason,
            },
        });
    }
    async onTeamDeleted(p) {
        if (p.memberCount === 0) {
            return;
        }
        await this.createFlag({
            userId: 'system',
            organizationId: p.organizationId,
            flagType: shared_types_1.MemberFlagType.TEAM_DELETED_WITH_MEMBERS,
            description: `Team "${p.teamName}" deleted with ${p.memberCount} active member${p.memberCount === 1 ? '' : 's'}`,
            metadata: {
                teamId: p.teamId,
                teamName: p.teamName,
                memberCount: p.memberCount,
            },
        });
    }
    async onActivityCancelled(p) {
        await this.createFlag({
            userId: 'system',
            organizationId: p.organizationId,
            flagType: shared_types_1.MemberFlagType.ACTIVITY_CANCELLED,
            description: [
                'Activity cancelled',
                p.reason ? `: ${p.reason}` : '',
                ` (${p.participantCount} participant${p.participantCount === 1 ? '' : 's'} affected)`,
            ].join(''),
            metadata: {
                activityId: p.activityId,
                reason: p.reason,
                participantCount: p.participantCount,
            },
        });
    }
    async createFlag(dto) {
        const flag = this.flagRepo.create({
            userId: dto.userId,
            organizationId: dto.organizationId,
            flagType: dto.flagType,
            severity: dto.severity ?? shared_types_1.DEFAULT_FLAG_SEVERITY[dto.flagType],
            status: shared_types_1.FlagStatus.OPEN,
            description: dto.description,
            metadata: dto.metadata,
            relatedEntityId: dto.relatedEntityId,
            relatedEntityType: dto.relatedEntityType,
            isAutoGenerated: dto.isAutoGenerated ?? true,
        });
        const saved = await this.flagRepo.save(flag);
        logger_1.logger.info('MemberAuditService: flag created', {
            flagId: saved.id,
            flagType: saved.flagType,
            severity: saved.severity,
            organizationId: saved.organizationId,
            userId: saved.userId,
        });
        try {
            (0, websocketServer_1.emitToOrganization)(saved.organizationId, 'intel:flag:created', {
                id: saved.id,
                userId: saved.userId,
                flagType: saved.flagType,
                severity: saved.severity,
                status: saved.status,
                description: saved.description,
                isAutoGenerated: saved.isAutoGenerated,
                createdAt: saved.createdAt.toISOString(),
            });
        }
        catch {
        }
        return saved;
    }
    async createManualFlag(organizationId, targetUserId, officerId, dto) {
        return this.createFlag({
            userId: targetUserId,
            organizationId,
            flagType: shared_types_1.MemberFlagType.MANUAL,
            severity: dto.severity,
            description: dto.description,
            metadata: {
                ...dto.metadata,
                createdByOfficer: officerId,
            },
            isAutoGenerated: false,
        });
    }
    async getFlagById(organizationId, flagId) {
        return this.flagRepo.findOne({
            where: { id: flagId, organizationId },
        });
    }
    async listFlags(organizationId, query = {}) {
        const page = Math.max(query.page ?? 1, 1);
        const pageSize = Math.min(Math.max(query.pageSize ?? 25, 1), 100);
        const skip = (page - 1) * pageSize;
        try {
            const where = { organizationId };
            if (query.userId) {
                where.userId = query.userId;
            }
            if (query.statuses?.length) {
                where.status = (0, typeorm_1.In)(query.statuses);
            }
            if (query.flagTypes?.length) {
                where.flagType = (0, typeorm_1.In)(query.flagTypes);
            }
            if (query.severities?.length) {
                where.severity = (0, typeorm_1.In)(query.severities);
            }
            if (query.isAutoGenerated !== undefined) {
                where.isAutoGenerated = query.isAutoGenerated;
            }
            const qb = this.flagRepo.createQueryBuilder('flag').where(where);
            if (query.dateFrom) {
                qb.andWhere('flag.createdAt >= :dateFrom', { dateFrom: query.dateFrom });
            }
            if (query.dateTo) {
                qb.andWhere('flag.createdAt <= :dateTo', { dateTo: query.dateTo });
            }
            const sortBy = query.sortBy ?? 'createdAt';
            const sortOrder = query.sortOrder ?? 'DESC';
            const ALLOWED_SORT = new Set([
                'createdAt',
                'updatedAt',
                'flagType',
                'severity',
                'status',
                'userId',
            ]);
            const safeSortBy = ALLOWED_SORT.has(sortBy) ? sortBy : 'createdAt';
            qb.orderBy(`flag.${safeSortBy}`, sortOrder);
            const [items, total] = await qb.skip(skip).take(pageSize).getManyAndCount();
            const totalPages = Math.ceil(total / pageSize);
            return {
                data: items.map(f => this.toSummary(f)),
                pagination: {
                    total,
                    count: items.length,
                    page,
                    pageSize,
                    hasMore: page < totalPages,
                    totalPages,
                },
            };
        }
        catch (err) {
            logger_1.logger.error('MemberAuditService.listFlags failed', {
                error: err instanceof Error ? err.message : String(err),
                stack: err instanceof Error ? err.stack : undefined,
                organizationId,
            });
            return {
                data: [],
                pagination: {
                    total: 0,
                    count: 0,
                    page,
                    pageSize,
                    hasMore: false,
                    totalPages: 0,
                },
            };
        }
    }
    async resolveFlag(organizationId, flagId, officerId, dto) {
        const flag = await this.flagRepo.findOne({
            where: { id: flagId, organizationId },
        });
        if (!flag) {
            throw new apiErrors_1.NotFoundError('Flag not found');
        }
        if (!flag.isOpen()) {
            throw new apiErrors_1.ValidationError(`Flag is already ${flag.status}`);
        }
        flag.status = dto.status;
        flag.resolvedBy = officerId;
        flag.resolvedAt = new Date();
        flag.resolutionNote = dto.resolutionNote;
        const saved = await this.flagRepo.save(flag);
        logger_1.logger.info('MemberAuditService: flag resolved', {
            flagId: saved.id,
            newStatus: saved.status,
            resolvedBy: officerId,
            organizationId,
        });
        return saved;
    }
    async getUserFlagStats(organizationId, userId) {
        try {
            const flags = await this.flagRepo.find({
                where: { organizationId, userId },
                select: ['severity', 'status', 'createdAt'],
                order: { createdAt: 'DESC' },
            });
            let highestSeverityWeight = 0;
            let highestSeverity = null;
            const counts = {
                openFlags: 0,
                resolvedFlags: 0,
                dismissedFlags: 0,
                escalatedFlags: 0,
            };
            for (const flag of flags) {
                if (flag.status === shared_types_1.FlagStatus.OPEN) {
                    counts.openFlags++;
                }
                else if (flag.status === shared_types_1.FlagStatus.RESOLVED) {
                    counts.resolvedFlags++;
                }
                else if (flag.status === shared_types_1.FlagStatus.DISMISSED) {
                    counts.dismissedFlags++;
                }
                else if (flag.status === shared_types_1.FlagStatus.ESCALATED) {
                    counts.escalatedFlags++;
                }
                const weight = MemberAuditEvent_1.MemberAuditEvent.prototype.getSeverityWeight.call(flag);
                if (weight > highestSeverityWeight) {
                    highestSeverityWeight = weight;
                    highestSeverity = flag.severity;
                }
            }
            return {
                userId,
                organizationId,
                totalFlags: flags.length,
                ...counts,
                highestSeverity,
                lastFlagAt: flags.length > 0 ? flags[0].createdAt.toISOString() : null,
            };
        }
        catch (err) {
            logger_1.logger.error('MemberAuditService.getUserFlagStats failed', {
                error: err instanceof Error ? err.message : String(err),
                stack: err instanceof Error ? err.stack : undefined,
                organizationId,
                userId,
            });
            return {
                userId,
                organizationId,
                totalFlags: 0,
                openFlags: 0,
                resolvedFlags: 0,
                dismissedFlags: 0,
                escalatedFlags: 0,
                highestSeverity: null,
                lastFlagAt: null,
            };
        }
    }
    async findWatchlistEntry(organizationId, rsiHandle) {
        return this.watchlistRepo.findOne({
            where: { organizationId, rsiHandle },
        });
    }
    moderationSeverityToFlag(numericSeverity) {
        if (numericSeverity >= 8) {
            return shared_types_1.FlagSeverity.CRITICAL;
        }
        if (numericSeverity >= 5) {
            return shared_types_1.FlagSeverity.HIGH;
        }
        if (numericSeverity >= 3) {
            return shared_types_1.FlagSeverity.MEDIUM;
        }
        return shared_types_1.FlagSeverity.INFO;
    }
    buildTimeoutDescription(p) {
        const base = `Discord timeout (${p.durationMinutes} min) in ${p.guildName}`;
        return p.reason ? `${base} — ${p.reason}` : base;
    }
    buildModerationDescription(p) {
        const prefix = p.isShared ? 'Shared moderation' : 'Moderation';
        const base = `${prefix} action: ${p.incidentType}`;
        return p.reason ? `${base} — ${p.reason}` : base;
    }
    buildRoleChangeDescription(p) {
        const parts = [];
        if (p.addedRoles.length > 0) {
            parts.push(`added: ${p.addedRoles.length} role(s)`);
        }
        if (p.removedRoles.length > 0) {
            parts.push(`removed: ${p.removedRoles.length} role(s)`);
        }
        return `Discord role change — ${parts.join(', ')}`;
    }
    toSummary(flag) {
        return {
            id: flag.id,
            userId: flag.userId,
            organizationId: flag.organizationId,
            flagType: flag.flagType,
            severity: flag.severity,
            status: flag.status,
            description: flag.description,
            metadata: flag.metadata,
            relatedEntityId: flag.relatedEntityId,
            relatedEntityType: flag.relatedEntityType,
            isAutoGenerated: flag.isAutoGenerated,
            createdAt: flag.createdAt.toISOString(),
            resolvedAt: flag.resolvedAt?.toISOString(),
            resolvedBy: flag.resolvedBy,
            resolutionNote: flag.resolutionNote,
        };
    }
}
exports.MemberAuditService = MemberAuditService;
//# sourceMappingURL=MemberAuditService.js.map