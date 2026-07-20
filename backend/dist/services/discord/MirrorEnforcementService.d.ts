import { MirrorAction, MirrorActionType } from '../../models/MirrorAction';
export interface EnforcementResult {
    success: boolean;
    actionType: MirrorActionType;
    targetDiscordId: string;
    guildId: string;
    errorMessage?: string;
}
export declare class MirrorEnforcementService {
    private static instance;
    private readonly mirrorActionService;
    private constructor();
    static getInstance(): MirrorEnforcementService;
    executeAction(organizationId: string, mirrorAction: MirrorAction): Promise<EnforcementResult>;
}
//# sourceMappingURL=MirrorEnforcementService.d.ts.map