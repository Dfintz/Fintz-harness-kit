"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventMirrorService = exports.MIRROR_SYNC_CHANNEL = void 0;
const node_crypto_1 = __importDefault(require("node:crypto"));
const data_source_1 = require("../../data-source");
const Activity_1 = require("../../models/Activity");
const DiscordGuildSettings_1 = require("../../models/DiscordGuildSettings");
const MirroredActivity_1 = require("../../models/MirroredActivity");
const logger_1 = require("../../utils/logger");
const TenantService_1 = require("../base/TenantService");
const DEFAULT_MIRRORS_PER_ACTIVITY = 5;
const ABSOLUTE_MAX_MIRRORS = 10;
exports.MIRROR_SYNC_CHANNEL = 'mirror:rsvp:sync';
class EventMirrorService extends TenantService_1.TenantService {
    activityRepository;
    static instance = null;
    constructor() {
        super(data_source_1.AppDataSource.getRepository(MirroredActivity_1.MirroredActivity), {
            enableCache: true,
            cacheTTL: 300,
            cacheCheckPeriod: 60,
        });
        this.activityRepository = data_source_1.AppDataSource.getRepository(Activity_1.Activity);
    }
    static getInstance() {
        EventMirrorService.instance ??= new EventMirrorService();
        return EventMirrorService.instance;
    }
    async createMirror(dto) {
        const sourceActivity = await this.activityRepository.findOne({
            where: { id: dto.sourceActivityId },
        });
        if (!sourceActivity) {
            return { success: false, message: 'Source activity not found.' };
        }
        const existingMirror = await this.repository.findOne({
            where: {
                sourceActivityId: dto.sourceActivityId,
                mirrorGuildId: dto.mirrorGuildId,
                status: MirroredActivity_1.MirroredActivityStatus.ACTIVE,
            },
        });
        if (existingMirror) {
            existingMirror.mirrorChannelId = dto.mirrorChannelId;
            if (dto.mirrorKey) {
                existingMirror.mirrorKey = EventMirrorService.hashMirrorKey(dto.mirrorKey);
            }
            existingMirror.syncEnabled = true;
            const updated = await this.repository.save(existingMirror);
            logger_1.logger.info(`Event mirror reposted: source=${dto.sourceActivityId} → target guild=${dto.mirrorGuildId} (mirror=${updated.id})`);
            return {
                success: true,
                mirror: updated,
                message: 'Event mirror reposted successfully.',
            };
        }
        const maxMirrors = await this.resolveMaxMirrors(dto.sourceGuildId, dto.sourceOrganizationId);
        const existingMirrorCount = await this.repository.count({
            where: {
                sourceActivityId: dto.sourceActivityId,
                status: MirroredActivity_1.MirroredActivityStatus.ACTIVE,
            },
        });
        if (existingMirrorCount >= maxMirrors) {
            return {
                success: false,
                message: `This activity already has ${existingMirrorCount} active mirror${existingMirrorCount === 1 ? '' : 's'} (limit: ${maxMirrors}). Cancel an existing mirror first.`,
            };
        }
        let hashedMirrorKey;
        if (dto.mirrorKey) {
            hashedMirrorKey = EventMirrorService.hashMirrorKey(dto.mirrorKey);
        }
        const mirror = this.repository.create({
            sourceActivityId: dto.sourceActivityId,
            sourceGuildId: dto.sourceGuildId,
            sourceOrganizationId: dto.sourceOrganizationId,
            mirrorGuildId: dto.mirrorGuildId,
            mirrorChannelId: dto.mirrorChannelId,
            mirrorKey: hashedMirrorKey,
            organizationId: dto.targetOrganizationId,
            status: MirroredActivity_1.MirroredActivityStatus.ACTIVE,
            syncEnabled: true,
        });
        const saved = await this.repository.save(mirror);
        logger_1.logger.info(`Event mirror created: source=${dto.sourceActivityId} → target guild=${dto.mirrorGuildId} (mirror=${saved.id})`);
        return {
            success: true,
            mirror: saved,
            message: 'Event mirror created successfully.',
        };
    }
    async resolveMaxMirrors(guildId, organizationId) {
        try {
            const settingsRepo = data_source_1.AppDataSource.getRepository(DiscordGuildSettings_1.DiscordGuildSettings);
            const settings = await settingsRepo.findOne({
                where: { guildId, organizationId },
            });
            const configured = settings?.eventSettings?.maxMirrorsPerActivity;
            if (configured !== null && configured !== undefined && Number.isFinite(configured)) {
                return Math.max(1, Math.min(configured, ABSOLUTE_MAX_MIRRORS));
            }
        }
        catch (err) {
            logger_1.logger.warn('Failed to resolve max mirrors setting, using default', {
                guildId,
                error: String(err),
            });
        }
        return DEFAULT_MIRRORS_PER_ACTIVITY;
    }
    async getMirrorsForEvent(sourceActivityId) {
        return this.repository.find({
            where: {
                sourceActivityId,
                status: MirroredActivity_1.MirroredActivityStatus.ACTIVE,
            },
            order: { createdAt: 'ASC' },
        });
    }
    async getMirrorsForGuild(guildId) {
        return this.repository.find({
            where: {
                mirrorGuildId: guildId,
                status: MirroredActivity_1.MirroredActivityStatus.ACTIVE,
            },
            order: { createdAt: 'DESC' },
        });
    }
    async findMirror(sourceActivityId, mirrorGuildId) {
        return this.repository.findOne({
            where: {
                sourceActivityId,
                mirrorGuildId,
                status: MirroredActivity_1.MirroredActivityStatus.ACTIVE,
            },
        });
    }
    async findRelatedMirrors(activityId) {
        return this.repository.find({
            where: [
                { sourceActivityId: activityId, status: MirroredActivity_1.MirroredActivityStatus.ACTIVE },
                { mirrorActivityId: activityId, status: MirroredActivity_1.MirroredActivityStatus.ACTIVE },
            ],
        });
    }
    async setMirrorMessageId(mirrorId, messageId) {
        await this.repository.update(mirrorId, {
            mirrorMessageId: messageId,
        });
    }
    async setMirrorActivityId(mirrorId, mirrorActivityId) {
        await this.repository.update(mirrorId, {
            mirrorActivityId,
        });
    }
    async recordSync(mirrorId) {
        await this.repository.update(mirrorId, {
            lastSyncAt: new Date(),
        });
    }
    async cancelMirror(mirrorId) {
        const mirror = await this.repository.findOne({ where: { id: mirrorId } });
        if (!mirror) {
            return { success: false, message: 'Mirror not found.' };
        }
        mirror.status = MirroredActivity_1.MirroredActivityStatus.CANCELLED;
        mirror.syncEnabled = false;
        await this.repository.save(mirror);
        logger_1.logger.info(`Event mirror cancelled: ${mirrorId}`);
        return { success: true, mirror, message: 'Mirror cancelled.' };
    }
    async expireMirrorsForEvent(sourceActivityId) {
        const result = await this.repository.update({
            sourceActivityId,
            status: MirroredActivity_1.MirroredActivityStatus.ACTIVE,
        }, {
            status: MirroredActivity_1.MirroredActivityStatus.EXPIRED,
            syncEnabled: false,
        });
        const affected = result.affected ?? 0;
        if (affected > 0) {
            logger_1.logger.info(`Expired ${affected} mirrors for event ${sourceActivityId}`);
        }
        return affected;
    }
    async setEventMirrorKey(activityId, rawKey) {
        const activity = await this.activityRepository.findOne({
            where: { id: activityId },
        });
        if (!activity) {
            return { success: false, message: 'Activity not found.' };
        }
        const hashedKey = EventMirrorService.hashMirrorKey(rawKey);
        activity.metadata = {
            ...activity.metadata,
            mirrorKeyHash: hashedKey,
        };
        await this.activityRepository.save(activity);
        logger_1.logger.info(`Mirror key set for event ${activityId}`);
        return { success: true, message: 'Mirror key set successfully.' };
    }
    async validateMirrorKey(activityId, rawKey) {
        const activity = await this.activityRepository.findOne({
            where: { id: activityId },
        });
        if (!activity?.metadata) {
            return false;
        }
        const storedHash = activity.metadata.mirrorKeyHash;
        if (!storedHash) {
            return true;
        }
        return storedHash === EventMirrorService.hashMirrorKey(rawKey);
    }
    async generateInviteCode(activityId, mirrorKey) {
        const activity = await this.activityRepository.findOne({
            where: { id: activityId },
        });
        if (!activity) {
            return { success: false, message: 'Activity not found.' };
        }
        const code = EventMirrorService.createInviteCode();
        const existing = await this.findActivityByInviteCode(code);
        if (existing) {
            const retryCode = EventMirrorService.createInviteCode();
            activity.metadata = {
                ...activity.metadata,
                mirrorInviteCode: retryCode,
                ...(mirrorKey ? { mirrorKeyHash: EventMirrorService.hashMirrorKey(mirrorKey) } : {}),
            };
            await this.activityRepository.save(activity);
            logger_1.logger.info(`Mirror invite code generated for event ${activityId}: ${retryCode}`);
            return { success: true, inviteCode: retryCode, message: 'Invite code created.' };
        }
        activity.metadata = {
            ...activity.metadata,
            mirrorInviteCode: code,
            ...(mirrorKey ? { mirrorKeyHash: EventMirrorService.hashMirrorKey(mirrorKey) } : {}),
        };
        await this.activityRepository.save(activity);
        logger_1.logger.info(`Mirror invite code generated for event ${activityId}: ${code}`);
        return { success: true, inviteCode: code, message: 'Invite code created.' };
    }
    async findActivityByInviteCode(inviteCode) {
        return this.activityRepository
            .createQueryBuilder('activity')
            .where('activity.metadata IS NOT NULL')
            .andWhere("(activity.metadata::jsonb)->>'mirrorInviteCode' = :code", {
            code: inviteCode.toUpperCase().trim(),
        })
            .getOne();
    }
    static createInviteCode() {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let suffix = '';
        const bytes = node_crypto_1.default.randomBytes(4);
        for (let i = 0; i < 4; i++) {
            suffix += chars[bytes[i] % chars.length];
        }
        return `FLEET-${suffix}`;
    }
    static hashMirrorKey(rawKey) {
        return node_crypto_1.default.createHash('sha256').update(rawKey).digest('hex');
    }
    static resetInstance() {
        EventMirrorService.instance = null;
    }
}
exports.EventMirrorService = EventMirrorService;
//# sourceMappingURL=EventMirrorService.js.map