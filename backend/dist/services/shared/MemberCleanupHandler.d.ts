import { AvailabilityService } from '../calendar/AvailabilityService';
import { TeamService } from '../team/TeamService';
export declare class MemberCleanupHandler {
    private readonly teamService;
    private readonly availabilityService;
    private subscribed;
    constructor(teamService?: TeamService, availabilityService?: AvailabilityService);
    subscribeToEvents(): void;
    private onPlatformLeft;
}
export declare function getMemberCleanupHandler(): MemberCleanupHandler;
//# sourceMappingURL=MemberCleanupHandler.d.ts.map