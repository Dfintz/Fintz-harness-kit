"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AvailabilityService = void 0;
const typeorm_1 = require("typeorm");
const database_1 = require("../../config/database");
const TeamMember_1 = require("../../models/TeamMember");
const UserAvailability_1 = require("../../models/UserAvailability");
const DomainEventBus_1 = require("../shared/DomainEventBus");
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
function minutesToTimeString(minutes) {
    const h = Math.floor(minutes / 60)
        .toString()
        .padStart(2, '0');
    const m = (minutes % 60).toString().padStart(2, '0');
    return `${h}:${m}`;
}
class AvailabilityService {
    repo;
    constructor(repo) {
        this.repo = repo || database_1.AppDataSource.getRepository(UserAvailability_1.UserAvailability);
    }
    async setAvailability(userId, orgId, slots) {
        const result = await database_1.AppDataSource.transaction(async (manager) => {
            const txRepo = manager.getRepository(UserAvailability_1.UserAvailability);
            await txRepo.delete({ userId, organizationId: orgId });
            if (slots.length === 0) {
                return [];
            }
            const entities = slots.map((s) => txRepo.create({
                userId,
                organizationId: orgId,
                dayOfWeek: s.dayOfWeek,
                startMinute: s.startMinute,
                endMinute: s.endMinute,
                isRecurring: s.isRecurring ?? true,
                effectiveDate: s.effectiveDate ?? undefined,
                expiresAt: s.expiresAt ?? undefined,
            }));
            return txRepo.save(entities);
        });
        DomainEventBus_1.domainEvents.emit('availability:updated', {
            userId,
            organizationId: orgId,
            slotCount: result.length,
            timestamp: new Date().toISOString(),
        });
        return result;
    }
    async getMyAvailability(userId, orgId) {
        return this.repo.find({
            where: { userId, organizationId: orgId },
            order: { dayOfWeek: 'ASC', startMinute: 'ASC' },
        });
    }
    async getGroupAvailability(orgId, teamId) {
        let teamUserIds;
        if (teamId) {
            const teamMemberRepo = database_1.AppDataSource.getRepository(TeamMember_1.TeamMember);
            const members = await teamMemberRepo.find({
                where: { organizationId: orgId, teamId, status: 'active' },
                select: ['userId'],
            });
            teamUserIds = members.map(m => m.userId);
            if (teamUserIds.length === 0) {
                return { orgId, totalMembers: 0, cells: this.buildEmptyGrid() };
            }
        }
        const qb = this.repo
            .createQueryBuilder('a')
            .select('COUNT(DISTINCT a.userId)', 'cnt')
            .where('a.organizationId = :orgId', { orgId });
        if (teamUserIds) {
            qb.andWhere('a.userId IN (:...userIds)', { userIds: teamUserIds });
        }
        const totalResult = await qb.getRawOne();
        const totalMembers = parseInt(totalResult?.cnt || '0', 10);
        let slots;
        if (teamUserIds) {
            slots = await this.repo.find({
                where: { organizationId: orgId, userId: (0, typeorm_1.In)(teamUserIds) },
            });
        }
        else {
            slots = await this.repo.find({
                where: { organizationId: orgId },
            });
        }
        const grid = {};
        for (let d = 0; d < 7; d++) {
            for (let h = 0; h < 24; h++) {
                grid[`${d}-${h}`] = new Set();
            }
        }
        for (const slot of slots) {
            const startHour = Math.floor(slot.startMinute / 60);
            const endHour = Math.ceil(slot.endMinute / 60);
            for (let h = startHour; h < endHour && h < 24; h++) {
                grid[`${slot.dayOfWeek}-${h}`].add(slot.userId);
            }
        }
        const cells = [];
        for (let d = 0; d < 7; d++) {
            for (let h = 0; h < 24; h++) {
                cells.push({
                    dayOfWeek: d,
                    hour: h,
                    count: grid[`${d}-${h}`].size,
                    total: totalMembers,
                });
            }
        }
        return { orgId, totalMembers, cells };
    }
    async findBestTimes(orgId, durationMinutes, minAttendees, maxResults = 5, teamId) {
        const heatmap = await this.getGroupAvailability(orgId, teamId);
        const durationHours = Math.ceil(durationMinutes / 60);
        const windows = [];
        for (let d = 0; d < 7; d++) {
            const dayCells = heatmap.cells.filter((c) => c.dayOfWeek === d);
            dayCells.sort((a, b) => a.hour - b.hour);
            for (let startH = 0; startH <= 24 - durationHours; startH++) {
                let minCount = Infinity;
                for (let offset = 0; offset < durationHours; offset++) {
                    const cell = dayCells.find((c) => c.hour === startH + offset);
                    const count = cell?.count ?? 0;
                    if (count < minCount) {
                        minCount = count;
                    }
                }
                if (minCount >= minAttendees) {
                    const startMinute = startH * 60;
                    const endMinute = Math.min((startH + durationHours) * 60, 1440);
                    windows.push({
                        dayOfWeek: d,
                        startMinute,
                        endMinute,
                        availableCount: minCount,
                        dayName: DAY_NAMES[d],
                        timeRange: `${minutesToTimeString(startMinute)} – ${minutesToTimeString(endMinute)}`,
                    });
                }
            }
        }
        windows.sort((a, b) => {
            if (b.availableCount !== a.availableCount) {
                return b.availableCount - a.availableCount;
            }
            if (a.dayOfWeek !== b.dayOfWeek) {
                return a.dayOfWeek - b.dayOfWeek;
            }
            return a.startMinute - b.startMinute;
        });
        return windows.slice(0, maxResults);
    }
    async getAvailabilityForUsers(orgId, userIds) {
        if (userIds.length === 0) {
            return new Map();
        }
        const slots = await this.repo.find({
            where: { organizationId: orgId, userId: (0, typeorm_1.In)(userIds) },
            order: { dayOfWeek: 'ASC', startMinute: 'ASC' },
        });
        const map = new Map();
        for (const slot of slots) {
            const existing = map.get(slot.userId);
            if (existing) {
                existing.push(slot);
            }
            else {
                map.set(slot.userId, [slot]);
            }
        }
        return map;
    }
    buildEmptyGrid() {
        const cells = [];
        for (let d = 0; d < 7; d++) {
            for (let h = 0; h < 24; h++) {
                cells.push({ dayOfWeek: d, hour: h, count: 0, total: 0 });
            }
        }
        return cells;
    }
}
exports.AvailabilityService = AvailabilityService;
//# sourceMappingURL=AvailabilityService.js.map