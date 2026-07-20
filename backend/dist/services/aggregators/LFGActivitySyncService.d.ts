import { ActivityParticipant, ActivityStatus } from '../../models/Activity';
import { ActivityParticipantService } from '../activity/ActivityParticipantService';
import { ActivityService } from '../activity/ActivityService';
import { LFGSession, LFGSessionService, LFGSessionStatus } from '../social/LFGSessionService';
export interface LFGSyncResult {
    success: boolean;
    activityId?: string;
    sessionId: string;
    participantsSynced: number;
    statusMapped: ActivityStatus | null;
    errors: string[];
}
export interface LFGSyncOptions {
    syncParticipants?: boolean;
    creatorName?: string;
    organizationName?: string;
}
export declare class LFGActivitySyncService {
    private readonly activityService;
    private readonly participantService;
    private readonly lfgSessionService;
    constructor(activityService?: ActivityService, participantService?: ActivityParticipantService, lfgSessionService?: LFGSessionService);
    syncLFGToActivity(sessionId: string, options?: LFGSyncOptions): Promise<LFGSyncResult>;
    private buildCreateDto;
    private syncParticipantsToActivity;
    private tryUpdateActivityStatus;
    mapStatus(lfgStatus: LFGSessionStatus): ActivityStatus;
    mapParticipants(session: LFGSession): ActivityParticipant[];
    syncStatusToActivity(sessionId: string, newLfgStatus: LFGSessionStatus, hostUserId: string, activityId: string): Promise<{
        success: boolean;
        error?: string;
    }>;
}
//# sourceMappingURL=LFGActivitySyncService.d.ts.map