import { type ParticipationQuery, type ParticipationSummary } from '@sc-fleet-manager/shared-types';
import { ActivityService } from '../activity/ActivityService';
import { JobApplicationService } from '../organization/JobApplicationService';
import { LFGSessionService } from '../social/LFGSessionService';
import { TeamService } from '../team/TeamService';
export type { ParticipationQuery, ParticipationSummary, ParticipationSystemType, SystemParticipation } from '@sc-fleet-manager/shared-types';
export declare class UnifiedParticipantService {
    private readonly teamService;
    private readonly activityService;
    private readonly jobApplicationService;
    private readonly lfgSessionService;
    constructor(teamService?: TeamService, activityService?: ActivityService, jobApplicationService?: JobApplicationService, lfgSessionService?: LFGSessionService);
    getUserParticipationSummary(query: ParticipationQuery): Promise<ParticipationSummary>;
    private getSystemParticipation;
    private getTeamParticipation;
    private getActivityParticipation;
    private getJobParticipation;
    private getLfgParticipation;
    private buildSummary;
}
//# sourceMappingURL=UnifiedParticipantService.d.ts.map