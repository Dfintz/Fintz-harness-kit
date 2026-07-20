import { FlagSeverity, WatchlistReason, WatchlistThreatLevel } from '@sc-fleet-manager/shared-types';
import { TenantEntity } from './base/TenantEntity';
export declare class OrgWatchlistEntry extends TenantEntity {
    id: string;
    rsiHandle: string;
    citizenName: string;
    reason: WatchlistReason;
    threatLevel: WatchlistThreatLevel;
    notes?: string;
    addedBy: string;
    createdAt: Date;
    updatedAt: Date;
    getFlagSeverity(): FlagSeverity;
    getSummary(): string;
}
//# sourceMappingURL=OrgWatchlistEntry.d.ts.map