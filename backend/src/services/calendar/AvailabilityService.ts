/**
 * AvailabilityService — Group scheduling & availability (Wave 2.4)
 *
 * Provides:
 * - Bulk upsert of per-user availability slots
 * - Heatmap aggregation (7×24 grid)
 * - "Find best times" algorithm
 */

import type {
  BestTimeWindow,
  GroupAvailabilityHeatmap,
  HeatmapCell,
} from '@sc-fleet-manager/shared-types';
import { In, Repository } from 'typeorm';

import { AppDataSource } from '../../config/database';
import { TeamMember } from '../../models/TeamMember';
import { UserAvailability } from '../../models/UserAvailability';
import { domainEvents } from '../shared/DomainEventBus';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function minutesToTimeString(minutes: number): string {
  const h = Math.floor(minutes / 60)
    .toString()
    .padStart(2, '0');
  const m = (minutes % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}

export class AvailabilityService {
  private repo: Repository<UserAvailability>;

  constructor(repo?: Repository<UserAvailability>) {
    this.repo = repo || AppDataSource.getRepository(UserAvailability);
  }

  /**
   * Bulk-replace a user's availability for an org.
   * Deletes existing slots then inserts the new ones.
   */
  async setAvailability(
    userId: string,
    orgId: string,
    slots: Array<{
      dayOfWeek: number;
      startMinute: number;
      endMinute: number;
      isRecurring?: boolean;
      effectiveDate?: string | null;
      expiresAt?: string | null;
    }>
  ): Promise<UserAvailability[]> {
    const result = await AppDataSource.transaction(async (manager) => {
      const txRepo = manager.getRepository(UserAvailability);

      // Delete existing slots for this user+org
      await txRepo.delete({ userId, organizationId: orgId });

      if (slots.length === 0) {return [];}

      // Insert new slots
      const entities = slots.map((s) =>
        txRepo.create({
          userId,
          organizationId: orgId,
          dayOfWeek: s.dayOfWeek,
          startMinute: s.startMinute,
          endMinute: s.endMinute,
          isRecurring: s.isRecurring ?? true,
          effectiveDate: s.effectiveDate ?? undefined,
          expiresAt: s.expiresAt ?? undefined,
        })
      );

      return txRepo.save(entities);
    });

    domainEvents.emit('availability:updated', {
      userId,
      organizationId: orgId,
      slotCount: result.length,
      timestamp: new Date().toISOString(),
    });

    return result;
  }

  /**
   * Get a single user's availability for an org.
   */
  async getMyAvailability(userId: string, orgId: string): Promise<UserAvailability[]> {
    return this.repo.find({
      where: { userId, organizationId: orgId },
      order: { dayOfWeek: 'ASC', startMinute: 'ASC' },
    });
  }

  /**
   * Build a 7×24 heatmap showing how many users are available per hour-block.
   * Optionally filter to members of a specific team.
   */
  async getGroupAvailability(orgId: string, teamId?: string): Promise<GroupAvailabilityHeatmap> {
    // If teamId provided, restrict to team members only
    let teamUserIds: string[] | undefined;
    if (teamId) {
      const teamMemberRepo = AppDataSource.getRepository(TeamMember);
      const members = await teamMemberRepo.find({
        where: { organizationId: orgId, teamId, status: 'active' as const },
        select: ['userId'],
      });
      teamUserIds = members.map(m => m.userId);
      if (teamUserIds.length === 0) {
        return { orgId, totalMembers: 0, cells: this.buildEmptyGrid() };
      }
    }

    // Count distinct users who have any availability (filtered by team if applicable)
    const qb = this.repo
      .createQueryBuilder('a')
      .select('COUNT(DISTINCT a.userId)', 'cnt')
      .where('a.organizationId = :orgId', { orgId });
    if (teamUserIds) {
      qb.andWhere('a.userId IN (:...userIds)', { userIds: teamUserIds });
    }
    const totalResult = await qb.getRawOne();
    const totalMembers = parseInt(totalResult?.cnt || '0', 10);

    // Get slots (filtered by team if applicable)
    let slots: UserAvailability[];
    if (teamUserIds) {
      slots = await this.repo.find({
        where: { organizationId: orgId, userId: In(teamUserIds) },
      });
    } else {
      slots = await this.repo.find({
        where: { organizationId: orgId },
      });
    }

    // Build a 7×24 grid
    const grid: Record<string, Set<string>> = {};
    for (let d = 0; d < 7; d++) {
      for (let h = 0; h < 24; h++) {
        grid[`${d}-${h}`] = new Set<string>();
      }
    }

    // Fill the grid: for each slot, mark the hours it covers
    for (const slot of slots) {
      const startHour = Math.floor(slot.startMinute / 60);
      const endHour = Math.ceil(slot.endMinute / 60);
      for (let h = startHour; h < endHour && h < 24; h++) {
        grid[`${slot.dayOfWeek}-${h}`].add(slot.userId);
      }
    }

    const cells: HeatmapCell[] = [];
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

  /**
   * Find the top N time windows where at least `minAttendees` users are available
   * for `durationMinutes`.
   */
  async findBestTimes(
    orgId: string,
    durationMinutes: number,
    minAttendees: number,
    maxResults = 5,
    teamId?: string
  ): Promise<BestTimeWindow[]> {
    const heatmap = await this.getGroupAvailability(orgId, teamId);
    const durationHours = Math.ceil(durationMinutes / 60);

    const windows: BestTimeWindow[] = [];

    // Slide over each day, checking contiguous hour blocks
    for (let d = 0; d < 7; d++) {
      const dayCells = heatmap.cells.filter((c: HeatmapCell) => c.dayOfWeek === d);
      dayCells.sort((a: HeatmapCell, b: HeatmapCell) => a.hour - b.hour);

      for (let startH = 0; startH <= 24 - durationHours; startH++) {
        // Min availability across the window
        let minCount = Infinity;
        for (let offset = 0; offset < durationHours; offset++) {
          const cell = dayCells.find((c: HeatmapCell) => c.hour === startH + offset);
          const count = cell?.count ?? 0;
          if (count < minCount) {minCount = count;}
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

    // Sort by most available, then earliest day/time
    windows.sort((a, b) => {
      if (b.availableCount !== a.availableCount) {return b.availableCount - a.availableCount;}
      if (a.dayOfWeek !== b.dayOfWeek) {return a.dayOfWeek - b.dayOfWeek;}
      return a.startMinute - b.startMinute;
    });

    return windows.slice(0, maxResults);
  }

  /**
   * Bulk-load availability for multiple users in an org.
   * Returns a Map keyed by userId.
   */
  async getAvailabilityForUsers(
    orgId: string,
    userIds: string[]
  ): Promise<Map<string, UserAvailability[]>> {
    if (userIds.length === 0) {return new Map();}

    const slots = await this.repo.find({
      where: { organizationId: orgId, userId: In(userIds) },
      order: { dayOfWeek: 'ASC', startMinute: 'ASC' },
    });

    const map = new Map<string, UserAvailability[]>();
    for (const slot of slots) {
      const existing = map.get(slot.userId);
      if (existing) {
        existing.push(slot);
      } else {
        map.set(slot.userId, [slot]);
      }
    }

    return map;
  }

  /**
   * Build an empty 7×24 grid (used when no data is available).
   */
  private buildEmptyGrid(): HeatmapCell[] {
    const cells: HeatmapCell[] = [];
    for (let d = 0; d < 7; d++) {
      for (let h = 0; h < 24; h++) {
        cells.push({ dayOfWeek: d, hour: h, count: 0, total: 0 });
      }
    }
    return cells;
  }
}

