import type { FederationAmbassadorPermission, FederationAmbassadorRole } from '@sc-fleet-manager/shared-types';
export interface AmbassadorData {
    id: string;
    federationId: string;
    organizationId: string;
    organizationName: string;
    userId: string;
    userName: string;
    role: FederationAmbassadorRole;
    permissions: FederationAmbassadorPermission[];
    isActive: boolean;
    isExternal: boolean;
    title: string | null;
    appointedAt: Date;
}
export declare class FederationAmbassadorService {
    private static instance;
    private readonly ambassadorRepository;
    private readonly memberRepository;
    constructor();
    static getInstance(): FederationAmbassadorService;
    private toData;
    private validatePermissionCascade;
    listAmbassadors(federationId: string): Promise<AmbassadorData[]>;
    getAmbassador(federationId: string, ambassadorId: string): Promise<AmbassadorData | null>;
    findByUser(federationId: string, userId: string): Promise<AmbassadorData | null>;
    appointAmbassador(federationId: string, actorOrgId: string, data: {
        userId: string;
        userName: string;
        organizationId: string;
        organizationName: string;
        role?: FederationAmbassadorRole;
        permissions?: FederationAmbassadorPermission[];
        title?: string;
        isExternal?: boolean;
    }): Promise<AmbassadorData>;
    private validateUpdateConstraints;
    updateAmbassador(federationId: string, ambassadorId: string, actorOrgId: string, updates: {
        role?: FederationAmbassadorRole;
        permissions?: FederationAmbassadorPermission[];
        title?: string | null;
        isActive?: boolean;
    }): Promise<AmbassadorData | null>;
    removeAmbassador(federationId: string, ambassadorId: string, actorOrgId: string): Promise<void>;
    getMyAmbassadorProfile(federationId: string, userId: string): Promise<AmbassadorData | null>;
    hasPermission(federationId: string, userId: string, permission: FederationAmbassadorPermission): Promise<boolean>;
    getOrgAmbassadors(federationId: string, organizationId: string): Promise<AmbassadorData[]>;
}
//# sourceMappingURL=FederationAmbassadorService.d.ts.map