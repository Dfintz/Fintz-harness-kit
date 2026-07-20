interface DefaultRoleDef {
    name: string;
    description: string;
    priority: number;
    permissions: string[];
    isSystem: boolean;
    minRankLevel: number;
}
interface RankDef {
    level: number;
    name: string;
    priority: number;
    description: string;
}
export interface SeedDefaultsResult {
    rolesCreated: number;
    teamsCreated: number;
    rsiMappingsCreated: number;
    skipped: boolean;
}
export declare class OrgDefaultsService {
    private readonly roleService;
    private readonly teamService;
    constructor();
    seedDefaults(organizationId: string): Promise<SeedDefaultsResult>;
    private seedRoles;
    private seedTeamHierarchy;
    private seedRsiMappings;
    static getDefaultRanks(): readonly RankDef[];
    static getRankNameByLevel(level: number): string | undefined;
    static getDefaultRoles(): readonly DefaultRoleDef[];
}
export declare function getOrgDefaultsService(): OrgDefaultsService;
export {};
//# sourceMappingURL=OrgDefaultsService.d.ts.map