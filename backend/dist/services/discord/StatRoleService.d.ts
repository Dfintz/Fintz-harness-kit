import { StatRole } from '../../models/MemberEngagement';
export interface StatRoleCreateInput {
    guildId: string;
    roleId: string;
    roleName: string;
    minMessages?: number;
    minVoiceMinutes?: number;
    windowDays?: number;
    autoRemove?: boolean;
}
export declare class StatRoleService {
    private static instance;
    private readonly repo;
    private readonly engagementService;
    constructor();
    static getInstance(): StatRoleService;
    createStatRole(input: StatRoleCreateInput): Promise<StatRole>;
    deleteStatRole(guildId: string, roleId: string): Promise<boolean>;
    getStatRolesForGuild(guildId: string): Promise<StatRole[]>;
    evaluateGuild(guildId: string): Promise<{
        roleId: string;
        addUserIds: string[];
        removeUserIds: string[];
    }[]>;
    private buildWindowCaches;
    private evaluateStatRole;
}
//# sourceMappingURL=StatRoleService.d.ts.map