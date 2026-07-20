import type { FederationAmbassadorPermission } from '@sc-fleet-manager/shared-types';
import { FederationAmbassadorService } from './FederationAmbassadorService';
export declare function requireFederationPermission(ambassadorService: FederationAmbassadorService, federationId: string, userId: string, permission: FederationAmbassadorPermission, errorMessage?: string): Promise<void>;
export declare function requireFederationViewAccess(ambassadorService: FederationAmbassadorService, federationId: string, userId: string, resourceName?: string): Promise<void>;
//# sourceMappingURL=federationPermissions.d.ts.map