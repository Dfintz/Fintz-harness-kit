type CommandRank = 'ops_commander' | 'fleet_commander' | 'squadron_leader' | 'member';
type CommandPriority = 'routine' | 'urgent' | 'critical';
type OperationCommandType = 'order' | 'preflight_check' | 'move_to' | 'hold_position' | 'engage' | 'disengage' | 'rally' | 'refuel' | 'form_up' | 'weapons_free' | 'weapons_hold' | 'custom';
interface CommandChainNode {
    userId: string;
    userName: string;
    rank: CommandRank;
    fleetId?: string;
    fleetName?: string;
    squadronName?: string;
    subordinateIds: string[];
    superiorId?: string;
}
interface OperationCommandChain {
    activityId: string;
    organizationId: string;
    commanderId: string;
    commanderName: string;
    nodes: Record<string, CommandChainNode>;
    updatedAt: string;
}
interface CommandState {
    id: string;
    activityId: string;
    organizationId: string;
    type: OperationCommandType;
    priority: CommandPriority;
    issuedBy: string;
    issuedByName: string;
    issuedByRank: CommandRank;
    targetScope: {
        type: 'all' | 'fleet' | 'squadron' | 'individual';
        fleetId?: string;
        squadronName?: string;
        userIds?: string[];
        resolvedRecipientIds: string[];
    };
    message: string;
    payload?: Record<string, unknown>;
    issuedAt: string;
    acknowledgedAt?: string;
    status: 'issued' | 'acknowledged' | 'completed' | 'cancelled';
    acknowledgements: Array<{
        userId: string;
        userName: string;
        acknowledgedAt: string;
        response?: string;
    }>;
}
export declare const VALID_COMMAND_TYPES: OperationCommandType[];
export declare class OperationCommandService {
    private readonly activityRepo;
    private readonly participantRepo;
    private readonly notificationRouter;
    setCommandChain(activityId: string, organizationId: string, userId: string, userName: string, fleetCommanders: Array<{
        userId: string;
        userName: string;
        fleetId?: string;
        fleetName?: string;
    }>, squadronLeaders: Array<{
        userId: string;
        userName: string;
        squadronName: string;
        reportsToUserId: string;
    }>): Promise<OperationCommandChain>;
    getCommandChain(activityId: string): Promise<OperationCommandChain | null>;
    issueCommand(activityId: string, organizationId: string, issuer: {
        userId: string;
        userName: string;
    }, type: OperationCommandType, message: string, targetScope: {
        type: 'all' | 'fleet' | 'squadron' | 'individual';
        fleetId?: string;
        squadronName?: string;
        userIds?: string[];
    }, options?: {
        priority?: CommandPriority;
        payload?: Record<string, unknown>;
    }): Promise<CommandState>;
    acknowledgeCommand(commandId: string, userId: string, userName: string, response?: string): Promise<CommandState>;
    getCommands(activityId: string): Promise<CommandState[]>;
    getCommand(commandId: string): Promise<CommandState | null>;
    issuePreflightCheck(activityId: string, organizationId: string, userId: string, userName: string): Promise<CommandState>;
    private loadAndVerifyActivity;
    private getAcceptedParticipantIds;
    private resolveRecipients;
    private getAllSubordinates;
}
export {};
//# sourceMappingURL=OperationCommandService.d.ts.map