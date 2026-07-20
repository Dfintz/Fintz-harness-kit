import { Organization } from './Organization';
import { RsiSyncAuditLog } from './RsiSyncAuditLog';
export declare class RsiSyncMemberSnapshot {
    id: string;
    syncLogId: string;
    syncLog: RsiSyncAuditLog;
    organizationId: string;
    organization: Organization;
    rsiHandle: string;
    displayName?: string;
    rank?: string;
    stars: number;
    isMain: boolean;
    isAffiliate: boolean;
    isHidden: boolean;
    isRedacted: boolean;
    avatar?: string;
    enlisted?: string;
    createdAt: Date;
}
//# sourceMappingURL=RsiSyncMemberSnapshot.d.ts.map