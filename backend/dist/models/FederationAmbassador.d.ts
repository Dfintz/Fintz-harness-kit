import type { FederationAmbassadorPermission, FederationAmbassadorRole } from '@sc-fleet-manager/shared-types';
import { Federation } from './Federation';
export declare class FederationAmbassador {
    id: string;
    federationId: string;
    federation?: Federation;
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
//# sourceMappingURL=FederationAmbassador.d.ts.map