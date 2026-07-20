export interface FederationPersonnel {
    userId: string;
    userName: string;
    organizationId: string;
    organizationName: string;
    orgRole: string;
    title: string | null;
    isAmbassador: boolean;
    ambassadorRole: string | null;
    ambassadorTitle: string | null;
    joinedAt: Date | null;
}
export interface FederationPersonnelSummary {
    totalPersonnel: number;
    byOrganization: Record<string, number>;
    totalAmbassadors: number;
}
export declare class FederationPersonnelService {
    private static instance;
    private readonly memberRepository;
    private readonly membershipRepository;
    private readonly ambassadorRepository;
    private readonly ambassadorService;
    constructor();
    static getInstance(): FederationPersonnelService;
    listPersonnel(federationId: string, userId: string): Promise<FederationPersonnel[]>;
    getPersonnelSummary(federationId: string, userId: string): Promise<FederationPersonnelSummary>;
}
//# sourceMappingURL=FederationPersonnelService.d.ts.map