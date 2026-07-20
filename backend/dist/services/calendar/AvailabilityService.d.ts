import type { BestTimeWindow, GroupAvailabilityHeatmap } from '@sc-fleet-manager/shared-types';
import { Repository } from 'typeorm';
import { UserAvailability } from '../../models/UserAvailability';
export declare class AvailabilityService {
    private repo;
    constructor(repo?: Repository<UserAvailability>);
    setAvailability(userId: string, orgId: string, slots: Array<{
        dayOfWeek: number;
        startMinute: number;
        endMinute: number;
        isRecurring?: boolean;
        effectiveDate?: string | null;
        expiresAt?: string | null;
    }>): Promise<UserAvailability[]>;
    getMyAvailability(userId: string, orgId: string): Promise<UserAvailability[]>;
    getGroupAvailability(orgId: string, teamId?: string): Promise<GroupAvailabilityHeatmap>;
    findBestTimes(orgId: string, durationMinutes: number, minAttendees: number, maxResults?: number, teamId?: string): Promise<BestTimeWindow[]>;
    getAvailabilityForUsers(orgId: string, userIds: string[]): Promise<Map<string, UserAvailability[]>>;
    private buildEmptyGrid;
}
//# sourceMappingURL=AvailabilityService.d.ts.map